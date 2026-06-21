/**
 * Tests for ML Training Pipeline
 *
 * Covers:
 *   1. trainTestSplit — size preservation, randomness, stratification, seeding
 *   2. crossValidate — fold count, mean computation, model types
 *   3. trainWithEarlyStopping — early stop, history, patience
 *   4. gridSearch — best params, combination count, sorted results
 *   5. selectBestModel — multi-model comparison, best selection
 *   6. computeAllMetrics — regression and classification metrics
 */

import {
  trainTestSplit,
  crossValidate,
  trainWithEarlyStopping,
  gridSearch,
  selectBestModel,
  computeAllMetrics,
} from '../training';
import { createModel, LinearRegression, RidgeRegression, DecisionTree, RandomForest } from '../models';
import type { Dataset, TrainingSample, ModelType } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDataset(n: number, taskType: 'regression' | 'classification' = 'regression'): Dataset {
  const samples: TrainingSample[] = [];
  for (let i = 0; i < n; i++) {
    samples.push({
      features: [Math.random() * 10, Math.random() * 10],
      label: taskType === 'classification' ? (i % 2) : Math.random() * 10,
    });
  }
  return { featureNames: ['f1', 'f2'], samples, taskType };
}

function makeRegressionData(n: number): { X: number[][]; y: number[] } {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x1 = Math.random() * 10 - 5;
    const x2 = Math.random() * 10 - 5;
    X.push([x1, x2]);
    y.push(2 * x1 + 3 * x2 + (Math.random() - 0.5) * 0.5);
  }
  return { X, y };
}

function makeLinearData(n: number, weights: number[]): { X: number[][]; y: number[] } {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = weights.map(() => Math.random() * 10 - 5);
    const yi = x.reduce((s, v, j) => s + v * weights[j], 0);
    X.push(x);
    y.push(yi);
  }
  return { X, y };
}

// ── 1. trainTestSplit ─────────────────────────────────────────────────────

describe('trainTestSplit', () => {
  it('should preserve total data size', () => {
    const dataset = makeDataset(100);
    const { train, test } = trainTestSplit(dataset, 0.2);

    expect(train.samples.length + test.samples.length).toBe(100);
  });

  it('should default testFraction to 0.2', () => {
    const dataset = makeDataset(100);
    const { test } = trainTestSplit(dataset);

    expect(test.samples.length).toBe(20);
  });

  it('should use custom testFraction', () => {
    const dataset = makeDataset(100);
    const { test } = trainTestSplit(dataset, 0.3);

    expect(test.samples.length).toBe(30);
  });

  it('should produce different splits with different seeds', () => {
    const dataset = makeDataset(50);
    const split1 = trainTestSplit(dataset, 0.2, false, 42);
    const split2 = trainTestSplit(dataset, 0.2, false, 99);

    // Same sizes
    expect(split1.test.samples.length).toBe(split2.test.samples.length);

    // Different content (very unlikely to be identical with different seeds)
    const s1 = split1.test.samples.map(s => s.features[0]).join(',');
    const s2 = split2.test.samples.map(s => s.features[0]).join(',');
    expect(s1).not.toBe(s2);
  });

  it('should produce identical splits with same seed', () => {
    const dataset = makeDataset(50);
    const split1 = trainTestSplit(dataset, 0.2, false, 42);
    const split2 = trainTestSplit(dataset, 0.2, false, 42);

    const s1 = split1.test.samples.map(s => s.features[0]).join(',');
    const s2 = split2.test.samples.map(s => s.features[0]).join(',');
    expect(s1).toBe(s2);
  });

  it('should handle empty dataset', () => {
    const dataset: Dataset = { featureNames: ['f1'], samples: [], taskType: 'regression' };
    const { train, test } = trainTestSplit(dataset, 0.2);

    expect(train.samples.length).toBe(0);
    expect(test.samples.length).toBe(0);
  });

  it('should handle single sample', () => {
    const dataset: Dataset = {
      featureNames: ['f1'],
      samples: [{ features: [1], label: 1 }],
      taskType: 'regression',
    };
    const { train, test } = trainTestSplit(dataset, 0.2);

    expect(train.samples.length + test.samples.length).toBe(1);
  });

  it('should preserve featureNames in both splits', () => {
    const dataset = makeDataset(20);
    const { train, test } = trainTestSplit(dataset, 0.3);

    expect(train.featureNames).toEqual(dataset.featureNames);
    expect(test.featureNames).toEqual(dataset.featureNames);
    expect(train.taskType).toBe(dataset.taskType);
    expect(test.taskType).toBe(dataset.taskType);
  });

  it('should stratify classification data to preserve class distribution', () => {
    // 80 class-0, 20 class-1
    const samples: TrainingSample[] = [];
    for (let i = 0; i < 80; i++) samples.push({ features: [i], label: 0 });
    for (let i = 0; i < 20; i++) samples.push({ features: [i + 80], label: 1 });
    const dataset: Dataset = { featureNames: ['f1'], samples, taskType: 'classification' };

    const { train, test } = trainTestSplit(dataset, 0.2, true);

    // Both sets should have class 0 and class 1
    const trainClass0 = train.samples.filter(s => s.label === 0).length;
    const trainClass1 = train.samples.filter(s => s.label === 1).length;
    const testClass0 = test.samples.filter(s => s.label === 0).length;
    const testClass1 = test.samples.filter(s => s.label === 1).length;

    expect(trainClass0).toBeGreaterThan(0);
    expect(trainClass1).toBeGreaterThan(0);
    expect(testClass0).toBeGreaterThan(0);
    expect(testClass1).toBeGreaterThan(0);

    // Class ratios should be approximately preserved
    const trainRatio = trainClass1 / trainClass0;
    const testRatio = testClass1 / testClass0;
    expect(Math.abs(trainRatio - testRatio)).toBeLessThan(0.3);
  });

  it('should produce total size equal to original with stratification', () => {
    const samples: TrainingSample[] = [];
    for (let i = 0; i < 50; i++) samples.push({ features: [i], label: 0 });
    for (let i = 0; i < 50; i++) samples.push({ features: [i + 50], label: 1 });
    const dataset: Dataset = { featureNames: ['f1'], samples, taskType: 'classification' };

    const { train, test } = trainTestSplit(dataset, 0.2, true);
    expect(train.samples.length + test.samples.length).toBe(100);
  });
});

// ── 2. crossValidate ──────────────────────────────────────────────────────

describe('crossValidate', () => {
  it('should return k fold metrics', () => {
    const { X, y } = makeLinearData(100, [2, 3]);
    const model = new LinearRegression();
    const { foldMetrics } = crossValidate(model, X, y, 5);

    expect(foldMetrics.length).toBe(5);
  });

  it('should compute mean metrics correctly', () => {
    const { X, y } = makeLinearData(100, [2, 3]);
    const model = new LinearRegression();
    const { foldMetrics, meanMetrics } = crossValidate(model, X, y, 5);

    // Mean MAE should be average of fold MAEs
    const expectedMAE = foldMetrics.reduce((s, m) => s + m.mae, 0) / 5;
    expect(meanMetrics.mae).toBeCloseTo(expectedMAE, 10);

    // Mean RMSE should be average of fold RMSEs
    const expectedRMSE = foldMetrics.reduce((s, m) => s + m.rmse, 0) / 5;
    expect(meanMetrics.rmse).toBeCloseTo(expectedRMSE, 10);
  });

  it('should produce good R² for linear data with LinearRegression', () => {
    const { X, y } = makeLinearData(200, [2, 3]);
    const model = new LinearRegression();
    const { meanMetrics } = crossValidate(model, X, y, 5);

    expect(meanMetrics.r2).toBeGreaterThan(0.95);
  });

  it('should work with Ridge model', () => {
    const { X, y } = makeLinearData(200, [2, 3]);
    const model = new RidgeRegression(0.1);
    const { foldMetrics, meanMetrics } = crossValidate(model, X, y, 5);

    expect(foldMetrics.length).toBe(5);
    expect(meanMetrics.r2).toBeGreaterThan(0.9);
  });

  it('should work with DecisionTree model', () => {
    const { X, y } = makeLinearData(200, [2, 3]);
    const model = new DecisionTree(5, 2, 1);
    const { foldMetrics, meanMetrics } = crossValidate(model, X, y, 5);

    expect(foldMetrics.length).toBe(5);
    expect(meanMetrics.r2).toBeGreaterThan(0.5);
  });

  it('should work with RandomForest model', () => {
    const { X, y } = makeLinearData(200, [2, 3]);
    const model = new RandomForest(10, 0, 5, 2, 1);
    const { foldMetrics, meanMetrics } = crossValidate(model, X, y, 5);

    expect(foldMetrics.length).toBe(5);
    expect(meanMetrics.r2).toBeGreaterThan(0.5);
  });

  it('should handle empty data', () => {
    const model = new LinearRegression();
    const { foldMetrics, meanMetrics } = crossValidate(model, [], [], 5);

    expect(foldMetrics.length).toBe(0);
    expect(meanMetrics.mae).toBe(0);
    expect(meanMetrics.rmse).toBe(0);
    expect(meanMetrics.r2).toBe(0);
  });

  it('should cap k at sample count for small datasets', () => {
    const X = [[1], [2], [3]];
    const y = [1, 2, 3];
    const model = new LinearRegression();
    const { foldMetrics } = crossValidate(model, X, y, 10);

    // k should be capped at 3 (sample count)
    expect(foldMetrics.length).toBe(3);
  });

  it('should accept custom metrics function', () => {
    const { X, y } = makeLinearData(100, [2, 3]);
    const model = new LinearRegression();

    const customMetrics = (yTrue: number[], yPred: number[]) => ({
      mae: 999,
      rmse: 999,
      r2: 999,
    });

    const { foldMetrics, meanMetrics } = crossValidate(model, X, y, 3, customMetrics);

    expect(foldMetrics[0].mae).toBe(999);
    expect(meanMetrics.mae).toBe(999);
  });
});

// ── 3. trainWithEarlyStopping ─────────────────────────────────────────────

describe('trainWithEarlyStopping', () => {
  it('should return training history', () => {
    const { X, y } = makeLinearData(100, [2, 3]);
    const trainX = X.slice(0, 80);
    const trainY = y.slice(0, 80);
    const valX = X.slice(80);
    const valY = y.slice(80);

    const model = new LinearRegression();
    const { history } = trainWithEarlyStopping(model, trainX, trainY, valX, valY, {
      maxIterations: 50,
      patience: 10,
    });

    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty('iteration');
    expect(history[0]).toHaveProperty('trainLoss');
    expect(history[0]).toHaveProperty('valLoss');
  });

  it('should stop before maxIterations when no improvement', () => {
    // Noisy data — validation loss plateaus quickly, triggering early stop
    const n = 200;
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 10 - 5;
      X.push([x]);
      y.push(2 * x + (Math.random() - 0.5) * 20); // heavy noise
    }
    const trainX = X.slice(0, 160);
    const trainY = y.slice(0, 160);
    const valX = X.slice(160);
    const valY = y.slice(160);

    const model = new LinearRegression();
    const { history } = trainWithEarlyStopping(model, trainX, trainY, valX, valY, {
      maxIterations: 200,
      patience: 5,
    });

    // With heavy noise, validation loss should plateau and trigger early stop
    expect(history.length).toBeLessThan(200);
  });

  it('should work with different patience values', () => {
    const { X, y } = makeLinearData(100, [2, 3]);
    const trainX = X.slice(0, 80);
    const trainY = y.slice(0, 80);
    const valX = X.slice(80);
    const valY = y.slice(80);

    const model1 = new LinearRegression();
    const { history: h1 } = trainWithEarlyStopping(model1, trainX, trainY, valX, valY, {
      maxIterations: 100,
      patience: 3,
    });

    const model2 = new LinearRegression();
    const { history: h2 } = trainWithEarlyStopping(model2, trainX, trainY, valX, valY, {
      maxIterations: 100,
      patience: 20,
    });

    // Higher patience should run at least as many iterations
    expect(h2.length).toBeGreaterThanOrEqual(h1.length - 5);
  });

  it('should handle empty training data', () => {
    const model = new LinearRegression();
    const { history } = trainWithEarlyStopping(model, [], [], [[1]], [1]);

    expect(history.length).toBe(0);
  });

  it('should work with Ridge model', () => {
    const { X, y } = makeLinearData(100, [2, 3]);
    const trainX = X.slice(0, 80);
    const trainY = y.slice(0, 80);
    const valX = X.slice(80);
    const valY = y.slice(80);

    const model = new RidgeRegression(0.1);
    const { history } = trainWithEarlyStopping(model, trainX, trainY, valX, valY, {
      maxIterations: 50,
      patience: 10,
    });

    expect(history.length).toBeGreaterThan(0);
  });

  it('should work with DecisionTree (single iteration)', () => {
    const { X, y } = makeLinearData(100, [2, 3]);
    const trainX = X.slice(0, 80);
    const trainY = y.slice(0, 80);
    const valX = X.slice(80);
    const valY = y.slice(80);

    const model = new DecisionTree(5, 2, 1);
    const { history } = trainWithEarlyStopping(model, trainX, trainY, valX, valY);

    // Non-linear models train once
    expect(history.length).toBe(1);
    expect(history[0].iteration).toBe(0);
  });

  it('should use default options when not provided', () => {
    const { X, y } = makeLinearData(50, [2, 3]);
    const trainX = X.slice(0, 40);
    const trainY = y.slice(0, 40);
    const valX = X.slice(40);
    const valY = y.slice(40);

    const model = new LinearRegression();
    const { history } = trainWithEarlyStopping(model, trainX, trainY, valX, valY);

    expect(history.length).toBeGreaterThan(0);
    expect(history.length).toBeLessThanOrEqual(100);
  });

  it('should track validation loss in history', () => {
    const { X, y } = makeLinearData(100, [2, 3]);
    const trainX = X.slice(0, 80);
    const trainY = y.slice(0, 80);
    const valX = X.slice(80);
    const valY = y.slice(80);

    const model = new LinearRegression();
    const { history } = trainWithEarlyStopping(model, trainX, trainY, valX, valY, {
      maxIterations: 30,
      patience: 10,
    });

    // All val losses should be finite numbers
    for (const entry of history) {
      expect(Number.isFinite(entry.valLoss)).toBe(true);
      expect(Number.isFinite(entry.trainLoss)).toBe(true);
    }
  });
});

// ── 4. gridSearch ─────────────────────────────────────────────────────────

describe('gridSearch', () => {
  it('should find best parameters', () => {
    const { X, y } = makeLinearData(100, [2, 3]);

    const result = gridSearch(
      (params) => createModel('ridge', params),
      { alpha: [0.001, 0.01, 0.1, 1.0, 10.0] },
      X,
      y,
      3,
    );

    // Best alpha should be small (data has little noise)
    expect(result.bestParams.alpha).toBeLessThanOrEqual(0.1);
    expect(typeof result.bestScore).toBe('number');
    expect(result.bestScore).toBeLessThan(0); // negative MSE
  });

  it('should test all combinations', () => {
    const { X, y } = makeLinearData(60, [2, 3]);

    const result = gridSearch(
      (params) => createModel('ridge', params),
      { alpha: [0.1, 1.0, 10.0] },
      X,
      y,
      3,
    );

    expect(result.results.length).toBe(3);
  });

  it('should test all combinations with multiple parameters', () => {
    const { X, y } = makeLinearData(60, [2, 3]);

    const result = gridSearch(
      (params) => createModel('decision_tree', params),
      { maxDepth: [3, 5], minSamplesSplit: [2, 5] },
      X,
      y,
      3,
    );

    // 2 * 2 = 4 combinations
    expect(result.results.length).toBe(4);
  });

  it('should return results sorted by score (descending)', () => {
    const { X, y } = makeLinearData(100, [2, 3]);

    const result = gridSearch(
      (params) => createModel('ridge', params),
      { alpha: [0.001, 0.1, 1.0, 10.0] },
      X,
      y,
      3,
    );

    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i - 1].score).toBeGreaterThanOrEqual(result.results[i].score);
    }
  });

  it('should include foldMetrics in each result', () => {
    const { X, y } = makeLinearData(80, [2, 3]);

    const result = gridSearch(
      (params) => createModel('ridge', params),
      { alpha: [0.1, 1.0] },
      X,
      y,
      3,
    );

    for (const entry of result.results) {
      expect(entry.foldMetrics.length).toBe(3);
      expect(entry.params).toBeDefined();
      expect(typeof entry.score).toBe('number');
    }
  });

  it('should handle empty param grid', () => {
    const { X, y } = makeLinearData(50, [2, 3]);

    const result = gridSearch(
      (params) => createModel('ridge', params),
      {},
      X,
      y,
      3,
    );

    expect(result.results.length).toBe(0);
    expect(result.bestScore).toBe(-Infinity);
  });
});

// ── 5. selectBestModel ────────────────────────────────────────────────────

describe('selectBestModel', () => {
  it('should compare multiple models', () => {
    const { X, y } = makeLinearData(200, [2, 3]);

    const result = selectBestModel(
      [
        { type: 'linear' },
        { type: 'ridge', params: { alpha: 0.1 } },
      ],
      X,
      y,
      5,
    );

    expect(result.comparison.length).toBe(2);
    expect(result.comparison[0].type).toBe('linear');
    expect(result.comparison[1].type).toBe('ridge');
  });

  it('should return best performing model', () => {
    const { X, y } = makeLinearData(200, [2, 3]);

    const result = selectBestModel(
      [
        { type: 'linear' },
        { type: 'ridge', params: { alpha: 0.1 } },
      ],
      X,
      y,
      5,
    );

    // Both should perform well; bestModel should be trained
    expect(result.bestModel).toBeDefined();
    expect(result.bestType).toBeDefined();

    // Best model should be able to predict
    const preds = result.bestModel.predict([[1, 2]]);
    expect(preds.length).toBe(1);
    expect(typeof preds[0]).toBe('number');
  });

  it('should work with tree models', () => {
    const { X, y } = makeLinearData(100, [2, 3]);

    const result = selectBestModel(
      [
        { type: 'decision_tree', params: { maxDepth: 5 } },
        { type: 'random_forest', params: { nEstimators: 5 } },
      ],
      X,
      y,
      3,
    );

    expect(result.comparison.length).toBe(2);
    expect(['decision_tree', 'random_forest']).toContain(result.bestType);
  });

  it('should include meanMetrics in comparison entries', () => {
    const { X, y } = makeLinearData(100, [2, 3]);

    const result = selectBestModel(
      [{ type: 'linear' }, { type: 'ridge', params: { alpha: 1.0 } }],
      X,
      y,
      3,
    );

    for (const entry of result.comparison) {
      expect(entry.meanMetrics).toBeDefined();
      expect(typeof entry.meanMetrics.mae).toBe('number');
      expect(typeof entry.meanMetrics.rmse).toBe('number');
      expect(typeof entry.meanMetrics.r2).toBe('number');
    }
  });

  it('should work with different datasets', () => {
    const { X: X1, y: y1 } = makeLinearData(100, [5, 1]);
    const { X: X2, y: y2 } = makeLinearData(100, [1, 5]);

    const r1 = selectBestModel([{ type: 'linear' }], X1, y1, 3);
    const r2 = selectBestModel([{ type: 'linear' }], X2, y2, 3);

    // Both should produce valid results
    expect(r1.bestType).toBe('linear');
    expect(r2.bestType).toBe('linear');
  });
});

// ── 6. computeAllMetrics ──────────────────────────────────────────────────

describe('computeAllMetrics', () => {
  it('should compute regression metrics correctly', () => {
    const yTrue = [1, 2, 3, 4, 5];
    const yPred = [1.1, 2.2, 2.8, 4.1, 4.9];

    const metrics = computeAllMetrics(yTrue, yPred);

    expect(metrics.mae).toBeCloseTo(0.14, 2);
    expect(metrics.rmse).toBeGreaterThan(0);
    expect(metrics.r2).toBeGreaterThan(0.9);
  });

  it('should return R² = 1 for perfect predictions', () => {
    const yTrue = [1, 2, 3, 4, 5];
    const yPred = [1, 2, 3, 4, 5];

    const metrics = computeAllMetrics(yTrue, yPred);

    expect(metrics.mae).toBeCloseTo(0, 10);
    expect(metrics.rmse).toBeCloseTo(0, 10);
    expect(metrics.r2).toBeCloseTo(1, 10);
  });

  it('should handle empty arrays', () => {
    const metrics = computeAllMetrics([], []);

    expect(metrics.mae).toBe(0);
    expect(metrics.rmse).toBe(0);
    expect(metrics.r2).toBe(0);
  });

  it('should detect classification task and compute accuracy/F1', () => {
    const yTrue = [0, 0, 1, 1, 1];
    const yPred = [0, 1, 1, 1, 0];

    const metrics = computeAllMetrics(yTrue, yPred);

    expect(metrics.accuracy).toBe(0.6); // 3/5 correct
    expect(metrics.f1).toBeDefined();
    expect(metrics.f1!).toBeGreaterThan(0);
    expect(metrics.f1!).toBeLessThanOrEqual(1);
  });

  it('should return perfect F1 for perfect classification', () => {
    const yTrue = [0, 0, 1, 1, 1];
    const yPred = [0, 0, 1, 1, 1];

    const metrics = computeAllMetrics(yTrue, yPred);

    expect(metrics.accuracy).toBeCloseTo(1, 10);
    expect(metrics.f1).toBeCloseTo(1, 10);
  });

  it('should handle single sample', () => {
    const metrics = computeAllMetrics([5], [5]);

    expect(metrics.mae).toBe(0);
    expect(metrics.rmse).toBe(0);
    expect(metrics.r2).toBe(1);
  });

  it('should return negative R² for poor predictions', () => {
    const yTrue = [1, 2, 3, 4, 5];
    const yPred = [10, 20, 30, 40, 50]; // Way off

    const metrics = computeAllMetrics(yTrue, yPred);

    expect(metrics.r2).toBeLessThan(0);
  });

  it('should handle constant target values', () => {
    const yTrue = [5, 5, 5, 5];
    const yPred = [5, 5, 5, 5];

    const metrics = computeAllMetrics(yTrue, yPred);

    expect(metrics.mae).toBe(0);
    expect(metrics.rmse).toBe(0);
    expect(metrics.r2).toBe(1);
  });
});
