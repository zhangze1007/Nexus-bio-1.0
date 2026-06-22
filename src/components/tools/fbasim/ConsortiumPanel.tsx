'use client';

import React, { useState, useCallback } from 'react';
import { THEME } from '../../../theme';
import type { Strain, ConsortiumDesign, CrossFeedingInteraction } from '../../../server/consortiumDesignEngine';

// ── Default species presets ─────────────────────────────────────────────────
const PRESET_STRAINS: Strain[] = [
  {
    id: 'ecoli',
    name: 'E. coli K-12',
    organism: 'Escherichia coli',
    growthRate: 0.69,
    monod: { muMax: 0.89, ks: 0.15, yieldCoeff: 0.48 },
    metabolites: { produces: ['acetate', 'co2'], consumes: ['glucose', 'oxygen'] },
    qsParameters: { ahlProductionRate: 1.2, ahlDegradationRate: 0.15, threshold: 5, hillCoeff: 2 },
  },
  {
    id: 'scerevisiae',
    name: 'S. cerevisiae',
    organism: 'Saccharomyces cerevisiae',
    growthRate: 0.38,
    monod: { muMax: 0.45, ks: 0.5, yieldCoeff: 0.42 },
    metabolites: { produces: ['ethanol', 'co2'], consumes: ['glucose', 'acetate'] },
    qsParameters: undefined,
  },
  {
    id: 'bsubtilis',
    name: 'B. subtilis',
    organism: 'Bacillus subtilis',
    growthRate: 0.55,
    monod: { muMax: 0.62, ks: 0.25, yieldCoeff: 0.45 },
    metabolites: { produces: ['glutamate', 'acetate'], consumes: ['glucose', 'oxygen'] },
    qsParameters: { ahlProductionRate: 0.5, ahlDegradationRate: 0.2, threshold: 8, hillCoeff: 1.5 },
  },
  {
    id: 'paeruginosa',
    name: 'P. aeruginosa',
    organism: 'Pseudomonas aeruginosa',
    growthRate: 0.48,
    monod: { muMax: 0.56, ks: 0.3, yieldCoeff: 0.38 },
    metabolites: { produces: ['rhamnolipid', 'co2'], consumes: ['glucose', 'oxygen', 'glutamate'] },
    qsParameters: { ahlProductionRate: 3.5, ahlDegradationRate: 0.1, threshold: 2, hillCoeff: 2.5 },
  },
];

const AVAILABLE_OBJECTIVES = [
  'biomass', 'acetate', 'ethanol', 'glutamate', 'rhamnolipid', 'co2',
];

// ── Sub-components ──────────────────────────────────────────────────────────

/** ConfidenceBadge: shows stability prediction confidence */
function ConfidenceBadge({ stability, eigenvalues }: { stability: ConsortiumDesign['stability']; eigenvalues: number[] }) {
  const maxEigenvalue = Math.max(...eigenvalues.map(Math.abs));
  const margin = eigenvalues.filter(e => e < 0).length === eigenvalues.length
    ? Math.abs(Math.max(...eigenvalues)) // all negative: margin to zero
    : 0;

  const label = stability === 'stable' ? 'Stable' : stability === 'unstable' ? 'Unstable' : 'Neutral';
  const confidence = stability === 'stable'
    ? Math.min(0.99, 0.5 + margin / (maxEigenvalue + 1))
    : stability === 'unstable'
      ? Math.min(0.99, 0.5 + (maxEigenvalue - margin) / (maxEigenvalue + 1))
      : 0.5;

  const color = stability === 'stable' ? THEME.MINT : stability === 'unstable' ? THEME.CORAL : THEME.APRICOT;
  const bgAlpha = stability === 'stable' ? '0.12' : stability === 'unstable' ? '0.12' : '0.1';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: color.replace(')', `,${bgAlpha})`).replace('rgb', 'rgba').startsWith('rgba') ? `${color}1a` : `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},0.12)`,
      border: `1px solid ${color}44`,
      fontFamily: THEME.MONO, fontSize: '10px', fontWeight: 600,
      color,
      letterSpacing: '0.04em',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: color,
        boxShadow: `0 0 4px ${color}88`,
      }} />
      {label} {(confidence * 100).toFixed(0)}%
    </span>
  );
}

/** ParameterPanel: consortium parameters input */
function ParameterPanel({
  selectedStrainIds,
  onToggleStrain,
  objective,
  onObjectiveChange,
  maxStrains,
  onMaxStrainsChange,
  onRun,
  loading,
}: {
  selectedStrainIds: string[];
  onToggleStrain: (id: string) => void;
  objective: string;
  onObjectiveChange: (obj: string) => void;
  maxStrains: number;
  onMaxStrainsChange: (n: number) => void;
  onRun: () => void;
  loading: boolean;
}) {
  return (
    <div>
      <p style={{
        fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.55)', margin: '0 0 8px',
      }}>
        Available Strains
      </p>
      {PRESET_STRAINS.map(s => {
        const selected = selectedStrainIds.includes(s.id);
        return (
          <button
            key={s.id}
            onClick={() => onToggleStrain(s.id)}
            className={`nb-tool-toggle ${selected ? 'nb-tool-toggle--active' : ''}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '5px 8px', marginBottom: '3px',
              background: selected ? 'rgba(207,196,227,0.12)' : undefined,
              borderColor: selected ? 'rgba(207,196,227,0.3)' : undefined,
              borderRadius: 'var(--nb-radius-sm)',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <span style={{
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                color: selected ? 'rgba(207,196,227,0.9)' : 'rgba(255,255,255,0.5)',
              }}>
                {s.name}
              </span>
              <span style={{
                display: 'block', fontFamily: THEME.SANS, fontSize: '10px',
                color: 'rgba(255,255,255,0.3)', marginTop: 1,
              }}>
                {s.organism} &middot; {'μ'}={s.monod.muMax.toFixed(2)}
              </span>
            </div>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: selected ? 'rgba(207,196,227,0.7)' : 'rgba(255,255,255,0.12)',
            }} />
          </button>
        );
      })}

      <p style={{
        fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.55)', margin: '12px 0 8px',
      }}>
        Max Strains
      </p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[2, 3, 4].map(n => (
          <button
            key={n}
            onClick={() => onMaxStrainsChange(n)}
            className={`nb-tool-toggle ${maxStrains === n ? 'nb-tool-toggle--active' : ''}`}
            style={{
              flex: 1, padding: '4px 6px', textAlign: 'center',
              background: maxStrains === n ? 'rgba(207,196,227,0.12)' : undefined,
              borderColor: maxStrains === n ? 'rgba(207,196,227,0.3)' : undefined,
              borderRadius: 'var(--nb-radius-sm)',
              fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
              color: maxStrains === n ? 'rgba(207,196,227,0.9)' : 'rgba(255,255,255,0.4)',
            }}
          >
            {n}
          </button>
        ))}
      </div>

      <p style={{
        fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.55)', margin: '12px 0 8px',
      }}>
        Community Objective
      </p>
      {AVAILABLE_OBJECTIVES.map(obj => (
        <button
          key={obj}
          onClick={() => onObjectiveChange(obj)}
          className={`nb-tool-toggle ${objective === obj ? 'nb-tool-toggle--active' : ''}`}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '4px 8px', marginBottom: '2px',
            background: objective === obj ? 'rgba(207,196,227,0.12)' : undefined,
            borderColor: objective === obj ? 'rgba(207,196,227,0.3)' : undefined,
            borderRadius: 'var(--nb-radius-sm)',
            fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
            color: objective === obj ? 'rgba(207,196,227,0.9)' : 'rgba(255,255,255,0.4)',
          }}
        >
          {obj}
        </button>
      ))}

      <button
        onClick={onRun}
        disabled={loading || selectedStrainIds.length < 2}
        style={{
          display: 'block', width: '100%', marginTop: 14,
          padding: '7px 12px', borderRadius: 'var(--nb-radius-sm)',
          background: (loading || selectedStrainIds.length < 2)
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(207,196,227,0.14)',
          border: `1px solid ${(loading || selectedStrainIds.length < 2) ? 'rgba(255,255,255,0.08)' : 'rgba(207,196,227,0.3)'}`,
          color: (loading || selectedStrainIds.length < 2)
            ? 'rgba(255,255,255,0.35)'
            : 'rgba(207,196,227,0.9)',
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)',
          fontWeight: 600, cursor: (loading || selectedStrainIds.length < 2) ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Designing Consortium...' : 'Design Consortium'}
      </button>
      {selectedStrainIds.length < 2 && (
        <p style={{
          fontFamily: THEME.SANS, fontSize: '10px',
          color: 'rgba(232,163,161,0.6)', margin: '6px 0 0', lineHeight: 1.3,
        }}>
          Select at least 2 strains for consortium design.
        </p>
      )}
    </div>
  );
}

/** ResultSummaryPanel: aggregate consortium metrics */
function ResultSummaryPanel({ design }: { design: ConsortiumDesign }) {
  const totalBiomass = design.strains.reduce((s, strain) => s + strain.growthRate, 0);
  const activeExchanges = design.interactions.filter(i => Math.abs(i.flux) > 0.001).length;
  const carbonEfficiency = design.strains.length > 0
    ? Math.min(100, (design.totalProductFlux / (totalBiomass * 0.5 + 0.001)) * 100)
    : 0;

  return (
    <div style={{
      padding: '10px 14px',
      background: 'rgba(207,196,227,0.06)',
      border: '1px solid rgba(207,196,227,0.15)',
      borderRadius: 'var(--nb-radius-sm)',
      marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
          color: THEME.LILAC, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Consortium Summary
        </span>
        <ConfidenceBadge stability={design.stability} eigenvalues={design.stabilityEigenvalues} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Species', value: String(design.strains.length), accent: THEME.LILAC },
          { label: 'Total Biomass', value: `${totalBiomass.toFixed(3)} h⁻¹`, accent: THEME.MINT },
          { label: 'Product Flux', value: `${design.totalProductFlux.toFixed(3)}`, accent: THEME.APRICOT },
          { label: 'C Efficiency', value: `${carbonEfficiency.toFixed(1)}%`, accent: carbonEfficiency > 50 ? THEME.MINT : THEME.CORAL },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: THEME.MONO, fontSize: '10px',
              color: 'rgba(217,225,235,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {m.label}
            </div>
            <div style={{
              fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)',
              fontWeight: 600, color: m.accent, marginTop: 2,
            }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

interface ConsortiumPanelProps {
  onResult?: (design: ConsortiumDesign | null) => void;
}

export default function ConsortiumPanel({ onResult }: ConsortiumPanelProps) {
  const [selectedStrainIds, setSelectedStrainIds] = useState<string[]>(['ecoli', 'scerevisiae']);
  const [objective, setObjective] = useState('biomass');
  const [maxStrains, setMaxStrains] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [design, setDesign] = useState<ConsortiumDesign | null>(null);

  const toggleStrain = useCallback((id: string) => {
    setSelectedStrainIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }, []);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { optimizeConsortium } = await import('../../../server/consortiumDesignEngine');
      const strains = PRESET_STRAINS.filter(s => selectedStrainIds.includes(s.id));
      const result = await optimizeConsortium(strains, objective, maxStrains);
      setDesign(result);
      onResult?.(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Consortium design failed';
      setError(msg);
      setDesign(null);
      onResult?.(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStrainIds, objective, maxStrains, onResult]);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Control Rail */}
      <div style={{
        width: 240, flexShrink: 0, overflow: 'auto',
        padding: '12px 14px',
        borderRight: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_MUTED,
      }}>
        <ParameterPanel
          selectedStrainIds={selectedStrainIds}
          onToggleStrain={toggleStrain}
          objective={objective}
          onObjectiveChange={setObjective}
          maxStrains={maxStrains}
          onMaxStrainsChange={setMaxStrains}
          onRun={handleRun}
          loading={loading}
        />
      </div>

      {/* Results Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: 12,
            borderRadius: 'var(--nb-radius-sm)',
            border: '1px solid rgba(232,163,161,0.3)',
            background: 'rgba(232,163,161,0.08)',
            fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
            color: 'rgba(232,163,161,0.85)',
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{
            padding: '8px 12px', marginBottom: 12,
            borderRadius: 'var(--nb-radius-md)',
            border: '1px solid rgba(207,196,227,0.22)',
            background: 'rgba(207,196,227,0.08)',
            color: 'rgba(240,245,255,0.78)',
            fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
          }}>
            Running SteadyCom LP optimization, QS simulation, and Jacobian stability analysis...
          </div>
        )}

        {design && <ResultSummaryPanel design={design} />}

        {design && (
          <>
            {/* Species Abundances */}
            <div style={{ marginBottom: 16 }}>
              <p style={{
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.55)', margin: '0 0 8px',
              }}>
                Species Abundances
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {design.strains.map((strain, i) => (
                  <div key={strain.id} style={{
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    borderRadius: 'var(--nb-radius-sm)',
                  }}>
                    <div style={{
                      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                      color: THEME.LILAC, fontWeight: 600, marginBottom: 4,
                    }}>
                      {strain.name}
                    </div>
                    <div style={{
                      fontFamily: THEME.SANS, fontSize: '10px',
                      color: 'rgba(217,225,235,0.45)', marginBottom: 6,
                    }}>
                      {strain.organism}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: 'rgba(217,225,235,0.55)' }}>
                        Growth Rate
                      </span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.VALUE, fontWeight: 600 }}>
                        {strain.growthRate.toFixed(3)} h⁻¹
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: 'rgba(217,225,235,0.55)' }}>
                        {'μ'}max
                      </span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.VALUE }}>
                        {strain.monod.muMax.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: 'rgba(217,225,235,0.55)' }}>
                        Ks
                      </span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.VALUE }}>
                        {strain.monod.ks.toFixed(2)} g/L
                      </span>
                    </div>
                    {/* Abundance bar */}
                    <div style={{
                      marginTop: 6, height: 3,
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 2,
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${Math.min(100, (strain.growthRate / design.communityGrowthRate) * 100)}%`,
                        background: THEME.LILAC,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Exchange Fluxes */}
            <div style={{ marginBottom: 16 }}>
              <p style={{
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.55)', margin: '0 0 8px',
              }}>
                Exchange Fluxes
              </p>
              {design.interactions.length === 0 ? (
                <p style={{
                  fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                  color: 'rgba(217,225,235,0.35)', padding: '12px', textAlign: 'center',
                }}>
                  No cross-feeding interactions detected.
                </p>
              ) : (
                <table style={{
                  width: '100%', borderCollapse: 'collapse',
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {['Producer', 'Consumer', 'Metabolite', 'Flux (mmol/gDW/h)', 'Benefit'].map(h => (
                        <th key={h} style={{
                          padding: '6px 8px', textAlign: 'left',
                          color: 'rgba(217,225,235,0.55)', fontWeight: 500,
                          textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {design.interactions.map((ixn, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '5px 8px', color: 'rgba(250,246,240,0.7)' }}>
                          {ixn.producer}
                        </td>
                        <td style={{ padding: '5px 8px', color: 'rgba(250,246,240,0.7)' }}>
                          {ixn.consumer}
                        </td>
                        <td style={{ padding: '5px 8px' }}>
                          <span style={{
                            padding: '1px 6px', borderRadius: 3,
                            background: 'rgba(207,196,227,0.1)',
                            border: '1px solid rgba(207,196,227,0.2)',
                            color: 'rgba(207,196,227,0.85)',
                            fontSize: 'var(--nb-fs-xxs)',
                          }}>
                            {ixn.metabolite}
                          </span>
                        </td>
                        <td style={{
                          padding: '5px 8px', textAlign: 'right',
                          color: ixn.flux > 0 ? 'rgba(191,220,205,0.85)' : 'rgba(232,163,161,0.7)',
                        }}>
                          {ixn.flux.toFixed(3)}
                        </td>
                        <td style={{
                          padding: '5px 8px', textAlign: 'right',
                          color: ixn.benefit > 0 ? 'rgba(191,220,205,0.7)' : 'rgba(217,225,235,0.4)',
                        }}>
                          {ixn.benefit.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Stability Eigenvalues */}
            <div style={{ marginBottom: 16 }}>
              <p style={{
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.55)', margin: '0 0 8px',
              }}>
                Stability Eigenvalues
              </p>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6,
              }}>
                {design.stabilityEigenvalues.map((ev, i) => (
                  <span key={i} style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--nb-radius-sm)',
                    background: ev < 0 ? 'rgba(191,220,205,0.08)' : 'rgba(232,163,161,0.08)',
                    border: `1px solid ${ev < 0 ? 'rgba(191,220,205,0.2)' : 'rgba(232,163,161,0.2)'}`,
                    fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                    color: ev < 0 ? 'rgba(191,220,205,0.85)' : 'rgba(232,163,161,0.85)',
                    fontWeight: 600,
                  }}>
                    {'λ'}{i + 1} = {ev.toFixed(3)}
                  </span>
                ))}
              </div>
              <p style={{
                fontFamily: THEME.SANS, fontSize: '10px',
                color: 'rgba(217,225,235,0.35)', margin: '6px 0 0', lineHeight: 1.4,
              }}>
                May (1972): community stable iff all eigenvalues have negative real parts.
                Computed via QR algorithm (Golub & Van Loan 2013).
              </p>
            </div>

            {/* Quorum Sensing */}
            <div style={{ marginBottom: 16 }}>
              <p style={{
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.55)', margin: '0 0 8px',
              }}>
                Quorum Sensing Status
              </p>
              <div style={{
                padding: '8px 12px',
                background: design.quorumSensingActive
                  ? 'rgba(191,220,205,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${design.quorumSensingActive
                  ? 'rgba(191,220,205,0.15)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 'var(--nb-radius-sm)',
              }}>
                <div style={{
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)',
                  color: design.quorumSensingActive ? THEME.MINT : 'rgba(217,225,235,0.45)',
                  fontWeight: 600,
                }}>
                  {design.quorumSensingActive ? 'QS ACTIVE' : 'QS INACTIVE'}
                </div>
                <p style={{
                  fontFamily: THEME.SANS, fontSize: '10px',
                  color: 'rgba(217,225,235,0.4)', margin: '4px 0 0', lineHeight: 1.4,
                }}>
                  {design.quorumSensingActive
                    ? 'LuxI/LuxR system thresholds exceeded. Community communication is active.'
                    : 'Below quorum threshold. No inter-species signaling detected.'}
                </p>
              </div>
            </div>

            {/* Design Notes */}
            <div>
              <p style={{
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.55)', margin: '0 0 8px',
              }}>
                Design Notes
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {design.designNotes.map((note, i) => (
                  <li key={i} style={{
                    padding: '4px 0',
                    fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                    color: 'rgba(217,225,235,0.6)', lineHeight: 1.5,
                    borderBottom: i < design.designNotes.length - 1
                      ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {!design && !loading && !error && (
          <div style={{
            padding: '32px', textAlign: 'center',
            color: 'rgba(217,225,235,0.35)', fontFamily: THEME.SANS,
            fontSize: 'var(--nb-fs-sm)',
          }}>
            Select strains, set parameters, and click "Design Consortium" to run
            SteadyCom community FBA with quorum sensing and stability analysis.
          </div>
        )}
      </div>
    </div>
  );
}
