"""Pydantic request/response models for the Spatial Transcriptomics API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Analysis Parameters ─────────────────────────────────────────────


class QCParams(BaseModel):
    min_counts: int = Field(500, ge=0, description="Minimum UMI counts per cell")
    min_genes: int = Field(200, ge=0, description="Minimum detected genes per cell")
    max_mito_percent: float = Field(20.0, ge=0, le=100, description="Max mitochondrial %")


class NormalizationParams(BaseModel):
    target_sum: float = Field(1e4, gt=0, description="Library-size normalization target")


class HVGParams(BaseModel):
    n_top_genes: int = Field(2000, ge=50, le=10000, description="Number of HVGs")
    flavor: str = Field("seurat", description="HVG method: seurat, cell_ranger, seurat_v3")


class ClusteringParams(BaseModel):
    resolution: float = Field(1.0, ge=0.1, le=5.0, description="Leiden resolution")
    n_neighbors: int = Field(15, ge=2, le=100, description="KNN neighbors")
    n_pcs: int = Field(30, ge=5, le=100, description="Number of PCs")


class SpatialParams(BaseModel):
    coord_type: Optional[str] = Field(None, description="visium, generic, or None for auto")
    n_neighs: int = Field(6, ge=1, le=50, description="Spatial neighbors")
    delaunay: bool = Field(False, description="Use Delaunay triangulation")


class SpatialAutocorrParams(BaseModel):
    mode: str = Field("moran", description="moran or geary")
    n_perms: int = Field(1000, ge=0, le=10000, description="Permutations for p-value")


class AnalysisConfig(BaseModel):
    qc: QCParams = QCParams()
    normalization: NormalizationParams = NormalizationParams()
    hvg: HVGParams = HVGParams()
    clustering: ClusteringParams = ClusteringParams()
    spatial: SpatialParams = SpatialParams()
    spatial_autocorr: SpatialAutocorrParams = SpatialAutocorrParams()
    max_cells: int = Field(50000, ge=100, le=500000, description="Max cells to process")


# ── Job Status ──────────────────────────────────────────────────────


class JobStatus(BaseModel):
    job_id: str
    status: str  # "queued", "running", "completed", "failed"
    progress: float = Field(0.0, ge=0, le=1.0)
    stage: str = ""
    message: str = ""
    error: Optional[str] = None


class ProgressUpdate(BaseModel):
    progress: float
    stage: str
    message: str


# ── Artifact (matches ScSpatialNormalizedArtifact in TypeScript) ────


class SparseMatrixRow(BaseModel):
    indices: List[int]
    values: List[float]


class SparseMatrix(BaseModel):
    encoding: str = "row-sparse-v1"
    nObs: int
    nVars: int
    rows: List[SparseMatrixRow]


class CellRecord(BaseModel):
    cellId: str
    clusterLabel: Optional[str] = None
    cellType: Optional[str] = None
    batchId: Optional[Any] = None
    sampleId: Optional[str] = None
    condition: Optional[str] = None
    replicate: Optional[str] = None
    sampleMetadata: Optional[Dict[str, Any]] = None


class GeneRecord(BaseModel):
    geneId: str
    geneSymbol: str


class EmbeddingData(BaseModel):
    dimensions: int
    points: List[List[float]]


class ArtifactSource(BaseModel):
    fileName: str
    uploadedAt: int
    sampleCount: int
    parserVersion: str
    pythonVersion: Optional[str] = None


class ArtifactMetadata(BaseModel):
    warnings: List[str] = []
    missingFields: List[str] = []
    availableViews: Dict[str, bool] = {}
    extractedKeys: Dict[str, Any] = {}
    hasSpatialCoords: bool = False
    hasClusterLabels: bool = False
    hasPrecomputedUmap: bool = False


class SpatialNormalizedArtifact(BaseModel):
    schemaVersion: int = 1
    artifactId: str
    source: ArtifactSource
    matrix: Dict[str, Any]  # { X: SparseMatrix, layers: {...}, defaultLayer: "X" }
    obs: List[CellRecord]
    var: List[GeneRecord]
    obsm: Dict[str, Any]  # { spatial: [[x,y],...], embeddings: {...} }
    metadata: ArtifactMetadata

    # Pre-computed analysis results (new fields)
    analysis: Optional[Dict[str, Any]] = None
    # analysis contains:
    #   moranI: [{ gene, I, pval, pval_adjpval_adj, ... }]
    #   nhoodEnrichment: { zscore_matrix, clusters }
    #   ligrec: { means, pvalues, ... }
    #   markerGenes: { cluster -> [{ gene, logFC, pval_adj }] }
    #   paga: { connectivities, confidence }
    #   qcMetrics: { n_cells_before, n_cells_after, n_genes_before, n_genes_after }


# ── Query ───────────────────────────────────────────────────────────


class QueryRequest(BaseModel):
    artifactId: str
    selectedGene: Optional[str] = ""
    selectedCluster: Optional[str] = None
    selectedCellId: Optional[str] = None
    viewMode: str = "spatial-2d"
    developerMode: bool = False


# ── Ingest Response ─────────────────────────────────────────────────


class IngestResponse(BaseModel):
    ok: bool
    job_id: Optional[str] = None
    artifactId: Optional[str] = None
    status: str = ""
    error: Optional[str] = None
    detail: Optional[str] = None
