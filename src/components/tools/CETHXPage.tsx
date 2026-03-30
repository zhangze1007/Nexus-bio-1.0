'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { PATHWAY_STEPS, computeThermo } from '../../data/mockCETHX';
import type { PathwayKey } from '../../data/mockCETHX';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

function WaterfallChart({ steps, tempC, pH }: { steps: ReturnType<typeof computeThermo>['steps']; tempC: number; pH: number }) {
  const W = 420, H = 280, PAD = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minG = Math.min(0, ...steps.map(s => s.cumulative));
  const maxG = Math.max(0, ...steps.map(s => s.cumulative), ...steps.map(s => s.deltaG));
  const range = maxG - minG || 1;

  function yPos(v: number) { return PAD.top + innerH - ((v - minG) / range) * innerH; }
  const barW = Math.max(8, innerW / steps.length - 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" />

      {/* Zero line */}
      <line x1={PAD.left} y1={yPos(0)} x2={W - PAD.right} y2={yPos(0)}
        stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

      {/* Cumulative step line */}
      <polyline
        points={steps.map((s, i) => {
          const x = PAD.left + (i / steps.length) * innerW + barW / 2;
          return `${x},${yPos(s.cumulative)}`;
        }).join(' ')}
        fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="4 2"
      />

      {/* Bars */}
      {steps.map((step, i) => {
        const x = PAD.left + (i / steps.length) * innerW;
        const isNeg = step.deltaG < 0;
        const yTop = isNeg ? yPos(step.deltaG + (steps[i - 1]?.cumulative ?? 0)) : yPos(steps[i - 1]?.cumulative ?? 0);
        const barH = Math.abs(yPos(step.deltaG) - yPos(0));
        const color = step.atpYield > 0
          ? 'rgba(255,200,80,0.7)'
          : isNeg ? 'rgba(120,220,180,0.6)' : 'rgba(255,100,100,0.5)';
        return (
          <g key={i}>
            <rect x={x + 2} y={Math.min(yPos(step.cumulative), yPos(step.cumulative - step.deltaG))}
              width={barW - 2}
              height={Math.abs(yPos(step.cumulative) - yPos(step.cumulative - step.deltaG))}
              fill={color} rx="1" />
            <text x={x + barW / 2} y={H - 8} textAnchor="middle"
              fontFamily={MONO} fontSize="7" fill="rgba(255,255,255,0.3)"
              transform={`rotate(-45,${x + barW / 2},${H - 8})`}>
              {step.step.slice(0, 8)}
            </text>
          </g>
        );
      })}

      {/* Y axis */}
      {[-40, -20, 0, 20].map(v => v >= minG && v <= maxG ? (
        <g key={v}>
          <line x1={PAD.left - 4} y1={yPos(v)} x2={PAD.left} y2={yPos(v)} stroke="rgba(255,255,255,0.15)" />
          <text x={PAD.left - 6} y={yPos(v) + 4} textAnchor="end" fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.25)">
            {v}
          </text>
        </g>
      ) : null)}

      <text x={10} y={H / 2} textAnchor="middle" fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.25)"
        transform={`rotate(-90,10,${H / 2})`}>ΔG (kJ/mol)</text>

      {/* Legend */}
      {[
        { color: 'rgba(120,220,180,0.6)', label: 'Exergonic' },
        { color: 'rgba(255,100,100,0.5)', label: 'Endergonic' },
        { color: 'rgba(255,200,80,0.7)',  label: 'ATP step' },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.left + i * 90},${PAD.top - 8})`}>
          <rect width={10} height={8} rx="1" fill={l.color} />
          <text x={14} y={8} fontFamily={SANS} fontSize="8" fill="rgba(255,255,255,0.35)">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

const PATHWAYS: { id: PathwayKey; label: string }[] = [
  { id: 'glycolysis', label: 'Glycolysis' },
  { id: 'tca',        label: 'TCA Cycle' },
  { id: 'ppp',        label: 'Pentose Phosphate' },
];

export default function CETHXPage() {
  const [pathway, setPathway] = useState<PathwayKey>('glycolysis');
  const [tempC, setTempC] = useState(37);
  const [pH, setPH] = useState(7.4);

  const thermo = useMemo(() =>
    computeThermo(PATHWAY_STEPS[pathway], tempC, pH),
    [pathway, tempC, pH]
  );

  return (
    <IDEShell moduleId="cethx">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#0a0c10' }}>
        <AlgorithmInsight
          title="Cell Thermodynamics Engine"
          description="ΔG° values corrected for temperature and pH via Van't Hoff. ATP yield and NADH/FADH₂ tallied per pathway step."
          formula="ΔG' = ΔG° · (T/298) + ΔpH · RT·ln10"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Input panel */}
          <div style={{ width: '220px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#0a0c10' }}>
            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 12px' }}>
              Pathway
            </p>
            {PATHWAYS.map(p => (
              <button key={p.id} onClick={() => setPathway(p.id)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', marginBottom: '5px',
                background: pathway === p.id ? 'rgba(255,255,255,0.07)' : 'transparent',
                border: `1px solid ${pathway === p.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '3px',
                color: pathway === p.id ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)',
                fontFamily: SANS, fontSize: '11px', cursor: 'pointer',
              }}>
                {p.label}
              </button>
            ))}

            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '16px 0 8px' }}>
              Conditions
            </p>
            {[
              { label: 'Temperature', value: tempC, min: 20, max: 60, step: 1, unit: '°C', onChange: setTempC },
              { label: 'pH', value: pH, min: 5.5, max: 9.0, step: 0.1, unit: '', onChange: setPH },
            ].map(s => (
              <div key={s.label} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{s.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.75)' }}>{s.value.toFixed(1)}{s.unit}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.onChange(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'rgba(255,255,255,0.6)' }} />
              </div>
            ))}

            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '16px 0 8px' }}>
              Steps
            </p>
            {thermo.steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontFamily: SANS, fontSize: '9px', color: 'rgba(255,255,255,0.35)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.step}
                </span>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: s.deltaG < 0 ? 'rgba(120,220,180,0.7)' : 'rgba(255,100,100,0.7)' }}>
                  {s.deltaG > 0 ? '+' : ''}{s.deltaG.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          {/* Engine view — waterfall */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <WaterfallChart steps={thermo.steps} tempC={tempC} pH={pH} />
          </div>

          {/* Results panel */}
          <div style={{ width: '220px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#0a0c10' }}>
            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 12px' }}>
              Thermodynamics
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Net ATP Yield" value={thermo.atp_yield} unit="mol/mol" highlight />
              <MetricCard label="NADH Yield" value={thermo.nadh_yield} unit="mol/mol" />
              <MetricCard label="ΔG Total" value={thermo.gibbs_free_energy} unit="kJ/mol" />
              <MetricCard label="Entropy Production" value={thermo.entropy_production.toFixed(3)} unit="kJ/mol/K" />
              <MetricCard label="Efficiency" value={thermo.efficiency.toFixed(1)} unit="%" />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <ExportButton label="Export JSON" data={thermo} filename="cethx-thermodynamics" format="json" />
          <ExportButton label="Export Steps CSV" data={thermo.steps} filename="cethx-steps" format="csv" />
        </div>
      </div>
    </IDEShell>
  );
}
