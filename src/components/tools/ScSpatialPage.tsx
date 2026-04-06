'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { computeConvexHull, expandHull } from '../../utils/vizUtils';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import DataTable from '../ide/shared/DataTable';
import type { TableColumn } from '../ide/shared/DataTable';
import { SC_SPATIAL_DATA, GENE_LIST, CLUSTER_LABELS } from '../../data/mockScSpatial';
import { runFullPipeline } from '../../services/ScSpatialEngine';
import type { ScSpatialAnalysisResult, HighYieldCluster, MoranResult } from '../../services/ScSpatialEngine';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import { useWorkbenchStore } from '../../store/workbenchStore';
import ScientificHero from './shared/ScientificHero';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import { PATHD_THEME } from '../workbench/workbenchTheme';

/* ── Design Tokens ────────────────────────────────────────────────── */

const PANEL_BG = PATHD_THEME.sepiaPanelMuted;
const BORDER = PATHD_THEME.paperBorder;
const LABEL = PATHD_THEME.paperLabel;
const VALUE = PATHD_THEME.paperValue;
const INPUT_BG = PATHD_THEME.paperSurfaceStrong;
const INPUT_BORDER = PATHD_THEME.paperBorder;
const INPUT_TEXT = PATHD_THEME.paperValue;

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  background: PATHD_THEME.paperSurfaceStrong,
  border: `1px solid ${PATHD_THEME.paperBorder}`,
};

const CLUSTER_COLORS: Record<number, string> = {
  0: '#F0FDFA',
  1: '#5151CD',
  2: '#FA8072',
  3: '#FFFB1F',
  4: '#FF1FFF',
};

const CLUSTER_PAL = ['#E41A1C','#377EB8','#4DAF4A','#984EA3','#FF7F00','#A65628','#F781BF','#FFFF33'];

function viridisColor(t: number): string {
  const stops: [number, number, number][] = [[68,1,84],[49,104,142],[53,183,121],[144,215,67],[253,231,37]];
  const s = Math.max(0, Math.min(1, t)) * 4;
  const lo = Math.floor(s), hi = Math.min(4, lo + 1), f = s - lo;
  const [r1,g1,b1] = stops[lo], [r2,g2,b2] = stops[hi];
  return `rgb(${Math.round(r1+(r2-r1)*f)},${Math.round(g1+(g2-g1)*f)},${Math.round(b1+(b2-b1)*f)})`;
}

type ViewMode = 'Spatial' | 'Spatial3D' | 'UMAP' | 'Trajectory' | 'Efficiency' | 'Heatmap' | 'Table';

function canonicalGeneToken(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function findPreferredSpatialGene(candidates: string[]) {
  const availableTokens = new Map(GENE_LIST.map((gene) => [canonicalGeneToken(gene), gene]));
  for (const candidate of candidates) {
    const token = canonicalGeneToken(candidate);
    if (!token) continue;
    const exact = availableTokens.get(token);
    if (exact) return exact;
    const partial = GENE_LIST.find((gene) => token.includes(canonicalGeneToken(gene)) || canonicalGeneToken(gene).includes(token));
    if (partial) return partial;
  }
  return GENE_LIST[0] ?? 'ADS';
}

/* ── Section Label (same as MultiOPage) ───────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.1em', color: LABEL, margin: '0 0 10px',
  }}>
    {children}
  </p>
);

/* ── Cell Table Columns ───────────────────────────────────────────── */

interface CellRow {
  id: string;
  barcode: string;
  cluster: number;
  cellType: string;
  totalCounts: number;
  nGenes: number;
  mitoPercent: number;
  pseudotime: number;
}

const CELL_COLUMNS: TableColumn<CellRow>[] = [
  { key: 'id',          header: 'Cell',     width: 70 },
  { key: 'barcode',     header: 'Barcode',  width: 100 },
  { key: 'cluster',     header: 'Cl.',      width: 35,
    render: v => (
      <span style={{
        fontFamily: T.MONO, fontSize: '10px',
        color: CLUSTER_COLORS[v as number] ?? VALUE,
      }}>
        {v as number}
      </span>
    ),
  },
  { key: 'cellType',    header: 'Type',     width: 110 },
  { key: 'totalCounts', header: 'Counts',   width: 60,
    render: v => (
      <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>
        {(v as number).toLocaleString()}
      </span>
    ),
  },
  { key: 'nGenes',      header: 'Genes',    width: 50,
    render: v => (
      <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>
        {v as number}
      </span>
    ),
  },
  { key: 'mitoPercent',  header: 'Mito%',   width: 50,
    render: v => (
      <span style={{
        fontFamily: T.MONO, fontSize: '10px',
        color: (v as number) > 20 ? 'rgba(250,128,114,0.85)' : VALUE,
      }}>
        {(v as number).toFixed(1)}
      </span>
    ),
  },
  { key: 'pseudotime',  header: 'PT',       width: 50,
    render: v => (
      <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>
        {(v as number).toFixed(2)}
      </span>
    ),
  },
];

/* ── Visium-style hexagonal spot helper ───────────────────────────── */

function hexPath(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top
    const x = (cx + r * Math.cos(angle)).toFixed(2);
    const y = (cy + r * Math.sin(angle)).toFixed(2);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ') + ' Z';
}

/* ── Spatial Map SVG — publication-quality hexagonal spot grid ─────── */

// Hexagonal spot grid parameters
const HEX_ROWS = 25, HEX_COLS = 16, HEX_W = 24, HEX_H = 21, HEX_R = 9;

// Cluster centers in normalized [0,1] grid space for spot assignment
const SPOT_CENTERS: [number, number][] = [
  [0.72, 0.22], [0.30, 0.18], [0.12, 0.62], [0.58, 0.78], [0.46, 0.46],
];

// Seeded PRNG for reproducible spot assignments
function mkRng(seed = 7919) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
}

// Pre-generate 400 hex spots with cluster + base-expression assignments
const HEX_SPOTS = (() => {
  const rng = mkRng();
  return Array.from({ length: HEX_ROWS }, (_, row) =>
    Array.from({ length: HEX_COLS }, (_, col) => {
      const px = 36 + col * HEX_W + (row % 2) * HEX_W / 2;
      const py = 36 + row * HEX_H;
      const nx = col / (HEX_COLS - 1), ny = row / (HEX_ROWS - 1);
      let best = 0, bestD = Infinity;
      SPOT_CENTERS.forEach(([cx, cy], ci) => {
        const jx = nx + (rng() - 0.5) * 0.28, jy = ny + (rng() - 0.5) * 0.28;
        const d = Math.sqrt((jx - cx) ** 2 + (jy - cy) ** 2);
        if (d < bestD) { bestD = d; best = ci; }
      });
      const baseExpr = rng();
      return { px, py, cluster: best, baseExpr };
    })
  ).flat();
})();

function SpatialMap({ cells, selectedCluster, highlightGene }: {
  cells: typeof SC_SPATIAL_DATA;
  selectedCluster: number | null;
  highlightGene: string;
}) {
  const W = 520, H = 570;

  // Per-cluster mean expression from real data
  const clusterMeanExpr = useMemo(() => {
    const means: Record<number, number> = {};
    for (let c = 0; c < 5; c++) {
      const vals = cells.filter(cell => cell.cluster === c).map(cell => cell.geneExpression[highlightGene] ?? 0);
      means[c] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    return means;
  }, [cells, highlightGene]);

  const geneMax = useMemo(() => Math.max(...Object.values(clusterMeanExpr), 0.01), [clusterMeanExpr]);

  // Color bar gradient stops (viridis)
  const viridisStops = ['#440154','#31688e','#35b779','#90d743','#fde725'];

  return (
    <svg role="img" aria-label="Visium hexagonal spot grid" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="sc-viridis-bar" x1="0" y1="0" x2="0" y2="1">
          {viridisStops.map((c, i) => (
            <stop key={i} offset={`${i * 25}%`} stopColor={c} />
          )).reverse()}
        </linearGradient>
        <filter id="sc-spot-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="#050505" rx={12} />

      {/* Kidney-bean tissue outline */}
      <path
        d="M 160 38 C 240 12 390 20 450 80 C 500 130 505 210 488 300 C 472 390 420 470 340 510 C 280 540 210 545 160 520 C 90 490 36 440 26 360 C 14 270 34 160 80 100 C 108 68 130 48 160 38 Z"
        fill="rgba(180,160,140,0.06)" stroke="rgba(200,180,160,0.15)" strokeWidth={1.5} />

      {/* Hex spots */}
      {HEX_SPOTS.map((spot, i) => {
        if (selectedCluster !== null && spot.cluster !== selectedCluster) return null;
        const meanExpr = clusterMeanExpr[spot.cluster] ?? 0;
        const expr = Math.max(0, meanExpr * (0.6 + spot.baseExpr * 0.8));
        const t = expr / geneMax;
        const fill = highlightGene ? viridisColor(t) : CLUSTER_PAL[spot.cluster % 8];
        const opacity = highlightGene ? 0.55 + t * 0.42 : (selectedCluster === null ? 0.82 : 0.9);
        const isSelected = selectedCluster !== null && spot.cluster === selectedCluster;
        return (
          <g key={i}>
            {isSelected && (
              <path d={hexPath(spot.px, spot.py, HEX_R + 4)}
                fill={fill} opacity={0.18} filter="url(#sc-spot-glow)" />
            )}
            <path d={hexPath(spot.px, spot.py, HEX_R)}
              fill={fill}
              stroke={isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}
              strokeWidth={isSelected ? 0.7 : 0.35}
              opacity={opacity} />
          </g>
        );
      })}

      {/* Axis labels */}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>
        Spatial X (μm)
      </text>
      <text x={10} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,10,${H / 2})`}>
        Spatial Y (μm)
      </text>
      <text x={36} y={24} fontFamily={T.MONO} fontSize="8" fill={LABEL}>
        10x Visium · {HEX_SPOTS.length} spots · {highlightGene || 'cluster identity'}
      </text>

      {/* Cluster legend */}
      {CLUSTER_LABELS && Object.entries(CLUSTER_LABELS).map(([k, label], i) => {
        const active = selectedCluster === null || selectedCluster === Number(k);
        return (
          <g key={k} transform={`translate(${W - 128}, ${36 + i * 17})`}>
            <path d={hexPath(0, 0, 5)} fill={CLUSTER_PAL[Number(k) % 8]} opacity={active ? 0.9 : 0.22} />
            <text x={12} y={4} fontFamily={T.SANS} fontSize="8.5"
              fill={active ? VALUE : LABEL}>
              {label}
            </text>
          </g>
        );
      })}

      {/* ── Viridis expression colorbar (when gene is selected) ── */}
      {highlightGene && (
        <g transform={`translate(${W - 28}, 120)`}>
          <rect x="0" y="0" width="10" height="120" rx="3" fill="url(#sc-viridis-bar)" />
          {/* Tick marks */}
          {[{t: 0, v: geneMax.toFixed(2)}, {t: 0.5, v: (geneMax/2).toFixed(2)}, {t: 1, v: '0'}].map(({t, v}) => {
            const y = t * 120;
            return (
              <g key={v}>
                <line x1="10" y1={y} x2="14" y2={y} stroke={LABEL} strokeWidth={0.7} />
                <text x="17" y={y + 3} fontFamily={T.MONO} fontSize="6.5" fill={LABEL}>{v}</text>
              </g>
            );
          })}
          <text x="5" y="-4" textAnchor="middle" fontFamily={T.MONO} fontSize="6.5" fill={LABEL}>
            {highlightGene}
          </text>
        </g>
      )}

      {/* ── Scale bar — 500 μm reference (Nature/10x Genomics standard) ── */}
      {/* Bar width = ~55px ≈ 500 μm at typical Visium capture area scale */}
      <g transform={`translate(32, ${H - 22})`}>
        <line x1="0" y1="0" x2="55" y2="0" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
        <line x1="0" y1="-3" x2="0" y2="3" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
        <line x1="55" y1="-3" x2="55" y2="3" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
        <text x="27.5" y="-5" textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.5)">
          500 μm
        </text>
      </g>
    </svg>
  );
}

function SpatialPointCloud({ cells, selectedCluster, highlightGene, showQCFailed }: {
  cells: typeof SC_SPATIAL_DATA;
  selectedCluster: number | null;
  highlightGene: string;
  showQCFailed: boolean;
}) {
  const filtered = useMemo(
    () => cells.filter(cell => (showQCFailed || cell.qcPass) && (selectedCluster === null || cell.cluster === selectedCluster)),
    [cells, selectedCluster, showQCFailed],
  );

  const bounds = useMemo(() => {
    const xs = filtered.map(c => c.spatialX);
    const ys = filtered.map(c => c.spatialY);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const geneMax = Math.max(...filtered.map(c => c.geneExpression[highlightGene] ?? 0), 1);
    return { xMin, xRange: xMax - xMin || 1, yMin, yRange: yMax - yMin || 1, geneMax };
  }, [filtered, highlightGene]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '420px', borderRadius: '18px', overflow: 'hidden', border: `1px solid ${BORDER}`, background: '#050505', position: 'relative' }}>
      <Canvas camera={{ position: [0, 8, 16], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[6, 10, 8]} intensity={1.0} />
        <pointLight position={[-8, 6, -4]} intensity={0.45} color="#5151CD" />
        <gridHelper args={[18, 12, '#1f1f1f', '#111111']} position={[0, -2.6, 0]} />
        <group position={[-4.5, 0, -4.5]}>
          {filtered.map(cell => {
            const expr = cell.geneExpression[highlightGene] ?? 0;
            const intensity = expr / bounds.geneMax;
            const x = ((cell.spatialX - bounds.xMin) / bounds.xRange) * 9;
            const z = ((cell.spatialY - bounds.yMin) / bounds.yRange) * 9;
            const y = highlightGene ? intensity * 3.6 : cell.pseudotime * 3;
            const radius = 0.08 + intensity * 0.18 + (cell.qcPass ? 0 : 0.04);
            const color = highlightGene ? '#93CB52' : CLUSTER_COLORS[cell.cluster] ?? '#888';
            return (
              <mesh key={cell.id} position={[x, y, z]}>
                <sphereGeometry args={[radius, 12, 12]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.22 + intensity * 0.25} transparent opacity={cell.qcPass ? 0.55 + intensity * 0.35 : 0.35} />
              </mesh>
            );
          })}
        </group>
        <OrbitControls enablePan={false} minDistance={8} maxDistance={28} />
      </Canvas>
      <div style={{ position: 'absolute', top: '10px', left: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
          X/Y = tissue plane
        </span>
        <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
          Height = {highlightGene ? `${highlightGene} expression` : 'pseudotime'}
        </span>
      </div>
    </div>
  );
}

/* ── UMAP Scatter SVG — 8 Gaussian blob clusters ─────────────────── */

// 8 cluster centers (pixel space within 520×450)
const UMAP_CENTERS: [number, number][] = [
  [120,170],[280,90],[415,155],[350,275],[175,315],[80,375],[460,345],[310,425],
];
const UMAP_LABELS = [
  'High Producers','Metabolically Active','Stressed','Quiescent',
  'Transitioning','Progenitor','Senescent','Proliferating',
];

// Pre-generate 300 UMAP blob points (seeded, ~37-38 per cluster)
const UMAP_POINTS = (() => {
  const rng = mkRng(31337);
  const gauss = (mu: number, sd: number) => {
    const u = rng() || 1e-10, v = rng();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return Array.from({ length: 300 }, (_, i) => {
    const cl = i % 8;
    const [mx, my] = UMAP_CENTERS[cl];
    return { x: gauss(mx, 32), y: gauss(my, 28), cluster: cl };
  });
})();

function UMAPScatter({ selectedCluster }: { selectedCluster: number | null }) {
  const W = 520, H = 460;

  const centroids = useMemo(() => {
    const acc: Record<number, {sx: number; sy: number; n: number}> = {};
    UMAP_POINTS.forEach(p => {
      if (!acc[p.cluster]) acc[p.cluster] = {sx: 0, sy: 0, n: 0};
      acc[p.cluster].sx += p.x; acc[p.cluster].sy += p.y; acc[p.cluster].n++;
    });
    Object.values(acc).forEach(c => { c.sx /= c.n; c.sy /= c.n; });
    return acc;
  }, []);

  // Convex hull per cluster for territory fill
  const hulls = useMemo(() => {
    const byCluster: Record<number, {sx: number; sy: number}[]> = {};
    UMAP_POINTS.forEach(p => {
      if (!byCluster[p.cluster]) byCluster[p.cluster] = [];
      byCluster[p.cluster].push({ sx: p.x, sy: p.y });
    });
    return Object.fromEntries(
      Object.entries(byCluster)
        .filter(([, pts]) => pts.length >= 3)
        .map(([k, pts]) => [k, expandHull(computeConvexHull(pts), 18)])
    );
  }, []);

  return (
    <svg role="img" aria-label="UMAP embedding" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <filter id="umap-hull-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="#050505" rx={12} />

      {/* Axis lines */}
      <line x1={30} y1={H - 28} x2={W - 20} y2={H - 28} stroke="rgba(255,255,255,0.08)" strokeWidth={0.7} />
      <line x1={30} y1={22} x2={30} y2={H - 28} stroke="rgba(255,255,255,0.08)" strokeWidth={0.7} />
      <text x={W / 2} y={H - 8} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>UMAP1</text>
      <text x={12} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,12,${H / 2})`}>UMAP2</text>
      <text x={36} y={16} fontFamily={T.MONO} fontSize="7.5" fill={LABEL}>
        scVAE latent embedding · 8 cell state clusters
      </text>

      {/* Cluster hulls */}
      {Object.entries(hulls).map(([k, hull]) => {
        const cl = Number(k);
        if (selectedCluster !== null && selectedCluster !== cl) return null;
        const color = CLUSTER_PAL[cl % 8];
        const poly = hull.map(p => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ');
        return (
          <g key={`hull-${k}`}>
            <polygon points={poly} fill={color} opacity={0.18} filter="url(#umap-hull-blur)" />
            <polygon points={poly} fill={color} opacity={0.04}
              stroke={color} strokeWidth={1} strokeOpacity={0.4} />
          </g>
        );
      })}

      {/* Points */}
      {UMAP_POINTS.map((p, i) => {
        if (selectedCluster !== null && p.cluster !== selectedCluster) return null;
        const color = CLUSTER_PAL[p.cluster % 8];
        const dimmed = selectedCluster !== null && p.cluster !== selectedCluster;
        return (
          <circle key={i} cx={p.x} cy={p.y} r={3.8}
            fill={color} opacity={dimmed ? 0.15 : 0.82} />
        );
      })}

      {/* Centroid labels */}
      {Object.entries(centroids).map(([k, c]) => {
        const cl = Number(k);
        if (selectedCluster !== null && selectedCluster !== cl) return null;
        const label = UMAP_LABELS[cl] ?? `C${cl}`;
        return (
          <text key={k} x={c.sx} y={c.sy - 14} textAnchor="middle"
            fontFamily={T.MONO} fontSize="8" fontWeight={600}
            fill={CLUSTER_PAL[cl % 8]} style={{ pointerEvents: 'none' }}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Trajectory / PAGA SVG ────────────────────────────────────────── */

function TrajectoryView({ analysis }: { analysis: ScSpatialAnalysisResult }) {
  const W = 520, H = 420, PAD = 60;
  const paga = analysis.paga;
  const clusters = analysis.clusters;

  const clusterPseudo = useMemo(() => {
    const map: Record<number, number> = {};
    const ptMap: Record<number, number[]> = {};
    SC_SPATIAL_DATA.forEach(c => {
      if (!ptMap[c.cluster]) ptMap[c.cluster] = [];
      ptMap[c.cluster].push(c.pseudotime);
    });
    Object.entries(ptMap).forEach(([k, pts]) => {
      map[Number(k)] = pts.reduce((a, b) => a + b, 0) / pts.length;
    });
    return map;
  }, []);

  const verticalSpread: Record<number, number> = { 0: 0.25, 1: 0.65, 2: 0.85, 3: 0.15, 4: 0.5 };

  function nodeX(cluster: number) {
    return PAD + (clusterPseudo[cluster] ?? 0.5) * (W - PAD * 2);
  }
  function nodeY(cluster: number) {
    return PAD + (verticalSpread[cluster] ?? 0.5) * (H - PAD * 2);
  }

  const sizeScale = useMemo(() => {
    const sizes = clusters.clusterSizes.map(c => c.size);
    const mx = Math.max(...sizes, 1);
    return (n: number) => 14 + (n / mx) * 22;
  }, [clusters]);

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      {/* Pseudotime axis */}
      <line x1={PAD} y1={H - 28} x2={W - PAD} y2={H - 28} stroke="rgba(255,255,255,0.1)" />
      <text x={PAD} y={H - 14} fontFamily={T.MONO} fontSize="8" fill={LABEL}>0.0</text>
      <text x={W - PAD} y={H - 14} textAnchor="end" fontFamily={T.MONO} fontSize="8" fill={LABEL}>1.0</text>
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>
        Pseudotime →
      </text>
      {/* Trajectory edges */}
      {paga.trajectory.map((edge, i) => {
        const x1 = nodeX(edge.from), y1 = nodeY(edge.from);
        const x2 = nodeX(edge.to), y2 = nodeY(edge.to);
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len, uy = dy / len;
        const arrowLen = 8;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={`rgba(255,255,255,${0.1 + edge.weight * 0.3})`}
              strokeWidth={1 + edge.weight * 2} />
            <polygon
              points={`${x2},${y2} ${x2 - ux * arrowLen - uy * 4},${y2 - uy * arrowLen + ux * 4} ${x2 - ux * arrowLen + uy * 4},${y2 - uy * arrowLen - ux * 4}`}
              fill={`rgba(255,255,255,${0.15 + edge.weight * 0.2})`} />
          </g>
        );
      })}
      {/* Cluster nodes */}
      {clusters.clusterSizes.map(cs => {
        const cx = nodeX(cs.cluster);
        const cy = nodeY(cs.cluster);
        const r = sizeScale(cs.size);
        return (
          <g key={cs.cluster}>
            <circle cx={cx} cy={cy} r={r}
              fill={`${CLUSTER_COLORS[cs.cluster]}30`}
              stroke={CLUSTER_COLORS[cs.cluster]}
              strokeWidth={1.5} />
            <text x={cx} y={cy + 3} textAnchor="middle"
              fontFamily={T.MONO} fontSize="10" fontWeight={600}
              fill={CLUSTER_COLORS[cs.cluster]}>
              {cs.size}
            </text>
            <text x={cx} y={cy + r + 12} textAnchor="middle"
              fontFamily={T.SANS} fontSize="8" fill={VALUE}>
              {cs.label}
            </text>
          </g>
        );
      })}
      {/* Branching point diamonds */}
      {paga.branchingPoints.map((bp, i) => {
        const cx = nodeX(bp.cluster);
        const cy = nodeY(bp.cluster) - sizeScale(
          clusters.clusterSizes.find(c => c.cluster === bp.cluster)?.size ?? 30
        ) - 8;
        return (
          <g key={i}>
            <polygon points={`${cx},${cy - 6} ${cx + 5},${cy} ${cx},${cy + 6} ${cx - 5},${cy}`}
              fill="rgba(255,139,31,0.7)" stroke="rgba(255,139,31,0.9)" strokeWidth={0.8} />
            <text x={cx + 8} y={cy + 3} fontFamily={T.MONO} fontSize="7" fill="rgba(255,139,31,0.8)">
              Branch
            </text>
          </g>
        );
      })}
      {/* Root indicator */}
      <text x={nodeX(paga.rootCluster)} y={nodeY(paga.rootCluster) - sizeScale(
        clusters.clusterSizes.find(c => c.cluster === paga.rootCluster)?.size ?? 30
      ) - 14} textAnchor="middle"
        fontFamily={T.SANS} fontSize="8" fontWeight={600} fill="rgba(255,139,31,0.9)">
        ▼ Root
      </text>
    </svg>
  );
}

/* ── Efficiency Heatmap / Bar Chart ───────────────────────────────── */

function EfficiencyChart({ highYield }: { highYield: HighYieldCluster[] }) {
  const W = 520, H = 420, PAD = { top: 40, right: 30, bottom: 60, left: 60 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const barGroupW = innerW / highYield.length;
  const barW = Math.max(12, barGroupW * 0.3);

  const FATE_COLORS: Record<string, string> = {
    productive: 'rgba(147,203,82,0.75)',
    stressed:   'rgba(250,128,114,0.65)',
    quiescent:  'rgba(255,139,31,0.65)',
  };

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      {/* Y-axis */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.1)" />
      {[0, 0.25, 0.5, 0.75, 1.0].map(v => {
        const y = H - PAD.bottom - v * innerH;
        return (
          <g key={v}>
            <line x1={PAD.left - 4} y1={y} x2={PAD.left} y2={y} stroke="rgba(255,255,255,0.15)" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.25)">
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
      <text x={14} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,14,${H / 2})`}>Score</text>
      {/* Bars per cluster */}
      {highYield.map((hy, i) => {
        const gx = PAD.left + i * barGroupW + barGroupW / 2;
        const effH = hy.avgMetabolicEfficiency * innerH;
        const prodH = hy.avgProductivity * innerH;
        return (
          <g key={hy.clusterId}>
            {/* Efficiency bar */}
            <rect x={gx - barW - 2} y={H - PAD.bottom - effH}
              width={barW} height={effH}
              fill={CLUSTER_COLORS[hy.clusterId] ?? '#888'} rx={2} opacity={0.8} />
            {/* Productivity bar */}
            <rect x={gx + 2} y={H - PAD.bottom - prodH}
              width={barW} height={prodH}
              fill={FATE_COLORS[hy.fate] ?? '#888'} rx={2} opacity={0.8} />
            {/* Label */}
            <text x={gx} y={H - PAD.bottom + 14} textAnchor="middle"
              fontFamily={T.SANS} fontSize="8" fill={VALUE}>
              {hy.label.length > 14 ? hy.label.slice(0, 12) + '…' : hy.label}
            </text>
            {/* Fate label */}
            <text x={gx} y={H - PAD.bottom + 26} textAnchor="middle"
              fontFamily={T.MONO} fontSize="7" fill={FATE_COLORS[hy.fate] ?? LABEL}>
              {hy.fate}
            </text>
            {/* Key genes */}
            <text x={gx} y={H - PAD.bottom + 38} textAnchor="middle"
              fontFamily={T.MONO} fontSize="6" fill={LABEL}>
              {hy.keyGenes.slice(0, 3).map(g => g.gene).join(', ')}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      {[
        { color: CLUSTER_COLORS[0], label: 'Efficiency' },
        { color: 'rgba(147,203,82,0.75)', label: 'Productivity' },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.left + i * 100},${PAD.top - 16})`}>
          <rect width={10} height={8} rx={1} fill={l.color} />
          <text x={14} y={8} fontFamily={T.SANS} fontSize="8" fill="rgba(255,255,255,0.35)">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Expression Heatmap — 20 genes × 5 clusters ───────────────────── */

function ExpressionHeatmap({ cells }: { cells: typeof SC_SPATIAL_DATA }) {
  const N_GENES = 20;
  const N_CLUSTERS = 5;
  const genes = GENE_LIST.slice(0, N_GENES);
  const W = 520, H = 460;
  const LEFT_PAD = 70, TOP_PAD = 80, RIGHT_PAD = 55, BOT_PAD = 28;
  const cellW = (W - LEFT_PAD - RIGHT_PAD) / N_CLUSTERS;
  const cellH = (H - TOP_PAD - BOT_PAD) / N_GENES;

  // Compute mean expression per gene per cluster
  const matrix = useMemo(() => {
    return genes.map(gene => {
      const row: number[] = [];
      for (let c = 0; c < N_CLUSTERS; c++) {
        const vals = cells.filter(cell => cell.cluster === c).map(cell => cell.geneExpression[gene] ?? 0);
        row.push(vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
      }
      return row;
    });
  }, [cells]);

  // Normalize each gene row to [0, 1]
  const normalized = useMemo(() => matrix.map(row => {
    const mx = Math.max(...row, 0.001);
    return row.map(v => v / mx);
  }), [matrix]);

  const viridisStops = ['#440154','#31688e','#35b779','#90d743','#fde725'];
  const clusterNames = Object.values(CLUSTER_LABELS);

  return (
    <svg role="img" aria-label="Expression heatmap" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="hm-viridis" x1="0" y1="0" x2="0" y2="1">
          {viridisStops.map((c, i) => (
            <stop key={i} offset={`${i * 25}%`} stopColor={c} />
          )).reverse()}
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <text x={LEFT_PAD} y={18} fontFamily={T.MONO} fontSize="9" fill={LABEL}>
        Mean expression · {N_GENES} genes × {N_CLUSTERS} cell state clusters · viridis scale
      </text>

      {/* Cluster column labels (rotated 45°) */}
      {clusterNames.map((name, ci) => {
        const x = LEFT_PAD + ci * cellW + cellW / 2;
        const y = TOP_PAD - 8;
        return (
          <text key={ci} x={x} y={y}
            textAnchor="start" fontFamily={T.MONO} fontSize="8"
            fill={CLUSTER_PAL[ci % 8]}
            transform={`rotate(-42, ${x}, ${y})`}>
            {name.length > 12 ? name.slice(0, 11) + '…' : name}
          </text>
        );
      })}

      {/* Heatmap cells */}
      {normalized.map((row, gi) =>
        row.map((val, ci) => {
          const x = LEFT_PAD + ci * cellW;
          const y = TOP_PAD + gi * cellH;
          return (
            <rect key={`${gi}-${ci}`}
              x={x + 0.5} y={y + 0.5}
              width={cellW - 1} height={cellH - 1}
              fill={viridisColor(val)}
              rx={1}
            />
          );
        })
      )}

      {/* Gene row labels */}
      {genes.map((gene, gi) => (
        <text key={gene}
          x={LEFT_PAD - 4}
          y={TOP_PAD + gi * cellH + cellH / 2 + 3}
          textAnchor="end"
          fontFamily={T.MONO} fontSize="7.5" fill={VALUE}>
          {gene}
        </text>
      ))}

      {/* ── Publication colorbar — viridis scale with labelled ticks ── */}
      {/* Matches Nature/10x Genomics figure standard: bar + 3 tick marks + unit label */}
      <rect x={W - RIGHT_PAD + 8} y={TOP_PAD} width={10} height={H - TOP_PAD - BOT_PAD}
        rx={3} fill="url(#hm-viridis)" />
      {/* Tick marks + labels at 0, 0.5, 1 */}
      {[{t: 0, label: '1.0'}, {t: 0.5, label: '0.5'}, {t: 1, label: '0'}].map(({ t, label }) => {
        const y = TOP_PAD + t * (H - TOP_PAD - BOT_PAD);
        return (
          <g key={label}>
            <line x1={W - RIGHT_PAD + 18} y1={y} x2={W - RIGHT_PAD + 22} y2={y}
              stroke={LABEL} strokeWidth={0.7} />
            <text x={W - RIGHT_PAD + 25} y={y + 3}
              fontFamily={T.MONO} fontSize="6.5" fill={LABEL}>{label}</text>
          </g>
        );
      })}
      {/* Unit label */}
      <text
        x={W - RIGHT_PAD + 14} y={TOP_PAD - 8}
        textAnchor="middle" fontFamily={T.MONO} fontSize="6.5" fill={LABEL}>
        norm.
      </text>
      {/* Scale note bottom */}
      <text x={W - RIGHT_PAD + 14} y={H - BOT_PAD + 14}
        textAnchor="middle" fontFamily={T.MONO} fontSize="6.5" fill={LABEL}>
        expr.
      </text>

      {/* Cluster color dots below column labels */}
      {Array.from({ length: N_CLUSTERS }, (_, ci) => (
        <rect key={ci}
          x={LEFT_PAD + ci * cellW + cellW / 2 - 4}
          y={TOP_PAD - 4}
          width={8} height={3}
          fill={CLUSTER_PAL[ci % 8]} rx={1} />
      ))}
    </svg>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */

export default function ScSpatialPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const { data: analysis, error: simError } = useMemo(() => {
    try { return { data: runFullPipeline(SC_SPATIAL_DATA), error: null as string | null }; }
    catch (e) { return { data: runFullPipeline(SC_SPATIAL_DATA), error: e instanceof Error ? e.message : 'Pipeline failed' }; }
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('Spatial');
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [showQCFailed, setShowQCFailed] = useState(false);
  const [highlightGene, setHighlightGene] = useState<string>('ADS');

  const cellRows: CellRow[] = useMemo(() =>
    SC_SPATIAL_DATA.map(c => ({
      id: c.id,
      barcode: c.barcode,
      cluster: c.cluster,
      cellType: c.cellType,
      totalCounts: c.totalCounts,
      nGenes: c.nGenes,
      mitoPercent: c.mitoPercent,
      pseudotime: c.pseudotime,
    })),
  []);

  const exportCells = useMemo(() =>
    SC_SPATIAL_DATA.map(c => ({
      id: c.id, barcode: c.barcode, cluster: c.cluster, cellType: c.cellType,
      totalCounts: c.totalCounts, nGenes: c.nGenes, mitoPercent: c.mitoPercent,
      pseudotime: c.pseudotime, spatialX: c.spatialX, spatialY: c.spatialY,
    })),
  []);

  const toggleCluster = useCallback((cl: number) => {
    setSelectedCluster(prev => prev === cl ? null : cl);
  }, []);

  const topMoran = useMemo(() =>
    analysis.autocorrelation.results
      .filter(r => r.isSpatiallyRestricted)
      .sort((a, b) => b.moranI - a.moranI)
      .slice(0, 5),
  [analysis]);
  const preferredGene = useMemo(
    () =>
      findPreferredSpatialGene([
        analyzeArtifact?.enzymeCandidates[0]?.label ?? '',
        analyzeArtifact?.bottleneckAssumptions[0]?.label ?? '',
        analyzeArtifact?.pathwayCandidates[0]?.label ?? '',
        project?.targetProduct ?? '',
      ]),
    [analyzeArtifact, project?.targetProduct],
  );
  const highestYieldCluster = analysis.highYieldClusters[0] ?? null;
  const spatialTraceSummary = useMemo(() => {
    const clusterLabel = selectedCluster !== null ? CLUSTER_LABELS[selectedCluster] : 'All clusters';
    const moranLead = topMoran[0];
    return {
      clusterLabel,
      summary: moranLead
        ? `${moranLead.gene} is the strongest spatially restricted gene in the current view and remains linked to the 3D height mapping.`
        : 'The 3D scene reuses the post-QC matrix and switches height between expression and pseudotime.',
    };
  }, [selectedCluster, topMoran]);

  const convergenceIter = analysis.vae.convergenceHistory.length;
  const finalLoss = analysis.vae.convergenceHistory[convergenceIter - 1];
  const activeClusterLabel = selectedCluster !== null ? CLUSTER_LABELS[selectedCluster] : 'All clusters';
  const figureMeta = useMemo(() => {
    if (viewMode === 'Spatial') {
      return {
        eyebrow: 'Figure A · Spot-Level Spatial Atlas',
        title: `${highlightGene} expression mapped across ${activeClusterLabel}`,
        caption: 'A publication-style spot map should foreground tissue architecture, gene-localized signal, and cluster identity together instead of separating them into unrelated widgets.',
      };
    }
    if (viewMode === 'Spatial3D') {
      return {
        eyebrow: 'Figure B · Spatial Depth Reconstruction',
        title: `${highlightGene} signal lifted into a 3D tissue context`,
        caption: 'Depth is used here as an analysis axis, not as decoration, so cluster position, pseudotime, and marker intensity can be read in a single spatial frame.',
      };
    }
    if (viewMode === 'UMAP') {
      return {
        eyebrow: 'Figure C · Cell-State Embedding',
        title: 'Latent cell-state separation and cluster continuity',
        caption: 'The embedding panel behaves like a figure companion to the tissue map, translating spatial neighborhoods into state-space structure without losing cluster identity.',
      };
    }
    if (viewMode === 'Trajectory') {
      return {
        eyebrow: 'Figure D · Trajectory Inference',
        title: 'Branching structure across productive and stressed cell fates',
        caption: 'Trajectory view emphasizes branch points and path divergence as a scientific explanation layer rather than a generic alternate chart tab.',
      };
    }
    if (viewMode === 'Efficiency') {
      return {
        eyebrow: 'Figure E · Yield-Relevant Cell States',
        title: 'Production-relevant clusters ranked by metabolic efficiency',
        caption: 'Efficiency view links the single-cell atlas back to the engineering question: which state is actually worth prioritizing for validation and redesign.',
      };
    }
    if (viewMode === 'Heatmap') {
      return {
        eyebrow: 'Figure F · Marker Structure',
        title: 'Expression heatmap arranged as a comparative figure plate',
        caption: 'Heatmap stays in the same scientific frame so marker contrast, cluster grouping, and pathway relevance read as one figure system.',
      };
    }
    return {
      eyebrow: 'Figure G · Cell Ledger',
      title: 'Auditable per-cell table with the same contextual labels',
      caption: 'Even the table view is treated as a scientific appendix surface, tied to the same cluster, QC, and marker context as the visual panels.',
    };
  }, [activeClusterLabel, highlightGene, viewMode]);

  useEffect(() => {
    if (preferredGene) {
      setHighlightGene(preferredGene);
    }
  }, [preferredGene]);

  useEffect(() => {
    if (highestYieldCluster) {
      setSelectedCluster(highestYieldCluster.clusterId);
    }
  }, [highestYieldCluster]);

  useEffect(() => {
    setToolPayload('scspatial', {
      toolId: 'scspatial',
      targetProduct: analyzeArtifact?.targetProduct ?? project?.targetProduct ?? 'Cell state atlas',
      sourceArtifactId: analyzeArtifact?.id,
      selectedCluster,
      highlightGene,
      activeView: viewMode,
      result: {
        totalCells: analysis.qc.totalCells,
        passedCells: analysis.qc.passedCells,
        topSpatialGene: topMoran[0]?.gene ?? highlightGene,
        topMoranI: topMoran[0]?.moranI ?? 0,
        highestYieldCluster: highestYieldCluster?.label ?? 'Not identified',
        latentDim: analysis.vae.latentDim,
      },
      updatedAt: Date.now(),
    });
  }, [
    analysis.qc.passedCells,
    analysis.qc.totalCells,
    analysis.vae.latentDim,
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    highlightGene,
    highestYieldCluster,
    project?.targetProduct,
    selectedCluster,
    setToolPayload,
    topMoran,
    viewMode,
  ]);

  return (
    <>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: PANEL_BG, minHeight: '100%', flex: 1 }}>
        <AlgorithmInsight
          title="Single-Cell & Spatial Transcriptomics"
          description="QC → HVG selection → Louvain clustering → PAGA trajectory → Moran's I spatial autocorrelation → scVAE latent embedding with batch correction"
          formula="I = (N/W) × Σᵢⱼ wᵢⱼ(xᵢ−x̄)(xⱼ−x̄) / Σᵢ(xᵢ−x̄)²"
        />

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificHero
            eyebrow="Stage 4 · Single-Cell & Spatial Evidence"
            title="Where the pathway is actually active across cells and tissue"
            summary="SCSPATIAL now opens with the scientific question first: which cell state and niche are carrying production-relevant expression, how strong that spatial restriction is, and whether the current cluster focus is actually the one worth chasing."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current spatial lens
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {viewMode} · {selectedCluster !== null ? CLUSTER_LABELS[selectedCluster] : 'All clusters'}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  {spatialTraceSummary.summary}
                </div>
              </>
            }
            signals={[
              {
                label: 'QC Pass',
                value: `${analysis.qc.passedCells}/${analysis.qc.totalCells}`,
                detail: `${analysis.qc.filteredCells} cells filtered out during QC`,
                tone: analysis.qc.passedCells / analysis.qc.totalCells > 0.8 ? 'cool' : 'warm',
              },
              {
                label: 'Top Spatial Gene',
                value: topMoran[0]?.gene ?? highlightGene,
                detail: topMoran[0] ? `Moran's I ${topMoran[0].moranI.toFixed(3)}` : 'No spatially restricted feature is currently flagged.',
                tone: topMoran[0]?.isSpatiallyRestricted ? 'cool' : 'neutral',
              },
              {
                label: 'Highest-Yield Cluster',
                value: highestYieldCluster?.label ?? 'Pending',
                detail: highestYieldCluster
                  ? `${highestYieldCluster.nCells} cells · eff ${highestYieldCluster.avgMetabolicEfficiency.toFixed(2)} · prod ${highestYieldCluster.avgProductivity.toFixed(2)}`
                  : 'No dominant high-yield cluster identified yet.',
                tone: highestYieldCluster ? 'warm' : 'neutral',
              },
              {
                label: 'Latent Model',
                value: `${analysis.vae.latentDim}D`,
                detail: `Final VAE loss ${finalLoss?.loss.toFixed(3) ?? '0.000'} after ${convergenceIter} iterations`,
                tone: 'neutral',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificMethodStrip
            label="Spatial Figure Grammar"
            items={[
              {
                title: 'Spot-level tissue map',
                detail: 'Keep the low-resolution atlas readable first: tissue silhouette, cluster assignment, and scale bar should be legible before any extra controls.',
                accent: PATHD_THEME.sky,
                note: 'Visium-style context',
              },
              {
                title: 'Cell-resolved inference',
                detail: 'High-resolution interpretation belongs beside the atlas as a refinement layer, not hidden in a separate product mode.',
                accent: PATHD_THEME.lilac,
                note: 'Inference bridge',
              },
              {
                title: 'Histology and state linkage',
                detail: 'Spatial signal must always be tied back to cell state, QC, and production-relevant marker evidence.',
                accent: PATHD_THEME.mint,
                note: 'Evidence-linked readout',
              },
            ]}
          />
        </div>

        {simError && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={simError} /></div>
        )}

        <div className="nb-tool-panels" style={{ flex: 1 }}>

          {/* ── LEFT SIDEBAR (240px) ──────────────────────────────── */}
          <div className="nb-tool-sidebar" style={{
            width: '240px', flexShrink: 0, padding: '16px',
            borderRight: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            <WorkbenchInlineContext
              toolId="scspatial"
              title="Single-Cell & Spatial Transcriptomics"
              summary="Map pathway signatures and yield-relevant markers back onto cell states and tissue niches so the iteration loop can identify where production actually concentrates."
              compact
              isSimulated={!analyzeArtifact}
            />

            {/* QC Summary */}
            <SectionLabel>QC Summary</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="Total Cells" value={analysis.qc.totalCells} highlight />
              <MetricCard label="Passed" value={analysis.qc.passedCells} />
              <MetricCard label="Filtered" value={analysis.qc.filteredCells} />
              <MetricCard label="Med. Counts" value={analysis.qc.medianCounts} />
              <MetricCard label="Med. Mito%" value={analysis.qc.medianMitoPercent.toFixed(1)} unit="%" />
            </div>

            {/* Show QC-failed toggle */}
            <button aria-label="Action" onClick={() => setShowQCFailed(!showQCFailed)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '7px 10px', marginBottom: '16px',
              background: showQCFailed ? 'rgba(232,163,161,0.18)' : INPUT_BG,
              border: `1px solid ${showQCFailed ? 'rgba(232,163,161,0.34)' : BORDER}`,
              borderRadius: '8px', cursor: 'pointer',
              color: showQCFailed ? VALUE : LABEL,
              fontFamily: T.SANS, fontSize: '10px', textAlign: 'left',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '2px',
                background: showQCFailed ? 'rgba(250,128,114,0.7)' : 'transparent',
                border: '1.5px solid rgba(250,128,114,0.5)', flexShrink: 0,
              }} />
              Show QC-failed
            </button>

            {/* Cluster Selection */}
            <SectionLabel>Clusters</SectionLabel>
            {analysis.clusters.clusterSizes.map(cs => (
              <button aria-label="Action" key={cs.cluster} onClick={() => toggleCluster(cs.cluster)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '7px 10px', marginBottom: '5px',
                background: selectedCluster === cs.cluster ? 'rgba(175,195,214,0.22)' : INPUT_BG,
                border: `1px solid ${selectedCluster === cs.cluster ? 'rgba(175,195,214,0.34)' : BORDER}`,
                borderRadius: '8px', cursor: 'pointer',
                color: selectedCluster === cs.cluster ? VALUE : LABEL,
                fontFamily: T.SANS, fontSize: '11px', textAlign: 'left',
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: selectedCluster === cs.cluster
                    ? CLUSTER_COLORS[cs.cluster] : 'transparent',
                  border: `1.5px solid ${CLUSTER_COLORS[cs.cluster]}`, flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{cs.label}</span>
                <span style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL }}>{cs.size}</span>
              </button>
            ))}

            {/* View Mode Tabs */}
            <div style={{ margin: '16px 0 0' }}>
              <SectionLabel>View Mode</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '16px' }}>
                {(['Spatial', 'Spatial3D', 'UMAP', 'Trajectory', 'Efficiency', 'Heatmap', 'Table'] as ViewMode[]).map(mode => (
                  <button aria-label="Action" key={mode} onClick={() => setViewMode(mode)} style={{
                    flex: mode === 'Table' ? '1 1 100%' : '1 1 0',
                    padding: '5px 0', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: T.SANS, fontSize: '10px', border: `1px solid ${viewMode === mode ? 'rgba(175,195,214,0.34)' : INPUT_BORDER}`,
                    background: viewMode === mode ? 'rgba(175,195,214,0.22)' : INPUT_BG,
                    color: viewMode === mode ? VALUE : LABEL,
                  }}>
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Gene Highlight */}
            <SectionLabel>Gene Highlight</SectionLabel>
            <select
              value={highlightGene}
              onChange={e => setHighlightGene(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', marginBottom: '16px',
                background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: '8px',
                color: INPUT_TEXT, fontFamily: T.MONO, fontSize: '10px',
                outline: 'none', appearance: 'auto' as React.CSSProperties['appearance'],
              }}
            >
              {GENE_LIST.map(g => (
                <option key={g} value={g} style={{ background: '#1a1d24' }}>{g}</option>
              ))}
            </select>

            {/* HVG Stats */}
            <SectionLabel>HVG Selection</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>HVGs Found</span>
                <span style={{ fontFamily: T.MONO, fontSize: '13px', fontWeight: 700, color: VALUE }}>
                  {analysis.hvg.nHVGs}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Method</span>
                <span style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL }}>
                  {analysis.hvg.method}
                </span>
              </div>
            </div>
          </div>

          {/* ── CENTER ENGINE ────────────────────────────────────── */}
          <div className="nb-tool-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: PANEL_BG, minWidth: 0, padding: '16px', overflow: 'auto' }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              minHeight="100%"
              legend={[
                { label: 'View', value: viewMode, accent: PATHD_THEME.apricot },
                { label: 'Cluster', value: activeClusterLabel, accent: selectedCluster !== null ? CLUSTER_COLORS[selectedCluster] : PATHD_THEME.sky },
                { label: 'Marker', value: highlightGene, accent: PATHD_THEME.lilac },
                { label: 'QC', value: `${analysis.qc.passedCells}/${analysis.qc.totalCells} kept`, accent: PATHD_THEME.mint },
              ]}
              footer={
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.paperMuted, lineHeight: 1.55 }}>
                  {spatialTraceSummary.summary}
                </div>
              }
            >
              {viewMode === 'Spatial' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '520px' }}>
                  <div style={{ width: '100%', maxWidth: '640px' }}>
                    <SpatialMap
                      cells={SC_SPATIAL_DATA}
                      selectedCluster={selectedCluster}
                      highlightGene={highlightGene}
                    />
                  </div>
                </div>
              )}
              {viewMode === 'Spatial3D' && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ padding: '10px 12px', borderRadius: '14px', border: `1px solid ${PATHD_THEME.paperBorder}`, background: PATHD_THEME.paperSurfaceMuted }}>
                    <p style={{ margin: '0 0 3px', color: PATHD_THEME.paperValue, fontSize: '11px', fontFamily: T.SANS }}>
                      Spatial 3D mode translates the 2D atlas into a tissue-depth figure where cluster neighborhood and marker intensity can be inspected together.
                    </p>
                    <p style={{ margin: 0, color: PATHD_THEME.paperLabel, fontSize: '9px', fontFamily: T.MONO }}>
                      rotate = tissue context · height = {highlightGene} expression / pseudotime
                    </p>
                  </div>
                  <div style={{ minHeight: '500px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>
                    <div style={{ position: 'relative' }}>
                      <SpatialPointCloud
                        cells={SC_SPATIAL_DATA}
                        selectedCluster={selectedCluster}
                        highlightGene={highlightGene}
                        showQCFailed={showQCFailed}
                      />
                    </div>
                  </div>
                </div>
              )}
              {viewMode === 'UMAP' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '520px' }}>
                  <div style={{ width: '100%', maxWidth: '640px' }}>
                    <UMAPScatter selectedCluster={selectedCluster} />
                  </div>
                </div>
              )}
              {viewMode === 'Trajectory' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '520px' }}>
                  <div style={{ width: '100%', maxWidth: '640px' }}>
                    <TrajectoryView analysis={analysis} />
                  </div>
                </div>
              )}
              {viewMode === 'Efficiency' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '520px' }}>
                  <div style={{ width: '100%', maxWidth: '640px' }}>
                    <EfficiencyChart highYield={analysis.highYieldClusters} />
                  </div>
                </div>
              )}
              {viewMode === 'Heatmap' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '520px' }}>
                  <div style={{ width: '100%', maxWidth: '640px' }}>
                    <ExpressionHeatmap cells={SC_SPATIAL_DATA} />
                  </div>
                </div>
              )}
              {viewMode === 'Table' && (
                <div style={{ minHeight: '520px', overflow: 'auto' }}>
                  <DataTable<CellRow> columns={CELL_COLUMNS} rows={cellRows} maxRows={50} />
                </div>
              )}
            </ScientificFigureFrame>
          </div>

          {/* ── RIGHT PANEL (260px) ──────────────────────────────── */}
          <div className="nb-tool-right" style={{
            width: '260px', flexShrink: 0, padding: '16px',
            borderLeft: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            {/* VAE Metrics */}
            <SectionLabel>VAE Latent Model</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="ELBO" value={analysis.vae.elbo.toFixed(2)} highlight />
              <MetricCard label="Recon Loss" value={analysis.vae.reconLoss.toFixed(2)} />
              <MetricCard label="KL Div" value={analysis.vae.klDivergence.toFixed(3)} />
              <MetricCard label="Latent Dim" value={analysis.vae.latentDim} />
            </div>

            {/* Convergence */}
            <SectionLabel>Convergence</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Iterations</span>
                <span style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {convergenceIter}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Final Loss</span>
                <span style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {finalLoss?.loss.toFixed(3) ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Batch Corrected</span>
                <span style={{ fontFamily: T.MONO, fontSize: '11px', color: analysis.vae.batchCorrected ? 'rgba(147,203,82,0.9)' : LABEL, textAlign: 'right' }}>
                  {analysis.vae.batchCorrected ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {/* Clustering */}
            <SectionLabel>Clustering</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Silhouette</span>
                <span style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {analysis.clusters.silhouetteScore.toFixed(3)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Modularity</span>
                <span style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {analysis.clusters.modularity.toFixed(3)}
                </span>
              </div>
            </div>

            {/* PAGA Analysis */}
            <SectionLabel>PAGA Trajectory</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Root Cluster</span>
                <span style={{ fontFamily: T.MONO, fontSize: '11px', color: CLUSTER_COLORS[analysis.paga.rootCluster], textAlign: 'right' }}>
                  {CLUSTER_LABELS[analysis.paga.rootCluster]}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Branch Points</span>
                <span style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {analysis.paga.branchingPoints.length}
                </span>
              </div>
              {analysis.paga.branchingPoints.map((bp, i) => (
                <div key={i} style={{
                  padding: '6px 0',
                  borderTop: `1px solid ${BORDER}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '9px', color: VALUE }}>
                      {bp.label}
                    </span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: 'rgba(255,139,31,0.85)' }}>
                      div={bp.divergenceScore.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {bp.childBranches.map(child => {
                      const fateColor = child.fate === 'productive'
                        ? 'rgba(147,203,82,0.9)'
                        : child.fate === 'stressed'
                          ? 'rgba(250,128,114,0.9)'
                          : 'rgba(255,139,31,0.9)';
                      return (
                        <span key={child.cluster} style={{
                          fontFamily: T.MONO, fontSize: '7px', padding: '2px 6px',
                          borderRadius: '4px',
                          background: `${fateColor.replace('0.9', '0.15')}`,
                          color: fateColor,
                          border: `1px solid ${fateColor.replace('0.9', '0.2')}`,
                        }}>
                          {child.label} → {child.fate}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Spatial Autocorrelation */}
            <SectionLabel>Moran&apos;s I — Spatial Genes</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {topMoran.map(mr => (
                <div key={mr.gene} style={{ ...GLASS, borderRadius: '10px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.MONO, fontSize: '10px', fontWeight: 600, color: 'rgba(147,203,82,0.9)' }}>
                      {mr.gene}
                    </span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE, textAlign: 'right' }}>
                      I={mr.moranI.toFixed(3)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL }}>
                      z={mr.zScore.toFixed(2)}
                    </span>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '8px', textAlign: 'right',
                      color: mr.pValue < 0.01 ? 'rgba(255,139,31,0.85)' : LABEL,
                    }}>
                      p={mr.pValue < 0.001 ? '<0.001' : mr.pValue.toFixed(3)}
                    </span>
                  </div>
                </div>
              ))}
              {topMoran.length === 0 && (
                <p style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL, fontStyle: 'italic', margin: 0 }}>
                  No spatially restricted genes found.
                </p>
              )}
            </div>

            {/* High-Yield Clusters */}
            <SectionLabel>High-Yield Clusters</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {analysis.highYieldClusters.map(hy => {
                const fateColor = hy.fate === 'productive'
                  ? 'rgba(147,203,82,0.9)'
                  : hy.fate === 'stressed'
                    ? 'rgba(250,128,114,0.9)'
                    : 'rgba(255,139,31,0.9)';
                return (
                  <div key={hy.clusterId} style={{ ...GLASS, borderRadius: '10px', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: CLUSTER_COLORS[hy.clusterId], flexShrink: 0,
                        }} />
                        <span style={{ fontFamily: T.SANS, fontSize: '10px', color: VALUE }}>
                          {hy.label}
                        </span>
                      </span>
                      <span style={{
                        fontFamily: T.MONO, fontSize: '8px', padding: '1px 5px',
                        borderRadius: '4px', background: fateColor.replace('0.9', '0.15'),
                        color: fateColor,
                      }}>
                        {hy.fate}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Efficiency</span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE, textAlign: 'right' }}>
                        {(hy.avgMetabolicEfficiency * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Productivity</span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE, textAlign: 'right' }}>
                        {(hy.avgProductivity * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                      {hy.keyGenes.slice(0, 4).map(g => (
                        <span key={g.gene} style={{
                          fontFamily: T.MONO, fontSize: '7px', padding: '1px 5px',
                          borderRadius: '4px', background: `${CLUSTER_COLORS[hy.clusterId]}20`,
                          color: CLUSTER_COLORS[hy.clusterId],
                        }}>
                          {g.gene}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Bottom Export Bar ──────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${BORDER}`, padding: '8px 16px',
          display: 'flex', gap: '8px', flexShrink: 0, background: PANEL_BG,
        }}>
          <ExportButton label="Export Analysis JSON" data={analysis} filename="scspatial-analysis" format="json" />
          <ExportButton label="Export Cells CSV" data={exportCells} filename="scspatial-cells" format="csv" />
        </div>
      </div>
    </>
  );
}
