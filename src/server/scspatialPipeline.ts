/**
 * ScSpatial Single-Cell Spatial Pipeline
 *
 * Unidirectional pipeline: Data Processor → Cluster Analyzer → Spatial Interpreter
 *
 * Agent A (Processor): QC filtering + library-size normalization + log1p transform
 * Agent B (Analyzer): K-means clustering + spatial statistics
 * Agent C (Interpreter): Moran's I spatial autocorrelation for spatially variable gene detection
 *
 * Every numerical conclusion comes from real solver calls.
 *
 * @scientific_provenance
 *   ALGORITHM: Pipeline orchestration — library-size normalization + K-means clustering + Moran's I spatial autocorrelation
 *   REFERENCE:
 *     Moran's I: Moran PAP (1950) "Notes on continuous stochastic phenomena" Biometrika 37:17-23
 *     Normal CDF approximation: Abramowitz M, Stegun IA (1964) "Handbook of Mathematical Functions" NBS, formula 26.2.17
 *     Spatial variance formula: Cliff AD, Ord JK (1981) "Spatial Processes: Models and Applications" Pion, London
 *   KNOWN_LIMITATIONS:
 *     - K-means only; no Leiden, Louvain, or graph-based clustering (e.g., Seurat/Scanpy workflow)
 *     - Moran's I weight matrix uses inverse Euclidean distance; no k-nearest-neighbor or spatial kernel alternative
 *     - No highly variable gene (HVG) selection; all genes pass to clustering
 *     - Pseudotime trajectory is always null; no PAGA or diffusion pseudotime implementation
 *     - QC parameters have defaults but no automatic threshold estimation (e.g., knee-point detection)
 *     - No batch correction or multi-section integration
 */

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ScSpatialInput {
  expressionMatrix: number[][];   // [cells × genes]
  geneNames: string[];
  cellCoordinates: Array<{ x: number; y: number }>;
  qcParams?: {
    minCounts?: number;
    minGenes?: number;
    maxMitoPercent?: number;
  };
}

export interface ClusterResult {
  clusterId: number;
  cellIndices: number[];
  meanExpression: Record<string, number>;
  spatialCenter: { x: number; y: number };
  spatialSpread: number;
}

export interface SpatiallyVariableGene {
  geneName: string;
  moransI: number;          // -1 to 1 (spatial autocorrelation)
  pValue: number;
  significant: boolean;
}

export interface ScSpatialResult {
  input: ScSpatialInput;
  nCellsAfterQC: number;
  clusters: ClusterResult[];
  spatiallyVariableGenes: SpatiallyVariableGene[];
  trajectoryPseudotime: number[] | null;
  allSolverCalls: Array<{ solver: string; description: string }>;
}

// ── Agent A: Data Processor ─────────────────────────────────────────────────

/**
 * QC filtering + library-size normalization + log1p transform.
 */
function processData(
  input: ScSpatialInput,
): {
  filteredMatrix: number[][];
  filteredGenes: string[];
  filteredCoords: Array<{ x: number; y: number }>;
  filteredIndices: number[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  const { qcParams } = input;

  const minCounts = qcParams?.minCounts ?? 500;
  const minGenes = qcParams?.minGenes ?? 200;

  // Filter cells by total counts and gene count
  const filteredIndices: number[] = [];
  for (let i = 0; i < input.expressionMatrix.length; i++) {
    const row = input.expressionMatrix[i];
    const totalCounts = row.reduce((s, v) => s + v, 0);
    const nGenes = row.filter(v => v > 0).length;
    if (totalCounts >= minCounts && nGenes >= minGenes) {
      filteredIndices.push(i);
    }
  }

  solverCalls.push({ solver: 'qc::filter', description: `${filteredIndices.length}/${input.expressionMatrix.length} cells pass QC` });

  // Library-size normalize + log1p
  const filteredMatrix = filteredIndices.map(i => {
    const row = input.expressionMatrix[i];
    const total = row.reduce((s, v) => s + v, 0);
    return row.map(v => Math.log1p((v / Math.max(total, 1)) * 10000));
  });

  const filteredGenes = input.geneNames;
  const filteredCoords = filteredIndices.map(i => input.cellCoordinates[i]);

  return { filteredMatrix, filteredGenes, filteredCoords, filteredIndices, solverCalls };
}

// ── Agent B: Cluster Analyzer ───────────────────────────────────────────────

/**
 * K-means clustering on normalized expression data.
 */
function analyzeClusters(
  matrix: number[][],
  coords: Array<{ x: number; y: number }>,
  geneNames: string[],
  nClusters = 5,
): {
  clusters: ClusterResult[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  solverCalls.push({ solver: 'clustering::kmeans', description: `${nClusters} clusters on ${matrix.length} cells` });

  // K-means with iterative centroid updates (max 20 iterations)
  const nGenes = matrix[0]?.length ?? 0;
  const centroids: number[][] = [];
  for (let k = 0; k < nClusters; k++) {
    const idx = Math.floor((k / nClusters) * matrix.length);
    centroids.push([...matrix[idx]]);
  }

  let assignments = new Array(matrix.length).fill(0);
  const maxIter = 20;

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign cells to nearest centroid
    const newAssignments = matrix.map(row => {
      let minDist = Infinity;
      let bestK = 0;
      for (let k = 0; k < nClusters; k++) {
        let dist = 0;
        for (let j = 0; j < nGenes; j++) {
          dist += (row[j] - centroids[k][j]) ** 2;
        }
        if (dist < minDist) { minDist = dist; bestK = k; }
      }
      return bestK;
    });

    // Check convergence
    const changed = newAssignments.filter((a, i) => a !== assignments[i]).length;
    assignments = newAssignments;
    if (changed === 0) break;

    // Recompute centroids
    for (let k = 0; k < nClusters; k++) {
      const members = matrix.filter((_, i) => assignments[i] === k);
      if (members.length === 0) continue;
      for (let j = 0; j < nGenes; j++) {
        centroids[k][j] = members.reduce((s, row) => s + row[j], 0) / members.length;
      }
    }
  }

  // Build cluster results
  const clusters: ClusterResult[] = [];
  for (let k = 0; k < nClusters; k++) {
    const cellIndices = assignments.reduce((acc, a, i) => a === k ? [...acc, i] : acc, [] as number[]);

    // Mean expression
    const meanExpression: Record<string, number> = {};
    for (let j = 0; j < geneNames.length; j++) {
      const values = cellIndices.map((ci: number) => matrix[ci][j]);
      meanExpression[geneNames[j]] = values.length > 0
        ? values.reduce((s: number, v: number) => s + v, 0) / values.length
        : 0;
    }

    // Spatial center and spread
    const cx = cellIndices.reduce((s: number, ci: number) => s + coords[ci].x, 0) / Math.max(cellIndices.length, 1);
    const cy = cellIndices.reduce((s: number, ci: number) => s + coords[ci].y, 0) / Math.max(cellIndices.length, 1);
    const spread = cellIndices.reduce((s: number, ci: number) =>
      s + Math.sqrt((coords[ci].x - cx) ** 2 + (coords[ci].y - cy) ** 2), 0
    ) / Math.max(cellIndices.length, 1);

    clusters.push({ clusterId: k, cellIndices, meanExpression, spatialCenter: { x: cx, y: cy }, spatialSpread: Math.round(spread * 100) / 100 });
  }

  return { clusters, solverCalls };
}

// ── Agent C: Spatial Interpreter ────────────────────────────────────────────

/**
 * Compute Moran's I for spatial autocorrelation of each gene.
 */
function interpretSpatial(
  matrix: number[][],
  coords: Array<{ x: number; y: number }>,
  geneNames: string[],
): {
  spatiallyVariableGenes: SpatiallyVariableGene[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  solverCalls.push({ solver: 'spatial::moransI', description: `${geneNames.length} genes tested for spatial autocorrelation` });

  const n = matrix.length;
  if (n < 3) return { spatiallyVariableGenes: [], solverCalls };

  // Build spatial weight matrix (inverse distance)
  const W: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  let totalW = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = Math.sqrt((coords[i].x - coords[j].x) ** 2 + (coords[i].y - coords[j].y) ** 2);
      const w = dist > 0 ? 1 / dist : 0;
      W[i][j] = w;
      W[j][i] = w;
      totalW += 2 * w;
    }
  }

  // Compute Moran's I for each gene
  const svgs: SpatiallyVariableGene[] = [];
  for (let g = 0; g < geneNames.length; g++) {
    const values = matrix.map(row => row[g]);
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

    if (variance < 1e-10) continue;

    // Moran's I = (n / W) * (Σ w_ij * (x_i - x̄)(x_j - x̄)) / (Σ (x_i - x̄)²)
    let numerator = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        numerator += W[i][j] * (values[i] - mean) * (values[j] - mean);
      }
    }

    const moransI = totalW > 0 ? (n / totalW) * numerator / (variance * n) : 0;

    // Asymptotic p-value under H0: I ~ N(E[I], Var[I])
    // E[I] = -1 / (n - 1)
    // z = (I - E[I]) / sqrt(Var[I])
    const EI = -1 / (n - 1);
    // Estimated variance (Cliff & Ord 1981)
    const S0 = totalW;
    const S1 = 0.5 * W.flat().reduce((s: number, w: number) => s + 2 * w * w, 0);
    const rowSums = W.map((row: number[]) => row.reduce((s: number, w: number) => s + w, 0));
    const colSums = W[0].map((_: number, j: number) => W.reduce((s: number, row: number[]) => s + row[j], 0));
    const S2 = rowSums.reduce((s: number, rs: number, i: number) => s + (rs + colSums[i]) ** 2, 0);
    const varI = (n * S1 - S2 + 3 * S0 * S0) / ((n - 1) * (n + 1) * S0 * S0) - EI * EI;
    const seI = Math.sqrt(Math.max(varI, 1e-20));
    const z = (moransI - EI) / seI;
    // Two-tailed p-value from z-score (normal CDF approximation)
    const pValue = Math.max(0, Math.min(1, 2 * (1 - normalCDF(Math.abs(z)))));

    svgs.push({
      geneName: geneNames[g],
      moransI: Math.round(moransI * 1000) / 1000,
      pValue: Math.round(pValue * 1000) / 1000,
      significant: Math.abs(moransI) > 0.1 && pValue < 0.05,
    });
  }

  svgs.sort((a, b) => Math.abs(b.moransI) - Math.abs(a.moransI));
  return { spatiallyVariableGenes: svgs, solverCalls };
}

// ── Pipeline Entry Point ────────────────────────────────────────────────────

export function runScSpatialPipeline(input: ScSpatialInput): ScSpatialResult {
  const allSolverCalls: Array<{ solver: string; description: string }> = [];

  // Agent A: Process data
  const { filteredMatrix, filteredGenes, filteredCoords, filteredIndices, solverCalls: procCalls } = processData(input);
  allSolverCalls.push(...procCalls);

  // Agent B: Cluster analysis
  const { clusters, solverCalls: clusterCalls } = analyzeClusters(filteredMatrix, filteredCoords, filteredGenes);
  allSolverCalls.push(...clusterCalls);

  // Agent C: Spatial interpretation
  const { spatiallyVariableGenes, solverCalls: spatialCalls } = interpretSpatial(filteredMatrix, filteredCoords, filteredGenes);
  allSolverCalls.push(...spatialCalls);

  return {
    input,
    nCellsAfterQC: filteredIndices.length,
    clusters,
    spatiallyVariableGenes,
    trajectoryPseudotime: null,  // would need PAGA
    allSolverCalls,
  };
}

/**
 * Standard normal CDF approximation (Abramowitz & Stegun 1964, formula 26.2.17)
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  return 0.5 * (1 + sign * y);
}
