'use client';

import styles from './ScSpatialWorkbench.module.css';
import type { ScSpatialQueryResponse } from '../../../types/scspatial';
import { colorForCluster } from './scSpatialPalette';

interface ScSpatialInsightRailProps {
  query: ScSpatialQueryResponse | null;
}

function EvidentiarySummary({ query }: { query: ScSpatialQueryResponse }) {
  const topHotspot = query.rightPanel.hotspots[0];
  const gene = query.selection.selectedGene || 'Target gene';
  const copy = topHotspot
    ? `Spatial transcriptomics readout for ${gene}. Top spatially restricted signal observed at ${topHotspot.geneSymbol} (Moran's I ${topHotspot.moranI.toFixed(2)}).`
    : `Spatial transcriptomics readout for ${gene}. No spatially restricted signals passed the current threshold.`;
  return (
    <div className={styles.evidentiary}>
      <h2 className={styles.evidentiaryTitle}>Evidentiary Summary</h2>
      <p className={styles.evidentiaryBody}>{copy}</p>
    </div>
  );
}

function HotspotTable({ query }: { query: ScSpatialQueryResponse }) {
  const rows = query.rightPanel.hotspots.slice(0, 6);
  if (rows.length === 0) {
    return <div className={styles.metricDetail}>No spatial hotspots in current query.</div>;
  }
  return (
    <table className={styles.sciTable}>
      <thead>
        <tr>
          <th>Gene</th>
          <th className="num">Moran&apos;s I</th>
          <th className="num">p</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((hotspot) => (
          <tr key={hotspot.geneSymbol}>
            <td className={styles.gene ?? ''}>{hotspot.geneSymbol}</td>
            <td className="num">{hotspot.moranI.toFixed(2)}</td>
            <td className="num">{hotspot.pValue.toFixed(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LeadingEdgeProfile({ query }: { query: ScSpatialQueryResponse }) {
  const hotspots = query.rightPanel.hotspots.slice(0, 40);
  if (hotspots.length === 0) return null;
  const max = Math.max(...hotspots.map((h) => Math.abs(h.moranI)), 0.01);
  // Use the top-6 (significant) as leading-edge, rest muted — mirrors GSEA leading edge visual.
  const leadingCount = Math.min(6, hotspots.length);
  return (
    <div className={styles.leadingEdge}>
      <h4 className={styles.leadingEdgeTitle}>Leading Edge Profile (Spatial)</h4>
      <div className={styles.leadingEdgeBars} role="img" aria-label="Leading edge distribution of Moran's I">
        {hotspots.map((h, idx) => {
          const height = Math.max(8, (Math.abs(h.moranI) / max) * 100);
          const muted = idx >= leadingCount;
          return (
            <div
              key={`${h.geneSymbol}-${idx}`}
              className={`${styles.leadingEdgeBar} ${muted ? styles.muted : ''}`}
              style={{ height: `${height}%` }}
              title={`${h.geneSymbol} I=${h.moranI.toFixed(2)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ScSpatialInsightRail({ query }: ScSpatialInsightRailProps) {
  if (!query) {
    return (
      <aside className={styles.rail} aria-label="SCSPATIAL analysis details">
        <div className={styles.railScroll}>
          <div className={styles.evidentiary}>
            <h2 className={styles.evidentiaryTitle}>Evidentiary Summary</h2>
            <p className={styles.evidentiaryBody}>
              Load a normalized artifact to inspect cluster evidence, spatial hotspots, coexpression, and provenance.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.rail} aria-label="SCSPATIAL analysis details">
      <div className={styles.railScroll}>
        <EvidentiarySummary query={query} />

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Spatial Hotspots (Moran&apos;s I)</h3>
          <HotspotTable query={query} />
          <LeadingEdgeProfile query={query} />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Hotspot Context</h3>
          <div className={styles.list}>
            {query.rightPanel.hotspots.slice(0, 3).map((hotspot) => (
              <div key={hotspot.geneSymbol} className={styles.insightCard}>
                <div className={styles.insightRow}>
                  <span style={{ fontWeight: 600, color: 'var(--sc-value)' }}>Moran&apos;s I: {hotspot.geneSymbol}</span>
                  <span
                    className={styles.insightStrong}
                    style={{ color: hotspot.moranI > 0.3 ? '#dc2626' : hotspot.moranI > 0 ? '#d97706' : '#2563eb' }}
                  >
                    {hotspot.moranI.toFixed(2)}
                  </span>
                </div>
                <div className={styles.insightRow}>
                  <span style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: 10, color: 'var(--sc-muted)' }}>
                    z={hotspot.zScore.toFixed(2)}, {hotspot.isSpatiallyRestricted ? 'spatially restricted' : 'diffuse'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {query.rightPanel.coexpression.length > 0 ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Coexpression</h3>
            <table className={styles.sciTable}>
              <thead>
                <tr>
                  <th>Gene</th>
                  <th className="num">r</th>
                </tr>
              </thead>
              <tbody>
                {query.rightPanel.coexpression.slice(0, 5).map((entry) => (
                  <tr key={entry.geneSymbol}>
                    <td className={styles.gene ?? ''}>{entry.geneSymbol}</td>
                    <td
                      className="num"
                      style={{ color: entry.correlation < 0 ? '#2563eb' : '#dc2626' }}
                    >
                      {entry.correlation.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Selected Cluster</h3>
          {query.rightPanel.selectedClusterSummary ? (
            <div className={styles.insightCard}>
              <div className={styles.insightRow}>
                <span>Cluster</span>
                <span className={styles.insightStrong}>
                  <span className={styles.swatch} style={{ background: colorForCluster(query.rightPanel.selectedClusterSummary.clusterId) }} />
                  {query.rightPanel.selectedClusterSummary.clusterLabel}
                </span>
              </div>
              <div className={styles.insightRow}>
                <span>Cells</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedClusterSummary.cellCount}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Mean expr.</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedClusterSummary.meanExpression.toFixed(2)}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Pseudotime</span>
                <span className={styles.insightStrong}>{query.rightPanel.selectedClusterSummary.meanPseudotime.toFixed(2)}</span>
              </div>
              <div className={styles.pillList}>
                {query.rightPanel.selectedClusterSummary.topGenes.map((gene) => (
                  <span key={gene} className={styles.pill}>{gene}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.metricDetail}>Select a cluster to inspect its expression profile.</div>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Selected Cell</h3>
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
                    .slice(0, 4)
                    .map(([key, value]) => (
                      <span key={key} className={styles.pill}>{key}:{String(value ?? '—')}</span>
                    ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.metricDetail}>Click a point in the center view to inspect a single cell.</div>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Cluster Ledger</h3>
          <table className={styles.sciTable}>
            <thead>
              <tr>
                <th>Cluster</th>
                <th className="num">Cells</th>
                <th>Fate</th>
              </tr>
            </thead>
            <tbody>
              {query.rightPanel.clusterSummaries.slice(0, 8).map((cluster) => (
                <tr key={cluster.clusterLabel}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className={styles.swatch} style={{ background: colorForCluster(cluster.clusterId) }} />
                      {cluster.clusterLabel}
                    </span>
                  </td>
                  <td className="num">{cluster.cellCount}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--sc-label)' }}>
                    {cluster.fate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Provenance</h3>
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
            {query.rightPanel.provenance.missingFields.length > 0 ? (
              <div className={styles.pillList}>
                {query.rightPanel.provenance.missingFields.map((field) => (
                  <span key={field} className={styles.pill} style={{ color: '#d97706', borderColor: '#fcd34d' }}>missing: {field}</span>
                ))}
              </div>
            ) : null}
            {query.rightPanel.provenance.warnings.length > 0 ? (
              <div className={styles.metricDetail}>{query.rightPanel.provenance.warnings.join(' ')}</div>
            ) : null}
          </div>
        </section>

        {query.selection.developerMode ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Developer</h3>
            <div className={styles.developerPanel}>
              <div className={styles.insightRow}>
                <span>Embeddings</span>
                <span className={styles.insightStrong}>{query.developer.availableEmbeddings.join(', ') || 'backend umap'}</span>
              </div>
              <div className={styles.insightRow}>
                <span>Layers</span>
                <span className={styles.insightStrong}>{query.developer.availableLayers.join(', ') || 'X'}</span>
              </div>
              {query.developer.warnings.length > 0 ? (
                <div className={styles.metricDetail}>{query.developer.warnings.join(' ')}</div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
