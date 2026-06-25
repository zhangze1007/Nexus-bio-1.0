'use client';

import { useMemo, useState } from 'react';
import { FlaskConical, Layers3, Loader2, Network, Search, UploadCloud } from 'lucide-react';
import styles from './ScSpatialWorkbench.module.css';
import { colorForCluster } from './scSpatialPalette';
import type { ScSpatialAvailableViews } from '../../../types/scspatial';

export interface ScSpatialAnalysisParams {
  leidenResolution: number;
  nNeighbors: number;
  nPcs: number;
  nTopGenes: number;
  moranPerms: number;
  coordType: 'auto' | 'visium' | 'generic';
}

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
  compareGene: string;
  showKde: boolean;
  showNeighbors: boolean;
  neighborK: number;
  analysisParams: ScSpatialAnalysisParams;
  spatialFormat?: string | null;
  onLoadDemo: () => void;
  onPickFile: () => void;
  onSelectCluster: (cluster: string | null) => void;
  onSelectGene: (gene: string) => void;
  onSetCompareGene: (gene: string) => void;
  onToggleDeveloperMode: () => void;
  onToggleKde: () => void;
  onToggleNeighbors: () => void;
  onSetNeighborK: (k: number) => void;
  onAnalysisParamChange: <K extends keyof ScSpatialAnalysisParams>(key: K, value: ScSpatialAnalysisParams[K]) => void;
}

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
  compareGene,
  showKde,
  showNeighbors,
  neighborK,
  analysisParams,
  spatialFormat,
  onLoadDemo,
  onPickFile,
  onSelectCluster,
  onSelectGene,
  onSetCompareGene,
  onToggleDeveloperMode,
  onToggleKde,
  onToggleNeighbors,
  onSetNeighborK,
  onAnalysisParamChange,
}: ScSpatialControlRailProps) {
  const busy = loadState === 'uploading' || loadState === 'querying';

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
              Upload Data
            </button>
            <button type="button" className={styles.button} onClick={onLoadDemo} disabled={busy}>
              <FlaskConical size={13} />
              Demo
            </button>
          </div>
          {spatialFormat && spatialFormat !== 'none' && (
            <span className={styles.badge} style={{ marginTop: 4 }}>
              {spatialFormat === 'visium' ? '10x Visium' :
               spatialFormat === 'merfish' ? 'MERFISH' :
               spatialFormat === 'generic' ? 'Spatial' : spatialFormat}
            </span>
          )}
          {datasetMeta ? (
            <div className={styles.inlineStats}>
              <span><strong>{datasetMeta.cellCount.toLocaleString()}</strong>cells</span>
              <span><strong>{datasetMeta.geneCount.toLocaleString()}</strong>genes</span>
              <span><strong>{datasetMeta.sampleCount}</strong>samples</span>
            </div>
          ) : null}
        </section>

        <section className={styles.section}>
          <StepTitle n={2}>Gene</StepTitle>
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
          <div>
            <label className={styles.fieldLabel}>Compare Gene (dual-channel)</label>
            <select
              aria-label="Compare gene"
              className={styles.select}
              value={compareGene}
              onChange={(event) => onSetCompareGene(event.target.value)}
              disabled={availableGenes.length === 0 || busy}
            >
              <option value="">— None —</option>
              {availableGenes.filter((g) => g !== selectedGene).map((gene) => (
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
            <button
              type="button"
              className={`${styles.toggle} ${showKde ? styles.toggleActive : ''}`}
              onClick={onToggleKde}
              disabled={busy}
            >
              Density heatmap
            </button>
            <button
              type="button"
              className={`${styles.toggle} ${showNeighbors ? styles.toggleActive : ''}`}
              onClick={onToggleNeighbors}
              disabled={busy}
            >
              <Network size={13} />
              Neighbor graph
            </button>
            {showNeighbors ? (
              <div>
                <label className={styles.fieldLabel}>K neighbors: {neighborK}</label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={neighborK}
                  onChange={(event) => onSetNeighborK(Number(event.target.value))}
                  className={styles.input}
                  aria-label="Number of nearest neighbors"
                />
              </div>
            ) : null}
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

            <div style={{ borderTop: '1px solid #d1d5db', margin: '8px 0', paddingTop: 8 }}>
              <label className={styles.fieldLabel} style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>
                Analysis Parameters
              </label>

              <div>
                <label className={styles.fieldLabel}>Leiden Resolution: {analysisParams.leidenResolution.toFixed(1)}</label>
                <input
                  type="range"
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  value={analysisParams.leidenResolution}
                  onChange={(e) => onAnalysisParamChange('leidenResolution', Number(e.target.value))}
                  className={styles.input}
                  aria-label="Leiden clustering resolution"
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>N Neighbors: {analysisParams.nNeighbors}</label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={1}
                  value={analysisParams.nNeighbors}
                  onChange={(e) => onAnalysisParamChange('nNeighbors', Number(e.target.value))}
                  className={styles.input}
                  aria-label="Number of neighbors for UMAP"
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>N PCs: {analysisParams.nPcs}</label>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={5}
                  value={analysisParams.nPcs}
                  onChange={(e) => onAnalysisParamChange('nPcs', Number(e.target.value))}
                  className={styles.input}
                  aria-label="Number of principal components"
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>N Top HVGs: {analysisParams.nTopGenes.toLocaleString()}</label>
                <input
                  type="range"
                  min={500}
                  max={5000}
                  step={500}
                  value={analysisParams.nTopGenes}
                  onChange={(e) => onAnalysisParamChange('nTopGenes', Number(e.target.value))}
                  className={styles.input}
                  aria-label="Number of top highly variable genes"
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>Moran's I Permutations: {analysisParams.moranPerms.toLocaleString()}</label>
                <input
                  type="range"
                  min={100}
                  max={10000}
                  step={100}
                  value={analysisParams.moranPerms}
                  onChange={(e) => onAnalysisParamChange('moranPerms', Number(e.target.value))}
                  className={styles.input}
                  aria-label="Moran's I permutation count"
                />
              </div>

              <div>
                <label className={styles.fieldLabel}>Coord Type</label>
                <select
                  className={styles.select}
                  value={analysisParams.coordType}
                  onChange={(e) => onAnalysisParamChange('coordType', e.target.value as 'auto' | 'visium' | 'generic')}
                  aria-label="Coordinate type"
                >
                  <option value="auto">Auto</option>
                  <option value="visium">Visium</option>
                  <option value="generic">Generic</option>
                </select>
              </div>
            </div>
          </div>
        </details>
      </div>
    </aside>
  );
}
