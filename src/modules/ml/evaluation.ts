/**
 * ML Evaluation Metrics for Metabolic Engineering
 *
 * Pure TypeScript implementations of regression, classification, and
 * model diagnostics metrics for assessing ML model performance.
 *
 * Metrics:
 *   1. Regression: MAE, RMSE, R², Explained Variance
 *   2. Classification: Accuracy, Precision, Recall, F1, ROC-AUC
 *   3. Residual Analysis: raw and standardized residuals
 *   4. Cross-Validation Aggregation: mean, std, min, max
 *   5. Confusion Matrix: multi-class support
 *
 * Reference: Bishop (2006) Pattern Recognition and Machine Learning
 * Reference: Hastie et al. (2009) The Elements of Statistical Learning
 */

import type { ModelMetrics } from './types';

// ── Extended Metric Types ──────────────────────────────────────────────────

/** Regression metrics including explained variance. */
export interface RegressionMetrics extends ModelMetrics {
  /** Explained variance score: 1 - Var(residuals) / Var(yTrue) */
  explainedVariance: number;
}

/** Classification metrics including precision, recall, and ROC-AUC. */
export interface ClassificationMetrics extends ModelMetrics {
  /** Precision: TP / (TP + FP) */
  precision: number;
  /** Recall (sensitivity): TP / (TP + FN) */
  recall: number;
  /** Area under the ROC curve (binary only, undefined for multi-class) */
  rocAuc?: number;
}

/** Residual analysis output. */
export interface ResidualAnalysis {
  /** Raw residuals: yTrue - yPred */
  residuals: number[];
  /** Standardized residuals: (residual - mean) / std */
  standardizedResiduals: number[];
  /** Mean of residuals */
  meanResidual: number;
  /** Standard deviation of residuals */
  stdResidual: number;
}

/** Aggregated metrics from k-fold cross-validation. */
export interface AggregatedMetrics {
  mean: ModelMetrics;
  std: ModelMetrics;
  min: ModelMetrics;
  max: ModelMetrics;
}

/** Confusion matrix output. */
export interface ConfusionMatrixResult {
  /** Confusion matrix [actual][predicted] */
  matrix: number[][];
  /** Class labels in matrix order */
  labels: number[];
}

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Compute the arithmetic mean of an array.
 * Returns 0 for empty arrays.
 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

/**
 * Compute the population variance of an array.
 * Returns 0 for arrays with fewer than 2 elements.
 */
function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += (arr[i] - m) ** 2;
  }
  return sum / arr.length;
}

/**
 * Compute the sample standard deviation of an array.
 * Uses Bessel's correction (n-1 denominator).
 * Returns 0 for arrays with fewer than 2 elements.
 */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += (arr[i] - m) ** 2;
  }
  return Math.sqrt(sum / (arr.length - 1));
}

/**
 * Compute the area under the ROC curve using the trapezoidal rule.
 *
 * Sorts samples by descending score, then walks the curve computing
 * cumulative TPR and FPR at each threshold.
 *
 * @param yTrue - Binary ground truth labels (0 or 1)
 * @param yScores - Continuous prediction scores (higher = more likely positive)
 * @returns AUC value in [0, 1]; returns 0.5 if only one class present
 */
function computeAUC(yTrue: number[], yScores: number[]): number {
  const n = yTrue.length;
  if (n === 0) return 0.5;

  // Count positives and negatives
  let nPos = 0;
  let nNeg = 0;
  for (let i = 0; i < n; i++) {
    if (yTrue[i] === 1) nPos++;
    else nNeg++;
  }

  // Degenerate: single class
  if (nPos === 0 || nNeg === 0) return 0.5;

  // Check for all tied scores — degenerate ROC curve
  const firstScore = yScores[0];
  let allTied = true;
  for (let i = 1; i < n; i++) {
    if (Math.abs(yScores[i] - firstScore) > 1e-12) {
      allTied = false;
      break;
    }
  }
  if (allTied) return 0.5;

  // Sort by descending score
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => yScores[b] - yScores[a]);

  // Walk the ROC curve
  let tp = 0;
  let fp = 0;
  let auc = 0;
  let prevTPR = 0;
  let prevFPR = 0;

  for (let i = 0; i < n; i++) {
    const idx = indices[i];
    if (yTrue[idx] === 1) {
      tp++;
    } else {
      fp++;
    }

    const tpr = tp / nPos;
    const fpr = fp / nNeg;

    // Trapezoidal rule: area = (fpr - prevFPR) * (tpr + prevTPR) / 2
    auc += (fpr - prevFPR) * (tpr + prevTPR) / 2;

    prevTPR = tpr;
    prevFPR = fpr;
  }

  return auc;
}

// ── 1. Regression Metrics ──────────────────────────────────────────────────

/**
 * Compute regression evaluation metrics.
 *
 * Metrics:
 *   - **MAE** (Mean Absolute Error): mean(|yTrue - yPred|)
 *   - **RMSE** (Root Mean Squared Error): sqrt(mean((yTrue - yPred)²))
 *   - **R²** (Coefficient of Determination): 1 - SS_res / SS_tot
 *   - **Explained Variance**: 1 - Var(yTrue - yPred) / Var(yTrue)
 *
 * @param yTrue - Ground truth values
 * @param yPred - Predicted values
 * @returns RegressionMetrics with MAE, RMSE, R², and explained variance
 */
export function computeRegressionMetrics(
  yTrue: number[],
  yPred: number[],
): RegressionMetrics {
  const n = yTrue.length;
  if (n === 0) {
    return { mae: 0, rmse: 0, r2: 0, explainedVariance: 0 };
  }

  // MAE
  let sumAbsErr = 0;
  for (let i = 0; i < n; i++) {
    sumAbsErr += Math.abs(yTrue[i] - yPred[i]);
  }
  const mae = sumAbsErr / n;

  // RMSE
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (yTrue[i] - yPred[i]) ** 2;
  }
  const rmse = Math.sqrt(ssRes / n);

  // R²
  const meanTrue = mean(yTrue);
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (yTrue[i] - meanTrue) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 1 : 1 - ssRes / ssTot;

  // Explained Variance: 1 - Var(residuals) / Var(yTrue)
  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    residuals.push(yTrue[i] - yPred[i]);
  }
  const varTrue = variance(yTrue);
  const varResiduals = variance(residuals);
  const explainedVariance = varTrue < 1e-12 ? 1 : 1 - varResiduals / varTrue;

  return { mae, rmse, r2, explainedVariance };
}

// ── 2. Classification Metrics ──────────────────────────────────────────────

/**
 * Compute classification evaluation metrics.
 *
 * Metrics:
 *   - **Accuracy**: (TP + TN) / (P + N)
 *   - **Precision**: TP / (TP + FP), macro-averaged for multi-class
 *   - **Recall**: TP / (TP + FN), macro-averaged for multi-class
 *   - **F1 Score**: 2 * Precision * Recall / (Precision + Recall), macro-averaged
 *   - **ROC-AUC**: Area under ROC curve (binary only; undefined for multi-class)
 *
 * For binary classification, class 1 is treated as the positive class.
 * For multi-class, precision/recall/F1 are macro-averaged across all classes.
 *
 * @param yTrue - Ground truth class labels
 * @param yPred - Predicted class labels
 * @returns ClassificationMetrics with accuracy, precision, recall, F1, and optional ROC-AUC
 */
export function computeClassificationMetrics(
  yTrue: number[],
  yPred: number[],
): ClassificationMetrics {
  const n = yTrue.length;
  if (n === 0) {
    return { mae: 0, rmse: 0, r2: 0, accuracy: 0, precision: 0, recall: 0, f1: 0 };
  }

  const classes = [...new Set(yTrue)].sort((a, b) => a - b);

  // Accuracy
  let correct = 0;
  for (let i = 0; i < n; i++) {
    if (yTrue[i] === yPred[i]) correct++;
  }
  const accuracy = correct / n;

  // Per-class precision, recall, F1
  let precisionSum = 0;
  let recallSum = 0;
  let f1Sum = 0;

  for (const cls of classes) {
    let tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < n; i++) {
      if (yPred[i] === cls && yTrue[i] === cls) tp++;
      else if (yPred[i] === cls && yTrue[i] !== cls) fp++;
      else if (yPred[i] !== cls && yTrue[i] === cls) fn++;
    }
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;

    precisionSum += prec;
    recallSum += rec;
    f1Sum += f1;
  }

  const nClasses = classes.length;
  const precision = precisionSum / nClasses;
  const recall = recallSum / nClasses;
  const f1 = f1Sum / nClasses;

  // ROC-AUC: only for binary classification
  let rocAuc: number | undefined;
  if (nClasses === 2) {
    // For hard labels, treat predictions as scores
    // Perfect predictions yield AUC=1; random yields ~0.5
    rocAuc = computeAUC(yTrue, yPred);
  }

  return { mae: 0, rmse: 0, r2: 0, accuracy, precision, recall, f1, rocAuc };
}

/**
 * Compute ROC-AUC for binary classification using continuous scores.
 *
 * @param yTrue - Binary ground truth labels (0 or 1)
 * @param yScores - Continuous prediction scores (higher = more likely positive)
 * @returns AUC value in [0, 1]
 */
export function computeROCAUC(yTrue: number[], yScores: number[]): number {
  return computeAUC(yTrue, yScores);
}

// ── 3. Residual Analysis ───────────────────────────────────────────────────

/**
 * Compute residual analysis for regression predictions.
 *
 * Residuals help detect outliers, heteroscedasticity, and model bias:
 *   - **Raw residual**: yTrue - yPred
 *   - **Standardized residual**: (residual - mean) / std
 *
 * Standardized residuals with |z| > 2 are potential outliers.
 *
 * @param yTrue - Ground truth values
 * @param yPred - Predicted values
 * @returns ResidualAnalysis with raw and standardized residuals
 */
export function computeResiduals(
  yTrue: number[],
  yPred: number[],
): ResidualAnalysis {
  const n = yTrue.length;
  if (n === 0) {
    return { residuals: [], standardizedResiduals: [], meanResidual: 0, stdResidual: 0 };
  }

  const residuals: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    residuals[i] = yTrue[i] - yPred[i];
  }

  const meanRes = mean(residuals);
  const stdRes = stdDev(residuals);

  const standardizedResiduals: number[] = new Array(n);
  if (stdRes < 1e-12) {
    // All residuals are identical (or nearly so)
    for (let i = 0; i < n; i++) {
      standardizedResiduals[i] = 0;
    }
  } else {
    for (let i = 0; i < n; i++) {
      standardizedResiduals[i] = (residuals[i] - meanRes) / stdRes;
    }
  }

  return {
    residuals,
    standardizedResiduals,
    meanResidual: meanRes,
    stdResidual: stdRes,
  };
}

// ── 4. Metric Aggregation for Cross-Validation ────────────────────────────

/**
 * Aggregate metrics from k-fold cross-validation.
 *
 * Computes mean, standard deviation, minimum, and maximum for each metric
 * across all folds. Useful for reporting cross-validation results with
 * uncertainty estimates.
 *
 * @param metricsList - Array of ModelMetrics from each fold
 * @returns AggregatedMetrics with mean, std, min, max
 */
export function aggregateMetrics(metricsList: ModelMetrics[]): AggregatedMetrics {
  if (metricsList.length === 0) {
    const empty: ModelMetrics = { mae: 0, rmse: 0, r2: 0 };
    return { mean: empty, std: empty, min: empty, max: empty };
  }

  const keys: (keyof ModelMetrics)[] = ['mae', 'rmse', 'r2', 'accuracy', 'f1'];

  // Use Record<string, number> so we can dynamically index by metric key.
  const meanMetrics = { mae: 0, rmse: 0, r2: 0 } as ModelMetrics & Record<string, number>;
  const stdMetrics = { mae: 0, rmse: 0, r2: 0 } as ModelMetrics & Record<string, number>;
  const minMetrics = { mae: Infinity, rmse: Infinity, r2: Infinity } as ModelMetrics & Record<string, number>;
  const maxMetrics = { mae: -Infinity, rmse: -Infinity, r2: -Infinity } as ModelMetrics & Record<string, number>;

  for (const key of keys) {
    const values: number[] = [];
    for (const m of metricsList) {
      const val = m[key];
      if (typeof val === 'number') {
        values.push(val);
      }
    }

    if (values.length > 0) {
      const m = mean(values);
      const s = stdDev(values);
      const mn = Math.min(...values);
      const mx = Math.max(...values);

      meanMetrics[key] = m;
      stdMetrics[key] = s;
      minMetrics[key] = mn;
      maxMetrics[key] = mx;
    }
  }

  return { mean: meanMetrics, std: stdMetrics, min: minMetrics, max: maxMetrics };
}

// ── 5. Confusion Matrix ───────────────────────────────────────────────────

/**
 * Compute confusion matrix for classification predictions.
 *
 * Supports both binary and multi-class classification. Matrix is indexed
 * by [actual][predicted], with labels sorted in ascending order.
 *
 * @param yTrue - Ground truth class labels
 * @param yPred - Predicted class labels
 * @returns ConfusionMatrixResult with matrix and sorted labels
 */
export function computeConfusionMatrix(
  yTrue: number[],
  yPred: number[],
): ConfusionMatrixResult {
  const n = yTrue.length;
  if (n === 0) {
    return { matrix: [], labels: [] };
  }

  // Get all unique labels from both yTrue and yPred
  const labelSet = new Set<number>();
  for (let i = 0; i < n; i++) {
    labelSet.add(yTrue[i]);
    labelSet.add(yPred[i]);
  }
  const labels = [...labelSet].sort((a, b) => a - b);

  // Create label to index mapping
  const labelToIdx = new Map<number, number>();
  for (let i = 0; i < labels.length; i++) {
    labelToIdx.set(labels[i], i);
  }

  // Build confusion matrix
  const k = labels.length;
  const matrix: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));

  for (let i = 0; i < n; i++) {
    const actualIdx = labelToIdx.get(yTrue[i])!;
    const predIdx = labelToIdx.get(yPred[i])!;
    matrix[actualIdx][predIdx]++;
  }

  return { matrix, labels };
}
