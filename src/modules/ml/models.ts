/**
 * ML Models Layer for Metabolic Engineering
 *
 * Pure TypeScript implementations of regression and tree-based models
 * for enzyme activity prediction and metabolic flux estimation.
 *
 * Models:
 *   1. Linear Regression (Normal Equation)
 *   2. Ridge Regression (L2 regularization)
 *   3. Lasso Regression (Coordinate Descent)
 *   4. Decision Tree (CART)
 *   5. Random Forest (Bagging)
 *
 * Reference: Bishop (2006) Pattern Recognition and Machine Learning
 * Reference: Hastie et al. (2009) The Elements of Statistical Learning
 */

import type { ModelType } from './types';

// ── Public Interface ────────────────────────────────────────────────────────

/** Common interface for all ML models */
export interface MLModel {
  /** Train the model on feature matrix X and target vector y */
  fit(X: number[][], y: number[]): void;
  /** Predict on new data */
  predict(X: number[][]): number[];
  /** Get feature importances (0 if not applicable) */
  getFeatureImportances(): number[];
  /** Serialize model to JSON string */
  serialize(): string;
}

// ── Matrix Utilities ────────────────────────────────────────────────────────

/**
 * Transpose a matrix.
 * @param M - Input matrix (m x n)
 * @returns Transposed matrix (n x m)
 */
function transpose(M: number[][]): number[][] {
  if (M.length === 0) return [];
  const rows = M.length;
  const cols = M[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = M[i][j];
    }
  }
  return T;
}

/**
 * Multiply two matrices A (m x n) and B (n x p).
 * @returns Result matrix (m x p)
 */
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = A[0]?.length ?? 0;
  const p = B[0]?.length ?? 0;
  const result: number[][] = Array.from({ length: m }, () => new Array(p).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

/**
 * Multiply matrix M (m x n) by vector v (n).
 * @returns Result vector (m)
 */
function matVecMul(M: number[][], v: number[]): number[] {
  const m = M.length;
  const n = M[0]?.length ?? 0;
  const result = new Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += M[i][j] * v[j];
    }
    result[i] = sum;
  }
  return result;
}

/**
 * Create an n x n identity matrix.
 */
function identity(n: number): number[][] {
  const I: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    I[i][i] = 1;
  }
  return I;
}

/**
 * Scale a matrix by a scalar value.
 */
function scaleMat(M: number[][], scalar: number): number[][] {
  return M.map(row => row.map(v => v * scalar));
}

/**
 * Add two matrices element-wise.
 */
function matAdd(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

/**
 * Invert a square matrix using Gauss-Jordan elimination with partial pivoting.
 * Returns null if the matrix is singular.
 * @param M - Square matrix (n x n)
 * @returns Inverted matrix or null if singular
 */
function invertMatrix(M: number[][]): number[][] | null {
  const n = M.length;
  // Augmented matrix [M | I]
  const aug: number[][] = M.map((row, i) => [...row, ...identity(n)[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting: find max absolute value in column
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) return null; // Singular

    // Swap rows
    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }

    // Scale pivot row
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate column in other rows
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverse from augmented matrix
  return aug.map(row => row.slice(n));
}

/**
 * Solve the normal equation: w = (X^T X + regularization)^-1 X^T y
 * @param X - Feature matrix (n_samples x n_features)
 * @param y - Target vector (n_samples)
 * @param reg - Regularization matrix (n_features x n_features), or null for no regularization
 * @returns Weight vector or null if singular
 */
function solveNormalEquation(
  X: number[][],
  y: number[],
  reg: number[][] | null = null,
): number[] | null {
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);

  // Add regularization if provided
  const A = reg ? matAdd(XtX, reg) : XtX;

  // Invert
  const Ainv = invertMatrix(A);
  if (!Ainv) return null;

  // w = A^-1 X^T y
  const Xty = matVecMul(Xt, y);
  return matVecMul(Ainv, Xty);
}

// ── 1. Linear Regression ────────────────────────────────────────────────────

/**
 * Linear Regression using the Normal Equation.
 *
 * Solves: w = (X^T X)^-1 X^T y
 *
 * Adds a bias (intercept) column of ones to the feature matrix.
 * No regularization is applied.
 *
 * Reference: Bishop (2006) PRML Ch. 3.1
 */
export class LinearRegression implements MLModel {
  private weights: number[] = [];
  private nFeatures: number = 0;

  /**
   * Train the linear regression model.
   * @param X - Feature matrix (n_samples x n_features)
   * @param y - Target vector (n_samples)
   */
  fit(X: number[][], y: number[]): void {
    if (X.length === 0 || y.length === 0) {
      this.weights = [];
      this.nFeatures = 0;
      return;
    }

    this.nFeatures = X[0].length;

    // Add bias column
    const Xb = addBiasColumn(X);
    const w = solveNormalEquation(Xb, y);
    this.weights = w ?? new Array(this.nFeatures + 1).fill(0);
  }

  /**
   * Predict target values for new data.
   * @param X - Feature matrix (n_samples x n_features)
   * @returns Predicted values
   */
  predict(X: number[][]): number[] {
    if (this.weights.length === 0) return X.map(() => 0);
    const Xb = addBiasColumn(X);
    return matVecMul(Xb, this.weights);
  }

  /**
   * Get feature importances (absolute weights, excluding bias).
   */
  getFeatureImportances(): number[] {
    if (this.weights.length <= 1) return [];
    // Weights[0] is bias, rest are feature weights
    const featureWeights = this.weights.slice(1);
    const absWeights = featureWeights.map(Math.abs);
    const total = absWeights.reduce((s, v) => s + v, 0);
    if (total === 0) return absWeights.map(() => 0);
    return absWeights.map(v => v / total);
  }

  /**
   * Serialize model to JSON.
   */
  serialize(): string {
    return JSON.stringify({
      type: 'linear' as const,
      weights: this.weights,
      nFeatures: this.nFeatures,
    });
  }

  /**
   * Reconstruct a LinearRegression from serialized data.
   */
  static hydrate(data: { weights: number[]; nFeatures: number }): LinearRegression {
    const model = new LinearRegression();
    model.weights = data.weights;
    model.nFeatures = data.nFeatures;
    return model;
  }
}

// ── 2. Ridge Regression ─────────────────────────────────────────────────────

/**
 * Ridge Regression with L2 regularization.
 *
 * Solves: w = (X^T X + alpha * I)^-1 X^T y
 *
 * The regularization term alpha * I prevents overfitting and handles
 * multicollinear features by ensuring the matrix is invertible.
 *
 * Reference: Bishop (2006) PRML Ch. 3.1.4
 */
export class RidgeRegression implements MLModel {
  private weights: number[] = [];
  private nFeatures: number = 0;
  private alpha: number;

  /**
   * @param alpha - Regularization strength (default: 1.0)
   */
  constructor(alpha: number = 1.0) {
    this.alpha = alpha;
  }

  /**
   * Train the ridge regression model.
   * @param X - Feature matrix (n_samples x n_features)
   * @param y - Target vector (n_samples)
   */
  fit(X: number[][], y: number[]): void {
    if (X.length === 0 || y.length === 0) {
      this.weights = [];
      this.nFeatures = 0;
      return;
    }

    this.nFeatures = X[0].length;

    // Add bias column
    const Xb = addBiasColumn(X);
    const n = Xb[0].length;

    // Regularization: do not regularize bias term
    const reg = identity(n);
    reg[0][0] = 0; // Don't regularize bias

    const w = solveNormalEquation(Xb, y, scaleMat(reg, this.alpha));
    this.weights = w ?? new Array(n).fill(0);
  }

  /**
   * Predict target values for new data.
   */
  predict(X: number[][]): number[] {
    if (this.weights.length === 0) return X.map(() => 0);
    const Xb = addBiasColumn(X);
    return matVecMul(Xb, this.weights);
  }

  /**
   * Get feature importances (absolute weights, excluding bias).
   */
  getFeatureImportances(): number[] {
    if (this.weights.length <= 1) return [];
    const featureWeights = this.weights.slice(1);
    const absWeights = featureWeights.map(Math.abs);
    const total = absWeights.reduce((s, v) => s + v, 0);
    if (total === 0) return absWeights.map(() => 0);
    return absWeights.map(v => v / total);
  }

  /**
   * Serialize model to JSON.
   */
  serialize(): string {
    return JSON.stringify({
      type: 'ridge' as const,
      weights: this.weights,
      nFeatures: this.nFeatures,
      alpha: this.alpha,
    });
  }

  /**
   * Reconstruct a RidgeRegression from serialized data.
   */
  static hydrate(data: { weights: number[]; nFeatures: number; alpha: number }): RidgeRegression {
    const model = new RidgeRegression(data.alpha);
    model.weights = data.weights;
    model.nFeatures = data.nFeatures;
    return model;
  }
}

// ── 3. Lasso Regression ─────────────────────────────────────────────────────

/**
 * Lasso Regression using coordinate descent approximation.
 *
 * Minimizes: (1/2n) ||y - Xw||^2 + alpha * ||w||_1
 *
 * Each coordinate is updated in turn, applying soft-thresholding
 * for the L1 penalty. This induces sparsity (feature selection).
 *
 * Reference: Friedman et al. (2010) J Stat Softw 33:1
 */
export class LassoRegression implements MLModel {
  private weights: number[] = [];
  private nFeatures: number = 0;
  private alpha: number;
  private maxIter: number;
  private tol: number;

  /**
   * @param alpha - Regularization strength (default: 0.1)
   * @param maxIter - Maximum iterations (default: 1000)
   * @param tol - Convergence tolerance (default: 1e-4)
   */
  constructor(alpha: number = 0.1, maxIter: number = 1000, tol: number = 1e-4) {
    this.alpha = alpha;
    this.maxIter = maxIter;
    this.tol = tol;
  }

  /**
   * Train the lasso regression model using coordinate descent.
   * @param X - Feature matrix (n_samples x n_features)
   * @param y - Target vector (n_samples)
   */
  fit(X: number[][], y: number[]): void {
    if (X.length === 0 || y.length === 0) {
      this.weights = [];
      this.nFeatures = 0;
      return;
    }

    const n = X.length;
    const p = X[0].length;
    this.nFeatures = p;

    // Add bias column
    const Xb = addBiasColumn(X);
    const totalFeatures = p + 1;

    // Initialize weights to zero
    const w = new Array(totalFeatures).fill(0);

    // Precompute column norms squared
    const colNormSq = new Array(totalFeatures).fill(0);
    for (let j = 0; j < totalFeatures; j++) {
      for (let i = 0; i < n; i++) {
        colNormSq[j] += Xb[i][j] * Xb[i][j];
      }
    }

    // Coordinate descent
    for (let iter = 0; iter < this.maxIter; iter++) {
      let maxChange = 0;

      for (let j = 0; j < totalFeatures; j++) {
        // Compute residual without feature j
        let rho = 0;
        for (let i = 0; i < n; i++) {
          let pred = 0;
          for (let k = 0; k < totalFeatures; k++) {
            if (k !== j) pred += Xb[i][k] * w[k];
          }
          rho += Xb[i][j] * (y[i] - pred);
        }

        const oldW = w[j];

        if (j === 0) {
          // Don't regularize bias
          w[j] = colNormSq[j] > 0 ? rho / colNormSq[j] : 0;
        } else {
          // Soft thresholding for L1 penalty
          if (colNormSq[j] > 0) {
            const z = rho / colNormSq[j];
            const lambda = n * this.alpha / colNormSq[j];
            if (z > lambda) {
              w[j] = z - lambda;
            } else if (z < -lambda) {
              w[j] = z + lambda;
            } else {
              w[j] = 0;
            }
          }
        }

        maxChange = Math.max(maxChange, Math.abs(w[j] - oldW));
      }

      if (maxChange < this.tol) break;
    }

    this.weights = w;
  }

  /**
   * Predict target values for new data.
   */
  predict(X: number[][]): number[] {
    if (this.weights.length === 0) return X.map(() => 0);
    const Xb = addBiasColumn(X);
    return matVecMul(Xb, this.weights);
  }

  /**
   * Get feature importances (absolute weights, excluding bias).
   */
  getFeatureImportances(): number[] {
    if (this.weights.length <= 1) return [];
    const featureWeights = this.weights.slice(1);
    const absWeights = featureWeights.map(Math.abs);
    const total = absWeights.reduce((s, v) => s + v, 0);
    if (total === 0) return absWeights.map(() => 0);
    return absWeights.map(v => v / total);
  }

  /**
   * Serialize model to JSON.
   */
  serialize(): string {
    return JSON.stringify({
      type: 'lasso' as const,
      weights: this.weights,
      nFeatures: this.nFeatures,
      alpha: this.alpha,
      maxIter: this.maxIter,
      tol: this.tol,
    });
  }

  /**
   * Reconstruct a LassoRegression from serialized data.
   */
  static hydrate(data: {
    weights: number[];
    nFeatures: number;
    alpha: number;
    maxIter: number;
    tol: number;
  }): LassoRegression {
    const model = new LassoRegression(data.alpha, data.maxIter, data.tol);
    model.weights = data.weights;
    model.nFeatures = data.nFeatures;
    return model;
  }
}

// ── 4. Decision Tree (CART) ─────────────────────────────────────────────────

interface TreeNode {
  /** Feature index to split on (-1 for leaf) */
  featureIndex: number;
  /** Threshold value for split */
  threshold: number;
  /** Prediction value for leaf nodes */
  value: number;
  /** Left child (feature <= threshold) */
  left: TreeNode | null;
  /** Right child (feature > threshold) */
  right: TreeNode | null;
  /** Number of samples at this node */
  nSamples: number;
}

/**
 * Decision Tree Regressor using CART algorithm.
 *
 * Splits are chosen to minimize MSE (Mean Squared Error):
 *   MSE = (1/n) * sum((y_i - y_mean)^2)
 *
 * The tree is built recursively until stopping criteria are met:
 *   - Maximum depth reached
 *   - Minimum samples for split not met
 *   - Minimum samples for leaf not met
 *
 * Reference: Breiman et al. (1984) Classification and Regression Trees
 */
export class DecisionTree implements MLModel {
  private tree: TreeNode | null = null;
  private nFeatures: number = 0;
  private maxDepth: number;
  private minSamplesSplit: number;
  private minSamplesLeaf: number;
  private featureImportances: number[] = [];

  /**
   * @param maxDepth - Maximum tree depth (default: 10)
   * @param minSamplesSplit - Minimum samples to split a node (default: 2)
   * @param minSamplesLeaf - Minimum samples in a leaf (default: 1)
   */
  constructor(maxDepth: number = 10, minSamplesSplit: number = 2, minSamplesLeaf: number = 1) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.minSamplesLeaf = minSamplesLeaf;
  }

  /**
   * Train the decision tree.
   * @param X - Feature matrix (n_samples x n_features)
   * @param y - Target vector (n_samples)
   */
  fit(X: number[][], y: number[]): void {
    if (X.length === 0 || y.length === 0) {
      this.tree = null;
      this.nFeatures = 0;
      this.featureImportances = [];
      return;
    }

    this.nFeatures = X[0].length;
    const impurityTracker = new Array(this.nFeatures).fill(0);

    this.tree = this.buildTree(X, y, 0, impurityTracker);

    // Normalize feature importances
    const total = impurityTracker.reduce((s, v) => s + v, 0);
    this.featureImportances = total > 0
      ? impurityTracker.map(v => v / total)
      : new Array(this.nFeatures).fill(0);
  }

  /**
   * Predict target values for new data.
   */
  predict(X: number[][]): number[] {
    if (!this.tree) return X.map(() => 0);
    return X.map(x => this.predictSingle(x, this.tree!));
  }

  /**
   * Get feature importances (normalized impurity reduction).
   */
  getFeatureImportances(): number[] {
    return [...this.featureImportances];
  }

  /**
   * Serialize model to JSON.
   */
  serialize(): string {
    return JSON.stringify({
      type: 'decision_tree' as const,
      tree: this.tree,
      nFeatures: this.nFeatures,
      maxDepth: this.maxDepth,
      minSamplesSplit: this.minSamplesSplit,
      minSamplesLeaf: this.minSamplesLeaf,
      featureImportances: this.featureImportances,
    });
  }

  /**
   * Reconstruct a DecisionTree from serialized data.
   */
  static hydrate(data: {
    tree: TreeNode | null;
    nFeatures: number;
    maxDepth: number;
    minSamplesSplit: number;
    minSamplesLeaf: number;
    featureImportances: number[];
  }): DecisionTree {
    const model = new DecisionTree(data.maxDepth, data.minSamplesSplit, data.minSamplesLeaf);
    model.tree = data.tree;
    model.nFeatures = data.nFeatures;
    model.featureImportances = data.featureImportances;
    return model;
  }

  /**
   * Build tree recursively.
   */
  private buildTree(
    X: number[][],
    y: number[],
    depth: number,
    impurityTracker: number[],
  ): TreeNode {
    const n = y.length;

    // Compute mean prediction
    const meanVal = y.reduce((s, v) => s + v, 0) / n;

    // Stopping criteria
    if (depth >= this.maxDepth || n < this.minSamplesSplit || this.isPure(y)) {
      return { featureIndex: -1, threshold: 0, value: meanVal, left: null, right: null, nSamples: n };
    }

    // Find best split
    let bestFeature = -1;
    let bestThreshold = 0;
    let bestMSE = Infinity;
    let bestLeftIdx: number[] = [];
    let bestRightIdx: number[] = [];

    const currentMSE = this.computeMSE(y);

    for (let j = 0; j < this.nFeatures; j++) {
      // Get unique values for this feature
      const values = X.map((x, i) => ({ val: x[j], idx: i }));
      values.sort((a, b) => a.val - b.val);

      // Try midpoints between consecutive unique values
      for (let i = 0; i < values.length - 1; i++) {
        if (values[i].val === values[i + 1].val) continue;

        const threshold = (values[i].val + values[i + 1].val) / 2;
        const leftIdx: number[] = [];
        const rightIdx: number[] = [];

        for (let k = 0; k < n; k++) {
          if (X[k][j] <= threshold) {
            leftIdx.push(k);
          } else {
            rightIdx.push(k);
          }
        }

        // Check min samples leaf
        if (leftIdx.length < this.minSamplesLeaf || rightIdx.length < this.minSamplesLeaf) {
          continue;
        }

        // Compute weighted MSE
        const leftMSE = this.computeMSE(leftIdx.map(i => y[i]));
        const rightMSE = this.computeMSE(rightIdx.map(i => y[i]));
        const weightedMSE = (leftIdx.length * leftMSE + rightIdx.length * rightMSE) / n;

        if (weightedMSE < bestMSE) {
          bestMSE = weightedMSE;
          bestFeature = j;
          bestThreshold = threshold;
          bestLeftIdx = leftIdx;
          bestRightIdx = rightIdx;
        }
      }
    }

    // If no valid split found, return leaf
    if (bestFeature === -1) {
      return { featureIndex: -1, threshold: 0, value: meanVal, left: null, right: null, nSamples: n };
    }

    // Track impurity reduction
    const impurityReduction = n * (currentMSE - bestMSE);
    impurityTracker[bestFeature] += impurityReduction;

    // Recursively build children
    const leftX = bestLeftIdx.map(i => X[i]);
    const leftY = bestLeftIdx.map(i => y[i]);
    const rightX = bestRightIdx.map(i => X[i]);
    const rightY = bestRightIdx.map(i => y[i]);

    return {
      featureIndex: bestFeature,
      threshold: bestThreshold,
      value: meanVal,
      left: this.buildTree(leftX, leftY, depth + 1, impurityTracker),
      right: this.buildTree(rightX, rightY, depth + 1, impurityTracker),
      nSamples: n,
    };
  }

  /**
   * Predict for a single sample by traversing the tree.
   */
  private predictSingle(x: number[], node: TreeNode): number {
    if (node.featureIndex === -1 || !node.left || !node.right) {
      return node.value;
    }
    if (x[node.featureIndex] <= node.threshold) {
      return this.predictSingle(x, node.left);
    }
    return this.predictSingle(x, node.right);
  }

  /**
   * Compute MSE for a set of target values.
   */
  private computeMSE(y: number[]): number {
    if (y.length === 0) return 0;
    const mean = y.reduce((s, v) => s + v, 0) / y.length;
    return y.reduce((s, v) => s + (v - mean) ** 2, 0) / y.length;
  }

  /**
   * Check if all target values are the same.
   */
  private isPure(y: number[]): boolean {
    if (y.length <= 1) return true;
    const first = y[0];
    return y.every(v => Math.abs(v - first) < 1e-10);
  }
}

// ── 5. Random Forest ────────────────────────────────────────────────────────

interface ForestTree {
  tree: DecisionTree;
  featureIndices: number[];
}

/**
 * Random Forest Regressor using bagging (bootstrap aggregating).
 *
 * Each tree is trained on a bootstrap sample of the data with
 * a random subset of features. Predictions are averaged across
 * all trees to reduce variance.
 *
 * Reference: Breiman (2001) Machine Learning 45:5-32
 */
export class RandomForest implements MLModel {
  private forest: ForestTree[] = [];
  private nFeatures: number = 0;
  private nEstimators: number;
  private maxFeatures: number;
  private maxDepth: number;
  private minSamplesSplit: number;
  private minSamplesLeaf: number;
  private featureImportances: number[] = [];

  /**
   * @param nEstimators - Number of trees (default: 10)
   * @param maxFeatures - Max features per tree, 0 = sqrt(n_features) (default: 0)
   * @param maxDepth - Maximum tree depth (default: 10)
   * @param minSamplesSplit - Minimum samples to split (default: 2)
   * @param minSamplesLeaf - Minimum samples in a leaf (default: 1)
   */
  constructor(
    nEstimators: number = 10,
    maxFeatures: number = 0,
    maxDepth: number = 10,
    minSamplesSplit: number = 2,
    minSamplesLeaf: number = 1,
  ) {
    this.nEstimators = nEstimators;
    this.maxFeatures = maxFeatures;
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.minSamplesLeaf = minSamplesLeaf;
  }

  /**
   * Train the random forest.
   * @param X - Feature matrix (n_samples x n_features)
   * @param y - Target vector (n_samples)
   */
  fit(X: number[][], y: number[]): void {
    if (X.length === 0 || y.length === 0) {
      this.forest = [];
      this.nFeatures = 0;
      this.featureImportances = [];
      return;
    }

    const n = X.length;
    this.nFeatures = X[0].length;
    const maxFeat = this.maxFeatures > 0
      ? Math.min(this.maxFeatures, this.nFeatures)
      : Math.max(1, Math.round(Math.sqrt(this.nFeatures)));

    this.forest = [];
    const aggImportances = new Array(this.nFeatures).fill(0);

    for (let t = 0; t < this.nEstimators; t++) {
      // Bootstrap sample
      const { sampleX, sampleY } = this.bootstrapSample(X, y);

      // Random feature subset
      const featureIndices = this.randomFeatureSubset(maxFeat);

      // Create subset of features
      const subsetX = sampleX.map(row => featureIndices.map(j => row[j]));

      // Train tree
      const tree = new DecisionTree(
        this.maxDepth,
        this.minSamplesSplit,
        this.minSamplesLeaf,
      );
      tree.fit(subsetX, sampleY);
      this.forest.push({ tree, featureIndices });

      // Accumulate feature importances (mapped back to original indices)
      const treeImportances = tree.getFeatureImportances();
      for (let i = 0; i < featureIndices.length; i++) {
        aggImportances[featureIndices[i]] += treeImportances[i] ?? 0;
      }
    }

    // Normalize feature importances
    const total = aggImportances.reduce((s, v) => s + v, 0);
    this.featureImportances = total > 0
      ? aggImportances.map(v => v / total)
      : new Array(this.nFeatures).fill(0);
  }

  /**
   * Predict by averaging all tree predictions.
   */
  predict(X: number[][]): number[] {
    if (this.forest.length === 0) return X.map(() => 0);
    return X.map(x => {
      let sum = 0;
      for (const entry of this.forest) {
        const subset = entry.featureIndices.map(j => x[j]);
        const preds = entry.tree.predict([subset]);
        sum += preds[0];
      }
      return sum / this.forest.length;
    });
  }

  /**
   * Get feature importances (averaged across all trees).
   */
  getFeatureImportances(): number[] {
    return [...this.featureImportances];
  }

  /**
   * Serialize model to JSON.
   */
  serialize(): string {
    return JSON.stringify({
      type: 'random_forest' as const,
      forest: this.forest.map(entry => ({
        treeData: JSON.parse(entry.tree.serialize()),
        featureIndices: entry.featureIndices,
      })),
      nFeatures: this.nFeatures,
      nEstimators: this.nEstimators,
      maxFeatures: this.maxFeatures,
      maxDepth: this.maxDepth,
      minSamplesSplit: this.minSamplesSplit,
      minSamplesLeaf: this.minSamplesLeaf,
      featureImportances: this.featureImportances,
    });
  }

  /**
   * Reconstruct a RandomForest from serialized data.
   */
  static hydrate(data: {
    forest: Array<{ treeData: Parameters<typeof DecisionTree.hydrate>[0]; featureIndices: number[] }>;
    nFeatures: number;
    nEstimators: number;
    maxFeatures: number;
    maxDepth: number;
    minSamplesSplit: number;
    minSamplesLeaf: number;
    featureImportances: number[];
  }): RandomForest {
    const model = new RandomForest(
      data.nEstimators,
      data.maxFeatures,
      data.maxDepth,
      data.minSamplesSplit,
      data.minSamplesLeaf,
    );
    model.nFeatures = data.nFeatures;
    model.featureImportances = data.featureImportances;
    model.forest = data.forest.map(entry => ({
      tree: DecisionTree.hydrate(entry.treeData),
      featureIndices: entry.featureIndices,
    }));
    return model;
  }

  /**
   * Generate a bootstrap sample (sampling with replacement).
   */
  private bootstrapSample(X: number[][], y: number[]): { sampleX: number[][]; sampleY: number[] } {
    const n = X.length;
    const sampleX: number[][] = [];
    const sampleY: number[] = [];

    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * n);
      sampleX.push(X[idx]);
      sampleY.push(y[idx]);
    }

    return { sampleX, sampleY };
  }

  /**
   * Select a random subset of feature indices.
   */
  private randomFeatureSubset(maxFeat: number): number[] {
    const indices = Array.from({ length: this.nFeatures }, (_, i) => i);

    // Fisher-Yates shuffle
    for (let i = this.nFeatures - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    return indices.slice(0, maxFeat).sort((a, b) => a - b);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Add a bias (intercept) column of ones to the feature matrix.
 * @param X - Feature matrix (n_samples x n_features)
 * @returns Augmented matrix (n_samples x (n_features + 1))
 */
function addBiasColumn(X: number[][]): number[][] {
  return X.map(row => [1, ...row]);
}

// ── Deserialization ─────────────────────────────────────────────────────────

/**
 * Deserialize a model from JSON string.
 * @param data - JSON string from serialize()
 * @returns Reconstructed MLModel instance
 */
export function deserializeModel(data: string): MLModel {
  const parsed = JSON.parse(data);

  switch (parsed.type) {
    case 'linear':
      return LinearRegression.hydrate(parsed);
    case 'ridge':
      return RidgeRegression.hydrate(parsed);
    case 'lasso':
      return LassoRegression.hydrate(parsed);
    case 'decision_tree':
      return DecisionTree.hydrate(parsed);
    case 'random_forest':
      return RandomForest.hydrate(parsed);
    default:
      throw new Error(`Unknown model type: ${parsed.type}`);
  }
}

// ── Model Registry ──────────────────────────────────────────────────────────

/**
 * Create a model instance by type with optional parameters.
 * @param type - Model type
 * @param params - Optional parameters for the model
 * @returns MLModel instance
 */
export function createModel(type: ModelType, params?: Record<string, unknown>): MLModel {
  switch (type) {
    case 'linear':
      return new LinearRegression();
    case 'ridge':
      return new RidgeRegression(
        typeof params?.alpha === 'number' ? params.alpha : 1.0,
      );
    case 'lasso':
      return new LassoRegression(
        typeof params?.alpha === 'number' ? params.alpha : 0.1,
        typeof params?.maxIter === 'number' ? params.maxIter : 1000,
        typeof params?.tol === 'number' ? params.tol : 1e-4,
      );
    case 'decision_tree':
      return new DecisionTree(
        typeof params?.maxDepth === 'number' ? params.maxDepth : 10,
        typeof params?.minSamplesSplit === 'number' ? params.minSamplesSplit : 2,
        typeof params?.minSamplesLeaf === 'number' ? params.minSamplesLeaf : 1,
      );
    case 'random_forest':
      return new RandomForest(
        typeof params?.nEstimators === 'number' ? params.nEstimators : 10,
        typeof params?.maxFeatures === 'number' ? params.maxFeatures : 0,
        typeof params?.maxDepth === 'number' ? params.maxDepth : 10,
        typeof params?.minSamplesSplit === 'number' ? params.minSamplesSplit : 2,
        typeof params?.minSamplesLeaf === 'number' ? params.minSamplesLeaf : 1,
      );
    default:
      throw new Error(`Unknown model type: ${type}`);
  }
}
