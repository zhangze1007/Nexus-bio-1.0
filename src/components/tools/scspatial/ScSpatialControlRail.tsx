'use client';

import { Database, FlaskConical, Layers3, Loader2, UploadCloud } from 'lucide-react';
import styles from './ScSpatialWorkbench.module.css';
import { colorForCluster } from './scSpatialPalette';
import type { ScSpatialAvailableViews } from '../../../types/scspatial';

interface ScSpatialControlRailProps {
  availableClusters: string[];
  availableGenes: string[];
  datasetMeta: {
    availableViews: ScSpatialAvailableViews;
    cellCount: number;
    geneCount: number;
    sampleCount: number;
    fileName: string;
    missingFields: string[];
    parserVersion: string;
    sampleMetadataKeys: string[];
    warnings: string[];
  } | null;
  developerMode: boolean;
  loadState: 'idle' | 'uploading' | 'querying' | 'ready' | 'error';
  selectedCluster: string | null;
  selectedGene: string;
  viewMode: 'spatial-2d' | 'spatial-3d' | 'umap' | 'trajectory' | 'table';
  onLoadDemo: () => void;
  onPickFile: () => void;
  onSelectCluster: (cluster: string | null) => void;
  onSelectGene: (gene: string) => void;
  onSetViewMode: (viewMode: 'spatial-2d' | 'spatial-3d' | 'umap' | 'trajectory' | 'table') => void;
  onToggleDeveloperMode: () => void;
}

const VIEW_OPTIONS: Array<{
  value: 'spatial-2d' | 'spatial-3d' | 'umap' | 'trajectory' | 'table';
  label: string;
}> = [
  { value: 'spatial-2d', label: '2D Spatial' },
  { value: 'spatial-3d', label: '3D Spatial' },
  { value: 'umap', label: 'UMAP' },
  { value: 'trajectory', label: 'Trajectory' },
  { value: 'table', label: 'Table' },
];

export default function ScSpatialControlRail({
  availableClusters,
  availableGenes,
  datasetMeta,
  developerMode,
  loadState,
  selectedCluster,
  selectedGene,
  viewMode,
  onLoadDemo,
  onPickFile,
  onSelectCluster,
  onSelectGene,
  onSetViewMode,
  onToggleDeveloperMode,
}: ScSpatialControlRailProps) {
  const busy = loadState === 'uploading' || loadState === 'querying';
  const viewAvailability = datasetMeta?.availableViews ?? {
    spatial2d: false,
    spatial3d: false,
    umap: false,
    trajectory: false,
    table: false,
  };

  return (
    <aside className={styles.rail} aria-label="SCSPATIAL controls">
      <div className={styles.railScroll}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Dataset</h2>
          <div className={styles.buttonRow}>
            <button type="button" className={styles.button} onClick={onPickFile} disabled={busy}>
              {busy ? <Loader2 size={16} /> : <UploadCloud size={16} />}
              Upload h5ad
            </button>
            <button type="button" className={styles.button} onClick={onLoadDemo} disabled={busy}>
              <FlaskConical size={16} />
              Demo
            </button>
          </div>
          {datasetMeta ? (
            <div className={styles.summaryGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Cells</span>
                <span className={styles.metricValue}>{datasetMeta.cellCount}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Genes</span>
                <span className={styles.metricValue}>{datasetMeta.geneCount}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Samples</span>
                <span className={styles.metricValue}>{datasetMeta.sampleCount}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Parser</span>
                <span className={styles.metricDetail}>{datasetMeta.parserVersion}</span>
              </div>
            </div>
          ) : null}
          {datasetMeta ? (
            <div className={styles.insightCard}>
              <div className={styles.insightRow}>
                <span>Source</span>
                <span className={styles.insightStrong}>{datasetMeta.fileName}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Warnings</span>
                <span className={styles.insightStrong}>{datasetMeta.warnings.length}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Missing</span>
                <span className={styles.insightStrong}>{datasetMeta.missingFields.length}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Sample keys</span>
                <span className={styles.insightStrong}>{datasetMeta.sampleMetadataKeys.length}</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Gene</h2>
          <select
            aria-label="Select highlighted gene"
            className={styles.select}
            value={selectedGene}
            onChange={(event) => onSelectGene(event.target.value)}
            disabled={availableGenes.length === 0 || busy}
          >
            {availableGenes.length === 0 ? (
              <option value="">No genes loaded</option>
            ) : availableGenes.map((gene) => (
              <option key={gene} value={gene}>{gene}</option>
            ))}
          </select>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>View</h2>
          <div className={styles.buttonRow}>
            {VIEW_OPTIONS.map((option) => {
              const available = option.value === 'spatial-2d'
                ? viewAvailability.spatial2d
                : option.value === 'spatial-3d'
                  ? viewAvailability.spatial3d
                  : option.value === 'umap'
                    ? viewAvailability.umap
                    : option.value === 'trajectory'
                      ? viewAvailability.trajectory
                      : viewAvailability.table;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.button} ${viewMode === option.value ? styles.buttonActive : ''} ${!available ? styles.buttonDisabled : ''}`}
                  onClick={() => onSetViewMode(option.value)}
                  disabled={!available || busy}
                  aria-disabled={!available || busy}
                  title={available ? option.label : `${option.label} unavailable for the current artifact`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Clusters</h2>
          <div className={styles.list}>
            <button
              type="button"
              className={`${styles.listButton} ${selectedCluster === null ? styles.listButtonActive : ''}`}
              onClick={() => onSelectCluster(null)}
            >
              <span className={styles.listMeta}>
                <span className={styles.swatch} style={{ background: 'var(--sc-sky)' }} />
                <span className={styles.listPrimary}>All clusters</span>
              </span>
            </button>
            {availableClusters.map((cluster, index) => (
              <button
                key={cluster}
                type="button"
                className={`${styles.listButton} ${selectedCluster === cluster ? styles.listButtonActive : ''}`}
                onClick={() => onSelectCluster(cluster)}
              >
                <span className={styles.listMeta}>
                  <span className={styles.swatch} style={{ background: colorForCluster(index) }} />
                  <span className={styles.listPrimary}>{cluster}</span>
                </span>
                <span className={styles.listSecondary}>#{index + 1}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Workbench</h2>
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={`${styles.toggle} ${developerMode ? styles.toggleActive : ''}`}
              onClick={onToggleDeveloperMode}
            >
              <Layers3 size={16} />
              Developer mode
            </button>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Source type</span>
              <span className={styles.metricDetail}>{datasetMeta ? 'Normalized artifact JSON' : 'No artifact loaded'}</span>
            </div>
          </div>
          <div className={styles.insightCard}>
            <div className={styles.insightRow}>
              <span>Payload contract</span>
              <span className={styles.insightStrong}><Database size={14} /> JSON only</span>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
