'use client';
/**
 * CatDes View Components -- Presentational components for the Catalyst Designer.
 * Includes: MiniBar, StatusDot, FrontierEngineBadge, BindingView, SequenceView,
 * FluxCostView, BalancerView, ParetoView, MutagenesisView.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { THEME } from '../../../theme';
import { getToolValidity } from '../../../config/toolValidity';
import {
  PHASE_COLORS, tn, hdrCell, dataCell, BORDER, LABEL, VALUE, VALIDITY_STYLES,
} from './catdesShared';
import type {
  BindingAffinityResult, SequenceDesignResult, MetabolicDrainResult,
  PathwayBalanceResult, ParetoFrontResult, MutagenesisResult, EnzymeStructure,
} from '../../../services/CatalystDesignerEngine';

/* -- MiniBar --------------------------------------------------------- */

export function MiniBar({ value, color, max = 1 }: { value: number; color: string; max?: number }) {
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

/* -- StatusDot ------------------------------------------------------- */

export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{label}</span>
    </span>
  );
}

/* -- FrontierEngineBadge --------------------------------------------- */

export function FrontierEngineBadge({ engineId }: { engineId: string }) {
  const validity = getToolValidity(engineId);
  if (!validity) return null;
  const style = VALIDITY_STYLES[validity.level] ?? VALIDITY_STYLES.partial;
  return (
    <div
      title={validity.caption}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        marginLeft: 'auto', marginRight: 16,
        fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700,
        letterSpacing: '0.10em', padding: '5px 9px',
        borderRadius: 'var(--nb-radius-md)',
        background: style.bg, border: `1px solid ${style.border}`, color: style.color,
        cursor: 'help', flexShrink: 0,
      }}
    >
      {style.label}
      <span style={{ fontWeight: 400, opacity: 0.7, letterSpacing: 0 }}>/ {engineId}</span>
    </div>
  );
}

/* -- BindingView (compact) ------------------------------------------- */

export function BindingView({ result, enzyme }: { result: BindingAffinityResult; enzyme: EnzymeStructure }) {
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

/* -- SequenceView (compact table) ------------------------------------ */

export function SequenceView({ result }: { result: SequenceDesignResult }) {
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

/* -- FluxCostView (compact) ------------------------------------------ */

export function FluxCostView({ result }: { result: MetabolicDrainResult }) {
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

/* -- BalancerView (compact table) ------------------------------------ */

export function BalancerView({ result }: { result: PathwayBalanceResult }) {
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

/* -- ParetoView (compact ranked table) ------------------------------- */

export function ParetoView({ result }: { result: ParetoFrontResult }) {
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

/* -- MutagenesisView (compact) --------------------------------------- */

export function MutagenesisView({ result, enzyme }: { result: MutagenesisResult; enzyme: EnzymeStructure }) {
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
