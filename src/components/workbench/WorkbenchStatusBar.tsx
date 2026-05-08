'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, BookOpenText, BrainCircuit, Layers3, Microscope, Workflow, X } from 'lucide-react';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import {
  CROSS_STAGE_TOOL_IDS,
  getDefaultHrefForStage,
  getStageById,
  getStageForTool,
  WORKBENCH_STAGES,
  type WorkbenchStageId,
} from '../tools/shared/workbenchConfig';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { useUIStore } from '../../store/uiStore';
import { T } from '../ide/tokens';
import WorkbenchAuditTimeline from './WorkbenchAuditTimeline';
import WorkbenchDecisionTracePanel from './WorkbenchDecisionTracePanel';
import WorkbenchEvidenceTracePanel from './WorkbenchEvidenceTracePanel';
import WorkbenchExperimentLedger from './WorkbenchExperimentLedger';
import WorkbenchProjectTimeline from './WorkbenchProjectTimeline';
import WorkbenchRunCompare from './WorkbenchRunCompare';
import { getFreshnessMap, getToolFreshness } from './workbenchTrust';
import { PATHD_THEME } from './workbenchTheme';
import {
  buildWorkflowDashboardItems,
  workflowStatusLabel,
  type WorkflowExperienceStatus,
} from './workflowExperience';
import {
  glassPanel,
  glassPanelInset,
  typography,
  iconContainer,
  statusChip,
  cardVariants,
  staggerContainer,
  accentLeftBorder,
} from './workbenchDesignSystem';

interface WorkbenchStatusBarProps {
  moduleId: string | null;
}

const SURFACE = `linear-gradient(180deg, ${PATHD_THEME.sepiaPanelMuted} 0%, ${PATHD_THEME.sepiaPanel} 100%)`;
const BORDER = PATHD_THEME.sepiaPanelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;
const CARD_BG = PATHD_THEME.panelGlassStrong;
const CARD_BG_SOFT = PATHD_THEME.panelSurface;

function getStageStatusColor(status: 'pending' | 'active' | 'complete') {
  if (status === 'complete') return PATHD_THEME.mint;
  if (status === 'active') return PATHD_THEME.apricot;
  return 'rgba(226,232,240,0.18)';
}

function getWorkflowStatusColor(status: WorkflowExperienceStatus | string) {
  if (status === 'complete') return PATHD_THEME.mint;
  if (status === 'current' || status === 'next' || status === 'ready') return PATHD_THEME.sky;
  if (status === 'blocked') return PATHD_THEME.coral;
  if (status === 'demoOnly' || status === 'humanGate') return PATHD_THEME.apricot;
  return 'rgba(226,232,240,0.22)';
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
  const workflowControl = useWorkbenchStore((s) => s.workflowControl);

  const stage = moduleId ? getStageForTool(moduleId) : getStageById(currentStageId);
  const selectedEvidence = evidenceItems.filter((item) => selectedEvidenceIds.includes(item.id));
  const nextToolIds = workflowControl.nextRecommendedNode ? [workflowControl.nextRecommendedNode] : [];
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
  const compactHeader = Boolean(moduleId);
  const compactExecutionSummary = moduleId
    ? freshness.status === 'fresh'
      ? 'Fresh'
      : freshness.status === 'stale'
        ? `Stale after ${freshness.blockingToolIds.map((id) => id.toUpperCase()).join(', ')}`
        : freshness.status === 'awaiting-upstream'
          ? 'Awaiting rerun'
          : 'No auditable run'
    : executionSummary;
  const compactSummaryItems = useMemo(
    () => [
      {
        label: 'Object',
        value: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'No active project',
      },
      {
        label: 'Evidence',
        value: `${selectedEvidence.length} selected`,
      },
      {
        label: 'Stage',
        value: stage?.label ?? 'Workbench flow',
      },
      {
        label: 'Freshness',
        value: compactExecutionSummary,
      },
      {
        label: 'Workflow',
        value: `${workflowStatusLabel(workflowControl.status)}${workflowControl.nextRecommendedNode ? ` -> ${workflowControl.nextRecommendedNode.toUpperCase()}` : ''}`,
      },
    ],
    [analyzeArtifact?.targetProduct, compactExecutionSummary, project?.targetProduct, project?.title, selectedEvidence.length, stage?.label, workflowControl.nextRecommendedNode, workflowControl.status],
  );
  const workflowDashboardItems = useMemo(
    () => buildWorkflowDashboardItems(workflowControl, runArtifacts),
    [runArtifacts, workflowControl],
  );
  const workflowProgress = useMemo(() => {
    const complete = workflowDashboardItems.filter((item) => item.id !== 'target' && item.id !== 'nexai' && item.status === 'complete').length;
    return `${complete}/6`;
  }, [workflowDashboardItems]);

  return (
    <>
      <section
        style={{
          padding: compactHeader ? '5px 12px 6px' : '8px 16px 10px',
          display: 'grid',
          gap: compactHeader ? '5px' : '8px',
          background: SURFACE,
          borderBottom: `1px solid ${BORDER}`,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: '0 10px 30px rgba(32,37,43,0.05)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: compactHeader ? '6px' : '10px', flexWrap: 'wrap' }}>
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
                    minHeight: compactHeader ? '28px' : '32px',
                    padding: compactHeader ? '0 8px' : '0 10px',
                    borderRadius: '999px',
                    border: `1px solid ${isActive ? PATHD_THEME.panelBorderStrong : BORDER}`,
                  background: isActive ? `${entry.accent}33` : CARD_BG,
                    color: VALUE,
                    textDecoration: 'none',
                    fontFamily: T.SANS,
                    fontSize: compactHeader ? '10px' : '11px',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '999px',
                      background: getStageStatusColor(checkpoint?.status ?? 'pending'),
                      boxShadow: `0 0 12px ${getStageStatusColor(checkpoint?.status ?? 'pending')}66`,
                    }}
                  />
                  {entry.shortLabel}
                  {!compactHeader && (
                    <span style={{ color: LABEL, fontSize: '11px', fontWeight: 500 }}>
                      {entry.label}
                    </span>
                  )}
                </Link>
              );
            })}

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
              <Link
                href="/research"
                style={{
                  minHeight: compactHeader ? '28px' : '32px',
                  padding: compactHeader ? '0 8px' : '0 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  border: `1px solid ${BORDER}`,
                  background: CARD_BG,
                  color: LABEL,
                  fontFamily: T.SANS,
                  fontSize: compactHeader ? '10px' : '11px',
                }}
              >
                <BookOpenText size={13} />
                Research
              </Link>
              <Link
                href="/analyze"
                style={{
                  minHeight: compactHeader ? '28px' : '32px',
                  padding: compactHeader ? '0 8px' : '0 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  border: `1px solid ${BORDER}`,
                  background: CARD_BG,
                  color: LABEL,
                  fontFamily: T.SANS,
                  fontSize: compactHeader ? '10px' : '11px',
                }}
              >
                <Microscope size={13} />
                Analyze
              </Link>
              <button
                type="button"
                onClick={() => useUIStore.getState().setCopilotOpen(true)}
                data-testid="workbench-axon-copilot"
                style={{
                  minHeight: compactHeader ? '28px' : '32px',
                  padding: compactHeader ? '0 8px' : '0 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: `1px solid ${PATHD_THEME.panelBorderStrong}`,
                  background: 'rgba(207,196,227,0.34)',
                  color: VALUE,
                  fontFamily: T.SANS,
                  fontSize: compactHeader ? '10px' : '11px',
                }}
              >
                <BrainCircuit size={13} />
                {analyzeArtifact?.targetProduct ? `Axon: ${analyzeArtifact.targetProduct}` : 'Axon Copilot'}
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen((open) => !open)}
                style={{
                  minHeight: compactHeader ? '28px' : '32px',
                  padding: compactHeader ? '0 8px' : '0 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: `1px solid ${drawerOpen ? PATHD_THEME.panelBorderStrong : BORDER}`,
                  background: drawerOpen ? 'rgba(175,195,214,0.18)' : CARD_BG,
                  color: VALUE,
                  cursor: 'pointer',
                  fontFamily: T.SANS,
                  fontSize: compactHeader ? '10px' : '11px',
                }}
              >
                <Layers3 size={13} />
                Evidence & Next Steps
              </button>
            </div>
          </div>

          {compactHeader ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {compactSummaryItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: '3px 7px',
                    minHeight: '24px',
                    maxWidth: '100%',
                    borderRadius: '999px',
                    border: `1px solid ${BORDER}`,
                    background: CARD_BG_SOFT,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.SANS,
                      fontSize: '9px',
                      color: VALUE,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: item.label === 'Freshness' ? '24ch' : '18ch',
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              style={{
                display: 'grid',
                gap: '8px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
              }}
            >
              <motion.div
                variants={cardVariants}
                style={{
                  ...glassPanel,
                  ...accentLeftBorder(PATHD_THEME.sky, 2),
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={typography.sectionTitle}>Current Object</span>
                  <span
                    style={{
                        ...statusChip.base,
                        border: `1px solid ${project?.isDemo ? PATHD_THEME.chipBorderWarm : 'rgba(255,255,255,0.08)'}`,
                        background: project?.isDemo ? 'rgba(231,199,169,0.24)' : 'rgba(175,195,214,0.22)',
                        color: VALUE,
                        fontSize: '9px',
                        padding: '2px 7px',
                    }}
                  >
                    {project?.isDemo ? 'Demo' : 'Project'}
                  </span>
                  {stage && (
                    <span
                      style={{
                        ...statusChip.base,
                        border: '1px solid rgba(191,220,205,0.22)',
                        background: 'rgba(191,220,205,0.12)',
                        color: VALUE,
                        fontSize: '9px',
                        padding: '2px 7px',
                      }}
                    >
                      {stage.shortLabel}
                    </span>
                  )}
                </div>
                <div style={{ ...typography.cardTitle, fontSize: '14px', letterSpacing: '-0.01em' }}>
                  {project?.title ?? 'Scientific workbench context not yet initialized'}
                </div>
                <div style={typography.body}>
                  {analyzeArtifact
                    ? `${analyzeArtifact.targetProduct} · ${analyzeArtifact.nodes.length} nodes · ${analyzeArtifact.edges.length} edges`
                    : project?.summary ?? 'Start in Research or Analyze to create a traceable project object.'}
                </div>
              </motion.div>

              <motion.div
                variants={cardVariants}
                style={{
                  ...glassPanel,
                  padding: '10px 12px',
                }}
              >
                <span style={typography.sectionTitle}>Evidence</span>
                <div style={{ ...typography.cardTitle, fontSize: '16px' }}>
                  {selectedEvidence.length}
                </div>
                <div style={typography.body}>
                  {selectedEvidence.length
                    ? selectedEvidence[0]?.title
                    : project?.isDemo
                      ? 'Demo fallback is active.'
                      : 'Research bundle ready to attach.'}
                </div>
              </motion.div>

              <motion.div
                variants={cardVariants}
                style={{
                  ...glassPanel,
                  ...accentLeftBorder(PATHD_THEME.lilac, 2),
                  padding: '10px 12px',
                }}
              >
                <span style={typography.sectionTitle}>Stage Focus</span>
                <div style={typography.label}>
                  {stage?.label ?? 'Flowchart skeleton ready'}
                </div>
                <div style={typography.body}>
                  {stageSummary}
                </div>
              </motion.div>

              <motion.div
                variants={cardVariants}
                style={{
                  ...glassPanel,
                  ...accentLeftBorder(PATHD_THEME.mint, 2),
                  padding: '10px 12px',
                }}
              >
                <span style={typography.sectionTitle}>Integrity</span>
                <div style={typography.label}>
                  {executionSummary}
                </div>
                <div style={typography.caption}>
                  {syncLabel} · {backendMeta?.runArtifactCount ?? runArtifacts.length} runs · {backendMeta?.experimentCount ?? experimentRecords.length} experiments
                </div>
              </motion.div>
            </motion.div>
          )}

          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            style={{
              ...glassPanel,
              padding: compactHeader ? '8px 10px' : '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Workflow size={14} color={getWorkflowStatusColor(workflowControl.status === 'gated' ? 'humanGate' : workflowControl.status)} />
                <span style={{ fontFamily: T.SANS, fontSize: compactHeader ? '11px' : '13px', color: VALUE, fontWeight: 700 }}>
                  Golden Path Dashboard
                </span>
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: `1px solid ${BORDER}`,
                    background: CARD_BG_SOFT,
                    color: getWorkflowStatusColor(workflowControl.status === 'gated' ? 'humanGate' : workflowControl.status),
                    fontFamily: T.MONO,
                    fontSize: compactHeader ? '8px' : '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {workflowStatusLabel(workflowControl.status)}
                </span>
              </div>
              <div style={{ fontFamily: T.MONO, fontSize: compactHeader ? '8px' : '10px', color: LABEL }}>
                progress {workflowProgress}
                {workflowControl.nextRecommendedNode ? ` · next ${workflowControl.nextRecommendedNode.toUpperCase()}` : ''}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: '6px', flexWrap: 'wrap' }}>
              {workflowDashboardItems.map((item) => {
                const color = getWorkflowStatusColor(item.status);
                const body = (
                  <>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '999px',
                        background: color,
                        boxShadow: `0 0 10px ${color}66`,
                        flex: '0 0 auto',
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    <span style={{ color: LABEL, textTransform: 'uppercase', fontSize: compactHeader ? '7px' : '8px' }}>
                      {workflowStatusLabel(item.status)}
                    </span>
                  </>
                );
                const itemStyle: React.CSSProperties = {
                  minHeight: compactHeader ? '28px' : '32px',
                  maxWidth: '100%',
                  padding: compactHeader ? '0 8px' : '0 10px',
                  borderRadius: '999px',
                  border: `1px solid ${item.status === 'current' || item.status === 'next' ? PATHD_THEME.panelBorderStrong : BORDER}`,
                  background: item.status === 'current' || item.status === 'next' ? 'rgba(175,195,214,0.18)' : CARD_BG_SOFT,
                  color: VALUE,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: T.SANS,
                  fontSize: compactHeader ? '9px' : '10px',
                  fontWeight: 700,
                  textDecoration: 'none',
                };
                return item.href ? (
                  <Link key={item.id} href={item.href} title={item.detail} style={itemStyle}>
                    {body}
                  </Link>
                ) : (
                  <div key={item.id} title={item.detail} style={itemStyle}>
                    {body}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontFamily: T.MONO, fontSize: compactHeader ? '8px' : '10px', color: LABEL }}>
              {workflowControl.currentToolId && <span>current · {workflowControl.currentToolId.toUpperCase()}</span>}
              {workflowControl.confidence !== null && <span>confidence · {workflowControl.confidence.toFixed(2)}</span>}
              <span>uncertainty · {workflowControl.uncertainty === null ? 'unknown' : workflowControl.uncertainty.toFixed(2)}</span>
              {workflowControl.humanGateRequired && <span style={{ color: PATHD_THEME.apricot }}>human gate</span>}
              {workflowControl.isDemoOnly && <span style={{ color: PATHD_THEME.apricot }}>demo/simulated</span>}
              {workflowControl.missingEvidence.minRequired > 0 && (
                <span>
                  missing evidence · {workflowControl.missingEvidence.have}/{workflowControl.missingEvidence.minRequired}
                  {workflowControl.missingEvidence.kinds.length ? ` ${workflowControl.missingEvidence.kinds.join(', ')}` : ''}
                </span>
              )}
            </div>
          </motion.div>

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
                    minHeight: compactHeader ? '26px' : '30px',
                    padding: compactHeader ? '0 8px' : '0 10px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                    border: `1px solid ${PATHD_THEME.chipBorder}`,
                    background: CARD_BG_SOFT,
                    color: VALUE,
                    fontFamily: T.SANS,
                    fontSize: compactHeader ? '10px' : '11px',
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
                background: 'rgba(55, 53, 49, 0.18)',
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
                background: `linear-gradient(180deg, ${PATHD_THEME.sepiaPanelMuted} 0%, ${PATHD_THEME.sepiaPanel} 100%)`,
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 24px 80px rgba(52, 48, 43, 0.16)',
                zIndex: 90,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: `1px solid rgba(255,255,255,0.06)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={typography.sectionTitle}>
                    Evidence Drawer
                  </div>
                  <div style={{ ...typography.cardTitle, fontSize: '14px' }}>
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
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(16, 19, 26, 0.6)',
                    color: LABEL,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'border-color 0.2s ease',
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'grid', gap: '14px' }}>
                <motion.section variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'grid', gap: '8px' }}>
                  <motion.div variants={cardVariants} style={typography.sectionTitle}>
                    Closed-loop Feedback
                  </motion.div>
                  <motion.div
                    variants={cardVariants}
                    style={{
                      ...glassPanel,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={typography.label}>
                      {feedbackLabel}
                    </div>
                    <div style={typography.body}>
                      {dbtlPayload?.feedbackSource === 'committed'
                        ? 'Upstream stage seeds require approved typed LearnedDeltaPacks before incorporating DBTL learning.'
                        : 'Draft DBTL output remains visible, but upstream reseeding waits for committed and approved typed learning.'}
                    </div>
                  </motion.div>
                </motion.section>

                {moduleId && (
                  <motion.section variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'grid', gap: '8px' }}>
                    <motion.div variants={cardVariants} style={typography.sectionTitle}>
                      Execution Integrity
                    </motion.div>
                    <motion.div
                      variants={cardVariants}
                      style={{
                        ...glassPanel,
                        ...accentLeftBorder(freshness.status === 'stale' ? PATHD_THEME.coral : PATHD_THEME.mint, 2),
                        padding: '12px 14px',
                      }}
                    >
                      <div style={typography.label}>
                        {freshness.status === 'fresh'
                          ? 'Current run is aligned with upstream context'
                          : freshness.status === 'stale'
                            ? 'Current run is stale against upstream updates'
                            : freshness.status === 'awaiting-upstream'
                              ? 'Upstream data is ready, but this tool has not been rerun'
                              : 'No auditable run recorded yet'}
                      </div>
                      <div style={typography.body}>
                        {freshness.summary}
                      </div>
                    </motion.div>
                  </motion.section>
                )}

                <motion.section variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'grid', gap: '8px' }}>
                  <motion.div variants={cardVariants} style={typography.sectionTitle}>
                    Canonical State
                  </motion.div>
                  <motion.div
                    variants={cardVariants}
                    style={{
                      ...glassPanel,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={typography.label}>
                      {syncLabel}
                    </div>
                    <div style={typography.body}>
                      {runArtifacts.length
                        ? `${backendMeta?.runArtifactCount ?? runArtifacts.length} immutable run artifact(s) retained for provenance and downstream audit.`
                        : 'No immutable run artifacts yet. Execute a tool to create auditable state.'}
                    </div>
                    {backendMeta && (
                      <div style={typography.caption}>
                        {backendMeta.driver} · project {backendMeta.projectId} · actor {backendMeta.actorId} · rev {backendMeta.revision} · {backendMeta.auditCount} sync audit event(s)
                      </div>
                    )}
                  </motion.div>
                </motion.section>

                <motion.section variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'grid', gap: '8px' }}>
                  <motion.div variants={cardVariants} style={typography.sectionTitle}>
                    Active Evidence
                  </motion.div>
                  {selectedEvidence.length ? selectedEvidence.map((item) => (
                    <motion.div
                      key={item.id}
                      variants={cardVariants}
                      style={{
                        ...glassPanel,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={typography.label}>
                        {item.title}
                      </div>
                      <div style={typography.caption}>
                        {[item.source ?? item.journal, item.year].filter(Boolean).join(' · ')}
                      </div>
                      <div style={typography.body}>
                        {item.abstract.slice(0, 180)}{item.abstract.length > 180 ? '…' : ''}
                      </div>
                    </motion.div>
                  )) : (
                    <motion.div variants={cardVariants} style={typography.body}>
                      No evidence has been selected yet. Save papers in Research to build a bundle.
                    </motion.div>
                  )}
                </motion.section>

                <motion.section variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'grid', gap: '8px' }}>
                  <motion.div variants={cardVariants} style={typography.sectionTitle}>
                    Analyze Artifact
                  </motion.div>
                  {analyzeArtifact ? (
                    <motion.div
                      variants={cardVariants}
                      style={{
                        ...glassPanel,
                        ...accentLeftBorder(PATHD_THEME.lilac, 2),
                        padding: '12px 14px',
                      }}
                    >
                      <div style={typography.label}>
                        {analyzeArtifact.title}
                      </div>
                      <div style={typography.body}>
                        {analyzeArtifact.summary}
                      </div>
                      <div style={typography.caption}>
                        {`${analyzeArtifact.nodes.length} nodes · ${analyzeArtifact.edges.length} edges · ${analyzeArtifact.bottleneckAssumptions.length} bottleneck assumptions`}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div variants={cardVariants} style={typography.body}>
                      Analyze has not generated a structured artifact yet.
                    </motion.div>
                  )}
                </motion.section>

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

                <motion.section variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'grid', gap: '8px' }}>
                  <motion.div variants={cardVariants} style={typography.sectionTitle}>
                    Next Step Panel
                  </motion.div>
                  {nextRecommendations.length ? nextRecommendations.map((recommendation) => {
                    const tool = TOOL_BY_ID[recommendation.toolId];
                    if (!tool) return null;
                    return (
                      <motion.div key={recommendation.id} variants={cardVariants} whileHover="hover">
                        <Link
                          href={tool.href}
                          style={{
                            ...glassPanel,
                            padding: '12px 14px',
                            textDecoration: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                            <span style={typography.label}>
                              {tool.name}
                            </span>
                            <span style={typography.caption}>
                              {tool.shortLabel}
                            </span>
                          </div>
                          <div style={typography.body}>
                            {recommendation.reason}
                          </div>
                        </Link>
                      </motion.div>
                    );
                  }) : (
                    <motion.div variants={cardVariants} style={typography.body}>
                      No recommended next step yet. Run Analyze or open a stage tool to get handoff guidance.
                    </motion.div>
                  )}
                </motion.section>

                {CROSS_STAGE_TOOL_IDS.length > 0 && (
                  <motion.section variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'grid', gap: '8px' }}>
                    <motion.div variants={cardVariants} style={typography.sectionTitle}>
                      Cross-Stage Intelligence
                    </motion.div>
                    {CROSS_STAGE_TOOL_IDS.map((toolId) => {
                      const tool = TOOL_BY_ID[toolId];
                      if (!tool) return null;
                      return (
                        <motion.div key={toolId} variants={cardVariants} whileHover="hover">
                          <Link
                            href={tool.href}
                            style={{
                              ...glassPanel,
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              textDecoration: 'none',
                            }}
                          >
                            <span style={typography.label}>{tool.name}</span>
                            <Workflow size={13} color={PATHD_THEME.sky} />
                          </Link>
                        </motion.div>
                      );
                    })}
                  </motion.section>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
