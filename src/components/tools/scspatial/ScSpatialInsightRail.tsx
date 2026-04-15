'use client';

import styles from './ScSpatialWorkbench.module.css';
import type { ScSpatialQueryResponse } from '../../../types/scspatial';
import { colorForCluster } from './scSpatialPalette';

interface ScSpatialInsightRailProps {
  query: ScSpatialQueryResponse | null;
}

export default function ScSpatialInsightRail({ query }: ScSpatialInsightRailProps) {
  if (!query) {
    return (
      <aside className={styles.rail} aria-label="SCSPATIAL analysis details">
        <div className={styles.railScroll}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Analysis</h2>
            <div className={styles.insightCard}>
              <div className={styles.metricDetail}>Load a normalized artifact to inspect cluster evidence, hotspots, coexpression, and provenance.</div>
            </div>
          </section>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.rail} aria-label="SCSPATIAL analysis details">
      <div className={styles.railScroll}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Selected cluster</h2>
          {query.rightPanel.selectedClusterSummary ? (
            <div className={styles.insightCard}>
              <div className={styles.insightRow}>
                <span>Cluster</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedClusterSummary.clusterLabel}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Cells</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedClusterSummary.cellCount}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Mean expression</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedClusterSummary.meanExpression.toFixed(2)}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Mean pseudotime</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedClusterSummary.meanPseudotime.toFixed(2)}</span>
              </div>
              <div className={styles.pillList}>
                {query.rightPanel.selectedClusterSummary.topGenes.map((gene) => (
                  <span key={gene} className={styles.pill}>{gene}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.insightCard}>
              <div className={styles.metricDetail}>Select a cluster to inspect its expression profile and hotspot relevance.</div>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Selected cell</h2>
          {query.rightPanel.selectedCell ? (
            <div className={styles.insightCard}>
              <div className={styles.insightRow}>
                <span>Cell</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedCell.cellId}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Cluster</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedCell.clusterLabel}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Type</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedCell.cellType}</span>
              </div>
              {query.rightPanel.selectedCell.sampleId ? (
                <div className={styles.insightRow}>
                  <span>Sample</span>
                  <span className={styles.insightStrong}>{query.rightPanel.selectedCell.sampleId}</span>
                </div>
              ) : null}
              {query.rightPanel.selectedCell.condition ? (
                <div className={styles.insightRow}>
                  <span>Condition</span>
                  <span className={styles.insightStrong}>{query.rightPanel.selectedCell.condition}</span>
                </div>
              ) : null}
              {query.rightPanel.selectedCell.replicate ? (
                <div className={styles.insightRow}>
                  <span>Replicate</span>
                  <span className={styles.insightStrong}>{query.rightPanel.selectedCell.replicate}</span>
                </div>
              ) : null}
              <div className={styles.insightRow}>
                <span>Expression</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedCell.expression.toFixed(2)}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Pseudotime</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedCell.pseudotime.toFixed(2)}</span>
              </div>
              {query.rightPanel.selectedCell.sampleMetadata ? (
                <div className={styles.pillList}>
                  {Object.entries(query.rightPanel.selectedCell.sampleMetadata)
                    .filter(([, value]) => value !== null && value !== '')
                    .map(([key, value]) => (
                    <span key={key} className={styles.pill}>{key}:{String(value ?? '—')}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.insightCard}>
              <div className={styles.metricDetail}>Click a point in the center view to inspect a single cell.</div>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Spatial hotspots</h2>
          <div className={styles.list}>
            {query.rightPanel.hotspots.slice(0, 6).map((hotspot) => (
              <div key={hotspot.geneSymbol} className={styles.insightCard}>
                <div className={styles.insightRow}>
                  <span>{hotspot.geneSymbol}</span>
                  <span className={styles.insightStrong}>I={hotspot.moranI.toFixed(2)}</span>
                </div>
                <div className={styles.insightRow}>
                  <span>z={hotspot.zScore.toFixed(2)}</span>
                  <span className={styles.insightStrong}>p={hotspot.pValue.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Coexpression</h2>
          <div className={styles.list}>
            {query.rightPanel.coexpression.map((entry) => (
              <div key={entry.geneSymbol} className={styles.insightCard}>
                <div className={styles.insightRow}>
                  <span>{entry.geneSymbol}</span>
                  <span className={styles.insightStrong}>{entry.correlation.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Cluster ledger</h2>
          <div className={styles.list}>
            {query.rightPanel.clusterSummaries.map((cluster) => (
              <div key={cluster.clusterLabel} className={styles.insightCard}>
                <div className={styles.insightRow}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span className={styles.swatch} style={{ background: colorForCluster(cluster.clusterId) }} />
                    {cluster.clusterLabel}
                  </span>
                  <span className={styles.insightStrong}>{cluster.cellCount}</span>
                </div>
                <div className={styles.insightRow}>
                  <span>Fate</span>
                  <span className={styles.insightStrong}>{cluster.fate}</span>
                </div>
                <div className={styles.insightRow}>
                  <span>Localized</span>
                  <span className={styles.insightStrong}>{cluster.spatiallyLocalized ? 'Yes' : 'No'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Provenance</h2>
          <div className={styles.insightCard}>
            <div className={styles.insightRow}>
              <span>Source</span>
              <span className={styles.insightStrong}>{query.rightPanel.provenance.source}</span>
            </div>
            <div className={styles.insightRow}>
              <span>Validity</span>
              <span className={styles.insightStrong}>{query.rightPanel.provenance.validity}</span>
            </div>
            <div className={styles.metricDetail}>{query.rightPanel.provenance.fileName}</div>
            {query.datasetMeta.sampleMetadataKeys.length > 0 ? (
              <div className={styles.pillList}>
                {query.datasetMeta.sampleMetadataKeys.map((field) => (
                  <span key={field} className={styles.pill}>{field}</span>
                ))}
              </div>
            ) : null}
            <div className={styles.pillList}>
              {query.rightPanel.provenance.missingFields.map((field) => (
                <span key={field} className={styles.pill}>{field}</span>
              ))}
            </div>
            {query.rightPanel.provenance.warnings.length > 0 ? (
              <div className={styles.metricDetail}>{query.rightPanel.provenance.warnings.join(' ')}</div>
            ) : null}
          </div>
        </section>

        {query.selection.developerMode ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Developer</h2>
            <div className={styles.developerPanel}>
              <div className={styles.insightRow}>
                <span>Embeddings</span>
                <span className={styles.insightStrong}>{query.developer.availableEmbeddings.join(', ') || 'backend umap'}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Layers</span>
                <span className={styles.insightStrong}>{query.developer.availableLayers.join(', ') || 'X'}</span>
              </div>
              <div className={styles.metricDetail}>
                {query.developer.warnings.join(' ')}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
