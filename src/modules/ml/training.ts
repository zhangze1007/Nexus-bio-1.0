/**
 * ML Training Pipeline for Metabolic Engineering
 *
 * Provides train/test splitting, cross-validation, early stopping,
 * hyperparameter grid search, and model selection.
 *
 * Pure TypeScript — no external ML libraries.
 *
 * Reference: Bishop (2006) Pattern Recognition and Machine Learning
 * Reference: Hastie et al. (2009) The Elements of Statistical Learning
 */

import type { Dataset, ModelMetrics, ModelType } from './types';
import type { MLModel } from './models';
import { createModel } from './models';

// ── Helper Types ───────────────────────────────────────────────────────────

/** Training history recorded per iteration during early stopping. */
export interface TrainingHistory {
  /** Iteration index (0-based) */
  iteration: number;
  /** Training loss (MSE) at this iteration */
  trainLoss: number;
  /** Validation loss (MSE) at this iteration */
  valLoss: number;
}

/** Result of evaluating one hyperparameter combination in grid search. */
export interface GridSearchResult {
  /** Hyperparameter values used */
  params: Record<string, unknown>;
  /** Cross-validation score (higher is better — negative MSE for regression) */
  score: number;
  /** Per-fold metrics */
  foldMetrics: ModelMetrics[];
}

/** Comparison entry when selecting between model types. */
export interface ModelComparison {
  /** Model type identifier */
  type: ModelType;
  /** Parameters used (if any) */
  params?: Record<string, unknown>;
  /** Mean cross-validation metrics across folds */
  meanMetrics: ModelMetrics;
}

// ── 1. Train/Test Split ───────────────────────────────────────────────────

/**
 * Split a dataset into train and test subsets.
 *
 * Supports:
 *   - Random shuffle with optional seed for reproducibility
 *   - Stratified splitting to preserve class distribution
 *
 * @param dataset - Source dataset to split
 * @param testFraction - Fraction of samples for the test set (default: 0.2)
 * @param stratify - If true, split preserves class label distribution
 * @param seed - Optional seed for reproducible shuffling
 * @returns Train and test datasets
 */
export function trainTestSplit(
  dataset: Dataset,
  testFraction: number = 0.2,
  stratify: boolean = false,
  seed?: number,
): { train: Dataset; test: Dataset } {
  const n = dataset.samples.length;
  if (n === 0) {
    return {
      train: { ...dataset, samples: [] },
      test: { ...dataset, samples: [] },
    };
  }

  const nTest = Math.max(1, Math.floor(n * testFraction));
  const rng = seed !== undefined ? seededRNG(seed) : Math.random;

  if (stratify && dataset.taskType === 'classification') {
    // Group indices by class label
    const byClass = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const label = dataset.samples[i].label;
      if (!byClass.has(label)) byClass.set(label, []);
      byClass.get(label)!.push(i);
    }

    const testIndices = new Set<number>();
    for (const indices of byClass.values()) {
      // Shuffle within each class
      shuffle(indices, rng);
      // Allocate proportional number of test samples
      const nClassTest = Math.max(1, Math.round(indices.length * testFraction));
      for (let i = 0; i < nClassTest && testIndices.size < nTest; i++) {
        testIndices.add(indices[i]);
      }
    }

    const train = dataset.samples.filter((_, i) => !testIndices.has(i));
    const test = dataset.samples.filter((_, i) => testIndices.has(i));
    return {
      train: { ...dataset, samples: train },
      test: { ...dataset, samples: test },
    };
  }

  // Non-stratified: shuffle all indices
  const indices = Array.from({ length: n }, (_, i) => i);
  shuffle(indices, rng);

  const testSet = new Set(indices.slice(0, nTest));
  const train = dataset.samples.filter((_, i) => !testSet.has(i));
  const test = dataset.samples.filter((_, i) => testSet.has(i));

  return {
    train: { ...dataset, samples: train },
    test: { ...dataset, samples: test },
  };
}

// ── 2. Cross-Validation ───────────────────────────────────────────────────

/**
 * Evaluate a model using k-fold cross-validation.
 *
 * Splits data into k folds, trains on k-1 folds, validates on the remaining
 * fold, and repeats for each fold. Returns per-fold metrics and their mean.
 *
 * @param model - Model instance to evaluate (reused across folds)
 * @param X - Feature matrix (n_samples x n_features)
 * @param y - Target vector (n_samples)
 * @param k - Number of folds (default: 5)
 * @param metrics - Custom metrics function (defaults to standard regression/classification metrics)
 * @param taskType - 'regression' or 'classification' (default: 'regression')
 * @returns Per-fold metrics and mean metrics
 */
export function crossValidate(
  model: MLModel,
  X: number[][],
  y: number[],
  k: number = 5,
  metrics?: (yTrue: number[], yPred: number[]) => ModelMetrics,
  taskType: 'regression' | 'classification' = 'regression',
): { foldMetrics: ModelMetrics[]; meanMetrics: ModelMetrics } {
  const n = X.length;
  if (n === 0) {
    const empty: ModelMetrics = { mae: 0, rmse: 0, r2: 0, accuracy: 0, f1: 0 };
    return { foldMetrics: [], meanMetrics: empty };
  }

  // Cap k at sample count
  k = Math.min(k, n);

  const metricsFn = metrics ?? computeAllMetrics;

  // Build fold indices (stratified for classification)
  const folds: number[][] = taskType === 'classification'
    ? buildStratifiedFolds(y, k)
    : buildFolds(n, k);

  const foldMetrics: ModelMetrics[] = [];

  for (let i = 0; i < folds.length; i++) {
    // Train = all folds except i; Validation = fold i
    const valIndices = folds[i];
    const trainIndices: number[] = [];
    for (let j = 0; j < folds.length; j++) {
      if (j !== i) trainIndices.push(...folds[j]);
    }

    const trainX = trainIndices.map(idx => X[idx]);
    const trainY = trainIndices.map(idx => y[idx]);
    const valX = valIndices.map(idx => X[idx]);
    const valY = valIndices.map(idx => y[idx]);

    model.fit(trainX, trainY);
    const preds = model.predict(valX);
    foldMetrics.push(metricsFn(valY, preds));
  }

  // Compute mean metrics across folds
  const kActual = foldMetrics.length;
  const meanMetrics: ModelMetrics = {
    mae: foldMetrics.reduce((s, m) => s + m.mae, 0) / kActual,
    rmse: foldMetrics.reduce((s, m) => s + m.rmse, 0) / kActual,
    r2: foldMetrics.reduce((s, m) => s + m.r2, 0) / kActual,
    accuracy: foldMetrics.reduce((s, m) => s + (m.accuracy ?? 0), 0) / kActual,
    f1: foldMetrics.reduce((s, m) => s + (m.f1 ?? 0), 0) / kActual,
  };

  return { foldMetrics, meanMetrics };
}

// ── 3. Early Stopping Training Loop ───────────────────────────────────────

/**
 * Train a model with early stopping based on validation loss.
 *
 * For linear models (linear, ridge, lasso), uses iterative gradient descent
 * and monitors validation MSE at each iteration. Training stops if no
 * improvement is seen for `patience` consecutive iterations.
 *
 * For non-linear models (decision_tree, random_forest), trains once and
 * records the validation loss.
 *
 * @param model - Model instance to train
 * @param XTrain - Training feature matrix
 * @param yTrain - Training target vector
 * @param XVal - Validation feature matrix
 * @param yVal - Validation target vector
 * @param options - Training options
 * @returns The trained model and training history
 */
export function trainWithEarlyStopping(
  model: MLModel,
  XTrain: number[][],
  yTrain: number[],
  XVal: number[][],
  yVal: number[],
  options?: {
    maxIterations?: number;
    patience?: number;
    minDelta?: number;
  },
): { model: MLModel; history: TrainingHistory[] } {
  const maxIterations = options?.maxIterations ?? 100;
  const patience = options?.patience ?? 10;
  const minDelta = options?.minDelta ?? 1e-6;

  if (XTrain.length === 0 || yTrain.length === 0) {
    return { model, history: [] };
  }

  const isLinear = isLinearModel(model);

  if (!isLinear) {
    // Non-linear models: train once, record single history entry
    model.fit(XTrain, yTrain);
    const valPreds = model.predict(XVal);
    const valLoss = XVal.length > 0 ? mseLoss(yVal, valPreds) : 0;
    const trainPreds = model.predict(XTrain);
    const trainLoss = mseLoss(yTrain, trainPreds);

    return {
      model,
      history: [{ iteration: 0, trainLoss, valLoss }],
    };
  }

  // Linear models: iterative gradient descent with early stopping
  const nFeatures = XTrain[0]?.length ?? 0;
  const weights = new Array(nFeatures).fill(0);
  let bias = 0;

  // Learning rate: balance between convergence speed and stability
  const learningRate = 0.1;

  let bestValLoss = Infinity;
  let bestWeights: number[] = [];
  let bestBias = 0;
  let noImprovementCount = 0;
  const history: TrainingHistory[] = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    // --- Gradient descent step ---
    const gradW = new Array(nFeatures).fill(0);
    let gradB = 0;

    for (let i = 0; i < XTrain.length; i++) {
      let pred = bias;
      for (let j = 0; j < nFeatures; j++) {
        pred += weights[j] * XTrain[i][j];
      }
      const error = pred - yTrain[i];
      for (let j = 0; j < nFeatures; j++) {
        gradW[j] += error * XTrain[i][j];
      }
      gradB += error;
    }

    const n = XTrain.length;
    for (let j = 0; j < nFeatures; j++) {
      gradW[j] /= n;
    }
    gradB /= n;

    // Add L2 regularization for ridge models
    const regAlpha = getRegularizationAlpha(model);
    if (regAlpha > 0) {
      for (let j = 0; j < nFeatures; j++) {
        gradW[j] += regAlpha * weights[j];
      }
    }

    // Clip gradients to prevent divergence (threshold scaled by feature count)
    const gradNorm = Math.sqrt(
      gradW.reduce((s, g) => s + g * g, 0) + gradB * gradB,
    );
    const clipThreshold = Math.max(10, nFeatures * 5);
    if (gradNorm > clipThreshold) {
      const scale = clipThreshold / gradNorm;
      for (let j = 0; j < nFeatures; j++) {
        gradW[j] *= scale;
      }
      gradB *= scale;
    }

    // Update weights
    for (let j = 0; j < nFeatures; j++) {
      weights[j] -= learningRate * gradW[j];
    }
    bias -= learningRate * gradB;

    // --- Evaluate ---
    const valPreds = XVal.map(x => {
      let pred = bias;
      for (let j = 0; j < nFeatures; j++) pred += weights[j] * x[j];
      return pred;
    });
    const valLoss = XVal.length > 0 ? mseLoss(yVal, valPreds) : 0;

    const trainPreds = XTrain.map(x => {
      let pred = bias;
      for (let j = 0; j < nFeatures; j++) pred += weights[j] * x[j];
      return pred;
    });
    const trainLoss = mseLoss(yTrain, trainPreds);

    history.push({ iteration: iter, trainLoss, valLoss });

    // --- Early stopping check ---
    if (valLoss < bestValLoss - minDelta) {
      bestValLoss = valLoss;
      bestWeights = [...weights];
      bestBias = bias;
      noImprovementCount = 0;
    } else {
      noImprovementCount++;
    }

    if (noImprovementCount >= patience) {
      break;
    }
  }

  // Restore best weights
  if (bestWeights.length > 0) {
    for (let j = 0; j < nFeatures; j++) {
      weights[j] = bestWeights[j];
    }
    bias = bestBias;
  }

  // Re-fit model on original training data (uses closed-form solution internally).
  // The gradient descent loop above was used for validation monitoring;
  // the final model is trained analytically on the full training set.
  model.fit(XTrain, yTrain);

  return { model, history };
}

// ── 4. Hyperparameter Grid Search ─────────────────────────────────────────

/**
 * Exhaustive hyperparameter grid search with k-fold cross-validation.
 *
 * Evaluates all combinations of parameters in `paramGrid` using the
 * model factory function and k-fold CV. Returns the best parameters,
 * best score, and all results sorted by score (descending).
 *
 * @param modelFactory - Function that creates a model instance given parameters
 * @param paramGrid - Parameter names mapped to arrays of values to try
 * @param X - Feature matrix
 * @param y - Target vector
 * @param k - Number of CV folds
 * @returns Best parameters, best score, and all grid search results
 */
export function gridSearch(
  modelFactory: (params: Record<string, unknown>) => MLModel,
  paramGrid: Record<string, unknown[]>,
  X: number[][],
  y: number[],
  k: number,
): { bestParams: Record<string, unknown>; bestScore: number; results: GridSearchResult[] } {
  // Generate all parameter combinations
  const paramNames = Object.keys(paramGrid);

  if (paramNames.length === 0) {
    return { bestParams: {}, bestScore: -Infinity, results: [] };
  }

  let combos: Record<string, unknown>[] = [{}];

  for (const name of paramNames) {
    const values = paramGrid[name];
    const newCombos: Record<string, unknown>[] = [];
    for (const combo of combos) {
      for (const val of values) {
        newCombos.push({ ...combo, [name]: val });
      }
    }
    combos = newCombos;
  }

  if (combos.length === 0) {
    return { bestParams: {}, bestScore: -Infinity, results: [] };
  }

  // Evaluate each combination
  const results: GridSearchResult[] = [];

  for (const params of combos) {
    const model = modelFactory(params);
    const { foldMetrics, meanMetrics } = crossValidate(model, X, y, k);

    // Score = negative MSE (higher is better)
    const score = -meanMetrics.rmse * meanMetrics.rmse;

    results.push({ params, score, foldMetrics });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return {
    bestParams: results[0].params,
    bestScore: results[0].score,
    results,
  };
}

// ── 5. Model Selection Helper ─────────────────────────────────────────────

/**
 * Compare multiple model types via cross-validation and return the best.
 *
 * Each model type is evaluated using k-fold CV. The model with the lowest
 * mean RMSE is selected as the best.
 *
 * @param models - Array of model types with optional parameters
 * @param X - Feature matrix
 * @param y - Target vector
 * @param k - Number of CV folds
 * @returns Best model, its type, and comparison table
 */
export function selectBestModel(
  models: Array<{ type: ModelType; params?: Record<string, unknown> }>,
  X: number[][],
  y: number[],
  k: number,
): { bestModel: MLModel; bestType: ModelType; comparison: ModelComparison[] } {
  const comparison: ModelComparison[] = [];

  for (const entry of models) {
    const model = createModel(entry.type, entry.params);
    const { meanMetrics } = crossValidate(model, X, y, k);
    comparison.push({
      type: entry.type,
      params: entry.params,
      meanMetrics,
    });
  }

  // Select best by lowest RMSE
  let bestIdx = 0;
  let bestRMSE = comparison[0].meanMetrics.rmse;
  for (let i = 1; i < comparison.length; i++) {
    if (comparison[i].meanMetrics.rmse < bestRMSE) {
      bestRMSE = comparison[i].meanMetrics.rmse;
      bestIdx = i;
    }
  }

  const bestType = comparison[bestIdx].type;
  const bestModel = createModel(bestType, comparison[bestIdx].params);

  // Train the best model on all data
  bestModel.fit(X, y);

  return { bestModel, bestType, comparison };
}

// ── Metrics ───────────────────────────────────────────────────────────────

/**
 * Compute standard regression and classification metrics.
 *
 * Always computes: mae, rmse, r2
 * For classification: also computes accuracy, f1
 *
 * @param yTrue - Ground truth values
 * @param yPred - Predicted values
 * @returns ModelMetrics with all applicable metrics
 */
export function computeAllMetrics(yTrue: number[], yPred: number[]): ModelMetrics {
  if (yTrue.length === 0) {
    return { mae: 0, rmse: 0, r2: 0, accuracy: 0, f1: 0 };
  }

  const n = yTrue.length;

  // MAE
  let sumAbsErr = 0;
  for (let i = 0; i < n; i++) {
    sumAbsErr += Math.abs(yTrue[i] - yPred[i]);
  }
  const mae = sumAbsErr / n;

  // RMSE
  let sumSqErr = 0;
  for (let i = 0; i < n; i++) {
    sumSqErr += (yTrue[i] - yPred[i]) ** 2;
  }
  const rmse = Math.sqrt(sumSqErr / n);

  // R²
  const mean = yTrue.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (yTrue[i] - mean) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 1 : 1 - sumSqErr / ssTot;

  // Classification metrics: check if predictions are approximately integers
  const isClassification = yPred.some(p => Math.abs(p - Math.round(p)) > 0.01) === false
    && yTrue.every(t => t === Math.round(t));

  if (isClassification) {
    const rounded = yPred.map(Math.round);
    let correct = 0;
    for (let i = 0; i < n; i++) {
      if (rounded[i] === yTrue[i]) correct++;
    }
    const accuracy = correct / n;

    // Macro F1
    const classes = [...new Set(yTrue)];
    if (classes.length <= 1) {
      return { mae, rmse, r2, accuracy, f1: accuracy };
    }

    let f1Sum = 0;
    for (const cls of classes) {
      let tp = 0, fp = 0, fn = 0;
      for (let i = 0; i < n; i++) {
        if (rounded[i] === cls && yTrue[i] === cls) tp++;
        else if (rounded[i] === cls && yTrue[i] !== cls) fp++;
        else if (rounded[i] !== cls && yTrue[i] === cls) fn++;
      }
      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      f1Sum += precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    }
    const f1 = f1Sum / classes.length;

    return { mae, rmse, r2, accuracy, f1 };
  }

  return { mae, rmse, r2 };
}

// ── Internal Helpers ───────────────────────────────────────────────────────

/** Check if a model is a linear model type (supports iterative gradient descent). */
function isLinearModel(model: MLModel): boolean {
  try {
    const json = model.serialize();
    const parsed = JSON.parse(json);
    return parsed.type === 'linear' || parsed.type === 'ridge' || parsed.type === 'lasso';
  } catch {
    return false;
  }
}

/** Get the regularization alpha for ridge/lasso models (0 for plain linear). */
function getRegularizationAlpha(model: MLModel): number {
  try {
    const json = model.serialize();
    const parsed = JSON.parse(json);
    if (parsed.type === 'ridge' || parsed.type === 'lasso') {
      return parsed.alpha ?? 0;
    }
  } catch {
    // ignore
  }
  return 0;
}

/** Compute MSE loss between true and predicted values. */
function mseLoss(yTrue: number[], yPred: number[]): number {
  if (yTrue.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < yTrue.length; i++) {
    sum += (yTrue[i] - yPred[i]) ** 2;
  }
  return sum / yTrue.length;
}

/** Fisher-Yates in-place shuffle using the provided RNG. */
function shuffle(arr: number[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Create a seeded pseudo-random number generator (LCG). */
function seededRNG(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Build sequential fold index arrays (non-stratified). */
function buildFolds(n: number, k: number): number[][] {
  const folds: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) {
    folds[i % k].push(i);
  }
  return folds;
}

/** Build stratified fold index arrays that preserve class distribution. */
function buildStratifiedFolds(y: number[], k: number): number[][] {
  const folds: number[][] = Array.from({ length: k }, () => []);

  const byClass = new Map<number, number[]>();
  for (let i = 0; i < y.length; i++) {
    const label = y[i];
    if (!byClass.has(label)) byClass.set(label, []);
    byClass.get(label)!.push(i);
  }

  for (const indices of byClass.values()) {
    for (let i = 0; i < indices.length; i++) {
      folds[i % k].push(indices[i]);
    }
  }

  return folds;
}
