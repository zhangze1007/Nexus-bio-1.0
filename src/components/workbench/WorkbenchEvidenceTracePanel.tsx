'use client';

import { useMemo } from 'react';
import { ArrowRight, BookMarked, FlaskConical, ShieldAlert, Workflow } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { getDependencyTrace } from '../tools/shared/workbenchGraph';
import { getAuthorityTier } from './workbenchTrust';
import { PATHD_THEME } from './workbenchTheme';
import { tryGetToolContract } from '../../services/workflowRegistry';
import {
  GOLDEN_PATH_TOOL_IDS,
  type ToolId,
} from '../../domain/workflowContract';
import { evaluateToolContract } from '../../services/workflowContractEvaluator';
import type { WorkbenchToolPayloadMap } from '../../store/workbenchPayloads';

interface WorkbenchEvidenceTracePanelProps {
  toolId?: string | null;
  title?: string;
}

const BORDER = PATHD_THEME.panelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;

export default function WorkbenchEvidenceTracePanel({
  toolId = null,
  title = 'Evidence to Result Trace',
}: WorkbenchEvidenceTracePanelProps) {
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const project = useWorkbenchStore((s) => s.project);
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);
  const toolPayloads = useWorkbenchStore((s) => s.toolPayloads);

  // Phase-1 — Workflow Control Plane: list missing pieces the next
  // golden-path step would require. We walk the path; the first tool whose
  // contract is unsatisfied (no payload, validity below floor, or
  // confidence below threshold) becomes the "current" step, and we
  // enumerate the gaps.
  const gateRow = useMemo(() => {
    for (const tool of GOLDEN_PATH_TOOL_IDS) {
      const contract = tryGetToolContract(tool);
      if (!contract) continue;
      const payload = toolPayloads[tool as keyof WorkbenchToolPayloadMap];
      const evaluation = evaluateToolContract(contract, payload, {
        evidence: evidenceItems.map((item) => ({ sourceKind: item.sourceKind })),
        projectIsDemo: Boolean(project?.isDemo),
      });
      if (
        !evaluation.status.hasRequiredOutputs ||
        !evaluation.validityOk ||
        !evaluation.confidenceOk ||
        !evaluation.uncertaintyOk ||
        evaluation.isSimulated
      ) {
        const evidenceShort =
          contract.evidenceRequired.minItems > evidenceItems.length;
        const haveKinds = new Set(evidenceItems.map((e) => e.sourceKind));
        const missingKinds = contract.evidenceRequired.kinds.filter((k) => !haveKinds.has(k));
        return {
          toolId: tool as ToolId,
          missingPayload: !evaluation.status.hasRequiredOutputs,
          missingOutputPaths: evaluation.missingOutputPaths,
          validityShort: evaluation.status.hasRequiredOutputs && !evaluation.validityOk ? evaluation.status.validity : null,
          floor: contract.validityBaseline.floor,
          simulated: evaluation.isSimulated,
          reason: evaluation.reason,
          evidenceShort,
          missingKinds,
          minItems: contract.evidenceRequired.minItems,
          haveItems: evidenceItems.length,
        };
      }
    }
    return null;
  }, [evidenceItems, project?.isDemo, toolPayloads]);

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

      {/* Phase-1 — Workflow Control Plane: missing-evidence / next-gate row.
          Renders only when the supervisor sees a gap. */}
      {gateRow && (
        <div
          style={{
            borderRadius: '14px',
            border: `1px solid ${BORDER}`,
            background: PATHD_THEME.panelGradientSoft,
            padding: '10px 12px',
            display: 'grid',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <ShieldAlert size={13} color={PATHD_THEME.coral} />
            <span style={{ fontFamily: T.SANS, fontSize: '12px', color: VALUE, fontWeight: 700 }}>
              Next step needs:
            </span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.sky }}>
              {gateRow.toolId.toUpperCase()}
            </span>
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.55 }}>
            {gateRow.missingPayload && `Run ${gateRow.toolId.toUpperCase()} to publish required outputs.`}
            {!gateRow.missingPayload && gateRow.validityShort && (
              <>Upgrade {gateRow.toolId.toUpperCase()} validity from {gateRow.validityShort} to {gateRow.floor}.</>
            )}
            {!gateRow.missingPayload && !gateRow.validityShort && gateRow.simulated && (
              <>Demo/simulated output cannot satisfy closed-loop execution.</>
            )}
            {!gateRow.missingPayload && !gateRow.validityShort && !gateRow.simulated && gateRow.reason}
          </div>
          {gateRow.evidenceShort && (
            <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
              evidence · {gateRow.haveItems}/{gateRow.minItems}
              {gateRow.missingKinds.length > 0 && ` · missing ${gateRow.missingKinds.join(', ')}`}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div
          style={{
            borderRadius: '16px',
            border: `1px solid ${BORDER}`,
            background: PATHD_THEME.panelGradientSoft,
            padding: '12px 14px',
            display: 'grid',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookMarked size={14} color={PATHD_THEME.blue} />
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
            background: PATHD_THEME.panelGradientSoft,
            padding: '12px 14px',
            display: 'grid',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FlaskConical size={14} color={PATHD_THEME.indigo} />
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
            background: PATHD_THEME.panelGradientSoft,
            padding: '12px 14px',
            display: 'grid',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Workflow size={14} color={PATHD_THEME.orange} />
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
                    border: `1px solid ${entry.run ? PATHD_THEME.chipBorder : BORDER}`,
                    background: entry.run ? PATHD_THEME.chipCool : PATHD_THEME.chipNeutral,
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
                      background: PATHD_THEME.chipNeutral,
                      color: LABEL,
                      fontFamily: T.MONO,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {getAuthorityTier(entry.run)}
                  </span>
                )}
                {index < executionTrace.length - 1 && <ArrowRight size={12} color={PATHD_THEME.orange} />}
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
