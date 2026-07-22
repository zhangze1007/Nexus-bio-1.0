/**
 * ML Feature Importance / Interpretability for Metabolic Engineering
 *
 * Extracts and ranks feature importances from trained ML models using
 * three complementary methods:
 *
 *   1. Linear coefficient extraction (LinearRegression, Ridge, Lasso)
 *   2. Tree-based impurity reduction (DecisionTree, RandomForest)
 *   3. Permutation importance (model-agnostic)
 *
 * Also provides ranking and export utilities (JSON, CSV).
 *
 * Reference: Breiman (2001) Machine Learning 45:5-32 (Random Forest importance)
 * Reference: Fisher et al. (2019) arXiv:1801.01489 (Permutation importance)
 */

import { makeRng } from "../../utils/rng";
import type { MLModel } from "./models";
import type { FeatureImportance } from "./types";

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Assign ranks to importances (1 = highest importance).
 * Ties receive the same rank; the next rank skips accordingly.
 * @param items - Sorted array of {featureName, importance} (descending)
 * @returns FeatureImportance[] with rank assigned
 */
function assignRanks(items: Array<{ featureName: string; importance: number }>): FeatureImportance[] {
  const result: FeatureImportance[] = [];
  let currentRank = 1;

  for (let i = 0; i < items.length; i++) {
    if (i > 0 && items[i].importance < items[i - 1].importance) {
      currentRank = i + 1;
    }
    result.push({
      featureName: items[i].featureName,
      importance: items[i].importance,
      rank: currentRank,
    });
  }

  return result;
}

/**
 * Sort importances descending by importance value, then assign ranks.
 * @param items - Array of {featureName, importance}
 * @returns FeatureImportance[] sorted descending with ranks
 */
function sortAndRank(items: Array<{ featureName: string; importance: number }>): FeatureImportance[] {
  const sorted = [...items].sort((a, b) => b.importance - a.importance);
  return assignRanks(sorted);
}

// ── 1. Linear Model Coefficient Extraction ──────────────────────────────────

/**
 * Extract feature importances from linear models (LinearRegression, Ridge, Lasso).
 *
 * Importance is the absolute value of each feature's coefficient.
 * The model's built-in `getFeatureImportances()` returns normalized absolute
 * weights (summing to 1), so we recover raw importances from those.
 *
 * @param model - A fitted linear model (LinearRegression, RidgeRegression, or LassoRegression)
 * @param featureNames - Names corresponding to each feature dimension
 * @returns FeatureImportance[] sorted by importance descending with ranks
 *
 * @example
 * const model = new LinearRegression();
 * model.fit(X, y);
 * const importances = getLinearImportances(model, ['MW', 'pI', 'hydrophobicity']);
 */
export function getLinearImportances(model: MLModel, featureNames: string[]): FeatureImportance[] {
  if (featureNames.length === 0) return [];

  // getFeatureImportances() returns normalized abs weights summing to 1
  const normalizedImportances = model.getFeatureImportances();

  if (normalizedImportances.length === 0) {
    return featureNames.map((name) => ({ featureName: name, importance: 0, rank: 1 }));
  }

  const items = featureNames.map((name, i) => ({
    featureName: name,
    importance: normalizedImportances[i] ?? 0,
  }));

  return sortAndRank(items);
}

// ── 2. Tree-Based Feature Importance ────────────────────────────────────────

/**
 * Extract feature importances from tree-based models (DecisionTree, RandomForest).
 *
 * Importance is the total impurity reduction (MSE decrease) across all splits
 * on each feature, normalized to sum to 1.
 *
 * @param model - A fitted tree model (DecisionTree or RandomForest)
 * @param featureNames - Names corresponding to each feature dimension
 * @returns FeatureImportance[] sorted by importance descending with ranks
 *
 * @example
 * const forest = new RandomForest(50);
 * forest.fit(X, y);
 * const importances = getTreeImportances(forest, ['MW', 'pI', 'hydrophobicity']);
 */
export function getTreeImportances(model: MLModel, featureNames: string[]): FeatureImportance[] {
  if (featureNames.length === 0) return [];

  // getFeatureImportances() returns normalized impurity reductions summing to 1
  const normalizedImportances = model.getFeatureImportances();

  if (normalizedImportances.length === 0) {
    return featureNames.map((name) => ({ featureName: name, importance: 0, rank: 1 }));
  }

  const items = featureNames.map((name, i) => ({
    featureName: name,
    importance: normalizedImportances[i] ?? 0,
  }));

  return sortAndRank(items);
}

// ── 3. Permutation Importance ───────────────────────────────────────────────

/**
 * Compute permutation importance for any model.
 *
 * For each feature, the feature column is shuffled nRepeats times.
 * The metric degradation (original metric - shuffled metric) measures
 * how much the model relies on that feature.
 *
 * Higher degradation = more important feature.
 *
 * @param model - Any fitted MLModel
 * @param X - Feature matrix (n_samples x n_features)
 * @param y - True target values
 * @param featureNames - Names corresponding to each feature dimension
 * @param options - Optional configuration
 * @param options.nRepeats - Number of shuffles per feature (default: 5)
 * @param options.metric - Metric function (yTrue, yPred) => number (default: negative RMSE)
 * @returns FeatureImportance[] sorted by importance descending with ranks
 *
 * @example
 * const importances = permutationImportance(model, X_test, y_test, featureNames, {
 *   nRepeats: 10,
 *   metric: (yt, yp) => -computeRMSE(yt, yp),
 * });
 */
export function permutationImportance(
  model: MLModel,
  X: number[][],
  y: number[],
  featureNames: string[],
  options?: {
    nRepeats?: number;
    metric?: (yTrue: number[], yPred: number[]) => number;
    seed?: number;
  },
): FeatureImportance[] {
  if (featureNames.length === 0 || X.length === 0 || y.length === 0) return [];

  const nRepeats = options?.nRepeats ?? 5;
  const metric = options?.metric ?? defaultMetric;
  const rng = makeRng(options?.seed ?? 42);

  const nFeatures = featureNames.length;
  const nSamples = X.length;

  // Compute baseline metric with original data
  const baselinePreds = model.predict(X);
  const baselineMetric = metric(y, baselinePreds);

  // Compute importance for each feature
  const items: Array<{ featureName: string; importance: number }> = [];

  for (let f = 0; f < nFeatures; f++) {
    let totalDegradation = 0;

    for (let r = 0; r < nRepeats; r++) {
      // Create a shuffled copy of X
      const XShuffled = X.map((row) => [...row]);

      // Fisher-Yates shuffle on column f
      const column = XShuffled.map((row) => row[f]);
      for (let i = nSamples - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [column[i], column[j]] = [column[j], column[i]];
      }
      for (let i = 0; i < nSamples; i++) {
        XShuffled[i][f] = column[i];
      }

      // Predict and compute metric with shuffled feature
      const shuffledPreds = model.predict(XShuffled);
      const shuffledMetric = metric(y, shuffledPreds);

      // Degradation = baseline - shuffled (positive means feature matters)
      totalDegradation += baselineMetric - shuffledMetric;
    }

    items.push({
      featureName: featureNames[f],
      importance: totalDegradation / nRepeats,
    });
  }

  return sortAndRank(items);
}

/**
 * Default metric for permutation importance: negative RMSE.
 * Higher (less negative) = better fit. Degradation is positive when
 * shuffling a feature makes predictions worse.
 */
function defaultMetric(yTrue: number[], yPred: number[]): number {
  const n = yTrue.length;
  if (n === 0) return 0;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    ss += (yTrue[i] - yPred[i]) ** 2;
  }
  return -Math.sqrt(ss / n);
}

// ── 4. Importance Ranking and Export ────────────────────────────────────────

/**
 * Re-rank an array of FeatureImportance by descending importance.
 *
 * Useful when combining importances from multiple sources or after
 * filtering. Assigns fresh ranks respecting ties.
 *
 * @param importances - Array of FeatureImportance to re-rank
 * @returns New array sorted by importance descending with updated ranks
 *
 * @example
 * const combined = [...linearImp, ...treeImp];
 * const ranked = rankImportances(combined);
 */
export function rankImportances(importances: FeatureImportance[]): FeatureImportance[] {
  if (importances.length === 0) return [];

  const items = importances.map((imp) => ({
    featureName: imp.featureName,
    importance: imp.importance,
  }));

  return sortAndRank(items);
}

/**
 * Export feature importances as a pretty-printed JSON string.
 *
 * @param importances - Array of FeatureImportance to export
 * @returns JSON string (2-space indented)
 *
 * @example
 * const json = exportImportancesToJSON(importances);
 * fs.writeFileSync('importances.json', json);
 */
export function exportImportancesToJSON(importances: FeatureImportance[]): string {
  return JSON.stringify(importances, null, 2);
}

/**
 * Export feature importances as a CSV string.
 *
 * Format:
 * ```
 * featureName,importance,rank
 * MW,0.45,1
 * pI,0.30,2
 * ```
 *
 * @param importances - Array of FeatureImportance to export
 * @returns CSV string with header row
 *
 * @example
 * const csv = exportImportancesToCSV(importances);
 * fs.writeFileSync('importances.csv', csv);
 */
export function exportImportancesToCSV(importances: FeatureImportance[]): string {
  const header = "featureName,importance,rank";
  const rows = importances.map((imp) => `${imp.featureName},${imp.importance},${imp.rank}`);
  return [header, ...rows].join("\n");
}
