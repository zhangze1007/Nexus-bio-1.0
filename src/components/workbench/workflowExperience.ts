import { GOLDEN_PATH_TOOL_IDS, type ToolId } from '../../domain/workflowContract';
import { getGoldenPathSuccessor, tryGetToolContract } from '../../services/workflowRegistry';
import type { WorkbenchRunArtifact, WorkbenchWorkflowControlSnapshot } from '../../store/workbenchTypes';
import { TOOL_BY_ID } from '../tools/shared/toolRegistry';

export type WorkflowExperienceStatus =
  | 'pending'
  | 'ready'
  | 'current'
  | 'complete'
  | 'blocked'
  | 'demoOnly'
  | 'humanGate'
  | 'next';

export interface WorkflowDashboardItem {
  id: string;
  label: string;
  href?: string;
  status: WorkflowExperienceStatus;
  detail: string;
}

export interface WorkflowHandoffSummary {
  toolId: string;
  upstreamRows: Array<{
    toolId: ToolId;
    artifactPath: string;
    rationale: string;
    present: boolean;
    status: string;
  }>;
  nextToolId: ToolId | null;
  nextToolName: string | null;
  nextHref: string | null;
  nextArtifactPath: string | null;
  nextArtifactPresent: boolean;
  availability: 'available' | 'blocked' | 'demoOnly' | 'humanGate' | 'pending';
  reason: string;
}

const COMPLETED_BY_MACHINE_STATE: Record<WorkbenchWorkflowControlSnapshot['machineState'], number> = {
  idle: 0,
  targetSet: 0,
  pathdReady: 1,
  fbasimReady: 2,
  catdesReady: 3,
  dynconReady: 4,
  cellfreeReady: 5,
  dbtlCommitted: 6,
};

function latestRunFor(toolId: string, runArtifacts: WorkbenchRunArtifact[]) {
  return runArtifacts.find((artifact) => artifact.toolId === toolId) ?? null;
}

function statusFromRun(run: WorkbenchRunArtifact | null) {
  return run?.status ?? (run ? 'ok' : 'missing');
}

function gateStatus(status: WorkbenchWorkflowControlSnapshot['status']): WorkflowExperienceStatus {
  if (status === 'blocked') return 'blocked';
  if (status === 'gated') return 'humanGate';
  if (status === 'demoOnly') return 'demoOnly';
  return 'current';
}

export function workflowStatusLabel(status: string): string {
  if (status === 'demoOnly') return 'DemoOnly';
  if (status === 'humanGate' || status === 'gated') return 'HumanGate';
  return status;
}

export function buildWorkflowDashboardItems(
  workflow: WorkbenchWorkflowControlSnapshot,
  runArtifacts: WorkbenchRunArtifact[],
): WorkflowDashboardItem[] {
  const completedCount = COMPLETED_BY_MACHINE_STATE[workflow.machineState] ?? 0;
  const items: WorkflowDashboardItem[] = [
    {
      id: 'target',
      label: 'Target Input',
      href: '/analyze',
      status: workflow.machineState === 'idle' ? 'current' : 'complete',
      detail: workflow.machineState === 'idle' ? 'Set a target product to start PATHD.' : 'Target product is set.',
    },
  ];

  GOLDEN_PATH_TOOL_IDS.forEach((toolId, index) => {
    const tool = TOOL_BY_ID[toolId];
    const run = latestRunFor(toolId, runArtifacts);
    let status: WorkflowExperienceStatus = 'pending';
    if (index < completedCount) status = 'complete';
    if (workflow.currentToolId === toolId) status = gateStatus(workflow.status);
    if (workflow.nextRecommendedNode === toolId && status === 'pending') status = 'next';
    if (run?.status === 'demoOnly') status = 'demoOnly';
    if (run?.status === 'blocked') status = 'blocked';
    if (run?.status === 'gated') status = 'humanGate';

    items.push({
      id: toolId,
      label: tool?.shortLabel ?? toolId.toUpperCase(),
      href: tool?.href,
      status,
      detail: run
        ? `${workflowStatusLabel(run.status ?? 'ready')} · ${run.summary}`
        : workflow.nextRecommendedNode === toolId
          ? workflow.explanation
          : 'No artifact published yet.',
    });
  });

  items.push({
    id: 'nexai',
    label: 'NEXAI',
    href: TOOL_BY_ID.nexai?.href,
    status: workflow.machineState === 'dbtlCommitted' ? 'next' : 'pending',
    detail: workflow.machineState === 'dbtlCommitted'
      ? 'Ready to explain the next DBTL cycle recommendation.'
      : 'Supervisor context updates as workflow evidence accumulates.',
  });

  return items;
}

export function buildWorkflowHandoffSummary(
  toolId: string,
  workflow: WorkbenchWorkflowControlSnapshot,
  runArtifacts: WorkbenchRunArtifact[],
): WorkflowHandoffSummary | null {
  const contract = tryGetToolContract(toolId);
  if (!contract || contract.contractScope === 'alias') return null;

  const upstreamRows = contract.requiredInputs
    .filter((ref) => ref.required)
    .map((ref) => {
      const run = latestRunFor(ref.toolId, runArtifacts);
      return {
        toolId: ref.toolId,
        artifactPath: ref.payloadPath,
        rationale: ref.rationale,
        present: statusFromRun(run) === 'ok',
        status: statusFromRun(run),
      };
    });

  const nextToolId = getGoldenPathSuccessor(contract.toolId);
  const nextContract = nextToolId ? tryGetToolContract(nextToolId) : undefined;
  const nextRequirement = nextContract?.requiredInputs.find((ref) => ref.toolId === contract.toolId && ref.required) ?? null;
  const currentRun = latestRunFor(toolId, runArtifacts);
  const currentRunStatus = statusFromRun(currentRun);
  const blockedUpstream = upstreamRows.find((row) => !row.present);
  const blocksCurrentWorkflow =
    workflow.currentToolId === contract.toolId ||
    workflow.nextRecommendedNode === contract.toolId ||
    workflow.latestRunToolId === contract.toolId;

  const availability: WorkflowHandoffSummary['availability'] =
    blockedUpstream || currentRunStatus === 'blocked'
      ? 'blocked'
      : currentRunStatus === 'demoOnly' || currentRunStatus === 'simulated'
        ? 'demoOnly'
        : currentRunStatus === 'gated' || (blocksCurrentWorkflow && workflow.humanGateRequired)
          ? 'humanGate'
          : currentRunStatus === 'ok'
            ? 'available'
            : 'pending';

  const nextTool = nextToolId ? TOOL_BY_ID[nextToolId] : null;
  const reason =
    blockedUpstream
      ? `${contract.toolId.toUpperCase()} needs ${blockedUpstream.toolId.toUpperCase()} ${blockedUpstream.artifactPath} before this step can advance.`
      : nextRequirement
        ? `${nextTool?.shortLabel ?? nextToolId?.toUpperCase()} consumes ${nextRequirement.payloadPath}: ${nextRequirement.rationale}`
        : workflow.explanation;

  return {
    toolId,
    upstreamRows,
    nextToolId,
    nextToolName: nextTool?.name ?? null,
    nextHref: nextTool?.href ?? null,
    nextArtifactPath: nextRequirement?.payloadPath ?? contract.outputArtifacts[0]?.payloadPath ?? null,
    nextArtifactPresent: currentRunStatus === 'ok',
    availability,
    reason,
  };
}
