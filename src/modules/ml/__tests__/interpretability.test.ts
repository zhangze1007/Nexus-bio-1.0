/**
 * Tests for ML Feature Importance / Interpretability
 *
 * Covers:
 *   1. getLinearImportances — coefficient extraction from LinearRegression, Ridge, Lasso
 *   2. getTreeImportances — impurity reduction from DecisionTree, RandomForest
 *   3. permutationImportance — model-agnostic shuffling-based importance
 *   4. rankImportances / exportImportancesToJSON / exportImportancesToCSV
 *   5. Edge cases — empty features, single feature, equal importances
 */

import {
  getLinearImportances,
  getTreeImportances,
  permutationImportance,
  rankImportances,
  exportImportancesToJSON,
  exportImportancesToCSV,
} from '../interpretability';
import {
  LinearRegression,
  RidgeRegression,
  LassoRegression,
  DecisionTree,
  RandomForest,
} from '../models';
import type { FeatureImportance } from '../types';

// ── Test Data ───────────────────────────────────────────────────────────────

/**
 * Generate a simple dataset where y = 2*x0 + 3*x1 + noise.
 * x0 has moderate importance, x1 has high importance.
 */
function generateLinearData(n: number = 100): {
  X: number[][];
  y: number[];
  featureNames: string[];
} {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = Math.random() * 10;
    const x1 = Math.random() * 10;
    X.push([x0, x1]);
    y.push(2 * x0 + 3 * x1 + (Math.random() - 0.5) * 0.5);
  }
  return { X, y, featureNames: ['feature_0', 'feature_1'] };
}

/**
 * Generate a dataset with 3 features where y = 5*x0 + 0.1*x1 + 0.01*x2.
 * Feature 0 is dominant, feature 2 is nearly irrelevant.
 */
function generateSkewedData(n: number = 200): {
  X: number[][];
  y: number[];
  featureNames: string[];
} {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = Math.random() * 10;
    const x1 = Math.random() * 10;
    const x2 = Math.random() * 10;
    X.push([x0, x1, x2]);
    y.push(5 * x0 + 0.1 * x1 + 0.01 * x2 + (Math.random() - 0.5) * 0.1);
  }
  return { X, y, featureNames: ['dominant', 'weak', 'negligible'] };
}

/**
 * Generate data for tree models: y = x0^2 + x1 (nonlinear).
 */
function generateTreeData(n: number = 200): {
  X: number[][];
  y: number[];
  featureNames: string[];
} {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = Math.random() * 10;
    const x1 = Math.random() * 10;
    X.push([x0, x1]);
    y.push(x0 * x0 + x1 + (Math.random() - 0.5) * 2);
  }
  return { X, y, featureNames: ['squared', 'linear'] };
}

// ── 1. Linear Importances ──────────────────────────────────────────────────

describe('getLinearImportances', () => {
  it('should extract coefficients from LinearRegression', () => {
    const { X, y, featureNames } = generateLinearData(100);
    const model = new LinearRegression();
    model.fit(X, y);

    const importances = getLinearImportances(model, featureNames);

    expect(importances).toHaveLength(2);
    expect(importances[0].featureName).toBe('feature_1'); // Higher coefficient (3 vs 2)
    expect(importances[0].importance).toBeGreaterThan(0);
    expect(importances[0].rank).toBe(1);
    expect(importances[1].rank).toBe(2);
  });

  it('should extract coefficients from RidgeRegression', () => {
    const { X, y, featureNames } = generateLinearData(100);
    const model = new RidgeRegression(1.0);
    model.fit(X, y);

    const importances = getLinearImportances(model, featureNames);

    expect(importances).toHaveLength(2);
    // Both features should have nonzero importance
    expect(importances[0].importance).toBeGreaterThan(0);
    expect(importances[1].importance).toBeGreaterThan(0);
    // feature_1 has higher coefficient (3 > 2)
    expect(importances[0].featureName).toBe('feature_1');
  });

  it('should extract coefficients from LassoRegression', () => {
    const { X, y, featureNames } = generateLinearData(100);
    const model = new LassoRegression(0.01, 2000, 1e-6);
    model.fit(X, y);

    const importances = getLinearImportances(model, featureNames);

    expect(importances).toHaveLength(2);
    expect(importances[0].importance).toBeGreaterThan(0);
  });

  it('should rank features correctly (descending by importance)', () => {
    const { X, y, featureNames } = generateSkewedData(200);
    const model = new LinearRegression();
    model.fit(X, y);

    const importances = getLinearImportances(model, featureNames);

    expect(importances).toHaveLength(3);
    // dominant feature should be ranked 1
    expect(importances[0].featureName).toBe('dominant');
    expect(importances[0].rank).toBe(1);
    // Importance values should be in descending order
    for (let i = 1; i < importances.length; i++) {
      expect(importances[i].importance).toBeLessThanOrEqual(importances[i - 1].importance);
    }
  });

  it('should handle model with all-zero weights', () => {
    const model = new LinearRegression();
    model.fit([], []);

    const importances = getLinearImportances(model, ['a', 'b']);

    expect(importances).toHaveLength(2);
    expect(importances[0].importance).toBe(0);
    expect(importances[1].importance).toBe(0);
  });
});

// ── 2. Tree Importances ────────────────────────────────────────────────────

describe('getTreeImportances', () => {
  it('should extract importances from DecisionTree', () => {
    const { X, y, featureNames } = generateTreeData(200);
    const model = new DecisionTree(8, 5, 2);
    model.fit(X, y);

    const importances = getTreeImportances(model, featureNames);

    expect(importances).toHaveLength(2);
    expect(importances[0].importance).toBeGreaterThanOrEqual(0);
    expect(importances[1].importance).toBeGreaterThanOrEqual(0);
  });

  it('should extract importances from RandomForest', () => {
    const { X, y, featureNames } = generateTreeData(200);
    const model = new RandomForest(20, 0, 8, 5, 2);
    model.fit(X, y);

    const importances = getTreeImportances(model, featureNames);

    expect(importances).toHaveLength(2);
    expect(importances[0].importance).toBeGreaterThanOrEqual(0);
    expect(importances[1].importance).toBeGreaterThanOrEqual(0);
  });

  it('should have importances summing to 1 (normalized)', () => {
    const { X, y, featureNames } = generateTreeData(200);
    const model = new RandomForest(30, 0, 10, 5, 2);
    model.fit(X, y);

    const importances = getTreeImportances(model, featureNames);

    const sum = importances.reduce((s, imp) => s + imp.importance, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('should rank features correctly', () => {
    const { X, y, featureNames } = generateTreeData(300);
    const model = new RandomForest(30, 0, 10, 5, 2);
    model.fit(X, y);

    const importances = getTreeImportances(model, featureNames);

    expect(importances[0].rank).toBe(1);
    // Ranks start at 1; ties get same rank, non-ties get sequential ranks
    const ranks = importances.map(imp => imp.rank);
    expect(ranks[0]).toBe(1);
    // If not tied, second rank should be 2
    if (importances[0].importance !== importances[1].importance) {
      expect(ranks[1]).toBe(2);
    }
    // Descending order
    for (let i = 1; i < importances.length; i++) {
      expect(importances[i].importance).toBeLessThanOrEqual(importances[i - 1].importance);
    }
  });

  it('should handle untrained model (empty fit)', () => {
    const model = new DecisionTree();
    model.fit([], []);

    const importances = getTreeImportances(model, ['a', 'b']);

    expect(importances).toHaveLength(2);
    expect(importances[0].importance).toBe(0);
    expect(importances[1].importance).toBe(0);
  });
});

// ── 3. Permutation Importance ──────────────────────────────────────────────

describe('permutationImportance', () => {
  it('should give higher importance to dominant features', () => {
    const { X, y, featureNames } = generateSkewedData(200);
    const model = new LinearRegression();
    model.fit(X, y);

    const importances = permutationImportance(model, X, y, featureNames, {
      nRepeats: 10,
    });

    expect(importances).toHaveLength(3);
    // dominant feature should have highest importance
    expect(importances[0].featureName).toBe('dominant');
    expect(importances[0].importance).toBeGreaterThan(0);
  });

  it('should give lower importance to unimportant features', () => {
    const { X, y, featureNames } = generateSkewedData(200);
    const model = new LinearRegression();
    model.fit(X, y);

    const importances = permutationImportance(model, X, y, featureNames, {
      nRepeats: 10,
    });

    // negligible feature should have lowest importance
    const negligible = importances.find(imp => imp.featureName === 'negligible');
    const dominant = importances.find(imp => imp.featureName === 'dominant');
    expect(negligible).toBeDefined();
    expect(dominant).toBeDefined();
    expect(negligible!.importance).toBeLessThan(dominant!.importance);
  });

  it('should work with different nRepeats', () => {
    const { X, y, featureNames } = generateLinearData(100);
    const model = new LinearRegression();
    model.fit(X, y);

    const imp3 = permutationImportance(model, X, y, featureNames, { nRepeats: 3 });
    const imp10 = permutationImportance(model, X, y, featureNames, { nRepeats: 10 });

    expect(imp3).toHaveLength(2);
    expect(imp10).toHaveLength(2);
    // Both should have same ranking (feature_1 > feature_0)
    expect(imp3[0].featureName).toBe(imp10[0].featureName);
  });

  it('should work with custom metric function', () => {
    const { X, y, featureNames } = generateLinearData(100);
    const model = new LinearRegression();
    model.fit(X, y);

    // Custom metric: negative MAE
    const customMetric = (yTrue: number[], yPred: number[]): number => {
      let sum = 0;
      for (let i = 0; i < yTrue.length; i++) {
        sum += Math.abs(yTrue[i] - yPred[i]);
      }
      return -sum / yTrue.length;
    };

    const importances = permutationImportance(model, X, y, featureNames, {
      nRepeats: 5,
      metric: customMetric,
    });

    expect(importances).toHaveLength(2);
    expect(importances[0].importance).toBeGreaterThan(0);
  });

  it('should work with tree-based models', () => {
    const { X, y, featureNames } = generateTreeData(200);
    const model = new RandomForest(20, 0, 8, 5, 2);
    model.fit(X, y);

    const importances = permutationImportance(model, X, y, featureNames, {
      nRepeats: 5,
    });

    expect(importances).toHaveLength(2);
    expect(importances[0].rank).toBe(1);
  });

  it('should handle empty data gracefully', () => {
    const model = new LinearRegression();
    model.fit([[1, 2]], [3]);

    const importances = permutationImportance(model, [], [], []);

    expect(importances).toHaveLength(0);
  });
});

// ── 4. Ranking and Export ──────────────────────────────────────────────────

describe('rankImportances', () => {
  it('should sort by importance descending', () => {
    const input: FeatureImportance[] = [
      { featureName: 'low', importance: 0.1, rank: 2 },
      { featureName: 'high', importance: 0.9, rank: 1 },
      { featureName: 'mid', importance: 0.5, rank: 3 },
    ];

    const ranked = rankImportances(input);

    expect(ranked[0].featureName).toBe('high');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].featureName).toBe('mid');
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].featureName).toBe('low');
    expect(ranked[2].rank).toBe(3);
  });

  it('should handle ties (same rank)', () => {
    const input: FeatureImportance[] = [
      { featureName: 'a', importance: 0.5, rank: 1 },
      { featureName: 'b', importance: 0.5, rank: 2 },
    ];

    const ranked = rankImportances(input);

    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1); // Tie: same rank
  });

  it('should handle empty array', () => {
    const ranked = rankImportances([]);
    expect(ranked).toHaveLength(0);
  });
});

describe('exportImportancesToJSON', () => {
  it('should produce parseable JSON', () => {
    const importances: FeatureImportance[] = [
      { featureName: 'MW', importance: 0.45, rank: 1 },
      { featureName: 'pI', importance: 0.30, rank: 2 },
    ];

    const json = exportImportancesToJSON(importances);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].featureName).toBe('MW');
    expect(parsed[0].importance).toBe(0.45);
    expect(parsed[0].rank).toBe(1);
  });

  it('should be pretty-printed (2-space indent)', () => {
    const importances: FeatureImportance[] = [
      { featureName: 'MW', importance: 0.45, rank: 1 },
    ];

    const json = exportImportancesToJSON(importances);

    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });

  it('should handle empty array', () => {
    const json = exportImportancesToJSON([]);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(0);
  });
});

describe('exportImportancesToCSV', () => {
  it('should have correct CSV format with header', () => {
    const importances: FeatureImportance[] = [
      { featureName: 'MW', importance: 0.45, rank: 1 },
      { featureName: 'pI', importance: 0.30, rank: 2 },
    ];

    const csv = exportImportancesToCSV(importances);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('featureName,importance,rank');
    expect(lines[1]).toBe('MW,0.45,1');
    expect(lines[2]).toBe('pI,0.3,2');
  });

  it('should handle empty array (header only)', () => {
    const csv = exportImportancesToCSV([]);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('featureName,importance,rank');
  });

  it('should handle single feature', () => {
    const importances: FeatureImportance[] = [
      { featureName: 'hydrophobicity', importance: 1.0, rank: 1 },
    ];

    const csv = exportImportancesToCSV(importances);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('hydrophobicity,1,1');
  });
});

// ── 5. Edge Cases ──────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('should handle empty feature names for linear importances', () => {
    const model = new LinearRegression();
    model.fit([[1, 2], [3, 4]], [5, 7]);

    const importances = getLinearImportances(model, []);

    expect(importances).toHaveLength(0);
  });

  it('should handle empty feature names for tree importances', () => {
    const model = new DecisionTree();
    model.fit([[1, 2], [3, 4]], [5, 7]);

    const importances = getTreeImportances(model, []);

    expect(importances).toHaveLength(0);
  });

  it('should handle single feature for linear importances', () => {
    const X = [[1], [2], [3], [4], [5]];
    const y = [2, 4, 6, 8, 10];
    const model = new LinearRegression();
    model.fit(X, y);

    const importances = getLinearImportances(model, ['only_feature']);

    expect(importances).toHaveLength(1);
    expect(importances[0].featureName).toBe('only_feature');
    expect(importances[0].importance).toBeCloseTo(1, 5); // Only feature = 100%
    expect(importances[0].rank).toBe(1);
  });

  it('should handle single feature for tree importances', () => {
    const X = [[1], [2], [3], [4], [5]];
    const y = [2, 4, 6, 8, 10];
    const model = new DecisionTree(5, 2, 1);
    model.fit(X, y);

    const importances = getTreeImportances(model, ['only_feature']);

    expect(importances).toHaveLength(1);
    expect(importances[0].featureName).toBe('only_feature');
    expect(importances[0].importance).toBeCloseTo(1, 5);
    expect(importances[0].rank).toBe(1);
  });

  it('should handle all features having same importance', () => {
    // Create data where both features contribute equally
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 200; i++) {
      const x0 = Math.random() * 10;
      const x1 = Math.random() * 10;
      X.push([x0, x1]);
      y.push(x0 + x1);
    }

    const model = new LinearRegression();
    model.fit(X, y);

    const importances = getLinearImportances(model, ['a', 'b']);

    expect(importances).toHaveLength(2);
    // Both should have similar importance (equal coefficients)
    const diff = Math.abs(importances[0].importance - importances[1].importance);
    expect(diff).toBeLessThan(0.1);
  });

  it('should handle permutation importance with single feature', () => {
    const X = [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]];
    const y = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    const model = new LinearRegression();
    model.fit(X, y);

    const importances = permutationImportance(model, X, y, ['x'], {
      nRepeats: 5,
    });

    expect(importances).toHaveLength(1);
    expect(importances[0].featureName).toBe('x');
    expect(importances[0].importance).toBeGreaterThan(0);
    expect(importances[0].rank).toBe(1);
  });
});
