'use client';
import { useEffect, useMemo, useState } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import {
  ENZYME_STRUCTURES,
  PATHWAY_STEPS,
  PATHWAY_CANDIDATES,
  RATE_LIMITING_ENZYME,
} from '../../data/mockCatalystDesigner';
import {
  predictBindingAffinity,
  designSequences,
  estimateMetabolicDrain,
  balancePathway,
  rankPathways,
  predictMutagenesisSites,
} from '../../services/CatalystDesignerEngine';
import type {
  BindingAffinityResult,
  SequenceDesignResult,
  MetabolicDrainResult,
  PathwayBalanceResult,
  ParetoFrontResult,
  MutagenesisResult,
  EnzymeStructure,
} from '../../services/CatalystDesignerEngine';
import { useWorkbenchStore } from '../../store/workbenchStore';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import { buildCatalystSeed } from './shared/workbenchDataflow';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';
import ScientificHero from './shared/ScientificHero';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import { PATHD_THEME } from '../workbench/workbenchTheme';

/* ── Design Tokens ────────────────────────────────────────────────── */

const PANEL_BG = PATHD_THEME.sepiaPanelMuted;
const BORDER = PATHD_THEME.sepiaPanelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;
const INPUT_BG = PATHD_THEME.panelInset;
const INPUT_BORDER = PATHD_THEME.sepiaPanelBorder;
const INPUT_TEXT = PATHD_THEME.value;

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  background: PATHD_THEME.panelSurface,
  border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
};

const PHASE_COLORS: Record<string, string> = {
  binding:     '#BFDCCD',   // mint
  sequence:    '#AFC3D6',   // sky
  flux:        '#E7C7A9',   // apricot
  balancing:   '#E8A3A1',   // coral
  pareto:      '#CFC4E3',   // lilac
  mutagenesis: '#BFDCCD',   // mint
};

const PHASE_MAP: Record<string, string> = {
  retrosynthesis:     'binding',
  enzyme_selection:   'binding',
  structure_analysis: 'binding',
  sequence_design:    'sequence',
  flux_coupling:      'flux',
  balancing:          'balancing',
  mutagenesis:        'mutagenesis',
};

type ViewMode = 'Binding' | 'Sequences' | 'FluxCost' | 'Balancer' | 'Pareto' | 'Mutagenesis';

const VIEW_MODES: { key: ViewMode; label: string; color: string }[] = [
  { key: 'Binding',    label: 'Binding',    color: PHASE_COLORS.binding },
  { key: 'Sequences',  label: 'Sequences',  color: PHASE_COLORS.sequence },
  { key: 'FluxCost',   label: 'Flux Cost',  color: PHASE_COLORS.flux },
  { key: 'Balancer',   label: 'Balancer',   color: PHASE_COLORS.balancing },
  { key: 'Pareto',     label: 'Pareto',     color: PHASE_COLORS.pareto },
  { key: 'Mutagenesis',label: 'Mutagen.',   color: PHASE_COLORS.mutagenesis },
];

/* ── Section Label ────────────────────────────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.1em', color: LABEL, margin: '0 0 10px',
  }}>
    {children}
  </p>
);

/* ── Binding Radar SVG ────────────────────────────────────────────── */

function BindingRadar({ result }: { result: BindingAffinityResult }) {
  const W = 520, H = 460;
  const axes = [
    { label: 'Distance', value: result.distanceScore },
    { label: 'Orientation', value: result.orientationScore },
    { label: 'vdW', value: result.vdwScore },
    { label: 'Electrostatic', value: result.electrostaticScore },
  ];

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <rect x="20" y="24" width="220" height="154" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x="36" y="18" fontFamily={T.SANS} fontSize="9" fill={LABEL} letterSpacing="0.12em">ACTIVE-SITE DIAGNOSTICS</text>
      <text x="36" y="32" fontFamily={T.SANS} fontSize="11" fill={VALUE}>Binding dimensions against optimal docking envelope</text>
      {axes.map((ax, index) => {
        const y = 56 + index * 28;
        const width = ax.value * 136;
        return (
          <g key={ax.label}>
            <text x="36" y={y} fontFamily={T.SANS} fontSize="9" fill={LABEL}>{ax.label}</text>
            <rect x="122" y={y - 8} width="136" height="10" rx="5" fill="rgba(255,255,255,0.05)" />
            <rect x="122" y={y - 8} width={width} height="10" rx="5" fill={PHASE_COLORS.binding} opacity="0.82" />
            <line x1="230" y1={y - 12} x2="230" y2={y + 4} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 2" />
            <text x="270" y={y} fontFamily={T.MONO} fontSize="8" fill={VALUE}>{ax.value.toFixed(3)}</text>
          </g>
        );
      })}
      <rect x="268" y="24" width="232" height="154" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x="284" y="52" fontFamily={T.MONO} fontSize="28" fill="rgba(247,249,255,0.92)">{result.overallScore.toFixed(3)}</text>
      <text x="284" y="67" fontFamily={T.SANS} fontSize="9" fill={LABEL}>overall catalytic fit</text>
      <text x="284" y="104" fontFamily={T.SANS} fontSize="9" fill={LABEL}>Predicted Kd</text>
      <text x="284" y="118" fontFamily={T.MONO} fontSize="14" fill={VALUE}>{result.predictedKd.toFixed(2)} μM</text>
      <text x="392" y="104" fontFamily={T.SANS} fontSize="9" fill={LABEL}>Binding energy</text>
      <text x="392" y="118" fontFamily={T.MONO} fontSize="14" fill={VALUE}>{result.bindingEnergy.toFixed(2)} kcal/mol</text>
      <text x="284" y="148" fontFamily={T.SANS} fontSize="9" fill="rgba(255,255,255,0.42)">
        {result.interpretation}
      </text>

      <rect x="20" y="198" width="480" height="226" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x="36" y="218" fontFamily={T.MONO} fontSize="8" fill={LABEL}>BINDING ENERGY DECOMPOSITION</text>
      {[
        { label: 'Distance fit', value: result.distanceScore, color: '#F0FDFA' },
        { label: 'Orientation fit', value: result.orientationScore, color: '#5151CD' },
        { label: 'vdW packing', value: result.vdwScore, color: '#FF8B1F' },
        { label: 'Electrostatic complementarity', value: result.electrostaticScore, color: '#93CB52' },
      ].map((item, index) => {
        const x = 42 + index * 112;
        const height = item.value * 112;
        return (
          <g key={item.label}>
            <rect x={x} y={338 - height} width="48" height={height} rx="8" fill={item.color} opacity="0.82" />
            <rect x={x} y="226" width="48" height="112" rx="8" fill="none" stroke="rgba(255,255,255,0.08)" />
            <text x={x + 24} y="352" textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={VALUE}>{item.value.toFixed(2)}</text>
            <text x={x + 24} y="372" textAnchor="middle" fontFamily={T.SANS} fontSize="8" fill={LABEL}>
              {item.label.length > 13 ? `${item.label.slice(0, 12)}…` : item.label}
            </text>
          </g>
        );
      })}
      <line x1="314" y1="234" x2="314" y2="394" stroke="rgba(255,255,255,0.08)" />
      <text x="332" y="242" fontFamily={T.MONO} fontSize="8" fill={LABEL}>Design note</text>
      <text x="332" y="260" fontFamily={T.SANS} fontSize="10" fill={VALUE}>
        Use residues with the weakest bars as first-pass mutagenesis targets.
      </text>
      <text x="332" y="278" fontFamily={T.SANS} fontSize="10" fill={VALUE}>
        A score above 0.80 means the catalytic pocket is already close to
      </text>
      <text x="332" y="292" fontFamily={T.SANS} fontSize="10" fill={VALUE}>
        a viable wet-lab prototype, so effort should move to stability and flux.
      </text>
    </svg>
  );
}

/* ── Active Site Residue Projection ──────────────────────────────── */

const AS_RESIDUES = [
  { name: 'Ser195', type: 'catalytic',   x: 198, y: 125, contrib: 0.95 },
  { name: 'His57',  type: 'catalytic',   x: 132, y: 158, contrib: 0.92 },
  { name: 'Asp102', type: 'catalytic',   x: 98,  y: 218, contrib: 0.88 },
  { name: 'Gly193', type: 'polar',       x: 228, y: 92,  contrib: 0.45 },
  { name: 'Ser214', type: 'polar',       x: 163, y: 78,  contrib: 0.52 },
  { name: 'Trp215', type: 'hydrophobic', x: 278, y: 108, contrib: 0.72 },
  { name: 'Val216', type: 'hydrophobic', x: 318, y: 138, contrib: 0.35 },
  { name: 'Gly217', type: 'polar',       x: 342, y: 174, contrib: 0.28 },
  { name: 'Asp189', type: 'charged',     x: 308, y: 218, contrib: 0.66 },
  { name: 'Lys224', type: 'charged',     x: 276, y: 256, contrib: 0.58 },
  { name: 'Tyr228', type: 'polar',       x: 228, y: 286, contrib: 0.40 },
  { name: 'His40',  type: 'charged',     x: 168, y: 278, contrib: 0.48 },
  { name: 'Cys42',  type: 'polar',       x: 118, y: 252, contrib: 0.38 },
  { name: 'Met192', type: 'hydrophobic', x: 164, y: 192, contrib: 0.55 },
  { name: 'Phe41',  type: 'hydrophobic', x: 74,  y: 188, contrib: 0.42 },
  { name: 'Asn155', type: 'polar',       x: 84,  y: 138, contrib: 0.32 },
] as const;

const AS_EDGES: [number, number][] = [
  [0,1],[1,2],[0,3],[3,4],[0,5],[5,6],[6,7],[7,8],[8,9],[9,10],
  [10,11],[11,12],[12,13],[2,12],[1,13],[13,14],[14,15],[15,2],[0,13],[1,5],
];

const AS_COLORS: Record<string, string> = {
  catalytic:   '#4DAF4A',
  polar:       '#377EB8',
  hydrophobic: '#FF7F00',
  charged:     '#E41A1C',
};

function ActiveSitePlot({ overallScore }: { overallScore: number }) {
  const W = 520, H = 340;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL, margin: '0 0 4px',
        letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Active site residue projection
      </p>
      <p style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL, margin: '0 0 8px', lineHeight: 1.5 }}>
        Active site residues projected from AlphaFold structure · colored by chemical class
      </p>
      <svg role="img" aria-label="Active site residues" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        <rect width={W} height={H} fill="#050505" rx={10} />
        {/* Background subtle grid */}
        {Array.from({ length: 7 }, (_, i) => {
          const gx = 40 + i * 68, gy = 30 + i * 44;
          return (
            <g key={i}>
              <line x1={gx} y1={30} x2={gx} y2={H - 24} stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
              <line x1={40} y1={gy} x2={W - 30} y2={gy} stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
            </g>
          );
        })}
        {/* Edges */}
        {AS_EDGES.map(([a, b], i) => {
          const ra = AS_RESIDUES[a], rb = AS_RESIDUES[b];
          const colorA = AS_COLORS[ra.type], colorB = AS_COLORS[rb.type];
          const sameType = ra.type === rb.type;
          return (
            <line key={i}
              x1={ra.x + 30} y1={ra.y + 20} x2={rb.x + 30} y2={rb.y + 20}
              stroke={sameType ? colorA : 'rgba(255,255,255,0.1)'}
              strokeWidth={sameType ? 1 : 0.7}
              opacity={sameType ? 0.35 : 0.22}
              strokeDasharray={sameType ? '' : '3 4'} />
          );
        })}
        {/* Nodes */}
        {AS_RESIDUES.map((res, i) => {
          const color = AS_COLORS[res.type];
          const r = 5 + res.contrib * overallScore * 9;
          const nx = res.x + 30, ny = res.y + 20;
          const isCatalytic = res.type === 'catalytic';
          return (
            <g key={res.name}>
              {isCatalytic && (
                <circle cx={nx} cy={ny} r={r + 5} fill={color} opacity={0.1} />
              )}
              <circle cx={nx} cy={ny} r={r}
                fill={color} opacity={isCatalytic ? 0.9 : 0.72}
                stroke={isCatalytic ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}
                strokeWidth={isCatalytic ? 1.2 : 0.6} />
              <text x={nx} y={ny - r - 3}
                textAnchor="middle"
                fontFamily={T.MONO} fontSize="6.5" fill={color} opacity={0.9}>
                {res.name}
              </text>
            </g>
          );
        })}
        {/* Legend */}
        {Object.entries(AS_COLORS).map(([cls, color], i) => (
          <g key={cls} transform={`translate(${W - 150 + i * 0}, ${H - 20 - i * 16})`}>
            <circle cx={6} cy={0} r={4} fill={color} opacity={0.8} />
            <text x={14} y={4} fontFamily={T.SANS} fontSize="8" fill={LABEL}>
              {cls.charAt(0).toUpperCase() + cls.slice(1)}
            </text>
          </g>
        ))}
        {/* Score label */}
        <text x={W - 30} y={18} textAnchor="end" fontFamily={T.MONO} fontSize="8" fill={LABEL}>
          Overall score: {overallScore.toFixed(3)}
        </text>
      </svg>
    </div>
  );
}

/* ── Catalytic Residue Table ──────────────────────────────────────── */

function ResidueTable({ enzyme }: { enzyme: EnzymeStructure }) {
  const hdr: React.CSSProperties = {
    fontFamily: T.MONO, fontSize: '9px', color: LABEL, textAlign: 'left',
    padding: '4px 6px', borderBottom: `1px solid ${BORDER}`,
  };
  const cell: React.CSSProperties = {
    fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '3px 6px',
    textAlign: 'right',
  };
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Pos', 'Res', 'Role', 'Dist Å', 'Opt Å', 'Angle°', 'Opt°', 'pKa Δ'].map(h => (
              <th key={h} style={hdr}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {enzyme.catalyticResidues.map(r => (
            <tr key={r.position} style={{ background: 'rgba(255,255,255,0.02)' }}>
              <td style={{ ...cell, textAlign: 'left', color: '#F0FDFA' }}>{r.position}</td>
              <td style={{ ...cell, textAlign: 'center' }}>{r.residue}</td>
              <td style={{ ...cell, textAlign: 'left', fontSize: '8px' }}>{r.role.replace('_', ' ')}</td>
              <td style={cell}>{r.distanceToSubstrate.toFixed(1)}</td>
              <td style={cell}>{r.optimalDistance.toFixed(1)}</td>
              <td style={cell}>{r.orientationAngle.toFixed(0)}</td>
              <td style={cell}>{r.optimalAngle.toFixed(0)}</td>
              <td style={{ ...cell, color: Math.abs(r.pKaShift) > 0.5 ? '#FA8072' : VALUE }}>
                {r.pKaShift > 0 ? '+' : ''}{r.pKaShift.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Sequence Design View ─────────────────────────────────────────── */

function SequenceView({ result }: { result: SequenceDesignResult }) {
  const caiColor = (v: number) =>
    v >= 0.75 ? '#93CB52' : v >= 0.55 ? '#FFFB1F' : 'rgba(255,120,120,0.7)';
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
      <SectionLabel>Designed Sequences — {result.targetEnzyme}</SectionLabel>
      {result.designs.map(d => (
        <div key={d.rank} style={{
          ...GLASS, padding: '10px 14px', marginBottom: 8, borderRadius: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: T.MONO, fontSize: '11px', color: PHASE_COLORS.sequence,
              fontWeight: 600 }}>#{d.rank}</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>
              Score {d.score.toFixed(3)}</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
              Recovery {(d.recoveryRate * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: caiColor(d.cai) }}>
              CAI {d.cai.toFixed(3)}</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
              GC {(d.gcContent * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px',
              color: d.rareCodons > 3 ? 'rgba(255,120,120,0.7)' : VALUE }}>
              {d.rareCodons} rare</span>
          </div>
          <div style={{
            fontFamily: T.MONO, fontSize: '9px', color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.04em', overflowX: 'auto', whiteSpace: 'nowrap',
            padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 6,
          }}>
            {d.dnaSequence.slice(0, 60)}
            {d.dnaSequence.length > 60 && <span style={{ color: LABEL }}> …</span>}
          </div>
        </div>
      ))}
      {result.consensusMotifs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <SectionLabel>Consensus Motifs</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {result.consensusMotifs.map((m, i) => (
              <span key={i} style={{
                fontFamily: T.MONO, fontSize: '10px', color: PHASE_COLORS.sequence,
                padding: '2px 8px', borderRadius: 8,
                background: 'rgba(81,81,205,0.1)', border: '1px solid rgba(81,81,205,0.15)',
              }}>{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Flux Cost Gauge ──────────────────────────────────────────────── */

function FluxCostView({ result }: { result: MetabolicDrainResult }) {
  const W = 520, H = 420;
  const barY = 74, barH = 30, barW = 380;
  const total = result.atpCost + result.nadphCost + result.ribosomeBurden * 100;
  const atpW = total > 0 ? (result.atpCost / total) * barW : 0;
  const nadW = total > 0 ? (result.nadphCost / total) * barW : 0;
  const ribW = barW - atpW - nadW;
  const viabilityColor = result.isViable
    ? result.growthPenalty < 10 ? '#93CB52' : '#FFFB1F'
    : 'rgba(255,120,120,0.8)';
  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <rect x="20" y="22" width="480" height="140" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x={70} y={barY - 18} fontFamily={T.SANS} fontSize="9" fill={LABEL}>
        RESOURCE BURDEN LEDGER (ATP / NADPH / RIBOSOME)
      </text>
      <rect x={70} y={barY} width={atpW} height={barH} fill={PHASE_COLORS.flux} rx={4} />
      <rect x={70 + atpW} y={barY} width={nadW} height={barH} fill={PHASE_COLORS.balancing} rx={0} />
      <rect x={70 + atpW + nadW} y={barY} width={Math.max(0, ribW)} height={barH}
        fill={PHASE_COLORS.pareto} rx={4} />
      <rect x={70} y={barY} width={barW} height={barH} fill="none"
        stroke="rgba(255,255,255,0.1)" rx={4} />
      <text x={70 + atpW / 2} y={barY + barH / 2 + 4} textAnchor="middle"
        fontFamily={T.MONO} fontSize="9" fill="#000000">ATP {result.atpCost.toFixed(1)}</text>
      {nadW > 40 && (
        <text x={70 + atpW + nadW / 2} y={barY + barH / 2 + 4} textAnchor="middle"
          fontFamily={T.MONO} fontSize="9" fill="#000000">NADPH {result.nadphCost.toFixed(1)}</text>
      )}
      <rect x="20" y="186" width="480" height="198" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x="36" y="206" fontFamily={T.MONO} fontSize="8" fill={LABEL}>DRAIN AND VIABILITY WINDOWS</text>
      <text x="36" y="238" fontFamily={T.MONO} fontSize="28" fill={VALUE}>
        {(result.totalMetabolicDrain * 100).toFixed(1)}%
      </text>
      <text x="36" y="252" fontFamily={T.SANS} fontSize="9" fill={LABEL}>total metabolic drain</text>
      <rect x="36" y="274" width="280" height="18" rx="9" fill="rgba(255,255,255,0.05)" />
      <rect x="36" y="274" width={Math.min(280, result.totalMetabolicDrain * 280)} height="18" rx="9" fill="rgba(255,139,31,0.82)" />
      <line x1="232" y1="268" x2="232" y2="298" stroke="rgba(255,255,255,0.24)" strokeDasharray="4 3" />
      <text x="232" y="262" textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill={LABEL}>target limit</text>

      <text x="36" y="330" fontFamily={T.SANS} fontSize="9" fill={LABEL}>Growth penalty</text>
      <rect x="36" y="338" width="280" height="14" rx="7" fill="rgba(255,255,255,0.05)" />
      <rect x="36" y="338" width={Math.min(280, (result.growthPenalty / 30) * 280)} height="14" rx="7" fill={viabilityColor} />
      <text x="324" y="349" fontFamily={T.MONO} fontSize="9" fill={VALUE}>{result.growthPenalty.toFixed(1)}%</text>

      <rect x="346" y="226" width="134" height="106" rx="12" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" />
      <text x="360" y="246" fontFamily={T.MONO} fontSize="7" fill={LABEL}>VIABILITY STATUS</text>
      <text x="360" y="270" fontFamily={T.SANS} fontSize="18" fill={viabilityColor}>
        {result.isViable ? 'Prototype viable' : 'Redesign required'}
      </text>
      <text x="360" y="294" fontFamily={T.SANS} fontSize="10" fill={VALUE}>
        {result.recommendation}
      </text>
    </svg>
  );
}

/* ── Pathway Balancer View ────────────────────────────────────────── */

function BalancerView({ result }: { result: PathwayBalanceResult }) {
  const W = 540, H = 440, PAD = 40;
  const steps = result.steps;
  const n = steps.length;
  const stepW = (W - PAD * 2) / (n * 2 - 1);
  const maxConc = Math.max(...steps.map(s => s.intermediateConc), 0.01);

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <text x={W / 2} y={24} textAnchor="middle" fontFamily={T.SANS} fontSize="10" fill={VALUE}>
        Pathway Pipeline — {n} Steps
      </text>
      {/* Badge */}
      <rect x={W - 130} y={10} width={110} height={20} rx={10}
        fill={result.isBalanced ? 'rgba(147,203,82,0.12)' : 'rgba(250,128,114,0.12)'}
        stroke={result.isBalanced ? '#93CB52' : '#FA8072'} strokeWidth={0.8} />
      <text x={W - 75} y={24} textAnchor="middle" fontFamily={T.MONO} fontSize="9"
        fill={result.isBalanced ? '#93CB52' : '#FA8072'}>
        {result.isBalanced ? 'Balanced ✓' : 'Imbalanced ✗'}
      </text>

      {/* Pipeline */}
      {steps.map((s, i) => {
        const cx = PAD + i * 2 * stepW + stepW / 2;
        const cy = 120;
        const toxRatio = s.intermediateConc / s.toxicityThreshold;
        const intColor = toxRatio > 0.8 ? 'rgba(255,120,120,0.6)' :
          toxRatio > 0.5 ? '#FFFB1F' : '#93CB52';
        const barH = Math.min(80, (s.intermediateConc / maxConc) * 80);
        return (
          <g key={i}>
            {/* Enzyme circle */}
            <circle cx={cx} cy={cy} r={18}
              fill="rgba(255,255,255,0.04)" stroke={PHASE_COLORS.balancing} strokeWidth={1} />
            <text x={cx} y={cy - 3} textAnchor="middle" fontFamily={T.MONO} fontSize="7"
              fill={VALUE}>{s.enzyme.toUpperCase()}</text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontFamily={T.MONO} fontSize="6"
              fill={LABEL}>kcat {s.adjustedKcat.toFixed(2)}</text>
            {/* Intermediate rectangle + bar */}
            {i < n - 1 && (() => {
              const ix = cx + stepW;
              return (
                <g>
                  <rect x={ix - 14} y={cy - 12} width={28} height={24} rx={4}
                    fill="rgba(255,255,255,0.03)" stroke={intColor} strokeWidth={0.8} />
                  <text x={ix} y={cy + 2} textAnchor="middle" fontFamily={T.MONO} fontSize="6"
                    fill={intColor}>{s.intermediateConc.toFixed(2)}</text>
                  <rect x={ix - 6} y={180 + (80 - barH)} width={12} height={barH} rx={3}
                    fill={intColor} opacity={0.5} />
                  {/* Arrow */}
                  <line x1={cx + 20} y1={cy} x2={ix - 16} y2={cy}
                    stroke="rgba(255,255,255,0.12)" strokeWidth={1}
                    markerEnd="url(#arrowhead)" />
                  <text x={(cx + 20 + ix - 16) / 2} y={cy - 8} textAnchor="middle"
                    fontFamily={T.MONO} fontSize="6" fill={LABEL}>
                    {s.currentFlux.toFixed(2)}
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="rgba(255,255,255,0.2)" />
        </marker>
      </defs>

      {/* Convergence chart */}
      {result.convergenceHistory.length > 1 && (() => {
        const ch = result.convergenceHistory;
        const cW = W - PAD * 2 - 40, cH = 90, cY0 = 310;
        const maxC = Math.max(...ch.map(c => c.maxConc), 0.01);
        return (
          <g>
            <text x={PAD + 20} y={cY0 - 8} fontFamily={T.SANS} fontSize="8" fill={LABEL}>
              Convergence (iterations vs max concentration)
            </text>
            <rect x={PAD + 20} y={cY0} width={cW} height={cH} rx={6}
              fill="rgba(255,255,255,0.02)" stroke={BORDER} />
            <polyline fill="none" stroke={PHASE_COLORS.balancing} strokeWidth={1.2}
              points={ch.map((c, i) =>
                `${PAD + 20 + (i / (ch.length - 1)) * cW},${cY0 + cH - (c.maxConc / maxC) * cH}`
              ).join(' ')} />
            <text x={PAD + 20} y={cY0 + cH + 12} fontFamily={T.MONO} fontSize="7" fill={LABEL}>
              0
            </text>
            <text x={PAD + 20 + cW} y={cY0 + cH + 12} textAnchor="end"
              fontFamily={T.MONO} fontSize="7" fill={LABEL}>{ch.length - 1}</text>
          </g>
        );
      })()}
    </svg>
  );
}

/* ── Pareto Front View ────────────────────────────────────────────── */

function ParetoView({ result }: { result: ParetoFrontResult }) {
  const W = 540, H = 440, PAD = 56;
  const candidates = result.candidates;
  const front = result.paretoFront;
  const frontIds = new Set(front.map(c => c.id));

  const xMin = Math.min(...candidates.map(c => c.scores.thermodynamic)) - 0.05;
  const xMax = Math.max(...candidates.map(c => c.scores.thermodynamic)) + 0.05;
  const yMin = Math.min(...candidates.map(c => c.scores.yield)) - 0.05;
  const yMax = Math.max(...candidates.map(c => c.scores.yield)) + 0.05;
  const xR = xMax - xMin || 1, yR = yMax - yMin || 1;

  const sx = (v: number) => PAD + ((v - xMin) / xR) * (W - PAD * 2);
  const sy = (v: number) => H - PAD - ((v - yMin) / yR) * (H - PAD * 2);

  const sorted = [...front].sort((a, b) => a.scores.thermodynamic - b.scores.thermodynamic);

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const gx = PAD + t * (W - PAD * 2);
        const gy = PAD + t * (H - PAD * 2);
        return (
          <g key={t}>
            <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="rgba(255,255,255,0.04)" />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.04)" />
          </g>
        );
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <text x={W / 2} y={H - 10} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>
        Thermodynamic Score
      </text>
      <text x={14} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,14,${H / 2})`}>
        Yield Score
      </text>

      {/* Pareto front line */}
      {sorted.length > 1 && (
        <polyline fill="none" stroke={PHASE_COLORS.pareto} strokeWidth={1.2} strokeDasharray="4 3"
          points={sorted.map(c => `${sx(c.scores.thermodynamic)},${sy(c.scores.yield)}`).join(' ')} />
      )}

      {/* Points */}
      {candidates.map(c => {
        const px = sx(c.scores.thermodynamic);
        const py = sy(c.scores.yield);
        const r = Math.max(5, Math.min(14, (1 / (c.scores.metabolicCost + 0.1)) * 4));
        const isFront = frontIds.has(c.id);
        const isBest = c.id === result.bestOverall;
        return (
          <g key={c.id}>
            <circle cx={px} cy={py} r={r}
              fill={isFront ? PHASE_COLORS.pareto : 'rgba(255,255,255,0.1)'}
              opacity={isFront ? 0.8 : 0.35}
              stroke={isBest ? '#fff' : 'none'} strokeWidth={isBest ? 1.5 : 0} />
            {isBest && (
              <text x={px} y={py - r - 6} textAnchor="middle" fontFamily={T.SANS} fontSize="12"
                fill="#FFFB1F">★</text>
            )}
            <text x={px} y={py + r + 12} textAnchor="middle" fontFamily={T.SANS} fontSize="8"
              fill={isFront ? VALUE : LABEL}>{c.name}</text>
            <text x={px} y={py + r + 22} textAnchor="middle" fontFamily={T.MONO} fontSize="7"
              fill={LABEL}>Rank {c.paretoRank}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Mutagenesis View ─────────────────────────────────────────────── */

function MutagenesisView({ result, enzyme }: { result: MutagenesisResult; enzyme: EnzymeStructure }) {
  const W = 540, H = 450, PAD = 30;
  const seqLen = enzyme.length;
  const barY = 44, barH = 22;
  const barW = W - PAD * 2;
  const catalyticPositions = new Set(enzyme.catalyticResidues.map(r => r.position));

  const effectColor = (e: string) =>
    e === 'beneficial' ? '#93CB52' : e === 'neutral' ? '#FFFB1F' : 'rgba(255,120,120,0.7)';

  const tblY = 160;
  const rowH = 34;
  const hdr: React.CSSProperties = {
    fontFamily: T.MONO, fontSize: '8px', color: LABEL, textAlign: 'left',
    padding: '3px 5px', borderBottom: `1px solid ${BORDER}`,
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 0 }}>
      <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${barY + barH + 60}`} style={{ width: '100%' }}>
        <rect width={W} height={barY + barH + 60} fill="#050505" rx={12} />
        {/* Sequence bar */}
        <rect x={PAD} y={barY} width={barW} height={barH} rx={4} fill="rgba(255,255,255,0.04)"
          stroke={BORDER} />
        {/* Ticks every 50 residues */}
        {Array.from({ length: Math.ceil(seqLen / 50) + 1 }).map((_, i) => {
          const pos = i * 50;
          if (pos > seqLen) return null;
          const tx = PAD + (pos / seqLen) * barW;
          return (
            <g key={pos}>
              <line x1={tx} y1={barY + barH} x2={tx} y2={barY + barH + 4}
                stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
              <text x={tx} y={barY + barH + 12} textAnchor="middle"
                fontFamily={T.MONO} fontSize="6" fill={LABEL}>{pos}</text>
            </g>
          );
        })}
        {/* Catalytic residues (red) */}
        {enzyme.catalyticResidues.map(r => {
          const rx = PAD + (r.position / seqLen) * barW;
          return (
            <rect key={`cat-${r.position}`} x={rx - 1.5} y={barY + 2} width={3} height={barH - 4}
              fill="rgba(250,128,114,0.6)" rx={1} />
          );
        })}
        {/* Mutagenesis sites (green triangles) */}
        {result.sites.map(s => {
          const sx = PAD + (s.position / seqLen) * barW;
          return (
            <g key={`mut-${s.position}`}>
              <rect x={sx - 2} y={barY + 2} width={4} height={barH - 4}
                fill="rgba(147,203,82,0.5)" rx={1} />
              <polygon points={`${sx},${barY - 6} ${sx - 4},${barY - 1} ${sx + 4},${barY - 1}`}
                fill={PHASE_COLORS.mutagenesis} />
            </g>
          );
        })}
        {/* Legend */}
        <rect x={PAD} y={barY + barH + 20} width={8} height={8} fill="rgba(250,128,114,0.6)" rx={2} />
        <text x={PAD + 12} y={barY + barH + 27} fontFamily={T.SANS} fontSize="8" fill={LABEL}>
          Catalytic
        </text>
        <rect x={PAD + 70} y={barY + barH + 20} width={8} height={8} fill={PHASE_COLORS.mutagenesis} rx={2} />
        <text x={PAD + 82} y={barY + barH + 27} fontFamily={T.SANS} fontSize="8" fill={LABEL}>
          Mutagenesis site
        </text>
      </svg>

      {/* Top combination */}
      <div style={{
        ...GLASS, margin: '8px 16px', padding: '8px 14px', borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Top Combination</span>
        <span style={{ fontFamily: T.MONO, fontSize: '11px', color: PHASE_COLORS.mutagenesis }}>
          {result.topCombination.positions.join(', ')}
        </span>
        <span style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE }}>
          +{(result.topCombination.predictedImprovement * 100).toFixed(0)}% predicted
        </span>
      </div>

      {/* Sites table */}
      <div style={{ padding: '0 16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Pos', 'WT', 'Mutants', 'Cons.', 'Effect', 'ΔKcat', 'ΔKm', 'Conf.', 'Rationale'].map(h => (
                <th key={h} style={hdr}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.sites.map(s => (
              <tr key={s.position} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: PHASE_COLORS.mutagenesis,
                  padding: '4px 5px' }}>{s.position}</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'center' }}>{s.wildTypeResidue}</td>
                <td style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE, padding: '4px 5px' }}>
                  {s.suggestedMutants.join(', ')}</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'right' }}>{s.conservationScore.toFixed(2)}</td>
                <td style={{ fontFamily: T.SANS, fontSize: '9px', padding: '4px 5px',
                  color: effectColor(s.predictedEffect) }}>{s.predictedEffect}</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'right' }}>{s.predictedDeltaKcat.toFixed(2)}×</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'right' }}>{s.predictedDeltaKm.toFixed(2)}×</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'right' }}>{(s.confidence * 100).toFixed(0)}%</td>
                <td style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL, padding: '4px 5px',
                  maxWidth: 120 }}>{s.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════════════ */

export default function CatalystDesignerPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [selectedEnzyme, setSelectedEnzyme] = useState<number>(2);
  const [viewMode, setViewMode] = useState<ViewMode>('Binding');
  const recommendedSeed = useMemo(
    () => buildCatalystSeed(project, analyzeArtifact, fbaPayload, cethxPayload, dbtlPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, fbaPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  useEffect(() => {
    setSelectedEnzyme(recommendedSeed.enzymeIndex);
  }, [recommendedSeed.enzymeIndex]);

  const enzyme = ENZYME_STRUCTURES[selectedEnzyme];
  const { data: binding, error: simError } = useMemo(() => {
    try { return { data: predictBindingAffinity(enzyme), error: null as string | null }; }
    catch (e) { return { data: predictBindingAffinity(ENZYME_STRUCTURES[selectedEnzyme]), error: e instanceof Error ? e.message : 'Binding prediction failed' }; }
  }, [enzyme]);
  const sequences = useMemo(() => designSequences(enzyme, recommendedSeed.designCount), [enzyme, recommendedSeed.designCount]);
  const drain = useMemo(() => estimateMetabolicDrain(enzyme, recommendedSeed.requiredFlux), [enzyme, recommendedSeed.requiredFlux]);
  const balance = useMemo(() => balancePathway(PATHWAY_STEPS), []);
  const pareto = useMemo(() => rankPathways(PATHWAY_CANDIDATES), []);
  const mutagenesis = useMemo(() => predictMutagenesisSites(enzyme, 5), [enzyme]);

  const bestPathway = pareto.candidates.find(c => c.id === pareto.bestOverall);
  const figureMeta = useMemo(() => {
    if (viewMode === 'Binding') {
      return {
        eyebrow: 'Figure A · Active-Site Fit',
        title: `${enzyme.name} binding geometry and catalytic residue context`,
        caption: 'Binding view is framed as a scientific figure panel, keeping affinity, residue support, and local active-site logic together instead of distributing them across unrelated cards.',
      };
    }
    if (viewMode === 'Sequences') {
      return {
        eyebrow: 'Figure B · Sequence Proposal Plate',
        title: 'Designed sequence variants ranked for expression and catalytic fit',
        caption: 'Sequence proposals are presented as a candidate plate, so rank, CAI, GC balance, and rationale read like a design figure rather than an export list.',
      };
    }
    if (viewMode === 'FluxCost') {
      return {
        eyebrow: 'Figure C · Route Burden',
        title: 'Catalyst choice translated into metabolic burden and viability',
        caption: 'Flux-cost analysis ties the enzyme decision back to host-level burden, making route feasibility a first-class figure within the design bench.',
      };
    }
    if (viewMode === 'Balancer') {
      return {
        eyebrow: 'Figure D · Pathway Balancing',
        title: 'Stepwise balancing and stoichiometric pressure across the route',
        caption: 'Balancing view should read as a pathway figure with intervention context, not as an isolated engineering utility.',
      };
    }
    if (viewMode === 'Pareto') {
      return {
        eyebrow: 'Figure E · Multi-Objective Tradeoff',
        title: 'Pareto frontier for catalyst and route prioritization',
        caption: 'Trade-off view promotes the design decision itself into the center panel, aligning pathway viability, catalytic fit, and optimization pressure in one evidence frame.',
      };
    }
    return {
      eyebrow: 'Figure F · Mutational Leverage',
      title: 'Directed mutagenesis opportunities around catalytic bottlenecks',
      caption: 'Mutagenesis is presented as a leverage figure: where to edit, why that site matters, and how the predicted effect maps onto the current catalyst selection.',
    };
  }, [enzyme.name, viewMode]);
  useEffect(() => {
    if (simError) return;
    setToolPayload('catdes', {
      toolId: 'catdes',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      selectedEnzymeId: enzyme.id,
      selectedEnzymeName: enzyme.name,
      selectedView: viewMode,
      requiredFlux: recommendedSeed.requiredFlux,
      designCount: recommendedSeed.designCount,
      result: {
        bindingKd: binding.predictedKd,
        overallBinding: binding.overallScore,
        bestSequenceScore: sequences.designs[0]?.score ?? 0,
        bestCAI: sequences.designs[0]?.cai ?? 0,
        totalMetabolicDrain: drain.totalMetabolicDrain,
        growthPenalty: drain.growthPenalty,
        isViable: drain.isViable,
        bestPathway: bestPathway?.name ?? 'No ranked pathway',
        topMutationSites: mutagenesis.sites.filter((site) => site.predictedEffect === 'beneficial').length,
        recommendation: drain.recommendation,
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    bestPathway?.name,
    binding.overallScore,
    binding.predictedKd,
    drain.growthPenalty,
    drain.isViable,
    drain.recommendation,
    drain.totalMetabolicDrain,
    enzyme.id,
    enzyme.name,
    mutagenesis.sites,
    project?.targetProduct,
    project?.title,
    recommendedSeed.designCount,
    recommendedSeed.requiredFlux,
    sequences.designs,
    setToolPayload,
    simError,
    viewMode,
  ]);

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <>
      <div className="nb-tool-page">

        {/* Algorithm Insight */}
        <AlgorithmInsight
          title="Catalyst-Designer Engine"
          description="AlphaFold 3-inspired binding prediction → ProteinMPNN sequence design → FBA flux coupling → Church-method balancing → Pareto multi-objective ranking → ESM-2 mutagenesis"
          formula="Kd = exp(ΔG_bind/RT) | ΔΔG = Σ BLOSUM(wt,mut)"
        />
        <div style={{ padding: '0 16px 10px' }}>
          <WorkbenchInlineContext
            toolId="catdes"
            title="Catalyst Design"
            summary="Catalyst design consumes flux, thermodynamic, and pathway evidence together, so sequence proposals, mutagenesis sites, and viability scoring stay synchronized with the current research object instead of drifting into isolated enzyme demos."
            compact
            isSimulated={!analyzeArtifact}
          />
        </div>
        <div style={{ padding: '0 16px 10px' }}>
          <ScientificHero
            eyebrow="Stage 2 · Catalyst & Enzyme Optimization"
            title={`${enzyme.name} as the current catalytic bottleneck`}
            summary="Catalyst Designer should feel less like a grab-bag of molecular widgets and more like a decision deck: binding confidence, sequence proposals, mutational leverage, and pathway viability are surfaced together so redesign decisions stay scientifically coherent."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Route pressure
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {recommendedSeed.requiredFlux.toFixed(2)} required flux · {recommendedSeed.designCount} sequence proposal(s)
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  Flux and thermodynamic context from upstream tools are now visible here before any sequence is trusted.
                </div>
              </>
            }
            signals={[
              {
                label: 'Predicted Kd',
                value: `${binding.predictedKd.toFixed(2)} μM`,
                detail: `Overall binding score ${binding.overallScore.toFixed(2)} for ${enzyme.name}`,
                tone: binding.predictedKd < 10 ? 'cool' : 'warm',
              },
              {
                label: 'Best Sequence',
                value: `${sequences.designs[0]?.score.toFixed(2) ?? '0.00'} score`,
                detail: `CAI ${sequences.designs[0]?.cai.toFixed(2) ?? '0.00'} · GC ${(sequences.designs[0]?.gcContent ?? 0).toFixed(1)}%`,
                tone: 'cool',
              },
              {
                label: 'Growth Penalty',
                value: `${drain.growthPenalty.toFixed(1)}%`,
                detail: drain.recommendation,
                tone: drain.isViable ? 'warm' : 'alert',
              },
              {
                label: 'Mutation Leverage',
                value: `${mutagenesis.sites.filter((site) => site.predictedEffect === 'beneficial').length} beneficial sites`,
                detail: `${bestPathway?.name ?? 'No ranked pathway'} remains the leading pathway candidate in the current design window.`,
                tone: 'neutral',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificMethodStrip
            label="Candidate Bench Grammar"
            items={[
              {
                title: 'Binding and structure',
                detail: 'A candidate page should open on catalytic geometry and residue context, because structure is part of the argument for why this enzyme matters.',
                accent: PATHD_THEME.coral,
                note: 'Structure-backed fit',
              },
              {
                title: 'Sequence and mutation deck',
                detail: 'Designed variants and beneficial sites should read like a curated candidate plate, not a stack of export-ready rows.',
                accent: PATHD_THEME.lilac,
                note: 'Candidate comparison',
              },
              {
                title: 'Host viability check',
                detail: 'Catalyst selection is incomplete until burden, balancing, and route-level feasibility are visible beside the candidate evidence.',
                accent: PATHD_THEME.mint,
                note: 'System viability',
              },
            ]}
          />
        </div>

        {simError && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={simError} /></div>
        )}

        {/* 3-Panel Layout */}
        <div className="nb-tool-panels" style={{ flex: 1 }}>

          {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
          <div className="nb-tool-sidebar" style={{
            width: 240, minWidth: 240, background: PANEL_BG,
            borderRight: `1px solid ${BORDER}`,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* Enzyme Selector */}
            <div>
              <SectionLabel>Enzyme Selector</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ENZYME_STRUCTURES.map((enz, i) => {
                  const isRL = enz.id === RATE_LIMITING_ENZYME.id;
                  const sel = i === selectedEnzyme;
                  return (
                    <button aria-label="Action" key={enz.id} onClick={() => setSelectedEnzyme(i)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '6px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: sel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                      transition: 'background 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                        <span style={{ fontFamily: T.SANS, fontSize: '11px', fontWeight: 600,
                          color: sel ? '#fff' : VALUE }}>{enz.name}</span>
                        {isRL && (
                          <span style={{
                            fontFamily: T.MONO, fontSize: '7px', color: '#FFFB1F',
                            background: 'rgba(255,251,31,0.12)',
                            padding: '1px 5px', borderRadius: 6,
                          }}>⚠ Rate-limiting</span>
                        )}
                      </div>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL }}>
                        EC {enz.ecNumber}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* View Mode Tabs */}
            <div>
              <SectionLabel>Analysis View</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {VIEW_MODES.map(vm => (
                  <button aria-label="Action" key={vm.key} onClick={() => setViewMode(vm.key)} style={{
                    fontFamily: T.SANS, fontSize: '9px', padding: '5px 2px',
                    border: viewMode === vm.key
                      ? `1px solid ${vm.color}` : `1px solid ${INPUT_BORDER}`,
                    borderRadius: 8, cursor: 'pointer',
                    background: viewMode === vm.key
                      ? `${vm.color}18` : INPUT_BG,
                    color: viewMode === vm.key ? vm.color : INPUT_TEXT,
                    transition: 'all 0.15s',
                  }}>
                    {vm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Enzyme Quick Stats */}
            <div>
              <SectionLabel>Enzyme Quick Stats</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <MetricCard label="kcat" value={enzyme.kcat.toFixed(2)} unit="s⁻¹" />
                <MetricCard label="Km" value={enzyme.km.toFixed(3)} unit="mM" />
                <MetricCard label="Tm" value={enzyme.meltingTemp.toFixed(0)} unit="°C" />
                <MetricCard label="MW" value={enzyme.molecularWeight.toFixed(1)} unit="kDa" />
              </div>
            </div>

            {/* Substrate / Product */}
            <div>
              <SectionLabel>Reaction</SectionLabel>
              <div style={{
                fontFamily: T.SANS, fontSize: '9px', color: VALUE, lineHeight: 1.5,
                padding: '6px 8px', ...GLASS, borderRadius: 10,
              }}>
                <span style={{ color: LABEL }}>Substrate:</span> {enzyme.substrate}
                <br />
                <span style={{ color: LABEL }}>Product:</span> {enzyme.product}
                <br />
                <span style={{ color: LABEL }}>pH opt:</span>{' '}
                <span style={{ fontFamily: T.MONO }}>{enzyme.optimalPH}</span>
                {' | '}
                <span style={{ color: LABEL }}>T opt:</span>{' '}
                <span style={{ fontFamily: T.MONO }}>{enzyme.optimalTemp}°C</span>
              </div>
            </div>
          </div>

          {/* ── CENTER CANVAS ─────────────────────────────────────── */}
          <div className="nb-tool-center" style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: PANEL_BG, minWidth: 0, padding: '16px',
          }}>
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <ScientificFigureFrame
                eyebrow={figureMeta.eyebrow}
                title={figureMeta.title}
                caption={figureMeta.caption}
                minHeight="100%"
                legend={[
                  { label: 'View', value: viewMode, accent: PATHD_THEME.apricot },
                  { label: 'Catalyst', value: enzyme.name, accent: PATHD_THEME.coral },
                  { label: 'Route', value: bestPathway?.name ?? 'Pending', accent: PATHD_THEME.mint },
                  { label: 'Required flux', value: `${recommendedSeed.requiredFlux.toFixed(2)}`, accent: PATHD_THEME.sky },
                ]}
                footer={
                  <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                    Candidate evidence is kept in one figure frame so catalytic fit, design proposals, and host-level burden can be compared as one decision surface.
                  </div>
                }
              >
                {viewMode === 'Binding' && (
                  <div style={{ padding: 8 }}>
                    <BindingRadar result={binding} />
                    <ActiveSitePlot overallScore={binding.overallScore} />
                    <div style={{ marginTop: 8 }}>
                      <SectionLabel>Catalytic Residues — {enzyme.name}</SectionLabel>
                      <ResidueTable enzyme={enzyme} />
                    </div>
                  </div>
                )}
                {viewMode === 'Sequences' && <SequenceView result={sequences} />}
                {viewMode === 'FluxCost' && (
                  <div style={{ padding: 8 }}>
                    <FluxCostView result={drain} />
                  </div>
                )}
                {viewMode === 'Balancer' && (
                  <div style={{ padding: 8 }}>
                    <BalancerView result={balance} />
                  </div>
                )}
                {viewMode === 'Pareto' && (
                  <div style={{ padding: 8 }}>
                    <ParetoView result={pareto} />
                  </div>
                )}
                {viewMode === 'Mutagenesis' && (
                  <MutagenesisView result={mutagenesis} enzyme={enzyme} />
                )}
              </ScientificFigureFrame>
            </div>

            {/* Export bar */}
            <div style={{
              display: 'flex', gap: 8, padding: '8px 14px',
              borderTop: `1px solid ${BORDER}`, background: PANEL_BG,
            }}>
              <ExportButton label="Export Design JSON"
                data={{ enzyme: enzyme.id, binding, sequences, drain, balance, pareto, mutagenesis }}
                filename="catalyst-design" format="json" />
              <ExportButton label="Export Sequences CSV"
                data={sequences.designs} filename="catalyst-sequences" format="csv" />
            </div>
          </div>

          {/* ── RIGHT PANEL ───────────────────────────────────────── */}
          <div className="nb-tool-right" style={{
            width: 260, minWidth: 260, background: PANEL_BG,
            borderLeft: `1px solid ${BORDER}`, padding: '14px 12px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* Design Summary */}
            <div>
              <SectionLabel>Design Summary</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <MetricCard label="Binding Kd" value={binding.predictedKd.toFixed(2)} unit="μM" />
                <MetricCard label="Best Seq Score" value={
                  sequences.designs.length > 0
                    ? sequences.designs[0].score.toFixed(3) : '—'
                } />
                <MetricCard label="Best CAI" value={
                  sequences.designs.length > 0
                    ? sequences.designs[0].cai.toFixed(3) : '—'
                } />
                <MetricCard label="Metabolic Drain" value={
                  (drain.totalMetabolicDrain * 100).toFixed(1)
                } unit="%" warning={!drain.isViable ? 'Non-viable' : undefined} />
                <MetricCard label="Pathway Balanced"
                  value={balance.isBalanced ? 'Yes' : 'No'}
                  highlight={balance.isBalanced} />
                <MetricCard label="Best Pathway" value={
                  bestPathway ? bestPathway.name : '—'
                } />
                <MetricCard label="Top Mutation Sites" value={
                  mutagenesis.sites
                    .filter(s => s.predictedEffect === 'beneficial')
                    .length.toString()
                } unit="beneficial" />
              </div>
            </div>

            {/* Audit Trail */}
            <div>
              <SectionLabel>Audit Trail</SectionLabel>
              <div style={{
                maxHeight: 300, overflowY: 'auto', display: 'flex',
                flexDirection: 'column', gap: 6,
              }}>
                {mutagenesis.auditTrail.map(a => {
                  const phaseKey = PHASE_MAP[a.phase] ?? 'binding';
                  const color = PHASE_COLORS[phaseKey] ?? VALUE;
                  return (
                    <div key={a.step} style={{
                      ...GLASS, borderRadius: 12, padding: '8px 10px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{
                          fontFamily: T.MONO, fontSize: '9px', color: VALUE, fontWeight: 700,
                          background: color, padding: '1px 6px', borderRadius: 6,
                        }}>{a.step}</span>
                        <span style={{
                          fontFamily: T.SANS, fontSize: '8px', color,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>{a.phase.replace('_', ' ')}</span>
                      </div>
                      <p style={{
                        fontFamily: T.SANS, fontSize: '9px', color: VALUE,
                        margin: 0, lineHeight: 1.4,
                      }}>{a.description}</p>
                      {/* Confidence bar */}
                      <div style={{
                        marginTop: 4, height: 3, borderRadius: 2,
                        background: 'rgba(255,255,255,0.06)',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2, background: color,
                          width: `${a.confidence * 100}%`, opacity: 0.6,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Export duplicates at bottom of right panel */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <ExportButton label="Full Report JSON"
                data={{ enzyme: enzyme.id, binding, sequences, drain, balance, pareto, mutagenesis }}
                filename="catalyst-full-report" format="json" />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
