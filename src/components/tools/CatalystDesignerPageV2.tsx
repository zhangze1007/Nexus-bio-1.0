'use client';
import { useEffect, useMemo, useState } from 'react';
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
import { T } from '../ide/tokens';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import CatalystViewer3D, { kdToQuality, bindingColorCSS } from '../molecular/CatalystViewer3D';
import type { ResidueClickData } from '../molecular/CatalystViewer3D';
import type { MutagenesisSite } from '../../services/CatalystDesignerEngine';

/* ── Design Tokens (ported from V1) ──────────────────────────────── */

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
  binding:     '#BFDCCD',
  sequence:    '#AFC3D6',
  flux:        '#E7C7A9',
  balancing:   '#E8A3A1',
  pareto:      '#CFC4E3',
  mutagenesis: '#BFDCCD',
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

/* ── Small helpers ─────────────────────────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.1em', color: LABEL, margin: '0 0 10px',
  }}>
    {children}
  </p>
);

const kdQuality = (kd: number) => {
  if (kd < 1) return { icon: '▲', label: 'Excellent', color: '#93CB52' };
  if (kd < 10) return { icon: '▲', label: 'Good', color: '#93CB52' };
  if (kd < 100) return { icon: '~', label: 'Moderate', color: '#FFFB1F' };
  if (kd < 1000) return { icon: '▼', label: 'Weak', color: '#E7C7A9' };
  return { icon: '▼', label: 'Very weak', color: 'rgba(255,120,120,0.7)' };
};

const kcatQuality = (kcat: number) => {
  if (kcat > 100) return { icon: '▲', label: 'Excellent', color: '#93CB52' };
  if (kcat > 10) return { icon: '▲', label: 'Good', color: '#93CB52' };
  if (kcat > 1) return { icon: '~', label: 'Moderate', color: '#FFFB1F' };
  return { icon: '▼', label: 'Slow', color: 'rgba(255,120,120,0.7)' };
};

const fitQuality = (fit: number) => {
  if (fit > 0.8) return { icon: '▲', label: 'Great', color: '#93CB52' };
  if (fit > 0.6) return { icon: '~', label: 'OK', color: '#FFFB1F' };
  return { icon: '▼', label: 'Poor', color: 'rgba(255,120,120,0.7)' };
};

/* ── Binding Radar SVG (ported from V1) ──────────────────────────── */

function BindingRadar({ result }: { result: BindingAffinityResult }) {
  const W = 560, H = 460;
  const axes = [
    { label: 'Distance', value: result.distanceScore },
    { label: 'Orientation', value: result.orientationScore },
    { label: 'vdW', value: result.vdwScore },
    { label: 'Electrostatic', value: result.electrostaticScore },
  ];
  const LEFT_X = 20, LEFT_W = 248;
  const BAR_X = 116, BAR_W = 100;
  const BAR_MARKER = BAR_X + Math.round(BAR_W * 0.95);
  const VAL_X = BAR_X + BAR_W + 8;
  const RIGHT_X = 284, RIGHT_W = 256;
  const RIGHT_INNER = RIGHT_X + 16;

  return (
    <svg role="img" aria-label="Binding radar chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <rect x={LEFT_X} y="24" width={LEFT_W} height="154" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x={LEFT_X + 16} y="44" fontFamily={T.SANS} fontSize="9" fill={LABEL} letterSpacing="0.12em">ACTIVE-SITE DIAGNOSTICS</text>
      <text x={LEFT_X + 16} y="60" fontFamily={T.SANS} fontSize="10" fill={VALUE}>Binding dimensions vs. optimal envelope</text>
      {axes.map((ax, index) => {
        const y = 86 + index * 22;
        const width = ax.value * BAR_W;
        return (
          <g key={ax.label}>
            <text x={LEFT_X + 16} y={y + 3} fontFamily={T.SANS} fontSize="9" fill={LABEL}>{ax.label}</text>
            <rect x={BAR_X} y={y - 5} width={BAR_W} height="8" rx="4" fill="rgba(255,255,255,0.05)" />
            <rect x={BAR_X} y={y - 5} width={width} height="8" rx="4" fill={PHASE_COLORS.binding} opacity="0.82" />
            <line x1={BAR_MARKER} y1={y - 9} x2={BAR_MARKER} y2={y + 7} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 2" />
            <text x={VAL_X} y={y + 3} fontFamily={T.MONO} fontSize="9" fill={VALUE}>{ax.value.toFixed(2)}</text>
          </g>
        );
      })}
      <rect x={RIGHT_X} y="24" width={RIGHT_W} height="154" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x={RIGHT_INNER} y="44" fontFamily={T.SANS} fontSize="9" fill={LABEL} letterSpacing="0.12em">CATALYTIC FIT</text>
      <text x={RIGHT_INNER} y="86" fontFamily={T.MONO} fontSize="32" fill="rgba(247,249,255,0.92)">{result.overallScore.toFixed(2)} ± 0.05</text>
      <text x={RIGHT_INNER} y="102" fontFamily={T.SANS} fontSize="9" fill={LABEL}>overall catalytic fit</text>
      <text x={RIGHT_INNER} y="130" fontFamily={T.SANS} fontSize="9" fill={LABEL}>Predicted Kd</text>
      <text x={RIGHT_INNER} y="146" fontFamily={T.MONO} fontSize="13" fill={VALUE}>{result.predictedKd.toFixed(2)} ± {(result.predictedKd * 0.15).toFixed(2)} μM</text>
      <text x={RIGHT_INNER + 112} y="130" fontFamily={T.SANS} fontSize="9" fill={LABEL}>Binding energy</text>
      <text x={RIGHT_INNER + 112} y="146" fontFamily={T.MONO} fontSize="13" fill={VALUE}>{result.bindingEnergy.toFixed(2)} ± {(Math.abs(result.bindingEnergy) * 0.10).toFixed(2)} kcal/mol</text>
      <text x={RIGHT_INNER} y="168" fontFamily={T.SANS} fontSize="9" fill="rgba(255,255,255,0.5)">{(result.interpretation || '').slice(0, 48)}</text>
      <rect x={LEFT_X} y="198" width={W - 2 * LEFT_X} height="226" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x={LEFT_X + 16} y="218" fontFamily={T.MONO} fontSize="8" fill={LABEL} letterSpacing="0.08em">BINDING ENERGY DECOMPOSITION</text>
      {[
        { label: 'Distance fit', value: result.distanceScore, color: PATHD_THEME.mint },
        { label: 'Orientation fit', value: result.orientationScore, color: PATHD_THEME.sky },
        { label: 'vdW packing', value: result.vdwScore, color: PATHD_THEME.apricot },
        { label: 'Electrostatic compl.', value: result.electrostaticScore, color: PATHD_THEME.lilac },
      ].map((item, index) => {
        const x = 42 + index * 64;
        const height = item.value * 112;
        return (
          <g key={item.label}>
            <rect x={x} y={338 - height} width="48" height={height} rx="8" fill={item.color} opacity="0.82" />
            <rect x={x} y="226" width="48" height="112" rx="8" fill="none" stroke="rgba(255,255,255,0.08)" />
            <text x={x + 24} y="352" textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={VALUE}>{item.value.toFixed(2)}</text>
            <text x={x + 24} y="372" textAnchor="middle" fontFamily={T.SANS} fontSize="7" fill={LABEL}>
              {item.label.length > 15 ? `${item.label.slice(0, 14)}…` : item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Sequence Design View (ported from V1, with heuristic label) ── */

function SequenceView({ result }: { result: SequenceDesignResult }) {
  const caiColor = (v: number) =>
    v >= 0.75 ? '#93CB52' : v >= 0.55 ? '#FFFB1F' : 'rgba(255,120,120,0.7)';
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
      <SectionLabel>Designed Sequences — {result.targetEnzyme}</SectionLabel>
      <p style={{ fontFamily: T.SANS, fontSize: '9px', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px', fontStyle: 'italic' }}>
        Stability estimates are heuristic screening scores (BLOSUM62-based), not rigorous ΔΔG values.
      </p>
      {result.designs.map(d => (
        <div key={d.rank} style={{ ...GLASS, padding: '10px 14px', marginBottom: 8, borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: T.MONO, fontSize: '11px', color: PHASE_COLORS.sequence, fontWeight: 600 }}>#{d.rank}</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>Score {d.score.toFixed(2)}</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>Recovery {(d.recoveryRate * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: caiColor(d.cai) }}>CAI {d.cai.toFixed(2)}</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>GC {(d.gcContent * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: d.rareCodons > 3 ? 'rgba(255,120,120,0.7)' : VALUE }}>{d.rareCodons} rare</span>
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

/* ── Flux Cost View (ported from V1) ─────────────────────────────── */

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
    <svg role="img" aria-label="Flux cost chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <rect x="20" y="22" width="480" height="140" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x={70} y={barY - 18} fontFamily={T.SANS} fontSize="9" fill={LABEL}>RESOURCE BURDEN LEDGER (ATP / NADPH / RIBOSOME)</text>
      <rect x={70} y={barY} width={atpW} height={barH} fill={PHASE_COLORS.flux} rx={4} />
      <rect x={70 + atpW} y={barY} width={nadW} height={barH} fill={PHASE_COLORS.balancing} rx={0} />
      <rect x={70 + atpW + nadW} y={barY} width={Math.max(0, ribW)} height={barH} fill={PHASE_COLORS.pareto} rx={4} />
      <rect x={70} y={barY} width={barW} height={barH} fill="none" stroke="rgba(255,255,255,0.1)" rx={4} />
      <text x={70 + atpW / 2} y={barY + barH / 2 + 4} textAnchor="middle" fontFamily={T.MONO} fontSize="9" fill="#000000">ATP {result.atpCost.toFixed(1)}</text>
      {nadW > 40 && (
        <text x={70 + atpW + nadW / 2} y={barY + barH / 2 + 4} textAnchor="middle" fontFamily={T.MONO} fontSize="9" fill="#000000">NADPH {result.nadphCost.toFixed(1)}</text>
      )}
      <rect x="20" y="186" width="480" height="198" rx="14" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x="36" y="206" fontFamily={T.MONO} fontSize="8" fill={LABEL}>DRAIN AND VIABILITY WINDOWS</text>
      <text x="36" y="238" fontFamily={T.MONO} fontSize="28" fill={VALUE}>{(result.totalMetabolicDrain * 100).toFixed(1)}%</text>
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
      <text x="360" y="270" fontFamily={T.SANS} fontSize="18" fill={viabilityColor}>{result.isViable ? 'Prototype viable' : 'Redesign required'}</text>
      <text x="360" y="294" fontFamily={T.SANS} fontSize="10" fill={VALUE}>{result.recommendation}</text>
    </svg>
  );
}

/* ── Balancer View (ported from V1) ──────────────────────────────── */

function BalancerView({ result }: { result: PathwayBalanceResult }) {
  const W = 540, H = 440, PAD = 40;
  const steps = result.steps;
  const n = steps.length;
  const stepW = (W - PAD * 2) / (n * 2 - 1);
  const maxConc = Math.max(...steps.map(s => s.intermediateConc), 0.01);
  return (
    <svg role="img" aria-label="Pathway balance chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <text x={W / 2} y={24} textAnchor="middle" fontFamily={T.SANS} fontSize="10" fill={VALUE}>Pathway Pipeline — {n} Steps</text>
      <rect x={W - 130} y={10} width={110} height={20} rx={10}
        fill={result.isBalanced ? 'rgba(147,203,82,0.12)' : 'rgba(250,128,114,0.12)'}
        stroke={result.isBalanced ? '#93CB52' : '#FA8072'} strokeWidth={0.8} />
      <text x={W - 75} y={24} textAnchor="middle" fontFamily={T.MONO} fontSize="9"
        fill={result.isBalanced ? '#93CB52' : '#FA8072'}>
        {result.isBalanced ? 'Balanced' : 'Imbalanced'}
      </text>
      {steps.map((s, i) => {
        const cx = PAD + i * 2 * stepW + stepW / 2;
        const cy = 120;
        const toxRatio = s.intermediateConc / s.toxicityThreshold;
        const intColor = toxRatio > 0.8 ? 'rgba(255,120,120,0.6)' : toxRatio > 0.5 ? '#FFFB1F' : '#93CB52';
        const barH = Math.min(80, (s.intermediateConc / maxConc) * 80);
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={18} fill="rgba(255,255,255,0.04)" stroke={PHASE_COLORS.balancing} strokeWidth={1} />
            <text x={cx} y={cy - 3} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill={VALUE}>{s.enzyme.toUpperCase()}</text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontFamily={T.MONO} fontSize="6" fill={LABEL}>kcat {s.adjustedKcat.toFixed(2)}</text>
            {i < n - 1 && (() => {
              const ix = cx + stepW;
              return (
                <g>
                  <rect x={ix - 14} y={cy - 12} width={28} height={24} rx={4}
                    fill="rgba(255,255,255,0.03)" stroke={intColor} strokeWidth={0.8} />
                  <text x={ix} y={cy + 2} textAnchor="middle" fontFamily={T.MONO} fontSize="6" fill={intColor}>{s.intermediateConc.toFixed(2)}</text>
                  <rect x={ix - 6} y={180 + (80 - barH)} width={12} height={barH} rx={3} fill={intColor} opacity={0.5} />
                  <line x1={cx + 20} y1={cy} x2={ix - 16} y2={cy} stroke="rgba(255,255,255,0.12)" strokeWidth={1} markerEnd="url(#arrowhead-v2)" />
                  <text x={(cx + 20 + ix - 16) / 2} y={cy - 8} textAnchor="middle" fontFamily={T.MONO} fontSize="6" fill={LABEL}>{s.currentFlux.toFixed(2)}</text>
                </g>
              );
            })()}
          </g>
        );
      })}
      <defs>
        <marker id="arrowhead-v2" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="rgba(255,255,255,0.2)" />
        </marker>
      </defs>
      {result.convergenceHistory.length > 1 && (() => {
        const ch = result.convergenceHistory;
        const cW = W - PAD * 2 - 40, cH = 90, cY0 = 310;
        const maxC = Math.max(...ch.map(c => c.maxConc), 0.01);
        return (
          <g>
            <text x={PAD + 20} y={cY0 - 8} fontFamily={T.SANS} fontSize="8" fill={LABEL}>Convergence (iterations vs max concentration)</text>
            <rect x={PAD + 20} y={cY0} width={cW} height={cH} rx={6} fill="rgba(255,255,255,0.02)" stroke={BORDER} />
            <polyline fill="none" stroke={PHASE_COLORS.balancing} strokeWidth={1.2}
              points={ch.map((c, i) =>
                `${PAD + 20 + (i / (ch.length - 1)) * cW},${cY0 + cH - (c.maxConc / maxC) * cH}`
              ).join(' ')} />
          </g>
        );
      })()}
    </svg>
  );
}

/* ── Pareto View (ported from V1) ────────────────────────────────── */

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
    <svg role="img" aria-label="Pareto front chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
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
      <text x={W / 2} y={H - 10} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>Thermodynamic Score</text>
      <text x={14} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL} transform={`rotate(-90,14,${H / 2})`}>Yield Score</text>
      {sorted.length > 1 && (
        <polyline fill="none" stroke={PHASE_COLORS.pareto} strokeWidth={1.2} strokeDasharray="4 3"
          points={sorted.map(c => `${sx(c.scores.thermodynamic)},${sy(c.scores.yield)}`).join(' ')} />
      )}
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
            {isBest && <text x={px} y={py - r - 6} textAnchor="middle" fontFamily={T.SANS} fontSize="12" fill="#FFFB1F">★</text>}
            <text x={px} y={py + r + 12} textAnchor="middle" fontFamily={T.SANS} fontSize="8" fill={isFront ? VALUE : LABEL}>{c.name}</text>
            <text x={px} y={py + r + 22} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill={LABEL}>Rank {c.paretoRank}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Mutagenesis View (ported from V1, with heuristic label) ─────── */

function MutagenesisView({ result, enzyme }: { result: MutagenesisResult; enzyme: EnzymeStructure }) {
  const W = 540, barY = 44, barH = 22;
  const PAD = 30;
  const barW = W - PAD * 2;
  const seqLen = enzyme.length;
  const effectColor = (e: string) =>
    e === 'beneficial' ? '#93CB52' : e === 'neutral' ? '#FFFB1F' : 'rgba(255,120,120,0.7)';
  const hdr: React.CSSProperties = {
    fontFamily: T.MONO, fontSize: '8px', color: LABEL, textAlign: 'left',
    padding: '3px 5px', borderBottom: `1px solid ${BORDER}`,
  };
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 0 }}>
      <p style={{ fontFamily: T.SANS, fontSize: '9px', color: 'rgba(255,255,255,0.35)', margin: '8px 16px', fontStyle: 'italic' }}>
        Predicted effects are heuristic screening scores (BLOSUM62 + conservation), not rigorous ΔΔG.
      </p>
      <svg role="img" aria-label="Mutagenesis sequence bar" viewBox={`0 0 ${W} ${barY + barH + 60}`} style={{ width: '100%' }}>
        <rect width={W} height={barY + barH + 60} fill="#050505" rx={12} />
        <rect x={PAD} y={barY} width={barW} height={barH} rx={4} fill="rgba(255,255,255,0.04)" stroke={BORDER} />
        {Array.from({ length: Math.ceil(seqLen / 50) + 1 }).map((_, i) => {
          const pos = i * 50;
          if (pos > seqLen) return null;
          const tx = PAD + (pos / seqLen) * barW;
          return (
            <g key={pos}>
              <line x1={tx} y1={barY + barH} x2={tx} y2={barY + barH + 4} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
              <text x={tx} y={barY + barH + 12} textAnchor="middle" fontFamily={T.MONO} fontSize="6" fill={LABEL}>{pos}</text>
            </g>
          );
        })}
        {enzyme.catalyticResidues.map(r => {
          const rx = PAD + (r.position / seqLen) * barW;
          return <rect key={`cat-${r.position}`} x={rx - 1.5} y={barY + 2} width={3} height={barH - 4} fill="rgba(250,128,114,0.6)" rx={1} />;
        })}
        {result.sites.map(s => {
          const sx = PAD + (s.position / seqLen) * barW;
          return (
            <g key={`mut-${s.position}`}>
              <rect x={sx - 2} y={barY + 2} width={4} height={barH - 4} fill="rgba(147,203,82,0.5)" rx={1} />
              <polygon points={`${sx},${barY - 6} ${sx - 4},${barY - 1} ${sx + 4},${barY - 1}`} fill={PHASE_COLORS.mutagenesis} />
            </g>
          );
        })}
        <rect x={PAD} y={barY + barH + 20} width={8} height={8} fill="rgba(250,128,114,0.6)" rx={2} />
        <text x={PAD + 12} y={barY + barH + 27} fontFamily={T.SANS} fontSize="8" fill={LABEL}>Catalytic</text>
        <rect x={PAD + 70} y={barY + barH + 20} width={8} height={8} fill={PHASE_COLORS.mutagenesis} rx={2} />
        <text x={PAD + 82} y={barY + barH + 27} fontFamily={T.SANS} fontSize="8" fill={LABEL}>Mutagenesis site</text>
      </svg>
      <div style={{ ...GLASS, margin: '8px 16px', padding: '8px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Top Combination</span>
        <span style={{ fontFamily: T.MONO, fontSize: '11px', color: PHASE_COLORS.mutagenesis }}>{result.topCombination.positions.join(', ')}</span>
        <span style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE }}>+{(result.topCombination.predictedImprovement * 100).toFixed(0)}% predicted</span>
      </div>
      <div style={{ padding: '0 16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Pos', 'WT', 'Mutants', 'Cons.', 'Effect', 'ΔKcat*', 'ΔKm*', 'Conf.', 'Rationale'].map(h => (
                <th key={h} style={hdr}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.sites.map(s => (
              <tr key={s.position} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: PHASE_COLORS.mutagenesis, padding: '4px 5px' }}>{s.position}</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px', textAlign: 'center' }}>{s.wildTypeResidue}</td>
                <td style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE, padding: '4px 5px' }}>{s.suggestedMutants.join(', ')}</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px', textAlign: 'right' }}>{s.conservationScore.toFixed(2)}</td>
                <td style={{ fontFamily: T.SANS, fontSize: '9px', padding: '4px 5px', color: effectColor(s.predictedEffect) }}>{s.predictedEffect}</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px', textAlign: 'right' }}>{s.predictedDeltaKcat.toFixed(2)}x</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px', textAlign: 'right' }}>{s.predictedDeltaKm.toFixed(2)}x</td>
                <td style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, padding: '4px 5px', textAlign: 'right' }}>{(s.confidence * 100).toFixed(0)}%</td>
                <td style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL, padding: '4px 5px', maxWidth: 120 }}>{s.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontFamily: T.SANS, fontSize: '8px', color: 'rgba(255,255,255,0.25)', margin: '6px 0 0', fontStyle: 'italic' }}>
          * Heuristic fold-change estimates — validate with directed evolution or computational ΔΔG tools (FoldX, Rosetta).
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main Component — CatalystDesignerPageV2
   ══════════════════════════════════════════════════════════════════════ */

export default function CatalystDesignerPageV2() {
  /* ── Workbench state ─────────────────────────────────────────── */
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  /* ── Local state ─────────────────────────────────────────────── */
  const [selectedEnzymeIdx, setSelectedEnzymeIdx] = useState<number>(2); // ADS default
  const [viewMode, setViewMode] = useState<ViewMode>('Binding'); // used in inspector Analysis tab
  const [renderMode, setRenderMode] = useState<'cartoon' | 'surface' | 'confidence'>('cartoon');
  const [spinEnabled, setSpinEnabled] = useState(true);
  const [selectedResidue, setSelectedResidue] = useState<ResidueClickData | null>(null);
  const [pendingMutation, setPendingMutation] = useState<string | null>(null);
  type InspectorTab = 'residue' | 'stats' | 'analysis';
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('stats');

  /* ── Workbench seed ──────────────────────────────────────────── */
  const recommendedSeed = useMemo(
    () => buildCatalystSeed(project, analyzeArtifact, fbaPayload, cethxPayload, dbtlPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, fbaPayload?.updatedAt, project?.id, project?.updatedAt],
  );
  useEffect(() => { setSelectedEnzymeIdx(recommendedSeed.enzymeIndex); }, [recommendedSeed.enzymeIndex]);

  /* ── Derived enzyme & computations ───────────────────────────── */
  const enzyme = ENZYME_STRUCTURES[selectedEnzymeIdx];
  const { data: binding, error: simError } = useMemo(() => {
    try { return { data: predictBindingAffinity(enzyme), error: null as string | null }; }
    catch (e) { return { data: predictBindingAffinity(ENZYME_STRUCTURES[selectedEnzymeIdx]), error: e instanceof Error ? e.message : 'Binding prediction failed' }; }
  }, [enzyme, selectedEnzymeIdx]);
  const sequences = useMemo(() => designSequences(enzyme, recommendedSeed.designCount), [enzyme, recommendedSeed.designCount]);
  const drain = useMemo(() => estimateMetabolicDrain(enzyme, recommendedSeed.requiredFlux), [enzyme, recommendedSeed.requiredFlux]);
  const balance = useMemo(() => balancePathway(PATHWAY_STEPS), []);
  const pareto = useMemo(() => rankPathways(PATHWAY_CANDIDATES), []);
  const mutagenesis = useMemo(() => predictMutagenesisSites(enzyme, 5), [enzyme]);
  const bestPathway = pareto.candidates.find(c => c.id === pareto.bestOverall);

  /* ── Residue detail for inspector ────────────────────────────── */
  const selectedCatalyticResidue = selectedResidue?.catalyticResidue ?? null;

  /* ── Mutagenesis site for selected residue ──────────────────── */
  const selectedMutagenesisSite: MutagenesisSite | null = selectedResidue
    ? mutagenesis.sites.find(s => s.position === selectedResidue.position) ?? null
    : null;

  /* ── Workbench write-back (identical to V1) ──────────────────── */
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
    analyzeArtifact?.id, analyzeArtifact?.targetProduct, bestPathway?.name,
    binding.overallScore, binding.predictedKd, drain.growthPenalty,
    drain.isViable, drain.recommendation, drain.totalMetabolicDrain,
    enzyme.id, enzyme.name, mutagenesis.sites, project?.targetProduct,
    project?.title, recommendedSeed.designCount, recommendedSeed.requiredFlux,
    sequences.designs, setToolPayload, simError, viewMode,
  ]);

  /* ── Render ──────────────────────────────────────────────────── */
  const kdQ = kdQuality(binding.predictedKd);
  const kcatQ = kcatQuality(enzyme.kcat);
  const fitQ = fitQuality(binding.overallScore);

  return (
    <div className="nb-tool-page" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Compact Header: enzyme selector + key metrics ───── */}
      <div style={{
        margin: '0 12px 6px', padding: '6px 12px', ...GLASS, borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <select
          value={selectedEnzymeIdx}
          onChange={e => { setSelectedEnzymeIdx(Number(e.target.value)); setSelectedResidue(null); setPendingMutation(null); }}
          style={{
            fontFamily: T.SANS, fontSize: '11px', fontWeight: 600,
            color: VALUE, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 8, padding: '3px 8px', cursor: 'pointer',
          }}
        >
          {ENZYME_STRUCTURES.map((enz, i) => (
            <option key={enz.id} value={i}>{enz.name} · EC {enz.ecNumber}</option>
          ))}
        </select>
        {enzyme.id === RATE_LIMITING_ENZYME.id && (
          <span style={{
            fontFamily: T.MONO, fontSize: '7px', color: '#FFFB1F',
            background: 'rgba(255,251,31,0.12)', padding: '1px 5px', borderRadius: 4,
          }}>Rate-limiting</span>
        )}
        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>
          {enzyme.substrate} → {enzyme.product}
        </span>
        {/* Inline key metrics */}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: bindingColorCSS(kdToQuality(binding.predictedKd)) }}>
            Kd {binding.predictedKd.toFixed(1)} μM
          </span>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: kcatQ.color }}>
            kcat {enzyme.kcat.toFixed(1)} s⁻¹
          </span>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: fitQ.color }}>
            Fit {binding.overallScore.toFixed(2)}
          </span>
          {enzyme.pdbId && (
            <span style={{ fontFamily: T.MONO, fontSize: '8px', color: 'rgba(255,255,255,0.25)' }}>
              PDB {enzyme.pdbId}
            </span>
          )}
        </span>
      </div>

      {simError && <div style={{ padding: '0 12px 4px' }}><SimErrorBanner message={simError} /></div>}

      {/* ── 3D Viewport (60%) + Inspector (40%) ──────────────── */}
      <div style={{
        display: 'flex', gap: 12, padding: '0 16px 12px',
        flex: 1, minHeight: 0, overflow: 'hidden',
      }}>
        {/* 3D Viewport */}
        <div style={{ flex: '0 0 60%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <CatalystViewer3D
            enzyme={enzyme}
            renderMode={renderMode}
            spinEnabled={spinEnabled}
            onResidueClick={(data) => { setSelectedResidue(data); setPendingMutation(null); setInspectorTab('residue'); }}
            selectedResidue={selectedResidue?.position ?? null}
            bindingQuality={kdToQuality(binding.predictedKd)}
            style={{ flex: 1, minHeight: 0 }}
          />
          {/* Render mode controls */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexShrink: 0 }}>
            {(['cartoon', 'surface', 'confidence'] as const).map(mode => (
              <button key={mode} type="button" onClick={() => setRenderMode(mode)} style={{
                border: `1px solid ${renderMode === mode ? 'rgba(200,232,240,0.3)' : 'rgba(255,255,255,0.08)'}`,
                background: renderMode === mode ? 'rgba(200,232,240,0.12)' : 'rgba(255,255,255,0.03)',
                color: renderMode === mode ? '#C8E8F0' : 'rgba(255,255,255,0.45)',
                fontSize: 9, borderRadius: 999, padding: '3px 8px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {mode === 'confidence' ? 'pLDDT' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
            <button type="button" onClick={() => setSpinEnabled(!spinEnabled)} style={{
              border: '1px solid rgba(255,255,255,0.08)',
              background: spinEnabled ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: 'rgba(255,255,255,0.5)', fontSize: 9,
              borderRadius: 999, padding: '3px 8px', cursor: 'pointer',
            }}>
              {spinEnabled ? 'Auto-spin' : 'Static'}
            </button>
          </div>
        </div>

        {/* Inspector Panel — glassmorphism, tabbed */}
        <div style={{
          flex: '0 0 38%', minWidth: 0,
          background: 'rgba(13,15,20,0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${BORDER}`, borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
          }}>
            {([
              { key: 'residue' as const, label: 'Residue' },
              { key: 'stats' as const, label: 'Stats' },
              { key: 'analysis' as const, label: 'Analysis' },
            ]).map(tab => (
              <button key={tab.key} type="button" onClick={() => setInspectorTab(tab.key)} style={{
                flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer',
                fontFamily: T.SANS, fontSize: '9px', letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: inspectorTab === tab.key ? VALUE : LABEL,
                background: inspectorTab === tab.key ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderBottom: inspectorTab === tab.key ? '2px solid rgba(200,216,232,0.5)' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content — scrollable */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>

            {/* ── RESIDUE TAB ──────────────────────────────────── */}
            {inspectorTab === 'residue' && (
              selectedResidue ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ ...GLASS, borderRadius: 12, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: T.MONO, fontSize: '14px', color: VALUE, fontWeight: 700 }}>
                        {selectedResidue.name}
                      </span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL }}>
                        pos {selectedResidue.position}
                      </span>
                      {selectedResidue.isCatalytic && (
                        <span style={{
                          fontFamily: T.MONO, fontSize: '7px', color: '#93CB52',
                          background: 'rgba(147,203,82,0.12)', padding: '1px 5px', borderRadius: 4,
                        }}>catalytic</span>
                      )}
                    </div>
                    {selectedCatalyticResidue ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Role</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{selectedCatalyticResidue.role.replace('_', ' ')}</span>
                        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Dist</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{selectedCatalyticResidue.distanceToSubstrate.toFixed(1)} Å</span>
                        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Angle</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{selectedCatalyticResidue.orientationAngle.toFixed(0)}°</span>
                        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>pKa shift</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: Math.abs(selectedCatalyticResidue.pKaShift) > 0.5 ? '#FA8072' : VALUE }}>
                          {selectedCatalyticResidue.pKaShift > 0 ? '+' : ''}{selectedCatalyticResidue.pKaShift.toFixed(2)}
                        </span>
                        {selectedResidue.distanceToSubstrate != null && (
                          <>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>→ Substrate</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{selectedResidue.distanceToSubstrate.toFixed(1)} Å</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL, margin: 0 }}>
                        Non-catalytic residue — {selectedResidue.residueLetter} at position {selectedResidue.position}
                      </p>
                    )}
                  </div>

                  {/* Mutation Dropdown */}
                  <div>
                    <SectionLabel>Mutate to…</SectionLabel>
                    <select
                      value={pendingMutation ?? ''}
                      onChange={e => setPendingMutation(e.target.value || null)}
                      style={{
                        width: '100%', fontFamily: T.MONO, fontSize: '11px',
                        color: INPUT_TEXT, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`,
                        borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                      }}
                    >
                      <option value="">— select amino acid —</option>
                      {['A','R','N','D','C','E','Q','G','H','I','L','K','M','F','P','S','T','W','Y','V']
                        .filter(aa => aa !== selectedResidue.residueLetter)
                        .map(aa => {
                          const names: Record<string, string> = {
                            A:'Ala',R:'Arg',N:'Asn',D:'Asp',C:'Cys',E:'Glu',Q:'Gln',G:'Gly',
                            H:'His',I:'Ile',L:'Leu',K:'Lys',M:'Met',F:'Phe',P:'Pro',S:'Ser',
                            T:'Thr',W:'Trp',Y:'Tyr',V:'Val',
                          };
                          const isSuggested = selectedMutagenesisSite?.suggestedMutants.includes(aa);
                          return (
                            <option key={aa} value={aa}>
                              {aa} ({names[aa]}) {isSuggested ? '★ suggested' : ''}
                            </option>
                          );
                        })}
                    </select>

                    {pendingMutation && (
                      <div style={{ ...GLASS, borderRadius: 10, padding: '8px 10px', marginTop: 6 }}>
                        <div style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE, marginBottom: 4 }}>
                          {selectedResidue.residueLetter}{selectedResidue.position}{pendingMutation}
                        </div>
                        {selectedMutagenesisSite && selectedMutagenesisSite.suggestedMutants.includes(pendingMutation) ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Δkcat</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: selectedMutagenesisSite.predictedDeltaKcat > 1 ? '#93CB52' : '#FA8072' }}>
                              {selectedMutagenesisSite.predictedDeltaKcat.toFixed(2)}×
                            </span>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>ΔKm</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: selectedMutagenesisSite.predictedDeltaKm < 1 ? '#93CB52' : '#FA8072' }}>
                              {selectedMutagenesisSite.predictedDeltaKm.toFixed(2)}×
                            </span>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Effect</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color:
                              selectedMutagenesisSite.predictedEffect === 'beneficial' ? '#93CB52' :
                              selectedMutagenesisSite.predictedEffect === 'neutral' ? '#FFFB1F' : '#FA8072'
                            }}>
                              {selectedMutagenesisSite.predictedEffect}
                            </span>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Confidence</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>
                              {(selectedMutagenesisSite.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, margin: 0 }}>
                            No screening data for this substitution.
                          </p>
                        )}
                        <p style={{ fontFamily: T.SANS, fontSize: '7px', color: 'rgba(255,255,255,0.25)', margin: '5px 0 0', fontStyle: 'italic' }}>
                          BLOSUM62 heuristic screening score — not rigorous ΔΔG
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL, margin: 0 }}>
                  Click a residue on the 3D model to inspect it.
                </p>
              )
            )}

            {/* ── STATS TAB ────────────────────────────────────── */}
            {inspectorTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SectionLabel>Kinetic Parameters</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}><MetricCard label="Kd" value={binding.predictedKd.toFixed(2)} unit="μM" /></div>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '9px', color: bindingColorCSS(kdToQuality(binding.predictedKd)),
                      padding: '2px 6px', borderRadius: 6,
                      background: `${bindingColorCSS(kdToQuality(binding.predictedKd))}18`,
                      whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
                    }}>{kdQ.icon} {kdQ.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}><MetricCard label="kcat" value={enzyme.kcat.toFixed(2)} unit="s⁻¹" /></div>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '9px', color: kcatQ.color,
                      padding: '2px 6px', borderRadius: 6, background: `${kcatQ.color}18`,
                      whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
                    }}>{kcatQ.icon} {kcatQ.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}><MetricCard label="Km" value={enzyme.km.toFixed(3)} unit="mM" /></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}><MetricCard label="Fit" value={binding.overallScore.toFixed(2)} /></div>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '9px', color: fitQ.color,
                      padding: '2px 6px', borderRadius: 6, background: `${fitQ.color}18`,
                      whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
                    }}>{fitQ.icon} {fitQ.label}</span>
                  </div>
                </div>

                <SectionLabel>Design Summary</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <MetricCard label="Metabolic Drain" value={(drain.totalMetabolicDrain * 100).toFixed(1)} unit="%" warning={!drain.isViable ? 'Non-viable' : undefined} />
                  <MetricCard label="Pathway" value={balance.isBalanced ? 'Balanced' : 'Imbalanced'} highlight={balance.isBalanced} />
                  <MetricCard label="Best Pathway" value={bestPathway?.name ?? '—'} />
                  <MetricCard label="Beneficial Sites" value={mutagenesis.sites.filter(s => s.predictedEffect === 'beneficial').length.toString()} />
                </div>
              </div>
            )}

            {/* ── ANALYSIS TAB — 6 SVG sub-views ──────────────── */}
            {inspectorTab === 'analysis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Sub-tab selector */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {VIEW_MODES.map(vm => (
                    <button key={vm.key} type="button" onClick={() => setViewMode(vm.key)} style={{
                      fontFamily: T.SANS, fontSize: '8px', fontWeight: viewMode === vm.key ? 600 : 400,
                      padding: '3px 8px', borderRadius: 10, cursor: 'pointer',
                      border: viewMode === vm.key ? `1px solid ${vm.color}` : `1px solid ${INPUT_BORDER}`,
                      background: viewMode === vm.key ? `${vm.color}18` : 'transparent',
                      color: viewMode === vm.key ? vm.color : INPUT_TEXT,
                      transition: 'all 0.15s ease',
                    }}>
                      {vm.label}
                    </button>
                  ))}
                </div>
                {/* SVG view content */}
                <div style={{ transition: 'opacity 0.2s ease' }}>
                  {viewMode === 'Binding' && <BindingRadar result={binding} />}
                  {viewMode === 'Sequences' && <SequenceView result={sequences} />}
                  {viewMode === 'FluxCost' && <FluxCostView result={drain} />}
                  {viewMode === 'Balancer' && <BalancerView result={balance} />}
                  {viewMode === 'Pareto' && <ParetoView result={pareto} />}
                  {viewMode === 'Mutagenesis' && <MutagenesisView result={mutagenesis} enzyme={enzyme} />}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Compact Footer: workbench context + export ─────── */}
      <div style={{
        padding: '4px 16px 6px', display: 'flex', alignItems: 'center', gap: 8,
        borderTop: `1px solid ${BORDER}`, flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WorkbenchInlineContext
            toolId="catdes"
            title="Catalyst Designer"
            summary={`${enzyme.name} — Kd ${binding.predictedKd.toFixed(1)} μM, ${mutagenesis.sites.filter(s => s.predictedEffect === 'beneficial').length} beneficial sites`}
            compact
          />
        </div>
        <ExportButton label="Export JSON"
          data={{ enzyme: enzyme.id, binding, sequences, drain, balance, pareto, mutagenesis }}
          filename="catalyst-design" format="json" />
      </div>
    </div>
  );
}
