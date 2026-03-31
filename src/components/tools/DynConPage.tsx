'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { runBioreactor, DEFAULT_CONTROLLER, DEFAULT_PARAMS } from '../../data/mockDynCon';
import type { ODEState } from '../../types';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

const SERIES = [
  { key: 'biomass',    label: 'Biomass',   color: 'rgba(120,200,255,0.8)',  unit: 'g/L' },
  { key: 'substrate',  label: 'Substrate', color: 'rgba(255,200,80,0.8)',   unit: 'g/L' },
  { key: 'product',    label: 'Product',   color: 'rgba(120,255,180,0.8)',  unit: 'g/L' },
  { key: 'dissolvedO2',label: 'DO₂',       color: 'rgba(200,120,255,0.7)',  unit: 'sat.' },
] as const;

function TimeSeriesSVG({ trajectory }: { trajectory: ODEState[] }) {
  if (trajectory.length < 2) return null;
  const W = 420, H = 300, PAD = 40;

  const maxValues: Record<string, number> = {};
  SERIES.forEach(s => {
    maxValues[s.key] = Math.max(...trajectory.map(t => t[s.key] as number));
  });

  function normalize(val: number, key: string) {
    const m = maxValues[key] ?? 1;
    return m > 0 ? val / m : 0;
  }

  function toSVG(t: ODEState, key: string) {
    const x = PAD + (t.time / trajectory[trajectory.length - 1].time) * (W - PAD);
    const y = H - PAD - normalize(t[key] as number, key) * (H - PAD * 2);
    return `${x},${y}`;
  }

  return (
    <svg viewBox={`0 0 ${W + 80} ${H + 20}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W + 80} height={H + 20} fill="#0d0f14" />
      {[0.25, 0.5, 0.75, 1.0].map(f => (
        <g key={f}>
          <line x1={PAD} y1={H - PAD - f * (H - PAD * 2)} x2={W} y2={H - PAD - f * (H - PAD * 2)}
            stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          <text x={PAD - 4} y={H - PAD - f * (H - PAD * 2) + 4} fontFamily={MONO} fontSize="8"
            textAnchor="end" fill="rgba(255,255,255,0.2)">{(f * 100).toFixed(0)}%</text>
        </g>
      ))}
      <line x1={PAD} y1={H - PAD - 0.4 * (H - PAD * 2)} x2={W} y2={H - PAD - 0.4 * (H - PAD * 2)}
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
        <g key={s.key} transform={`translate(${W + 10}, ${30 + i * 22})`}>
          <line x1={0} y1={6} x2={16} y2={6} stroke={s.color} strokeWidth={2} />
          <text x={20} y={10} fontFamily={SANS} fontSize="9" fill="rgba(255,255,255,0.45)">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

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

export default function DynConPage() {
  const [kp, setKp] = useState(DEFAULT_CONTROLLER.kp);
  const [ki, setKi] = useState(DEFAULT_CONTROLLER.ki);
  const [kd, setKd] = useState(DEFAULT_CONTROLLER.kd);
  const [setpoint, setSetpoint] = useState(DEFAULT_CONTROLLER.setpoint);

  const trajectory = useMemo(() =>
    runBioreactor({ kp, ki, kd, setpoint }, DEFAULT_PARAMS, 100, 1.0),
    [kp, ki, kd, setpoint]
  );

  const last = trajectory[trajectory.length - 1];
  const productTiter = last?.product ?? 0;
  const productivity = last ? productTiter / last.time : 0;
  const doRmse = useMemo(() => {
    const errors = trajectory.map(t => (t.dissolvedO2 - setpoint) ** 2);
    return Math.sqrt(errors.reduce((a, b) => a + b, 0) / errors.length);
  }, [trajectory, setpoint]);

  return (
    <IDEShell moduleId="dyncon">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#10131a' }}>
        <AlgorithmInsight
          title="Dynamic Control Simulator"
          description="Fed-batch bioreactor with PID-controlled dissolved O₂. Monod kinetics integrated via RK4 at 1h timestep."
          formula="u(t) = Kp·e + Ki·∫e dt + Kd·de/dt"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Input panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#10131a' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
              PID Controller
            </p>
            <ParamSlider label="Kp (Proportional)" value={kp} min={0} max={10} step={0.1} onChange={setKp} />
            <ParamSlider label="Ki (Integral)" value={ki} min={0} max={5} step={0.05} onChange={setKi} />
            <ParamSlider label="Kd (Derivative)" value={kd} min={0} max={2} step={0.02} onChange={setKd} />
            <ParamSlider label="DO₂ Setpoint" value={setpoint} min={0.1} max={1.0} step={0.05} onChange={setSetpoint} unit="sat." />

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '16px 0 8px' }}>
              Bioreactor Parameters
            </p>
            {[
              ['μmax', `${DEFAULT_PARAMS.muMax} h⁻¹`],
              ['Ks', `${DEFAULT_PARAMS.Ks} g/L`],
              ['Yxs', `${DEFAULT_PARAMS.Yxs} g/g`],
              ['kLa', `${DEFAULT_PARAMS.kLa} h⁻¹`],
              ['Feed conc', `${DEFAULT_PARAMS.feedConc} g/L`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Engine view */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <TimeSeriesSVG trajectory={trajectory} />
          </div>

          {/* Results panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#10131a' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
              Process Readouts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Final Product Titer" value={productTiter} unit="g/L" highlight />
              <MetricCard label="Productivity" value={productivity} unit="g/L/h" />
              <MetricCard label="Final Biomass" value={last?.biomass ?? 0} unit="g/L" />
              <MetricCard label="DO₂ RMSE" value={doRmse} unit="sat."
                warning={doRmse > 0.1 ? 'Poor control — adjust Kp/Ki' : undefined} />
              <MetricCard label="Residual Substrate" value={last?.substrate ?? 0} unit="g/L" />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: '#10131a' }}>
          <ExportButton label="Export Trajectory JSON" data={trajectory} filename="dyncon-trajectory" format="json" />
          <ExportButton label="Export CSV" data={trajectory} filename="dyncon-trajectory" format="csv" />
        </div>
      </div>
    </IDEShell>
  );
}
