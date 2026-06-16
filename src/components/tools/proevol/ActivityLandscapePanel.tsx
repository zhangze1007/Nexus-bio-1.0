'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  PlaneGeometry,
} from 'three';
import type { ProteinEvolutionCampaign, VariantCandidate } from '../../../services/ProEvolCampaignEngine';
import { PROEVOL_THEME, StatusPill } from './shared';
import { THEME } from '../../../theme';
import CanvasErrorBoundary from '../../shared/CanvasErrorBoundary';

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
  wtFitness: number;
} {
  const allVariants = Object.values(campaign.variantIndex);
  const sitePool = campaign.rounds[0]?.variantLibrary.candidates[0]?.mutatedPositions ?? [];

  // Collect all mutation positions from sitePool
  const positions = [...sitePool].sort((a, b) => a - b);
  if (positions.length === 0) return { cells: [], positions: [], wtFitness: 55 };

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

  // Derive actual WT fitness from campaign data for the selected metric
  const wtFitness = metric === 'composite' ? wt.score.composite
    : metric === 'activity' ? wt.predictedActivity
    : metric === 'stability' ? wt.predictedStability
    : metric === 'expression' ? wt.predictedExpression
    : wt.predictedSpecificity;

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
        fitness: data ? data.sum / data.count : (isWT ? wtFitness : 0),
        count: data?.count ?? 0,
        isWildType: isWT,
      });
    }
  }

  return { cells, positions, wtFitness };
}

function mutationEffect(cell: FitnessCell, fitnessRange: { min: number; max: number }, wtFitness: number): 'wt' | 'tolerated' | 'deleterious' | 'gain-of-function' {
  if (cell.isWildType) return 'wt';
  if (cell.count === 0) return 'tolerated';
  const threshold = (fitnessRange.max - fitnessRange.min) * 0.15;
  if (cell.fitness > wtFitness + threshold) return 'gain-of-function';
  if (cell.fitness < wtFitness - threshold) return 'deleterious';
  return 'tolerated';
}

function effectLabel(effect: ReturnType<typeof mutationEffect>): string {
  if (effect === 'wt') return 'WT';
  if (effect === 'gain-of-function') return 'GoF';
  if (effect === 'deleterious') return 'DEL';
  return 'TOL';
}

function effectColor(effect: ReturnType<typeof mutationEffect>): string {
  if (effect === 'gain-of-function') return PROEVOL_THEME.mint;
  if (effect === 'deleterious') return PROEVOL_THEME.coral;
  return PROEVOL_THEME.muted;
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

function DMSHeatmap({ cells, positions, metric, wtFitness, selectedVariantId, campaign, onSelectVariant, peakThreshold = 0.7 }: {
  cells: FitnessCell[];
  positions: number[];
  metric: FitnessMetricKey;
  wtFitness: number;
  selectedVariantId: string | null;
  campaign: ProteinEvolutionCampaign;
  onSelectVariant: (id: string) => void;
  peakThreshold?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<FitnessCell | null>(null);

  const fitnessRange = useMemo(() => {
    const vals = cells.filter(c => c.count > 0).map(c => c.fitness);
    if (!vals.length) return { min: 0, max: 100 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [cells]);

  // Build position index map for O(1) lookup
  const posIndex = useMemo(() => {
    const map = new Map<number, number>();
    positions.forEach((p, i) => map.set(p, i));
    return map;
  }, [positions]);

  const aaIndex = useMemo(() => {
    const map = new Map<string, number>();
    AMINO_ACIDS.forEach((aa, i) => map.set(aa, i));
    return map;
  }, []);

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
      const xi = posIndex.get(cell.position);
      const yi = aaIndex.get(cell.aa);
      if (xi === undefined || yi === undefined) continue;

      const x = labelW + xi * cellW;
      const y = labelH + yi * cellH;

      if (cell.count > 0 || cell.isWildType) {
        const t = (cell.fitness - fitnessRange.min) / range;
        const [r, g, b] = viridisColor(t);
        ctx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      } else {
        // Unobserved — distinct gray, not lowest viridis
        ctx.fillStyle = 'rgba(50,48,44,0.6)';
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.font = '7px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('—', x + cellW / 2, y + cellH / 2 + 2);
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

    // ── Marching-squares contour lines ──────────────────────────────────
    // Build a 2D grid of fitness values for contour extraction
    const gridW = positions.length;
    const gridH = AMINO_ACIDS.length;
    const grid: number[][] = Array.from({ length: gridH }, () => new Array(gridW).fill(NaN));

    for (const cell of cells) {
      const xi = posIndex.get(cell.position);
      const yi = aaIndex.get(cell.aa);
      if (xi !== undefined && yi !== undefined && (cell.count > 0 || cell.isWildType)) {
        grid[yi][xi] = (cell.fitness - fitnessRange.min) / range;
      }
    }

    // Draw isocontours at 5 levels
    const contourLevels = [0.2, 0.4, 0.6, 0.8, 0.95];
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.8;

    for (const level of contourLevels) {
      // Simple marching squares: check each cell for contour crossing
      for (let yi = 0; yi < gridH - 1; yi++) {
        for (let xi = 0; xi < gridW - 1; xi++) {
          const v00 = grid[yi][xi];
          const v10 = grid[yi][xi + 1];
          const v01 = grid[yi + 1][xi];
          const v11 = grid[yi + 1][xi + 1];

          // Skip cells with NaN
          if (isNaN(v00) || isNaN(v10) || isNaN(v01) || isNaN(v11)) continue;

          // Determine which corners are above the contour level
          const code =
            (v00 >= level ? 1 : 0) |
            (v10 >= level ? 2 : 0) |
            (v11 >= level ? 4 : 0) |
            (v01 >= level ? 8 : 0);

          // Skip uniform cells (all above or all below)
          if (code === 0 || code === 15) continue;

          // Interpolate contour segment(s)
          const x0 = labelW + xi * cellW + cellW / 2;
          const y0 = labelH + yi * cellH + cellH / 2;
          const x1 = labelW + (xi + 1) * cellW + cellW / 2;
          const y1 = labelH + (yi + 1) * cellH + cellH / 2;

          // Linear interpolation helpers
          const interpX = (va: number, vb: number, ya: number, yb: number) => {
            const t = (level - va) / (vb - va);
            return ya + t * (yb - ya);
          };

          // Draw contour segments based on marching squares case
          const drawSegment = (ax: number, ay: number, bx: number, by: number) => {
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          };

          // Edge midpoints (linear interpolation)
          const top = { x: interpX(v00, v10, x0, x1), y: y0 };
          const bottom = { x: interpX(v01, v11, x0, x1), y: y1 };
          const left = { x: x0, y: interpX(v00, v01, y0, y1) };
          const right = { x: x1, y: interpX(v10, v11, y0, y1) };

          switch (code) {
            case 1: case 14: drawSegment(top.x, top.y, left.x, left.y); break;
            case 2: case 13: drawSegment(top.x, top.y, right.x, right.y); break;
            case 3: case 12: drawSegment(left.x, left.y, right.x, right.y); break;
            case 4: case 11: drawSegment(right.x, right.y, bottom.x, bottom.y); break;
            case 5: drawSegment(top.x, top.y, right.x, right.y); drawSegment(left.x, left.y, bottom.x, bottom.y); break;
            case 6: case 9: drawSegment(top.x, top.y, bottom.x, bottom.y); break;
            case 7: case 8: drawSegment(left.x, left.y, bottom.x, bottom.y); break;
            case 10: drawSegment(top.x, top.y, left.x, left.y); drawSegment(right.x, right.y, bottom.x, bottom.y); break;
          }
        }
      }
    }

    // ── Peak markers ────────────────────────────────────────────────────
    // Build O(1) lookup map for cells
    const cellLookup = new Map<string, FitnessCell>();
    for (const c of cells) cellLookup.set(`${c.position}-${c.aa}`, c);

    // Find local maxima (cells higher than all 8 neighbors)
    const peakCells: FitnessCell[] = [];
    for (let yi = 1; yi < gridH - 1; yi++) {
      for (let xi = 1; xi < gridW - 1; xi++) {
        const v = grid[yi][xi];
        if (isNaN(v)) continue;

        let isPeak = true;
        for (let dy = -1; dy <= 1 && isPeak; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const neighbor = grid[yi + dy][xi + dx];
            if (!isNaN(neighbor) && neighbor > v) {
              isPeak = false;
              break;
            }
          }
        }

        if (isPeak && v > peakThreshold) {
          const cell = cellLookup.get(`${positions[xi]}-${AMINO_ACIDS[yi]}`);
          if (cell) peakCells.push(cell);
        }
      }
    }

    // Draw peak markers
    for (const peak of peakCells) {
      const xi = posIndex.get(peak.position);
      const yi = aaIndex.get(peak.aa);
      if (xi === undefined || yi === undefined) continue;
      const cx = labelW + xi * cellW + cellW / 2;
      const cy = labelH + yi * cellH + cellH / 2;

      // Glow halo
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();

      // Diamond marker
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx + 4, cy);
      ctx.lineTo(cx, cy + 4);
      ctx.lineTo(cx - 4, cy);
      ctx.closePath();
      ctx.fill();

      // Peak label
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '7px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`★${peak.fitness.toFixed(0)}`, cx, cy - 8);
    }

    // Cleanup function to prevent memory leaks
    return () => {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };
  }, [cells, positions, fitnessRange, posIndex, aaIndex]);

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
          marginBottom: '6px', padding: '6px 10px', borderRadius: 'var(--nb-radius-sm)',
          background: 'rgba(0,0,0,0.85)', border: `1px solid ${PROEVOL_THEME.border}`,
          backdropFilter: 'blur(8px)', whiteSpace: 'nowrap', zIndex: 10,
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.value,
          display: 'grid', gap: '2px',
        }}>
          <span>{hovered.wtResidue}{hovered.position}{hovered.aa === hovered.wtResidue ? '(WT)' : hovered.aa}</span>
          <span style={{ color: effectColor(mutationEffect(hovered, fitnessRange, wtFitness)) }}>
            {effectLabel(mutationEffect(hovered, fitnessRange, wtFitness))} · predicted {metric}: {hovered.count > 0 ? hovered.fitness.toFixed(1) : '—'} · n={hovered.count}
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
  const meshRef = useRef<Mesh>(null);

  // Build lookup for O(1) access
  const cellLookup = useMemo(() => {
    const map = new Map<string, FitnessCell>();
    for (const c of cells) map.set(`${c.position}-${c.aa}`, c);
    return map;
  }, [cells]);

  const { geometry, colors } = useMemo(() => {
    const nX = positions.length;
    const nY = AMINO_ACIDS.length;
    if (nX === 0 || nY === 0) return { geometry: new BufferGeometry(), colors: new Float32Array(0) };

    const fitnessRange = (() => {
      const vals = cells.filter(c => c.count > 0).map(c => c.fitness);
      if (!vals.length) return { min: 0, max: 100 };
      return { min: Math.min(...vals), max: Math.max(...vals) };
    })();
    const range = fitnessRange.max - fitnessRange.min || 1;

    const geo = new PlaneGeometry(2, 1.6, nX - 1, nY - 1);
    const posAttr = geo.attributes.position;
    const colorArr = new Float32Array(posAttr.count * 3);

    for (let yi = 0; yi < nY; yi++) {
      for (let xi = 0; xi < nX; xi++) {
        const idx = yi * nX + xi;
        const cell = cellLookup.get(`${positions[xi]}-${AMINO_ACIDS[yi]}`);
        const observed = cell && (cell.count > 0 || cell.isWildType);

        if (observed) {
          const t = (cell.fitness - fitnessRange.min) / range;
          const height = t * 0.5;
          posAttr.setZ(idx, height);
          const [r, g, b] = viridisColor(t);
          colorArr[idx * 3] = r;
          colorArr[idx * 3 + 1] = g;
          colorArr[idx * 3 + 2] = b;
        } else {
          // Unobserved — flat at baseline, dark gray
          posAttr.setZ(idx, 0);
          colorArr[idx * 3] = 0.18;
          colorArr[idx * 3 + 1] = 0.17;
          colorArr[idx * 3 + 2] = 0.16;
        }
      }
    }

    geo.setAttribute('color', new BufferAttribute(colorArr, 3));
    geo.computeVertexNormals();
    return { geometry: geo, colors: colorArr };
  }, [cells, positions, cellLookup]);

  return (
    <group rotation={[-0.5, 0.3, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshLambertMaterial vertexColors side={DoubleSide} />
      </mesh>
      {/* Wireframe overlay for depth perception */}
      <mesh geometry={geometry}>
        <meshBasicMaterial color="rgba(255,255,255,0.06)" side={DoubleSide} wireframe transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function FitnessSurfaceCanvas({ cells, positions, metric }: {
  cells: FitnessCell[];
  positions: number[];
  metric: FitnessMetricKey;
}) {
  return (
    <CanvasErrorBoundary>
      <Canvas
        orthographic
        camera={{ position: [2, 2, 2.5], zoom: 100 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        style={{ width: '100%', height: '320px', borderRadius: 'var(--nb-radius-sm)', cursor: 'grab' }}
      >
        <FitnessSurface cells={cells} positions={positions} metric={metric} />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minZoom={50}
          maxZoom={250}
          rotateSpeed={0.5}
        />
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 2, 4]} intensity={0.6} />
      </Canvas>
    </CanvasErrorBoundary>
  );
}

/* ── Axis Labels for 3D ───────────────────────────────────────────────── */

function AxisLabels({ positions, metric }: { positions: number[]; metric: FitnessMetricKey }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', gap: '8px', marginTop: '4px',
    }}>
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label, letterSpacing: '0.06em' }}>
        ← Position {positions[0] ?? '—'}
      </span>
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label, textAlign: 'center' }}>
        Amino acid substitution → Y | Position → X | {metric} ↑ Z
      </span>
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label, textAlign: 'right' }}>
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
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.muted }}>{range.min.toFixed(0)}</span>
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
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.muted }}>{range.max.toFixed(0)}</span>
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label, marginLeft: '4px' }}>
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

  const { cells, positions, wtFitness } = useMemo(() => buildFitnessGrid(campaign, metric), [campaign, metric]);

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--nb-radius-md)',
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
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase',
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
              fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', cursor: 'pointer',
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
              fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', cursor: 'pointer',
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
            wtFitness={wtFitness}
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
        marginTop: '6px', padding: '6px 8px', borderRadius: 'var(--nb-radius-sm)',
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${PROEVOL_THEME.border}`,
        fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.muted, lineHeight: 1.5,
        display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
      }}>
        <span>Predicted fitness landscape. White outline = WT. Gray = unobserved. Hover for effect class.</span>
        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ color: PROEVOL_THEME.mint, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>GoF</span>
          <span style={{ color: PROEVOL_THEME.muted, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>TOL</span>
          <span style={{ color: PROEVOL_THEME.coral, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>DEL</span>
        </span>
        {positions.length > 0 ? (
          <span style={{ marginLeft: 'auto', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>
            {positions.length} pos × {AMINO_ACIDS.length} AA = {positions.length * AMINO_ACIDS.length} cells
          </span>
        ) : null}
      </div>
    </div>
  );
}
