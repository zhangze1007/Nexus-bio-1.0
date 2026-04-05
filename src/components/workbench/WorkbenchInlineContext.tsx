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

const BORDER = PATHD_THEME.panelBorder;
const SURFACE = PATHD_THEME.panelGradientSoft;
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

  return (
    <div
      style={{
        borderRadius: compact ? '16px' : '18px',
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        padding: compact ? '12px' : '14px 16px',
        display: 'grid',
        gap: compact ? '10px' : '12px',
        marginBottom: compact ? '14px' : '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '4px' }}>
          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {stage?.shortLabel ?? 'Workbench'} context
          </span>
          <span style={{ fontFamily: T.SANS, fontSize: compact ? '13px' : '14px', color: VALUE, fontWeight: 700 }}>
            {project?.targetProduct || analyzeArtifact?.targetProduct || project?.title || 'No active project object'}
          </span>
        </div>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: '999px',
            border: `1px solid ${(isSimulated || project?.isDemo) ? PATHD_THEME.chipBorderWarm : PATHD_THEME.chipBorder}`,
            background: (isSimulated || project?.isDemo) ? PATHD_THEME.chipWarm : PATHD_THEME.chipCool,
            color: (isSimulated || project?.isDemo) ? 'rgba(255,222,190,0.94)' : PATHD_THEME.chipText,
            fontFamily: T.MONO,
            fontSize: '9px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {(isSimulated || project?.isDemo) ? 'Simulated Context' : 'Project-Linked'}
        </span>
      </div>

      <div
        style={{
          fontFamily: T.SANS,
          fontSize: compact ? '10px' : '12px',
          color: LABEL,
          lineHeight: compact ? 1.5 : 1.6,
          ...(compact
            ? {
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        {summary}
      </div>

      {compact ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { label: 'Evidence', value: `${selectedEvidenceIds.length} selected` },
            { label: 'Bottleneck', value: bottleneck?.label ?? 'Awaiting analyze artifact' },
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
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: '4px 8px',
                borderRadius: '999px',
                border: `1px solid ${BORDER}`,
                background: PATHD_THEME.chipNeutral,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                minHeight: '24px',
                maxWidth: '100%',
              }}
            >
              <span style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {item.label}
              </span>
              <span
                style={{
                  fontFamily: T.SANS,
                  fontSize: '10px',
                  color: VALUE,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '28ch',
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
            background: PATHD_THEME.chipNeutral,
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Link
          href="/analyze"
          style={{
            minHeight: '30px',
            padding: '0 10px',
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            border: `1px solid ${BORDER}`,
            background: PATHD_THEME.chipNeutral,
            color: VALUE,
            fontFamily: T.SANS,
            fontSize: '11px',
          }}
        >
          <Microscope size={12} />
          Analyze
        </Link>
        {toolId !== 'nexai' && (
          <Link
            href="/tools/nexai"
            style={{
              minHeight: '30px',
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
            <BrainCircuit size={12} />
            Ask Axon
          </Link>
        )}
        {nextTool && (
          <Link
            href={nextTool.href}
            style={{
              minHeight: '30px',
              padding: '0 10px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              border: `1px solid ${BORDER}`,
              background: PATHD_THEME.chipNeutral,
              color: 'rgba(255,255,255,0.72)',
              fontFamily: T.SANS,
              fontSize: '11px',
            }}
          >
            Next: {nextTool.shortLabel}
            <ArrowUpRight size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}
