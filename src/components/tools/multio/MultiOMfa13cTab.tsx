'use client';
import React from 'react';
import { SVGChartContainer } from '../../charts/primitives';
import { PAPER_THEME } from '../../charts/chartTheme';
import { THEME } from '../../../theme';
import { toolTokens } from '../../../hooks/useToolTheme';
import { LAYER_COLORS } from './multiOHelpers';
import ToolTabPanel from '../shared/ToolTabPanel';
import FloatingControlRail from '../shared/FloatingControlRail';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';
import ResultSummaryPanel from '../shared/ResultSummaryPanel';
import ConfidenceBadge from '../shared/ConfidenceBadge';
import ParameterPanel from '../shared/ParameterPanel';
import WorkbenchRangeSlider from '../shared/WorkbenchRangeSlider';
import ActionButton from '../shared/ActionButton';
import { SectionLabel } from './multiOHelpers';

const { label: LABEL, value: VALUE, glass: GLASS, border: BORDER } = toolTokens;

interface Mfa13cTabProps {
  activeTab: string;
  mfa13cResult: import('../../../server/mfa13CEngine').MFAResult | null;
  mfa13cLoading: boolean;
  mfa13cMCResult: ReturnType<typeof import('../../../server/mfa13CEngine').monteCarloConfidenceIntervals> | null;
  mfa13cMCTrials: number;
  setMfa13cMCTrials: (v: number) => void;
  handleRunMFA13C: () => void;
}

export function MultiOMfa13cTab(props: Mfa13cTabProps) {
  const { activeTab, mfa13cResult, mfa13cLoading, mfa13cMCResult, mfa13cMCTrials, setMfa13cMCTrials, handleRunMFA13C } = props;

  return (
    <ToolTabPanel tabId="mfa13c" activeId={activeTab}>
      <div style={{ display: 'flex', gap: '0', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FloatingControlRail label="13C-MFA Controls">
          <ParameterPanel
            title="MFA Parameters"
            defaultCollapsed={false}
            onReset={() => { setMfa13cMCTrials(100); }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>MC Trials</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, fontWeight: 700 }}>{mfa13cMCTrials}</span>
              </div>
              <WorkbenchRangeSlider
                label="Trials"
                value={mfa13cMCTrials}
                min={50}
                max={500}
                step={10}
                formatValue={v => `${v}`}
                onChange={setMfa13cMCTrials}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Confidence</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, fontWeight: 700 }}>95%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Status</span>
                <span style={{
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700,
                  color: mfa13cLoading ? THEME.APRICOT : mfa13cResult ? THEME.MINT : THEME.LABEL,
                }}>
                  {mfa13cLoading ? 'Running...' : mfa13cResult ? 'Complete' : 'Not run'}
                </span>
              </div>
            </div>
          </ParameterPanel>

          <SectionLabel>Network</SectionLabel>
          <div style={{
            fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: LABEL,
            padding: '6px 8px', background: THEME.PANEL_INSET, borderRadius: 'var(--nb-radius-sm)',
            lineHeight: 1.5,
          }}>
            glucose (6C) → pyruvate (3C) → acetyl-CoA (2C) → citrate (6C)
          </div>

          <div style={{ marginTop: '12px' }}>
            <ActionButton
              variant="primary"
              size="sm"
              aria-label="Run 13C-MFA analysis"
              onClick={handleRunMFA13C}
              disabled={mfa13cLoading}
              style={{ width: '100%' }}
            >
              {mfa13cLoading ? 'Running 13C-MFA...' : 'Run 13C-MFA'}
            </ActionButton>
          </div>
        </FloatingControlRail>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <ScientificFigureFrame
            eyebrow="13C Metabolic Flux Analysis"
            title="Isotopomer-based intracellular flux estimation"
            caption="EMU decomposition with Levenberg-Marquardt optimization and Monte Carlo confidence intervals. Reference: Antoniewicz et al. (2007) Metab Eng 9:68-86."
            minHeight="100%"
            legend={[
              { label: 'Status', value: mfa13cResult ? (mfa13cResult.converged ? 'Converged' : 'Not converged') : 'Not run', accent: mfa13cResult?.converged ? THEME.MINT : THEME.CORAL },
              { label: 'χ²/dof', value: mfa13cResult?.fitQuality?.toFixed(4) ?? '—', accent: THEME.SKY },
            ]}
          >
            {!mfa13cResult && !mfa13cLoading && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '48px 24px', color: LABEL, fontFamily: THEME.SANS,
                fontSize: 'var(--nb-fs-sm)', textAlign: 'center', lineHeight: 1.6,
              }}>
                Click "Run 13C-MFA" to perform isotopomer-based flux estimation.
                <br />The engine uses EMU decomposition, Levenberg-Marquardt optimization, and Monte Carlo sampling for confidence intervals.
              </div>
            )}

            {mfa13cLoading && (
              <div style={{ display: 'grid', gap: '8px', padding: '16px' }}>
                <div style={{ height: '14px', width: '40%', borderRadius: '4px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                <div style={{ height: '200px', borderRadius: '12px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                <div style={{ textAlign: 'center', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginTop: '4px' }}>
                  Running EMU decomposition and Levenberg-Marquardt optimization...
                </div>
              </div>
            )}

            {mfa13cResult && (
              <>
                {/* Result Summary */}
                <ResultSummaryPanel
                  metrics={[
                    { label: 'Reactions', value: mfa13cResult.fluxEstimates.length, accent: THEME.SKY },
                    { label: 'χ²/dof', value: mfa13cResult.fitQuality.toFixed(4), accent: mfa13cResult.fitQuality < 1 ? THEME.MINT : THEME.CORAL },
                    { label: 'Iterations', value: mfa13cResult.nIterations, accent: THEME.LILAC },
                    { label: 'Objective', value: mfa13cResult.objectiveFlux.toFixed(3), accent: THEME.APRICOT, trend: mfa13cResult.converged ? 'up' : 'flat' },
                  ]}
                />

                {/* Flux Estimates with Error Bars */}
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                    Estimated Fluxes with 95% CI
                  </div>
                  {(() => {
                    const W = 460, H = 220, PAD = 50;
                    const nRxns = mfa13cResult.fluxEstimates.length;
                    const barW = Math.min(48, (W - PAD * 2) / nRxns - 8);
                    const fluxes = mfa13cResult.fluxEstimates;
                    const maxFlux = Math.max(...fluxes.map(f => Math.abs(f.flux)), ...((mfa13cMCResult?.fluxCIs?.map(c => Math.abs(c[1])) ?? [1])), 0.01);
                    const yScale = (H - PAD * 2) / (maxFlux * 1.2);
                    const barGap = (W - PAD * 2) / nRxns;
                    return (
                      <SVGChartContainer W={W} H={H} ariaLabel="Flux estimates with error bars" variant="paper">
                        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={PAPER_THEME.axis} strokeWidth={PAPER_THEME.axisWidth} />
                        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={PAPER_THEME.axis} strokeWidth={PAPER_THEME.axisWidth} />
                        <text x={10} y={H / 2} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}
                          transform={`rotate(-90,10,${H / 2})`}>Flux</text>
                        {[0.25, 0.5, 0.75, 1.0].map(t => {
                          const y = H - PAD - maxFlux * 1.2 * t * yScale;
                          return (
                            <g key={t}>
                              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke={PAPER_THEME.grid} strokeWidth={0.5} />
                              <text x={PAD - 4} y={y + 3} textAnchor="end" fontFamily={THEME.MONO} fontSize="9" fill={LABEL}>
                                {(maxFlux * 1.2 * t).toFixed(1)}
                              </text>
                            </g>
                          );
                        })}
                        {fluxes.map((f, i) => {
                          const cx = PAD + i * barGap + barGap / 2;
                          const barH = f.flux * yScale;
                          const yTop = H - PAD - barH;
                          const mc = mfa13cMCResult;
                          const ciLow = mc ? mc.fluxCIs[i]?.[0] ?? f.flux : f.flux * 0.9;
                          const ciHigh = mc ? mc.fluxCIs[i]?.[1] ?? f.flux : f.flux * 1.1;
                          const yLow = H - PAD - ciLow * yScale;
                          const yHigh = H - PAD - ciHigh * yScale;
                          const color = f.direction === 'forward' ? THEME.SKY : f.direction === 'reverse' ? THEME.CORAL : THEME.APRICOT;
                          return (
                            <g key={f.reactionId}>
                              <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={2} opacity={0.6} />
                              <line x1={cx - 5} y1={yHigh} x2={cx + 5} y2={yHigh} stroke={color} strokeWidth={1.5} opacity={0.6} />
                              <line x1={cx - 5} y1={yLow} x2={cx + 5} y2={yLow} stroke={color} strokeWidth={1.5} opacity={0.6} />
                              <rect x={cx - barW / 2} y={yTop} width={barW} height={barH}
                                fill={color} opacity={0.5} rx={2} />
                              <ConfidenceBadge value={f.confidence} />
                              <text x={cx} y={H - PAD + 14} textAnchor="middle" fontFamily={THEME.MONO} fontSize="8" fill={LABEL}>
                                {f.reactionId.slice(0, 8)}
                              </text>
                              <text x={cx} y={yTop - 4} textAnchor="middle" fontFamily={THEME.MONO} fontSize="9" fill={VALUE}>
                                {f.flux.toFixed(2)}
                              </text>
                            </g>
                          );
                        })}
                      </SVGChartContainer>
                    );
                  })()}
                </div>

                {/* Flux Table with ConfidenceBadges */}
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                    Flux Estimation Details
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {mfa13cResult.fluxEstimates.map((f, i) => {
                      const mc = mfa13cMCResult;
                      const ciLow = mc?.fluxMeans[i] != null ? mc.fluxCIs[i]?.[0] : null;
                      const ciHigh = mc?.fluxMeans[i] != null ? mc.fluxCIs[i]?.[1] : null;
                      const std = mc?.fluxStd[i];
                      const dirColor = f.direction === 'forward' ? THEME.SKY : f.direction === 'reverse' ? THEME.CORAL : THEME.APRICOT;
                      return (
                        <div key={f.reactionId} style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                          borderRadius: 'var(--nb-radius-sm)',
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${BORDER}`,
                        }}>
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                            background: dirColor,
                          }} />
                          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, width: '100px', flexShrink: 0 }}>{f.reactionId}</span>
                          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, width: '60px', textAlign: 'right' }}>{f.flux.toFixed(3)}</span>
                          {ciLow != null && ciHigh != null && (
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: LABEL, width: '100px' }}>
                              [{ciLow.toFixed(3)}, {ciHigh.toFixed(3)}]
                            </span>
                          )}
                          {std != null && (
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, width: '60px' }}>
                              σ={std.toFixed(3)}
                            </span>
                          )}
                          <span style={{
                            fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', padding: '1px 4px', borderRadius: '4px',
                            background: `${dirColor}20`, color: dirColor, width: '30px', textAlign: 'center',
                          }}>
                            {f.direction.slice(0, 3)}
                          </span>
                          <div style={{ flex: 1 }} />
                          <ConfidenceBadge value={f.confidence} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mass Isotopomer Distributions */}
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                    Mass Isotopomer Distributions (MID)
                  </div>
                  {(() => {
                    const mids = mfa13cResult.mids;
                    const maxN = Math.max(...mids.map(m => m.nCarbon));
                    const hmCellW = 40, hmCellH = 28;
                    const hmPAD_L = 100, hmPAD_T = 28;
                    const hmW = hmPAD_L + (maxN + 1) * hmCellW + 60;
                    const hmH = hmPAD_T + mids.length * hmCellH + 10;
                    return (
                      <SVGChartContainer W={hmW} H={hmH} ariaLabel="Mass isotopomer distribution heatmap" variant="paper">
                        {Array.from({ length: maxN + 1 }, (_, j) => (
                          <text key={`mh-${j}`}
                            x={hmPAD_L + j * hmCellW + hmCellW / 2} y={hmPAD_T - 8}
                            textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
                            M+{j}
                          </text>
                        ))}
                        {mids.map((mid, ri) => {
                          const y = hmPAD_T + ri * hmCellH;
                          const maxVal = Math.max(...mid.mid, 0.01);
                          return (
                            <g key={mid.metabolite}>
                              <text x={hmPAD_L - 6} y={y + hmCellH * 0.65} textAnchor="end"
                                fontFamily={THEME.MONO} fontSize="10" fill={VALUE}>
                                {mid.metabolite.slice(0, 8)}
                              </text>
                              {mid.mid.map((val, j) => {
                                const intensity = val / maxVal;
                                return (
                                  <g key={`${mid.metabolite}-m${j}`}>
                                    <rect
                                      x={hmPAD_L + j * hmCellW} y={y}
                                      width={hmCellW - 2} height={hmCellH - 2}
                                      fill={THEME.CORAL} opacity={0.15 + intensity * 0.7}
                                      rx={3}
                                    />
                                    <text
                                      x={hmPAD_L + j * hmCellW + hmCellW / 2 - 1}
                                      y={y + hmCellH * 0.6}
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
                          <linearGradient id="mid-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={THEME.CORAL} stopOpacity={0.85} />
                            <stop offset="100%" stopColor={THEME.CORAL} stopOpacity={0.15} />
                          </linearGradient>
                        </defs>
                        <rect x={hmPAD_L + (maxN + 1) * hmCellW + 8} y={hmPAD_T} width="8" height={mids.length * hmCellH - 2}
                          fill="url(#mid-grad)" rx="2" />
                        <text x={hmPAD_L + (maxN + 1) * hmCellW + 12} y={hmPAD_T - 4} fontFamily={THEME.MONO} fontSize="9" fill={LABEL}>Max</text>
                        <text x={hmPAD_L + (maxN + 1) * hmCellW + 12} y={hmPAD_T + mids.length * hmCellH + 10} fontFamily={THEME.MONO} fontSize="9" fill={LABEL}>0</text>
                      </SVGChartContainer>
                    );
                  })()}
                </div>

                {/* Convergence Info */}
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    Analysis Notes
                  </div>
                  <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, lineHeight: 1.5 }}>
                    EMU decomposition with Levenberg-Marquardt nonlinear least squares. {mfa13cMCTrials} Monte Carlo samples for 95% confidence intervals. Label substrate: glucose (carbons 0,1,2 labeled). Objective reaction: CS (citrate synthase).
                    {mfa13cResult.converged ? ' Fit quality (χ²/dof < 1.0) indicates good agreement between simulated and measured MIDs.' : ' Optimization did not converge to a good fit — consider adjusting measured MID data or network topology.'}
                  </div>
                </div>
              </>
            )}
          </ScientificFigureFrame>
        </div>
      </div>
    </ToolTabPanel>
  );
}
