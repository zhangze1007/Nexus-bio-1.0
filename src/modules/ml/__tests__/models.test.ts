/**
 * Tests for ML Models Layer
 *
 * Covers:
 *   1. Linear Regression (Normal Equation)
 *   2. Ridge Regression (L2)
 *   3. Lasso Regression (Coordinate Descent)
 *   4. Decision Tree (CART)
 *   5. Random Forest (Bagging)
 *   6. Serialization roundtrip
 *   7. Model Registry (createModel / deserializeModel)
 */

import {
  LinearRegression,
  RidgeRegression,
  LassoRegression,
  DecisionTree,
  RandomForest,
  createModel,
  deserializeModel,
} from '../models';

// ── Helper Functions ────────────────────────────────────────────────────────

/** Compute R² score */
function r2Score(yTrue: number[], yPred: number[]): number {
  const mean = yTrue.reduce((s, v) => s + v, 0) / yTrue.length;
  const ssRes = yTrue.reduce((s, yt, i) => s + (yt - yPred[i]) ** 2, 0);
  const ssTot = yTrue.reduce((s, yt) => s + (yt - mean) ** 2, 0);
  return ssTot === 0 ? 1 : 1 - ssRes / ssTot;
}

/** Compute RMSE */
function rmse(yTrue: number[], yPred: number[]): number {
  const mse = yTrue.reduce((s, yt, i) => s + (yt - yPred[i]) ** 2, 0) / yTrue.length;
  return Math.sqrt(mse);
}

/** Generate perfectly linear data: y = w . x */
function generateLinearData(
  n: number,
  weights: number[],
  noise: number = 0,
): { X: number[][]; y: number[] } {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = weights.map(() => Math.random() * 10 - 5);
    const yi = x.reduce((s, v, j) => s + v * weights[j], 0) + (noise > 0 ? (Math.random() - 0.5) * noise : 0);
    X.push(x);
    y.push(yi);
  }
  return { X, y };
}

/** Generate XOR-like non-linear data */
function generateXORData(n: number): { X: number[][]; y: number[] } {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x1 = Math.random() > 0.5 ? 1 : 0;
    const x2 = Math.random() > 0.5 ? 1 : 0;
    X.push([x1, x2]);
    y.push(x1 ^ x2 ? 1.0 : 0.0);
  }
  return { X, y };
}

// ── 1. Linear Regression ────────────────────────────────────────────────────

describe('LinearRegression', () => {
  it('should fit perfectly linear data and predict accurately', () => {
    // y = 2*x1 + 3*x2
    const { X, y } = generateLinearData(200, [2, 3]);
    const model = new LinearRegression();
    model.fit(X, y);

    const preds = model.predict(X);
    const r2 = r2Score(y, preds);

    expect(r2).toBeGreaterThan(0.99);
  });

  it('should recover correct coefficients for known linear relationship', () => {
    // y = 5*x1 - 2*x2 + 1*x3
    const { X, y } = generateLinearData(500, [5, -2, 1]);
    const model = new LinearRegression();
    model.fit(X, y);

    // Get weights (bias + features)
    const serialized = JSON.parse(model.serialize());
    const weights = serialized.weights;

    // Bias should be ~0 (no intercept in data)
    expect(Math.abs(weights[0])).toBeLessThan(0.1);
    // Feature weights should be close to [5, -2, 1]
    expect(Math.abs(weights[1] - 5)).toBeLessThan(0.1);
    expect(Math.abs(weights[2] - (-2))).toBeLessThan(0.1);
    expect(Math.abs(weights[3] - 1)).toBeLessThan(0.1);
  });

  it('should handle empty data gracefully', () => {
    const model = new LinearRegression();
    model.fit([], []);

    const preds = model.predict([[1, 2], [3, 4]]);
    expect(preds).toEqual([0, 0]);
  });

  it('should handle single feature', () => {
    // y = 4*x
    const X = [[1], [2], [3], [4], [5]];
    const y = [4, 8, 12, 16, 20];
    const model = new LinearRegression();
    model.fit(X, y);

    const preds = model.predict([[6]]);
    expect(Math.abs(preds[0] - 24)).toBeLessThan(0.1);
  });

  it('should return feature importances that sum to 1', () => {
    const { X, y } = generateLinearData(100, [2, 3, 1]);
    const model = new LinearRegression();
    model.fit(X, y);

    const importances = model.getFeatureImportances();
    expect(importances.length).toBe(3);
    const sum = importances.reduce((s, v) => s + v, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-10);
  });
});

// ── 2. Ridge Regression ─────────────────────────────────────────────────────

describe('RidgeRegression', () => {
  it('should handle multicollinear features without crashing', () => {
    // Create multicollinear data: x2 = x1 + small noise
    const n = 100;
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const x1 = Math.random() * 10;
      const x2 = x1 + (Math.random() - 0.5) * 0.01; // Nearly identical
      X.push([x1, x2]);
      y.push(2 * x1 + 3 * x2);
    }

    const model = new RidgeRegression(1.0);
    model.fit(X, y);
    const preds = model.predict(X);

    // Should still predict reasonably well
    const r2 = r2Score(y, preds);
    expect(r2).toBeGreaterThan(0.8);
  });

  it('should prevent overfitting with regularization', () => {
    // Generate simple data with noise
    const { X, y } = generateLinearData(50, [2, 3], 5);

    // High regularization
    const ridge = new RidgeRegression(100.0);
    ridge.fit(X, y);

    // Low regularization
    const linear = new LinearRegression();
    linear.fit(X, y);

    // Ridge weights should be smaller (closer to zero)
    const ridgeWeights = JSON.parse(ridge.serialize()).weights;
    const linearWeights = JSON.parse(linear.serialize()).weights;

    const ridgeNorm = ridgeWeights.slice(1).reduce((s: number, w: number) => s + w ** 2, 0);
    const linearNorm = linearWeights.slice(1).reduce((s: number, w: number) => s + w ** 2, 0);

    expect(ridgeNorm).toBeLessThanOrEqual(linearNorm);
  });

  it('should give same result as Linear Regression when alpha=0', () => {
    const { X, y } = generateLinearData(100, [2, 3]);

    const linear = new LinearRegression();
    linear.fit(X, y);

    const ridge = new RidgeRegression(0);
    ridge.fit(X, y);

    const linearPreds = linear.predict(X);
    const ridgePreds = ridge.predict(X);

    // Should be very close (numerical precision)
    for (let i = 0; i < linearPreds.length; i++) {
      expect(Math.abs(linearPreds[i] - ridgePreds[i])).toBeLessThan(1e-6);
    }
  });

  it('should handle empty data gracefully', () => {
    const model = new RidgeRegression(1.0);
    model.fit([], []);
    const preds = model.predict([[1, 2]]);
    expect(preds).toEqual([0]);
  });
});

// ── 3. Lasso Regression ─────────────────────────────────────────────────────

describe('LassoRegression', () => {
  it('should perform feature selection (some coefficients become 0)', () => {
    // Only first 2 features matter
    const n = 200;
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = Array.from({ length: 5 }, () => Math.random() * 10);
      X.push(x);
      y.push(3 * x[0] + 2 * x[1]); // features 2,3,4 are noise
    }

    const model = new LassoRegression(0.5, 2000, 1e-6);
    model.fit(X, y);

    const serialized = JSON.parse(model.serialize());
    const weights = serialized.weights.slice(1); // exclude bias

    // At least some weights should be exactly 0
    const zeroWeights = weights.filter((w: number) => Math.abs(w) < 1e-6);
    expect(zeroWeights.length).toBeGreaterThan(0);
  });

  it('should converge within max iterations', () => {
    const { X, y } = generateLinearData(100, [2, 3]);

    // Very few iterations - should still converge for simple data
    const model = new LassoRegression(0.01, 100, 1e-4);
    model.fit(X, y);

    const preds = model.predict(X);
    const r2 = r2Score(y, preds);
    expect(r2).toBeGreaterThan(0.9);
  });

  it('should handle empty data gracefully', () => {
    const model = new LassoRegression();
    model.fit([], []);
    const preds = model.predict([[1, 2]]);
    expect(preds).toEqual([0]);
  });

  it('should return feature importances that sum to 1', () => {
    const { X, y } = generateLinearData(100, [5, 2, 1]);
    const model = new LassoRegression(0.1);
    model.fit(X, y);

    const importances = model.getFeatureImportances();
    expect(importances.length).toBe(3);
    const sum = importances.reduce((s, v) => s + v, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-10);
  });
});

// ── 4. Decision Tree ────────────────────────────────────────────────────────

describe('DecisionTree', () => {
  it('should fit non-linear data (XOR-like pattern)', () => {
    const { X, y } = generateXORData(200);

    const tree = new DecisionTree(10, 2, 1);
    tree.fit(X, y);

    // Predict on known XOR inputs
    const testX = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const preds = tree.predict(testX);

    // XOR: (0,0)->0, (0,1)->1, (1,0)->1, (1,1)->0
    expect(preds[0]).toBeCloseTo(0, 0);
    expect(preds[1]).toBeCloseTo(1, 0);
    expect(preds[2]).toBeCloseTo(1, 0);
    expect(preds[3]).toBeCloseTo(0, 0);
  });

  it('should respect max depth parameter', () => {
    const { X, y } = generateLinearData(200, [2, 3]);

    // Very shallow tree
    const tree = new DecisionTree(1, 2, 1);
    tree.fit(X, y);

    // Should still produce predictions (just less accurate)
    const preds = tree.predict(X);
    expect(preds.length).toBe(X.length);
    preds.forEach(p => expect(typeof p).toBe('number'));
  });

  it('should have feature importances that sum to 1', () => {
    const { X, y } = generateLinearData(200, [2, 3, 1]);
    const tree = new DecisionTree(5, 2, 1);
    tree.fit(X, y);

    const importances = tree.getFeatureImportances();
    expect(importances.length).toBe(3);
    const sum = importances.reduce((s, v) => s + v, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-10);
  });

  it('should handle empty data gracefully', () => {
    const tree = new DecisionTree();
    tree.fit([], []);
    const preds = tree.predict([[1, 2]]);
    expect(preds).toEqual([0]);
  });

  it('should handle single sample', () => {
    const tree = new DecisionTree();
    tree.fit([[1, 2]], [5]);
    const preds = tree.predict([[1, 2]]);
    expect(preds[0]).toBeCloseTo(5, 5);
  });

  it('should reduce MSE with deeper trees', () => {
    const { X, y } = generateLinearData(200, [2, 3], 5);

    const shallowTree = new DecisionTree(2, 2, 1);
    shallowTree.fit(X, y);
    const shallowPreds = shallowTree.predict(X);
    const shallowRMSE = rmse(y, shallowPreds);

    const deepTree = new DecisionTree(15, 2, 1);
    deepTree.fit(X, y);
    const deepPreds = deepTree.predict(X);
    const deepRMSE = rmse(y, deepPreds);

    expect(deepRMSE).toBeLessThanOrEqual(shallowRMSE);
  });
});

// ── 5. Random Forest ────────────────────────────────────────────────────────

describe('RandomForest', () => {
  it('should produce reasonable predictions on test data', () => {
    // Simple 2-feature problem with clear signal
    const { X, y } = generateLinearData(300, [5, 3], 2);

    const trainX = X.slice(0, 200);
    const trainY = y.slice(0, 200);
    const testX = X.slice(200);
    const testY = y.slice(200);

    // Use all features per tree (maxFeatures = nFeatures) to avoid subset issues
    const forest = new RandomForest(20, 2, 10, 2, 1);
    forest.fit(trainX, trainY);
    const preds = forest.predict(testX);
    const testR2 = r2Score(testY, preds);

    // Forest should explain at least 70% of variance on test data
    expect(testR2).toBeGreaterThan(0.7);
  });

  it('should have meaningful feature importances', () => {
    // Feature 0 dominates, feature 1 has moderate signal
    const n = 500;
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = Array.from({ length: 5 }, () => Math.random() * 10);
      X.push(x);
      y.push(100 * x[0] + 1 * x[1] + 0.01 * x[2]);
    }

    const forest = new RandomForest(30, 0, 8, 2, 1);
    forest.fit(X, y);

    const importances = forest.getFeatureImportances();
    expect(importances.length).toBe(5);
    const sum = importances.reduce((s, v) => s + v, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-10);

    // Feature 0 should have highest importance (dominant signal)
    expect(importances[0]).toBeGreaterThan(importances[3]);
    expect(importances[0]).toBeGreaterThan(importances[4]);
  });

  it('should work with default parameters', () => {
    const { X, y } = generateLinearData(100, [2, 3]);
    const forest = new RandomForest();
    forest.fit(X, y);

    const preds = forest.predict(X);
    expect(preds.length).toBe(X.length);
    preds.forEach(p => expect(typeof p).toBe('number'));
  });

  it('should handle empty data gracefully', () => {
    const forest = new RandomForest();
    forest.fit([], []);
    const preds = forest.predict([[1, 2]]);
    expect(preds).toEqual([0]);
  });

  it('should have feature importances that sum to 1', () => {
    const { X, y } = generateLinearData(100, [2, 3, 1]);
    const forest = new RandomForest(5);
    forest.fit(X, y);

    const importances = forest.getFeatureImportances();
    const sum = importances.reduce((s, v) => s + v, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-10);
  });
});

// ── 6. Serialization Roundtrip ──────────────────────────────────────────────

describe('Serialization', () => {
  it('should roundtrip LinearRegression correctly', () => {
    const { X, y } = generateLinearData(100, [2, 3]);
    const model = new LinearRegression();
    model.fit(X, y);

    const preds1 = model.predict(X);
    const json = model.serialize();
    const restored = deserializeModel(json);
    const preds2 = restored.predict(X);

    for (let i = 0; i < preds1.length; i++) {
      expect(preds2[i]).toBeCloseTo(preds1[i], 10);
    }
  });

  it('should roundtrip RidgeRegression correctly', () => {
    const { X, y } = generateLinearData(100, [2, 3]);
    const model = new RidgeRegression(0.5);
    model.fit(X, y);

    const preds1 = model.predict(X);
    const json = model.serialize();
    const restored = deserializeModel(json);
    const preds2 = restored.predict(X);

    for (let i = 0; i < preds1.length; i++) {
      expect(preds2[i]).toBeCloseTo(preds1[i], 10);
    }
  });

  it('should roundtrip LassoRegression correctly', () => {
    const { X, y } = generateLinearData(100, [2, 3]);
    const model = new LassoRegression(0.1, 500, 1e-4);
    model.fit(X, y);

    const preds1 = model.predict(X);
    const json = model.serialize();
    const restored = deserializeModel(json);
    const preds2 = restored.predict(X);

    for (let i = 0; i < preds1.length; i++) {
      expect(preds2[i]).toBeCloseTo(preds1[i], 10);
    }
  });

  it('should roundtrip DecisionTree correctly', () => {
    const { X, y } = generateXORData(100);
    const model = new DecisionTree(10, 2, 1);
    model.fit(X, y);

    const preds1 = model.predict(X);
    const json = model.serialize();
    const restored = deserializeModel(json);
    const preds2 = restored.predict(X);

    for (let i = 0; i < preds1.length; i++) {
      expect(preds2[i]).toBeCloseTo(preds1[i], 10);
    }
  });

  it('should roundtrip RandomForest correctly', () => {
    const { X, y } = generateLinearData(100, [2, 3]);
    const model = new RandomForest(5, 0, 5, 2, 1);
    model.fit(X, y);

    const preds1 = model.predict(X);
    const json = model.serialize();
    const restored = deserializeModel(json);
    const preds2 = restored.predict(X);

    for (let i = 0; i < preds1.length; i++) {
      expect(preds2[i]).toBeCloseTo(preds1[i], 10);
    }
  });
});

// ── 7. Model Registry ───────────────────────────────────────────────────────

describe('Model Registry', () => {
  it('should create correct model types via createModel', () => {
    const linear = createModel('linear');
    expect(linear).toBeInstanceOf(LinearRegression);

    const ridge = createModel('ridge', { alpha: 0.5 });
    expect(ridge).toBeInstanceOf(RidgeRegression);

    const lasso = createModel('lasso', { alpha: 0.2, maxIter: 500 });
    expect(lasso).toBeInstanceOf(LassoRegression);

    const tree = createModel('decision_tree', { maxDepth: 5 });
    expect(tree).toBeInstanceOf(DecisionTree);

    const forest = createModel('random_forest', { nEstimators: 5 });
    expect(forest).toBeInstanceOf(RandomForest);
  });

  it('should use default params when not specified', () => {
    const ridge = createModel('ridge');
    expect(ridge).toBeInstanceOf(RidgeRegression);

    const lasso = createModel('lasso');
    expect(lasso).toBeInstanceOf(LassoRegression);

    const tree = createModel('decision_tree');
    expect(tree).toBeInstanceOf(DecisionTree);

    const forest = createModel('random_forest');
    expect(forest).toBeInstanceOf(RandomForest);
  });

  it('should throw for unknown model type', () => {
    expect(() => createModel('unknown' as any)).toThrow('Unknown model type');
  });

  it('should deserializeModel for all types', () => {
    const { X, y } = generateLinearData(50, [2, 3]);

    // Linear
    const linear = new LinearRegression();
    linear.fit(X, y);
    const linearRestored = deserializeModel(linear.serialize());
    expect(linearRestored).toBeInstanceOf(LinearRegression);

    // Ridge
    const ridge = new RidgeRegression(0.5);
    ridge.fit(X, y);
    const ridgeRestored = deserializeModel(ridge.serialize());
    expect(ridgeRestored).toBeInstanceOf(RidgeRegression);

    // Lasso
    const lasso = new LassoRegression(0.1, 200, 1e-4);
    lasso.fit(X, y);
    const lassoRestored = deserializeModel(lasso.serialize());
    expect(lassoRestored).toBeInstanceOf(LassoRegression);

    // Decision Tree
    const tree = new DecisionTree(5, 2, 1);
    tree.fit(X, y);
    const treeRestored = deserializeModel(tree.serialize());
    expect(treeRestored).toBeInstanceOf(DecisionTree);

    // Random Forest
    const forest = new RandomForest(3);
    forest.fit(X, y);
    const forestRestored = deserializeModel(forest.serialize());
    expect(forestRestored).toBeInstanceOf(RandomForest);
  });

  it('should throw for invalid JSON in deserializeModel', () => {
    expect(() => deserializeModel('{"type":"invalid"}')).toThrow('Unknown model type');
  });
});
