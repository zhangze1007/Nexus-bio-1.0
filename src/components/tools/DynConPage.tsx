'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import ScientificHero from './shared/ScientificHero';
import { getToolValidity } from '../../config/toolValidity';
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
  SPONTANEOUS_LOSS_RATE,
  PROTEIN_TURNOVER_RATE,
  O2_CONSUMPTION_COEFF,
} from '../../data/mockDynCon';
import { runMPC } from '../../server/modelPredictiveControl';
import type { ODEState, HillParams } from '../../types';
import type { DynConOverrides } from '../../data/mockDynCon';
import { buildDynConSeed } from './shared/workbenchDataflow';
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import WorkflowStepper, { type StepDef } from './shared/WorkflowStepper';
import ResultSummaryPanel from './shared/ResultSummaryPanel';
import ParameterPanel from './shared/ParameterPanel';
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
    <SVGChartContainer W={W} H={H + 36} ariaLabel="Closed-loop trajectory" variant="paper" svgRef={svgRef}>
      <text x="22" y="22" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
        Closed-loop trajectory
      </text>
      <text x="22" y="36" fontFamily={THEME.SANS} fontSize="12" fill={PAPER_THEME.labelColor}>
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
            <rect x={PAD_X} y={y} width={plotWidth} height={laneH} rx="2" fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line key={fraction} x1={PAD_X} y1={y + laneH - fraction * laneH}
                x2={PAD_X + plotWidth} y2={y + laneH - fraction * laneH}
                stroke={PAPER_THEME.grid} strokeWidth="1" />
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
            <text x="20" y={y + 14} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>{lane.label}</text>
            <text x="20" y={y + 28} fontFamily={THEME.SANS} fontSize="10" fill={PAPER_THEME.labelColor}>
              {(lastValue ?? 0).toFixed(lane.key === 'fpp' ? 1 : 2)} {lane.unit}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + 14} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
              {lane.max.toFixed(lane.key === 'fpp' ? 0 : 1)}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + laneH} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>0</text>
          </g>
        );
      })}

      {[0, 25, 50, 75, 100].map((tick) => {
        const x = PAD_X + (tick / 100) * plotWidth;
        return (
          <g key={tick}>
            <line x1={x} y1={plotTop + lanes.length * (laneH + laneGap) - laneGap}
              x2={x} y2={plotTop + lanes.length * (laneH + laneGap) - laneGap + 6}
              stroke={PAPER_THEME.grid} />
            <text x={x} y={plotTop + lanes.length * (laneH + laneGap) - laneGap + 18}
              textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
              {tick}h
            </text>
          </g>
        );
      })}

      {/* Deterministic simulation — no uncertainty quantification */}
      <text x={PAD_X} y={plotTop + lanes.length * (laneH + laneGap) - laneGap + 30}
        fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor} fontStyle="italic">
        Deterministic simulation — no uncertainty quantification
      </text>

      {/* Phase portrait inset (P vs FPP) */}
      <rect x={PP_X - 4} y={PP_Y - 12} width={PP_W + 8} height={PP_H + 22} rx="2"
        fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
      <text x={PP_X + PP_W / 2} y={PP_Y - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
        PHASE PORTRAIT
      </text>
      <line x1={PP_X} y1={PP_Y} x2={PP_X} y2={PP_Y + PP_H} stroke={PAPER_THEME.grid} />
      <line x1={PP_X} y1={PP_Y + PP_H} x2={PP_X + PP_W} y2={PP_Y + PP_H} stroke={PAPER_THEME.grid} />
      <text x={PP_X + PP_W / 2} y={PP_Y + PP_H + 14} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>Product (g/L)</text>
      <text x={PP_X - 2} y={PP_Y + PP_H + 8} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>0</text>
      <text x={PP_X + PP_W} y={PP_Y + PP_H + 8} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>→</text>
      <text x={PP_X - 4} y={PP_Y - 2} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>FPP (μM)</text>
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
    <SVGChartContainer W={W} H={H + 10} ariaLabel="Hill feedback curve" variant="paper" style={{ height: '132px' }}>
      {/* axes */}
      <line x1={PAD} y1={H - PAD + 4} x2={W - PAD} y2={H - PAD + 4} stroke={PAPER_THEME.axis} />
      <line x1={PAD} y1={PAD - 8} x2={PAD} y2={H - PAD + 4} stroke={PAPER_THEME.axis} />
      {/* curve */}
      <rect x={PAD} y={PAD - 8} width={W - PAD * 2} height={H - PAD * 2 + 12} fill={PAPER_THEME.bgAlt} rx="2" />
      <polyline points={pts.join(' ')} fill="none" stroke={THEME.MINT} strokeWidth={2.2} />
      {/* current FPP marker */}
      <line x1={markerX} y1={PAD - 8} x2={markerX} y2={H - PAD + 4}
        stroke={`${THEME.CORAL}80`} strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={markerX} cy={H - PAD + 4 - (hillFeedback(Math.min(currentFPP, fppMax), hill) / hill.Vmax) * (H - PAD * 2 + 4)}
        r={3} fill={THEME.CORAL} />
      {/* labels */}
      <text x="20" y="18" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
        Repression response
      </text>
      <text x="20" y="32" fontFamily={THEME.SANS} fontSize="11" fill={PAPER_THEME.labelColor}>
        Operating point of the current precursor pool on the Hill feedback curve
      </text>
      <text x={W / 2} y={H + 6} fontFamily={THEME.MONO} fontSize="10" textAnchor="middle" fill={LABEL}>FPP (μM)</text>
      <text x={10} y={(PAD + H - PAD) / 2} fontFamily={THEME.MONO} fontSize="10" textAnchor="middle" fill={LABEL}
        transform={`rotate(-90, 10, ${(PAD + H - PAD) / 2})`}>ADS</text>
      <text x={W - PAD} y={H + 6} fontFamily={PAPER_THEME.tickFont} fontSize="10" textAnchor="end" fill={PAPER_THEME.tickColor}>200</text>
      <text x={PAD} y={H + 6} fontFamily={PAPER_THEME.tickFont} fontSize="10" textAnchor="start" fill={PAPER_THEME.tickColor}>0</text>
    </SVGChartContainer>
  );
}

/* ── Param Slider — PATHD gradient + useTransition for smooth dragging ── */
function ParamSlider({ label, value, min, max, step = 0.1, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
}) {
  const decimals = step > 0 ? Math.max(2, Math.ceil(-Math.log10(step))) : 2;
  return (
    <WorkbenchRangeSlider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={onChange}
      formatValue={(nextValue) => nextValue.toFixed(decimals)}
    />
  );
}

/* ── Section Header ────────────────────────────────────────────────────────── */
import SectionLabel from './shared/SectionLabel';
import { PAPER_THEME } from '../charts/chartTheme';
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
  { id: 'bioprocess', label: 'Bioprocess Opt.', accent: THEME.SKY },
  { id: 'digitaltwin', label: 'Digital Twin', accent: THEME.LILAC },
  { id: 'analytics', label: 'Analytics', accent: THEME.MINT },
];

const VALIDITY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  real:    { bg: 'rgba(147, 203, 82, 0.16)',  border: 'rgba(147, 203, 82, 0.45)',  color: '#5d8a2f', label: 'REAL' },
  partial: { bg: 'rgba(232, 220, 200, 0.32)', border: 'rgba(180, 150, 100, 0.50)', color: '#8a6a30', label: 'PARTIAL' },
  demo:    { bg: 'rgba(250, 128, 114, 0.16)', border: 'rgba(250, 128, 114, 0.50)', color: '#a8453a', label: 'DEMO' },
};

function FrontierEngineBadge({ engineId }: { engineId: string }) {
  const validity = getToolValidity(engineId);
  if (!validity) return null;
  const style = VALIDITY_STYLES[validity.level] ?? VALIDITY_STYLES.partial;
  return (
    <div
      title={validity.caption}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        marginLeft: 'auto', marginRight: 16,
        fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700,
        letterSpacing: '0.10em', padding: '5px 9px',
        borderRadius: 'var(--nb-radius-md)',
        background: style.bg, border: `1px solid ${style.border}`, color: style.color,
        cursor: 'help', flexShrink: 0,
      }}
    >
      {style.label}
      <span style={{ fontWeight: 400, opacity: 0.7, letterSpacing: 0 }}>/ {engineId}</span>
    </div>
  );
}

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
  const kineticsPayload = useWorkbenchStore((s) => s.toolPayloads.kinetics);
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

  /* ── Advanced overrides (persisted) ──────────────────────────────────────── */
  const [spontaneousLossRate, setSpontaneousLossRate] = usePersistedState('nexus-bio:dyncon:spontaneousLossRate', SPONTANEOUS_LOSS_RATE);
  const [o2ConsumptionCoeff, setO2ConsumptionCoeff] = usePersistedState('nexus-bio:dyncon:o2ConsumptionCoeff', O2_CONSUMPTION_COEFF);
  const [burdenPenalty, setBurdenPenalty] = usePersistedState('nexus-bio:dyncon:burdenPenalty', 0.4);

  /* ── MPC mode (persisted) ──────────────────────────────────────────────── */
  const [controlMode, setControlMode] = usePersistedState<'pid' | 'mpc'>('nexus-bio:dyncon:controlMode', 'pid');
  const [mpcPredHorizon, setMpcPredHorizon] = usePersistedState('nexus-bio:dyncon:mpcPredHorizon', 10);
  const [mpcCtrlHorizon, setMpcCtrlHorizon] = usePersistedState('nexus-bio:dyncon:mpcCtrlHorizon', 4);
  const [mpcStateWeight, setMpcStateWeight] = usePersistedState('nexus-bio:dyncon:mpcStateWeight', 10.0);
  const [mpcControlWeight, setMpcControlWeight] = usePersistedState('nexus-bio:dyncon:mpcControlWeight', 0.5);
  const [mpcResult, setMpcResult] = useState<{
    trajectory: ODEState[];
    controlSignals: number[];
    cost: number;
    feasible: boolean;
    predictedTrajectory: ODEState[];
    constraintViolations: { time: number; variable: string; value: number; bound: string }[];
  } | null>(null);

  // Pipeline state
  const [pipelineResult, setPipelineResult] = useState<{
    optimalKp: number; optimalKi: number; optimalKd: number;
    costReduction: number; iterations: number; convergenceMetric: number;
  } | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('trajectory');
  const [workflowStep, setWorkflowStep] = useState(0);
  const recommendedSeed = useMemo(
    () => buildDynConSeed(fbaPayload, cethxPayload, catalystPayload, dbtlPayload),
    [catalystPayload?.updatedAt, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, fbaPayload?.updatedAt],
  );

  // Seed signature guard: only re-apply when seed values actually change
  const seedSignature = useMemo(
    () => `${recommendedSeed.controller.kp}|${recommendedSeed.controller.ki}|${recommendedSeed.controller.kd}|${recommendedSeed.controller.setpoint}|${recommendedSeed.hill.vmax}|${recommendedSeed.hill.kd}|${recommendedSeed.hill.n}`,
    [recommendedSeed.controller.kp, recommendedSeed.controller.ki, recommendedSeed.controller.kd, recommendedSeed.controller.setpoint, recommendedSeed.hill.vmax, recommendedSeed.hill.kd, recommendedSeed.hill.n],
  );
  const lastAppliedSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastAppliedSeedRef.current === seedSignature) return;
    setKp(recommendedSeed.controller.kp);
    setKi(recommendedSeed.controller.ki);
    setKd(recommendedSeed.controller.kd);
    setSetpoint(recommendedSeed.controller.setpoint);
    // Hill parameters seeded from kinetic simulation when available
    if (kineticsPayload?.result) {
      const kv = kineticsPayload.result;
      // vmax from kinetics Vmax (normalized to Hill scale)
      setVmax(Math.min(2, Math.max(0.2, kv.vmax)));
      // hillKd seeded from Km (Michaelis constant → Hill dissociation constant)
      setHillKd(Math.min(200, Math.max(5, kv.km * 40)));
    } else {
      setVmax(recommendedSeed.hill.vmax);
      setHillKd(recommendedSeed.hill.kd);
    }
    setHillN(recommendedSeed.hill.n);
    lastAppliedSeedRef.current = seedSignature;
  }, [
    seedSignature,
    kineticsPayload?.result,
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

  const overrides: DynConOverrides = useMemo(() => ({
    spontaneousLossRate,
    o2ConsumptionCoeff,
    burdenPenalty,
  }), [spontaneousLossRate, o2ConsumptionCoeff, burdenPenalty]);

  /* ── MPC state-transition model (discrete-time, 1 Euler step) ─────────── */
  const mpcModelStateRef = useRef<{
    p: typeof DEFAULT_PARAMS;
    hill: HillParams;
    overrides: DynConOverrides;
  }>({ p: DEFAULT_PARAMS, hill, overrides });
  mpcModelStateRef.current = { p: DEFAULT_PARAMS, hill, overrides };

  const mpcModelFn = useMemo(
    () => (state: number[], control: number[]): number[] => {
      // State: [X, S, P, O_norm, FPP, ADS, V]
      // Control: [airflowScale]  (0..3)
      const { p, hill: h, overrides: ov } = mpcModelStateRef.current;
      const spontaneousLoss = ov.spontaneousLossRate ?? SPONTANEOUS_LOSS_RATE;
      const o2Coeff = ov.o2ConsumptionCoeff ?? O2_CONSUMPTION_COEFF;
      const burdenCoeff = ov.burdenPenalty ?? 0.4;
      const airflowScale = Math.max(0, Math.min(3, control[0]));
      const dt = 1.0; // 1-hour timestep (matches PID simulation)

      const X = Math.max(0, state[0]);
      const S = Math.max(0, state[1]);
      const P = Math.max(0, state[2]);
      const O_norm = Math.max(0, Math.min(1.2, state[3]));
      const FPP = Math.max(0, state[4]);
      const ADS = Math.max(0, Math.min(2.0, state[5]));
      const V = Math.max(0.1, state[6]);
      const O = O_norm * p.OstarSat;

      const muO = O > 0 ? O / (p.Ko + O) : 0;
      const muBase = p.muMax * (S / (p.Ks + S)) * muO;
      const fppInhib = 1 / (1 + (FPP / p.fppToxicThreshold) ** 2);
      const prodInhib = 1 / (1 + (P / p.productToxicThreshold) ** 2);
      const burdenRaw = Math.min(1, ADS / p.maxBurdenTolerance);
      const burdenPen = Math.max(0, 1 - burdenRaw * burdenCoeff);
      const mu = muBase * fppInhib * prodInhib * burdenPen;

      const dilution = p.feedRate / V;
      const dX = mu * X - dilution * X;
      const dS = p.feedRate * (p.feedConc - S) / V - dX / p.Yxs;
      const dFPP = p.kFPP * X - ADS * FPP * p.fppDegradation - FPP * spontaneousLoss - dilution * FPP;
      const adsTarget = hillFeedback(FPP, h);
      const dADS = (adsTarget - ADS) * PROTEIN_TURNOVER_RATE;
      const dP = p.kADS * ADS * FPP - dilution * P;
      const dO_full = p.kLa * airflowScale * (p.OstarSat - O) - mu * X * o2Coeff;
      const dO = dO_full / p.OstarSat;

      const Xn = Math.max(0, X + dt * dX);
      const Sn = Math.max(0, S + dt * dS);
      const Pn = Math.max(0, P + dt * dP);
      const On = Math.max(0, Math.min(1.2, O_norm + dt * dO));
      const FPPn = Math.max(0, FPP + dt * dFPP);
      const ADSn = Math.max(0, Math.min(2.0, ADS + dt * dADS));
      const Vn = Math.max(0.1, V + dt * p.feedRate);

      return [Xn, Sn, Pn, On, FPPn, ADSn, Vn];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ── MPC simulation ────────────────────────────────────────────────────── */
  const pidSimulation = useMemo(() => {
    try {
      const t = runBioreactor({ kp, ki, kd, setpoint }, DEFAULT_PARAMS, 100, 1.0, hill, overrides);
      return { trajectory: t, simError: null as string | null };
    } catch (e) {
      return { trajectory: [] as ODEState[], simError: e instanceof Error ? e.message : 'Simulation failed' };
    }
  }, [kp, ki, kd, setpoint, hill, overrides]);

  const mpcSimulation = useMemo(() => {
    if (controlMode !== 'mpc') return null;
    try {
      const params = DEFAULT_PARAMS;
      const initialState = [
        0.5,                     // X (biomass)
        20.0,                    // S (substrate)
        0.0,                     // P (product)
        1.0,                     // O_norm (dissolved O2, normalized)
        10.0,                    // FPP
        hill.Vmax * 0.8,        // ADS
        2.0,                     // V (volume)
      ];

      const predHorizon = Math.max(2, Math.min(20, mpcPredHorizon));
      const ctrlHorizon = Math.max(1, Math.min(predHorizon, mpcCtrlHorizon));

      const mpcConfig = {
        predictionHorizon: predHorizon,
        controlHorizon: ctrlHorizon,
        dt: 1.0,
        setpoint: [0, 0, 0, setpoint, 0, 0, 0],
        stateConstraints: {
          min: [0, 0, 0, 0, 0, 0, 0.1],
          max: [50, 100, 50, 1.2, 300, 2.0, 20],
        },
        controlConstraints: { min: [0], max: [3] },
        costWeights: {
          state: [0.1, 0.01, 1.0, mpcStateWeight, 0.05, 0.1, 0.01],
          control: [mpcControlWeight],
        },
      };

      const result = runMPC(initialState, mpcConfig, mpcModelFn, 100);

      const toODEState = (idx: number): ODEState => ({
        time: (idx + 1) * 1.0,
        biomass: result.trajectories[0][idx + 1],
        substrate: result.trajectories[1][idx + 1],
        product: result.trajectories[2][idx + 1],
        dissolvedO2: result.trajectories[3][idx + 1],
        fpp: result.trajectories[4][idx + 1],
        adsExpression: result.trajectories[5][idx + 1],
        volume: result.trajectories[6][idx + 1],
      });

      const trajectory = Array.from({ length: 100 }, (_, i) => toODEState(i));

      // Predicted trajectory from current state (last point) over prediction horizon
      const lastIdx = 99;
      const currentState = [
        result.trajectories[0][lastIdx],
        result.trajectories[1][lastIdx],
        result.trajectories[2][lastIdx],
        result.trajectories[3][lastIdx],
        result.trajectories[4][lastIdx],
        result.trajectories[5][lastIdx],
        result.trajectories[6][lastIdx],
      ];
      const lastControl = result.controlSignals[lastIdx];
      const predictedStates: ODEState[] = [toODEState(lastIdx)];
      let prevState = currentState;
      for (let k = 0; k < predHorizon; k++) {
        const nextState = mpcModelFn(prevState, [lastControl]);
        predictedStates.push({
          time: lastIdx + 1 + k + 1,
          biomass: nextState[0],
          substrate: nextState[1],
          product: nextState[2],
          dissolvedO2: nextState[3],
          fpp: nextState[4],
          adsExpression: nextState[5],
          volume: nextState[6],
        });
        prevState = nextState;
      }

      // Constraint violations
      const violations: { time: number; variable: string; value: number; bound: string }[] = [];
      trajectory.forEach((s, i) => {
        if (s.fpp !== undefined && s.fpp > params.fppToxicThreshold) {
          violations.push({ time: s.time, variable: 'FPP', value: s.fpp, bound: `< ${params.fppToxicThreshold} uM` });
        }
        if (s.product > params.productToxicThreshold) {
          violations.push({ time: s.time, variable: 'Product', value: s.product, bound: `< ${params.productToxicThreshold} g/L` });
        }
      });

      return {
        trajectory,
        controlSignals: result.controlSignals,
        cost: result.cost,
        feasible: result.feasible,
        predictedTrajectory: predictedStates,
        constraintViolations: violations,
        simError: null as string | null,
      };
    } catch (e) {
      return {
        trajectory: [] as ODEState[],
        controlSignals: [] as number[],
        cost: 0,
        feasible: false,
        predictedTrajectory: [] as ODEState[],
        constraintViolations: [] as { time: number; variable: string; value: number; bound: string }[],
        simError: e instanceof Error ? e.message : 'MPC simulation failed',
      };
    }
  }, [controlMode, mpcPredHorizon, mpcCtrlHorizon, mpcStateWeight, mpcControlWeight, setpoint, hill, mpcModelFn]);

  useEffect(() => {
    if (controlMode === 'mpc' && mpcSimulation) {
      setMpcResult({
        trajectory: mpcSimulation.trajectory,
        controlSignals: mpcSimulation.controlSignals,
        cost: mpcSimulation.cost,
        feasible: mpcSimulation.feasible,
        predictedTrajectory: mpcSimulation.predictedTrajectory,
        constraintViolations: mpcSimulation.constraintViolations,
      });
    }
  }, [controlMode, mpcSimulation]);

  /* ── Active simulation results ─────────────────────────────────────────── */
  const trajectory = controlMode === 'mpc' && mpcResult && mpcResult.trajectory.length > 0
    ? mpcResult.trajectory
    : pidSimulation.trajectory;
  const simError = controlMode === 'mpc' && mpcResult
    ? (mpcSimulation?.simError ?? null)
    : pidSimulation.simError;

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
      if (controlMode === 'mpc' && mpcResult) {
        appendConsole({
          level: 'info',
          module: 'DYNCON',
          message: `MPC sim complete — Np=${mpcPredHorizon} Nc=${mpcCtrlHorizon} Q_DO2=${mpcStateWeight} R=${mpcControlWeight} | Product=${productTiter.toFixed(2)} g/L | Cost=${mpcResult.cost.toFixed(2)} | ${mpcResult.feasible ? 'Feasible' : 'Constraint violations'} | RMSE=${doRmse.toFixed(3)}`,
        });
      } else {
        appendConsole({
          level: 'info',
          module: 'DYNCON',
          message: `ODE sim complete — Kp=${kp} Ki=${ki} Kd=${kd} SP=${setpoint} | Product=${productTiter.toFixed(2)} g/L | RMSE=${doRmse.toFixed(3)} | ${convergence.isStable ? 'Stable' : 'Unstable'}`,
        });
      }
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
      description={`Fed-batch bioreactor with ${controlMode === 'mpc' ? 'MPC (Model Predictive Control)' : 'PID-controlled'} DO₂ and Hill-function negative feedback`}
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
        <>
          <FrontierEngineBadge engineId="digitaltwin" />
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
        </>
      }
    >
      {simError ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <SimErrorBanner message={simError} />
        </div>
      ) : (
        <>
          {/* ── Workflow Stepper ── */}
          <div style={{ padding: '8px 16px 0' }}>
            <WorkflowStepper
              steps={[
                { id: 'setup', label: 'Setup', status: workflowStep > 0 ? 'done' : workflowStep === 0 ? 'active' : 'pending', detail: 'Controller params' },
                { id: 'simulate', label: 'Simulate', status: workflowStep > 1 ? 'done' : workflowStep === 1 ? 'active' : 'pending', detail: controlMode === 'mpc' ? 'MPC' : 'RK4 ODE' },
                { id: 'optimize', label: 'Optimize', status: workflowStep > 2 ? 'done' : workflowStep === 2 ? 'active' : 'pending', detail: 'Tune gains' },
                { id: 'analyze', label: 'Analyze', status: workflowStep > 3 ? 'done' : workflowStep === 3 ? 'active' : 'pending', detail: 'Convergence' },
              ]}
              activeIndex={workflowStep}
              onStepClick={setWorkflowStep}
            />
          </div>

          {/* ── Result Summary ── */}
          <div style={{ padding: '0 16px 8px' }}>
            <ResultSummaryPanel
              metrics={[
                { label: 'Convergence', value: convergence.isStable ? 'Stable' : 'Unstable', accent: convergence.isStable ? THEME.MINT : THEME.CORAL },
                { label: 'Growth Rate', value: (last?.biomass ?? 0).toFixed(2), unit: 'g/L', accent: THEME.SKY },
                { label: 'Productivity', value: productivity.toFixed(2), unit: 'g/L/h', accent: THEME.MINT },
                { label: 'Stability', value: doRmse.toFixed(3), unit: 'RMSE', accent: doRmse > 0.1 ? THEME.CORAL : THEME.SKY, trend: doRmse > 0.1 ? 'down' : 'flat' },
              ]}
            />
          </div>

          {/* ── Algorithm Transparency ── */}
          <div style={{ padding: '8px 16px' }}>
            <AlgorithmPanel
              name={controlMode === 'mpc' ? 'Euler Discrete + MPC (Projected QP)' : 'RK4 ODE + PID Control'}
              description={controlMode === 'mpc'
                ? 'Model Predictive Control with online linearisation and quadratic programming. At each timestep the nonlinear bioreactor model is linearised via finite-difference Jacobians, a QP is solved over the prediction horizon, and the first optimal control signal is applied.'
                : 'Simulates dynamic bioreactor control using 4th-order Runge-Kutta integration. PID controller adjusts feed rate to maintain setpoint. Hill functions model feedback inhibition.'}
              assumptions={[
                'Well-mixed bioreactor (CSTR model)',
                'Instantaneous mixing (no transport delays)',
                'Monod kinetics for substrate uptake',
                'Hill function for product inhibition',
                ...(controlMode === 'mpc'
                  ? [
                      'Linearised state-space model per timestep',
                      'Quadratic cost: state error + control effort',
                      'Box constraints on states and controls',
                      'Projected gradient descent QP solver',
                    ]
                  : ['PID controller with anti-windup']
                ),
              ]}
              limitations={[
                'No discrete event modeling (e.g., batch transitions)',
                'Simplified metabolic network (6 species)',
                'No stochastic effects',
                ...(controlMode === 'mpc'
                  ? [
                      'Euler integration (1h step) — less accurate than RK4',
                      'QP solved by gradient descent (not a commercial solver)',
                      'Linearisation may diverge far from operating point',
                    ]
                  : ['Controller tuning is manual']
                ),
              ]}
              citation={controlMode === 'mpc'
                ? {
                    authors: 'Camacho EF, Bordons C',
                    title: 'Model Predictive Control',
                    journal: 'Springer',
                    year: 2007,
                    doi: '10.1007/978-0-85729-398-5',
                  }
                : {
                    authors: 'Bailey JE, Ollis DF',
                    title: 'Biochemical Engineering Fundamentals',
                    journal: 'McGraw-Hill',
                    year: 1986,
                    doi: '',
                  }
              }
            />
          </div>

          {/* ── Trajectory Tab ── */}
          <ToolTabPanel tabId="trajectory" activeId={activeTab}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <FloatingControlRail label="Parameters" defaultCollapsed={false} width={260}>
                {/* Control mode toggle */}
                <SectionLabel>Control Mode</SectionLabel>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  {(['pid', 'mpc'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setControlMode(mode)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontFamily: THEME.MONO,
                        fontSize: 'var(--nb-fs-xs)',
                        fontWeight: controlMode === mode ? 700 : 400,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: controlMode === mode ? `${THEME.SKY}20` : 'transparent',
                        color: controlMode === mode ? THEME.SKY : LABEL,
                        border: `1px solid ${controlMode === mode ? `${THEME.SKY}60` : BORDER}`,
                        borderRadius: 'var(--nb-radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {mode === 'pid' ? 'PID' : 'MPC'}
                    </button>
                  ))}
                </div>

                {controlMode === 'pid' ? (
                  <>
                    <ParameterPanel title="PID Controller" onReset={() => { setKp(DEFAULT_CONTROLLER.kp); setKi(DEFAULT_CONTROLLER.ki); setKd(DEFAULT_CONTROLLER.kd); setSetpoint(DEFAULT_CONTROLLER.setpoint); }}>
                      <ParamSlider label="Kp" value={kp} min={0} max={10} step={0.1} onChange={setKp} />
                      <ParamSlider label="Ki" value={ki} min={0} max={5} step={0.05} onChange={setKi} />
                      <ParamSlider label="Kd" value={kd} min={0} max={2} step={0.02} onChange={setKd} />
                      <ParamSlider label="DO₂ Setpoint" value={setpoint} min={0.1} max={1.0} step={0.05} onChange={setSetpoint} unit="sat." />
                    </ParameterPanel>
                    <ParameterPanel title="Hill Feedback" onReset={() => { setVmax(DEFAULT_HILL.Vmax); setHillKd(DEFAULT_HILL.Kd); setHillN(DEFAULT_HILL.n); }}>
                      <ParamSlider label="Vmax" value={vmax} min={0.1} max={2.0} step={0.05} onChange={setVmax} />
                      <ParamSlider label="Kd" value={hillKd} min={5} max={200} step={5} onChange={setHillKd} unit="μM" />
                      <ParamSlider label="n" value={hillN} min={1} max={4} step={0.5} onChange={setHillN} />
                    </ParameterPanel>
                    <ParameterPanel title="Advanced" defaultCollapsed onReset={() => { setSpontaneousLossRate(SPONTANEOUS_LOSS_RATE); setO2ConsumptionCoeff(O2_CONSUMPTION_COEFF); setBurdenPenalty(0.4); }}>
                      <ParamSlider label="Spont. Loss Rate" value={spontaneousLossRate} min={0.001} max={0.1} step={0.001} onChange={setSpontaneousLossRate} unit="h⁻¹" />
                      <ParamSlider label="O₂ Cons. Coeff" value={o2ConsumptionCoeff} min={0.5} max={3.0} step={0.1} onChange={setO2ConsumptionCoeff} />
                      <ParamSlider label="Burden Penalty" value={burdenPenalty} min={0.1} max={0.8} step={0.05} onChange={setBurdenPenalty} />
                    </ParameterPanel>
                  </>
                ) : (
                  <>
                    <ParameterPanel title="MPC Configuration" onReset={() => { setMpcPredHorizon(10); setMpcCtrlHorizon(4); setSetpoint(DEFAULT_CONTROLLER.setpoint); }}>
                      <ParamSlider label="Prediction Horizon" value={mpcPredHorizon} min={2} max={20} step={1} onChange={setMpcPredHorizon} />
                      <ParamSlider label="Control Horizon" value={mpcCtrlHorizon} min={1} max={Math.min(mpcPredHorizon, 10)} step={1} onChange={setMpcCtrlHorizon} />
                      <ParamSlider label="DO₂ Setpoint" value={setpoint} min={0.1} max={1.0} step={0.05} onChange={setSetpoint} unit="sat." />
                    </ParameterPanel>
                    <ParameterPanel title="Cost Weights" onReset={() => { setMpcStateWeight(10.0); setMpcControlWeight(0.5); }}>
                      <ParamSlider label="State Weight (DO₂)" value={mpcStateWeight} min={0.1} max={50} step={0.5} onChange={setMpcStateWeight} />
                      <ParamSlider label="Control Weight" value={mpcControlWeight} min={0.01} max={5} step={0.05} onChange={setMpcControlWeight} />
                    </ParameterPanel>
                    <ParameterPanel title="Hill Feedback" onReset={() => { setVmax(DEFAULT_HILL.Vmax); setHillKd(DEFAULT_HILL.Kd); setHillN(DEFAULT_HILL.n); }}>
                      <ParamSlider label="Vmax" value={vmax} min={0.1} max={2.0} step={0.05} onChange={setVmax} />
                      <ParamSlider label="Kd" value={hillKd} min={5} max={200} step={5} onChange={setHillKd} unit="μM" />
                      <ParamSlider label="n" value={hillN} min={1} max={4} step={0.5} onChange={setHillN} />
                    </ParameterPanel>
                  </>
                )}
              </FloatingControlRail>

              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <ScientificFigureFrame
                  eyebrow={controlMode === 'mpc' ? 'MPC controller figure' : 'Controller figure'}
                  title={controlMode === 'mpc' ? 'MPC-controlled bioreactor dynamics' : 'Closed-loop bioreactor dynamics'}
                  caption={controlMode === 'mpc'
                    ? `6-lane time-series under MPC control (Np=${mpcPredHorizon}, Nc=${mpcCtrlHorizon}). Predicted trajectory shown as dashed overlay.`
                    : '6-lane time-series showing biomass, substrate, product, DO₂, FPP, and ADS expression trajectories under PID control.'}
                  legend={[
                    { label: 'Setpoint', value: `${setpoint.toFixed(2)} sat.`, accent: THEME.SKY },
                    { label: 'Stability', value: convergence.isStable ? 'Stable' : 'Unstable', accent: convergence.isStable ? THEME.MINT : THEME.CORAL },
                    { label: 'Titer', value: `${productTiter.toFixed(2)} g/L`, accent: THEME.MINT },
                    ...(controlMode === 'mpc' && mpcResult
                      ? [
                          { label: 'MPC Cost', value: mpcResult.cost.toFixed(1), accent: THEME.APRICOT },
                          { label: 'Feasible', value: mpcResult.feasible ? 'Yes' : 'No', accent: mpcResult.feasible ? THEME.MINT : THEME.CORAL },
                        ]
                      : [{ label: 'RBS', value: rbsMapping.rbsName, accent: THEME.LILAC }]
                    ),
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
                    ...(controlMode === 'mpc' && mpcResult
                      ? [{ label: 'MPC Cost', value: mpcResult.cost.toFixed(2), accent: THEME.APRICOT }]
                      : []
                    ),
                  ]}
                />

                {/* ── MPC Prediction Horizon Visualization ── */}
                {controlMode === 'mpc' && mpcResult && mpcResult.predictedTrajectory.length > 1 && (
                  <div style={{ ...GLASS, padding: '12px', margin: '8px 16px' }}>
                    <SectionLabel>Prediction Horizon</SectionLabel>
                    <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, marginBottom: '8px', lineHeight: 1.5 }}>
                      MPC-predicted DO₂ trajectory over the next {mpcPredHorizon} steps from the final operating point.
                      The controller optimizes airflow to keep DO₂ at setpoint while respecting constraints.
                    </div>
                    <svg width="100%" viewBox="0 0 560 100" style={{ display: 'block' }}>
                      {(() => {
                        const W = 560, H = 100, PAD = 30;
                        const pred = mpcResult.predictedTrajectory;
                        const tMax = pred[pred.length - 1].time - pred[0].time;
                        const doMax = 1.2;
                        const spY = PAD + (1 - setpoint / doMax) * (H - 2 * PAD);
                        const predPts = pred.map((s, i) => {
                          const x = PAD + ((s.time - pred[0].time) / Math.max(1, tMax)) * (W - 2 * PAD);
                          const y = PAD + (1 - (s.dissolvedO2 ?? 0) / doMax) * (H - 2 * PAD);
                          return `${x},${y}`;
                        });
                        return (
                          <>
                            <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} rx="2" fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
                            <line x1={PAD} y1={spY} x2={W - PAD} y2={spY} stroke={`${THEME.SKY}50`} strokeDasharray="4 4" />
                            <text x={W - PAD + 4} y={spY + 3} fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>SP</text>
                            <polyline points={predPts.join(' ')} fill="none" stroke={THEME.MINT} strokeWidth="2" strokeDasharray="6 3" />
                            <circle cx={predPts[0]?.split(',')[0]} cy={predPts[0]?.split(',')[1]} r="3" fill={THEME.CORAL} />
                            <text x={PAD} y={12} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>DO₂ prediction</text>
                            <text x={PAD} y={H - 8} fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>now</text>
                            <text x={W - PAD} y={H - 8} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>+{mpcPredHorizon}h</text>
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                {/* ── MPC Constraint Violations ── */}
                {controlMode === 'mpc' && mpcResult && mpcResult.constraintViolations.length > 0 && (
                  <div style={{ ...GLASS, padding: '12px', margin: '0 16px 8px', borderLeft: `3px solid ${THEME.CORAL}` }}>
                    <SectionLabel>Constraint Violations</SectionLabel>
                    <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, marginBottom: '4px' }}>
                      {mpcResult.constraintViolations.length} violation(s) detected during simulation
                    </div>
                    <div style={{ maxHeight: '80px', overflow: 'auto' }}>
                      {mpcResult.constraintViolations.slice(0, 8).map((v, i) => (
                        <div key={i} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-2xs)', color: LABEL, padding: '2px 0' }}>
                          t={v.time.toFixed(0)}h: {v.variable} = {v.value.toFixed(2)} (bound: {v.bound})
                        </div>
                      ))}
                      {mpcResult.constraintViolations.length > 8 && (
                        <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-2xs)', color: THEME.DIM }}>
                          +{mpcResult.constraintViolations.length - 8} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ToolTabPanel>

          {/* ── Hill Curve Tab ── */}
          <ToolTabPanel tabId="hill" activeId={activeTab}>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <FloatingControlRail label="Hill Parameters" defaultCollapsed={false} width={260}>
                <ParameterPanel title="Hill Feedback" onReset={() => { setVmax(DEFAULT_HILL.Vmax); setHillKd(DEFAULT_HILL.Kd); setHillN(DEFAULT_HILL.n); }}>
                  <ParamSlider label="Vmax" value={vmax} min={0.1} max={2.0} step={0.05} onChange={setVmax} />
                  <ParamSlider label="Kd" value={hillKd} min={5} max={200} step={5} onChange={setHillKd} unit="μM" />
                  <ParamSlider label="n" value={hillN} min={1} max={4} step={0.5} onChange={setHillN} />
                </ParameterPanel>
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

                {/* ── Pipeline Section ── */}
                <div style={{ ...GLASS, padding: '12px', marginTop: '12px' }}>
                  <SectionLabel>Control Optimization Pipeline</SectionLabel>
                  <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, margin: '0 0 8px' }}>
                    Optimize PID gains via gradient-free search against current trajectory cost.
                  </p>
                  <button
                    onClick={async () => {
                      setPipelineLoading(true);
                      setPipelineError(null);
                      try {
                        const res = await fetch('/api/pipeline/dyncon', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ kp, ki, kd, setpoint, hill, controlMode }),
                        });
                        if (!res.ok) throw new Error(`Pipeline failed (${res.status})`);
                        const data = await res.json();
                        setPipelineResult(data.result);
                      } catch (err) {
                        setPipelineError(err instanceof Error ? err.message : 'Pipeline failed');
                      } finally {
                        setPipelineLoading(false);
                      }
                    }}
                    disabled={pipelineLoading}
                    style={{
                      padding: '6px 14px', borderRadius: 'var(--nb-radius-sm)',
                      background: pipelineLoading ? 'rgba(255,255,255,0.04)' : 'rgba(191,220,205,0.14)',
                      border: `1px solid ${pipelineLoading ? 'rgba(255,255,255,0.08)' : 'rgba(191,220,205,0.3)'}`,
                      color: pipelineLoading ? 'rgba(255,255,255,0.35)' : 'rgba(191,220,205,0.9)',
                      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                      cursor: pipelineLoading ? 'wait' : 'pointer',
                    }}
                  >
                    {pipelineLoading ? 'Running Pipeline...' : 'Run Pipeline'}
                  </button>
                  {pipelineError && (
                    <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, margin: '6px 0 0' }}>
                      {pipelineError}
                    </p>
                  )}
                  {pipelineResult && (
                    <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(191,220,205,0.08)', border: '1px solid rgba(191,220,205,0.15)', borderRadius: 'var(--nb-radius-sm)' }}>
                      <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>
                        Kp={pipelineResult.optimalKp.toFixed(2)} Ki={pipelineResult.optimalKi.toFixed(3)} Kd={pipelineResult.optimalKd.toFixed(3)}
                      </div>
                      <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginTop: 2 }}>
                        Cost reduction: {(pipelineResult.costReduction * 100).toFixed(1)}% | {pipelineResult.iterations} iterations
                      </div>
                    </div>
                  )}
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
                <ParameterPanel title="PID Controller" onReset={() => { setKp(DEFAULT_CONTROLLER.kp); setKi(DEFAULT_CONTROLLER.ki); setKd(DEFAULT_CONTROLLER.kd); }}>
                  <ParamSlider label="Kp" value={kp} min={0} max={10} step={0.1} onChange={setKp} />
                  <ParamSlider label="Ki" value={ki} min={0} max={5} step={0.05} onChange={setKi} />
                  <ParamSlider label="Kd" value={kd} min={0} max={2} step={0.02} onChange={setKd} />
                </ParameterPanel>
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

      {/* ── Bioprocess Optimization Tab ─────────────────────────────── */}
      <ToolTabPanel tabId="bioprocess" activeId={activeTab}>
        <BioprocessOptimizationPanel />
      </ToolTabPanel>

      {/* ── Digital Twin Tab ──────────────────────────────────────────── */}
      <ToolTabPanel tabId="digitaltwin" activeId={activeTab}>
        <DigitalTwinPanel />
      </ToolTabPanel>

      {/* ── Bioreactor Analytics Tab ────────────────────────────────────── */}
      <ToolTabPanel tabId="analytics" activeId={activeTab}>
        <BioreactorAnalyticsPanel />
      </ToolTabPanel>
    </ToolShell>
  );
});

/* ── Digital Twin Panel ──────────────────────────────────────────────────── */

function DigitalTwinPanel() {
  const [readings, setReadings] = useState(10);
  const [result, setResult] = useState<import('../../server/digitalTwinEngine').DigitalTwinResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dtError, setDtError] = useState<string | null>(null);

  const handleRun = React.useCallback(async () => {
    setLoading(true);
    try {
      const { runDigitalTwin } = await import('../../server/digitalTwinEngine');
      const config = {
        volume: 1, temperature: 37, pH: 7.0, dissolvedO2: 100,
        muMax: 0.5, ks: 0.5, yieldCoeff: 0.5, maintenanceCoeff: 0.02,
        productYield: 0.1, feedConcentration: 10, feedRate: 0.01,
        processNoise: 1.0, measurementNoise: 1.0, initialUncertainty: 1.0,
      };
      // Generate synthetic sensor readings
      const sensorReadings = Array.from({ length: readings }, (_, i) => ({
        timestamp: i * 0.5,
        biomass: 0.1 * Math.exp(0.3 * i) + (Math.random() - 0.5) * 0.02,
        substrate: Math.max(0, 10 - 0.5 * i + (Math.random() - 0.5) * 0.1),
        product: 0.05 * i + (Math.random() - 0.5) * 0.01,
      }));
      const res = runDigitalTwin(config, sensorReadings, 12);
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Digital twin simulation failed';
      setDtError(msg);
    } finally {
      setLoading(false);
    }
  }, [readings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Controls */}
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Sensor Readings
        </span>
        <input type="number" min={5} max={100} value={readings}
          onChange={(e) => setReadings(Number(e.target.value))}
          style={{ width: 60, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', outline: 'none' }}
        />
        <button onClick={handleRun} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Synchronizing...' : 'Run Digital Twin'}
        </button>
        {result && (
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.4)' }}>
            R²={result.diagnostics.modelFit.toFixed(3)} • {result.diagnostics.anomalyCount} anomalies
          </span>
        )}
      </div>

      {dtError && <SimErrorBanner message={dtError} onRetry={() => setDtError(null)} />}

      {/* Diagnostics */}
      {result && (
        <div style={{
          background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
          border: `1px solid ${THEME.BORDER}`,
        }}>
          {[
            { label: 'Biomass', value: `${result.currentState.biomass.toFixed(3)} g/L`, color: THEME.MINT },
            { label: 'Substrate', value: `${result.currentState.substrate.toFixed(3)} g/L`, color: THEME.SKY },
            { label: 'Product', value: `${result.currentState.product.toFixed(3)} g/L`, color: THEME.APRICOT },
            { label: 'μ (growth)', value: `${result.currentState.specificGrowthRate.toFixed(4)} h⁻¹`, color: THEME.LILAC },
            { label: 'μ_max drift', value: `${result.diagnostics.parameterDrift.muMax}%`, color: Math.abs(result.diagnostics.parameterDrift.muMax) > 10 ? 'rgba(250,128,114,0.7)' : 'rgba(147,203,82,0.7)' },
            { label: 'Model Fit', value: `R² ${result.diagnostics.modelFit.toFixed(3)}`, color: result.diagnostics.modelFit > 0.9 ? 'rgba(147,203,82,0.7)' : 'rgba(250,128,114,0.7)' },
          ].map((m, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--nb-radius-sm)', padding: '8px 10px',
              border: `1px solid rgba(255,255,255,0.05)`,
            }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {m.label}
              </div>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: m.color, fontWeight: 600 }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Forecast */}
      {result && result.forecast.length > 0 && (
        <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            12h Forecast (Monte Carlo, 95% CI)
          </div>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {result.forecast.filter((_, i) => i % 4 === 0).map((f, i) => (
              <div key={i} style={{
                minWidth: 80, padding: '6px 8px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--nb-radius-sm)',
                textAlign: 'center',
              }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(255,255,255,0.3)' }}>
                  {f.time.toFixed(0)}h
                </div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.MINT }}>
                  {f.biomass.mean.toFixed(2)}
                </div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(255,255,255,0.25)' }}>
                  [{f.biomass.ci95[0].toFixed(2)}, {f.biomass.ci95[1].toFixed(2)}]
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Design notes */}
      {result && result.designNotes.length > 0 && (
        <div style={{
          background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12,
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
          border: `1px solid ${THEME.BORDER}`,
        }}>
          {result.designNotes.map((n, i) => <div key={i}>• {n}</div>)}
        </div>
      )}
    </div>
  );
}

/* ── Bioprocess Optimization Panel ─────────────────────────────────────── */

function BioprocessOptimizationPanel() {
  const [loading, setLoading] = useState(false);
  const [simResult, setSimResult] = useState<import('../../server/bioprocessOptimizationEngine').BioprocessResult | null>(null);
  const [optResult, setOptResult] = useState<{ optimalFeedRates: number[]; maxProduct: number; improvement: number } | null>(null);
  const [activeBioprocessTab, setActiveBioprocessTab] = useState<'kinetics' | 'kla' | 'optimize'>('kinetics');
  const [bpError, setBpError] = useState<string | null>(null);

  // Default bioprocess parameters
  const [muMax, setMuMax] = usePersistedState('nexus-bio:dyncon:bp:muMax', 0.5);
  const [ks, setKs] = usePersistedState('nexus-bio:dyncon:bp:ks', 0.5);
  const [ko, setKo] = usePersistedState('nexus-bio:dyncon:bp:ko', 0.5);
  const [feedConc, setFeedConc] = usePersistedState('nexus-bio:dyncon:bp:feedConc', 200);
  const [feedRate, setFeedRate] = usePersistedState('nexus-bio:dyncon:bp:feedRate', 0.05);
  const [agitation, setAgitation] = usePersistedState('nexus-bio:dyncon:bp:agitation', 300);
  const [aeration, setAeration] = usePersistedState('nexus-bio:dyncon:bp:aeration', 1.0);
  const [duration, setDuration] = usePersistedState('nexus-bio:dyncon:bp:duration', 48);

  const handleSimulate = React.useCallback(async () => {
    setLoading(true);
    try {
      const { simulateFedBatch, optimizeFedBatch } = await import('../../server/bioprocessOptimizationEngine');
      const params = {
        volume: 2, impellerDiameter: 0.08, agitationSpeed: agitation, aerationRate: aeration,
        muMax, ks, ko, kp: 50, yieldCoeff: 0.5, maintenanceCoeff: 0.02,
        productYield: 0.1, productMaintenance: 0.01, deathRate: 0.01,
        temperature: 37, pH: 7.0, dissolvedO2: 100,
        feedConcentration: feedConc, feedRate,
      };
      const sim = simulateFedBatch(params, duration);
      setSimResult(sim);
      const opt = optimizeFedBatch(params, duration, 12);
      setOptResult(opt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bioprocess simulation failed';
      setBpError(msg);
    } finally {
      setLoading(false);
    }
  }, [muMax, ks, ko, feedConc, feedRate, agitation, aeration, duration]);

  // kLa computation for display
  const klaValue = React.useMemo(() => {
    const Np = 6.0, rho = 1000;
    const N = agitation / 60;
    const D = 0.08;
    const power = Np * rho * Math.pow(N, 3) * Math.pow(D, 5);
    const pv = power / (2 * 0.001);
    const Q = aeration * 2 / 60;
    const rD = Math.pow(2 * 4 / (Math.PI * 3), 1 / 3);
    const A = Math.PI * Math.pow(rD / 100, 2) / 4;
    const vs = Q * 1e-3 / Math.max(A, 0.001);
    return 0.02 * Math.pow(pv, 0.4) * Math.pow(vs, 0.5) * Math.pow(0.001, -0.5);
  }, [agitation, aeration]);

  const bioprocessSubTabs = [
    { id: 'kinetics', label: 'Kinetics', accent: THEME.MINT },
    { id: 'kla', label: 'kLa / O₂', accent: THEME.SKY },
    { id: 'optimize', label: 'Optimize', accent: THEME.APRICOT },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', overflow: 'auto' }}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {bioprocessSubTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveBioprocessTab(tab.id)}
            style={{
              padding: '6px 12px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
              fontWeight: activeBioprocessTab === tab.id ? 700 : 400,
              background: activeBioprocessTab === tab.id ? `${tab.accent}20` : 'transparent',
              color: activeBioprocessTab === tab.id ? tab.accent : LABEL,
              border: `1px solid ${activeBioprocessTab === tab.id ? `${tab.accent}60` : BORDER}`,
              borderRadius: 'var(--nb-radius-sm)', cursor: 'pointer', transition: 'all 150ms ease',
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSimulate}
          disabled={loading}
          style={{
            padding: '6px 14px', borderRadius: 'var(--nb-radius-sm)',
            background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(191,220,205,0.14)',
            border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : 'rgba(191,220,205,0.3)'}`,
            color: loading ? 'rgba(255,255,255,0.35)' : 'rgba(191,220,205,0.9)',
            fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Simulating...' : 'Run Simulation'}
        </button>
      </div>

      {bpError && <SimErrorBanner message={bpError} onRetry={() => setBpError(null)} />}

      {/* Parameters */}
      <ParameterPanel title="Bioprocess Parameters" onReset={() => {
        setMuMax(0.5); setKs(0.5); setKo(0.5); setFeedConc(200); setFeedRate(0.05);
        setAgitation(300); setAeration(1.0); setDuration(48);
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <ParamSlider label="μ_max" value={muMax} min={0.1} max={1.5} step={0.05} onChange={setMuMax} unit="h⁻¹" />
          <ParamSlider label="Ks" value={ks} min={0.1} max={5.0} step={0.1} onChange={setKs} unit="g/L" />
          <ParamSlider label="Ko" value={ko} min={0.1} max={2.0} step={0.1} onChange={setKo} unit="% sat." />
          <ParamSlider label="Feed Conc" value={feedConc} min={50} max={400} step={10} onChange={setFeedConc} unit="g/L" />
          <ParamSlider label="Feed Rate" value={feedRate} min={0.001} max={0.2} step={0.005} onChange={setFeedRate} unit="L/h" />
          <ParamSlider label="Agitation" value={agitation} min={100} max={800} step={25} onChange={setAgitation} unit="rpm" />
          <ParamSlider label="Aeration" value={aeration} min={0.1} max={3.0} step={0.1} onChange={setAeration} unit="vvm" />
          <ParamSlider label="Duration" value={duration} min={12} max={120} step={4} onChange={setDuration} unit="h" />
        </div>
      </ParameterPanel>

      {/* Kinetics Tab */}
      {activeBioprocessTab === 'kinetics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...GLASS, padding: '12px' }}>
            <SectionLabel>Structured Kinetics Model</SectionLabel>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, marginBottom: '8px', lineHeight: 1.5 }}>
              Monod kinetics with O₂ limitation and product inhibition (Garcia-Ochoa & Gomez, 2009).
              Growth: μ = μ_max · S/(Ks+S) · O₂/(Ko+O₂) · (1-P/Kp)^n
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {[
                { model: 'Monod', formula: 'S/(Ks+S)', param: `Ks=${ks.toFixed(2)} g/L` },
                { model: 'Contois', formula: 'S/(B·X+S)', param: `B=${(ks / 0.5).toFixed(2)}` },
                { model: 'Tessier', formula: '1-exp(-S/Ks)', param: `Ks=${ks.toFixed(2)} g/L` },
              ].map((m, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`,
                  borderRadius: 'var(--nb-radius-sm)', padding: '8px 10px',
                }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LILAC, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    {m.model}
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>
                    {m.formula}
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: LABEL, marginTop: 2 }}>
                    {m.param}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulation Results */}
          {simResult && (
            <>
              <ResultSummaryPanel
                metrics={[
                  { label: 'Final Biomass', value: simResult.finalBiomass.toFixed(2), unit: 'g/L', accent: THEME.MINT },
                  { label: 'Final Product', value: simResult.finalProduct.toFixed(2), unit: 'g/L', accent: THEME.SKY },
                  { label: 'Productivity', value: simResult.productivity.toFixed(3), unit: 'g/L/h', accent: THEME.APRICOT },
                  { label: 'Yield', value: simResult.yield.toFixed(3), unit: 'g/g', accent: THEME.LILAC },
                ]}
              />
              {/* Time-series mini chart */}
              <div style={{ ...GLASS, padding: '12px' }}>
                <SectionLabel>Fed-Batch Trajectory</SectionLabel>
                <svg width="100%" viewBox="0 0 560 180" style={{ display: 'block' }}>
                  {(() => {
                    const W = 560, H = 180, PAD = 30;
                    const ts = simResult.timeSeries;
                    if (ts.length < 2) return null;
                    const tMax = ts[ts.length - 1].time;
                    const xMax = Math.max(0.001, ...ts.map(t => t.biomass));
                    const sMax = Math.max(0.001, ...ts.map(t => t.substrate));
                    const pMax = Math.max(0.001, ...ts.map(t => t.product));
                    const toX = (t: number) => PAD + (t / tMax) * (W - 2 * PAD);
                    const toY = (v: number, mx: number) => PAD + (1 - v / mx) * (H - 2 * PAD);
                    const mkPath = (key: keyof typeof ts[0], mx: number) =>
                      ts.map((s, i) => `${i === 0 ? 'M' : 'L'}${toX(s.time)},${toY(s[key] as number, mx)}`).join(' ');
                    return (
                      <>
                        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} rx="2" fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
                        <path d={mkPath('biomass', xMax)} fill="none" stroke={THEME.MINT} strokeWidth="1.5" />
                        <path d={mkPath('substrate', sMax)} fill="none" stroke={THEME.SKY} strokeWidth="1.5" />
                        <path d={mkPath('product', pMax)} fill="none" stroke={THEME.APRICOT} strokeWidth="1.5" />
                        {/* Legend */}
                        {[{ l: 'Biomass', c: THEME.MINT }, { l: 'Substrate', c: THEME.SKY }, { l: 'Product', c: THEME.APRICOT }].map((item, i) => (
                          <g key={item.l}>
                            <line x1={PAD + i * 100} y1={H - 8} x2={PAD + i * 100 + 16} y2={H - 8} stroke={item.c} strokeWidth="2" />
                            <text x={PAD + i * 100 + 20} y={H - 5} fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>{item.l}</text>
                          </g>
                        ))}
                        <text x={PAD} y={14} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>Time (h)</text>
                      </>
                    );
                  })()}
                </svg>
              </div>
              {simResult.recommendations.length > 0 && (
                <div style={{ ...GLASS, padding: '12px', borderLeft: `3px solid ${THEME.APRICOT}` }}>
                  <SectionLabel>Recommendations</SectionLabel>
                  {simResult.recommendations.map((r, i) => (
                    <div key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.7)', padding: '2px 0' }}>
                      • {r}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* kLa Tab */}
      {activeBioprocessTab === 'kla' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...GLASS, padding: '12px' }}>
            <SectionLabel>kLa Correlation (van&apos;t Riet, 1979)</SectionLabel>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, marginBottom: '8px', lineHeight: 1.5 }}>
              kLa = a · (P/V)^b · v_s^c · μ_app^d — volumetric oxygen transfer coefficient for stirred-tank bioreactors.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
              <MetricCard label="kLa" value={klaValue.toFixed(2)} unit="h⁻¹" highlight />
              <MetricCard label="Agitation" value={agitation} unit="rpm" />
              <MetricCard label="Aeration" value={aeration} unit="vvm" />
              {simResult && <MetricCard label="OTR" value={simResult.oxygenTransferRate} unit="mmol/L/h" />}
            </div>
          </div>
          <div style={{ ...GLASS, padding: '12px' }}>
            <SectionLabel>Empirical Coefficients</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { sym: 'a', val: '0.02', desc: 'van\'t Riet (coalescing)' },
                { sym: 'b', val: '0.4', desc: 'Power number exponent' },
                { sym: 'c', val: '0.5', desc: 'Gas velocity exponent' },
                { sym: 'd', val: '-0.5', desc: 'Viscosity exponent' },
              ].map((c, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`,
                  borderRadius: 'var(--nb-radius-sm)', padding: '8px', textAlign: 'center',
                }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', color: THEME.SKY, fontWeight: 700 }}>{c.sym}={c.val}</div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: LABEL, marginTop: 2 }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
          {simResult && (
            <div style={{ ...GLASS, padding: '12px' }}>
              <SectionLabel>Agitation Power</SectionLabel>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: VALUE }}>
                P/V = {simResult.agitationPower.toFixed(2)} W/L
              </div>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, marginTop: 4 }}>
                Rushton turbine (Np=6.0) · Impeller D=0.08 m · Volume=2 L
              </div>
            </div>
          )}
        </div>
      )}

      {/* Optimize Tab */}
      {activeBioprocessTab === 'optimize' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...GLASS, padding: '12px' }}>
            <SectionLabel>Pontryagin Maximum Principle (Grid Search)</SectionLabel>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, lineHeight: 1.5 }}>
              Exhaustive feed-rate optimization via grid search over {12} candidate rates. Selects the constant feed rate
              that maximizes final product concentration. Full Pontryagin costate equations approximate via
              discrete enumeration (Lim & Shin, 1989).
            </div>
          </div>
          {optResult ? (
            <>
              <ResultSummaryPanel
                metrics={[
                  { label: 'Max Product', value: optResult.maxProduct.toFixed(2), unit: 'g/L', accent: THEME.MINT, trend: 'up' },
                  { label: 'Improvement', value: `+${(optResult.improvement * 100).toFixed(1)}%`, accent: THEME.APRICOT, trend: optResult.improvement > 0 ? 'up' : 'flat' },
                  { label: 'Optimal Feed', value: optResult.optimalFeedRates[0]?.toFixed(3) ?? '—', unit: 'L/h', accent: THEME.SKY },
                ]}
              />
              <div style={{ ...GLASS, padding: '12px' }}>
                <SectionLabel>Optimal Feed Rate Trajectory</SectionLabel>
                <svg width="100%" viewBox="0 0 560 100" style={{ display: 'block' }}>
                  {(() => {
                    const W = 560, H = 100, PAD = 30;
                    const rates = optResult.optimalFeedRates;
                    if (rates.length < 1) return null;
                    const rMax = Math.max(0.001, ...rates);
                    const pts = rates.map((r, i) => {
                      const x = PAD + (i / Math.max(1, rates.length - 1)) * (W - 2 * PAD);
                      const y = PAD + (1 - r / rMax) * (H - 2 * PAD);
                      return `${x},${y}`;
                    });
                    return (
                      <>
                        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} rx="2" fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
                        <polyline points={pts.join(' ')} fill="none" stroke={THEME.MINT} strokeWidth="2" />
                        <text x={PAD} y={14} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>Optimal feed rate (constant)</text>
                        <text x={PAD} y={H - 6} fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>0h</text>
                        <text x={W - PAD} y={H - 6} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>{rates.length}h</text>
                      </>
                    );
                  })()}
                </svg>
              </div>
            </>
          ) : (
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: LABEL, padding: '20px', textAlign: 'center' }}>
              Run simulation first to compute optimal feed rates.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Bioreactor Analytics Panel ──────────────────────────────────────────── */

function BioreactorAnalyticsPanel() {
  const [readings, setReadings] = useState(20);
  const [result, setResult] = useState<import('../../server/bioreactorAnalyticsEngine').BioreactorAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [baError, setBaError] = useState<string | null>(null);

  const handleRun = React.useCallback(async () => {
    setLoading(true);
    try {
      const { analyzeBioreactorData } = await import('../../server/bioreactorAnalyticsEngine');
      // Generate synthetic batch data
      const data = Array.from({ length: readings }, (_, i) => ({
        time: i * 0.5,
        biomass: 0.1 * Math.exp(0.15 * i),
        substrate: Math.max(0, 10 - 0.3 * i),
        product: 0.04 * i,
        dissolvedO2: 80 - i * 0.5,
        pH: 7.0,
        temperature: 37,
      }));
      const res = analyzeBioreactorData(data);
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bioreactor analytics failed';
      setBaError(msg);
    } finally {
      setLoading(false);
    }
  }, [readings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Batch Data Points
        </span>
        <input type="number" min={10} max={200} value={readings}
          onChange={(e) => setReadings(Number(e.target.value))}
          style={{ width: 60, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', outline: 'none' }}
        />
        <button onClick={handleRun} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Analyzing...' : 'Run Analytics'}
        </button>
        {result && (
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.4)' }}>
            {result.anomalies.length} anomalies • {result.phases.length} phases • μmax={result.kinetics.muMax}
          </span>
        )}
      </div>

      {baError && <SimErrorBanner message={baError} onRetry={() => setBaError(null)} />}

      {result && (
        <>
          {/* Growth phases */}
          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Growth Phases</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {result.phases.map((p, i) => (
                <span key={i} style={{
                  padding: '3px 8px',
                  background: p.phase === 'exponential' ? 'rgba(147,203,82,0.1)' : p.phase === 'stationary' ? 'rgba(200,216,232,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${p.phase === 'exponential' ? 'rgba(147,203,82,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '3px',
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  color: p.phase === 'exponential' ? 'rgba(147,203,82,0.8)' : 'rgba(255,255,255,0.5)',
                }}>
                  {p.phase} ({p.duration.toFixed(1)}h)
                  {p.growthRate !== undefined && ` μ=${p.growthRate}`}
                </span>
              ))}
            </div>
          </div>

          {/* Kinetics */}
          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, border: `1px solid ${THEME.BORDER}` }}>
            {[
              { label: 'μmax', value: `${result.kinetics.muMax} h⁻¹`, color: THEME.MINT },
              { label: 'Ks', value: `${result.kinetics.ks} g/L`, color: THEME.SKY },
              { label: 'Yxs', value: `${result.kinetics.yieldCoeff} g/g`, color: THEME.APRICOT },
              { label: 'R²', value: result.kinetics.r2.toString(), color: result.kinetics.r2 > 0.8 ? 'rgba(147,203,82,0.7)' : 'rgba(250,128,114,0.7)' },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>{m.label}</div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: m.color, fontWeight: 600 }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Recommendations</div>
              {result.recommendations.map((r, i) => (
                <div key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  • {r}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
