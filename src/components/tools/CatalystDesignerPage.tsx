'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
import { PAPER_THEME } from '../charts/chartTheme';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { buildCatalystSeed } from './shared/workbenchDataflow';
import ToolShell from './shared/ToolShell';
import AlgorithmPanel from '../shared/AlgorithmPanel';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import type { ToolTab } from './shared/ToolTabBar';
import { getBRENDAKinetics } from '../../services/database/brendaClient';
import type { BRENDAKinetics } from '../../services/database/brendaClient';
import DataSourceBadge from '../ide/shared/DataSourceBadge';

/* ── Design Tokens (shared via useToolTheme) ──────────────────────── */

import { toolTokens } from '../../hooks/useToolTheme';
import { THEME } from '../../theme';
const { panelBg: PANEL_BG, border: BORDER, label: LABEL, value: VALUE,
        inputBg: INPUT_BG, inputBorder: INPUT_BORDER, inputText: INPUT_TEXT } = toolTokens;
const GLASS: React.CSSProperties = { ...toolTokens.glass, borderRadius: 'var(--nb-radius-xl)' };

const PHASE_COLORS: Record<string, string> = {
  binding:     THEME.MINT,
  sequence:    THEME.SKY,
  flux:        THEME.APRICOT,
  balancing:   THEME.CORAL,
  pareto:      THEME.LILAC,
  mutagenesis: THEME.MINT,
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
  if (kd < 1) return { icon: '★', color: THEME.SUCCESS_HIGH, label: 'Excellent' };
  if (kd < 10) return { icon: '✓', color: THEME.SUCCESS_MEDIUM, label: 'Good' };
  if (kd < 100) return { icon: '~', color: THEME.RISK_LOW, label: 'Moderate' };
  if (kd < 1000) return { icon: '⊘', color: THEME.RISK_MEDIUM, label: 'Weak' };
  return { icon: '⊘', color: THEME.RISK_HIGH, label: 'Very weak' };
}

function kcatQuality(kcat: number) {
  if (kcat > 100) return { icon: '★', color: THEME.SUCCESS_HIGH, label: 'Excellent' };
  if (kcat > 10) return { icon: '✓', color: THEME.SUCCESS_MEDIUM, label: 'Good' };
  if (kcat > 1) return { icon: '~', color: THEME.RISK_LOW, label: 'Moderate' };
  return { icon: '⊘', color: THEME.RISK_HIGH, label: 'Slow' };
}

function fitQuality(fit: number) {
  if (fit > 0.85) return { icon: '★', color: THEME.SUCCESS_HIGH, label: 'Excellent' };
  if (fit > 0.65) return { icon: '✓', color: THEME.SUCCESS_MEDIUM, label: 'Good' };
  if (fit > 0.45) return { icon: '~', color: THEME.RISK_LOW, label: 'Moderate' };
  return { icon: '⊘', color: THEME.RISK_HIGH, label: 'Poor' };
}

const AA_MUTATIONS = [
  'A','R','N','D','C','E','Q','G','H','I','L','K','M','F','P','S','T','W','Y','V',
];

/* ── Compact Shared Styles ─────────────────────────────────────────── */

const tn: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };
const hdrCell: React.CSSProperties = {
  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textAlign: 'left',
  padding: '4px 6px', borderBottom: `1px solid ${BORDER}`, letterSpacing: '0.04em',
};
const dataCell: React.CSSProperties = {
  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: VALUE, padding: '4px 6px',
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
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 2, background: color, opacity: 0.8 }}
        />
      </div>
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, minWidth: 28, textAlign: 'right', ...tn }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{label}</span>
    </span>
  );
}

/* ── Binding View (compact) ───────────────────────────────────────── */

function BindingView({ result, enzyme }: { result: BindingAffinityResult; enzyme: EnzymeStructure }) {
  const axes = [
    { label: 'Distance', value: result.distanceScore, color: THEME.MINT },
    { label: 'Orient', value: result.orientationScore, color: THEME.SKY },
    { label: 'vdW', value: result.vdwScore, color: THEME.APRICOT },
    { label: 'Electro', value: result.electrostaticScore, color: THEME.LILAC },
  ];

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header metrics */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <div>
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Catalytic Fit</span>
          <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', color: VALUE, margin: '1px 0 0', ...tn }}>{result.overallScore.toFixed(3)}</p>
        </div>
        <div>
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Kd</span>
          <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '1px 0 0', ...tn }}>{result.predictedKd.toFixed(2)} <span style={{ fontSize: 'var(--nb-fs-xs)', color: LABEL }}>μM</span></p>
        </div>
        <div>
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>ΔG</span>
          <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '1px 0 0', ...tn }}>{result.bindingEnergy.toFixed(2)} <span style={{ fontSize: 'var(--nb-fs-xs)', color: LABEL }}>kcal/mol</span></p>
        </div>
      </div>

      {/* Energy decomposition */}
      <div>
        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Energy Decomposition</span>
        <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
          {axes.map(ax => (
            <div key={ax.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, minWidth: 42 }}>{ax.label}</span>
              <MiniBar value={ax.value} color={ax.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Catalytic residues table */}
      <div>
        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                  <td style={{ ...dataCell, color: Math.abs(distDelta) > 0.5 ? THEME.CORAL : VALUE }}>
                    {distDelta > 0 ? '+' : ''}{distDelta.toFixed(1)}
                  </td>
                  <td style={dataCell}>{r.orientationAngle.toFixed(0)}°</td>
                  <td style={{ ...dataCell, color: Math.abs(r.pKaShift) > 0.5 ? THEME.CORAL : VALUE }}>
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
    v >= 0.75 ? THEME.MINT : v >= 0.55 ? THEME.RISK_LOW : 'rgba(255,120,120,0.7)';

  return (
    <div style={{ padding: '10px 12px' }}>
      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
              <td style={{ ...dataCell, color: d.rareCodons > 3 ? THEME.CORAL : VALUE }}>{d.rareCodons}</td>
              <td style={{
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.55)',
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
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, marginRight: 4 }}>Motifs:</span>
          {result.consensusMotifs.map((m, i) => (
            <span key={i} style={{
              fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PHASE_COLORS.sequence,
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
    ? result.growthPenalty < 10 ? THEME.MINT : THEME.RISK_LOW
    : THEME.CORAL;

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <div>
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Drain</span>
          <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', color: VALUE, margin: '1px 0 0', ...tn }}>
            {(result.totalMetabolicDrain * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Growth Penalty</span>
          <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: viabilityColor, margin: '1px 0 0', ...tn }}>
            {result.growthPenalty.toFixed(1)}%
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <StatusDot color={viabilityColor} label={result.isViable ? 'Viable' : 'Non-viable'} />
        </div>
      </div>

      {/* Resource breakdown */}
      <div>
        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resource Breakdown</span>
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'ATP', value: result.atpCost, color: PHASE_COLORS.flux },
            { label: 'NADPH', value: result.nadphCost, color: PHASE_COLORS.balancing },
            { label: 'Ribosome', value: result.ribosomeBurden, color: PHASE_COLORS.pareto },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, minWidth: 52 }}>{item.label}</span>
              <MiniBar value={item.value} color={item.color} max={Math.max(result.atpCost, result.nadphCost, result.ribosomeBurden) || 1} />
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div style={{
        fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: LABEL,
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
        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pathway Balance — {steps.length} Steps
        </span>
        <StatusDot color={result.isBalanced ? THEME.MINT : THEME.CORAL} label={result.isBalanced ? 'Balanced' : 'Imbalanced'} />
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
            const statusColor = toxRatio > 0.8 ? THEME.CORAL : toxRatio > 0.5 ? THEME.RISK_LOW : THEME.MINT;
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
            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Convergence</span>
            <svg width={sparkW} height={sparkH} style={{ overflow: 'visible' }}>
              <polyline points={pts} fill="none" stroke={PHASE_COLORS.balancing} strokeWidth={1.2} />
            </svg>
            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, ...tn }}>
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
      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                <td style={{ ...dataCell, textAlign: 'left', color: isBest ? THEME.RISK_LOW : VALUE }}>
                  {isBest ? '★' : ''} {c.paretoRank}
                </td>
                <td style={{ ...dataCell, textAlign: 'left' }}>{c.name}</td>
                <td style={dataCell}>{c.scores.thermodynamic.toFixed(3)}</td>
                <td style={dataCell}>{c.scores.yield.toFixed(3)}</td>
                <td style={dataCell}>{c.scores.metabolicCost.toFixed(3)}</td>
                <td style={{ ...dataCell, textAlign: 'center' }}>
                  <span style={{
                    fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)',
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
    e === 'beneficial' ? THEME.MINT : e === 'neutral' ? THEME.RISK_LOW : THEME.CORAL;
  const effectSymbol = (e: string) =>
    e === 'beneficial' ? '+++' : e === 'neutral' ? '·' : '−';

  return (
    <div style={{ padding: '10px 12px' }}>
      {/* Header with sequence bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: LABEL }}>{seqLen} aa</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Top combo:</span>
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: PHASE_COLORS.mutagenesis }}>
            {result.topCombination.positions.join(', ')}
          </span>
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: THEME.MINT, ...tn }}>
            {result.topCombination.predictedImprovement != null ? `+${(result.topCombination.predictedImprovement * 100).toFixed(0)}%` : 'N/A'}
          </span>
        </div>
      </div>

      {/* Sites table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Pos', 'WT', 'Mutants', 'Cons', 'Effect', 'ΔKcat*', 'ΔKm*', 'Conf'].map(h => (
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
              <td style={dataCell}>{s.predictedDeltaKcat != null ? `${s.predictedDeltaKcat.toFixed(2)}×` : 'N/A'}</td>
              <td style={dataCell}>{s.predictedDeltaKm != null ? `${s.predictedDeltaKm.toFixed(2)}×` : 'N/A'}</td>
              <td style={dataCell}>{(s.confidence * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: '6px 0 0', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: LABEL, opacity: 0.7 }}>
        * ΔKcat/ΔKm predictions not available — quantitative mutagenesis effects require FoldX, Rosetta, or molecular dynamics.
      </p>
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
  const [brendaEcInput, setBrendaEcInput] = useState(enzyme.ecNumber);
  const [brendaData, setBrendaData] = useState<BRENDAKinetics | null>(null);
  const [brendaSource, setBrendaSource] = useState<'live' | 'mock'>('mock');
  const [brendaLoading, setBrendaLoading] = useState(false);

  const recommendedSeed = useMemo(
    () => buildCatalystSeed(project, analyzeArtifact, fbaPayload, cethxPayload, dbtlPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, fbaPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  useEffect(() => {
    setSelectedEnzyme(recommendedSeed.enzymeIndex);
  }, [recommendedSeed.enzymeIndex]);

  useEffect(() => {
    setBrendaEcInput(enzyme.ecNumber);
    setBrendaData(null);
  }, [enzyme.ecNumber]);

  const handleBrendaLookup = useCallback(async () => {
    if (!brendaEcInput.trim()) return;
    setBrendaLoading(true);
    try {
      const result = await getBRENDAKinetics(brendaEcInput.trim());
      setBrendaData(result.data);
      setBrendaSource(result.source);
    } finally {
      setBrendaLoading(false);
    }
  }, [brendaEcInput]);

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
  // NOTE: No quantitative prediction available — mutagenesis effects require
  // external tools (FoldX, Rosetta ddg_monomer, protein design suites).
  const mutationImpact = useMemo(() => {
    if (!selectedResidue || !selectedMutation) return null;
    return {
      deltaKd: null,
      deltaKcat: null,
      newKd: null,
      newKcat: null,
    };
  }, [selectedResidue, selectedMutation]);

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
    { id: 'viewer', label: '3D Viewer', accent: THEME.SKY },
    { id: 'binding', label: 'Binding', accent: THEME.LILAC },
    { id: 'sequences', label: 'Sequences', accent: THEME.APRICOT },
    { id: 'pareto', label: 'Pareto', accent: THEME.MINT },
    { id: 'mutagenesis', label: 'Mutagenesis', accent: THEME.CORAL },
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

      {/* ── Algorithm Transparency ── */}
      <div style={{ padding: '8px 16px' }}>
        <AlgorithmPanel
          name="Enzyme Design Pipeline"
          description="Combines binding affinity estimation (ΔG decomposition), sequence optimization (CAI + codon harmonization), and mutagenesis targeting. Uses BLOSUM62 substitution matrices and energy-based screening."
          assumptions={[
            'Lock-and-key binding model (rigid body)',
            'Additive free energy contributions per residue',
            'CAI reflects translation efficiency',
            'BLOSUM62 captures evolutionary conservation',
            'Single-point mutations only (no epistasis)',
          ]}
          limitations={[
            'No molecular dynamics simulation',
            'Simplified solvation model',
            'No allosteric effects considered',
            'Requires experimental validation of predictions',
          ]}
          citation={{
            authors: 'Kortemme T, Baker D',
            title: 'A simple physical model for binding energy hot spots in protein-protein complexes',
            journal: 'Proc Natl Acad Sci USA',
            year: 2002,
            doi: '10.1073/pnas.202485799',
          }}
        />
      </div>

      {/* ── 3D Viewer Tab ── */}
      <ToolTabPanel tabId="viewer" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Enzyme" defaultCollapsed={false}>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enzyme</span>
              <select
                value={selectedEnzyme}
                onChange={e => { setSelectedEnzyme(Number(e.target.value)); setSelectedResidue(null); setSelectedMutation(null); }}
                style={{ width: '100%', marginTop: 4, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 600, color: VALUE, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 8, padding: '5px 8px', cursor: 'pointer', outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px' }}
              >
                {ENZYME_STRUCTURES.map((enz, i) => (
                  <option key={enz.id} value={i}>{enz.name} · EC {enz.ecNumber}</option>
                ))}
              </select>
              {enzyme.id === RATE_LIMITING_ENZYME.id && (
                <span style={{ display: 'inline-block', marginTop: 4, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.RISK_LOW, background: 'rgba(255,251,31,0.12)', padding: '2px 8px', borderRadius: 8 }}>Rate-limiting</span>
              )}
            </div>
            {/* BRENDA Kinetics Lookup */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>BRENDA Lookup</span>
                <DataSourceBadge source={brendaSource} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={brendaEcInput}
                  onChange={e => setBrendaEcInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleBrendaLookup(); }}
                  placeholder="EC number (e.g. 1.1.1.34)"
                  style={{ flex: 1, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: INPUT_TEXT, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '4px 6px', outline: 'none' }}
                />
                <button
                  onClick={handleBrendaLookup}
                  disabled={brendaLoading}
                  style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: VALUE, background: 'rgba(175,195,214,0.12)', border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '4px 8px', cursor: brendaLoading ? 'wait' : 'pointer', opacity: brendaLoading ? 0.6 : 1 }}
                >
                  {brendaLoading ? '...' : 'Fetch'}
                </button>
              </div>
              {brendaData && brendaData.km.length > 0 && (
                <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}` }}>
                  <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: LABEL, marginBottom: 4 }}>{brendaData.enzymeName}</div>
                  {brendaData.km.map((k, i) => (
                    <div key={`km-${i}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Km ({k.substrate})</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{k.value} {k.unit}</span>
                    </div>
                  ))}
                  {brendaData.kcat.map((k, i) => (
                    <div key={`kcat-${i}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Kcat ({k.substrate})</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{k.value} {k.unit}</span>
                    </div>
                  ))}
                </div>
              )}
              {brendaData && brendaData.km.length === 0 && (
                <p style={{ margin: '4px 0 0', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: LABEL, opacity: 0.7 }}>
                  No kinetics data found for {brendaData.ecNumber}
                </p>
              )}
            </div>
            <div style={{ marginBottom: '12px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>
              <span>{enzyme.substrate}</span>
              <span style={{ color: VALUE, margin: '0 4px' }}>→</span>
              <span>{enzyme.product}</span>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Render Mode</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {(['cartoon', 'surface', 'confidence'] as const).map(mode => (
                  <button key={mode} onClick={() => setRenderMode(mode)}
                    className={`nb-tool-toggle ${renderMode === mode ? 'nb-tool-toggle--active' : ''}`}
                    style={{ flex: '1 1 0', padding: '4px 0', borderRadius: 6, borderColor: renderMode === mode ? THEME.SKY : undefined, background: renderMode === mode ? 'rgba(175,195,214,0.15)' : undefined, color: renderMode === mode ? THEME.SKY : undefined }}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setSpinEnabled(!spinEnabled)}
              className={`nb-tool-toggle ${spinEnabled ? 'nb-tool-toggle--active' : ''}`}
              style={{ width: '100%', padding: '5px 0', borderRadius: 6, borderColor: spinEnabled ? THEME.MINT : undefined, background: spinEnabled ? 'rgba(191,220,205,0.15)' : undefined, color: spinEnabled ? THEME.MINT : undefined }}>
              {spinEnabled ? '● Spin On' : 'Spin Off'}
            </button>
            {selectedResidue != null && selectedCatResidue && (
              <div style={{ marginTop: '16px' }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected Residue</span>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '8px 10px', marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: '#FFDB13', fontWeight: 700 }}>{selectedCatResidue.residue}{selectedResidue}</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PHASE_COLORS.binding, background: 'rgba(191,220,205,0.12)', padding: '2px 5px', borderRadius: 4 }}>{selectedCatResidue.role.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px' }}>
                    <div>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Dist</span>
                      <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, margin: 0 }}>{selectedCatResidue.distanceToSubstrate.toFixed(1)} Å</p>
                    </div>
                    <div>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Angle</span>
                      <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, margin: 0 }}>{selectedCatResidue.orientationAngle.toFixed(0)}°</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Mutate to</span>
                    <select value={selectedMutation || ''} onChange={e => setSelectedMutation(e.target.value || null)}
                      style={{ width: '100%', marginTop: 2, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '4px 6px', cursor: 'pointer', outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px' }}>
                      <option value="">Select…</option>
                      {AA_MUTATIONS.filter(aa => aa !== selectedCatResidue.residue).map(aa => (
                        <option key={aa} value={aa}>{selectedCatResidue.residue} → {aa}</option>
                      ))}
                    </select>
                  </div>
                  {mutationImpact && (
                    <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}>
                      <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', margin: 0, color: LABEL }}>No prediction available — use FoldX or Rosetta</p>
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
                { label: 'Tm', value: `${enzyme.meltingTemp.toFixed(0)}°C`, accent: THEME.APRICOT },
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
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Kd</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: kdQ.color }}>{kdQ.icon}</span>
              </div>
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '2px 0 0' }}>{(mutationImpact?.newKd ?? binding.predictedKd).toFixed(1)}<span style={{ fontSize: 'var(--nb-fs-sm)', color: LABEL }}> μM</span></p>
            </div>
            <div style={{ ...GLASS, padding: '10px 12px', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Kcat</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: kcatQ.color }}>{kcatQ.icon}</span>
              </div>
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '2px 0 0' }}>{(mutationImpact?.newKcat ?? enzyme.kcat).toFixed(2)}<span style={{ fontSize: 'var(--nb-fs-sm)', color: LABEL }}> s⁻¹</span></p>
            </div>
            <div style={{ ...GLASS, padding: '10px 12px', borderRadius: 14 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Km</span>
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '2px 0 0' }}>{enzyme.km.toFixed(2)}<span style={{ fontSize: 'var(--nb-fs-sm)', color: LABEL }}> mM</span></p>
            </div>
            <div style={{ ...GLASS, padding: '10px 12px', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Fit</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: fitQ.color }}>{fitQ.icon}</span>
              </div>
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: '2px 0 0' }}>{binding.overallScore.toFixed(2)}</p>
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
