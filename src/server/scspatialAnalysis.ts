import { UMAP } from 'umap-js';
import {
  computeMoranI,
  computePAGA,
  computeSpatialNeighbors,
  identifyHighYieldClusters,
  normalizeAndLog,
  preprocessAndQC,
  selectHVGs,
  clusterCells,
  type CellRecord,
  type ClusterResult,
  type MoranResult,
  type PAGAResult,
  type SpatialAutocorrelationResult,
  type SpatialNeighborResult,
  type GiStarGeneResult,
} from '../services/ScSpatialEngine';
import { benjaminiHochberg } from '../utils/statistics';
import type {
  ScSpatialClusterSummary,
  ScSpatialCoexpressionSummary,
  ScSpatialDatasetMeta,
  ScSpatialHotspotSummary,
  ScSpatialNiche,
  ScSpatialNormalizedArtifact,
  ScSpatialPointDatum,
  ScSpatialQueryRequest,
  ScSpatialQueryResponse,
  ScSpatialSVGResult,
  ScSpatialTrajectoryEdge,
  ScSpatialTrajectoryNode,
  ScSpatialValidity,
  ScSpatialViewMode,
} from '../types/scspatial';

interface PreparedAnalysis {
  validity: ScSpatialValidity;
  datasetMeta: ScSpatialDatasetMeta;
  availableGenes: string[];
  availableClusters: string[];
  cells: CellRecord[];
  qcPassedCells: CellRecord[];
  clusterResult: ClusterResult;
  paga: PAGAResult;
  autocorrelation: SpatialAutocorrelationResult;
  hotspots: ScSpatialHotspotSummary[];
  clusterSummaries: ScSpatialClusterSummary[];
  umapPoints: number[][];
  spatialNeighborGraph: SpatialNeighborResult;
  svgResults: ScSpatialSVGResult[];
  niches: ScSpatialNiche[];
  warnings: string[];
  missingFields: string[];
}

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sanitizeLabel(value: string | null | undefined, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function buildDenseVector(cell: CellRecord, genes: string[]) {
  return genes.map((gene) => cell.geneExpression[gene] ?? 0);
}

function euclideanDistance(left: number[], right: number[]) {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

function pearsonCorrelation(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftCentered = left[index] - leftMean;
    const rightCentered = right[index] - rightMean;
    numerator += leftCentered * rightCentered;
    leftVariance += leftCentered * leftCentered;
    rightVariance += rightCentered * rightCentered;
  }

  if (leftVariance === 0 || rightVariance === 0) return 0;
  return numerator / Math.sqrt(leftVariance * rightVariance);
}

function geneIsMitochondrial(geneSymbol: string) {
  return geneSymbol.startsWith('MT-') || geneSymbol.startsWith('mt-');
}

function buildGeneExpressionRecord(
  indices: number[],
  values: number[],
  genes: string[],
) {
  const record: Record<string, number> = {};
  for (let index = 0; index < indices.length; index += 1) {
    const gene = genes[indices[index]];
    if (!gene) continue;
    record[gene] = values[index];
  }
  return record;
}

function buildRuntimeViews(hasSpatialCoords: boolean, hasUmap: boolean, hasClusters: boolean) {
  return {
    spatial2d: hasSpatialCoords,
    spatial3d: hasSpatialCoords,
    umap: hasUmap,
    trajectory: hasClusters,
    table: true,
  };
}

function buildDatasetMeta(
  artifact: ScSpatialNormalizedArtifact,
  availableViews: ReturnType<typeof buildRuntimeViews>,
): ScSpatialDatasetMeta {
  const uniqueSamples = new Set(
    artifact.obs
      .map((record) => record.sampleId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );

  return {
    artifactId: artifact.artifactId,
    datasetName: artifact.source.fileName.replace(/\.h5ad$/i, ''),
    fileName: artifact.source.fileName,
    cellCount: artifact.matrix.X.nObs,
    geneCount: artifact.matrix.X.nVars,
    sampleCount: uniqueSamples.size || artifact.source.sampleCount || 1,
    hasSpatialCoords: artifact.metadata.hasSpatialCoords,
    hasPrecomputedUmap: artifact.metadata.hasPrecomputedUmap,
    availableViews,
    warnings: artifact.metadata.warnings,
    missingFields: artifact.metadata.missingFields,
    clusterLabelKey: artifact.metadata.extractedKeys.clusterLabelKey ?? null,
    cellTypeKey: artifact.metadata.extractedKeys.cellTypeKey ?? null,
    batchKey: artifact.metadata.extractedKeys.batchKey ?? null,
    sampleMetadataKeys: artifact.metadata.extractedKeys.sampleMetadataKeys,
    availableLayers: artifact.metadata.extractedKeys.layers,
    availableEmbeddings: artifact.metadata.extractedKeys.embeddings,
    parserVersion: artifact.source.parserVersion,
  };
}

function pickUmapEmbedding(artifact: ScSpatialNormalizedArtifact) {
  const entries = Object.entries(artifact.obsm.embeddings);
  const direct = entries.find(([key]) => key.toLowerCase().includes('umap'));
  return direct ?? null;
}

function createDeterministicRandom(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function computeUmapEmbedding(cells: CellRecord[], genes: string[]) {
  if (cells.length === 0) return [];
  const dense = cells.map((cell) => buildDenseVector(cell, genes));
  const fallback = cells.map((cell, index) => ([
    genes[0] ? cell.geneExpression[genes[0]] ?? 0 : cell.spatialX || index,
    genes[1] ? cell.geneExpression[genes[1]] ?? 0 : cell.spatialY || cell.pseudotime || index,
  ]));
  if (dense.length < 6 || dense[0]?.length === 0) {
    return fallback;
  }
  const nNeighbors = Math.max(2, Math.min(
    15,
    Math.max(5, Math.floor(Math.sqrt(Math.max(dense.length, 1)))),
    dense.length - 1,
  ));
  const model = new UMAP({
    nComponents: 2,
    nNeighbors,
    minDist: 0.12,
    random: createDeterministicRandom(17),
  });
  try {
    return model.fit(dense);
  } catch {
    return fallback;
  }
}

function buildProvidedClusterSummary(
  cells: CellRecord[],
  clusterLabelById: string[],
  genesForMetrics: string[],
  spatialPoints?: number[][],
): ClusterResult {
  const clusters = new Map<number, CellRecord[]>();
  cells.forEach((cell) => {
    const bucket = clusters.get(cell.cluster) ?? [];
    bucket.push(cell);
    clusters.set(cell.cluster, bucket);
  });

  const centroids = new Map<number, number[]>();
  clusters.forEach((clusterCells, clusterId) => {
    const centroid = genesForMetrics.map((gene) =>
      mean(clusterCells.map((cell) => cell.geneExpression[gene] ?? 0)),
    );
    centroids.set(clusterId, centroid);
  });

  const silhouette = mean(
    cells.map((cell) => {
      const ownCentroid = centroids.get(cell.cluster) ?? [];
      const a = euclideanDistance(buildDenseVector(cell, genesForMetrics), ownCentroid);
      const b = Math.min(
        ...Array.from(centroids.entries())
          .filter(([clusterId]) => clusterId !== cell.cluster)
          .map(([, centroid]) => euclideanDistance(buildDenseVector(cell, genesForMetrics), centroid)),
      );
      if (!Number.isFinite(b)) return 0;
      const denom = Math.max(a, b, 1e-6);
      return (b - a) / denom;
    }),
  );

  let modularity = 0;
  if (spatialPoints && spatialPoints.length === cells.length) {
    const spatialGraph = computeSpatialNeighbors(cells);
    const within = spatialGraph.adjacency.filter(([left, right]) => cells[left]?.cluster === cells[right]?.cluster).length;
    modularity = spatialGraph.adjacency.length > 0 ? within / spatialGraph.adjacency.length : 0;
  }

  return {
    nClusters: clusters.size,
    clusterSizes: Array.from(clusters.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([clusterId, clusterCells]) => ({
        cluster: clusterId,
        size: clusterCells.length,
        label: clusterLabelById[clusterId] ?? `Cluster ${clusterId + 1}`,
      })),
    silhouetteScore: round(silhouette),
    modularity: round(modularity),
  };
}

function buildCellsFromArtifact(artifact: ScSpatialNormalizedArtifact) {
  const genes = artifact.var.map((record) => sanitizeLabel(record.geneSymbol, record.geneId));
  const batchMap = new Map<string, number>();
  const rawClusterLabels = artifact.obs.map((record) =>
    sanitizeLabel(record.clusterLabel ?? record.cellType ?? null, ''),
  );
  const uniqueClusterLabels = Array.from(new Set(rawClusterLabels.filter(Boolean)));
  const clusterMap = new Map(uniqueClusterLabels.map((label, index) => [label, index]));
  const spatial = artifact.obsm.spatial;

  const cells: CellRecord[] = artifact.matrix.X.rows.map((row, index) => {
    const geneExpression = buildGeneExpressionRecord(row.indices, row.values, genes);
    const totalCounts = row.values.reduce((sum, value) => sum + value, 0);
    const mitoCounts = row.indices.reduce((sum, geneIndex, valueIndex) => (
      geneIsMitochondrial(genes[geneIndex]) ? sum + row.values[valueIndex] : sum
    ), 0);
    const batchLabel = artifact.obs[index]?.batchId;
    const batchKey = batchLabel == null ? 'default' : String(batchLabel);
    if (!batchMap.has(batchKey)) {
      batchMap.set(batchKey, batchMap.size);
    }
    const clusterLabel = rawClusterLabels[index];
    const spatialX = spatial?.[index]?.[0];
    const spatialY = spatial?.[index]?.[1];
    return {
      id: artifact.obs[index]?.cellId ?? `cell-${index + 1}`,
      barcode: artifact.obs[index]?.cellId ?? `cell-${index + 1}`,
      totalCounts: round(totalCounts, 2),
      nGenes: row.indices.length,
      mitoPercent: totalCounts > 0 ? round((mitoCounts / totalCounts) * 100, 2) : 0,
      geneExpression,
      cluster: clusterLabel ? (clusterMap.get(clusterLabel) ?? 0) : 0,
      cellType: sanitizeLabel(
        artifact.obs[index]?.cellType ?? clusterLabel ?? null,
        clusterLabel || 'Unannotated',
      ),
      pseudotime: 0,
      spatialX: Number.isFinite(spatialX) ? spatialX ?? 0 : Number.NaN,
      spatialY: Number.isFinite(spatialY) ? spatialY ?? 0 : Number.NaN,
      batchId: batchMap.get(batchKey) ?? 0,
      qcPass: true,
    };
  });

  return {
    cells,
    genes,
    providedClusterLabels: uniqueClusterLabels,
    hasProvidedClusterLabels: uniqueClusterLabels.length > 0,
  };
}

function createEmptySpatialAutocorrelation(): SpatialAutocorrelationResult {
  return {
    results: [],
    nGenesTested: 0,
    nSpatiallyRestricted: 0,
    topSpatialGenes: [],
    giStarResults: { results: [], nHotHigh: 0, nHotLow: 0 },
  };
}

function createEmptySpatialNeighborGraph(cellCount: number): SpatialNeighborResult {
  return {
    nCells: cellCount,
    nNeighbors: 0,
    graphType: 'knn',
    adjacency: [],
  };
}

function inferValidity(artifact: ScSpatialNormalizedArtifact) {
  if (artifact.source.fileName === 'bundled-demo.h5ad') return 'demo' as const;
  if (!artifact.metadata.hasSpatialCoords) return 'partial' as const;
  return 'real' as const;
}

function prepareAnalysis(artifact: ScSpatialNormalizedArtifact): PreparedAnalysis {
  const { cells: rawCells, genes, hasProvidedClusterLabels, providedClusterLabels } = buildCellsFromArtifact(artifact);
  const qcResult = preprocessAndQC(rawCells);
  const warnings = [...artifact.metadata.warnings];
  const missingFields = [...artifact.metadata.missingFields];
  const qcCells = qcResult.filtered.length > 0
    ? qcResult.filtered
    : rawCells.map((cell) => ({ ...cell, qcPass: true }));
  if (qcResult.filtered.length === 0 && rawCells.length > 0) {
    warnings.push('QC thresholds removed every cell; SCSPATIAL fell back to unfiltered cells for visualization.');
  }
  const normalized = normalizeAndLog(qcCells);
  const hvg = selectHVGs(normalized, Math.min(50, genes.length));
  const genesForMetrics = hvg.genes.filter((gene) => gene.isHVG).slice(0, 25).map((gene) => gene.gene);
  const metricGenes = genesForMetrics.length > 0 ? genesForMetrics : genes.slice(0, Math.min(25, genes.length));

  let cells = normalized;
  let clusterResult: ClusterResult;

  if (hasProvidedClusterLabels) {
    clusterResult = buildProvidedClusterSummary(normalized, providedClusterLabels, metricGenes, artifact.obsm.spatial);
  } else {
    const clustered = clusterCells(normalized);
    cells = clustered.cells;
    clusterResult = clustered.result;
  }

  const paga = computePAGA(cells, clusterResult);
  const cellsWithPseudotime = cells.map((cell) => ({
    ...cell,
    pseudotime: paga.clusterPseudotime[cell.cluster] ?? 0,
  }));

  const spatialNeighborGraph = artifact.metadata.hasSpatialCoords
    ? computeSpatialNeighbors(cellsWithPseudotime)
    : createEmptySpatialNeighborGraph(cellsWithPseudotime.length);
  const autocorrelation = artifact.metadata.hasSpatialCoords
    ? computeMoranI(cellsWithPseudotime, spatialNeighborGraph)
    : createEmptySpatialAutocorrelation();

  const hotspots: ScSpatialHotspotSummary[] = autocorrelation.results.slice(0, 12).map((result) => ({
    geneSymbol: result.gene,
    moranI: round(result.moranI),
    zScore: round(result.zScore),
    pValue: round(result.pValue, 4),
    qValue: round(result.qValue, 4),
    isSpatiallyRestricted: result.isSpatiallyRestricted,
    hotspot: result.hotspot,
  }));

  const runtimeViewsBase = buildRuntimeViews(
    artifact.metadata.hasSpatialCoords,
    true,
    clusterResult.nClusters > 0,
  );
  const datasetMeta = buildDatasetMeta(artifact, runtimeViewsBase);
  datasetMeta.warnings = warnings;
  datasetMeta.missingFields = missingFields;
  const validity = inferValidity(artifact);

  const embedding = pickUmapEmbedding(artifact);
  const umapPoints = embedding
    ? embedding[1].points.map((point) => [point[0] ?? 0, point[1] ?? 0])
    : computeUmapEmbedding(cellsWithPseudotime, metricGenes);
  datasetMeta.hasPrecomputedUmap = Boolean(embedding);
  datasetMeta.availableViews = buildRuntimeViews(
    artifact.metadata.hasSpatialCoords,
    umapPoints.length === cellsWithPseudotime.length,
    clusterResult.nClusters > 0,
  );

  const highYieldClusters = identifyHighYieldClusters(cellsWithPseudotime, clusterResult, paga, autocorrelation);
  const selectedGeneFallback = genes[0] ?? '';
  const clusterSummaries: ScSpatialClusterSummary[] = clusterResult.clusterSizes.map((clusterSize) => {
    const clusterCells = cellsWithPseudotime.filter((cell) => cell.cluster === clusterSize.cluster);
    const yieldCluster = highYieldClusters.find((candidate) => candidate.clusterId === clusterSize.cluster);
    const topGenes = yieldCluster?.keyGenes.map((gene) => gene.gene) ?? [];
    return {
      clusterId: clusterSize.cluster,
      clusterLabel: clusterSize.label,
      cellCount: clusterSize.size,
      meanExpression: round(mean(clusterCells.map((cell) => cell.geneExpression[selectedGeneFallback] ?? 0))),
      meanPseudotime: round(mean(clusterCells.map((cell) => cell.pseudotime))),
      topGenes,
      fate: yieldCluster?.fate ?? 'quiescent',
      spatiallyLocalized: yieldCluster?.spatiallyLocalized ?? false,
    };
  });

  // SVG detection: use spatial coords + expression matrix
  let svgResults: ScSpatialSVGResult[] = [];
  let niches: ScSpatialNiche[] = [];
  if (artifact.metadata.hasSpatialCoords && artifact.obsm.spatial) {
    const validCoords = cellsWithPseudotime
      .map((cell, idx) => ({
        x: cell.spatialX,
        y: cell.spatialY,
        valid: Number.isFinite(cell.spatialX) && Number.isFinite(cell.spatialY),
        idx,
      }))
      .filter((c) => c.valid);

    if (validCoords.length >= 3) {
      const coords = validCoords.map((c) => ({ x: c.x, y: c.y }));
      // Build per-gene expression vectors aligned with valid coords
      const expressionMatrix: number[][] = genes.map((gene) =>
        validCoords.map((c) => cellsWithPseudotime[c.idx]?.geneExpression[gene] ?? 0),
      );
      svgResults = detectSVGs(expressionMatrix, genes, coords);

      // Niche analysis
      const clusterLabelByIndex = clusterResult.clusterSizes.map((cs) => cs.label);
      const nicheClusterLabels = validCoords.map(
        (c) => clusterLabelByIndex[cellsWithPseudotime[c.idx]?.cluster ?? 0] ?? 'Unknown',
      );
      const nicheExpression: number[][] = genes.map((gene) =>
        validCoords.map((c) => cellsWithPseudotime[c.idx]?.geneExpression[gene] ?? 0),
      );
      niches = identifyNiches(coords, nicheClusterLabels, nicheExpression, genes);
    }
  }

  return {
    validity,
    datasetMeta,
    availableGenes: genes,
    availableClusters: clusterResult.clusterSizes.map((cluster) => cluster.label),
    cells: cellsWithPseudotime,
    qcPassedCells: qcCells,
    clusterResult,
    paga,
    autocorrelation,
    hotspots,
    clusterSummaries,
    umapPoints,
    spatialNeighborGraph,
    svgResults,
    niches,
    warnings,
    missingFields,
  };
}

function resolveSelectedGene(request: ScSpatialQueryRequest, availableGenes: string[]) {
  if (availableGenes.includes(request.selectedGene)) return request.selectedGene;
  return availableGenes[0] ?? '';
}

function resolveSelectedCluster(
  request: ScSpatialQueryRequest,
  clusterSummaries: ScSpatialClusterSummary[],
) {
  if (request.selectedCluster && clusterSummaries.some((cluster) => cluster.clusterLabel === request.selectedCluster)) {
    return request.selectedCluster;
  }
  return clusterSummaries[0]?.clusterLabel ?? null;
}

function resolveSelectedCellId(
  request: ScSpatialQueryRequest,
  points: ScSpatialPointDatum[],
  selectedCluster: string | null,
) {
  if (request.selectedCellId && points.some((point) => point.id === request.selectedCellId)) {
    return request.selectedCellId;
  }
  if (selectedCluster) {
    return points.find((point) => point.clusterLabel === selectedCluster)?.id ?? points[0]?.id ?? null;
  }
  return points[0]?.id ?? null;
}

function resolveViewMode(
  requested: ScSpatialViewMode,
  datasetMeta: ScSpatialDatasetMeta,
) {
  const viewOrder: ScSpatialViewMode[] = ['spatial-2d', 'spatial-3d', 'umap', 'trajectory', 'table'];
  const availability: Record<ScSpatialViewMode, boolean> = {
    'spatial-2d': datasetMeta.availableViews.spatial2d,
    'spatial-3d': datasetMeta.availableViews.spatial3d,
    umap: datasetMeta.availableViews.umap,
    trajectory: datasetMeta.availableViews.trajectory,
    table: datasetMeta.availableViews.table,
    communication: true, // always available — client-side analysis
  };
  if (availability[requested]) return requested;
  return viewOrder.find((candidate) => availability[candidate]) ?? 'table';
}

function buildViewPoints(
  mode: ScSpatialViewMode,
  cells: CellRecord[],
  umapPoints: number[][],
  selectedGene: string,
  selectedCluster: string | null,
  selectedCellId: string | null,
  clusterLabels: string[],
): ScSpatialPointDatum[] {
  return cells
    .map((cell, index) => {
      const clusterLabel = clusterLabels[cell.cluster] ?? `Cluster ${cell.cluster + 1}`;
      const expression = cell.geneExpression[selectedGene] ?? 0;
      const spatialPoint = [cell.spatialX, cell.spatialY];
      const umapPoint = umapPoints[index] ?? [0, 0];
      let x = spatialPoint[0];
      let y = spatialPoint[1];
      let z: number | undefined;

      if (mode === 'umap') {
        [x, y] = umapPoint;
      } else if (mode === 'spatial-3d') {
        [x, y] = spatialPoint;
        z = expression;
      }

      return {
        id: cell.id,
        clusterId: cell.cluster,
        clusterLabel,
        cellType: cell.cellType,
        x,
        y,
        z,
        expression,
        pseudotime: cell.pseudotime,
        selected: cell.id === selectedCellId,
      };
    })
    .filter((point) => !selectedCluster || point.clusterLabel === selectedCluster);
}

function buildTrajectoryLayout(
  clusterResult: ClusterResult,
  paga: PAGAResult,
): { nodes: ScSpatialTrajectoryNode[]; edges: ScSpatialTrajectoryEdge[] } {
  const nodes = clusterResult.clusterSizes.map((cluster, index) => ({
    clusterId: cluster.cluster,
    clusterLabel: cluster.label,
    cellCount: cluster.size,
    x: paga.clusterPseudotime[cluster.cluster] ?? index / Math.max(clusterResult.clusterSizes.length, 1),
    y: clusterResult.clusterSizes.length > 1
      ? index / Math.max(clusterResult.clusterSizes.length - 1, 1)
      : 0.5,
  }));
  const edges = paga.trajectory.map((edge) => ({
    from: edge.from,
    to: edge.to,
    weight: round(edge.weight),
  }));
  return { nodes, edges };
}

function buildCoexpressionSummaries(
  cells: CellRecord[],
  genes: string[],
  selectedGene: string,
): ScSpatialCoexpressionSummary[] {
  const selectedVector = cells.map((cell) => cell.geneExpression[selectedGene] ?? 0);
  return genes
    .filter((gene) => gene !== selectedGene)
    .map((gene) => ({
      geneSymbol: gene,
      correlation: round(pearsonCorrelation(selectedVector, cells.map((cell) => cell.geneExpression[gene] ?? 0))),
    }))
    .sort((left, right) => Math.abs(right.correlation) - Math.abs(left.correlation))
    .slice(0, 6);
}

/**
 * Detect Spatially Variable Genes (SVGs) using Moran's I with permutation
 * p-values and Benjamini-Hochberg FDR correction.
 *
 * Classifies each gene as 'clustered' (I > 0, q < fdrThreshold),
 * 'dispersed' (I < 0, q < fdrThreshold), or 'random'.
 * Identifies genes with similar spatial patterns as hotspot co-members.
 */
function detectSVGs(
  expression: number[][],
  geneNames: string[],
  spatialCoords: { x: number; y: number }[],
  fdrThreshold = 0.05,
): ScSpatialSVGResult[] {
  const n = spatialCoords.length;
  const nGenes = geneNames.length;
  if (n < 3 || nGenes === 0) return [];

  // Build KNN spatial neighbor graph (k = 6)
  const k = Math.min(6, n - 1);
  const adjacency: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const dists: { idx: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = spatialCoords[i].x - spatialCoords[j].x;
      const dy = spatialCoords[i].y - spatialCoords[j].y;
      dists.push({ idx: j, d: Math.sqrt(dx * dx + dy * dy) });
    }
    dists.sort((a, b) => a.d - b.d);
    for (let t = 0; t < k; t++) {
      adjacency.push([i, dists[t].idx]);
    }
  }

  const W = adjacency.length;
  if (W === 0) return [];

  // Permutation count: adaptive based on dataset size
  const nPermutations = n > 500 ? 199 : 999;
  let rngState = 42;
  const rngNext = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0xffffffff;
  };

  // Per-gene Moran's I + permutation p-value
  const rawResults: { gene: string; moranI: number; pValue: number }[] = [];
  for (let g = 0; g < nGenes; g++) {
    const x = expression[g];
    if (!x || x.length === 0) {
      rawResults.push({ gene: geneNames[g], moranI: 0, pValue: 1 });
      continue;
    }
    const xMean = x.reduce((s, v) => s + v, 0) / n;
    let denom = 0;
    for (let i = 0; i < n; i++) denom += (x[i] - xMean) ** 2;
    if (denom === 0) {
      rawResults.push({ gene: geneNames[g], moranI: 0, pValue: 1 });
      continue;
    }

    // Observed Moran's I
    let numer = 0;
    for (const [i, j] of adjacency) {
      numer += (x[i] - xMean) * (x[j] - xMean);
    }
    const observedI = (n / W) * (numer / denom);

    // Permutation test
    let count = 0;
    for (let p = 0; p < nPermutations; p++) {
      const shuffled = [...x];
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rngNext() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
      }
      let pNumer = 0;
      for (const [a, b] of adjacency) {
        pNumer += (shuffled[a] - xMean) * (shuffled[b] - xMean);
      }
      const permI = (n / W) * (pNumer / denom);
      if (permI >= observedI) count++;
    }
    const pValue = (count + 1) / (nPermutations + 1);
    rawResults.push({ gene: geneNames[g], moranI: observedI, pValue });
  }

  // BH FDR correction
  const pValues = rawResults.map((r) => r.pValue);
  const qValues = benjaminiHochberg(pValues);

  // Classify spatial patterns and find co-clustered genes
  const results: ScSpatialSVGResult[] = rawResults.map((r, idx) => {
    const qValue = qValues[idx];
    let spatialPattern: 'clustered' | 'dispersed' | 'random' = 'random';
    if (qValue < fdrThreshold) {
      spatialPattern = r.moranI > 0 ? 'clustered' : 'dispersed';
    }
    return {
      gene: r.gene,
      moranI: round(r.moranI, 4),
      pValue: round(r.pValue, 4),
      qValue: round(qValue, 4),
      spatialPattern,
      hotspotGenes: [],
    };
  });

  // Identify hotspot co-members: genes with similar Moran's I sign and significant q
  const clusteredGenes = results
    .filter((r) => r.spatialPattern === 'clustered')
    .sort((a, b) => b.moranI - a.moranI);
  const dispersedGenes = results
    .filter((r) => r.spatialPattern === 'dispersed')
    .sort((a, b) => a.moranI - b.moranI);

  for (const result of results) {
    if (result.spatialPattern === 'clustered') {
      result.hotspotGenes = clusteredGenes
        .filter((r) => r.gene !== result.gene)
        .slice(0, 5)
        .map((r) => r.gene);
    } else if (result.spatialPattern === 'dispersed') {
      result.hotspotGenes = dispersedGenes
        .filter((r) => r.gene !== result.gene)
        .slice(0, 5)
        .map((r) => r.gene);
    }
  }

  // Sort: significant clustered first, then dispersed, then random; within each by |I|
  results.sort((a, b) => {
    const orderA = a.spatialPattern === 'clustered' ? 0 : a.spatialPattern === 'dispersed' ? 1 : 2;
    const orderB = b.spatialPattern === 'clustered' ? 0 : b.spatialPattern === 'dispersed' ? 1 : 2;
    if (orderA !== orderB) return orderA - orderB;
    return Math.abs(b.moranI) - Math.abs(a.moranI);
  });

  return results;
}

/**
 * Identify spatial niches — recurring cellular neighborhoods — from
 * cell positions and cluster labels.
 *
 * For each cell, defines its niche as all cells within `nicheRadius`.
 * Clusters niches by composition similarity using k-means on composition
 * vectors. Identifies marker genes for each niche via differential
 * expression (fold-change ranking).
 */
function identifyNiches(
  cellPositions: { x: number; y: number }[],
  clusterLabels: string[],
  expression: number[][],
  geneNames: string[],
  nicheRadius?: number,
): ScSpatialNiche[] {
  const n = cellPositions.length;
  if (n < 3) return [];

  // Auto-detect nicheRadius from median nearest-neighbor distance if not provided
  let radius = nicheRadius;
  if (radius == null || radius <= 0) {
    const nnDists: number[] = [];
    for (let i = 0; i < Math.min(n, 200); i++) {
      let minDist = Infinity;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = cellPositions[i].x - cellPositions[j].x;
        const dy = cellPositions[i].y - cellPositions[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) minDist = d;
      }
      if (minDist < Infinity) nnDists.push(minDist);
    }
    nnDists.sort((a, b) => a - b);
    const medianNN = nnDists.length > 0
      ? nnDists[Math.floor(nnDists.length / 2)]
      : 1;
    radius = medianNN * 5;
  }

  // Unique cluster labels
  const uniqueClusters = Array.from(new Set(clusterLabels)).sort();
  const clusterIndex = new Map(uniqueClusters.map((c, i) => [c, i]));
  const nClusters = uniqueClusters.length;

  // Build composition vector for each cell's neighborhood
  const compositions: number[][] = [];
  for (let i = 0; i < n; i++) {
    const comp = new Array(nClusters).fill(0);
    let neighborCount = 0;
    for (let j = 0; j < n; j++) {
      const dx = cellPositions[i].x - cellPositions[j].x;
      const dy = cellPositions[i].y - cellPositions[j].y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        const ci = clusterIndex.get(clusterLabels[j]) ?? 0;
        comp[ci]++;
        neighborCount++;
      }
    }
    // Normalize to proportions
    if (neighborCount > 0) {
      for (let c = 0; c < nClusters; c++) comp[c] /= neighborCount;
    }
    compositions.push(comp);
  }

  // k-means clustering on composition vectors
  const kMax = Math.min(8, Math.max(2, Math.floor(Math.sqrt(n / 5))));
  const maxIter = 50;
  let rngState = 137;
  const rngNext = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0xffffffff;
  };

  // Initialize centroids via k-means++
  const centroids: number[][] = [];
  const firstIdx = Math.floor(rngNext() * n);
  centroids.push([...compositions[firstIdx]]);

  for (let c = 1; c < kMax; c++) {
    // Distance to nearest existing centroid
    const dists = compositions.map((comp) => {
      let minD = Infinity;
      for (const cent of centroids) {
        let d = 0;
        for (let f = 0; f < nClusters; f++) d += (comp[f] - cent[f]) ** 2;
        if (d < minD) minD = d;
      }
      return minD;
    });
    const totalDist = dists.reduce((s, d) => s + d, 0);
    if (totalDist === 0) break;
    let r = rngNext() * totalDist;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    centroids.push([...compositions[chosen]]);
  }

  const kActual = centroids.length;
  const assignments = new Int32Array(n);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each cell to nearest centroid
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestC = 0;
      let bestD = Infinity;
      for (let c = 0; c < kActual; c++) {
        let d = 0;
        for (let f = 0; f < nClusters; f++) {
          d += (compositions[i][f] - centroids[c][f]) ** 2;
        }
        if (d < bestD) { bestD = d; bestC = c; }
      }
      if (assignments[i] !== bestC) {
        assignments[i] = bestC;
        changed = true;
      }
    }
    if (!changed) break;

    // Recompute centroids
    for (let c = 0; c < kActual; c++) {
      const members = compositions.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;
      for (let f = 0; f < nClusters; f++) {
        centroids[c][f] = members.reduce((s, m) => s + m[f], 0) / members.length;
      }
    }
  }

  // Build niche results
  const nicheResults: ScSpatialNiche[] = [];
  for (let c = 0; c < kActual; c++) {
    const memberIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (assignments[i] === c) memberIndices.push(i);
    }
    if (memberIndices.length === 0) continue;

    // Composition: average proportion per cluster
    const composition: Record<string, number> = {};
    for (let ci = 0; ci < nClusters; ci++) {
      const avg = memberIndices.reduce((s, i) => s + compositions[i][ci], 0) / memberIndices.length;
      composition[uniqueClusters[ci]] = round(avg, 3);
    }

    // Dominant cluster
    let dominantCluster = uniqueClusters[0];
    let maxProp = 0;
    for (const [cluster, prop] of Object.entries(composition)) {
      if (prop > maxProp) { maxProp = prop; dominantCluster = cluster; }
    }

    // Centroid
    const centroidX = round(memberIndices.reduce((s, i) => s + cellPositions[i].x, 0) / memberIndices.length);
    const centroidY = round(memberIndices.reduce((s, i) => s + cellPositions[i].y, 0) / memberIndices.length);

    // Marker genes: genes with highest fold-change inside vs outside niche
    const insideMean = new Array(geneNames.length).fill(0);
    const outsideMean = new Array(geneNames.length).fill(0);
    const insideSet = new Set(memberIndices);
    let insideCount = 0;
    let outsideCount = 0;
    for (let i = 0; i < n; i++) {
      const target = insideSet.has(i) ? insideMean : outsideMean;
      if (insideSet.has(i)) insideCount++; else outsideCount++;
      for (let g = 0; g < geneNames.length; g++) {
        target[g] += (expression[g]?.[i] ?? 0);
      }
    }
    if (insideCount > 0) for (let g = 0; g < geneNames.length; g++) insideMean[g] /= insideCount;
    if (outsideCount > 0) for (let g = 0; g < geneNames.length; g++) outsideMean[g] /= outsideCount;

    const markerScores = geneNames.map((gene, g) => {
      const pseudocount = 0.01;
      const fc = (insideMean[g] + pseudocount) / (outsideMean[g] + pseudocount);
      return { gene, fc };
    });
    markerScores.sort((a, b) => b.fc - a.fc);
    const markerGenes = markerScores.slice(0, 5).map((m) => m.gene);

    nicheResults.push({
      id: `niche-${c + 1}`,
      cellCount: memberIndices.length,
      dominantCluster,
      composition,
      centroidX,
      centroidY,
      markerGenes,
    });
  }

  // Sort by cell count descending
  nicheResults.sort((a, b) => b.cellCount - a.cellCount);
  return nicheResults;
}

function buildSelectedCellDetail(
  artifact: ScSpatialNormalizedArtifact,
  cells: CellRecord[],
  selectedCellId: string | null,
  selectedGene: string,
  clusterLabels: string[],
) {
  if (!selectedCellId) return null;
  const cellIndex = cells.findIndex((cell) => cell.id === selectedCellId);
  if (cellIndex === -1) return null;
  const cell = cells[cellIndex];
  const obs = artifact.obs.find((record) => record.cellId === selectedCellId);
  return {
    cellId: cell.id,
    clusterLabel: clusterLabels[cell.cluster] ?? `Cluster ${cell.cluster + 1}`,
    cellType: cell.cellType,
    sampleId: obs?.sampleId ?? null,
    condition: obs?.condition ?? null,
    replicate: obs?.replicate ?? null,
    sampleMetadata: obs?.sampleMetadata ?? null,
    expression: round(cell.geneExpression[selectedGene] ?? 0),
    pseudotime: round(cell.pseudotime),
    spatialX: Number.isFinite(cell.spatialX) ? round(cell.spatialX) : undefined,
    spatialY: Number.isFinite(cell.spatialY) ? round(cell.spatialY) : undefined,
  };
}

export function buildScSpatialQueryResponse(
  artifact: ScSpatialNormalizedArtifact,
  request: ScSpatialQueryRequest,
): ScSpatialQueryResponse {
  const analysis = prepareAnalysis(artifact);
  const selectedGene = resolveSelectedGene(request, analysis.availableGenes);
  const clusterLabels = analysis.clusterResult.clusterSizes.map((cluster) => cluster.label);
  const requestedClusterSummaries = analysis.clusterSummaries.map((cluster) => ({
    ...cluster,
    meanExpression: round(
      mean(
        analysis.cells
          .filter((cell) => clusterLabels[cell.cluster] === cluster.clusterLabel)
          .map((cell) => cell.geneExpression[selectedGene] ?? 0),
      ),
    ),
  }));
  const selectedCluster = resolveSelectedCluster(
    { ...request, selectedGene },
    requestedClusterSummaries,
  );
  const viewMode = resolveViewMode(request.viewMode, analysis.datasetMeta);
  const viewPoints = buildViewPoints(
    viewMode,
    analysis.cells,
    analysis.umapPoints,
    selectedGene,
    selectedCluster,
    request.selectedCellId,
    clusterLabels,
  );
  const selectedCellId = resolveSelectedCellId(request, viewPoints, selectedCluster);
  const centerViewPoints = buildViewPoints(
    viewMode,
    analysis.cells,
    analysis.umapPoints,
    selectedGene,
    selectedCluster,
    selectedCellId,
    clusterLabels,
  );

  const selectedClusterSummary = requestedClusterSummaries.find((cluster) => cluster.clusterLabel === selectedCluster) ?? null;
  const selectedCell = buildSelectedCellDetail(
    artifact,
    analysis.cells,
    selectedCellId,
    selectedGene,
    clusterLabels,
  );

  return {
    artifactId: artifact.artifactId,
    validity: analysis.validity,
    datasetMeta: analysis.datasetMeta,
    availableGenes: analysis.availableGenes,
    availableClusters: analysis.availableClusters,
    selection: {
      selectedGene,
      selectedCluster,
      selectedCellId,
      viewMode,
      developerMode: request.developerMode,
    },
    centerView: {
      mode: viewMode,
      points: viewMode === 'trajectory' ? [] : centerViewPoints,
      xLabel: viewMode.startsWith('spatial') ? 'Spatial X' : viewMode === 'umap' ? 'UMAP 1' : 'Cell',
      yLabel: viewMode.startsWith('spatial') ? 'Spatial Y' : viewMode === 'umap' ? 'UMAP 2' : 'Expression',
      zLabel: viewMode === 'spatial-3d' ? `${selectedGene} expression` : undefined,
      trajectory: viewMode === 'trajectory'
        ? buildTrajectoryLayout(analysis.clusterResult, analysis.paga)
        : undefined,
    },
    rightPanel: {
      clusterSummaries: requestedClusterSummaries,
      selectedClusterSummary,
      selectedCell,
      hotspots: analysis.hotspots,
      coexpression: buildCoexpressionSummaries(analysis.cells, analysis.availableGenes, selectedGene),
      spatiallyVariableGenes: analysis.svgResults,
      niches: analysis.niches,
      provenance: {
        source: analysis.validity === 'demo' ? 'bundled-demo' : 'upload',
        fileName: artifact.source.fileName,
        validity: analysis.validity,
        warnings: analysis.warnings,
        missingFields: analysis.missingFields,
      },
    },
    exportData: {
      clusterAnnotations: analysis.cells.map((cell) => {
        const obs = artifact.obs.find((record) => record.cellId === cell.id);
        return {
          cellId: cell.id,
          clusterLabel: clusterLabels[cell.cluster] ?? `Cluster ${cell.cluster + 1}`,
          cellType: cell.cellType,
          sampleId: obs?.sampleId ?? null,
          condition: obs?.condition ?? null,
        };
      }),
      hotspotTable: analysis.hotspots,
      spatialPoints: analysis.cells
        .filter((cell) => Number.isFinite(cell.spatialX) && Number.isFinite(cell.spatialY))
        .map((cell) => ({
          cellId: cell.id,
          clusterLabel: clusterLabels[cell.cluster] ?? `Cluster ${cell.cluster + 1}`,
          x: round(cell.spatialX),
          y: round(cell.spatialY),
          expression: round(cell.geneExpression[selectedGene] ?? 0),
        })),
    },
    developer: {
      warnings: analysis.warnings,
      missingFields: analysis.missingFields,
      availableEmbeddings: analysis.datasetMeta.availableEmbeddings,
      availableLayers: analysis.datasetMeta.availableLayers,
    },
  };
}
