'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ProteinEvolutionCampaign, VariantCandidate } from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import { PROEVOL_THEME, StatusPill } from './shared';

/* ── Constants ────────────────────────────────────────────────────────── */

const AMINO_ACIDS = ['A','C','D','E','F','G','H','I','K','L','M','N','P','Q','R','S','T','V','W','Y'];
const FITNESS_METRICS = [
  { key: 'activity', label: 'Activity', color: PROEVOL_THEME.mint },
  { key: 'stability', label: 'Stability', color: PROEVOL_THEME.sky },
  { key: 'expression', label: 'Expression', color: PROEVOL_THEME.apricot },
  { key: 'specificity', label: 'Specificity', color: PROEVOL_THEME.lilac },
  { key: 'composite', label: 'Composite', color: PROEVOL_THEME.value },
] as const;
type FitnessMetricKey = typeof FITNESS_METRICS[number]['key'];

const VIRIDIS: [number, number, number][] = [
  [0.267, 0.004, 0.329], [0.282, 0.140, 0.458], [0.253, 0.265, 0.530],
  [0.206, 0.372, 0.553], [0.163, 0.471, 0.558], [0.128, 0.567, 0.551],
  [0.135, 0.659, 0.518], [0.267, 0.749, 0.441], [0.478, 0.821, 0.318],
  [0.741, 0.873, 0.150], [0.993, 0.906, 0.144],
];

/* ── Data construction ────────────────────────────────────────────────── */

interface FitnessCell {
  position: number;
  aa: string;
  wtResidue: string;
  fitness: number;
  count: number;
  isWildType: boolean;
}

function buildFitnessGrid(campaign: ProteinEvolutionCampaign, metric: FitnessMetricKey): {
  cells: FitnessCell[];
  positions: number[];
} {
  const allVariants = Object.values(campaign.variantIndex);
  const sitePool = campaign.rounds[0]?.variantLibrary.candidates[0]?.mutatedPositions ?? [];

  // Collect all mutation positions from sitePool
  const positions = [...sitePool].sort((a, b) => a - b);
  if (positions.length === 0) return { cells: [], positions: [] };

  // Build WT residue map
  const wtResidueMap = new Map<number, string>();
  const wt = campaign.wildType;
  for (const mut of wt.mutations) {
    wtResidueMap.set(mut.position, mut.from);
  }
  // Also infer from other variants
  for (const v of allVariants) {
    for (const mut of v.mutations) {
      if (!wtResidueMap.has(mut.position)) {
        wtResidueMap.set(mut.position, mut.from);
      }
    }
  }

  // Collect fitness values per (position, aa)
  const cellMap = new Map<string, { sum: number; count: number }>();
  for (const v of allVariants) {
    if (v.status === 'wild-type') continue;
    let fitness: number;
    if (metric === 'composite') fitness = v.score.composite;
    else if (metric === 'activity') fitness = v.predictedActivity;
    else if (metric === 'stability') fitness = v.predictedStability;
    else if (metric === 'expression') fitness = v.predictedExpression;
    else fitness = v.predictedSpecificity;

    for (const mut of v.mutations) {
      const key = `${mut.position}-${mut.to}`;
      const existing = cellMap.get(key) ?? { sum: 0, count: 0 };
      cellMap.set(key, { sum: existing.sum + fitness, count: existing.count + 1 });
    }
  }

  // Build cells
  const cells: FitnessCell[] = [];
  for (const pos of positions) {
    const wtRes = wtResidueMap.get(pos) ?? 'A';
    for (const aa of AMINO_ACIDS) {
      const key = `${pos}-${aa}`;
      const data = cellMap.get(key);
      const isWT = aa === wtRes;
      cells.push({
        position: pos,
        aa,
        wtResidue: wtRes,
        fitness: data ? data.sum / data.count : (isWT ? 55 : 0),
        count: data?.count ?? 0,
        isWildType: isWT,
      });
    }
  }

  return { cells, positions };
}

function viridisColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = clamped * (VIRIDIS.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, VIRIDIS.length - 1);
  const frac = idx - lo;
  return [
    VIRIDIS[lo][0] + (VIRIDIS[hi][0] - VIRIDIS[lo][0]) * frac,
    VIRIDIS[lo][1] + (VIRIDIS[hi][1] - VIRIDIS[lo][1]) * frac,
    VIRIDIS[lo][2] + (VIRIDIS[hi][2] - VIRIDIS[lo][2]) * frac,
  ];
}

/* ── DMS Heatmap (2D canvas) ──────────────────────────────────────────── */

function DMSHeatmap({ cells, positions, metric, selectedVariantId, campaign, onSelectVariant }: {
  cells: FitnessCell[];
  positions: number[];
  metric: FitnessMetricKey;
  selectedVariantId: string | null;
  campaign: ProteinEvolutionCampaign;
  onSelectVariant: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<FitnessCell | null>(null);

  const fitnessRange = useMemo(() => {
    const vals = cells.filter(c => c.count > 0).map(c => c.fitness);
    if (!vals.length) return { min: 0, max: 100 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [cells]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellW = 28;
    const cellH = 22;
    const labelW = 36;
    const labelH = 20;
    const w = labelW + positions.length * cellW;
    const h = labelH + AMINO_ACIDS.length * cellH;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = 'rgba(8,7,6,1)';
    ctx.fillRect(0, 0, w, h);

    const range = fitnessRange.max - fitnessRange.min || 1;

    // Draw cells
    for (const cell of cells) {
      const xi = positions.indexOf(cell.position);
      const yi = AMINO_ACIDS.indexOf(cell.aa);
      if (xi < 0 || yi < 0) continue;

      const x = labelW + xi * cellW;
      const y = labelH + yi * cellH;

      if (cell.count > 0 || cell.isWildType) {
        const t = (cell.fitness - fitnessRange.min) / range;
        const [r, g, b] = viridisColor(t);
        ctx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }

      // WT marker
      if (cell.isWildType) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      }

      // Count label
      if (cell.count > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '8px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(cell.count.toString(), x + cellW / 2, y + cellH / 2 + 3);
      }
    }

    // Position labels (top)
    ctx.fillStyle = 'rgba(225,215,200,0.6)';
    ctx.font = '8px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < positions.length; i++) {
      ctx.fillText(positions[i].toString(), labelW + i * cellW + cellW / 2, labelH - 5);
    }

    // AA labels (left)
    ctx.textAlign = 'right';
    for (let i = 0; i < AMINO_ACIDS.length; i++) {
      ctx.fillText(AMINO_ACIDS[i], labelW - 5, labelH + i * cellH + cellH / 2 + 3);
    }
  }, [cells, positions, fitnessRange]);

  // Handle hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const labelW = 36;
    const labelH = 20;
    const cellW = 28;
    const cellH = 22;
    const xi = Math.floor((x - labelW) / cellW);
    const yi = Math.floor((y - labelH) / cellH);
    if (xi >= 0 && xi < positions.length && yi >= 0 && yi < AMINO_ACIDS.length) {
      const cell = cells.find(c => c.position === positions[xi] && c.aa === AMINO_ACIDS[yi]);
      setHovered(cell ?? null);
    } else {
      setHovered(null);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: 'crosshair', borderRadius: '6px' }}
      />
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: '6px', padding: '6px 10px', borderRadius: '8px',
          background: 'rgba(0,0,0,0.85)', border: `1px solid ${PROEVOL_THEME.border}`,
          backdropFilter: 'blur(8px)', whiteSpace: 'nowrap', zIndex: 10,
          fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.value,
          display: 'grid', gap: '2px',
        }}>
          <span>{hovered.wtResidue}{hovered.position}{hovered.aa === hovered.wtResidue ? '(WT)' : hovered.aa}</span>
          <span style={{ color: PROEVOL_THEME.muted }}>
            {metric}: {hovered.count > 0 ? hovered.fitness.toFixed(1) : '—'} · n={hovered.count}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── 3D Fitness Surface ───────────────────────────────────────────────── */

function FitnessSurface({ cells, positions, metric }: {
  cells: FitnessCell[];
  positions: number[];
  metric: FitnessMetricKey;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, colors } = useMemo(() => {
    const nX = positions.length;
    const nY = AMINO_ACIDS.length;
    if (nX === 0 || nY === 0) return { geometry: new THREE.BufferGeometry(), colors: new Float32Array(0) };

    const fitnessRange = (() => {
      const vals = cells.filter(c => c.count > 0).map(c => c.fitness);
      if (!vals.length) return { min: 0, max: 100 };
      return { min: Math.min(...vals), max: Math.max(...vals) };
    })();
    const range = fitnessRange.max - fitnessRange.min || 1;

    const geo = new THREE.PlaneGeometry(2, 1.6, nX - 1, nY - 1);
    const posAttr = geo.attributes.position;
    const colorArr = new Float32Array(posAttr.count * 3);

    for (let yi = 0; yi < nY; yi++) {
      for (let xi = 0; xi < nX; xi++) {
        const idx = yi * nX + xi;
        const cell = cells.find(c => c.position === positions[xi] && c.aa === AMINO_ACIDS[yi]);
        const fitness = cell?.fitness ?? fitnessRange.min;
        const t = (fitness - fitnessRange.min) / range;
        const height = t * 0.5;
        posAttr.setZ(idx, height);
        const [r, g, b] = viridisColor(t);
        colorArr[idx * 3] = r;
        colorArr[idx * 3 + 1] = g;
        colorArr[idx * 3 + 2] = b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    geo.computeVertexNormals();
    return { geometry: geo, colors: colorArr };
  }, [cells, positions]);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-0.4, 0.2, 0]}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} wireframe={false} />
    </mesh>
  );
}

function FitnessSurfaceCanvas({ cells, positions, metric }: {
  cells: FitnessCell[];
  positions: number[];
  metric: FitnessMetricKey;
}) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 2.5], zoom: 120 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '280px', borderRadius: '8px' }}
    >
      <FitnessSurface cells={cells} positions={positions} metric={metric} />
    </Canvas>
  );
}

/* ── Axis Labels for 3D ───────────────────────────────────────────────── */

function AxisLabels({ positions, metric }: { positions: number[]; metric: FitnessMetricKey }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', gap: '8px', marginTop: '4px',
    }}>
      <span style={{ fontFamily: T.MONO, fontSize: '8px', color: PROEVOL_THEME.label, letterSpacing: '0.06em' }}>
        ← Position {positions[0] ?? '—'}
      </span>
      <span style={{ fontFamily: T.MONO, fontSize: '8px', color: PROEVOL_THEME.label, textAlign: 'center' }}>
        Amino acid substitution → Y | Position → X | {metric} ↑ Z
      </span>
      <span style={{ fontFamily: T.MONO, fontSize: '8px', color: PROEVOL_THEME.label, textAlign: 'right' }}>
        {positions[positions.length - 1] ?? '—'} Position →
      </span>
    </div>
  );
}

/* ── Legend ────────────────────────────────────────────────────────────── */

function FitnessLegend({ metric, cells }: { metric: FitnessMetricKey; cells: FitnessCell[] }) {
  const range = useMemo(() => {
    const vals = cells.filter(c => c.count > 0).map(c => c.fitness);
    if (!vals.length) return { min: 0, max: 100 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [cells]);

  const steps = 8;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontFamily: T.MONO, fontSize: '8px', color: PROEVOL_THEME.muted }}>{range.min.toFixed(0)}</span>
      <div style={{ display: 'flex', flex: 1, height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
        {Array.from({ length: steps }, (_, i) => {
          const t = i / (steps - 1);
          const [r, g, b] = viridisColor(t);
          return (
            <div key={i} style={{
              flex: 1,
              background: `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`,
            }} />
          );
        })}
      </div>
      <span style={{ fontFamily: T.MONO, fontSize: '8px', color: PROEVOL_THEME.muted }}>{range.max.toFixed(0)}</span>
      <span style={{ fontFamily: T.MONO, fontSize: '8px', color: PROEVOL_THEME.label, marginLeft: '4px' }}>
        {FITNESS_METRICS.find(m => m.key === metric)?.label ?? metric}
      </span>
    </div>
  );
}

/* ── Main Panel ───────────────────────────────────────────────────────── */

export default function ActivityLandscapePanel({
  campaign,
  selectedVariantId,
  onSelectVariant,
}: {
  campaign: ProteinEvolutionCampaign;
  selectedVariantId: string | null;
  onSelectVariant: (id: string) => void;
}) {
  const [metric, setMetric] = useState<FitnessMetricKey>('activity');
  const [viewMode, setViewMode] = useState<'heatmap' | '3d'>('heatmap');

  const { cells, positions } = useMemo(() => buildFitnessGrid(campaign, metric), [campaign, metric]);

  return (
    <div style={{
      padding: '10px 12px', borderRadius: '12px',
      border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {FITNESS_METRICS.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              style={{
                minHeight: '24px', padding: '0 8px', borderRadius: '999px',
                border: `1px solid ${metric === m.key ? `${m.color}55` : PROEVOL_THEME.border}`,
                background: metric === m.key ? `${m.color}18` : 'transparent',
                color: metric === m.key ? PROEVOL_THEME.value : PROEVOL_THEME.label,
                fontFamily: T.MONO, fontSize: '8px', textTransform: 'uppercase',
                letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setViewMode('heatmap')}
            style={{
              minHeight: '24px', padding: '0 8px', borderRadius: '999px',
              border: `1px solid ${viewMode === 'heatmap' ? `${PROEVOL_THEME.mint}55` : PROEVOL_THEME.border}`,
              background: viewMode === 'heatmap' ? 'rgba(191,220,205,0.12)' : 'transparent',
              color: viewMode === 'heatmap' ? PROEVOL_THEME.value : PROEVOL_THEME.label,
              fontFamily: T.MONO, fontSize: '8px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            Heatmap
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            style={{
              minHeight: '24px', padding: '0 8px', borderRadius: '999px',
              border: `1px solid ${viewMode === '3d' ? `${PROEVOL_THEME.mint}55` : PROEVOL_THEME.border}`,
              background: viewMode === '3d' ? 'rgba(191,220,205,0.12)' : 'transparent',
              color: viewMode === '3d' ? PROEVOL_THEME.value : PROEVOL_THEME.label,
              fontFamily: T.MONO, fontSize: '8px', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            3D Surface
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'heatmap' ? (
        <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
          <DMSHeatmap
            cells={cells}
            positions={positions}
            metric={metric}
            selectedVariantId={selectedVariantId}
            campaign={campaign}
            onSelectVariant={onSelectVariant}
          />
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <FitnessSurfaceCanvas cells={cells} positions={positions} metric={metric} />
          <AxisLabels positions={positions} metric={metric} />
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: '6px' }}>
        <FitnessLegend metric={metric} cells={cells} />
      </div>

      {/* Interpretation */}
      <div style={{
        marginTop: '6px', padding: '6px 8px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${PROEVOL_THEME.border}`,
        fontFamily: T.SANS, fontSize: '10px', color: PROEVOL_THEME.muted, lineHeight: 1.5,
      }}>
        Position × amino acid substitution fitness map. White outline = wild-type residue. Number in cell = variant count.
        {positions.length > 0 ? ` ${positions.length} positions × ${AMINO_ACIDS.length} substitutions = ${positions.length * AMINO_ACIDS.length} cells.` : ''}
      </div>
    </div>
  );
}
