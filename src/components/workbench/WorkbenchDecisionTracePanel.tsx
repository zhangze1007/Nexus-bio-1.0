'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowUpRight, Compass, ShieldCheck, WandSparkles } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { getFreshnessMap, getAuthoritySummary, getAuthorityTier, getToolFreshness } from './workbenchTrust';

interface WorkbenchDecisionTracePanelProps {
  toolId?: string | null;
  title?: string;
  limit?: number;
}

const BORDER = 'rgba(255,255,255,0.08)';
const LABEL = 'rgba(255,255,255,0.42)';
const VALUE = 'rgba(255,255,255,0.88)';

export default function WorkbenchDecisionTracePanel({
  toolId = null,
  title = 'Decision Trace',
  limit = 3,
}: WorkbenchDecisionTracePanelProps) {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const nextRecommendations = useWorkbenchStore((s) => s.nextRecommendations);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);

  const activeRun = useMemo(
    () => (toolId ? runArtifacts.find((artifact) => artifact.toolId === toolId) : runArtifacts[0] ?? null),
    [runArtifacts, toolId],
  );
  const freshness = useMemo(
    () => getToolFreshness(runArtifacts, toolId, { project, analyzeArtifact }),
    [analyzeArtifact, project, runArtifacts, toolId],
  );

  const recommendations = useMemo(() => nextRecommendations.slice(0, limit), [limit, nextRecommendations]);
  const recommendationFreshness = useMemo(
    () => getFreshnessMap(runArtifacts, recommendations.map((item) => item.toolId), { project, analyzeArtifact }),
    [analyzeArtifact, project, recommendations, runArtifacts],
  );

  const rationale = useMemo(() => {
    const lines: string[] = [];
    if (analyzeArtifact?.bottleneckAssumptions[0]) {
      lines.push(`Analyze flagged ${analyzeArtifact.bottleneckAssumptions[0].label} as the leading bottleneck`);
    }
    if (activeRun) {
      lines.push(activeRun.summary);
      lines.push(getAuthoritySummary(getAuthorityTier(activeRun)));
    }
    if (dbtlPayload?.feedbackSource === 'committed') {
      lines.push(`Committed DBTL feedback is active: ${dbtlPayload.result.passRate.toFixed(0)}% pass rate at ${dbtlPayload.result.latestPhase}`);
    }
    if (!lines.length && project) {
      lines.push(`Project context is active for ${project.targetProduct}`);
    }
    return lines.slice(0, 4);
  }, [activeRun, analyzeArtifact?.bottleneckAssumptions, dbtlPayload, project]);

  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Compass size={14} color="rgba(255,255,255,0.72)" />
        <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </div>
      </div>

      <div
        style={{
          borderRadius: '16px',
          border: `1px solid ${BORDER}`,
          background: 'rgba(255,255,255,0.03)',
          padding: '12px 14px',
          display: 'grid',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <ShieldCheck size={13} color="rgba(255,255,255,0.72)" />
          <span style={{ fontFamily: T.SANS, fontSize: '13px', color: VALUE, fontWeight: 700 }}>
            Current decision basis
          </span>
          {toolId && (
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
              {freshness.status}
            </span>
          )}
        </div>
        {rationale.length ? rationale.map((line) => (
          <div key={line} style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.55 }}>
            {line}
          </div>
        )) : (
          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.55 }}>
            Analyze artifacts, run outputs, and DBTL feedback will accumulate here as an explicit decision chain.
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        {recommendations.length ? recommendations.map((recommendation) => {
          const tool = TOOL_BY_ID[recommendation.toolId];
          if (!tool) return null;
          const targetFreshness = recommendationFreshness[recommendation.toolId];
          return (
            <Link
              key={recommendation.id}
              href={tool.href}
              style={{
                borderRadius: '16px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.03)',
                padding: '12px 14px',
                display: 'grid',
                gap: '6px',
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <WandSparkles size={13} color="rgba(255,255,255,0.72)" />
                  <span style={{ fontFamily: T.SANS, fontSize: '13px', color: VALUE, fontWeight: 700 }}>
                    {tool.name}
                  </span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                  {recommendation.source}
                  <ArrowUpRight size={11} />
                </span>
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.55 }}>
                {recommendation.reason}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '999px',
                    border: `1px solid ${BORDER}`,
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.76)',
                    fontFamily: T.MONO,
                    fontSize: '10px',
                  }}
                >
                  {targetFreshness?.status ?? 'not-run'}
                </span>
                <span style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, lineHeight: 1.5 }}>
                  {targetFreshness?.summary ?? 'No execution integrity signal yet.'}
                </span>
              </div>
            </Link>
          );
        }) : (
          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
            No downstream decision trace yet. Run Analyze or a stage tool to generate explicit next-step logic.
          </div>
        )}
      </div>
    </section>
  );
}
