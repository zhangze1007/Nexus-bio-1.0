'use client';

import styles from './ScSpatialWorkbench.module.css';
import type { ScSpatialQueryResponse } from '../../../types/scspatial';
import { colorForCluster } from './scSpatialPalette';

interface ScSpatialInsightRailProps {
  query: ScSpatialQueryResponse | null;
}

function headlineText(query: ScSpatialQueryResponse): string {
  const gene = query.selection.selectedGene || 'Target gene';
  const topHotspot = query.rightPanel.hotspots[0];
  if (topHotspot) {
    return `${gene} readout · top spatially-restricted signal at ${topHotspot.geneSymbol} (Moran's I ${topHotspot.moranI.toFixed(2)}, p ${topHotspot.pValue.toFixed(3)}).`;
  }
  return `${gene} readout · no spatially-restricted signals passed the current threshold.`;
}

function nextStepText(query: ScSpatialQueryResponse): string {
  const topHotspot = query.rightPanel.hotspots[0];
  const selectedCluster = query.rightPanel.selectedClusterSummary;
  const selectedCell = query.rightPanel.selectedCell;

  if (!selectedCluster && topHotspot) {
    return `Pick the cluster with strongest ${topHotspot.geneSymbol} signal in the scatter to inspect its marker profile.`;
  }
  if (selectedCluster && !selectedCell) {
    return `Click a point in ${selectedCluster.clusterLabel} to see per-cell expression and pseudotime.`;
  }
  if (selectedCell) {
    return `Export the cluster annotations CSV to persist this selection into the DBTL ledger.`;
  }
  return 'Load a normalized artifact or run the bundled demo to begin.';
}

function RunSummary({ query }: { query: ScSpatialQueryResponse }) {
  const topHotspot = query.rightPanel.hotspots[0];
  const clusterCount = query.rightPanel.clusterSummaries.length;
  const hotspotCount = query.rightPanel.hotspots.length;

  return (
    <div className={styles.runSummary}>
      <p className={styles.runSummaryLabel}>Run Summary</p>
      <p className={styles.runSummaryHeadline}>{headlineText(query)}</p>
      <div className={styles.kpiGrid}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Top hotspot</span>
          <span className={styles.kpiValueMono}>{topHotspot?.geneSymbol ?? '—'}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Moran&apos;s I</span>
          <span className={styles.kpiValue}>{topHotspot ? topHotspot.moranI.toFixed(2) : '—'}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Clusters</span>
          <span className={styles.kpiValue}>{clusterCount}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Hotspots</span>
          <span className={styles.kpiValue}>{hotspotCount}</span>
        </div>
      </div>
      <div className={styles.nextStep}>
        <span className={styles.nextStepLabel}>Next step</span>
        <p className={styles.nextStepText}>{nextStepText(query)}</p>
      </div>
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

function SelectedClusterCard({ query }: { query: ScSpatialQueryResponse }) {
  const summary = query.rightPanel.selectedClusterSummary;
  if (!summary) {
    return <div className={styles.metricDetail}>Select a cluster to inspect its expression profile.</div>;
  }
  return (
    <div className={styles.insightCard}>
      <div className={styles.insightRow}>
        <span>Cluster</span>
        <span className={styles.insightStrong}>
          <span className={styles.swatch} style={{ background: colorForCluster(summary.clusterId) }} />
          {summary.clusterLabel}
        </span>
      </div>
      <div className={styles.insightRow}>
        <span>Cells</span>
        <span className={styles.insightStrong}>{summary.cellCount}</span>
      </div>
      <div className={styles.insightRow}>
        <span>Mean expr.</span>
        <span className={styles.insightStrong}>{summary.meanExpression.toFixed(2)}</span>
      </div>
      <div className={styles.insightRow}>
        <span>Pseudotime</span>
        <span className={styles.insightStrong}>{summary.meanPseudotime.toFixed(2)}</span>
      </div>
      <div className={styles.pillList}>
        {summary.topGenes.map((gene) => (
          <span key={gene} className={styles.pill}>{gene}</span>
        ))}
      </div>
    </div>
  );
}

function SelectedCellCard({ query }: { query: ScSpatialQueryResponse }) {
  const cell = query.rightPanel.selectedCell;
  if (!cell) {
    return <div className={styles.metricDetail}>Click a point in the center view to inspect a single cell.</div>;
  }
  return (
    <div className={styles.insightCard}>
      <div className={styles.insightRow}>
        <span>Cell</span>
        <span className={styles.insightStrong}>{cell.cellId}</span>
      </div>
      <div className={styles.insightRow}>
        <span>Cluster</span>
        <span className={styles.insightStrong}>{cell.clusterLabel}</span>
      </div>
      <div className={styles.insightRow}>
        <span>Type</span>
        <span className={styles.insightStrong}>{cell.cellType}</span>
      </div>
      <div className={styles.insightRow}>
        <span>Expression</span>
        <span className={styles.insightStrong}>{cell.expression.toFixed(2)}</span>
      </div>
      <div className={styles.insightRow}>
        <span>Pseudotime</span>
        <span className={styles.insightStrong}>{cell.pseudotime.toFixed(2)}</span>
      </div>
      {cell.sampleMetadata ? (
        <div className={styles.pillList}>
          {Object.entries(cell.sampleMetadata)
            .filter(([, value]) => value !== null && value !== '')
            .slice(0, 4)
            .map(([key, value]) => (
              <span key={key} className={styles.pill}>{key}:{String(value ?? '—')}</span>
            ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ScSpatialInsightRail({ query }: ScSpatialInsightRailProps) {
  if (!query) {
    return (
      <aside className={styles.rail} aria-label="SCSPATIAL analysis details">
        <div className={styles.railScroll}>
          <div className={styles.runSummary}>
            <p className={styles.runSummaryLabel}>Run Summary</p>
            <p className={styles.runSummaryHeadline}>
              Load a normalized artifact to inspect cluster evidence, spatial hotspots, coexpression, and provenance.
            </p>
            <div className={styles.nextStep}>
              <span className={styles.nextStepLabel}>Next step</span>
              <p className={styles.nextStepText}>Use &ldquo;Upload h5ad&rdquo; or &ldquo;Demo&rdquo; in step 1 on the left.</p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const hasSelection =
    Boolean(query.rightPanel.selectedClusterSummary) || Boolean(query.rightPanel.selectedCell);
  const coexpressionCount = query.rightPanel.coexpression.length;
  const hotspotCount = query.rightPanel.hotspots.length;
  const clusterCount = query.rightPanel.clusterSummaries.length;

  return (
    <aside className={styles.rail} aria-label="SCSPATIAL analysis details">
      <div className={styles.railScroll}>
        <RunSummary query={query} />

        <details className={styles.groupDetails} open>
          <summary className={styles.groupSummary}>
            Key Metrics
            <span className={styles.groupSummaryBadge}>{hotspotCount}</span>
          </summary>
          <div className={styles.groupBody}>
            <HotspotTable query={query} />
            <LeadingEdgeProfile query={query} />
          </div>
        </details>

        <details className={styles.groupDetails} open={hasSelection}>
          <summary className={styles.groupSummary}>
            Interpretation
            {hasSelection ? <span className={styles.groupSummaryBadge}>selected</span> : null}
          </summary>
          <div className={styles.groupBody}>
            <SelectedClusterCard query={query} />
            <SelectedCellCard query={query} />
            {coexpressionCount > 0 ? (
              <table className={styles.sciTable}>
                <thead>
                  <tr>
                    <th>Coexpressed gene</th>
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
            ) : null}
          </div>
        </details>

        <details className={styles.groupDetails}>
          <summary className={styles.groupSummary}>
            Cluster Ledger
            <span className={styles.groupSummaryBadge}>{clusterCount}</span>
          </summary>
          <div className={styles.groupBody}>
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
          </div>
        </details>

        <details className={styles.groupDetails}>
          <summary className={styles.groupSummary}>Provenance &amp; Developer</summary>
          <div className={styles.groupBody}>
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
            {query.selection.developerMode ? (
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
            ) : null}
          </div>
        </details>
      </div>
    </aside>
  );
}
