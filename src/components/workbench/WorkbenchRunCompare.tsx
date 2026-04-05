'use client';

import { useMemo } from 'react';
import { Gauge, GitCompareArrows } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import type { WorkbenchStageId } from '../tools/shared/workbenchConfig';
import { getAuthorityTier } from './workbenchTrust';
import { PATHD_THEME } from './workbenchTheme';

interface WorkbenchRunCompareProps {
  toolId?: string | null;
  stageId?: WorkbenchStageId | null;
  title?: string;
}

const BORDER = PATHD_THEME.panelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorkbenchRunCompare({
  toolId = null,
  stageId = null,
  title = 'Run Compare',
}: WorkbenchRunCompareProps) {
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);

  const [latest, previous] = useMemo(() => {
    const filtered = runArtifacts.filter((artifact) => {
      if (toolId) return artifact.toolId === toolId;
      if (stageId) return artifact.stageId === stageId;
      return true;
    });
    return filtered.slice(0, 2);
  }, [runArtifacts, stageId, toolId]);

  const compareLabel = useMemo(() => {
    if (!latest || !previous) return null;
    const upstreamDelta = latest.upstreamArtifactIds.length - previous.upstreamArtifactIds.length;
    const sameSummary = latest.summary === previous.summary;
    const targetShift = latest.targetProduct === previous.targetProduct ? 'same target' : 'target changed';
    return [
      sameSummary ? 'summary stable' : 'summary shifted',
      upstreamDelta === 0 ? 'same upstream depth' : `upstream ${upstreamDelta > 0 ? '+' : ''}${upstreamDelta}`,
      targetShift,
    ].join(' · ');
  }, [latest, previous]);

  const subject = toolId ? (TOOL_BY_ID[toolId]?.name ?? toolId.toUpperCase()) : stageId ? stageId.replace('stage-', 'Stage ') : 'Workbench';

  if (!latest) {
    return (
      <section style={{ display: 'grid', gap: '8px' }}>
        <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </div>
        <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
          No runs have been recorded for {subject} yet.
        </div>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <GitCompareArrows size={14} color={PATHD_THEME.orange} />
        <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {[latest, previous].filter(Boolean).map((run, index) => (
          <div
            key={run.id}
            style={{
              borderRadius: '16px',
              border: `1px solid ${BORDER}`,
              background: index === 0 ? PATHD_THEME.panelGradient : PATHD_THEME.panelGradientSoft,
              padding: '12px 14px',
              display: 'grid',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ fontFamily: T.SANS, fontSize: '13px', color: VALUE, fontWeight: 700 }}>
                {index === 0 ? 'Latest run' : 'Previous run'}
              </div>
              <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                {formatTime(run.createdAt)}
              </div>
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, lineHeight: 1.55 }}>
              {run.summary}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '999px',
                  border: `1px solid ${run.isSimulated ? PATHD_THEME.chipBorderWarm : PATHD_THEME.chipBorder}`,
                  background: run.isSimulated ? PATHD_THEME.chipWarm : PATHD_THEME.chipCool,
                  color: PATHD_THEME.chipText,
                  fontFamily: T.MONO,
                  fontSize: '10px',
                }}
              >
                {run.isSimulated ? 'Simulated' : 'Project-linked'}
              </span>
              <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                {getAuthorityTier(run)}
              </span>
              <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                upstream {run.upstreamArtifactIds.length}
              </span>
            </div>
          </div>
        ))}
      </div>

      {compareLabel && (
        <div
          style={{
            borderRadius: '14px',
            border: `1px solid ${BORDER}`,
            background: PATHD_THEME.panelGradientSoft,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <Gauge size={13} color={PATHD_THEME.blue} />
          <span style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 600 }}>
            {subject}
          </span>
          <span style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.55 }}>
            {compareLabel}
          </span>
        </div>
      )}
    </section>
  );
}
