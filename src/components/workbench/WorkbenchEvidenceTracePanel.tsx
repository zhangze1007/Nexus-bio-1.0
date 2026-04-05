'use client';

import { useMemo } from 'react';
import { ArrowRight, BookMarked, FlaskConical, Workflow } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { getDependencyTrace } from '../tools/shared/workbenchGraph';
import { getAuthorityTier } from './workbenchTrust';

interface WorkbenchEvidenceTracePanelProps {
  toolId?: string | null;
  title?: string;
}

const BORDER = 'rgba(255,255,255,0.08)';
const LABEL = 'rgba(255,255,255,0.42)';
const VALUE = 'rgba(255,255,255,0.88)';

export default function WorkbenchEvidenceTracePanel({
  toolId = null,
  title = 'Evidence to Result Trace',
}: WorkbenchEvidenceTracePanelProps) {
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);

  const evidenceTrace = useMemo(() => {
    const traceIds = analyzeArtifact?.evidenceTraceIds?.length ? analyzeArtifact.evidenceTraceIds : selectedEvidenceIds;
    return evidenceItems.filter((item) => traceIds.includes(item.id)).slice(0, 3);
  }, [analyzeArtifact?.evidenceTraceIds, evidenceItems, selectedEvidenceIds]);

  const executionTrace = useMemo(() => {
    const traceToolIds = toolId ? getDependencyTrace(toolId) : analyzeArtifact?.recommendedNextTools ?? [];
    const orderedToolIds = traceToolIds.length
      ? traceToolIds
      : runArtifacts.slice(0, 4).map((artifact) => artifact.toolId);
    const uniqueToolIds = Array.from(new Set(orderedToolIds));

    return uniqueToolIds.slice(0, 5).map((id) => ({
      toolId: id,
      tool: TOOL_BY_ID[id],
      run: runArtifacts.find((artifact) => artifact.toolId === id),
    }));
  }, [analyzeArtifact?.recommendedNextTools, runArtifacts, toolId]);

  return (
    <section style={{ display: 'grid', gap: '10px' }}>
      <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>

      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookMarked size={14} color="rgba(255,255,255,0.72)" />
            <span style={{ fontFamily: T.SANS, fontSize: '13px', color: VALUE, fontWeight: 700 }}>
              Evidence Bundle
            </span>
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
            {evidenceTrace.length
              ? evidenceTrace.map((item) => item.title).join(' · ')
              : 'No evidence bundle has been attached yet.'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FlaskConical size={14} color="rgba(255,255,255,0.72)" />
            <span style={{ fontFamily: T.SANS, fontSize: '13px', color: VALUE, fontWeight: 700 }}>
              Analyze Artifact
            </span>
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, lineHeight: 1.55 }}>
            {analyzeArtifact?.targetProduct ?? 'Pending'}
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
            {analyzeArtifact
              ? `${analyzeArtifact.bottleneckAssumptions[0]?.label ?? 'No leading bottleneck'} · ${analyzeArtifact.pathwayCandidates.length || 1} route(s)`
              : 'Run Analyze to create a structured handoff object.'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Workflow size={14} color="rgba(255,255,255,0.72)" />
            <span style={{ fontFamily: T.SANS, fontSize: '13px', color: VALUE, fontWeight: 700 }}>
              Execution Trace
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {executionTrace.length ? executionTrace.map((entry, index) => (
              <span key={`${entry.toolId}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '999px',
                    border: `1px solid ${entry.run ? 'rgba(158,215,199,0.22)' : BORDER}`,
                    background: entry.run ? 'rgba(158,215,199,0.10)' : 'rgba(255,255,255,0.03)',
                    color: VALUE,
                    fontFamily: T.MONO,
                    fontSize: '10px',
                  }}
                >
                  {entry.tool?.shortLabel ?? entry.toolId.toUpperCase()}
                </span>
                {entry.run && (
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${BORDER}`,
                      background: 'rgba(255,255,255,0.04)',
                      color: LABEL,
                      fontFamily: T.MONO,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {getAuthorityTier(entry.run)}
                  </span>
                )}
                {index < executionTrace.length - 1 && <ArrowRight size={12} color="rgba(255,255,255,0.38)" />}
              </span>
            )) : (
              <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
                No execution trace has been formed yet.
              </div>
            )}
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.6 }}>
            {executionTrace.find((entry) => entry.run)?.run?.summary ?? 'Execute a tool to create a result trace.'}
          </div>
        </div>
      </div>
    </section>
  );
}
