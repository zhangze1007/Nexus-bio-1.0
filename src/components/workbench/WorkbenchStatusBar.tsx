'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, BookOpenText, BrainCircuit, Layers3, Microscope, Workflow, X } from 'lucide-react';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import {
  CROSS_STAGE_TOOL_IDS,
  getDefaultHrefForStage,
  getNextToolIds,
  getStageById,
  getStageForTool,
  WORKBENCH_STAGES,
  type WorkbenchStageId,
} from '../tools/shared/workbenchConfig';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import WorkbenchAuditTimeline from './WorkbenchAuditTimeline';
import WorkbenchDecisionTracePanel from './WorkbenchDecisionTracePanel';
import WorkbenchEvidenceTracePanel from './WorkbenchEvidenceTracePanel';
import WorkbenchExperimentLedger from './WorkbenchExperimentLedger';
import WorkbenchProjectTimeline from './WorkbenchProjectTimeline';
import WorkbenchRunCompare from './WorkbenchRunCompare';
import { getFreshnessMap, getToolFreshness } from './workbenchTrust';
import { PATHD_THEME } from './workbenchTheme';

interface WorkbenchStatusBarProps {
  moduleId: string | null;
}

const SURFACE = 'linear-gradient(180deg, rgba(9,12,18,0.96) 0%, rgba(10,12,18,0.9) 100%)';
const BORDER = PATHD_THEME.panelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;

function getStageStatusColor(status: 'pending' | 'active' | 'complete') {
  if (status === 'complete') return '#9ED7C7';
  if (status === 'active') return '#F2D6A2';
  return 'rgba(255,255,255,0.22)';
}

export default function WorkbenchStatusBar({ moduleId }: WorkbenchStatusBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const project = useWorkbenchStore((s) => s.project);
  const checkpoints = useWorkbenchStore((s) => s.checkpoints);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const nextRecommendations = useWorkbenchStore((s) => s.nextRecommendations);
  const currentStageId = useWorkbenchStore((s) => s.currentStageId);
  const backendMeta = useWorkbenchStore((s) => s.backendMeta);
  const collaborators = useWorkbenchStore((s) => s.collaborators);
  const experimentRecords = useWorkbenchStore((s) => s.experimentRecords);
  const syncStatus = useWorkbenchStore((s) => s.syncStatus);
  const syncError = useWorkbenchStore((s) => s.syncError);
  const lastServerSyncAt = useWorkbenchStore((s) => s.lastServerSyncAt);

  const stage = moduleId ? getStageForTool(moduleId) : getStageById(currentStageId);
  const selectedEvidence = evidenceItems.filter((item) => selectedEvidenceIds.includes(item.id));
  const nextToolIds = moduleId ? getNextToolIds(moduleId) : analyzeArtifact?.recommendedNextTools ?? [];
  const nextTools = nextToolIds
    .map((toolId) => TOOL_BY_ID[toolId])
    .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));
  const freshness = useMemo(
    () => getToolFreshness(runArtifacts, moduleId, { project, analyzeArtifact }),
    [analyzeArtifact, moduleId, project, runArtifacts],
  );
  const nextFreshness = useMemo(
    () => getFreshnessMap(runArtifacts, nextToolIds, { project, analyzeArtifact }),
    [analyzeArtifact, nextToolIds, project, runArtifacts],
  );
  const syncLabel = useMemo(() => {
    if (syncStatus === 'loading') return 'Loading database-backed canonical state';
    if (syncStatus === 'saving') return 'Syncing database-backed canonical state';
    if (syncStatus === 'synced') return lastServerSyncAt ? `Canonical DB synced · ${new Date(lastServerSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Canonical DB synced';
    if (syncStatus === 'conflict') return 'Canonical DB conflict resolved on server';
    if (syncStatus === 'error') return syncError ?? 'Canonical DB unavailable';
    return 'Canonical DB idle';
  }, [lastServerSyncAt, syncError, syncStatus]);
  const feedbackLabel = useMemo(() => {
    if (!dbtlPayload) return 'No DBTL feedback yet';
    if (dbtlPayload.feedbackSource === 'committed') {
      return `DBTL committed · pass ${dbtlPayload.result.passRate.toFixed(0)}% · ${dbtlPayload.result.latestPhase}`;
    }
    return `DBTL draft · phase ${dbtlPayload.proposedPhase} · waiting for commit`;
  }, [dbtlPayload]);
  const collaboratorLabel = useMemo(() => {
    if (!collaborators.length) return 'Collaboration ledger · waiting for another actor to join this project scope';
    return `Collaboration ledger · ${collaborators.slice(0, 3).map((entry) => entry.displayName).join(' · ')}`;
  }, [collaborators]);
  const experimentLabel = useMemo(() => {
    if (!experimentRecords.length) return 'Experiment ledger · no analysis or experiment records synced yet';
    const latest = experimentRecords[0];
    return `Experiment ledger · latest ${latest.toolId.toUpperCase()} · ${latest.authorityTier} · ${latest.status}`;
  }, [experimentRecords]);

  const stageSummary = useMemo(() => {
    if (analyzeArtifact && stage?.id === 'stage-1') {
      return `${analyzeArtifact.pathwayCandidates.length || 1} analyzed route ready for execution`;
    }
    if (moduleId) {
      return stage?.description ?? 'Scientific workbench stage';
    }
    return 'Move through the four-stage synthetic biology workflow without losing object context.';
  }, [analyzeArtifact, moduleId, stage]);
  const executionSummary = moduleId
    ? freshness.status === 'fresh'
      ? 'Fresh against current upstream context'
      : freshness.status === 'stale'
        ? `Stale after ${freshness.blockingToolIds.map((id) => id.toUpperCase()).join(', ')}`
        : freshness.status === 'awaiting-upstream'
          ? 'Awaiting rerun with newer upstream data'
          : 'No auditable run yet'
    : 'Follow the stage rail and audit trail to validate each transition.';
  const visibleNextTools = nextTools.slice(0, 3);

  return (
    <>
      <section
        style={{
          padding: '8px 16px 10px',
          display: 'grid',
          gap: '8px',
          background: SURFACE,
          borderBottom: `1px solid ${BORDER}`,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {WORKBENCH_STAGES.map((entry) => {
              const checkpoint = checkpoints.find((item) => item.id === entry.id);
              const isActive = stage?.id === entry.id || (!moduleId && currentStageId === entry.id);
              return (
                <Link
                  key={entry.id}
                  href={getDefaultHrefForStage(entry.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '32px',
                    padding: '0 10px',
                    borderRadius: '999px',
                    border: `1px solid ${isActive ? PATHD_THEME.panelBorderStrong : BORDER}`,
                    background: isActive ? PATHD_THEME.panelGradientSoft : PATHD_THEME.chipNeutral,
                    color: isActive ? VALUE : 'rgba(255,255,255,0.62)',
                    textDecoration: 'none',
                    fontFamily: T.SANS,
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '999px',
                      background: getStageStatusColor(checkpoint?.status ?? 'pending'),
                      boxShadow: `0 0 12px ${getStageStatusColor(checkpoint?.status ?? 'pending')}55`,
                    }}
                  />
                  {entry.shortLabel}
                  <span style={{ color: LABEL, fontSize: '11px', fontWeight: 500 }}>
                    {entry.label}
                  </span>
                </Link>
              );
            })}

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
              <Link
                href="/research"
                style={{
                  minHeight: '32px',
                  padding: '0 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  border: `1px solid ${BORDER}`,
                  background: PATHD_THEME.chipNeutral,
                  color: 'rgba(255,255,255,0.68)',
                  fontFamily: T.SANS,
                  fontSize: '11px',
                }}
              >
                <BookOpenText size={13} />
                Research
              </Link>
              <Link
                href="/analyze"
                style={{
                  minHeight: '32px',
                  padding: '0 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  border: `1px solid ${BORDER}`,
                  background: PATHD_THEME.chipNeutral,
                  color: 'rgba(255,255,255,0.68)',
                  fontFamily: T.SANS,
                  fontSize: '11px',
                }}
              >
                <Microscope size={13} />
                Analyze
              </Link>
              <Link
                href="/tools/nexai"
                style={{
                  minHeight: '32px',
                  padding: '0 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  border: `1px solid ${PATHD_THEME.panelBorderStrong}`,
                  background: PATHD_THEME.panelGradientSoft,
                  color: VALUE,
                  fontFamily: T.SANS,
                  fontSize: '11px',
                }}
              >
                <BrainCircuit size={13} />
                {analyzeArtifact?.targetProduct ? `Axon: ${analyzeArtifact.targetProduct}` : 'Axon Copilot'}
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen((open) => !open)}
                style={{
                  minHeight: '32px',
                  padding: '0 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: `1px solid ${drawerOpen ? PATHD_THEME.panelBorderStrong : BORDER}`,
                  background: drawerOpen ? PATHD_THEME.panelGradientSoft : PATHD_THEME.chipNeutral,
                  color: drawerOpen ? VALUE : 'rgba(255,255,255,0.68)',
                  cursor: 'pointer',
                  fontFamily: T.SANS,
                  fontSize: '11px',
                }}
              >
                <Layers3 size={13} />
                Evidence & Next Steps
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '8px',
              gridTemplateColumns: 'minmax(280px, 1.4fr) repeat(auto-fit, minmax(170px, 1fr))',
            }}
          >
            <div
              style={{
                borderRadius: '14px',
                border: `1px solid ${BORDER}`,
                background: PATHD_THEME.panelGradientSoft,
                padding: '10px 12px',
                display: 'grid',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Current Object
                </span>
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: `1px solid ${project?.isDemo ? PATHD_THEME.chipBorderWarm : PATHD_THEME.chipBorder}`,
                    background: project?.isDemo ? PATHD_THEME.chipWarm : PATHD_THEME.chipCool,
                    color: project?.isDemo ? 'rgba(255,222,190,0.94)' : PATHD_THEME.chipText,
                    fontFamily: T.MONO,
                    fontSize: '9px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  {project?.isDemo ? 'Demo' : 'Project'}
                </span>
                {stage && (
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '999px',
                      border: `1px solid ${PATHD_THEME.chipBorder}`,
                      background: PATHD_THEME.chipCool,
                      color: VALUE,
                      fontFamily: T.MONO,
                      fontSize: '9px',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {stage.shortLabel}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '14px', fontWeight: 700, color: VALUE, letterSpacing: '-0.01em' }}>
                {project?.title ?? 'Scientific workbench context not yet initialized'}
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                {analyzeArtifact
                  ? `${analyzeArtifact.targetProduct} · ${analyzeArtifact.nodes.length} nodes · ${analyzeArtifact.edges.length} edges`
                  : project?.summary ?? 'Start in Research or Analyze to create a traceable project object.'}
              </div>
            </div>

            <div
              style={{
                borderRadius: '14px',
                border: `1px solid ${BORDER}`,
                background: PATHD_THEME.panelGradientSoft,
                padding: '10px 12px',
                display: 'grid',
                gap: '6px',
              }}
            >
              <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Evidence
              </span>
              <div style={{ fontFamily: T.SANS, fontSize: '16px', color: VALUE, fontWeight: 700 }}>
                {selectedEvidence.length}
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                {selectedEvidence.length
                  ? selectedEvidence[0]?.title
                  : project?.isDemo
                    ? 'Demo fallback is active.'
                    : 'Research bundle ready to attach.'}
              </div>
            </div>

            <div
              style={{
                borderRadius: '14px',
                border: `1px solid ${BORDER}`,
                background: PATHD_THEME.panelGradientSoft,
                padding: '10px 12px',
                display: 'grid',
                gap: '6px',
              }}
            >
              <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Stage Focus
              </span>
              <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 600 }}>
                {stage?.label ?? 'Flowchart skeleton ready'}
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                {stageSummary}
              </div>
            </div>

            <div
              style={{
                borderRadius: '14px',
                border: `1px solid ${BORDER}`,
                background: PATHD_THEME.panelGradientSoft,
                padding: '10px 12px',
                display: 'grid',
                gap: '6px',
              }}
            >
              <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Integrity
              </span>
              <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 600 }}>
                {executionSummary}
              </div>
              <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, lineHeight: 1.5 }}>
                {syncLabel} · {backendMeta?.runArtifactCount ?? runArtifacts.length} runs · {backendMeta?.experimentCount ?? experimentRecords.length} experiments
              </div>
            </div>
          </div>

          {visibleNextTools.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Next Step
              </span>
              {visibleNextTools.map((tool) => (
                <Link
                  key={tool.id}
                  href={tool.href}
                  style={{
                    minHeight: '30px',
                    padding: '0 10px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                    border: `1px solid ${PATHD_THEME.chipBorder}`,
                    background: PATHD_THEME.chipNeutral,
                    color: 'rgba(255,255,255,0.76)',
                    fontFamily: T.SANS,
                    fontSize: '11px',
                  }}
                >
                  {tool.shortLabel}
                  {nextFreshness[tool.id]?.status === 'stale' && (
                    <span style={{ color: 'rgba(255,214,166,0.92)', fontFamily: T.MONO, fontSize: '10px' }}>
                      stale
                    </span>
                  )}
                  <ArrowUpRight size={12} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.button
              type="button"
              onClick={() => setDrawerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.32)',
                border: 'none',
                zIndex: 85,
                cursor: 'pointer',
              }}
              aria-label="Close evidence drawer"
            />
            <motion.aside
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              style={{
                position: 'fixed',
                top: 112,
                right: 12,
                bottom: 12,
                width: 'min(360px, calc(100vw - 24px))',
                borderRadius: '22px',
                border: `1px solid ${BORDER}`,
                background: 'linear-gradient(180deg, rgba(10,12,18,0.98) 0%, rgba(13,16,24,0.96) 100%)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.38)',
                zIndex: 90,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: `1px solid ${BORDER}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Evidence Drawer
                  </div>
                  <div style={{ fontFamily: T.SANS, fontSize: '14px', color: VALUE, fontWeight: 700 }}>
                    Evidence Chain & Next Steps
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '999px',
                    border: `1px solid ${BORDER}`,
                    background: PATHD_THEME.chipNeutral,
                    color: 'rgba(255,255,255,0.58)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'grid', gap: '14px' }}>
                <section style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Closed-loop Feedback
                  </div>
                  <div
                    style={{
                      borderRadius: '14px',
                      border: `1px solid ${BORDER}`,
                      background: PATHD_THEME.panelGradientSoft,
                      padding: '10px 12px',
                      display: 'grid',
                      gap: '4px',
                    }}
                  >
                    <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 600 }}>
                      {feedbackLabel}
                    </div>
                    <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                      {dbtlPayload?.feedbackSource === 'committed'
                        ? 'Upstream stage seeds are now allowed to incorporate the latest committed Learn cycle.'
                        : 'Draft DBTL output remains visible, but upstream reseeding waits for a committed experiment loop.'}
                    </div>
                  </div>
                </section>

                {moduleId && (
                  <section style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Execution Integrity
                    </div>
                    <div
                      style={{
                        borderRadius: '14px',
                        border: `1px solid ${BORDER}`,
                        background: freshness.status === 'stale' ? PATHD_THEME.chipWarm : PATHD_THEME.panelGradientSoft,
                        padding: '10px 12px',
                        display: 'grid',
                        gap: '4px',
                      }}
                    >
                      <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 600 }}>
                        {freshness.status === 'fresh'
                          ? 'Current run is aligned with upstream context'
                          : freshness.status === 'stale'
                            ? 'Current run is stale against upstream updates'
                            : freshness.status === 'awaiting-upstream'
                              ? 'Upstream data is ready, but this tool has not been rerun'
                              : 'No auditable run recorded yet'}
                      </div>
                      <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                        {freshness.summary}
                      </div>
                    </div>
                  </section>
                )}

                <section style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Canonical State
                  </div>
                  <div
                    style={{
                      borderRadius: '14px',
                      border: `1px solid ${BORDER}`,
                      background: PATHD_THEME.panelGradientSoft,
                      padding: '10px 12px',
                      display: 'grid',
                      gap: '4px',
                    }}
                  >
                    <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 600 }}>
                      {syncLabel}
                    </div>
                    <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                      {runArtifacts.length
                        ? `${backendMeta?.runArtifactCount ?? runArtifacts.length} immutable run artifact(s) retained for provenance and downstream audit.`
                        : 'No immutable run artifacts yet. Execute a tool to create auditable state.'}
                    </div>
                    {backendMeta && (
                      <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                        {backendMeta.driver} · project {backendMeta.projectId} · actor {backendMeta.actorId} · rev {backendMeta.revision} · {backendMeta.auditCount} sync audit event(s)
                      </div>
                    )}
                  </div>
                </section>

                <section style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Active Evidence
                  </div>
                  {selectedEvidence.length ? selectedEvidence.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        borderRadius: '14px',
                        border: `1px solid ${BORDER}`,
                        background: PATHD_THEME.panelGradientSoft,
                        padding: '10px 12px',
                        display: 'grid',
                        gap: '4px',
                      }}
                    >
                      <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 600 }}>
                        {item.title}
                      </div>
                      <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                        {[item.source ?? item.journal, item.year].filter(Boolean).join(' · ')}
                      </div>
                      <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                        {item.abstract.slice(0, 180)}{item.abstract.length > 180 ? '…' : ''}
                      </div>
                    </div>
                  )) : (
                    <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
                      No evidence has been selected yet. Save papers in Research to build a bundle.
                    </div>
                  )}
                </section>

                <section style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Analyze Artifact
                  </div>
                  {analyzeArtifact ? (
                    <div
                      style={{
                        borderRadius: '14px',
                        border: `1px solid ${BORDER}`,
                        background: PATHD_THEME.panelGradientSoft,
                        padding: '10px 12px',
                        display: 'grid',
                        gap: '6px',
                      }}
                    >
                      <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 600 }}>
                        {analyzeArtifact.title}
                      </div>
                      <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                        {analyzeArtifact.summary}
                      </div>
                      <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                        {`${analyzeArtifact.nodes.length} nodes · ${analyzeArtifact.edges.length} edges · ${analyzeArtifact.bottleneckAssumptions.length} bottleneck assumptions`}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
                      Analyze has not generated a structured artifact yet.
                    </div>
                  )}
                </section>

                <WorkbenchEvidenceTracePanel toolId={moduleId} />

                <WorkbenchDecisionTracePanel
                  toolId={moduleId}
                  title={moduleId ? 'Current Decision Trace' : 'Workbench Decision Trace'}
                  limit={4}
                />

                <WorkbenchRunCompare
                  toolId={moduleId}
                  stageId={moduleId ? null : stage?.id ?? currentStageId}
                  title={moduleId ? 'Current Tool Compare' : 'Stage Compare'}
                />

                <WorkbenchProjectTimeline
                  title={moduleId ? 'Canonical Project Timeline' : 'Workbench Project Timeline'}
                  limit={5}
                />

                <WorkbenchExperimentLedger
                  title={moduleId ? 'Experimental Record Layer' : 'Stage 4 Experimental Record Layer'}
                  limit={4}
                />

                <WorkbenchAuditTimeline
                  toolId={moduleId}
                  stageId={moduleId ? null : stage?.id ?? currentStageId}
                  title="Audit Timeline"
                  limit={7}
                />

                <section style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Next Step Panel
                  </div>
                  {nextRecommendations.length ? nextRecommendations.map((recommendation) => {
                    const tool = TOOL_BY_ID[recommendation.toolId];
                    if (!tool) return null;
                    return (
                      <Link
                        key={recommendation.id}
                        href={tool.href}
                        style={{
                          borderRadius: '14px',
                          border: `1px solid ${BORDER}`,
                          background: PATHD_THEME.panelGradientSoft,
                          padding: '10px 12px',
                          display: 'grid',
                          gap: '4px',
                          textDecoration: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 600 }}>
                            {tool.name}
                          </span>
                          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                            {tool.shortLabel}
                          </span>
                        </div>
                        <div style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.55 }}>
                          {recommendation.reason}
                        </div>
                      </Link>
                    );
                  }) : (
                    <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
                      No recommended next step yet. Run Analyze or open a stage tool to get handoff guidance.
                    </div>
                  )}
                </section>

                <section style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Cross-Stage Intelligence
                  </div>
                  {CROSS_STAGE_TOOL_IDS.map((toolId) => {
                    const tool = TOOL_BY_ID[toolId];
                    if (!tool) return null;
                    return (
                      <Link
                        key={toolId}
                        href={tool.href}
                        style={{
                          borderRadius: '14px',
                          border: `1px solid ${BORDER}`,
                          background: PATHD_THEME.panelGradientSoft,
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          textDecoration: 'none',
                          color: VALUE,
                          fontFamily: T.SANS,
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        <span>{tool.name}</span>
                        <Workflow size={13} />
                      </Link>
                    );
                  })}
                </section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
