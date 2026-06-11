'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import ScientificHero from './shared/ScientificHero';
import AlgorithmPanel from '../shared/AlgorithmPanel';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { catmullRomPath } from '../../utils/svgPath';
import { SVGChartContainer, ChartGrid } from '../charts/primitives';
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
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import type { ToolTab } from './shared/ToolTabBar';

/* ── Design Tokens (shared via useToolTheme) ───────────────────────────────── */
import { toolTokens } from '../../hooks/useToolTheme';
const { panelBg: PANEL_BG, border: BORDER, label: LABEL, value: VALUE,
        glass: GLASS } = toolTokens;

/* ── Series definitions (6 state variables) ────────────────────────────────── */
const SERIES = [
  { key: 'biomass',       label: 'Biomass',   color: `${THEME.LILAC}D1`, unit: 'g/L' },
  { key: 'substrate',     label: 'Substrate', color: `${THEME.APRICOT}E0`, unit: 'g/L' },
  { key: 'product',       label: 'Product',   color: `${THEME.MINT}E0`, unit: 'g/L' },
  { key: 'dissolvedO2',   label: 'DO₂',       color: `${THEME.SKY}E0`, unit: 'sat.' },
  { key: 'fpp',           label: 'FPP',       color: `${THEME.CORAL}E6`, unit: 'μM' },
  { key: 'adsExpression', label: 'ADS Expr',  color: `${THEME.LILAC}EB`, unit: 'a.u.' },
] as const;

/* ── Catmull-Rom → SVG path helper ─────────────────────────────────────────── */
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
    { key: 'product',       label: 'Product',   color: `${THEME.MINT}EB`, max: Math.max(0.001, ...trajectory.map((point) => point.product)),       unit: 'g/L'  },
    { key: 'biomass',       label: 'Biomass',   color: `${THEME.LILAC}EB`, max: Math.max(0.001, ...trajectory.map((point) => point.biomass)),        unit: 'g/L'  },
    { key: 'substrate',     label: 'Substrate', color: `${THEME.APRICOT}EB`, max: Math.max(0.001, ...trajectory.map((point) => point.substrate)),      unit: 'g/L'  },
    { key: 'dissolvedO2',   label: 'DO₂',       color: `${THEME.SKY}E6`,  max: 1,                                                                    unit: 'sat.' },
    { key: 'fpp',           label: 'FPP',       color: `${THEME.CORAL}F0`, max: Math.max(0.001, ...trajectory.map((point) => point.fpp ?? 0)),             unit: 'μM'   },
    { key: 'adsExpression', label: 'ADS',       color: `${THEME.LILAC}EB`, max: Math.max(0.001, ...trajectory.map((point) => point.adsExpression ?? 0)),   unit: 'a.u.' },
  ] as const;

  const tMax = trajectory[trajectory.length - 1].time;
  const plotWidth = W - PAD_X - 28;
  // Phase portrait inset dimensions
  const PP_X = W - 118, PP_Y = plotTop + 2, PP_W = 104, PP_H = 80;

  function laneY(index: number) { return plotTop + index * (laneH + laneGap); }
  function normalize(value: number, max: number) { return max > 0 ? value / max : 0; }
  function toXY(pt: ODEState, index: number, key: keyof ODEState, max: number): [number, number] {
    const raw = pt[key];
    const value = typeof raw === 'number' ? raw : 0;
    return [PAD_X + (pt.time / tMax) * plotWidth, laneY(index) + laneH - normalize(value, max) * laneH];
  }

  // Phase portrait: product vs fpp
  const productMax = lanes[0].max, fppMax = lanes[4].max;
  const ppPts: [number, number][] = trajectory.map(pt => [
    PP_X + (normalize(pt.product, productMax)) * PP_W,
    PP_Y + PP_H - (normalize(pt.fpp ?? 0, fppMax)) * PP_H,
  ]);
  const ppPath = catmullRomPath(ppPts);

  return (
    <SVGChartContainer W={W} H={H + 36} ariaLabel="Closed-loop trajectory" rx={18} svgRef={svgRef}>
      <text x="22" y="22" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.24)">
        Closed-loop trajectory
      </text>
      <text x="22" y="36" fontFamily={THEME.SANS} fontSize="12" fill="rgba(255,255,255,0.72)">
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

        const smoothPath = catmullRomPath(coords);

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
                <rect x={PAD_X} y={setpointY - 6} width={plotWidth} height={12} fill={`${THEME.SKY}0F`} />
                <line x1={PAD_X} y1={setpointY} x2={PAD_X + plotWidth} y2={setpointY} stroke={`${THEME.SKY}66`} strokeDasharray="4 4" />
              </>
            )}
            {toxicityY !== null && (
              <line x1={PAD_X} y1={toxicityY} x2={PAD_X + plotWidth} y2={toxicityY} stroke="rgba(255,49,49,0.35)" strokeDasharray="5 4" />
            )}
            {/* Smooth Catmull-Rom curve — deterministic simulation, no uncertainty quantification */}
            <motion.path d={smoothPath} fill="none" stroke={lane.color} strokeWidth="2" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.2, ease: 'easeOut', delay: index * 0.1 }} />
            <motion.circle cx={markerX} cy={markerY} r="4" fill={lane.color} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 1.0 + index * 0.1 }} />
            <text x="20" y={y + 14} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.24)">{lane.label}</text>
            <text x="20" y={y + 28} fontFamily={THEME.SANS} fontSize="10" fill="rgba(255,255,255,0.62)">
              {(lastValue ?? 0).toFixed(lane.key === 'fpp' ? 1 : 2)} {lane.unit}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + 14} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.2)">
              {lane.max.toFixed(lane.key === 'fpp' ? 0 : 1)}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + laneH} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.16)">0</text>
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
              textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.45)">
              {tick}h
            </text>
          </g>
        );
      })}

      {/* Deterministic simulation — no uncertainty quantification */}
      <text x={PAD_X} y={plotTop + lanes.length * (laneH + laneGap) - laneGap + 30}
        fontFamily={THEME.MONO} fontSize="9" fill="rgba(255,255,255,0.18)" fontStyle="italic">
        Deterministic simulation — no uncertainty quantification
      </text>

      {/* Phase portrait inset (P vs FPP) */}
      <rect x={PP_X - 4} y={PP_Y - 12} width={PP_W + 8} height={PP_H + 22} rx="8"
        fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.08)" />
      <text x={PP_X + PP_W / 2} y={PP_Y - 4} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.3)">
        PHASE PORTRAIT
      </text>
      <line x1={PP_X} y1={PP_Y} x2={PP_X} y2={PP_Y + PP_H} stroke="rgba(255,255,255,0.1)" />
      <line x1={PP_X} y1={PP_Y + PP_H} x2={PP_X + PP_W} y2={PP_Y + PP_H} stroke="rgba(255,255,255,0.1)" />
      <text x={PP_X - 2} y={PP_Y + PP_H + 8} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.45)">P</text>
      <text x={PP_X + PP_W} y={PP_Y + PP_H + 8} textAnchor="end" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.45)">→</text>
      <text x={PP_X - 2} y={PP_Y} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.45)">R↑</text>
      {ppPath && <path d={ppPath} fill="none" stroke={`${THEME.CORAL}B2`} strokeWidth="1.2" />}
      {ppPts.length > 0 && (
        <circle cx={ppPts[ppPts.length - 1][0]} cy={ppPts[ppPts.length - 1][1]} r="2.5" fill={THEME.CORAL} />
      )}
    </SVGChartContainer>
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
    <SVGChartContainer W={W} H={H + 10} ariaLabel="Hill feedback curve" rx={18} style={{ height: '132px' }}>
      {/* axes */}
      <line x1={PAD} y1={H - PAD + 4} x2={W - PAD} y2={H - PAD + 4} stroke="rgba(255,255,255,0.08)" />
      <line x1={PAD} y1={PAD - 8} x2={PAD} y2={H - PAD + 4} stroke="rgba(255,255,255,0.08)" />
      {/* curve */}
      <rect x={PAD} y={PAD - 8} width={W - PAD * 2} height={H - PAD * 2 + 12} fill="rgba(255,255,255,0.02)" rx="14" />
      <polyline points={pts.join(' ')} fill="none" stroke={THEME.MINT} strokeWidth={2.2} />
      {/* current FPP marker */}
      <line x1={markerX} y1={PAD - 8} x2={markerX} y2={H - PAD + 4}
        stroke={`${THEME.CORAL}80`} strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={markerX} cy={H - PAD + 4 - (hillFeedback(Math.min(currentFPP, fppMax), hill) / hill.Vmax) * (H - PAD * 2 + 4)}
        r={3} fill={THEME.CORAL} />
      {/* labels */}
      <text x="20" y="18" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.24)">
        Repression response
      </text>
      <text x="20" y="32" fontFamily={THEME.SANS} fontSize="11" fill="rgba(255,255,255,0.5)">
        Operating point of the current precursor pool on the Hill feedback curve
      </text>
      <text x={W / 2} y={H + 6} fontFamily={THEME.MONO} fontSize="10" textAnchor="middle" fill={LABEL}>FPP (μM)</text>
      <text x={10} y={(PAD + H - PAD) / 2} fontFamily={THEME.MONO} fontSize="10" textAnchor="middle" fill={LABEL}
        transform={`rotate(-90, 10, ${(PAD + H - PAD) / 2})`}>ADS</text>
      <text x={W - PAD} y={H + 6} fontFamily={THEME.MONO} fontSize="10" textAnchor="end" fill="rgba(255,255,255,0.15)">200</text>
      <text x={PAD} y={H + 6} fontFamily={THEME.MONO} fontSize="10" textAnchor="start" fill="rgba(255,255,255,0.15)">0</text>
    </SVGChartContainer>
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
import SectionLabel from './shared/SectionLabel';
import { THEME, TOOL_RESULT_PALETTE } from '../../theme';

/* ── Stat Row (for convergence / burden readouts) ──────────────────────────── */
function StatRow({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{label}</span>
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', fontWeight: 600, color: VALUE, textAlign: 'right' }}>
        {typeof value === 'number' ? value.toFixed(3) : value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

const DYNCON_TABS: ToolTab[] = [
  { id: 'trajectory', label: 'Trajectory', accent: THEME.SKY },
  { id: 'hill', label: 'Hill Curve', accent: THEME.LILAC },
  { id: 'convergence', label: 'Convergence', accent: THEME.APRICOT },
  { id: 'rbs', label: 'RBS Bridge', accent: THEME.MINT },
];

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default React.memo(function DynConPage() {
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
  const [activeTab, setActiveTab] = useState('trajectory');
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
        validity: 'partial',
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
    <ToolShell
      moduleId="dyncon"
      title="Dynamic Control Simulator"
      description="Fed-batch bioreactor with PID-controlled DO₂ and Hill-function negative feedback"
      formula="f(FPP) = Vmax·Kd^n / (Kd^n + FPP^n)"
      tabs={DYNCON_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['convergence', 'rbs']}
      footer={
        <>
          <ExportButton label="Export JSON" data={trajectory} filename="dyncon-trajectory" format="json" />
          <ExportButton label="Export CSV" data={trajectory} filename="dyncon-trajectory" format="csv" />
          <ExportButton label="Export SVG" data={null} filename="dyncon-chart" format="svg" svgRef={chartRef} />
        </>
      }
      hero={
        <ScientificHero
            eyebrow="Stage 3 · Chassis Control"
            title="Controller behavior is tied to the current metabolic burden"
            summary="DYNCON turns pathway risk into operating policy. PID tuning, Hill repression, and genetic-part mapping are treated as one control package so the page behaves like a scientific control surface for a living system, not a disconnected slider set."
            aside={
              <>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Control bridge
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, fontWeight: 700 }}>
                  {rbsMapping.rbsName} · gain {rbsMapping.controlGain.toFixed(2)}
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, lineHeight: 1.55 }}>
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
      }
    >
      {simError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <SimErrorBanner message={simError} />
        </div>
      ) : (
        <>
          {/* ── Algorithm Transparency ── */}
          <div style={{ padding: '8px 16px' }}>
            <AlgorithmPanel
              name="RK4 ODE + PID Control"
              description="Simulates dynamic bioreactor control using 4th-order Runge-Kutta integration. PID controller adjusts feed rate to maintain setpoint. Hill functions model feedback inhibition."
              assumptions={[
                'Well-mixed bioreactor (CSTR model)',
                'Instantaneous mixing (no transport delays)',
                'Monod kinetics for substrate uptake',
                'Hill function for product inhibition',
                'PID controller with anti-windup',
              ]}
              limitations={[
                'No discrete event modeling (e.g., batch transitions)',
                'Simplified metabolic network (6 species)',
                'No stochastic effects',
                'Controller tuning is manual',
              ]}
              citation={{
                authors: 'Bailey JE, Ollis DF',
                title: 'Biochemical Engineering Fundamentals',
                journal: 'McGraw-Hill',
                year: 1986,
                doi: '',
              }}
            />
          </div>

          {/* ── Trajectory Tab ── */}
          <ToolTabPanel tabId="trajectory" activeId={activeTab}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <FloatingControlRail label="Parameters" defaultCollapsed={false} width={260}>
                <SectionLabel>PID Controller</SectionLabel>
                <ParamSlider label="Kp" value={kp} min={0} max={10} step={0.1} onChange={setKp} />
                <ParamSlider label="Ki" value={ki} min={0} max={5} step={0.05} onChange={setKi} />
                <ParamSlider label="Kd" value={kd} min={0} max={2} step={0.02} onChange={setKd} />
                <ParamSlider label="DO₂ Setpoint" value={setpoint} min={0.1} max={1.0} step={0.05} onChange={setSetpoint} unit="sat." />
                <SectionLabel>Hill Feedback</SectionLabel>
                <ParamSlider label="Vmax" value={vmax} min={0.1} max={2.0} step={0.05} onChange={setVmax} />
                <ParamSlider label="Kd" value={hillKd} min={5} max={200} step={5} onChange={setHillKd} unit="μM" />
                <ParamSlider label="n" value={hillN} min={1} max={4} step={0.5} onChange={setHillN} />
              </FloatingControlRail>

              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <ScientificFigureFrame
                  eyebrow="Controller figure"
                  title="Closed-loop bioreactor dynamics"
                  caption="6-lane time-series showing biomass, substrate, product, DO₂, FPP, and ADS expression trajectories under PID control."
                  legend={[
                    { label: 'Setpoint', value: `${setpoint.toFixed(2)} sat.`, accent: THEME.SKY },
                    { label: 'Stability', value: convergence.isStable ? 'Stable' : 'Unstable', accent: convergence.isStable ? THEME.MINT : THEME.CORAL },
                    { label: 'Titer', value: `${productTiter.toFixed(2)} g/L`, accent: THEME.MINT },
                    { label: 'RBS', value: rbsMapping.rbsName, accent: THEME.LILAC },
                  ]}
                  minHeight="100%"
                >
                  <TimeSeriesSVG trajectory={trajectory} setpoint={setpoint} svgRef={chartRef} />
                </ScientificFigureFrame>

                <InlineMetricOverlay
                  position="top-right"
                  metrics={[
                    { label: 'Titer', value: `${productTiter.toFixed(2)} g/L`, accent: THEME.MINT },
                    { label: 'DO₂ RMSE', value: doRmse.toFixed(3), accent: doRmse > 0.1 ? THEME.CORAL : THEME.SKY },
                    { label: 'FPP', value: `${currentFPP.toFixed(1)} μM`, accent: currentFPP > DEFAULT_PARAMS.fppToxicThreshold ? THEME.CORAL : THEME.SKY },
                    { label: 'Burden', value: burden.burdenIndex.toFixed(3), accent: burden.isViable ? THEME.MINT : THEME.CORAL },
                  ]}
                />
              </div>
            </div>
          </ToolTabPanel>

          {/* ── Hill Curve Tab ── */}
          <ToolTabPanel tabId="hill" activeId={activeTab}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <FloatingControlRail label="Hill Parameters" defaultCollapsed={false} width={260}>
                <SectionLabel>Hill Feedback</SectionLabel>
                <ParamSlider label="Vmax" value={vmax} min={0.1} max={2.0} step={0.05} onChange={setVmax} />
                <ParamSlider label="Kd" value={hillKd} min={5} max={200} step={5} onChange={setHillKd} unit="μM" />
                <ParamSlider label="n" value={hillN} min={1} max={4} step={0.5} onChange={setHillN} />
              </FloatingControlRail>

              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <ScientificFigureFrame
                  eyebrow="Hill repression"
                  title="Hill feedback curve with operating point"
                  caption="f(FPP) = Vmax·Kd^n / (Kd^n + FPP^n). The operating point shows current repression level."
                  legend={[
                    { label: 'Vmax', value: vmax.toFixed(2), accent: THEME.SKY },
                    { label: 'Kd', value: `${hillKd.toFixed(0)} μM`, accent: THEME.LILAC },
                    { label: 'n', value: hillN.toFixed(1), accent: THEME.APRICOT },
                    { label: 'Operating Pt', value: `${currentFPP.toFixed(1)} μM`, accent: THEME.MINT },
                  ]}
                  minHeight="100%"
                >
                  <HillCurveSVG hill={hill} currentFPP={currentFPP} />
                </ScientificFigureFrame>

                <InlineMetricOverlay
                  position="top-right"
                  metrics={[
                    { label: 'Vmax', value: vmax.toFixed(2), accent: THEME.SKY },
                    { label: 'Kd', value: `${hillKd.toFixed(0)} μM`, accent: THEME.LILAC },
                    { label: 'Hill coeff', value: hillN.toFixed(1), accent: THEME.APRICOT },
                    { label: 'Current FPP', value: `${currentFPP.toFixed(1)} μM`, accent: currentFPP > DEFAULT_PARAMS.fppToxicThreshold ? THEME.CORAL : THEME.MINT },
                  ]}
                />
              </div>
            </div>
          </ToolTabPanel>

          {/* ── Convergence Tab ── */}
          <ToolTabPanel tabId="convergence" activeId={activeTab}>
            <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, overflow: 'auto', padding: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SectionLabel>Convergence Analysis</SectionLabel>
                <div style={{ ...GLASS, padding: '12px', marginBottom: '12px' }}>
                  <StatRow label="Settling Time" value={convergence.settlingTime} unit="h" />
                  <StatRow label="Overshoot" value={convergence.overshoot} unit="%" />
                  <StatRow label="Conv. Rate" value={convergence.convergenceRate} unit="h⁻¹" />
                  <StatRow label="SS Error" value={convergence.steadyStateError} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: convergence.isStable ? THEME.MINT : THEME.CORAL }} />
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: convergence.isStable ? VALUE : THEME.CORAL }}>{convergence.isStable ? 'Stable' : 'Unstable'}</span>
                  </div>
                </div>
                <SectionLabel>Metabolic Burden</SectionLabel>
                <div style={{ ...GLASS, padding: '12px' }}>
                  <StatRow label="Burden Index" value={burden.burdenIndex} />
                  <StatRow label="Protein Cost" value={burden.proteinCost} />
                  <StatRow label="ATP Drain" value={burden.atpDrain} unit="mmol/gDW/h" />
                  <StatRow label="Growth Penalty" value={burden.growthPenalty} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: burden.isViable ? THEME.MINT : THEME.CORAL }} />
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: burden.isViable ? VALUE : THEME.CORAL }}>{burden.isViable ? 'Viable' : 'Non-viable'}</span>
                  </div>
                  <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', fontStyle: 'italic', color: LABEL, lineHeight: 1.45, marginTop: '6px' }}>{burden.recommendation}</p>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SectionLabel>Process Readouts</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <MetricCard label="Final Product Titer" value={productTiter} unit="g/L" highlight />
                  <MetricCard label="Productivity" value={productivity} unit="g/L/h" />
                  <MetricCard label="Final Biomass" value={last?.biomass ?? 0} unit="g/L" />
                  <MetricCard label="DO₂ RMSE" value={doRmse} unit="sat." warning={doRmse > 0.1 ? 'Poor control' : undefined} />
                  <MetricCard label="FPP Level" value={currentFPP} unit="μM" warning={currentFPP > DEFAULT_PARAMS.fppToxicThreshold ? 'Above toxic' : undefined} />
                  <MetricCard label="ADS Expression" value={currentADS} unit="a.u." />
                </div>
              </div>
            </div>
          </ToolTabPanel>

          {/* ── RBS Bridge Tab ── */}
          <ToolTabPanel tabId="rbs" activeId={activeTab}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <FloatingControlRail label="Controller Gains" defaultCollapsed={false} width={260}>
                <SectionLabel>PID Controller</SectionLabel>
                <ParamSlider label="Kp" value={kp} min={0} max={10} step={0.1} onChange={setKp} />
                <ParamSlider label="Ki" value={ki} min={0} max={5} step={0.05} onChange={setKi} />
                <ParamSlider label="Kd" value={kd} min={0} max={2} step={0.02} onChange={setKd} />
              </FloatingControlRail>

              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, gap: '12px', padding: '12px', overflow: 'auto' }}>
                <SectionLabel>RBS Part Mapping</SectionLabel>
                <div style={{ ...GLASS, padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Control Gain</div>
                      <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-lg)', color: VALUE, fontWeight: 700 }}>{rbsMapping.controlGain.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>RBS Part</div>
                      <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-lg)', color: THEME.SKY, fontWeight: 700 }}>{rbsMapping.rbsName}</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>RBS Strength</div>
                    <div style={{ background: THEME.PANEL_INSET, borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, rbsMapping.rbsStrength * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${THEME.SKY}, ${THEME.MINT})`, borderRadius: '6px', transition: 'width 300ms ease-out' }} />
                    </div>
                    <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, marginTop: '4px' }}>{(rbsMapping.rbsStrength * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>DNA Sequence</div>
                    <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.SKY, wordBreak: 'break-all', lineHeight: 1.6, background: THEME.PANEL_INSET, padding: '8px', borderRadius: 'var(--nb-radius-sm)', border: `1px solid ${THEME.BORDER}` }}>
                      {rbsMapping.sequence}
                    </p>
                  </div>
                </div>

                <InlineMetricOverlay
                  position="top-right"
                  metrics={[
                    { label: 'Gain', value: rbsMapping.controlGain.toFixed(2), accent: THEME.SKY },
                    { label: 'RBS', value: rbsMapping.rbsName, accent: THEME.LILAC },
                    { label: 'Strength', value: `${(rbsMapping.rbsStrength * 100).toFixed(0)}%`, accent: THEME.MINT },
                  ]}
                />
              </div>
            </div>
          </ToolTabPanel>
        </>
      )}
    </ToolShell>
  );
});
