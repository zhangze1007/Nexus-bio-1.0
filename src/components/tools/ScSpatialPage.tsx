"use client";

import { HelpCircle, RefreshCcw } from "lucide-react";
import React, { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExpandedCommunicationResult } from "../../server/cellChat";
import { analyzeCommunicationExpanded, computeSpatialWeights } from "../../server/cellChat";
import { ingestScSpatialDemo, ingestScSpatialFile, queryScSpatial } from "../../services/ScSpatialAuthorityClient";
import { useScSpatialStore } from "../../store/scSpatialStore";
import { useWorkbenchStore } from "../../store/workbenchStore";
import { THEME } from "../../theme";
import { PAPER_THEME } from "../charts/chartTheme";
import DataSourceBadge from "../ide/shared/DataSourceBadge";
import ExportButton from "../ide/shared/ExportButton";
import SimErrorBanner from "../ide/shared/SimErrorBanner";
import ScSpatialControlRail, { type ScSpatialAnalysisParams } from "./scspatial/ScSpatialControlRail";
import ScSpatialHelpDialog from "./scspatial/ScSpatialHelpDialog";
import ScSpatialViewport from "./scspatial/ScSpatialViewport";
import styles from "./scspatial/ScSpatialWorkbench.module.css";
import { colorForCluster, SCSPATIAL_VIEW_LABELS } from "./scspatial/scSpatialPalette";
import InlineMetricOverlay from "./shared/InlineMetricOverlay";
import ToolShell from "./shared/ToolShell";
import ToolTabBar, { type ToolTab } from "./shared/ToolTabBar";
import ToolTabPanel from "./shared/ToolTabPanel";

const SCSPATIAL_TABS: ToolTab[] = [
  { id: "spatial-2d", label: "Hex Grid", accent: THEME.SKY },
  { id: "umap", label: "Projection", accent: THEME.LILAC },
  { id: "trajectory", label: "Clusters", accent: THEME.APRICOT },
  { id: "table", label: "Gene Expression", accent: THEME.MINT },
  { id: "communication", label: "Communication", accent: THEME.CORAL },
];

function readyClass(validity: "real" | "partial" | "demo" | null, loadState: string) {
  if (loadState === "uploading" || loadState === "querying") return styles.readyIdle;
  if (validity === "real") return styles.readyReal;
  if (validity === "partial") return styles.readyPartial;
  if (validity === "demo") return styles.readyDemo;
  return styles.readyIdle;
}

function readyLabel(validity: "real" | "partial" | "demo" | null, loadState: string) {
  if (loadState === "uploading") return "Loading…";
  if (loadState === "querying") return "Computing…";
  if (loadState === "error") return "Error";
  if (validity === "real") return "Ready";
  if (validity === "partial") return "Partial";
  if (validity === "demo") return "Demo";
  return "Idle";
}

export default React.memo(function ScSpatialPage() {
  const [activeTab, setActiveTab] = useState("spatial-2d");
  const [commResult, setCommResult] = useState<ExpandedCommunicationResult | null>(null);
  const [precomputedLigrec, setPrecomputedLigrec] = useState<Record<string, unknown> | null>(null);
  const [scspatialError, setScspatialError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const analyzeArtifact = useWorkbenchStore((state) => state.analyzeArtifact);
  const project = useWorkbenchStore((state) => state.project);
  const setToolPayload = useWorkbenchStore((state) => state.setToolPayload);

  const artifactId = useScSpatialStore((state) => state.artifactId);
  const availableClusters = useScSpatialStore((state) => state.availableClusters);
  const availableGenes = useScSpatialStore((state) => state.availableGenes);
  const datasetMeta = useScSpatialStore((state) => state.datasetMeta);
  const developerMode = useScSpatialStore((state) => state.developerMode);
  const error = useScSpatialStore((state) => state.error);
  const helpOpen = useScSpatialStore((state) => state.helpOpen);
  const loadState = useScSpatialStore((state) => state.loadState);
  const query = useScSpatialStore((state) => state.query);
  const selectedCellId = useScSpatialStore((state) => state.selectedCellId);
  const selectedCluster = useScSpatialStore((state) => state.selectedCluster);
  const selectedGene = useScSpatialStore((state) => state.selectedGene);
  const compareGene = useScSpatialStore((state) => state.compareGene);
  const showKde = useScSpatialStore((state) => state.showKde);
  const showNeighbors = useScSpatialStore((state) => state.showNeighbors);
  const neighborK = useScSpatialStore((state) => state.neighborK);
  const validity = useScSpatialStore((state) => state.validity);
  const viewMode = useScSpatialStore((state) => state.viewMode);

  const beginQuery = useScSpatialStore((state) => state.beginQuery);
  const beginUpload = useScSpatialStore((state) => state.beginUpload);
  const fail = useScSpatialStore((state) => state.fail);
  const hydrateFromQuery = useScSpatialStore((state) => state.hydrateFromQuery);
  const reset = useScSpatialStore((state) => state.reset);
  const setSelectedCellStore = useScSpatialStore((state) => state.setSelectedCellId);
  const setSelectedClusterStore = useScSpatialStore((state) => state.setSelectedCluster);
  const setSelectedGeneStore = useScSpatialStore((state) => state.setSelectedGene);
  const setCompareGeneStore = useScSpatialStore((state) => state.setCompareGene);
  const setViewModeStore = useScSpatialStore((state) => state.setViewMode);
  const toggleDeveloperMode = useScSpatialStore((state) => state.toggleDeveloperMode);
  const toggleHelp = useScSpatialStore((state) => state.toggleHelp);
  const toggleKde = useScSpatialStore((state) => state.toggleKde);
  const toggleNeighbors = useScSpatialStore((state) => state.toggleNeighbors);
  const setNeighborK = useScSpatialStore((state) => state.setNeighborK);

  const [analysisParams, setAnalysisParams] = useState<ScSpatialAnalysisParams>({
    leidenResolution: 1.0,
    nNeighbors: 15,
    nPcs: 30,
    nTopGenes: 2000,
    moranPerms: 1000,
    coordType: "auto",
  });

  const handleAnalysisParamChange = useCallback(
    <K extends keyof ScSpatialAnalysisParams>(key: K, value: ScSpatialAnalysisParams[K]) => {
      setAnalysisParams((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const loadDemo = useCallback(async () => {
    beginUpload();
    try {
      const response = await ingestScSpatialDemo(undefined, {
        leidenResolution: analysisParams.leidenResolution,
        nNeighbors: analysisParams.nNeighbors,
        nPcs: analysisParams.nPcs,
        nTopGenes: analysisParams.nTopGenes,
        moranPerms: analysisParams.moranPerms,
        coordType: analysisParams.coordType,
      });
      hydrateFromQuery(response.initialQuery);
    } catch (uploadError) {
      fail(uploadError instanceof Error ? uploadError.message : "Bundled demo could not be loaded");
    }
  }, [analysisParams, beginUpload, fail, hydrateFromQuery]);

  const uploadFile = useCallback(
    async (file: File) => {
      beginUpload();
      try {
        const response = await ingestScSpatialFile(file, {
          maxCells: 5000,
          leidenResolution: analysisParams.leidenResolution,
          nNeighbors: analysisParams.nNeighbors,
          nPcs: analysisParams.nPcs,
          nTopGenes: analysisParams.nTopGenes,
          moranPerms: analysisParams.moranPerms,
          coordType: analysisParams.coordType,
        });
        hydrateFromQuery(response.initialQuery);
      } catch (uploadError) {
        fail(uploadError instanceof Error ? uploadError.message : "SCSPATIAL upload failed");
      }
    },
    [analysisParams, beginUpload, fail, hydrateFromQuery],
  );

  const onFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await uploadFile(file);
      event.target.value = "";
    },
    [uploadFile],
  );

  const handleAnalyzeCommunication = useCallback(() => {
    if (!query) return;

    const clusterNames = query.availableClusters;
    if (clusterNames.length === 0) return;

    // If Python backend provided pre-computed ligrec results, use them directly
    const analysis = (query as unknown as Record<string, unknown>).analysis as
      | { ligrec?: Record<string, unknown> }
      | undefined;
    if (analysis?.ligrec) {
      setPrecomputedLigrec(analysis.ligrec);
      setCommResult(null); // Clear any previous client-side result
      return;
    }

    // Fall back to client-side CellChat-style analysis
    setPrecomputedLigrec(null);

    try {
      // Build multi-gene expression matrix from spatial points.
      // Primary: selected gene's per-cluster mean expression.
      // Enrichment: coexpression-correlated genes scaled by correlation.
      const geneClusterExpr: Record<string, Record<string, number>> = {};

      if (query.centerView.points.length > 0) {
        const selGene = query.selection.selectedGene;
        if (selGene) {
          // Aggregate per-cell expression into per-cluster means for selected gene
          const selAgg: Record<string, { sum: number; count: number }> = {};
          for (const pt of query.centerView.points) {
            const cid = pt.clusterId.toString();
            if (!selAgg[cid]) selAgg[cid] = { sum: 0, count: 0 };
            selAgg[cid].sum += pt.expression;
            selAgg[cid].count += 1;
          }
          geneClusterExpr[selGene] = {};
          for (const cid of clusterNames) {
            const agg = selAgg[cid];
            if (agg && agg.count > 0) {
              geneClusterExpr[selGene][cid] = agg.sum / agg.count;
            }
          }

          // Enrich with coexpression-correlated genes.
          // For each coexpressed gene, estimate per-cluster expression by
          // scaling the selected gene's cluster mean by the absolute correlation.
          for (const coex of query.rightPanel.coexpression) {
            if (geneClusterExpr[coex.geneSymbol]) continue;
            geneClusterExpr[coex.geneSymbol] = {};
            for (const cid of clusterNames) {
              const baseExpr = geneClusterExpr[selGene][cid] ?? 0;
              geneClusterExpr[coex.geneSymbol][cid] = Math.max(0, baseExpr * Math.abs(coex.correlation));
            }
          }
        }
      }

      // Build cell counts per cluster
      const cellCounts: Record<string, number> = {};
      for (const cs of query.rightPanel.clusterSummaries) {
        cellCounts[cs.clusterId.toString()] = cs.cellCount;
      }

      // Build spatial weight matrix from cell positions
      const positionsByCluster = new Map<string, { x: number; y: number }[]>();
      for (const pt of query.centerView.points) {
        const label = pt.clusterId.toString();
        let arr = positionsByCluster.get(label);
        if (!arr) {
          arr = [];
          positionsByCluster.set(label, arr);
        }
        arr.push({ x: pt.x, y: pt.y });
      }
      const spatialWeightMatrix =
        positionsByCluster.size > 0 ? computeSpatialWeights(positionsByCluster, clusterNames) : undefined;

      const result = analyzeCommunicationExpanded({
        expressionMatrix: geneClusterExpr,
        clusters: clusterNames,
        cellCounts,
        nPermutations: 200, // reduced from 1000 for client-side performance
        useExpandedDB: true, // 2780 L-R pairs
        spatialWeightMatrix,
      });

      setCommResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Communication analysis failed";
      setScspatialError(msg);
    }
  }, [query]);

  // Sync tab → viewMode in store
  useEffect(() => {
    const tabToView: Record<string, typeof viewMode> = {
      "spatial-2d": "spatial-2d",
      umap: "umap",
      trajectory: "trajectory",
      table: "table",
      // 'communication' intentionally omitted — analysis is client-side,
      // no need to trigger a server re-query when switching to this tab.
    };
    const mapped = tabToView[activeTab];
    if (mapped && mapped !== viewMode) {
      setViewModeStore(mapped);
    }
  }, [activeTab, viewMode, setViewModeStore]);

  useEffect(() => {
    if (!artifactId) return;
    const controller = new AbortController();
    beginQuery();
    queryScSpatial(
      {
        artifactId,
        selectedGene,
        selectedCluster,
        selectedCellId,
        viewMode,
        developerMode,
      },
      controller.signal,
    )
      .then((response) => {
        hydrateFromQuery(response);
      })
      .catch((queryError) => {
        if (controller.signal.aborted) return;
        fail(queryError instanceof Error ? queryError.message : "SCSPATIAL query failed");
      });

    return () => controller.abort();
  }, [
    artifactId,
    beginQuery,
    developerMode,
    fail,
    hydrateFromQuery,
    selectedCellId,
    selectedCluster,
    selectedGene,
    viewMode,
  ]);

  useEffect(() => {
    if (!query || !datasetMeta || !validity) return;
    setToolPayload("scspatial", {
      validity,
      toolId: "scspatial",
      artifactId: query.artifactId,
      source: query.rightPanel.provenance.source,
      targetProduct: analyzeArtifact?.targetProduct ?? project?.targetProduct ?? "Spatial transcriptomics program",
      sourceArtifactId: analyzeArtifact?.id,
      datasetMeta,
      selectedCluster: query.selection.selectedCluster,
      selectedCellId: query.selection.selectedCellId,
      highlightGene: query.selection.selectedGene,
      activeView: query.selection.viewMode,
      exportableArtifacts: ["cluster-annotations-csv", "hotspots-csv", "viewport-png"],
      result: {
        totalCells: datasetMeta.cellCount,
        passedCells: query.exportData.clusterAnnotations.length,
        topSpatialGene: query.rightPanel.hotspots[0]?.geneSymbol ?? query.selection.selectedGene,
        topMoranI: query.rightPanel.hotspots[0]?.moranI ?? 0,
        highestYieldCluster: query.rightPanel.clusterSummaries[0]?.clusterLabel ?? "Not available",
        hotspotCount: query.rightPanel.hotspots.length,
        // Spatial cluster assignments inform factor decomposition in downstream tools (MultiO)
        clusterSummaries: query.rightPanel.clusterSummaries.map((cs) => ({
          clusterId: cs.clusterId,
          clusterLabel: cs.clusterLabel,
          cellCount: cs.cellCount,
          meanExpression: cs.meanExpression,
          fate: cs.fate,
          topGenes: cs.topGenes,
        })),
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    datasetMeta,
    project?.targetProduct,
    query,
    setToolPayload,
    validity,
  ]);

  const selectionSummary = useMemo(() => {
    if (!query) {
      return "No normalized artifact is loaded.";
    }
    const cluster = query.selection.selectedCluster ?? "all clusters";
    const cell = query.selection.selectedCellId ?? "no cell selected";
    const view = SCSPATIAL_VIEW_LABELS[query.selection.viewMode];
    return `Current SCSPATIAL selection: ${view}, gene ${query.selection.selectedGene || "not selected"}, cluster ${cluster}, cell ${cell}.`;
  }, [query]);

  const artifactChipLabel = useMemo(() => {
    if (datasetMeta?.artifactId) return datasetMeta.artifactId;
    if (artifactId) return artifactId;
    return "NONE";
  }, [datasetMeta, artifactId]);

  return (
    <ToolShell
      moduleId="scspatial"
      title="Single-Cell Spatial Transcriptomics"
      formula="hex-grid · linear projection · Moran's I · cluster enrichment"
      tabs={SCSPATIAL_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={["trajectory", "table"]}
      footer={
        <>
          <DataSourceBadge
            source={validity === "real" ? "live" : "mock"}
            label={validity === "real" ? "Live Data" : validity === "partial" ? "Partial Data" : "Demo Data"}
          />
          <ExportButton
            label="Export Cluster CSV"
            data={query?.exportData.clusterAnnotations ?? []}
            filename="scspatial-cluster-annotations"
            format="csv"
            disabled={!query}
          />
          <ExportButton
            label="Export Hotspots CSV"
            data={query?.exportData.hotspotTable ?? []}
            filename="scspatial-hotspots"
            format="csv"
            disabled={!query}
          />
          <ExportButton
            label="Export View PNG"
            data={null}
            filename="scspatial-view"
            format="png"
            svgRef={svgRef}
            canvasRef={canvasRef}
            disabled={!query}
          />
        </>
      }
    >
      <p className={styles.srOnly} aria-live="polite">
        {selectionSummary}
      </p>
      <input ref={fileInputRef} type="file" accept=".h5ad,.zip" hidden onChange={onFileChange} />

      {error ? (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}
      {scspatialError && (
        <div style={{ padding: "0 0 8px" }}>
          <SimErrorBanner message={scspatialError} onRetry={() => setScspatialError(null)} />
        </div>
      )}

      <ToolTabPanel tabId={activeTab} activeId={activeTab}>
        {activeTab === "communication" ? (
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "20px",
              background: "#f3f6f8",
              color: "#111827",
              fontFamily: THEME.SANS,
            }}
          >
            {/* ── Header ───────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: THEME.MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#111827",
                }}
              >
                Cell-Cell Communication
              </h3>
              <button
                type="button"
                className={styles.button}
                style={{ width: "auto", padding: "0 14px" }}
                onClick={handleAnalyzeCommunication}
                disabled={!query}
              >
                Analyze Communication
              </button>
            </div>

            {!query ? (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  color: "#6b7280",
                  fontFamily: THEME.SANS,
                  fontSize: 13,
                }}
              >
                Load a dataset first (use the Hex Grid tab to upload or load demo data), then return here to analyze
                cell-cell communication.
              </div>
            ) : precomputedLigrec ? (
              <>
                {/* ── Pre-computed ligrec from Python backend (squidpy) ── */}
                <div className={styles.summaryGrid} style={{ marginBottom: 16 }}>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Analysis Engine</span>
                    <span className={styles.metricValue}>squidpy.gr.ligrec</span>
                    <span className={styles.metricDetail}>Ligand-receptor interaction via squidpy (Python)</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Data Source</span>
                    <span className={styles.metricValue}>Pre-computed</span>
                    <span className={styles.metricDetail}>
                      Results computed during ingest by scanpy/squidpy pipeline
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    padding: 20,
                    border: "2px solid #d1d5db",
                    borderRadius: 4,
                    background: "#ffffff",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 12px",
                      fontFamily: THEME.MONO,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#374151",
                    }}
                  >
                    Ligand-Receptor Results (squidpy)
                  </h4>
                  <pre
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: 11,
                      color: "#374151",
                      background: "#f6f7f9",
                      padding: 12,
                      borderRadius: 4,
                      border: "1px solid #e5e7eb",
                      overflow: "auto",
                      maxHeight: 400,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {JSON.stringify(precomputedLigrec, null, 2)}
                  </pre>
                </div>
              </>
            ) : !commResult ? (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  color: "#6b7280",
                  fontFamily: THEME.SANS,
                  fontSize: 13,
                }}
              >
                Click "Analyze Communication" to infer ligand-receptor interactions between {availableClusters.length}{" "}
                clusters across 2780+ L-R pairs, using multi-gene expression and spatial distance weighting.
              </div>
            ) : (
              <>
                {/* ── Summary Metrics ──────────────────────────── */}
                <div className={styles.summaryGrid} style={{ marginBottom: 16 }}>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Active Interactions</span>
                    <span className={styles.metricValue}>{commResult.interactions.length}</span>
                    <span className={styles.metricDetail}>ligand-receptor pairs with P &gt; 0</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Top Interaction</span>
                    <span className={styles.metricValue}>
                      {commResult.topInteractions[0]
                        ? `${commResult.topInteractions[0].ligand} -> ${commResult.topInteractions[0].receptor}`
                        : "—"}
                    </span>
                    <span className={styles.metricDetail}>
                      {commResult.topInteractions[0]
                        ? `P = ${commResult.topInteractions[0].probability.toFixed(3)}, ${commResult.topInteractions[0].pathway}`
                        : ""}
                    </span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Signaling Pathways</span>
                    <span className={styles.metricValue}>{Object.keys(commResult.pathwaySummary).length}</span>
                    <span className={styles.metricDetail}>pathways with active signaling</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Top Pathway</span>
                    <span className={styles.metricValue}>{commResult.pathwayDetails[0]?.pathway ?? "—"}</span>
                    <span className={styles.metricDetail}>
                      {commResult.pathwayDetails[0]
                        ? `strength ${commResult.pathwayDetails[0].totalStrength.toFixed(2)}, ${commResult.pathwayDetails[0].interactionCount} interactions`
                        : ""}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  {/* ── Network Visualization ──────────────────── */}
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      border: "2px solid #d1d5db",
                      borderRadius: 4,
                      background: "#ffffff",
                      padding: 12,
                    }}
                  >
                    <h4 className={styles.sectionTitle}>Communication Network</h4>
                    {(() => {
                      const n = availableClusters.length;
                      const cx = 280,
                        cy = 160,
                        r = 110;
                      const nodePos = availableClusters.map((_, i) => {
                        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
                        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
                      });

                      // Use network edges from result (includes interactionType)
                      const netEdges = commResult.network.edges;
                      const maxEdge = Math.max(...netEdges.map((e) => e.weight), 1);

                      // Cell count range for node sizing
                      const cellCountsArr = availableClusters.map((c) => {
                        const node = commResult.network.nodes.find((nd) => nd.id === c);
                        return node?.nCells ?? 0;
                      });
                      const maxCells = Math.max(...cellCountsArr, 1);

                      return (
                        <svg width="100%" viewBox="0 0 560 320" style={{ display: "block" }}>
                          <defs>
                            <marker
                              id="comm-arrow-signal"
                              viewBox="0 0 10 6"
                              refX="9"
                              refY="3"
                              markerWidth="8"
                              markerHeight="5"
                              orient="auto-start-reverse"
                            >
                              <path d="M0,0 L10,3 L0,6Z" fill="#60a5fa" />
                            </marker>
                            <marker
                              id="comm-arrow-inhibit"
                              viewBox="0 0 10 6"
                              refX="9"
                              refY="3"
                              markerWidth="8"
                              markerHeight="5"
                              orient="auto-start-reverse"
                            >
                              <path d="M0,0 L10,3 L0,6Z" fill="#f87171" />
                            </marker>
                          </defs>
                          {/* Edges — thickness by strength, color by interaction type */}
                          {netEdges.map((edge) => {
                            const si = availableClusters.indexOf(edge.source);
                            const ti = availableClusters.indexOf(edge.target);
                            if (si < 0 || ti < 0 || si === ti) return null;
                            const p1 = nodePos[si];
                            const p2 = nodePos[ti];
                            const strength = edge.weight / maxEdge;
                            if (strength < 0.02) return null;
                            const mx = (p1.x + p2.x) / 2 + (p2.y - p1.y) * 0.1;
                            const my = (p1.y + p2.y) / 2 - (p2.x - p1.x) * 0.1;
                            const strokeW = 0.8 + strength * 5;
                            const opacity = 0.2 + strength * 0.7;
                            const isInhibition = edge.interactionType === "inhibition";
                            const strokeColor = isInhibition ? "#f87171" : "#60a5fa";
                            const markerId = isInhibition ? "comm-arrow-inhibit" : "comm-arrow-signal";
                            return (
                              <path
                                key={`${edge.source}->${edge.target}`}
                                d={`M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={strokeW}
                                strokeOpacity={opacity}
                                markerEnd={`url(#${markerId})`}
                              />
                            );
                          })}
                          {/* Nodes — size proportional to cell count */}
                          {availableClusters.map((cluster, i) => {
                            const pos = nodePos[i];
                            const c = commResult.centrality[cluster];
                            const cellFrac = cellCountsArr[i] / maxCells;
                            const nodeR = 12 + cellFrac * 16 + (c ? c.totalStrength * 0.15 : 0);
                            const roleColor =
                              c?.dominantRole === "sender"
                                ? "#3b82f6"
                                : c?.dominantRole === "receiver"
                                  ? "#ef4444"
                                  : "#a855f7";
                            return (
                              <g key={cluster}>
                                <circle
                                  cx={pos.x}
                                  cy={pos.y}
                                  r={nodeR}
                                  fill={colorForCluster(i)}
                                  stroke={roleColor}
                                  strokeWidth={2}
                                />
                                <text
                                  x={pos.x}
                                  y={pos.y + 1}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  style={{ fontSize: 9, fontFamily: THEME.MONO, fontWeight: 600, fill: "#111827" }}
                                >
                                  {cluster.length > 8 ? cluster.slice(0, 7) + "..." : cluster}
                                </text>
                              </g>
                            );
                          })}
                          {/* Legend */}
                          <g transform="translate(420, 10)" style={{ fontSize: 9, fontFamily: THEME.MONO }}>
                            <rect x={0} y={0} width={130} height={90} rx={4} fill="#fafafa" stroke="#e5e7eb" />
                            <circle cx={12} cy={16} r={5} fill="#BFDCCD" stroke="#3b82f6" strokeWidth={1.5} />
                            <text x={22} y={19} fill="#4b5563">
                              Sender
                            </text>
                            <circle cx={12} cy={34} r={5} fill="#BFDCCD" stroke="#ef4444" strokeWidth={1.5} />
                            <text x={22} y={37} fill="#4b5563">
                              Receiver
                            </text>
                            <circle cx={12} cy={52} r={5} fill="#BFDCCD" stroke="#a855f7" strokeWidth={1.5} />
                            <text x={22} y={55} fill="#4b5563">
                              Mediator
                            </text>
                            <line x1={6} y1={70} x2={18} y2={70} stroke="#60a5fa" strokeWidth={2} />
                            <text x={22} y={73} fill="#4b5563">
                              Signaling
                            </text>
                            <line x1={6} y1={84} x2={18} y2={84} stroke="#f87171" strokeWidth={2} />
                            <text x={22} y={87} fill="#4b5563">
                              Inhibition
                            </text>
                          </g>
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  {/* ── Centrality Summary ─────────────────────── */}
                  <div
                    style={{
                      border: "2px solid #d1d5db",
                      borderRadius: 4,
                      background: "#ffffff",
                      padding: 12,
                    }}
                  >
                    <h4 className={styles.sectionTitle}>Cluster Centrality</h4>
                    <table className={styles.sciTable}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>Cluster</th>
                          <th style={{ textAlign: "right", padding: "4px 8px" }}>Outgoing</th>
                          <th style={{ textAlign: "right", padding: "4px 8px" }}>Incoming</th>
                          <th style={{ textAlign: "right", padding: "4px 8px" }}>Total</th>
                          <th style={{ textAlign: "center", padding: "4px 8px" }}>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableClusters.map((cluster, i) => {
                          const c = commResult.centrality[cluster];
                          if (!c) return null;
                          const roleBadge =
                            c.dominantRole === "sender"
                              ? { bg: "#dbeafe", color: "#1d4ed8" }
                              : c.dominantRole === "receiver"
                                ? { bg: "#fee2e2", color: "#dc2626" }
                                : { bg: "#f3e8ff", color: "#7c3aed" };
                          return (
                            <tr key={cluster}>
                              <td style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                                <span
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 2,
                                    background: colorForCluster(i),
                                    display: "inline-block",
                                    border: "1px solid #d1d5db",
                                  }}
                                />
                                {cluster}
                              </td>
                              <td
                                style={{ textAlign: "right", padding: "4px 8px", fontFamily: THEME.MONO, fontSize: 10 }}
                              >
                                {c.outgoingStrength.toFixed(3)}
                              </td>
                              <td
                                style={{ textAlign: "right", padding: "4px 8px", fontFamily: THEME.MONO, fontSize: 10 }}
                              >
                                {c.incomingStrength.toFixed(3)}
                              </td>
                              <td
                                style={{ textAlign: "right", padding: "4px 8px", fontFamily: THEME.MONO, fontSize: 10 }}
                              >
                                {c.totalStrength.toFixed(3)}
                              </td>
                              <td style={{ textAlign: "center", padding: "4px 8px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "1px 8px",
                                    borderRadius: 10,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    fontFamily: THEME.MONO,
                                    background: roleBadge.bg,
                                    color: roleBadge.color,
                                  }}
                                >
                                  {c.dominantRole}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Pathway Summary ────────────────────────── */}
                  <div
                    style={{
                      border: "2px solid #d1d5db",
                      borderRadius: 4,
                      background: "#ffffff",
                      padding: 12,
                    }}
                  >
                    <h4 className={styles.sectionTitle}>Pathway Summary</h4>
                    <table className={styles.sciTable}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>Pathway</th>
                          <th style={{ textAlign: "right", padding: "4px 8px" }}>Strength</th>
                          <th style={{ textAlign: "right", padding: "4px 8px" }}>Interactions</th>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>Top Sender</th>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>Top Receiver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commResult.pathwayDetails.map((pw) => (
                          <tr key={pw.pathway}>
                            <td style={{ padding: "4px 8px", fontWeight: 500 }}>{pw.pathway}</td>
                            <td
                              style={{ textAlign: "right", padding: "4px 8px", fontFamily: THEME.MONO, fontSize: 10 }}
                            >
                              {pw.totalStrength.toFixed(3)}
                            </td>
                            <td
                              style={{ textAlign: "right", padding: "4px 8px", fontFamily: THEME.MONO, fontSize: 10 }}
                            >
                              {pw.interactionCount}
                            </td>
                            <td style={{ padding: "4px 8px", fontSize: 10 }}>{pw.topSender}</td>
                            <td style={{ padding: "4px 8px", fontSize: 10 }}>{pw.topReceiver}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Top Interactions Table ────────────────────── */}
                <div
                  style={{
                    border: "2px solid #d1d5db",
                    borderRadius: 4,
                    background: "#ffffff",
                    padding: 12,
                  }}
                >
                  <h4 className={styles.sectionTitle}>Top Ligand-Receptor Interactions</h4>
                  <div style={{ overflowX: "auto" }}>
                    <table className={styles.sciTable}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>#</th>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>Ligand</th>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>Receptor</th>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>Pathway</th>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>Sender</th>
                          <th style={{ textAlign: "left", padding: "4px 8px" }}>Receiver</th>
                          <th style={{ textAlign: "right", padding: "4px 8px" }}>Probability</th>
                          <th style={{ textAlign: "right", padding: "4px 8px" }}>Significance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commResult.topInteractions.map((inter, idx) => (
                          <tr key={`${inter.ligand}-${inter.receptor}-${inter.sender}-${inter.receiver}-${idx}`}>
                            <td style={{ padding: "4px 8px", fontFamily: THEME.MONO, fontSize: 10, color: "#6b7280" }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: "4px 8px", fontWeight: 500 }}>{inter.ligand}</td>
                            <td style={{ padding: "4px 8px", fontWeight: 500 }}>{inter.receptor}</td>
                            <td style={{ padding: "4px 8px", fontSize: 10 }}>{inter.pathway}</td>
                            <td style={{ padding: "4px 8px", fontSize: 10 }}>{inter.sender}</td>
                            <td style={{ padding: "4px 8px", fontSize: 10 }}>{inter.receiver}</td>
                            <td
                              style={{ textAlign: "right", padding: "4px 8px", fontFamily: THEME.MONO, fontSize: 10 }}
                            >
                              {inter.probability.toFixed(4)}
                            </td>
                            <td style={{ textAlign: "right", padding: "4px 8px" }}>
                              <div
                                style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}
                              >
                                <div
                                  style={{
                                    width: 50,
                                    height: 5,
                                    borderRadius: 3,
                                    background: "#e5e7eb",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${Math.max(5, (1 - inter.pAdj) * 100)}%`,
                                      height: "100%",
                                      borderRadius: 3,
                                      background: inter.significant
                                        ? "#16a34a"
                                        : inter.pAdj < 0.1
                                          ? "#d97706"
                                          : "#dc2626",
                                    }}
                                  />
                                </div>
                                <span
                                  style={{ fontFamily: THEME.MONO, fontSize: 10, minWidth: 36, textAlign: "right" }}
                                >
                                  {inter.significant ? "✓" : `p=${inter.pAdj.toFixed(3)}`}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontFamily: THEME.SANS,
                      fontSize: 11,
                      fontStyle: "italic",
                      color: "#4b5563",
                      lineHeight: 1.5,
                    }}
                  >
                    Communication probabilities inferred via CellChat-style ligand-receptor co-expression model (Jin et
                    al., Nat Commun 2021) with spatial distance weighting. Multi-gene expression matrix used for robust
                    L-R inference. Edge colors: blue = signaling, red = inhibition. Node size reflects cluster cell
                    count. Significance assessed via permutation testing with Benjamini-Hochberg FDR correction.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={styles.layout}>
            <ScSpatialControlRail
              availableClusters={availableClusters}
              availableGenes={availableGenes}
              datasetMeta={
                datasetMeta
                  ? {
                      availableViews: datasetMeta.availableViews,
                      cellCount: datasetMeta.cellCount,
                      geneCount: datasetMeta.geneCount,
                      sampleCount: datasetMeta.sampleCount,
                      fileName: datasetMeta.fileName,
                      missingFields: datasetMeta.missingFields,
                      parserVersion: datasetMeta.parserVersion,
                      sampleMetadataKeys: datasetMeta.sampleMetadataKeys,
                      warnings: datasetMeta.warnings,
                    }
                  : null
              }
              developerMode={developerMode}
              loadState={loadState}
              selectedCluster={selectedCluster}
              selectedGene={selectedGene}
              compareGene={compareGene}
              showKde={showKde}
              showNeighbors={showNeighbors}
              neighborK={neighborK}
              analysisParams={analysisParams}
              onLoadDemo={loadDemo}
              onPickFile={() => fileInputRef.current?.click()}
              onSelectCluster={setSelectedClusterStore}
              onSelectGene={setSelectedGeneStore}
              onSetCompareGene={setCompareGeneStore}
              onToggleDeveloperMode={toggleDeveloperMode}
              onToggleKde={toggleKde}
              onToggleNeighbors={toggleNeighbors}
              onSetNeighborK={setNeighborK}
              onAnalysisParamChange={handleAnalysisParamChange}
              spatialFormat={
                query ? (((query as unknown as Record<string, unknown>).spatialFormat as string) ?? null) : null
              }
            />

            <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
              <ScSpatialViewport
                canvasRef={canvasRef}
                loadState={loadState}
                query={query}
                svgRef={svgRef}
                onSelectCell={setSelectedCellStore}
                compareGene={compareGene}
                showKde={showKde}
                showNeighbors={showNeighbors}
                neighborK={neighborK}
                heImageData={
                  query
                    ? (((query as unknown as Record<string, unknown>).heImage as {
                        data: string;
                        scaleFactor: number;
                        spotDiameter: number;
                      } | null) ?? null)
                    : null
                }
              />

              {query && (
                <InlineMetricOverlay
                  position="top-right"
                  metrics={[
                    { label: "Cells", value: `${datasetMeta?.cellCount ?? 0}`, accent: THEME.SKY },
                    { label: "Clusters", value: `${availableClusters.length}`, accent: THEME.LILAC },
                    { label: "Gene", value: selectedGene || "—", accent: THEME.MINT },
                    { label: "Hotspots", value: `${query.rightPanel.hotspots.length}`, accent: THEME.APRICOT },
                  ]}
                />
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                flexShrink: 0,
                borderTop: "1px solid #d1d5db",
                background: "#ffffff",
              }}
            >
              <span className={`${styles.readyIndicator} ${readyClass(validity, loadState)}`}>
                <span className={styles.readyDot} />
                {readyLabel(validity, loadState)}
              </span>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: "#4b5563",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: "#f6f7f9",
                  border: "1px solid #d1d5db",
                }}
              >
                {artifactChipLabel}
              </span>
              <button type="button" className={styles.headerIconButton} onClick={toggleHelp} aria-label="Toggle help">
                <HelpCircle size={13} />
              </button>
              <button type="button" className={styles.headerIconButton} onClick={reset} aria-label="Reset view">
                <RefreshCcw size={13} />
              </button>
            </div>
          </div>
        )}
      </ToolTabPanel>

      {helpOpen ? <ScSpatialHelpDialog onClose={toggleHelp} /> : null}
    </ToolShell>
  );
});
