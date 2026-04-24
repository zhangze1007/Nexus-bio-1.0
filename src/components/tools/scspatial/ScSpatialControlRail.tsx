'use client';

import { useMemo, useState } from 'react';
import { FlaskConical, Layers3, Loader2, Search, UploadCloud } from 'lucide-react';
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

const VIEW_BUTTONS: Array<{ value: 'spatial-2d' | 'spatial-3d' | 'umap' | 'trajectory' | 'table'; label: string; availKey: keyof ScSpatialAvailableViews }> = [
  { value: 'spatial-2d', label: '2D', availKey: 'spatial2d' },
  { value: 'spatial-3d', label: '3D', availKey: 'spatial3d' },
  { value: 'umap', label: 'UMAP', availKey: 'umap' },
  { value: 'trajectory', label: 'Traj.', availKey: 'trajectory' },
  { value: 'table', label: 'Table', availKey: 'table' },
];

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className={styles.stepTitle}>
      <span className={styles.stepNumber}>{n}</span>
      {children}
    </h2>
  );
}

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

  const [geneQuery, setGeneQuery] = useState('');

  const filteredGenes = useMemo(() => {
    if (!geneQuery.trim()) return availableGenes.slice(0, 20);
    const needle = geneQuery.trim().toLowerCase();
    return availableGenes.filter((gene) => gene.toLowerCase().includes(needle)).slice(0, 20);
  }, [availableGenes, geneQuery]);

  return (
    <aside className={styles.rail} aria-label="SCSPATIAL controls">
      <div className={styles.railScroll}>
        <section className={styles.section}>
          <StepTitle n={1}>Load Data</StepTitle>
          <div className={styles.buttonRow}>
            <button type="button" className={styles.button} onClick={onPickFile} disabled={busy}>
              {busy ? <Loader2 size={13} /> : <UploadCloud size={13} />}
              Upload h5ad
            </button>
            <button type="button" className={styles.button} onClick={onLoadDemo} disabled={busy}>
              <FlaskConical size={13} />
              Demo
            </button>
          </div>
          {datasetMeta ? (
            <div className={styles.inlineStats}>
              <span><strong>{datasetMeta.cellCount.toLocaleString()}</strong>cells</span>
              <span><strong>{datasetMeta.geneCount.toLocaleString()}</strong>genes</span>
              <span><strong>{datasetMeta.sampleCount}</strong>samples</span>
            </div>
          ) : null}
        </section>

        <section className={styles.section}>
          <StepTitle n={2}>View</StepTitle>
          <div>
            <label className={styles.fieldLabel}>Mode</label>
            <div className={styles.chipRow}>
              {VIEW_BUTTONS.map((option) => {
                const available = viewAvailability[option.availKey];
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
          </div>
          <div>
            <label className={styles.fieldLabel}>Target Gene</label>
            <select
              aria-label="Target gene"
              className={styles.select}
              value={selectedGene}
              onChange={(event) => onSelectGene(event.target.value)}
              disabled={availableGenes.length === 0 || busy}
            >
              {availableGenes.length === 0 ? (
                <option value="">— No genes loaded —</option>
              ) : availableGenes.map((gene) => (
                <option key={gene} value={gene}>{gene}</option>
              ))}
            </select>
          </div>
        </section>

        <section className={styles.section}>
          <StepTitle n={3}>Filter</StepTitle>
          <div className={styles.inputWithIcon}>
            <Search className={styles.inputIcon} size={12} />
            <input
              type="text"
              className={styles.input}
              placeholder="Search genes (e.g. TGFB1)…"
              value={geneQuery}
              onChange={(event) => setGeneQuery(event.target.value)}
              disabled={availableGenes.length === 0 || busy}
              aria-label="Search genes"
            />
          </div>
          {geneQuery.trim() ? (
            <div className={styles.list}>
              {filteredGenes.length === 0 ? (
                <div className={styles.metricDetail}>No matches.</div>
              ) : filteredGenes.map((gene) => (
                <button
                  key={gene}
                  type="button"
                  className={`${styles.listButton} ${selectedGene === gene ? styles.listButtonActive : ''}`}
                  onClick={() => { onSelectGene(gene); setGeneQuery(''); }}
                >
                  <span className={styles.listPrimary}>{gene}</span>
                  {selectedGene === gene ? <span className={styles.listSecondary}>active</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          <label className={styles.fieldLabel}>Clusters</label>
          <div className={styles.list}>
            <button
              type="button"
              className={`${styles.listButton} ${selectedCluster === null ? styles.listButtonActive : ''}`}
              onClick={() => onSelectCluster(null)}
            >
              <span className={styles.listMeta}>
                <span className={styles.swatch} style={{ background: '#6b7280' }} />
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

        <details className={styles.advancedDetails}>
          <summary className={styles.advancedSummary}>Advanced</summary>
          <div className={styles.advancedBody}>
            <button
              type="button"
              className={`${styles.toggle} ${developerMode ? styles.toggleActive : ''}`}
              onClick={onToggleDeveloperMode}
            >
              <Layers3 size={13} />
              Developer mode
            </button>
            <div>
              <label className={styles.fieldLabel}>Reference Set</label>
              <select className={styles.select} defaultValue="" disabled>
                <option value="">— Select Reference Set —</option>
                <option>HALLMARK_EMT</option>
                <option>GLYCOLYSIS</option>
                <option>HYPOXIA_SIGNATURE</option>
              </select>
            </div>
            {datasetMeta ? (
              <div className={styles.inlineStats}>
                <span><strong>{datasetMeta.warnings.length}</strong>warnings</span>
                <span><strong>{datasetMeta.missingFields.length}</strong>missing</span>
                <span>parser <strong style={{ fontSize: 10 }}>{datasetMeta.parserVersion}</strong></span>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </aside>
  );
}
