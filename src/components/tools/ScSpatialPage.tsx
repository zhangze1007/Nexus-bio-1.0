'use client';

import { useCallback, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import { HelpCircle, RefreshCcw } from 'lucide-react';
import ExportButton from '../ide/shared/ExportButton';
import ScSpatialControlRail from './scspatial/ScSpatialControlRail';
import ScSpatialHelpDialog from './scspatial/ScSpatialHelpDialog';
import ScSpatialInsightRail from './scspatial/ScSpatialInsightRail';
import ScSpatialViewport from './scspatial/ScSpatialViewport';
import styles from './scspatial/ScSpatialWorkbench.module.css';
import { SCSPATIAL_VIEW_LABELS } from './scspatial/scSpatialPalette';
import { ingestScSpatialDemo, ingestScSpatialFile, queryScSpatial } from '../../services/ScSpatialAuthorityClient';
import { useScSpatialStore } from '../../store/scSpatialStore';
import { useWorkbenchStore } from '../../store/workbenchStore';

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

const VIEW_OPTIONS: Array<{ value: 'spatial-2d' | 'spatial-3d' | 'umap' | 'trajectory' | 'table'; label: string }> = [
  { value: 'spatial-2d', label: 'View: Spatial Context' },
  { value: 'spatial-3d', label: 'View: 3D Spatial' },
  { value: 'umap', label: 'View: Feature Embedding' },
  { value: 'trajectory', label: 'View: Trajectory' },
  { value: 'table', label: 'View: Cell Table' },
];

export default function ScSpatialPage() {
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

  const viewAvailability = datasetMeta?.availableViews;
  const availableViewOptions = VIEW_OPTIONS.filter((option) => {
    if (!viewAvailability) return true;
    if (option.value === 'spatial-2d') return viewAvailability.spatial2d;
    if (option.value === 'spatial-3d') return viewAvailability.spatial3d;
    if (option.value === 'umap') return viewAvailability.umap;
    if (option.value === 'trajectory') return viewAvailability.trajectory;
    return viewAvailability.table;
  });

  return (
    <div className={styles.root}>
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

      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h1 className={styles.title}>SCSPATIAL</h1>
          <div className={styles.headerArtifact}>
            <span className={styles.headerArtifactLabel}>Artifact:</span>
            <span className={styles.headerChip}>{artifactChipLabel}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <span className={`${styles.readyIndicator} ${readyClass(validity, loadState)}`}>
            <span className={styles.readyDot} />
            {readyLabel(validity, loadState)}
          </span>
          <select
            className={styles.viewSelect}
            value={viewMode}
            onChange={(event) => setViewModeStore(event.target.value as typeof viewMode)}
            disabled={!datasetMeta}
            aria-label="Switch SCSPATIAL view"
          >
            {(availableViewOptions.length > 0 ? availableViewOptions : VIEW_OPTIONS).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" className={styles.headerIconButton} onClick={toggleHelp}>
            <HelpCircle size={13} />
            Help
          </button>
          <button type="button" className={styles.headerIconButton} onClick={reset}>
            <RefreshCcw size={13} />
            Reset
          </button>
        </div>
      </header>

      {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

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
          viewMode={viewMode}
          onLoadDemo={loadDemo}
          onPickFile={() => fileInputRef.current?.click()}
          onSelectCluster={setSelectedClusterStore}
          onSelectGene={setSelectedGeneStore}
          onSetViewMode={setViewModeStore}
          onToggleDeveloperMode={toggleDeveloperMode}
        />

        <ScSpatialViewport
          canvasRef={canvasRef}
          loadState={loadState}
          query={query}
          svgRef={svgRef}
          onSelectCell={setSelectedCellStore}
        />

        <ScSpatialInsightRail query={query} />
      </div>

      <footer className={styles.footer}>
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
      </footer>

      {helpOpen ? <ScSpatialHelpDialog onClose={toggleHelp} /> : null}
    </div>
  );
}
