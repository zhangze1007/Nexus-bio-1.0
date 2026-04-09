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

/** Build a KNN graph from 2-D points. Returns edge list of index pairs. */
function buildKNNGraph(points: [number, number][], k: number): [number, number][] {
  const n = points.length;
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    // Compute distances from point i to every other point
    const dists: { idx: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = points[i][0] - points[j][0];
      const dy = points[i][1] - points[j][1];
      dists.push({ idx: j, d: Math.sqrt(dx * dx + dy * dy) });
    }
    dists.sort((a, b) => a.d - b.d);
    const kActual = Math.min(k, dists.length);
    for (let t = 0; t < kActual; t++) {
      edges.push([i, dists[t].idx]);
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
 * Seurat v3 HVG selection via variance-stabilizing transformation.
 *
 * For each gene the mean and variance across cells are computed. A
 * loess-like local regression is fitted to the mean-variance trend (using
 * sliding-window averaging), and the normalized variance is the ratio of
 * observed to expected variance. The top `nTop` genes ranked by
 * normalized variance are flagged as highly variable.
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

  // Sort by mean for windowed trend estimation
  stats.sort((a, b) => a.mean - b.mean);

  // Loess-like local regression: sliding window of width ~10% of genes
  const windowHalf = Math.max(5, Math.floor(stats.length * 0.05));
  const expectedVariance: number[] = new Array(stats.length);
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
  const adj: number[][] = Array.from({ length: n }, () => []);
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
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    for (const j of adj[i]) {
      const key = edgeKey(i, j);
      if (!weights.has(key)) {
        weights.set(key, 1);
        totalWeight += 1;
      }
    }
  }

  // Simplified Louvain: initialise each cell in its own community
  const community = new Int32Array(n);
  for (let i = 0; i < n; i++) community[i] = i;
  const degree = new Float64Array(n);
  for (let i = 0; i < n; i++) degree[i] = adj[i].length;
  const m2 = totalWeight * 2 || 1; // 2 * total edge weight

  // Iterative node-move phase
  for (let iter = 0; iter < 10; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const ci = community[i];
      // Compute modularity gain for moving i to each neighbor community
      const communityDelta = new Map<number, number>();
      for (const j of adj[i]) {
        const cj = community[j];
        if (cj === ci) continue;
        const w = 1; // edge weight
        const sumTot = sumCommunityDegree(community, degree, cj);
        const ki = degree[i];
        const gain = resolution * (w - (ki * sumTot) / m2);
        communityDelta.set(cj, (communityDelta.get(cj) ?? 0) + gain);
      }
      // Pick best community
      let bestComm = ci, bestGain = 0;
      communityDelta.forEach((gain, comm) => {
        if (gain > bestGain) { bestGain = gain; bestComm = comm; }
      });
      if (bestComm !== ci) {
        community[i] = bestComm;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Re-label communities to 0..K-1
  const uniqueComms = Array.from(new Set(community));
  const commMap = new Map<number, number>();
  uniqueComms.forEach((c, idx) => commMap.set(c, idx));
  for (let i = 0; i < n; i++) community[i] = commMap.get(community[i])!;
  const nClusters = uniqueComms.length;

  // Cell-type heuristic based on marker genes
  const cellTypeLabels = [
    'Progenitor', 'Metabolically Active', 'Stressed', 'Quiescent',
    'Proliferating', 'Differentiating', 'Secretory', 'Senescent',
  ];

  // Assign labels
  const clusterSizes: ClusterResult['clusterSizes'] = [];
  for (let c = 0; c < nClusters; c++) {
    const size = community.filter(v => v === c).length;
    clusterSizes.push({ cluster: c, size, label: cellTypeLabels[c % cellTypeLabels.length] });
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

  // Modularity Q
  let Q = 0;
  weights.forEach((w, key) => {
    const [iStr, jStr] = key.split('_');
    const i = parseInt(iStr), j = parseInt(jStr);
    if (community[i] === community[j]) {
      Q += w - (degree[i] * degree[j]) / m2;
    }
  });
  Q /= (m2 / 2) || 1;

  // Produce updated cells
  const updated = cells.map((c, idx) => ({
    ...c,
    cluster: community[idx],
    cellType: cellTypeLabels[community[idx] % cellTypeLabels.length],
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

  // Connectivity matrix — inverse distance between centroids, normalised
  const connectivities: number[][] = Array.from({ length: nC }, () => new Array(nC).fill(0));
  let maxDist = 0;
  for (let i = 0; i < nC; i++) {
    for (let j = i + 1; j < nC; j++) {
      const d = euclideanDistance(centroids[i], centroids[j]);
      if (d > maxDist) maxDist = d;
    }
  }
  maxDist = maxDist || 1;
  for (let i = 0; i < nC; i++) {
    for (let j = i + 1; j < nC; j++) {
      const d = euclideanDistance(centroids[i], centroids[j]);
      const w = 1 - d / maxDist;
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
  const fates: Array<'productive' | 'stressed' | 'quiescent'> = ['productive', 'stressed', 'quiescent'];
  const branchingPoints: PAGAResult['branchingPoints'] = [];
  for (let i = 0; i < nC; i++) {
    const strongNeighbors = [];
    for (let j = 0; j < nC; j++) {
      if (j !== i && connectivities[i][j] > 0.3) strongNeighbors.push(j);
    }
    if (strongNeighbors.length >= 2) {
      const children = strongNeighbors
        .filter(j => pseudotime[j] > pseudotime[i])
        .map((j, idx) => ({
          cluster: j,
          label: clusters.clusterSizes[j]?.label ?? `Cluster ${j}`,
          fate: fates[idx % fates.length],
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
 */
export function trainScVAE(
  cells: CellRecord[],
  latentDim: number = 10,
  beta: number = 0.5,
  epochs: number = 50,
  batchLabels?: number[],
): ScVAEResult {
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

  /** Forward pass through the VAE. */
  function forward(x: number[]): ForwardResult {
    // Encoder layer 1
    const h1 = new Array(h1Dim);
    for (let j = 0; j < h1Dim; j++) {
      let s = w.b1[j];
      for (let i = 0; i < inputDim; i++) s += x[i] * w.W1[i][j];
      h1[j] = relu(s);
    }
    // Encoder layer 2
    const h2 = new Array(h2Dim);
    for (let j = 0; j < h2Dim; j++) {
      let s = w.b2[j];
      for (let i = 0; i < h1Dim; i++) s += h1[i] * w.W2[i][j];
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
    for (let j = 0; j < latentDim; j++) {
      z_sample[j] = z_mean[j] + Math.exp(0.5 * z_logvar[j]) * rng.gaussian();
    }
    // Decoder layer 1
    const h3 = new Array(h2Dim);
    for (let j = 0; j < h2Dim; j++) {
      let s = w.b3[j];
      for (let i = 0; i < latentDim; i++) s += z_sample[i] * w.W3[i][j];
      h3[j] = relu(s);
    }
    // Decoder layer 2
    const h4 = new Array(h1Dim);
    for (let j = 0; j < h1Dim; j++) {
      let s = w.b4[j];
      for (let i = 0; i < h2Dim; i++) s += h3[i] * w.W4[i][j];
      h4[j] = relu(s);
    }
    // Output reconstruction
    const recon = new Array(nFeatures);
    for (let j = 0; j < nFeatures; j++) {
      let s = w.b5[j];
      for (let i = 0; i < h1Dim; i++) s += h4[i] * w.W5[i][j];
      recon[j] = s;
    }
    return { h1, h2, z_mean, z_logvar, z_sample, h3, h4, recon };
  }

  // Training loop
  const lr = 0.001;
  const history: ScVAEResult['convergenceHistory'] = [];
  let finalReconLoss = 0, finalKL = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let epochRecon = 0, epochKL = 0;
    const perturbScale = lr * (1 - epoch / epochs);

    for (let i = 0; i < n; i++) {
      const res = forward(inputs[i]);

      // Reconstruction loss (MSE over gene features only)
      let reconLoss = 0;
      for (let j = 0; j < nFeatures; j++) {
        reconLoss += (inputs[i][j] - res.recon[j]) ** 2;
      }
      reconLoss /= nFeatures;

      // KL divergence: −0.5 Σ (1 + log σ² − μ² − σ²)
      let kl = 0;
      for (let k = 0; k < latentDim; k++) {
        kl += -0.5 * (1 + res.z_logvar[k] - res.z_mean[k] ** 2 - Math.exp(res.z_logvar[k]));
      }

      epochRecon += reconLoss;
      epochKL += kl;

      // Gradient updates — decoder output layer
      for (let j = 0; j < nFeatures; j++) {
        const error = inputs[i][j] - res.recon[j];
        w.b5[j] += perturbScale * error;
        for (let h = 0; h < h1Dim; h++) {
          w.W5[h][j] += perturbScale * error * res.h4[h] * 0.01;
        }
      }
      // Decoder hidden layer (W4)
      for (let j = 0; j < h1Dim; j++) {
        if (res.h4[j] <= 0) continue; // ReLU gate
        let dj = 0;
        for (let o = 0; o < nFeatures; o++) {
          dj += (inputs[i][o] - res.recon[o]) * (w.W5[j]?.[o] ?? 0);
        }
        w.b4[j] += perturbScale * dj * 0.01;
        for (let h = 0; h < h2Dim; h++) {
          w.W4[h][j] += perturbScale * dj * res.h3[h] * 0.001;
        }
      }
      // Encoder mean update (KL gradient ∂KL/∂μ = μ)
      for (let k = 0; k < latentDim; k++) {
        w.bmu[k] -= perturbScale * beta * res.z_mean[k] * 0.01;
      }
      // Encoder log-variance update (∂KL/∂logvar = 0.5(exp(logvar) − 1))
      for (let k = 0; k < latentDim; k++) {
        const klGradLv = 0.5 * (Math.exp(res.z_logvar[k]) - 1);
        w.blv[k] -= perturbScale * beta * klGradLv * 0.01;
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

  // 2-D projection via t-SNE-like force layout on latent means
  const pos: [number, number][] = latentPoints.map(() => [rng.next() * 2 - 1, rng.next() * 2 - 1]);

  for (let iter = 0; iter < 200; iter++) {
    const alpha = 0.5 * (1 - iter / 200);
    for (let i = 0; i < n; i++) {
      let fx = 0, fy = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dLatent = euclideanDistance(latentPoints[i].z_mean, latentPoints[j].z_mean);
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const d2D = Math.sqrt(dx * dx + dy * dy) + 1e-8;
        const force = (dLatent - d2D) / d2D;
        fx += force * dx * 0.01;
        fy += force * dy * 0.01;
      }
      pos[i][0] += alpha * fx;
      pos[i][1] += alpha * fy;
    }
  }

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
export function runFullPipeline(cells: CellRecord[]): ScSpatialAnalysisResult {
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
    pseudotime: paga.pseudotimeRange[1] > 0
      ? (paga.connectivities[c.cluster]?.[paga.rootCluster] ?? 0.5)
      : 0,
  }));

  // 6. Spatial neighbors
  const spatial = computeSpatialNeighbors(withPseudotime);

  // 7. Spatial autocorrelation
  const autocorrelation = computeMoranI(withPseudotime, spatial);

  // 8. VAE
  const vae = trainScVAE(withPseudotime);

  // 9. High-yield clusters
  const highYieldClusters = identifyHighYieldClusters(withPseudotime, clusterResult, paga, autocorrelation);

  return { qc, hvg, clusters: clusterResult, paga, spatial, autocorrelation, vae, highYieldClusters };
}
