'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { METABOLIC_NODES, FLUX_EDGES, REACTION_DEFS, runFBA } from '../../data/mockFBA';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

function ParamSlider({ label, value, min, max, step = 0.5, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
          {value.toFixed(1)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'rgba(120,180,255,0.8)', cursor: 'pointer' }}
      />
    </div>
  );
}

const W = 340, H = 640;
const SUBSYSTEM_COLORS: Record<string, string> = {
  Glycolysis: 'rgba(120,200,255,0.7)',
  TCA: 'rgba(120,255,180,0.7)',
  Energy: 'rgba(255,200,80,0.7)',
};

function FluxMap({ glucoseUptake, oxygenUptake, knockouts }: {
  glucoseUptake: number; oxygenUptake: number; knockouts: string[];
}) {
  const result = useMemo(
    () => runFBA(glucoseUptake, oxygenUptake, knockouts),
    [glucoseUptake, oxygenUptake, knockouts],
  );
  const fluxValues = Object.values(result.fluxes).map(Math.abs);
  const maxFlux = Math.max(...fluxValues, 1);

  const nodeMap = Object.fromEntries(METABOLIC_NODES.map(n => [n.id, n]));
  const koSet = new Set(knockouts);

  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', maxHeight: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" />
      {FLUX_EDGES.map(edge => {
        const from = nodeMap[edge.from];
        const to = nodeMap[edge.to];
        if (!from || !to) return null;
        const flux = Math.abs(result.fluxes[edge.reactionId] ?? 0);
        const normalized = flux / maxFlux;
        const isKO = koSet.has(edge.reactionId);
        const color = isKO
          ? 'rgba(255,80,80,0.5)'
          : normalized > 0.6 ? 'rgba(120,220,180,0.85)'
          : normalized > 0.3 ? 'rgba(120,180,255,0.7)'
          : 'rgba(255,255,255,0.2)';
        const strokeW = isKO ? 1 : 1.5 + normalized * 5;
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        return (
          <g key={edge.reactionId}>
            <line x1={from.x + 20} y1={from.y + 20} x2={to.x + 20} y2={to.y + 20}
              stroke={color} strokeWidth={strokeW} strokeLinecap="round"
              strokeDasharray={isKO ? '4 3' : undefined}
              style={{ transition: 'stroke-width 0.3s, stroke 0.3s' }} />
            <text x={mx + 28} y={my + 20} fill={isKO ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.4)'}
              fontFamily={MONO} fontSize="8" textAnchor="middle">
              {isKO ? '—' : flux.toFixed(1)}
            </text>
          </g>
        );
      })}
      {METABOLIC_NODES.map(node => {
        const isActive = hovered === node.id;
        const subsystemColor = SUBSYSTEM_COLORS[node.subsystem] ?? 'rgba(255,255,255,0.5)';
        return (
          <g key={node.id} onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}>
            <circle cx={node.x + 20} cy={node.y + 20} r={isActive ? 18 : 14}
              fill="rgba(255,255,255,0.07)" stroke={subsystemColor}
              strokeWidth={isActive ? 2 : 1}
              style={{ transition: 'all 0.2s' }} />
            <text x={node.x + 20} y={node.y + 25} textAnchor="middle"
              fontFamily={MONO} fontSize="9" fill="rgba(255,255,255,0.85)">
              {node.label}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${W - 90}, 12)`}>
        {Object.entries(SUBSYSTEM_COLORS).map(([name, color], i) => (
          <g key={name} transform={`translate(0,${i * 14})`}>
            <circle cx={5} cy={5} r={4} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1} />
            <text x={14} y={9} fontFamily={SANS} fontSize="8" fill="rgba(255,255,255,0.4)">{name}</text>
          </g>
        ))}
      </g>
      <text x={W / 2} y={H - 10} textAnchor="middle" fontFamily={MONO} fontSize="10" fill="rgba(255,255,255,0.3)">
        μ = {result.growthRate.toFixed(4)} h⁻¹
      </text>
    </svg>
  );
}

export default function FBASimPage() {
  const [glucoseUptake, setGlucoseUptake] = useState(10);
  const [oxygenUptake, setOxygenUptake] = useState(12);
  const [objective, setObjective] = useState<'biomass' | 'atp' | 'product'>('biomass');
  const [knockouts, setKnockouts] = useState<string[]>([]);

  const result = useMemo(
    () => runFBA(glucoseUptake, oxygenUptake, knockouts),
    [glucoseUptake, oxygenUptake, knockouts],
  );

  const top5 = useMemo(() => {
    return REACTION_DEFS
      .map(r => ({ ...r, flux: result.fluxes[r.id] ?? 0 }))
      .sort((a, b) => Math.abs(b.flux) - Math.abs(a.flux))
      .slice(0, 5);
  }, [result]);

  const maxTopFlux = Math.abs(top5[0]?.flux ?? 1) || 1;

  function toggleKO(id: string) {
    setKnockouts(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  }

  return (
    <IDEShell moduleId="fbasim">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#10131a' }}>
        <AlgorithmInsight
          title="Flux Balance Analysis"
          description="Linear programming maximizes objective flux subject to stoichiometric constraints and reaction bounds."
          formula="max cᵀv s.t. Sv=0, lb≤v≤ub"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Input panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#10131a' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
              Simulation Parameters
            </p>

            <ParamSlider label="Glucose uptake" value={glucoseUptake} min={0} max={20} onChange={setGlucoseUptake} unit="mmol/gDW/h" />
            <ParamSlider label="O₂ uptake" value={oxygenUptake} min={0} max={20} onChange={setOxygenUptake} unit="mmol/gDW/h" />

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '16px 0 8px' }}>
              Objective Function
            </p>
            {(['biomass', 'atp', 'product'] as const).map(opt => (
              <button key={opt} onClick={() => setObjective(opt)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', marginBottom: '4px',
                background: objective === opt ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: `1px solid ${objective === opt ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '8px',
                color: objective === opt ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                fontFamily: SANS, fontSize: '11px', cursor: 'pointer',
              }}>
                {opt === 'biomass' ? 'Max Biomass' : opt === 'atp' ? 'Max ATP' : 'Max Product'}
              </button>
            ))}

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '16px 0 8px' }}>
              Gene Knockouts
            </p>
            {REACTION_DEFS.map(r => {
              const isKO = knockouts.includes(r.id);
              return (
                <button key={r.id} onClick={() => toggleKO(r.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '5px 8px', marginBottom: '3px',
                  background: isKO ? 'rgba(255,80,80,0.08)' : 'transparent',
                  border: `1px solid ${isKO ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '6px', cursor: 'pointer',
                }}>
                  <span style={{ fontFamily: MONO, fontSize: '10px', color: isKO ? 'rgba(255,120,120,0.9)' : 'rgba(255,255,255,0.5)' }}>{r.id}</span>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: isKO ? 'rgba(255,80,80,0.7)' : 'rgba(255,255,255,0.12)',
                    flexShrink: 0,
                  }} />
                </button>
              );
            })}
            {knockouts.length > 0 && (
              <button onClick={() => setKnockouts([])} style={{
                display: 'block', width: '100%', marginTop: '6px',
                padding: '5px 8px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
                color: 'rgba(255,255,255,0.3)', fontFamily: SANS, fontSize: '10px', cursor: 'pointer',
              }}>
                Clear all knockouts
              </button>
            )}
          </div>

          {/* Engine view — SVG flux map */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FluxMap glucoseUptake={glucoseUptake} oxygenUptake={oxygenUptake} knockouts={knockouts} />
            </div>
          </div>

          {/* Results panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#10131a' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
              Results
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="Growth Rate (μ)" value={result.growthRate} unit="h⁻¹" highlight />
              <MetricCard label="ATP Yield" value={result.atpYield} unit="mol/mol glc" />
              <MetricCard label="NADH Production" value={result.nadhProduction} unit="mmol/gDW/h" />
              <MetricCard label="Carbon Efficiency" value={result.carbonEfficiency} unit="%" />
              <MetricCard label="Feasible" value={result.feasible ? 'YES' : 'NO'} />
            </div>

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>
              Top 5 Active Reactions
            </p>
            {top5.map(r => (
              <div key={r.id} style={{
                padding: '6px 8px', marginBottom: '4px',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${knockouts.includes(r.id) ? 'rgba(255,80,80,0.2)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: '10px', color: knockouts.includes(r.id) ? 'rgba(255,120,120,0.7)' : 'rgba(255,255,255,0.6)' }}>{r.id}</span>
                  <span style={{ fontFamily: MONO, fontSize: '10px', color: r.flux > 0 ? 'rgba(20,140,80,0.9)' : 'rgba(255,80,80,0.6)' }}>
                    {r.flux.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{r.name}</div>
                <div style={{ marginTop: '4px', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
                  <div style={{
                    height: '100%', borderRadius: '1px',
                    width: `${Math.abs(r.flux / maxTopFlux) * 100}%`,
                    background: knockouts.includes(r.id) ? 'rgba(255,80,80,0.3)' : 'rgba(20,140,80,0.4)',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: '#10131a' }}>
          <ExportButton label="Export JSON" data={result} filename="fbasim-result" format="json" />
          <ExportButton label="Export Fluxes CSV" data={
            REACTION_DEFS.map(r => ({ id: r.id, name: r.name, subsystem: r.subsystem, flux: result.fluxes[r.id] ?? 0, knocked_out: knockouts.includes(r.id) }))
          } filename="fbasim-fluxes" format="csv" />
        </div>
      </div>
    </IDEShell>
  );
}
