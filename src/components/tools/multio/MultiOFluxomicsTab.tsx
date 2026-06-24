'use client';
import React from 'react';
import { SVGChartContainer } from '../../charts/primitives';
import { THEME } from '../../../theme';
import { toolTokens } from '../../../hooks/useToolTheme';
import type { FluxomicsResult } from '../../../modules/fluxomics/types';
import { LAYER_COLORS, divergingColor } from './multiOHelpers';
import ToolTabPanel from '../shared/ToolTabPanel';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';
import ActionButton from '../shared/ActionButton';
import ConfidenceBadge from '../shared/ConfidenceBadge';

const { label: LABEL, value: VALUE, glass: GLASS, border: BORDER } = toolTokens;

interface FluxomicsTabProps {
  activeTab: string;
  fluxomicsResult: FluxomicsResult | null;
  fluxomicsLoading: boolean;
  handleRunFluxomics: () => void;
}

export function MultiOFluxomicsTab(props: FluxomicsTabProps) {
  const { activeTab, fluxomicsResult, fluxomicsLoading, handleRunFluxomics } = props;

  return (
    <ToolTabPanel tabId="fluxomics" activeId={activeTab}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        <ScientificFigureFrame
          eyebrow="13C-MFA Fluxomics"
          title="Metabolic flux estimation with transcriptomics correlation"
          caption="13C Metabolic Flux Analysis integrated with gene expression data to identify flux-expression correlations, metabolic bottlenecks, and efficiency metrics. Reference: Zamboni (2011) Annu Rev Biochem 80:291."
          minHeight="100%"
          legend={[
            { label: 'Status', value: fluxomicsResult ? 'Complete' : 'Not run', accent: fluxomicsResult ? THEME.MINT : THEME.DIM },
            { label: 'Bottlenecks', value: `${fluxomicsResult?.bottlenecks.filter(b => b.isBottleneck).length ?? 0}`, accent: THEME.CORAL },
          ]}
        >
          {/* Run button */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <ActionButton
              variant="primary"
              size="sm"
              aria-label="Run fluxomics analysis"
              onClick={handleRunFluxomics}
              disabled={fluxomicsLoading}
              style={{ minWidth: '160px' }}
            >
              {fluxomicsLoading ? 'Running 13C-MFA...' : 'Run Fluxomics'}
            </ActionButton>
            {fluxomicsResult && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>
                  Carbon eff:
                </span>
                <ConfidenceBadge value={fluxomicsResult.efficiency.carbonEfficiency} label="Carbon" />
              </div>
            )}
          </div>

          {!fluxomicsResult && !fluxomicsLoading && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '48px 24px', color: LABEL, fontFamily: THEME.SANS,
              fontSize: 'var(--nb-fs-sm)', textAlign: 'center', lineHeight: 1.6,
            }}>
              Click "Run Fluxomics" to perform 13C-MFA flux estimation and correlation with transcriptomics data.
              <br />The analysis identifies metabolic bottlenecks and computes carbon/oxygen/ATP efficiency metrics.
            </div>
          )}

          {fluxomicsLoading && (
            <div style={{ display: 'grid', gap: '8px', padding: '16px' }}>
              <div style={{ height: '14px', width: '40%', borderRadius: '4px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              <div style={{ height: '200px', borderRadius: '12px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
              <div style={{ textAlign: 'center', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginTop: '4px' }}>
                Running 13C-MFA flux estimation and correlation analysis...
              </div>
            </div>
          )}

          {fluxomicsResult && (
            <>
              {/* Summary metrics */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Correlations</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: THEME.SKY }}>{fluxomicsResult.correlations.length}</span>
                </div>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Significant</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: THEME.MINT }}>{fluxomicsResult.correlations.filter(c => c.significant).length}</span>
                </div>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Bottlenecks</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: THEME.CORAL }}>{fluxomicsResult.bottlenecks.filter(b => b.isBottleneck).length}</span>
                </div>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Carbon Eff.</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: THEME.APRICOT }}>{(fluxomicsResult.efficiency.carbonEfficiency * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Efficiency Metrics */}
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Metabolic Efficiency
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Carbon', value: fluxomicsResult.efficiency.carbonEfficiency, color: THEME.MINT },
                    { label: 'Oxygen', value: fluxomicsResult.efficiency.oxygenEfficiency / 10, color: THEME.SKY },
                    { label: 'ATP', value: fluxomicsResult.efficiency.atpEfficiency, color: THEME.APRICOT },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ flex: '1 0 100px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{label}</span>
                        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{(value * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: THEME.PANEL_INSET }}>
                        <div style={{ width: `${Math.min(100, value * 100)}%`, height: '100%', borderRadius: '3px', background: color, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottleneck Reactions */}
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Bottleneck Analysis
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {fluxomicsResult.bottlenecks.slice(0, 12).map(b => (
                    <div key={b.reactionId} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                      borderRadius: 'var(--nb-radius-sm)',
                      background: b.isBottleneck ? 'rgba(232,163,161,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${b.isBottleneck ? 'rgba(232,163,161,0.2)' : BORDER}`,
                    }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                        background: b.isBottleneck ? THEME.CORAL : b.utilization < 0.2 ? THEME.DIM : THEME.MINT,
                      }} />
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, width: '120px', flexShrink: 0 }}>{b.reactionId}</span>
                      <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: THEME.PANEL_INSET }}>
                        <div style={{ width: `${Math.min(100, b.utilization * 100)}%`, height: '100%', borderRadius: '3px', background: b.isBottleneck ? THEME.CORAL : THEME.SKY }} />
                      </div>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, width: '40px', textAlign: 'right' }}>{(b.utilization * 100).toFixed(0)}%</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, width: '60px', textAlign: 'right' }}>flux: {b.flux.toFixed(2)}</span>
                      {b.isBottleneck && <ConfidenceBadge value={1 - b.utilization} thresholds={{ high: 0.5, low: 0.2 }} />}
                    </div>
                  ))}
                </div>
                {fluxomicsResult.bottlenecks.some(b => b.isBottleneck) && (
                  <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: 'var(--nb-radius-sm)', background: 'rgba(191,220,205,0.06)', border: '1px solid rgba(191,220,205,0.15)' }}>
                    <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.MINT, fontWeight: 600, marginBottom: '4px' }}>Recommendations</div>
                    {fluxomicsResult.bottlenecks.filter(b => b.isBottleneck).map(b => (
                      <div key={b.reactionId} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, lineHeight: 1.4, padding: '2px 0' }}>
                        {b.recommendation}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Flux-Expression Correlations */}
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Flux-Expression Correlations
                </div>
                {(() => {
                  const sigCorrs = fluxomicsResult.correlations.filter(c => c.significant);
                  const topCorrs = sigCorrs.length > 0 ? sigCorrs : fluxomicsResult.correlations.slice(0, 20);
                  if (topCorrs.length === 0) return (
                    <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, padding: '12px', textAlign: 'center' }}>
                      No correlations computed. Provide gene expression data to enable flux-expression analysis.
                    </div>
                  );
                  const cellW = 48, cellH = 32;
                  const hmPAD_L = 100, hmPAD_T = 28;
                  const reactions = [...new Set(topCorrs.map(c => c.reactionId))];
                  const genes = [...new Set(topCorrs.map(c => c.geneId))];
                  const hmW = hmPAD_L + genes.length * cellW + 60;
                  const hmH = hmPAD_T + reactions.length * cellH + 10;
                  const corrMap = new Map<string, number>();
                  topCorrs.forEach(c => corrMap.set(`${c.reactionId}|${c.geneId}`, c.correlation));
                  return (
                    <SVGChartContainer W={hmW} H={hmH} ariaLabel="Flux-expression correlation heatmap" variant="paper">
                      {genes.map((g, gi) => (
                        <text key={`gl-${gi}`}
                          x={hmPAD_L + gi * cellW + cellW / 2} y={hmPAD_T - 8}
                          textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
                          {g.replace('R_', '').slice(0, 6)}
                        </text>
                      ))}
                      {reactions.map((rxn, ri) => {
                        const y = hmPAD_T + ri * cellH;
                        return (
                          <g key={rxn}>
                            <text x={hmPAD_L - 6} y={y + cellH * 0.65} textAnchor="end"
                              fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
                              {rxn.replace('R_', '').slice(0, 8)}
                            </text>
                            {genes.map((gene, gi) => {
                              const r = corrMap.get(`${rxn}|${gene}`) ?? 0;
                              return (
                                <g key={`${rxn}-${gene}`}>
                                  <rect
                                    x={hmPAD_L + gi * cellW} y={y}
                                    width={cellW - 2} height={cellH - 2}
                                    fill={divergingColor(r)}
                                    rx={3}
                                  />
                                  <text
                                    x={hmPAD_L + gi * cellW + cellW / 2 - 1}
                                    y={y + cellH * 0.6}
                                    textAnchor="middle" fontFamily={THEME.MONO} fontSize="9"
                                    fill={Math.abs(r) > 0.5 ? '#fff' : VALUE}>
                                    {r.toFixed(2)}
                                  </text>
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}
                      <defs>
                        <linearGradient id="flux-corr-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={divergingColor(1)} />
                          <stop offset="50%" stopColor={divergingColor(0)} />
                          <stop offset="100%" stopColor={divergingColor(-1)} />
                        </linearGradient>
                      </defs>
                      <rect x={hmPAD_L + genes.length * cellW + 8} y={hmPAD_T} width="8" height={reactions.length * cellH - 2}
                        fill="url(#flux-corr-grad)" rx="2" />
                      <text x={hmPAD_L + genes.length * cellW + 12} y={hmPAD_T - 4} fontFamily={THEME.MONO} fontSize="9" fill={LABEL}>+1</text>
                      <text x={hmPAD_L + genes.length * cellW + 12} y={hmPAD_T + reactions.length * cellH + 10} fontFamily={THEME.MONO} fontSize="9" fill={LABEL}>-1</text>
                    </SVGChartContainer>
                  );
                })()}
              </div>

              {/* Design Notes */}
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  Analysis Notes
                </div>
                {fluxomicsResult.designNotes.map((note, i) => (
                  <div key={i} style={{
                    fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL,
                    padding: '3px 0', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none', lineHeight: 1.4,
                  }}>
                    {note}
                  </div>
                ))}
              </div>
            </>
          )}
        </ScientificFigureFrame>
      </div>
    </ToolTabPanel>
  );
}
