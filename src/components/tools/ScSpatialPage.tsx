'use client';
import { useState, useMemo, useCallback } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import DataTable from '../ide/shared/DataTable';
import type { TableColumn } from '../ide/shared/DataTable';
import { SC_SPATIAL_DATA, GENE_LIST, CLUSTER_LABELS } from '../../data/mockScSpatial';
import { runFullPipeline } from '../../services/ScSpatialEngine';
import type { ScSpatialAnalysisResult, HighYieldCluster, MoranResult } from '../../services/ScSpatialEngine';

/* ── Design Tokens ────────────────────────────────────────────────── */

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";
const PANEL_BG = '#10131a';
const BORDER = 'rgba(255,255,255,0.06)';
const LABEL = 'rgba(255,255,255,0.28)';
const VALUE = 'rgba(255,255,255,0.65)';
const INPUT_BG = 'rgba(255,255,255,0.05)';
const INPUT_BORDER = 'rgba(255,255,255,0.08)';
const INPUT_TEXT = 'rgba(255,255,255,0.7)';

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  backdropFilter: 'blur(10px)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const CLUSTER_COLORS: Record<number, string> = {
  0: '#C9E4DE',
  1: '#C6DEF1',
  2: '#F2C6DE',
  3: '#FAEDCB',
  4: '#DBCDF0',
};

type ViewMode = 'Spatial' | 'UMAP' | 'Trajectory' | 'Efficiency' | 'Table';

/* ── Section Label (same as MultiOPage) ───────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase',
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
        fontFamily: MONO, fontSize: '10px',
        color: CLUSTER_COLORS[v as number] ?? VALUE,
      }}>
        {v as number}
      </span>
    ),
  },
  { key: 'cellType',    header: 'Type',     width: 110 },
  { key: 'totalCounts', header: 'Counts',   width: 60,
    render: v => (
      <span style={{ fontFamily: MONO, fontSize: '10px', color: VALUE }}>
        {(v as number).toLocaleString()}
      </span>
    ),
  },
  { key: 'nGenes',      header: 'Genes',    width: 50,
    render: v => (
      <span style={{ fontFamily: MONO, fontSize: '10px', color: VALUE }}>
        {v as number}
      </span>
    ),
  },
  { key: 'mitoPercent',  header: 'Mito%',   width: 50,
    render: v => (
      <span style={{
        fontFamily: MONO, fontSize: '10px',
        color: (v as number) > 20 ? 'rgba(255,100,100,0.85)' : VALUE,
      }}>
        {(v as number).toFixed(1)}
      </span>
    ),
  },
  { key: 'pseudotime',  header: 'PT',       width: 50,
    render: v => (
      <span style={{ fontFamily: MONO, fontSize: '10px', color: VALUE }}>
        {(v as number).toFixed(2)}
      </span>
    ),
  },
];

/* ── Spatial Map SVG ──────────────────────────────────────────────── */

function SpatialMap({ cells, selectedCluster, highlightGene, showQCFailed }: {
  cells: typeof SC_SPATIAL_DATA;
  selectedCluster: number | null;
  highlightGene: string;
  showQCFailed: boolean;
}) {
  const W = 520, H = 420, PAD = 44;

  const { xMin, xRange, yMin, yRange } = useMemo(() => {
    const xs = cells.map(c => c.spatialX);
    const ys = cells.map(c => c.spatialY);
    const xMn = Math.min(...xs), xMx = Math.max(...xs);
    const yMn = Math.min(...ys), yMx = Math.max(...ys);
    return { xMin: xMn, xRange: xMx - xMn || 1, yMin: yMn, yRange: yMx - yMn || 1 };
  }, [cells]);

  const geneMax = useMemo(() => {
    let mx = 0;
    cells.forEach(c => { mx = Math.max(mx, c.geneExpression[highlightGene] ?? 0); });
    return mx || 1;
  }, [cells, highlightGene]);

  function sx(x: number) { return PAD + ((x - xMin) / xRange) * (W - PAD * 2); }
  function sy(y: number) { return H - PAD - ((y - yMin) / yRange) * (H - PAD * 2); }

  const GRID = 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" rx={12} />
      {Array.from({ length: GRID + 1 }).map((_, i) => {
        const gx = PAD + (i / GRID) * (W - PAD * 2);
        const gy = PAD + (i / GRID) * (H - PAD * 2);
        return (
          <g key={i}>
            <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          </g>
        );
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}>
        Spatial X (μm)
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,12,${H / 2})`}>
        Spatial Y (μm)
      </text>
      {cells.map(cell => {
        if (!showQCFailed && !cell.qcPass) return null;
        if (selectedCluster !== null && cell.cluster !== selectedCluster) return null;
        const expr = cell.geneExpression[highlightGene] ?? 0;
        const intensity = expr / geneMax;
        const color = highlightGene
          ? `rgba(120,220,180,${0.2 + intensity * 0.8})`
          : CLUSTER_COLORS[cell.cluster] ?? '#888';
        const cx = sx(cell.spatialX);
        const cy = sy(cell.spatialY);
        if (!cell.qcPass) {
          return (
            <g key={cell.id}>
              <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} stroke="rgba(255,100,100,0.6)" strokeWidth={1.5} />
              <line x1={cx + 3} y1={cy - 3} x2={cx - 3} y2={cy + 3} stroke="rgba(255,100,100,0.6)" strokeWidth={1.5} />
            </g>
          );
        }
        return (
          <circle key={cell.id} cx={cx} cy={cy}
            r={highlightGene ? 3 + intensity * 3 : 4}
            fill={!highlightGene ? CLUSTER_COLORS[cell.cluster] : color}
            opacity={0.85}
            style={{ transition: 'opacity 0.2s' }}>
            <title>{cell.id} [{cell.cellType}] {highlightGene}={expr.toFixed(2)}</title>
          </circle>
        );
      })}
      {/* Legend */}
      {Object.entries(CLUSTER_COLORS).map(([k, col], i) => (
        <g key={k} transform={`translate(${W - PAD - 120}, ${PAD + 6 + i * 16})`}>
          <circle cx={0} cy={0} r={4} fill={col}
            opacity={selectedCluster === null || selectedCluster === Number(k) ? 1 : 0.25} />
          <text x={10} y={3.5} fontFamily={SANS} fontSize="9"
            fill={selectedCluster === null || selectedCluster === Number(k) ? VALUE : LABEL}>
            {CLUSTER_LABELS[Number(k)]}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── UMAP Scatter SVG ─────────────────────────────────────────────── */

function UMAPScatter({ analysis, selectedCluster }: {
  analysis: ScSpatialAnalysisResult;
  selectedCluster: number | null;
}) {
  const W = 520, H = 420, PAD = 44;
  const latent = analysis.vae.latentCells;

  const { projected, centroids } = useMemo(() => {
    const xs = latent.map(p => p.umapX);
    const ys = latent.map(p => p.umapY);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xR = xMax - xMin || 1, yR = yMax - yMin || 1;
    const pts = latent.map(p => ({
      ...p,
      sx: PAD + ((p.umapX - xMin) / xR) * (W - PAD * 2),
      sy: PAD + ((p.umapY - yMin) / yR) * (H - PAD * 2),
    }));
    const cent: Record<number, { sx: number; sy: number; n: number }> = {};
    pts.forEach(p => {
      if (!cent[p.cluster]) cent[p.cluster] = { sx: 0, sy: 0, n: 0 };
      cent[p.cluster].sx += p.sx;
      cent[p.cluster].sy += p.sy;
      cent[p.cluster].n += 1;
    });
    Object.keys(cent).forEach(k => {
      const c = cent[Number(k)];
      c.sx /= c.n; c.sy /= c.n;
    });
    return { projected: pts, centroids: cent };
  }, [latent]);

  const GRID = 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" rx={12} />
      {Array.from({ length: GRID + 1 }).map((_, i) => {
        const gx = PAD + (i / GRID) * (W - PAD * 2);
        const gy = PAD + (i / GRID) * (H - PAD * 2);
        return (
          <g key={i}>
            <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          </g>
        );
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}>
        UMAP-1
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,12,${H / 2})`}>
        UMAP-2
      </text>
      {projected.map(p => {
        if (selectedCluster !== null && p.cluster !== selectedCluster) return null;
        return (
          <circle key={p.id} cx={p.sx} cy={p.sy} r={4}
            fill={CLUSTER_COLORS[p.cluster] ?? '#888'} opacity={0.85}
            style={{ transition: 'opacity 0.2s' }}>
            <title>{p.id} [{p.cellType}]</title>
          </circle>
        );
      })}
      {Object.entries(centroids).map(([k, c]) => {
        if (selectedCluster !== null && selectedCluster !== Number(k)) return null;
        return (
          <text key={k} x={c.sx} y={c.sy - 10} textAnchor="middle"
            fontFamily={SANS} fontSize="9" fontWeight={600}
            fill={CLUSTER_COLORS[Number(k)]}
            style={{ pointerEvents: 'none' }}>
            {CLUSTER_LABELS[Number(k)]}
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
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" rx={12} />
      {/* Pseudotime axis */}
      <line x1={PAD} y1={H - 28} x2={W - PAD} y2={H - 28} stroke="rgba(255,255,255,0.1)" />
      <text x={PAD} y={H - 14} fontFamily={MONO} fontSize="8" fill={LABEL}>0.0</text>
      <text x={W - PAD} y={H - 14} textAnchor="end" fontFamily={MONO} fontSize="8" fill={LABEL}>1.0</text>
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}>
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
              fontFamily={MONO} fontSize="10" fontWeight={600}
              fill={CLUSTER_COLORS[cs.cluster]}>
              {cs.size}
            </text>
            <text x={cx} y={cy + r + 12} textAnchor="middle"
              fontFamily={SANS} fontSize="8" fill={VALUE}>
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
              fill="rgba(255,200,80,0.7)" stroke="rgba(255,200,80,0.9)" strokeWidth={0.8} />
            <text x={cx + 8} y={cy + 3} fontFamily={MONO} fontSize="7" fill="rgba(255,200,80,0.8)">
              Branch
            </text>
          </g>
        );
      })}
      {/* Root indicator */}
      <text x={nodeX(paga.rootCluster)} y={nodeY(paga.rootCluster) - sizeScale(
        clusters.clusterSizes.find(c => c.cluster === paga.rootCluster)?.size ?? 30
      ) - 14} textAnchor="middle"
        fontFamily={SANS} fontSize="8" fontWeight={600} fill="rgba(255,200,80,0.9)">
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
    productive: 'rgba(120,220,180,0.75)',
    stressed:   'rgba(255,100,100,0.65)',
    quiescent:  'rgba(255,200,80,0.65)',
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" rx={12} />
      {/* Y-axis */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.1)" />
      {[0, 0.25, 0.5, 0.75, 1.0].map(v => {
        const y = H - PAD.bottom - v * innerH;
        return (
          <g key={v}>
            <line x1={PAD.left - 4} y1={y} x2={PAD.left} y2={y} stroke="rgba(255,255,255,0.15)" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.25)">
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
      <text x={14} y={H / 2} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}
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
              fontFamily={SANS} fontSize="8" fill={VALUE}>
              {hy.label.length > 14 ? hy.label.slice(0, 12) + '…' : hy.label}
            </text>
            {/* Fate label */}
            <text x={gx} y={H - PAD.bottom + 26} textAnchor="middle"
              fontFamily={MONO} fontSize="7" fill={FATE_COLORS[hy.fate] ?? LABEL}>
              {hy.fate}
            </text>
            {/* Key genes */}
            <text x={gx} y={H - PAD.bottom + 38} textAnchor="middle"
              fontFamily={MONO} fontSize="6" fill={LABEL}>
              {hy.keyGenes.slice(0, 3).map(g => g.gene).join(', ')}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      {[
        { color: CLUSTER_COLORS[0], label: 'Efficiency' },
        { color: 'rgba(120,220,180,0.75)', label: 'Productivity' },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.left + i * 100},${PAD.top - 16})`}>
          <rect width={10} height={8} rx={1} fill={l.color} />
          <text x={14} y={8} fontFamily={SANS} fontSize="8" fill="rgba(255,255,255,0.35)">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */

export default function ScSpatialPage() {
  const analysis = useMemo(() => runFullPipeline(SC_SPATIAL_DATA), []);

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

  const convergenceIter = analysis.vae.convergenceHistory.length;
  const finalLoss = analysis.vae.convergenceHistory[convergenceIter - 1];

  return (
    <IDEShell moduleId="scspatial">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: PANEL_BG }}>
        <AlgorithmInsight
          title="Single-Cell & Spatial Transcriptomics"
          description="QC → HVG selection → Louvain clustering → PAGA trajectory → Moran's I spatial autocorrelation → scVAE latent embedding with batch correction"
          formula="I = (N/W) × Σᵢⱼ wᵢⱼ(xᵢ−x̄)(xⱼ−x̄) / Σᵢ(xᵢ−x̄)²"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* ── LEFT SIDEBAR (240px) ──────────────────────────────── */}
          <div style={{
            width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px',
            borderRight: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
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
            <button onClick={() => setShowQCFailed(!showQCFailed)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '7px 10px', marginBottom: '16px',
              background: showQCFailed ? 'rgba(255,100,100,0.12)' : 'transparent',
              border: `1px solid ${showQCFailed ? 'rgba(255,100,100,0.3)' : BORDER}`,
              borderRadius: '8px', cursor: 'pointer',
              color: showQCFailed ? 'rgba(255,100,100,0.85)' : 'rgba(255,255,255,0.4)',
              fontFamily: SANS, fontSize: '10px', textAlign: 'left',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '2px',
                background: showQCFailed ? 'rgba(255,100,100,0.7)' : 'transparent',
                border: '1.5px solid rgba(255,100,100,0.5)', flexShrink: 0,
              }} />
              Show QC-failed
            </button>

            {/* Cluster Selection */}
            <SectionLabel>Clusters</SectionLabel>
            {analysis.clusters.clusterSizes.map(cs => (
              <button key={cs.cluster} onClick={() => toggleCluster(cs.cluster)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '7px 10px', marginBottom: '5px',
                background: selectedCluster === cs.cluster ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: `1px solid ${selectedCluster === cs.cluster ? 'rgba(255,255,255,0.15)' : BORDER}`,
                borderRadius: '8px', cursor: 'pointer',
                color: selectedCluster === cs.cluster ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                fontFamily: SANS, fontSize: '11px', textAlign: 'left',
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: selectedCluster === cs.cluster
                    ? CLUSTER_COLORS[cs.cluster] : 'transparent',
                  border: `1.5px solid ${CLUSTER_COLORS[cs.cluster]}`, flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{cs.label}</span>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: LABEL }}>{cs.size}</span>
              </button>
            ))}

            {/* View Mode Tabs */}
            <div style={{ margin: '16px 0 0' }}>
              <SectionLabel>View Mode</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '16px' }}>
                {(['Spatial', 'UMAP', 'Trajectory', 'Efficiency', 'Table'] as ViewMode[]).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)} style={{
                    flex: mode === 'Table' ? '1 1 100%' : '1 1 0',
                    padding: '5px 0', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: SANS, fontSize: '10px', border: 'none',
                    background: viewMode === mode ? 'rgba(255,255,255,0.12)' : INPUT_BG,
                    color: viewMode === mode ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
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
                color: INPUT_TEXT, fontFamily: MONO, fontSize: '10px',
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
                <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>HVGs Found</span>
                <span style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 700, color: VALUE }}>
                  {analysis.hvg.nHVGs}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Method</span>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: LABEL }}>
                  {analysis.hvg.method}
                </span>
              </div>
            </div>
          </div>

          {/* ── CENTER ENGINE ────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0f14' }}>
            {viewMode === 'Spatial' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <SpatialMap
                    cells={SC_SPATIAL_DATA}
                    selectedCluster={selectedCluster}
                    highlightGene={highlightGene}
                    showQCFailed={showQCFailed}
                  />
                </div>
              </div>
            )}
            {viewMode === 'UMAP' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <UMAPScatter analysis={analysis} selectedCluster={selectedCluster} />
                </div>
              </div>
            )}
            {viewMode === 'Trajectory' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <TrajectoryView analysis={analysis} />
                </div>
              </div>
            )}
            {viewMode === 'Efficiency' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <EfficiencyChart highYield={analysis.highYieldClusters} />
                </div>
              </div>
            )}
            {viewMode === 'Table' && (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <DataTable<CellRow> columns={CELL_COLUMNS} rows={cellRows} maxRows={50} />
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL (260px) ──────────────────────────────── */}
          <div style={{
            width: '260px', flexShrink: 0, overflowY: 'auto', padding: '16px',
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
                <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Iterations</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {convergenceIter}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Final Loss</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {finalLoss?.loss.toFixed(3) ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Batch Corrected</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: analysis.vae.batchCorrected ? 'rgba(120,220,180,0.9)' : LABEL, textAlign: 'right' }}>
                  {analysis.vae.batchCorrected ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {/* Clustering */}
            <SectionLabel>Clustering</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Silhouette</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {analysis.clusters.silhouetteScore.toFixed(3)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Modularity</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {analysis.clusters.modularity.toFixed(3)}
                </span>
              </div>
            </div>

            {/* PAGA Analysis */}
            <SectionLabel>PAGA Trajectory</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Root Cluster</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: CLUSTER_COLORS[analysis.paga.rootCluster], textAlign: 'right' }}>
                  {CLUSTER_LABELS[analysis.paga.rootCluster]}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Branch Points</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: VALUE, textAlign: 'right' }}>
                  {analysis.paga.branchingPoints.length}
                </span>
              </div>
              {analysis.paga.branchingPoints.map((bp, i) => (
                <div key={i} style={{
                  padding: '6px 0',
                  borderTop: `1px solid ${BORDER}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: SANS, fontSize: '9px', color: VALUE }}>
                      {bp.label}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,200,80,0.85)' }}>
                      div={bp.divergenceScore.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {bp.childBranches.map(child => {
                      const fateColor = child.fate === 'productive'
                        ? 'rgba(120,220,180,0.9)'
                        : child.fate === 'stressed'
                          ? 'rgba(255,100,100,0.9)'
                          : 'rgba(255,200,80,0.9)';
                      return (
                        <span key={child.cluster} style={{
                          fontFamily: MONO, fontSize: '7px', padding: '2px 6px',
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
                    <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 600, color: 'rgba(120,220,180,0.9)' }}>
                      {mr.gene}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: '9px', color: VALUE, textAlign: 'right' }}>
                      I={mr.moranI.toFixed(3)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: MONO, fontSize: '8px', color: LABEL }}>
                      z={mr.zScore.toFixed(2)}
                    </span>
                    <span style={{
                      fontFamily: MONO, fontSize: '8px', textAlign: 'right',
                      color: mr.pValue < 0.01 ? 'rgba(255,200,80,0.85)' : LABEL,
                    }}>
                      p={mr.pValue < 0.001 ? '<0.001' : mr.pValue.toFixed(3)}
                    </span>
                  </div>
                </div>
              ))}
              {topMoran.length === 0 && (
                <p style={{ fontFamily: SANS, fontSize: '10px', color: LABEL, fontStyle: 'italic', margin: 0 }}>
                  No spatially restricted genes found.
                </p>
              )}
            </div>

            {/* High-Yield Clusters */}
            <SectionLabel>High-Yield Clusters</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {analysis.highYieldClusters.map(hy => {
                const fateColor = hy.fate === 'productive'
                  ? 'rgba(120,220,180,0.9)'
                  : hy.fate === 'stressed'
                    ? 'rgba(255,100,100,0.9)'
                    : 'rgba(255,200,80,0.9)';
                return (
                  <div key={hy.clusterId} style={{ ...GLASS, borderRadius: '10px', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: CLUSTER_COLORS[hy.clusterId], flexShrink: 0,
                        }} />
                        <span style={{ fontFamily: SANS, fontSize: '10px', color: VALUE }}>
                          {hy.label}
                        </span>
                      </span>
                      <span style={{
                        fontFamily: MONO, fontSize: '8px', padding: '1px 5px',
                        borderRadius: '4px', background: fateColor.replace('0.9', '0.15'),
                        color: fateColor,
                      }}>
                        {hy.fate}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: SANS, fontSize: '8px', color: LABEL }}>Efficiency</span>
                      <span style={{ fontFamily: MONO, fontSize: '9px', color: VALUE, textAlign: 'right' }}>
                        {(hy.avgMetabolicEfficiency * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: SANS, fontSize: '8px', color: LABEL }}>Productivity</span>
                      <span style={{ fontFamily: MONO, fontSize: '9px', color: VALUE, textAlign: 'right' }}>
                        {(hy.avgProductivity * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                      {hy.keyGenes.slice(0, 4).map(g => (
                        <span key={g.gene} style={{
                          fontFamily: MONO, fontSize: '7px', padding: '1px 5px',
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
    </IDEShell>
  );
}
