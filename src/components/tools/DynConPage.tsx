'use client';
import { useMemo, useRef, useEffect } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import DemoBanner from '../ide/shared/DemoBanner';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import ScientificHero from './shared/ScientificHero';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { usePersistedState } from '../ide/shared/usePersistedState';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';
import {
  runBioreactor,
  DEFAULT_CONTROLLER,
  DEFAULT_PARAMS,
  DEFAULT_HILL,
  analyzeConvergence,
  analyzeMetabolicBurden,
  mapControlGainToRBS,
  hillFeedback,
} from '../../data/mockDynCon';
import type { ODEState, HillParams } from '../../types';
import { buildDynConSeed } from './shared/workbenchDataflow';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';

/* ── Design Tokens ─────────────────────────────────────────────────────────── */
const PANEL_BG = PATHD_THEME.sepiaPanelMuted;
const BORDER = PATHD_THEME.sepiaPanelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  background: PATHD_THEME.panelSurface,
  border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
};

/* ── Series definitions (6 state variables) ────────────────────────────────── */
const SERIES = [
  { key: 'biomass',       label: 'Biomass',   color: 'rgba(207,196,227,0.82)', unit: 'g/L' },
  { key: 'substrate',     label: 'Substrate', color: 'rgba(231,199,169,0.88)', unit: 'g/L' },
  { key: 'product',       label: 'Product',   color: 'rgba(191,220,205,0.88)', unit: 'g/L' },
  { key: 'dissolvedO2',   label: 'DO₂',       color: 'rgba(175,195,214,0.88)', unit: 'sat.' },
  { key: 'fpp',           label: 'FPP',       color: 'rgba(232,163,161,0.9)',  unit: 'μM' },
  { key: 'adsExpression', label: 'ADS Expr',  color: 'rgba(207,196,227,0.92)', unit: 'a.u.' },
] as const;

/* ── Catmull-Rom → SVG path helper ─────────────────────────────────────────── */
function crPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M ${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
    const cp1x = x1 + (x2 - x0) / 6, cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6, cp2y = y2 - (y3 - y1) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

/* ── Time-Series SVG (6 series) ────────────────────────────────────────────── */
function TimeSeriesSVG({ trajectory, setpoint, svgRef }: { trajectory: ODEState[]; setpoint: number; svgRef?: React.RefObject<SVGSVGElement | null> }) {
  if (trajectory.length < 2) return null;
  const W = 620;
  const H = 470;
  const PAD_X = 54;
  const laneH = 52;
  const laneGap = 16;
  const plotTop = 42;
  const lanes = [
    { key: 'product',       label: 'Product',   color: 'rgba(191,220,205,0.92)', max: Math.max(0.001, ...trajectory.map((point) => point.product)),       unit: 'g/L'  },
    { key: 'biomass',       label: 'Biomass',   color: 'rgba(207,196,227,0.92)', max: Math.max(0.001, ...trajectory.map((point) => point.biomass)),        unit: 'g/L'  },
    { key: 'substrate',     label: 'Substrate', color: 'rgba(231,199,169,0.92)', max: Math.max(0.001, ...trajectory.map((point) => point.substrate)),      unit: 'g/L'  },
    { key: 'dissolvedO2',   label: 'DO₂',       color: 'rgba(175,195,214,0.9)',  max: 1,                                                                    unit: 'sat.' },
    { key: 'fpp',           label: 'FPP',       color: 'rgba(232,163,161,0.94)', max: Math.max(0.001, ...trajectory.map((point) => point.fpp)),             unit: 'μM'   },
    { key: 'adsExpression', label: 'ADS',       color: 'rgba(207,196,227,0.92)', max: Math.max(0.001, ...trajectory.map((point) => point.adsExpression)),   unit: 'a.u.' },
  ] as const;

  const tMax = trajectory[trajectory.length - 1].time;
  const plotWidth = W - PAD_X - 28;
  // Phase portrait inset dimensions
  const PP_X = W - 118, PP_Y = plotTop + 2, PP_W = 104, PP_H = 80;

  function laneY(index: number) { return plotTop + index * (laneH + laneGap); }
  function normalize(value: number, max: number) { return max > 0 ? value / max : 0; }
  function toXY(pt: ODEState, laneIndex: number, key: keyof ODEState, max: number): [number, number] {
    const raw = pt[key];
    const value = typeof raw === 'number' ? raw : 0;
    return [PAD_X + (pt.time / tMax) * plotWidth, laneY(laneIndex) + laneH - normalize(value, max) * laneH];
  }

  // Phase portrait: product vs fpp
  const productMax = lanes[0].max, fppMax = lanes[4].max;
  const ppPts: [number, number][] = trajectory.map(pt => [
    PP_X + (normalize(pt.product, productMax)) * PP_W,
    PP_Y + PP_H - (normalize(pt.fpp, fppMax)) * PP_H,
  ]);
  const ppPath = crPath(ppPts);

  return (
    <svg ref={svgRef} role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H + 36}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H + 36} fill="#050505" rx="18" />
      <text x="22" y="22" fontFamily={T.MONO} fontSize="10" fill="rgba(255,255,255,0.24)">
        Closed-loop trajectory
      </text>
      <text x="22" y="36" fontFamily={T.SANS} fontSize="12" fill="rgba(255,255,255,0.72)">
        Shared timeline for product, host state, oxygen control, precursor load, and expression
      </text>

      {lanes.map((lane, index) => {
        const y = laneY(index);
        const coords: [number, number][] = trajectory.map(pt => toXY(pt, index, lane.key, lane.max));
        const lastValue = trajectory[trajectory.length - 1][lane.key] as number;
        const markerX = PAD_X + plotWidth;
        const markerY = y + laneH - normalize(lastValue, lane.max) * laneH;
        const setpointY = lane.key === 'dissolvedO2'
          ? y + laneH - normalize(setpoint, lane.max) * laneH : null;
        const toxicityY = lane.key === 'fpp'
          ? y + laneH - normalize(DEFAULT_PARAMS.fppToxicThreshold, lane.max) * laneH : null;

        // Confidence band: ±5% of laneH
        const sigma = laneH * 0.05;
        const bandPath = coords.length > 1
          ? crPath(coords.map(([x, cy]) => [x, cy - sigma] as [number, number]))
            + ' '
            + crPath([...coords].reverse().map(([x, cy]) => [x, cy + sigma] as [number, number])).replace('M', 'L')
            + ' Z'
          : '';
        const smoothPath = crPath(coords);
        // Extract base color for band fill
        const bandColor = lane.color.startsWith('rgba')
          ? lane.color.replace(/[\d.]+\)$/, '0.10)')
          : lane.color + '1a';

        return (
          <g key={lane.key}>
            <rect x={PAD_X} y={y} width={plotWidth} height={laneH} rx="12" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" />
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line key={fraction} x1={PAD_X} y1={y + laneH - fraction * laneH}
                x2={PAD_X + plotWidth} y2={y + laneH - fraction * laneH}
                stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            ))}
            {setpointY !== null && (
              <>
                <rect x={PAD_X} y={setpointY - 6} width={plotWidth} height={12} fill="rgba(95,168,255,0.06)" />
                <line x1={PAD_X} y1={setpointY} x2={PAD_X + plotWidth} y2={setpointY} stroke="rgba(95,168,255,0.4)" strokeDasharray="4 4" />
              </>
            )}
            {toxicityY !== null && (
              <line x1={PAD_X} y1={toxicityY} x2={PAD_X + plotWidth} y2={toxicityY} stroke="rgba(255,49,49,0.35)" strokeDasharray="5 4" />
            )}
            {/* Confidence band */}
            {bandPath && <path d={bandPath} fill={bandColor} stroke="none" />}
            {/* Smooth Catmull-Rom curve */}
            <path d={smoothPath} fill="none" stroke={lane.color} strokeWidth="2" />
            <circle cx={markerX} cy={markerY} r="4" fill={lane.color} />
            <text x="20" y={y + 14} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.24)">{lane.label}</text>
            <text x="20" y={y + 28} fontFamily={T.SANS} fontSize="10" fill="rgba(255,255,255,0.62)">
              {(lastValue ?? 0).toFixed(lane.key === 'fpp' ? 1 : 2)} {lane.unit}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + 14} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
              {lane.max.toFixed(lane.key === 'fpp' ? 0 : 1)}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + laneH} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.16)">0</text>
          </g>
        );
      })}

      {[0, 25, 50, 75, 100].map((tick) => {
        const x = PAD_X + (tick / 100) * plotWidth;
        return (
          <g key={tick}>
            <line x1={x} y1={plotTop + lanes.length * (laneH + laneGap) - laneGap}
              x2={x} y2={plotTop + lanes.length * (laneH + laneGap) - laneGap + 6}
              stroke="rgba(255,255,255,0.08)" />
            <text x={x} y={plotTop + lanes.length * (laneH + laneGap) - laneGap + 18}
              textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.22)">
              {tick}h
            </text>
          </g>
        );
      })}

      {/* Phase portrait inset (P vs FPP) */}
      <rect x={PP_X - 4} y={PP_Y - 12} width={PP_W + 8} height={PP_H + 22} rx="8"
        fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.08)" />
      <text x={PP_X + PP_W / 2} y={PP_Y - 4} textAnchor="middle" fontFamily={T.MONO} fontSize="6" fill="rgba(255,255,255,0.3)">
        PHASE PORTRAIT
      </text>
      <line x1={PP_X} y1={PP_Y} x2={PP_X} y2={PP_Y + PP_H} stroke="rgba(255,255,255,0.1)" />
      <line x1={PP_X} y1={PP_Y + PP_H} x2={PP_X + PP_W} y2={PP_Y + PP_H} stroke="rgba(255,255,255,0.1)" />
      <text x={PP_X - 2} y={PP_Y + PP_H + 8} textAnchor="middle" fontFamily={T.MONO} fontSize="5" fill="rgba(255,255,255,0.25)">P</text>
      <text x={PP_X + PP_W} y={PP_Y + PP_H + 8} textAnchor="end" fontFamily={T.MONO} fontSize="5" fill="rgba(255,255,255,0.25)">→</text>
      <text x={PP_X - 2} y={PP_Y} fontFamily={T.MONO} fontSize="5" fill="rgba(255,255,255,0.25)">R↑</text>
      {ppPath && <path d={ppPath} fill="none" stroke="rgba(232,163,161,0.7)" strokeWidth="1.2" />}
      {ppPts.length > 0 && (
        <circle cx={ppPts[ppPts.length - 1][0]} cy={ppPts[ppPts.length - 1][1]} r="2.5" fill={PATHD_THEME.coral} />
      )}
    </svg>
  );
}

/* ── Hill Feedback Curve (mini SVG) ────────────────────────────────────────── */
function HillCurveSVG({ hill, currentFPP }: { hill: HillParams; currentFPP: number }) {
  const W = 520, H = 120, PAD = 44;
  const fppMax = 200;
  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const fpp = (i / 100) * fppMax;
    const expr = hillFeedback(fpp, hill);
    const x = PAD + (fpp / fppMax) * (W - PAD * 2);
    const y = H - PAD + 4 - (expr / hill.Vmax) * (H - PAD * 2 + 4);
    pts.push(`${x},${y}`);
  }
  const markerX = PAD + (Math.min(currentFPP, fppMax) / fppMax) * (W - PAD * 2);

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H + 10}`} style={{ width: '100%', height: '132px' }}>
      <rect width={W} height={H + 10} fill="#050505" rx="18" />
      {/* axes */}
      <line x1={PAD} y1={H - PAD + 4} x2={W - PAD} y2={H - PAD + 4} stroke="rgba(255,255,255,0.08)" />
      <line x1={PAD} y1={PAD - 8} x2={PAD} y2={H - PAD + 4} stroke="rgba(255,255,255,0.08)" />
      {/* curve */}
      <rect x={PAD} y={PAD - 8} width={W - PAD * 2} height={H - PAD * 2 + 12} fill="rgba(255,255,255,0.02)" rx="14" />
      <polyline points={pts.join(' ')} fill="none" stroke={PATHD_THEME.mint} strokeWidth={2.2} />
      {/* current FPP marker */}
      <line x1={markerX} y1={PAD - 8} x2={markerX} y2={H - PAD + 4}
        stroke="rgba(232,163,161,0.5)" strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={markerX} cy={H - PAD + 4 - (hillFeedback(Math.min(currentFPP, fppMax), hill) / hill.Vmax) * (H - PAD * 2 + 4)}
        r={3} fill={PATHD_THEME.coral} />
      {/* labels */}
      <text x="20" y="18" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.24)">
        Repression response
      </text>
      <text x="20" y="32" fontFamily={T.SANS} fontSize="11" fill="rgba(255,255,255,0.5)">
        Operating point of the current precursor pool on the Hill feedback curve
      </text>
      <text x={W / 2} y={H + 6} fontFamily={T.MONO} fontSize="8" textAnchor="middle" fill={LABEL}>FPP (μM)</text>
      <text x={10} y={(PAD + H - PAD) / 2} fontFamily={T.MONO} fontSize="8" textAnchor="middle" fill={LABEL}
        transform={`rotate(-90, 10, ${(PAD + H - PAD) / 2})`}>ADS</text>
      <text x={W - PAD} y={H + 6} fontFamily={T.MONO} fontSize="7" textAnchor="end" fill="rgba(255,255,255,0.15)">200</text>
      <text x={PAD} y={H + 6} fontFamily={T.MONO} fontSize="7" textAnchor="start" fill="rgba(255,255,255,0.15)">0</text>
    </svg>
  );
}

/* ── Param Slider — PATHD gradient + useTransition for smooth dragging ── */
function ParamSlider({ label, value, min, max, step = 0.1, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <WorkbenchRangeSlider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={onChange}
      formatValue={(nextValue) => nextValue.toFixed(2)}
    />
  );
}

/* ── Section Header ────────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '16px 0 8px' }}>
      {children}
    </p>
  );
}

/* ── Stat Row (for convergence / burden readouts) ──────────────────────────── */
function StatRow({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL }}>{label}</span>
      <span style={{ fontFamily: T.MONO, fontSize: '12px', fontWeight: 600, color: VALUE, textAlign: 'right' }}>
        {typeof value === 'number' ? value.toFixed(3) : value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function DynConPage() {
  const chartRef = useRef<SVGSVGElement>(null);
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  /* ── PID state (persisted) ─────────────────────────────────────────────── */
  const [kp, setKp] = usePersistedState('nexus-bio:dyncon:kp', DEFAULT_CONTROLLER.kp);
  const [ki, setKi] = usePersistedState('nexus-bio:dyncon:ki', DEFAULT_CONTROLLER.ki);
  const [kd, setKd] = usePersistedState('nexus-bio:dyncon:kd', DEFAULT_CONTROLLER.kd);
  const [setpoint, setSetpoint] = usePersistedState('nexus-bio:dyncon:setpoint', DEFAULT_CONTROLLER.setpoint);

  /* ── Hill state (persisted) ────────────────────────────────────────────── */
  const [vmax, setVmax] = usePersistedState('nexus-bio:dyncon:vmax', DEFAULT_HILL.Vmax);
  const [hillKd, setHillKd] = usePersistedState('nexus-bio:dyncon:hillKd', DEFAULT_HILL.Kd);
  const [hillN, setHillN] = usePersistedState('nexus-bio:dyncon:hillN', DEFAULT_HILL.n);
  const recommendedSeed = useMemo(
    () => buildDynConSeed(fbaPayload, cethxPayload, catalystPayload, dbtlPayload),
    [catalystPayload?.updatedAt, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, fbaPayload?.updatedAt],
  );

  useEffect(() => {
    setKp(recommendedSeed.controller.kp);
    setKi(recommendedSeed.controller.ki);
    setKd(recommendedSeed.controller.kd);
    setSetpoint(recommendedSeed.controller.setpoint);
    setVmax(recommendedSeed.hill.vmax);
    setHillKd(recommendedSeed.hill.kd);
    setHillN(recommendedSeed.hill.n);
  }, [
    recommendedSeed.controller.kd,
    recommendedSeed.controller.ki,
    recommendedSeed.controller.kp,
    recommendedSeed.controller.setpoint,
    recommendedSeed.hill.kd,
    recommendedSeed.hill.n,
    recommendedSeed.hill.vmax,
    setHillKd,
    setHillN,
    setKd,
    setKi,
    setKp,
    setSetpoint,
    setVmax,
  ]);

  const hill: HillParams = useMemo(() => ({ Vmax: vmax, Kd: hillKd, n: hillN }), [vmax, hillKd, hillN]);

  /* ── Simulation ─────────────────────────────────────────────────────────── */
  const { trajectory, simError } = useMemo(() => {
    try {
      const t = runBioreactor({ kp, ki, kd, setpoint }, DEFAULT_PARAMS, 100, 1.0, hill);
      return { trajectory: t, simError: null as string | null };
    } catch (e) {
      return { trajectory: [] as ODEState[], simError: e instanceof Error ? e.message : 'Simulation failed' };
    }
  }, [kp, ki, kd, setpoint, hill]);

  const last = trajectory[trajectory.length - 1];
  const productTiter = last?.product ?? 0;
  const productivity = last ? productTiter / last.time : 0;

  const doRmse = useMemo(() => {
    const errors = trajectory.map(t => (t.dissolvedO2 - setpoint) ** 2);
    return Math.sqrt(errors.reduce((a, b) => a + b, 0) / errors.length);
  }, [trajectory, setpoint]);

  /* ── Derived analytics ──────────────────────────────────────────────────── */
  const convergence = useMemo(() => analyzeConvergence(trajectory, setpoint), [trajectory, setpoint]);
  const burden = useMemo(() => analyzeMetabolicBurden(trajectory), [trajectory]);
  const rbsMapping = useMemo(() => mapControlGainToRBS(kp, ki, kd), [kp, ki, kd]);

  const currentFPP = last?.fpp ?? 0;
  const currentADS = last?.adsExpression ?? 0;
  const figureMeta = useMemo(() => ({
    eyebrow: 'Controller figure',
    title: 'Closed-loop bioreactor dynamics, Hill repression, and genetic-part mapping are read as one control figure',
    caption: 'The page now treats trajectory, repression curve, burden response, and implementation bridge as one scientific control object instead of a collection of simulator widgets.',
  }), []);

  /* ── Console logging ─────────────────────────────────────────────────── */
  const appendConsole = useUIStore((s) => s.appendConsole);
  useEffect(() => {
    if (simError) {
      appendConsole({ level: 'error', module: 'DYNCON', message: `Simulation error: ${simError}` });
    } else if (trajectory.length > 0) {
      appendConsole({
        level: 'info',
        module: 'DYNCON',
        message: `ODE sim complete — Kp=${kp} Ki=${ki} Kd=${kd} SP=${setpoint} | Product=${productTiter.toFixed(2)} g/L | RMSE=${doRmse.toFixed(3)} | ${convergence.isStable ? 'Stable' : 'Unstable'}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajectory, simError]);

  /* ── Read FBA snapshot from canonical workbench state ────────────────── */
  const fba = fbaPayload;

  useEffect(() => {
    if (last && !simError) {
      const now = Date.now();
      setToolPayload('dyncon', {
        toolId: 'dyncon',
        targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
        sourceArtifactId: analyzeArtifact?.id,
        controller: { kp, ki, kd, setpoint },
        hill: { vmax, kd: hillKd, n: hillN },
        result: {
          productTiter,
          productivity,
          doRmse,
          stable: convergence.isStable,
          burdenIndex: burden.burdenIndex,
          currentFPP,
          adsExpression: currentADS,
          rbsPart: rbsMapping.rbsName,
        },
        updatedAt: now,
      });
    }
  }, [analyzeArtifact?.id, analyzeArtifact?.targetProduct, burden.burdenIndex, convergence.isStable, currentADS, currentFPP, doRmse, hillKd, hillN, kd, ki, kp, last, productTiter, productivity, project?.targetProduct, project?.title, rbsMapping.rbsName, setToolPayload, setpoint, simError, vmax]);

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <div className="nb-tool-page" style={{ background: PANEL_BG }}>
        <AlgorithmInsight
          title="Dynamic Control Simulator"
          description="Fed-batch bioreactor with PID-controlled DO₂ and Hill-function negative feedback on ADS expression. RK4 integration."
          formula="f(FPP) = Vmax·Kd^n / (Kd^n + FPP^n)"
        />
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <WorkbenchInlineContext
            toolId="dyncon"
            title="Dynamic Control"
            summary="Dynamic control inherits bottlenecks, thermodynamic stress, catalyst burden, and DBTL feedback so controller tuning reflects the latest pathway reality instead of freezing around an old operating point."
            compact
            isSimulated={!analyzeArtifact}
          />
          {fba && (
            <div role="status" style={{ padding: '6px 14px', background: 'rgba(175,195,214,0.14)', border: '1px solid rgba(175,195,214,0.28)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontFamily: T.MONO, fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(175,195,214,0.22)', border: '1px solid rgba(175,195,214,0.34)', color: VALUE, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                FBASim
              </span>
              <span style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL }}>
                {'✓ Flux data loaded — '}
                <span style={{ fontFamily: T.MONO, color: VALUE }}>
                  {`μ=${fba.result.growthRate.toFixed(4)} h⁻¹ · ∂μ/∂Glc=${fba.result.shadowPrices.glc.toFixed(4)} · ∂μ/∂O₂=${fba.result.shadowPrices.o2.toFixed(4)}`}
                </span>
              </span>
            </div>
          )}
          <ScientificHero
            eyebrow="Stage 3 · Chassis Control"
            title="Controller behavior is tied to the current metabolic burden"
            summary="DYNCON turns pathway risk into operating policy. PID tuning, Hill repression, and genetic-part mapping are treated as one control package so the page behaves like a scientific control surface for a living system, not a disconnected slider set."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Control bridge
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {rbsMapping.rbsName} · gain {rbsMapping.controlGain.toFixed(2)}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  Controller gains are translated into a concrete RBS choice, so the workbench keeps one foot in executable biology.
                </div>
              </>
            }
            signals={[
              {
                label: 'Product Titer',
                value: `${productTiter.toFixed(2)} g/L`,
                detail: `${productivity.toFixed(2)} g/L/h productivity under the current controller settings.`,
                tone: productTiter > 10 ? 'cool' : 'warm',
              },
              {
                label: 'Control Stability',
                value: convergence.isStable ? 'Stable' : 'Unstable',
                detail: `DO₂ RMSE ${doRmse.toFixed(3)} against setpoint ${setpoint.toFixed(2)}`,
                tone: convergence.isStable ? 'cool' : 'alert',
              },
              {
                label: 'Burden Index',
                value: burden.burdenIndex.toFixed(2),
                detail: `Current FPP ${currentFPP.toFixed(2)} μM · ADS expression ${currentADS.toFixed(2)}`,
                tone: burden.burdenIndex < 0.45 ? 'cool' : 'warm',
              },
              {
                label: 'Repression Curve',
                value: `Vmax ${vmax.toFixed(2)} · n ${hillN.toFixed(1)}`,
                detail: `Hill Kd ${hillKd.toFixed(1)} μM defines how quickly repression engages as pathway pressure rises.`,
                tone: 'neutral',
              },
            ]}
          />
          <ScientificMethodStrip
            label="Control bench"
            items={[
              {
                title: 'Policy tuning',
                detail: 'PID gains, setpoint, and Hill repression parameters are treated as one operating policy rather than separate slider families.',
                accent: PATHD_THEME.apricot,
                note: `Kp ${kp.toFixed(2)} · Ki ${ki.toFixed(2)} · Kd ${kd.toFixed(2)}`,
              },
              {
                title: 'Dynamic figure',
                detail: 'The main panel combines the closed-loop trajectory and repression curve so system behavior reads as a scientific control figure.',
                accent: PATHD_THEME.sky,
                note: convergence.isStable ? 'stable regime' : 'unstable regime',
              },
              {
                title: 'Implementation bridge',
                detail: 'Controller gain is translated into an RBS part and burden readout so simulation choices stay grounded in executable biology.',
                accent: PATHD_THEME.mint,
                note: rbsMapping.rbsName,
              },
            ]}
          />
          <DemoBanner context="Artemisinin biosynthesis PID control (Ro et al. 2006)" />
        </div>

        {simError ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <SimErrorBanner message={simError} />
          </div>
        ) : (
        <>
        <div className="nb-tool-panels" style={{ flex: 1 }}>
          {/* ═══════ LEFT PANEL (260px) ═══════ */}
          <div className="nb-tool-sidebar" style={{ width: '260px', borderRight: `1px solid ${BORDER}`, background: PANEL_BG }}>
            {/* — PID Controller — */}
            <SectionLabel>PID Controller</SectionLabel>
            <ParamSlider label="Kp (Proportional)" value={kp} min={0} max={10} step={0.1} onChange={setKp} />
            <ParamSlider label="Ki (Integral)" value={ki} min={0} max={5} step={0.05} onChange={setKi} />
            <ParamSlider label="Kd (Derivative)" value={kd} min={0} max={2} step={0.02} onChange={setKd} />
            <ParamSlider label="DO₂ Setpoint" value={setpoint} min={0.1} max={1.0} step={0.05} onChange={setSetpoint} unit="sat." />

            {/* — Hill Feedback — */}
            <SectionLabel>Hill Feedback</SectionLabel>
            <ParamSlider label="Vmax" value={vmax} min={0.1} max={2.0} step={0.05} onChange={setVmax} />
            <ParamSlider label="Kd (dissociation)" value={hillKd} min={5} max={200} step={5} onChange={setHillKd} unit="μM" />
            <ParamSlider label="n (cooperativity)" value={hillN} min={1} max={4} step={0.5} onChange={setHillN} />

            {/* — RBS Mapping — */}
            <SectionLabel>Codon Optimization Bridge</SectionLabel>
            <div style={{ ...GLASS, padding: '12px', marginBottom: '12px' }}>
              <StatRow label="Combined Gain" value={rbsMapping.controlGain} />
              <StatRow label="RBS Part" value={rbsMapping.rbsName} />
              <StatRow label="Registry ID" value={rbsMapping.registryId} />
              {/* RBS Strength bar */}
              <div style={{ margin: '8px 0 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL }}>RBS Strength</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{rbsMapping.rbsStrength.toFixed(2)}</span>
                </div>
                <div style={{ height: `${PATHD_THEME.progressHeight}px`, borderRadius: `${PATHD_THEME.progressRadius}px`, background: PATHD_THEME.progressTrack, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${rbsMapping.rbsStrength * 100}%`, borderRadius: `${PATHD_THEME.progressRadius}px`, background: PATHD_THEME.progressGradient, boxShadow: PATHD_THEME.progressGlow, transition: 'width 0.3s ease' }} />
                </div>
              </div>
              {/* DNA Sequence */}
              <p style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.sky, wordBreak: 'break-all', lineHeight: 1.5, margin: '8px 0 0', opacity: 0.85 }}>
                {rbsMapping.sequence}
              </p>
            </div>

            {/* — Bioreactor Parameters — */}
            <SectionLabel>Bioreactor Parameters</SectionLabel>
            {([
              ['μmax', `${DEFAULT_PARAMS.muMax} h⁻¹`],
              ['Ks', `${DEFAULT_PARAMS.Ks} g/L`],
              ['Yxs', `${DEFAULT_PARAMS.Yxs} g/g`],
              ['kLa', `${DEFAULT_PARAMS.kLa} h⁻¹`],
              ['Feed conc', `${DEFAULT_PARAMS.feedConc} g/L`],
              ['FPP toxic', `${DEFAULT_PARAMS.fppToxicThreshold} μM`],
            ] as const).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>{k}</span>
                <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{v}</span>
              </div>
            ))}
          </div>

          {/* ═══════ CENTER (flex) ═══════ */}
          <div className="nb-tool-center" style={{ flex: 1, background: PANEL_BG, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '12px' }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              legend={[
                { label: 'Setpoint', value: `${setpoint.toFixed(2)} sat.`, accent: PATHD_THEME.sky },
                { label: 'Stability', value: convergence.isStable ? 'Stable' : 'Unstable', accent: convergence.isStable ? PATHD_THEME.mint : PATHD_THEME.coral },
                { label: 'Titer', value: `${productTiter.toFixed(2)} g/L`, accent: PATHD_THEME.mint },
                { label: 'RBS', value: rbsMapping.rbsName, accent: PATHD_THEME.lilac },
              ]}
              footer={
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, lineHeight: 1.55 }}>
                    The central figure now lets controller behavior, repression logic, and implementation mapping be read as one scientific control story instead of a simulator trace plus a detached helper chart.
                  </div>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                    burden {burden.burdenIndex.toFixed(3)} · DO₂ RMSE {doRmse.toFixed(3)} · FPP {currentFPP.toFixed(2)} μM
                  </div>
                </div>
              }
              minHeight="100%"
            >
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TimeSeriesSVG trajectory={trajectory} setpoint={setpoint} svgRef={chartRef} />
                </div>
                <div>
                  <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: LABEL, margin: '4px 0 2px 4px' }}>
                    Hill Feedback Curve — f(FPP)
                  </p>
                  <HillCurveSVG hill={hill} currentFPP={currentFPP} />
                </div>
              </div>
            </ScientificFigureFrame>
          </div>

          {/* ═══════ RIGHT PANEL (280px) ═══════ */}
          <div className="nb-tool-right" style={{ width: '280px', borderLeft: `1px solid ${BORDER}`, background: PANEL_BG }}>
            {/* — Process Readouts — */}
            <SectionLabel>Process Readouts</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="Final Product Titer" value={productTiter} unit="g/L" highlight />
              <MetricCard label="Productivity" value={productivity} unit="g/L/h" />
              <MetricCard label="Final Biomass" value={last?.biomass ?? 0} unit="g/L" />
              <MetricCard label="DO₂ RMSE" value={doRmse} unit="sat."
                warning={doRmse > 0.1 ? 'Poor control — adjust Kp/Ki' : undefined} />
              <MetricCard label="Residual Substrate" value={last?.substrate ?? 0} unit="g/L" />
              <MetricCard label="FPP Level" value={currentFPP} unit="μM"
                warning={currentFPP > DEFAULT_PARAMS.fppToxicThreshold ? 'Above toxic threshold' : undefined} />
              <MetricCard label="ADS Expression" value={currentADS} unit="a.u." />
            </div>

            {/* — Convergence Analysis — */}
            <SectionLabel>Convergence Analysis</SectionLabel>
            <div style={{ ...GLASS, padding: '14px', marginBottom: '16px' }}>
              <StatRow label="Settling Time" value={convergence.settlingTime} unit="h" />
              <StatRow label="Overshoot" value={convergence.overshoot} unit="%" />
              <StatRow label="Convergence Rate" value={convergence.convergenceRate} unit="h⁻¹" />
              <StatRow label="Steady-State Error" value={convergence.steadyStateError} />
              <StatRow label="Oscillation Count" value={convergence.oscillationCount} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: convergence.isStable ? PATHD_THEME.mint : PATHD_THEME.coral,
                  boxShadow: convergence.isStable ? '0 0 6px rgba(191,220,205,0.4)' : '0 0 6px rgba(232,163,161,0.4)',
                }} />
                <span style={{ fontFamily: T.SANS, fontSize: '11px', color: convergence.isStable ? VALUE : PATHD_THEME.coral }}>
                  {convergence.isStable ? 'Stable' : 'Unstable'}
                </span>
              </div>
            </div>

            {/* — Metabolic Burden — */}
            <SectionLabel>Metabolic Burden</SectionLabel>
            <div style={{ ...GLASS, padding: '14px', marginBottom: '16px' }}>
              {/* Burden index bar */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL }}>Burden Index</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '12px', fontWeight: 600, color: VALUE }}>{burden.burdenIndex.toFixed(3)}</span>
                </div>
                <div style={{ height: `${PATHD_THEME.progressHeight + 2}px`, borderRadius: `${PATHD_THEME.progressRadius}px`, background: PATHD_THEME.progressTrack, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: `${PATHD_THEME.progressRadius}px`, transition: 'width 0.3s ease',
                    width: `${Math.min(1, burden.burdenIndex) * 100}%`,
                    background: burden.burdenIndex < 0.3
                      ? PATHD_THEME.mint
                      : burden.burdenIndex < 0.6
                        ? PATHD_THEME.progressGradient
                        : PATHD_THEME.coral,
                    boxShadow: burden.burdenIndex < 0.3
                      ? '0 0 6px rgba(191,220,205,0.3)'
                      : burden.burdenIndex < 0.6
                        ? PATHD_THEME.progressGlow
                        : '0 0 6px rgba(232,163,161,0.3)',
                  }} />
                </div>
              </div>
              <StatRow label="Protein Cost" value={burden.proteinCost} />
              <StatRow label="ATP Drain" value={burden.atpDrain} unit="mmol/gDW/h" />
              <StatRow label="Growth Penalty" value={burden.growthPenalty} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: burden.isViable ? PATHD_THEME.mint : PATHD_THEME.coral,
                  boxShadow: burden.isViable ? '0 0 6px rgba(191,220,205,0.4)' : '0 0 6px rgba(232,163,161,0.4)',
                }} />
                <span style={{ fontFamily: T.SANS, fontSize: '11px', color: burden.isViable ? VALUE : PATHD_THEME.coral }}>
                  {burden.isViable ? 'Viable' : 'Non-viable'}
                </span>
              </div>
              <p style={{ fontFamily: T.SANS, fontSize: '10px', fontStyle: 'italic', color: LABEL, lineHeight: 1.45, margin: '8px 0 0' }}>
                {burden.recommendation}
              </p>
            </div>

            {/* — Internal Feedback State — */}
            <SectionLabel>Internal Feedback</SectionLabel>
            <div style={{ ...GLASS, padding: '14px' }}>
              <StatRow label="Hill f(FPP)" value={hillFeedback(currentFPP, hill)} unit="a.u." />
              <StatRow label="Current FPP" value={currentFPP} unit="μM" />
              <StatRow label="Current ADS" value={currentADS} unit="a.u." />
              <StatRow label="Toxicity" value={last?.toxicity ?? 0} />
            </div>

            <div style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '12px',
              border: `1px solid ${BORDER}`,
              background: PATHD_THEME.panelSurface,
              display: 'grid',
              gap: '6px',
            }}>
              <div style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Readout
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, lineHeight: 1.55 }}>
                {convergence.isStable
                  ? 'The controller is behaving like a viable operating policy rather than a fragile simulator-only tuning.'
                  : 'The current gain package still behaves like an unstable experimental policy, so the figure encourages retuning before downstream commitment.'}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ FOOTER ═══════ */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: PANEL_BG }}>
          <ExportButton label="Export JSON" data={trajectory} filename="dyncon-trajectory" format="json" />
          <ExportButton label="Export CSV" data={trajectory} filename="dyncon-trajectory" format="csv" />
          <ExportButton label="Export SVG" data={null} filename="dyncon-chart" format="svg" svgRef={chartRef} />
        </div>
        </>
        )}
      </div>
    </>
  );
}
