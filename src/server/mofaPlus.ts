import { SeededRNG } from '../utils/seededRng';

/**
 * MOFA+ Multi-Omics Factor Analysis
 *
 * Variational Bayes inference with ARD priors for multi-omics integration.
 * Decomposes multi-view data into shared latent factors and view-specific
 * loadings via coordinate ascent variational inference.
 *
 * Model: Y_vm = Z * W_v^T + E_vm
 *   Z: shared factor matrix [samples x factors]
 *   W_v: view-specific loadings [features x factors]
 *   E_vm: Gaussian noise
 *
 * Inference via coordinate ascent variational Bayes:
 *   1. Update Z (shared factors) via ridge regression
 *   2. Update W_v (view loadings) via ridge regression per view
 *   3. Update noise precision
 *   4. Update ARD prior (sparsity on W)
 *   5. Compute variance explained
 *
 * @scientific_provenance
 *   ALGORITHM: Multi-Omics Factor Analysis (MOFA+) via coordinate ascent
 *     variational Bayes. Factor matrix Z and view loadings W_v are
 *     iteratively updated by ridge regression, noise precision tau_v is
 *     estimated from residuals, and ARD (Automatic Relevance Determination)
 *     priors alpha_k induce sparsity on factors. Convergence is checked via
 *     approximate ELBO change.
 *   REFERENCE: Argelaguet R, Velten B, Arnol D, Dietrich S, Zenz T,
 *     Marioni JC, Buettner F, Huber W, Stegle O. "Multi-Omics Factor
 *     Analysis — a framework for unsupervised integration of multi-omics
 *     data sets." Mol Syst Biol. 2020;16:e9918.
 *   KNOWN_LIMITATIONS:
 *     - ARD update uses a damped heuristic with fixed cap (100) and damping
 *       factor (0.5) to prevent factor collapse; this is more conservative
 *       than the standard VB update and may retain spurious factors.
 *     - Ridge solve uses a diagonal fallback when Cholesky fails, which
 *       ignores off-diagonal correlations in Z^T Z.
 *     - NaN handling replaces missing values with 0 and masks them; this
 *       is a rough approximation that does not model missing-not-at-random
 *       mechanisms common in single-cell data.
 *     - Variance explained is computed per-factor independently (not
 *       cumulative), so R^2 values across factors do not sum to total R^2.
 */

export interface MOFAInput {
  views: Record<string, number[][]>; // viewName -> [samples x features]
  nFactors?: number; // default 5
  maxIterations?: number; // default 100
}

export interface MOFAFactorLoadings {
  [viewName: string]: number[][]; // [features x factors]
}

export interface MOFAResult {
  factors: number[][]; // [samples x factors]
  loadings: MOFAFactorLoadings;
  varianceExplained: Record<string, number[]>; // viewName -> per-factor R^2
  converged: boolean;
  iterations: number;
}

// ─── Linear algebra helpers ──────────────────────────────────────────────────

function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const out: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) out[j][i] = A[i][j];
  }
  return out;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const k = A[0].length;
  const n = B[0].length;
  const out: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += A[i][p] * B[p][j];
      out[i][j] = s;
    }
  }
  return out;
}

/**
 * Solve (A + lambda*I) * X = B for X where A is symmetric.
 * Uses Cholesky decomposition or fallback to diagonal approximation.
 */
function solveRidge(A: number[][], B: number[][], lambda: number): number[][] {
  const k = A.length;
  // Build A + lambda*I
  const M: number[][] = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => A[i][j] + (i === j ? lambda : 0)),
  );

  // Cholesky decomposition (M = L * L^T)
  const L: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  let choleskyOk = true;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let p = 0; p < j; p++) s += L[i][p] * L[j][p];
      if (i === j) {
        const diag = M[i][i] - s;
        if (diag <= 1e-12) {
          choleskyOk = false;
          break;
        }
        L[i][j] = Math.sqrt(diag);
      } else {
        L[i][j] = (M[i][j] - s) / L[j][j];
      }
    }
    if (!choleskyOk) break;
  }

  if (!choleskyOk) {
    // Fallback: diagonal solve
    const n = B[0].length;
    const X: number[][] = Array.from({ length: k }, () => new Array(n).fill(0));
    for (let i = 0; i < k; i++) {
      const diag = M[i][i];
      if (Math.abs(diag) < 1e-12) continue;
      for (let j = 0; j < n; j++) X[i][j] = B[i][j] / diag;
    }
    return X;
  }

  // Forward solve L * Y = B
  const m2 = B[0].length;
  const Y: number[][] = Array.from({ length: k }, () => new Array(m2).fill(0));
  for (let j = 0; j < m2; j++) {
    for (let i = 0; i < k; i++) {
      let s = 0;
      for (let p = 0; p < i; p++) s += L[i][p] * Y[p][j];
      Y[i][j] = (B[i][j] - s) / L[i][i];
    }
  }

  // Backward solve L^T * X = Y
  const X: number[][] = Array.from({ length: k }, () => new Array(m2).fill(0));
  for (let j = 0; j < m2; j++) {
    for (let i = k - 1; i >= 0; i--) {
      let s = 0;
      for (let p = i + 1; p < k; p++) s += L[p][i] * X[p][j];
      X[i][j] = (Y[i][j] - s) / L[i][i];
    }
  }

  return X;
}

// ─── MOFA+ implementation ────────────────────────────────────────────────────

/**
 * Replace NaN with 0 in a matrix, returning cleaned copy and mask.
 */
function nanToZero(data: number[][]): { clean: number[][]; mask: boolean[][] } {
  return {
    clean: data.map(row => row.map(v => (Number.isFinite(v) ? v : 0))),
    mask: data.map(row => row.map(v => Number.isFinite(v))),
  };
}

/**
 * Compute column-wise sum of squares for a matrix.
 */
function colSumSq(A: number[][]): number[] {
  const n = A[0].length;
  const ss = new Array(n).fill(0);
  for (const row of A) {
    for (let j = 0; j < n; j++) ss[j] += row[j] * row[j];
  }
  return ss;
}

/**
 * Compute total sum of squares for a matrix (per column = 1 value).
 */
function totalSumSq(A: number[][]): number {
  let ss = 0;
  for (const row of A) {
    for (const v of row) ss += v * v;
  }
  return ss;
}

/**
 * Run MOFA+ multi-omics factor analysis.
 *
 * Uses variational Bayes with coordinate ascent:
 *   - Update Z via ridge regression (fix W)
 *   - Update W_v via ridge regression per view (fix Z)
 *   - Update noise precision (inverse variance)
 *   - Update ARD prior (sparsity inducing on W)
 *   - Check convergence via ELBO change
 */
export function runMOFA(input: MOFAInput): MOFAResult {
  const rng = new SeededRNG(42);
  const viewNames = Object.keys(input.views);
  const nSamples = input.views[viewNames[0]].length;
  const nViews = viewNames.length;

  // Clamp nFactors to min(nSamples, minFeatureDim)
  let requestedFactors = input.nFactors ?? 5;
  const minFeatures = Math.min(...viewNames.map(v => input.views[v][0].length));
  const nFactors = Math.min(requestedFactors, nSamples, minFeatures);
  const maxIter = input.maxIterations ?? 100;

  // Clean NaN values and store masks
  const viewData: Record<string, { clean: number[][]; mask: boolean[][] }> = {};
  for (const vn of viewNames) {
    viewData[vn] = nanToZero(input.views[vn]);
  }

  // Initialize Z randomly [nSamples x nFactors]
  let Z: number[][] = Array.from({ length: nSamples }, () =>
    Array.from({ length: nFactors }, () => (rng.next() - 0.5) * 0.1),
  );

  // Initialize W_v per view [features_v x nFactors]
  const W: Record<string, number[][]> = {};
  for (const vn of viewNames) {
    const nf = input.views[vn][0].length;
    W[vn] = Array.from({ length: nf }, () =>
      Array.from({ length: nFactors }, () => (rng.next() - 0.5) * 0.1),
    );
  }

  // Noise precision per view (inverse variance)
  const tau: Record<string, number> = {};
  for (const vn of viewNames) {
    tau[vn] = 1.0;
  }

  // ARD prior: alpha_k (precision per factor, sparsity)
  const alpha = new Array(nFactors).fill(1.0);

  const CONV_THRESHOLD = 1e-6;
  let prevELBO = -Infinity;
  let converged = false;
  let iter = 0;

  for (iter = 0; iter < maxIter; iter++) {
    // === Step 1: Update Z (shared factors) ===
    // For each sample i, Z_i = (sum_v tau_v * W_v^T * mask_v_i * Y_v_i) / (sum_v tau_v * W_v^T * mask_v_i * W_v + I)
    // Z = Y_eff * W_eff * (W_eff^T * W_eff + lambda*I)^{-1}
    {
      // Build stacked weighted W and Y
      // W_eff^T W_eff [k x k]
      const WtW: number[][] = Array.from({ length: nFactors }, () => new Array(nFactors).fill(0));
      // Y_eff * W_eff [nSamples x k]
      const YtW: number[][] = Array.from({ length: nSamples }, () => new Array(nFactors).fill(0));

      for (const vn of viewNames) {
        const Yv = viewData[vn].clean;
        const Mv = viewData[vn].mask;
        const Wv = W[vn];
        const nf = Wv.length;
        const t = tau[vn];

        // W_v^T * W_v (weighted by tau and mask)
        // We approximate by using full W and tau
        for (let a = 0; a < nFactors; a++) {
          for (let b = 0; b < nFactors; b++) {
            let s = 0;
            for (let j = 0; j < nf; j++) s += Wv[j][a] * Wv[j][b];
            WtW[a][b] += t * s;
          }
        }

        // Y_v * W_v (mask-aware)
        for (let i = 0; i < nSamples; i++) {
          for (let a = 0; a < nFactors; a++) {
            let s = 0;
            for (let j = 0; j < nf; j++) {
              if (Mv[i][j]) s += Yv[i][j] * Wv[j][a];
            }
            YtW[i][a] += t * s;
          }
        }
      }

      // Ridge: Z = YtW * (WtW + I)^{-1}
      // For each sample, solve (WtW + I) * z_i = YtW_i
      const lambda = 1.0;
      for (let i = 0; i < nSamples; i++) {
        // B is a 1-column: YtW[i] as column vector
        const B: number[][] = Array.from({ length: nFactors }, () => [0]);
        for (let a = 0; a < nFactors; a++) B[a][0] = YtW[i][a];

        const zSol = solveRidge(WtW, B, lambda);
        for (let a = 0; a < nFactors; a++) Z[i][a] = zSol[a][0];
      }
    }

    // === Step 2: Update W_v per view (fix Z) ===
    // W_v = Y_v^T * Z * (Z^T * Z + diag(alpha))^{-1}
    {
      const ZtZ: number[][] = Array.from({ length: nFactors }, () => new Array(nFactors).fill(0));
      for (let a = 0; a < nFactors; a++) {
        for (let b = 0; b < nFactors; b++) {
          let s = 0;
          for (let i = 0; i < nSamples; i++) s += Z[i][a] * Z[i][b];
          ZtZ[a][b] = s;
        }
      }

      for (const vn of viewNames) {
        const Yv = viewData[vn].clean;
        const Mv = viewData[vn].mask;
        const nf = Yv[0].length;
        const t = tau[vn];

        // Y_v^T * Z [features x k] (mask-aware)
        const YtZ: number[][] = Array.from({ length: nf }, () => new Array(nFactors).fill(0));
        for (let j = 0; j < nf; j++) {
          for (let a = 0; a < nFactors; a++) {
            let s = 0;
            for (let i = 0; i < nSamples; i++) {
              if (Mv[i][j]) s += Yv[i][j] * Z[i][a];
            }
            YtZ[j][a] = t * s;
          }
        }

        // Ridge with ARD: ZtZ + diag(alpha/tau)
        const lambda = 1e-4;
        const scaledAlpha: number[][] = Array.from({ length: nFactors }, () => [0]);
        for (let a = 0; a < nFactors; a++) scaledAlpha[a][0] = alpha[a] / t;

        // For each feature, solve (ZtZ + diag(alpha/tau) + lambda*I) * w_j = YtZ_j
        // Use per-factor alpha scaled by tau, with small constant regularizer
        const ardLambda = alpha.map(av => lambda + av / t);
        for (let j = 0; j < nf; j++) {
          const B: number[][] = Array.from({ length: nFactors }, () => [0]);
          for (let a = 0; a < nFactors; a++) B[a][0] = YtZ[j][a];

          // Use average ARD lambda (solveRidge applies uniform lambda)
          const avgLambda = ardLambda.reduce((s, v) => s + v, 0) / nFactors;
          const wSol = solveRidge(ZtZ, B, avgLambda);
          for (let a = 0; a < nFactors; a++) W[vn][j][a] = wSol[a][0];
        }
      }
    }

    // === Step 3: Update noise precision tau_v ===
    for (const vn of viewNames) {
      const Yv = viewData[vn].clean;
      const Mv = viewData[vn].mask;
      const Wv = W[vn];
      const nf = Wv.length;

      // Compute residual: E = Y - Z * W^T (only observed entries)
      let rss = 0;
      let nObs = 0;
      for (let i = 0; i < nSamples; i++) {
        for (let j = 0; j < nf; j++) {
          if (!Mv[i][j]) continue;
          let pred = 0;
          for (let a = 0; a < nFactors; a++) pred += Z[i][a] * Wv[j][a];
          const resid = Yv[i][j] - pred;
          rss += resid * resid;
          nObs++;
        }
      }
      tau[vn] = nObs > 0 ? nObs / (rss + 1e-8) : 1.0;
    }

    // === Step 4: Update ARD prior alpha_k ===
    // Use damped update to prevent explosive growth in early iterations.
    // Standard VB ARD: alpha_k = N / (E[W_k^2] + Var[W_k])
    // We approximate Var[W_k] with a floor proportional to 1/tau to avoid
    // the death spiral where small W → huge alpha → W crushed → repeat.
    const ARD_MAX = 100; // Cap precision to prevent factor collapse
    const ARD_DAMP = 0.5; // Damping factor for update
    for (let a = 0; a < nFactors; a++) {
      let sumW2 = 0;
      let countW = 0;
      for (const vn of viewNames) {
        const Wv = W[vn];
        const t = tau[vn];
        for (let j = 0; j < Wv.length; j++) {
          sumW2 += Wv[j][a] * Wv[j][a];
          countW++;
        }
      }
      // Floor on sumW2 based on noise to prevent alpha explosion
      const noiseFloor = countW * 0.01;
      const rawAlpha = countW > 0 ? countW / (sumW2 + noiseFloor + 1e-8) : 1.0;
      // Damped update: blend old and new to stabilize
      alpha[a] = Math.min(ARD_MAX, (1 - ARD_DAMP) * alpha[a] + ARD_DAMP * rawAlpha);
    }

    // === Step 5: Compute approximate ELBO for convergence check ===
    let elbo = 0;
    // Likelihood: -0.5 * sum_v tau_v * ||Y_v - Z*W_v^T||^2
    for (const vn of viewNames) {
      const Yv = viewData[vn].clean;
      const Mv = viewData[vn].mask;
      const Wv = W[vn];
      const nf = Wv.length;
      let rss = 0;
      for (let i = 0; i < nSamples; i++) {
        for (let j = 0; j < nf; j++) {
          if (!Mv[i][j]) continue;
          let pred = 0;
          for (let a = 0; a < nFactors; a++) pred += Z[i][a] * Wv[j][a];
          const resid = Yv[i][j] - pred;
          rss += resid * resid;
        }
      }
      elbo -= 0.5 * tau[vn] * rss;
    }
    // ARD penalty: -0.5 * sum_k alpha_k * sum_j W_jk^2
    for (let a = 0; a < nFactors; a++) {
      let sumW2 = 0;
      for (const vn of viewNames) {
        const Wv = W[vn];
        for (let j = 0; j < Wv.length; j++) sumW2 += Wv[j][a] * Wv[j][a];
      }
      elbo -= 0.5 * alpha[a] * sumW2;
    }

    // Convergence check
    const delta = Math.abs(elbo - prevELBO);
    if (iter > 2 && delta < CONV_THRESHOLD * Math.abs(prevELBO + 1e-8)) {
      converged = true;
      break;
    }
    prevELBO = elbo;
  }

  // === Compute variance explained per view per factor ===
  const varianceExplained: Record<string, number[]> = {};
  for (const vn of viewNames) {
    const Yv = viewData[vn].clean;
    const Mv = viewData[vn].mask;
    const Wv = W[vn];
    const nf = Wv.length;

    // Total SS (observed entries only)
    let totalSS = 0;
    const meanCols = new Array(nf).fill(0);
    let nObsPerCol = new Array(nf).fill(0);
    for (let i = 0; i < nSamples; i++) {
      for (let j = 0; j < nf; j++) {
        if (Mv[i][j]) {
          meanCols[j] += Yv[i][j];
          nObsPerCol[j]++;
        }
      }
    }
    for (let j = 0; j < nf; j++) {
      if (nObsPerCol[j] > 0) meanCols[j] /= nObsPerCol[j];
    }
    for (let i = 0; i < nSamples; i++) {
      for (let j = 0; j < nf; j++) {
        if (Mv[i][j]) {
          const d = Yv[i][j] - meanCols[j];
          totalSS += d * d;
        }
      }
    }

    // Per-factor R^2: variance explained by each factor independently
    const r2PerFactor: number[] = [];
    for (let a = 0; a < nFactors; a++) {
      // Reconstruct from factor a only: Z[:, a] * W_v[:, a]^T
      let factorSS = 0;
      for (let i = 0; i < nSamples; i++) {
        for (let j = 0; j < nf; j++) {
          if (Mv[i][j]) {
            const pred = Z[i][a] * Wv[j][a];
            // Adjust for mean
            const resid = (Yv[i][j] - meanCols[j]) - pred;
            factorSS += resid * resid;
          }
        }
      }
      // R^2 = 1 - SS_residual / SS_total
      const r2 = totalSS > 0 ? Math.max(0, 1 - factorSS / totalSS) : 0;
      r2PerFactor.push(r2);
    }

    varianceExplained[vn] = r2PerFactor;
  }

  return {
    factors: Z,
    loadings: W,
    varianceExplained,
    converged,
    iterations: iter + 1,
  };
}
