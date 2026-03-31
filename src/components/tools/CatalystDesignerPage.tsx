'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
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

/* ── Design Tokens ────────────────────────────────────────────────── */

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";
const PANEL_BG = '#10131a';
const BORDER = 'rgba(255,255,255,0.06)';
const LABEL = 'rgba(255,255,255,0.28)';
const VALUE = 'rgba(255,255,255,0.65)';
const INPUT_BG = 'rgba(255,255,255,0.05)';
const INPUT_BORDER = 'rgba(255,255,255,0.08)';
const INPUT_TEXT = 'rgba(255,255,255,0.7)';

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  backdropFilter: 'blur(10px)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const PHASE_COLORS: Record<string, string> = {
  binding:     '#C9E4DE',
  sequence:    '#C6DEF1',
  flux:        '#FAEDCB',
  balancing:   '#F2C6DE',
  pareto:      '#DBCDF0',
  mutagenesis: '#D4E8C4',
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
    fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.1em', color: LABEL, margin: '0 0 10px',
  }}>
    {children}
  </p>
);

/* ── Binding Radar SVG ────────────────────────────────────────────── */

function BindingRadar({ result }: { result: BindingAffinityResult }) {
  const W = 520, H = 460, CX = W / 2, CY = 190, R = 120;
  const axes = [
    { label: 'Distance', value: result.distanceScore },
    { label: 'Orientation', value: result.orientationScore },
    { label: 'vdW', value: result.vdwScore },
    { label: 'Electrostatic', value: result.electrostaticScore },
  ];
  const n = axes.length;
  const poly = axes.map((a, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `${CX + Math.cos(angle) * R * a.value},${CY + Math.sin(angle) * R * a.value}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" rx={12} />
      {[0.25, 0.5, 0.75, 1].map(s => (
        <polygon key={s}
          points={axes.map((_, i) => {
            const a = (Math.PI * 2 * i) / n - Math.PI / 2;
            return `${CX + Math.cos(a) * R * s},${CY + Math.sin(a) * R * s}`;
          }).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      ))}
      {axes.map((_, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        return (
          <line key={i} x1={CX} y1={CY}
            x2={CX + Math.cos(a) * R} y2={CY + Math.sin(a) * R}
            stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
        );
      })}
      <polygon points={poly} fill="rgba(201,228,222,0.18)" stroke={PHASE_COLORS.binding} strokeWidth={1.5} />
      {axes.map((ax, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        const lx = CX + Math.cos(a) * (R + 22);
        const ly = CY + Math.sin(a) * (R + 22);
        const vx = CX + Math.cos(a) * R * ax.value;
        const vy = CY + Math.sin(a) * R * ax.value;
        return (
          <g key={i}>
            <circle cx={vx} cy={vy} r={4} fill={PHASE_COLORS.binding} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fontFamily={SANS} fontSize="9" fill={VALUE}>{ax.label}</text>
            <text x={lx} y={ly + 12} textAnchor="middle"
              fontFamily={MONO} fontSize="8" fill={LABEL}>{ax.value.toFixed(3)}</text>
          </g>
        );
      })}
      <text x={CX} y={CY - 8} textAnchor="middle" fontFamily={MONO} fontSize="22"
        fill="rgba(255,255,255,0.85)">{result.overallScore.toFixed(3)}</text>
      <text x={CX} y={CY + 14} textAnchor="middle" fontFamily={SANS} fontSize="9" fill={LABEL}>
        Overall Score
      </text>
      <text x={CX - 80} y={CY + R + 52} fontFamily={SANS} fontSize="9" fill={LABEL}>
        Predicted Kd
      </text>
      <text x={CX - 80} y={CY + R + 66} fontFamily={MONO} fontSize="13"
        fill={VALUE}>{result.predictedKd.toFixed(2)} μM</text>
      <text x={CX + 40} y={CY + R + 52} fontFamily={SANS} fontSize="9" fill={LABEL}>
        Binding Energy
      </text>
      <text x={CX + 40} y={CY + R + 66} fontFamily={MONO} fontSize="13"
        fill={VALUE}>{result.bindingEnergy.toFixed(2)} kcal/mol</text>
      <text x={CX} y={CY + R + 88} textAnchor="middle" fontFamily={SANS} fontSize="9"
        fill="rgba(255,255,255,0.4)">{result.interpretation}</text>
    </svg>
  );
}

/* ── Catalytic Residue Table ──────────────────────────────────────── */

function ResidueTable({ enzyme }: { enzyme: EnzymeStructure }) {
  const hdr: React.CSSProperties = {
    fontFamily: MONO, fontSize: '9px', color: LABEL, textAlign: 'left',
    padding: '4px 6px', borderBottom: `1px solid ${BORDER}`,
  };
  const cell: React.CSSProperties = {
    fontFamily: MONO, fontSize: '10px', color: VALUE, padding: '3px 6px',
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
              <td style={{ ...cell, textAlign: 'left', color: '#C9E4DE' }}>{r.position}</td>
              <td style={{ ...cell, textAlign: 'center' }}>{r.residue}</td>
              <td style={{ ...cell, textAlign: 'left', fontSize: '8px' }}>{r.role.replace('_', ' ')}</td>
              <td style={cell}>{r.distanceToSubstrate.toFixed(1)}</td>
              <td style={cell}>{r.optimalDistance.toFixed(1)}</td>
              <td style={cell}>{r.orientationAngle.toFixed(0)}</td>
              <td style={cell}>{r.optimalAngle.toFixed(0)}</td>
              <td style={{ ...cell, color: Math.abs(r.pKaShift) > 0.5 ? '#F2C6DE' : VALUE }}>
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
    v >= 0.75 ? '#D4E8C4' : v >= 0.55 ? '#FAEDCB' : 'rgba(255,120,120,0.7)';
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
      <SectionLabel>Designed Sequences — {result.targetEnzyme}</SectionLabel>
      {result.designs.map(d => (
        <div key={d.rank} style={{
          ...GLASS, padding: '10px 14px', marginBottom: 8, borderRadius: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: PHASE_COLORS.sequence,
              fontWeight: 600 }}>#{d.rank}</span>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: VALUE }}>
              Score {d.score.toFixed(3)}</span>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: LABEL }}>
              Recovery {(d.recoveryRate * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: caiColor(d.cai) }}>
              CAI {d.cai.toFixed(3)}</span>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: LABEL }}>
              GC {(d.gcContent * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: MONO, fontSize: '10px',
              color: d.rareCodons > 3 ? 'rgba(255,120,120,0.7)' : VALUE }}>
              {d.rareCodons} rare</span>
          </div>
          <div style={{
            fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.45)',
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
                fontFamily: MONO, fontSize: '10px', color: PHASE_COLORS.sequence,
                padding: '2px 8px', borderRadius: 8,
                background: 'rgba(198,222,241,0.1)', border: '1px solid rgba(198,222,241,0.15)',
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
  const barY = 60, barH = 28, barW = 380;
  const total = result.atpCost + result.nadphCost + result.ribosomeBurden * 100;
  const atpW = total > 0 ? (result.atpCost / total) * barW : 0;
  const nadW = total > 0 ? (result.nadphCost / total) * barW : 0;
  const ribW = barW - atpW - nadW;
  const gaugeAngle = result.totalMetabolicDrain * 180;
  const viabilityColor = result.isViable
    ? result.growthPenalty < 10 ? '#D4E8C4' : '#FAEDCB'
    : 'rgba(255,120,120,0.8)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" rx={12} />
      <text x={70} y={barY - 12} fontFamily={SANS} fontSize="9" fill={LABEL}>
        Cost Breakdown (ATP / NADPH / Ribosome)
      </text>
      <rect x={70} y={barY} width={atpW} height={barH} fill={PHASE_COLORS.flux} rx={4} />
      <rect x={70 + atpW} y={barY} width={nadW} height={barH} fill={PHASE_COLORS.balancing} rx={0} />
      <rect x={70 + atpW + nadW} y={barY} width={Math.max(0, ribW)} height={barH}
        fill={PHASE_COLORS.pareto} rx={4} />
      <rect x={70} y={barY} width={barW} height={barH} fill="none"
        stroke="rgba(255,255,255,0.1)" rx={4} />
      <text x={70 + atpW / 2} y={barY + barH / 2 + 4} textAnchor="middle"
        fontFamily={MONO} fontSize="9" fill="#10131a">ATP {result.atpCost.toFixed(1)}</text>
      {nadW > 40 && (
        <text x={70 + atpW + nadW / 2} y={barY + barH / 2 + 4} textAnchor="middle"
          fontFamily={MONO} fontSize="9" fill="#10131a">NADPH {result.nadphCost.toFixed(1)}</text>
      )}

      {/* Gauge */}
      <g transform={`translate(${W / 2}, 230)`}>
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const a = t * Math.PI;
          return (
            <g key={t}>
              <line x1={Math.cos(Math.PI - a) * 80} y1={-Math.sin(Math.PI - a) * 80}
                x2={Math.cos(Math.PI - a) * 90} y2={-Math.sin(Math.PI - a) * 90}
                stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              <text x={Math.cos(Math.PI - a) * 100} y={-Math.sin(Math.PI - a) * 100 + 3}
                textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}>
                {(t * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
        <path d={`M -90 0 A 90 90 0 0 1 90 0`} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={12} strokeLinecap="round" />
        <path d={`M -90 0 A 90 90 0 0 1 90 0`} fill="none"
          stroke={PHASE_COLORS.flux} strokeWidth={12} strokeLinecap="round"
          strokeDasharray={`${gaugeAngle * (Math.PI / 180) * 90} 999`}
          opacity={0.7} />
        {(() => {
          const a = Math.PI - (result.totalMetabolicDrain * Math.PI);
          const nx = Math.cos(a) * 70, ny = -Math.sin(a) * 70;
          return <line x1={0} y1={0} x2={nx} y2={ny} stroke={VALUE} strokeWidth={2} strokeLinecap="round" />;
        })()}
        <circle cx={0} cy={0} r={4} fill={VALUE} />
        <text x={0} y={-30} textAnchor="middle" fontFamily={MONO} fontSize="20" fill={VALUE}>
          {(result.totalMetabolicDrain * 100).toFixed(1)}%
        </text>
        <text x={0} y={-14} textAnchor="middle" fontFamily={SANS} fontSize="9" fill={LABEL}>
          Metabolic Drain
        </text>
      </g>

      {/* Growth penalty */}
      <g transform={`translate(${W / 2}, 300)`}>
        <rect x={-100} y={0} width={200} height={28} rx={8}
          fill="rgba(255,255,255,0.03)" stroke={BORDER} />
        <circle cx={-80} cy={14} r={5} fill={viabilityColor} />
        <text x={-68} y={18} fontFamily={SANS} fontSize="10" fill={VALUE}>
          Growth penalty: {result.growthPenalty.toFixed(1)}%
        </text>
      </g>
      <text x={W / 2} y={360} textAnchor="middle" fontFamily={SANS} fontSize="9"
        fill="rgba(255,255,255,0.35)">{result.recommendation}</text>
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
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" rx={12} />
      <text x={W / 2} y={24} textAnchor="middle" fontFamily={SANS} fontSize="10" fill={VALUE}>
        Pathway Pipeline — {n} Steps
      </text>
      {/* Badge */}
      <rect x={W - 130} y={10} width={110} height={20} rx={10}
        fill={result.isBalanced ? 'rgba(212,232,196,0.12)' : 'rgba(242,198,222,0.12)'}
        stroke={result.isBalanced ? '#D4E8C4' : '#F2C6DE'} strokeWidth={0.8} />
      <text x={W - 75} y={24} textAnchor="middle" fontFamily={MONO} fontSize="9"
        fill={result.isBalanced ? '#D4E8C4' : '#F2C6DE'}>
        {result.isBalanced ? 'Balanced ✓' : 'Imbalanced ✗'}
      </text>

      {/* Pipeline */}
      {steps.map((s, i) => {
        const cx = PAD + i * 2 * stepW + stepW / 2;
        const cy = 120;
        const toxRatio = s.intermediateConc / s.toxicityThreshold;
        const intColor = toxRatio > 0.8 ? 'rgba(255,120,120,0.6)' :
          toxRatio > 0.5 ? '#FAEDCB' : '#D4E8C4';
        const barH = Math.min(80, (s.intermediateConc / maxConc) * 80);
        return (
          <g key={i}>
            {/* Enzyme circle */}
            <circle cx={cx} cy={cy} r={18}
              fill="rgba(255,255,255,0.04)" stroke={PHASE_COLORS.balancing} strokeWidth={1} />
            <text x={cx} y={cy - 3} textAnchor="middle" fontFamily={MONO} fontSize="7"
              fill={VALUE}>{s.enzyme.toUpperCase()}</text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontFamily={MONO} fontSize="6"
              fill={LABEL}>kcat {s.adjustedKcat.toFixed(2)}</text>
            {/* Intermediate rectangle + bar */}
            {i < n - 1 && (() => {
              const ix = cx + stepW;
              return (
                <g>
                  <rect x={ix - 14} y={cy - 12} width={28} height={24} rx={4}
                    fill="rgba(255,255,255,0.03)" stroke={intColor} strokeWidth={0.8} />
                  <text x={ix} y={cy + 2} textAnchor="middle" fontFamily={MONO} fontSize="6"
                    fill={intColor}>{s.intermediateConc.toFixed(2)}</text>
                  <rect x={ix - 6} y={180 + (80 - barH)} width={12} height={barH} rx={3}
                    fill={intColor} opacity={0.5} />
                  {/* Arrow */}
                  <line x1={cx + 20} y1={cy} x2={ix - 16} y2={cy}
                    stroke="rgba(255,255,255,0.12)" strokeWidth={1}
                    markerEnd="url(#arrowhead)" />
                  <text x={(cx + 20 + ix - 16) / 2} y={cy - 8} textAnchor="middle"
                    fontFamily={MONO} fontSize="6" fill={LABEL}>
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
            <text x={PAD + 20} y={cY0 - 8} fontFamily={SANS} fontSize="8" fill={LABEL}>
              Convergence (iterations vs max concentration)
            </text>
            <rect x={PAD + 20} y={cY0} width={cW} height={cH} rx={6}
              fill="rgba(255,255,255,0.02)" stroke={BORDER} />
            <polyline fill="none" stroke={PHASE_COLORS.balancing} strokeWidth={1.2}
              points={ch.map((c, i) =>
                `${PAD + 20 + (i / (ch.length - 1)) * cW},${cY0 + cH - (c.maxConc / maxC) * cH}`
              ).join(' ')} />
            <text x={PAD + 20} y={cY0 + cH + 12} fontFamily={MONO} fontSize="7" fill={LABEL}>
              0
            </text>
            <text x={PAD + 20 + cW} y={cY0 + cH + 12} textAnchor="end"
              fontFamily={MONO} fontSize="7" fill={LABEL}>{ch.length - 1}</text>
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
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" rx={12} />
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
      <text x={W / 2} y={H - 10} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}>
        Thermodynamic Score
      </text>
      <text x={14} y={H / 2} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}
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
              <text x={px} y={py - r - 6} textAnchor="middle" fontFamily={SANS} fontSize="12"
                fill="#FAEDCB">★</text>
            )}
            <text x={px} y={py + r + 12} textAnchor="middle" fontFamily={SANS} fontSize="8"
              fill={isFront ? VALUE : LABEL}>{c.name}</text>
            <text x={px} y={py + r + 22} textAnchor="middle" fontFamily={MONO} fontSize="7"
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
    e === 'beneficial' ? '#D4E8C4' : e === 'neutral' ? '#FAEDCB' : 'rgba(255,120,120,0.7)';

  const tblY = 160;
  const rowH = 34;
  const hdr: React.CSSProperties = {
    fontFamily: MONO, fontSize: '8px', color: LABEL, textAlign: 'left',
    padding: '3px 5px', borderBottom: `1px solid ${BORDER}`,
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 0 }}>
      <svg viewBox={`0 0 ${W} ${barY + barH + 60}`} style={{ width: '100%' }}>
        <rect width={W} height={barY + barH + 60} fill="#0d0f14" rx={12} />
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
                fontFamily={MONO} fontSize="6" fill={LABEL}>{pos}</text>
            </g>
          );
        })}
        {/* Catalytic residues (red) */}
        {enzyme.catalyticResidues.map(r => {
          const rx = PAD + (r.position / seqLen) * barW;
          return (
            <rect key={`cat-${r.position}`} x={rx - 1.5} y={barY + 2} width={3} height={barH - 4}
              fill="rgba(255,100,100,0.6)" rx={1} />
          );
        })}
        {/* Mutagenesis sites (green triangles) */}
        {result.sites.map(s => {
          const sx = PAD + (s.position / seqLen) * barW;
          return (
            <g key={`mut-${s.position}`}>
              <rect x={sx - 2} y={barY + 2} width={4} height={barH - 4}
                fill="rgba(212,232,196,0.5)" rx={1} />
              <polygon points={`${sx},${barY - 6} ${sx - 4},${barY - 1} ${sx + 4},${barY - 1}`}
                fill={PHASE_COLORS.mutagenesis} />
            </g>
          );
        })}
        {/* Legend */}
        <rect x={PAD} y={barY + barH + 20} width={8} height={8} fill="rgba(255,100,100,0.6)" rx={2} />
        <text x={PAD + 12} y={barY + barH + 27} fontFamily={SANS} fontSize="8" fill={LABEL}>
          Catalytic
        </text>
        <rect x={PAD + 70} y={barY + barH + 20} width={8} height={8} fill={PHASE_COLORS.mutagenesis} rx={2} />
        <text x={PAD + 82} y={barY + barH + 27} fontFamily={SANS} fontSize="8" fill={LABEL}>
          Mutagenesis site
        </text>
      </svg>

      {/* Top combination */}
      <div style={{
        ...GLASS, margin: '8px 16px', padding: '8px 14px', borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Top Combination</span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: PHASE_COLORS.mutagenesis }}>
          {result.topCombination.positions.join(', ')}
        </span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: VALUE }}>
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
                <td style={{ fontFamily: MONO, fontSize: '10px', color: PHASE_COLORS.mutagenesis,
                  padding: '4px 5px' }}>{s.position}</td>
                <td style={{ fontFamily: MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'center' }}>{s.wildTypeResidue}</td>
                <td style={{ fontFamily: MONO, fontSize: '9px', color: VALUE, padding: '4px 5px' }}>
                  {s.suggestedMutants.join(', ')}</td>
                <td style={{ fontFamily: MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'right' }}>{s.conservationScore.toFixed(2)}</td>
                <td style={{ fontFamily: SANS, fontSize: '9px', padding: '4px 5px',
                  color: effectColor(s.predictedEffect) }}>{s.predictedEffect}</td>
                <td style={{ fontFamily: MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'right' }}>{s.predictedDeltaKcat.toFixed(2)}×</td>
                <td style={{ fontFamily: MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'right' }}>{s.predictedDeltaKm.toFixed(2)}×</td>
                <td style={{ fontFamily: MONO, fontSize: '10px', color: VALUE, padding: '4px 5px',
                  textAlign: 'right' }}>{(s.confidence * 100).toFixed(0)}%</td>
                <td style={{ fontFamily: SANS, fontSize: '8px', color: LABEL, padding: '4px 5px',
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
  const [selectedEnzyme, setSelectedEnzyme] = useState<number>(2);
  const [viewMode, setViewMode] = useState<ViewMode>('Binding');

  const enzyme = ENZYME_STRUCTURES[selectedEnzyme];
  const binding = useMemo(() => predictBindingAffinity(enzyme), [enzyme]);
  const sequences = useMemo(() => designSequences(enzyme, 10), [enzyme]);
  const drain = useMemo(() => estimateMetabolicDrain(enzyme, 0.5), [enzyme]);
  const balance = useMemo(() => balancePathway(PATHWAY_STEPS), []);
  const pareto = useMemo(() => rankPathways(PATHWAY_CANDIDATES), []);
  const mutagenesis = useMemo(() => predictMutagenesisSites(enzyme, 5), [enzyme]);

  const bestPathway = pareto.candidates.find(c => c.id === pareto.bestOverall);

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <IDEShell moduleId="catdes">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Algorithm Insight */}
        <AlgorithmInsight
          title="Catalyst-Designer Engine"
          description="AlphaFold 3-inspired binding prediction → ProteinMPNN sequence design → FBA flux coupling → Church-method balancing → Pareto multi-objective ranking → ESM-2 mutagenesis"
          formula="Kd = exp(ΔG_bind/RT) | ΔΔG = Σ BLOSUM(wt,mut)"
        />

        {/* 3-Panel Layout */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
          <div style={{
            width: 240, minWidth: 240, background: PANEL_BG,
            borderRight: `1px solid ${BORDER}`, padding: '14px 12px',
            overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* Enzyme Selector */}
            <div>
              <SectionLabel>Enzyme Selector</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ENZYME_STRUCTURES.map((enz, i) => {
                  const isRL = enz.id === RATE_LIMITING_ENZYME.id;
                  const sel = i === selectedEnzyme;
                  return (
                    <button key={enz.id} onClick={() => setSelectedEnzyme(i)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '6px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: sel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                      transition: 'background 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                        <span style={{ fontFamily: SANS, fontSize: '11px', fontWeight: 600,
                          color: sel ? '#fff' : VALUE }}>{enz.name}</span>
                        {isRL && (
                          <span style={{
                            fontFamily: MONO, fontSize: '7px', color: '#FAEDCB',
                            background: 'rgba(250,237,203,0.12)',
                            padding: '1px 5px', borderRadius: 6,
                          }}>⚠ Rate-limiting</span>
                        )}
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: '9px', color: LABEL }}>
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
                  <button key={vm.key} onClick={() => setViewMode(vm.key)} style={{
                    fontFamily: SANS, fontSize: '9px', padding: '5px 2px',
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
                fontFamily: SANS, fontSize: '9px', color: VALUE, lineHeight: 1.5,
                padding: '6px 8px', ...GLASS, borderRadius: 10,
              }}>
                <span style={{ color: LABEL }}>Substrate:</span> {enzyme.substrate}
                <br />
                <span style={{ color: LABEL }}>Product:</span> {enzyme.product}
                <br />
                <span style={{ color: LABEL }}>pH opt:</span>{' '}
                <span style={{ fontFamily: MONO }}>{enzyme.optimalPH}</span>
                {' | '}
                <span style={{ color: LABEL }}>T opt:</span>{' '}
                <span style={{ fontFamily: MONO }}>{enzyme.optimalTemp}°C</span>
              </div>
            </div>
          </div>

          {/* ── CENTER CANVAS ─────────────────────────────────────── */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: '#0c0e14', overflow: 'hidden',
          }}>
            <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
              {viewMode === 'Binding' && (
                <div style={{ padding: 16 }}>
                  <BindingRadar result={binding} />
                  <div style={{ marginTop: 8 }}>
                    <SectionLabel>Catalytic Residues — {enzyme.name}</SectionLabel>
                    <ResidueTable enzyme={enzyme} />
                  </div>
                </div>
              )}
              {viewMode === 'Sequences' && <SequenceView result={sequences} />}
              {viewMode === 'FluxCost' && (
                <div style={{ padding: 16 }}>
                  <FluxCostView result={drain} />
                </div>
              )}
              {viewMode === 'Balancer' && (
                <div style={{ padding: 16 }}>
                  <BalancerView result={balance} />
                </div>
              )}
              {viewMode === 'Pareto' && (
                <div style={{ padding: 16 }}>
                  <ParetoView result={pareto} />
                </div>
              )}
              {viewMode === 'Mutagenesis' && (
                <MutagenesisView result={mutagenesis} enzyme={enzyme} />
              )}
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
          <div style={{
            width: 260, minWidth: 260, background: PANEL_BG,
            borderLeft: `1px solid ${BORDER}`, padding: '14px 12px',
            overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
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
                          fontFamily: MONO, fontSize: '9px', color: PANEL_BG, fontWeight: 700,
                          background: color, padding: '1px 6px', borderRadius: 6,
                        }}>{a.step}</span>
                        <span style={{
                          fontFamily: SANS, fontSize: '8px', color,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>{a.phase.replace('_', ' ')}</span>
                      </div>
                      <p style={{
                        fontFamily: SANS, fontSize: '9px', color: VALUE,
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
    </IDEShell>
  );
}
