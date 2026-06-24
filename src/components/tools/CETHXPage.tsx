'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ToolShell from './shared/ToolShell';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';
import ScientificHero from './shared/ScientificHero';
import AlgorithmPanel from '../shared/AlgorithmPanel';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ExportButton from '../ide/shared/ExportButton';
import { THEME } from '../../theme';
import DataSourceBadge from '../ide/shared/DataSourceBadge';
import DataUpload from '../shared/DataUpload';
import DataPreview from '../shared/DataPreview';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';

import useCETHXState from './cethx/useCETHXState';
import { PATHWAYS, CETHX_TABS } from './cethx/sharedComponents';
import BreathingWaterfall from './cethx/WaterfallCascade';
import ATPAccounting from './cethx/ATPAccounting';
import PathwayFeasibility from './cethx/PathwayFeasibility';
import TFAAnalysis from './cethx/TFAAnalysis';

export default React.memo(function CETHXPage() {
  const state = useCETHXState();
  const {
    pathway, setPathway, tempC, setTempC, pH, setPH,
    isRealData, equilibratorLoaded, isLoadingEquilibrator,
    compoundQuery, setCompoundQuery,
    pubchemData, pubchemSource, pubchemLoading, handleCompoundSearch,
    customThermoData, setCustomThermoData,
    customThermoHeaders, setCustomThermoHeaders,
    customThermoRows, setCustomThermoRows,
    customThermoError, setCustomThermoError,
    activeTab, setActiveTab,
    pipelineResult, setPipelineResult,
    pipelineLoading, setPipelineLoading,
    pipelineError, setPipelineError,
    tfaReactions, tfaResult, handleRunTFA,
    thermo, limitingStep, feasibilityData, fba,
    retryEquilibrator,
  } = state;

  return (
    <ToolShell
      moduleId="cethx"
      title="Cell Thermodynamics Engine"
      description={equilibratorLoaded
        ? "Condition-aware thermodynamics — eQuilibrator 3 with Alberty transform"
        : "Condition-aware thermodynamics — Pre-computed from Lehninger/NIST references with Alberty transform"
      }
      formula="ΔG' = ΔG° + RT·ln(10)·(pH-7)·nH + Debye-Hückel(Δz², I)"
      tabs={CETHX_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['feasibility']}
      hero={
        <ScientificHero
          eyebrow="Stage 2 · Condition-Aware Thermodynamics"
          title={`${PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway} with condition-aware ΔG′`}
          summary={equilibratorLoaded
            ? "CETHX uses eQuilibrator 3 (ComponentContribution) for condition-aware thermodynamic calculations with Alberty transform, Debye-Hückel ionic strength correction, and uncertainty quantification."
            : "CETHX uses pre-computed ΔG values from Lehninger/NIST references, transformed via the Alberty formalism for pH and ionic strength. Data sourced from published reference tables — no external API required."
          }
          signals={[
            {
              label: "ΔG′",
              value: `${thermo.gibbs_free_energy.toFixed(1)} kJ/mol`,
              detail: thermo.gibbs_free_energy < 0
                ? 'Thermodynamically favorable.'
                : 'Thermodynamically unfavorable.',
              tone: thermo.gibbs_free_energy < 0 ? 'cool' : 'warm'
            },
            {
              label: 'Efficiency',
              value: `${thermo.efficiency.toFixed(1)}%`,
              detail: `${thermo.atp_yield.toFixed(1)} ATP · ${thermo.nadh_yield.toFixed(1)} NADH`,
              tone: thermo.efficiency > 50 ? 'cool' : 'warm'
            },
            {
              label: 'Feasibility',
              value: feasibilityData.overallFeasible ? 'All steps feasible' : `${feasibilityData.infeasibleCount} infeasible`,
              detail: `${feasibilityData.feasibleCount} feasible · ${feasibilityData.marginalCount} marginal · ${feasibilityData.infeasibleCount} infeasible`,
              tone: feasibilityData.overallFeasible ? 'cool' : 'warm'
            },
            {
              label: 'Limiting Step',
              value: limitingStep ?? 'Pending',
              detail: 'Reaction most likely to constrain downstream choices.',
              tone: 'neutral'
            },
            {
              label: 'Conditions',
              value: `${tempC.toFixed(0)}°C · pH ${pH.toFixed(1)}`,
              detail: 'Alberty transform · Debye-Hückel I=0.25M',
              tone: 'neutral'
            },
            ...(isLoadingEquilibrator ? [{
              label: 'Status',
              value: 'Loading...',
              detail: 'Fetching eQuilibrator data',
              tone: 'neutral' as const,
            }] : []),
            {
              label: 'Source',
              value: equilibratorLoaded ? 'eQuilibrator 3' : 'Pre-computed',
              detail: equilibratorLoaded ? 'ComponentContribution with uncertainty' : 'Lehninger/NIST + Alberty transform (pre-computed)',
              tone: 'cool' as const,
            },
          ]}
        />
      }
      footer={
        <>
          <DataSourceBadge source={equilibratorLoaded ? 'live' : 'mock'} label={equilibratorLoaded ? 'eQuilibrator Live' : 'Pre-computed (Lehninger/NIST)'} />
          {fba && (
            <div role="status" style={{ padding: '6px 14px', background: `${THEME.SKY}24`, border: `1px solid ${THEME.SKY}47`, borderRadius: 'var(--nb-radius-md)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: `${THEME.SKY}38`, border: `1px solid ${THEME.SKY}57`, color: THEME.VALUE, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                FBASim
              </span>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL }}>
                {'✓ Flux data loaded — '}
                <span style={{ fontFamily: THEME.MONO, color: THEME.VALUE }}>
                  {`μ=${fba.result.growthRate.toFixed(4)} h⁻¹ · ∂μ/∂Glc=${fba.result.sensitivityCoefficients.glc.toFixed(4)} · ∂μ/∂O₂=${fba.result.sensitivityCoefficients.o2.toFixed(4)}`}
                </span>
              </span>
            </div>
          )}
          <ExportButton label="Export JSON" data={thermo} filename="cethx-thermodynamics" format="json" />
          <ExportButton label="Export CSV" data={thermo.steps} filename="cethx-steps" format="csv" />
        </>
      }
    >
      {/* ── Demo data warning ── */}
      {!isRealData && !isLoadingEquilibrator && (
        <div style={{ padding: '4px 16px' }}>
          <div style={{ padding: '4px 8px', background: 'rgba(232,220,200,0.12)', borderRadius: '4px', fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>
            Using demo data — eQuilibrator API unavailable.{' '}
            <button
              onClick={retryEquilibrator}
              style={{ background: 'none', border: 'none', color: THEME.SKY, cursor: 'pointer', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textDecoration: 'underline' }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Algorithm Transparency ── */}
      <div style={{ padding: '8px 16px' }}>
        <AlgorithmPanel
          name="Alberty Transformed Gibbs Energy"
          description="Applies the Alberty formalism to transform standard Gibbs energy (ΔG°) values from Lehninger reference tables into condition-aware ΔG′ values. Accounts for pH-dependent protonation via RT·ln(10)·(pH-7)·nH and ionic strength effects via Debye-Hückel theory: 9.205·Δz²·√I/(1+1.6·√I)."
          assumptions={[
            `Temperature: ${tempC}°C (${(tempC + 273.15).toFixed(2)} K)`,
            `pH: ${pH.toFixed(1)}`,
            'Ionic strength I = 0.25 M (physiological)',
            'Aqueous phase reactions only',
            'Proton stoichiometry estimated from KEGG reaction equations',
            'Reference ΔG° values from Lehninger/NIST tables',
            equilibratorLoaded
              ? 'Live data from eQuilibrator 3 (ComponentContribution)'
              : 'Pre-computed ΔG′ from published reference values',
          ]}
          limitations={[
            'Reference ΔG° values are at standard conditions (25°C, pH 7)',
            'Proton stoichiometry (nH) is estimated, not from measured pKa values',
            'Charge change (Δz²) is approximate',
            'Does not account for magnesium binding effects',
            'Compartment-specific ΔG′ adjustments not included',
            !equilibratorLoaded && 'Pre-computed values use fixed proton stoichiometry; eQuilibrator uses group contribution',
          ].filter(Boolean) as string[]}
          citation={{
            authors: 'Alberty RA',
            title: 'Thermodynamics of Biochemical Reactions',
            journal: 'Wiley-Interscience',
            year: 2003,
            doi: '10.1002/0471332607',
          }}
        />
      </div>

      {/* ── Waterfall Tab ── */}
      <ToolTabPanel tabId="waterfall" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Parameters" defaultCollapsed={false}>
            <div style={{ marginBottom: '16px' }}>
              {PATHWAYS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPathway(p.id)}
                  className={`nb-tool-toggle${pathway === p.id ? ' nb-tool-toggle--active' : ''}`}
                  aria-pressed={pathway === p.id}
                  aria-label={`Select ${p.label} pathway`}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', marginBottom: '4px',
                    borderRadius: 'var(--nb-radius-md)',
                  }}
                >
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 500, color: pathway === p.id ? THEME.VALUE : THEME.LABEL, display: 'block' }}>
                    {p.label}
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.DIM }}>
                    {p.desc}
                  </span>
                </button>
              ))}
            </div>
            <WorkbenchRangeSlider label="Temperature" value={tempC} min={20} max={60} step={1} unit="°C" onChange={setTempC} />
            <WorkbenchRangeSlider label="pH" value={pH} min={5.5} max={9.0} step={0.1} onChange={setPH} />

            {/* PubChem Compound Lookup */}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${THEME.BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  PubChem Lookup
                </span>
                <DataSourceBadge source={pubchemSource} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={compoundQuery}
                  onChange={e => setCompoundQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCompoundSearch(); }}
                  placeholder="Compound name (e.g. glucose)"
                  style={{
                    flex: 1, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                    color: THEME.VALUE, background: THEME.PANEL_INSET,
                    border: `1px solid ${THEME.BORDER}`, borderRadius: 6,
                    padding: '4px 6px', outline: 'none',
                  }}
                />
                <button
                  onClick={handleCompoundSearch}
                  disabled={pubchemLoading}
                  style={{
                    fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                    color: THEME.VALUE, background: 'rgba(175,195,214,0.12)',
                    border: `1px solid ${THEME.BORDER}`, borderRadius: 6,
                    padding: '4px 8px', cursor: pubchemLoading ? 'wait' : 'pointer',
                    opacity: pubchemLoading ? 0.6 : 1,
                  }}
                >
                  {pubchemLoading ? '...' : 'Fetch'}
                </button>
              </div>
              {pubchemData && pubchemData.cid > 0 && (
                <div style={{
                  marginTop: 6, padding: '6px 8px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)', border: `1px solid ${THEME.BORDER}`,
                }}>
                  <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4 }}>
                    {pubchemData.name} (CID: {pubchemData.cid})
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Formula</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>{pubchemData.formula}</span>
                  </div>
                  {pubchemData.molecularWeight > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>MW</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>{pubchemData.molecularWeight.toFixed(2)} g/mol</span>
                    </div>
                  )}
                  {pubchemData.iupacName !== 'Unknown' && (
                    <div style={{ marginTop: 2, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM, lineHeight: 1.3 }}>
                      {pubchemData.iupacName}
                    </div>
                  )}
                </div>
              )}
              {pubchemData && pubchemData.cid === 0 && (
                <p style={{ margin: '4px 0 0', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, opacity: 0.7 }}>
                  No compound found for &quot;{compoundQuery}&quot;
                </p>
              )}
            </div>

            {/* ── Custom Thermodynamic Data Upload ── */}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${THEME.BORDER}` }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Upload Thermodynamic Data
              </span>
              <div style={{ marginTop: 6 }}>
                <DataUpload
                  accept=".csv,.tsv"
                  label="Upload custom ΔG data"
                  onUpload={(rows, headers) => {
                    // Validate required columns
                    const lowerHeaders = headers.map(h => h.toLowerCase());
                    const reactionCol = lowerHeaders.findIndex(h => h === 'reaction_id' || h === 'reaction' || h === 'step');
                    const deltaGCol = lowerHeaders.findIndex(h => h === 'deltag' || h === 'delta_g' || h === 'δg' || h === 'dg');
                    if (reactionCol === -1 || deltaGCol === -1) {
                      setCustomThermoError('CSV must have reaction_id and deltaG columns');
                      return;
                    }
                    const keqCol = lowerHeaders.findIndex(h => h === 'keq' || h === 'k_eq');
                    const parsed = rows.map(row => {
                      const vals = Object.values(row);
                      return {
                        reaction: vals[reactionCol],
                        deltaG: parseFloat(vals[deltaGCol]),
                        keq: keqCol >= 0 ? parseFloat(vals[keqCol]) : undefined,
                      };
                    }).filter(d => d.reaction && !isNaN(d.deltaG));
                    if (parsed.length === 0) {
                      setCustomThermoError('No valid data rows found');
                      return;
                    }
                    setCustomThermoData(parsed);
                    setCustomThermoHeaders(headers);
                    setCustomThermoRows(rows);
                    setCustomThermoError(null);
                  }}
                  onError={(err) => setCustomThermoError(err)}
                />
              </div>
              {customThermoError && (
                <p style={{ margin: '6px 0 0', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.CORAL }}>
                  {customThermoError}
                </p>
              )}
              {customThermoData && customThermoData.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.MINT }}>
                      {customThermoData.length} custom reactions loaded
                    </span>
                    <button
                      onClick={() => { setCustomThermoData(null); setCustomThermoHeaders([]); setCustomThermoRows([]); }}
                      style={{
                        fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)',
                        color: THEME.CORAL, background: 'rgba(250,128,114,0.08)',
                        border: `1px solid rgba(250,128,114,0.2)`,
                        borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <DataPreview headers={customThermoHeaders} rows={customThermoRows} maxRows={3} />
                </div>
              )}
            </div>

            {/* ── Pipeline Section ── */}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${THEME.BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Pipeline
                </span>
                {pipelineResult && (
                  <span style={{ fontFamily: THEME.MONO, fontSize: 10, color: THEME.MINT, background: 'rgba(191,220,205,0.12)', padding: '2px 6px', borderRadius: 6 }}>
                    {pipelineResult.feasible ? 'FEASIBLE' : 'INFEASIBLE'}
                  </span>
                )}
              </div>
              <button
                onClick={async () => {
                  setPipelineLoading(true);
                  setPipelineError(null);
                  try {
                    const res = await fetch('/api/pipeline/cethx', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ pathway, tempC, pH, steps: thermo.steps }),
                    });
                    if (!res.ok) throw new Error(`Pipeline failed (${res.status})`);
                    const data = await res.json();
                    setPipelineResult(data.result);
                  } catch (err) {
                    setPipelineError(err instanceof Error ? err.message : 'Pipeline failed');
                  } finally {
                    setPipelineLoading(false);
                  }
                }}
                disabled={pipelineLoading}
                style={{
                  width: '100%', padding: '6px 14px', borderRadius: 'var(--nb-radius-sm)',
                  background: pipelineLoading ? 'rgba(255,255,255,0.04)' : 'rgba(191,220,205,0.14)',
                  border: `1px solid ${pipelineLoading ? 'rgba(255,255,255,0.08)' : 'rgba(191,220,205,0.3)'}`,
                  color: pipelineLoading ? 'rgba(255,255,255,0.35)' : 'rgba(191,220,205,0.9)',
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                  cursor: pipelineLoading ? 'wait' : 'pointer',
                }}
              >
                {pipelineLoading ? 'Running Pipeline...' : 'Run Pipeline'}
              </button>
              {pipelineError && (
                <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, margin: '6px 0 0' }}>
                  {pipelineError}
                </p>
              )}
              {pipelineResult && (
                <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(191,220,205,0.08)', border: '1px solid rgba(191,220,205,0.15)', borderRadius: 'var(--nb-radius-sm)' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>
                    {pipelineResult.totalDeltaG.toFixed(1)} kJ/mol | {pipelineResult.atpYield.toFixed(0)} ATP | {pipelineResult.efficiency.toFixed(1)}%
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginTop: 2 }}>
                    Limiting: {pipelineResult.limitingStep}
                  </div>
                </div>
              )}
            </div>
          </FloatingControlRail>

          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', background: THEME.PANEL_INSET }}>
            <ScientificFigureFrame
              eyebrow="Thermodynamic waterfall"
              title="Free-energy burden, ATP coupling, and cumulative route load"
              caption="Publication-quality waterfall showing step-by-step ΔG cascade with limiting chemistry highlighted."
              legend={[
                { label: 'Pathway', value: PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway, accent: THEME.APRICOT },
                { label: 'Window', value: `${tempC.toFixed(0)}°C / pH ${pH.toFixed(1)}`, accent: THEME.SKY },
                { label: 'Delta-G', value: `${thermo.gibbs_free_energy.toFixed(1)} kJ/mol`, accent: THEME.CORAL },
                { label: 'ATP', value: `${thermo.atp_yield.toFixed(1)}`, accent: THEME.MINT },
              ]}
              footer={
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>
                  limiting step {limitingStep ?? 'pending'} · entropy {thermo.entropy_production.toFixed(3)} · NADH {thermo.nadh_yield.toFixed(1)}
                  {!equilibratorLoaded && (
                    <span style={{ display: 'block', marginTop: '2px', color: THEME.DIM, fontStyle: 'italic' }}>
                      Uncertainty estimated at ~15% of |ΔG′| — using pre-computed reference data
                    </span>
                  )}
                </div>
              }
              minHeight="100%"
            >
              <AnimatePresence mode="wait">
                {isLoadingEquilibrator ? (
                  <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', maxWidth: '600px' }}>
                    <div style={{ display: 'grid', gap: '8px', padding: '16px' }}>
                      <div style={{ height: '14px', width: '40%', borderRadius: '4px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                      <div style={{ height: '280px', borderRadius: '12px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[1,2,3].map(i => <div key={i} style={{ height: '48px', flex: 1, borderRadius: '8px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />)}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key={pathway} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ width: '100%', maxWidth: '600px' }}>
                    <BreathingWaterfall steps={thermo.steps} />
                  </motion.div>
                )}
              </AnimatePresence>
            </ScientificFigureFrame>

            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'ΔG', value: `${thermo.gibbs_free_energy.toFixed(1)} kJ/mol`, accent: thermo.gibbs_free_energy < 0 ? THEME.MINT : THEME.CORAL },
                { label: 'ATP', value: `${thermo.atp_yield.toFixed(1)}`, accent: THEME.MINT },
                { label: 'NADH', value: `${thermo.nadh_yield.toFixed(1)}`, accent: THEME.SKY },
                { label: 'Efficiency', value: `${thermo.efficiency.toFixed(1)}%`, accent: THEME.APRICOT },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── ATP Ledger Tab ── */}
      <ToolTabPanel tabId="atp" activeId={activeTab}>
        <ATPAccounting thermo={thermo} />
      </ToolTabPanel>

      {/* ── Feasibility Tab ── */}
      <ToolTabPanel tabId="feasibility" activeId={activeTab}>
        <PathwayFeasibility
          thermo={thermo}
          pathway={pathway}
          tempC={tempC}
          pH={pH}
          limitingStep={limitingStep}
          feasibilityData={feasibilityData}
          equilibratorLoaded={equilibratorLoaded}
        />
      </ToolTabPanel>

      {/* ── TFA Tab ── */}
      <ToolTabPanel tabId="tfa" activeId={activeTab}>
        <TFAAnalysis
          tfaReactions={tfaReactions}
          tfaResult={tfaResult}
          tempC={tempC}
          pH={pH}
          handleRunTFA={handleRunTFA}
        />
      </ToolTabPanel>
    </ToolShell>
  );
});
