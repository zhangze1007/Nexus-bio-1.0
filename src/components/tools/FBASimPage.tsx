'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { usePersistedState } from '../ide/shared/usePersistedState';
import { useUIStore } from '../../store/uiStore';
import {
  METABOLIC_NODES, FLUX_EDGES, REACTION_DEFS, runFBA,
  YEAST_NODES, YEAST_FLUX_EDGES, YEAST_REACTION_DEFS, SHARED_METABOLITES,
  calculateCommunityFlux,
} from '../../data/mockFBA';
import type { FBAOutput, CommunityFBAOutput } from '../../data/mockFBA';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';

// ── Pastel palette ──
const COLORS = {
  strainA: '#FF1FFF',
  strainB: '#F0FDFA',
  sharedPool: '#5151CD',
  strainABg: 'rgba(255,31,255,0.06)',
  strainBBg: 'rgba(240,253,250,0.06)',
  sharedBg: 'rgba(81,81,205,0.06)',
  strainABorder: 'rgba(255,31,255,0.20)',
  strainBBorder: 'rgba(240,253,250,0.20)',
  sharedBorder: 'rgba(81,81,205,0.20)',
};

type SimMode = 'single' | 'community';

function ParamSlider({ label, value, min, max, step = 0.5, onChange, unit, accentColor }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string; accentColor?: string;
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: T.SANS, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</span>
        <span style={{ fontFamily: T.MONO, fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textAlign: 'right' }}>
          {value.toFixed(1)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input aria-label="Parameter slider" type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: accentColor ?? 'rgba(120,180,255,0.8)', cursor: 'pointer' }}
      />
    </div>
  );
}

const W = 340, H = 640;
const SUBSYSTEM_COLORS: Record<string, string> = {
  Glycolysis: 'rgba(81,81,205,0.7)',
  TCA: 'rgba(120,255,180,0.7)',
  Energy: 'rgba(255,139,31,0.7)',
  Fermentation: 'rgba(255,31,255,0.7)',
};

function FluxMap({ result, nodes, edges, knockouts, compact, svgRef }: {
  result: FBAOutput;
  nodes: typeof METABOLIC_NODES;
  edges: typeof FLUX_EDGES;
  knockouts: string[];
  compact?: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const fluxValues = Object.values(result.fluxes).map(Math.abs);
  const maxFlux = Math.max(...fluxValues, 1);
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const koSet = new Set(knockouts);
  const [hovered, setHovered] = useState<string | null>(null);
  const viewH = compact ? 480 : H;

  return (
    <svg ref={svgRef} role="img" aria-label="Chart" viewBox={`0 0 ${W} ${viewH}`} style={{ width: '100%', height: '100%', maxHeight: '100%' }}>
      <rect width={W} height={viewH} fill="transparent" />
      {edges.map(edge => {
        const from = nodeMap[edge.from];
        const to = nodeMap[edge.to];
        if (!from || !to) return null;
        const flux = Math.abs(result.fluxes[edge.reactionId] ?? 0);
        const normalized = flux / maxFlux;
        const isKO = koSet.has(edge.reactionId);
        const color = isKO ? 'rgba(255,80,80,0.5)'
          : normalized > 0.6 ? 'rgba(147,203,82,0.85)'
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
              fontFamily={T.MONO} fontSize="8" textAnchor="middle">
              {isKO ? '—' : flux.toFixed(1)}
            </text>
          </g>
        );
      })}
      {nodes.map(node => {
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
              fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.85)">
              {node.label}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={viewH - 10} textAnchor="middle" fontFamily={T.MONO} fontSize="10" fill="rgba(255,255,255,0.3)">
        μ = {result.growthRate.toFixed(4)} h⁻¹
      </text>
    </svg>
  );
}

// ── Glassmorphism container ──
function GlassContainer({ children, color, borderColor, style }: {
  children: React.ReactNode;
  color: string;
  borderColor: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      borderRadius: '24px',
      background: color,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: `1px solid ${borderColor}`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Shared Metabolite Bus (animated cross-feeding lines) ──
function SharedMetaboliteBus({ exchangeFluxes }: {
  exchangeFluxes: CommunityFBAOutput['exchangeFluxes'];
}) {
  const maxFlux = Math.max(...exchangeFluxes.map(e => Math.abs(e.flux)), 0.1);

  return (
    <GlassContainer color={COLORS.sharedBg} borderColor={COLORS.sharedBorder}
      style={{ padding: '14px 16px' }}>
      <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: COLORS.sharedPool, margin: '0 0 10px' }}>
        Shared Environmental Pool
      </p>

      <style>{`
        @keyframes flowRight { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
        @keyframes flowLeft  { from { stroke-dashoffset: -24; } to { stroke-dashoffset: 0; } }
      `}</style>

      {exchangeFluxes.map((ex) => {
        const isRightFlow = ex.fromStrain === 'ecoli';
        const normalized = Math.abs(ex.flux) / maxFlux;
        const strokeW = 1.5 + normalized * 3;

        return (
          <div key={ex.id} style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontFamily: T.SANS, fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                {ex.metabolite}
              </span>
              <span style={{
                fontFamily: T.MONO, fontSize: '11px', fontWeight: 600, color: COLORS.sharedPool, textAlign: 'right',
              }}>
                {ex.flux.toFixed(2)} mmol/h
              </span>
            </div>
            <svg role="img" aria-label="Chart" width="100%" height="12" style={{ display: 'block' }}>
              <defs>
                <linearGradient id={`grad-${ex.id}`} x1={isRightFlow ? '0%' : '100%'} y1="0%" x2={isRightFlow ? '100%' : '0%'} y2="0%">
                  <stop offset="0%" stopColor={COLORS.strainA} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={COLORS.strainB} stopOpacity="0.8" />
                </linearGradient>
              </defs>
              <line x1="8" y1="6" x2="100%" y2="6"
                stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <line x1="8" y1="6" x2="100%" y2="6"
                stroke={`url(#grad-${ex.id})`}
                strokeWidth={strokeW}
                strokeDasharray="6 6"
                strokeLinecap="round"
                style={{
                  animation: `${isRightFlow ? 'flowRight' : 'flowLeft'} ${1.5 / Math.max(0.3, normalized)}s linear infinite`,
                  opacity: ex.flux > 0.01 ? 0.85 : 0.2,
                }}
              />
              {/* Direction arrows */}
              <text x={isRightFlow ? '92%' : '4%'} y="10" fontFamily={T.SANS} fontSize="8"
                fill={COLORS.sharedPool} textAnchor="middle">
                {isRightFlow ? '→' : '←'}
              </text>
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span style={{ fontSize: '8px', color: isRightFlow ? COLORS.strainA : COLORS.strainB, fontFamily: T.MONO }}>
                {ex.fromStrain === 'ecoli' ? 'E. coli' : 'S. cerevisiae'}
              </span>
              <span style={{ fontSize: '8px', color: isRightFlow ? COLORS.strainB : COLORS.strainA, fontFamily: T.MONO }}>
                {ex.toStrain === 'ecoli' ? 'E. coli' : 'S. cerevisiae'}
              </span>
            </div>
          </div>
        );
      })}
    </GlassContainer>
  );
}

// ── Strain sidebar panel ──
function StrainPanel({ label, color, borderColor, accentColor, glucoseUptake, oxygenUptake,
  knockouts, reactions, result, onGlucoseChange, onOxygenChange, onToggleKO, onClearKO,
}: {
  label: string; color: string; borderColor: string; accentColor: string;
  glucoseUptake: number; oxygenUptake: number;
  knockouts: string[]; reactions: typeof REACTION_DEFS;
  result: FBAOutput;
  onGlucoseChange: (v: number) => void; onOxygenChange: (v: number) => void;
  onToggleKO: (id: string) => void; onClearKO: () => void;
}) {
  return (
    <GlassContainer color={color} borderColor={borderColor}
      style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: accentColor, margin: '0' }}>
        {label}
      </p>

      <ParamSlider label="Glucose" value={glucoseUptake} min={0} max={20}
        onChange={onGlucoseChange} unit="mmol/gDW/h" accentColor={accentColor} />
      <ParamSlider label="O₂" value={oxygenUptake} min={0} max={20}
        onChange={onOxygenChange} unit="mmol/gDW/h" accentColor={accentColor} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <MetricCard label="Growth Rate (μ)" value={result.growthRate} unit="h⁻¹" highlight />
        <MetricCard label="ATP Yield" value={result.atpYield} unit="mol/mol" />
        <MetricCard label="Carbon Eff." value={result.carbonEfficiency} unit="%" />
      </div>

      <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '6px 0 0' }}>
        Gene Knockouts
      </p>
      <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
        {reactions.map(r => {
          const isKO = knockouts.includes(r.id);
          return (
            <button aria-label="Action" key={r.id} onClick={() => onToggleKO(r.id)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '4px 8px', marginBottom: '2px',
              background: isKO ? 'rgba(255,80,80,0.08)' : 'transparent',
              border: `1px solid ${isKO ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '6px', cursor: 'pointer',
            }}>
              <span style={{ fontFamily: T.MONO, fontSize: '10px', color: isKO ? 'rgba(255,120,120,0.9)' : 'rgba(255,255,255,0.5)' }}>{r.id}</span>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: isKO ? 'rgba(255,80,80,0.7)' : 'rgba(255,255,255,0.12)', flexShrink: 0,
              }} />
            </button>
          );
        })}
      </div>
      {knockouts.length > 0 && (
        <button aria-label="Action" onClick={onClearKO} style={{
          display: 'block', width: '100%', padding: '4px 8px',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '6px', color: 'rgba(255,255,255,0.3)', fontFamily: T.SANS, fontSize: '10px', cursor: 'pointer',
        }}>
          Clear all
        </button>
      )}
    </GlassContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ──
// ═══════════════════════════════════════════════════════════════════════════════

export default function FBASimPage() {
  const [simMode, setSimMode] = useState<SimMode>('single');
  const chartRef = useRef<SVGSVGElement>(null);

  // Single-species state (persisted)
  const [glucoseUptake, setGlucoseUptake] = usePersistedState('nexus-bio:fba:glucose', 10);
  const [oxygenUptake, setOxygenUptake] = usePersistedState('nexus-bio:fba:oxygen', 12);
  const [objective, setObjective] = useState<'biomass' | 'atp' | 'product'>('biomass');
  const [knockouts, setKnockouts] = useState<string[]>([]);

  // Community state (persisted)
  const [ecoliGlucose, setEcoliGlucose] = usePersistedState('nexus-bio:fba:ecoli-glucose', 10);
  const [ecoliOxygen, setEcoliOxygen] = usePersistedState('nexus-bio:fba:ecoli-oxygen', 12);
  const [ecoliKO, setEcoliKO] = useState<string[]>([]);
  const [yeastGlucose, setYeastGlucose] = usePersistedState('nexus-bio:fba:yeast-glucose', 8);
  const [yeastOxygen, setYeastOxygen] = usePersistedState('nexus-bio:fba:yeast-oxygen', 6);
  const [yeastKO, setYeastKO] = useState<string[]>([]);

  // Single-species FBA
  const { data: singleResult, error: singleError } = useMemo(() => {
    try {
      return { data: runFBA(glucoseUptake, oxygenUptake, knockouts), error: null as string | null };
    } catch (e) {
      return { data: runFBA(10, 12, []), error: e instanceof Error ? e.message : 'FBA simulation failed' };
    }
  }, [glucoseUptake, oxygenUptake, knockouts]);

  // Community FBA
  const { data: communityResult, error: communityError } = useMemo<{ data: CommunityFBAOutput; error: string | null }>(() => {
    try {
      return { data: calculateCommunityFlux(ecoliGlucose, ecoliOxygen, ecoliKO, yeastGlucose, yeastOxygen, yeastKO), error: null };
    } catch (e) {
      return { data: calculateCommunityFlux(10, 12, [], 8, 6, []), error: e instanceof Error ? e.message : 'Community FBA failed' };
    }
  }, [ecoliGlucose, ecoliOxygen, ecoliKO, yeastGlucose, yeastOxygen, yeastKO]);

  const top5 = useMemo(() => {
    return REACTION_DEFS
      .map(r => ({ ...r, flux: singleResult.fluxes[r.id] ?? 0 }))
      .sort((a, b) => Math.abs(b.flux) - Math.abs(a.flux))
      .slice(0, 5);
  }, [singleResult]);

  const maxTopFlux = Math.abs(top5[0]?.flux ?? 1) || 1;

  function toggleKO(id: string) {
    setKnockouts(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
  }
  function toggleEcoliKO(id: string) {
    setEcoliKO(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
  }
  function toggleYeastKO(id: string) {
    setYeastKO(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
  }

  const exportData = simMode === 'single' ? singleResult : communityResult;

  /* ── Console logging ─────────────────────────────────────────────────── */
  const appendConsole = useUIStore((s) => s.appendConsole);
  useEffect(() => {
    const error = simMode === 'single' ? singleError : communityError;
    if (error) {
      appendConsole({ level: 'error', module: 'FBASIM', message: `FBA error: ${error}` });
    } else if (simMode === 'single') {
      appendConsole({
        level: 'info',
        module: 'FBASIM',
        message: `FBA complete — μ=${singleResult.growthRate.toFixed(4)} h⁻¹ | ATP=${singleResult.atpYield.toFixed(1)} mol/mol | C-eff=${singleResult.carbonEfficiency.toFixed(1)}% | KO=[${knockouts.join(',')||'none'}]`,
      });
    } else {
      appendConsole({
        level: 'info',
        module: 'FBASIM',
        message: `Community FBA — E.coli μ=${communityResult.ecoli.growthRate.toFixed(4)} | Yeast μ=${communityResult.yeast.growthRate.toFixed(4)} | Mutualism=${communityResult.mutualismIndex.toFixed(2)}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleResult, communityResult, simMode]);

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#000000' }}>
        <AlgorithmInsight
          title={simMode === 'single' ? 'Flux Balance Analysis' : 'Community FBA — Multi-species'}
          description={simMode === 'single'
            ? 'Linear programming maximizes objective flux subject to stoichiometric constraints and reaction bounds.'
            : 'Composite stoichiometric matrix S_com couples two host organisms through shared exchange reactions in an environmental pool.'}
          formula={simMode === 'single'
            ? 'max cᵀv s.t. Sv=0, lb≤v≤ub'
            : 'S_com = [S₁, 0, E₁; 0, S₂, E₂]'}
        />

        {/* Mode toggle */}
        <div style={{ padding: '0 16px 8px', display: 'flex', gap: '4px', flexShrink: 0 }}>
          {(['single', 'community'] as const).map(mode => (
            <button aria-label="Action" key={mode} onClick={() => setSimMode(mode)} style={{
              padding: '6px 14px', borderRadius: '20px',
              background: simMode === mode ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: `1px solid ${simMode === mode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
              color: simMode === mode ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
              fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {mode === 'single' ? 'Single Species' : 'Community'}
            </button>
          ))}
        </div>

        {/* Error banners */}
        {singleError && simMode === 'single' && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={singleError} /></div>
        )}
        {communityError && simMode === 'community' && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={communityError} /></div>
        )}

        {/* ── SINGLE MODE ── */}
        {simMode === 'single' && (
          <div className="nb-tool-panels" style={{ flex: 1 }}>
            {/* Input panel */}
            <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#000000' }}>
              <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
                Simulation Parameters
              </p>

              <ParamSlider label="Glucose uptake" value={glucoseUptake} min={0} max={20} onChange={setGlucoseUptake} unit="mmol/gDW/h" />
              <ParamSlider label="O₂ uptake" value={oxygenUptake} min={0} max={20} onChange={setOxygenUptake} unit="mmol/gDW/h" />

              <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '16px 0 8px' }}>
                Objective Function
              </p>
              {(['biomass', 'atp', 'product'] as const).map(opt => (
                <button aria-label="Action" key={opt} onClick={() => setObjective(opt)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 10px', marginBottom: '4px',
                  background: objective === opt ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: `1px solid ${objective === opt ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '8px',
                  color: objective === opt ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                  fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer',
                }}>
                  {opt === 'biomass' ? 'Max Biomass' : opt === 'atp' ? 'Max ATP' : 'Max Product'}
                </button>
              ))}

              <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '16px 0 8px' }}>
                Gene Knockouts
              </p>
              {REACTION_DEFS.map(r => {
                const isKO = knockouts.includes(r.id);
                return (
                  <button aria-label="Action" key={r.id} onClick={() => toggleKO(r.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '5px 8px', marginBottom: '3px',
                    background: isKO ? 'rgba(255,80,80,0.08)' : 'transparent',
                    border: `1px solid ${isKO ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '6px', cursor: 'pointer',
                  }}>
                    <span style={{ fontFamily: T.MONO, fontSize: '10px', color: isKO ? 'rgba(255,120,120,0.9)' : 'rgba(255,255,255,0.5)' }}>{r.id}</span>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: isKO ? 'rgba(255,80,80,0.7)' : 'rgba(255,255,255,0.12)',
                      flexShrink: 0,
                    }} />
                  </button>
                );
              })}
              {knockouts.length > 0 && (
                <button aria-label="Action" onClick={() => setKnockouts([])} style={{
                  display: 'block', width: '100%', marginTop: '6px',
                  padding: '5px 8px', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
                  color: 'rgba(255,255,255,0.3)', fontFamily: T.SANS, fontSize: '10px', cursor: 'pointer',
                }}>
                  Clear all knockouts
                </button>
              )}
            </div>

            {/* Engine view — SVG flux map */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FluxMap result={singleResult} nodes={METABOLIC_NODES} edges={FLUX_EDGES} knockouts={knockouts} svgRef={chartRef} />
              </div>
            </div>

            {/* Results panel */}
            <div className="nb-tool-right" style={{ width: '240px', borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#000000' }}>
              <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
                Results
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <MetricCard label="Growth Rate (μ)" value={singleResult.growthRate} unit="h⁻¹" highlight />
                <MetricCard label="ATP Yield" value={singleResult.atpYield} unit="mol/mol glc" />
                <MetricCard label="NADH Production" value={singleResult.nadhProduction} unit="mmol/gDW/h" />
                <MetricCard label="Carbon Efficiency" value={singleResult.carbonEfficiency} unit="%" />
                <MetricCard label="Feasible" value={singleResult.feasible ? 'YES' : 'NO'} />
              </div>

              <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>
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
                    <span style={{ fontFamily: T.MONO, fontSize: '10px', color: knockouts.includes(r.id) ? 'rgba(255,120,120,0.7)' : 'rgba(255,255,255,0.6)' }}>{r.id}</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '10px', fontWeight: 600, color: r.flux > 0 ? 'rgba(20,140,80,0.9)' : 'rgba(255,80,80,0.6)', textAlign: 'right' }}>
                      {r.flux.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontFamily: T.SANS, fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{r.name}</div>
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
        )}

        {/* ── COMMUNITY MODE ── */}
        {simMode === 'community' && (
          <div className="nb-tool-panels" style={{ flex: 1 }}>
            {/* Strain A (E. coli) sidebar */}
            <div style={{ width: '220px', flexShrink: 0, overflowY: 'auto', padding: '12px' }}>
              <StrainPanel
                label="E. coli (Strain A)"
                color={COLORS.strainABg} borderColor={COLORS.strainABorder} accentColor={COLORS.strainA}
                glucoseUptake={ecoliGlucose} oxygenUptake={ecoliOxygen} knockouts={ecoliKO}
                reactions={REACTION_DEFS} result={communityResult.ecoli}
                onGlucoseChange={setEcoliGlucose} onOxygenChange={setEcoliOxygen}
                onToggleKO={toggleEcoliKO} onClearKO={() => setEcoliKO([])}
              />
            </div>

            {/* Center: dual flux maps + shared bus */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
              {/* Community objective banner */}
              <GlassContainer color={COLORS.sharedBg} borderColor={COLORS.sharedBorder}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.SANS, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
                  Community Biomass Objective
                </span>
                <span style={{ fontFamily: T.MONO, fontSize: '14px', fontWeight: 600, color: COLORS.sharedPool, textAlign: 'right' }}>
                  μ_com = {communityResult.communityGrowthRate.toFixed(4)} h⁻¹
                </span>
              </GlassContainer>

              {/* Dual flux maps */}
              <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
                <GlassContainer color={COLORS.strainABg} borderColor={COLORS.strainABorder}
                  style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontFamily: T.MONO, fontSize: '9px', color: COLORS.strainA, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    E. coli Network
                  </p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <FluxMap result={communityResult.ecoli} nodes={METABOLIC_NODES} edges={FLUX_EDGES} knockouts={ecoliKO} compact />
                  </div>
                </GlassContainer>

                <GlassContainer color={COLORS.strainBBg} borderColor={COLORS.strainBBorder}
                  style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontFamily: T.MONO, fontSize: '9px', color: COLORS.strainB, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    S. cerevisiae Network
                  </p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <FluxMap result={communityResult.yeast} nodes={YEAST_NODES} edges={YEAST_FLUX_EDGES} knockouts={yeastKO} compact />
                  </div>
                </GlassContainer>
              </div>

              {/* Shared metabolite bus */}
              <SharedMetaboliteBus exchangeFluxes={communityResult.exchangeFluxes} />
            </div>

            {/* Strain B (S. cerevisiae) sidebar */}
            <div style={{ width: '220px', flexShrink: 0, overflowY: 'auto', padding: '12px' }}>
              <StrainPanel
                label="S. cerevisiae (Strain B)"
                color={COLORS.strainBBg} borderColor={COLORS.strainBBorder} accentColor={COLORS.strainB}
                glucoseUptake={yeastGlucose} oxygenUptake={yeastOxygen} knockouts={yeastKO}
                reactions={YEAST_REACTION_DEFS} result={communityResult.yeast}
                onGlucoseChange={setYeastGlucose} onOxygenChange={setYeastOxygen}
                onToggleKO={toggleYeastKO} onClearKO={() => setYeastKO([])}
              />
            </div>
          </div>
        )}

        {/* Export bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: '#000000' }}>
          <ExportButton label="Export JSON" data={exportData} filename={`fbasim-${simMode}-result`} format="json" />
          <ExportButton label="Export CSV" data={
            simMode === 'single'
              ? REACTION_DEFS.map(r => ({ id: r.id, name: r.name, subsystem: r.subsystem, flux: singleResult.fluxes[r.id] ?? 0, knocked_out: knockouts.includes(r.id) }))
              : [
                  ...REACTION_DEFS.map(r => ({ strain: 'ecoli', id: r.id, name: r.name, subsystem: r.subsystem, flux: communityResult.ecoli.fluxes[r.id] ?? 0, knocked_out: ecoliKO.includes(r.id) })),
                  ...YEAST_REACTION_DEFS.map(r => ({ strain: 'yeast', id: r.id, name: r.name, subsystem: r.subsystem, flux: communityResult.yeast.fluxes[r.id] ?? 0, knocked_out: yeastKO.includes(r.id) })),
                  ...communityResult.exchangeFluxes.map(e => ({ strain: 'exchange', id: e.id, name: e.metabolite, subsystem: 'Exchange', flux: e.flux, knocked_out: false })),
                ]
          } filename={`fbasim-${simMode}-fluxes`} format="csv" />
          <ExportButton label="Export SVG" data={null} filename={`fbasim-${simMode}-chart`} format="svg" svgRef={chartRef} />
        </div>
      </div>
    </>
  );
}
