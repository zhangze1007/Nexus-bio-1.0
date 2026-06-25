'use client';
/**
 * PathwayFeasibility — Feasibility tab panel for CETHX.
 * Extracted from CETHXPage.tsx for modularity.
 */
import React from 'react';
import { THEME } from '../../../theme';
import MetricCard from '../../ide/shared/MetricCard';
import type { CETHXThermoResult, CETHXFeasibilityResult } from './useCETHXState';
import type { PathwayKey } from '../../../data/mockCETHX';
import { PATHWAYS } from './sharedComponents';

interface PathwayFeasibilityProps {
  thermo: CETHXThermoResult;
  pathway: PathwayKey;
  tempC: number;
  pH: number;
  limitingStep: string | null;
  feasibilityData: CETHXFeasibilityResult;
  equilibratorLoaded: boolean;
}

export default function PathwayFeasibility({
  thermo, pathway, tempC, pH, limitingStep, feasibilityData, equilibratorLoaded,
}: PathwayFeasibilityProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {/* Overall feasibility banner */}
      <div style={{
        padding: '14px 16px', borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${feasibilityData.overallFeasible ? `${THEME.MINT}57` : `${THEME.CORAL}57`}`,
        background: feasibilityData.overallFeasible ? `${THEME.MINT}12` : `${THEME.CORAL}12`,
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
      }}>
        <span style={{
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', fontWeight: 700,
          padding: '4px 10px', borderRadius: '999px',
          background: feasibilityData.overallFeasible ? `${THEME.MINT}28` : `${THEME.CORAL}28`,
          color: feasibilityData.overallFeasible ? THEME.MINT : THEME.CORAL,
        }}>
          {feasibilityData.overallFeasible ? 'FEASIBLE' : 'INFEASIBLE STEPS'}
        </span>
        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.5 }}>
          {feasibilityData.overallFeasible
            ? `All ${thermo.steps.length} steps have ΔG′ < 0 (exergonic) or are marginal. The pathway is thermodynamically feasible under current conditions.`
            : `${feasibilityData.infeasibleCount} of ${thermo.steps.length} steps have ΔG′ > 0 (endergonic). These require coupling or substrate channeling to proceed.`}
        </span>
      </div>

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <MetricCard label="Overall ΔG′" value={thermo.gibbs_free_energy} unit="kJ/mol" highlight={thermo.gibbs_free_energy < 0} />
        <MetricCard label="Feasible Steps" value={feasibilityData.feasibleCount} unit={`/ ${thermo.steps.length}`} />
        <MetricCard label="Infeasible Steps" value={feasibilityData.infeasibleCount} />
        <MetricCard label="Limiting Step" value={limitingStep ?? 'Pending'} />
      </div>

      {/* Per-step feasibility table */}
      <div style={{
        padding: '12px', borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_INSET, marginBottom: '16px',
      }}>
        <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
          Per-Step Feasibility Assessment
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 90px', gap: '2px 8px', alignItems: 'center' }}>
          {/* Header */}
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM, letterSpacing: '0.06em' }}>STEP</span>
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM, textAlign: 'right', letterSpacing: '0.06em' }}>ΔG′ (kJ/mol)</span>
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM, textAlign: 'right', letterSpacing: '0.06em' }}>K′eq</span>
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM, textAlign: 'center', letterSpacing: '0.06em' }}>STATUS</span>
          {/* Rows */}
          {feasibilityData.stepResults.map((r, i) => (
            <React.Fragment key={r.step + i}>
              <span
                className="nb-slide-in-left"
                style={{ animationDelay: `${i * 0.03}s`, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '3px 0', borderBottom: `1px solid ${THEME.BORDER}` }}
              >
                {r.step}
              </span>
              <span style={{
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 600, textAlign: 'right',
                color: r.deltaG < 0 ? THEME.MINT : r.deltaG <= 5 ? THEME.APRICOT : THEME.CORAL,
                padding: '3px 0', borderBottom: `1px solid ${THEME.BORDER}`,
              }}>
                {r.deltaG > 0 ? '+' : ''}{r.deltaG.toFixed(1)}
              </span>
              <span style={{
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textAlign: 'right',
                color: THEME.DIM,
                padding: '3px 0', borderBottom: `1px solid ${THEME.BORDER}`,
              }}>
                {r.keq >= 1e3 ? r.keq.toExponential(1) : r.keq <= 1e-3 ? r.keq.toExponential(1) : r.keq.toFixed(2)}
              </span>
              <span style={{ padding: '3px 0', borderBottom: `1px solid ${THEME.BORDER}`, textAlign: 'center' }}>
                <span style={{
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', fontWeight: 600,
                  padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.04em',
                  background: r.feasibility === 'feasible' ? `${THEME.MINT}22` : r.feasibility === 'marginal' ? `${THEME.APRICOT}22` : `${THEME.CORAL}22`,
                  color: r.feasibility === 'feasible' ? THEME.MINT : r.feasibility === 'marginal' ? THEME.APRICOT : THEME.CORAL,
                }}>
                  {r.feasibility.toUpperCase()}
                </span>
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <div style={{
        padding: '12px', borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_INSET, display: 'grid', gap: '6px', marginBottom: '16px',
      }}>
        <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Interpretation
        </div>
        <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.55 }}>
          {thermo.gibbs_free_energy < 0
            ? `The Alberty-transformed total ΔG′ = ${thermo.gibbs_free_energy.toFixed(1)} kJ/mol at pH ${pH.toFixed(1)}, ${tempC}°C is negative, indicating thermodynamic favorability. ${feasibilityData.infeasibleCount > 0 ? `However, ${feasibilityData.infeasibleCount} individual step(s) are endergonic and may require substrate channeling or coupling to proceed.` : 'All individual steps are exergonic or marginal.'}`
            : `The total ΔG′ = ${thermo.gibbs_free_energy.toFixed(1)} kJ/mol is positive. The pathway is thermodynamically unfavorable under these conditions. Consider adjusting pH, temperature, or metabolite concentrations to shift equilibrium.`}
        </div>
      </div>

      {/* Conditions */}
      <div style={{
        padding: '12px', borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_INSET, display: 'grid', gap: '6px',
      }}>
        <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Conditions
        </div>
        <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.55 }}>
          {`Pathway: ${PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway} · ${tempC.toFixed(0)}°C · pH ${pH.toFixed(1)} · I = 0.25 M · Alberty transform with Debye-Hückel ionic strength correction. ${equilibratorLoaded ? 'eQuilibrator 3 (ComponentContribution) backend.' : 'Pre-computed from Lehninger/NIST reference ΔG° with Alberty transform.'}`}
          {!equilibratorLoaded && (
            <span style={{ display: 'block', marginTop: '6px', fontStyle: 'italic', color: THEME.DIM }}>
              Note: per-step uncertainty is estimated at ~15% of |ΔG′| as a heuristic. For measured uncertainty from statistical thermodynamics, connect to the eQuilibrator backend.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
