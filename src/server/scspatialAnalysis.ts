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
} from '../services/ScSpatialEngine';
import type {
  ScSpatialClusterSummary,
  ScSpatialCoexpressionSummary,
  ScSpatialDatasetMeta,
  ScSpatialHotspotSummary,
  ScSpatialNormalizedArtifact,
  ScSpatialPointDatum,
  ScSpatialQueryRequest,
  ScSpatialQueryResponse,
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
    isSpatiallyRestricted: result.isSpatiallyRestricted,
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
