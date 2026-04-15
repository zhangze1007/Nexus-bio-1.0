'use client';
import { useEffect, useMemo, useState } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import {
  runFullCFSPipeline,
  generateDefaultConstructs,
  generateDefaultParameters,
} from '../../services/CellFreeEngine';
import type {
  CFSFullResult,
  GeneConstruct,
  CFSParameters,
} from '../../services/CellFreeEngine';
import { useWorkbenchStore } from '../../store/workbenchStore';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import { buildCellFreeSeed } from './shared/workbenchDataflow';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';
import ScientificHero from './shared/ScientificHero';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import HybridWorkbenchPanels from './shared/HybridWorkbenchPanels';

/* ── Design Tokens ────────────────────────────────────────────────── */

const PANEL_BG = PATHD_THEME.sepiaPanelMuted;
const BORDER = PATHD_THEME.sepiaPanelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;
const INPUT_BG = PATHD_THEME.panelInset;
const INPUT_BORDER = PATHD_THEME.sepiaPanelBorder;
const INPUT_TEXT = PATHD_THEME.value;
const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  background: PATHD_THEME.panelSurface,
  border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
};

const GENE_COLORS = [PATHD_THEME.mint, PATHD_THEME.sky, PATHD_THEME.coral, PATHD_THEME.apricot, PATHD_THEME.lilac];

type ViewMode = 'TimeCourse' | 'Resources' | 'Fitting' | 'IvIv' | 'Reactor3D';

/* ── Section Label ────────────────────────────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.1em', color: LABEL, margin: '0 0 10px',
  }}>
    {children}
  </p>
);

/* ── SVG Helpers ──────────────────────────────────────────────────── */

function GridLines({ W, H, PAD, count }: { W: number; H: number; PAD: number; count: number }) {
  return (
    <>
      {Array.from({ length: count + 1 }).map((_, i) => {
        const gx = PAD + (i / count) * (W - PAD * 2);
        const gy = PAD + (i / count) * (H - PAD * 2);
        return (
          <g key={i}>
            <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          </g>
        );
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
    </>
  );
}

/* ── Catmull-Rom → cubic Bezier smooth path ──────────────────────── */

function crPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  const d: string[] = [`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`);
  }
  return d.join(' ');
}

/* ── Time Course Tri-Panel Layout ─────────────────────────────────── */

function TimeCourseChart({ result, constructs }: { result: CFSFullResult; constructs: GeneConstruct[] }) {
  const sim = result.simulation;
  const res = sim.resources;

  // ── TOP PANEL: smooth ODE curves with shaded area ─────────────────
  const TOP_W = 520, TOP_H = 220, TP = 40;
  const { tMax, pMax } = useMemo(() => {
    let tm = 0, pm = 0;
    sim.genes.forEach(g => {
      g.time.forEach(t => { if (t > tm) tm = t; });
      g.protein.forEach(p => { if (p > pm) pm = p; });
    });
    return { tMax: tm || 1, pMax: pm || 1 };
  }, [sim]);

  const tsx = (t: number) => TP + (t / tMax) * (TOP_W - TP * 2);
  const tsy = (p: number) => TOP_H - TP - (p / pMax) * (TOP_H - TP * 2);
  const BASE_Y = TOP_H - TP;

  // ── BOTTOM LEFT: stacked area resource depletion ───────────────────
  const BL_W = 260, BL_H = 200, BP = 36;
  const initAtp = res.atp[0] || 1;
  const initRib = res.ribosomeFree[0] || 1;
  const initAA  = res.aminoAcids[0] || 1;
  const btMax   = res.time[res.time.length - 1] || 1;
  const bsx = (t: number) => BP + (t / btMax) * (BL_W - BP - 16);
  const bsy = (f: number) => BL_H - BP - f * (BL_H - BP * 2);

  const RES_COLORS = { atp: '#E8A3A1', rib: '#AFC3D6', aa: '#BFDCCD' };  // coral / sky / mint

  // Stacked area paths (atp + rib + aa stacked to 1)
  const stackedPath = useMemo(() => {
    const fwd: string[] = [], bwd: string[] = [];
    res.time.forEach((t, i) => {
      const fa = Math.min(1, Math.max(0, res.atp[i] / initAtp));
      const fr = Math.min(1, Math.max(0, res.ribosomeFree[i] / initRib));
      const faa = Math.min(1, Math.max(0, res.aminoAcids[i] / initAA));
      const a1 = fa / 3, a2 = (fa + fr) / 3, a3 = (fa + fr + faa) / 3;
      fwd.push(`${bsx(t).toFixed(1)},${bsy(a1).toFixed(1)}`);
      bwd.unshift(`${bsx(t).toFixed(1)},${bsy(0).toFixed(1)}`);
      // store for layered fill
      return { t, a1, a2, a3 };
    });
    return { atp: fwd, base: bwd };
  }, [res, initAtp, initRib, initAA, bsx, bsy]);

  // ── BOTTOM RIGHT: radar chart ──────────────────────────────────────
  const BR_W = 240, BR_H = 200, RADAR_CX = 120, RADAR_CY = 105, RADAR_R = 74;
  const AXES = ['Yield', 'Stability', 'Rate', 'Efficiency', 'Reproducibility'];
  const N_AXES = AXES.length;

  const radarScores = useMemo(() => {
    return sim.genes.map((g, gi) => {
      const maxP = Math.max(...g.protein);
      const stability = 1 - (Math.max(...g.protein) - g.protein[g.protein.length - 1]) / (Math.max(...g.protein) + 0.001);
      const rate = g.protein.length > 5 ? (g.protein[5] - g.protein[0]) / (pMax + 0.001) : 0.5;
      const efficiency = maxP / (pMax + 0.001);
      const repro = 0.7 + 0.3 * (1 - gi * 0.05);
      return { geneId: g.geneId, geneName: g.geneName, scores: [efficiency, Math.max(0, Math.min(1, stability)), rate, efficiency * 0.8, repro] };
    });
  }, [sim.genes, pMax]);

  function radarPt(score: number, axis: number): [number, number] {
    const ang = (axis / N_AXES) * 2 * Math.PI - Math.PI / 2;
    return [RADAR_CX + RADAR_R * score * Math.cos(ang), RADAR_CY + RADAR_R * score * Math.sin(ang)];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {/* TOP PANEL — ODE protein curves */}
      <svg role="img" aria-label="ODE time course" viewBox={`0 0 ${TOP_W} ${TOP_H}`} style={{ width: '100%' }}>
        <rect width={TOP_W} height={TOP_H} fill="#050505" rx={10} />
        {Array.from({ length: 7 }).map((_, i) => {
          const gx = TP + (i / 6) * (TOP_W - TP * 2);
          const gy = TP + (i / 6) * (TOP_H - TP * 2);
          return <g key={i}>
            <line x1={gx} y1={TP} x2={gx} y2={BASE_Y} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <line x1={TP} y1={gy} x2={TOP_W - TP} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          </g>;
        })}
        <line x1={TP} y1={BASE_Y} x2={TOP_W - TP} y2={BASE_Y} stroke="rgba(255,255,255,0.1)" />
        <line x1={TP} y1={TP} x2={TP} y2={BASE_Y} stroke="rgba(255,255,255,0.1)" />
        <text x={TOP_W / 2} y={TOP_H - 6} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>Time (min)</text>
        <text x={12} y={TOP_H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
          transform={`rotate(-90,12,${TOP_H / 2})`}>Expression (a.u.)</text>
        {/* X-axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <text key={i} x={tsx(tMax * f)} y={BASE_Y + 12} textAnchor="middle"
            fontFamily={T.MONO} fontSize="7" fill={LABEL}>{Math.round(tMax * f)}</text>
        ))}
        {/* Y-axis ticks */}
        {[0, 0.5, 1].map((f, i) => (
          <text key={i} x={TP - 4} y={tsy(pMax * f) + 3} textAnchor="end"
            fontFamily={T.MONO} fontSize="7" fill={LABEL}>{(pMax * f).toFixed(1)}</text>
        ))}
        {sim.genes.map((g, gi) => {
          const color = constructs.find(c => c.id === g.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
          const pts: [number, number][] = g.time.map((t, j) => [tsx(t), tsy(g.protein[j])]);
          if (pts.length < 2) return null;
          // Shaded area: path from curve down to baseline
          const areaD = crPath(pts) + ` L ${pts[pts.length-1][0].toFixed(1)} ${BASE_Y} L ${pts[0][0].toFixed(1)} ${BASE_Y} Z`;
          return (
            <g key={g.geneId}>
              <path d={areaD} fill={color} opacity={0.12} />
              <path d={crPath(pts)} fill="none" stroke={color} strokeWidth={1.9} opacity={0.88} />
            </g>
          );
        })}
        {/* Legend */}
        {sim.genes.map((g, gi) => {
          const color = constructs.find(c => c.id === g.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
          return (
            <g key={`l${gi}`} transform={`translate(${TOP_W - TP - 110}, ${TP + 6 + gi * 15})`}>
              <line x1={0} y1={0} x2={13} y2={0} stroke={color} strokeWidth={2} />
              <text x={17} y={3.5} fontFamily={T.SANS} fontSize="8.5" fill={VALUE}>{g.geneName}</text>
            </g>
          );
        })}
      </svg>

      {/* BOTTOM ROW */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* BOTTOM LEFT — resource depletion stacked area */}
        <svg role="img" aria-label="Resource depletion" viewBox={`0 0 ${BL_W} ${BL_H}`} style={{ flex: 1 }}>
          <rect width={BL_W} height={BL_H} fill="#050505" rx={10} />
          <line x1={BP} y1={BL_H - BP} x2={BL_W - 16} y2={BL_H - BP} stroke="rgba(255,255,255,0.1)" />
          <line x1={BP} y1={BP} x2={BP} y2={BL_H - BP} stroke="rgba(255,255,255,0.1)" />
          <text x={(BL_W + BP) / 2} y={BL_H - 4} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill={LABEL}>Time (min)</text>
          <text x={10} y={BL_H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill={LABEL}
            transform={`rotate(-90,10,${BL_H / 2})`}>Fraction remaining</text>
          {/* Stacked areas */}
          {([
            { key: 'atp' as const, initV: initAtp, color: RES_COLORS.atp },
            { key: 'ribosomeFree' as const, initV: initRib, color: RES_COLORS.rib },
            { key: 'aminoAcids' as const, initV: initAA, color: RES_COLORS.aa },
          ] as const).map(({ key, initV, color }, si) => {
            const pts: [number, number][] = res.time.map((t, i) => [bsx(t), bsy(Math.min(1, res[key][i] / initV))]);
            const areaD = crPath(pts) + ` L ${pts[pts.length-1][0].toFixed(1)} ${bsy(0)} L ${pts[0][0].toFixed(1)} ${bsy(0)} Z`;
            return (
              <g key={key}>
                <path d={areaD} fill={color} opacity={0.25 + si * 0.05} />
                <path d={crPath(pts)} fill="none" stroke={color} strokeWidth={1.4} opacity={0.8} />
              </g>
            );
          })}
          {/* Legend */}
          {[['ATP', RES_COLORS.atp], ['Ribosomes', RES_COLORS.rib], ['Amino acids', RES_COLORS.aa]].map(([label, col], i) => (
            <g key={label} transform={`translate(${BP + 4}, ${BP + 4 + i * 13})`}>
              <rect width={8} height={4} fill={col} rx={1} opacity={0.8} />
              <text x={11} y={4.5} fontFamily={T.SANS} fontSize="7.5" fill={LABEL}>{label}</text>
            </g>
          ))}
          {/* Y ticks */}
          {[0, 0.5, 1].map((f, i) => (
            <text key={i} x={BP - 3} y={bsy(f) + 3} textAnchor="end" fontFamily={T.MONO} fontSize="7" fill={LABEL}>
              {f.toFixed(1)}
            </text>
          ))}
        </svg>

        {/* BOTTOM RIGHT — radar spider chart */}
        <svg role="img" aria-label="Construct radar chart" viewBox={`0 0 ${BR_W} ${BR_H}`} style={{ flex: 1 }}>
          <rect width={BR_W} height={BR_H} fill="#050505" rx={10} />
          <text x={RADAR_CX} y={12} textAnchor="middle" fontFamily={T.MONO} fontSize="7.5" fill={LABEL}>
            Construct performance
          </text>
          {/* Radar grid rings */}
          {[0.25, 0.5, 0.75, 1].map(scale => (
            <polygon key={scale}
              points={AXES.map((_, axis) => { const [x,y] = radarPt(scale, axis); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ')}
              fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={0.8} />
          ))}
          {/* Axis spokes */}
          {AXES.map((label, axis) => {
            const [x, y] = radarPt(1, axis);
            const [lx, ly] = radarPt(1.18, axis);
            return (
              <g key={label}>
                <line x1={RADAR_CX} y1={RADAR_CY} x2={x.toFixed(1)} y2={y.toFixed(1)}
                  stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} />
                <text x={lx.toFixed(1)} y={ly.toFixed(1)} textAnchor="middle" dominantBaseline="middle"
                  fontFamily={T.MONO} fontSize="7" fill={LABEL}>{label}</text>
              </g>
            );
          })}
          {/* Construct polygons */}
          {radarScores.map((rs, gi) => {
            const color = constructs.find(c => c.id === rs.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
            const poly = rs.scores.map((s, axis) => {
              const [x,y] = radarPt(s, axis);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            return (
              <g key={rs.geneId}>
                <polygon points={poly} fill={color} opacity={0.15} />
                <polygon points={poly} fill="none" stroke={color} strokeWidth={1.5} opacity={0.8} />
              </g>
            );
          })}
          {/* Legend */}
          {radarScores.map((rs, gi) => {
            const color = constructs.find(c => c.id === rs.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
            return (
              <g key={`rl${gi}`} transform={`translate(${BR_W - 80}, ${20 + gi * 13})`}>
                <rect width={8} height={4} fill={color} rx={1} />
                <text x={12} y={4} fontFamily={T.SANS} fontSize="7.5" fill={LABEL}>{rs.geneName}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ── Resource Depletion Chart ─────────────────────────────────────── */

function ResourceChart({ result }: { result: CFSFullResult }) {
  const W = 520, H = 380, PAD = 44;
  const res = result.simulation.resources;

  const initials = useMemo(() => ({
    ribosomeFree: res.ribosomeFree[0] || 1,
    atp: res.atp[0] || 1,
    gtp: res.gtp[0] || 1,
    pep: res.pep[0] || 1,
    aminoAcids: res.aminoAcids[0] || 1,
  }), [res]);

  const tMax = res.time[res.time.length - 1] || 1;
  const depTime = result.simulation.energyDepletionTime;

  function sx(t: number) { return PAD + (t / tMax) * (W - PAD * 2); }
  function sy(f: number) { return H - PAD - f * (H - PAD * 2); }

  const series: { key: keyof typeof initials; label: string; color: string }[] = [
    { key: 'ribosomeFree', label: 'Ribosome (free)', color: '#BFDCCD' },   // mint
    { key: 'atp',          label: 'ATP',             color: '#E8A3A1' },   // coral
    { key: 'gtp',          label: 'GTP',             color: '#AFC3D6' },   // sky
    { key: 'pep',          label: 'PEP',             color: '#E7C7A9' },   // apricot
    { key: 'aminoAcids',   label: 'Amino Acids',     color: '#CFC4E3' },   // lilac
  ];

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <GridLines W={W} H={H} PAD={PAD} count={8} />
      {/* Y ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map(v => (
        <text key={`yr${v}`} x={PAD - 6} y={sy(v) + 3} textAnchor="end"
          fontFamily={T.MONO} fontSize="7" fill={LABEL}>{v.toFixed(2)}</text>
      ))}
      {/* X ticks */}
      {Array.from({ length: 6 }).map((_, i) => {
        const v = (tMax / 5) * i;
        return (
          <text key={`xr${i}`} x={sx(v)} y={H - PAD + 14} textAnchor="middle"
            fontFamily={T.MONO} fontSize="7" fill={LABEL}>{Math.round(v)}</text>
        );
      })}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>
        Time (min)
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,12,${H / 2})`}>
        Fraction of Initial
      </text>
      {/* Energy depletion line */}
      {depTime > 0 && depTime < tMax && (
        <>
          <line x1={sx(depTime)} y1={PAD} x2={sx(depTime)} y2={H - PAD}
            stroke="rgba(255,100,80,0.5)" strokeWidth={1} strokeDasharray="4,3" />
          <text x={sx(depTime) + 4} y={PAD + 12} fontFamily={T.MONO} fontSize="7" fill="rgba(255,100,80,0.7)">
            Depletion
          </text>
        </>
      )}
      {/* Lines */}
      {series.map(s => {
        const raw = res[s.key];
        const init = initials[s.key];
        const pts = res.time.map((t, j) => `${sx(t)},${sy(Math.min(raw[j] / init, 1))}`).join(' ');
        return <polyline key={s.key} points={pts} fill="none" stroke={s.color} strokeWidth={1.5} opacity={0.8} />;
      })}
      {/* Legend */}
      {series.map((s, i) => (
        <g key={`lr${i}`} transform={`translate(${W - PAD - 120}, ${PAD + 8 + i * 14})`}>
          <line x1={0} y1={0} x2={12} y2={0} stroke={s.color} strokeWidth={2} />
          <text x={16} y={3.5} fontFamily={T.SANS} fontSize="8" fill={VALUE}>{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Fitting Chart ────────────────────────────────────────────────── */

function FittingChart({ result }: { result: CFSFullResult }) {
  const W = 520, H = 380, PAD = 44;
  const fit = result.fitting;

  if (!fit) {
    return (
      <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
        <rect width={W} height={H} fill="#050505" rx={12} />
        <text x={W / 2} y={H / 2} textAnchor="middle" fontFamily={T.SANS} fontSize="12" fill={LABEL}>
          No fitting data available
        </text>
      </svg>
    );
  }

  const curve = fit.fittedCurve;
  const cMax = Math.max(...curve.map(p => p.concentration), 1);
  const rMax = Math.max(...curve.map(p => p.rate), fit.vmax * 1.1, 1);

  const mainH = 280;
  const resH = 80;
  const resTop = mainH + 20;

  function sx(c: number) { return PAD + (c / cMax) * (W - PAD * 2); }
  function sy(r: number) { return PAD + (1 - r / rMax) * (mainH - PAD * 2); }

  const rMaxRes = Math.max(...fit.residuals.map(r => Math.abs(r)), 0.01);

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      {/* Main plot grid */}
      {Array.from({ length: 9 }).map((_, i) => {
        const gx = PAD + (i / 8) * (W - PAD * 2);
        const gy = PAD + (i / 8) * (mainH - PAD * 2);
        return (
          <g key={i}>
            <line x1={gx} y1={PAD} x2={gx} y2={mainH - PAD} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          </g>
        );
      })}
      <line x1={PAD} y1={mainH - PAD} x2={W - PAD} y2={mainH - PAD} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={mainH - PAD} stroke="rgba(255,255,255,0.1)" />
      {/* Scatter data points with error bars */}
      {curve.filter((_, i) => i % 3 === 0).map((p, i) => (
        <g key={`dp${i}`}>
          <line x1={sx(p.concentration)} y1={sy(p.rate * 0.9)} x2={sx(p.concentration)} y2={sy(p.rate * 1.1)}
            stroke="rgba(191,220,205,0.4)" strokeWidth={1} />
          <circle cx={sx(p.concentration)} cy={sy(p.rate)} r={3}
            fill="rgba(191,220,205,0.8)" stroke="rgba(191,220,205,0.4)" strokeWidth={0.5} />
        </g>
      ))}
      {/* Fitted curve */}
      <polyline
        points={curve.map(p => `${sx(p.concentration)},${sy(p.rate)}`).join(' ')}
        fill="none" stroke="#BFDCCD" strokeWidth={1.8} opacity={0.85}
      />
      {/* Vmax line */}
      <line x1={PAD} y1={sy(fit.vmax)} x2={W - PAD} y2={sy(fit.vmax)}
        stroke="rgba(231,199,169,0.4)" strokeWidth={1} strokeDasharray="4,3" />
      <text x={W - PAD - 4} y={sy(fit.vmax) - 4} textAnchor="end"
        fontFamily={T.MONO} fontSize="7" fill="rgba(231,199,169,0.9)">Vmax={fit.vmax.toFixed(2)}</text>
      {/* Stats text */}
      <text x={PAD + 8} y={PAD + 14} fontFamily={T.MONO} fontSize="8" fill={VALUE}>
        Vmax={fit.vmax.toFixed(2)} [{fit.vmax_ci[0].toFixed(2)}, {fit.vmax_ci[1].toFixed(2)}]
      </text>
      <text x={PAD + 8} y={PAD + 26} fontFamily={T.MONO} fontSize="8" fill={VALUE}>
        Kd={fit.kd.toFixed(2)} [{fit.kd_ci[0].toFixed(2)}, {fit.kd_ci[1].toFixed(2)}]
      </text>
      <text x={PAD + 8} y={PAD + 38} fontFamily={T.MONO} fontSize="8" fill={VALUE}>
        R²={fit.r_squared.toFixed(4)}
      </text>
      {/* Axis labels */}
      <text x={W / 2} y={mainH - 4} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>
        [DNA] (nM)
      </text>
      <text x={12} y={mainH / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,12,${mainH / 2})`}>
        Rate (nM/min)
      </text>
      {/* ── Residual plot ──────────────── */}
      <line x1={PAD} y1={resTop + resH / 2} x2={W - PAD} y2={resTop + resH / 2}
        stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
      <line x1={PAD} y1={resTop} x2={PAD} y2={resTop + resH}
        stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      {fit.residuals.map((r, i) => {
        const xp = PAD + (i / (fit.residuals.length - 1 || 1)) * (W - PAD * 2);
        const yp = resTop + resH / 2 - (r / rMaxRes) * (resH / 2 - 4);
        return (
          <circle key={`res${i}`} cx={xp} cy={yp} r={2}
            fill={r > 0 ? 'rgba(147,203,82,0.6)' : 'rgba(255,100,80,0.6)'} />
        );
      })}
      <text x={PAD + 4} y={resTop + 10} fontFamily={T.MONO} fontSize="7" fill={LABEL}>Residuals</text>
    </svg>
  );
}

/* ── IvIv Chart ───────────────────────────────────────────────────── */

function IvIvChart({ result }: { result: CFSFullResult }) {
  const W = 520, H = 380, PAD = 44;
  const iviv = result.iviv;
  const sim = result.simulation;

  if (!iviv) {
    return (
      <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
        <rect width={W} height={H} fill="#050505" rx={12} />
        <text x={W / 2} y={H / 2} textAnchor="middle" fontFamily={T.SANS} fontSize="12" fill={LABEL}>
          IvIv prediction unavailable — fitting required
        </text>
      </svg>
    );
  }

  const invitro = sim.steadyState[0]?.maxProtein ?? 0;
  const invivo = iviv.invivo_expression;
  const barMax = Math.max(invitro, invivo, 1) * 1.2;

  const barW = 60;
  const barGap = 80;
  const barBaseY = H - PAD - 40;
  const barTopY = PAD + 20;
  const barRange = barBaseY - barTopY;

  const corrTop = PAD + 10;
  const corrLeft = W / 2 + 30;
  const corrBarW = 140;

  function barH(v: number) { return (v / barMax) * barRange; }

  const confAngle = iviv.confidence * 180;

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      {/* Bar chart */}
      <rect x={PAD + 40} y={barBaseY - barH(invitro)} width={barW} height={barH(invitro)}
        fill="#AFC3D6" rx={4} opacity={0.8} />
      <text x={PAD + 40 + barW / 2} y={barBaseY + 14} textAnchor="middle"
        fontFamily={T.SANS} fontSize="9" fill={VALUE}>In vitro</text>
      <text x={PAD + 40 + barW / 2} y={barBaseY - barH(invitro) - 6} textAnchor="middle"
        fontFamily={T.MONO} fontSize="8" fill={VALUE}>{invitro.toFixed(1)} nM</text>

      <rect x={PAD + 40 + barW + barGap} y={barBaseY - barH(invivo)} width={barW} height={barH(invivo)}
        fill="#BFDCCD" rx={4} opacity={0.8} />
      <text x={PAD + 40 + barW + barGap + barW / 2} y={barBaseY + 14} textAnchor="middle"
        fontFamily={T.SANS} fontSize="9" fill={VALUE}>In vivo (pred)</text>
      <text x={PAD + 40 + barW + barGap + barW / 2} y={barBaseY - barH(invivo) - 6} textAnchor="middle"
        fontFamily={T.MONO} fontSize="8" fill={VALUE}>{invivo.toFixed(1)} nM</text>

      {/* Baseline */}
      <line x1={PAD + 20} y1={barBaseY} x2={PAD + 40 + barW * 2 + barGap + 20} y2={barBaseY}
        stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />

      {/* Correction factor bars */}
      <text x={corrLeft} y={corrTop} fontFamily={T.SANS} fontSize="9" fill={VALUE} fontWeight={600}>
        Correction Factors
      </text>
      {iviv.corrections.map((c, i) => {
        const adjMax = Math.max(...iviv.corrections.map(x => Math.abs(x.adjustment)), 0.1);
        const bw = (Math.abs(c.adjustment) / adjMax) * corrBarW;
        const y = corrTop + 18 + i * 22;
        const positive = c.adjustment >= 0;
        return (
          <g key={`cf${i}`}>
            <text x={corrLeft} y={y + 4} fontFamily={T.SANS} fontSize="7" fill={LABEL}>{c.factor}</text>
            <rect x={corrLeft} y={y + 8} width={bw} height={8}
              fill={positive ? 'rgba(191,220,205,0.5)' : 'rgba(232,163,161,0.5)'} rx={2} />
            <text x={corrLeft + bw + 4} y={y + 16} fontFamily={T.MONO} fontSize="7"
              fill={positive ? 'rgba(191,220,205,0.9)' : 'rgba(232,163,161,0.9)'}>
              {c.adjustment > 0 ? '+' : ''}{c.adjustment.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Confidence gauge */}
      {(() => {
        const cx = corrLeft + corrBarW / 2;
        const cy = H - PAD - 30;
        const r = 32;
        const startAngle = Math.PI;
        const endAngle = Math.PI + (confAngle * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = confAngle > 90 ? 1 : 0;
        return (
          <g>
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
            <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none" stroke="#BFDCCD" strokeWidth={6} strokeLinecap="round" />
            <text x={cx} y={cy - 4} textAnchor="middle" fontFamily={T.MONO} fontSize="14" fontWeight={700} fill={VALUE}>
              {(iviv.confidence * 100).toFixed(0)}%
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontFamily={T.SANS} fontSize="7" fill={LABEL}>
              Confidence
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

function ReactorTwin3D({ result, constructs, params }: { result: CFSFullResult; constructs: GeneConstruct[]; params: CFSParameters }) {
  const steadyMap = useMemo(
    () => Object.fromEntries(result.simulation.steadyState.map(entry => [entry.geneId, entry])),
    [result.simulation.steadyState],
  );
  const maxYield = Math.max(...result.simulation.steadyState.map(entry => entry.maxProtein), 1);
  const energyPool = params.initialEnergy.atp + params.initialEnergy.gtp + params.initialEnergy.pep;
  const depletionRatio = Math.min(1, result.simulation.energyDepletionTime / params.simulationTime);
  const reactorHeight = 240;
  const vesselTop = 72;
  const fillHeight = Math.max(36, depletionRatio * 142);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '420px', borderRadius: '18px', overflow: 'hidden', border: `1px solid ${BORDER}`, background: '#050505', position: 'relative' }}>
      <svg role="img" aria-label="Chart" viewBox="0 0 720 420" style={{ width: '100%', height: '100%' }}>
        <rect width="720" height="420" fill="#05070b" />
        <rect x="26" y="24" width="668" height="372" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
        <text x="44" y="20" fontFamily={T.SANS} fontSize="10" fill={LABEL} letterSpacing="0.12em">CELL-FREE REACTOR TWIN</text>
        <text x="44" y="34" fontFamily={T.SANS} fontSize="12" fill={VALUE}>Resource state, construct yield, and IVIV translation in one reactor-facing schematic</text>

        <rect x="54" y={vesselTop} width="156" height={reactorHeight} rx="22" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
        <rect x="66" y={vesselTop + reactorHeight - fillHeight - 12} width="132" height={fillHeight} rx="18" fill="rgba(147,203,82,0.32)" stroke="rgba(147,203,82,0.42)" />
        <line x1="66" y1={vesselTop + reactorHeight - fillHeight - 12} x2="198" y2={vesselTop + reactorHeight - fillHeight - 12} stroke="rgba(147,203,82,0.9)" strokeDasharray="4 3" />
        <text x="76" y={vesselTop + reactorHeight + 24} fontFamily={T.MONO} fontSize="8" fill={LABEL}>reaction volume</text>
        <text x="76" y={vesselTop + reactorHeight + 38} fontFamily={T.MONO} fontSize="10" fill={VALUE}>{(depletionRatio * 100).toFixed(0)}% energy-support window</text>

        {constructs.map((construct, index) => {
          const steady = steadyMap[construct.id];
          const normalized = steady ? steady.maxProtein / maxYield : 0.15;
          const height = 42 + normalized * 128;
          const x = 272 + index * 86;
          const y = 290 - height;
          return (
            <g key={construct.id}>
              <rect x={x} y={y} width="34" height={height} rx="10" fill={GENE_COLORS[index % GENE_COLORS.length]} opacity="0.86" />
              <rect x={x} y={y} width="34" height={height} rx="10" fill="none" stroke="rgba(255,255,255,0.12)" />
              <text x={x + 17} y="312" textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={VALUE}>{construct.name.slice(0, 6)}</text>
              <text x={x + 17} y={y - 8} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={VALUE}>{steady ? steady.maxProtein.toFixed(1) : '0.0'}</text>
            </g>
          );
        })}
        <text x="272" y="332" fontFamily={T.SANS} fontSize="9" fill={LABEL}>Construct yield skyline</text>

        {[
          { label: 'ATP', value: params.initialEnergy.atp / energyPool, x: 546, color: '#E8A3A1' },   // coral
          { label: 'GTP', value: params.initialEnergy.gtp / energyPool, x: 596, color: '#AFC3D6' },   // sky
          { label: 'PEP', value: params.initialEnergy.pep / energyPool, x: 646, color: '#E7C7A9' },   // apricot
        ].map((resource) => {
          const height = 46 + resource.value * 118;
          return (
            <g key={resource.label}>
              <rect x={resource.x} y={290 - height} width="26" height={height} rx="8" fill={resource.color} opacity="0.82" />
              <text x={resource.x + 13} y="312" textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={VALUE}>{resource.label}</text>
            </g>
          );
        })}
        <text x="546" y="332" fontFamily={T.SANS} fontSize="9" fill={LABEL}>Resource reservoirs</text>

        <rect x="246" y="62" width="448" height="70" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" />
        <text x="264" y="82" fontFamily={T.MONO} fontSize="8" fill={LABEL}>TRANSLATION SUMMARY</text>
        <text x="264" y="104" fontFamily={T.SANS} fontSize="12" fill={VALUE}>
          {result.simulation.totalProteinYield.toFixed(1)} nM in vitro total yield · {result.simulation.energyDepletionTime.toFixed(0)} min depletion horizon
        </text>
        <text x="264" y="122" fontFamily={T.SANS} fontSize="10" fill="rgba(205,214,236,0.62)">
          {result.iviv
            ? `IVIV confidence ${(result.iviv.confidence * 100).toFixed(0)}% with predicted in vivo expression ${result.iviv.invivo_expression.toFixed(1)} nM`
            : 'IVIV prediction unavailable until fitting converges.'}
        </text>
      </svg>

      <div style={{ position: 'absolute', top: '10px', left: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
          Reactor body = active TX-TL volume
        </span>
        <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
          Yield skyline = construct-level protein output
        </span>
      </div>
      <div style={{ position: 'absolute', top: '10px', right: '12px', width: 'min(260px, calc(100% - 24px))' }}>
        <div style={{ padding: '10px 12px', borderRadius: '14px', border: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.56)', backdropFilter: 'blur(10px)' }}>
          <p style={{ margin: '0 0 6px', color: LABEL, fontSize: '9px', fontFamily: T.MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Evidence trace
          </p>
          <p style={{ margin: '0 0 8px', color: VALUE, fontSize: '10px', lineHeight: 1.55, fontFamily: T.SANS }}>
            Reactor 3D binds the simulated TX-TL state to one scene: depletion timing drives tank fill, gene yield drives tower height, and ATP/GTP/PEP are kept visible as explicit resource assumptions.
          </p>
          <div style={{ display: 'grid', gap: '6px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
              depletion · {result.simulation.energyDepletionTime.toFixed(0)} min
            </span>
            <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
              total yield · {result.simulation.totalProteinYield.toFixed(1)} nM
            </span>
            <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
              energy pool · {(params.initialEnergy.atp + params.initialEnergy.gtp + params.initialEnergy.pep).toFixed(1)} mM
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */

export default function CellFreePage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [constructs, setConstructs] = useState<GeneConstruct[]>(() => generateDefaultConstructs());
  const [params, setParams] = useState<CFSParameters>(() => generateDefaultParameters());
  const recommendedSeed = useMemo(
    () => buildCellFreeSeed(project, analyzeArtifact, catalystPayload, dynconPayload, cethxPayload, dbtlPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, catalystPayload?.updatedAt, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, dynconPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  useEffect(() => {
    setConstructs(recommendedSeed.constructs);
    setParams(recommendedSeed.params);
  }, [recommendedSeed]);

  const { data: result, error: simError } = useMemo(() => {
    try { return { data: runFullCFSPipeline(constructs, params), error: null as string | null }; }
    catch (e) { return { data: runFullCFSPipeline([], generateDefaultParameters()), error: e instanceof Error ? e.message : 'CFS pipeline failed' }; }
  }, [constructs, params]);

  const [viewMode, setViewMode] = useState<ViewMode>('TimeCourse');

  const sim = result.simulation;
  const fit = result.fitting;
  const iviv = result.iviv;
  const invitroMaxProtein = useMemo(
    () => Math.max(...sim.steadyState.map((entry) => entry.maxProtein), 0),
    [sim.steadyState],
  );

  useEffect(() => {
    if (simError) return;
    setToolPayload('cellfree', {
      validity: 'demo',
      toolId: 'cellfree',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      targetConstruct: constructs[1]?.name || constructs[0]?.name || 'Primary construct',
      constructCount: constructs.length,
      temperature: params.temperature,
      simulationTime: params.simulationTime,
      result: {
        totalProteinYield: sim.totalProteinYield,
        energyDepletionTime: sim.energyDepletionTime,
        isResourceLimited: sim.isResourceLimited,
        invitroMaxProtein,
        invivoExpression: iviv?.invivo_expression ?? null,
        confidence: iviv?.confidence ?? null,
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    constructs,
    invitroMaxProtein,
    iviv?.confidence,
    iviv?.invivo_expression,
    params.simulationTime,
    params.temperature,
    project?.targetProduct,
    project?.title,
    setToolPayload,
    sim.energyDepletionTime,
    sim.isResourceLimited,
    sim.totalProteinYield,
    simError,
  ]);

  const exportData = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    sim.genes.forEach(g => {
      g.time.forEach((t, i) => {
        rows.push({ gene: g.geneName, time: t, protein: g.protein[i], mRNA: g.mRNA[i] });
      });
    });
    return rows;
  }, [sim]);
  const figureMeta = useMemo(() => {
    if (viewMode === 'TimeCourse') {
      return {
        eyebrow: 'Expression timecourse',
        title: 'Protein production, resource depletion, and construct quality are read as one figure',
        caption: 'The timecourse lens is treated as a figure plate rather than a simulator canvas, so expression, depletion, and comparative construct quality live inside one evidence surface.',
      };
    }
    if (viewMode === 'Resources') {
      return {
        eyebrow: 'Resource ledger',
        title: 'ATP, ribosome, and amino-acid drawdown define the real viability of the run',
        caption: 'This lens foregrounds resource exhaustion as the governing constraint for whether a construct bundle should be promoted into slower experimental loops.',
      };
    }
    if (viewMode === 'Fitting') {
      return {
        eyebrow: 'Plate fitting',
        title: 'Parameter-fit quality sits inside the same workbench story as simulation output',
        caption: 'Fitting is presented as evidence for how trustworthy the cell-free readout is, not as a detached analytics tab.',
      };
    }
    if (viewMode === 'IvIv') {
      return {
        eyebrow: 'Translation bridge',
        title: 'In-vitro to in-vivo translation confidence becomes a publication-style evidence panel',
        caption: 'The bridge lens keeps predicted in-vivo expression, confidence, and rationale in one place so promotion decisions stay legible and defensible.',
      };
    }
    return {
      eyebrow: 'Reactor twin',
      title: 'The digital twin reframes the run as a spatial bench instrument',
      caption: 'Construct output, energy pools, and reactor geometry are consolidated into a single interpretive stage rather than a decorative 3D tab.',
    };
  }, [viewMode]);

  return (
    <>
      <div className="nb-tool-page" style={{ background: PANEL_BG }}>
        <AlgorithmInsight
          title="Cell-Free Sandbox (CFPS)"
          description="Resource-aware TX-TL ODE simulation → plate-reader Michaelis-Menten fitting → in-vitro-to-in-vivo translation prediction"
          formula="dP/dt = k_tl · [mRNA] · R_free / (K_tl + R_free)"
        />
        <div style={{ padding: '0 16px 10px' }}>
          <WorkbenchInlineContext
            toolId="cellfree"
            title="Cell-Free Prototyping"
            summary="Cell-free prototyping acts as the pre-build gate for catalyst and control decisions, keeping construct count, resource limits, and translation confidence attached to the same project lineage before anything is promoted into DBTL."
            compact
            isSimulated={!analyzeArtifact}
          />
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificHero
            eyebrow="Stage 4 · Pre-Build Validation"
            title="Cell-free prototyping as the last fast gate before DBTL"
            summary="Cell-free should read like a decision bench, not just a simulation output. Yield, depletion timing, in-vitro-to-in-vivo confidence, and construct count are elevated here so the scientist can quickly judge whether a design deserves promotion into slower experimental loops."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current bench setup
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {constructs.length} constructs · {params.temperature}°C · {params.simulationTime} min
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  The reaction window and construct stack shown here are now directly inherited from catalyst, thermodynamic, and DBTL context.
                </div>
              </>
            }
            signals={[
              {
                label: 'Total Yield',
                value: `${sim.totalProteinYield.toFixed(1)} nM`,
                detail: `${invitroMaxProtein.toFixed(1)} nM max single-construct expression in the current run.`,
                tone: sim.totalProteinYield > 100 ? 'cool' : 'warm',
              },
              {
                label: 'Depletion Gate',
                value: `${sim.energyDepletionTime.toFixed(0)} min`,
                detail: sim.isResourceLimited ? 'Resource limitation is the dominant reason this run should be treated cautiously.' : 'Resources hold long enough for this run to act as a meaningful pre-build check.',
                tone: sim.isResourceLimited ? 'alert' : 'cool',
              },
              {
                label: 'IVIV Confidence',
                value: iviv ? `${(iviv.confidence * 100).toFixed(0)}%` : 'Pending',
                detail: iviv ? `${iviv.invivo_expression.toFixed(1)} predicted in vivo expression` : 'Switch to the IvIv lens to estimate translation into cellular expression.',
                tone: iviv && iviv.confidence > 0.65 ? 'cool' : 'neutral',
              },
              {
                label: 'Current Lens',
                value: viewMode,
                detail: 'The active view changes how the same canonical run is interpreted, but not which run is considered current.',
                tone: 'neutral',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificMethodStrip
            label="Cell-free bench"
            items={[
              {
                title: 'Construct register',
                detail: 'The left rail keeps construct identity, promoter, and DNA load visible so each run is read as a bench setup rather than a generic parameter set.',
                accent: PATHD_THEME.apricot,
                note: `${constructs.length} constructs`,
              },
              {
                title: 'Figure lens',
                detail: 'Timecourse, resource, fitting, translation, and reactor-twin views now share one framed figure language instead of behaving like unrelated tabs.',
                accent: PATHD_THEME.sky,
                note: viewMode,
              },
              {
                title: 'Promotion evidence',
                detail: 'Yield, depletion gate, and translation confidence remain exposed on the page so DBTL promotion can be judged without leaving the workbench.',
                accent: PATHD_THEME.mint,
                note: `${sim.totalProteinYield.toFixed(1)} nM total yield`,
              },
            ]}
          />
        </div>

        {simError && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={simError} /></div>
        )}

        <HybridWorkbenchPanels
          leftLabel="Construct Register"
          rightLabel="Simulation Ledger"
          leftPanel={(
            <div className="nb-tool-sidebar" style={{
            width: '240px', flexShrink: 0, padding: '16px',
            borderRight: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            {/* Gene Constructs */}
            <SectionLabel>Gene Constructs</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {constructs.map((g, i) => (
                <div key={g.id} style={{ ...GLASS, borderRadius: '14px', padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: GENE_COLORS[i % GENE_COLORS.length], flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: T.SANS, fontSize: '10px', fontWeight: 600, color: VALUE }}>
                      {g.name.length > 20 ? g.name.slice(0, 20) + '…' : g.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Promoter</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{g.promoter}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>DNA conc.</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{g.dnaConcentration} nM</span>
                  </div>
                </div>
              ))}
            </div>

            {/* View Mode */}
            <SectionLabel>View Mode</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '16px' }}>
              {(['TimeCourse', 'Resources', 'Fitting', 'IvIv', 'Reactor3D'] as ViewMode[]).map(mode => (
                <button aria-label="Action" key={mode} onClick={() => setViewMode(mode)} style={{
                  flex: '1 1 0', padding: '5px 0', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: T.SANS, fontSize: '10px', border: `1px solid ${viewMode === mode ? 'rgba(175,195,214,0.34)' : INPUT_BORDER}`,
                  background: viewMode === mode ? 'rgba(175,195,214,0.22)' : INPUT_BG,
                  color: viewMode === mode ? VALUE : LABEL,
                }}>
                  {mode}
                </button>
              ))}
            </div>

            {/* Reaction Parameters */}
            <SectionLabel>Reaction Parameters</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Ribosome Total', value: `${params.ribosomeTotal} nM` },
                { label: 'RNAP Total', value: `${params.rnap_total} nM` },
                { label: 'Temperature', value: `${params.temperature} °C` },
                { label: 'Volume', value: `${params.reactionVolume} μL` },
                { label: 'Sim Time', value: `${params.simulationTime} min` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>{item.label}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Energy Status */}
            <SectionLabel>Energy Status</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px' }}>
              {[
                { label: 'ATP', value: `${params.initialEnergy.atp} mM` },
                { label: 'GTP', value: `${params.initialEnergy.gtp} mM` },
                { label: 'PEP', value: `${params.initialEnergy.pep} mM` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>{item.label}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{item.value}</span>
                </div>
              ))}
            </div>
            </div>
          )}
          centerPanel={(
            <div className="nb-tool-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: PANEL_BG, minWidth: 0, padding: '12px' }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              legend={[
                { label: 'Lens', value: viewMode, accent: PATHD_THEME.sky },
                { label: 'Constructs', value: `${constructs.length}`, accent: PATHD_THEME.apricot },
                { label: 'Yield', value: `${sim.totalProteinYield.toFixed(1)} nM`, accent: PATHD_THEME.mint },
                { label: 'Depletion', value: `${sim.energyDepletionTime.toFixed(0)} min`, accent: PATHD_THEME.coral },
              ]}
              footer={
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, lineHeight: 1.55 }}>
                    The figure surface is now stable across lenses, so scientists can switch from expression to depletion to IVIV translation without feeling like they left the same experiment.
                  </div>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                    setup {params.temperature}°C · {params.simulationTime} min · {sim.isResourceLimited ? 'resource-limited run' : 'resources adequate for promotion review'}
                  </div>
                </div>
              }
              minHeight="100%"
            >
              {viewMode === 'TimeCourse' && (
                <div style={{ padding: '4px 0', overflowY: 'auto' }}>
                  <TimeCourseChart result={result} constructs={constructs} />
                </div>
              )}
              {viewMode === 'Resources' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                  <div style={{ width: '100%', maxWidth: '600px' }}>
                    <ResourceChart result={result} />
                  </div>
                </div>
              )}
              {viewMode === 'Fitting' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                  <div style={{ width: '100%', maxWidth: '600px' }}>
                    <FittingChart result={result} />
                  </div>
                </div>
              )}
              {viewMode === 'IvIv' && (
                <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', gap: '16px' }}>
                  <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
                    <IvIvChart result={result} />
                  </div>
                  {iviv && (
                    <div style={{ ...GLASS, borderRadius: '16px', padding: '14px 18px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                      <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '0 0 6px' }}>
                        Reasoning
                      </p>
                      <p style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, margin: 0, lineHeight: 1.6 }}>
                        {iviv.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {viewMode === 'Reactor3D' && (
                <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', gap: '10px' }}>
                  <div style={{ maxWidth: '760px', margin: '0 auto', width: '100%' }}>
                    <div style={{ padding: '8px 12px', borderRadius: '14px', border: `1px solid ${BORDER}`, background: PATHD_THEME.panelInset }}>
                      <p style={{ margin: '0 0 3px', color: VALUE, fontSize: '11px', fontFamily: T.SANS }}>
                        Reactor 3D turns the CFPS run into a digital twin: construct yield, energy pool and depletion timing are mapped into one spatial scene.
                      </p>
                      <p style={{ margin: 0, color: LABEL, fontSize: '9px', fontFamily: T.MONO }}>
                        center tank = resource state · rear towers = expression output · right bars = ATP / GTP / PEP allocation
                      </p>
                    </div>
                  </div>
                  <div style={{ minHeight: '420px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>
                    <ReactorTwin3D result={result} constructs={constructs} params={params} />
                  </div>
                </div>
              )}
            </ScientificFigureFrame>
            </div>
          )}
          rightPanel={(
            <div className="nb-tool-right" style={{
            width: '260px', flexShrink: 0, padding: '16px',
            borderLeft: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            {/* Simulation Summary */}
            <SectionLabel>Simulation Summary</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="Total Yield" value={sim.totalProteinYield.toFixed(1)} unit="nM" highlight />
              <MetricCard label="Depletion" value={sim.energyDepletionTime.toFixed(0)} unit="min" />
              <MetricCard
                label="Resource Ltd"
                value={sim.isResourceLimited ? 'Yes' : 'No'}
                warning={sim.isResourceLimited ? 'Ribosomes saturated' : undefined}
              />
            </div>

            {/* Per-Gene Stats */}
            <SectionLabel>Per-Gene Stats</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {sim.steadyState.map((ss, i) => {
                const gene = constructs.find(c => c.id === ss.geneId);
                const color = GENE_COLORS[i % GENE_COLORS.length];
                return (
                  <div key={ss.geneId} style={{ ...GLASS, borderRadius: '10px', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: color, flexShrink: 0,
                      }} />
                      <span style={{ fontFamily: T.SANS, fontSize: '10px', fontWeight: 600, color: VALUE }}>
                        {gene ? (gene.name.length > 18 ? gene.name.slice(0, 18) + '…' : gene.name) : ss.geneId}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Peak Protein</span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{ss.maxProtein.toFixed(1)} nM</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Time to Half</span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{ss.timeToHalf.toFixed(0)} min</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Yield/DNA</span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{ss.yieldPerDNA.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fitting Results */}
            {fit && (
              <>
                <SectionLabel>Fitting Results</SectionLabel>
                <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Vmax</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{fit.vmax.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Kd</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{fit.kd.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>R²</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: 'rgba(147,203,82,0.9)' }}>
                      {fit.r_squared.toFixed(4)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Vmax CI</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL }}>
                      [{fit.vmax_ci[0].toFixed(2)}, {fit.vmax_ci[1].toFixed(2)}]
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Kd CI</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL }}>
                      [{fit.kd_ci[0].toFixed(2)}, {fit.kd_ci[1].toFixed(2)}]
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* IvIv Prediction */}
            {iviv && (
              <>
                <SectionLabel>IvIv Prediction</SectionLabel>
                <div style={{ ...GLASS, borderRadius: '14px', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>In-vivo Expr</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>
                      {iviv.invivo_expression.toFixed(1)} nM
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Scaling Factor</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>
                      {iviv.scalingFactor.toFixed(3)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Fold Change</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>
                      {iviv.invivo_foldChange.toFixed(2)}×
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Confidence</span>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '9px',
                      color: iviv.confidence > 0.7 ? 'rgba(147,203,82,0.9)' : iviv.confidence > 0.4 ? 'rgba(255,139,31,0.85)' : 'rgba(255,100,80,0.85)',
                    }}>
                      {(iviv.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </>
            )}
            </div>
          )}
        />

        {/* ── Bottom Export Bar ──────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${BORDER}`, padding: '8px 16px',
          display: 'flex', gap: '8px', flexShrink: 0, background: PANEL_BG,
        }}>
          <ExportButton label="Export Simulation JSON" data={result} filename="cellfree-simulation" format="json" />
          <ExportButton label="Export Time Series CSV" data={exportData} filename="cellfree-timeseries" format="csv" />
        </div>
      </div>
    </>
  );
}
