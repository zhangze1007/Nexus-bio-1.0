export type ScSpatialValidity = 'real' | 'partial' | 'demo';
export type ScSpatialScalar = string | number | boolean;

export type ScSpatialViewMode =
  | 'spatial-2d'
  | 'spatial-3d'
  | 'umap'
  | 'trajectory'
  | 'table';

export interface ScSpatialSparseRow {
  indices: number[];
  values: number[];
}

export interface ScSpatialSparseMatrix {
  encoding: 'row-sparse-v1';
  nObs: number;
  nVars: number;
  rows: ScSpatialSparseRow[];
}

export interface ScSpatialObsRecord {
  cellId: string;
  clusterLabel?: string | null;
  cellType?: string | null;
  batchId?: string | number | null;
  sampleId?: string | null;
  condition?: string | null;
  replicate?: string | null;
  sampleMetadata?: Record<string, ScSpatialScalar | null> | null;
}

export interface ScSpatialVarRecord {
  geneId: string;
  geneSymbol: string;
}

export interface ScSpatialEmbeddingPayload {
  dimensions: number;
  points: number[][];
}

export interface ScSpatialAvailableViews {
  spatial2d: boolean;
  spatial3d: boolean;
  umap: boolean;
  trajectory: boolean;
  table: boolean;
}

export interface ScSpatialDatasetMeta {
  artifactId: string;
  datasetName: string;
  fileName: string;
  cellCount: number;
  geneCount: number;
  sampleCount: number;
  hasSpatialCoords: boolean;
  hasPrecomputedUmap: boolean;
  availableViews: ScSpatialAvailableViews;
  warnings: string[];
  missingFields: string[];
  clusterLabelKey?: string | null;
  cellTypeKey?: string | null;
  batchKey?: string | null;
  sampleMetadataKeys: string[];
  availableLayers: string[];
  availableEmbeddings: string[];
  parserVersion: string;
}

export interface ScSpatialNormalizedArtifact {
  schemaVersion: 1;
  artifactId: string;
  source: {
    fileName: string;
    uploadedAt: number;
    sampleCount: number;
    parserVersion: string;
    pythonVersion?: string | null;
  };
  matrix: {
    X: ScSpatialSparseMatrix;
    layers: Record<string, ScSpatialSparseMatrix>;
    defaultLayer: string;
  };
  obs: ScSpatialObsRecord[];
  var: ScSpatialVarRecord[];
  obsm: {
    spatial?: number[][];
    embeddings: Record<string, ScSpatialEmbeddingPayload>;
  };
  metadata: {
    warnings: string[];
    missingFields: string[];
    availableViews: ScSpatialAvailableViews;
    extractedKeys: {
      layers: string[];
      embeddings: string[];
      clusterLabelKey?: string | null;
      cellTypeKey?: string | null;
      batchKey?: string | null;
      sampleMetadataKeys: string[];
    };
    hasSpatialCoords: boolean;
    hasClusterLabels: boolean;
    hasPrecomputedUmap: boolean;
  };
}

export interface ScSpatialIngestConfig {
  clusterKey?: string;
  cellTypeKey?: string;
  batchKey?: string;
  sampleMetadataKeys?: string[];
  spatialKey?: string;
  embeddingKeys?: string[];
  layerKeys?: string[];
  maxCells?: number;
}

export interface ScSpatialSelectionState {
  selectedGene: string;
  selectedCluster: string | null;
  selectedCellId: string | null;
  viewMode: ScSpatialViewMode;
  developerMode: boolean;
}

export interface ScSpatialQueryRequest extends ScSpatialSelectionState {
  artifactId: string;
}

export interface ScSpatialPointDatum {
  id: string;
  clusterId: number;
  clusterLabel: string;
  cellType: string;
  x: number;
  y: number;
  z?: number;
  expression: number;
  pseudotime: number;
  selected: boolean;
}

export interface ScSpatialTrajectoryNode {
  clusterId: number;
  clusterLabel: string;
  cellCount: number;
  x: number;
  y: number;
}

export interface ScSpatialTrajectoryEdge {
  from: number;
  to: number;
  weight: number;
}

export interface ScSpatialCenterView {
  mode: ScSpatialViewMode;
  points: ScSpatialPointDatum[];
  xLabel: string;
  yLabel: string;
  zLabel?: string;
  trajectory?: {
    nodes: ScSpatialTrajectoryNode[];
    edges: ScSpatialTrajectoryEdge[];
  };
}

export interface ScSpatialHotspotSummary {
  geneSymbol: string;
  moranI: number;
  zScore: number;
  pValue: number;
  isSpatiallyRestricted: boolean;
}

export interface ScSpatialClusterSummary {
  clusterId: number;
  clusterLabel: string;
  cellCount: number;
  meanExpression: number;
  meanPseudotime: number;
  topGenes: string[];
  fate: 'productive' | 'stressed' | 'quiescent';
  spatiallyLocalized: boolean;
}

export interface ScSpatialCellDetail {
  cellId: string;
  clusterLabel: string;
  cellType: string;
  sampleId: string | null;
  condition: string | null;
  replicate?: string | null;
  sampleMetadata?: Record<string, ScSpatialScalar | null> | null;
  expression: number;
  pseudotime: number;
  spatialX?: number;
  spatialY?: number;
}

export interface ScSpatialCoexpressionSummary {
  geneSymbol: string;
  correlation: number;
}

export interface ScSpatialQueryResponse {
  artifactId: string;
  validity: ScSpatialValidity;
  datasetMeta: ScSpatialDatasetMeta;
  availableGenes: string[];
  availableClusters: string[];
  selection: ScSpatialSelectionState;
  centerView: ScSpatialCenterView;
  rightPanel: {
    clusterSummaries: ScSpatialClusterSummary[];
    selectedClusterSummary: ScSpatialClusterSummary | null;
    selectedCell: ScSpatialCellDetail | null;
    hotspots: ScSpatialHotspotSummary[];
    coexpression: ScSpatialCoexpressionSummary[];
    provenance: {
      source: 'upload' | 'bundled-demo';
      fileName: string;
      validity: ScSpatialValidity;
      warnings: string[];
      missingFields: string[];
    };
  };
  exportData: {
    clusterAnnotations: Array<{
      cellId: string;
      clusterLabel: string;
      cellType: string;
      sampleId: string | null;
      condition: string | null;
    }>;
    hotspotTable: ScSpatialHotspotSummary[];
    spatialPoints: Array<{
      cellId: string;
      clusterLabel: string;
      x: number;
      y: number;
      expression: number;
    }>;
  };
  developer: {
    warnings: string[];
    missingFields: string[];
    availableEmbeddings: string[];
    availableLayers: string[];
  };
}

export interface ScSpatialIngestResponse {
  ok: true;
  artifactId: string;
  validity: ScSpatialValidity;
  datasetMeta: ScSpatialDatasetMeta;
  initialQuery: ScSpatialQueryResponse;
}

export interface ScSpatialErrorResponse {
  ok: false;
  error: string;
  detail?: string;
}
