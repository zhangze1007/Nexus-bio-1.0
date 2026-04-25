/**
 * workflowSupervisor — deterministic explainer for the Workflow Control Plane.
 *
 * Replaces `noopAutonomyLoop` as the seam NEXAI consumes. Given a snapshot
 * of the workbench (contracts + machine state value + per-tool payloads +
 * evidence) the supervisor returns a structured decision:
 *
 *   - status: 'idle' | 'ready' | 'blocked' | 'gated' | 'complete'
 *   - currentToolId: which step the user is on
 *   - nextRecommendedNode: next golden-path tool, or null at terminal
 *   - missingEvidence: evidence the next step requires but doesn't have
 *   - confidence / uncertainty: numeric snapshot for the active tool
 *   - humanGateRequired: boolean derived from contract.humanGatePolicy
 *   - explanation: deterministic prose (NEXAI may paraphrase via Groq)
 *
 * Pure function. No fetches, no LLM call, no store access. Fully testable.
 */
import {
  GOLDEN_PATH_TOOL_IDS,
  meetsValidityFloor,
  type EvidenceSourceKind,
  type ToolId,
  type ValidityFloor,
} from '../domain/workflowContract';
import {
  GOLDEN_PATH_DONE_EVENT,
  type WorkflowStateValue,
  type WorkflowToolStatus,
} from './workflowStateMachine';
import {
  getGoldenPathPredecessor,
  getGoldenPathSuccessor,
  getToolContract,
} from './workflowRegistry';

export type WorkflowDecisionStatus =
  | 'idle'
  | 'ready'
  | 'blocked'
  | 'gated'
  | 'complete';

export interface WorkflowEvidenceLite {
  id: string;
  sourceKind?: EvidenceSourceKind | string;
}

export interface WorkflowSupervisorInput {
  machineState: WorkflowStateValue;
  targetProduct: string | null;
  /** Per-tool status produced from workbench payloads. */
  toolStatus: Partial<Record<ToolId, WorkflowToolStatus>>;
  /** Evidence currently in the bundle. */
  evidence: WorkflowEvidenceLite[];
  /** Adapter coverage. Tools without an adapter are still contract-defined. */
  isAdapterRegistered: (id: ToolId) => boolean;
}

export interface WorkflowDecision {
  status: WorkflowDecisionStatus;
  currentToolId: ToolId | null;
  nextRecommendedNode: ToolId | null;
  missingEvidence: {
    minRequired: number;
    have: number;
    kinds: EvidenceSourceKind[];
  };
  confidence: number | null;
  uncertainty: number | null;
  validity: ValidityFloor | null;
  humanGateRequired: boolean;
  /** True when the next recommended node has no real Axon adapter yet. */
  nextNodeIsContractOnly: boolean;
  explanation: string;
  /** Optional structured reason codes — useful for tests / telemetry. */
  reasonCodes: string[];
}

const STATE_TO_TOOL: Record<WorkflowStateValue, ToolId | null> = {
  idle: null,
  targetSet: 'pathd',
  pathdReady: 'fbasim',
  fbasimReady: 'catdes',
  catdesReady: 'dyncon',
  dynconReady: 'cellfree',
  cellfreeReady: 'dbtlflow',
  dbtlCommitted: null,
};

function describeMissingContract(toolId: ToolId, status: WorkflowToolStatus | undefined): string {
  const contract = getToolContract(toolId);
  const reasons: string[] = [];
  if (!status) {
    reasons.push(`no payload published for ${toolId.toUpperCase()}`);
  } else {
    if (!status.hasRequiredOutputs) reasons.push('required outputs missing');
    if (status.validity && !meetsValidityFloor(status.validity, contract.validityBaseline.floor)) {
      reasons.push(`validity ${status.validity} below floor ${contract.validityBaseline.floor}`);
    }
    if (
      contract.confidencePolicy.minToAdvance !== null &&
      (status.confidence === null || status.confidence < contract.confidencePolicy.minToAdvance)
    ) {
      reasons.push(`confidence below ${contract.confidencePolicy.minToAdvance}`);
    }
  }
  return reasons.join('; ');
}

function evidenceKindOf(item: WorkflowEvidenceLite): EvidenceSourceKind | null {
  if (!item.sourceKind) return null;
  const kinds: EvidenceSourceKind[] = ['literature', 'analysis', 'tool', 'system'];
  return kinds.includes(item.sourceKind as EvidenceSourceKind)
    ? (item.sourceKind as EvidenceSourceKind)
    : null;
}

export function buildWorkflowDecision(input: WorkflowSupervisorInput): WorkflowDecision {
  const reasonCodes: string[] = [];

  // Terminal: everything done.
  if (input.machineState === 'dbtlCommitted') {
    return {
      status: 'complete',
      currentToolId: 'dbtlflow',
      nextRecommendedNode: null,
      missingEvidence: { minRequired: 0, have: input.evidence.length, kinds: [] },
      confidence: input.toolStatus.dbtlflow?.confidence ?? null,
      uncertainty: null,
      validity: input.toolStatus.dbtlflow?.validity ?? null,
      humanGateRequired: getToolContract('dbtlflow').humanGatePolicy.requiredFor.length > 0,
      nextNodeIsContractOnly: false,
      explanation:
        'DBTL Learn cycle is committed. The next loop iteration must be initiated explicitly via LOOP_BACK.',
      reasonCodes: ['DBTL_COMMITTED'],
    };
  }

  // Idle: no target set, no current tool.
  if (input.machineState === 'idle') {
    return {
      status: 'idle',
      currentToolId: null,
      nextRecommendedNode: 'pathd',
      missingEvidence: { minRequired: 0, have: input.evidence.length, kinds: [] },
      confidence: null,
      uncertainty: null,
      validity: null,
      humanGateRequired: false,
      nextNodeIsContractOnly: !input.isAdapterRegistered('pathd'),
      explanation:
        'No target product set. Set a target via /research or /analyze, then run PATHD.',
      reasonCodes: ['NO_TARGET'],
    };
  }

  const currentToolId = STATE_TO_TOOL[input.machineState];
  if (!currentToolId) {
    return {
      status: 'idle',
      currentToolId: null,
      nextRecommendedNode: null,
      missingEvidence: { minRequired: 0, have: input.evidence.length, kinds: [] },
      confidence: null,
      uncertainty: null,
      validity: null,
      humanGateRequired: false,
      nextNodeIsContractOnly: false,
      explanation: 'Workflow is in a state with no current tool.',
      reasonCodes: ['NO_CURRENT_TOOL'],
    };
  }

  const contract = getToolContract(currentToolId);
  const status = input.toolStatus[currentToolId];

  // Evidence gate. The supervisor checks the evidence requirement of the
  // CURRENT tool, since that's what the user must satisfy next.
  const evidenceReq = contract.evidenceRequired;
  const evidenceHave = input.evidence.length;
  const haveKinds = new Set(
    input.evidence.map((e) => evidenceKindOf(e)).filter((k): k is EvidenceSourceKind => Boolean(k)),
  );
  const missingKinds = evidenceReq.kinds.filter((k) => !haveKinds.has(k));
  const evidenceShort = evidenceHave < evidenceReq.minItems;

  // Block if predecessor (golden path) hasn't published a satisfactory
  // payload — this happens when a downstream tool is opened directly.
  const predecessor = getGoldenPathPredecessor(currentToolId);
  if (predecessor) {
    const predStatus = input.toolStatus[predecessor];
    const predContract = getToolContract(predecessor);
    const predOk =
      predStatus?.hasRequiredOutputs &&
      predStatus.validity !== null &&
      meetsValidityFloor(predStatus.validity, predContract.validityBaseline.floor) &&
      (predContract.confidencePolicy.minToAdvance === null ||
        (predStatus.confidence !== null &&
          predStatus.confidence >= predContract.confidencePolicy.minToAdvance));
    if (!predOk) {
      reasonCodes.push('UPSTREAM_BLOCKED');
      return {
        status: 'blocked',
        currentToolId,
        nextRecommendedNode: predecessor,
        missingEvidence: {
          minRequired: evidenceReq.minItems,
          have: evidenceHave,
          kinds: missingKinds,
        },
        confidence: status?.confidence ?? null,
        uncertainty: null,
        validity: status?.validity ?? null,
        humanGateRequired: contract.humanGatePolicy.requiredFor.length > 0,
        nextNodeIsContractOnly: !input.isAdapterRegistered(predecessor),
        explanation: `${currentToolId.toUpperCase()} cannot advance: upstream ${predecessor.toUpperCase()} is missing — ${describeMissingContract(predecessor, predStatus)}.`,
        reasonCodes,
      };
    }
  }

  // Gated by evidence requirement.
  if (evidenceShort && evidenceReq.gateOnMissing) {
    reasonCodes.push('EVIDENCE_GATE');
    return {
      status: 'gated',
      currentToolId,
      nextRecommendedNode: currentToolId,
      missingEvidence: {
        minRequired: evidenceReq.minItems,
        have: evidenceHave,
        kinds: missingKinds,
      },
      confidence: status?.confidence ?? null,
      uncertainty: null,
      validity: status?.validity ?? null,
      humanGateRequired: true,
      nextNodeIsContractOnly: !input.isAdapterRegistered(currentToolId),
      explanation: `${currentToolId.toUpperCase()} requires ≥${evidenceReq.minItems} evidence items (${evidenceReq.kinds.join(', ')}). Currently have ${evidenceHave}.`,
      reasonCodes,
    };
  }

  // Current tool not yet satisfying its own contract.
  const currentContractOk =
    status?.hasRequiredOutputs &&
    status.validity !== null &&
    meetsValidityFloor(status.validity, contract.validityBaseline.floor) &&
    (contract.confidencePolicy.minToAdvance === null ||
      (status.confidence !== null &&
        status.confidence >= contract.confidencePolicy.minToAdvance));

  if (!currentContractOk) {
    reasonCodes.push('CURRENT_TOOL_NOT_READY');
    return {
      status: 'ready',
      currentToolId,
      nextRecommendedNode: currentToolId,
      missingEvidence: {
        minRequired: evidenceReq.minItems,
        have: evidenceHave,
        kinds: missingKinds,
      },
      confidence: status?.confidence ?? null,
      uncertainty: null,
      validity: status?.validity ?? null,
      humanGateRequired: contract.humanGatePolicy.requiredFor.length > 0,
      nextNodeIsContractOnly: !input.isAdapterRegistered(currentToolId),
      explanation: status
        ? `Run ${currentToolId.toUpperCase()} to satisfy: ${describeMissingContract(currentToolId, status)}.`
        : `Run ${currentToolId.toUpperCase()} — ${contract.primaryIntent} for the active target.`,
      reasonCodes,
    };
  }

  // Current tool is satisfied — recommend the successor.
  const successor = getGoldenPathSuccessor(currentToolId);
  reasonCodes.push('CURRENT_TOOL_SATISFIED');
  return {
    status: 'ready',
    currentToolId,
    nextRecommendedNode: successor,
    missingEvidence: {
      minRequired: evidenceReq.minItems,
      have: evidenceHave,
      kinds: missingKinds,
    },
    confidence: status?.confidence ?? null,
    uncertainty: null,
    validity: status?.validity ?? null,
    humanGateRequired:
      successor !== null &&
      getToolContract(successor).humanGatePolicy.requiredFor.length > 0,
    nextNodeIsContractOnly: successor !== null && !input.isAdapterRegistered(successor),
    explanation: successor
      ? `${currentToolId.toUpperCase()} is satisfied. Next: ${successor.toUpperCase()} — ${getToolContract(successor).primaryIntent}.`
      : `${currentToolId.toUpperCase()} is the terminal step in the golden path.`,
    reasonCodes,
  };
}

/** Compact one-line summary used by status bars / sidebars. */
export function summariseDecision(decision: WorkflowDecision): string {
  const tool = decision.currentToolId ? decision.currentToolId.toUpperCase() : 'IDLE';
  const next = decision.nextRecommendedNode
    ? `→ ${decision.nextRecommendedNode.toUpperCase()}`
    : '';
  const gate = decision.humanGateRequired ? ' · human gate' : '';
  const contractOnly = decision.nextNodeIsContractOnly ? ' · contract-only' : '';
  return `${decision.status.toUpperCase()} · ${tool} ${next}${gate}${contractOnly}`.trim();
}

/** Convenience: every event the FSM accepts to advance from `state`. */
export function advanceEventNameForState(state: WorkflowStateValue): string | null {
  const tool = STATE_TO_TOOL[state];
  if (!tool) return null;
  const idx = GOLDEN_PATH_TOOL_IDS.indexOf(tool as never);
  if (idx < 0) return null;
  return GOLDEN_PATH_DONE_EVENT[GOLDEN_PATH_TOOL_IDS[idx]];
}
