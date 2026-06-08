'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import CatalystViewer3D from '../molecular/CatalystViewer3D';
import type { ResidueClickData } from '../molecular/CatalystViewer3D';
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
import { buildCatalystSeed } from './shared/workbenchDataflow';
import { T } from '../ide/tokens';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import type { ToolTab } from './shared/ToolTabBar';

/* ── Design Tokens (shared via useToolTheme) ──────────────────────── */

import { toolTokens } from '../../hooks/useToolTheme';
const { panelBg: PANEL_BG, border: BORDER, label: LABEL, value: VALUE,
        inputBg: INPUT_BG, inputBorder: INPUT_BORDER, inputText: INPUT_TEXT } = toolTokens;
const GLASS: React.CSSProperties = { ...toolTokens.glass, borderRadius: 'var(--nb-radius-xl)' };

const PHASE_COLORS: Record<string, string> = {
  binding:     '#BFDCCD',
  sequence:    '#AFC3D6',
  flux:        '#E7C7A9',
  balancing:   '#E8A3A1',
  pareto:      '#CFC4E3',
  mutagenesis: '#BFDCCD',
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


/* ── Quality helpers ──────────────────────────────────────────────── */

function kdQuality(kd: number) {
  if (kd < 1) return { icon: '★', color: '#9ECE7E', label: 'Excellent' };
  if (kd < 10) return { icon: '✓', color: '#86C2C6', label: 'Good' };
  if (kd < 100) return { icon: '~', color: '#D9BC5D', label: 'Moderate' };
  if (kd < 1000) return { icon: '⊘', color: '#E58F46', label: 'Weak' };
  return { icon: '⊘', color: '#D96562', label: 'Very weak' };
}

function kcatQuality(kcat: number) {
  if (kcat > 100) return { icon: '★', color: '#9ECE7E', label: 'Excellent' };
  if (kcat > 10) return { icon: '✓', color: '#86C2C6', label: 'Good' };
  if (kcat > 1) return { icon: '~', color: '#D9BC5D', label: 'Moderate' };
  return { icon: '⊘', color: '#D96562', label: 'Slow' };
}

function fitQuality(fit: number) {
  if (fit > 0.85) return { icon: '★', color: '#9ECE7E', label: 'Excellent' };
  if (fit > 0.65) return { icon: '✓', color: '#86C2C6', label: 'Good' };
  if (fit > 0.45) return { icon: '~', color: '#D9BC5D', label: 'Moderate' };
  return { icon: '⊘', color: '#D96562', label: 'Poor' };
}

const AA_MUTATIONS = [
  'A','R','N','D','C','E','Q','G','H','I','L','K','M','F','P','S','T','W','Y','V',
];

/* ── Compact Shared Styles ─────────────────────────────────────────── */

const tn: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };
const hdrCell: React.CSSProperties = {
  fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textAlign: 'left',
  padding: '4px 6px', borderBottom: `1px solid ${BORDER}`, letterSpacing: '0.04em',
};
const dataCell: React.CSSProperties = {
  fontFamily: T.MONO, fontSize: 'var(--nb-fs-sm)', color: VALUE, padding: '4px 6px',
  textAlign: 'right', ...tn,
};

function MiniBar({ value, color, max = 1 }: { value: number; color: string; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 60 }}>
      <div style={{
        flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, opacity: 0.8 }} />
      </div>
      <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, minWidth: 28, textAlign: 'right', ...tn }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{label}</span>
    </span>
  );
}

/* ── Binding View (compact) ───────────────────────────────────────── */

function BindingView({ result, enzyme }: { result: BindingAffinityResult; enzyme: EnzymeStructure }) {
  const axes = [
    { label: 'Distance', value: result.distanceScore, color: PATHD_THEME.mint },
    { label: 'Orient', value: result.orientationScore, color: PATHD_THEME.sky },
    { label: 'vdW', value: result.vdwScore, color: PATHD_THEME.apricot },
    { label: 'Electro', value: result.electrostaticScore, color: PATHD_THEME.lilac },
  ];

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header metrics */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <div>
          <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Catalytic Fit</span>
          <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-lg)', color: VALUE, margin: '1px 0 0', ...tn }}>{result.overallScore.toFixed(3)}</p>
        </div>
        <div>
          <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Kd</span>
          <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '1px 0 0', ...tn }}>{result.predictedKd.toFixed(2)} <span style={{ fontSize: 'var(--nb-fs-xs)', color: LABEL }}>μM</span></p>
        </div>
        <div>
          <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>ΔG</span>
          <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '1px 0 0', ...tn }}>{result.bindingEnergy.toFixed(2)} <span style={{ fontSize: 'var(--nb-fs-xs)', color: LABEL }}>kcal/mol</span></p>
        </div>
      </div>

      {/* Energy decomposition */}
      <div>
        <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Energy Decomposition</span>
        <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
          {axes.map(ax => (
            <div key={ax.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, minWidth: 42 }}>{ax.label}</span>
              <MiniBar value={ax.value} color={ax.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Catalytic residues table */}
      <div>
        <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Catalytic Residues — {enzyme.name}
        </span>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
          <thead>
            <tr>
              {['Pos', 'Res', 'Role', 'Dist', 'Opt', 'Δ', 'Angle', 'pKa'].map(h => (
                <th key={h} style={hdrCell}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enzyme.catalyticResidues.map(r => {
              const distDelta = r.distanceToSubstrate - r.optimalDistance;
              return (
                <tr key={r.position} style={{ background: 'rgba(255,255,255,0.015)' }}>
                  <td style={{ ...dataCell, textAlign: 'left', color: PHASE_COLORS.binding }}>{r.position}</td>
                  <td style={{ ...dataCell, textAlign: 'center' }}>{r.residue}</td>
                  <td style={{ ...dataCell, textAlign: 'left', fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{r.role.replace('_', ' ')}</td>
                  <td style={dataCell}>{r.distanceToSubstrate.toFixed(1)}</td>
                  <td style={dataCell}>{r.optimalDistance.toFixed(1)}</td>
                  <td style={{ ...dataCell, color: Math.abs(distDelta) > 0.5 ? '#FA8072' : VALUE }}>
                    {distDelta > 0 ? '+' : ''}{distDelta.toFixed(1)}
                  </td>
                  <td style={dataCell}>{r.orientationAngle.toFixed(0)}°</td>
                  <td style={{ ...dataCell, color: Math.abs(r.pKaShift) > 0.5 ? '#FA8072' : VALUE }}>
                    {r.pKaShift > 0 ? '+' : ''}{r.pKaShift.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Sequence View (compact table) ────────────────────────────────── */

function SequenceView({ result }: { result: SequenceDesignResult }) {
  const caiColor = (v: number) =>
    v >= 0.75 ? '#93CB52' : v >= 0.55 ? '#FFFB1F' : 'rgba(255,120,120,0.7)';

  return (
    <div style={{ padding: '10px 12px' }}>
      <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Sequence Designs — {result.targetEnzyme}
      </span>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
        <thead>
          <tr>
            {['#', 'Score', 'Recovery', 'CAI', 'GC%', 'Rare', 'Sequence'].map(h => (
              <th key={h} style={hdrCell}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.designs.map(d => (
            <tr key={d.rank} style={{ background: 'rgba(255,255,255,0.015)' }}>
              <td style={{ ...dataCell, textAlign: 'left', color: PHASE_COLORS.sequence, fontWeight: 600 }}>#{d.rank}</td>
              <td style={dataCell}>{d.score.toFixed(3)}</td>
              <td style={dataCell}>{(d.recoveryRate * 100).toFixed(1)}%</td>
              <td style={{ ...dataCell, color: caiColor(d.cai) }}>{d.cai.toFixed(3)}</td>
              <td style={dataCell}>{(d.gcContent * 100).toFixed(1)}%</td>
              <td style={{ ...dataCell, color: d.rareCodons > 3 ? '#FA8072' : VALUE }}>{d.rareCodons}</td>
              <td style={{
                fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.55)',
                padding: '3px 6px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {d.dnaSequence.slice(0, 40)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.consensusMotifs.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, marginRight: 4 }}>Motifs:</span>
          {result.consensusMotifs.map((m, i) => (
            <span key={i} style={{
              fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PHASE_COLORS.sequence,
              padding: '1px 6px', borderRadius: 4,
              background: 'rgba(175,195,214,0.1)', border: '1px solid rgba(175,195,214,0.15)',
            }}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Flux Cost View (compact) ─────────────────────────────────────── */

function FluxCostView({ result }: { result: MetabolicDrainResult }) {
  const viabilityColor = result.isViable
    ? result.growthPenalty < 10 ? '#93CB52' : '#FFFB1F'
    : '#FA8072';

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <div>
          <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Drain</span>
          <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-lg)', color: VALUE, margin: '1px 0 0', ...tn }}>
            {(result.totalMetabolicDrain * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Growth Penalty</span>
          <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-md)', color: viabilityColor, margin: '1px 0 0', ...tn }}>
            {result.growthPenalty.toFixed(1)}%
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <StatusDot color={viabilityColor} label={result.isViable ? 'Viable' : 'Non-viable'} />
        </div>
      </div>

      {/* Resource breakdown */}
      <div>
        <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resource Breakdown</span>
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'ATP', value: result.atpCost, color: PHASE_COLORS.flux },
            { label: 'NADPH', value: result.nadphCost, color: PHASE_COLORS.balancing },
            { label: 'Ribosome', value: result.ribosomeBurden, color: PHASE_COLORS.pareto },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, minWidth: 52 }}>{item.label}</span>
              <MiniBar value={item.value} color={item.color} max={Math.max(result.atpCost, result.nadphCost, result.ribosomeBurden) || 1} />
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div style={{
        fontFamily: T.SANS, fontSize: 'var(--nb-fs-sm)', color: LABEL,
        padding: '6px 8px', borderRadius: 8,
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`,
      }}>
        {result.recommendation}
      </div>
    </div>
  );
}

/* ── Balancer View (compact table) ────────────────────────────────── */

function BalancerView({ result }: { result: PathwayBalanceResult }) {
  const steps = result.steps;
  const maxConc = Math.max(...steps.map(s => s.intermediateConc), 0.01);

  return (
    <div style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pathway Balance — {steps.length} Steps
        </span>
        <StatusDot color={result.isBalanced ? '#93CB52' : '#FA8072'} label={result.isBalanced ? 'Balanced' : 'Imbalanced'} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['#', 'Enzyme', 'kcat', 'Flux', 'Conc', 'Toxic', 'Status'].map(h => (
              <th key={h} style={hdrCell}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => {
            const toxRatio = s.intermediateConc / s.toxicityThreshold;
            const statusColor = toxRatio > 0.8 ? '#FA8072' : toxRatio > 0.5 ? '#FFFB1F' : '#93CB52';
            return (
              <tr key={i} style={{ background: 'rgba(255,255,255,0.015)' }}>
                <td style={{ ...dataCell, textAlign: 'left', color: PHASE_COLORS.balancing }}>{i + 1}</td>
                <td style={{ ...dataCell, textAlign: 'left' }}>{s.enzyme.toUpperCase()}</td>
                <td style={dataCell}>{s.adjustedKcat.toFixed(3)}</td>
                <td style={dataCell}>{s.currentFlux.toFixed(3)}</td>
                <td style={dataCell}>{s.intermediateConc.toFixed(3)}</td>
                <td style={dataCell}>{toxRatio.toFixed(2)}</td>
                <td style={{ ...dataCell, textAlign: 'center' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Convergence mini sparkline */}
      {result.convergenceHistory.length > 1 && (() => {
        const ch = result.convergenceHistory;
        const maxC = Math.max(...ch.map(c => c.maxConc), 0.01);
        const sparkW = 120, sparkH = 24;
        const pts = ch.map((c, i) =>
          `${(i / (ch.length - 1)) * sparkW},${sparkH - (c.maxConc / maxC) * sparkH}`
        ).join(' ');
        return (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Convergence</span>
            <svg width={sparkW} height={sparkH} style={{ overflow: 'visible' }}>
              <polyline points={pts} fill="none" stroke={PHASE_COLORS.balancing} strokeWidth={1.2} />
            </svg>
            <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, ...tn }}>
              {ch.length} iter → {ch[ch.length - 1].maxConc.toFixed(3)}
            </span>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Pareto View (compact ranked table) ───────────────────────────── */

function ParetoView({ result }: { result: ParetoFrontResult }) {
  const candidates = result.candidates;
  const frontIds = new Set(result.paretoFront.map(c => c.id));

  return (
    <div style={{ padding: '10px 12px' }}>
      <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Pareto Front — {result.paretoFront.length} non-dominated
      </span>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
        <thead>
          <tr>
            {['Rank', 'Pathway', 'Thermo', 'Yield', 'Cost', 'Status'].map(h => (
              <th key={h} style={hdrCell}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map(c => {
            const isFront = frontIds.has(c.id);
            const isBest = c.id === result.bestOverall;
            return (
              <tr key={c.id} style={{
                background: isBest ? 'rgba(207,196,227,0.06)' : 'rgba(255,255,255,0.015)',
              }}>
                <td style={{ ...dataCell, textAlign: 'left', color: isBest ? '#FFFB1F' : VALUE }}>
                  {isBest ? '★' : ''} {c.paretoRank}
                </td>
                <td style={{ ...dataCell, textAlign: 'left' }}>{c.name}</td>
                <td style={dataCell}>{c.scores.thermodynamic.toFixed(3)}</td>
                <td style={dataCell}>{c.scores.yield.toFixed(3)}</td>
                <td style={dataCell}>{c.scores.metabolicCost.toFixed(3)}</td>
                <td style={{ ...dataCell, textAlign: 'center' }}>
                  <span style={{
                    fontFamily: T.MONO, fontSize: 'var(--nb-fs-sm)',
                    color: isFront ? PHASE_COLORS.pareto : LABEL,
                    padding: '1px 4px', borderRadius: 3,
                    background: isFront ? 'rgba(207,196,227,0.1)' : 'transparent',
                  }}>
                    {isFront ? 'Front' : 'Dom.'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Mutagenesis View (compact) ───────────────────────────────────── */

function MutagenesisView({ result, enzyme }: { result: MutagenesisResult; enzyme: EnzymeStructure }) {
  const seqLen = enzyme.length;
  const barW = 200;

  const effectColor = (e: string) =>
    e === 'beneficial' ? '#93CB52' : e === 'neutral' ? '#FFFB1F' : '#FA8072';
  const effectSymbol = (e: string) =>
    e === 'beneficial' ? '+++' : e === 'neutral' ? '·' : '−';

  return (
    <div style={{ padding: '10px 12px' }}>
      {/* Header with sequence bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Mutagenesis Targets
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={barW} height={12} style={{ overflow: 'visible' }}>
            <rect x={0} y={0} width={barW} height={10} rx={2} fill="rgba(255,255,255,0.04)" stroke={BORDER} />
            {enzyme.catalyticResidues.map(r => (
              <rect key={`c-${r.position}`} x={(r.position / seqLen) * barW - 1} y={1} width={2} height={8} rx={1} fill="rgba(250,128,114,0.6)" />
            ))}
            {result.sites.map(s => (
              <rect key={`m-${s.position}`} x={(s.position / seqLen) * barW - 1.5} y={0} width={3} height={10} rx={1} fill="rgba(147,203,82,0.5)" />
            ))}
          </svg>
          <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-sm)', color: LABEL }}>{seqLen} aa</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Top combo:</span>
          <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-sm)', color: PHASE_COLORS.mutagenesis }}>
            {result.topCombination.positions.join(', ')}
          </span>
          <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-sm)', color: '#93CB52', ...tn }}>
            +{(result.topCombination.predictedImprovement * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Sites table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Pos', 'WT', 'Mutants', 'Cons', 'Effect', 'ΔKcat', 'ΔKm', 'Conf'].map(h => (
              <th key={h} style={hdrCell}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.sites.map(s => (
            <tr key={s.position} style={{ background: 'rgba(255,255,255,0.015)' }}>
              <td style={{ ...dataCell, textAlign: 'left', color: PHASE_COLORS.mutagenesis }}>{s.position}</td>
              <td style={{ ...dataCell, textAlign: 'center' }}>{s.wildTypeResidue}</td>
              <td style={{ ...dataCell, textAlign: 'left', fontSize: 'var(--nb-fs-xs)' }}>{s.suggestedMutants.join(',')}</td>
              <td style={dataCell}>{s.conservationScore.toFixed(2)}</td>
              <td style={{ ...dataCell, color: effectColor(s.predictedEffect), textAlign: 'center' }}>
                {effectSymbol(s.predictedEffect)}
              </td>
              <td style={dataCell}>{s.predictedDeltaKcat.toFixed(2)}×</td>
              <td style={dataCell}>{s.predictedDeltaKm.toFixed(2)}×</td>
              <td style={dataCell}>{(s.confidence * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════════════ */

export default React.memo(function CatalystDesignerPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  const [selectedEnzyme, setSelectedEnzyme] = useState<number>(2);
  const [renderMode, setRenderMode] = useState<'cartoon' | 'surface' | 'confidence'>('cartoon');
  const [spinEnabled, setSpinEnabled] = useState(true);
  const [selectedResidue, setSelectedResidue] = useState<number | null>(null);
  const [selectedMutation, setSelectedMutation] = useState<string | null>(null);

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

  const handleResidueClick = useCallback((data: ResidueClickData) => {
    setSelectedResidue(data.position);
    setSelectedMutation(null);
  }, []);

  // Compute mutation impact when a mutation is selected
  const mutationImpact = useMemo(() => {
    if (!selectedResidue || !selectedMutation) return null;
    const catRes = enzyme.catalyticResidues.find(r => r.position === selectedResidue);
    const deltaKd = (Math.random() * 2 - 0.5) * binding.predictedKd * 0.3;
    const deltaKcat = catRes ? (Math.random() * 2 - 0.5) * enzyme.kcat * 0.2 : 0;
    return {
      deltaKd,
      deltaKcat,
      newKd: binding.predictedKd + deltaKd,
      newKcat: enzyme.kcat + deltaKcat,
    };
  }, [selectedResidue, selectedMutation, binding.predictedKd, enzyme]);

  useEffect(() => {
    if (simError) return;
    setToolPayload('catdes', {
      validity: 'partial',
      toolId: 'catdes',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      selectedEnzymeId: enzyme.id,
      selectedEnzymeName: enzyme.name,
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
    binding.overallScore, binding.predictedKd, drain.growthPenalty, drain.isViable,
    drain.recommendation, drain.totalMetabolicDrain, enzyme.id, enzyme.name,
    mutagenesis.sites, project?.targetProduct, project?.title,
    recommendedSeed.designCount, recommendedSeed.requiredFlux,
    sequences.designs, setToolPayload, simError,
  ]);

  const selectedCatResidue = enzyme.catalyticResidues.find(r => r.position === selectedResidue);

  const [activeTab, setActiveTab] = useState('viewer');
  const CATDES_TABS: ToolTab[] = [
    { id: 'viewer', label: '3D Viewer', accent: PATHD_THEME.sky },
    { id: 'binding', label: 'Binding', accent: PATHD_THEME.lilac },
    { id: 'sequences', label: 'Sequences', accent: PATHD_THEME.apricot },
    { id: 'pareto', label: 'Pareto', accent: PATHD_THEME.mint },
    { id: 'mutagenesis', label: 'Mutagenesis', accent: PATHD_THEME.coral },
  ];

  const kdQ = kdQuality(mutationImpact?.newKd ?? binding.predictedKd);
  const kcatQ = kcatQuality(mutationImpact?.newKcat ?? enzyme.kcat);
  const fitQ = fitQuality(binding.overallScore);

  return (
    <ToolShell
      moduleId="catdes"
      title="Catalyst Designer"
      description="Enzyme engineering: binding affinity, sequence design, metabolic drain, Pareto optimization"
      formula="ΔG_bind = Σ(group contributions) + solvation"
      tabs={CATDES_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['sequences', 'pareto', 'mutagenesis']}
      footer={
        <>
          <ExportButton label="Export JSON"
            data={{ enzyme: enzyme.id, binding, sequences, drain, balance, pareto, mutagenesis }}
            filename="catalyst-design" format="json" />
          <ExportButton label="Export CSV"
            data={sequences.designs} filename="catalyst-sequences" format="csv" />
        </>
      }
    >
      {simError && (
        <div style={{ padding: '0 0 8px' }}><SimErrorBanner message={simError} /></div>
      )}

      {/* ── 3D Viewer Tab ── */}
      <ToolTabPanel tabId="viewer" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Enzyme" defaultCollapsed={false}>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enzyme</span>
              <select
                value={selectedEnzyme}
                onChange={e => { setSelectedEnzyme(Number(e.target.value)); setSelectedResidue(null); setSelectedMutation(null); }}
                style={{ width: '100%', marginTop: 4, fontFamily: T.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 600, color: VALUE, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 8, padding: '5px 8px', cursor: 'pointer', outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px' }}
              >
                {ENZYME_STRUCTURES.map((enz, i) => (
                  <option key={enz.id} value={i}>{enz.name} · EC {enz.ecNumber}</option>
                ))}
              </select>
              {enzyme.id === RATE_LIMITING_ENZYME.id && (
                <span style={{ display: 'inline-block', marginTop: 4, fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: '#FFFB1F', background: 'rgba(255,251,31,0.12)', padding: '2px 8px', borderRadius: 8 }}>Rate-limiting</span>
              )}
            </div>
            <div style={{ marginBottom: '12px', fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>
              <span>{enzyme.substrate}</span>
              <span style={{ color: VALUE, margin: '0 4px' }}>→</span>
              <span>{enzyme.product}</span>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Render Mode</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {(['cartoon', 'surface', 'confidence'] as const).map(mode => (
                  <button key={mode} onClick={() => setRenderMode(mode)}
                    className={`nb-tool-toggle ${renderMode === mode ? 'nb-tool-toggle--active' : ''}`}
                    style={{ flex: '1 1 0', padding: '4px 0', borderRadius: 6, borderColor: renderMode === mode ? PATHD_THEME.sky : undefined, background: renderMode === mode ? 'rgba(175,195,214,0.15)' : undefined, color: renderMode === mode ? PATHD_THEME.sky : undefined }}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setSpinEnabled(!spinEnabled)}
              className={`nb-tool-toggle ${spinEnabled ? 'nb-tool-toggle--active' : ''}`}
              style={{ width: '100%', padding: '5px 0', borderRadius: 6, borderColor: spinEnabled ? PATHD_THEME.mint : undefined, background: spinEnabled ? 'rgba(191,220,205,0.15)' : undefined, color: spinEnabled ? PATHD_THEME.mint : undefined }}>
              {spinEnabled ? '● Spin On' : 'Spin Off'}
            </button>
            {selectedResidue != null && selectedCatResidue && (
              <div style={{ marginTop: '16px' }}>
                <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected Residue</span>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '8px 10px', marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-md)', color: '#FFDB13', fontWeight: 700 }}>{selectedCatResidue.residue}{selectedResidue}</span>
                    <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PHASE_COLORS.binding, background: 'rgba(191,220,205,0.12)', padding: '2px 5px', borderRadius: 4 }}>{selectedCatResidue.role.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px' }}>
                    <div>
                      <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Dist</span>
                      <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, margin: 0 }}>{selectedCatResidue.distanceToSubstrate.toFixed(1)} Å</p>
                    </div>
                    <div>
                      <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Angle</span>
                      <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, margin: 0 }}>{selectedCatResidue.orientationAngle.toFixed(0)}°</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Mutate to</span>
                    <select value={selectedMutation || ''} onChange={e => setSelectedMutation(e.target.value || null)}
                      style={{ width: '100%', marginTop: 2, fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '4px 6px', cursor: 'pointer', outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px' }}>
                      <option value="">Select…</option>
                      {AA_MUTATIONS.filter(aa => aa !== selectedCatResidue.residue).map(aa => (
                        <option key={aa} value={aa}>{selectedCatResidue.residue} → {aa}</option>
                      ))}
                    </select>
                  </div>
                  {mutationImpact && (
                    <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div>
                          <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>ΔKd</span>
                          <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', margin: 0, color: mutationImpact.deltaKd < 0 ? '#93CB52' : '#FA8072' }}>{mutationImpact.deltaKd > 0 ? '+' : ''}{mutationImpact.deltaKd.toFixed(1)} μM</p>
                        </div>
                        <div>
                          <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>ΔKcat</span>
                          <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', margin: 0, color: mutationImpact.deltaKcat > 0 ? '#93CB52' : '#FA8072' }}>{mutationImpact.deltaKcat > 0 ? '+' : ''}{mutationImpact.deltaKcat.toFixed(3)} s⁻¹</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </FloatingControlRail>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <CatalystViewer3D enzyme={enzyme} renderMode={renderMode} spinEnabled={spinEnabled} onResidueClick={handleResidueClick} selectedResidue={selectedResidue} bindingQuality={binding.overallScore} style={{ height: '100%' }} />
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Kd', value: `${(mutationImpact?.newKd ?? binding.predictedKd).toFixed(1)} μM`, accent: kdQ.color },
                { label: 'Kcat', value: `${(mutationImpact?.newKcat ?? enzyme.kcat).toFixed(2)} s⁻¹`, accent: kcatQ.color },
                { label: 'Fit', value: binding.overallScore.toFixed(2), accent: fitQ.color },
                { label: 'Tm', value: `${enzyme.meltingTemp.toFixed(0)}°C`, accent: PATHD_THEME.apricot },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Binding Tab ── */}
      <ToolTabPanel tabId="binding" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: '16px', padding: '0 12px' }}>
            <div style={{ ...GLASS, padding: '10px 12px', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Kd</span>
                <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: kdQ.color }}>{kdQ.icon}</span>
              </div>
              <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '2px 0 0' }}>{(mutationImpact?.newKd ?? binding.predictedKd).toFixed(1)}<span style={{ fontSize: 'var(--nb-fs-sm)', color: LABEL }}> μM</span></p>
            </div>
            <div style={{ ...GLASS, padding: '10px 12px', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Kcat</span>
                <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: kcatQ.color }}>{kcatQ.icon}</span>
              </div>
              <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '2px 0 0' }}>{(mutationImpact?.newKcat ?? enzyme.kcat).toFixed(2)}<span style={{ fontSize: 'var(--nb-fs-sm)', color: LABEL }}> s⁻¹</span></p>
            </div>
            <div style={{ ...GLASS, padding: '10px 12px', borderRadius: 14 }}>
              <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Km</span>
              <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '2px 0 0' }}>{enzyme.km.toFixed(2)}<span style={{ fontSize: 'var(--nb-fs-sm)', color: LABEL }}> mM</span></p>
            </div>
            <div style={{ ...GLASS, padding: '10px 12px', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Fit</span>
                <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: fitQ.color }}>{fitQ.icon}</span>
              </div>
              <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '2px 0 0' }}>{binding.overallScore.toFixed(2)}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: '16px', padding: '0 12px' }}>
            <MetricCard label="Tm" value={enzyme.meltingTemp.toFixed(0)} unit="°C" />
            <MetricCard label="MW" value={enzyme.molecularWeight.toFixed(1)} unit="kDa" />
            <MetricCard label="pH opt" value={enzyme.optimalPH.toFixed(1)} />
          </div>
          <div style={{ ...GLASS, borderRadius: 16, overflow: 'hidden', margin: '0 12px' }}>
            <BindingView result={binding} enzyme={enzyme} />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Sequences Tab ── */}
      <ToolTabPanel tabId="sequences" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          <div style={{ ...GLASS, borderRadius: 16, overflow: 'hidden', margin: '0 12px' }}>
            <SequenceView result={sequences} />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Pareto Tab ── */}
      <ToolTabPanel tabId="pareto" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ ...GLASS, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: 8 }}><ParetoView result={pareto} /></div>
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Mutagenesis Tab ── */}
      <ToolTabPanel tabId="mutagenesis" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ ...GLASS, borderRadius: 16, overflow: 'hidden' }}>
            <MutagenesisView result={mutagenesis} enzyme={enzyme} />
          </div>
        </div>
      </ToolTabPanel>
    </ToolShell>
  );
});
