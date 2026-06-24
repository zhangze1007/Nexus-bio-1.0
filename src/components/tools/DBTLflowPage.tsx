'use client';
import React from 'react';
import { INITIAL_ITERATIONS } from '../../data/mockDBTL';
import { THEME } from '../../theme';
import ScientificHero from './shared/ScientificHero';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import DataSourceBadge from '../ide/shared/DataSourceBadge';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';

/* ── Sub-components ── */
import { useDBTLState } from './dbtlflow/useDBTLState';
import { PHASE_PASTEL } from './dbtlflow/sharedComponents';
import CycleTabSidebar from './dbtlflow/CycleTabSidebar';
import CycleTabCenter from './dbtlflow/CycleTabCenter';
import CycleTabRight from './dbtlflow/CycleTabRight';
import IterationWaterfall from './dbtlflow/IterationWaterfall';
import ProtocolPanel from './dbtlflow/ProtocolPanel';
import DeltaPackPanel from './dbtlflow/DeltaPackPanel';
import GibsonAssemblyPanel from './dbtlflow/GibsonAssemblyPanel';
import ClosedLoopDBTLPanel from './dbtlflow/ClosedLoopDBTLPanel';

/* ── Main Page Component ── */
export default function DBTLflowPage() {
  const s = useDBTLState();

  /* ── Render ── */
  return (
    <ToolShell
      moduleId="dbtlflow"
      title="DBTL Cycle Tracker"
      description="Design-Build-Test-Learn cycle management with protocol generation and SBOL export"
      formula="Cycle: D→B→T→L→D'"
      tabs={s.tabs}
      activeTab={s.activeTab}
      onTabChange={s.setActiveTab}
      advancedTabIds={['protocol', 'deltapack', 'gibson']}
    >
      {s.dbtlError && (
        <div style={{ padding: '0 0 8px' }}><SimErrorBanner message={s.dbtlError} onRetry={() => s.setDbtlError(null)} /></div>
      )}

      {/* ═══════ CYCLE TAB ═══════ */}
      <ToolTabPanel activeId={s.activeTab} tabId="cycle">
        <div style={{ padding: '0 16px 4px' }}>
          <ScientificHero
            eyebrow="Stage 4 · Test, Learn, Reseed"
            title="Closed-loop iteration is now an explicit governed object"
            summary="DBTLflow is no longer just a list of experiments. It is the workbench's decision gate: draft learning stays visible, committed learning becomes canonical, and approved typed deltas are required before upstream reseeding."
            aside={
              <>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current loop status
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.value, fontWeight: 700 }}>
                  {s.hasCommittedFeedback ? 'Committed learn loop is active' : 'Draft learn loop awaiting commit'}
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.label, lineHeight: 1.55 }}>
                  {s.feedbackGateLabel}
                </div>
              </>
            }
            signals={[
              {
                label: 'Current Phase',
                value: s.currentPhase,
                detail: `${s.displayIterations.length} total recorded iterations in the visible cycle.`,
                tone: 'neutral',
              },
              {
                label: 'Pass Rate',
                value: `${s.passRate}%`,
                detail: `Committed pass rate ${s.committedPassRate}% across the canonical reviewable record.`,
                tone: Number(s.passRate) >= 70 ? 'cool' : 'warm',
              },
              {
                label: 'Best Result',
                value: `${s.bestIteration.result} ${s.bestIteration.unit}`,
                detail: s.bestIteration.hypothesis,
                tone: 'cool',
              },
              {
                label: 'Improvement Velocity',
                value: `${s.improvementRate}/${s.unit}`,
                detail: s.hasCommittedFeedback ? 'Approved typed deltas are still required before seed builders can apply changes.' : 'Learning is still visible, but not yet cleared for upstream reseeding.',
                tone: s.hasCommittedFeedback ? 'warm' : 'alert',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 6px' }}>
          <div
            style={{
              borderRadius: 'var(--nb-radius-md)',
              border: `1px solid ${s.hasCommittedFeedback ? 'rgba(158,215,199,0.22)' : 'rgba(255,192,128,0.24)'}`,
              background: s.hasCommittedFeedback ? 'rgba(158,215,199,0.10)' : 'rgba(255,192,128,0.08)',
              padding: '8px 10px',
              display: 'grid',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Closed-loop gate
              </span>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '999px',
                  border: `1px solid ${s.hasCommittedFeedback ? 'rgba(158,215,199,0.3)' : 'rgba(255,192,128,0.3)'}`,
                  background: s.hasCommittedFeedback ? 'rgba(158,215,199,0.16)' : 'rgba(255,192,128,0.14)',
                  color: s.hasCommittedFeedback ? 'rgba(224,244,238,0.92)' : 'rgba(255,219,180,0.92)',
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {s.hasCommittedFeedback ? 'Feedback Applied' : 'Awaiting Commit'}
              </span>
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.45 }}>
              {s.feedbackGateLabel}
            </div>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, lineHeight: 1.4 }}>
              committed pass rate {s.committedPassRate}% · committed improvement {s.committedImprovementRate} · latest committed phase {s.latestCommittedIteration?.phase ?? 'Design'}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 4px' }}>
          <ScientificMethodStrip
            label="Campaign bench"
            items={[
              {
                title: 'Draft iteration',
                detail: 'Hypothesis, result, and pass/fail stay editable on the left so the next cycle enters the record with explicit context instead of becoming anonymous row data.',
                accent: THEME.apricot,
                note: `phase ${s.currentPhase}`,
              },
              {
                title: 'Governed figure',
                detail: 'Progress ring, phase legend, and iteration timeline are merged into one figure frame so experimental history reads like a ledger panel, not a utility dashboard.',
                accent: THEME.sky,
                note: `${s.displayIterations.length} visible iterations`,
              },
              {
                title: 'Reseeding gate',
                detail: 'Automation, provenance, and feedback remain attached on the right so only governed learn output can return upstream.',
                accent: THEME.mint,
                note: s.hasCommittedFeedback ? 'committed feedback live' : 'draft feedback only',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 6px' }}>
          <div
            style={{
              borderRadius: 'var(--nb-radius-md)',
              border: `1px solid ${s.activityTone === 'error'
                ? 'rgba(232,163,161,0.34)'
                : s.draftIteration
                  ? 'rgba(175,195,214,0.32)'
                  : 'rgba(191,220,205,0.32)'}`,
              background: s.activityTone === 'error'
                ? 'rgba(232,163,161,0.10)'
                : s.draftIteration
                  ? 'rgba(175,195,214,0.10)'
                  : 'rgba(191,220,205,0.10)',
              padding: '8px 10px',
              display: 'grid',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Draft + action status
              </span>
              {s.draftIteration && (
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: '1px solid rgba(175,195,214,0.34)',
                    background: 'rgba(175,195,214,0.16)',
                    color: THEME.paperValue,
                    fontFamily: THEME.MONO,
                    fontSize: 'var(--nb-fs-xs)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Previewing draft iteration #{s.draftIteration.id}
                </span>
              )}
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.45 }}>
              {s.activityMessage
                ?? (s.draftIteration
                  ? `The figure and campaign cards are previewing your current draft at ${s.draftIteration.result.toFixed(1)} ${s.draftIteration.unit} before commit.`
                  : 'Commit a new iteration or generate a protocol to create a visible experimental artifact.')}
            </div>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
              {s.draftIteration
                ? `${s.draftIteration.phase} preview · ${s.draftIteration.passed ? 'pass' : 'fail'} gate · commit required for canonical history`
                : 'canonical history updates only after + Add Iteration'}
            </div>
          </div>
        </div>

        <div className="nb-tool-panels" style={{ flex: 1 }}>
          <CycleTabSidebar
            iterations={s.iterations}
            hypothesis={s.hypothesis}
            setHypothesis={s.setHypothesis}
            result={s.result}
            setResult={s.setResult}
            unit={s.unit}
            setUnit={s.setUnit}
            passed={s.passed}
            setPassed={s.setPassed}
            addIteration={s.addIteration}
            bestIteration={s.bestIteration}
            generatedProtocol={s.generatedProtocol}
            protocolExpanded={s.protocolExpanded}
            setProtocolExpanded={s.setProtocolExpanded}
            handleGenerateProtocol={s.handleGenerateProtocol}
            handleDownloadProtocol={s.handleDownloadProtocol}
            latestIteration={s.latestIteration}
            sbolDoc={s.sbolDoc}
            sbolValidation={s.sbolValidation}
            handleSBOLExport={s.handleSBOLExport}
            handleDownloadSBOL={s.handleDownloadSBOL}
            assemblyPlan={s.assemblyPlan}
            assemblyExpanded={s.assemblyExpanded}
            setAssemblyExpanded={s.setAssemblyExpanded}
            assemblyError={s.assemblyError}
            seqInput={s.seqInput}
            setSeqInput={s.setSeqInput}
            handlePlanAssembly={s.handlePlanAssembly}
            handleDownloadPrimers={s.handleDownloadPrimers}
            handleGenerateGibsonProtocol={s.handleGenerateGibsonProtocol}
            liveDraft={s.liveDraft}
          />
          <CycleTabCenter
            displayIterations={s.displayIterations}
            currentPhase={s.currentPhase}
            passRate={s.passRate}
            bestIteration={s.bestIteration}
            hasCommittedFeedback={s.hasCommittedFeedback}
            figureMeta={s.figureMeta}
            latestIteration={s.latestIteration}
          />
          <CycleTabRight
            displayIterations={s.displayIterations}
            bestIteration={s.bestIteration}
            improvementRate={s.improvementRate}
            passRate={s.passRate}
            feedbackLoading={s.feedbackLoading}
            feedbackError={s.feedbackError}
            feedbackResult={s.feedbackResult}
            handleCSVUpload={s.handleCSVUpload}
            learnedDeltaPacks={s.learnedDeltaPacks}
            approveDeltaPack={s.approveDeltaPack}
            rejectDeltaPack={s.rejectDeltaPack}
            assemblyProvenance={s.assemblyProvenance}
          />
        </div>
      </ToolTabPanel>

      {/* ═══════ ITERATIONS TAB ═══════ */}
      <ToolTabPanel activeId={s.activeTab} tabId="iterations">
        <IterationWaterfall displayIterations={s.displayIterations} />
      </ToolTabPanel>

      {/* ═══════ PROTOCOL TAB ═══════ */}
      <ToolTabPanel activeId={s.activeTab} tabId="protocol">
        <ProtocolPanel
          generatedProtocol={s.generatedProtocol}
          handleGenerateProtocol={s.handleGenerateProtocol}
          handleDownloadProtocol={s.handleDownloadProtocol}
          latestIteration={s.latestIteration}
          sbolDoc={s.sbolDoc}
          sbolValidation={s.sbolValidation}
          handleSBOLExport={s.handleSBOLExport}
          handleDownloadSBOL={s.handleDownloadSBOL}
        />
      </ToolTabPanel>

      {/* ═══════ DELTA PACK TAB ═══════ */}
      <ToolTabPanel activeId={s.activeTab} tabId="deltapack">
        <DeltaPackPanel
          computedDeltaPacks={s.computedDeltaPacks}
          learnedDeltaPacks={s.learnedDeltaPacks}
          approveDeltaPack={s.approveDeltaPack}
          rejectDeltaPack={s.rejectDeltaPack}
          assemblyProvenance={s.assemblyProvenance}
        />
      </ToolTabPanel>

      {/* ═══════ GIBSON ASSEMBLY TAB ═══════ */}
      <ToolTabPanel activeId={s.activeTab} tabId="gibson">
        <GibsonAssemblyPanel
          assemblyPlan={s.assemblyPlan}
          assemblyError={s.assemblyError}
          seqInput={s.seqInput}
          setSeqInput={s.setSeqInput}
          handlePlanAssembly={s.handlePlanAssembly}
        />
      </ToolTabPanel>

      {/* ── Closed-Loop DBTL Tab ──────────────────────────────────────────── */}
      <ToolTabPanel activeId={s.activeTab} tabId="closedloop">
        <ClosedLoopDBTLPanel />
      </ToolTabPanel>

      {/* ═══════ Footer: Export ═══════ */}
      <div style={{
        borderTop: `1px solid ${THEME.BORDER}`, padding: '8px 16px',
        display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, background: THEME.PANEL_MUTED,
      }}>
        <DataSourceBadge source={s.iterations.length > INITIAL_ITERATIONS.length ? 'live' : 'mock'} label={s.iterations.length > INITIAL_ITERATIONS.length ? 'User Data' : 'Demo Data'} />
        <ExportButton label="Export JSON" data={s.displayIterations} filename="dbtlflow-iterations" format="json" />
        <ExportButton label="Export CSV" data={s.displayIterations} filename="dbtlflow-iterations" format="csv" />
      </div>
    </ToolShell>
  );
}
