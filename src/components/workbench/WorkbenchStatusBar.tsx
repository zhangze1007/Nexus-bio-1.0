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
import WorkbenchAuditTimeline from './WorkbenchAuditTimeline';
import WorkbenchDecisionTracePanel from './WorkbenchDecisionTracePanel';
import WorkbenchEvidenceTracePanel from './WorkbenchEvidenceTracePanel';
import WorkbenchExperimentLedger from './WorkbenchExperimentLedger';
import WorkbenchProjectTimeline from './WorkbenchProjectTimeline';
import WorkbenchRunCompare from './WorkbenchRunCompare';
import ReportExportButton from '../tools/shared/ReportExportButton';
import { getFreshnessMap, getToolFreshness } from './workbenchTrust';
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
import { THEME } from '../../theme';

interface WorkbenchStatusBarProps {
  moduleId: string | null;
}

const BORDER = THEME.BORDER;
const LABEL = THEME.LABEL;
const VALUE = THEME.VALUE;
const CARD_BG = THEME.PANEL_GLASS_STRONG;
const CARD_BG_SOFT = THEME.PANEL_SURFACE;
const HEADER_HEIGHT = 34; // compact 1-row header height in px

function getStageStatusColor(status: 'pending' | 'active' | 'complete') {
  if (status === 'complete') return THEME.MINT;
  if (status === 'active') return THEME.APRICOT;
  return 'rgba(226,232,240,0.18)';
}

function getWorkflowStatusColor(status: WorkflowExperienceStatus | string) {
  if (status === 'complete') return THEME.MINT;
  if (status === 'current' || status === 'next' || status === 'ready') return THEME.SKY;
  if (status === 'blocked') return THEME.CORAL;
  if (status === 'demoOnly' || status === 'humanGate') return THEME.APRICOT;
  return 'rgba(226,232,240,0.22)';
}

type DrawerTab = 'status' | 'evidence' | 'history';

const DRAWER_TABS: { id: DrawerTab; label: string; accent: string }[] = [
  { id: 'status', label: 'Status', accent: THEME.SKY },
  { id: 'evidence', label: 'Evidence', accent: THEME.LILAC },
  { id: 'history', label: 'History', accent: THEME.MINT },
];

export default function WorkbenchStatusBar({ moduleId }: WorkbenchStatusBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('status');
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
    if (syncStatus === 'loading') return 'Loading canonical state';
    if (syncStatus === 'saving') return 'Syncing';
    if (syncStatus === 'synced') return lastServerSyncAt ? `Synced ${new Date(lastServerSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Synced';
    if (syncStatus === 'conflict') return 'Conflict resolved';
    if (syncStatus === 'error') return syncError ?? 'DB unavailable';
    return 'Idle';
  }, [lastServerSyncAt, syncError, syncStatus]);
  const feedbackLabel = useMemo(() => {
    if (!dbtlPayload) return 'No DBTL feedback';
    if (dbtlPayload.feedbackSource === 'committed') {
      return `Committed · pass ${dbtlPayload.result.passRate.toFixed(0)}% · ${dbtlPayload.result.latestPhase}`;
    }
    return `Draft · phase ${dbtlPayload.proposedPhase}`;
  }, [dbtlPayload]);
  const workflowDashboardItems = useMemo(
    () => buildWorkflowDashboardItems(workflowControl, runArtifacts),
    [runArtifacts, workflowControl],
  );
  const workflowProgress = useMemo(() => {
    const complete = workflowDashboardItems.filter((item) => item.id !== 'target' && item.id !== 'nexai' && item.status === 'complete').length;
    return `${complete}/6`;
  }, [workflowDashboardItems]);
  const visibleNextTools = nextTools.slice(0, 3);
  const objectLabel = analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'No active project';
  const freshnessLabel = moduleId
    ? freshness.status === 'fresh' ? 'Fresh' : freshness.status === 'stale' ? `Stale: ${freshness.blockingToolIds.map((id) => id.toUpperCase()).join(', ')}` : freshness.status === 'awaiting-upstream' ? 'Awaiting rerun' : 'No run'
    : syncLabel;
  const workflowLabel = `${workflowStatusLabel(workflowControl.status)}${workflowControl.nextRecommendedNode ? ` → ${workflowControl.nextRecommendedNode.toUpperCase()}` : ''}`;

  return (
    <>
      {/* ── 1-Row Compact Header ─────────────────────────────── */}
      <section
        role="banner"
        aria-label="Workbench status bar"
        style={{
          padding: '5px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'nowrap',
          background: `linear-gradient(180deg, ${THEME.PANEL_MUTED} 0%, ${THEME.PANEL_BG} 100%)`,
          borderBottom: `1px solid ${BORDER}`,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Stage pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {WORKBENCH_STAGES.map((entry) => {
            const checkpoint = checkpoints.find((item) => item.id === entry.id);
            const isActive = stage?.id === entry.id || (!moduleId && currentStageId === entry.id);
            return (
              <Link
                key={entry.id}
                href={getDefaultHrefForStage(entry.id)}
                title={entry.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '24px',
                  padding: '0 7px',
                  borderRadius: '999px',
                  border: `1px solid ${isActive ? THEME.BORDER_STRONG : BORDER}`,
                  background: isActive ? `${entry.accent}33` : CARD_BG,
                  color: VALUE,
                  textDecoration: 'none',
                  fontFamily: THEME.MONO,
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '999px',
                    background: getStageStatusColor(checkpoint?.status ?? 'pending'),
                    boxShadow: `0 0 8px ${getStageStatusColor(checkpoint?.status ?? 'pending')}66`,
                    flexShrink: 0,
                  }}
                />
                {entry.shortLabel}
              </Link>
            );
          })}
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '16px', background: BORDER, flexShrink: 0 }} />

        {/* Object */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            height: '24px',
            padding: '0 8px',
            borderRadius: '999px',
            border: `1px solid ${BORDER}`,
            background: 'rgba(175,195,214,0.14)',
            fontFamily: THEME.SANS,
            fontSize: '10px',
            fontWeight: 600,
            color: VALUE,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '180px',
            flexShrink: 1,
            minWidth: 0,
          }}
          title={objectLabel}
        >
          {objectLabel}
        </div>

        {/* Freshness chip */}
        <div
          style={{
            height: '24px',
            padding: '0 7px',
            borderRadius: '999px',
            border: `1px solid ${BORDER}`,
            background: CARD_BG_SOFT,
            fontFamily: THEME.MONO,
            fontSize: '10px',
            color: freshness.status === 'stale' ? THEME.CORAL : freshness.status === 'fresh' ? THEME.MINT : LABEL,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <span style={{
            width: '5px',
            height: '5px',
            borderRadius: '999px',
            background: freshness.status === 'stale' ? THEME.CORAL : freshness.status === 'fresh' ? THEME.MINT : 'rgba(226,232,240,0.3)',
          }} />
          {freshnessLabel}
        </div>

        {/* Workflow chip */}
        <div
          style={{
            height: '24px',
            padding: '0 7px',
            borderRadius: '999px',
            border: `1px solid ${BORDER}`,
            background: CARD_BG_SOFT,
            fontFamily: THEME.MONO,
            fontSize: '10px',
            color: getWorkflowStatusColor(workflowControl.status === 'gated' ? 'humanGate' : workflowControl.status),
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Workflow size={10} />
          {workflowLabel}
        </div>

        {/* Progress */}
        <div
          style={{
            fontFamily: THEME.MONO,
            fontSize: '10px',
            color: LABEL,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {workflowProgress}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, minWidth: 0 }} />

        {/* Action buttons */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <ReportExportButton />
          <Link
            href="/research"
            style={{
              height: '24px',
              padding: '0 7px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              border: `1px solid ${BORDER}`,
              background: CARD_BG,
              color: LABEL,
              fontFamily: THEME.SANS,
              fontSize: '10px',
            }}
          >
            <BookOpenText size={11} />
            Research
          </Link>
          <Link
            href="/analyze"
            style={{
              height: '24px',
              padding: '0 7px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              border: `1px solid ${BORDER}`,
              background: CARD_BG,
              color: LABEL,
              fontFamily: THEME.SANS,
              fontSize: '10px',
            }}
          >
            <Microscope size={11} />
            Analyze
          </Link>
          <button
            type="button"
            onClick={() => useUIStore.getState().setCopilotOpen(true)}
            data-testid="workbench-axon-copilot"
            style={{
              height: '24px',
              padding: '0 7px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              border: `1px solid ${THEME.BORDER_STRONG}`,
              background: 'rgba(207,196,227,0.34)',
              color: VALUE,
              fontFamily: THEME.SANS,
              fontSize: '10px',
            }}
          >
            <BrainCircuit size={11} />
            Axon
          </button>
          <button
            type="button"
            onClick={() => {
              setDrawerOpen((open) => !open);
              if (!drawerOpen) setDrawerTab('status');
            }}
            aria-expanded={drawerOpen}
            aria-label="Toggle detail drawer"
            style={{
              height: '24px',
              padding: '0 7px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              border: `1px solid ${drawerOpen ? THEME.BORDER_STRONG : BORDER}`,
              background: drawerOpen ? 'rgba(175,195,214,0.18)' : CARD_BG,
              color: VALUE,
              cursor: 'pointer',
              fontFamily: THEME.SANS,
              fontSize: '10px',
            }}
          >
            <Layers3 size={11} />
            Detail
          </button>
        </div>
      </section>

      {/* ── 3-Tab Drawer ──────────────────────────────────────── */}
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
              aria-label="Close detail drawer"
            />
            <motion.aside
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              style={{
                position: 'fixed',
                top: HEADER_HEIGHT + 14,
                right: 12,
                bottom: 12,
                width: 'min(380px, calc(100vw - 24px))',
                borderRadius: '22px',
                border: `1px solid ${BORDER}`,
                background: `linear-gradient(180deg, ${THEME.PANEL_MUTED} 0%, ${THEME.PANEL_BG} 100%)`,
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 24px 80px rgba(52, 48, 43, 0.16)',
                zIndex: 90,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Drawer close button */}
              <div
                style={{
                  padding: '8px 16px',
                  borderBottom: `1px solid rgba(255,255,255,0.06)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close drawer"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(16, 19, 26, 0.6)',
                    color: LABEL,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={12} />
                </button>
              </div>

              {/* Tab bar */}
              <div
                role="tablist"
                aria-label="Drawer sections"
                style={{
                  display: 'flex',
                  gap: '2px',
                  padding: '0 16px',
                  borderBottom: `1px solid ${BORDER}`,
                  background: THEME.PANEL_MUTED,
                  flexShrink: 0,
                }}
              >
                {DRAWER_TABS.map((tab) => {
                  const isActive = drawerTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setDrawerTab(tab.id)}
                      style={{
                        position: 'relative',
                        padding: '8px 14px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: THEME.SANS,
                        fontSize: '11px',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? tab.accent : LABEL,
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="drawer-tab-indicator"
                          style={{
                            position: 'absolute',
                            bottom: '-1px',
                            left: 0,
                            right: 0,
                            height: '2px',
                            background: tab.accent,
                            borderRadius: '2px 2px 0 0',
                          }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'grid', gap: '14px', alignContent: 'start' }}>
                <AnimatePresence mode="wait">
                  {drawerTab === 'status' && (
                    <motion.div key="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ display: 'grid', gap: '14px' }}>
                      {/* Workflow Dashboard */}
                      <DrawerSection title="Golden Path">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <Workflow size={13} color={getWorkflowStatusColor(workflowControl.status === 'gated' ? 'humanGate' : workflowControl.status)} />
                          <span style={{ fontFamily: THEME.SANS, fontSize: '12px', color: VALUE, fontWeight: 700 }}>
                            {workflowStatusLabel(workflowControl.status)}
                          </span>
                          <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: LABEL }}>
                            {workflowProgress}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {workflowDashboardItems.map((item) => {
                            const color = getWorkflowStatusColor(item.status);
                            const itemEl = (
                              <div
                                title={item.detail}
                                style={{
                                  height: '24px',
                                  padding: '0 7px',
                                  borderRadius: '999px',
                                  border: `1px solid ${item.status === 'current' || item.status === 'next' ? THEME.BORDER_STRONG : BORDER}`,
                                  background: item.status === 'current' || item.status === 'next' ? 'rgba(175,195,214,0.18)' : CARD_BG_SOFT,
                                  color: VALUE,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontFamily: THEME.SANS,
                                  fontSize: '10px',
                                  fontWeight: 600,
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: color, flexShrink: 0 }} />
                                {item.label}
                              </div>
                            );
                            return item.href ? <Link key={item.id} href={item.href} style={{ textDecoration: 'none' }}>{itemEl}</Link> : <div key={item.id}>{itemEl}</div>;
                          })}
                        </div>
                        <div style={{ fontFamily: THEME.MONO, fontSize: '10px', color: LABEL, marginTop: '6px' }}>
                          {workflowControl.currentToolId && <span>current: {workflowControl.currentToolId.toUpperCase()} · </span>}
                          {workflowControl.confidence !== null && <span>conf {workflowControl.confidence.toFixed(2)} · </span>}
                          <span>uncert {workflowControl.uncertainty === null ? '?' : workflowControl.uncertainty.toFixed(2)}</span>
                          {workflowControl.humanGateRequired && <span style={{ color: THEME.APRICOT }}> · human gate</span>}
                        </div>
                      </DrawerSection>

                      {/* DBTL Feedback */}
                      <DrawerSection title="Closed-loop Feedback">
                        <div style={typography.label}>{feedbackLabel}</div>
                        <div style={typography.body}>
                          {dbtlPayload?.feedbackSource === 'committed'
                            ? 'Upstream seeds require approved LearnedDeltaPacks before incorporating DBTL learning.'
                            : 'Draft DBTL output remains visible; upstream reseeding waits for committed learning.'}
                        </div>
                      </DrawerSection>

                      {/* Execution Integrity */}
                      {moduleId && (
                        <DrawerSection title="Execution Integrity" accent={freshness.status === 'stale' ? THEME.CORAL : THEME.MINT}>
                          <div style={typography.label}>
                            {freshness.status === 'fresh' ? 'Aligned with upstream' : freshness.status === 'stale' ? 'Stale against upstream' : freshness.status === 'awaiting-upstream' ? 'Awaiting rerun' : 'No auditable run'}
                          </div>
                          <div style={typography.body}>{freshness.summary}</div>
                        </DrawerSection>
                      )}

                      {/* Canonical State */}
                      <DrawerSection title="Canonical State">
                        <div style={typography.label}>{syncLabel}</div>
                        <div style={typography.body}>
                          {runArtifacts.length
                            ? `${backendMeta?.runArtifactCount ?? runArtifacts.length} immutable run artifact(s) retained.`
                            : 'No immutable run artifacts yet.'}
                        </div>
                        {backendMeta && (
                          <div style={typography.caption}>
                            {backendMeta.driver} · rev {backendMeta.revision} · {backendMeta.auditCount} audit events
                          </div>
                        )}
                      </DrawerSection>

                      {/* Next Step */}
                      <DrawerSection title="Next Step">
                        {visibleNextTools.length > 0 ? (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {visibleNextTools.map((tool) => (
                              <Link
                                key={tool.id}
                                href={tool.href}
                                style={{
                                  height: '26px',
                                  padding: '0 8px',
                                  borderRadius: '999px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  textDecoration: 'none',
                                  border: `1px solid ${THEME.CHIP_BORDER}`,
                                  background: CARD_BG_SOFT,
                                  color: VALUE,
                                  fontFamily: THEME.SANS,
                                  fontSize: '10px',
                                }}
                              >
                                {tool.shortLabel}
                                {nextFreshness[tool.id]?.status === 'stale' && (
                                  <span style={{ color: 'rgba(255,214,166,0.92)', fontFamily: THEME.MONO, fontSize: '10px' }}>stale</span>
                                )}
                                <ArrowUpRight size={11} />
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div style={typography.body}>Run a tool to get handoff guidance.</div>
                        )}
                      </DrawerSection>
                    </motion.div>
                  )}

                  {drawerTab === 'evidence' && (
                    <motion.div key="evidence" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ display: 'grid', gap: '14px' }}>
                      {/* Active Evidence */}
                      <DrawerSection title="Active Evidence">
                        {selectedEvidence.length ? selectedEvidence.map((item) => (
                          <div key={item.id} style={{ ...glassPanel, padding: '10px 12px' }}>
                            <div style={typography.label}>{item.title}</div>
                            <div style={typography.caption}>{[item.source ?? item.journal, item.year].filter(Boolean).join(' · ')}</div>
                            <div style={typography.body}>{item.abstract.slice(0, 160)}{item.abstract.length > 160 ? '…' : ''}</div>
                          </div>
                        )) : (
                          <div style={typography.body}>No evidence selected. Save papers in Research to build a bundle.</div>
                        )}
                      </DrawerSection>

                      {/* Analyze Artifact */}
                      <DrawerSection title="Analyze Artifact" accent={THEME.LILAC}>
                        {analyzeArtifact ? (
                          <div style={{ ...glassPanel, padding: '10px 12px' }}>
                            <div style={typography.label}>{analyzeArtifact.title}</div>
                            <div style={typography.body}>{analyzeArtifact.summary}</div>
                            <div style={typography.caption}>{analyzeArtifact.nodes.length} nodes · {analyzeArtifact.edges.length} edges · {analyzeArtifact.bottleneckAssumptions.length} bottlenecks</div>
                          </div>
                        ) : (
                          <div style={typography.body}>Analyze has not generated a structured artifact yet.</div>
                        )}
                      </DrawerSection>

                      <WorkbenchEvidenceTracePanel toolId={moduleId} />
                      <WorkbenchDecisionTracePanel toolId={moduleId} title={moduleId ? 'Decision Trace' : 'Workbench Decision Trace'} limit={4} />
                    </motion.div>
                  )}

                  {drawerTab === 'history' && (
                    <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ display: 'grid', gap: '14px' }}>
                      <WorkbenchRunCompare toolId={moduleId} stageId={moduleId ? null : stage?.id ?? currentStageId} title={moduleId ? 'Tool Compare' : 'Stage Compare'} />
                      <WorkbenchProjectTimeline title={moduleId ? 'Project Timeline' : 'Workbench Timeline'} limit={5} />
                      <WorkbenchExperimentLedger title={moduleId ? 'Experiment Ledger' : 'Stage 4 Ledger'} limit={4} />
                      <WorkbenchAuditTimeline toolId={moduleId} stageId={moduleId ? null : stage?.id ?? currentStageId} title="Audit Timeline" limit={7} />

                      {/* Cross-Stage Intelligence */}
                      {CROSS_STAGE_TOOL_IDS.length > 0 && (
                        <DrawerSection title="Cross-Stage Tools">
                          <div style={{ display: 'grid', gap: '4px' }}>
                            {CROSS_STAGE_TOOL_IDS.map((toolId) => {
                              const tool = TOOL_BY_ID[toolId];
                              if (!tool) return null;
                              return (
                                <Link
                                  key={toolId}
                                  href={tool.href}
                                  style={{
                                    ...glassPanel,
                                    padding: '10px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    textDecoration: 'none',
                                  }}
                                >
                                  <span style={typography.label}>{tool.name}</span>
                                  <Workflow size={12} color={THEME.SKY} />
                                </Link>
                              );
                            })}
                          </div>
                        </DrawerSection>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Helper: Drawer Section ─────────────────────────────────── */
function DrawerSection({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'grid', gap: '6px' }}>
      <motion.div variants={cardVariants} style={{ ...typography.sectionTitle, ...(accent ? { color: accent } : {}) }}>
        {title}
      </motion.div>
      <motion.div variants={cardVariants} style={{ ...glassPanel, ...(accent ? accentLeftBorder(accent, 2) : {}), padding: '10px 12px', display: 'grid', gap: '6px' }}>
        {children}
      </motion.div>
    </motion.section>
  );
}
