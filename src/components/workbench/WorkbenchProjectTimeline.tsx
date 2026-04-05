'use client';

import { useMemo } from 'react';
import { Database, GitBranchPlus, ShieldCheck } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { getAuthoritySummary, getAuthorityTier } from './workbenchTrust';

interface WorkbenchProjectTimelineProps {
  title?: string;
  limit?: number;
}

const BORDER = 'rgba(255,255,255,0.08)';
const LABEL = 'rgba(255,255,255,0.42)';
const VALUE = 'rgba(255,255,255,0.88)';

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function authorityColor(tier: ReturnType<typeof getAuthorityTier>) {
  if (tier === 'experiment-backed') return 'rgba(158,215,199,0.92)';
  if (tier === 'evidence-linked') return 'rgba(242,214,162,0.92)';
  if (tier === 'contextual') return 'rgba(205,214,255,0.92)';
  return 'rgba(255,192,128,0.92)';
}

export default function WorkbenchProjectTimeline({
  title = 'Project Timeline',
  limit = 6,
}: WorkbenchProjectTimelineProps) {
  const historyLog = useWorkbenchStore((s) => s.historyLog);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const backendMeta = useWorkbenchStore((s) => s.backendMeta);

  const entries = useMemo(() => historyLog.slice(0, limit), [historyLog, limit]);
  const latestAuthority = useMemo(() => {
    const artifact = runArtifacts[0];
    if (!artifact) return null;
    const tier = getAuthorityTier(artifact);
    return {
      tier,
      summary: getAuthoritySummary(tier),
    };
  }, [runArtifacts]);

  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <GitBranchPlus size={14} color="rgba(255,255,255,0.72)" />
        <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </div>
        {backendMeta && (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '999px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.04)',
              color: LABEL,
              fontFamily: T.MONO,
              fontSize: '10px',
            }}
          >
            {backendMeta.historyCount} revisions
          </span>
        )}
      </div>

      {latestAuthority && (
        <div
          style={{
            borderRadius: '16px',
            border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.03)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <ShieldCheck size={14} color={authorityColor(latestAuthority.tier)} />
          <span style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 700 }}>
            Latest run authority
          </span>
          <span style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.55 }}>
            {latestAuthority.summary}
          </span>
        </div>
      )}

      {entries.length ? entries.map((entry) => (
        <div
          key={entry.revision}
          style={{
            borderRadius: '16px',
            border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.03)',
            padding: '12px 14px',
            display: 'grid',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={13} color="rgba(255,255,255,0.72)" />
              <span style={{ fontFamily: T.SANS, fontSize: '13px', color: VALUE, fontWeight: 700 }}>
                rev {entry.revision} · {entry.projectTitle}
              </span>
            </div>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
              {formatTime(entry.updatedAt)}
            </span>
          </div>

          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
            {entry.targetProduct}
            {entry.analyzeTitle ? ` · ${entry.analyzeTitle}` : ' · Analyze pending'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '4px 8px',
                borderRadius: '999px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.76)',
                fontFamily: T.MONO,
                fontSize: '10px',
              }}
            >
              {entry.runArtifactCount} runs recorded
            </span>
            <span
              style={{
                padding: '4px 8px',
                borderRadius: '999px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.76)',
                fontFamily: T.MONO,
                fontSize: '10px',
              }}
            >
              mutation {formatTime(entry.mutationAt)}
            </span>
          </div>
        </div>
      )) : (
        <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
          No canonical revision history yet. Once the workbench syncs, project revisions will appear here.
        </div>
      )}
    </section>
  );
}
