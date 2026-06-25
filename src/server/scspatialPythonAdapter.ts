/**
 * Adapter: Python backend response → ScSpatialQueryResponse.
 *
 * The Python backend (FastAPI + scanpy/squidpy) returns a simplified JSON
 * structure. This module normalizes it into the full ScSpatialQueryResponse
 * format that the TypeScript frontend expects.
 */

import type {
  ScSpatialClusterSummary,
  ScSpatialCoexpressionSummary,
  ScSpatialHotspotSummary,
  ScSpatialNiche,
  ScSpatialQueryResponse,
  ScSpatialSVGResult,
  ScSpatialValidity,
} from "../types/scspatial";

interface PythonQueryResponse {
  artifactId: string;
  validity: string;
  datasetMeta: {
    availableViews: Record<string, boolean>;
    cellCount: number;
    geneCount: number;
    sampleCount: number;
    fileName: string;
    missingFields: string[];
    parserVersion: string;
    sampleMetadataKeys: string[];
    warnings: string[];
  };
  selection: {
    selectedGene: string;
    selectedCluster: string | null;
    selectedCellId: string | null;
    viewMode: string;
  };
  centerView: {
    points: Array<{
      id: string;
      clusterId: number;
      clusterLabel: string;
      cellType: string;
      x: number;
      y: number;
      umapX: number;
      umapY: number;
      expression: number;
      pseudotime: number;
      selected: boolean;
    }>;
    xLabel: string;
    yLabel: string;
    trajectory?: {
      nodes: Array<{
        clusterId: number;
        clusterLabel: string;
        x: number;
        y: number;
        cellCount: number;
      }>;
      edges: Array<{
        from: number;
        to: number;
        weight: number;
      }>;
    };
  };
  rightPanel: {
    clusterSummaries: Array<{
      clusterId: number;
      clusterLabel: string;
      cellCount: number;
      meanExpression: number;
      fate: string;
      topGenes: string[];
    }>;
    hotspots: Array<{
      geneSymbol: string;
      moranI: number;
      pvalAdj: number;
      spatialPattern: string;
    }>;
    coexpression: Array<{
      geneSymbol: string;
      correlation: number;
    }>;
    selectedClusterSummary: {
      clusterId: number;
      clusterLabel: string;
      cellCount: number;
      meanExpression: number;
      fate: string;
      topGenes: string[];
    } | null;
    provenance: {
      source: string;
      engine: string;
    };
  };
  exportData: {
    clusterAnnotations: Array<Record<string, unknown>>;
    hotspotTable: Array<{
      geneSymbol: string;
      moranI: number;
      pvalAdj: number;
      spatialPattern: string;
    }>;
  };
  heImage?: { data: string; scaleFactor: number; spotDiameter: number } | null;
  spatialFormat?: string;
}

/**
 * Convert a Python backend query response into the full
 * ScSpatialQueryResponse format the frontend expects.
 */
export function adaptPythonQueryResponse(py: PythonQueryResponse): ScSpatialQueryResponse {
  const validity: ScSpatialValidity = py.validity === "real" ? "real" : py.validity === "partial" ? "partial" : "demo";

  // Build available genes from points' expression data
  // (Python backend doesn't return a gene list separately)
  const availableGenes: string[] = [];

  // Build available clusters
  const availableClusters = py.rightPanel.clusterSummaries.map((cs) => cs.clusterLabel);

  // Adapt center points
  const points = py.centerView.points.map((p) => ({
    id: p.id,
    clusterId: p.clusterId,
    clusterLabel: p.clusterLabel,
    cellType: p.cellType,
    x: p.x,
    y: p.y,
    umapX: p.umapX,
    umapY: p.umapY,
    expression: p.expression,
    pseudotime: p.pseudotime,
    selected: p.selected,
  }));

  // Adapt trajectory
  const trajectory = py.centerView.trajectory
    ? {
        nodes: py.centerView.trajectory.nodes.map((n) => ({
          clusterId: n.clusterId,
          clusterLabel: n.clusterLabel,
          x: n.x,
          y: n.y,
          cellCount: n.cellCount,
        })),
        edges: py.centerView.trajectory.edges.map((e) => ({
          from: e.from,
          to: e.to,
          weight: e.weight,
        })),
      }
    : { nodes: [], edges: [] };

  // Adapt cluster summaries
  const clusterSummaries: ScSpatialClusterSummary[] = py.rightPanel.clusterSummaries.map((cs) => ({
    clusterId: cs.clusterId,
    clusterLabel: cs.clusterLabel,
    cellCount: cs.cellCount,
    meanExpression: cs.meanExpression,
    meanPseudotime: 0,
    fate: (cs.fate as "productive" | "stressed" | "quiescent") || "quiescent",
    topGenes: cs.topGenes,
    spatiallyLocalized: false,
  }));

  // Adapt hotspots
  const hotspots: ScSpatialHotspotSummary[] = py.rightPanel.hotspots.map((h) => ({
    geneSymbol: h.geneSymbol,
    moranI: h.moranI,
    zScore: h.moranI * 10, // Approximate z-score from Moran's I
    pValue: h.pvalAdj,
    qValue: h.pvalAdj,
    pvalAdj: h.pvalAdj,
    isSpatiallyRestricted: (h.moranI || 0) > 0.1,
    hotspot: (h.moranI || 0) > 0.1 ? ("high" as const) : ("ns" as const),
    spatialPattern: h.spatialPattern as "clustered" | "dispersed" | "random",
  }));

  // Adapt coexpression
  const coexpression: ScSpatialCoexpressionSummary[] = py.rightPanel.coexpression.map((c) => ({
    geneSymbol: c.geneSymbol,
    correlation: c.correlation,
  }));

  // Selected cluster summary
  const selectedClusterSummary: ScSpatialClusterSummary | null = py.rightPanel.selectedClusterSummary
    ? {
        clusterId: py.rightPanel.selectedClusterSummary.clusterId,
        clusterLabel: py.rightPanel.selectedClusterSummary.clusterLabel,
        cellCount: py.rightPanel.selectedClusterSummary.cellCount,
        meanExpression: py.rightPanel.selectedClusterSummary.meanExpression,
        meanPseudotime: 0,
        fate: (py.rightPanel.selectedClusterSummary.fate as "productive" | "stressed" | "quiescent") || "quiescent",
        topGenes: py.rightPanel.selectedClusterSummary.topGenes,
        spatiallyLocalized: false,
      }
    : null;

  return {
    artifactId: py.artifactId,
    validity,
    datasetMeta: {
      artifactId: py.artifactId,
      datasetName: py.datasetMeta.fileName,
      fileName: py.datasetMeta.fileName,
      cellCount: py.datasetMeta.cellCount,
      geneCount: py.datasetMeta.geneCount,
      sampleCount: py.datasetMeta.sampleCount,
      hasSpatialCoords: py.datasetMeta.availableViews.spatial2d ?? false,
      hasPrecomputedUmap: py.datasetMeta.availableViews.umap ?? false,
      availableViews: {
        spatial2d: py.datasetMeta.availableViews.spatial2d ?? false,
        spatial3d: py.datasetMeta.availableViews.spatial3d ?? false,
        umap: py.datasetMeta.availableViews.umap ?? false,
        trajectory: py.datasetMeta.availableViews.trajectory ?? false,
        table: py.datasetMeta.availableViews.table ?? true,
      },
      warnings: py.datasetMeta.warnings,
      missingFields: py.datasetMeta.missingFields,
      sampleMetadataKeys: py.datasetMeta.sampleMetadataKeys,
      availableLayers: [],
      availableEmbeddings: [],
      parserVersion: py.datasetMeta.parserVersion,
    },
    availableGenes,
    availableClusters,
    selection: {
      selectedGene: py.selection.selectedGene,
      selectedCluster: py.selection.selectedCluster,
      selectedCellId: py.selection.selectedCellId,
      viewMode: py.selection.viewMode as import("../types/scspatial").ScSpatialViewMode,
      developerMode: false,
    },
    centerView: {
      mode: (py.selection.viewMode || "spatial-2d") as import("../types/scspatial").ScSpatialViewMode,
      points,
      xLabel: py.centerView.xLabel,
      yLabel: py.centerView.yLabel,
      trajectory,
    },
    rightPanel: {
      clusterSummaries,
      selectedClusterSummary,
      selectedCell: null,
      hotspots,
      coexpression,
      spatiallyVariableGenes: [] as ScSpatialSVGResult[],
      niches: [] as ScSpatialNiche[],
      provenance: {
        source: "upload" as const,
        fileName: py.datasetMeta.fileName,
        validity,
        warnings: py.datasetMeta.warnings,
        missingFields: py.datasetMeta.missingFields,
      },
    },
    exportData: {
      clusterAnnotations: py.exportData.clusterAnnotations.map((c) => ({
        cellId: String(c.cellId ?? ""),
        clusterLabel: String(c.clusterLabel ?? ""),
        cellType: String(c.cellType ?? ""),
        sampleId: c.sampleId != null ? String(c.sampleId) : null,
        condition: c.condition != null ? String(c.condition) : null,
      })),
      hotspotTable: hotspots,
      spatialPoints: points.map((p) => ({
        cellId: p.id,
        clusterLabel: p.clusterLabel,
        x: p.x,
        y: p.y,
        expression: p.expression,
      })),
    },
    developer: {
      warnings: py.datasetMeta.warnings,
      missingFields: py.datasetMeta.missingFields,
      availableEmbeddings: [],
      availableLayers: [],
    },
    analysis: (py as unknown as Record<string, unknown>).analysis as
      | import("../types/scspatial").ScSpatialAnalysisResults
      | undefined,
    heImage:
      ((py as unknown as Record<string, unknown>).heImage as
        | import("../types/scspatial").ScSpatialNormalizedArtifact["heImage"]
        | undefined) ?? undefined,
    spatialFormat:
      ((py as unknown as Record<string, unknown>)
        .spatialFormat as import("../types/scspatial").ScSpatialNormalizedArtifact["spatialFormat"]) || undefined,
  };
}
