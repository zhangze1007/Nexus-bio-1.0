'use client';

import { useMemo } from 'react';
import { BookOpenText, Database, FlaskConical, Workflow } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { getDownstreamToolIds, getUpstreamToolIds } from '../tools/shared/workbenchGraph';
import type { WorkbenchStageId } from '../tools/shared/workbenchConfig';
import { PATHD_THEME } from './workbenchTheme';

interface WorkbenchAuditTimelineProps {
  toolId?: string | null;
  stageId?: WorkbenchStageId | null;
  title?: string;
  limit?: number;
  compact?: boolean;
}

const BORDER = PATHD_THEME.panelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;

type TimelineEvent = {
  id: string;
  at: number;
  kind: 'evidence' | 'analysis' | 'run' | 'sync';
  title: string;
  detail: string;
  caption: string;
};

function formatTime(timestamp: number) {
  if (!timestamp) return 'Pending';
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getKindAccent(kind: TimelineEvent['kind']) {
  switch (kind) {
    case 'evidence':
      return PATHD_THEME.blue;
    case 'analysis':
      return PATHD_THEME.indigo;
    case 'run':
      return PATHD_THEME.orange;
    default:
      return PATHD_THEME.liveRed;
  }
}

function getKindIcon(kind: TimelineEvent['kind']) {
  switch (kind) {
    case 'evidence':
      return BookOpenText;
    case 'analysis':
      return FlaskConical;
    case 'run':
      return Workflow;
    default:
      return Database;
  }
}

export default function WorkbenchAuditTimeline({
  toolId = null,
  stageId = null,
  title = 'Audit Timeline',
  limit = 6,
  compact = false,
}: WorkbenchAuditTimelineProps) {
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const syncAuditLog = useWorkbenchStore((s) => s.syncAuditLog);

  const events = useMemo(() => {
    const relevantEvidenceIds = new Set(
      (analyzeArtifact?.evidenceTraceIds?.length ? analyzeArtifact.evidenceTraceIds : selectedEvidenceIds),
    );
    const relevantToolIds = toolId
      ? new Set([
          toolId,
          ...getUpstreamToolIds(toolId, { deep: true }),
          ...getDownstreamToolIds(toolId, { deep: false, includeSupport: false }),
        ])
      : null;

    const items: TimelineEvent[] = [];

    evidenceItems
      .filter((item) => relevantEvidenceIds.has(item.id))
      .forEach((item) => {
        items.push({
          id: `evidence-${item.id}`,
          at: item.savedAt,
          kind: 'evidence',
          title: item.title,
          detail: item.abstract || 'Evidence item saved into the project bundle.',
          caption: [item.source ?? item.journal, item.year].filter(Boolean).join(' · ') || 'Evidence bundle',
        });
      });

    if (analyzeArtifact && (!stageId || stageId === 'stage-1' || !toolId)) {
      items.push({
        id: `analysis-${analyzeArtifact.id}`,
        at: analyzeArtifact.generatedAt,
        kind: 'analysis',
        title: analyzeArtifact.title,
        detail: analyzeArtifact.summary,
        caption: `${analyzeArtifact.nodes.length} nodes · ${analyzeArtifact.bottleneckAssumptions.length} bottleneck assumptions`,
      });
    }

    runArtifacts
      .filter((artifact) => {
        if (toolId && relevantToolIds) return relevantToolIds.has(artifact.toolId);
        if (stageId) return artifact.stageId === stageId;
        return true;
      })
      .forEach((artifact) => {
        const tool = TOOL_BY_ID[artifact.toolId];
        items.push({
          id: `run-${artifact.id}`,
          at: artifact.createdAt,
          kind: 'run',
          title: tool?.name ?? artifact.toolId.toUpperCase(),
          detail: artifact.summary,
          caption: `${artifact.stageId?.replace('stage-', 'Stage ') ?? 'Cross-stage'} · upstream ${artifact.upstreamArtifactIds.length}${artifact.isSimulated ? ' · simulated' : ' · project-linked'}`,
        });
      });

    syncAuditLog.slice(0, 6).forEach((entry) => {
      items.push({
        id: `sync-${entry.id}`,
        at: entry.createdAt,
        kind: 'sync',
        title: `Canonical DB revision ${entry.revision}`,
        detail: entry.detail ?? `${entry.action} ${entry.status}`,
        caption: `${entry.action} · ${entry.status}`,
      });
    });

    return items
      .sort((a, b) => b.at - a.at)
      .slice(0, limit);
  }, [analyzeArtifact, evidenceItems, limit, runArtifacts, selectedEvidenceIds, stageId, syncAuditLog, toolId]);

  return (
    <section
      style={{
        display: 'grid',
        gap: '10px',
      }}
    >
      <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>
      {events.length ? events.map((event) => {
        const Icon = getKindIcon(event.kind);
        const accent = getKindAccent(event.kind);
        return (
          <div
            key={event.id}
            style={{
              borderRadius: compact ? '14px' : '16px',
              border: `1px solid ${BORDER}`,
              background: PATHD_THEME.panelGradientSoft,
              padding: compact ? '10px 12px' : '12px 14px',
              display: 'grid',
              gap: '6px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(90deg, ${accent}18, transparent 45%)`,
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span
                  style={{
                    width: compact ? '22px' : '24px',
                    height: compact ? '22px' : '24px',
                    borderRadius: '999px',
                    border: `1px solid ${accent}55`,
                    background: `${accent}22`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: VALUE,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={compact ? 11 : 12} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.SANS, fontSize: compact ? '12px' : '13px', color: VALUE, fontWeight: 700 }}>
                    {event.title}
                  </div>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                    {event.caption}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, whiteSpace: 'nowrap' }}>
                {formatTime(event.at)}
              </div>
            </div>
            <div style={{ position: 'relative', fontFamily: T.SANS, fontSize: compact ? '11px' : '12px', color: LABEL, lineHeight: 1.55 }}>
              {event.detail}
            </div>
          </div>
        );
      }) : (
        <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
          No auditable events yet. Save evidence, run Analyze, or execute a tool to populate the timeline.
        </div>
      )}
    </section>
  );
}
