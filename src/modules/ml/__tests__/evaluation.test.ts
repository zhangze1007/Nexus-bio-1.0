/**
 * Tests for ML Evaluation Metrics
 *
 * Covers:
 *   1. computeRegressionMetrics — MAE, RMSE, R², explained variance
 *   2. computeClassificationMetrics — accuracy, precision, recall, F1, ROC-AUC
 *   3. computeResiduals — raw/standardized residuals, outlier detection
 *   4. aggregateMetrics — mean/std/min/max across CV folds
 *   5. computeConfusionMatrix — binary and multi-class
 *   6. computeROCAUC — perfect/random/known AUC values
 */

import {
  computeRegressionMetrics,
  computeClassificationMetrics,
  computeResiduals,
  aggregateMetrics,
  computeConfusionMatrix,
  computeROCAUC,
} from '../evaluation';
import type { ModelMetrics } from '../types';

// ── 1. Regression Metrics ──────────────────────────────────────────────────

describe('computeRegressionMetrics', () => {
  it('should return all zeros for perfect predictions: MAE=0, RMSE=0, R²=1', () => {
    const yTrue = [1, 2, 3, 4, 5];
    const yPred = [1, 2, 3, 4, 5];

    const m = computeRegressionMetrics(yTrue, yPred);

    expect(m.mae).toBeCloseTo(0, 10);
    expect(m.rmse).toBeCloseTo(0, 10);
    expect(m.r2).toBeCloseTo(1, 10);
    expect(m.explainedVariance).toBeCloseTo(1, 10);
  });

  it('should compute known MAE from textbook example', () => {
    // yTrue = [3, -0.5, 2, 7], yPred = [2.5, 0.0, 2, 8]
    // Errors: [0.5, 0.5, 0, 1] → MAE = 2/4 = 0.5
    const yTrue = [3, -0.5, 2, 7];
    const yPred = [2.5, 0.0, 2, 8];

    const m = computeRegressionMetrics(yTrue, yPred);

    expect(m.mae).toBeCloseTo(0.5, 10);
  });

  it('should compute known RMSE from textbook example', () => {
    // yTrue = [3, -0.5, 2, 7], yPred = [2.5, 0.0, 2, 8]
    // Sq errors: [0.25, 0.25, 0, 1] → mean = 0.375 → RMSE = sqrt(0.375) ≈ 0.6124
    const yTrue = [3, -0.5, 2, 7];
    const yPred = [2.5, 0.0, 2, 8];

    const m = computeRegressionMetrics(yTrue, yPred);

    expect(m.rmse).toBeCloseTo(Math.sqrt(0.375), 5);
  });

  it('should compute known R² value', () => {
    // yTrue = [1, 2, 3], yPred = [1, 2, 3] → R² = 1
    const yTrue = [1, 2, 3];
    const yPred = [1, 2, 3];

    const m = computeRegressionMetrics(yTrue, yPred);

    expect(m.r2).toBeCloseTo(1, 10);
  });

  it('should return negative R² for poor predictions', () => {
    const yTrue = [1, 2, 3, 4, 5];
    const yPred = [10, 20, 30, 40, 50]; // Way off

    const m = computeRegressionMetrics(yTrue, yPred);

    expect(m.r2).toBeLessThan(0);
  });

  it('should handle constant predictions (edge case)', () => {
    const yTrue = [1, 2, 3, 4, 5];
    const yPred = [3, 3, 3, 3, 3]; // Constant prediction = mean of yTrue

    const m = computeRegressionMetrics(yTrue, yPred);

    // MAE = mean(|1-3|, |2-3|, |3-3|, |4-3|, |5-3|) = mean(2,1,0,1,2) = 1.2
    expect(m.mae).toBeCloseTo(1.2, 5);
    // R² ≈ 0 for constant prediction at mean
    expect(m.r2).toBeCloseTo(0, 5);
  });

  it('should handle empty arrays', () => {
    const m = computeRegressionMetrics([], []);

    expect(m.mae).toBe(0);
    expect(m.rmse).toBe(0);
    expect(m.r2).toBe(0);
    expect(m.explainedVariance).toBe(0);
  });

  it('should handle single sample', () => {
    const m = computeRegressionMetrics([5], [3]);

    expect(m.mae).toBeCloseTo(2, 10);
    expect(m.rmse).toBeCloseTo(2, 10);
    // Single sample: ssTot=0, so R²=1 by convention
    expect(m.r2).toBe(1);
    expect(m.explainedVariance).toBe(1);
  });

  it('should handle constant target values', () => {
    const yTrue = [5, 5, 5, 5];
    const yPred = [5, 5, 5, 5];

    const m = computeRegressionMetrics(yTrue, yPred);

    expect(m.mae).toBe(0);
    expect(m.rmse).toBe(0);
    expect(m.r2).toBe(1);
    expect(m.explainedVariance).toBe(1);
  });

  it('should compute explained variance correctly', () => {
    // yTrue = [1, 2, 3, 4, 5], yPred = [1.1, 2.1, 2.9, 4.0, 5.1]
    // residuals = [-0.1, -0.1, 0.1, 0, -0.1]
    const yTrue = [1, 2, 3, 4, 5];
    const yPred = [1.1, 2.1, 2.9, 4.0, 5.1];

    const m = computeRegressionMetrics(yTrue, yPred);

    // Explained variance should be close to 1 for good predictions
    expect(m.explainedVariance).toBeGreaterThan(0.95);
    expect(m.explainedVariance).toBeLessThanOrEqual(1.01);
  });

  it('should handle constant target with different predictions', () => {
    // When Var(yTrue) = 0, explained variance should be 1 by convention
    const yTrue = [5, 5, 5, 5];
    const yPred = [4, 6, 4, 6];

    const m = computeRegressionMetrics(yTrue, yPred);

    expect(m.explainedVariance).toBe(1);
  });
});

// ── 2. Classification Metrics ──────────────────────────────────────────────

describe('computeClassificationMetrics', () => {
  it('should return perfect metrics for perfect predictions', () => {
    const yTrue = [0, 0, 1, 1, 1];
    const yPred = [0, 0, 1, 1, 1];

    const m = computeClassificationMetrics(yTrue, yPred);

    expect(m.accuracy).toBeCloseTo(1, 10);
    expect(m.f1).toBeCloseTo(1, 10);
    expect(m.precision).toBeCloseTo(1, 10);
    expect(m.recall).toBeCloseTo(1, 10);
  });

  it('should compute accuracy correctly with known TP/TN/FP/FN', () => {
    // yTrue = [1, 1, 0, 0, 1], yPred = [1, 0, 0, 1, 1]
    // TP=2, TN=1, FP=1, FN=1 → Accuracy = 3/5 = 0.6
    const yTrue = [1, 1, 0, 0, 1];
    const yPred = [1, 0, 0, 1, 1];

    const m = computeClassificationMetrics(yTrue, yPred);

    expect(m.accuracy).toBeCloseTo(0.6, 10);
  });

  it('should compute precision correctly', () => {
    // Binary: class 1 is positive
    // yTrue = [1, 1, 0, 0, 1], yPred = [1, 0, 0, 1, 1]
    // For class 1: TP=2, FP=1 → Precision_1 = 2/3
    // For class 0: TP=1, FN=1 → Precision_0 = 1/(1+1) = 0.5
    // Macro precision = (2/3 + 0.5) / 2 = (0.6667 + 0.5) / 2 = 0.5833
    const yTrue = [1, 1, 0, 0, 1];
    const yPred = [1, 0, 0, 1, 1];

    const m = computeClassificationMetrics(yTrue, yPred);

    expect(m.precision).toBeCloseTo((2/3 + 0.5) / 2, 3);
  });

  it('should compute recall correctly', () => {
    // yTrue = [1, 1, 0, 0, 1], yPred = [1, 0, 0, 1, 1]
    // For class 1: TP=2, FN=1 → Recall_1 = 2/3
    // For class 0: TP=1, FP=1 → Recall_0 = 1/(1+1) = 0.5
    // Macro recall = (2/3 + 0.5) / 2
    const yTrue = [1, 1, 0, 0, 1];
    const yPred = [1, 0, 0, 1, 1];

    const m = computeClassificationMetrics(yTrue, yPred);

    expect(m.recall).toBeCloseTo((2/3 + 0.5) / 2, 3);
  });

  it('should compute F1 as harmonic mean of precision and recall', () => {
    const yTrue = [0, 1, 1, 0, 1, 0, 1, 1];
    const yPred = [0, 1, 0, 0, 1, 1, 1, 1];

    const m = computeClassificationMetrics(yTrue, yPred);

    // F1 should be consistent with precision and recall
    expect(m.f1).toBeGreaterThan(0);
    expect(m.f1).toBeLessThanOrEqual(1);
    // F1 = 2*P*R/(P+R)
    if (m.precision + m.recall > 0) {
      expect(m.f1).toBeCloseTo(
        2 * m.precision * m.recall / (m.precision + m.recall),
        5,
      );
    }
  });

  it('should handle all same class (edge case)', () => {
    const yTrue = [1, 1, 1, 1];
    const yPred = [1, 1, 1, 1];

    const m = computeClassificationMetrics(yTrue, yPred);

    expect(m.accuracy).toBeCloseTo(1, 10);
    expect(m.precision).toBeCloseTo(1, 10);
    expect(m.recall).toBeCloseTo(1, 10);
    expect(m.f1).toBeCloseTo(1, 10);
  });

  it('should handle all same class with wrong predictions', () => {
    const yTrue = [1, 1, 1, 1];
    const yPred = [0, 0, 0, 0];

    const m = computeClassificationMetrics(yTrue, yPred);

    expect(m.accuracy).toBeCloseTo(0, 10);
    expect(m.recall).toBeCloseTo(0, 10);
  });

  it('should handle empty arrays', () => {
    const m = computeClassificationMetrics([], []);

    expect(m.accuracy).toBe(0);
    expect(m.precision).toBe(0);
    expect(m.recall).toBe(0);
    expect(m.f1).toBe(0);
  });

  it('should compute multi-class metrics correctly', () => {
    // 3 classes: 0, 1, 2
    const yTrue = [0, 0, 1, 1, 2, 2];
    const yPred = [0, 1, 1, 2, 2, 0];

    const m = computeClassificationMetrics(yTrue, yPred);

    // Accuracy: 3/6 = 0.5 (class 0 correct, class 1 one correct, class 2 one correct)
    expect(m.accuracy).toBeCloseTo(0.5, 5);
    // No ROC-AUC for multi-class
    expect(m.rocAuc).toBeUndefined();
  });

  it('should include ROC-AUC for binary classification with hard labels', () => {
    const yTrue = [0, 0, 1, 1];
    const yPred = [0, 0, 1, 1];

    const m = computeClassificationMetrics(yTrue, yPred);

    expect(m.rocAuc).toBeDefined();
    expect(m.rocAuc).toBeCloseTo(1, 5);
  });
});

// ── 3. Residual Analysis ───────────────────────────────────────────────────

describe('computeResiduals', () => {
  it('should return all zero residuals for perfect predictions', () => {
    const yTrue = [1, 2, 3, 4, 5];
    const yPred = [1, 2, 3, 4, 5];

    const r = computeResiduals(yTrue, yPred);

    expect(r.residuals).toEqual([0, 0, 0, 0, 0]);
    expect(r.meanResidual).toBeCloseTo(0, 10);
    expect(r.stdResidual).toBeCloseTo(0, 10);
  });

  it('should compute residuals as yTrue - yPred', () => {
    const yTrue = [5, 3, 8, 2];
    const yPred = [4, 4, 6, 1];

    const r = computeResiduals(yTrue, yPred);

    expect(r.residuals[0]).toBeCloseTo(1, 10);  // 5 - 4
    expect(r.residuals[1]).toBeCloseTo(-1, 10); // 3 - 4
    expect(r.residuals[2]).toBeCloseTo(2, 10);  // 8 - 6
    expect(r.residuals[3]).toBeCloseTo(1, 10);  // 2 - 1
  });

  it('should have standardized residuals with mean ≈ 0 and std ≈ 1', () => {
    const yTrue = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const yPred = [1.1, 1.9, 3.2, 3.8, 5.1, 5.9, 7.2, 7.8, 9.1, 9.9];

    const r = computeResiduals(yTrue, yPred);

    // Standardized residuals should have mean ≈ 0
    const stdMean = r.standardizedResiduals.reduce((s, v) => s + v, 0) / r.standardizedResiduals.length;
    expect(stdMean).toBeCloseTo(0, 5);

    // Standardized residuals should have std ≈ 1
    const stdStd = Math.sqrt(
      r.standardizedResiduals.reduce((s, v) => s + (v - stdMean) ** 2, 0) /
      (r.standardizedResiduals.length - 1),
    );
    expect(stdStd).toBeCloseTo(1, 3);
  });

  it('should detect outliers via large standardized residuals', () => {
    // Most predictions are close, but one is an outlier
    const yTrue = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]; // 100 is outlier target
    const yPred = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];  // Way off for last sample

    const r = computeResiduals(yTrue, yPred);

    // Last residual should be large: 100 - 10 = 90
    expect(r.residuals[9]).toBeCloseTo(90, 5);

    // Last standardized residual should be far from 0 (outlier)
    expect(Math.abs(r.standardizedResiduals[9])).toBeGreaterThan(2);
  });

  it('should handle empty arrays', () => {
    const r = computeResiduals([], []);

    expect(r.residuals).toEqual([]);
    expect(r.standardizedResiduals).toEqual([]);
    expect(r.meanResidual).toBe(0);
    expect(r.stdResidual).toBe(0);
  });

  it('should handle identical residuals (std = 0)', () => {
    // All predictions off by same amount
    const yTrue = [2, 3, 4, 5];
    const yPred = [1, 2, 3, 4]; // All off by 1

    const r = computeResiduals(yTrue, yPred);

    expect(r.residuals).toEqual([1, 1, 1, 1]);
    expect(r.meanResidual).toBeCloseTo(1, 10);
    // stdDev uses Bessel's correction, but for identical values the numerator is 0
    // so stdResidual should be very small or 0
    // Standardized residuals should all be 0 (since std = 0, we set them to 0)
    for (const sr of r.standardizedResiduals) {
      expect(sr).toBe(0);
    }
  });

  it('should handle single sample', () => {
    const r = computeResiduals([5], [3]);

    expect(r.residuals).toEqual([2]);
    expect(r.meanResidual).toBeCloseTo(2, 10);
    // Single sample: std = 0 (can't compute sample std with n=1)
    expect(r.stdResidual).toBe(0);
  });
});

// ── 4. Metric Aggregation ──────────────────────────────────────────────────

describe('aggregateMetrics', () => {
  it('should return same metric for mean when all metrics are identical', () => {
    const m: ModelMetrics = { mae: 0.5, rmse: 0.7, r2: 0.9, accuracy: 0.85, f1: 0.88 };
    const metricsList = [m, m, m, m, m];

    const agg = aggregateMetrics(metricsList);

    expect(agg.mean.mae).toBeCloseTo(0.5, 10);
    expect(agg.mean.rmse).toBeCloseTo(0.7, 10);
    expect(agg.mean.r2).toBeCloseTo(0.9, 10);
    expect(agg.mean.accuracy).toBeCloseTo(0.85, 10);
    expect(agg.mean.f1).toBeCloseTo(0.88, 10);
  });

  it('should return std = 0 when all metrics are identical', () => {
    const m: ModelMetrics = { mae: 0.5, rmse: 0.7, r2: 0.9 };
    const metricsList = [m, m, m];

    const agg = aggregateMetrics(metricsList);

    expect(agg.std.mae).toBeCloseTo(0, 10);
    expect(agg.std.rmse).toBeCloseTo(0, 10);
    expect(agg.std.r2).toBeCloseTo(0, 10);
  });

  it('should compute correct mean with different metric values', () => {
    const m1: ModelMetrics = { mae: 0.2, rmse: 0.4, r2: 0.95 };
    const m2: ModelMetrics = { mae: 0.4, rmse: 0.6, r2: 0.90 };
    const m3: ModelMetrics = { mae: 0.6, rmse: 0.8, r2: 0.85 };

    const agg = aggregateMetrics([m1, m2, m3]);

    expect(agg.mean.mae).toBeCloseTo(0.4, 5);
    expect(agg.mean.rmse).toBeCloseTo(0.6, 5);
    expect(agg.mean.r2).toBeCloseTo(0.9, 5);
  });

  it('should compute correct std with different metric values', () => {
    const m1: ModelMetrics = { mae: 0.2, rmse: 0.4, r2: 0.95 };
    const m2: ModelMetrics = { mae: 0.4, rmse: 0.6, r2: 0.90 };
    const m3: ModelMetrics = { mae: 0.6, rmse: 0.8, r2: 0.85 };

    const agg = aggregateMetrics([m1, m2, m3]);

    // std of [0.2, 0.4, 0.6] with Bessel's correction
    const expectedMAEStd = Math.sqrt(((0.2-0.4)**2 + (0.4-0.4)**2 + (0.6-0.4)**2) / 2);
    expect(agg.std.mae).toBeCloseTo(expectedMAEStd, 5);
  });

  it('should compute min and max correctly', () => {
    const m1: ModelMetrics = { mae: 0.3, rmse: 0.5, r2: 0.8 };
    const m2: ModelMetrics = { mae: 0.1, rmse: 0.3, r2: 0.95 };
    const m3: ModelMetrics = { mae: 0.5, rmse: 0.7, r2: 0.7 };

    const agg = aggregateMetrics([m1, m2, m3]);

    expect(agg.min.mae).toBeCloseTo(0.1, 10);
    expect(agg.max.mae).toBeCloseTo(0.5, 10);
    expect(agg.min.rmse).toBeCloseTo(0.3, 10);
    expect(agg.max.rmse).toBeCloseTo(0.7, 10);
    expect(agg.min.r2).toBeCloseTo(0.7, 10);
    expect(agg.max.r2).toBeCloseTo(0.95, 10);
  });

  it('should handle empty metrics list', () => {
    const agg = aggregateMetrics([]);

    expect(agg.mean.mae).toBe(0);
    expect(agg.std.mae).toBe(0);
    expect(agg.min.mae).toBe(0);
    expect(agg.max.mae).toBe(0);
  });

  it('should handle single fold', () => {
    const m: ModelMetrics = { mae: 0.5, rmse: 0.7, r2: 0.9 };

    const agg = aggregateMetrics([m]);

    expect(agg.mean.mae).toBeCloseTo(0.5, 10);
    expect(agg.std.mae).toBe(0); // Single value → std = 0
    expect(agg.min.mae).toBeCloseTo(0.5, 10);
    expect(agg.max.mae).toBeCloseTo(0.5, 10);
  });

  it('should handle metrics with optional fields undefined', () => {
    const m1: ModelMetrics = { mae: 0.2, rmse: 0.4, r2: 0.95 };
    const m2: ModelMetrics = { mae: 0.4, rmse: 0.6, r2: 0.90, accuracy: 0.85, f1: 0.8 };

    const agg = aggregateMetrics([m1, m2]);

    // Mean should only average defined values
    expect(agg.mean.mae).toBeCloseTo(0.3, 5);
    // accuracy and f1 only defined in m2, so mean = m2's value
    expect(agg.mean.accuracy).toBeCloseTo(0.85, 5);
    expect(agg.mean.f1).toBeCloseTo(0.8, 5);
  });
});

// ── 5. Confusion Matrix ────────────────────────────────────────────────────

describe('computeConfusionMatrix', () => {
  it('should compute binary confusion matrix correctly', () => {
    const yTrue = [1, 1, 0, 0, 1];
    const yPred = [1, 0, 0, 1, 1];

    const { matrix, labels } = computeConfusionMatrix(yTrue, yPred);

    expect(labels).toEqual([0, 1]);
    // [actual=0][pred=0] = TN = 1
    // [actual=0][pred=1] = FP = 1
    // [actual=1][pred=0] = FN = 1
    // [actual=1][pred=1] = TP = 2
    expect(matrix).toEqual([
      [1, 1],  // actual=0: TN=1, FP=1
      [1, 2],  // actual=1: FN=1, TP=2
    ]);
  });

  it('should compute multi-class confusion matrix correctly', () => {
    // Classes: 0, 1, 2
    const yTrue = [0, 0, 1, 1, 2, 2];
    const yPred = [0, 1, 1, 2, 2, 0];

    const { matrix, labels } = computeConfusionMatrix(yTrue, yPred);

    expect(labels).toEqual([0, 1, 2]);
    // Row 0 (actual=0): pred=[0,1] → [1, 1, 0]
    // Row 1 (actual=1): pred=[1,2] → [0, 1, 1]
    // Row 2 (actual=2): pred=[2,0] → [1, 0, 1]
    expect(matrix).toEqual([
      [1, 1, 0],
      [0, 1, 1],
      [1, 0, 1],
    ]);
  });

  it('should produce diagonal matrix for perfect predictions', () => {
    const yTrue = [0, 0, 1, 1, 2, 2];
    const yPred = [0, 0, 1, 1, 2, 2];

    const { matrix, labels } = computeConfusionMatrix(yTrue, yPred);

    expect(labels).toEqual([0, 1, 2]);
    expect(matrix).toEqual([
      [2, 0, 0],
      [0, 2, 0],
      [0, 0, 2],
    ]);
  });

  it('should handle empty arrays', () => {
    const { matrix, labels } = computeConfusionMatrix([], []);

    expect(matrix).toEqual([]);
    expect(labels).toEqual([]);
  });

  it('should include labels from both yTrue and yPred', () => {
    // yPred has a class not in yTrue
    const yTrue = [0, 0, 0];
    const yPred = [0, 1, 2];

    const { matrix, labels } = computeConfusionMatrix(yTrue, yPred);

    expect(labels).toEqual([0, 1, 2]);
    // actual=0: pred=[0,1,2] → [1, 1, 1]
    // actual=1: no samples → [0, 0, 0]
    // actual=2: no samples → [0, 0, 0]
    expect(matrix).toEqual([
      [1, 1, 1],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it('should handle single class', () => {
    const yTrue = [1, 1, 1];
    const yPred = [1, 1, 1];

    const { matrix, labels } = computeConfusionMatrix(yTrue, yPred);

    expect(labels).toEqual([1]);
    expect(matrix).toEqual([[3]]);
  });

  it('should sum to total sample count', () => {
    const yTrue = [0, 1, 2, 0, 1, 2, 0, 1];
    const yPred = [0, 1, 2, 1, 0, 2, 0, 2];

    const { matrix } = computeConfusionMatrix(yTrue, yPred);

    const total = matrix.flat().reduce((s, v) => s + v, 0);
    expect(total).toBe(yTrue.length);
  });
});

// ── 6. ROC-AUC ─────────────────────────────────────────────────────────────

describe('computeROCAUC', () => {
  it('should return AUC = 1 for perfect classifier', () => {
    // Perfect separation: all positives have higher scores than all negatives
    const yTrue = [0, 0, 0, 1, 1, 1];
    const yScores = [0.1, 0.2, 0.3, 0.7, 0.8, 0.9];

    const auc = computeROCAUC(yTrue, yScores);

    expect(auc).toBeCloseTo(1, 5);
  });

  it('should return AUC = 0.5 for random classifier', () => {
    // yTrue = [1, 0, 0, 1], yScores = [0.7, 0.8, 0.3, 0.4]
    // Sort by score desc: (0.8,0), (0.7,1), (0.4,1), (0.3,0)
    // P-N pairs: 2/4 have P ranked higher → AUC = 0.5
    const yTrue = [1, 0, 0, 1];
    const yScores = [0.7, 0.8, 0.3, 0.4];

    const auc = computeROCAUC(yTrue, yScores);

    expect(auc).toBeCloseTo(0.5, 5);
  });

  it('should return AUC = 0.5 for all same class', () => {
    const yTrue = [1, 1, 1, 1];
    const yScores = [0.1, 0.5, 0.8, 0.9];

    const auc = computeROCAUC(yTrue, yScores);

    expect(auc).toBe(0.5);
  });

  it('should return AUC = 0.5 for empty arrays', () => {
    const auc = computeROCAUC([], []);

    expect(auc).toBe(0.5);
  });

  it('should compute known AUC for specific example', () => {
    // yTrue = [0, 0, 1, 1], yScores = [0.1, 0.4, 0.35, 0.8]
    // Sort by descending score: idx 3(0.8,1), idx 1(0.4,0), idx 2(0.35,1), idx 0(0.1,0)
    // Walk:
    //   step 1: TP=0, FP=0 → (0,0)
    //   step 2: score=0.8, y=1 → TP=1, FP=0 → TPR=0.5, FPR=0 → auc += 0 * (0.5+0)/2 = 0
    //   step 3: score=0.4, y=0 → TP=1, FP=1 → TPR=0.5, FPR=0.5 → auc += 0.5 * (0.5+0.5)/2 = 0.25
    //   step 4: score=0.35, y=1 → TP=2, FP=1 → TPR=1.0, FPR=0.5 → auc += 0 * (1.0+0.5)/2 = 0
    //   step 5: score=0.1, y=0 → TP=2, FP=2 → TPR=1.0, FPR=1.0 → auc += 0.5 * (1.0+1.0)/2 = 0.5
    // Total AUC = 0.75
    const yTrue = [0, 0, 1, 1];
    const yScores = [0.1, 0.4, 0.35, 0.8];

    const auc = computeROCAUC(yTrue, yScores);

    expect(auc).toBeCloseTo(0.75, 5);
  });

  it('should compute AUC = 1 for reversed perfect classifier', () => {
    // All negatives have score 0, all positives have score 1
    const yTrue = [0, 0, 0, 1, 1, 1];
    const yScores = [0, 0, 0, 1, 1, 1];

    const auc = computeROCAUC(yTrue, yScores);

    expect(auc).toBeCloseTo(1, 5);
  });

  it('should compute AUC = 0 for inverted classifier', () => {
    // All positives have lower scores than all negatives
    const yTrue = [0, 0, 0, 1, 1, 1];
    const yScores = [0.9, 0.8, 0.7, 0.3, 0.2, 0.1];

    const auc = computeROCAUC(yTrue, yScores);

    expect(auc).toBeCloseTo(0, 5);
  });

  it('should handle tied scores', () => {
    const yTrue = [0, 0, 1, 1];
    const yScores = [0.5, 0.5, 0.5, 0.5];

    const auc = computeROCAUC(yTrue, yScores);

    // All tied → should be around 0.5
    expect(auc).toBeCloseTo(0.5, 5);
  });

  it('should handle single positive and single negative', () => {
    const yTrue = [0, 1];
    const yScores = [0.3, 0.7];

    const auc = computeROCAUC(yTrue, yScores);

    expect(auc).toBeCloseTo(1, 5);
  });
});
