'use client';
/**
 * StrainDesign.tsx — Strain Design tab content (FSEOF + OptKnock + Pipeline).
 * Extracted from FBASimPage.tsx for modularity.
 */

import React from 'react';
import SimErrorBanner from '../../ide/shared/SimErrorBanner';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';
import { THEME } from '../../../theme';
import type { FBASimState } from './useFBASimState';

type StrainDesignProps = Pick<FBASimState,
  | 'fseofResult'
  | 'optknockResult'
  | 'strainDesignLoading'
  | 'strainDesignError' | 'setStrainDesignError'
  | 'pipelineResult'
  | 'pipelineLoading'
  | 'pipelineError'
  | 'loadedReactions'
  | 'loadedObjectiveId'
  | 'handleRunFSEOF'
  | 'handleRunOptKnock'
  | 'handleRunPipeline'
  | 'handleSendToProEvol'
>;

export default function StrainDesignTab(props: StrainDesignProps) {
  const {
    fseofResult, optknockResult,
    strainDesignLoading, strainDesignError, setStrainDesignError,
    pipelineResult, pipelineLoading, pipelineError,
    loadedReactions, loadedObjectiveId,
    handleRunFSEOF, handleRunOptKnock, handleRunPipeline, handleSendToProEvol,
  } = props;

  return (
    <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, overflow: 'auto', padding: '12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* ── Strain Design Pipeline ── */}
        <div style={{ marginBottom: 12, padding: '12px', border: `1px solid ${THEME.BORDER}`, borderRadius: 'var(--nb-radius-md)', background: THEME.PANEL_SURFACE }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Strain Design Pipeline
            </span>
            {pipelineResult && (
              <span style={{ fontFamily: THEME.MONO, fontSize: 10, color: THEME.MINT, background: 'rgba(191,220,205,0.12)', padding: '2px 6px', borderRadius: 6 }}>
                ✓ {pipelineResult.paretoFront.length} Pareto designs
              </span>
            )}
          </div>
          <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, margin: '0 0 8px' }}>
            Run full strain design: FSEOF + OptKnock (Heuristic LP) → FBA evaluation → Pareto ranking
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRunPipeline}
              disabled={pipelineLoading}
              style={{
                padding: '6px 14px', borderRadius: 'var(--nb-radius-sm)',
                background: pipelineLoading ? 'rgba(255,255,255,0.04)' : 'rgba(191,220,205,0.14)',
                border: `1px solid ${pipelineLoading ? 'rgba(255,255,255,0.08)' : 'rgba(191,220,205,0.3)'}`,
                color: pipelineLoading ? 'rgba(255,255,255,0.35)' : 'rgba(191,220,205,0.9)',
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                cursor: pipelineLoading ? 'wait' : 'pointer',
              }}
            >
              {pipelineLoading ? 'Running Pipeline...' : 'Run Strain Design'}
            </button>
            {pipelineResult?.bestDesign && (
              <button
                onClick={handleSendToProEvol}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--nb-radius-sm)',
                  background: 'rgba(175,195,214,0.12)',
                  border: '1px solid rgba(175,195,214,0.25)',
                  color: 'rgba(175,195,214,0.9)',
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                  cursor: 'pointer',
                }}
              >
                Send to ProEvol →
              </button>
            )}
          </div>
          {pipelineError && (
            <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, margin: '8px 0 0' }}>
              {pipelineError}
            </p>
          )}
          {pipelineResult?.bestDesign && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(191,220,205,0.08)', border: '1px solid rgba(191,220,205,0.15)', borderRadius: 'var(--nb-radius-sm)' }}>
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(191,220,205,0.7)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Best Design
              </p>
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: 'rgba(250,246,240,0.9)', margin: '4px 0 0' }}>
                Growth: {pipelineResult.bestDesign.growthRate?.toFixed(4) ?? 'N/A'} h⁻¹ | Product: {pipelineResult.bestDesign.productFlux?.toFixed(4) ?? 'N/A'} | Burden: {(pipelineResult.bestDesign.growthFractionOfWT * 100).toFixed(1)}%
              </p>
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, margin: '4px 0 0' }}>
                {pipelineResult.bestDesign.strategy.description}
              </p>
            </div>
          )}
        </div>

        {strainDesignError && <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={strainDesignError} onRetry={() => setStrainDesignError(null)} /></div>}

        <ScientificFigureFrame
          eyebrow="FSEOF — Flux Scanning based on Enforced Objective Flux"
          title="Overexpression Targets"
          caption="FSEOF identifies gene overexpression targets by scanning flux changes as the enforced product flux increases from zero to its maximum. Reactions with monotonically increasing flux are candidate overexpression targets."
          legend={[
            { label: 'Objective', value: loadedObjectiveId || 'BIOMASS', accent: THEME.APRICOT },
            { label: 'Model', value: loadedReactions ? `${loadedReactions.length} rxns` : 'iJO1366 subset', accent: THEME.SKY },
          ]}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={handleRunFSEOF}
              disabled={strainDesignLoading || !loadedReactions}
              title={!loadedReactions ? 'Load a BiGG model first — FSEOF requires stoichiometric data' : undefined}
              className="nb-tool-toggle nb-tool-toggle--active"
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--nb-radius-sm)',
                background: (strainDesignLoading || !loadedReactions) ? 'rgba(255,255,255,0.04)' : 'rgba(191,220,205,0.14)',
                borderColor: (strainDesignLoading || !loadedReactions) ? 'rgba(255,255,255,0.08)' : 'rgba(191,220,205,0.3)',
                color: (strainDesignLoading || !loadedReactions) ? 'rgba(255,255,255,0.35)' : 'rgba(191,220,205,0.9)',
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                cursor: (strainDesignLoading || !loadedReactions) ? 'not-allowed' : 'pointer',
              }}
            >
              {strainDesignLoading ? 'Running...' : !loadedReactions ? 'Load BiGG Model First' : 'Run FSEOF'}
            </button>
          </div>

          {fseofResult ? (
            <div style={{ overflow: 'auto' }}>
              {fseofResult.wildType && (
                <div style={{
                  padding: '8px 12px', marginBottom: '12px',
                  background: 'rgba(191,220,205,0.08)',
                  border: '1px solid rgba(191,220,205,0.15)',
                  borderRadius: 'var(--nb-radius-sm)',
                }}>
                  <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(191,220,205,0.7)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Wild-Type Baseline
                  </p>
                  <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: 'rgba(250,246,240,0.9)', margin: '4px 0 0' }}>
                    Growth: {fseofResult.wildType.growthRate?.toFixed(4) ?? 'N/A'} h⁻¹ | Product Flux: {fseofResult.wildType.productFlux?.toFixed(4) ?? 'N/A'} mmol/gDW/h
                  </p>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(217,225,235,0.68)', fontWeight: 500 }}>Reaction</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(217,225,235,0.68)', fontWeight: 500 }}>Flux @ Min</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(217,225,235,0.68)', fontWeight: 500 }}>Flux @ Max</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(217,225,235,0.68)', fontWeight: 500 }}>Monotonicity</th>
                  </tr>
                </thead>
                <tbody>
                  {(fseofResult.targets ?? []).map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '5px 8px', color: 'rgba(250,246,240,0.85)' }}>{t.reactionId}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'rgba(250,246,240,0.6)' }}>{t.fluxAtMin.toFixed(3)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'rgba(191,220,205,0.85)' }}>{t.fluxAtMax.toFixed(3)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          background: t.monotonicity >= 0.8 ? 'rgba(191,220,205,0.15)' : t.monotonicity >= 0.5 ? 'rgba(231,199,169,0.15)' : 'rgba(232,163,161,0.15)',
                          color: t.monotonicity >= 0.8 ? 'rgba(191,220,205,0.9)' : t.monotonicity >= 0.5 ? 'rgba(231,199,169,0.9)' : 'rgba(232,163,161,0.9)',
                        }}>
                          {t.monotonicity.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              padding: '24px', textAlign: 'center',
              color: 'rgba(217,225,235,0.35)', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)',
            }}>
              Click "Run FSEOF" to scan for overexpression targets.
            </div>
          )}
        </ScientificFigureFrame>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <ScientificFigureFrame
          eyebrow="OptKnock — Heuristic LP Approximation"
          title="Knockout Strategies"
          caption="Inspired by Burgard et al. (2003). This implementation uses sequential LP enumeration with post-hoc coupling verification — NOT a true bilevel MILP reformulation. Results are heuristic suggestions; optimality is not guaranteed for large candidate sets."
          legend={[
            { label: 'Max Knockouts', value: '3', accent: THEME.CORAL },
            { label: 'Model', value: loadedReactions ? `${loadedReactions.length} rxns` : 'iJO1366 subset', accent: THEME.SKY },
          ]}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={handleRunOptKnock}
              disabled={strainDesignLoading || !loadedReactions}
              title={!loadedReactions ? 'Load a BiGG model first — OptKnock requires stoichiometric data' : undefined}
              className="nb-tool-toggle nb-tool-toggle--active"
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--nb-radius-sm)',
                background: (strainDesignLoading || !loadedReactions) ? 'rgba(255,255,255,0.04)' : 'rgba(232,163,161,0.14)',
                borderColor: (strainDesignLoading || !loadedReactions) ? 'rgba(255,255,255,0.08)' : 'rgba(232,163,161,0.3)',
                color: (strainDesignLoading || !loadedReactions) ? 'rgba(255,255,255,0.35)' : 'rgba(232,163,161,0.9)',
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                cursor: (strainDesignLoading || !loadedReactions) ? 'not-allowed' : 'pointer',
              }}
            >
              {strainDesignLoading ? 'Running...' : !loadedReactions ? 'Load BiGG Model First' : 'Run OptKnock (Heuristic)'}
            </button>
          </div>

          {optknockResult ? (
            <div style={{ overflow: 'auto' }}>
              {optknockResult.wildType && (
                <div style={{
                  padding: '8px 12px', marginBottom: '12px',
                  background: 'rgba(232,163,161,0.08)',
                  border: '1px solid rgba(232,163,161,0.15)',
                  borderRadius: 'var(--nb-radius-sm)',
                }}>
                  <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(232,163,161,0.7)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Wild-Type Baseline
                  </p>
                  <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: 'rgba(250,246,240,0.9)', margin: '4px 0 0' }}>
                    Growth: {optknockResult.wildType.growthRate?.toFixed(4) ?? 'N/A'} h⁻¹ | Product Flux: {optknockResult.wildType.productFlux?.toFixed(4) ?? 'N/A'} mmol/gDW/h
                  </p>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(217,225,235,0.68)', fontWeight: 500 }}>#</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(217,225,235,0.68)', fontWeight: 500 }}>Knockout Set</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(217,225,235,0.68)', fontWeight: 500 }}>Growth (h⁻¹)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(217,225,235,0.68)', fontWeight: 500 }}>Product Flux</th>
                  </tr>
                </thead>
                <tbody>
                  {(optknockResult.strategies ?? []).map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '5px 8px', color: 'rgba(250,246,240,0.5)' }}>{i + 1}</td>
                      <td style={{ padding: '5px 8px' }}>
                        {(s.knockouts ?? []).map((ko, j) => (
                          <span key={j} style={{
                            display: 'inline-block',
                            padding: '1px 5px',
                            marginRight: j < (s.knockouts ?? []).length - 1 ? '3px' : 0,
                            background: 'rgba(232,163,161,0.12)',
                            border: '1px solid rgba(232,163,161,0.2)',
                            borderRadius: '3px',
                            color: 'rgba(232,163,161,0.85)',
                            fontSize: 'var(--nb-fs-xxs)',
                          }}>
                            {ko}
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'rgba(191,220,205,0.85)' }}>{s.growthRate.toFixed(4)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'rgba(231,199,169,0.85)' }}>{s.productFlux.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              padding: '24px', textAlign: 'center',
              color: 'rgba(217,225,235,0.35)', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)',
            }}>
              Click "Run OptKnock (Heuristic)" to find knockout strategies that couple growth to product formation. Results are approximate — not guaranteed optimal.
            </div>
          )}
        </ScientificFigureFrame>
      </div>
    </div>
  );
}
