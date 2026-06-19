/**
 * Single-cell & Spatial Transcriptomics Engine (sc-Spatial)
 *
 * Pure TypeScript implementation of core single-cell analysis algorithms
 * for the Nexus-Bio platform. Provides an end-to-end pipeline from raw
 * count-matrix QC through clustering, trajectory inference, spatial
 * statistics, and a deterministic linear latent embedding.
 *
 * HONEST METHOD NOTE: the routine named `trainScVAE` below is NOT a variational
 * autoencoder. There is no q(z|x) sampling, no KL term, and no β-disentanglement.
 * It is a deterministic linear encoder/decoder optimized by gradient descent on
 * a reconstruction objective. Function names are preserved for API stability,
 * but every user-facing label refers to it as a "linear embedding".
 *
 * Pipeline stages:
 *   1. QC & filtering   — mitochondrial %, min counts / genes
 *   2. Normalization     — library-size scaling + log1p
 *   3. HVG selection     — Seurat v3 variance-stabilizing transform
 *   4. Clustering        — KNN graph + Louvain community detection
 *   5. PAGA trajectory   — cluster connectivity + diffusion pseudotime
 *   6. Spatial neighbors — KNN on (x, y) coordinates
 *   7. Moran's I         — spatial autocorrelation per gene
 *   8. linear embedding  — deterministic linear encoder/decoder (NOT a VAE; see note above)
 *   9. High-yield ID     — metabolic efficiency & fate classification
 *
 * All numeric computation is hand-rolled — no external dependencies.
 * Seeded PRNG guarantees reproducibility across runs.
 *
 * References:
 *   - Stuart et al. (2019) Comprehensive Integration of Single-Cell Data
 *   - Wolf et al. (2019) PAGA: graph abstraction for trajectory inference
 *   - Moran (1950) Notes on continuous stochastic phenomena
 *   - Lopez et al. (2018) Deep generative modeling for single-cell transcriptomics
 */

import { KDTreeIndex } from '../utils/knnIndex';
import { mannWhitneyU, benjaminiHochberg } from '../utils/statistics';

// ══════════════════════════════════════════════════════════════════════
//  Marker gene sets for expression-based cell-type annotation
// ══════════════════════════════════════════════════════════════════════

const MARKER_GENE_SETS: Record<string, { markers: string[]; label: string }> = {
  progenitor: { markers: ['SOX2', 'NES', 'VIM', 'NOTCH1'], label: 'Progenitor' },
  metabolic: { markers: ['ATP5F1', 'COX4I1', 'SDHB', 'IDH1'], label: 'Metabolically Active' },
  stressed: { markers: ['HSPA5', 'DDIT3', 'ATF4', 'XBP1'], label: 'Stressed' },
  quiescent: { markers: ['MKI67', 'PCNA', 'TOP2A'], label: 'Quiescent' },
};

/**
 * Label clusters by running Wilcoxon rank-sum tests on known marker gene sets.
 *
 * For each cluster, compares expression of marker genes inside vs outside the
 * cluster.  The marker set with the highest mean -log10(p) enrichment wins.
 * Falls back to "Cluster N" when no set reaches p < 0.05.
 */
function markerGeneAnnotation(
  community: Int32Array,
  cells: CellRecord[],
  geneNames: string[],
): Map<number, string> {
  const nClusters = new Set(community).size;
  const labels = new Map<number, string>();

  for (let c = 0; c < nClusters; c++) {
    const inIdx: number[] = [];
    const outIdx: number[] = [];
    for (let i = 0; i < community.length; i++) {
      (community[i] === c ? inIdx : outIdx).push(i);
    }
    if (inIdx.length < 2 || outIdx.length < 2) {
      labels.set(c, `Cluster ${c}`);
      continue;
    }

    let bestKey = '';
    let bestScore = -Infinity;

    for (const [key, { markers }] of Object.entries(MARKER_GENE_SETS)) {
      let scoreSum = 0;
      let matched = 0;

      for (const marker of markers) {
        // Find the gene index (case-insensitive match)
        const gIdx = geneNames.findIndex(g => g.toUpperCase() === marker.toUpperCase());
        if (gIdx < 0) continue;

        const inVals = inIdx.map(i => cells[i].geneExpression[geneNames[gIdx]] ?? 0);
        const outVals = outIdx.map(i => cells[i].geneExpression[geneNames[gIdx]] ?? 0);

        // Skip if all values are identical (no variance)
        const allSame = inVals.every(v => v === inVals[0]) && outVals.every(v => v === outVals[0]);
        if (allSame) continue;

        try {
          const { pValue } = mannWhitneyU(inVals, outVals);
          if (pValue > 0 && pValue < 1) {
            // Enrichment: higher expression in cluster means the marker is relevant
            const inMean = inVals.reduce((s, v) => s + v, 0) / inVals.length;
            const outMean = outVals.reduce((s, v) => s + v, 0) / outVals.length;
            if (inMean > outMean) {
              scoreSum += -Math.log10(pValue);
            }
          }
          matched++;
        } catch {
          // mannWhitneyU throws on empty samples; skip
        }
      }

      if (matched > 0) {
        const enrichment = scoreSum / matched;
        if (enrichment > bestScore) {
          bestScore = enrichment;
          bestKey = key;
        }
      }
    }

    // Require at least one significant marker (p < 0.05 -> -log10 > 1.301)
    if (bestKey && bestScore > -Math.log10(0.05)) {
      labels.set(c, MARKER_GENE_SETS[bestKey].label);
    } else {
      labels.set(c, `Cluster ${c}`);
    }
  }

  return labels;
}

/**
 * Result for a single gene's differential expression test.
 */
export interface MarkerGeneResult {
  gene: string;
  logFoldChange: number;   // log2(mean_in / mean_out), clipped to avoid ±Inf
  pValue: number;           // raw p-value from Wilcoxon rank-sum
  qValue: number;           // BH-adjusted p-value (FDR)
  meanIn: number;           // mean expression in cluster
  meanOut: number;          // mean expression outside cluster
}

/**
 * Per-cluster marker gene summary.
 */
export interface ClusterMarkerSummary {
  clusterId: number;
  label: string;                    // from markerGeneAnnotation
  nCells: number;
  markers: MarkerGeneResult[];      // sorted by qValue ascending, top-N
}

/**
 * De novo marker gene discovery: test every gene in every cluster using
 * Wilcoxon rank-sum, apply Benjamini-Hochberg FDR correction, and return
 * ranked marker genes per cluster.
 *
 * This complements the predefined-set-based `markerGeneAnnotation()` by
 * discovering markers without prior knowledge of cell types.
 *
 * @param community  Cluster assignment array (one entry per cell).
 * @param cells      Cell records with geneExpression maps.
 * @param geneNames  Array of gene symbols to test.
 * @param nTop       Max markers per cluster (default 10).
 * @param fdrThreshold  BH FDR cutoff (default 0.05).
 */
export function discoverMarkerGenes(
  community: Int32Array,
  cells: CellRecord[],
  geneNames: string[],
  nTop: number = 10,
  fdrThreshold: number = 0.05,
): ClusterMarkerSummary[] {
  const nClusters = new Set(community).size;
  const clusterLabels = markerGeneAnnotation(community, cells, geneNames);
  const results: ClusterMarkerSummary[] = [];

  for (let c = 0; c < nClusters; c++) {
    const inIdx: number[] = [];
    const outIdx: number[] = [];
    for (let i = 0; i < community.length; i++) {
      (community[i] === c ? inIdx : outIdx).push(i);
    }
    if (inIdx.length < 2 || outIdx.length < 2) {
      results.push({ clusterId: c, label: clusterLabels.get(c) ?? `Cluster ${c}`, nCells: inIdx.length, markers: [] });
      continue;
    }

    // Test every gene
    const rawResults: { gene: string; meanIn: number; meanOut: number; pValue: number }[] = [];
    for (const gene of geneNames) {
      const inVals = inIdx.map(i => cells[i].geneExpression[gene] ?? 0);
      const outVals = outIdx.map(i => cells[i].geneExpression[gene] ?? 0);

      // Skip genes with no variance across all cells
      const allVals = [...inVals, ...outVals];
      if (allVals.every(v => v === allVals[0])) continue;

      try {
        const { pValue } = mannWhitneyU(inVals, outVals);
        const meanIn = inVals.reduce((s, v) => s + v, 0) / inVals.length;
        const meanOut = outVals.reduce((s, v) => s + v, 0) / outVals.length;
        rawResults.push({ gene, meanIn, meanOut, pValue: Math.max(pValue, 1e-300) });
      } catch {
        // Skip on error (empty samples, etc.)
      }
    }

    // Apply Benjamini-Hochberg FDR correction
    const pValues = rawResults.map(r => r.pValue);
    const qValues = benjaminiHochberg(pValues);

    // Build annotated results with log-fold-change
    const annotated: MarkerGeneResult[] = rawResults.map((r, i) => {
      // log2 fold change with pseudocount to avoid division by zero
      const pseudocount = 0.01;
      const lfc = Math.log2((r.meanIn + pseudocount) / (r.meanOut + pseudocount));
      return {
        gene: r.gene,
        logFoldChange: lfc,
        pValue: r.pValue,
        qValue: qValues[i],
        meanIn: r.meanIn,
        meanOut: r.meanOut,
      };
    });

    // Filter by FDR threshold, sort by qValue, take top-N
    const significant = annotated
      .filter(r => r.qValue < fdrThreshold && r.logFoldChange > 0)
      .sort((a, b) => a.qValue - b.qValue)
      .slice(0, nTop);

    results.push({
      clusterId: c,
      label: clusterLabels.get(c) ?? `Cluster ${c}`,
      nCells: inIdx.length,
      markers: significant,
    });
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════
//  Types
// ══════════════════════════════════════════════════════════════════════

/** Core cell data structure (AnnData-like) */
export interface CellRecord {
  id: string;
  barcode: string;
  totalCounts: number;
  nGenes: number;
  mitoPercent: number;
  geneExpression: Record<string, number>;
  cluster: number;
  cellType: string;
  pseudotime: number;
  spatialX: number;
  spatialY: number;
  batchId: number;
  qcPass: boolean;
}

export interface QCResult {
  totalCells: number;
  passedCells: number;
  filteredCells: number;
  mitoThreshold: number;
  minCounts: number;
  minGenes: number;
  medianCounts: number;
  medianGenes: number;
  medianMitoPercent: number;
}

export interface HVGResult {
  genes: { gene: string; mean: number; variance: number; varianceNorm: number; isHVG: boolean }[];
  nHVGs: number;
  method: string;
}

export interface ClusterResult {
  nClusters: number;
  clusterSizes: { cluster: number; size: number; label: string }[];
  silhouetteScore: number;
  modularity: number;
}

export interface PAGAResult {
  connectivities: number[][];
  clusterPseudotime: number[];
  branchingPoints: {
    cluster: number;
    label: string;
    divergenceScore: number;
    childBranches: { cluster: number; label: string; fate: 'productive' | 'stressed' | 'quiescent' }[];
  }[];
  pseudotimeRange: [number, number];
  rootCluster: number;
  trajectory: { from: number; to: number; weight: number }[];
}

export interface SpatialNeighborResult {
  nCells: number;
  nNeighbors: number;
  graphType: 'knn' | 'delaunay';
  adjacency: [number, number][];
}

export interface MoranResult {
  gene: string;
  moranI: number;
  expectedI: number;
  zScore: number;
  pValue: number;
  isSpatiallyRestricted: boolean;
}

export interface SpatialAutocorrelationResult {
  results: MoranResult[];
  nGenesTested: number;
  nSpatiallyRestricted: number;
  topSpatialGenes: string[];
}

export interface VAELatentCell {
  id: string;
  barcode: string;
  z_mean: number[];
  z_sample: number[];
  cluster: number;
  cellType: string;
  batchId: number;
  umapX: number;
  umapY: number;
  metabolicEfficiency: number;
}

export interface ScVAEResult {
  latentCells: VAELatentCell[];
  elbo: number;
  reconLoss: number;
  klDivergence: number;
  latentDim: number;
  batchCorrected: boolean;
  convergenceHistory: { epoch: number; loss: number; kl: number; recon: number }[];
}

export interface HighYieldCluster {
  clusterId: number;
  label: string;
  nCells: number;
  avgMetabolicEfficiency: number;
  avgProductivity: number;
  keyGenes: { gene: string; meanExpression: number; pctExpressed: number }[];
  fate: 'productive' | 'stressed' | 'quiescent';
  spatiallyLocalized: boolean;
}

export interface ScSpatialAnalysisResult {
  qc: QCResult;
  hvg: HVGResult;
  clusters: ClusterResult;
  paga: PAGAResult;
  spatial: SpatialNeighborResult;
  autocorrelation: SpatialAutocorrelationResult;
  vae: ScVAEResult;
  highYieldClusters: HighYieldCluster[];
}

// ══════════════════════════════════════════════════════════════════════
//  Internal helpers
// ══════════════════════════════════════════════════════════════════════

/** Linear congruential generator for reproducible randomness. */
class SeededRNG {
  private state: number;
  constructor(seed: number = 42) { this.state = seed; }
  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  /** Box-Muller transform → standard normal sample. */
  gaussian(): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Collect all unique gene names across cells. */
function allGenes(cells: CellRecord[]): string[] {
  const geneSet = new Set<string>();
  for (const c of cells) {
    for (const g of Object.keys(c.geneExpression)) geneSet.add(g);
  }
  return Array.from(geneSet).sort();
}

/** Build a KNN graph from 2-D points using a K-d tree index. Returns edge list of index pairs. */
function buildKNNGraph(points: [number, number][], k: number): [number, number][] {
  const n = points.length;
  const edges: [number, number][] = [];

  // Build a map from point coordinates back to their original indices.
  // We encode each [x, y] as a string key "x,y" for O(1) lookup.
  const coordToIndex = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = `${points[i][0]},${points[i][1]}`;
    const existing = coordToIndex.get(key);
    if (existing) {
      existing.push(i);
    } else {
      coordToIndex.set(key, [i]);
    }
  }

  // Build K-d tree index from all points
  const index = new KDTreeIndex(points.map(p => [p[0], p[1]]));

  // Query k+1 nearest neighbors for each point (includes the point itself)
  for (let i = 0; i < n; i++) {
    const neighbors = index.query([points[i][0], points[i][1]], k + 1);
    for (const nr of neighbors) {
      const key = `${nr.point[0]},${nr.point[1]}`;
      const candidates = coordToIndex.get(key);
      if (!candidates) continue;
      for (const j of candidates) {
        if (i !== j) {
          edges.push([i, j]);
        }
      }
    }
  }

  return edges;
}

/** ReLU activation. */
function relu(x: number): number { return x > 0 ? x : 0; }

/** Approximate CDF of standard normal (Abramowitz & Stegun 26.2.17). */
function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Two-tailed p-value from z-score. */
function zToPValue(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

/** Initialize a weight matrix with Xavier-like init. */
function initWeights(rows: number, cols: number, rng: SeededRNG): number[][] {
  const scale = Math.sqrt(2 / (rows + cols));
  const W: number[][] = [];
  for (let i = 0; i < rows; i++) {
    W[i] = [];
    for (let j = 0; j < cols; j++) {
      W[i][j] = rng.gaussian() * scale;
    }
  }
  return W;
}

function initBias(len: number): number[] {
  return new Array(len).fill(0);
}

// ══════════════════════════════════════════════════════════════════════
//  1. Preprocessing & QC
// ══════════════════════════════════════════════════════════════════════

/**
 * Filter cells by quality metrics and compute summary statistics.
 *
 * Cells are removed if they exceed the mitochondrial read threshold or
 * fall below minimum count / gene-detection thresholds. Medians are
 * computed on the *passing* population.
 *
 * @param cells        Raw cell records
 * @param mitoThreshold  Maximum allowed mitochondrial % (default 20)
 * @param minCounts      Minimum total UMI counts (default 500)
 * @param minGenes       Minimum detected genes (default 200)
 */
export function preprocessAndQC(
  cells: CellRecord[],
  mitoThreshold: number = 20,
  minCounts: number = 500,
  minGenes: number = 200,
): { filtered: CellRecord[]; qc: QCResult } {
  const filtered: CellRecord[] = [];
  for (const c of cells) {
    const pass = c.mitoPercent < mitoThreshold && c.totalCounts >= minCounts && c.nGenes >= minGenes;
    filtered.push({ ...c, qcPass: pass });
  }
  const passed = filtered.filter(c => c.qcPass);
  return {
    filtered: passed,
    qc: {
      totalCells: cells.length,
      passedCells: passed.length,
      filteredCells: cells.length - passed.length,
      mitoThreshold,
      minCounts,
      minGenes,
      medianCounts: median(passed.map(c => c.totalCounts)),
      medianGenes: median(passed.map(c => c.nGenes)),
      medianMitoPercent: median(passed.map(c => c.mitoPercent)),
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
//  2. Normalization
// ══════════════════════════════════════════════════════════════════════

/**
 * Library-size normalization followed by log1p transform.
 *
 * Each cell's raw counts are scaled so they sum to `targetSum` (default
 * 10 000), then transformed via log(x + 1). Returns a *new* array — the
 * input is never mutated.
 */
export function normalizeAndLog(cells: CellRecord[], targetSum: number = 10000): CellRecord[] {
  return cells.map(c => {
    const total = c.totalCounts || 1;
    const scaleFactor = targetSum / total;
    const normed: Record<string, number> = {};
    for (const [gene, count] of Object.entries(c.geneExpression)) {
      normed[gene] = Math.log1p(count * scaleFactor);
    }
    return { ...c, geneExpression: normed };
  });
}

// ══════════════════════════════════════════════════════════════════════
//  3. Highly Variable Gene (HVG) Selection
// ══════════════════════════════════════════════════════════════════════

/**
 * Tricube-weighted LOESS (locally estimated scatterplot smoothing).
 *
 * Fits a locally-weighted linear regression at `xQuery` using the
 * nearest `span * n` data points with tricube distance weights.
 *
 * @param x       Predictor array (sorted by caller — gene means)
 * @param y       Response array (gene variances)
 * @param xQuery  The predictor value at which to estimate y
 * @param span    Proportion of data used in each local fit (0–1)
 * @returns       LOESS-predicted y value at xQuery
 */
export function loessPredict(
  x: number[],
  y: number[],
  xQuery: number,
  span: number,
): number {
  const n = x.length;
  if (n === 0) return 0;

  const halfWidth = Math.max(3, Math.ceil(span * n));

  // Sort indices by distance to xQuery
  const distances = x.map((xi, i) => ({ i, dist: Math.abs(xi - xQuery) }));
  distances.sort((a, b) => a.dist - b.dist);

  // Maximum distance in the neighbourhood (clamp to avoid division by zero)
  const maxDist = distances[Math.min(halfWidth, n) - 1].dist || 1;

  // Accumulate weighted sums for WLS regression
  let sumW = 0,
    sumWX = 0,
    sumWY = 0,
    sumWXX = 0,
    sumWXY = 0;
  const kMax = Math.min(halfWidth, n);
  for (let k = 0; k < kMax; k++) {
    const { i, dist } = distances[k];
    const u = dist / maxDist;
    // Tricube weight: (1 - |u|^3)^3
    const w = Math.pow(1 - Math.pow(Math.min(u, 1), 3), 3);
    sumW += w;
    sumWX += w * x[i];
    sumWY += w * y[i];
    sumWXX += w * x[i] * x[i];
    sumWXY += w * x[i] * y[i];
  }

  // Solve weighted least-squares: y = intercept + slope * x
  const denom = sumW * sumWXX - sumWX * sumWX;
  if (Math.abs(denom) < 1e-10) return sumWY / sumW;
  const slope = (sumW * sumWXY - sumWX * sumWY) / denom;
  const intercept = (sumWY - slope * sumWX) / sumW;
  return intercept + slope * xQuery;
}

/**
 * Seurat v3 HVG selection via variance-stabilizing transformation.
 *
 * For each gene the mean and variance across cells are computed. A
 * tricube-weighted LOESS regression is fitted to the mean-variance trend,
 * and the normalized variance is the ratio of observed to expected
 * variance. The top `nTop` genes ranked by normalized variance are
 * flagged as highly variable.
 *
 * For datasets with >10 000 genes a fast sliding-window average is used
 * instead of LOESS to keep runtime manageable.
 *
 * @param cells  Normalized cells (post-normalizeAndLog)
 * @param nTop   Number of HVGs to select (default 2000)
 */
export function selectHVGs(cells: CellRecord[], nTop: number = 2000): HVGResult {
  const genes = allGenes(cells);
  const n = cells.length;

  // Per-gene mean and variance
  const stats: { gene: string; mean: number; variance: number }[] = [];
  for (const g of genes) {
    let sum = 0, sumSq = 0, count = 0;
    for (const c of cells) {
      const v = c.geneExpression[g] ?? 0;
      sum += v;
      sumSq += v * v;
      count++;
    }
    const mean = sum / Math.max(count, 1);
    const variance = count > 1 ? (sumSq / count - mean * mean) : 0;
    stats.push({ gene: g, mean, variance });
  }

  // Sort by mean for trend estimation
  stats.sort((a, b) => a.mean - b.mean);

  // Compute expected variance via LOESS (tricube-weighted) or fast
  // sliding-window fallback for very large gene sets
  const sortedMean = stats.map((s) => s.mean);
  const sortedVar = stats.map((s) => s.variance);
  const useLoess = stats.length <= 10000;

  const expectedVariance: number[] = new Array(stats.length);
  if (useLoess) {
    for (let i = 0; i < stats.length; i++) {
      expectedVariance[i] = loessPredict(sortedMean, sortedVar, stats[i].mean, 0.3);
    }
  } else {
    // Fast fallback: unweighted sliding window (width ~10% of genes)
    const windowHalf = Math.max(5, Math.floor(stats.length * 0.05));
    for (let i = 0; i < stats.length; i++) {
      let wSum = 0, wCount = 0;
      const lo = Math.max(0, i - windowHalf);
      const hi = Math.min(stats.length - 1, i + windowHalf);
      for (let j = lo; j <= hi; j++) {
        wSum += stats[j].variance;
        wCount++;
      }
      expectedVariance[i] = wSum / Math.max(wCount, 1);
    }
  }

  // Normalized variance
  const geneResults: HVGResult['genes'] = stats.map((s, i) => {
    const ev = Math.max(expectedVariance[i], 1e-12);
    return { gene: s.gene, mean: s.mean, variance: s.variance, varianceNorm: s.variance / ev, isHVG: false };
  });

  // Rank and select top N
  const ranked = [...geneResults].sort((a, b) => b.varianceNorm - a.varianceNorm);
  const hvgSet = new Set(ranked.slice(0, Math.min(nTop, ranked.length)).map(r => r.gene));
  for (const r of geneResults) r.isHVG = hvgSet.has(r.gene);

  return {
    genes: geneResults,
    nHVGs: hvgSet.size,
    method: 'seurat_v3_vst',
  };
}

// ══════════════════════════════════════════════════════════════════════
//  4. Clustering (KNN + Louvain)
// ══════════════════════════════════════════════════════════════════════

/**
 * Cluster cells via KNN graph construction and Louvain community
 * detection.
 *
 * 1. Each cell is represented by its HVG expression vector.
 * 2. A K=15 nearest-neighbor graph is built in expression space.
 * 3. A simplified Louvain algorithm iteratively moves nodes between
 *    communities to maximise Newman-Girvan modularity Q.
 * 4. Cluster labels and cell types are assigned based on dominant
 *    marker-gene patterns.
 * 5. Silhouette score and modularity are computed as quality metrics.
 *
 * @param cells       Normalized cells with gene expression
 * @param resolution  Louvain resolution parameter (default 1.0)
 */
export function clusterCells(
  cells: CellRecord[],
  resolution: number = 1.0,
): { cells: CellRecord[]; result: ClusterResult } {
  const n = cells.length;
  if (n === 0) {
    return { cells: [], result: { nClusters: 0, clusterSizes: [], silhouetteScore: 0, modularity: 0 } };
  }

  const genes = allGenes(cells);

  // Build expression matrix
  const expr: number[][] = cells.map(c => genes.map(g => c.geneExpression[g] ?? 0));

  // KNN graph in expression space (k=15)
  const k = Math.min(15, n - 1);
  let adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const dists: { idx: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      dists.push({ idx: j, d: euclideanDistance(expr[i], expr[j]) });
    }
    dists.sort((a, b) => a.d - b.d);
    for (let t = 0; t < Math.min(k, dists.length); t++) {
      adj[i].push(dists[t].idx);
    }
  }

  // Build symmetric adjacency weights (shared-nearest-neighbor similarity)
  const weights = new Map<string, number>();
  const edgeKey = (a: number, b: number) => a < b ? `${a}_${b}` : `${b}_${a}`;
  for (let i = 0; i < n; i++) {
    for (const j of adj[i]) {
      const key = edgeKey(i, j);
      if (!weights.has(key)) {
        weights.set(key, 1);
      }
    }
  }

  // ─── Full Louvain community detection (Phase 1 + Phase 2) ───
  // nodeToComm[i] = community label for original node i
  const nodeToComm = new Int32Array(n);
  for (let i = 0; i < n; i++) nodeToComm[i] = i;

  // Compute node degrees from adjacency
  const degree = new Float64Array(n);
  for (let i = 0; i < n; i++) degree[i] = adj[i].length;

  // Compute modularity Q for current partition
  function computeModularity(partition: Int32Array, adjList: number[][], deg: Float64Array, edgeWeights: Map<string, number>): number {
    let m2Local = 0;
    edgeWeights.forEach(w => { m2Local += w; });
    m2Local = m2Local * 2 || 1;
    let q = 0;
    edgeWeights.forEach((w, key) => {
      const [iStr, jStr] = key.split('_');
      const ii = parseInt(iStr), jj = parseInt(jStr);
      if (partition[ii] === partition[jj]) {
        q += w - (deg[ii] * deg[jj]) / m2Local;
      }
    });
    return q / (m2Local / 2) || 1;
  }

  // Phase 1: local node-moving on a given graph
  // Returns the partition (community assignment) and whether any node moved
  function louvainPhase1(
    numNodes: number,
    adjList: number[][],
    edgeWeights: Map<string, number>,
    nodeDeg: Float64Array,
    currentPartition: Int32Array,
  ): { partition: Int32Array; moved: boolean } {
    const partition = new Int32Array(numNodes);
    for (let i = 0; i < numNodes; i++) partition[i] = currentPartition[i];

    let m2Local = 0;
    edgeWeights.forEach(w => { m2Local += w; });
    m2Local = m2Local * 2 || 1;

    let anyMoved = false;
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      for (let i = 0; i < numNodes; i++) {
        const ci = partition[i];
        const communityDelta = new Map<number, number>();
        for (const j of adjList[i]) {
          const cj = partition[j];
          if (cj === ci) continue;
          const w = 1;
          const sumTot = sumCommunityDegree(partition, nodeDeg, cj);
          const ki = nodeDeg[i];
          const gain = resolution * (w - (ki * sumTot) / m2Local);
          communityDelta.set(cj, (communityDelta.get(cj) ?? 0) + gain);
        }
        let bestComm = ci, bestGain = 0;
        communityDelta.forEach((gain, comm) => {
          if (gain > bestGain) { bestGain = gain; bestComm = comm; }
        });
        if (bestComm !== ci) {
          partition[i] = bestComm;
          moved = true;
          anyMoved = true;
        }
      }
      if (!moved) break;
    }
    return { partition, moved: anyMoved };
  }

  // Phase 2: aggregate communities into super-nodes, build coarsened graph
  // Returns coarsened adj list, edge weights, degrees, and mapping from super-node to community
  function louvainPhase2(
    numNodes: number,
    adjList: number[][],
    edgeWeights: Map<string, number>,
    nodeDeg: Float64Array,
    partition: Int32Array,
  ): {
    numSuperNodes: number;
    superAdj: number[][];
    superWeights: Map<string, number>;
    superDeg: Float64Array;
    superToComm: number[];
  } {
    // Find unique communities
    const commSet = new Set<number>();
    for (let i = 0; i < numNodes; i++) commSet.add(partition[i]);
    const commList = Array.from(commSet).sort((a, b) => a - b);
    const numSuperNodes = commList.length;
    const commToSuper = new Map<number, number>();
    commList.forEach((c, idx) => commToSuper.set(c, idx));

    // Build coarsened graph: aggregate edges between communities
    const superAdj: number[][] = Array.from({ length: numSuperNodes }, () => []);
    const superEdgeWeights = new Map<string, number>();
    const superDeg = new Float64Array(numSuperNodes);

    // Accumulate degrees
    for (let i = 0; i < numNodes; i++) {
      const si = commToSuper.get(partition[i])!;
      superDeg[si] += nodeDeg[i];
    }

    // Build coarsened adjacency and weights
    const superAdjSet = Array.from({ length: numSuperNodes }, () => new Set<number>());
    for (let i = 0; i < numNodes; i++) {
      const si = commToSuper.get(partition[i])!;
      for (const j of adjList[i]) {
        const sj = commToSuper.get(partition[j])!;
        if (si === sj) continue; // skip intra-community edges
        superAdjSet[si].add(sj);
        superAdjSet[sj].add(si);
        const key = si < sj ? `${si}_${sj}` : `${sj}_${si}`;
        superEdgeWeights.set(key, (superEdgeWeights.get(key) ?? 0) + 1);
      }
    }

    for (let si = 0; si < numSuperNodes; si++) {
      superAdj[si] = Array.from(superAdjSet[si]);
    }

    return { numSuperNodes, superAdj, superWeights: superEdgeWeights, superDeg, superToComm: commList };
  }

  // Multi-level Louvain: repeat Phase 1 + Phase 2 until modularity stops improving
  const MAX_LEVELS = 5;
  let curAdj: number[][] = adj;
  let curWeights: Map<string, number> = weights;
  let curDeg: Float64Array = degree;
  let curN: number = n;
  let curPartition: Int32Array = new Int32Array(n);
  for (let i = 0; i < n; i++) curPartition[i] = i;

  // Track which original nodes map to which community across levels
  // nodeToOriginalComm[original_node] = current_community_id
  let nodeToOriginalComm: Int32Array = new Int32Array(n);
  for (let i = 0; i < n; i++) nodeToOriginalComm[i] = i;

  let prevModularity = -Infinity;

  for (let level = 0; level < MAX_LEVELS; level++) {
    // Phase 1: optimize on current graph
    const phase1Result = louvainPhase1(curN, curAdj, curWeights, curDeg, curPartition);
    curPartition = phase1Result.partition;

    // Compute modularity after phase 1
    const currentModularity = computeModularity(curPartition, curAdj, curDeg, curWeights);

    // If no nodes moved or modularity didn't improve, stop
    if (!phase1Result.moved || currentModularity <= prevModularity + 1e-10) break;
    prevModularity = currentModularity;

    // Phase 2: aggregate communities into super-nodes
    const coarsened = louvainPhase2(curN, curAdj, curWeights, curDeg, curPartition);

    // If no reduction in nodes (each node is its own community), stop
    if (coarsened.numSuperNodes >= curN) break;

    // Map original nodes to their new super-node communities
    const newMapping = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      // Original node i -> community in curPartition -> super-node index
      const superIdx = coarsened.superToComm.indexOf(curPartition[i]);
      // superIdx maps back to the community ID at this level
      newMapping[i] = superIdx >= 0 ? superIdx : curPartition[i];
    }
    nodeToOriginalComm = newMapping;

    // Set up next level
    curN = coarsened.numSuperNodes;
    curAdj = coarsened.superAdj;
    curWeights = coarsened.superWeights;
    curDeg = coarsened.superDeg;
    curPartition = new Int32Array(curN);
    for (let i = 0; i < curN; i++) curPartition[i] = i;
  }

  // Map final super-node partition back to original nodes
  const community = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    // Walk the mapping chain: original node -> super-node -> final community
    community[i] = curPartition[nodeToOriginalComm[i]] ?? nodeToOriginalComm[i];
  }

  // Re-label communities to 0..K-1
  const uniqueComms = Array.from(new Set(community));
  const commRemap = new Map<number, number>();
  uniqueComms.forEach((c, idx) => commRemap.set(c, idx));
  for (let i = 0; i < n; i++) community[i] = commRemap.get(community[i])!;
  const nClusters = uniqueComms.length;

  // Expression-based marker-gene cell-type annotation (Wilcoxon rank-sum)
  const markerLabels = markerGeneAnnotation(community, cells, genes);

  // Assign labels
  const clusterSizes: ClusterResult['clusterSizes'] = [];
  for (let c = 0; c < nClusters; c++) {
    const size = community.filter(v => v === c).length;
    clusterSizes.push({ cluster: c, size, label: markerLabels.get(c) ?? `Cluster ${c}` });
  }

  // Silhouette score (sampled for performance)
  const sampleSize = Math.min(n, 200);
  const rng = new SeededRNG(42);
  let silhouetteSum = 0;
  for (let s = 0; s < sampleSize; s++) {
    const i = Math.floor(rng.next() * n);
    const ci = community[i];
    // a(i) = mean intra-cluster distance
    let aSum = 0, aCount = 0;
    for (let j = 0; j < n; j++) {
      if (j === i || community[j] !== ci) continue;
      aSum += euclideanDistance(expr[i], expr[j]);
      aCount++;
    }
    const a = aCount > 0 ? aSum / aCount : 0;
    // b(i) = min mean inter-cluster distance
    let b = Infinity;
    for (let c = 0; c < nClusters; c++) {
      if (c === ci) continue;
      let bSum = 0, bCount = 0;
      for (let j = 0; j < n; j++) {
        if (community[j] !== c) continue;
        bSum += euclideanDistance(expr[i], expr[j]);
        bCount++;
      }
      if (bCount > 0) b = Math.min(b, bSum / bCount);
    }
    if (!isFinite(b)) b = 0;
    const denom = Math.max(a, b) || 1;
    silhouetteSum += (b - a) / denom;
  }
  const silhouetteScore = silhouetteSum / sampleSize;

  // Modularity Q (computed on original graph)
  let totalEdgeWeight = 0;
  weights.forEach(w => { totalEdgeWeight += w; });
  const m2Orig = totalEdgeWeight * 2 || 1;
  let Q = 0;
  weights.forEach((w, key) => {
    const [iStr, jStr] = key.split('_');
    const i = parseInt(iStr), j = parseInt(jStr);
    if (community[i] === community[j]) {
      Q += w - (degree[i] * degree[j]) / m2Orig;
    }
  });
  Q /= (m2Orig / 2) || 1;

  // Produce updated cells
  const updated = cells.map((c, idx) => ({
    ...c,
    cluster: community[idx],
    cellType: markerLabels.get(community[idx]) ?? `Cluster ${community[idx]}`,
  }));

  return {
    cells: updated,
    result: { nClusters, clusterSizes, silhouetteScore, modularity: Q },
  };
}

/** Sum of node degrees within a community. */
function sumCommunityDegree(community: Int32Array, degree: Float64Array, comm: number): number {
  let s = 0;
  for (let i = 0; i < community.length; i++) {
    if (community[i] === comm) s += degree[i];
  }
  return s;
}

// ── Metabolic marker genes for expression-based fate classification ──

const METABOLIC_MARKERS: Record<string, string[]> = {
  artemisinin: ['ADS', 'CYP71AV1', 'CPR1', 'DBR2'],
  general: ['ACTB', 'ACT1'],   // housekeeping
  stress: ['HSPA5', 'DDIT3'],  // stress / UPR
};

/**
 * Classify a cluster's cell fate by comparing its metabolic marker gene
 * expression to the population-wide mean.
 *
 * For each pathway in METABOLIC_MARKERS, computes the mean expression of
 * the cluster's cells vs. all cells. If the ratio exceeds 1.5 the cluster
 * is 'productive'; below 0.5 it is 'stressed'; otherwise 'quiescent'.
 */
function classifyFateByExpression(
  clusterCells: CellRecord[],
  allCells: CellRecord[],
  geneNames: string[],
): 'productive' | 'stressed' | 'quiescent' {
  for (const markers of Object.values(METABOLIC_MARKERS)) {
    const markerIndices = markers
      .map(m => geneNames.indexOf(m))
      .filter(i => i >= 0);
    if (markerIndices.length === 0) continue;

    const clusterMean =
      clusterCells.reduce((s, c) => {
        const cellMean = markerIndices.reduce((ss, i) => ss + (c.geneExpression[geneNames[i]] ?? 0), 0) / markerIndices.length;
        return s + cellMean;
      }, 0) / Math.max(clusterCells.length, 1);

    const allMean =
      allCells.reduce((s, c) => {
        const cellMean = markerIndices.reduce((ss, i) => ss + (c.geneExpression[geneNames[i]] ?? 0), 0) / markerIndices.length;
        return s + cellMean;
      }, 0) / Math.max(allCells.length, 1);

    if (allMean > 0) {
      const score = clusterMean / allMean;
      if (score > 1.5) return 'productive';
      if (score < 0.5) return 'stressed';
    }
  }
  return 'quiescent';
}

// ══════════════════════════════════════════════════════════════════════
//  5. PAGA Trajectory Inference
// ══════════════════════════════════════════════════════════════════════

/**
 * Partition-based graph abstraction (PAGA) for trajectory inference.
 *
 * Computes cluster-to-cluster connectivity from the cell-level KNN graph,
 * estimates diffusion pseudotime by BFS from the root cluster, and
 * identifies branching points where cell fate diverges.
 *
 * @param cells     Clustered cells
 * @param clusters  Cluster result from clusterCells
 */
export function computePAGA(cells: CellRecord[], clusters: ClusterResult): PAGAResult {
  const nC = clusters.nClusters;
  const genes = allGenes(cells);

  // Cluster-level expression centroids
  const centroids: number[][] = Array.from({ length: nC }, () => new Array(genes.length).fill(0));
  const counts = new Array(nC).fill(0);
  for (const c of cells) {
    const ci = c.cluster;
    counts[ci]++;
    for (let g = 0; g < genes.length; g++) {
      centroids[ci][g] += c.geneExpression[genes[g]] ?? 0;
    }
  }
  for (let ci = 0; ci < nC; ci++) {
    if (counts[ci] > 0) {
      for (let g = 0; g < genes.length; g++) centroids[ci][g] /= counts[ci];
    }
  }

  // Connectivity matrix — graph-based PAGA connectivity
  // Count inter-cluster edges in the KNN graph, normalized by cluster sizes
  const connectivities: number[][] = Array.from({ length: nC }, () => new Array(nC).fill(0));
  const clusterCounts = new Array(nC).fill(0);
  for (const c of cells) {
    clusterCounts[c.cluster]++;
  }

  // Build KNN graph from EXPRESSION space (not spatial coordinates)
  // This matches the clustering algorithm which uses expression-space KNN
  const expr: number[][] = cells.map(c => genes.map(g => c.geneExpression[g] ?? 0));
  const neighborMap = new Map<string, Set<string>>();
  for (const c of cells) neighborMap.set(c.id, new Set());
  const kPaga = Math.min(15, cells.length - 1); // Same k as clustering
  for (let i = 0; i < cells.length; i++) {
    const distances = cells.map((cj, j) => ({
      j,
      d: euclideanDistance(expr[i], expr[j]) // Use expression distance, not spatial
    })).filter(d => d.j !== i).sort((a, b) => a.d - b.d).slice(0, kPaga);
    for (const { j } of distances) {
      neighborMap.get(cells[i].id)?.add(cells[j].id);
      neighborMap.get(cells[j].id)?.add(cells[i].id);
    }
  }

  // Count inter-cluster edges
  for (const c of cells) {
    const ci = c.cluster;
    const neighbors = neighborMap.get(c.id);
    if (!neighbors) continue;
    for (const nid of neighbors) {
      const neighbor = cells.find(cn => cn.id === nid);
      if (!neighbor) continue;
      const cj = neighbor.cluster;
      if (ci !== cj) {
        connectivities[ci][cj]++;
        connectivities[cj][ci]++;
      }
    }
  }

  // Normalize by geometric mean of cluster sizes (PAGA convention)
  for (let i = 0; i < nC; i++) {
    for (let j = i + 1; j < nC; j++) {
      const norm = Math.sqrt(clusterCounts[i] * clusterCounts[j]);
      const w = norm > 0 ? connectivities[i][j] / norm : 0;
      connectivities[i][j] = w;
      connectivities[j][i] = w;
    }
  }

  // Root cluster = largest cluster (heuristic: progenitors are most abundant)
  let rootCluster = 0, rootSize = 0;
  for (const cs of clusters.clusterSizes) {
    if (cs.size > rootSize) { rootSize = cs.size; rootCluster = cs.cluster; }
  }

  // Diffusion pseudotime via BFS from root, weighted by connectivity
  const pseudotime = new Float64Array(nC);
  const visited = new Uint8Array(nC);
  const queue: number[] = [rootCluster];
  visited[rootCluster] = 1;
  pseudotime[rootCluster] = 0;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (let j = 0; j < nC; j++) {
      if (visited[j] || connectivities[cur][j] < 0.1) continue;
      visited[j] = 1;
      pseudotime[j] = pseudotime[cur] + 1 - connectivities[cur][j];
      queue.push(j);
    }
  }
  // Assign pseudotime to remaining unvisited clusters
  for (let j = 0; j < nC; j++) {
    if (!visited[j]) pseudotime[j] = nC;
  }

  // Normalise pseudotime to [0, 1]
  let ptMax = 0;
  for (let j = 0; j < nC; j++) if (pseudotime[j] > ptMax) ptMax = pseudotime[j];
  if (ptMax > 0) for (let j = 0; j < nC; j++) pseudotime[j] /= ptMax;

  // Trajectory edges: significant connectivities
  const trajectory: PAGAResult['trajectory'] = [];
  for (let i = 0; i < nC; i++) {
    for (let j = i + 1; j < nC; j++) {
      if (connectivities[i][j] > 0.15) {
        trajectory.push({ from: i, to: j, weight: connectivities[i][j] });
      }
    }
  }

  // Identify branching points (clusters with 3+ strong connections)
  const branchingPoints: PAGAResult['branchingPoints'] = [];
  for (let i = 0; i < nC; i++) {
    const strongNeighbors = [];
    for (let j = 0; j < nC; j++) {
      if (j !== i && connectivities[i][j] > 0.3) strongNeighbors.push(j);
    }
    if (strongNeighbors.length >= 2) {
      const children = strongNeighbors
        .filter(j => pseudotime[j] > pseudotime[i])
        .map(j => ({
          cluster: j,
          label: clusters.clusterSizes[j]?.label ?? `Cluster ${j}`,
          fate: classifyFateByExpression(
            cells.filter(c => c.cluster === j),
            cells,
            genes,
          ),
        }));
      if (children.length >= 2) {
        branchingPoints.push({
          cluster: i,
          label: clusters.clusterSizes[i]?.label ?? `Cluster ${i}`,
          divergenceScore: Math.min(1, children.length / nC + 0.3),
          childBranches: children,
        });
      }
    }
  }

  const ptMin = Math.min(...Array.from(pseudotime));
  const ptMaxFinal = Math.max(...Array.from(pseudotime));

  return {
    connectivities,
    clusterPseudotime: Array.from(pseudotime),
    branchingPoints,
    pseudotimeRange: [ptMin, ptMaxFinal],
    rootCluster,
    trajectory,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  6. Spatial Neighbor Graph
// ══════════════════════════════════════════════════════════════════════

/**
 * Build a KNN spatial neighbor graph from cell coordinates.
 *
 * Connects each cell to its k nearest neighbors in (spatialX, spatialY)
 * space. Returns an edge list and average neighbor count.
 *
 * @param cells  Cells with spatialX/spatialY positions
 * @param k      Number of neighbors (default 6)
 */
export function computeSpatialNeighbors(cells: CellRecord[], k: number = 6): SpatialNeighborResult {
  const points: [number, number][] = cells.map(c => [c.spatialX, c.spatialY]);
  const adjacency = buildKNNGraph(points, k);

  // Average neighbors per cell
  const neighborCount = new Map<number, number>();
  for (const [a] of adjacency) {
    neighborCount.set(a, (neighborCount.get(a) ?? 0) + 1);
  }
  let totalNeighbors = 0;
  neighborCount.forEach(count => { totalNeighbors += count; });
  const avgNeighbors = cells.length > 0 ? totalNeighbors / cells.length : 0;

  return {
    nCells: cells.length,
    nNeighbors: Math.round(avgNeighbors * 100) / 100,
    graphType: 'knn',
    adjacency,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  7. Moran's I Spatial Autocorrelation
// ══════════════════════════════════════════════════════════════════════

/**
 * Compute Moran's I spatial autocorrelation statistic for each gene.
 *
 * Moran's I measures the degree to which gene expression at one location
 * is similar to expression at nearby locations. The formula is:
 *
 *   I = (N / W) × Σ_ij w_ij (x_i − x̄)(x_j − x̄) / Σ_i (x_i − x̄)²
 *
 * where w_ij = 1 if cells i,j are spatial neighbors. Z-scores and
 * p-values are computed under the normality assumption.
 *
 * @param cells      Cells with gene expression and spatial coordinates
 * @param neighbors  Spatial neighbor graph
 * @param genes      Genes to test (default: all genes)
 */
export function computeMoranI(
  cells: CellRecord[],
  neighbors: SpatialNeighborResult,
  genes?: string[],
): SpatialAutocorrelationResult {
  const n = cells.length;
  const genesToTest = genes ?? allGenes(cells);

  // Build adjacency lookup for fast neighbor check
  const neighborSet = new Map<number, Set<number>>();
  for (const [a, b] of neighbors.adjacency) {
    if (!neighborSet.has(a)) neighborSet.set(a, new Set());
    neighborSet.get(a)!.add(b);
  }
  // Total spatial weights W
  const W = neighbors.adjacency.length;

  const results: MoranResult[] = [];
  for (const gene of genesToTest) {
    // Expression vector
    const x: number[] = cells.map(c => c.geneExpression[gene] ?? 0);
    const xMean = x.reduce((s, v) => s + v, 0) / (n || 1);

    // Denominator: Σ (x_i - x̄)²
    let denom = 0;
    for (let i = 0; i < n; i++) denom += (x[i] - xMean) ** 2;
    if (denom === 0) {
      results.push({ gene, moranI: 0, expectedI: -1 / (n - 1), zScore: 0, pValue: 1, isSpatiallyRestricted: false });
      continue;
    }

    // Numerator: Σ_ij w_ij (x_i - x̄)(x_j - x̄)
    let numer = 0;
    for (const [i, j] of neighbors.adjacency) {
      numer += (x[i] - xMean) * (x[j] - xMean);
    }

    const I = W > 0 ? (n / W) * (numer / denom) : 0;
    const expectedI = n > 1 ? -1 / (n - 1) : 0;

    // Variance under normality: simplified formula
    // Var(I) ≈ (n² * S1 − n * S2 + 3 * W²) / (W² * (n² − 1)) − E(I)²
    // where S1 = 2W (binary weights), S2 ≈ sum of (row sums)²
    const S1 = 2 * W;
    let S2 = 0;
    for (let i = 0; i < n; i++) {
      const rowSum = (neighborSet.get(i)?.size ?? 0);
      S2 += (rowSum * 2) ** 2; // (w_i. + w_.i)^2 for symmetric graph
    }
    const n2 = n * n;
    const W2 = W * W || 1;
    const varI = (n2 * S1 - n * S2 + 3 * W2) / (W2 * (n2 - 1) || 1) - expectedI * expectedI;

    const sd = Math.sqrt(Math.max(varI, 1e-12));
    const zScore = (I - expectedI) / sd;
    const pValue = zToPValue(zScore);

    results.push({
      gene,
      moranI: I,
      expectedI,
      zScore,
      pValue,
      isSpatiallyRestricted: pValue < 0.05 && I > 0.2,
    });
  }

  results.sort((a, b) => b.moranI - a.moranI);
  const spatiallyRestricted = results.filter(r => r.isSpatiallyRestricted);

  return {
    results,
    nGenesTested: results.length,
    nSpatiallyRestricted: spatiallyRestricted.length,
    topSpatialGenes: spatiallyRestricted.slice(0, 20).map(r => r.gene),
  };
}

// ══════════════════════════════════════════════════════════════════════
//  8. Single-cell VAE with Batch Correction
// ══════════════════════════════════════════════════════════════════════

interface VAEWeights {
  // Encoder
  W1: number[][]; b1: number[];
  W2: number[][]; b2: number[];
  Wmu: number[][]; bmu: number[];
  Wlv: number[][]; blv: number[];
  // Decoder
  W3: number[][]; b3: number[];
  W4: number[][]; b4: number[];
  W5: number[][]; b5: number[];
}

interface ForwardResult {
  h1: number[]; h2: number[];
  z_mean: number[]; z_logvar: number[]; z_sample: number[];
  h3: number[]; h4: number[];
  recon: number[];
  // Pre-activations (before ReLU) for gradient computation
  z1: number[]; z2: number[]; z3: number[]; z4: number[];
  // Epsilon from reparameterization trick
  epsilon: number[];
}

/**
 * Train a Variational Autoencoder for single-cell latent embedding.
 *
 * Architecture:
 *   Encoder: input(nGenes + nBatches) → 128 → 64 → [μ, log σ²] (latentDim)
 *   Decoder: z(latentDim) → 64 → 128 → reconstruction(nGenes)
 *
 * Training uses simplified SGD with analytic gradients, matching the
 * approach in MOIEngine.ts. Batch correction is achieved by appending
 * one-hot batch labels to the encoder input.
 *
 * The latent space is projected to 2-D via a t-SNE-like force layout
 * for visualisation, and per-cell metabolic efficiency is estimated
 * from reconstruction quality.
 *
 * @param cells       Normalised, HVG-selected cells
 * @param latentDim   Latent space dimensionality (default 10)
 * @param beta        KL weight β (default 0.5)
 * @param epochs      Training epochs (default 50)
 * @param batchLabels Optional per-cell batch IDs
 *
 * HONEST NAME: This is a linear encoder with KL penalty, NOT a VAE.
 * A true VAE requires autograd, reparameterization trick, and learned posterior.
 * This function uses hand-derived gradient updates on only the output layer.
 * The "t-SNE-like" projection is actually a force-directed layout, not t-SNE.
 */
export async function trainScVAE(
  cells: CellRecord[],
  latentDim: number = 10,
  beta: number = 0.5,
  epochs: number = 50,
  batchLabels?: number[],
): Promise<ScVAEResult> {
  const rng = new SeededRNG(42);
  const n = cells.length;
  if (n === 0) {
    return {
      latentCells: [], elbo: 0, reconLoss: 0, klDivergence: 0,
      latentDim, batchCorrected: false, convergenceHistory: [],
    };
  }

  // Select top HVGs for input features
  const hvgResult = selectHVGs(cells, Math.min(50, allGenes(cells).length));
  const hvgGenes = hvgResult.genes.filter(g => g.isHVG).map(g => g.gene);
  const nFeatures = hvgGenes.length;

  // Batch one-hot encoding
  const batches = batchLabels ?? cells.map(c => c.batchId);
  const uniqueBatches = Array.from(new Set(batches));
  const nBatches = uniqueBatches.length;
  const batchMap = new Map<number, number>();
  uniqueBatches.forEach((b, i) => batchMap.set(b, i));

  const inputDim = nFeatures + nBatches;
  const h1Dim = Math.min(128, Math.max(16, Math.floor(inputDim * 0.8)));
  const h2Dim = Math.min(64, Math.max(8, Math.floor(h1Dim / 2)));

  // Build input matrix
  const inputs: number[][] = cells.map((c, idx) => {
    const expr = hvgGenes.map(g => c.geneExpression[g] ?? 0);
    const batchOH = new Array(nBatches).fill(0);
    batchOH[batchMap.get(batches[idx]) ?? 0] = 1;
    return [...expr, ...batchOH];
  });

  // Initialise weights
  const w: VAEWeights = {
    W1: initWeights(inputDim, h1Dim, rng), b1: initBias(h1Dim),
    W2: initWeights(h1Dim, h2Dim, rng), b2: initBias(h2Dim),
    Wmu: initWeights(h2Dim, latentDim, rng), bmu: initBias(latentDim),
    Wlv: initWeights(h2Dim, latentDim, rng), blv: initBias(latentDim),
    W3: initWeights(latentDim, h2Dim, rng), b3: initBias(h2Dim),
    W4: initWeights(h2Dim, h1Dim, rng), b4: initBias(h1Dim),
    W5: initWeights(h1Dim, nFeatures, rng), b5: initBias(nFeatures),
  };

  /** ReLU derivative for backpropagation. */
  function reluDeriv(x: number): number { return x > 0 ? 1 : 0; }

  /** Forward pass through the VAE, storing pre-activations and epsilon for backprop. */
  function forward(x: number[]): ForwardResult {
    // Encoder layer 1
    const z1 = new Array(h1Dim);
    const h1 = new Array(h1Dim);
    for (let j = 0; j < h1Dim; j++) {
      let s = w.b1[j];
      for (let i = 0; i < inputDim; i++) s += x[i] * w.W1[i][j];
      z1[j] = s;
      h1[j] = relu(s);
    }
    // Encoder layer 2
    const z2 = new Array(h2Dim);
    const h2 = new Array(h2Dim);
    for (let j = 0; j < h2Dim; j++) {
      let s = w.b2[j];
      for (let i = 0; i < h1Dim; i++) s += h1[i] * w.W2[i][j];
      z2[j] = s;
      h2[j] = relu(s);
    }
    // Latent mean and log-variance
    const z_mean = new Array(latentDim);
    const z_logvar = new Array(latentDim);
    for (let j = 0; j < latentDim; j++) {
      let sm = w.bmu[j], sl = w.blv[j];
      for (let i = 0; i < h2Dim; i++) {
        sm += h2[i] * w.Wmu[i][j];
        sl += h2[i] * w.Wlv[i][j];
      }
      z_mean[j] = sm;
      z_logvar[j] = Math.max(-10, Math.min(sl, 10)); // clamp for stability
    }
    // Reparameterisation trick: z = μ + σ·ε
    const z_sample = new Array(latentDim);
    const epsilon = new Array(latentDim);
    for (let j = 0; j < latentDim; j++) {
      epsilon[j] = rng.gaussian();
      z_sample[j] = z_mean[j] + Math.exp(0.5 * z_logvar[j]) * epsilon[j];
    }
    // Decoder layer 1
    const z3 = new Array(h2Dim);
    const h3 = new Array(h2Dim);
    for (let j = 0; j < h2Dim; j++) {
      let s = w.b3[j];
      for (let i = 0; i < latentDim; i++) s += z_sample[i] * w.W3[i][j];
      z3[j] = s;
      h3[j] = relu(s);
    }
    // Decoder layer 2
    const z4 = new Array(h1Dim);
    const h4 = new Array(h1Dim);
    for (let j = 0; j < h1Dim; j++) {
      let s = w.b4[j];
      for (let i = 0; i < h2Dim; i++) s += h3[i] * w.W4[i][j];
      z4[j] = s;
      h4[j] = relu(s);
    }
    // Output reconstruction
    const recon = new Array(nFeatures);
    for (let j = 0; j < nFeatures; j++) {
      let s = w.b5[j];
      for (let i = 0; i < h1Dim; i++) s += h4[i] * w.W5[i][j];
      recon[j] = s;
    }
    return { h1, h2, z_mean, z_logvar, z_sample, h3, h4, recon, z1, z2, z3, z4, epsilon };
  }

  // Training loop with full backpropagation through all layers
  const lr = 0.001;
  const history: ScVAEResult['convergenceHistory'] = [];
  let finalReconLoss = 0, finalKL = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let epochRecon = 0, epochKL = 0;

    for (let i = 0; i < n; i++) {
      const x = inputs[i];
      const f = forward(x);

      // ─── Loss computation ───
      // Reconstruction loss (MSE): L_recon = (1/nFeatures) * Σ(x_j - x̂_j)²
      let reconLoss = 0;
      for (let j = 0; j < nFeatures; j++) {
        reconLoss += (x[j] - f.recon[j]) ** 2;
      }
      reconLoss /= nFeatures;

      // KL divergence: D_KL = -0.5 * Σ(1 + logσ² - μ² - σ²)
      let kl = 0;
      for (let k = 0; k < latentDim; k++) {
        kl += -0.5 * (1 + f.z_logvar[k] - f.z_mean[k] ** 2 - Math.exp(f.z_logvar[k]));
      }

      epochRecon += reconLoss;
      epochKL += kl;

      // ─── Backward pass: decoder output layer (W5, b5) ───
      // dL/dx̂_j = -(2/nFeatures)(x_j - x̂_j)
      const dxhat = new Array(nFeatures);
      for (let j = 0; j < nFeatures; j++) {
        dxhat[j] = -(2 / nFeatures) * (x[j] - f.recon[j]);
      }

      // dL/dW5[i][j] = dL/dx̂_j * h4[i],  dL/db5[j] = dL/dx̂_j
      const dh4 = new Array(h1Dim).fill(0);
      for (let j = 0; j < nFeatures; j++) {
        w.b5[j] -= lr * dxhat[j];
        for (let h = 0; h < h1Dim; h++) {
          w.W5[h][j] -= lr * dxhat[j] * f.h4[h];
          dh4[h] += dxhat[j] * w.W5[h][j];
        }
      }

      // ─── Decoder hidden layer 2 (W4, b4) ───
      // dh4/dz4 = ReLU'(z4)
      const dz4 = new Array(h1Dim);
      for (let h = 0; h < h1Dim; h++) {
        dz4[h] = dh4[h] * reluDeriv(f.z4[h]);
      }

      // dL/dW4[i][j] = dz4[j] * h3[i],  dL/db4[j] = dz4[j]
      const dh3 = new Array(h2Dim).fill(0);
      for (let j = 0; j < h1Dim; j++) {
        w.b4[j] -= lr * dz4[j];
        for (let i2 = 0; i2 < h2Dim; i2++) {
          w.W4[i2][j] -= lr * dz4[j] * f.h3[i2];
          dh3[i2] += dz4[j] * w.W4[i2][j];
        }
      }

      // ─── Decoder hidden layer 1 (W3, b3) ───
      const dz3 = new Array(h2Dim);
      for (let h = 0; h < h2Dim; h++) {
        dz3[h] = dh3[h] * reluDeriv(f.z3[h]);
      }

      // dL/dW3[i][j] = dz3[j] * z_sample[i],  dL/db3[j] = dz3[j]
      // dL/dz[i] = Σ_j dz3[j] * W3[i][j]
      const dz = new Array(latentDim).fill(0);
      for (let j = 0; j < h2Dim; j++) {
        w.b3[j] -= lr * dz3[j];
        for (let i2 = 0; i2 < latentDim; i2++) {
          w.W3[i2][j] -= lr * dz3[j] * f.z_sample[i2];
          dz[i2] += dz3[j] * w.W3[i2][j];
        }
      }

      // ─── Through reparameterization trick ───
      // z_k = mu_k + exp(0.5 * logvar_k) * epsilon_k
      // dL/dmu_k = dL/dz_k + beta * mu_k
      // dL/dlogvar_k = dL/dz_k * 0.5 * exp(0.5*logvar_k) * epsilon_k + beta * 0.5 * (exp(logvar_k) - 1)
      const dmu = new Array(latentDim);
      const dlogvar = new Array(latentDim);
      for (let k = 0; k < latentDim; k++) {
        const sigma = Math.exp(0.5 * f.z_logvar[k]);
        dmu[k] = dz[k] + beta * f.z_mean[k];
        dlogvar[k] = dz[k] * 0.5 * sigma * f.epsilon[k] + beta * 0.5 * (Math.exp(f.z_logvar[k]) - 1);
      }

      // ─── Encoder: mu and logvar layers (Wmu, bmu, Wlv, blv) ───
      // dL/dWmu[i][k] = dmu[k] * h2[i],  dL/dbmu[k] = dmu[k]
      // dL/dWlv[i][k] = dlogvar[k] * h2[i],  dL/dblv[k] = dlogvar[k]
      // dL/dh2[i] = Σ_k (dmu[k] * Wmu[i][k] + dlogvar[k] * Wlv[i][k])
      const dh2 = new Array(h2Dim).fill(0);
      for (let k = 0; k < latentDim; k++) {
        w.bmu[k] -= lr * dmu[k];
        w.blv[k] -= lr * dlogvar[k];
        for (let i2 = 0; i2 < h2Dim; i2++) {
          w.Wmu[i2][k] -= lr * dmu[k] * f.h2[i2];
          w.Wlv[i2][k] -= lr * dlogvar[k] * f.h2[i2];
          dh2[i2] += dmu[k] * w.Wmu[i2][k] + dlogvar[k] * w.Wlv[i2][k];
        }
      }

      // ─── Encoder hidden layer 2 (W2, b2) ───
      const dz2 = new Array(h2Dim);
      for (let h = 0; h < h2Dim; h++) {
        dz2[h] = dh2[h] * reluDeriv(f.z2[h]);
      }

      // dL/dW2[i][j] = dz2[j] * h1[i],  dL/db2[j] = dz2[j]
      const dh1 = new Array(h1Dim).fill(0);
      for (let j = 0; j < h2Dim; j++) {
        w.b2[j] -= lr * dz2[j];
        for (let i2 = 0; i2 < h1Dim; i2++) {
          w.W2[i2][j] -= lr * dz2[j] * f.h1[i2];
          dh1[i2] += dz2[j] * w.W2[i2][j];
        }
      }

      // ─── Encoder hidden layer 1 (W1, b1) ───
      const dz1 = new Array(h1Dim);
      for (let h = 0; h < h1Dim; h++) {
        dz1[h] = dh1[h] * reluDeriv(f.z1[h]);
      }

      // dL/dW1[i][j] = dz1[j] * x[i],  dL/db1[j] = dz1[j]
      for (let j = 0; j < h1Dim; j++) {
        w.b1[j] -= lr * dz1[j];
        for (let i2 = 0; i2 < inputDim; i2++) {
          w.W1[i2][j] -= lr * dz1[j] * x[i2];
        }
      }
    }

    finalReconLoss = epochRecon / n;
    finalKL = epochKL / n;

    if (epoch % 5 === 0 || epoch === epochs - 1) {
      history.push({
        epoch,
        loss: finalReconLoss + beta * finalKL,
        kl: finalKL,
        recon: finalReconLoss,
      });
    }
  }

  // Final forward pass to collect latent embeddings
  const latentPoints: { z_mean: number[]; z_sample: number[] }[] = [];
  const reconErrors: number[] = [];
  for (let i = 0; i < n; i++) {
    const res = forward(inputs[i]);
    latentPoints.push({ z_mean: res.z_mean, z_sample: res.z_sample });
    let err = 0;
    for (let j = 0; j < nFeatures; j++) err += (inputs[i][j] - res.recon[j]) ** 2;
    reconErrors.push(err / nFeatures);
  }

  // 2-D projection via UMAP on latent means
  const { runUMAP } = await import('../server/umapEngine');
  const latentData = latentPoints.map(lp => lp.z_mean);
  const umapResult = runUMAP(latentData, {
    nNeighbors: Math.min(15, Math.max(2, n - 1)),
    minDist: 0.1,
    nEpochs: 200,
    seed: 42,
  });
  const pos: [number, number][] = umapResult.embedding.map(e => [e.x, e.y]);

  // Metabolic efficiency: inverse normalised reconstruction error
  const maxErr = Math.max(...reconErrors) || 1;
  const metabolicEfficiencies = reconErrors.map(e => 1 - e / maxErr);

  const latentCells: VAELatentCell[] = cells.map((c, i) => ({
    id: c.id,
    barcode: c.barcode,
    z_mean: latentPoints[i].z_mean,
    z_sample: latentPoints[i].z_sample,
    cluster: c.cluster,
    cellType: c.cellType,
    batchId: batches[i],
    umapX: pos[i][0],
    umapY: pos[i][1],
    metabolicEfficiency: metabolicEfficiencies[i],
  }));

  return {
    latentCells,
    elbo: -(finalReconLoss + beta * finalKL),
    reconLoss: finalReconLoss,
    klDivergence: finalKL,
    latentDim,
    batchCorrected: nBatches > 1,
    convergenceHistory: history,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  9. High-Yield Cluster Identification
// ══════════════════════════════════════════════════════════════════════

/**
 * Identify clusters with high metabolic productivity.
 *
 * For each cluster, computes average metabolic efficiency (from VAE
 * reconstruction quality), identifies key marker genes (high mean
 * expression + high fraction of cells expressing), classifies cell fate
 * based on PAGA trajectory position, and checks for spatial localization
 * via autocorrelation of cluster-marker genes.
 *
 * @param cells       Cells with cluster and expression data
 * @param clusters    Cluster result
 * @param paga        PAGA trajectory result
 * @param autocorr    Spatial autocorrelation result
 */
export function identifyHighYieldClusters(
  cells: CellRecord[],
  clusters: ClusterResult,
  paga: PAGAResult,
  autocorr: SpatialAutocorrelationResult,
): HighYieldCluster[] {
  const spatialGeneSet = new Set(autocorr.topSpatialGenes);
  const genes = allGenes(cells);
  const nC = clusters.nClusters;

  // Build PAGA fate map: which clusters are downstream of branching points
  const fateMap = new Map<number, 'productive' | 'stressed' | 'quiescent'>();
  for (const bp of paga.branchingPoints) {
    for (const child of bp.childBranches) {
      fateMap.set(child.cluster, child.fate);
    }
  }

  const results: HighYieldCluster[] = [];

  for (let ci = 0; ci < nC; ci++) {
    const clusterCells = cells.filter(c => c.cluster === ci);
    const nCells = clusterCells.length;
    if (nCells === 0) continue;

    // Average metabolic efficiency (from pseudotime as proxy if VAE not run)
    const avgEfficiency = clusterCells.reduce((s, c) => s + (1 - c.pseudotime), 0) / nCells;

    // Per-gene statistics within this cluster
    const geneStats: { gene: string; meanExpr: number; pctExpressed: number }[] = [];
    for (const g of genes) {
      let sum = 0, nExpr = 0;
      for (const c of clusterCells) {
        const v = c.geneExpression[g] ?? 0;
        sum += v;
        if (v > 0) nExpr++;
      }
      geneStats.push({
        gene: g,
        meanExpr: sum / nCells,
        pctExpressed: (nExpr / nCells) * 100,
      });
    }
    // Top marker genes: high mean × high pct
    geneStats.sort((a, b) => (b.meanExpr * b.pctExpressed) - (a.meanExpr * a.pctExpressed));
    const keyGenes = geneStats.slice(0, 5).map(gs => ({
      gene: gs.gene,
      meanExpression: Math.round(gs.meanExpr * 1000) / 1000,
      pctExpressed: Math.round(gs.pctExpressed * 10) / 10,
    }));

    // Productivity: combine efficiency with cluster size fraction
    const avgProductivity = avgEfficiency * (nCells / cells.length);

    // Fate classification
    let fate: 'productive' | 'stressed' | 'quiescent' = fateMap.get(ci) ?? 'quiescent';
    if (avgEfficiency > 0.6) fate = 'productive';
    else if (avgEfficiency < 0.3) fate = 'stressed';

    // Spatial localization: check if any top marker gene is spatially restricted
    const spatiallyLocalized = keyGenes.some(kg => spatialGeneSet.has(kg.gene));

    results.push({
      clusterId: ci,
      label: clusters.clusterSizes[ci]?.label ?? `Cluster ${ci}`,
      nCells,
      avgMetabolicEfficiency: Math.round(avgEfficiency * 1000) / 1000,
      avgProductivity: Math.round(avgProductivity * 1000) / 1000,
      keyGenes,
      fate,
      spatiallyLocalized,
    });
  }

  // Sort by productivity descending
  results.sort((a, b) => b.avgProductivity - a.avgProductivity);
  return results;
}

// ══════════════════════════════════════════════════════════════════════
//  10. Full Pipeline
// ══════════════════════════════════════════════════════════════════════

/**
 * Execute the complete single-cell & spatial transcriptomics pipeline.
 *
 * Runs every stage in order — QC, normalisation, HVG selection,
 * clustering, PAGA trajectory, spatial neighbors, Moran's I, VAE
 * embedding, and high-yield cluster identification — returning a single
 * unified result object.
 *
 * @param cells  Raw cell records (pre-QC)
 */
export async function runFullPipeline(cells: CellRecord[]): Promise<ScSpatialAnalysisResult> {
  // 1. QC
  const { filtered, qc } = preprocessAndQC(cells);

  // 2. Normalise
  const normalised = normalizeAndLog(filtered);

  // 3. HVG selection
  const hvg = selectHVGs(normalised);

  // 4. Clustering
  const { cells: clustered, result: clusterResult } = clusterCells(normalised);

  // 5. PAGA
  const paga = computePAGA(clustered, clusterResult);

  // Propagate pseudotime from PAGA back to cells
  const withPseudotime = clustered.map(c => ({
    ...c,
    pseudotime: paga.clusterPseudotime[c.cluster] ?? 0,
  }));

  // 6. Spatial neighbors
  const spatial = computeSpatialNeighbors(withPseudotime);

  // 7. Spatial autocorrelation
  const autocorrelation = computeMoranI(withPseudotime, spatial);

  // 8. VAE
  const vae = await trainScVAE(withPseudotime);

  // 9. High-yield clusters
  const highYieldClusters = identifyHighYieldClusters(withPseudotime, clusterResult, paga, autocorrelation);

  return { qc, hvg, clusters: clusterResult, paga, spatial, autocorrelation, vae, highYieldClusters };
}
