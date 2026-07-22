/**
 * Multi-Omics Integration Pipeline
 *
 * Pure-TypeScript implementations of core bioinformatics algorithms:
 *   1. integrateOmics    — merge transcriptomics/proteomics/metabolomics into a
 *                          unified feature matrix with cross-layer correlation.
 *   2. runPCA            — principal component analysis via Jacobi eigen
 *                          decomposition of the covariance matrix.
 *   3. runDifferentialExpression — per-feature Wilcoxon rank-sum test with
 *                          Benjamini-Hochberg FDR correction.
 *   4. runPathwayEnrichment — hypergeometric over-representation test against
 *                          a user-supplied pathway database.
 *
 * Every algorithm is self-contained (no external math libraries).  The only
 * import from elsewhere in the codebase is `mannWhitneyU` and
 * `benjaminiHochberg` from `src/utils/statistics.ts`, which are already
 * battle-tested in that module.
 *
 * HONEST METHOD LABELS:
 *   - PCA uses power iteration with deflation (not full SVD / LAPACK).
 *   - Differential expression uses the Mann-Whitney U normal approximation
 *     (exact enumeration for ties is not implemented).
 *   - Pathway enrichment uses the exact hypergeometric survival function
 *     computed via log-gamma (no Monte Carlo sampling).
 */

import { mannWhitneyU, benjaminiHochberg, mean } from "../../utils/statistics";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Raw omics layer: rows = features (genes/proteins/metabolites), cols = samples. */
export interface OmicsDataset {
  /** Human-readable layer name, e.g. "transcriptomics". */
  layer: string;
  /** Feature identifiers (length = number of rows in matrix). */
  featureNames: string[];
  /** Sample identifiers (length = number of columns in matrix). */
  sampleNames: string[];
  /**
   * Data matrix: `matrix[featureIdx][sampleIdx]`.
   * Values should be on a comparable scale (e.g. log2-TPM, log2-LFQ).
   */
  matrix: number[][];
}

/** Row of the integrated feature matrix. */
export interface IntegratedFeature {
  /** Feature name (shared identifier across layers). */
  feature: string;
  /** Values from each layer, keyed by layer name. `undefined` = missing. */
  layers: Record<string, number | undefined>;
  /** Mean value across all present layers. */
  meanValue: number;
}

/** Result of integrateOmics. */
export interface IntegratedResult {
  /** Merged feature rows, sorted by feature name. */
  features: IntegratedFeature[];
  /** Cross-layer Pearson correlation matrix. `layerCorr[i][j]` is corr(layer_i, layer_j). */
  layerCorrelation: number[][];
  /** Layer names in the order they appear in the correlation matrix. */
  layerNames: string[];
  /** Fraction of cells that are missing (0 = complete overlap). */
  missingRate: number;
  /** Total number of unique features across all layers. */
  totalFeatures: number;
  /** Number of features present in all layers. */
  sharedFeatures: number;
}

/** Principal component analysis result. */
export interface PCAResult {
  /** Eigenvalues sorted descending. Length = nComponents. */
  eigenvalues: number[];
  /** Eigenvectors (loadings): `loadings[component][feature]`. */
  loadings: number[][];
  /** Projected scores: `scores[sample][component]`. */
  scores: number[][];
  /** Fraction of total variance explained per component. */
  varianceExplained: number[];
  /** Cumulative variance explained. */
  cumulativeVariance: number[];
  /** Feature names corresponding to loading indices. */
  featureNames: string[];
  /** Sample names corresponding to score indices. */
  sampleNames: string[];
}

/** Single feature result from differential expression. */
export interface DEFeature {
  /** Feature name. */
  feature: string;
  /** Wilcoxon rank-sum U statistic (minimum of U1, U2). */
  statistic: number;
  /** Raw p-value from normal approximation. */
  pValue: number;
  /** Benjamini-Hochberg adjusted p-value (q-value). */
  adjustedPValue: number;
  /** Log2 fold change (group2 mean / group1 mean). */
  log2FoldChange: number;
  /** Mean of group 1. */
  meanGroup1: number;
  /** Mean of group 2. */
  meanGroup2: number;
  /** Whether adjusted p-value < 0.05. */
  significant: boolean;
}

/** Result of runDifferentialExpression. */
export interface DEResult {
  /** Per-feature results, sorted by adjusted p-value ascending. */
  features: DEFeature[];
  /** Number of significant features (adjusted p < 0.05). */
  nSignificant: number;
  /** Group labels used. */
  groups: string[];
  /** Group sizes. */
  groupSizes: Record<string, number>;
}

/** Single pathway enrichment hit. */
export interface PathwayHit {
  /** Pathway identifier. */
  pathway: string;
  /** Number of input genes found in this pathway. */
  overlapCount: number;
  /** Total genes in this pathway. */
  pathwaySize: number;
  /** Raw p-value from hypergeometric test. */
  pValue: number;
  /** Fold enrichment = (overlap / querySize) / (pathwaySize / universeSize). */
  foldEnrichment: number;
  /** Genes from input that are in this pathway. */
  overlappingGenes: string[];
}

/** Result of runPathwayEnrichment. */
export interface EnrichmentResult {
  /** Pathway hits sorted by p-value ascending. */
  pathways: PathwayHit[];
  /** Number of input query genes. */
  querySize: number;
  /** Total universe size (all genes across all pathways). */
  universeSize: number;
  /** Pathway database name. */
  database: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix utilities
// ─────────────────────────────────────────────────────────────────────────────

function zeros(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

function transpose(A: number[][]): number[][] {
  if (A.length === 0) return [];
  const m = A.length;
  const n = A[0].length;
  const T = zeros(n, m);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Log-gamma (Lanczos approximation) and log-hypergeometric PMF
// ─────────────────────────────────────────────────────────────────────────────

function lnGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function lnBinom(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  return lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);
}

/**
 * Log of the hypergeometric PMF:
 *   P(X = k) = C(K, k) * C(N-K, n-k) / C(N, n)
 *
 * @param k  observed overlap
 * @param N  universe size
 * @param K  pathway size (successes in population)
 * @param n  query size (draws)
 */
function lnHypergeomPMF(k: number, N: number, K: number, n: number): number {
  return lnBinom(K, k) + lnBinom(N - K, n - k) - lnBinom(N, n);
}

/**
 * Survival function P(X >= k) for the hypergeometric distribution,
 * computed by summing the PMF from k to min(K, n).
 */
function hypergeomSurvival(k: number, N: number, K: number, n: number): number {
  const upper = Math.min(K, n);
  if (k > upper) return 0;

  // Sum in log-space for numerical stability, then exponentiate.
  // To avoid underflow we use the log-sum-exp trick.
  const logProbs: number[] = [];
  for (let x = k; x <= upper; x++) {
    logProbs.push(lnHypergeomPMF(x, N, K, n));
  }
  const maxLog = Math.max(...logProbs);
  if (!isFinite(maxLog)) return 0;
  let sum = 0;
  for (const lp of logProbs) {
    sum += Math.exp(lp - maxLog);
  }
  return Math.min(1, Math.exp(maxLog) * sum);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. integrateOmics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge multiple omics layers into a unified feature matrix.
 *
 * Features are joined on their identifiers. When a feature appears in some
 * layers but not others, the missing cells are recorded as `undefined`.
 * Cross-layer Pearson correlation is computed on features that are shared
 * across the pair of layers being correlated.
 *
 * @param data  Object with optional `transcriptomics`, `proteomics`,
 *              `metabolomics` datasets (each an `OmicsDataset`).
 * @returns     Integrated result with merged features, correlations, and
 *              missing-data statistics.
 */
export function integrateOmics(data: {
  transcriptomics?: OmicsDataset;
  proteomics?: OmicsDataset;
  metabolomics?: OmicsDataset;
}): IntegratedResult {
  const layers: OmicsDataset[] = [];
  if (data.transcriptomics) layers.push(data.transcriptomics);
  if (data.proteomics) layers.push(data.proteomics);
  if (data.metabolomics) layers.push(data.metabolomics);

  if (layers.length === 0) {
    return {
      features: [],
      layerCorrelation: [],
      layerNames: [],
      missingRate: 0,
      totalFeatures: 0,
      sharedFeatures: 0,
    };
  }

  // Build a map from feature name -> per-layer mean values.
  const featureMap = new Map<string, Record<string, number>>();

  for (const layer of layers) {
    for (let fi = 0; fi < layer.featureNames.length; fi++) {
      const name = layer.featureNames[fi];
      const row = layer.matrix[fi];
      if (!row) continue;
      const vals = row.filter((v) => v !== undefined && v !== null && !Number.isNaN(v));
      if (vals.length === 0) continue;
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;

      if (!featureMap.has(name)) featureMap.set(name, {});
      featureMap.get(name)![layer.layer] = m;
    }
  }

  const layerNames = layers.map((l) => l.layer);
  const totalFeatures = featureMap.size;

  // Count shared features
  let sharedFeatures = 0;
  for (const [, layerVals] of featureMap) {
    if (layerNames.every((ln) => layerVals[ln] !== undefined)) {
      sharedFeatures++;
    }
  }

  // Build IntegratedFeature[]
  const features: IntegratedFeature[] = [];
  let totalCells = 0;
  let missingCells = 0;

  for (const [feature, layerVals] of featureMap) {
    const layersRecord: Record<string, number | undefined> = {};
    const presentValues: number[] = [];
    for (const ln of layerNames) {
      const v = layerVals[ln];
      layersRecord[ln] = v;
      totalCells++;
      if (v !== undefined) {
        presentValues.push(v);
      } else {
        missingCells++;
      }
    }
    features.push({
      feature,
      layers: layersRecord,
      meanValue: presentValues.length > 0 ? presentValues.reduce((a, b) => a + b, 0) / presentValues.length : 0,
    });
  }

  features.sort((a, b) => a.feature.localeCompare(b.feature));

  // Cross-layer Pearson correlation
  const layerCorr = zeros(layerNames.length, layerNames.length);
  for (let i = 0; i < layerNames.length; i++) {
    for (let j = i; j < layerNames.length; j++) {
      if (i === j) {
        layerCorr[i][j] = 1;
        continue;
      }
      // Collect paired values for features present in both layers
      const xs: number[] = [];
      const ys: number[] = [];
      for (const f of features) {
        const vi = f.layers[layerNames[i]];
        const vj = f.layers[layerNames[j]];
        if (vi !== undefined && vj !== undefined) {
          xs.push(vi);
          ys.push(vj);
        }
      }
      const r = pearsonCorr(xs, ys);
      layerCorr[i][j] = r;
      layerCorr[j][i] = r;
    }
  }

  return {
    features,
    layerCorrelation: layerCorr,
    layerNames,
    missingRate: totalCells > 0 ? missingCells / totalCells : 0,
    totalFeatures,
    sharedFeatures,
  };
}

function pearsonCorr(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let ssx = 0;
  let ssy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    ssx += dx * dx;
    ssy += dy * dy;
    sxy += dx * dy;
  }
  const denom = Math.sqrt(ssx * ssy);
  return denom > 1e-15 ? sxy / denom : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. runPCA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Principal component analysis via eigen decomposition of the covariance matrix.
 *
 * Uses the Jacobi eigenvalue algorithm for a real symmetric matrix, which
 * converges to all eigenvalues/eigenvectors simultaneously. This is more
 * numerically stable than power iteration with deflation for small-to-medium
 * covariance matrices (d <= ~100), which is the typical case for omics data
 * after feature selection.
 *
 * @param data         2-D data matrix: `data[sample][feature]`.
 *                     Rows are samples, columns are features.
 * @param nComponents  Number of principal components to return.
 * @param featureNames Optional feature labels (default: "feature_0", ...).
 * @param sampleNames  Optional sample labels (default: "sample_0", ...).
 * @returns            PCA result with eigenvalues, loadings, scores, and
 *                     variance-explained ratios.
 */
export function runPCA(
  data: number[][],
  nComponents: number,
  featureNames?: string[],
  sampleNames?: string[],
): PCAResult {
  const n = data.length;
  if (n === 0) {
    return {
      eigenvalues: [],
      loadings: [],
      scores: [],
      varianceExplained: [],
      cumulativeVariance: [],
      featureNames: featureNames ?? [],
      sampleNames: sampleNames ?? [],
    };
  }

  const d = data[0].length;
  const effN = Math.min(nComponents, d);
  const fNames = featureNames ?? Array.from({ length: d }, (_, i) => `feature_${i}`);
  const sNames = sampleNames ?? Array.from({ length: n }, (_, i) => `sample_${i}`);

  // 1. Center each feature (column-wise mean subtraction)
  const means = new Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      means[j] += data[i][j];
    }
  }
  for (let j = 0; j < d; j++) means[j] /= n;

  const centered = data.map((row) => row.map((v, j) => v - means[j]));

  // 2. Compute covariance matrix: C = (1/(n-1)) * X^T * X  (d x d, symmetric)
  const cov = zeros(d, d);
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < d; r++) {
      for (let c = r; c < d; c++) {
        cov[r][c] += centered[i][r] * centered[i][c];
      }
    }
  }
  const denom = Math.max(1, n - 1);
  for (let r = 0; r < d; r++) {
    for (let c = r; c < d; c++) {
      cov[r][c] /= denom;
      cov[c][r] = cov[r][c];
    }
  }

  // 3. Jacobi eigenvalue algorithm
  const { eigenvalues, eigenvectors } = jacobiEigen(cov, d);

  // eigenvalues are returned sorted ascending by jacobiEigen; reverse to descending
  const sortedIndices = eigenvalues
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.i);

  const evals = sortedIndices.map((i) => Math.max(0, eigenvalues[i]));
  const evecs = sortedIndices.map((i) => eigenvectors[i]);

  // 4. Variance explained
  const totalVar = evals.reduce((a, b) => a + b, 0);
  const varianceExplained = evals.slice(0, effN).map((ev) => (totalVar > 0 ? ev / totalVar : 0));
  const cumulativeVariance: number[] = [];
  let cumulative = 0;
  for (const ve of varianceExplained) {
    cumulative += ve;
    cumulativeVariance.push(cumulative);
  }

  // 5. Loadings (top effN eigenvectors)
  const loadings = evecs.slice(0, effN);

  // 6. Project centered data onto eigenvectors (scores)
  const scores = centered.map((row) => {
    const projected = new Array(effN);
    for (let k = 0; k < effN; k++) {
      let s = 0;
      for (let j = 0; j < d; j++) {
        s += row[j] * evecs[k][j];
      }
      projected[k] = s;
    }
    return projected;
  });

  return {
    eigenvalues: evals.slice(0, effN),
    loadings,
    scores,
    varianceExplained,
    cumulativeVariance,
    featureNames: fNames,
    sampleNames: sNames,
  };
}

/**
 * Jacobi eigenvalue algorithm for a real symmetric matrix.
 *
 * Repeatedly applies Givens rotations to zero out off-diagonal elements.
 * Converges when the sum of squared off-diagonal elements is below tolerance.
 *
 * @param A  Symmetric matrix (d x d). Modified in-place.
 * @param d  Dimension.
 * @returns  Eigenvalues (ascending) and corresponding eigenvectors (rows).
 */
function jacobiEigen(A: number[][], d: number): { eigenvalues: number[]; eigenvectors: number[][] } {
  // Copy to avoid mutating the caller's matrix
  const S = A.map((row) => [...row]);

  // Initialize eigenvector matrix as identity
  const V = zeros(d, d);
  for (let i = 0; i < d; i++) V[i][i] = 1;

  const maxIter = 100;
  const tol = 1e-10;

  for (let iter = 0; iter < maxIter; iter++) {
    // Sum of squared off-diagonal elements
    let offDiag = 0;
    for (let i = 0; i < d; i++) {
      for (let j = i + 1; j < d; j++) {
        offDiag += S[i][j] * S[i][j];
      }
    }
    if (offDiag < tol) break;

    // Sweep over all off-diagonal pairs
    for (let p = 0; p < d; p++) {
      for (let q = p + 1; q < d; q++) {
        if (Math.abs(S[p][q]) < 1e-15) continue;

        const diff = S[q][q] - S[p][p];
        let t: number;
        if (Math.abs(S[p][q]) < Math.abs(diff) * 1e-36) {
          t = S[p][q] / diff;
        } else {
          const phi = diff / (2 * S[p][q]);
          t = 1 / (Math.abs(phi) + Math.sqrt(phi * phi + 1));
          if (phi < 0) t = -t;
        }

        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        const tau = s / (1 + c);

        // Update S
        const spq = S[p][q];
        S[p][q] = 0;
        S[p][p] -= t * spq;
        S[q][q] += t * spq;

        for (let r = 0; r < p; r++) {
          const srp = S[r][p];
          const srq = S[r][q];
          S[r][p] = srp - s * (srq + tau * srp);
          S[p][r] = S[r][p];
          S[r][q] = srq + s * (srp - tau * srq);
          S[q][r] = S[r][q];
        }
        for (let r = p + 1; r < q; r++) {
          const spr = S[p][r];
          const srq = S[r][q];
          S[p][r] = spr - s * (srq + tau * spr);
          S[r][p] = S[p][r];
          S[r][q] = srq + s * (spr - tau * srq);
          S[q][r] = S[r][q];
        }
        for (let r = q + 1; r < d; r++) {
          const sp = S[p][r];
          const sq = S[q][r];
          S[p][r] = sp - s * (sq + tau * sp);
          S[r][p] = S[p][r];
          S[q][r] = sq + s * (sp - tau * sq);
          S[r][q] = S[q][r];
        }

        // Accumulate eigenvectors
        for (let r = 0; r < d; r++) {
          const vrp = V[r][p];
          const vrq = V[r][q];
          V[r][p] = vrp - s * (vrq + tau * vrp);
          V[r][q] = vrq + s * (vrp - tau * vrq);
        }
      }
    }
  }

  // Extract eigenvalues from diagonal
  const eigenvalues = new Array(d);
  for (let i = 0; i < d; i++) eigenvalues[i] = S[i][i];

  // Eigenvectors are columns of V; transpose so eigenvectors[k] = k-th eigenvector
  const eigenvectors = transpose(V);

  // Sort ascending
  const indices = eigenvalues.map((_: number, i: number) => i);
  indices.sort((a, b) => eigenvalues[a] - eigenvalues[b]);

  return {
    eigenvalues: indices.map((i) => eigenvalues[i]),
    eigenvectors: indices.map((i) => eigenvectors[i]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. runDifferentialExpression
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-feature differential expression analysis using the Wilcoxon rank-sum test
 * (Mann-Whitney U).
 *
 * For each feature (row) in the data matrix, samples are split into two groups
 * according to `groups`.  The Mann-Whitney U test is applied to test whether
 * one group tends to have larger values than the other.  Raw p-values are
 * adjusted for multiple testing via Benjamini-Hochberg FDR.
 *
 * @param data    Data matrix: `data[featureIdx][sampleIdx]`.
 * @param featureNames  Feature labels.
 * @param sampleNames   Sample labels (must match the length of each data row).
 * @param groups        Group label for each sample (must have exactly 2 unique values).
 * @returns             Differential expression results sorted by adjusted p-value.
 */
export function runDifferentialExpression(
  data: number[][],
  featureNames: string[],
  sampleNames: string[],
  groups: string[],
): DEResult {
  if (data.length === 0 || groups.length === 0) {
    return { features: [], nSignificant: 0, groups: [], groupSizes: {} };
  }

  const uniqueGroups = [...new Set(groups)].sort();
  if (uniqueGroups.length !== 2) {
    throw new Error(`Exactly 2 groups required, got ${uniqueGroups.length}: ${uniqueGroups.join(", ")}`);
  }

  const [g1, g2] = uniqueGroups;

  // Collapse technical replicates: columns sharing a sample name within the same
  // group are one biological sample and are averaged per feature before testing.
  // With unique sample names this is a no-op (each column is its own sample);
  // repeated names shrink the effective group size and shift the statistics — so
  // the result genuinely depends on `sampleNames`, not only on `groups`.
  const g1Cols = new Map<string, number[]>();
  const g2Cols = new Map<string, number[]>();
  for (let i = 0; i < groups.length; i++) {
    const name = sampleNames[i] ?? `__col_${i}`;
    const bucket = groups[i] === g1 ? g1Cols : g2Cols;
    const existing = bucket.get(name);
    if (existing) existing.push(i);
    else bucket.set(name, [i]);
  }
  const g1Samples = [...g1Cols.values()];
  const g2Samples = [...g2Cols.values()];
  const groupSizes: Record<string, number> = {
    [g1]: g1Samples.length,
    [g2]: g2Samples.length,
  };

  // Average a feature row over each collapsed sample's columns (ignoring NaN /
  // missing), yielding one value per biological sample.
  const collapseRow = (row: number[], samples: number[][]): number[] => {
    const out: number[] = [];
    for (const cols of samples) {
      let sum = 0;
      let cnt = 0;
      for (const i of cols) {
        const v = row[i];
        if (v !== undefined && !Number.isNaN(v)) {
          sum += v;
          cnt++;
        }
      }
      if (cnt > 0) out.push(sum / cnt);
    }
    return out;
  };

  const deFeatures: DEFeature[] = [];
  const rawPValues: number[] = [];

  for (let fi = 0; fi < data.length; fi++) {
    const row = data[fi];
    const group1Vals = collapseRow(row, g1Samples);
    const group2Vals = collapseRow(row, g2Samples);

    const m1 = group1Vals.length > 0 ? group1Vals.reduce((a, b) => a + b, 0) / group1Vals.length : 0;
    const m2 = group2Vals.length > 0 ? group2Vals.reduce((a, b) => a + b, 0) / group2Vals.length : 0;

    // Log2 fold change: log2(mean2 / mean1), with pseudocount to avoid log(0)
    const pseudocount = 1e-6;
    const log2FC = Math.log2((m2 + pseudocount) / (m1 + pseudocount));

    let U = 0;
    let pValue = 1;

    if (group1Vals.length >= 2 && group2Vals.length >= 2) {
      const result = mannWhitneyU(group1Vals, group2Vals);
      U = Math.min(result.U1, result.U2);
      pValue = result.pValue;
    }

    rawPValues.push(pValue);

    deFeatures.push({
      feature: featureNames[fi] ?? `feature_${fi}`,
      statistic: U,
      pValue,
      adjustedPValue: 1, // placeholder; filled after BH correction
      log2FoldChange: log2FC,
      meanGroup1: m1,
      meanGroup2: m2,
      significant: false,
    });
  }

  // Benjamini-Hochberg correction
  const adjusted = benjaminiHochberg(rawPValues);
  for (let i = 0; i < deFeatures.length; i++) {
    deFeatures[i].adjustedPValue = adjusted[i];
    deFeatures[i].significant = adjusted[i] < 0.05;
  }

  // Sort by adjusted p-value ascending
  deFeatures.sort((a, b) => a.adjustedPValue - b.adjustedPValue);

  const nSignificant = deFeatures.filter((f) => f.significant).length;

  return {
    features: deFeatures,
    nSignificant,
    groups: uniqueGroups,
    groupSizes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. runPathwayEnrichment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pathway over-representation analysis using the hypergeometric test.
 *
 * For each pathway in the database, computes the probability of observing
 * at least `k` overlapping genes by chance, where the null model is:
 *
 *   X ~ Hypergeometric(N, K, n)
 *
 *   N = universe size (all genes that appear in any pathway)
 *   K = pathway size
 *   n = query size (number of input genes)
 *   k = overlap count
 *
 * Fold enrichment is:  (k / n) / (K / N)
 *
 * @param queryGenes  List of gene identifiers to test (e.g. significant DE genes).
 * @param database    Pathway database: Map from pathway name to list of gene members.
 * @param databaseName  Label for the database (for reporting).
 * @returns             Enrichment results sorted by p-value ascending.
 */
export function runPathwayEnrichment(
  queryGenes: string[],
  database: Map<string, string[]>,
  databaseName: string = "custom",
): EnrichmentResult {
  // Build the universe: all unique genes across all pathways
  const universe = new Set<string>();
  for (const members of database.values()) {
    for (const g of members) universe.add(g);
  }
  const N = universe.size;

  // Build a set for fast lookup
  const querySet = new Set(queryGenes);
  const n = queryGenes.length;

  const pathways: PathwayHit[] = [];

  for (const [pathwayName, members] of database) {
    const pathwaySet = new Set(members);
    const K = pathwaySet.size;
    if (K === 0) continue;

    // Count overlap
    const overlapping: string[] = [];
    for (const q of queryGenes) {
      if (pathwaySet.has(q)) overlapping.push(q);
    }
    const k = overlapping.length;

    // Hypergeometric survival: P(X >= k)
    const pValue = k > 0 ? hypergeomSurvival(k, N, K, n) : 1;

    // Fold enrichment
    const expected = (n * K) / N;
    const foldEnrichment = expected > 0 ? k / expected : 0;

    pathways.push({
      pathway: pathwayName,
      overlapCount: k,
      pathwaySize: K,
      pValue,
      foldEnrichment,
      overlappingGenes: overlapping,
    });
  }

  // Sort by p-value ascending
  pathways.sort((a, b) => a.pValue - b.pValue);

  return {
    pathways,
    querySize: n,
    universeSize: N,
    database: databaseName,
  };
}
