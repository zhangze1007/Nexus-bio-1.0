'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
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

/* ── Design Tokens ─────────────────────────────────────────────────────────── */
const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";
const PANEL_BG = '#10131a';
const BORDER = 'rgba(255,255,255,0.06)';
const LABEL = 'rgba(255,255,255,0.28)';
const VALUE = 'rgba(255,255,255,0.65)';

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  backdropFilter: 'blur(10px)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

/* ── Series definitions (6 state variables) ────────────────────────────────── */
const SERIES = [
  { key: 'biomass',       label: 'Biomass',   color: 'rgba(120,200,255,0.8)',  unit: 'g/L' },
  { key: 'substrate',     label: 'Substrate', color: 'rgba(255,200,80,0.8)',   unit: 'g/L' },
  { key: 'product',       label: 'Product',   color: 'rgba(120,255,180,0.8)',  unit: 'g/L' },
  { key: 'dissolvedO2',   label: 'DO₂',       color: 'rgba(200,120,255,0.7)',  unit: 'sat.' },
  { key: 'fpp',           label: 'FPP',       color: '#FAEDCB',               unit: 'μM' },
  { key: 'adsExpression', label: 'ADS Expr',  color: '#C9E4DE',               unit: 'a.u.' },
] as const;

/* ── Time-Series SVG (6 series) ────────────────────────────────────────────── */
function TimeSeriesSVG({ trajectory, setpoint }: { trajectory: ODEState[]; setpoint: number }) {
  if (trajectory.length < 2) return null;
  const W = 420, H = 300, PAD = 40;

  const maxValues: Record<string, number> = {};
  SERIES.forEach(s => {
    maxValues[s.key] = Math.max(
      0.001,
      ...trajectory.map(t => {
        const v = t[s.key as keyof ODEState];
        return (typeof v === 'number' ? v : 0);
      }),
    );
  });

  function normalize(val: number, key: string) {
    const m = maxValues[key] ?? 1;
    return m > 0 ? val / m : 0;
  }

  const tMax = trajectory[trajectory.length - 1].time;

  function toSVG(t: ODEState, key: string) {
    const raw = t[key as keyof ODEState];
    const v = typeof raw === 'number' ? raw : 0;
    const x = PAD + (t.time / tMax) * (W - PAD);
    const y = H - PAD - normalize(v, key) * (H - PAD * 2);
    return `${x},${y}`;
  }

  const spNorm = normalize(setpoint, 'dissolvedO2');
  const spY = H - PAD - spNorm * (H - PAD * 2);

  return (
    <svg viewBox={`0 0 ${W + 100} ${H + 20}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W + 100} height={H + 20} fill="#0d0f14" />
      {[0.25, 0.5, 0.75, 1.0].map(f => (
        <g key={f}>
          <line x1={PAD} y1={H - PAD - f * (H - PAD * 2)} x2={W} y2={H - PAD - f * (H - PAD * 2)}
            stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          <text x={PAD - 4} y={H - PAD - f * (H - PAD * 2) + 4} fontFamily={MONO} fontSize="8"
            textAnchor="end" fill="rgba(255,255,255,0.2)">{(f * 100).toFixed(0)}%</text>
        </g>
      ))}
      {/* DO₂ setpoint dashed line */}
      <line x1={PAD} y1={spY} x2={W} y2={spY}
        stroke="rgba(200,120,255,0.3)" strokeWidth={1} strokeDasharray="4 4" />
      {SERIES.map(s => (
        <polyline key={s.key}
          points={trajectory.map(t => toSVG(t, s.key)).join(' ')}
          fill="none" stroke={s.color} strokeWidth={1.5}
        />
      ))}
      <line x1={PAD} y1={H - PAD} x2={W} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      {[0, 25, 50, 75, 100].map(h => {
        const x = PAD + (h / 100) * (W - PAD);
        return <text key={h} x={x} y={H - PAD + 14} fontFamily={MONO} fontSize="8" textAnchor="middle" fill="rgba(255,255,255,0.2)">{h}h</text>;
      })}
      {SERIES.map((s, i) => (
        <g key={s.key} transform={`translate(${W + 10}, ${20 + i * 20})`}>
          <line x1={0} y1={6} x2={14} y2={6} stroke={s.color} strokeWidth={2} />
          <text x={18} y={10} fontFamily={SANS} fontSize="9" fill="rgba(255,255,255,0.45)">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Hill Feedback Curve (mini SVG) ────────────────────────────────────────── */
function HillCurveSVG({ hill, currentFPP }: { hill: HillParams; currentFPP: number }) {
  const W = 420, H = 100, PAD = 36;
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
    <svg viewBox={`0 0 ${W} ${H + 10}`} style={{ width: '100%', height: '120px' }}>
      <rect width={W} height={H + 10} fill="#0d0f14" />
      {/* axes */}
      <line x1={PAD} y1={H - PAD + 4} x2={W - PAD} y2={H - PAD + 4} stroke="rgba(255,255,255,0.08)" />
      <line x1={PAD} y1={PAD - 8} x2={PAD} y2={H - PAD + 4} stroke="rgba(255,255,255,0.08)" />
      {/* curve */}
      <polyline points={pts.join(' ')} fill="none" stroke="#C9E4DE" strokeWidth={1.8} />
      {/* current FPP marker */}
      <line x1={markerX} y1={PAD - 8} x2={markerX} y2={H - PAD + 4}
        stroke="rgba(250,237,203,0.5)" strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={markerX} cy={H - PAD + 4 - (hillFeedback(Math.min(currentFPP, fppMax), hill) / hill.Vmax) * (H - PAD * 2 + 4)}
        r={3} fill="#FAEDCB" />
      {/* labels */}
      <text x={W / 2} y={H + 6} fontFamily={MONO} fontSize="8" textAnchor="middle" fill={LABEL}>FPP (μM)</text>
      <text x={10} y={(PAD + H - PAD) / 2} fontFamily={MONO} fontSize="8" textAnchor="middle" fill={LABEL}
        transform={`rotate(-90, 10, ${(PAD + H - PAD) / 2})`}>ADS</text>
      <text x={W - PAD} y={H + 6} fontFamily={MONO} fontSize="7" textAnchor="end" fill="rgba(255,255,255,0.15)">200</text>
      <text x={PAD} y={H + 6} fontFamily={MONO} fontSize="7" textAnchor="start" fill="rgba(255,255,255,0.15)">0</text>
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
        <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{value.toFixed(2)}{unit ? ` ${unit}` : ''}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'rgba(120,180,255,0.8)', cursor: 'pointer' }} />
    </div>
  );
}

/* ── Section Header ────────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '16px 0 8px' }}>
      {children}
    </p>
  );
}

/* ── Stat Row (for convergence / burden readouts) ──────────────────────────── */
function StatRow({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontFamily: SANS, fontSize: '10px', color: LABEL }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: VALUE, textAlign: 'right' }}>
        {typeof value === 'number' ? value.toFixed(3) : value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function DynConPage() {
  /* ── PID state ──────────────────────────────────────────────────────────── */
  const [kp, setKp] = useState(DEFAULT_CONTROLLER.kp);
  const [ki, setKi] = useState(DEFAULT_CONTROLLER.ki);
  const [kd, setKd] = useState(DEFAULT_CONTROLLER.kd);
  const [setpoint, setSetpoint] = useState(DEFAULT_CONTROLLER.setpoint);

  /* ── Hill state ─────────────────────────────────────────────────────────── */
  const [vmax, setVmax] = useState(DEFAULT_HILL.Vmax);
  const [hillKd, setHillKd] = useState(DEFAULT_HILL.Kd);
  const [hillN, setHillN] = useState(DEFAULT_HILL.n);

  const hill: HillParams = useMemo(() => ({ Vmax: vmax, Kd: hillKd, n: hillN }), [vmax, hillKd, hillN]);

  /* ── Simulation ─────────────────────────────────────────────────────────── */
  const trajectory = useMemo(() =>
    runBioreactor({ kp, ki, kd, setpoint }, DEFAULT_PARAMS, 100, 1.0, hill),
    [kp, ki, kd, setpoint, hill],
  );

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

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <IDEShell moduleId="dyncon">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: PANEL_BG }}>
        <AlgorithmInsight
          title="Dynamic Control Simulator"
          description="Fed-batch bioreactor with PID-controlled DO₂ and Hill-function negative feedback on ADS expression. RK4 integration."
          formula="f(FPP) = Vmax·Kd^n / (Kd^n + FPP^n)"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* ═══════ LEFT PANEL (260px) ═══════ */}
          <div style={{ width: '260px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: `1px solid ${BORDER}`, background: PANEL_BG }}>
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
                  <span style={{ fontFamily: SANS, fontSize: '10px', color: LABEL }}>RBS Strength</span>
                  <span style={{ fontFamily: MONO, fontSize: '10px', color: VALUE }}>{rbsMapping.rbsStrength.toFixed(2)}</span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${rbsMapping.rbsStrength * 100}%`, borderRadius: '3px', background: '#C9E4DE', transition: 'width 0.3s ease' }} />
                </div>
              </div>
              {/* DNA Sequence */}
              <p style={{ fontFamily: MONO, fontSize: '10px', color: '#C6DEF1', wordBreak: 'break-all', lineHeight: 1.5, margin: '8px 0 0', opacity: 0.85 }}>
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
                <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* ═══════ CENTER (flex) ═══════ */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#0d0f14', display: 'flex', flexDirection: 'column' }}>
            {/* Main time-series plot */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 12px 0' }}>
              <TimeSeriesSVG trajectory={trajectory} setpoint={setpoint} />
            </div>
            {/* Hill feedback mini-curve */}
            <div style={{ flexShrink: 0, padding: '0 12px 8px' }}>
              <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', margin: '4px 0 2px 4px' }}>
                Hill Feedback Curve — f(FPP)
              </p>
              <HillCurveSVG hill={hill} currentFPP={currentFPP} />
            </div>
          </div>

          {/* ═══════ RIGHT PANEL (280px) ═══════ */}
          <div style={{ width: '280px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: `1px solid ${BORDER}`, background: PANEL_BG }}>
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
                  background: convergence.isStable ? 'rgba(80,200,120,0.9)' : 'rgba(255,80,80,0.9)',
                  boxShadow: convergence.isStable ? '0 0 6px rgba(80,200,120,0.4)' : '0 0 6px rgba(255,80,80,0.4)',
                }} />
                <span style={{ fontFamily: SANS, fontSize: '11px', color: convergence.isStable ? 'rgba(80,200,120,0.9)' : 'rgba(255,80,80,0.9)' }}>
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
                  <span style={{ fontFamily: SANS, fontSize: '10px', color: LABEL }}>Burden Index</span>
                  <span style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: VALUE }}>{burden.burdenIndex.toFixed(3)}</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '4px', transition: 'width 0.3s ease',
                    width: `${Math.min(1, burden.burdenIndex) * 100}%`,
                    background: burden.burdenIndex < 0.3
                      ? 'rgba(80,200,120,0.8)'
                      : burden.burdenIndex < 0.6
                        ? 'rgba(255,200,80,0.8)'
                        : 'rgba(255,80,80,0.8)',
                  }} />
                </div>
              </div>
              <StatRow label="Protein Cost" value={burden.proteinCost} />
              <StatRow label="ATP Drain" value={burden.atpDrain} unit="mmol/gDW/h" />
              <StatRow label="Growth Penalty" value={burden.growthPenalty} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: burden.isViable ? 'rgba(80,200,120,0.9)' : 'rgba(255,80,80,0.9)',
                  boxShadow: burden.isViable ? '0 0 6px rgba(80,200,120,0.4)' : '0 0 6px rgba(255,80,80,0.4)',
                }} />
                <span style={{ fontFamily: SANS, fontSize: '11px', color: burden.isViable ? 'rgba(80,200,120,0.9)' : 'rgba(255,80,80,0.9)' }}>
                  {burden.isViable ? 'Viable' : 'Non-viable'}
                </span>
              </div>
              <p style={{ fontFamily: SANS, fontSize: '10px', fontStyle: 'italic', color: 'rgba(255,255,255,0.35)', lineHeight: 1.45, margin: '8px 0 0' }}>
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
          <ExportButton label="Export Trajectory JSON" data={trajectory} filename="dyncon-trajectory" format="json" />
          <ExportButton label="Export CSV" data={trajectory} filename="dyncon-trajectory" format="csv" />
        </div>
      </div>
    </IDEShell>
  );
}
