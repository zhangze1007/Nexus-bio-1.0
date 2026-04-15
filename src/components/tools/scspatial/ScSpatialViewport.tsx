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

function ScatterViewport({
  points,
  svgRef,
  xLabel,
  yLabel,
  onSelectCell,
}: {
  points: ScSpatialPointDatum[];
  svgRef: MutableRefObject<SVGSVGElement | null>;
  xLabel: string;
  yLabel: string;
  onSelectCell: (cellId: string | null) => void;
}) {
  if (points.length === 0) {
    return (
      <div className={styles.viewportStage}>
        <EmptyState title="No points in current view" message="Adjust the cluster or gene filters to populate the current scatter view." />
      </div>
    );
  }

  const [zoom, setZoom] = useState(1);
  const bounds = useMemo(() => getBounds(points), [points]);
  const padding = 24 / zoom;
  const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;

  return (
    <>
      <div className={styles.viewportToolbar}>
        <button type="button" className={styles.button} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="Zoom out">
          <Minus size={14} />
        </button>
        <button type="button" className={styles.button} onClick={() => setZoom((value) => Math.min(3, value + 0.25))} aria-label="Zoom in">
          <Plus size={14} />
        </button>
      </div>
      <div className={styles.viewportStage}>
        <svg
          ref={svgRef}
          className={styles.viewportSvg}
          viewBox={viewBox}
          role="img"
          aria-label={`${xLabel} versus ${yLabel} scatter plot`}
        >
          <rect x={bounds.minX - padding} y={bounds.minY - padding} width={bounds.width + padding * 2} height={bounds.height + padding * 2} fill="#050505" />
          {points.map((point) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={point.selected ? 3.5 : 2.2}
              fill={point.selected ? '#ffffff' : colorForCluster(point.clusterId)}
              opacity={point.selected ? 0.95 : 0.8}
              tabIndex={0}
              role="button"
              aria-label={`${point.id}, ${point.clusterLabel}, expression ${point.expression.toFixed(2)}`}
              onClick={() => onSelectCell(point.id)}
              onKeyDown={(event) => handlePointKeyDown(event, point.id, onSelectCell)}
            />
          ))}
        </svg>
      </div>
    </>
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
        <rect width="100" height="100" fill="#050505" />
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
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={0.5 + edge.weight}
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
              opacity={0.88}
            />
            <text
              x={10 + node.x * 80}
              y={12 + node.y * 80}
              textAnchor="middle"
              fontSize="3"
              fill="#f9f6f0"
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
  if (points.length === 0) {
    return (
      <div className={styles.viewportStage}>
        <EmptyState title="No 3D point cloud available" message="The current selection has no cells to render in the spatial point cloud." />
      </div>
    );
  }

  const bounds = useMemo(() => getBounds(points), [points]);
  const maxExpression = Math.max(...points.map((point) => point.expression), 1);

  return (
    <div className={styles.viewportStage}>
      <Canvas
        className={styles.viewportCanvas}
        camera={{ position: [0, 8, 16], fov: 42 }}
        onCreated={({ gl }) => {
          canvasRef.current = gl.domElement;
        }}
      >
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[6, 8, 12]} intensity={1.0} />
        <gridHelper args={[16, 12, '#22262e', '#111318']} position={[0, -2.3, 0]} />
        <group position={[-4.5, -2, -4.5]}>
          {points.map((point) => {
            const x = ((point.x - bounds.minX) / bounds.width) * 9;
            const z = ((point.y - bounds.minY) / bounds.height) * 9;
            const y = (point.expression / maxExpression) * 4;
            return (
              <mesh key={point.id} position={[x, y, z]} onClick={() => onSelectCell(point.id)}>
                <sphereGeometry args={[point.selected ? 0.22 : 0.12, 12, 12]} />
                <meshStandardMaterial color={point.selected ? '#ffffff' : colorForCluster(point.clusterId)} emissive={point.selected ? '#ffffff' : colorForCluster(point.clusterId)} emissiveIntensity={0.18} />
              </mesh>
            );
          })}
        </group>
        <OrbitControls enablePan={false} minDistance={8} maxDistance={28} />
      </Canvas>
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

  return (
    <section className={styles.viewport} aria-label="SCSPATIAL viewport">
      <div className={styles.viewportHeader}>
        <div className={styles.viewportTitle}>
          <div className={styles.eyebrow}>Core View</div>
          <h2>{SCSPATIAL_VIEW_LABELS[query.selection.viewMode]}</h2>
          <p>
            {query.selection.selectedGene
              ? `${query.selection.selectedGene} drives the current readout and updates the right rail in real time.`
              : 'Select a gene to inspect expression and spatial restriction.'}
          </p>
        </div>
      </div>
      <div className={styles.viewportBody}>
        {query.selection.viewMode === 'trajectory' ? (
          <TrajectoryViewport query={query} svgRef={svgRef} />
        ) : null}
        {query.selection.viewMode === 'spatial-3d' ? (
          <SpatialPointCloud points={query.centerView.points} canvasRef={canvasRef} onSelectCell={onSelectCell} />
        ) : null}
        {query.selection.viewMode === 'table' ? (
          <div className={styles.tableWrap}>
            <DataTable<TableRow>
              columns={TABLE_COLUMNS}
              rows={tableRows}
              emptyTitle="No cells in current view"
              emptyMessage="Adjust the cluster filter or load a dataset with valid cells."
            />
          </div>
        ) : null}
        {query.selection.viewMode !== 'table' && query.selection.viewMode !== 'trajectory' && query.selection.viewMode !== 'spatial-3d' ? (
          <ScatterViewport
            points={query.centerView.points}
            svgRef={svgRef}
            xLabel={query.centerView.xLabel}
            yLabel={query.centerView.yLabel}
            onSelectCell={onSelectCell}
          />
        ) : null}
      </div>
    </section>
  );
}
