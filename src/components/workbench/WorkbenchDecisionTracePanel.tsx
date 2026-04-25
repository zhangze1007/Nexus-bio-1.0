'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowUpRight, Compass, ShieldCheck, WandSparkles, Workflow } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';
import { getFreshnessMap, getAuthoritySummary, getAuthorityTier, getToolFreshness } from './workbenchTrust';
import { PATHD_THEME } from './workbenchTheme';
import {
  GOLDEN_PATH_TOOL_IDS,
  meetsValidityFloor,
  type ToolId,
} from '../../domain/workflowContract';
import { tryGetToolContract } from '../../services/workflowRegistry';
import { evaluateToolContract } from '../../services/workflowContractEvaluator';
import {
  buildWorkflowDecision,
  type WorkflowDecisionStatus,
} from '../../services/workflowSupervisor';
import type { WorkflowStateValue, WorkflowToolStatus } from '../../services/workflowStateMachine';
import type { WorkbenchToolPayloadMap } from '../../store/workbenchPayloads';

interface WorkbenchDecisionTracePanelProps {
  toolId?: string | null;
  title?: string;
  limit?: number;
}

const BORDER = PATHD_THEME.panelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;

// Phase-1 — Workflow Control Plane: derive a WorkflowToolStatus snapshot
// for one tool by reading its live payload. Returns null when the tool
// has no payload yet (which the supervisor reads as "missing").
function statusFromPayload(
  toolId: ToolId,
  payload: WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap] | undefined,
  projectIsDemo: boolean,
): WorkflowToolStatus | undefined {
  if (!payload) return undefined;
  const contract = tryGetToolContract(toolId);
  if (!contract) return undefined;
  return evaluateToolContract(contract, payload, { projectIsDemo }).status;
}

// Walk the golden path and return the FSM state that matches the
// furthest step whose payload satisfies its contract floor.
function inferMachineState(
  toolStatus: Partial<Record<ToolId, WorkflowToolStatus>>,
  hasTarget: boolean,
): WorkflowStateValue {
  if (!hasTarget) return 'idle';
  const STATE_AFTER: Record<string, WorkflowStateValue> = {
    pathd: 'pathdReady',
    fbasim: 'fbasimReady',
    catdes: 'catdesReady',
    dyncon: 'dynconReady',
    cellfree: 'cellfreeReady',
    dbtlflow: 'dbtlCommitted',
  };
  let last: WorkflowStateValue = 'targetSet';
  for (const tool of GOLDEN_PATH_TOOL_IDS) {
    const status = toolStatus[tool];
    const contract = tryGetToolContract(tool);
    if (!status || !contract) break;
    const validityOk =
      status.validity !== null &&
      meetsValidityFloor(status.validity, contract.validityBaseline.floor);
    const confidenceOk =
      contract.confidencePolicy.minToAdvance === null ||
      (status.confidence !== null &&
        status.confidence >= contract.confidencePolicy.minToAdvance);
    const uncertaintyOk =
      !contract.uncertaintyPolicy.unboundedIsGate || status.uncertainty != null;
    if (!status.hasRequiredOutputs || status.isSimulated || !validityOk || !confidenceOk || !uncertaintyOk) break;
    last = STATE_AFTER[tool];
  }
  return last;
}

function statusColor(status: WorkflowDecisionStatus): string {
  switch (status) {
    case 'complete': return PATHD_THEME.mint;
    case 'ready': return PATHD_THEME.sky;
    case 'blocked': return PATHD_THEME.coral;
    case 'gated': return PATHD_THEME.apricot;
    case 'idle':
    default: return PATHD_THEME.label;
  }
}

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
  const toolPayloads = useWorkbenchStore((s) => s.toolPayloads);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);

  // Phase-1 — Workflow Control Plane: derive a supervisor decision from
  // the live store snapshot. Pure function; rebuilds whenever tool
  // payloads or evidence change.
  const workflowDecision = useMemo(() => {
    const toolStatus: Partial<Record<ToolId, WorkflowToolStatus>> = {};
    const projectIsDemo = Boolean(project?.isDemo);
    for (const tool of GOLDEN_PATH_TOOL_IDS) {
      const status = statusFromPayload(tool, toolPayloads[tool as keyof WorkbenchToolPayloadMap], projectIsDemo);
      if (status) toolStatus[tool] = status;
    }
    const hasTarget = Boolean(project?.targetProduct || analyzeArtifact?.targetProduct);
    const machineState = inferMachineState(toolStatus, hasTarget);
    return buildWorkflowDecision({
      machineState,
      targetProduct: project?.targetProduct ?? analyzeArtifact?.targetProduct ?? null,
      toolStatus,
      evidence: evidenceItems.map((item) => ({ id: item.id, sourceKind: item.sourceKind })),
      // Phase-1: only PATHD and FBASim have real Axon adapters today.
      isAdapterRegistered: (id) => id === 'pathd' || id === 'fbasim',
    });
  }, [analyzeArtifact?.targetProduct, evidenceItems, project?.isDemo, project?.targetProduct, toolPayloads]);

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
        <Compass size={14} color={PATHD_THEME.blue} />
        <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </div>
      </div>

      {/* Phase-1 — Workflow Control Plane status row. Rendered above the
          existing decision basis so the supervisor's view is visible
          before the evidence rationale. */}
      <div
        style={{
          borderRadius: '16px',
          border: `1px solid ${BORDER}`,
          background: PATHD_THEME.panelGradientSoft,
          padding: '12px 14px',
          display: 'grid',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Workflow size={13} color={statusColor(workflowDecision.status)} />
          <span style={{ fontFamily: T.SANS, fontSize: '13px', color: VALUE, fontWeight: 700 }}>
            Workflow state
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '999px',
              border: `1px solid ${BORDER}`,
              background: PATHD_THEME.chipNeutral,
              color: statusColor(workflowDecision.status),
              fontFamily: T.MONO,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {workflowDecision.status}
          </span>
          {workflowDecision.humanGateRequired && (
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.apricot }}>
              human gate required
            </span>
          )}
          {workflowDecision.nextNodeIsContractOnly && (
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
              next: contract-only
            </span>
          )}
        </div>
        <div style={{ fontFamily: T.SANS, fontSize: '12px', color: LABEL, lineHeight: 1.55 }}>
          {workflowDecision.explanation}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
          {workflowDecision.currentToolId && (
            <span>current · {workflowDecision.currentToolId.toUpperCase()}</span>
          )}
          {workflowDecision.nextRecommendedNode && (
            <span>next · {workflowDecision.nextRecommendedNode.toUpperCase()}</span>
          )}
          {workflowDecision.confidence !== null && (
            <span>conf · {workflowDecision.confidence.toFixed(2)}</span>
          )}
          {workflowDecision.validity && (
            <span>validity · {workflowDecision.validity}</span>
          )}
          {workflowDecision.missingEvidence.minRequired > 0 && (
            <span>
              evidence · {workflowDecision.missingEvidence.have}/{workflowDecision.missingEvidence.minRequired}
            </span>
          )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <ShieldCheck size={13} color={PATHD_THEME.orange} />
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
                background: PATHD_THEME.panelGradientSoft,
                padding: '12px 14px',
                display: 'grid',
                gap: '6px',
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <WandSparkles size={13} color={PATHD_THEME.indigo} />
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
                    background: PATHD_THEME.chipNeutral,
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
