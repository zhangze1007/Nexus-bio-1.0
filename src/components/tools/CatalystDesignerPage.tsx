'use client';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  identifyBottlenecks,
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
import { runDocking } from '../../services/database/dockingClient';
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
  const [brendaEcInput, setBrendaEcInput] = useState('');
  const [brendaData, setBrendaData] = useState<BRENDAKinetics | null>(null);
  const [brendaSource, setBrendaSource] = useState<'live' | 'mock'>('mock');
  const [brendaLoading, setBrendaLoading] = useState(false);
  const [brendaAppliedKm, setBrendaAppliedKm] = useState<number | null>(null);
  const [brendaAppliedKcat, setBrendaAppliedKcat] = useState<number | null>(null);

  // AlphaFold structure lookup
  const [alphafoldStatus, setAlphafoldStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [alphafoldSource, setAlphafoldSource] = useState<'live' | 'mock'>('mock');
  const [alphafoldPdbLength, setAlphafoldPdbLength] = useState(0);

  // Molecular docking state
  const [dockingResult, setDockingResult] = useState<any>(null);
  const [dockingLoading, setDockingLoading] = useState(false);

  const recommendedSeed = useMemo(
    () => buildCatalystSeed(project, analyzeArtifact, fbaPayload, cethxPayload, dbtlPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, fbaPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  // Seed signature guard: only re-apply enzyme selection when seed actually changes
  const seedSignature = useMemo(
    () => `${recommendedSeed.enzymeIndex}|${recommendedSeed.requiredFlux}|${recommendedSeed.designCount}`,
    [recommendedSeed.enzymeIndex, recommendedSeed.requiredFlux, recommendedSeed.designCount],
  );
  const lastAppliedSeedRef = useRef<string | null>(null);

  const enzyme = ENZYME_STRUCTURES[selectedEnzyme];

  // Active enzyme with optional BRENDA-applied Km/Kcat overrides
  const activeEnzyme: EnzymeStructure = useMemo(() => {
    if (brendaAppliedKm == null && brendaAppliedKcat == null) return enzyme;
    return {
      ...enzyme,
      km: brendaAppliedKm ?? enzyme.km,
      kcat: brendaAppliedKcat ?? enzyme.kcat,
    };
  }, [enzyme, brendaAppliedKm, brendaAppliedKcat]);

  // Clear applied BRENDA values when enzyme selection changes
  useEffect(() => {
    setBrendaAppliedKm(null);
    setBrendaAppliedKcat(null);
  }, [selectedEnzyme]);

  useEffect(() => {
    if (lastAppliedSeedRef.current === seedSignature) return;
    setSelectedEnzyme(recommendedSeed.enzymeIndex);
    lastAppliedSeedRef.current = seedSignature;
  }, [seedSignature, recommendedSeed.enzymeIndex]);

  useEffect(() => {
    setBrendaEcInput(enzyme.ecNumber);
    setBrendaData(null);
    setBrendaAppliedKm(null);
    setBrendaAppliedKcat(null);
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

  const handleApplyBrenda = useCallback(() => {
    if (!brendaData) return;
    if (brendaData.km.length > 0) setBrendaAppliedKm(brendaData.km[0].value);
    if (brendaData.kcat.length > 0) setBrendaAppliedKcat(brendaData.kcat[0].value);
  }, [brendaData]);

  const handleRevertBrenda = useCallback(() => {
    setBrendaAppliedKm(null);
    setBrendaAppliedKcat(null);
  }, []);

  const hasBrendaApplied = brendaAppliedKm != null || brendaAppliedKcat != null;

  // Molecular docking handler
  const handleDocking = useCallback(async () => {
    if (!enzyme.pdbId || !enzyme.substrate) return;
    setDockingLoading(true);
    try {
      const result = await runDocking(enzyme.pdbId, enzyme.substrate);
      setDockingResult(result.data);
    } finally {
      setDockingLoading(false);
    }
  }, [enzyme.pdbId, enzyme.substrate]);

  // AlphaFold lookup when enzyme changes
  const handleAlphaFoldLookup = useCallback(async () => {
    if (!enzyme.uniprotId) return;
    setAlphafoldStatus('loading');
    try {
      const res = await fetch(`/api/alphafold?id=${enzyme.uniprotId}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const pdb = await res.text();
        if (pdb && pdb.length > 100) {
          setAlphafoldStatus('found');
          setAlphafoldSource('live');
          setAlphafoldPdbLength(pdb.length);
        } else {
          setAlphafoldStatus('not_found');
          setAlphafoldSource('mock');
        }
      } else {
        setAlphafoldStatus('not_found');
        setAlphafoldSource('mock');
      }
    } catch {
      setAlphafoldStatus('error');
      setAlphafoldSource('mock');
    }
  }, [enzyme.uniprotId]);

  // Auto-fetch AlphaFold when enzyme changes
  useEffect(() => {
    setAlphafoldStatus('idle');
    setAlphafoldPdbLength(0);
    handleAlphaFoldLookup();
  }, [handleAlphaFoldLookup]);

  const { data: binding, error: simError } = useMemo(() => {
    try { return { data: predictBindingAffinity(enzyme), error: null as string | null }; }
    catch (e) { return { data: predictBindingAffinity(ENZYME_STRUCTURES[selectedEnzyme]), error: e instanceof Error ? e.message : 'Binding prediction failed' }; }
  }, [enzyme]);
  const sequences = useMemo(() => designSequences(enzyme, recommendedSeed.designCount), [enzyme, recommendedSeed.designCount]);
  const drain = useMemo(() => estimateMetabolicDrain(activeEnzyme, recommendedSeed.requiredFlux), [activeEnzyme, recommendedSeed.requiredFlux]);
  const balance = useMemo(() => balancePathway(PATHWAY_STEPS), []);
  const pareto = useMemo(() => rankPathways(PATHWAY_CANDIDATES), []);
  const mutagenesis = useMemo(() => predictMutagenesisSites(enzyme, 5), [enzyme]);

  // Bottleneck identification using real data from workbenchStore
  const bottlenecks = useMemo(() => identifyBottlenecks({
    pathwaySteps: PATHWAY_STEPS.map(s => ({
      enzymeId: s.enzyme,
      enzymeName: s.enzyme,
      substrate: s.substrate,
      product: s.product,
    })),
    fbaData: fbaPayload?.result ? {
      shadowPrices: fbaPayload.result.sensitivityCoefficients,
      fluxes: Object.fromEntries(fbaPayload.result.topFluxes.map(f => [f.reactionId, f.flux])),
      feasible: fbaPayload.result.feasible,
    } : undefined,
    cethxData: cethxPayload?.result ? {
      overallFeasible: cethxPayload.result.gibbsFreeEnergy < 0,
    } : undefined,
    dbtlflowData: dbtlPayload?.result ? {
      passRate: dbtlPayload.result.passRate,
    } : undefined,
  }), [fbaPayload, cethxPayload, dbtlPayload]);

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

  const [activeTab, setActiveTab] = useState('overview');

  // Inverse Folding state
  const [invFoldSeqCount, setInvFoldSeqCount] = useState(8);
  const [invFoldTemp, setInvFoldTemp] = useState(0.5);
  const [invFoldResult, setInvFoldResult] = useState<import('../../server/inverseFoldingEngine').InverseFoldingResult | null>(null);
  const [invFoldLoading, setInvFoldLoading] = useState(false);

  const handleInverseFolding = useCallback(async () => {
    setInvFoldLoading(true);
    try {
      const { runInverseFolding } = await import('../../server/inverseFoldingEngine');
      // Generate backbone from current enzyme's catalytic residues (simplified)
      const backbone = Array.from({ length: Math.max(30, enzyme.catalyticResidues.length * 10) }, (_, i) => ({
        residueIndex: i,
        residueName: 'ALA',
        x: 10 * Math.cos(i * 0.6),
        y: 10 * Math.sin(i * 0.6) + (i % 5) * 2,
        z: i * 3.8,
      }));
      const result = runInverseFolding({
        backbone,
        nSequences: invFoldSeqCount,
        temperature: invFoldTemp,
      });
      setInvFoldResult(result);
    } finally {
      setInvFoldLoading(false);
    }
  }, [enzyme.catalyticResidues.length, invFoldSeqCount, invFoldTemp]);

  // Expression Prediction state
  const [exprResult, setExprResult] = useState<import('../../server/geneExpressionPredictor').ExpressionPrediction | null>(null);
  const [exprLoading, setExprLoading] = useState(false);

  // Plasmid Design state
  const [plasmidResult, setPlasmidResult] = useState<import('../../server/plasmidDesignEngine').PlasmidDesignResult | null>(null);
  const [plasmidLoading, setPlasmidLoading] = useState(false);
  const [plasmidHost, setPlasmidHost] = useState<'ecoli' | 'yeast'>('ecoli');

  const handleExpressionPrediction = useCallback(async () => {
    setExprLoading(true);
    try {
      const { predictGeneExpression } = await import('../../server/geneExpressionPredictor');
      // Use current enzyme's sequence for prediction
      const cds = enzyme.sequence || 'ATGAAACGCACCAGCAACAGCAACTAA';
      const promoter = 'TTGACATATACATTAAGAATTCGATATCAATGACA';
      const rbs = 'AAGAAGGAGATATACAT';
      const terminator = 'GCAAAAAACCCCTCAAGACCCGTTTAGAG';
      const result = predictGeneExpression(promoter, rbs, cds, terminator, 'ecoli');
      setExprResult(result);
    } finally {
      setExprLoading(false);
    }
  }, [enzyme.sequence]);

  const handlePlasmidDesign = useCallback(async () => {
    setPlasmidLoading(true);
    try {
      const { designPlasmid } = await import('../../server/plasmidDesignEngine');
      const cds = enzyme.sequence || 'ATGAAACGCACCAGCAACAGCAACTAA';
      const result = designPlasmid(cds, plasmidHost, 'high_expression', 'gibson', 2);
      setPlasmidResult(result);
    } finally {
      setPlasmidLoading(false);
    }
  }, [enzyme.sequence, plasmidHost]);

  const CATDES_TABS: ToolTab[] = [
    { id: 'overview', label: 'Overview', accent: THEME.CORAL },
    { id: 'balance', label: 'Pathway Balance', accent: THEME.MINT },
    { id: 'pareto', label: 'Pareto', accent: THEME.LILAC },
    { id: 'viewer', label: '3D Viewer', accent: THEME.SKY },
    { id: 'inversefold', label: 'Inverse Folding', accent: THEME.LILAC },
    { id: 'expression', label: 'Expression', accent: THEME.MINT },
    { id: 'plasmid', label: 'Plasmid', accent: THEME.APRICOT },
  ];

  const kdQ = kdQuality(mutationImpact?.newKd ?? binding.predictedKd);
  const kcatQ = kcatQuality(mutationImpact?.newKcat ?? activeEnzyme.kcat);
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
      advancedTabIds={['balance', 'pareto']}
      footer={
        <>
          <ExportButton label="Export JSON"
            data={{ enzyme: enzyme.id, binding, sequences, drain, balance, pareto, mutagenesis, docking: dockingResult }}
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

      {/* ── Overview Tab: Bottleneck Analysis + ProEvol Handoff ── */}
      <ToolTabPanel tabId="overview" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '16px' }}>
            {/* Bottleneck Analysis */}
            <div style={{ ...GLASS, borderRadius: 16, padding: '14px' }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Bottleneck Analysis
              </span>
              {bottlenecks.topBottleneck ? (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: VALUE, margin: 0 }}>
                    {bottlenecks.topBottleneck.enzymeName}
                  </p>
                  <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, margin: '4px 0 0' }}>
                    Score: {bottlenecks.topBottleneck.score.toFixed(3)} — {bottlenecks.topBottleneck.recommendation}
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: LABEL }}>FBA</span>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 2 }}>
                        <div style={{ height: '100%', width: `${bottlenecks.topBottleneck.factors.fba * 100}%`, background: THEME.SKY, borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: LABEL }}>Thermo</span>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 2 }}>
                        <div style={{ height: '100%', width: `${bottlenecks.topBottleneck.factors.thermo * 100}%`, background: THEME.CORAL, borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: LABEL }}>Expt</span>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 2 }}>
                        <div style={{ height: '100%', width: `${bottlenecks.topBottleneck.factors.experimental * 100}%`, background: THEME.MINT, borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: LABEL, margin: '8px 0 0' }}>
                  Connect FBA/CETHX/DBTLflow data to identify bottlenecks.
                </p>
              )}
            </div>

            {/* Metabolic Cost */}
            <div style={{ ...GLASS, borderRadius: 16, padding: '14px' }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Metabolic Cost
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <MetricCard label="ATP Cost" value={drain.atpCost.toFixed(0)} unit="ATP/chain" />
                <MetricCard label="Growth Penalty" value={(drain.growthPenalty * 100).toFixed(1)} unit="%" />
                <MetricCard label="Ribosome" value={(drain.ribosomeBurden * 100).toFixed(1)} unit="%" />
                <MetricCard label="Total Drain" value={(drain.totalMetabolicDrain * 100).toFixed(1)} unit="%" />
              </div>
            </div>
          </div>

          {/* Pathway Steps */}
          <div style={{ ...GLASS, borderRadius: 16, padding: '14px', marginBottom: 12 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pathway Steps
            </span>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PATHWAY_STEPS.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.SKY, minWidth: 24 }}>{i + 1}</span>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: VALUE, flex: 1 }}>
                    {step.enzyme} · {step.substrate} → {step.product}
                  </span>
                  {step.enzyme === bottlenecks.topBottleneck?.enzymeId && (
                    <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.RISK_LOW, background: 'rgba(255,251,31,0.12)', padding: '2px 6px', borderRadius: 6 }}>BOTTLENECK</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Send to ProEvol Button */}
          {bottlenecks.topBottleneck && (
            <div style={{ ...GLASS, borderRadius: 16, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: VALUE }}>
                  {bottlenecks.topBottleneck.enzymeName} is the rate-limiting step
                </span>
                <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, margin: '2px 0 0' }}>
                  Send to ProEvol for protein engineering
                </p>
              </div>
              <button
                onClick={() => {
                  const targetEnzyme = ENZYME_STRUCTURES.find(e => e.id === bottlenecks.topBottleneck?.enzymeId);
                  if (targetEnzyme) {
                    // Store ProEvol handoff data in localStorage (workaround for payload type constraints)
                    localStorage.setItem('nexus-bio:catdes-to-proevol', JSON.stringify({
                      targetEnzyme: targetEnzyme.id,
                      targetEnzymeName: targetEnzyme.name,
                      targetProperty: 'kcat',
                      currentValue: targetEnzyme.kcat,
                      targetValue: targetEnzyme.kcat * 3,
                      pdbId: targetEnzyme.pdbId,
                      uniprotId: targetEnzyme.uniprotId,
                      sequence: targetEnzyme.sequence,
                    }));
                    window.location.href = '/tools/proevol';
                  }
                }}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(191,220,205,0.14)', border: '1px solid rgba(191,220,205,0.3)',
                  color: 'rgba(191,220,205,0.9)', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)',
                  cursor: 'pointer',
                }}
              >
                Send to ProEvol →
              </button>
            </div>
          )}
        </div>
      </ToolTabPanel>

      {/* ── Pathway Balance Tab ── */}
      <ToolTabPanel tabId="balance" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ ...GLASS, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: 8 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Pathway Balance (Newton-Raphson)
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <MetricCard label="Converged" value={balance.isBalanced ? 'Yes' : 'No'} />
                <MetricCard label="Objective" value={balance.objectiveValue.toFixed(4)} />
                <MetricCard label="Iterations" value={String(balance.iterations)} />
                <MetricCard label="Toxicity" value={balance.toxicIntermediates.length > 0 ? '⚠ Flagged' : '✓ OK'} />
              </div>
            </div>
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
              {/* BRENDA vs Model Comparison Panel */}
              {brendaData && (brendaData.km.length > 0 || brendaData.kcat.length > 0) && (
                <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}` }}>
                  <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    BRENDA vs Model
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...hdrCell, fontSize: 'var(--nb-fs-xxs)', padding: '2px 4px' }}>Param</th>
                        <th style={{ ...hdrCell, fontSize: 'var(--nb-fs-xxs)', padding: '2px 4px', textAlign: 'right' }}>Model</th>
                        <th style={{ ...hdrCell, fontSize: 'var(--nb-fs-xxs)', padding: '2px 4px', textAlign: 'right' }}>BRENDA</th>
                        <th style={{ ...hdrCell, fontSize: 'var(--nb-fs-xxs)', padding: '2px 4px', textAlign: 'right' }}>Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brendaData.km.length > 0 && (() => {
                        const brendaKm = brendaData.km[0].value;
                        const modelKm = enzyme.km;
                        const delta = brendaKm - modelKm;
                        const deltaColor = Math.abs(delta) > modelKm * 0.5 ? THEME.CORAL : THEME.MINT;
                        return (
                          <tr>
                            <td style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, padding: '2px 4px' }}>Km</td>
                            <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, padding: '2px 4px', textAlign: 'right', ...tn }}>{modelKm.toFixed(3)} mM</td>
                            <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.SKY, padding: '2px 4px', textAlign: 'right', ...tn }}>
                              {brendaKm} {brendaData.km[0].unit}
                              <DataSourceBadge source={brendaSource} />
                            </td>
                            <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: deltaColor, padding: '2px 4px', textAlign: 'right', ...tn }}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(3)}
                            </td>
                          </tr>
                        );
                      })()}
                      {brendaData.kcat.length > 0 && (() => {
                        const brendaKcat = brendaData.kcat[0].value;
                        const modelKcat = enzyme.kcat;
                        const delta = brendaKcat - modelKcat;
                        const deltaColor = Math.abs(delta) > modelKcat * 0.5 ? THEME.CORAL : THEME.MINT;
                        return (
                          <tr>
                            <td style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, padding: '2px 4px' }}>Kcat</td>
                            <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, padding: '2px 4px', textAlign: 'right', ...tn }}>{modelKcat.toFixed(3)} s⁻¹</td>
                            <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.SKY, padding: '2px 4px', textAlign: 'right', ...tn }}>
                              {brendaKcat} {brendaData.kcat[0].unit}
                              <DataSourceBadge source={brendaSource} />
                            </td>
                            <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: deltaColor, padding: '2px 4px', textAlign: 'right', ...tn }}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(3)}
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                  {/* Apply / Revert buttons */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button
                      onClick={handleApplyBrenda}
                      disabled={hasBrendaApplied}
                      style={{
                        flex: 1, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)',
                        color: hasBrendaApplied ? LABEL : THEME.MINT,
                        background: hasBrendaApplied ? 'rgba(255,255,255,0.03)' : 'rgba(147,203,82,0.12)',
                        border: `1px solid ${hasBrendaApplied ? BORDER : 'rgba(147,203,82,0.3)'}`,
                        borderRadius: 6, padding: '4px 6px',
                        cursor: hasBrendaApplied ? 'default' : 'pointer',
                        opacity: hasBrendaApplied ? 0.5 : 1,
                      }}
                    >
                      {hasBrendaApplied ? 'Applied' : 'Apply BRENDA Values'}
                    </button>
                    {hasBrendaApplied && (
                      <button
                        onClick={handleRevertBrenda}
                        style={{
                          fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)',
                          color: THEME.CORAL, background: 'rgba(250,128,114,0.08)',
                          border: `1px solid rgba(250,128,114,0.2)`,
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                        }}
                      >
                        Revert
                      </button>
                    )}
                  </div>
                  {hasBrendaApplied && (
                    <p style={{ margin: '4px 0 0', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: LABEL, opacity: 0.6 }}>
                      BRENDA values applied to metabolic drain model.
                    </p>
                  )}
                </div>
              )}
            </div>
            {/* AlphaFold Structure Lookup */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>AlphaFold</span>
                <DataSourceBadge source={alphafoldSource} />
              </div>
              <div style={{
                padding: '6px 8px', borderRadius: 8,
                background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>UniProt</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{enzyme.uniprotId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Status</span>
                  <span style={{
                    fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                    color: alphafoldStatus === 'found' ? THEME.MINT :
                           alphafoldStatus === 'loading' ? THEME.APRICOT :
                           alphafoldStatus === 'not_found' ? THEME.CORAL : LABEL,
                  }}>
                    {alphafoldStatus === 'found' ? `Structure loaded (${(alphafoldPdbLength / 1000).toFixed(0)}k atoms)` :
                     alphafoldStatus === 'loading' ? 'Fetching...' :
                     alphafoldStatus === 'not_found' ? 'Not found' :
                     alphafoldStatus === 'error' ? 'API unavailable' : 'Pending'}
                  </span>
                </div>
                {alphafoldStatus !== 'loading' && (
                  <button
                    onClick={handleAlphaFoldLookup}
                    style={{
                      width: '100%', marginTop: 4,
                      fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)',
                      color: LABEL, background: 'rgba(175,195,214,0.08)',
                      border: `1px solid ${BORDER}`, borderRadius: 4,
                      padding: '3px 6px', cursor: 'pointer',
                    }}
                  >
                    Re-fetch
                  </button>
                )}
              </div>
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
                { label: 'Kcat', value: `${(mutationImpact?.newKcat ?? activeEnzyme.kcat).toFixed(2)} s⁻¹`, accent: kcatQ.color },
                { label: 'Fit', value: binding.overallScore.toFixed(2), accent: fitQ.color },
                { label: 'Tm', value: `${enzyme.meltingTemp.toFixed(0)}°C`, accent: THEME.APRICOT },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Inverse Folding Tab ──────────────────────────────────────── */}
      <ToolTabPanel tabId="inversefold" activeId={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            ...GLASS,
            padding: 16,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Sequences
            </span>
            <input type="number" min={1} max={32} value={invFoldSeqCount}
              onChange={(e) => setInvFoldSeqCount(Number(e.target.value))}
              style={{ width: 60, padding: '4px 8px', background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: THEME.FS_SM, outline: 'none' }}
            />
            <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Temperature
            </span>
            <input type="range" min={0.1} max={1.5} step={0.1} value={invFoldTemp}
              onChange={(e) => setInvFoldTemp(Number(e.target.value))}
              style={{ width: 100 }}
            />
            <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: VALUE }}>{invFoldTemp.toFixed(1)}</span>
            <button onClick={handleInverseFolding} disabled={invFoldLoading} className="nb-tool-toggle"
              style={{ padding: '6px 14px', fontSize: THEME.FS_SM, opacity: invFoldLoading ? 0.4 : 1 }}
            >
              {invFoldLoading ? 'Designing...' : 'Design Sequences'}
            </button>
            {invFoldResult && (
              <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: 'rgba(255,255,255,0.4)' }}>
                {invFoldResult.sequences.length} sequences • {invFoldResult.structuralMotifs.length} motifs
              </span>
            )}
          </div>

          {/* Design notes */}
          {invFoldResult && (
            <div style={{
              ...GLASS, padding: 12,
              fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
            }}>
              {invFoldResult.designNotes.map((n, i) => <div key={i}>• {n}</div>)}
            </div>
          )}

          {/* Results table */}
          {invFoldResult && invFoldResult.sequences.length > 0 && (
            <div style={{ ...GLASS, padding: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: THEME.MONO, fontSize: THEME.FS_XS }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: LABEL }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: LABEL }}>Sequence</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: LABEL }}>Score</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: LABEL }}>Packing</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: LABEL }}>SS Match</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: LABEL }}>Core</th>
                  </tr>
                </thead>
                <tbody>
                  {invFoldResult.sequences.slice(0, 10).map((seq, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                      <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.4)' }}>{i + 1}</td>
                      <td style={{ padding: '6px 8px', color: VALUE, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {seq.sequence}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: seq.score > 0.7 ? THEME.SUCCESS_HIGH : seq.score > 0.5 ? THEME.SUCCESS_MEDIUM : THEME.RISK_LOW }}>
                        {seq.score.toFixed(3)}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: VALUE }}>{seq.metrics.packingQuality.toFixed(2)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: VALUE }}>{seq.metrics.secondaryStructureMatch.toFixed(2)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: VALUE }}>{seq.metrics.hydrophobicCoreIntegrity.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Structural motifs */}
          {invFoldResult && invFoldResult.structuralMotifs.length > 0 && (
            <div style={{ ...GLASS, padding: 12 }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Structural Motifs
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {invFoldResult.structuralMotifs.map((motif, i) => (
                  <span key={i} style={{
                    padding: '3px 8px',
                    background: motif.type === 'helix' ? 'rgba(200,216,232,0.1)' : motif.type === 'sheet' ? 'rgba(200,224,208,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${motif.type === 'helix' ? 'rgba(200,216,232,0.2)' : motif.type === 'sheet' ? 'rgba(200,224,208,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '3px',
                    fontFamily: THEME.MONO,
                    fontSize: THEME.FS_XS,
                    color: motif.type === 'helix' ? THEME.SKY : motif.type === 'sheet' ? THEME.MINT : 'rgba(255,255,255,0.5)',
                  }}>
                    {motif.type} {motif.start}-{motif.end} ({(motif.confidence * 100).toFixed(0)}%)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </ToolTabPanel>

      {/* ── Expression Prediction Tab ──────────────────────────────────────── */}
      <ToolTabPanel tabId="expression" activeId={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            ...GLASS,
            padding: 16,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Gene Expression Predictor
            </span>
            <button onClick={handleExpressionPrediction} disabled={exprLoading} className="nb-tool-toggle"
              style={{ padding: '6px 14px', fontSize: THEME.FS_SM, opacity: exprLoading ? 0.4 : 1 }}
            >
              {exprLoading ? 'Predicting...' : 'Predict Expression'}
            </button>
            {exprResult && (
              <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: 'rgba(255,255,255,0.4)' }}>
                Expression: {exprResult.relativeExpression.toFixed(3)} | Confidence: {(exprResult.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {exprResult && (
            <>
              {/* Contribution breakdown */}
              <div style={{ ...GLASS, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {[
                  { label: 'Promoter', value: exprResult.contributions.promoter, color: THEME.CORAL },
                  { label: 'RBS', value: exprResult.contributions.rbs, color: THEME.MINT },
                  { label: 'CDS', value: exprResult.contributions.cds, color: THEME.SKY },
                  { label: 'Terminator', value: exprResult.contributions.terminator, color: THEME.LILAC },
                  { label: 'Host', value: exprResult.contributions.host, color: THEME.APRICOT },
                ].map(c => (
                  <div key={c.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL }}>{c.label}</div>
                    <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_SM, color: c.color, fontWeight: 600 }}>
                      {(c.value * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottlenecks */}
              {exprResult.bottlenecks.length > 0 && (
                <div style={{ ...GLASS, padding: 12 }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>Bottlenecks</div>
                  {exprResult.bottlenecks.map((b, i) => (
                    <div key={i} style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                      <span style={{ color: b.severity > 0.7 ? THEME.RISK_HIGH : b.severity > 0.4 ? THEME.RISK_MEDIUM : THEME.SUCCESS_MEDIUM }}>
                        [{b.stage}]
                      </span> {b.description}
                    </div>
                  ))}
                </div>
              )}

              {/* Optimization suggestions */}
              {exprResult.suggestions.length > 0 && (
                <div style={{ ...GLASS, padding: 12 }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>Optimization Suggestions</div>
                  {exprResult.suggestions.map((s, i) => (
                    <div key={i} style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                      <span style={{ color: THEME.SKY }}>[{s.component}]</span> {s.action}
                      <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                        (Δ={s.expectedImprovement.toFixed(3)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ToolTabPanel>

      {/* ── Plasmid Design Tab ──────────────────────────────────────────────── */}
      <ToolTabPanel tabId="plasmid" activeId={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            ...GLASS,
            padding: 16,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Plasmid Designer
            </span>
            <select
              value={plasmidHost}
              onChange={(e) => setPlasmidHost(e.target.value as 'ecoli' | 'yeast')}
              style={{ padding: '4px 8px', background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: THEME.FS_SM }}
            >
              <option value="ecoli">E. coli</option>
              <option value="yeast">S. cerevisiae</option>
            </select>
            <button onClick={handlePlasmidDesign} disabled={plasmidLoading} className="nb-tool-toggle"
              style={{ padding: '6px 14px', fontSize: THEME.FS_SM, opacity: plasmidLoading ? 0.4 : 1 }}
            >
              {plasmidLoading ? 'Designing...' : 'Design Plasmid'}
            </button>
            {plasmidResult && (
              <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: 'rgba(255,255,255,0.4)' }}>
                {plasmidResult.mainDesign.name} | {plasmidResult.mainDesign.totalSize} bp | Score: {plasmidResult.mainDesign.overallScore}
              </span>
            )}
          </div>

          {plasmidResult && (
            <>
              {/* Main design */}
              <div style={{ ...GLASS, padding: 12 }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>Main Design: {plasmidResult.mainDesign.name}</div>
                <div style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                  {plasmidResult.mainDesign.designNotes.map((n, i) => <div key={i}>• {n}</div>)}
                </div>
              </div>

              {/* Components */}
              <div style={{ ...GLASS, padding: 12 }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>Components</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {plasmidResult.mainDesign.components.map((c, i) => (
                    <span key={i} style={{
                      padding: '3px 8px',
                      background: c.type === 'replicon' ? 'rgba(200,216,232,0.1)' : c.type === 'resistance' ? 'rgba(200,224,208,0.1)' : 'rgba(221,208,232,0.1)',
                      border: `1px solid ${c.type === 'replicon' ? 'rgba(200,216,232,0.2)' : c.type === 'resistance' ? 'rgba(200,224,208,0.2)' : 'rgba(221,208,232,0.2)'}`,
                      borderRadius: '3px',
                      fontFamily: THEME.MONO,
                      fontSize: THEME.FS_XS,
                      color: 'rgba(255,255,255,0.7)',
                    }}>
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Alternatives */}
              {plasmidResult.alternatives.length > 0 && (
                <div style={{ ...GLASS, padding: 12 }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>Alternatives</div>
                  {plasmidResult.alternatives.map((alt, i) => (
                    <div key={i} style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                      <span style={{ color: THEME.SKY }}>Alt {i + 1}:</span> {alt.name} | {alt.totalSize} bp | Score: {alt.overallScore}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ToolTabPanel>

    </ToolShell>
  );
});
