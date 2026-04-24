'use client';

import { useMemo, useState, type KeyboardEvent, type MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Minus, Plus } from 'lucide-react';
import DataTable, { type TableColumn } from '../../ide/shared/DataTable';
import EmptyState from '../../ide/shared/EmptyState';
import type { ScSpatialPointDatum, ScSpatialQueryResponse } from '../../../types/scspatial';
import { colorForCluster, SCSPATIAL_VIEW_LABELS } from './scSpatialPalette';
import { computeConvexHull, expandHull } from '../../../utils/vizUtils';
import styles from './ScSpatialWorkbench.module.css';

type AnalysisTabKey = 'context' | 'marker' | 'distribution';

const ANALYSIS_TABS: Array<{ key: AnalysisTabKey; label: string }> = [
  { key: 'context', label: 'Tissue Context' },
  { key: 'marker', label: 'Marker Heatmap' },
  { key: 'distribution', label: 'Expression by Domain' },
];

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

  // Group points by cluster for hull overlays (Scanpy-style cluster territories).
  const clusterGroups = useMemo(() => {
    const map = new Map<number, { label: string; pts: ScSpatialPointDatum[] }>();
    for (const p of points) {
      const bucket = map.get(p.clusterId) ?? { label: p.clusterLabel, pts: [] };
      bucket.pts.push(p);
      map.set(p.clusterId, bucket);
    }
    const span = Math.max(bounds.width, bounds.height);
    return Array.from(map.entries()).map(([id, { label, pts }]) => {
      const hullIn = pts.map((p) => ({ sx: p.x, sy: p.y }));
      const hull = hullIn.length >= 3
        ? expandHull(computeConvexHull(hullIn), span * 0.018)
        : [];
      return { id, label, pts, hull };
    });
  }, [points, bounds]);

  if (points.length === 0) {
    return (
      <div className={styles.viewportStage}>
        <EmptyState title="No points in current view" message="Adjust the cluster or gene filters to populate the current scatter view." />
      </div>
    );
  }

  const isSpatial = viewMode === 'spatial-2d';

  // Publication-quality figure: fixed SVG canvas with margins, axis lines,
  // tick marks, gridlines, and cluster hulls. Data → pixel via linear scale.
  const W = 640;
  const H = 440;
  const marginL = 46;
  const marginR = 14;
  const marginT = 16;
  const marginB = 38;
  const plotW = W - marginL - marginR;
  const plotH = H - marginT - marginB;

  // zoom narrows the data window around the midpoint.
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const halfW = (bounds.width / 2) / zoom;
  const halfH = (bounds.height / 2) / zoom;
  const viewMinX = cx - halfW;
  const viewMaxX = cx + halfW;
  const viewMinY = cy - halfH;
  const viewMaxY = cy + halfH;
  const viewSpanX = Math.max(viewMaxX - viewMinX, 1e-6);
  const viewSpanY = Math.max(viewMaxY - viewMinY, 1e-6);

  const xScale = (x: number) => marginL + ((x - viewMinX) / viewSpanX) * plotW;
  const yScale = (y: number) => marginT + (1 - (y - viewMinY) / viewSpanY) * plotH;

  const tickFractions = [0, 0.25, 0.5, 0.75, 1];
  const xTickValues = tickFractions.map((t) => viewMinX + t * viewSpanX);
  const yTickValues = tickFractions.map((t) => viewMinY + t * viewSpanY);

  const hullPath = (hull: { sx: number; sy: number }[]) =>
    `M ${hull.map((p) => `${xScale(p.sx).toFixed(2)} ${yScale(p.sy).toFixed(2)}`).join(' L ')} Z`;

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
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${xLabel} versus ${yLabel} scatter plot`}
      >
        <rect width={W} height={H} fill="#ffffff" />
        {/* plot background */}
        <rect x={marginL} y={marginT} width={plotW} height={plotH} fill="#fbfcfd" />

        {/* gridlines */}
        {tickFractions.map((t, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={marginL + t * plotW}
              y1={marginT}
              x2={marginL + t * plotW}
              y2={marginT + plotH}
              stroke="#eef2f6"
              strokeWidth={0.5}
            />
            <line
              x1={marginL}
              y1={marginT + t * plotH}
              x2={marginL + plotW}
              y2={marginT + t * plotH}
              stroke="#eef2f6"
              strokeWidth={0.5}
            />
          </g>
        ))}

        {/* cluster territories (convex hulls) */}
        {clusterGroups.map((g) => {
          if (g.hull.length < 3) return null;
          const c = colorForCluster(g.id);
          return (
            <path
              key={`hull-${g.id}`}
              d={hullPath(g.hull)}
              fill={c}
              fillOpacity={0.08}
              stroke={c}
              strokeOpacity={0.55}
              strokeWidth={0.9}
              strokeDasharray="3 2"
            />
          );
        })}

        {/* scatter points */}
        {points.map((point) => (
          <circle
            key={point.id}
            cx={xScale(point.x)}
            cy={yScale(point.y)}
            r={point.selected ? 4.2 : 2.4}
            fill={colorForCluster(point.clusterId)}
            stroke={point.selected ? '#111827' : '#ffffff'}
            strokeWidth={point.selected ? 1.1 : 0.35}
            opacity={point.selected ? 1 : 0.82}
            tabIndex={0}
            role="button"
            aria-label={`${point.id}, ${point.clusterLabel}, expression ${point.expression.toFixed(2)}`}
            onClick={() => onSelectCell(point.id)}
            onKeyDown={(event) => handlePointKeyDown(event, point.id, onSelectCell)}
          />
        ))}

        {/* cluster centroid labels */}
        {clusterGroups.map((g) => {
          if (g.pts.length < 3) return null;
          const mx = g.pts.reduce((a, p) => a + p.x, 0) / g.pts.length;
          const my = g.pts.reduce((a, p) => a + p.y, 0) / g.pts.length;
          return (
            <text
              key={`lbl-${g.id}`}
              x={xScale(mx)}
              y={yScale(my)}
              fontSize={9}
              fontWeight={600}
              textAnchor="middle"
              fill="#0f172a"
              fontFamily="var(--font-mono)"
              style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 2.5, strokeLinejoin: 'round' }}
            >
              {g.label.length > 14 ? `${g.label.slice(0, 13)}…` : g.label}
            </text>
          );
        })}

        {/* axes */}
        <line x1={marginL} y1={marginT + plotH} x2={marginL + plotW} y2={marginT + plotH} stroke="#0f172a" strokeWidth={0.8} />
        <line x1={marginL} y1={marginT} x2={marginL} y2={marginT + plotH} stroke="#0f172a" strokeWidth={0.8} />

        {/* x ticks + labels */}
        {xTickValues.map((v, i) => {
          const x = marginL + tickFractions[i] * plotW;
          return (
            <g key={`xt-${i}`}>
              <line x1={x} y1={marginT + plotH} x2={x} y2={marginT + plotH + 3} stroke="#0f172a" strokeWidth={0.6} />
              <text
                x={x}
                y={marginT + plotH + 12}
                fontSize={8}
                textAnchor="middle"
                fill="#475569"
                fontFamily="var(--font-mono)"
              >
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* y ticks + labels */}
        {yTickValues.map((v, i) => {
          const y = marginT + (1 - tickFractions[i]) * plotH;
          return (
            <g key={`yt-${i}`}>
              <line x1={marginL - 3} y1={y} x2={marginL} y2={y} stroke="#0f172a" strokeWidth={0.6} />
              <text
                x={marginL - 5}
                y={y + 3}
                fontSize={8}
                textAnchor="end"
                fill="#475569"
                fontFamily="var(--font-mono)"
              >
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* axis titles */}
        <text
          x={marginL + plotW / 2}
          y={H - 8}
          fontSize={10}
          fontWeight={700}
          textAnchor="middle"
          fill="#0f172a"
          fontFamily="var(--font-mono)"
        >
          {xLabel}
        </text>
        <text
          x={12}
          y={marginT + plotH / 2}
          fontSize={10}
          fontWeight={700}
          textAnchor="middle"
          fill="#0f172a"
          fontFamily="var(--font-mono)"
          transform={`rotate(-90 12 ${marginT + plotH / 2})`}
        >
          {yLabel}
        </text>

        {/* n label in upper-right */}
        <text
          x={marginL + plotW - 4}
          y={marginT + 10}
          fontSize={8}
          textAnchor="end"
          fill="#475569"
          fontFamily="var(--font-mono)"
          fontStyle="italic"
        >
          n = {points.length.toLocaleString()}
        </text>
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

/**
 * Panel A — Tissue context map.
 *
 * Renders a shrunk version of the spatial point cloud with a cluster-hull
 * boundary overlay (via computeConvexHull + expandHull, the shared
 * Nexus-Bio viz primitive). Mirrors the "sample location" panel common
 * in spatial transcriptomics figures (10x Visium-style cartoons).
 */
function SpatialContextPanel({ query }: { query: ScSpatialQueryResponse }) {
  const points = query.centerView.points;
  if (points.length === 0) {
    return <div className={styles.analysisFigure} />;
  }

  const sampled = points.length > 700 ? points.filter((_, i) => i % Math.ceil(points.length / 700) === 0) : points;
  const bounds = getBounds(points);
  const padding = Math.max(bounds.width, bounds.height) * 0.08;
  const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;

  // Tissue outline from the full convex hull (so it stays stable even when
  // a cluster filter is applied to centerView.points).
  const hullPoints = sampled.map((p) => ({ sx: p.x, sy: p.y }));
  const hull = expandHull(computeConvexHull(hullPoints), padding * 0.35);
  const hullPath = hull.length
    ? `M ${hull.map((p) => `${p.sx.toFixed(2)} ${p.sy.toFixed(2)}`).join(' L ')} Z`
    : '';

  // ROI box: tight bounding box of the selected cluster if any.
  const selectedClusterId = query.rightPanel.selectedClusterSummary?.clusterId;
  const selectedPoints = selectedClusterId !== undefined
    ? sampled.filter((p) => p.clusterId === selectedClusterId)
    : [];
  const roi = selectedPoints.length > 0 ? getBounds(selectedPoints) : null;

  return (
    <div className={styles.analysisFigure}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        <rect
          x={bounds.minX - padding}
          y={bounds.minY - padding}
          width={bounds.width + padding * 2}
          height={bounds.height + padding * 2}
          fill="#f8fafc"
        />
        {/* tissue outline */}
        {hullPath ? (
          <path
            d={hullPath}
            fill="#eef2f7"
            stroke="#cbd5e1"
            strokeWidth={Math.max(bounds.width, bounds.height) * 0.004}
          />
        ) : null}
        {sampled.map((point) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r={Math.max(bounds.width, bounds.height) * 0.007}
            fill={colorForCluster(point.clusterId)}
            opacity={selectedClusterId === undefined || point.clusterId === selectedClusterId ? 0.82 : 0.25}
          />
        ))}
        {/* ROI box */}
        {roi ? (
          <rect
            x={roi.minX - roi.width * 0.08}
            y={roi.minY - roi.height * 0.08}
            width={roi.width * 1.16}
            height={roi.height * 1.16}
            fill="none"
            stroke="#E6194B"
            strokeWidth={Math.max(bounds.width, bounds.height) * 0.006}
            strokeDasharray={`${Math.max(bounds.width, bounds.height) * 0.02} ${Math.max(bounds.width, bounds.height) * 0.012}`}
          />
        ) : null}
        {/* axes label anchors for orientation */}
        <text
          x={bounds.minX - padding * 0.5}
          y={bounds.minY - padding * 0.2}
          fontSize={Math.max(bounds.width, bounds.height) * 0.028}
          fill="#475569"
          fontFamily="var(--font-mono)"
        >
          {query.datasetMeta.cellCount.toLocaleString()} cells
        </text>
      </svg>
    </div>
  );
}

/**
 * Panel B — Marker gene × domain heatmap.
 *
 * Classic Seurat/Scanpy dotplot-style marker figure. For each domain we
 * collect its top marker genes, then draw a cluster × gene grid colored
 * by the gene's rank within that cluster's top list (stronger = higher
 * rank). Genes also flagged as spatial hotspots get a darker accent.
 */
function MarkerHeatmapPanel({ query }: { query: ScSpatialQueryResponse }) {
  const clusters = query.rightPanel.clusterSummaries.slice(0, 8);
  if (clusters.length === 0) {
    return <div className={styles.analysisFigure} />;
  }

  // Collect the union of top genes, preserving order of first appearance,
  // trimmed to 10 for a readable grid.
  const seen = new Set<string>();
  const genes: string[] = [];
  for (const cluster of clusters) {
    for (const gene of cluster.topGenes) {
      if (!seen.has(gene)) {
        seen.add(gene);
        genes.push(gene);
      }
    }
  }
  const trimmedGenes = genes.slice(0, 10);

  if (trimmedGenes.length === 0) {
    return <div className={styles.analysisFigure} />;
  }

  const hotspotMap = new Map(query.rightPanel.hotspots.map((h) => [h.geneSymbol, h.moranI]));
  const maxMoran = Math.max(...query.rightPanel.hotspots.map((h) => Math.abs(h.moranI)), 0.01);

  const marginL = 58;
  const marginR = 12;
  const marginT = 8;
  const marginB = 28;
  const W = 320;
  const H = 150;
  const gridW = W - marginL - marginR;
  const gridH = H - marginT - marginB;
  const cellW = gridW / trimmedGenes.length;
  const cellH = gridH / clusters.length;

  /** Purple→teal→yellow ramp (Viridis-like, CVD-safe). */
  const ramp = (t: number) => {
    const stops = [
      { at: 0.0, c: [240, 243, 250] },  // very pale for "absent"
      { at: 0.3, c: [197, 205, 227] },
      { at: 0.55, c: [102, 133, 181] },
      { at: 0.8, c: [58, 91, 143] },
      { at: 1.0, c: [28, 54, 99] },
    ];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i].at) {
        const prev = stops[i - 1];
        const next = stops[i];
        const u = (t - prev.at) / (next.at - prev.at);
        const r = Math.round(prev.c[0] + (next.c[0] - prev.c[0]) * u);
        const g = Math.round(prev.c[1] + (next.c[1] - prev.c[1]) * u);
        const b = Math.round(prev.c[2] + (next.c[2] - prev.c[2]) * u);
        return `rgb(${r},${g},${b})`;
      }
    }
    return 'rgb(28,54,99)';
  };

  return (
    <div className={styles.analysisFigure}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <rect width={W} height={H} fill="#ffffff" />
        {/* frame */}
        <rect
          x={marginL}
          y={marginT}
          width={gridW}
          height={gridH}
          fill="none"
          stroke="#111827"
          strokeWidth={0.5}
        />
        {/* heatmap cells */}
        {clusters.map((cluster, rIdx) => (
          trimmedGenes.map((gene, cIdx) => {
            const rank = cluster.topGenes.indexOf(gene);
            const present = rank >= 0;
            const intensity = present ? 1 - rank / Math.max(cluster.topGenes.length, 1) : 0;
            const moran = hotspotMap.get(gene) ?? 0;
            const bump = Math.abs(moran) / maxMoran * 0.3;
            const t = Math.min(1, intensity + (present ? bump : 0));
            return (
              <rect
                key={`${cluster.clusterId}-${gene}`}
                x={marginL + cIdx * cellW}
                y={marginT + rIdx * cellH}
                width={cellW}
                height={cellH}
                fill={ramp(t)}
                stroke="#ffffff"
                strokeWidth={0.6}
              />
            );
          })
        ))}
        {/* row labels with cluster swatches */}
        {clusters.map((cluster, rIdx) => (
          <g key={`row-${cluster.clusterId}`}>
            <rect
              x={marginL - 14}
              y={marginT + rIdx * cellH + cellH / 2 - 3}
              width={6}
              height={6}
              fill={colorForCluster(cluster.clusterId)}
              stroke="#111827"
              strokeWidth={0.3}
            />
            <text
              x={marginL - 18}
              y={marginT + rIdx * cellH + cellH / 2 + 2.5}
              fontSize={8}
              fill="#111827"
              textAnchor="end"
              fontFamily="var(--font-mono)"
            >
              {cluster.clusterLabel.length > 7 ? `${cluster.clusterLabel.slice(0, 6)}…` : cluster.clusterLabel}
            </text>
          </g>
        ))}
        {/* column labels (gene symbols, rotated) */}
        {trimmedGenes.map((gene, cIdx) => (
          <text
            key={`col-${gene}`}
            x={marginL + cIdx * cellW + cellW / 2}
            y={marginT + gridH + 4}
            fontSize={7.2}
            fill="#111827"
            textAnchor="end"
            fontFamily="var(--font-mono)"
            fontStyle="italic"
            transform={`rotate(-45 ${marginL + cIdx * cellW + cellW / 2} ${marginT + gridH + 4})`}
          >
            {gene.length > 8 ? `${gene.slice(0, 7)}…` : gene}
          </text>
        ))}
        {/* axis title */}
        <text
          x={marginL - 44}
          y={marginT - 1}
          fontSize={7.5}
          fill="#374151"
          fontFamily="var(--font-mono)"
          fontWeight={700}
        >
          Domain
        </text>
      </svg>
    </div>
  );
}

/**
 * Panel C — Expression distribution box plot per domain.
 *
 * Real Tukey box-and-whisker plot: quartiles (Q1, median, Q3), whiskers
 * bounded by 1.5×IQR, and outlier dots — all computed from the actual
 * per-cell expression values in query.centerView.points grouped by
 * clusterId. No synthetic shapes.
 */
interface BoxStats {
  clusterId: number;
  clusterLabel: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  whiskerLow: number;
  whiskerHigh: number;
  outliers: number[];
  n: number;
}

function computeBoxStats(values: number[]): Omit<BoxStats, 'clusterId' | 'clusterLabel'> {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const quantile = (p: number) => {
    if (n === 0) return 0;
    const pos = (n - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };
  const q1 = quantile(0.25);
  const median = quantile(0.5);
  const q3 = quantile(0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const whiskerLow = sorted.find((v) => v >= lowerFence) ?? sorted[0] ?? 0;
  const whiskerHigh = [...sorted].reverse().find((v) => v <= upperFence) ?? sorted[n - 1] ?? 0;
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
  return {
    min: sorted[0] ?? 0,
    q1,
    median,
    q3,
    whiskerLow,
    whiskerHigh,
    outliers,
    n,
  };
}

function BoxPlotPanel({ query }: { query: ScSpatialQueryResponse }) {
  const points = query.centerView.points;

  const stats: BoxStats[] = useMemo(() => {
    const byCluster = new Map<number, { label: string; values: number[] }>();
    for (const pt of points) {
      const bucket = byCluster.get(pt.clusterId) ?? { label: pt.clusterLabel, values: [] };
      bucket.values.push(pt.expression);
      byCluster.set(pt.clusterId, bucket);
    }
    return Array.from(byCluster.entries())
      .map(([clusterId, bucket]) => ({
        clusterId,
        clusterLabel: bucket.label,
        ...computeBoxStats(bucket.values),
      }))
      .filter((s) => s.n > 0)
      .sort((a, b) => a.clusterId - b.clusterId)
      .slice(0, 8);
  }, [points]);

  if (stats.length === 0) {
    return <div className={styles.analysisFigure} />;
  }

  const globalMin = Math.min(...stats.map((s) => Math.min(s.whiskerLow, s.min, ...s.outliers.slice(0, 8))));
  const globalMax = Math.max(...stats.map((s) => Math.max(s.whiskerHigh, ...s.outliers.slice(0, 8))));
  const range = Math.max(globalMax - globalMin, 0.001);
  const padLo = range * 0.08;
  const padHi = range * 0.08;
  const yMin = globalMin - padLo;
  const yMax = globalMax + padHi;

  const W = 320;
  const H = 150;
  const marginL = 34;
  const marginR = 10;
  const marginT = 10;
  const marginB = 28;
  const plotW = W - marginL - marginR;
  const plotH = H - marginT - marginB;

  const xFor = (idx: number) => marginL + plotW * ((idx + 0.5) / stats.length);
  const yFor = (v: number) => marginT + plotH * (1 - (v - yMin) / (yMax - yMin));
  const boxW = Math.min(plotW / stats.length * 0.55, 22);

  const yTicks = [yMin, yMin + (yMax - yMin) * 0.25, yMin + (yMax - yMin) * 0.5, yMin + (yMax - yMin) * 0.75, yMax];

  return (
    <div className={styles.analysisFigure}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <rect width={W} height={H} fill="#ffffff" />
        {/* gridlines */}
        {yTicks.map((t, idx) => (
          <line
            key={`grid-${idx}`}
            x1={marginL}
            y1={yFor(t)}
            x2={W - marginR}
            y2={yFor(t)}
            stroke="#f1f5f9"
            strokeWidth={0.5}
          />
        ))}
        {/* axes */}
        <line x1={marginL} y1={marginT} x2={marginL} y2={marginT + plotH} stroke="#111827" strokeWidth={0.6} />
        <line x1={marginL} y1={marginT + plotH} x2={W - marginR} y2={marginT + plotH} stroke="#111827" strokeWidth={0.6} />
        {/* y ticks */}
        {yTicks.map((t, idx) => (
          <g key={`tick-${idx}`}>
            <line x1={marginL - 2} y1={yFor(t)} x2={marginL} y2={yFor(t)} stroke="#111827" strokeWidth={0.5} />
            <text
              x={marginL - 3}
              y={yFor(t) + 2}
              fontSize={7}
              fill="#475569"
              textAnchor="end"
              fontFamily="var(--font-mono)"
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={8}
          y={marginT + plotH / 2}
          fontSize={7.5}
          fill="#374151"
          fontFamily="var(--font-mono)"
          fontWeight={700}
          textAnchor="middle"
          transform={`rotate(-90 8 ${marginT + plotH / 2})`}
        >
          Expression
        </text>
        {/* boxes */}
        {stats.map((s, idx) => {
          const x = xFor(idx);
          const color = colorForCluster(s.clusterId);
          return (
            <g key={s.clusterId}>
              {/* lower whisker */}
              <line x1={x} y1={yFor(s.whiskerLow)} x2={x} y2={yFor(s.q1)} stroke="#111827" strokeWidth={0.5} />
              <line x1={x - boxW * 0.3} y1={yFor(s.whiskerLow)} x2={x + boxW * 0.3} y2={yFor(s.whiskerLow)} stroke="#111827" strokeWidth={0.5} />
              {/* upper whisker */}
              <line x1={x} y1={yFor(s.whiskerHigh)} x2={x} y2={yFor(s.q3)} stroke="#111827" strokeWidth={0.5} />
              <line x1={x - boxW * 0.3} y1={yFor(s.whiskerHigh)} x2={x + boxW * 0.3} y2={yFor(s.whiskerHigh)} stroke="#111827" strokeWidth={0.5} />
              {/* IQR box */}
              <rect
                x={x - boxW / 2}
                y={yFor(s.q3)}
                width={boxW}
                height={Math.max(1, yFor(s.q1) - yFor(s.q3))}
                fill={color}
                fillOpacity={0.55}
                stroke="#111827"
                strokeWidth={0.6}
              />
              {/* median */}
              <line
                x1={x - boxW / 2}
                y1={yFor(s.median)}
                x2={x + boxW / 2}
                y2={yFor(s.median)}
                stroke="#111827"
                strokeWidth={1.1}
              />
              {/* outliers (limit to 6 each side for clutter) */}
              {s.outliers.slice(0, 12).map((o, oIdx) => (
                <circle
                  key={`out-${oIdx}`}
                  cx={x}
                  cy={yFor(o)}
                  r={1.1}
                  fill="none"
                  stroke="#111827"
                  strokeWidth={0.35}
                />
              ))}
              {/* x label */}
              <text
                x={x}
                y={marginT + plotH + 9}
                fontSize={7}
                fill="#111827"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
              >
                {s.clusterLabel.length > 6 ? `${s.clusterLabel.slice(0, 5)}…` : s.clusterLabel}
              </text>
              <text
                x={x}
                y={marginT + plotH + 17}
                fontSize={6}
                fill="#6b7280"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
              >
                n={s.n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AnalysisStrip({ query }: { query: ScSpatialQueryResponse }) {
  const [activeTab, setActiveTab] = useState<AnalysisTabKey>('context');
  const selectedGene = query.selection.selectedGene;
  const selectedCluster = query.rightPanel.selectedClusterSummary?.clusterLabel;

  const caption =
    activeTab === 'context'
      ? selectedCluster
        ? `Spatial footprint with ROI highlighted for ${selectedCluster}.`
        : 'Tissue boundary from convex hull of all cells; domains colored by cluster.'
      : activeTab === 'marker'
      ? 'Top marker genes by domain; intensity encodes rank within each cluster, accented by spatial autocorrelation.'
      : `Tukey box plot of ${selectedGene || 'target gene'} expression per domain: IQR, median, 1.5×IQR whiskers, outliers.`;

  return (
    <div className={styles.analysisStrip}>
      <div className={styles.analysisTabs} role="tablist" aria-label="Secondary analysis">
        {ANALYSIS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`${styles.analysisTab} ${activeTab === tab.key ? styles.analysisTabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.analysisPanel}>
        <p className={styles.analysisCaption}>{caption}</p>
        {activeTab === 'context' ? <SpatialContextPanel query={query} /> : null}
        {activeTab === 'marker' ? <MarkerHeatmapPanel query={query} /> : null}
        {activeTab === 'distribution' ? <BoxPlotPanel query={query} /> : null}
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

  const topHotspot = query.rightPanel.hotspots[0];
  const nCells = query.centerView.points.length;
  const selectedClusterLabel = query.rightPanel.selectedClusterSummary?.clusterLabel;

  return (
    <section className={styles.viewport} aria-label="SCSPATIAL viewport">
      <div className={styles.viewportHeader}>
        <div className={styles.viewportTitle}>
          <h2>{SCSPATIAL_VIEW_LABELS[query.selection.viewMode]}</h2>
          <div className={styles.viewportHeadline}>
            {query.selection.selectedGene ? (
              <span><strong>{query.selection.selectedGene}</strong> readout</span>
            ) : (
              <span className={styles.viewportHeadlineMuted}>Select a gene to inspect expression</span>
            )}
            {topHotspot ? (
              <>
                <span className={styles.viewportHeadlineDivider} />
                <span className={styles.viewportHeadlineMuted}>
                  top hotspot <strong style={{ color: 'var(--sc-value)' }}>{topHotspot.geneSymbol}</strong> (I={topHotspot.moranI.toFixed(2)})
                </span>
              </>
            ) : null}
            {selectedClusterLabel ? (
              <>
                <span className={styles.viewportHeadlineDivider} />
                <span className={styles.viewportHeadlineMuted}>cluster <strong style={{ color: 'var(--sc-value)' }}>{selectedClusterLabel}</strong></span>
              </>
            ) : null}
            <span className={styles.viewportHeadlineDivider} />
            <span className={styles.viewportHeadlineMuted}>n = {nCells.toLocaleString()} cells</span>
          </div>
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
