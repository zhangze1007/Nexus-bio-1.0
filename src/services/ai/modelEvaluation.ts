/**
 * AI/ML Model Evaluation Service
 *
 * Provides functions for evaluating model performance, comparing multiple
 * models, and detecting model drift. All functions are pure TypeScript
 * with no external dependencies — computations are performed in-memory.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard classification + regression metrics bundle. */
export interface ModelMetrics {
  /** Ratio of correct predictions to total predictions (0-1). */
  accuracy: number;
  /** Of all positive predictions, fraction that were truly positive (0-1). */
  precision: number;
  /** Of all actual positives, fraction that were correctly identified (0-1). */
  recall: number;
  /** Harmonic mean of precision and recall (0-1). */
  f1: number;
  /** Coefficient of determination for regression tasks (can be negative). */
  r2: number;
  /** Root mean squared error for regression tasks (>= 0). */
  rmse: number;
}

/** A single labelled data point used for evaluation. */
export interface TestDataPoint {
  /** Ground-truth label / value. */
  actual: number;
  /** Model's predicted label / value. */
  predicted: number;
  /**
   * Optional classification threshold. Points with `predicted >= threshold`
   * are treated as positive class; below as negative. Defaults to 0.5.
   */
  threshold?: number;
}

/** Ranked entry inside a comparison result. */
export interface RankedModel {
  modelId: string;
  metrics: ModelMetrics;
  /** 1-based rank (1 = best). */
  rank: number;
}

/** Result of comparing multiple models head-to-head. */
export interface ComparisonResult {
  /** Models ordered best-to-worst by composite score. */
  models: RankedModel[];
  /** The metric that had the most variance across models. */
  mostDiscriminatingMetric: keyof ModelMetrics;
}

/** Result of a drift analysis. */
export interface DriftResult {
  /** 0-1 score where 0 = no drift, 1 = maximum drift. */
  driftScore: number;
  /** Convenience flag: true when driftScore >= 0.15. */
  isDrifting: boolean;
  /** Human-readable recommendations for addressing detected drift. */
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Helpers — classification metrics from raw predictions
// ---------------------------------------------------------------------------

function classifyPairs(data: TestDataPoint[]): { tp: number; fp: number; tn: number; fn: number } {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const { actual, predicted, threshold } of data) {
    const t = threshold ?? 0.5;
    const predPositive = predicted >= t;
    const actualPositive = actual >= t;

    if (predPositive && actualPositive) tp++;
    else if (predPositive && !actualPositive) fp++;
    else if (!predPositive && !actualPositive) tn++;
    else fn++;
  }

  return { tp, fp, tn, fn };
}

function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate model performance against a labelled test set.
 *
 * Classification metrics (accuracy, precision, recall, f1) are computed by
 * thresholding predictions at 0.5 (or a per-point custom threshold).
 * Regression metrics (r2, rmse) are computed directly from the raw numeric
 * values.
 *
 * @param modelId  Identifier of the model being evaluated (used for logging).
 * @param testData Array of { actual, predicted } pairs.
 * @returns        Full metrics bundle.
 */
export async function evaluateModelPerformance(modelId: string, testData: TestDataPoint[]): Promise<ModelMetrics> {
  if (testData.length === 0) {
    throw new Error(`evaluateModelPerformance: testData must not be empty (modelId=${modelId})`);
  }

  const n = testData.length;

  // --- Classification metrics ---
  const { tp, fp, tn, fn } = classifyPairs(testData);
  const accuracy = safeDiv(tp + tn, n);
  const precision = safeDiv(tp, tp + fp);
  const recall = safeDiv(tp, tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  // --- Regression metrics ---
  const actuals = testData.map((d) => d.actual);
  const meanActual = actuals.reduce((s, v) => s + v, 0) / n;

  let ssRes = 0;
  let ssTot = 0;
  let sqErrSum = 0;

  for (const { actual, predicted } of testData) {
    const err = actual - predicted;
    ssRes += err * err;
    ssTot += (actual - meanActual) ** 2;
    sqErrSum += err * err;
  }

  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const rmse = Math.sqrt(sqErrSum / n);

  return { accuracy, precision, recall, f1, r2, rmse };
}

/**
 * Compare multiple models and rank them by a composite quality score.
 *
 * The composite score weights F1 (classification quality) and R2 (regression
 * quality) equally, penalised by RMSE normalised to the dataset range. Models
 * are ranked highest-first.
 *
 * @param modelIds     IDs to compare.
 * @param testDataMap  Map of modelId -> test data for that model.
 * @returns            Ranked comparison result.
 */
export async function compareModels(
  modelIds: string[],
  testDataMap: Record<string, TestDataPoint[]>,
): Promise<ComparisonResult> {
  if (modelIds.length === 0) {
    throw new Error("compareModels: modelIds must not be empty");
  }

  const ranked: RankedModel[] = [];

  for (const id of modelIds) {
    const data = testDataMap[id];
    if (!data || data.length === 0) {
      throw new Error(`compareModels: no test data for model "${id}"`);
    }
    const metrics = await evaluateModelPerformance(id, data);
    ranked.push({ modelId: id, metrics, rank: 0 });
  }

  // Normalise RMSE to [0, 1] across the set for fair comparison.
  const maxRmse = Math.max(...ranked.map((r) => r.metrics.rmse), 1e-12);

  // Composite: 0.5 * f1 + 0.5 * r2_adjusted - 0.25 * normalised_rmse
  const scored = ranked.map((r) => {
    const r2Adj = (r.metrics.r2 + 1) / 2; // map [-1,1] to [0,1]
    const rmseNorm = r.metrics.rmse / maxRmse;
    return {
      ...r,
      composite: 0.5 * r.metrics.f1 + 0.5 * r2Adj - 0.25 * rmseNorm,
    };
  });

  scored.sort((a, b) => b.composite - a.composite);

  const result: RankedModel[] = scored.map((s, i) => ({
    modelId: s.modelId,
    metrics: s.metrics,
    rank: i + 1,
  }));

  // Determine which metric varies most.
  const metricKeys: (keyof ModelMetrics)[] = ["accuracy", "precision", "recall", "f1", "r2", "rmse"];
  let maxVariance = -1;
  let mostDiscriminating: keyof ModelMetrics = "f1";

  for (const key of metricKeys) {
    const values = result.map((r) => r.metrics[key]);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    if (variance > maxVariance) {
      maxVariance = variance;
      mostDiscriminating = key;
    }
  }

  return { models: result, mostDiscriminatingMetric: mostDiscriminating };
}

/**
 * Detect model drift by comparing baseline metrics against new data.
 *
 * The drift score is the normalised absolute change in key metrics
 * (accuracy, f1, rmse) between the baseline predictions and the new data.
 * A score >= 0.15 flags the model as drifting.
 *
 * @param modelId       The model to check.
 * @param baselineData  Original test data used to establish baseline metrics.
 * @param newData       Recent production data to compare against.
 * @returns             Drift assessment with actionable recommendations.
 */
export async function getModelDrift(
  modelId: string,
  baselineData: TestDataPoint[],
  newData: TestDataPoint[],
): Promise<DriftResult> {
  if (baselineData.length === 0 || newData.length === 0) {
    throw new Error(`getModelDrift: both baselineData and newData must be non-empty (modelId=${modelId})`);
  }

  const baseline = await evaluateModelPerformance(modelId, baselineData);
  const current = await evaluateModelPerformance(modelId, newData);

  // Compute normalised absolute deltas for key metrics.
  const accDelta = Math.abs(current.accuracy - baseline.accuracy);
  const f1Delta = Math.abs(current.f1 - baseline.f1);

  // RMSE delta normalised to baseline (relative change).
  // When baseline RMSE is 0 (perfect model), use the absolute value directly
  // since a relative ratio would be undefined / infinite.
  const rmseDelta =
    baseline.rmse === 0
      ? Math.min(current.rmse, 1) // cap at 1 for small absolute RMSE
      : Math.abs(current.rmse - baseline.rmse) / baseline.rmse;

  // Weighted composite drift score (0-1 scale).
  const rawDrift = 0.35 * accDelta + 0.35 * f1Delta + 0.3 * rmseDelta;
  const driftScore = Math.min(rawDrift, 1);

  const isDrifting = driftScore >= 0.15;

  // Build recommendations.
  const recommendations: string[] = [];

  if (accDelta > 0.1) {
    recommendations.push(
      `Accuracy dropped ${(accDelta * 100).toFixed(1)}% from baseline. Consider retraining on recent data.`,
    );
  }
  if (f1Delta > 0.1) {
    recommendations.push(`F1 score shifted by ${(f1Delta * 100).toFixed(1)}%. Investigate class distribution changes.`);
  }
  if (rmseDelta > 0.2) {
    recommendations.push(
      `RMSE changed by ${(rmseDelta * 100).toFixed(1)}% relative to baseline. Check for feature distribution shift.`,
    );
  }
  if (current.r2 < baseline.r2 * 0.8) {
    recommendations.push("R-squared regression detected. Validate input feature ranges against training data.");
  }
  if (!isDrifting) {
    recommendations.push("Model performance is within acceptable bounds. No action required.");
  }
  if (isDrifting && recommendations.length === 0) {
    recommendations.push("Drift detected but individual metric changes are moderate. Schedule a review.");
  }

  return { driftScore, isDrifting, recommendations };
}
