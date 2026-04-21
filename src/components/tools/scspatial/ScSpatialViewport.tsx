'use client';

import { useMemo, useState, type KeyboardEvent, type MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Minus, Plus } from 'lucide-react';
import DataTable, { type TableColumn } from '../../ide/shared/DataTable';
import EmptyState from '../../ide/shared/EmptyState';
import type { ScSpatialPointDatum, ScSpatialQueryResponse } from '../../../types/scspatial';
import { colorForCluster, SCSPATIAL_VIEW_LABELS } from './scSpatialPalette';
import styles from './ScSpatialWorkbench.module.css';

interface ScSpatialViewportProps {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  loadState: 'idle' | 'uploading' | 'querying' | 'ready' | 'error';
  query: ScSpatialQueryResponse | null;
  svgRef: MutableRefObject<SVGSVGElement | null>;
  onSelectCell: (cellId: string | null) => void;
}

interface TableRow {
  cellId: string;
  clusterLabel: string;
  cellType: string;
  expression: number;
  pseudotime: number;
}

const TABLE_COLUMNS: TableColumn<TableRow>[] = [
  { key: 'cellId', header: 'Cell', width: 120 },
  { key: 'clusterLabel', header: 'Cluster', width: 160 },
  { key: 'cellType', header: 'Type', width: 160 },
  { key: 'expression', header: 'Expr.', width: 70, render: (value) => (value as number).toFixed(2) },
  { key: 'pseudotime', header: 'PT', width: 70, render: (value) => (value as number).toFixed(2) },
];

function getBounds(points: ScSpatialPointDatum[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function handlePointKeyDown(event: KeyboardEvent<SVGCircleElement>, cellId: string, onSelectCell: (cellId: string | null) => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelectCell(cellId);
  }
}

function ClusterLegend({ query }: { query: ScSpatialQueryResponse }) {
  const items = query.rightPanel.clusterSummaries.slice(0, 6);
  if (items.length === 0) return null;
  return (
    <div className={styles.legend} role="figure" aria-label="Cluster legend">
      <h4 className={styles.legendTitle}>Domain Annotation</h4>
      {items.map((cluster) => (
        <div key={cluster.clusterLabel} className={styles.legendRow}>
          <span className={styles.legendSwatch} style={{ background: colorForCluster(cluster.clusterId) }} />
          <span>{cluster.clusterLabel}</span>
        </div>
      ))}
    </div>
  );
}

function ScaleBar({ label = '1000 µm' }: { label?: string }) {
  return (
    <div className={styles.scaleBar}>
      <div className={styles.scaleBarLine} />
      <span className={styles.scaleBarLabel}>{label}</span>
    </div>
  );
}

function ScatterViewport({
  points,
  svgRef,
  xLabel,
  yLabel,
  viewMode,
  onSelectCell,
}: {
  points: ScSpatialPointDatum[];
  svgRef: MutableRefObject<SVGSVGElement | null>;
  xLabel: string;
  yLabel: string;
  viewMode: string;
  onSelectCell: (cellId: string | null) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const bounds = useMemo(() => getBounds(points), [points]);

  if (points.length === 0) {
    return (
      <div className={styles.viewportStage}>
        <EmptyState title="No points in current view" message="Adjust the cluster or gene filters to populate the current scatter view." />
      </div>
    );
  }

  const padding = 24 / zoom;
  const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;
  const isSpatial = viewMode === 'spatial-2d';

  return (
    <div className={styles.viewportStage}>
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, zIndex: 5 }}>
        <button type="button" className={styles.button} style={{ width: 30, padding: 0 }} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="Zoom out">
          <Minus size={12} />
        </button>
        <button type="button" className={styles.button} style={{ width: 30, padding: 0 }} onClick={() => setZoom((value) => Math.min(3, value + 0.25))} aria-label="Zoom in">
          <Plus size={12} />
        </button>
      </div>

      <svg
        ref={svgRef}
        className={styles.viewportSvg}
        viewBox={viewBox}
        role="img"
        aria-label={`${xLabel} versus ${yLabel} scatter plot`}
      >
        <rect
          x={bounds.minX - padding}
          y={bounds.minY - padding}
          width={bounds.width + padding * 2}
          height={bounds.height + padding * 2}
          fill="#ffffff"
        />
        {points.map((point) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r={point.selected ? 3.2 : 2.0}
            fill={colorForCluster(point.clusterId)}
            stroke={point.selected ? '#111827' : 'none'}
            strokeWidth={point.selected ? 0.8 : 0}
            opacity={point.selected ? 1 : 0.78}
            tabIndex={0}
            role="button"
            aria-label={`${point.id}, ${point.clusterLabel}, expression ${point.expression.toFixed(2)}`}
            onClick={() => onSelectCell(point.id)}
            onKeyDown={(event) => handlePointKeyDown(event, point.id, onSelectCell)}
          />
        ))}
      </svg>

      {isSpatial ? <ScaleBar /> : null}
    </div>
  );
}

function TrajectoryViewport({
  query,
  svgRef,
}: {
  query: ScSpatialQueryResponse;
  svgRef: MutableRefObject<SVGSVGElement | null>;
}) {
  const nodes = query.centerView.trajectory?.nodes ?? [];
  const edges = query.centerView.trajectory?.edges ?? [];
  if (nodes.length === 0) {
    return (
      <div className={styles.viewportStage}>
        <EmptyState title="No trajectory graph available" message="This artifact does not currently expose enough cluster structure to render a PAGA trajectory." />
      </div>
    );
  }
  return (
    <div className={styles.viewportStage}>
      <svg ref={svgRef} className={styles.viewportSvg} viewBox="0 0 100 100" role="img" aria-label="PAGA trajectory graph">
        <rect width="100" height="100" fill="#ffffff" />
        {edges.map((edge) => {
          const from = nodes.find((node) => node.clusterId === edge.from);
          const to = nodes.find((node) => node.clusterId === edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={10 + from.x * 80}
              y1={10 + from.y * 80}
              x2={10 + to.x * 80}
              y2={10 + to.y * 80}
              stroke="#9ca3af"
              strokeWidth={0.4 + edge.weight * 0.8}
            />
          );
        })}
        {nodes.map((node) => (
          <g key={node.clusterId}>
            <circle
              cx={10 + node.x * 80}
              cy={10 + node.y * 80}
              r={3 + node.cellCount / Math.max(query.datasetMeta.cellCount, 1) * 12}
              fill={colorForCluster(node.clusterId)}
              stroke="#111827"
              strokeWidth={0.3}
              opacity={0.88}
            />
            <text
              x={10 + node.x * 80}
              y={12 + node.y * 80}
              textAnchor="middle"
              fontSize="3"
              fill="#111827"
              fontWeight={600}
            >
              {node.clusterLabel}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SpatialPointCloud({
  points,
  canvasRef,
  onSelectCell,
}: {
  points: ScSpatialPointDatum[];
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  onSelectCell: (cellId: string | null) => void;
}) {
  const bounds = useMemo(() => getBounds(points), [points]);
  const maxExpression = useMemo(() => Math.max(...points.map((point) => point.expression), 1), [points]);

  if (points.length === 0) {
    return (
      <div className={styles.viewportStage}>
        <EmptyState title="No 3D point cloud available" message="The current selection has no cells to render in the spatial point cloud." />
      </div>
    );
  }

  return (
    <div className={styles.viewportStage}>
      <Canvas
        className={styles.viewportCanvas}
        camera={{ position: [0, 8, 16], fov: 42 }}
        onCreated={({ gl }) => {
          canvasRef.current = gl.domElement;
        }}
      >
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={0.95} />
        <directionalLight position={[6, 8, 12]} intensity={0.6} />
        <gridHelper args={[16, 12, '#d1d5db', '#e5e7eb']} position={[0, -2.3, 0]} />
        <group position={[-4.5, -2, -4.5]}>
          {points.map((point) => {
            const x = ((point.x - bounds.minX) / bounds.width) * 9;
            const z = ((point.y - bounds.minY) / bounds.height) * 9;
            const y = (point.expression / maxExpression) * 4;
            return (
              <mesh key={point.id} position={[x, y, z]} onClick={() => onSelectCell(point.id)}>
                <sphereGeometry args={[point.selected ? 0.22 : 0.12, 12, 12]} />
                <meshLambertMaterial color={point.selected ? '#111827' : colorForCluster(point.clusterId)} />
              </mesh>
            );
          })}
        </group>
        <OrbitControls enablePan={false} minDistance={8} maxDistance={28} />
      </Canvas>
    </div>
  );
}

/* ── Analysis strip panels (grounded in real query data) ──────────── */

function SpatialThumbnailPanel({ query }: { query: ScSpatialQueryResponse }) {
  const points = query.centerView.points;
  if (points.length === 0) {
    return <div className={styles.analysisFigure} />;
  }
  const bounds = getBounds(points);
  const padding = 8;
  const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;
  return (
    <div className={styles.analysisFigure}>
      <svg viewBox={viewBox} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
        <rect
          x={bounds.minX - padding}
          y={bounds.minY - padding}
          width={bounds.width + padding * 2}
          height={bounds.height + padding * 2}
          fill="#f9fafb"
        />
        {points.slice(0, 800).map((point) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r={1.4}
            fill={colorForCluster(point.clusterId)}
            opacity={0.8}
          />
        ))}
        <rect
          x={bounds.minX - padding / 2}
          y={bounds.minY - padding / 2}
          width={bounds.width + padding}
          height={bounds.height + padding}
          fill="none"
          stroke="#E6194B"
          strokeWidth={0.6}
          strokeDasharray="2 1.5"
        />
      </svg>
    </div>
  );
}

function ClusterCompositionPanel({ query }: { query: ScSpatialQueryResponse }) {
  const clusters = query.rightPanel.clusterSummaries;
  if (clusters.length === 0) {
    return <div className={styles.analysisFigure} />;
  }
  const max = Math.max(...clusters.map((c) => c.cellCount), 1);
  return (
    <div className={styles.analysisFigure}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
        <rect width="100" height="100" fill="#ffffff" />
        {/* axis */}
        <line x1="10" y1="85" x2="95" y2="85" stroke="#9ca3af" strokeWidth="0.3" />
        <line x1="10" y1="10" x2="10" y2="85" stroke="#9ca3af" strokeWidth="0.3" />
        {clusters.slice(0, 8).map((cluster, idx) => {
          const total = Math.min(clusters.length, 8);
          const barWidth = 72 / total;
          const x = 12 + idx * barWidth;
          const height = (cluster.cellCount / max) * 70;
          return (
            <g key={cluster.clusterLabel}>
              <rect
                x={x + barWidth * 0.15}
                y={85 - height}
                width={barWidth * 0.7}
                height={height}
                fill={colorForCluster(cluster.clusterId)}
                stroke="#374151"
                strokeWidth={0.15}
              />
              <text
                x={x + barWidth / 2}
                y={92}
                textAnchor="middle"
                fontSize="2.8"
                fill="#4b5563"
              >
                {cluster.clusterLabel.length > 6 ? `${cluster.clusterLabel.slice(0, 5)}…` : cluster.clusterLabel}
              </text>
            </g>
          );
        })}
        <text x="5" y="10" fontSize="3" fill="#4b5563" transform="rotate(-90 5 10)">Cells</text>
      </svg>
    </div>
  );
}

function ExpressionDistributionPanel({ query }: { query: ScSpatialQueryResponse }) {
  const clusters = query.rightPanel.clusterSummaries;
  if (clusters.length === 0) {
    return <div className={styles.analysisFigure} />;
  }
  const max = Math.max(...clusters.map((c) => c.meanExpression), 0.01);
  return (
    <div className={styles.analysisFigure}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
        <rect width="100" height="100" fill="#ffffff" />
        <line x1="12" y1="85" x2="95" y2="85" stroke="#9ca3af" strokeWidth="0.3" />
        <line x1="12" y1="10" x2="12" y2="85" stroke="#9ca3af" strokeWidth="0.3" />
        {/* Y-axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1="11" y1={85 - t * 70} x2="12" y2={85 - t * 70} stroke="#9ca3af" strokeWidth="0.3" />
            <text x="10" y={86 - t * 70} fontSize="2.4" fill="#6b7280" textAnchor="end">{(t * max).toFixed(1)}</text>
          </g>
        ))}
        {clusters.slice(0, 6).map((cluster, idx) => {
          const total = Math.min(clusters.length, 6);
          const slot = 78 / total;
          const cx = 14 + idx * slot + slot / 2;
          const h = (cluster.meanExpression / max) * 70;
          const top = 85 - h;
          const bulge = Math.min(slot * 0.28, 6);
          // Violin-like shape: ellipse bounded by mean
          const path = `M ${cx} 85 Q ${cx - bulge} ${(85 + top) / 2}, ${cx} ${top} Q ${cx + bulge} ${(85 + top) / 2}, ${cx} 85 Z`;
          return (
            <g key={cluster.clusterLabel}>
              <path d={path} fill={colorForCluster(cluster.clusterId)} stroke="#111827" strokeWidth="0.2" opacity={0.85} />
              <text
                x={cx}
                y={92}
                textAnchor="middle"
                fontSize="2.8"
                fill="#4b5563"
              >
                {cluster.clusterLabel.length > 6 ? `${cluster.clusterLabel.slice(0, 5)}…` : cluster.clusterLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AnalysisStrip({ query }: { query: ScSpatialQueryResponse }) {
  const selectedGene = query.selection.selectedGene;
  return (
    <div className={styles.analysisStrip}>
      <div className={styles.analysisPanel}>
        <h3 className={styles.analysisTitle}>A. Target Spatial Location</h3>
        <p className={styles.analysisCaption}>
          Spatial footprint of the current selection, colored by cluster assignment.
        </p>
        <SpatialThumbnailPanel query={query} />
      </div>
      <div className={styles.analysisPanel}>
        <h3 className={styles.analysisTitle}>B. Cluster Composition</h3>
        <p className={styles.analysisCaption}>
          Cell count per cluster after current filters. Color-matched to the main view.
        </p>
        <ClusterCompositionPanel query={query} />
      </div>
      <div className={styles.analysisPanel}>
        <h3 className={styles.analysisTitle}>C. Domain Expression Distribution</h3>
        <p className={styles.analysisCaption}>
          Mean expression of {selectedGene || 'target gene'} across identified domains.
        </p>
        <ExpressionDistributionPanel query={query} />
      </div>
    </div>
  );
}

export default function ScSpatialViewport({
  canvasRef,
  loadState,
  query,
  svgRef,
  onSelectCell,
}: ScSpatialViewportProps) {
  if (loadState === 'uploading' || loadState === 'querying') {
    return (
      <div className={styles.emptyWrap}>
        <div className={styles.viewport}>
          <EmptyState type="loading" title="Loading spatial dataset" message="Preparing the normalized artifact and refreshing the current view." />
        </div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className={styles.emptyWrap}>
        <div className={styles.viewport}>
          <EmptyState title="No spatial artifact loaded" message="Upload a .h5ad file or open the bundled demo to start the SCSPATIAL workbench." />
        </div>
      </div>
    );
  }

  const tableRows: TableRow[] = query.centerView.points.map((point) => ({
    cellId: point.id,
    clusterLabel: point.clusterLabel,
    cellType: point.cellType,
    expression: point.expression,
    pseudotime: point.pseudotime,
  }));

  const viewMode = query.selection.viewMode;
  const isTable = viewMode === 'table';
  const isTrajectory = viewMode === 'trajectory';
  const is3D = viewMode === 'spatial-3d';

  return (
    <section className={styles.viewport} aria-label="SCSPATIAL viewport">
      <div className={styles.viewportHeader}>
        <div className={styles.viewportTitle}>
          <h2>{SCSPATIAL_VIEW_LABELS[query.selection.viewMode]}</h2>
          <p>
            {query.selection.selectedGene
              ? `${query.selection.selectedGene} drives the current readout.`
              : 'Select a gene to inspect expression and spatial restriction.'}
          </p>
        </div>
      </div>
      <div className={styles.viewportBody}>
        {isTable ? (
          <div className={styles.tableWrap}>
            <DataTable<TableRow>
              columns={TABLE_COLUMNS}
              rows={tableRows}
              emptyTitle="No cells in current view"
              emptyMessage="Adjust the cluster filter or load a dataset with valid cells."
            />
          </div>
        ) : (
          <>
            <div className={styles.viewportStageWrap}>
              {isTrajectory ? (
                <TrajectoryViewport query={query} svgRef={svgRef} />
              ) : is3D ? (
                <SpatialPointCloud points={query.centerView.points} canvasRef={canvasRef} onSelectCell={onSelectCell} />
              ) : (
                <ScatterViewport
                  points={query.centerView.points}
                  svgRef={svgRef}
                  xLabel={query.centerView.xLabel}
                  yLabel={query.centerView.yLabel}
                  viewMode={viewMode}
                  onSelectCell={onSelectCell}
                />
              )}
              <ClusterLegend query={query} />
            </div>
            <AnalysisStrip query={query} />
          </>
        )}
      </div>
    </section>
  );
}
