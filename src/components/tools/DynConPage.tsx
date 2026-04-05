'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import DemoBanner from '../ide/shared/DemoBanner';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import ScientificHero from './shared/ScientificHero';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { usePersistedState } from '../ide/shared/usePersistedState';
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
const PANEL_BG = '#000000';
const BORDER = 'rgba(255,255,255,0.06)';
const LABEL = 'rgba(255,255,255,0.45)';
const VALUE = 'rgba(255,255,255,0.65)';

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
};

/* ── Series definitions (6 state variables) ────────────────────────────────── */
const SERIES = [
  { key: 'biomass',       label: 'Biomass',   color: 'rgba(81,81,205,0.8)',  unit: 'g/L' },
  { key: 'substrate',     label: 'Substrate', color: 'rgba(255,139,31,0.8)',   unit: 'g/L' },
  { key: 'product',       label: 'Product',   color: 'rgba(120,255,180,0.8)',  unit: 'g/L' },
  { key: 'dissolvedO2',   label: 'DO₂',       color: 'rgba(95,68,74,0.7)',  unit: 'sat.' },
  { key: 'fpp',           label: 'FPP',       color: '#FFFB1F',               unit: 'μM' },
  { key: 'adsExpression', label: 'ADS Expr',  color: '#F0FDFA',               unit: 'a.u.' },
] as const;

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
    {
      key: 'product',
      label: 'Product',
      color: 'rgba(120,255,180,0.92)',
      max: Math.max(0.001, ...trajectory.map((point) => point.product)),
      unit: 'g/L',
    },
    {
      key: 'biomass',
      label: 'Biomass',
      color: 'rgba(81,81,205,0.92)',
      max: Math.max(0.001, ...trajectory.map((point) => point.biomass)),
      unit: 'g/L',
    },
    {
      key: 'substrate',
      label: 'Substrate',
      color: 'rgba(255,139,31,0.92)',
      max: Math.max(0.001, ...trajectory.map((point) => point.substrate)),
      unit: 'g/L',
    },
    {
      key: 'dissolvedO2',
      label: 'DO₂',
      color: 'rgba(95,68,74,0.9)',
      max: 1,
      unit: 'sat.',
    },
    {
      key: 'fpp',
      label: 'FPP',
      color: '#FFFB1F',
      max: Math.max(0.001, ...trajectory.map((point) => point.fpp)),
      unit: 'μM',
    },
    {
      key: 'adsExpression',
      label: 'ADS',
      color: '#F0FDFA',
      max: Math.max(0.001, ...trajectory.map((point) => point.adsExpression)),
      unit: 'a.u.',
    },
  ] as const;

  const tMax = trajectory[trajectory.length - 1].time;
  const plotWidth = W - PAD_X - 28;

  function laneY(index: number) {
    return plotTop + index * (laneH + laneGap);
  }

  function normalize(value: number, max: number) {
    return max > 0 ? value / max : 0;
  }

  function toPoint(t: ODEState, laneIndex: number, key: keyof ODEState, max: number) {
    const raw = t[key];
    const value = typeof raw === 'number' ? raw : 0;
    const x = PAD_X + (t.time / tMax) * plotWidth;
    const y = laneY(laneIndex) + laneH - normalize(value, max) * laneH;
    return `${x},${y}`;
  }

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
        const points = trajectory.map((point) => toPoint(point, index, lane.key, lane.max)).join(' ');
        const lastValue = trajectory[trajectory.length - 1][lane.key] as number;
        const markerX = PAD_X + plotWidth;
        const markerY = y + laneH - normalize(lastValue, lane.max) * laneH;
        const setpointY = lane.key === 'dissolvedO2'
          ? y + laneH - normalize(setpoint, lane.max) * laneH
          : null;
        const toxicityY = lane.key === 'fpp'
          ? y + laneH - normalize(DEFAULT_PARAMS.fppToxicThreshold, lane.max) * laneH
          : null;

        return (
          <g key={lane.key}>
            <rect x={PAD_X} y={y} width={plotWidth} height={laneH} rx="12" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" />
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={fraction}
                x1={PAD_X}
                y1={y + laneH - fraction * laneH}
                x2={PAD_X + plotWidth}
                y2={y + laneH - fraction * laneH}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
            ))}
            {setpointY !== null ? (
              <>
                <rect x={PAD_X} y={setpointY - 6} width={plotWidth} height={12} fill="rgba(95,68,74,0.08)" />
                <line x1={PAD_X} y1={setpointY} x2={PAD_X + plotWidth} y2={setpointY} stroke="rgba(95,68,74,0.45)" strokeDasharray="4 4" />
              </>
            ) : null}
            {toxicityY !== null ? (
              <line x1={PAD_X} y1={toxicityY} x2={PAD_X + plotWidth} y2={toxicityY} stroke="rgba(255,49,49,0.35)" strokeDasharray="5 4" />
            ) : null}
            <polyline points={points} fill="none" stroke={lane.color} strokeWidth="2" />
            <circle cx={markerX} cy={markerY} r="4" fill={lane.color} />
            <text x="20" y={y + 14} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.24)">
              {lane.label}
            </text>
            <text x="20" y={y + 28} fontFamily={T.SANS} fontSize="10" fill="rgba(255,255,255,0.62)">
              {(lastValue ?? 0).toFixed(lane.key === 'fpp' ? 1 : 2)} {lane.unit}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + 14} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
              {lane.max.toFixed(lane.key === 'fpp' ? 0 : 1)}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + laneH} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.16)">
              0
            </text>
          </g>
        );
      })}

      {[0, 25, 50, 75, 100].map((tick) => {
        const x = PAD_X + (tick / 100) * plotWidth;
        return (
          <g key={tick}>
            <line x1={x} y1={plotTop + lanes.length * (laneH + laneGap) - laneGap} x2={x} y2={plotTop + lanes.length * (laneH + laneGap) - laneGap + 6} stroke="rgba(255,255,255,0.08)" />
            <text x={x} y={plotTop + lanes.length * (laneH + laneGap) - laneGap + 18} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.22)">
              {tick}h
            </text>
          </g>
        );
      })}
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
      <polyline points={pts.join(' ')} fill="none" stroke="#F0FDFA" strokeWidth={2.2} />
      {/* current FPP marker */}
      <line x1={markerX} y1={PAD - 8} x2={markerX} y2={H - PAD + 4}
        stroke="rgba(255,251,31,0.5)" strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={markerX} cy={H - PAD + 4 - (hillFeedback(Math.min(currentFPP, fppMax), hill) / hill.Vmax) * (H - PAD * 2 + 4)}
        r={3} fill="#FFFB1F" />
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

/* ── Param Slider ──────────────────────────────────────────────────────────── */
function ParamSlider({ label, value, min, max, step = 0.1, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: T.SANS, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</span>
        <span style={{ fontFamily: T.MONO, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{value.toFixed(2)}{unit ? ` ${unit}` : ''}</span>
      </div>
      <input aria-label="Parameter slider" type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'rgba(120,180,255,0.8)', cursor: 'pointer' }} />
    </div>
  );
}

/* ── Section Header ────────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '16px 0 8px' }}>
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
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: PANEL_BG, minHeight: '100%', flex: 1 }}>
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
            <div role="status" style={{ padding: '6px 14px', background: 'rgba(74,124,255,0.06)', border: '1px solid rgba(74,124,255,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontFamily: T.MONO, fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(74,124,255,0.12)', border: '1px solid rgba(74,124,255,0.28)', color: 'rgba(120,170,255,0.95)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                FBASim
              </span>
              <span style={{ fontFamily: T.SANS, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
                {'✓ Flux data loaded — '}
                <span style={{ fontFamily: T.MONO, color: 'rgba(120,170,255,0.85)' }}>
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
              <p style={{ fontFamily: T.MONO, fontSize: '10px', color: '#5151CD', wordBreak: 'break-all', lineHeight: 1.5, margin: '8px 0 0', opacity: 0.85 }}>
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
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <span style={{ fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                <span style={{ fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* ═══════ CENTER (flex) ═══════ */}
          <div className="nb-tool-center" style={{ flex: 1, background: '#050505', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Main time-series plot */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 12px 0' }}>
              <TimeSeriesSVG trajectory={trajectory} setpoint={setpoint} svgRef={chartRef} />
            </div>
            {/* Hill feedback mini-curve */}
            <div style={{ flexShrink: 0, padding: '0 12px 8px' }}>
              <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', margin: '4px 0 2px 4px' }}>
                Hill Feedback Curve — f(FPP)
              </p>
              <HillCurveSVG hill={hill} currentFPP={currentFPP} />
            </div>
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
                  background: convergence.isStable ? '#39FF14' : '#FF3131',
                  boxShadow: convergence.isStable ? '0 0 6px rgba(57,255,20,0.4)' : '0 0 6px rgba(255,49,49,0.4)',
                }} />
                <span style={{ fontFamily: T.SANS, fontSize: '11px', color: convergence.isStable ? '#39FF14' : '#FF3131' }}>
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
                      ? '#39FF14'
                      : burden.burdenIndex < 0.6
                        ? PATHD_THEME.progressGradient
                        : '#FF3131',
                    boxShadow: burden.burdenIndex < 0.3
                      ? '0 0 6px rgba(57,255,20,0.3)'
                      : burden.burdenIndex < 0.6
                        ? PATHD_THEME.progressGlow
                        : '0 0 6px rgba(255,49,49,0.3)',
                  }} />
                </div>
              </div>
              <StatRow label="Protein Cost" value={burden.proteinCost} />
              <StatRow label="ATP Drain" value={burden.atpDrain} unit="mmol/gDW/h" />
              <StatRow label="Growth Penalty" value={burden.growthPenalty} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: burden.isViable ? '#39FF14' : '#FF3131',
                  boxShadow: burden.isViable ? '0 0 6px rgba(57,255,20,0.4)' : '0 0 6px rgba(255,49,49,0.4)',
                }} />
                <span style={{ fontFamily: T.SANS, fontSize: '11px', color: burden.isViable ? '#39FF14' : '#FF3131' }}>
                  {burden.isViable ? 'Viable' : 'Non-viable'}
                </span>
              </div>
              <p style={{ fontFamily: T.SANS, fontSize: '10px', fontStyle: 'italic', color: 'rgba(255,255,255,0.35)', lineHeight: 1.45, margin: '8px 0 0' }}>
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
