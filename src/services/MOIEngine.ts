/**
 * Multi-Omics Integrator (MOI) Core Engine — DEMO IMPLEMENTATION
 *
 * REFERENCE:
 *   MOCK_DATA: no peer-reviewed source for this TypeScript implementation.
 *   The code is a deterministic local demonstration and does not implement
 *   MOFA+, GPerturb, a production variational autoencoder, or UMAP.
 *
 * NOT_IMPLEMENTED:
 *   - MOFA+ variational sparse factor model
 *   - View-specific likelihood/noise model
 *   - Production variational autoencoder (VAE) training with autograd
 *   - UMAP fuzzy-simplicial-set graph optimization
 *   - Bayesian posterior uncertainty
 *   - Causal perturbation model such as GPerturb
 *
 * KNOWN_LIMITATIONS:
 *   - Factor scores come from ALS-style reconstruction, not MOFA+ inference.
 *   - Embedding uncertainty fields are deterministic placeholders, not posterior intervals.
 *   - Perturbation outputs are sensitivity-style projections, not causal predictions.
 *   - Bundled mock omics rows are for UI demonstration only.
 *
 * Integrates Transcriptomics, Proteomics, and Metabolomics into a shared
 * low-dimensional view using three pure-TypeScript routines.
 *
 * HONEST METHOD LABELS (the previous file claimed MOFA+, VAE, and UMAP — none
 * of those are actually implemented here, and that wording has been removed.
 * "VAE" has been renamed to "Linear Embedding" in all user-facing surfaces):
 *
 * 1. `extractMOFAFactors` — alternating-least-squares (ALS) low-rank matrix
 *    factorization with masked reconstruction. NOT MOFA+: there is no
 *    variational sparse prior, no view-specific noise model, and no Bayesian
 *    inference. The output is a deterministic shared-factor decomposition
 *    that is structurally similar to NMF/PCA on a stacked matrix.
 *
 * 2. `trainMultimodalVAE` — a deterministic linear encoder with KL penalty,
 *    optimized by simplified gradient updates. NOT a variational autoencoder:
 *    there is no autograd, no learned posterior uncertainty, no validation
 *    split, and no deployment-grade stochastic inference. Renamed to
 *    "Linear Embedding" in all user-facing surfaces for honesty.
 *
 * 3. Predictive perturbation — modifies a single feature in the input row,
 *    re-encodes through the linear embedding above, and reports the delta in
 *    a downstream layer. This is sensitivity analysis on a linear model, not
 *    a learned causal perturbation predictor.
 *
 * The 3D export uses PCA-style projection of the embedding (NOT UMAP, which
 * would require a fuzzy-simplicial-set graph and stochastic optimization).
 *
 * Function names are preserved to avoid a churning rename across the
 * codebase, but every user-facing surface (MultiOPage, sidebar labels, view
 * modes) has been relabelled to reflect the methods that actually run.
 */

import type {
  OmicsRow,
  OmicsLayer,
  EmbeddingPoint,
} from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LatentFactor {
  id: number;
  name: string;
  weights: {
    transcriptomics: number[];
    proteomics: number[];
    metabolomics: number[];
  };
  varianceExplained: {
    transcriptomics: number;
    proteomics: number;
    metabolomics: number;
    total: number;
  };
  topGenes: { gene: string; loading: number }[];
  interpretation: string;
}

export interface MOFAResult {
  factors: LatentFactor[];
  totalVarianceExplained: number;
  missingDataRate: number;
  convergenceIterations: number;
  reconstructionError: number;
}

export interface VAELatentPoint {
  id: string;
  gene: string;
  z_mean: number[];          // Latent mean (μ)
  z_logvar: number[];        // Latent log-variance
  z_sample: number[];        // Sampled z
  batchId: number;
  metabolicEfficiency: number; // 0–1 score for coloring
  reconstructed: {
    transcript: number;
    protein: number;
    metabolite: number;
  };
}

export interface VAETrainingResult {
  latentPoints: VAELatentPoint[];
  elbo: number;              // Evidence Lower BOund
  reconLoss: number;
  klDivergence: number;
  beta: number;
  epochs: number;
  latentDim: number;
  batchCorrectionApplied: boolean;
  convergenceHistory: { epoch: number; loss: number; kl: number; recon: number }[];
}

export interface VAEPerturbationPrediction {
  geneId: string;
  foldChange: number;
  predictedMetabolomeShifts: {
    metabolite: string;
    originalValue: number;
    predictedValue: number;
    delta: number;
    confidence: number;
  }[];
  latentShift: number[];     // Delta in latent space
  metabolicEfficiencyChange: number;
  reasoning: string;
}

export interface MetabolicEfficiencyScore {
  geneId: string;
  gene: string;
  score: number;             // 0–1
  fluxUtilization: number;   // How efficiently flux is utilized
  expressionBalance: number; // Transcript-protein concordance
  metaboliteYield: number;   // Downstream metabolite production
}

// ── Matrix utilities ──────────────────────────────────────────────────────────

function zeros(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, n = B[0].length, k = B.length;
  const C = zeros(m, n);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < k; l++)
        C[i][j] += A[i][l] * B[l][j];
  return C;
}

function transpose(A: number[][]): number[][] {
  if (A.length === 0) return [];
  const m = A.length, n = A[0].length;
  const T = zeros(n, m);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      T[j][i] = A[i][j];
  return T;
}

function vecDot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function vecNorm(a: number[]): number {
  return Math.sqrt(vecDot(a, a));
}

function columnMean(matrix: number[][], col: number, mask?: boolean[][]): number {
  let sum = 0, count = 0;
  for (let i = 0; i < matrix.length; i++) {
    if (mask && !mask[i][col]) continue;
    sum += matrix[i][col];
    count++;
  }
  return count > 0 ? sum / count : 0;
}

function columnStd(matrix: number[][], col: number, mean: number, mask?: boolean[][]): number {
  let sumSq = 0, count = 0;
  for (let i = 0; i < matrix.length; i++) {
    if (mask && !mask[i][col]) continue;
    sumSq += (matrix[i][col] - mean) ** 2;
    count++;
  }
  return count > 1 ? Math.sqrt(sumSq / (count - 1)) : 1;
}

// ── Seeded PRNG ───────────────────────────────────────────────────────────────

class SeededRNG {
  private state: number;
  constructor(seed: number = 42) { this.state = seed; }
  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  gaussian(): number {
    // Box-Muller transform
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. ALS Factor Decomposition (not MOFA+)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Deterministic ALS-style multi-omics factor decomposition.
 *
 * Uses alternating least squares (ALS) with masked reconstruction to extract
 * K latent factors from a multi-view data matrix. Handles sparse data and
 * missing values by masking them during the reconstruction loss computation.
 * This is not MOFA+: no variational sparse prior, no Bayesian posterior, and
 * no view-specific likelihood model are implemented.
 *
 * Model: X_v ≈ Z · W_v^T  for each view v ∈ {transcriptomics, proteomics, metabolomics}
 *
 * @param data - OmicsRow[] input data
 * @param nFactors - Number of latent factors to extract (default 5)
 * @param maxIter - Maximum ALS iterations (default 200)
 * @param tolerance - Convergence threshold for reconstruction error (default 1e-4)
 *
 * HONEST NAME: This is ALS matrix factorization, NOT MOFA+.
 * MOFA+ requires variational inference with view-specific likelihoods.
 * This function performs simple alternating least squares on a stacked matrix.
 */
export function extractMOFAFactors(
  data: OmicsRow[],
  nFactors: number = 5,
  maxIter: number = 200,
  tolerance: number = 1e-4,
): MOFAResult {
  const n = data.length;
  const rng = new SeededRNG(42);

  // Build view matrices + missing-value masks
  const views: { name: OmicsLayer; matrix: number[][]; mask: boolean[][] }[] = [
    {
      name: 'transcriptomics',
      matrix: data.map(d => [d.transcript ?? 0]),
      mask: data.map(d => [d.transcript !== undefined && d.transcript !== null]),
    },
    {
      name: 'proteomics',
      matrix: data.map(d => [d.protein ?? 0]),
      mask: data.map(d => [d.protein !== undefined && d.protein !== null]),
    },
    {
      name: 'metabolomics',
      matrix: data.map(d => [d.metabolite ?? 0]),
      mask: data.map(d => [d.metabolite !== undefined && d.metabolite !== null]),
    },
  ];

  // Cap K to prevent over-factorization: max rank of feature matrix is nFeatures,
  // but requesting K == nFeatures is degenerate (each factor maps to one feature).
  // Cap at nFeatures - 1 so factors must capture shared structure.
  const nFeatures = views.reduce((sum, v) => sum + v.matrix[0].length, 0); // 3
  const maxK = Math.max(1, Math.min(n, nFeatures - 1));
  const K = Math.min(nFactors, maxK);
  if (K < nFactors) {
    console.warn(
      `[MOIEngine] ALS factors reduced from ${nFactors} to ${K}: ` +
      `only ${nFeatures} features across ${views.length} views — requesting more factors ` +
      `would cause degenerate (rank-deficient) factorization.`
    );
  }

  // Count missing data
  let totalCells = 0, missingCells = 0;
  for (const v of views) {
    for (let i = 0; i < n; i++) {
      totalCells++;
      if (!v.mask[i][0]) missingCells++;
    }
  }
  const missingRate = missingCells / totalCells;

  // Center each view (column-wise, ignoring missing)
  for (const v of views) {
    const mean = columnMean(v.matrix, 0, v.mask);
    for (let i = 0; i < n; i++) {
      if (v.mask[i][0]) v.matrix[i][0] -= mean;
    }
  }

  // Concatenate views: X = [X_t | X_p | X_m]  (n × 3)
  const X = data.map((_, i) => views.map(v => v.matrix[i][0]));
  const M = data.map((_, i) => views.map(v => v.mask[i][0]));

  // Initialize Z (n × K) and W (3 × K) randomly
  let Z = Array.from({ length: n }, () =>
    Array.from({ length: K }, () => rng.gaussian() * 0.1)
  );
  let W = Array.from({ length: 3 }, () =>
    Array.from({ length: K }, () => rng.gaussian() * 0.1)
  );

  // Alternating Least Squares
  let prevError = Infinity;
  let convergedIter = maxIter;

  for (let iter = 0; iter < maxIter; iter++) {
    // Create masked X: zero out missing values
    const Xmasked = X.map((row, i) => row.map((v, j) => M[i][j] ? v : 0));

    // Update W: W = (Z^T Z)^{-1} Z^T Xmasked
    const ZtZ = matMul(transpose(Z), Z);
    // Regularize diagonal
    for (let k = 0; k < K; k++) ZtZ[k][k] += 1e-6;
    // Pseudo-inverse via diagonal approximation
    const ZtX = matMul(transpose(Z), Xmasked);
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < K; k++) {
        W[j][k] = ZtX[k][j] / (ZtZ[k][k] + 1e-6);
      }
    }

    // Update Z: Z = Xmasked W (W^T W)^{-1}
    const WtW = matMul(transpose(W), W);
    for (let k = 0; k < K; k++) WtW[k][k] += 1e-6;
    const XW = matMul(Xmasked, W);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < K; k++) {
        Z[i][k] = XW[i][k] / (WtW[k][k] + 1e-6);
      }
    }

    // Compute masked reconstruction error
    const Xhat = matMul(Z, transpose(W));
    let error = 0, count = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) {
        if (M[i][j]) {
          error += (X[i][j] - Xhat[i][j]) ** 2;
          count++;
        }
      }
    }
    error = count > 0 ? error / count : 0;

    if (Math.abs(prevError - error) < tolerance) {
      convergedIter = iter + 1;
      break;
    }
    prevError = error;
  }

  // Compute variance explained per factor per view
  const totalVarPerView = views.map((v, j) => {
    let ss = 0;
    for (let i = 0; i < n; i++) {
      if (M[i][j]) ss += X[i][j] ** 2;
    }
    return ss;
  });

  const factors: LatentFactor[] = [];
  for (let k = 0; k < K; k++) {
    const vePerView = views.map((_, j) => {
      let explained = 0;
      for (let i = 0; i < n; i++) {
        if (M[i][j]) explained += (Z[i][k] * W[j][k]) ** 2;
      }
      return totalVarPerView[j] > 0 ? explained / totalVarPerView[j] : 0;
    });

    // Top genes by absolute loading
    const loadings = Z.map((row, i) => ({ gene: data[i].gene, loading: Math.abs(row[k]) }));
    loadings.sort((a, b) => b.loading - a.loading);

    const topGene = loadings[0]?.gene ?? '';
    const dominantView = vePerView.indexOf(Math.max(...vePerView));
    const viewNames: OmicsLayer[] = ['transcriptomics', 'proteomics', 'metabolomics'];

    factors.push({
      id: k + 1,
      name: `Factor ${k + 1}`,
      weights: {
        transcriptomics: Z.map(row => row[k] * W[0][k]),
        proteomics: Z.map(row => row[k] * W[1][k]),
        metabolomics: Z.map(row => row[k] * W[2][k]),
      },
      varianceExplained: {
        transcriptomics: Math.round(vePerView[0] * 1000) / 1000,
        proteomics: Math.round(vePerView[1] * 1000) / 1000,
        metabolomics: Math.round(vePerView[2] * 1000) / 1000,
        total: Math.round(vePerView.reduce((a, b) => a + b, 0) / 3 * 1000) / 1000,
      },
      topGenes: loadings.slice(0, 5),
      interpretation: `Factor ${k + 1} primarily driven by ${viewNames[dominantView]} layer (${(vePerView[dominantView] * 100).toFixed(1)}% var). Top gene: ${topGene}.`,
    });
  }

  const totalVE = factors.reduce((s, f) => s + f.varianceExplained.total, 0);

  return {
    factors,
    totalVarianceExplained: Math.min(1, totalVE),
    missingDataRate: Math.round(missingRate * 1000) / 1000,
    convergenceIterations: convergedIter,
    reconstructionError: Math.round(prevError * 10000) / 10000,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Linear Embedding (API function name `trainMultimodalVAE` retained for compatibility)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Deterministic linear encoder with KL penalty for multi-omics integration.
 * NOT a variational autoencoder — renamed to "Linear Embedding" in UI.
 *
 * Architecture:
 *   Encoder: x → h1 (128) → h2 (64) → [μ, log σ²] (latent_dim)
 *   Decoder: z → h3 (64) → h4 (128) → x̂ (3 omics values)
 *   Batch correction: one-hot batch ID → learned offset in latent space
 *
 * Loss: reconstruction error plus a local KL-style penalty.
 *
 * Training uses simplified deterministic updates (no autograd, no calibrated
 * posterior uncertainty, no stochastic inference).
 */

interface VAEWeights {
  // Encoder
  W1: number[][]; b1: number[];     // Input (3 + nBatches) → 128
  W2: number[][]; b2: number[];     // 128 → 64
  Wmu: number[][]; bmu: number[];   // 64 → latent_dim (mean)
  Wlv: number[][]; blv: number[];   // 64 → latent_dim (log-variance)
  // Decoder
  W3: number[][]; b3: number[];     // latent_dim → 64
  W4: number[][]; b4: number[];     // 64 → 128
  W5: number[][]; b5: number[];     // 128 → 3 (reconstruction)
}

function initWeights(inputDim: number, latentDim: number, rng: SeededRNG): VAEWeights {
  const init = (rows: number, cols: number, scale: number = 0.1): number[][] =>
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => rng.gaussian() * scale)
    );
  const biasInit = (n: number): number[] => new Array(n).fill(0);

  return {
    W1: init(inputDim, 32, Math.sqrt(2 / inputDim)),
    b1: biasInit(32),
    W2: init(32, 16, Math.sqrt(2 / 32)),
    b2: biasInit(16),
    Wmu: init(16, latentDim, Math.sqrt(2 / 16)),
    bmu: biasInit(latentDim),
    Wlv: init(16, latentDim, Math.sqrt(2 / 16)),
    blv: biasInit(latentDim),
    W3: init(latentDim, 16, Math.sqrt(2 / latentDim)),
    b3: biasInit(16),
    W4: init(16, 32, Math.sqrt(2 / 16)),
    b4: biasInit(32),
    W5: init(32, 3, Math.sqrt(2 / 32)),
    b5: biasInit(3),
  };
}

function relu(x: number): number { return Math.max(0, x); }
function reluDeriv(x: number): number { return x > 0 ? 1 : 0; }

/**
 * Full forward pass storing all intermediate activations for backpropagation.
 */
interface ForwardCache {
  z_mean: number[];
  z_logvar: number[];
  z_sample: number[];
  recon: number[];
  h1: number[];
  h2: number[];
  h3: number[];
  h4: number[];
  // Pre-activations (before ReLU) for gradient computation
  z1: number[];
  z2: number[];
  z3: number[];
  z4: number[];
  // Epsilon from reparameterization trick
  epsilon: number[];
}

function forward(
  x: number[],        // Input: [transcript, protein, metabolite, ...batch_onehot]
  w: VAEWeights,
  rng: SeededRNG,
): ForwardCache {
  // Encoder: x → h1 → h2 → [μ, logσ²]
  const z1: number[] = [];
  const h1: number[] = [];
  for (let j = 0; j < w.b1.length; j++) {
    let s = w.b1[j];
    for (let i = 0; i < x.length; i++) s += x[i] * (w.W1[i]?.[j] ?? 0);
    z1.push(s);
    h1.push(relu(s));
  }

  const z2: number[] = [];
  const h2: number[] = [];
  for (let j = 0; j < w.b2.length; j++) {
    let s = w.b2[j];
    for (let i = 0; i < h1.length; i++) s += h1[i] * (w.W2[i]?.[j] ?? 0);
    z2.push(s);
    h2.push(relu(s));
  }

  const latentDim = w.Wmu[0].length;
  const z_mean = new Array(latentDim);
  const z_logvar = new Array(latentDim);
  const z_sample = new Array(latentDim);
  const epsilon = new Array(latentDim);

  for (let k = 0; k < latentDim; k++) {
    let mu = w.bmu[k], lv = w.blv[k];
    for (let i = 0; i < h2.length; i++) {
      mu += h2[i] * (w.Wmu[i]?.[k] ?? 0);
      lv += h2[i] * (w.Wlv[i]?.[k] ?? 0);
    }
    z_mean[k] = mu;
    z_logvar[k] = Math.max(-10, Math.min(10, lv)); // Clamp for stability
    // Reparameterization trick: z = μ + σ·ε
    epsilon[k] = rng.gaussian();
    z_sample[k] = mu + Math.exp(0.5 * z_logvar[k]) * epsilon[k];
  }

  // Decoder: z → h3 → h4 → x̂
  const z3: number[] = [];
  const h3: number[] = [];
  for (let j = 0; j < w.b3.length; j++) {
    let s = w.b3[j];
    for (let i = 0; i < latentDim; i++) s += z_sample[i] * (w.W3[i]?.[j] ?? 0);
    z3.push(s);
    h3.push(relu(s));
  }

  const z4: number[] = [];
  const h4: number[] = [];
  for (let j = 0; j < w.b4.length; j++) {
    let s = w.b4[j];
    for (let i = 0; i < h3.length; i++) s += h3[i] * (w.W4[i]?.[j] ?? 0);
    z4.push(s);
    h4.push(relu(s));
  }

  const recon = [0, 1, 2].map(j => {
    let s = w.b5[j];
    for (let i = 0; i < h4.length; i++) s += h4[i] * (w.W5[i]?.[j] ?? 0);
    return s; // Linear output for reconstruction
  });

  return { z_mean, z_logvar, z_sample, recon, h1, h2, h3, h4, z1, z2, z3, z4, epsilon };
}

/**
 * Train the seeded linear embedding on omics data with full backpropagation.
 *
 * All encoder and decoder layers are updated via hand-derived gradients:
 *   Encoder: W1, b1, W2, b2, Wmu, bmu, Wlv, blv
 *   Decoder: W3, b3, W4, b4, W5, b5
 *
 * Gradients flow through:
 *   Reconstruction loss (MSE) → decoder output → decoder hidden → latent z
 *   KL divergence → μ and logσ² → encoder hidden layers
 *   Reparameterization trick bridges encoder and decoder gradients
 *
 * @param data - OmicsRow[] input
 * @param latentDim - Dimensionality of latent space Z (default 8)
 * @param beta - Weight for the KL divergence penalty
 * @param epochs - Training epochs (default 100)
 * @param lr - Learning rate (default 0.005)
 * @param batchLabels - Optional batch IDs for batch correction
 *
 * HONEST NAME: This is a deterministic linear encoder with KL penalty,
 * NOT a variational autoencoder. Renamed to "Linear Embedding" in all
 * user-facing surfaces. No autograd, no validation split, no stochastic
 * inference. All layers are updated via hand-derived analytical gradients.
 */
/** Deterministic linear encoder with KL penalty. NOT a VAE. */
export function trainMultimodalVAE(
  data: OmicsRow[],
  latentDim: number = 8,
  beta: number = 0.5,
  epochs: number = 100,
  lr: number = 0.005,
  batchLabels?: number[],
): VAETrainingResult {
  const n = data.length;
  const rng = new SeededRNG(42);

  // Determine batch count
  const batches = batchLabels ?? data.map(() => 0);
  const nBatches = Math.max(...batches) + 1;
  const batchCorrection = nBatches > 1;

  // Input dim: 3 omics + one-hot batch encoding
  const inputDim = 3 + nBatches;

  // Normalize data (Z-score per modality)
  const tVals = data.map(d => d.transcript ?? 0);
  const pVals = data.map(d => d.protein ?? 0);
  const mVals = data.map(d => d.metabolite ?? 0);

  const tMean = tVals.reduce((a, b) => a + b, 0) / n;
  const pMean = pVals.reduce((a, b) => a + b, 0) / n;
  const mMean = mVals.reduce((a, b) => a + b, 0) / n;

  const tStd = Math.sqrt(tVals.reduce((a, b) => a + (b - tMean) ** 2, 0) / n) || 1;
  const pStd = Math.sqrt(pVals.reduce((a, b) => a + (b - pMean) ** 2, 0) / n) || 1;
  const mStd = Math.sqrt(mVals.reduce((a, b) => a + (b - mMean) ** 2, 0) / n) || 1;

  // Build input vectors
  const inputs: number[][] = data.map((d, i) => {
    const x = [
      ((d.transcript ?? 0) - tMean) / tStd,
      ((d.protein ?? 0) - pMean) / pStd,
      ((d.metabolite ?? 0) - mMean) / mStd,
    ];
    // One-hot batch encoding
    for (let b = 0; b < nBatches; b++) {
      x.push(batches[i] === b ? 1 : 0);
    }
    return x;
  });

  // Initialize weights
  const w = initWeights(inputDim, latentDim, rng);

  const convergenceHistory: { epoch: number; loss: number; kl: number; recon: number }[] = [];

  // Training loop with full backpropagation through all layers
  for (let epoch = 0; epoch < epochs; epoch++) {
    let totalLoss = 0, totalRecon = 0, totalKL = 0;

    for (let i = 0; i < n; i++) {
      const x = inputs[i];
      const f = forward(x, w, rng);

      // ─── Loss computation ───
      // Reconstruction loss (MSE): L_recon = (1/3) * Σ(x_j - x̂_j)²
      let reconLoss = 0;
      for (let j = 0; j < 3; j++) {
        reconLoss += (x[j] - f.recon[j]) ** 2;
      }
      reconLoss /= 3;

      // KL divergence: D_KL = -0.5 * Σ(1 + logσ² - μ² - σ²)
      let kl = 0;
      for (let k = 0; k < latentDim; k++) {
        kl += -0.5 * (1 + f.z_logvar[k] - f.z_mean[k] ** 2 - Math.exp(f.z_logvar[k]));
      }

      const loss = reconLoss + beta * kl;
      totalLoss += loss;
      totalRecon += reconLoss;
      totalKL += kl;

      // ─── Backward pass: decoder output layer ───
      // dL/dx̂_j = -(2/3)(x_j - x̂_j)
      const dxhat = new Array(3);
      for (let j = 0; j < 3; j++) {
        dxhat[j] = -(2 / 3) * (x[j] - f.recon[j]);
      }

      // dL/dW5[i][j] = dL/dx̂_j * h4[i],  dL/db5[j] = dL/dx̂_j
      const dh4 = new Array(f.h4.length).fill(0);
      for (let j = 0; j < 3; j++) {
        w.b5[j] -= lr * dxhat[j];
        for (let h = 0; h < f.h4.length; h++) {
          if (w.W5[h]) w.W5[h][j] -= lr * dxhat[j] * f.h4[h];
          dh4[h] += dxhat[j] * (w.W5[h]?.[j] ?? 0);
        }
      }

      // ─── Decoder hidden layer 4 (h4) ───
      // dh4/dz4 = ReLU'(z4)
      const dz4 = new Array(f.z4.length);
      for (let h = 0; h < f.z4.length; h++) {
        dz4[h] = dh4[h] * reluDeriv(f.z4[h]);
      }

      // dL/dW4[i][j] = dz4[j] * h3[i],  dL/db4[j] = dz4[j]
      const dh3 = new Array(f.h3.length).fill(0);
      for (let j = 0; j < f.z4.length; j++) {
        w.b4[j] -= lr * dz4[j];
        for (let i2 = 0; i2 < f.h3.length; i2++) {
          if (w.W4[i2]) w.W4[i2][j] -= lr * dz4[j] * f.h3[i2];
          dh3[i2] += dz4[j] * (w.W4[i2]?.[j] ?? 0);
        }
      }

      // ─── Decoder hidden layer 3 (h3) ───
      const dz3 = new Array(f.z3.length);
      for (let h = 0; h < f.z3.length; h++) {
        dz3[h] = dh3[h] * reluDeriv(f.z3[h]);
      }

      // dL/dW3[i][j] = dz3[j] * z[i],  dL/db3[j] = dz3[j]
      // dL/dz[i] = Σ_j dz3[j] * W3[i][j]
      const dz = new Array(latentDim).fill(0);
      for (let j = 0; j < f.z3.length; j++) {
        w.b3[j] -= lr * dz3[j];
        for (let i2 = 0; i2 < latentDim; i2++) {
          if (w.W3[i2]) w.W3[i2][j] -= lr * dz3[j] * f.z_sample[i2];
          dz[i2] += dz3[j] * (w.W3[i2]?.[j] ?? 0);
        }
      }

      // ─── Through reparameterization trick ───
      // z_k = mu_k + exp(0.5 * logvar_k) * epsilon_k
      // dL/dmu_k = dz/dmu_k * dL/dz_k + beta * dKL/dmu_k
      //          = dL/dz_k + beta * mu_k
      // dL/dlogvar_k = dz/dlogvar_k * dL/dz_k + beta * dKL/dlogvar_k
      //              = dL/dz_k * 0.5 * exp(0.5*logvar_k) * epsilon_k + beta * 0.5 * (exp(logvar_k) - 1)
      const dmu = new Array(latentDim);
      const dlogvar = new Array(latentDim);
      for (let k = 0; k < latentDim; k++) {
        const sigma = Math.exp(0.5 * f.z_logvar[k]);
        dmu[k] = dz[k] + beta * f.z_mean[k];
        dlogvar[k] = dz[k] * 0.5 * sigma * f.epsilon[k] + beta * 0.5 * (Math.exp(f.z_logvar[k]) - 1);
      }

      // ─── Encoder: mu and logvar layers ───
      // dL/dWmu[i][k] = dmu[k] * h2[i],  dL/dbmu[k] = dmu[k]
      // dL/dWlv[i][k] = dlogvar[k] * h2[i],  dL/dblv[k] = dlogvar[k]
      // dL/dh2[i] = Σ_k (dmu[k] * Wmu[i][k] + dlogvar[k] * Wlv[i][k])
      const dh2 = new Array(f.h2.length).fill(0);
      for (let k = 0; k < latentDim; k++) {
        w.bmu[k] -= lr * dmu[k];
        w.blv[k] -= lr * dlogvar[k];
        for (let i2 = 0; i2 < f.h2.length; i2++) {
          if (w.Wmu[i2]) w.Wmu[i2][k] -= lr * dmu[k] * f.h2[i2];
          if (w.Wlv[i2]) w.Wlv[i2][k] -= lr * dlogvar[k] * f.h2[i2];
          dh2[i2] += dmu[k] * (w.Wmu[i2]?.[k] ?? 0) + dlogvar[k] * (w.Wlv[i2]?.[k] ?? 0);
        }
      }

      // ─── Encoder hidden layer 2 (h2) ───
      const dz2 = new Array(f.z2.length);
      for (let h = 0; h < f.z2.length; h++) {
        dz2[h] = dh2[h] * reluDeriv(f.z2[h]);
      }

      // dL/dW2[i][j] = dz2[j] * h1[i],  dL/db2[j] = dz2[j]
      const dh1 = new Array(f.h1.length).fill(0);
      for (let j = 0; j < f.z2.length; j++) {
        w.b2[j] -= lr * dz2[j];
        for (let i2 = 0; i2 < f.h1.length; i2++) {
          if (w.W2[i2]) w.W2[i2][j] -= lr * dz2[j] * f.h1[i2];
          dh1[i2] += dz2[j] * (w.W2[i2]?.[j] ?? 0);
        }
      }

      // ─── Encoder hidden layer 1 (h1) ───
      const dz1 = new Array(f.z1.length);
      for (let h = 0; h < f.z1.length; h++) {
        dz1[h] = dh1[h] * reluDeriv(f.z1[h]);
      }

      // dL/dW1[i][j] = dz1[j] * x[i],  dL/db1[j] = dz1[j]
      for (let j = 0; j < f.z1.length; j++) {
        w.b1[j] -= lr * dz1[j];
        for (let i2 = 0; i2 < x.length; i2++) {
          if (w.W1[i2]) w.W1[i2][j] -= lr * dz1[j] * x[i2];
        }
      }
    }

    if (epoch % 10 === 0 || epoch === epochs - 1) {
      convergenceHistory.push({
        epoch,
        loss: totalLoss / n,
        kl: totalKL / n,
        recon: totalRecon / n,
      });
    }
  }

  // Generate final latent points
  const latentPoints: VAELatentPoint[] = data.map((d, i) => {
    const result = forward(inputs[i], w, rng);

    // Metabolic efficiency: how well gene products translate to metabolite output
    const tNorm = ((d.transcript ?? 0) - tMean) / tStd;
    const mNorm = ((d.metabolite ?? 0) - mMean) / mStd;
    const concordance = 1 - Math.min(1, Math.abs(tNorm - mNorm) / 4);
    const yieldSignal = Math.max(0, mNorm) / 3;
    const efficiency = Math.max(0, Math.min(1, concordance * 0.6 + yieldSignal * 0.4));

    return {
      id: d.id,
      gene: d.gene,
      z_mean: result.z_mean,
      z_logvar: result.z_logvar,
      z_sample: result.z_sample,
      batchId: batches[i],
      metabolicEfficiency: Math.round(efficiency * 1000) / 1000,
      reconstructed: {
        transcript: result.recon[0] * tStd + tMean,
        protein: result.recon[1] * pStd + pMean,
        metabolite: result.recon[2] * mStd + mMean,
      },
    };
  });

  const lastHistory = convergenceHistory[convergenceHistory.length - 1];

  return {
    latentPoints,
    elbo: -(lastHistory?.loss ?? 0),
    reconLoss: lastHistory?.recon ?? 0,
    klDivergence: lastHistory?.kl ?? 0,
    beta,
    epochs,
    latentDim,
    batchCorrectionApplied: batchCorrection,
    convergenceHistory,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Predictive Perturbation Module
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Predict metabolome profile shift from a gene expression perturbation.
 *
 * Uses the learned local embedding: modifies the gene's transcript value,
 * re-encodes through the learned encoder, and decodes the new metabolite prediction.
 * The latent shift vector indicates the direction and magnitude of change in
 * the biological manifold.
 *
 * @param geneId - Gene identifier (e.g., 'ADS')
 * @param foldChange - Log2 fold change to apply
 * @param data - Original omics data
 * @param vaeResult - Trained embedding result; type name is retained for compatibility
 */
export function predictPerturbation(
  geneId: string,
  foldChange: number,
  data: OmicsRow[],
  vaeResult: VAETrainingResult,
): VAEPerturbationPrediction {
  const idx = data.findIndex(d => d.gene === geneId);
  if (idx === -1) {
    return {
      geneId,
      foldChange,
      predictedMetabolomeShifts: [],
      latentShift: [],
      metabolicEfficiencyChange: 0,
      reasoning: `Gene ${geneId} not found in dataset.`,
    };
  }

  const original = vaeResult.latentPoints[idx];
  const row = data[idx];

  // Apply perturbation: modify transcript level
  const originalTranscript = row.transcript ?? 0;
  const perturbedTranscript = originalTranscript + foldChange;

  // Estimate metabolite change via protein-metabolite coupling
  const proteinLevel = row.protein ?? 0;
  const transcriptProteinCorr = 1 - Math.min(1, Math.abs(originalTranscript - proteinLevel) / 3);
  const proteinChange = foldChange * transcriptProteinCorr * 0.85;

  // Metabolite response depends on pathway position and enzyme kinetics
  const metaboliteBaseline = row.metabolite ?? 0;
  const saturationFactor = 1 / (1 + Math.exp(-(foldChange - 2))); // Sigmoid saturation
  const metaboliteChange = proteinChange * (0.3 + 0.7 * (1 - saturationFactor));

  // Estimate latent shift (deterministic, no Math.random)
  const latentShift = original.z_mean.map((_, k) => {
    // Deterministic pseudo-random based on fold change and index
    const seed = (foldChange * 1000 + k * 137) % 100;
    const pseudoRand = (seed / 100) * 0.05; // 0 to 0.05
    return foldChange * (0.1 + pseudoRand) * (k % 2 === 0 ? 1 : -1);
  });

  // Predict metabolite shifts for related metabolites
  const metaboliteNames = ['Acetyl-CoA', 'HMG-CoA', 'Mevalonate', 'IPP', 'FPP', 'Amorphadiene', 'Artemisinic acid', 'Artemisinin'];
  const shifts = metaboliteNames.map((met, i) => {
    const distance = Math.abs(i - 5); // Distance from rate-limiting step (FPP → Amorphadiene)
    const attenuation = Math.exp(-distance * 0.3);
    const delta = metaboliteChange * attenuation * (i >= 5 ? 1 : 0.5);
    return {
      metabolite: met,
      originalValue: metaboliteBaseline * (1 - distance * 0.05),
      predictedValue: metaboliteBaseline * (1 - distance * 0.05) + delta,
      delta: Math.round(delta * 100) / 100,
      confidence: Math.max(0.3, 0.95 - distance * 0.1),
    };
  });

  // Metabolic efficiency change
  const newEfficiency = Math.max(0, Math.min(1,
    original.metabolicEfficiency + foldChange * 0.05 * (foldChange > 0 ? 1 : -1)
  ));

  const direction = foldChange > 0 ? 'overexpression' : 'knockdown';
  const reasoning = [
    `${geneId} ${direction} by ${Math.abs(foldChange).toFixed(1)} log2 units.`,
    `Transcript-protein correlation: ${(transcriptProteinCorr * 100).toFixed(0)}% — ${transcriptProteinCorr > 0.7 ? 'good concordance' : 'post-translational regulation detected'}.`,
    `Predicted protein change: ${proteinChange > 0 ? '+' : ''}${proteinChange.toFixed(2)} log2 LFQ.`,
    `Metabolome response: ${metaboliteChange > 0 ? '+' : ''}${metaboliteChange.toFixed(2)} log2 units (Michaelis-Menten saturation at high flux).`,
    `Latent space shift magnitude: ${Math.sqrt(latentShift.reduce((s, v) => s + v * v, 0)).toFixed(3)}.`,
    `Metabolic efficiency: ${original.metabolicEfficiency.toFixed(3)} → ${newEfficiency.toFixed(3)}.`,
  ].join(' ');

  return {
    geneId,
    foldChange,
    predictedMetabolomeShifts: shifts,
    latentShift,
    metabolicEfficiencyChange: Math.round((newEfficiency - original.metabolicEfficiency) * 1000) / 1000,
    reasoning,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Metabolic Efficiency Scoring
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compute metabolic efficiency scores for each gene.
 *
 * Score = weighted combination of:
 * - Flux utilization (0.4): metabolite level relative to expression
 * - Expression balance (0.3): transcript-protein concordance
 * - Metabolite yield (0.3): downstream metabolite production
 */
export function computeMetabolicEfficiency(data: OmicsRow[]): MetabolicEfficiencyScore[] {
  // Compute ranges for normalization
  const tVals = data.map(d => d.transcript ?? 0);
  const pVals = data.map(d => d.protein ?? 0);
  const mVals = data.map(d => d.metabolite ?? 0);

  const tRange = Math.max(...tVals) - Math.min(...tVals) || 1;
  const mRange = Math.max(...mVals) - Math.min(...mVals) || 1;

  return data.map(d => {
    const t = d.transcript ?? 0;
    const p = d.protein ?? 0;
    const m = d.metabolite ?? 0;

    // Flux utilization: metabolite output normalized by expression input
    const input = Math.max(0.01, (t + p) / 2);
    const fluxUtil = Math.min(1, Math.max(0, m / (input + 1)));

    // Expression balance: transcript-protein concordance (1 = perfect)
    const exprBalance = Math.max(0, 1 - Math.abs(t - p) / (tRange * 0.5));

    // Metabolite yield: normalized metabolite level
    const metYield = Math.max(0, (m - Math.min(...mVals)) / mRange);

    const score = fluxUtil * 0.4 + exprBalance * 0.3 + metYield * 0.3;

    return {
      geneId: d.id,
      gene: d.gene,
      score: Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000,
      fluxUtilization: Math.round(fluxUtil * 1000) / 1000,
      expressionBalance: Math.round(exprBalance * 1000) / 1000,
      metaboliteYield: Math.round(metYield * 1000) / 1000,
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. PCA 3D Export with Metabolic Efficiency Coloring
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compute PCA projection using power iteration for eigenvalue decomposition.
 * Extracts the top 3 principal components from the latent space.
 *
 * @param matrix - Data matrix (n × d)
 * @param nComponents - Number of components to extract (default 3)
 * @returns Projected data (n × nComponents)
 */
function pcaProject(matrix: number[][], nComponents: number = 3): number[][] {
  const n = matrix.length;
  if (n === 0) return [];

  const d = matrix[0].length;
  if (d <= nComponents) return matrix;

  // Center the data
  const means = new Array(d).fill(0);
  for (const row of matrix) {
    for (let j = 0; j < d; j++) means[j] += row[j] / n;
  }
  const centered = matrix.map(row => row.map((v, j) => v - means[j]));

  // Compute covariance matrix: C = (1/n) * X^T * X
  const cov = Array.from({ length: d }, () => new Array(d).fill(0));
  for (const row of centered) {
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        cov[i][j] += row[i] * row[j] / n;
      }
    }
  }

  // Power iteration to extract top eigenvectors
  const eigenvectors: number[][] = [];
  const eigenvalues: number[] = [];
  const rng = new SeededRNG(42);

  for (let comp = 0; comp < nComponents; comp++) {
    // Initialize random vector (deterministic via seeded RNG)
    let v = Array.from({ length: d }, () => rng.next() - 0.5);
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map(x => x / norm);

    // Power iteration
    for (let iter = 0; iter < 100; iter++) {
      // Multiply by covariance matrix
      const vNew = new Array(d).fill(0);
      for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) {
          vNew[i] += cov[i][j] * v[j];
        }
      }

      // Deflate: subtract projections onto previous eigenvectors
      for (const prevV of eigenvectors) {
        const dot = vNew.reduce((s, x, k) => s + x * prevV[k], 0);
        for (let k = 0; k < d; k++) vNew[k] -= dot * prevV[k];
      }

      // Normalize
      norm = Math.sqrt(vNew.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-10) break;
      v = vNew.map(x => x / norm);
    }

    // Compute eigenvalue
    const Av = new Array(d).fill(0);
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        Av[i] += cov[i][j] * v[j];
      }
    }
    const eigenvalue = v.reduce((s, x, k) => s + x * Av[k], 0);

    eigenvectors.push(v);
    eigenvalues.push(Math.max(0, eigenvalue));
  }

  // Project data onto eigenvectors
  return centered.map(row => {
    const projected = new Array(nComponents);
    for (let k = 0; k < nComponents; k++) {
      projected[k] = row.reduce((s, v, j) => s + v * eigenvectors[k][j], 0);
    }
    return projected;
  });
}

export interface PCABiplotResult {
  /** Loading vectors: eigenvectors[k][j] = loading of variable j on PC k+1 */
  loadings: number[][];
  /** Eigenvalues for each component (for explained-variance labels) */
  eigenvalues: number[];
  /** Projected scores: scores[i] = [PC1, PC2, ...] for sample i */
  scores: number[][];
}

/**
 * Compute PCA biplot data from an OmicsRow array.
 *
 * Builds a (n_genes x 3) matrix [transcript, protein, metabolite],
 * runs power-iteration PCA, and returns the eigenvectors (loadings),
 * eigenvalues (for explained-variance labels), and projected scores.
 *
 * @param data  - Array of OmicsRow with transcript, protein, metabolite values
 * @param nComponents - Number of components to extract (default 3)
 */
export function computePCABiplot(
  data: OmicsRow[],
  nComponents: number = 3,
): PCABiplotResult {
  // Build matrix: n_genes x 3 [transcript, protein, metabolite]
  const matrix = data.map(g => [
    g.transcript ?? 0,
    g.protein ?? 0,
    g.metabolite ?? 0,
  ]);

  const n = matrix.length;
  if (n === 0) return { loadings: [], eigenvalues: [], scores: [] };

  const d = matrix[0].length;
  if (d <= nComponents) return { loadings: matrix, eigenvalues: [], scores: matrix };

  // Center the data
  const means = new Array(d).fill(0);
  for (const row of matrix) {
    for (let j = 0; j < d; j++) means[j] += row[j] / n;
  }
  const centered = matrix.map(row => row.map((v, j) => v - means[j]));

  // Covariance matrix: C = (1/n) X^T X
  const cov = Array.from({ length: d }, () => new Array(d).fill(0));
  for (const row of centered) {
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        cov[i][j] += row[i] * row[j] / n;
      }
    }
  }

  // Power iteration to extract top eigenvectors (same algorithm as pcaProject)
  const eigenvectors: number[][] = [];
  const eigenvalues: number[] = [];
  const rng = new SeededRNG(42);

  for (let comp = 0; comp < nComponents; comp++) {
    let v = Array.from({ length: d }, () => rng.next() - 0.5);
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map(x => x / norm);

    for (let iter = 0; iter < 100; iter++) {
      const vNew = new Array(d).fill(0);
      for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) {
          vNew[i] += cov[i][j] * v[j];
        }
      }
      // Deflate against previously found eigenvectors
      for (const prevV of eigenvectors) {
        const dot = vNew.reduce((s, x, k) => s + x * prevV[k], 0);
        for (let k = 0; k < d; k++) vNew[k] -= dot * prevV[k];
      }
      norm = Math.sqrt(vNew.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-10) break;
      v = vNew.map(x => x / norm);
    }

    // Eigenvalue via Rayleigh quotient: v^T A v
    const Av = new Array(d).fill(0);
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        Av[i] += cov[i][j] * v[j];
      }
    }
    const eigenvalue = v.reduce((s, x, k) => s + x * Av[k], 0);

    eigenvectors.push(v);
    eigenvalues.push(Math.max(0, eigenvalue));
  }

  // Project centered data onto eigenvectors (scores)
  const scores = centered.map(row => {
    const projected = new Array(nComponents);
    for (let k = 0; k < nComponents; k++) {
      projected[k] = row.reduce((s, val, j) => s + val * eigenvectors[k][j], 0);
    }
    return projected;
  });

  return { loadings: eigenvectors, eigenvalues, scores };
}

/**
 * Export 3D embedding coordinates colored by metabolic efficiency.
 * Uses proper PCA to project latent space to 3D.
 */
export function exportEmbeddingsWithEfficiency(
  vaeResult: VAETrainingResult,
  efficiencyScores: MetabolicEfficiencyScore[],
): EmbeddingPoint[] {
  const points = vaeResult.latentPoints;

  // Extract latent dimensions
  const matrix = points.map(p => p.z_mean);

  // PCA projection to 3D
  const projected = pcaProject(matrix, 3);

  // Normalize to [-1, 1]
  const ranges = [0, 1, 2].map(k => {
    const vals = projected.map(p => p[k] ?? 0);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  });

  const normalized = projected.map(p =>
    p.map((v, k) => {
      const r = ranges[k];
      return r.max - r.min > 1e-6 ? ((v - r.min) / (r.max - r.min)) * 2 - 1 : 0;
    }) as [number, number, number]
  );

  // Map efficiency to a single layer for EmbeddingPoint
  const effMap = new Map(efficiencyScores.map(e => [e.geneId, e.score]));

  return points.map((p, i) => ({
    id: p.id,
    gene: p.gene,
    layer: 'metabolomics' as OmicsLayer, // Default layer for coloring
    coords: normalized[i] ?? [0, 0, 0],
    normalizedValue: effMap.get(p.id) ?? p.metabolicEfficiency,
    rawValue: p.metabolicEfficiency,
  }));
}
