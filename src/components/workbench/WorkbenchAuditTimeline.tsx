'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BookOpenText, Database, FlaskConical, Workflow } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { getDownstreamToolIds, getUpstreamToolIds } from '../../config/workbenchGraph';
import type { WorkbenchStageId } from '../tools/shared/workbenchConfig';
import { PATHD_THEME } from './workbenchTheme';
import {
  glassPanel,
  typography,
  iconContainer,
  cardVariants,
  staggerContainer,
  accentLeftBorder,
} from './workbenchDesignSystem';

interface WorkbenchAuditTimelineProps {
  toolId?: string | null;
  stageId?: WorkbenchStageId | null;
  title?: string;
  limit?: number;
  compact?: boolean;
}

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
      return PATHD_THEME.sky;
    case 'analysis':
      return PATHD_THEME.lilac;
    case 'run':
      return PATHD_THEME.apricot;
    default:
      return PATHD_THEME.coral;
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
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      style={{ display: 'grid', gap: '12px' }}
    >
      {/* Section Header */}
      <motion.div variants={cardVariants} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={iconContainer(PATHD_THEME.sky, 20)}>
          <BookOpenText size={11} color={PATHD_THEME.sky} />
        </span>
        <span style={typography.sectionTitle}>{title}</span>
      </motion.div>

      {events.length ? (
        <div style={{ position: 'relative' }}>
          {/* Timeline vertical line */}
          <div
            style={{
              position: 'absolute',
              left: compact ? '11px' : '13px',
              top: '16px',
              bottom: '16px',
              width: '1px',
              background: `linear-gradient(180deg, ${PATHD_THEME.sky}22, ${PATHD_THEME.lilac}22, ${PATHD_THEME.apricot}22, transparent)`,
              pointerEvents: 'none',
            }}
          />

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            style={{ display: 'grid', gap: compact ? '10px' : '14px', position: 'relative' }}
          >
            {events.map((event) => (
              <TimelineCard key={event.id} event={event} compact={compact} />
            ))}
          </motion.div>
        </div>
      ) : (
        <motion.div
          variants={cardVariants}
          style={{
            ...glassPanel,
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ ...typography.body, maxWidth: '300px', margin: '0 auto' }}>
            No auditable events yet.
          </div>
          <div style={{ ...typography.caption, maxWidth: '300px', margin: '0 auto', opacity: 0.6 }}>
            Save evidence, run Analyze, or execute a tool to populate the timeline.
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}

function TimelineCard({
  event,
  compact,
}: {
  event: TimelineEvent;
  compact: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const Icon = getKindIcon(event.kind);
  const accent = getKindAccent(event.kind);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '24px 1fr' : '28px 1fr',
        gap: compact ? '10px' : '14px',
        alignItems: 'start',
      }}
    >
      {/* Icon node on the timeline */}
      <div
        style={{
          width: compact ? '24px' : '28px',
          height: compact ? '24px' : '28px',
          borderRadius: '999px',
          border: `1px solid ${accent}44`,
          background: `rgba(16, 19, 26, 0.8)`,
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          zIndex: 2,
          boxShadow: hovered ? `0 0 12px ${accent}22` : 'none',
          transition: 'box-shadow 0.25s ease',
        }}
      >
        <Icon size={compact ? 11 : 12} color={accent} />
      </div>

      {/* Card content */}
      <div
        style={{
          ...glassPanel,
          ...accentLeftBorder(accent, 2),
          padding: compact ? '10px 12px' : '12px 14px',
          borderRadius: compact ? '12px' : '14px',
          borderColor: hovered ? 'rgba(255, 255, 255, 0.12)' : glassPanel.borderColor,
          transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
          transition: 'border-color 0.25s ease, transform 0.25s ease',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{
              ...typography.cardTitle,
              fontSize: compact ? '12px' : '13px',
            }}>
              {event.title}
            </div>
            <div style={typography.caption}>{event.caption}</div>
          </div>
          <div style={{ ...typography.caption, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatTime(event.at)}
          </div>
        </div>

        {/* Detail */}
        <div
          style={{
            ...typography.body,
            fontSize: compact ? '11px' : '12px',
          }}
        >
          {event.detail}
        </div>
      </div>
    </motion.div>
  );
}
