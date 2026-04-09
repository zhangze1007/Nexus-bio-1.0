'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { ArrowUpRight, BrainCircuit, Microscope } from 'lucide-react';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { getNextToolIds, getStageForTool } from '../tools/shared/workbenchConfig';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { getToolFreshness } from './workbenchTrust';
import { PATHD_THEME } from './workbenchTheme';

interface WorkbenchInlineContextProps {
  toolId: string;
  title: string;
  summary: string;
  compact?: boolean;
  isSimulated?: boolean;
}

const BORDER = PATHD_THEME.sepiaPanelBorder;
const SURFACE = PATHD_THEME.panelGlassStrong;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;

export default function WorkbenchInlineContext({
  toolId,
  title,
  summary,
  compact = false,
  isSimulated = false,
}: WorkbenchInlineContextProps) {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const addToolRun = useWorkbenchStore((s) => s.addToolRun);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const stage = getStageForTool(toolId);
  const loggedRef = useRef(false);

  const actionBtn: React.CSSProperties & Record<`--${string}`, string> = {
    minHeight: compact ? '34px' : '30px',
    padding: compact ? '0 12px' : '0 10px',
    borderRadius: compact ? '12px' : '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    textDecoration: 'none',
    border: '1px solid var(--nb-control-border)',
    background: 'var(--nb-control-bg)',
    color: 'var(--nb-control-color)',
    fontFamily: T.SANS,
    fontSize: compact ? '10px' : '11px',
    fontWeight: 700,
    transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
    cursor: 'pointer',
    width: compact ? '100%' : undefined,
    minWidth: 0,
    ['--nb-control-bg']: 'rgba(255,255,255,0.10)',
    ['--nb-control-border']: 'rgba(255,255,255,0.14)',
    ['--nb-control-color']: 'rgba(255,255,255,0.60)',
    ['--nb-control-hover-bg']: 'rgba(255,255,255,0.94)',
    ['--nb-control-hover-border']: 'rgba(255,255,255,0.94)',
    ['--nb-control-hover-color']: '#111318',
    ['--nb-control-active-bg']: '#ffffff',
    ['--nb-control-active-border']: '#ffffff',
    ['--nb-control-active-color']: '#111318',
  };

  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    addToolRun({
      toolId,
      title,
      summary,
      isSimulated: isSimulated || Boolean(project?.isDemo),
    });
  }, [addToolRun, isSimulated, project?.isDemo, summary, title, toolId]);

  const evidenceTrace = useMemo(() => {
    const traceIds = analyzeArtifact?.evidenceTraceIds ?? selectedEvidenceIds;
    return evidenceItems.filter((item) => traceIds.includes(item.id)).slice(0, compact ? 1 : 2);
  }, [analyzeArtifact?.evidenceTraceIds, compact, evidenceItems, selectedEvidenceIds]);

  const bottleneck = analyzeArtifact?.bottleneckAssumptions[0];
  const nextTool = getNextToolIds(toolId)
    .map((nextId) => TOOL_BY_ID[nextId])
    .find(Boolean);
  const latestRunArtifact = useMemo(
    () => runArtifacts.find((artifact) => artifact.toolId === toolId),
    [runArtifacts, toolId],
  );
  const freshness = useMemo(
    () => getToolFreshness(runArtifacts, toolId, { project, analyzeArtifact }),
    [analyzeArtifact, project, runArtifacts, toolId],
  );
  const committedFeedback = dbtlPayload?.feedbackSource === 'committed' ? dbtlPayload : null;
  const compactItems = [
    { label: 'Evidence', value: `${selectedEvidenceIds.length} selected` },
    {
      label: 'Feedback',
      value: committedFeedback
        ? `DBTL ${committedFeedback.result.latestPhase} · pass ${committedFeedback.result.passRate.toFixed(0)}%`
        : 'No committed DBTL feedback',
    },
    {
      label: 'Freshness',
      value: freshness.status === 'fresh'
        ? 'Fresh'
        : freshness.status === 'stale'
          ? `Stale after ${freshness.blockingToolIds.map((id) => id.toUpperCase()).join(', ')}`
          : freshness.status === 'awaiting-upstream'
            ? 'Awaiting rerun'
            : 'No auditable run',
    },
    { label: 'Bottleneck', value: bottleneck?.label ?? 'Awaiting analyze artifact' },
  ];

  return (
    <div
      className={`nb-workbench-inline-context${compact ? ' nb-workbench-inline-context--compact' : ''}`}
      style={{
        borderRadius: compact ? '16px' : '18px',
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        padding: compact ? '12px' : '14px 16px',
        display: 'grid',
        gap: compact ? '12px' : '12px',
        marginBottom: compact ? '10px' : '16px',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: compact ? 'flex-start' : 'center', justifyContent: 'space-between', gap: compact ? '10px' : '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '4px' }}>
          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {stage?.shortLabel ?? 'Workbench'} context
          </span>
          <span style={{ fontFamily: T.SANS, fontSize: compact ? '12px' : '14px', color: VALUE, fontWeight: 700 }}>
            {project?.targetProduct || analyzeArtifact?.targetProduct || project?.title || 'No active project object'}
          </span>
        </div>
        <span
          style={{
            padding: compact ? '2px 7px' : '3px 8px',
            borderRadius: '999px',
            border: `1px solid ${(isSimulated || project?.isDemo) ? PATHD_THEME.chipBorderWarm : BORDER}`,
            background: (isSimulated || project?.isDemo) ? 'rgba(231,199,169,0.22)' : 'rgba(175,195,214,0.2)',
            color: VALUE,
            fontFamily: T.MONO,
            fontSize: compact ? '8px' : '9px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {(isSimulated || project?.isDemo) ? 'Simulated Context' : 'Project-Linked'}
        </span>
      </div>

      <div
        className="nb-workbench-inline-context__summary"
        style={{
          fontFamily: T.SANS,
          fontSize: compact ? '10.5px' : '12px',
          color: LABEL,
          lineHeight: compact ? 1.4 : 1.6,
          ...(compact
            ? {
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        {summary}
      </div>

      {(isSimulated || project?.isDemo) && (
        <div
          className="nb-workbench-inline-context__simulated"
          style={{
            borderRadius: compact ? '10px' : '12px',
            border: `1px solid ${PATHD_THEME.chipBorderWarm}`,
            background: 'rgba(231,199,169,0.12)',
            padding: compact ? '6px 8px' : '10px 12px',
            display: 'grid',
            gap: compact ? '6px' : '4px',
          }}
        >
          <div
            style={{
              fontFamily: T.MONO,
              fontSize: compact ? '8px' : '9px',
              color: VALUE,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Demo / simulated context
          </div>
          <div
            style={{
              fontFamily: T.SANS,
              fontSize: compact ? '9px' : '11px',
              color: LABEL,
              lineHeight: compact ? 1.4 : 1.55,
            }}
          >
            Outputs on this page may come from local models or bundled synthetic datasets until a project-linked evidence bundle or live analysis artifact is attached.
          </div>
        </div>
      )}

      {compact ? (
        <div className="nb-workbench-inline-context__metrics nb-workbench-inline-context__metrics--compact" style={{ display: 'grid', gap: '6px' }}>
          {compactItems.map((item) => (
            <div
              key={item.label}
              className="nb-workbench-inline-context__metric nb-workbench-inline-context__metric--compact"
              style={{
                padding: '7px 9px',
                borderRadius: '12px',
                border: `1px solid ${BORDER}`,
                background: PATHD_THEME.panelSurface,
                display: 'grid',
                gap: '4px',
                minHeight: 'unset',
                maxWidth: '100%',
                minWidth: 0,
              }}
            >
              <span
                className="nb-workbench-inline-context__metric-label"
                style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                {item.label}
              </span>
              <span
                className="nb-workbench-inline-context__metric-value"
                style={{
                  fontFamily: T.SANS,
                  fontSize: '10px',
                  color: VALUE,
                  lineHeight: 1.4,
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <div>
            <div style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Evidence
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE }}>
              {selectedEvidenceIds.length} selected
            </div>
          </div>
          <div>
            <div style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Bottleneck
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE }}>
              {bottleneck?.label ?? 'Awaiting structured analyze artifact'}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Loop Feedback
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, lineHeight: 1.55 }}>
              {committedFeedback
                ? `DBTL committed · pass ${committedFeedback.result.passRate.toFixed(0)}% · ${committedFeedback.result.latestPhase}`
                : 'No committed DBTL feedback applied yet'}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Freshness
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, lineHeight: 1.55 }}>
              {freshness.status === 'fresh'
                ? 'Fresh against current upstream context'
                : freshness.status === 'stale'
                  ? `Stale after ${freshness.blockingToolIds.map((id) => id.toUpperCase()).join(', ')} updated`
                  : freshness.status === 'awaiting-upstream'
                    ? 'Upstream data is available, but this tool has not been rerun'
                    : 'No auditable run recorded yet'}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Evidence trace
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, lineHeight: 1.55 }}>
              {evidenceTrace.length > 0 ? evidenceTrace.map((item) => item.title).join(' · ') : 'Manual or demo context'}
            </div>
          </div>
        </div>
      )}

      {latestRunArtifact && !compact && (
        <div
          style={{
            borderRadius: '12px',
            border: `1px solid ${BORDER}`,
            background: PATHD_THEME.panelSurface,
            padding: '10px 12px',
            display: 'grid',
            gap: '4px',
          }}
        >
          <div style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Latest audited run
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, lineHeight: 1.55 }}>
            {latestRunArtifact.summary}
          </div>
          <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
            upstream {latestRunArtifact.upstreamArtifactIds.length} · {new Date(latestRunArtifact.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      <div
        className={`nb-workbench-inline-context__actions${compact ? ' nb-workbench-inline-context__actions--compact' : ''}`}
        style={{
          display: compact ? 'grid' : 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: compact ? undefined : 'wrap',
          gridTemplateColumns: compact ? '1fr' : undefined,
        }}
      >
        <Link
          href="/analyze"
          className="nb-ui-control nb-workbench-inline-context__action"
          style={actionBtn}
        >
          <Microscope size={12} />
          Analyze
        </Link>
        {toolId !== 'nexai' && (
          <Link
            href="/tools/nexai"
            className="nb-ui-control nb-workbench-inline-context__action"
            style={actionBtn}
          >
            <BrainCircuit size={12} />
            Ask Axon
          </Link>
        )}
        {nextTool && (
          <Link
            href={nextTool.href}
            className="nb-ui-control nb-workbench-inline-context__action"
            style={actionBtn}
          >
            Next: {nextTool.shortLabel}
            <ArrowUpRight size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}
