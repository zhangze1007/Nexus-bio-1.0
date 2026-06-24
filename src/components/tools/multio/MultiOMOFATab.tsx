'use client';
import React from 'react';
import { SVGChartContainer } from '../../charts/primitives';
import { SCI_SERIES } from '../../charts/chartTheme';
import { THEME } from '../../../theme';
import { toolTokens } from '../../../hooks/useToolTheme';
import type { OmicsRow, OmicsLayer } from '../../../types';
import type { MOFAResult as MOFAPlusResultType } from '../../../server/mofaPlus';
import { LAYER_COLORS } from './multiOHelpers';
import ToolTabPanel from '../shared/ToolTabPanel';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';
import ActionButton from '../shared/ActionButton';

const { label: LABEL, value: VALUE, glass: GLASS, border: BORDER } = toolTokens;

interface MOFATabProps {
  activeTab: string;
  activeData: OmicsRow[];
  mofaPlusResult: MOFAPlusResultType | null;
  mofaPlusLoading: boolean;
  handleRunMOFA: () => void;
  pipelineResult: { topFactors: number; varianceExplained: number; dominantView: string; keyGenes: string[]; converged: boolean } | null;
  setPipelineResult: (v: MOFATabProps['pipelineResult']) => void;
  pipelineLoading: boolean;
  setPipelineLoading: (v: boolean) => void;
  pipelineError: string | null;
  setPipelineError: (v: string | null) => void;
  fcThreshold: number;
  pvThreshold: number;
  activeLayers: Record<OmicsLayer, boolean>;
}

export function MultiOMOFATab(props: MOFATabProps) {
  const {
    activeTab, activeData, mofaPlusResult, mofaPlusLoading, handleRunMOFA,
    pipelineResult, setPipelineResult, pipelineLoading, setPipelineLoading, pipelineError, setPipelineError,
    fcThreshold, pvThreshold, activeLayers,
  } = props;

  return (
    <ToolTabPanel tabId="mofaplus" activeId={activeTab}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        <ScientificFigureFrame
          eyebrow="MOFA+ Variational Bayes"
          title="Multi-omics factor analysis via coordinate ascent variational inference"
          caption="ARD-penalized factor decomposition across transcriptomics, proteomics, and metabolomics views. Reference: Argelaguet et al. (2020) Mol Syst Biol 16:e9918."
          minHeight="100%"
          legend={[
            { label: 'Status', value: mofaPlusResult ? (mofaPlusResult.converged ? 'Converged' : 'Max iter') : 'Not run', accent: mofaPlusResult?.converged ? THEME.MINT : THEME.CORAL },
            { label: 'Factors', value: `${mofaPlusResult?.factors[0]?.length ?? 0}`, accent: THEME.SKY },
          ]}
        >
          {/* Run button */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <ActionButton
              variant="primary"
              size="sm"
              aria-label="Run MOFA+ factor analysis"
              onClick={handleRunMOFA}
              disabled={mofaPlusLoading}
              style={{ minWidth: '160px' }}
            >
              {mofaPlusLoading ? 'Running MOFA+...' : 'Run MOFA+'}
            </ActionButton>
            <button
              onClick={async () => {
                setPipelineLoading(true);
                setPipelineError(null);
                try {
                  const res = await fetch('/api/pipeline/multio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      data: activeData.map(r => ({ gene: r.gene, transcript: r.transcript, protein: r.protein, metabolite: r.metabolite, foldChange: r.fold_change, pValue: r.pValue })),
                      nFactors: 5,
                      fcThreshold,
                      pvThreshold,
                    }),
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
                padding: '6px 14px', borderRadius: 'var(--nb-radius-sm)',
                background: pipelineLoading ? 'rgba(255,255,255,0.04)' : 'rgba(191,220,205,0.14)',
                border: `1px solid ${pipelineLoading ? 'rgba(255,255,255,0.08)' : 'rgba(191,220,205,0.3)'}`,
                color: pipelineLoading ? 'rgba(255,255,255,0.35)' : 'rgba(191,220,205,0.9)',
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                cursor: pipelineLoading ? 'wait' : 'pointer',
              }}
            >
              {pipelineLoading ? 'Running Pipeline...' : 'Run Pipeline'}
            </button>
          </div>
          {pipelineError && (
            <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, margin: '0 0 12px' }}>
              {pipelineError}
            </p>
          )}
          {pipelineResult && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(191,220,205,0.08)', border: '1px solid rgba(191,220,205,0.15)', borderRadius: 'var(--nb-radius-sm)' }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>
                {pipelineResult.topFactors} factors | {(pipelineResult.varianceExplained * 100).toFixed(1)}% var | {pipelineResult.dominantView}
              </div>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginTop: 2 }}>
                Key genes: {pipelineResult.keyGenes.join(', ')}
              </div>
            </div>
          )}

          {!mofaPlusResult && !mofaPlusLoading && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '48px 24px', color: LABEL, fontFamily: THEME.SANS,
              fontSize: 'var(--nb-fs-sm)', textAlign: 'center', lineHeight: 1.6,
            }}>
              Click "Run MOFA+" to perform variational Bayes factor analysis across all three omics views.
              <br />The model uses ARD priors for sparsity and coordinate ascent for inference.
            </div>
          )}

          {mofaPlusLoading && (
            <div style={{ display: 'grid', gap: '8px', padding: '16px' }}>
              <div style={{ height: '14px', width: '40%', borderRadius: '4px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              <div style={{ height: '200px', borderRadius: '12px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              <div style={{ textAlign: 'center', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginTop: '4px' }}>
                Running variational Bayes inference...
              </div>
            </div>
          )}

          {mofaPlusResult && (
            <>
              {/* Summary metrics */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Converged</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: mofaPlusResult.converged ? THEME.MINT : THEME.CORAL }}>
                    {mofaPlusResult.converged ? 'Yes' : 'No'}
                  </span>
                </div>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Iterations</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: VALUE }}>{mofaPlusResult.iterations}</span>
                </div>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Factors</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: THEME.SKY }}>{mofaPlusResult.factors[0]?.length ?? 0}</span>
                </div>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Samples</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: VALUE }}>{mofaPlusResult.factors.length}</span>
                </div>
              </div>

              {/* Variance Explained per view (bar chart) */}
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Variance Explained per View
                </div>
                {(() => {
                  const viewNames = Object.keys(mofaPlusResult.varianceExplained);
                  const barH = 18;
                  const gapY = 28;
                  const chartH = viewNames.length * gapY + 40;
                  const chartW = 400;
                  const PAD_L = 100;
                  const PAD_R = 30;
                  const barAreaW = chartW - PAD_L - PAD_R;
                  const totalPerView = viewNames.map(vn =>
                    mofaPlusResult.varianceExplained[vn].reduce((s, r2) => s + r2, 0)
                  );
                  const maxVar = Math.max(...totalPerView, 0.01);
                  return (
                    <SVGChartContainer W={chartW} H={chartH} ariaLabel="Variance explained per view" variant="paper">
                      {viewNames.map((vn, vi) => {
                        const total = totalPerView[vi];
                        const barW = (total / maxVar) * barAreaW;
                        const y = 20 + vi * gapY;
                        const viewColor = vn === 'transcriptomics' ? LAYER_COLORS.transcriptomics
                          : vn === 'proteomics' ? LAYER_COLORS.proteomics
                          : LAYER_COLORS.metabolomics;
                        return (
                          <g key={vn}>
                            <text x={PAD_L - 6} y={y + barH * 0.75} textAnchor="end"
                              fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
                              {vn.slice(0, 8)}
                            </text>
                            <rect x={PAD_L} y={y} width={barAreaW} height={barH}
                              fill={THEME.PANEL_INSET} rx={3} />
                            <rect x={PAD_L} y={y} width={Math.max(0, barW)} height={barH}
                              fill={viewColor} opacity={0.75} rx={3} />
                            <text x={PAD_L + barW + 6} y={y + barH * 0.75}
                              fontFamily={THEME.MONO} fontSize="10" fill={VALUE}>
                              {(total * 100).toFixed(1)}%
                            </text>
                          </g>
                        );
                      })}
                      {viewNames.map((vn, vi) => {
                        const y = 20 + vi * gapY;
                        let xOffset = 0;
                        return mofaPlusResult.varianceExplained[vn].map((r2, fi) => {
                          const segW = (r2 / maxVar) * barAreaW;
                          const x = PAD_L + xOffset;
                          xOffset += segW;
                          return (
                            <rect key={`${vn}-f${fi}`}
                              x={x} y={y} width={Math.max(0, segW)} height={barH}
                              fill={SCI_SERIES[fi % SCI_SERIES.length]}
                              opacity={0.2} rx={fi === 0 ? 3 : 0}
                            />
                          );
                        });
                      })}
                    </SVGChartContainer>
                  );
                })()}
              </div>

              {/* Factor Loadings Heatmap (view x factor) */}
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Factor Loadings Heatmap (View x Factor)
                </div>
                {(() => {
                  const viewNames = Object.keys(mofaPlusResult.loadings);
                  const nFactors = mofaPlusResult.factors[0]?.length ?? 0;
                  const meanLoadings: number[][] = viewNames.map(vn => {
                    const W = mofaPlusResult.loadings[vn];
                    const nf = W.length;
                    return Array.from({ length: nFactors }, (_, fi) => {
                      let sum = 0;
                      for (let j = 0; j < nf; j++) sum += Math.abs(W[j]?.[fi] ?? 0);
                      return nf > 0 ? sum / nf : 0;
                    });
                  });
                  const allVals = meanLoadings.flat();
                  const maxL = Math.max(...allVals, 0.01);
                  const cellW = 48;
                  const cellH = 36;
                  const hmPAD_L = 100;
                  const hmPAD_T = 28;
                  const hmW = hmPAD_L + nFactors * cellW + 60;
                  const hmH = hmPAD_T + viewNames.length * cellH + 10;
                  return (
                    <SVGChartContainer W={hmW} H={hmH} ariaLabel="Factor loadings heatmap" variant="paper">
                      {Array.from({ length: nFactors }, (_, fi) => (
                        <text key={`fl-${fi}`}
                          x={hmPAD_L + fi * cellW + cellW / 2} y={hmPAD_T - 8}
                          textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
                          F{fi + 1}
                        </text>
                      ))}
                      {viewNames.map((vn, vi) => {
                        const y = hmPAD_T + vi * cellH;
                        const viewColor = vn === 'transcriptomics' ? LAYER_COLORS.transcriptomics
                          : vn === 'proteomics' ? LAYER_COLORS.proteomics
                          : LAYER_COLORS.metabolomics;
                        return (
                          <g key={vn}>
                            <text x={hmPAD_L - 6} y={y + cellH * 0.65} textAnchor="end"
                              fontFamily={THEME.MONO} fontSize="10" fill={viewColor}>
                              {vn.slice(0, 8)}
                            </text>
                            {meanLoadings[vi].map((val, fi) => {
                              const intensity = val / maxL;
                              return (
                                <g key={`${vn}-${fi}`}>
                                  <rect
                                    x={hmPAD_L + fi * cellW} y={y}
                                    width={cellW - 2} height={cellH - 2}
                                    fill={viewColor} opacity={0.15 + intensity * 0.7}
                                    rx={3}
                                  />
                                  <text
                                    x={hmPAD_L + fi * cellW + cellW / 2 - 1}
                                    y={y + cellH * 0.6}
                                    textAnchor="middle" fontFamily={THEME.MONO} fontSize="9"
                                    fill={intensity > 0.5 ? '#fff' : VALUE}>
                                    {val.toFixed(3)}
                                  </text>
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}
                      <defs>
                        <linearGradient id="mofa-load-grad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={THEME.SKY} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={THEME.SKY} stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <rect x={hmPAD_L + nFactors * cellW + 8} y={hmPAD_T} width="8" height={viewNames.length * cellH - 2}
                        fill="url(#mofa-load-grad)" rx="2" />
                      <text x={hmPAD_L + nFactors * cellW + 12} y={hmPAD_T - 4} fontFamily={THEME.MONO} fontSize="9" fill={LABEL}>0</text>
                      <text x={hmPAD_L + nFactors * cellW + 12} y={hmPAD_T + viewNames.length * cellH + 10} fontFamily={THEME.MONO} fontSize="9" fill={LABEL}>{maxL.toFixed(2)}</text>
                    </SVGChartContainer>
                  );
                })()}
              </div>

              {/* Top contributing features per factor */}
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Top Contributing Features per Factor
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(() => {
                    const viewNames = Object.keys(mofaPlusResult.loadings);
                    const nFactors = mofaPlusResult.factors[0]?.length ?? 0;
                    const geneNames = activeData.map(r => r.gene);
                    return Array.from({ length: nFactors }, (_, fi) => {
                      const topFeatures: { gene: string; view: string; loading: number }[] = [];
                      for (const vn of viewNames) {
                        const W = mofaPlusResult.loadings[vn];
                        for (let j = 0; j < W.length; j++) {
                          const loading = Math.abs(W[j]?.[fi] ?? 0);
                          if (j < geneNames.length) {
                            topFeatures.push({ gene: geneNames[j], view: vn, loading });
                          }
                        }
                      }
                      topFeatures.sort((a, b) => b.loading - a.loading);
                      const top5 = topFeatures.slice(0, 5);
                      const viewColor = (vn: string) => vn === 'transcriptomics' ? LAYER_COLORS.transcriptomics
                        : vn === 'proteomics' ? LAYER_COLORS.proteomics
                        : LAYER_COLORS.metabolomics;
                      return (
                        <div key={`factor-${fi}`} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: '8px' }}>
                          <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 600, color: VALUE, marginBottom: '6px' }}>
                            Factor {fi + 1}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {top5.map((f, idx) => (
                              <span key={`${f.gene}-${f.view}-${idx}`} style={{
                                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                                padding: '3px 8px', borderRadius: '6px',
                                background: `${viewColor(f.view)}1A`,
                                color: viewColor(f.view),
                                border: `1px solid ${viewColor(f.view)}33`,
                              }}>
                                {f.gene} <span style={{ opacity: 0.6 }}>({f.view.slice(0, 4)})</span> {f.loading.toFixed(3)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </>
          )}
        </ScientificFigureFrame>
      </div>
    </ToolTabPanel>
  );
}
