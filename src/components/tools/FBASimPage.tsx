'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { METABOLIC_NODES, FLUX_EDGES, computeFBAResult } from '../../data/mockFBA';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

function ParamSlider({ label, value, min, max, step = 0.5, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(0,0,0,0.55)' }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(0,0,0,0.7)' }}>
          {value.toFixed(1)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
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

function FluxMap({ glucoseUptake, oxygenUptake }: { glucoseUptake: number; oxygenUptake: number }) {
  const result = useMemo(() => computeFBAResult(glucoseUptake, oxygenUptake), [glucoseUptake, oxygenUptake]);
  const maxFlux = Math.max(...result.reactions.map(r => Math.abs(r.flux ?? 0)));

  const nodeMap = Object.fromEntries(METABOLIC_NODES.map(n => [n.id, n]));
  const fluxMap = Object.fromEntries(result.reactions.map(r => [r.id, Math.abs(r.flux ?? 0)]));

  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', maxHeight: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" />
      {FLUX_EDGES.map(edge => {
        const from = nodeMap[edge.from];
        const to = nodeMap[edge.to];
        if (!from || !to) return null;
        const flux = fluxMap[edge.reactionId] ?? edge.baseFlux * glucoseUptake / 10;
        const normalized = flux / maxFlux;
        const strokeW = 1.5 + normalized * 5;
        const color = normalized > 0.6 ? 'rgba(120,220,180,0.85)'
          : normalized > 0.3 ? 'rgba(120,180,255,0.7)'
          : 'rgba(255,255,255,0.2)';
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        return (
          <g key={edge.reactionId}>
            <line x1={from.x + 20} y1={from.y + 20} x2={to.x + 20} y2={to.y + 20}
              stroke={color} strokeWidth={strokeW} strokeLinecap="round"
              style={{ transition: 'stroke-width 0.3s' }} />
            <text x={mx + 28} y={my + 20} fill="rgba(255,255,255,0.4)"
              fontFamily={MONO} fontSize="8" textAnchor="middle">
              {flux.toFixed(1)}
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
        μ = {result.objectiveValue.toFixed(3)} h⁻¹
      </text>
    </svg>
  );
}

export default function FBASimPage() {
  const [glucoseUptake, setGlucoseUptake] = useState(10);
  const [oxygenUptake, setOxygenUptake] = useState(12);
  const [objective, setObjective] = useState<'biomass' | 'atp' | 'product'>('biomass');

  const result = useMemo(() => computeFBAResult(glucoseUptake, oxygenUptake), [glucoseUptake, oxygenUptake]);

  const top5 = [...result.reactions]
    .sort((a, b) => Math.abs(b.flux ?? 0) - Math.abs(a.flux ?? 0))
    .slice(0, 5);

  return (
    <IDEShell moduleId="fbasim">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#F5F7FA' }}>
        <AlgorithmInsight
          title="Flux Balance Analysis"
          description="Linear programming maximizes objective flux subject to stoichiometric constraints and reaction bounds."
          formula="max cᵀv s.t. Sv=0, lb≤v≤ub"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Input panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(0,0,0,0.07)', background: '#FFFFFF' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '0 0 12px' }}>
              Simulation Parameters
            </p>

            <ParamSlider label="Glucose uptake" value={glucoseUptake} min={0} max={20} onChange={setGlucoseUptake} unit="mmol/gDW/h" />
            <ParamSlider label="O₂ uptake" value={oxygenUptake} min={0} max={20} onChange={setOxygenUptake} unit="mmol/gDW/h" />

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '16px 0 8px' }}>
              Objective Function
            </p>
            {(['biomass', 'atp', 'product'] as const).map(opt => (
              <button key={opt} onClick={() => setObjective(opt)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', marginBottom: '4px',
                background: objective === opt ? 'rgba(0,0,0,0.06)' : 'transparent',
                border: `1px solid ${objective === opt ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: '8px',
                color: objective === opt ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.4)',
                fontFamily: SANS, fontSize: '11px', cursor: 'pointer',
              }}>
                {opt === 'biomass' ? 'Max Biomass' : opt === 'atp' ? 'Max ATP' : 'Max Product'}
              </button>
            ))}

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '16px 0 8px' }}>
              Shadow Prices
            </p>
            {Object.entries(result.shadowPrices).map(([met, price]) => (
              <div key={met} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(0,0,0,0.45)' }}>{met}</span>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: price < 0 ? 'rgba(20,100,200,0.8)' : 'rgba(160,100,20,0.8)' }}>
                  {price.toFixed(3)}
                </span>
              </div>
            ))}
          </div>

          {/* Engine view — SVG flux map */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FluxMap glucoseUptake={glucoseUptake} oxygenUptake={oxygenUptake} />
            </div>
          </div>

          {/* Results panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: '1px solid rgba(0,0,0,0.07)', background: '#FFFFFF' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '0 0 12px' }}>
              Results
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="Growth Rate (μ)" value={result.objectiveValue} unit="h⁻¹" highlight />
              <MetricCard label="ATP Yield" value={result.reactions.find(r => r.id === 'ATPM')?.flux ?? 0} unit="mmol/gDW/h" />
              <MetricCard label="Feasible" value={result.feasible ? 'YES' : 'NO'} />
            </div>

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '0 0 8px' }}>
              Top 5 Active Reactions
            </p>
            {top5.map(r => (
              <div key={r.id} style={{
                padding: '6px 8px', marginBottom: '4px',
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(0,0,0,0.6)' }}>{r.id}</span>
                  <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(20,140,80,0.9)' }}>
                    {(r.flux ?? 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(0,0,0,0.35)', marginTop: '2px' }}>{r.name}</div>
                <div style={{ marginTop: '4px', height: '2px', background: 'rgba(0,0,0,0.08)', borderRadius: '1px' }}>
                  <div style={{
                    height: '100%', borderRadius: '1px',
                    width: `${Math.abs((r.flux ?? 0) / (top5[0].flux ?? 1)) * 100}%`,
                    background: 'rgba(20,140,80,0.4)',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export bar */}
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: '#FFFFFF' }}>
          <ExportButton label="Export JSON" data={result} filename="fbasim-result" format="json" />
          <ExportButton label="Export Reactions CSV" data={result.reactions} filename="fbasim-reactions" format="csv" />
        </div>
      </div>
    </IDEShell>
  );
}
