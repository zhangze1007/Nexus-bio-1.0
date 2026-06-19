'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { HelpCircle, RefreshCcw } from 'lucide-react';
import ExportButton from '../ide/shared/ExportButton';
import ScSpatialControlRail from './scspatial/ScSpatialControlRail';
import ScSpatialHelpDialog from './scspatial/ScSpatialHelpDialog';
import ScSpatialViewport from './scspatial/ScSpatialViewport';
import styles from './scspatial/ScSpatialWorkbench.module.css';
import { SCSPATIAL_VIEW_LABELS } from './scspatial/scSpatialPalette';
import { ingestScSpatialDemo, ingestScSpatialFile, queryScSpatial } from '../../services/ScSpatialAuthorityClient';
import { useScSpatialStore } from '../../store/scSpatialStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import ToolShell from './shared/ToolShell';
import ToolTabBar, { type ToolTab } from './shared/ToolTabBar';
import ToolTabPanel from './shared/ToolTabPanel';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import { THEME } from '../../theme';
import { PAPER_THEME } from '../charts/chartTheme';
import { analyzeCommunication } from '../../server/cellChat';
import type { CommunicationResult } from '../../server/cellChat';
import { colorForCluster } from './scspatial/scSpatialPalette';

const SCSPATIAL_TABS: ToolTab[] = [
  { id: 'spatial-2d', label: 'Hex Grid', accent: THEME.SKY },
  { id: 'umap', label: 'Projection', accent: THEME.LILAC },
  { id: 'trajectory', label: 'Clusters', accent: THEME.APRICOT },
  { id: 'table', label: 'Gene Expression', accent: THEME.MINT },
  { id: 'communication', label: 'Communication', accent: THEME.CORAL },
];

function readyClass(validity: 'real' | 'partial' | 'demo' | null, loadState: string) {
  if (loadState === 'uploading' || loadState === 'querying') return styles.readyIdle;
  if (validity === 'real') return styles.readyReal;
  if (validity === 'partial') return styles.readyPartial;
  if (validity === 'demo') return styles.readyDemo;
  return styles.readyIdle;
}

function readyLabel(validity: 'real' | 'partial' | 'demo' | null, loadState: string) {
  if (loadState === 'uploading') return 'Loading…';
  if (loadState === 'querying') return 'Computing…';
  if (loadState === 'error') return 'Error';
  if (validity === 'real') return 'Ready';
  if (validity === 'partial') return 'Partial';
  if (validity === 'demo') return 'Demo';
  return 'Idle';
}

export default React.memo(function ScSpatialPage() {
  const [activeTab, setActiveTab] = useState('spatial-2d');
  const [commResult, setCommResult] = useState<CommunicationResult | null>(null);
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
  const setViewModeStore = useScSpatialStore((state) => state.setViewMode);
  const toggleDeveloperMode = useScSpatialStore((state) => state.toggleDeveloperMode);
  const toggleHelp = useScSpatialStore((state) => state.toggleHelp);

  const loadDemo = useCallback(async () => {
    beginUpload();
    try {
      const response = await ingestScSpatialDemo();
      hydrateFromQuery(response.initialQuery);
    } catch (uploadError) {
      fail(uploadError instanceof Error ? uploadError.message : 'Bundled demo could not be loaded');
    }
  }, [beginUpload, fail, hydrateFromQuery]);

  const uploadFile = useCallback(async (file: File) => {
    beginUpload();
    try {
      const response = await ingestScSpatialFile(file, {
        maxCells: 5000,
      });
      hydrateFromQuery(response.initialQuery);
    } catch (uploadError) {
      fail(uploadError instanceof Error ? uploadError.message : 'SCSPATIAL upload failed');
    }
  }, [beginUpload, fail, hydrateFromQuery]);

  const onFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    event.target.value = '';
  }, [uploadFile]);

  const handleAnalyzeCommunication = useCallback(() => {
    if (!query) return;

    const clusterNames = query.availableClusters;
    if (clusterNames.length === 0) return;

    // Build expression matrix from spatial points (per-cell expression for selected gene)
    const geneClusterExpr: Record<string, Record<string, number>> = {};

    if (query.centerView.points.length > 0) {
      // Aggregate per-cell expression into per-cluster means
      const geneAgg: Record<string, Record<string, { sum: number; count: number }>> = {};
      const selGene = query.selection.selectedGene;
      if (selGene) {
        geneAgg[selGene] = {};
        for (const pt of query.centerView.points) {
          const cid = pt.clusterId.toString();
          if (!geneAgg[selGene][cid]) geneAgg[selGene][cid] = { sum: 0, count: 0 };
          geneAgg[selGene][cid].sum += pt.expression;
          geneAgg[selGene][cid].count += 1;
        }
      }

      // Convert aggregated sums to mean expression matrix
      for (const [gene, clusterAgg] of Object.entries(geneAgg)) {
        geneClusterExpr[gene] = {};
        for (const cid of clusterNames) {
          const agg = clusterAgg[cid];
          if (agg && agg.count > 0) {
            geneClusterExpr[gene][cid] = agg.sum / agg.count;
          }
        }
      }
    }

    // Build cell counts per cluster
    const cellCounts: Record<string, number> = {};
    for (const cs of query.rightPanel.clusterSummaries) {
      cellCounts[cs.clusterId.toString()] = cs.cellCount;
    }

    const result = analyzeCommunication({
      expressionMatrix: geneClusterExpr,
      clusters: clusterNames,
      cellCounts,
    });

    setCommResult(result);
  }, [query]);

  // Sync tab → viewMode in store
  useEffect(() => {
    const tabToView: Record<string, typeof viewMode> = {
      'spatial-2d': 'spatial-2d',
      'umap': 'umap',
      'trajectory': 'trajectory',
      'table': 'table',
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
    queryScSpatial({
      artifactId,
      selectedGene,
      selectedCluster,
      selectedCellId,
      viewMode,
      developerMode,
    }, controller.signal)
      .then((response) => {
        hydrateFromQuery(response);
      })
      .catch((queryError) => {
        if (controller.signal.aborted) return;
        fail(queryError instanceof Error ? queryError.message : 'SCSPATIAL query failed');
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
    setToolPayload('scspatial', {
      validity,
      toolId: 'scspatial',
      artifactId: query.artifactId,
      source: query.rightPanel.provenance.source,
      targetProduct: analyzeArtifact?.targetProduct ?? project?.targetProduct ?? 'Spatial transcriptomics program',
      sourceArtifactId: analyzeArtifact?.id,
      datasetMeta,
      selectedCluster: query.selection.selectedCluster,
      selectedCellId: query.selection.selectedCellId,
      highlightGene: query.selection.selectedGene,
      activeView: query.selection.viewMode,
      exportableArtifacts: ['cluster-annotations-csv', 'hotspots-csv', 'viewport-png'],
      result: {
        totalCells: datasetMeta.cellCount,
        passedCells: query.exportData.clusterAnnotations.length,
        topSpatialGene: query.rightPanel.hotspots[0]?.geneSymbol ?? query.selection.selectedGene,
        topMoranI: query.rightPanel.hotspots[0]?.moranI ?? 0,
        highestYieldCluster: query.rightPanel.clusterSummaries[0]?.clusterLabel ?? 'Not available',
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
      return 'No normalized artifact is loaded.';
    }
    const cluster = query.selection.selectedCluster ?? 'all clusters';
    const cell = query.selection.selectedCellId ?? 'no cell selected';
    const view = SCSPATIAL_VIEW_LABELS[query.selection.viewMode];
    return `Current SCSPATIAL selection: ${view}, gene ${query.selection.selectedGene || 'not selected'}, cluster ${cluster}, cell ${cell}.`;
  }, [query]);

  const artifactChipLabel = useMemo(() => {
    if (datasetMeta?.artifactId) return datasetMeta.artifactId;
    if (artifactId) return artifactId;
    return 'NONE';
  }, [datasetMeta, artifactId]);

  return (
    <ToolShell
      moduleId="scspatial"
      title="Single-Cell Spatial Transcriptomics"
      formula="hex-grid · linear projection · Moran's I · cluster enrichment"
      tabs={SCSPATIAL_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['trajectory', 'table']}
      footer={
        <>
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".h5ad"
        hidden
        onChange={onFileChange}
      />

      {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

      <ToolTabPanel tabId={activeTab} activeId={activeTab}>
        {activeTab === 'communication' ? (
          <div style={{
            flex: 1, overflow: 'auto', padding: '20px',
            background: 'var(--sc-bg, #f3f6f8)', color: 'var(--sc-value, #111827)',
            fontFamily: 'var(--font-sans)',
          }}>
            {/* ── Header ───────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <h3 style={{
                margin: 0, fontFamily: THEME.MONO, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sc-value)',
              }}>
                Cell-Cell Communication
              </h3>
              <button
                type="button"
                className={styles.button}
                style={{ width: 'auto', padding: '0 14px' }}
                onClick={handleAnalyzeCommunication}
                disabled={!query}
              >
                Analyze Communication
              </button>
            </div>

            {!query ? (
              <div style={{
                padding: 32, textAlign: 'center', color: 'var(--sc-muted)',
                fontFamily: 'var(--font-sans)', fontSize: 13,
              }}>
                Load a dataset first (use the Hex Grid tab to upload or load demo data), then return here to analyze cell-cell communication.
              </div>
            ) : !commResult ? (
              <div style={{
                padding: 32, textAlign: 'center', color: 'var(--sc-muted)',
                fontFamily: 'var(--font-sans)', fontSize: 13,
              }}>
                Click "Analyze Communication" to infer ligand-receptor interactions between {availableClusters.length} clusters across 52 known L-R pairs.
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
                        : '—'}
                    </span>
                    <span className={styles.metricDetail}>
                      {commResult.topInteractions[0]
                        ? `P = ${commResult.topInteractions[0].probability.toFixed(3)}, ${commResult.topInteractions[0].pathway}`
                        : ''}
                    </span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Signaling Pathways</span>
                    <span className={styles.metricValue}>{Object.keys(commResult.pathwaySummary).length}</span>
                    <span className={styles.metricDetail}>pathways with active signaling</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Top Pathway</span>
                    <span className={styles.metricValue}>
                      {commResult.pathwayDetails[0]?.pathway ?? '—'}
                    </span>
                    <span className={styles.metricDetail}>
                      {commResult.pathwayDetails[0]
                        ? `strength ${commResult.pathwayDetails[0].totalStrength.toFixed(2)}, ${commResult.pathwayDetails[0].interactionCount} interactions`
                        : ''}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* ── Network Visualization ──────────────────── */}
                  <div style={{
                    gridColumn: '1 / -1', border: '1px solid var(--sc-border)',
                    borderRadius: 4, background: 'var(--sc-surface)',
                    padding: 12,
                  }}>
                    <h4 className={styles.sectionTitle}>Communication Network</h4>
                    {(() => {
                      const n = availableClusters.length;
                      const cx = 280, cy = 160, r = 110;
                      const nodePos = availableClusters.map((_, i) => {
                        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
                        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
                      });

                      // Build aggregated edge weights (sender -> receiver)
                      const edgeMap: Record<string, number> = {};
                      for (const inter of commResult.interactions) {
                        const key = `${inter.sender}->${inter.receiver}`;
                        edgeMap[key] = (edgeMap[key] ?? 0) + inter.probability;
                      }
                      const maxEdge = Math.max(...Object.values(edgeMap), 1);

                      return (
                        <svg width="100%" viewBox="0 0 560 320" style={{ display: 'block' }}>
                          <defs>
                            <marker id="comm-arrow" viewBox="0 0 10 6" refX="9" refY="3"
                              markerWidth="8" markerHeight="5" orient="auto-start-reverse">
                              <path d="M0,0 L10,3 L0,6Z" fill="#9ca3af" />
                            </marker>
                          </defs>
                          {/* Edges */}
                          {Object.entries(edgeMap).map(([key, weight]) => {
                            const [src, tgt] = key.split('->');
                            const si = availableClusters.indexOf(src);
                            const ti = availableClusters.indexOf(tgt);
                            if (si < 0 || ti < 0 || si === ti) return null;
                            const p1 = nodePos[si];
                            const p2 = nodePos[ti];
                            const strength = weight / maxEdge;
                            if (strength < 0.05) return null;
                            // Slight curve via midpoint offset
                            const mx = (p1.x + p2.x) / 2 + (p2.y - p1.y) * 0.1;
                            const my = (p1.y + p2.y) / 2 - (p2.x - p1.x) * 0.1;
                            const strokeW = 0.5 + strength * 3.5;
                            const opacity = 0.15 + strength * 0.7;
                            return (
                              <path
                                key={key}
                                d={`M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`}
                                fill="none"
                                stroke="#6b7280"
                                strokeWidth={strokeW}
                                strokeOpacity={opacity}
                                markerEnd="url(#comm-arrow)"
                              />
                            );
                          })}
                          {/* Nodes */}
                          {availableClusters.map((cluster, i) => {
                            const pos = nodePos[i];
                            const c = commResult.centrality[cluster];
                            const nodeR = 16 + (c ? c.totalStrength * 0.3 : 0);
                            const roleColor = c?.dominantRole === 'sender'
                              ? '#3b82f6'
                              : c?.dominantRole === 'receiver'
                                ? '#ef4444'
                                : '#a855f7';
                            return (
                              <g key={cluster}>
                                <circle cx={pos.x} cy={pos.y} r={nodeR}
                                  fill={colorForCluster(i)} stroke={roleColor} strokeWidth={2} />
                                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                                  style={{ fontSize: 9, fontFamily: THEME.MONO, fontWeight: 600, fill: '#111827' }}>
                                  {cluster.length > 8 ? cluster.slice(0, 7) + '...' : cluster}
                                </text>
                              </g>
                            );
                          })}
                          {/* Legend */}
                          <g transform="translate(440, 20)" style={{ fontSize: 9, fontFamily: THEME.MONO }}>
                            <rect x={0} y={0} width={110} height={70} rx={4} fill="var(--sc-surface-muted)" stroke="var(--sc-border)" />
                            <circle cx={12} cy={16} r={5} fill="#BFDCCD" stroke="#3b82f6" strokeWidth={1.5} />
                            <text x={22} y={19} fill="var(--sc-label)">Sender</text>
                            <circle cx={12} cy={34} r={5} fill="#BFDCCD" stroke="#ef4444" strokeWidth={1.5} />
                            <text x={22} y={37} fill="var(--sc-label)">Receiver</text>
                            <circle cx={12} cy={52} r={5} fill="#BFDCCD" stroke="#a855f7" strokeWidth={1.5} />
                            <text x={22} y={55} fill="var(--sc-label)">Mediator</text>
                          </g>
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  {/* ── Centrality Summary ─────────────────────── */}
                  <div style={{
                    border: '1px solid var(--sc-border)', borderRadius: 4,
                    background: 'var(--sc-surface)', padding: 12,
                  }}>
                    <h4 className={styles.sectionTitle}>Cluster Centrality</h4>
                    <table className={styles.sciTable}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Cluster</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Outgoing</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Incoming</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Total</th>
                          <th style={{ textAlign: 'center', padding: '4px 8px' }}>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableClusters.map((cluster, i) => {
                          const c = commResult.centrality[cluster];
                          if (!c) return null;
                          const roleBadge = c.dominantRole === 'sender'
                            ? { bg: '#dbeafe', color: '#1d4ed8' }
                            : c.dominantRole === 'receiver'
                              ? { bg: '#fee2e2', color: '#dc2626' }
                              : { bg: '#f3e8ff', color: '#7c3aed' };
                          return (
                            <tr key={cluster}>
                              <td style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  width: 10, height: 10, borderRadius: 2,
                                  background: colorForCluster(i), display: 'inline-block',
                                  border: '1px solid var(--sc-border-strong)',
                                }} />
                                {cluster}
                              </td>
                              <td style={{ textAlign: 'right', padding: '4px 8px', fontFamily: THEME.MONO, fontSize: 10 }}>
                                {c.outgoingStrength.toFixed(3)}
                              </td>
                              <td style={{ textAlign: 'right', padding: '4px 8px', fontFamily: THEME.MONO, fontSize: 10 }}>
                                {c.incomingStrength.toFixed(3)}
                              </td>
                              <td style={{ textAlign: 'right', padding: '4px 8px', fontFamily: THEME.MONO, fontSize: 10 }}>
                                {c.totalStrength.toFixed(3)}
                              </td>
                              <td style={{ textAlign: 'center', padding: '4px 8px' }}>
                                <span style={{
                                  display: 'inline-block', padding: '1px 8px', borderRadius: 10,
                                  fontSize: 9, fontWeight: 600, fontFamily: THEME.MONO,
                                  background: roleBadge.bg, color: roleBadge.color,
                                }}>
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
                  <div style={{
                    border: '1px solid var(--sc-border)', borderRadius: 4,
                    background: 'var(--sc-surface)', padding: 12,
                  }}>
                    <h4 className={styles.sectionTitle}>Pathway Summary</h4>
                    <table className={styles.sciTable}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Pathway</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Strength</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Interactions</th>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Top Sender</th>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Top Receiver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commResult.pathwayDetails.map((pw) => (
                          <tr key={pw.pathway}>
                            <td style={{ padding: '4px 8px', fontWeight: 500 }}>{pw.pathway}</td>
                            <td style={{ textAlign: 'right', padding: '4px 8px', fontFamily: THEME.MONO, fontSize: 10 }}>
                              {pw.totalStrength.toFixed(3)}
                            </td>
                            <td style={{ textAlign: 'right', padding: '4px 8px', fontFamily: THEME.MONO, fontSize: 10 }}>
                              {pw.interactionCount}
                            </td>
                            <td style={{ padding: '4px 8px', fontSize: 10 }}>{pw.topSender}</td>
                            <td style={{ padding: '4px 8px', fontSize: 10 }}>{pw.topReceiver}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Top Interactions Table ────────────────────── */}
                <div style={{
                  border: '1px solid var(--sc-border)', borderRadius: 4,
                  background: 'var(--sc-surface)', padding: 12,
                }}>
                  <h4 className={styles.sectionTitle}>Top Ligand-Receptor Interactions</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className={styles.sciTable}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>#</th>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Ligand</th>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Receptor</th>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Pathway</th>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Sender</th>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Receiver</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Probability</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Significance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commResult.topInteractions.map((inter, idx) => (
                          <tr key={`${inter.ligand}-${inter.receptor}-${inter.sender}-${inter.receiver}-${idx}`}>
                            <td style={{ padding: '4px 8px', fontFamily: THEME.MONO, fontSize: 10, color: 'var(--sc-muted)' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '4px 8px', fontWeight: 500 }}>{inter.ligand}</td>
                            <td style={{ padding: '4px 8px', fontWeight: 500 }}>{inter.receptor}</td>
                            <td style={{ padding: '4px 8px', fontSize: 10 }}>{inter.pathway}</td>
                            <td style={{ padding: '4px 8px', fontSize: 10 }}>{inter.sender}</td>
                            <td style={{ padding: '4px 8px', fontSize: 10 }}>{inter.receiver}</td>
                            <td style={{ textAlign: 'right', padding: '4px 8px', fontFamily: THEME.MONO, fontSize: 10 }}>
                              {inter.probability.toFixed(4)}
                            </td>
                            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                <div style={{
                                  width: 50, height: 5, borderRadius: 3,
                                  background: 'var(--sc-border)',
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    width: `${inter.significance * 100}%`,
                                    height: '100%',
                                    borderRadius: 3,
                                    background: inter.significance > 0.8 ? '#16a34a' : inter.significance > 0.5 ? '#d97706' : '#dc2626',
                                  }} />
                                </div>
                                <span style={{ fontFamily: THEME.MONO, fontSize: 10, minWidth: 36, textAlign: 'right' }}>
                                  {(inter.significance * 100).toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{
                    margin: '8px 0 0', fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: 11, fontStyle: 'italic', color: 'var(--sc-label)', lineHeight: 1.5,
                  }}>
                    Communication probabilities inferred via CellChat-style ligand-receptor co-expression model (Jin et al., Nat Commun 2021). Significance = percentile rank among all nonzero interactions.
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
              datasetMeta={datasetMeta ? {
                availableViews: datasetMeta.availableViews,
                cellCount: datasetMeta.cellCount,
                geneCount: datasetMeta.geneCount,
                sampleCount: datasetMeta.sampleCount,
                fileName: datasetMeta.fileName,
                missingFields: datasetMeta.missingFields,
                parserVersion: datasetMeta.parserVersion,
                sampleMetadataKeys: datasetMeta.sampleMetadataKeys,
                warnings: datasetMeta.warnings,
              } : null}
              developerMode={developerMode}
              loadState={loadState}
              selectedCluster={selectedCluster}
              selectedGene={selectedGene}
              onLoadDemo={loadDemo}
              onPickFile={() => fileInputRef.current?.click()}
              onSelectCluster={setSelectedClusterStore}
              onSelectGene={setSelectedGeneStore}
              onToggleDeveloperMode={toggleDeveloperMode}
            />

            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <ScSpatialViewport
                canvasRef={canvasRef}
                loadState={loadState}
                query={query}
                svgRef={svgRef}
                onSelectCell={setSelectedCellStore}
              />

              {query && (
                <InlineMetricOverlay
                  position="top-right"
                  metrics={[
                    { label: 'Cells', value: `${datasetMeta?.cellCount ?? 0}`, accent: THEME.SKY },
                    { label: 'Clusters', value: `${availableClusters.length}`, accent: THEME.LILAC },
                    { label: 'Gene', value: selectedGene || '—', accent: THEME.MINT },
                    { label: 'Hotspots', value: `${query.rightPanel.hotspots.length}`, accent: THEME.APRICOT },
                  ]}
                />
              )}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 12px', flexShrink: 0,
            }}>
              <span className={`${styles.readyIndicator} ${readyClass(validity, loadState)}`}>
                <span className={styles.readyDot} />
                {readyLabel(validity, loadState)}
              </span>
              <span style={{
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL,
                padding: '2px 8px', borderRadius: '6px',
                background: THEME.PANEL_INSET, border: `1px solid ${THEME.BORDER}`,
              }}>
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
