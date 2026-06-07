'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
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
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { T } from '../ide/tokens';

const SCSPATIAL_TABS: ToolTab[] = [
  { id: 'spatial-2d', label: 'Hex Grid', accent: PATHD_THEME.sky },
  { id: 'umap', label: 'UMAP', accent: PATHD_THEME.lilac },
  { id: 'trajectory', label: 'Clusters', accent: PATHD_THEME.apricot },
  { id: 'table', label: 'Gene Expression', accent: PATHD_THEME.mint },
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

export default function ScSpatialPage() {
  const [activeTab, setActiveTab] = useState('spatial-2d');
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

  // Sync tab → viewMode in store
  useEffect(() => {
    const tabToView: Record<string, typeof viewMode> = {
      'spatial-2d': 'spatial-2d',
      'umap': 'umap',
      'trajectory': 'trajectory',
      'table': 'table',
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
      formula="hex-grid · UMAP · Moran's I · cluster enrichment"
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
                  { label: 'Cells', value: `${datasetMeta?.cellCount ?? 0}`, accent: PATHD_THEME.sky },
                  { label: 'Clusters', value: `${availableClusters.length}`, accent: PATHD_THEME.lilac },
                  { label: 'Gene', value: selectedGene || '—', accent: PATHD_THEME.mint },
                  { label: 'Hotspots', value: `${query.rightPanel.hotspots.length}`, accent: PATHD_THEME.apricot },
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
              fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label,
              padding: '2px 8px', borderRadius: '6px',
              background: PATHD_THEME.panelInset, border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
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
      </ToolTabPanel>

      {helpOpen ? <ScSpatialHelpDialog onClose={toggleHelp} /> : null}
    </ToolShell>
  );
}
