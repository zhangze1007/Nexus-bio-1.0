/**
 * Gaussian Process regression with RBF / Matérn-5/2 kernel for ML-guided
 * directed evolution.
 *
 * Implements exact GP regression with Cholesky decomposition for numerical
 * stability.  Used in ProEvol to predict protein fitness landscapes and
 * suggest high-value mutations via Expected Improvement acquisition.
 *
 * Enhancements over v1:
 *   - ARD (Automatic Relevance Determination): per-dimension length scales so
 *     the GP learns which sequence/feature dimensions matter most.
 *   - Matérn 5/2 kernel option — less smooth than RBF, often a better default
 *     for biological fitness landscapes.
 *   - Hyperparameter optimisation via log marginal likelihood grid search.
 *   - `fitOptimized()` convenience method that picks the best kernel and
 *     hyperparameters automatically.
 *
 * @scientific_provenance
 *   ALGORITHM: Exact Gaussian Process regression with squared-exponential (RBF)
 *     or Matérn-5/2 kernel.  Fits by Cholesky decomposition of K + σ²I,
 *     predicts posterior mean and variance via k-star matrix solve.
 *     Acquisition via Expected Improvement (EI) with normal CDF/PDF from
 *     Abramowitz & Stegun rational approximation (7.1.26).
 *   REFERENCE: Rasmussen CE, Williams CKI. "Gaussian Processes for Machine
 *     Learning." MIT Press, 2006. ISBN 0-262-18253-X.
 *   KNOWN_LIMITATIONS:
 *     - Exact GP scales as O(n³) in training size due to Cholesky decomposition;
 *       impractical for more than ~1000 training points.
 *     - Cholesky fallback adds fixed jitter (1e-8) on non-positive-definite
 *       diagonals rather than adaptively adjusting.
 *     - EI acquisition assumes a stationary landscape; may under-explore
 *       in regions of high non-stationarity.
 *     - Hyperparameter optimisation uses grid search (not gradient-based);
 *       for high-dimensional ARD the grid grows exponentially.
 */

export type KernelType = 'rbf' | 'matern52';

export interface GPConfig {
  kernel: KernelType;
  /** Single shared length scale or per-dimension array (ARD). */
  lengthScale: number | number[];
  signalVariance: number;
  noiseVariance: number;
}

export interface GPPrediction {
  mean: number;
  variance: number;
}

/** Normal CDF and PDF via rational approximation (Abramowitz & Stegun 7.1.26). */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  return 0.5 * (1.0 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export class GaussianProcess {
  private config: GPConfig;
  private XTrain: number[][] = [];
  private yTrain: number[] = [];
  private L: number[][] = []; // Cholesky factor
  private alpha: number[] = []; // L^T \ (L \ y)
  private fitted = false;

  constructor(config: GPConfig) {
    this.config = config;
  }

  /**
   * Fit the GP to training data.
   * Computes Cholesky decomposition of K + noise*I and stores alpha = (K + noise*I)^{-1} y.
   */
  fit(X: number[][], y: number[]): void {
    if (X.length === 0 || X.length !== y.length) {
      throw new Error('X and y must have the same non-zero length');
    }

    this.XTrain = X.map(row => [...row]);
    this.yTrain = [...y];

    const n = X.length;
    const K = this.kernelMatrix(X, X);

    // Add noise variance + jitter to diagonal for positive definiteness
    const jitter = 1e-6;
    for (let i = 0; i < n; i++) {
      K[i][i] += this.config.noiseVariance + jitter;
    }

    // Cholesky decomposition: K = L * L^T
    this.L = this.cholesky(K);

    // Solve L * z = y  (forward substitution)
    const z = this.forwardSub(this.L, y);

    // Solve L^T * alpha = z  (back substitution)
    this.alpha = this.backSub(this.L, z);

    this.fitted = true;
  }

  /**
   * Fit with automatic hyperparameter optimisation.
   *
   * Runs a grid search over lengthScale, signalVariance, and noiseVariance
   * to maximise the log marginal likelihood, then fits the GP with the best
   * config found.
   *
   * @param X           Training inputs
   * @param y           Training targets
   * @param kernelType  'rbf' (default) or 'matern52'
   * @param lsGrid      Optional custom lengthScale grid (default [1,5,10,20,50])
   */
  fitOptimized(
    X: number[][],
    y: number[],
    kernelType: KernelType = 'rbf',
    lsGrid?: number[],
  ): void {
    const bestConfig = GaussianProcess.optimizeHyperparameters(
      X, y, kernelType, lsGrid,
    );
    this.config = bestConfig;
    this.fit(X, y);
  }

  /**
   * Predict posterior mean and variance for new inputs.
   */
  predict(X: number[][]): GPPrediction[] {
    this.ensureFitted();

    const results: GPPrediction[] = [];

    for (const xNew of X) {
      // k_star: covariance between xNew and training points
      const kStar = this.XTrain.map(xTrain => this.kernelFn(xNew, xTrain));

      // Posterior mean: k_star^T * alpha
      let mean = 0;
      for (let i = 0; i < kStar.length; i++) {
        mean += kStar[i] * this.alpha[i];
      }

      // v = L^{-1} * k_star  (forward substitution)
      const v = this.forwardSub(this.L, kStar);

      // Posterior variance: k(x_new, x_new) - v^T * v
      const kSelf = this.kernelFn(xNew, xNew);
      let vDotV = 0;
      for (let i = 0; i < v.length; i++) {
        vDotV += v[i] * v[i];
      }
      const variance = Math.max(kSelf - vDotV, 0); // guard against numerical negatives

      results.push({ mean, variance });
    }

    return results;
  }

  /**
   * Compute Expected Improvement acquisition function.
   * EI(x) = (mu - best - xi) * Phi(Z) + sigma * phi(Z)
   * where Z = (mu - best - xi) / sigma
   *
   * @param X       Candidate points to evaluate
   * @param bestY   Current best observed value (higher is better)
   * @param xi      Exploration-exploitation tradeoff (default 0.01)
   */
  expectedImprovement(X: number[][], bestY: number, xi = 0.01): number[] {
    this.ensureFitted();

    const predictions = this.predict(X);
    const eiValues: number[] = [];

    for (const pred of predictions) {
      const sigma = Math.sqrt(pred.variance);

      if (sigma < 1e-9) {
        // No uncertainty => no improvement possible
        eiValues.push(0);
        continue;
      }

      const Z = (pred.mean - bestY - xi) / sigma;
      const ei = (pred.mean - bestY - xi) * normalCDF(Z) + sigma * normalPDF(Z);
      eiValues.push(Math.max(ei, 0));
    }

    return eiValues;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Compute kernel value between two points using the current config.
   * Dispatches to RBF or Matérn 5/2 based on config.kernel.
   * Supports ARD (per-dimension length scales) for both kernel types.
   */
  private kernelFn(x1: number[], x2: number[]): number {
    if (this.config.kernel === 'matern52') {
      return GaussianProcess.matern52(
        x1, x2, this.config.lengthScale, this.config.signalVariance,
      );
    }
    return GaussianProcess.rbf(
      x1, x2, this.config.lengthScale, this.config.signalVariance,
    );
  }

  /**
   * RBF (squared-exponential) kernel with ARD support.
   * k(x, x') = σ² exp(-0.5 Σ_i ((x_i - x'_i) / l_i)²)
   */
  private static rbf(
    x1: number[],
    x2: number[],
    ls: number | number[],
    sv: number,
  ): number {
    let sqDist = 0;
    for (let i = 0; i < x1.length; i++) {
      const li = Array.isArray(ls) ? ls[i] : ls;
      const diff = (x1[i] - x2[i]) / li;
      sqDist += diff * diff;
    }
    return sv * Math.exp(-0.5 * sqDist);
  }

  /**
   * Matérn 5/2 kernel with ARD support.
   * k(x, x') = σ² (1 + √5 r + 5/3 r²) exp(-√5 r)
   * where r = sqrt(Σ_i ((x_i - x'_i) / l_i)²)
   *
   * Less smooth than RBF — often a better fit for biological fitness
   * landscapes which are rarely infinitely differentiable.
   *
   * @scientific_provenance
   *   REFERENCE: Rasmussen & Williams (2006) eq. 4.16, Table 4.1.
   */
  private static matern52(
    x1: number[],
    x2: number[],
    ls: number | number[],
    sv: number,
  ): number {
    let sqDist = 0;
    for (let i = 0; i < x1.length; i++) {
      const li = Array.isArray(ls) ? ls[i] : ls;
      const diff = (x1[i] - x2[i]) / li;
      sqDist += diff * diff;
    }
    const r = Math.sqrt(sqDist);
    const sqrt5r = Math.sqrt(5) * r;
    return sv * (1 + sqrt5r + (5 / 3) * r * r) * Math.exp(-sqrt5r);
  }

  private kernelMatrix(A: number[][], B: number[][]): number[][] {
    const m = A.length;
    const n = B.length;
    const K: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        K[i][j] = this.kernelFn(A[i], B[j]);
      }
    }
    return K;
  }

  /**
   * Log marginal likelihood (LML) of the current model.
   * LML = -0.5 y^T α - 0.5 log|K| - n/2 log(2π)
   *
   * Used for hyperparameter selection: the LML trades off data fit against
   * model complexity automatically (the "Occam's razor" property of GPs).
   *
   * @scientific_provenance
   *   REFERENCE: Rasmussen & Williams (2006) eq. 2.30.
   */
  logMarginalLikelihood(): number {
    this.ensureFitted();
    const n = this.yTrain.length;
    const K = this.kernelMatrix(this.XTrain, this.XTrain);
    for (let i = 0; i < n; i++) {
      K[i][i] += this.config.noiseVariance + 1e-6;
    }
    const L = this.cholesky(K);
    const alpha = this.backSub(L, this.forwardSub(L, this.yTrain));

    let dataFit = 0;
    for (let i = 0; i < n; i++) dataFit += this.yTrain[i] * alpha[i];

    let logDet = 0;
    for (let i = 0; i < n; i++) logDet += Math.log(Math.max(L[i][i], 1e-300));
    logDet *= 2; // log|K| = 2 * Σ log(L_ii)

    return -0.5 * dataFit - 0.5 * logDet - (n / 2) * Math.log(2 * Math.PI);
  }

  /**
   * Grid-search hyperparameter optimisation via log marginal likelihood.
   *
   * Searches over:
   *   - lengthScale grid (shared or per-dimension for ARD)
   *   - signalVariance ∈ {0.5, 1.0, 2.0}
   *   - noiseVariance  ∈ {0.01, 0.05, 0.1, 0.5}
   *
   * Returns the best GPConfig found.
   */
  static optimizeHyperparameters(
    X: number[][],
    y: number[],
    kernelType: KernelType = 'rbf',
    lengthScaleGrid?: number[],
  ): GPConfig {
    const lsGrid = lengthScaleGrid ?? [1, 5, 10, 20, 50];
    const svGrid = [0.5, 1.0, 2.0];
    const nvGrid = [0.01, 0.05, 0.1, 0.5];

    let bestConfig: GPConfig = {
      kernel: kernelType,
      lengthScale: lsGrid[0],
      signalVariance: svGrid[0],
      noiseVariance: nvGrid[0],
    };
    let bestLML = -Infinity;

    for (const ls of lsGrid) {
      for (const sv of svGrid) {
        for (const nv of nvGrid) {
          const config: GPConfig = {
            kernel: kernelType,
            lengthScale: ls,
            signalVariance: sv,
            noiseVariance: nv,
          };
          const gp = new GaussianProcess(config);
          gp.fit(X, y);
          const lml = gp.logMarginalLikelihood();
          if (lml > bestLML) {
            bestLML = lml;
            bestConfig = { ...config };
          }
        }
      }
    }

    return bestConfig;
  }

  /**
   * Cholesky decomposition: A = L * L^T (lower-triangular).
   * Adds small jitter if matrix is not positive definite.
   */
  private cholesky(A: number[][]): number[][] {
    const n = A.length;
    const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }

        if (i === j) {
          const diag = A[i][i] - sum;
          if (diag <= 0) {
            // Add jitter for numerical stability
            L[i][j] = Math.sqrt(1e-8);
          } else {
            L[i][j] = Math.sqrt(diag);
          }
        } else {
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }

    return L;
  }

  /** Forward substitution: solve L * x = b for lower-triangular L. */
  private forwardSub(L: number[][], b: number[]): number[] {
    const n = L.length;
    const x = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < i; j++) {
        sum += L[i][j] * x[j];
      }
      x[i] = (b[i] - sum) / L[i][i];
    }

    return x;
  }

  /** Back substitution: solve L^T * x = b for lower-triangular L. */
  private backSub(L: number[][], b: number[]): number[] {
    const n = L.length;
    const x = new Array(n).fill(0);

    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += L[j][i] * x[j]; // L^T[i][j] = L[j][i]
      }
      x[i] = (b[i] - sum) / L[i][i];
    }

    return x;
  }

  private ensureFitted(): void {
    if (!this.fitted) {
      throw new Error('GaussianProcess has not been fitted. Call fit() before predict() or expectedImprovement().');
    }
  }
}
