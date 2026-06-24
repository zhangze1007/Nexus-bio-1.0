'use client';
import React from 'react';
import MetricCard from '../../ide/shared/MetricCard';
import SimErrorBanner from '../../ide/shared/SimErrorBanner';
import type {
  DBTLIteration,
  FeedbackLoopResult,
  QCFlag,
  NextIterationSuggestion,
  GibsonAssemblyPlan,
  ProvenanceRecord,
} from '../../../types';
import type { LearnedDeltaPack } from '../../../types/learnedDelta';
import { THEME } from '../../../theme';
import ActionButton from '../shared/ActionButton';
import { PHASE_PASTEL, sectionLabel } from './sharedComponents';

/* ── Props ── */
interface CycleTabRightProps {
  displayIterations: DBTLIteration[];
  bestIteration: DBTLIteration;
  improvementRate: string;
  passRate: string;
  feedbackLoading: boolean;
  feedbackError: string | null;
  feedbackResult: FeedbackLoopResult | null;
  handleCSVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  learnedDeltaPacks: LearnedDeltaPack[];
  approveDeltaPack: (id: string) => void;
  rejectDeltaPack: (id: string) => void;
  assemblyProvenance: ProvenanceRecord[];
}

export default function CycleTabRight({
  displayIterations,
  bestIteration,
  improvementRate,
  passRate,
  feedbackLoading,
  feedbackError,
  feedbackResult,
  handleCSVUpload,
  learnedDeltaPacks,
  approveDeltaPack,
  rejectDeltaPack,
  assemblyProvenance,
}: CycleTabRightProps) {
  return (
    <div className="nb-tool-right" style={{
      width: '260px', flexShrink: 0, padding: '16px',
      borderLeft: `1px solid ${THEME.paperBorder}`, background: THEME.sepiaPanelMuted,
    }}>
      {/* Campaign Summary (preserved) */}
      <p style={sectionLabel}>Campaign Summary</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <MetricCard label="Total Iterations" value={displayIterations.length} highlight />
        <MetricCard label="Best Titer" value={bestIteration?.result ?? 0} unit={bestIteration?.unit} />
        <MetricCard label="Avg Improvement" value={improvementRate} unit={bestIteration?.unit + '/cycle'} />
        <MetricCard label="Pass Rate" value={passRate} unit="%" />
      </div>

      {/* ── Automation Control Center ── */}
      <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', padding: '14px' }}>
        <p style={{ ...sectionLabel, margin: '0 0 10px' }}>Automation Control Center</p>

        {/* CSV Upload drop zone */}
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '14px 8px',
          borderRadius: 'var(--nb-radius-md)',
          border: `2px dashed ${THEME.paperBorderStrong}`,
          background: THEME.paperSurfaceMuted,
          cursor: 'pointer',
          marginBottom: '12px',
          transition: 'border-color 0.2s',
        }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, marginBottom: '4px' }}>
            {feedbackLoading ? '⏳ Processing…' : '↑ Upload Test CSV'}
          </span>
          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
            .csv with assay metadata, units, instrument, operator
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            style={{ display: 'none' }}
          />
        </label>

        {feedbackError && (
          <div style={{ marginBottom: '12px' }}>
            <SimErrorBanner message={feedbackError} />
          </div>
        )}

        {/* Feedback Results */}
        {feedbackResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Test Summary */}
            <div style={{
              padding: '10px', borderRadius: 'var(--nb-radius-md)',
              background: THEME.paperSurfaceMuted,
              border: `1px solid ${THEME.paperBorder}`,
            }}>
              <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                Test Summary
              </p>
              {([
                ['Mean Yield', feedbackResult.test_summary.mean_yield.toFixed(2)],
                ['Std Dev', feedbackResult.test_summary.std_yield.toFixed(2)],
                ['Best Sample', feedbackResult.test_summary.best_sample],
                ['Worst Sample', feedbackResult.test_summary.worst_sample],
              ] as const).map(([lbl, val]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>{lbl}</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, textAlign: 'right' }}>{val}</span>
                </div>
              ))}
            </div>

            {/* QC Flags */}
            {feedbackResult.qc_flags.length > 0 && (
              <div>
                <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                  QC Flags ({feedbackResult.qc_flags.length})
                </p>
                {feedbackResult.qc_flags.map((flag: QCFlag, idx: number) => (
                  <div key={idx} style={{
                    padding: '8px', borderRadius: 'var(--nb-radius-sm)', marginBottom: '6px',
                    background: flag.flag_type === 'sensor_anomaly'
                      ? 'rgba(231,199,169,0.18)'
                      : 'rgba(232,163,161,0.18)',
                    border: `1px solid ${flag.flag_type === 'sensor_anomaly'
                      ? 'rgba(231,199,169,0.34)'
                      : 'rgba(232,163,161,0.34)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PHASE_PASTEL.Build }}>
                        {flag.flag_type === 'sensor_anomaly' ? '⚠' : '◆'} {flag.sample_id}
                      </span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, textAlign: 'right' }}>
                        {flag.measured_value.toFixed(1)} / {flag.theoretical_max.toFixed(1)}
                      </span>
                    </div>
                    <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0, lineHeight: 1.3 }}>
                      {flag.message}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Next Iteration Suggestions */}
            {feedbackResult.next_iteration_suggestions.length > 0 && (
              <div>
                <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                  Suggested Next Iteration
                </p>
                {feedbackResult.next_iteration_suggestions.map((s: NextIterationSuggestion, idx: number) => (
                  <div key={idx} style={{
                    padding: '8px', borderRadius: 'var(--nb-radius-sm)', marginBottom: '6px',
                    background: 'rgba(191,220,205,0.18)',
                    border: '1px solid rgba(191,220,205,0.34)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: PHASE_PASTEL.Learn, fontWeight: 500 }}>
                        {s.parameter}
                      </span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, textAlign: 'right' }}>
                        +{s.predicted_improvement_percent.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
                        {s.current_value}
                      </span>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>→</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, textAlign: 'right' }}>
                        {s.suggested_value}
                      </span>
                    </div>
                    <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0, lineHeight: 1.3 }}>
                      {s.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Optimization Objective */}
            <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0, textAlign: 'center' }}>
              objective: {feedbackResult.optimization_objective}
            </p>
          </div>
        )}
      </div>

      {/* ── Delta Pack Approval Gate ── */}
      {learnedDeltaPacks.length > 0 && (
        <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', padding: '14px', marginTop: '16px' }}>
          <p style={{ ...sectionLabel, margin: '0 0 10px' }}>
            Delta Pack Approval Gate
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {learnedDeltaPacks.map((pack) => {
              const statusColor = pack.humanGateStatus === 'approved'
                ? THEME.mint
                : pack.humanGateStatus === 'rejected'
                  ? THEME.coral
                  : THEME.apricot;
              const statusBg = pack.humanGateStatus === 'approved'
                ? 'rgba(158,215,199,0.18)'
                : pack.humanGateStatus === 'rejected'
                  ? 'rgba(232,163,161,0.18)'
                  : 'rgba(231,199,169,0.18)';
              const statusBorder = pack.humanGateStatus === 'approved'
                ? 'rgba(158,215,199,0.34)'
                : pack.humanGateStatus === 'rejected'
                  ? 'rgba(232,163,161,0.34)'
                  : 'rgba(231,199,169,0.34)';
              const entryCount = Object.keys(pack.changedBounds).length
                + Object.keys(pack.changedPriors).length
                + Object.keys(pack.changedWeights).length;
              return (
                <div
                  key={pack.deltaPackId}
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--nb-radius-md)',
                    background: statusBg,
                    border: `1px solid ${statusBorder}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, fontWeight: 600 }}>
                      Iteration #{pack.iteration} Delta Pack
                    </span>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '999px',
                        border: `1px solid ${statusBorder}`,
                        background: statusBg,
                        color: statusColor,
                        fontFamily: THEME.MONO,
                        fontSize: 'var(--nb-fs-xs)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {pack.humanGateStatus}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>Classification</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>{pack.classification}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>Target tools</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>{pack.targetToolIds.join(', ')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>Delta entries</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>{entryCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>Sources</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>{pack.sourceExperimentRecordIds.length} record(s)</span>
                    </div>
                  </div>

                  {pack.notes && (
                    <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: '0 0 8px', lineHeight: 1.3 }}>
                      {pack.notes}
                    </p>
                  )}

                  {pack.humanGateStatus === 'pending' && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <ActionButton
                        variant="primary"
                        size="sm"
                        aria-label={`Approve delta pack for iteration ${pack.iteration}`}
                        onClick={() => approveDeltaPack(pack.deltaPackId)}
                        style={{ flex: 1 }}
                      >
                        Approve
                      </ActionButton>
                      <ActionButton
                        variant="destructive"
                        size="sm"
                        aria-label={`Reject delta pack for iteration ${pack.iteration}`}
                        onClick={() => rejectDeltaPack(pack.deltaPackId)}
                        style={{ flex: 1 }}
                      >
                        Reject
                      </ActionButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Provenance Tracker ── */}
      {assemblyProvenance.length > 0 && (
        <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', padding: '14px', marginTop: '16px' }}>
          <p style={{ ...sectionLabel, margin: '0 0 10px' }}>
            Data Provenance ({assemblyProvenance.length} records)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {assemblyProvenance.map(p => {
              const tc: Record<string, string> = {
                fragment: THEME.mint,
                primer: THEME.sky,
                assembly: THEME.lilac,
                transformant: THEME.coral,
                culture: THEME.apricot,
              };
              const clr = tc[p.sampleType] ?? THEME.paperValue;
              return (
                <div key={p.uuid} style={{ padding: '8px', borderRadius: 'var(--nb-radius-sm)', background: THEME.paperSurfaceMuted, border: `1px solid ${THEME.paperBorder}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: clr }}>{p.sampleType.toUpperCase()}</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textAlign: 'right' }}>
                      {p.well ? 'Well ' + p.well : ''}{p.slot ? ' · Slot ' + p.slot : ''}
                    </span>
                  </div>
                  <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, margin: '0 0 2px', lineHeight: 1.3 }}>{p.label}</p>
                  <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0 }}>{p.uuid}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
