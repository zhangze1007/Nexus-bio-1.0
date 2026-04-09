'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import DemoBanner from '../ide/shared/DemoBanner';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { usePersistedState } from '../ide/shared/usePersistedState';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import ScientificHero from './shared/ScientificHero';
import {
  METABOLIC_NODES, FLUX_EDGES, REACTION_DEFS,
  YEAST_NODES, YEAST_FLUX_EDGES, YEAST_REACTION_DEFS, SHARED_METABOLITES,
} from '../../data/mockFBA';
import type { FBAOutput, CommunityFBAOutput } from '../../data/mockFBA';
import { buildFBASeed } from './shared/workbenchDataflow';
import { solveAuthorityCommunityFBA, solveAuthorityFBA } from '../../services/FBAAuthorityClient';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';

// ── 5-color scientific palette (coral / sky / mint / lilac / apricot) ──
// E. coli → coral (warm, distinctive)
// Yeast   → sky blue (cool, contrasts coral)
// Shared  → mint (neutral exchange pool)
const COLORS = {
  strainA: '#E8A3A1',                      // coral   (E. coli)
  strainB: '#AFC3D6',                      // sky     (S. cerevisiae)
  sharedPool: '#BFDCCD',                   // mint    (exchange pool)
  strainABg: 'rgba(232,163,161,0.07)',
  strainBBg: 'rgba(175,195,214,0.07)',
  sharedBg: 'rgba(191,220,205,0.07)',
  strainABorder: 'rgba(232,163,161,0.28)',
  strainBBorder: 'rgba(175,195,214,0.28)',
  sharedBorder: 'rgba(191,220,205,0.28)',
};

type SimMode = 'single' | 'community';

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function createEmptyFBAOutput(): FBAOutput {
  return {
    fluxes: Object.fromEntries(REACTION_DEFS.map((reaction) => [reaction.id, 0])),
    growthRate: 0,
    atpYield: 0,
    nadhProduction: 0,
    carbonEfficiency: 0,
    feasible: false,
    shadowPrices: {
      glc: 0,
      o2: 0,
      atp: 0,
    },
  };
}

function createEmptyCommunityOutput(): CommunityFBAOutput {
  return {
    ecoli: createEmptyFBAOutput(),
    yeast: {
      fluxes: Object.fromEntries(YEAST_REACTION_DEFS.map((reaction) => [reaction.id, 0])),
      growthRate: 0,
      atpYield: 0,
      nadhProduction: 0,
      carbonEfficiency: 0,
      feasible: false,
      shadowPrices: {
        glc: 0,
        o2: 0,
        atp: 0,
      },
    },
    exchangeFluxes: SHARED_METABOLITES.map((metabolite) => ({
      id: `EX_${metabolite.id}`,
      metabolite: metabolite.name,
      fromStrain: metabolite.exporterStrain,
      toStrain: metabolite.importerStrain,
      flux: 0,
    })),
    communityGrowthRate: 0,
    communityBiomassObjective: 0,
    feasible: false,
  };
}

function ParamSlider({ label, value, min, max, step = 0.5, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string; accentColor?: string;
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
      formatValue={(nextValue) => nextValue.toFixed(1)}
    />
  );
}

const W = 480, H = 640;
// 5-color scientific palette for subsystem nodes
const SUBSYSTEM_COLORS: Record<string, string> = {
  Glycolysis:   '#E8A3A1',   // coral
  TCA:          '#AFC3D6',   // sky
  Energy:       '#BFDCCD',   // mint
  Fermentation: '#CFC4E3',   // lilac
};

function runForceLayout(
  nodes: { id: string; subsystem: string }[],
  edges: { from: string; to: string }[],
  width: number,
  height: number,
): Record<string, { x: number; y: number }> {
  const PAD = 48;
  const pos: Record<string, { x: number; y: number }> = {};
  const glyNodes = nodes.filter(n => n.subsystem === 'Glycolysis');
  const tcaNodes = nodes.filter(n => n.subsystem === 'TCA');
  const otherNodes = nodes.filter(n => n.subsystem !== 'Glycolysis' && n.subsystem !== 'TCA');

  glyNodes.forEach((n, i) => {
    pos[n.id] = { x: PAD + 30 + (i % 2) * 40, y: PAD + i * ((height - PAD * 2) / Math.max(glyNodes.length - 1, 1)) };
  });
  tcaNodes.forEach((n, i) => {
    pos[n.id] = { x: width * 0.55 + (i % 2) * 50, y: PAD + 80 + i * ((height - PAD * 2 - 80) / Math.max(tcaNodes.length, 1)) };
  });
  otherNodes.forEach((n, i) => {
    pos[n.id] = { x: width - PAD - 30, y: PAD + i * 80 };
  });

  const nodeIds = nodes.map(n => n.id);
  const area = (width - PAD * 2) * (height - PAD * 2);
  const k = Math.sqrt(area / Math.max(nodeIds.length, 1));

  for (let iter = 0; iter < 180; iter++) {
    const temp = k * (1 - iter / 180) * 0.45;
    const disp: Record<string, { dx: number; dy: number }> = {};
    nodeIds.forEach(id => { disp[id] = { dx: 0, dy: 0 }; });

    for (let a = 0; a < nodeIds.length; a++) {
      for (let b = a + 1; b < nodeIds.length; b++) {
        const ia = nodeIds[a], ib = nodeIds[b];
        const dx = pos[ia].x - pos[ib].x, dy = pos[ia].y - pos[ib].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const rep = (k * k) / d;
        disp[ia].dx += (dx / d) * rep; disp[ia].dy += (dy / d) * rep;
        disp[ib].dx -= (dx / d) * rep; disp[ib].dy -= (dy / d) * rep;
      }
    }
    edges.forEach(e => {
      if (!pos[e.from] || !pos[e.to]) return;
      const dx = pos[e.to].x - pos[e.from].x, dy = pos[e.to].y - pos[e.from].y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const att = (d * d) / k;
      disp[e.from].dx += (dx / d) * att; disp[e.from].dy += (dy / d) * att;
      disp[e.to].dx   -= (dx / d) * att; disp[e.to].dy   -= (dy / d) * att;
    });
    nodeIds.forEach(id => {
      const d = Math.max(Math.sqrt(disp[id].dx ** 2 + disp[id].dy ** 2), 0.01);
      const sc = Math.min(d, temp) / d;
      pos[id].x = Math.max(PAD, Math.min(width - PAD, pos[id].x + disp[id].dx * sc));
      pos[id].y = Math.max(PAD, Math.min(height - PAD, pos[id].y + disp[id].dy * sc));
    });
  }
  return pos;
}

function FluxMap({ result, nodes, edges, knockouts, compact, svgRef }: {
  result: FBAOutput;
  nodes: typeof METABOLIC_NODES;
  edges: typeof FLUX_EDGES;
  knockouts: string[];
  compact?: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const maxFlux = Math.max(...Object.values(result.fluxes).map(Math.abs), 1);
  const koSet = new Set(knockouts);
  const [hovered, setHovered] = useState<string | null>(null);
  const viewH = compact ? 480 : H;

  const positions = useMemo(
    () => runForceLayout(nodes, edges, W, viewH),
    [nodes, edges, viewH],
  );

  // Node flux magnitude: use sum of connected edge fluxes
  function nodeFlux(nodeId: string) {
    const connected = edges.filter(e => e.from === nodeId || e.to === nodeId);
    const total = connected.reduce((sum, e) => sum + Math.abs(result.fluxes[e.reactionId] ?? 0), 0);
    return total / Math.max(connected.length, 1);
  }

  return (
    <svg ref={svgRef} role="img" aria-label="Chart" viewBox={`0 0 ${W} ${viewH}`} style={{ width: '100%', height: '100%', maxHeight: '100%' }}>
      <defs>
        <marker id="fba-fwd"  markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 0.5, 6.5 3.5, 0 6.5" fill="#4DAF4A" />
        </marker>
        <marker id="fba-rev"  markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 0.5, 6.5 3.5, 0 6.5" fill="#E41A1C" />
        </marker>
        <marker id="fba-zero" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 0.5, 6.5 3.5, 0 6.5" fill="rgba(255,255,255,0.18)" />
        </marker>
        <marker id="fba-ko"   markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 0.5, 6.5 3.5, 0 6.5" fill="rgba(255,80,80,0.5)" />
        </marker>
        <filter id="fba-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect width={W} height={viewH} fill="#05070b" rx={16} />

      {/* Subnetwork region labels */}
      <text x="28" y="22" fontFamily={T.MONO} fontSize="8" fill="rgba(228,26,28,0.6)">● GLYCOLYSIS</text>
      <text x="200" y="22" fontFamily={T.MONO} fontSize="8" fill="rgba(55,126,184,0.6)">● TCA CYCLE</text>
      <text x="28" y={viewH - 12} fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.2)">
        Flux: mmol·gDW⁻¹·h⁻¹ · Node size ∝ flux magnitude · Edge color encodes direction
      </text>

      {/* Edges */}
      {edges.map(edge => {
        const from = positions[edge.from], to = positions[edge.to];
        if (!from || !to) return null;
        const rawFlux = result.fluxes[edge.reactionId] ?? 0;
        const flux = Math.abs(rawFlux);
        const normalized = flux / maxFlux;
        const isKO = koSet.has(edge.reactionId);
        const isReverse = rawFlux < 0;
        const color = isKO ? 'rgba(255,80,80,0.55)'
          : flux < 0.01 ? 'rgba(255,255,255,0.15)'
          : isReverse ? '#E41A1C' : '#4DAF4A';
        const strokeW = Math.min(8, 1 + normalized * 5);
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const marker = isKO ? 'url(#fba-ko)' : flux < 0.01 ? 'url(#fba-zero)' : isReverse ? 'url(#fba-rev)' : 'url(#fba-fwd)';
        return (
          <g key={edge.reactionId}>
            <line
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={color} strokeWidth={strokeW} strokeLinecap="round"
              strokeDasharray={isKO ? '5 3' : undefined}
              markerEnd={marker}
              opacity={0.85}
            />
            <rect x={mx - 14} y={my - 7} width="28" height="14" rx="7"
              fill="rgba(5,7,11,0.88)" stroke="rgba(255,255,255,0.07)" />
            <text x={mx} y={my + 4} fill={isKO ? 'rgba(255,80,80,0.7)' : 'rgba(255,255,255,0.55)'}
              fontFamily={T.MONO} fontSize="7.5" textAnchor="middle">
              {isKO ? '×' : flux.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Nodes as circles sized by flux */}
      {nodes.map(node => {
        const pos = positions[node.id];
        if (!pos) return null;
        const f = nodeFlux(node.id);
        const r = Math.max(10, Math.min(20, 8 + Math.sqrt(f / maxFlux) * 14));
        const color = SUBSYSTEM_COLORS[node.subsystem] ?? 'rgba(255,255,255,0.5)';
        const isHov = hovered === node.id;
        return (
          <g key={node.id}
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}>
            {isHov && <circle cx={pos.x} cy={pos.y} r={r + 6} fill={color} opacity={0.12} />}
            <circle cx={pos.x} cy={pos.y} r={r}
              fill="rgba(5,7,11,0.92)" stroke={color}
              strokeWidth={isHov ? 2.2 : 1.4}
              filter={isHov ? 'url(#fba-glow)' : undefined}
            />
            <text x={pos.x} y={pos.y + 3.5} textAnchor="middle"
              fontFamily={T.MONO} fontSize="7.5" fill="rgba(255,255,255,0.88)">
              {node.label.slice(0, 5)}
            </text>
            <text x={pos.x} y={pos.y + r + 10} textAnchor="middle"
              fontFamily={T.MONO} fontSize="6.5" fill={color} opacity={0.7}>
              {f.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Biomass legend */}
      <rect x={W - 110} y={26} width="96" height="38" rx="10"
        fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" />
      <text x={W - 96} y={40} fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.28)">μ BIOMASS</text>
      <text x={W - 96} y={56} fontFamily={T.MONO} fontSize="13" fontWeight="700" fill="rgba(247,249,255,0.92)">
        {result.growthRate.toFixed(4)}
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
                strokeLinecap="round"
                style={{
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
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const pathdPayload = useWorkbenchStore((s) => s.toolPayloads.pathd);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

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
  const [singleResult, setSingleResult] = useState<FBAOutput>(() => createEmptyFBAOutput());
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleLoading, setSingleLoading] = useState(true);
  const [communityResult, setCommunityResult] = useState<CommunityFBAOutput>(() => createEmptyCommunityOutput());
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityLoading, setCommunityLoading] = useState(true);
  const recommendedSeed = useMemo(
    () => buildFBASeed(project, analyzeArtifact, dbtlPayload, pathdPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, pathdPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  // P1.2: track the seed signature that was last applied. Without this, every
  // upstream update silently overwrites persisted local edits (E. coli / yeast
  // glucose & oxygen) — non-monotonic and surprising. We now (a) only re-seed
  // when the upstream signature actually changes and (b) surface a dismissible
  // notice when the new seed is replacing locally-modified persisted values.
  const seedSignature = useMemo(
    () => `${recommendedSeed.mode}|${recommendedSeed.objective}|${recommendedSeed.glucoseUptake}|${recommendedSeed.oxygenUptake}|${recommendedSeed.knockouts.join(',')}`,
    [recommendedSeed.glucoseUptake, recommendedSeed.knockouts, recommendedSeed.mode, recommendedSeed.objective, recommendedSeed.oxygenUptake],
  );
  const lastAppliedSeedRef = useRef<string | null>(null);
  const [seedOverwriteNotice, setSeedOverwriteNotice] = useState<string | null>(null);

  useEffect(() => {
    if (lastAppliedSeedRef.current === seedSignature) return;

    const expectedEcoliGlc = Math.max(3, round(recommendedSeed.glucoseUptake * 0.58));
    const expectedEcoliO2  = Math.max(3, round(recommendedSeed.oxygenUptake  * 0.65));
    const expectedYeastGlc = Math.max(2, round(recommendedSeed.glucoseUptake * 0.42));
    const expectedYeastO2  = Math.max(2, round(recommendedSeed.oxygenUptake  * 0.45));

    // Detect divergence: only meaningful after we have applied at least one seed.
    if (lastAppliedSeedRef.current !== null) {
      const localDiverged =
        ecoliGlucose !== expectedEcoliGlc ||
        ecoliOxygen  !== expectedEcoliO2  ||
        yeastGlucose !== expectedYeastGlc ||
        yeastOxygen  !== expectedYeastO2;
      if (localDiverged) {
        setSeedOverwriteNotice('Upstream FBA seed has changed and your local Two-Species uptake edits were just replaced. Re-apply manual values if needed.');
      }
    }

    setSimMode(recommendedSeed.mode);
    setObjective(recommendedSeed.objective);
    setGlucoseUptake(recommendedSeed.glucoseUptake);
    setOxygenUptake(recommendedSeed.oxygenUptake);
    setKnockouts(recommendedSeed.knockouts);
    setEcoliGlucose(expectedEcoliGlc);
    setEcoliOxygen(expectedEcoliO2);
    setYeastGlucose(expectedYeastGlc);
    setYeastOxygen(expectedYeastO2);
    setEcoliKO(recommendedSeed.knockouts.slice(0, 1));
    setYeastKO(recommendedSeed.knockouts.slice(1));
    lastAppliedSeedRef.current = seedSignature;
  }, [
    seedSignature,
    recommendedSeed.glucoseUptake,
    recommendedSeed.knockouts,
    recommendedSeed.mode,
    recommendedSeed.objective,
    recommendedSeed.oxygenUptake,
    ecoliGlucose,
    ecoliOxygen,
    yeastGlucose,
    yeastOxygen,
    setEcoliGlucose,
    setEcoliOxygen,
    setGlucoseUptake,
    setOxygenUptake,
    setObjective,
    setYeastGlucose,
    setYeastOxygen,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    setSingleLoading(true);
    setSingleError(null);

    solveAuthorityFBA(
      {
        objective,
        glucoseUptake,
        oxygenUptake,
        knockouts,
      },
      controller.signal,
    ).then((result) => {
      setSingleResult(result);
      setSingleError(null);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setSingleResult(createEmptyFBAOutput());
      setSingleError(error instanceof Error ? error.message : 'Authoritative FBA solve failed');
    }).finally(() => {
      if (!controller.signal.aborted) {
        setSingleLoading(false);
      }
    });

    return () => controller.abort();
  }, [glucoseUptake, knockouts, objective, oxygenUptake]);

  useEffect(() => {
    const controller = new AbortController();
    setCommunityLoading(true);
    setCommunityError(null);

    solveAuthorityCommunityFBA(
      {
        objective,
        ecoli: {
          glucoseUptake: ecoliGlucose,
          oxygenUptake: ecoliOxygen,
          knockouts: ecoliKO,
        },
        yeast: {
          glucoseUptake: yeastGlucose,
          oxygenUptake: yeastOxygen,
          knockouts: yeastKO,
        },
      },
      controller.signal,
    ).then((result) => {
      setCommunityResult(result);
      setCommunityError(null);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setCommunityResult(createEmptyCommunityOutput());
      setCommunityError(error instanceof Error ? error.message : 'Authority-backed community FBA failed');
    }).finally(() => {
      if (!controller.signal.aborted) {
        setCommunityLoading(false);
      }
    });

    return () => controller.abort();
  }, [ecoliGlucose, ecoliKO, ecoliOxygen, objective, yeastGlucose, yeastKO, yeastOxygen]);

  const top5 = useMemo(() => {
    return REACTION_DEFS
      .map(r => ({ ...r, flux: singleResult.fluxes[r.id] ?? 0 }))
      .sort((a, b) => Math.abs(b.flux) - Math.abs(a.flux))
      .slice(0, 5);
  }, [singleResult]);

  const maxTopFlux = Math.abs(top5[0]?.flux ?? 1) || 1;
  const figureMeta = useMemo(() => {
    if (simMode === 'single') {
      return {
        eyebrow: 'Figure A · Host Flux State',
        title: 'Constraint-resolved flux map for the active host context',
        caption: 'The central flux map is framed as a model figure: objective, uptake limits, and shadow-price interpretation are treated as part of the same scientific panel.',
      };
    }
    return {
      eyebrow: 'Figure B · Two-Species Exchange Comparison',
      title: 'Coupled host-state and shared metabolite exchange',
      caption: 'Community mode becomes a multi-panel model figure where strain-specific optima and shared-pool exchange are read together instead of across disconnected cards.',
    };
  }, [simMode]);

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
    if ((simMode === 'single' && singleLoading) || (simMode === 'community' && communityLoading)) {
      return;
    }
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
        message: `Community FBA — E.coli μ=${communityResult.ecoli.growthRate.toFixed(4)} | Yeast μ=${communityResult.yeast.growthRate.toFixed(4)} | Community μ=${communityResult.communityGrowthRate.toFixed(4)}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appendConsole, communityError, communityLoading, communityResult, simMode, singleError, singleLoading, singleResult]);

  useEffect(() => {
    const now = Date.now();
    const activeResult = simMode === 'single'
      ? singleResult
      : {
          fluxes: communityResult.ecoli.fluxes,
          growthRate: communityResult.communityGrowthRate,
          atpYield: (communityResult.ecoli.atpYield + communityResult.yeast.atpYield) / 2,
          nadhProduction: (communityResult.ecoli.nadhProduction + communityResult.yeast.nadhProduction) / 2,
          carbonEfficiency: (communityResult.ecoli.carbonEfficiency + communityResult.yeast.carbonEfficiency) / 2,
          feasible: communityResult.feasible,
          shadowPrices: {
            glc: (communityResult.ecoli.shadowPrices.glc + communityResult.yeast.shadowPrices.glc) / 2,
            o2: (communityResult.ecoli.shadowPrices.o2 + communityResult.yeast.shadowPrices.o2) / 2,
            atp: (communityResult.ecoli.shadowPrices.atp + communityResult.yeast.shadowPrices.atp) / 2,
          },
        };

    if (singleLoading || communityLoading) return;
    if (singleError && simMode === 'single') return;
    if (communityError && simMode === 'community') return;

    setToolPayload('fbasim', {
      toolId: 'fbasim',
      targetProduct: recommendedSeed.targetProduct,
      pathwayFocus: recommendedSeed.pathwayFocus,
      sourceArtifactId: analyzeArtifact?.id,
      mode: simMode,
      objective,
      glucoseUptake,
      oxygenUptake,
      knockouts,
      result: {
        growthRate: activeResult.growthRate,
        atpYield: activeResult.atpYield,
        nadhProduction: activeResult.nadhProduction,
        carbonEfficiency: activeResult.carbonEfficiency,
        feasible: activeResult.feasible,
        shadowPrices: activeResult.shadowPrices,
        topFluxes: Object.entries(activeResult.fluxes)
          .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
          .slice(0, 5)
          .map(([reactionId, flux]) => ({ reactionId, flux })),
      },
      updatedAt: now,
    });
  }, [
    analyzeArtifact?.id,
    communityLoading,
    communityError,
    communityResult,
    glucoseUptake,
    knockouts,
    objective,
    oxygenUptake,
    recommendedSeed.pathwayFocus,
    recommendedSeed.targetProduct,
    setToolPayload,
    simMode,
    singleLoading,
    singleError,
    singleResult,
  ]);

  return (
    <>
      <div className="nb-tool-page" style={{ background: PATHD_THEME.sepiaPanelMuted }}>
        <AlgorithmInsight
          title={simMode === 'single' ? 'Flux Balance Analysis' : 'Two-Species Flux Comparison'}
          description={simMode === 'single'
            ? 'Server-side GLPK solves a stoichiometric LP for the current host context, then revalidates glucose and oxygen shadow prices with finite-difference reruns so downstream tools inherit an authority-backed flux state.'
            : 'Two server-side host LPs are solved independently and then coupled through an exchange pool, so community feasibility is derived from live strain-level optima rather than a browser-only mock.'}
          formula={simMode === 'single'
            ? 'max cᵀv s.t. Sv=0, lb≤v≤ub'
            : 'S_com = [S₁, 0, E₁; 0, S₂, E₂]'}
        />
        <div style={{ padding: '0 16px 8px' }}>
          <WorkbenchInlineContext
            toolId="fbasim"
            title="Flux Simulation"
            summary="Flux simulation turns the current pathway object into quantitative growth, ATP, and carbon-efficiency constraints so downstream thermodynamics, catalyst design, and control layers do not keep operating on stale assumptions."
            compact
            isSimulated={!analyzeArtifact}
          />
        </div>
        <div style={{ padding: '0 16px 10px' }}>
          <ScientificHero
            eyebrow={`Stage 2 · ${simMode === 'single' ? 'Host Flux Solve' : 'Community Flux Solve'}`}
            title={simMode === 'single' ? 'Authority-backed metabolic flux state' : 'Coupled host exchange and community feasibility'}
            summary={simMode === 'single'
              ? 'FBASim is the first point where the pathway object becomes a constrained production model. The key question is no longer “can the route exist,” but “what does it cost the host and which uptake constraints dominate the present solution.”'
              : 'Community mode promotes the pathway into a multi-host systems question. Exchange flux, strain balance, and shared-pool feasibility become explicit so later tools can inherit a real ecological operating state.'}
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: 'rgba(205,214,236,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current route focus
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: 'rgba(247,249,255,0.92)', fontWeight: 700 }}>
                  {recommendedSeed.pathwayFocus || recommendedSeed.targetProduct}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: 'rgba(205,214,236,0.6)', lineHeight: 1.55 }}>
                  Objective {objective === 'biomass' ? 'maximizes biomass resilience' : objective === 'atp' ? 'prioritizes energetic yield' : 'pushes product-oriented flux through the current route'}.
                </div>
              </>
            }
            signals={simMode === 'single'
              ? [
                  {
                    label: 'Growth Rate',
                    value: `${singleResult.growthRate.toFixed(4)} h⁻¹`,
                    detail: singleLoading ? 'Server authority solve is recomputing this host state.' : singleResult.feasible ? 'Host remains feasible under the present uptake and objective settings.' : 'Infeasible host state under the current constraints.',
                    tone: singleResult.feasible ? 'cool' : 'alert',
                  },
                  {
                    label: 'Carbon Efficiency',
                    value: `${singleResult.carbonEfficiency.toFixed(1)}%`,
                    detail: `${singleResult.atpYield.toFixed(2)} ATP yield · ${singleResult.nadhProduction.toFixed(2)} NADH production`,
                    tone: singleResult.carbonEfficiency >= 50 ? 'cool' : 'warm',
                  },
                  {
                    label: 'Primary Constraint',
                    value: `∂μ/∂Glc ${singleResult.shadowPrices.glc.toFixed(4)}`,
                    detail: `O₂ shadow ${singleResult.shadowPrices.o2.toFixed(4)} · ATP shadow ${singleResult.shadowPrices.atp.toFixed(4)}`,
                    tone: 'neutral',
                  },
                  {
                    label: 'Top Active Route',
                    value: top5[0]?.id ?? 'Pending',
                    detail: top5[0] ? `${Math.abs(top5[0].flux).toFixed(2)} mmol/gDW/h through the strongest reaction channel.` : 'No active reactions ranked yet.',
                    tone: 'neutral',
                  },
                ]
              : [
                  {
                    label: 'Community Growth',
                    value: `${communityResult.communityGrowthRate.toFixed(4)} h⁻¹`,
                    detail: communityLoading ? 'Coupled authority solve is recomputing both hosts and the exchange pool.' : communityResult.feasible ? 'Both hosts can satisfy the coupled exchange constraints.' : 'The coupled host system is currently infeasible.',
                    tone: communityResult.feasible ? 'cool' : 'alert',
                  },
                  {
                    label: 'Biomass Objective',
                    value: `${communityResult.communityBiomassObjective.toFixed(3)}`,
                    detail: `E. coli ${communityResult.ecoli.growthRate.toFixed(3)} · Yeast ${communityResult.yeast.growthRate.toFixed(3)}`,
                    tone: 'neutral',
                  },
                  {
                    label: 'Shared Exchange',
                    value: `${communityResult.exchangeFluxes.filter((entry) => Math.abs(entry.flux) > 0.01).length} active links`,
                    detail: communityResult.exchangeFluxes[0] ? `${communityResult.exchangeFluxes[0].metabolite} ${communityResult.exchangeFluxes[0].flux.toFixed(2)} mmol/h` : 'No exchange fluxes detected yet.',
                    tone: 'warm',
                  },
                  {
                    label: 'Pathway Focus',
                    value: recommendedSeed.pathwayFocus || recommendedSeed.targetProduct,
                    detail: 'This route focus is what downstream thermodynamics and catalyst design will inherit from the current systems solve.',
                    tone: 'neutral',
                  },
                ]}
          />
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificMethodStrip
            label="Model Analysis Grammar"
            items={[
              {
                title: 'Constraint setup',
                detail: 'Objective, uptake limits, and knockout state should read like the methods legend for the current flux solve.',
                accent: PATHD_THEME.apricot,
                note: 'Model inputs',
              },
              {
                title: 'Flux figure',
                detail: 'The network map is the primary scientific canvas and should carry the main burden of interpretation, not act as a middle-column ornament.',
                accent: PATHD_THEME.sky,
                note: 'Primary canvas',
              },
              {
                title: 'Readout ledger',
                detail: 'Growth, ATP, carbon efficiency, and top reactions belong as an attached evidence ledger around the same model figure.',
                accent: PATHD_THEME.mint,
                note: 'Integrated readout',
              },
            ]}
          />
        </div>
        <div style={{ padding: '0 16px 4px' }}>
          <DemoBanner context="E. coli central metabolism (glycolysis + TCA)" />
        </div>

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
              {mode === 'single' ? 'Single Species' : 'Two-Species Comparison'}
            </button>
          ))}
        </div>

        {/* Error banners */}
        {singleError && simMode === 'single' && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={singleError} /></div>
        )}
        {simMode === 'community' && (
          <div style={{ padding: '0 16px 8px' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '12px',
              border: '1px solid rgba(250,128,114,0.28)',
              background: 'rgba(250,128,114,0.08)',
              color: 'rgba(255,228,220,0.85)',
              fontFamily: T.SANS,
              fontSize: '11px',
              lineHeight: 1.5,
            }}>
              <strong style={{ color: 'rgba(255,200,190,0.95)' }}>Method note:</strong> This mode runs two independent single-species FBA solves (E. coli and yeast) and compares their exchange fluxes. It is <em>not</em> a joint community LP (e.g. SteadyCom / cFBA) — shared-pool stoichiometric coupling is not enforced. Treat outputs as a side-by-side flux comparison, not a microbiome model.
            </div>
          </div>
        )}
        {seedOverwriteNotice && (
          <div style={{ padding: '0 16px 8px' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '12px',
              border: '1px solid rgba(232, 180, 90, 0.45)',
              background: 'rgba(232, 180, 90, 0.10)',
              color: 'rgba(255, 230, 190, 0.9)',
              fontFamily: T.SANS,
              fontSize: '11px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>{seedOverwriteNotice}</span>
              <button
                aria-label="Dismiss"
                onClick={() => setSeedOverwriteNotice(null)}
                style={{
                  fontFamily: T.MONO,
                  fontSize: '10px',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {communityError && simMode === 'community' && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={communityError} /></div>
        )}
        {singleLoading && simMode === 'single' && (
          <div style={{ padding: '0 16px 8px' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '12px',
              border: '1px solid rgba(81,81,205,0.22)',
              background: 'rgba(81,81,205,0.08)',
              color: 'rgba(240,245,255,0.78)',
              fontFamily: T.SANS,
              fontSize: '11px',
            }}>
              Authority engine recomputing server-side LP for the current pathway context.
            </div>
          </div>
        )}
        {communityLoading && simMode === 'community' && (
          <div style={{ padding: '0 16px 8px' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '12px',
              border: '1px solid rgba(81,81,205,0.22)',
              background: 'rgba(81,81,205,0.08)',
              color: 'rgba(240,245,255,0.78)',
              fontFamily: T.SANS,
              fontSize: '11px',
            }}>
              Solving two independent single-species LPs and comparing their exchange fluxes (not a joint stoichiometric optimization).
            </div>
          </div>
        )}

        {/* ── SINGLE MODE ── */}
        {simMode === 'single' && (
          <div className="nb-tool-panels" style={{ flex: 1 }}>
            {/* Input panel */}
            <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: `1px solid ${PATHD_THEME.sepiaPanelBorder}`, background: PATHD_THEME.sepiaPanelMuted }}>
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
                  background: objective === opt ? PATHD_THEME.panelSurface : 'rgba(255,255,255,0.34)',
                  border: `1px solid ${objective === opt ? PATHD_THEME.panelBorderStrong : PATHD_THEME.sepiaPanelBorder}`,
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
                  <button aria-label={`${isKO ? 'Remove' : 'Apply'} ${r.id} knockout`} aria-pressed={isKO} key={r.id} onClick={() => toggleKO(r.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '5px 8px', marginBottom: '3px',
                    background: isKO ? 'rgba(255,80,80,0.14)' : 'transparent',
                    border: `1px solid ${isKO ? 'rgba(255,80,80,0.38)' : 'rgba(255,255,255,0.06)'}`,
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
                <>
                  <div
                    style={{
                      marginTop: '6px',
                      marginBottom: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,80,80,0.24)',
                      background: 'rgba(255,80,80,0.10)',
                      display: 'grid',
                      gap: '3px',
                    }}
                  >
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: 'rgba(255,190,190,0.92)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Active perturbations
                    </span>
                    <span style={{ fontFamily: T.SANS, fontSize: '10px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
                      {knockouts.join(', ')} applied. The LP has been recomputed with those reactions clamped to zero flux.
                    </span>
                  </div>
                  <button aria-label="Clear all knockouts" onClick={() => setKnockouts([])} style={{
                    display: 'block', width: '100%', marginTop: '6px',
                    padding: '5px 8px', background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
                    color: 'rgba(255,255,255,0.3)', fontFamily: T.SANS, fontSize: '10px', cursor: 'pointer',
                  }}>
                    Clear all knockouts
                  </button>
                </>
              )}
            </div>

            {/* Engine view — SVG flux map */}
            <div className="nb-tool-center" style={{ flex: 1, position: 'relative', background: PATHD_THEME.sepiaPanelMuted, display: 'flex', alignItems: 'stretch', justifyContent: 'center', minWidth: 0, padding: '16px' }}>
              <ScientificFigureFrame
                eyebrow={figureMeta.eyebrow}
                title={figureMeta.title}
                caption={figureMeta.caption}
                minHeight="100%"
                legend={[
                  { label: 'Objective', value: objective, accent: PATHD_THEME.apricot },
                  { label: 'Glucose', value: `${glucoseUptake.toFixed(1)} mmol/gDW/h`, accent: PATHD_THEME.coral },
                  { label: 'Oxygen', value: `${oxygenUptake.toFixed(1)} mmol/gDW/h`, accent: PATHD_THEME.sky },
                  { label: 'Knockouts', value: knockouts.length ? knockouts.join(', ') : 'none', accent: PATHD_THEME.mint },
                ]}
                footer={
                  <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.paperMuted, lineHeight: 1.55 }}>
                    {singleResult.feasible
                      ? 'Shadow prices and top-flux readouts should be interpreted as annotations on this same model figure, not as detached KPI tiles.'
                      : 'The current solve is infeasible, so the figure is functioning as a rejection surface rather than a success dashboard.'}
                  </div>
                }
              >
                <div style={{ minHeight: '540px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FluxMap result={singleResult} nodes={METABOLIC_NODES} edges={FLUX_EDGES} knockouts={knockouts} svgRef={chartRef} />
                </div>
              </ScientificFigureFrame>
            </div>

            {/* Results panel */}
            <div className="nb-tool-right" style={{ width: '240px', borderLeft: `1px solid ${PATHD_THEME.sepiaPanelBorder}`, background: PATHD_THEME.sepiaPanelMuted }}>
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
                Shadow Prices (∂μ/∂uptake)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <MetricCard label="∂μ/∂Glucose" value={singleResult.shadowPrices.glc.toFixed(4)} unit="h⁻¹·gDW/mmol" />
                <MetricCard label="∂μ/∂Oxygen"  value={singleResult.shadowPrices.o2.toFixed(4)}  unit="h⁻¹·gDW/mmol" />
                <MetricCard label="∂μ/∂ATP"     value={singleResult.shadowPrices.atp.toFixed(4)} unit="h⁻¹·gDW/mmol" />
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
            <div className="nb-tool-sidebar" style={{ width: '220px', flexShrink: 0, padding: '12px' }}>
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
            <div className="nb-tool-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', minWidth: 0, background: PATHD_THEME.sepiaPanelMuted }}>
              <ScientificFigureFrame
                eyebrow={figureMeta.eyebrow}
                title={figureMeta.title}
                caption={figureMeta.caption}
                minHeight="100%"
                legend={[
                  { label: 'Objective', value: objective, accent: PATHD_THEME.apricot },
                  { label: 'Community growth', value: `${communityResult.communityGrowthRate.toFixed(4)} h⁻¹`, accent: PATHD_THEME.mint },
                  { label: 'E. coli KOs', value: ecoliKO.length ? ecoliKO.join(', ') : 'none', accent: COLORS.strainA },
                  { label: 'Yeast KOs', value: yeastKO.length ? yeastKO.join(', ') : 'none', accent: COLORS.strainB },
                ]}
                footer={
                  <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.paperMuted, lineHeight: 1.55 }}>
                    Community view is framed as a comparative systems figure: two host states above, shared exchange below, and growth coupling visible as one model story.
                  </div>
                }
              >
                <div style={{ display: 'grid', gap: '12px', minHeight: '540px' }}>
                  <GlassContainer color={COLORS.sharedBg} borderColor={COLORS.sharedBorder}
                    style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
                      Community Biomass Objective
                    </span>
                    <span style={{ fontFamily: T.MONO, fontSize: '14px', fontWeight: 600, color: COLORS.sharedPool, textAlign: 'right' }}>
                      μ_com = {communityResult.communityGrowthRate.toFixed(4)} h⁻¹
                    </span>
                  </GlassContainer>

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

                  <SharedMetaboliteBus exchangeFluxes={communityResult.exchangeFluxes} />
                </div>
              </ScientificFigureFrame>
            </div>

            {/* Strain B (S. cerevisiae) sidebar */}
            <div className="nb-tool-right" style={{ width: '220px', flexShrink: 0, padding: '12px' }}>
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
        <div style={{ borderTop: `1px solid ${PATHD_THEME.sepiaPanelBorder}`, padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: PATHD_THEME.sepiaPanelMuted }}>
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
