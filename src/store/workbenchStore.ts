'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BottleneckEnzyme, DeNovoDesignStrategy, PathwayEdge, PathwayNode } from '../types';
import type { WorkflowArtifact } from '../domain/workflowArtifact';
import { deriveAnalyzeCompatibilityProjection } from '../domain/workflowArtifactAdapters';
import type { WorkbenchToolPayloadMap } from './workbenchPayloads';
import {
  sanitizeWorkbenchHistory,
  sanitizeWorkbenchAuditLog,
  sanitizeWorkbenchBackendMeta,
  sanitizeWorkbenchCollaborators,
  sanitizeWorkbenchExperimentRecords,
  sanitizeWorkbenchState,
} from './workbenchValidation';
import {
  getNextToolIds,
  getStageForTool,
  type WorkbenchStageId,
} from '../components/tools/shared/workbenchConfig';
import { getUpstreamToolIds } from '../components/tools/shared/workbenchGraph';
import { TOOL_ASSUMPTIONS } from '../components/tools/shared/toolAssumptions';
import { buildExecutionSnapshot } from '../components/workbench/workbenchExecution';
import { tryGetToolContract } from '../services/workflowRegistry';
import { isAxonToolSupported } from '../services/axonAdapterRegistry';
import type { AxonTool } from '../services/AxonOrchestrator';
import {
  createWorkflowActor,
  GOLDEN_PATH_DONE_EVENT,
  type WorkflowActor,
  type WorkflowStateValue,
  type WorkflowToolStatus,
} from '../services/workflowStateMachine';
import { evaluateToolContract } from '../services/workflowContractEvaluator';
import { buildWorkflowDecision } from '../services/workflowSupervisor';
import { canPassToDownstream } from '../utils/runtimeGating';
import {
  GOLDEN_PATH_TOOL_IDS,
  meetsValidityFloor,
  type ToolId,
} from '../domain/workflowContract';
import type { WorkbenchRunStatus } from './workbenchTypes';
import { getToolValidity } from '../components/tools/shared/toolValidity';
import {
  evaluateWorkbenchPayloadAdmission,
  inferAdmissionInputFromPayload,
} from '../services/workbenchPayloadAdmission';
import {
  collectProvenanceIds,
  withProvenanceSync,
} from '../services/provenanceMiddleware';
import type {
  AxonRunRecord,
  EvidenceSourceKind,
  NextStepRecommendation,
  StageCheckpoint,
  StructuredAnalysisPayload,
  WorkbenchAnalyzeArtifact,
  WorkbenchAxonLogEntry,
  WorkbenchAxonPlanRecord,
  WorkbenchBackendMeta,
  WorkbenchCanonicalState,
  WorkbenchCollaborator,
  WorkbenchEvidenceItem,
  WorkbenchExperimentRecord,
  WorkbenchHistoryEntry,
  WorkbenchProjectBrief,
  WorkbenchWorkflowControlSnapshot,
  WorkbenchRunArtifact,
  WorkbenchSyncAuditEntry,
  WorkbenchToolRun,
} from './workbenchTypes';

export type {
  AxonRunRecord,
  WorkbenchAxonLogEntry,
  WorkbenchAxonPlanRecord,
  WorkbenchAxonPlanStepRecord,
  BottleneckAssumption,
  EnzymeCandidateSummary,
  EvidenceSourceKind,
  NextStepRecommendation,
  PathwayCandidateSummary,
  StageCheckpoint,
  StructuredAnalysisPayload,
  WorkbenchAnalyzeArtifact,
  WorkbenchCanonicalState,
  WorkbenchEvidenceItem,
  WorkbenchHistoryEntry,
  WorkbenchProjectBrief,
  WorkbenchWorkflowControlSnapshot,
  WorkbenchRunArtifact,
  WorkbenchToolRun,
} from './workbenchTypes';
export type {
  ProductSourcePage,
  ScientificStage,
  WorkflowArtifact,
  WorkflowArtifactStatus,
  WorkflowEvidencePacket,
} from '../domain/workflowArtifact';

interface WorkbenchState extends WorkbenchCanonicalState {
  currentToolId: string | null;
  currentStageId: WorkbenchStageId | null;
  backendMeta: WorkbenchBackendMeta | null;
  collaborators: WorkbenchCollaborator[];
  experimentRecords: WorkbenchExperimentRecord[];
  axonRuns: AxonRunRecord[];
  axonLogs: WorkbenchAxonLogEntry[];
  axonPlan: WorkbenchAxonPlanRecord | null;
  syncAuditLog: WorkbenchSyncAuditEntry[];
  historyLog: WorkbenchHistoryEntry[];
  syncStatus: 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'conflict';
  syncError: string | null;
  hydratedFromServer: boolean;
  lastServerSyncAt: number | null;
  lastServerSyncedRevision: number;
  artifactLoadState: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  artifactLoadError: string | null;
  artifactRequestedId: string | null;
  ensureProject: (seed?: Partial<WorkbenchProjectBrief>) => void;
  upsertEvidence: (item: Omit<WorkbenchEvidenceItem, 'id' | 'savedAt'>, options?: { select?: boolean }) => string;
  toggleEvidenceSelection: (id: string) => void;
  prepareAnalyzeFromEvidence: (ids?: string[]) => string;
  setDraftAnalyzeInput: (text: string) => void;
  persistWorkflowArtifact: (artifact: WorkflowArtifact) => Promise<WorkflowArtifact>;
  visitTool: (toolId: string | null) => void;
  addToolRun: (run: Omit<WorkbenchToolRun, 'id' | 'createdAt' | 'stageId'> & { stageId?: WorkbenchStageId | null }) => void;
  appendAxonRun: (record: AxonRunRecord) => void;
  clearAxonRuns: () => void;
  appendAxonLog: (entry: WorkbenchAxonLogEntry) => void;
  clearAxonLogs: () => void;
  setAxonPlan: (plan: WorkbenchAxonPlanRecord | null) => void;
  updateAxonPlanStep: (
    planId: string,
    stepId: string,
    patch: Partial<WorkbenchAxonPlanRecord['steps'][number]>,
  ) => void;
  setToolPayload: <K extends keyof WorkbenchToolPayloadMap>(toolId: K, payload: WorkbenchToolPayloadMap[K]) => void;
  /**
   * Phase-2B.1 (R2). Fires LOOP_BACK on the workflow actor (only valid
   * from `dbtlCommitted`), bumps `iteration` on the snapshot, and
   * clears golden-path tool payloads so the next iteration starts blank.
   * Evidence and project are preserved.
   */
  loopBackWorkflow: () => void;
  seedDemoProject: (toolId?: string | null) => void;
  applyCanonicalState: (state: WorkbenchCanonicalState, options?: { markHydrated?: boolean; synced?: boolean; conflict?: boolean }) => void;
  loadFromServer: (options?: { artifactId?: string | null }) => Promise<void>;
  syncToServer: (options?: { artifactId?: string | null }) => Promise<void>;
  resetWorkbench: () => void;
}

const STAGE_IDS: WorkbenchStageId[] = ['stage-1', 'stage-2', 'stage-3', 'stage-4'];
const WORKBENCH_SCHEMA_VERSION = 1;
const RUN_ARTIFACT_LIMIT = 160;
const TOOL_RUN_LIMIT = 120;
const AXON_RUN_LIMIT = 80;
const AXON_LOG_LIMIT = 400;
const WORKBENCH_ACTOR_KEY = 'nexus-bio:workbench-actor-id';
const DEFAULT_PROJECT_SYNC_SCOPE = 'default-workbench';
const PROVENANCE_MIDDLEWARE_TOOL_IDS = new Set(['pathd', 'dyncon', 'dbtlflow', 'catdes']);

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getWorkbenchActorId() {
  if (typeof window === 'undefined') return 'system';
  try {
    const existing = window.localStorage.getItem(WORKBENCH_ACTOR_KEY);
    if (existing && existing.trim().length > 0) return existing;
    const generated = typeof window.crypto?.randomUUID === 'function'
      ? `actor-${window.crypto.randomUUID()}`
      : createId('actor');
    window.localStorage.setItem(WORKBENCH_ACTOR_KEY, generated);
    return generated;
  } catch {
    return 'system';
  }
}

function stableSerialize(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function createEmptyCheckpoints(now = Date.now()): StageCheckpoint[] {
  return STAGE_IDS.map((id) => ({
    id,
    status: 'pending',
    summary: 'Waiting for project context',
    updatedAt: now,
  }));
}

function deriveTargetProduct(nodes: PathwayNode[]) {
  const preferred = [...nodes].reverse().find((node) => node.nodeType !== 'enzyme' && node.nodeType !== 'gene');
  return preferred?.label ?? nodes[nodes.length - 1]?.label ?? 'Target Product';
}

function composeEvidenceText(items: WorkbenchEvidenceItem[]) {
  return items
    .map((item) => {
      const meta = [
        item.source ?? item.journal,
        item.year,
        item.doi ? `DOI: ${item.doi}` : null,
      ].filter(Boolean).join(' · ');
      return [
        `Title: ${item.title}`,
        item.authors.length ? `Authors: ${item.authors.join(', ')}` : null,
        meta ? `Source: ${meta}` : null,
        item.abstract ? `Abstract: ${item.abstract}` : null,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n---\n\n');
}

function buildRecommendationsFromToolIds(toolIds: string[], source: NextStepRecommendation['source'], reason: string): NextStepRecommendation[] {
  return toolIds.map((toolId) => ({
    id: `${source}-${toolId}`,
    toolId,
    source,
    reason,
  }));
}

function buildCheckpoints(
  currentStageId: WorkbenchStageId | null,
  analyzeArtifact: WorkbenchAnalyzeArtifact | null,
  toolRuns: WorkbenchToolRun[],
): StageCheckpoint[] {
  const now = Date.now();
  const hasStageVisits = (stageId: WorkbenchStageId) => toolRuns.some((run) => run.stageId === stageId);

  return STAGE_IDS.map((stageId) => {
    if (stageId === 'stage-1' && analyzeArtifact) {
      return {
        id: stageId,
        status: currentStageId === stageId ? 'active' : 'complete',
        summary: `${analyzeArtifact.pathwayCandidates.length || 1} analyzed pathway candidate ready`,
        updatedAt: now,
      };
    }
    if (hasStageVisits(stageId)) {
      return {
        id: stageId,
        status: currentStageId === stageId ? 'active' : 'complete',
        summary: `Visited ${toolRuns.filter((run) => run.stageId === stageId).length} workbench step(s)`,
        updatedAt: now,
      };
    }
    return {
      id: stageId,
      status: currentStageId === stageId ? 'active' : 'pending',
      summary: currentStageId === stageId ? 'Current execution focus' : 'Not started',
      updatedAt: now,
    };
  });
}

function summarizePayload<K extends keyof WorkbenchToolPayloadMap>(toolId: K, payload: WorkbenchToolPayloadMap[K]) {
  if (!payload) return `${String(toolId).toUpperCase()} updated`;
  switch (toolId) {
    case 'pathd': {
      const data = payload as WorkbenchToolPayloadMap['pathd'];
      return `PATHD ${data.activeRouteLabel} · ${data.nodeCount} nodes · ${data.result.bottleneckCount} bottlenecks`;
    }
    case 'fbasim': {
      const data = payload as WorkbenchToolPayloadMap['fbasim'];
      return `FBA ${data.mode} run · growth ${data.result.growthRate.toFixed(3)} · feasible ${data.result.feasible ? 'yes' : 'no'}`;
    }
    case 'cethx': {
      const data = payload as WorkbenchToolPayloadMap['cethx'];
      return `Thermo ${data.pathway} · ΔG ${data.result.gibbsFreeEnergy.toFixed(1)} · η ${data.result.efficiency.toFixed(1)}%`;
    }
    case 'catdes': {
      const data = payload as WorkbenchToolPayloadMap['catdes'];
      return `Catalyst ${data.selectedEnzymeName} · ${data.designCount} designs · viable ${data.result.isViable ? 'yes' : 'no'}`;
    }
    case 'dyncon': {
      const data = payload as WorkbenchToolPayloadMap['dyncon'];
      return `Dynamic control · titer ${data.result.productTiter.toFixed(2)} · stable ${data.result.stable ? 'yes' : 'no'}`;
    }
    case 'cellfree': {
      const data = payload as WorkbenchToolPayloadMap['cellfree'];
      return `Cell-free ${data.targetConstruct} · ${data.result.totalProteinYield.toFixed(2)} mg/mL`;
    }
    case 'dbtlflow': {
      const data = payload as WorkbenchToolPayloadMap['dbtlflow'];
      const typedMetricCount = Object.values(data.result.feedback?.learnedMetrics ?? {})
        .filter((value) => typeof value === 'number')
        .length;
      const legacyLearnedCount = data.result.learnedParameters?.length ?? 0;
      return `DBTL ${data.proposedPhase} · pass ${data.passed ? 'yes' : 'no'} · ${typedMetricCount || legacyLearnedCount} learned`;
    }
    case 'proevol': {
      const data = payload as WorkbenchToolPayloadMap['proevol'];
      return `PROEVOL ${data.targetProtein} · round ${data.currentRound}/${data.totalRounds} · lead ${data.result.leadVariantName}`;
    }
    case 'gecair': {
      const data = payload as WorkbenchToolPayloadMap['gecair'];
      return `Gene circuit ${data.gateType} · output ${data.result.outputLevel.toFixed(2)}`;
    }
    case 'genmim': {
      const data = payload as WorkbenchToolPayloadMap['genmim'];
      return `Genome minimizer · ${data.result.selectedTargets} targets · risk ${data.result.offTargetRisk.toFixed(2)}`;
    }
    case 'multio': {
      const data = payload as WorkbenchToolPayloadMap['multio'];
      return `Multi-omics ${data.selectedGene} · ${data.result.significantCount} significant signals`;
    }
    case 'scspatial': {
      const data = payload as WorkbenchToolPayloadMap['scspatial'];
      return `Spatial ${data.highlightGene} · cluster ${data.result.highestYieldCluster}`;
    }
    case 'nexai': {
      const data = payload as WorkbenchToolPayloadMap['nexai'];
      return `Axon ${data.result.mode} · ${data.result.citations} citations · ${(data.result.confidence * 100).toFixed(0)}% confidence`;
    }
    default:
      return `${String(toolId).toUpperCase()} updated`;
  }
}

/**
 * Phase-1 — Workflow Control Plane. Returns true when the URL carries
 * `?demo=1` (or the env flag NEXT_PUBLIC_AUTO_DEMO=1). All other entry
 * paths must invoke `seedDemoProject` explicitly. Returning false on
 * the server (window undefined) preserves SSR safety.
 */
function shouldAutoSeedDemo(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.location.search.includes('demo=1')) return true;
  } catch {
    // Ignore — sandboxed iframes can throw on .search access.
  }
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AUTO_DEMO === '1') return true;
  return false;
}

function inferToolSimulation(payload: WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap]) {
  if (!payload) return true;
  if ('validity' in payload && payload.validity === 'demo') return true;
  if ('result' in payload && payload.result && typeof payload.result === 'object') {
    if ('mode' in payload.result) {
      return payload.result.mode === 'mock' || payload.result.mode === 'idle';
    }
  }
  return false;
}

type ContractStatusDecision = {
  status: WorkbenchRunStatus;
  blockingUpstreamToolIds: string[];
  reason: string;
  confidence: WorkbenchRunArtifact['confidence'];
  uncertainty: WorkbenchRunArtifact['uncertainty'];
  validity: WorkbenchRunArtifact['validity'];
  humanGateRequired: boolean;
};

function payloadValidity(payload: WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap]): WorkbenchRunArtifact['validity'] {
  if (!payload || typeof payload !== 'object' || !('validity' in payload)) return null;
  const validity = payload.validity;
  return validity === 'real' || validity === 'partial' || validity === 'demo' ? validity : null;
}

const EVIDENCE_SOURCE_KINDS: EvidenceSourceKind[] = ['literature', 'analysis', 'tool', 'system'];

function buildRunEvidenceSnapshot(
  state: Pick<WorkbenchState, 'evidenceItems' | 'selectedEvidenceIds'>,
  toolId: keyof WorkbenchToolPayloadMap,
): WorkbenchRunArtifact['evidenceSnapshot'] {
  const contract = tryGetToolContract(toolId as string);
  const count = state.evidenceItems.length;
  const selectedEvidenceIds = state.selectedEvidenceIds.filter((id) =>
    state.evidenceItems.some((item) => item.id === id),
  );
  const haveKinds = new Set(
    state.evidenceItems
      .map((item) => item.sourceKind)
      .filter((kind): kind is EvidenceSourceKind => EVIDENCE_SOURCE_KINDS.includes(kind as EvidenceSourceKind)),
  );
  const requiredKinds = contract?.evidenceRequired.kinds ?? [];
  const missingKinds = requiredKinds.filter((kind) => !haveKinds.has(kind));
  const minRequired = contract?.evidenceRequired.minItems ?? 0;
  const status =
    minRequired === 0 && requiredKinds.length === 0
      ? 'not-required'
      : count >= minRequired && missingKinds.length === 0
        ? 'satisfied'
        : 'missing';

  return {
    count,
    selectedCount: selectedEvidenceIds.length,
    evidenceItemIds: state.evidenceItems.map((item) => item.id),
    selectedEvidenceIds,
    status,
    missingEvidence: {
      minRequired,
      have: count,
      kinds: requiredKinds,
      missingKinds,
    },
  };
}

/**
 * Phase-1 — Workflow Control Plane. Given a tool id and the current
 * latest-run map, return the contract gate decision:
 *   - status: 'ok' | 'simulated' | 'blocked' | 'gated'
 *   - blockingUpstreamToolIds: which upstream tools are missing or below floor
 *   - reason: short prose for the UI
 *
 * Returns 'ok' when no contract is registered (sidecars without explicit
 * required inputs collapse to this path).
 */
function evaluateContractStatus(
  toolId: keyof WorkbenchToolPayloadMap,
  payload: WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap],
  latestByTool: Map<string, WorkbenchRunArtifact>,
  projectIsDemo: boolean,
): ContractStatusDecision {
  const contract = tryGetToolContract(toolId as string);
  if (!contract) {
    return {
      status: 'ok',
      blockingUpstreamToolIds: [],
      reason: '',
      confidence: null,
      uncertainty: null,
      validity: payloadValidity(payload),
      humanGateRequired: false,
    };
  }
  const blocking: string[] = [];
  const reasons: string[] = [];
  const current = evaluateToolContract(contract, payload, { projectIsDemo });
  const runMetadata = {
    confidence: current.status.confidence ?? null,
    uncertainty: current.status.uncertainty ?? null,
    validity: current.status.validity ?? null,
    humanGateRequired: contract.humanGatePolicy.requiredFor.length > 0,
  };

  for (const ref of contract.requiredInputs) {
    if (!ref.required) continue;
    const upstream = latestByTool.get(ref.toolId);
    if (!upstream) {
      blocking.push(ref.toolId);
      reasons.push(`${ref.toolId.toUpperCase()} payload missing`);
      continue;
    }
    const upstreamContract = tryGetToolContract(ref.toolId);
    if (upstreamContract) {
      const upstreamEval = evaluateToolContract(upstreamContract, upstream.payloadSnapshot, {
        projectIsDemo: upstream.isSimulated,
      });
      if (
        !upstreamEval.status.hasRequiredOutputs ||
        !upstreamEval.validityOk ||
        !upstreamEval.confidenceOk ||
        !upstreamEval.uncertaintyOk ||
        upstreamEval.isSimulated
      ) {
        blocking.push(ref.toolId);
        reasons.push(`${ref.toolId.toUpperCase()} contract unsatisfied: ${upstreamEval.reason}`);
      }
    }
    if (upstream.status === 'blocked' || upstream.status === 'gated' || upstream.status === 'demoOnly') {
      blocking.push(ref.toolId);
      reasons.push(`${ref.toolId.toUpperCase()} is itself ${upstream.status}`);
    }
    if (upstream.status === 'simulated') {
      blocking.push(ref.toolId);
      reasons.push(`${ref.toolId.toUpperCase()} is simulated`);
    }
  }

  if (blocking.length) {
    return {
      status: 'blocked',
      blockingUpstreamToolIds: Array.from(new Set(blocking)),
      reason: reasons.join('; '),
      ...runMetadata,
    };
  }

  if (!current.status.hasRequiredOutputs) {
    return {
      status: 'blocked',
      blockingUpstreamToolIds: [],
      reason: current.reason,
      ...runMetadata,
    };
  }

  if (current.isSimulated) {
    return {
      status: 'demoOnly',
      blockingUpstreamToolIds: [],
      reason: current.reason,
      ...runMetadata,
      humanGateRequired: true,
    };
  }

  if (!current.validityOk || !current.confidenceOk || !current.uncertaintyOk) {
    return {
      status: 'gated',
      blockingUpstreamToolIds: [],
      reason: current.reason,
      ...runMetadata,
      humanGateRequired: true,
    };
  }

  return {
    status: 'ok',
    blockingUpstreamToolIds: [],
    reason: '',
    ...runMetadata,
  };
}

const STATE_AFTER_TOOL: Record<string, WorkflowStateValue> = {
  pathd: 'pathdReady',
  fbasim: 'fbasimReady',
  catdes: 'catdesReady',
  dyncon: 'dynconReady',
  cellfree: 'cellfreeReady',
  dbtlflow: 'dbtlCommitted',
};

function inferWorkflowMachineState(
  toolStatus: Partial<Record<ToolId, WorkflowToolStatus>>,
  hasTarget: boolean,
): WorkflowStateValue {
  if (!hasTarget) return 'idle';
  let state: WorkflowStateValue = 'targetSet';
  for (const tool of GOLDEN_PATH_TOOL_IDS) {
    const status = toolStatus[tool];
    const contract = tryGetToolContract(tool);
    if (!status || !contract) break;
    const validityOk =
      status.validity !== null && meetsValidityFloor(status.validity, contract.validityBaseline.floor);
    const confidenceOk =
      contract.confidencePolicy.minToAdvance === null ||
      (status.confidence !== null && status.confidence >= contract.confidencePolicy.minToAdvance);
    const uncertaintyOk =
      !contract.uncertaintyPolicy.unboundedIsGate || status.uncertainty != null;
    if (!status.hasRequiredOutputs || status.isSimulated || !validityOk || !confidenceOk || !uncertaintyOk) break;
    state = STATE_AFTER_TOOL[tool];
  }
  return state;
}

// ── Phase-2B.1 — Workflow actor (R2) ────────────────────────────────────
//
// The XState 5 actor at workflowStateMachine.ts is the authoritative
// owner of `iteration` and the LOOP_BACK transition. We keep it as a
// module-level singleton so the actor's state survives across React
// re-renders and store mutations. Tests reset it via
// `__resetWorkflowActorForTests` so each suite starts from a clean
// `idle / iteration: 0` state.
//
// Convergence semantics: every `buildWorkflowControlSnapshot` calls
// `syncWorkflowActor`, which fast-forwards the actor to the inferred
// state by sending SET_TARGET / *_DONE events. Events that don't apply
// in the actor's current state are silently ignored by XState (no
// transition handler), so over-sending is safe.
//
// Project-change semantics: when `targetProduct` changes the actor is
// reset so iteration / tool history don't bleed across projects. This is
// stronger than CLEAR_TARGET (which only fires from `targetSet`) and
// matches the user-visible "new program" lifecycle.

let workflowActor: WorkflowActor | null = null;

function getWorkflowActor(): WorkflowActor {
  if (!workflowActor) {
    workflowActor = createWorkflowActor();
    workflowActor.start();
  }
  return workflowActor;
}

/** Test helper. Production code never calls this. */
export function __resetWorkflowActorForTests(): void {
  if (workflowActor) {
    try {
      workflowActor.stop();
    } catch {
      // ignore stop errors
    }
  }
  workflowActor = null;
}

function syncWorkflowActor(
  targetProduct: string | null,
  toolStatus: Partial<Record<ToolId, WorkflowToolStatus>>,
): WorkflowStateValue {
  let actor = getWorkflowActor();
  let ctx = actor.getSnapshot().context;

  if (ctx.targetProduct !== null && ctx.targetProduct !== targetProduct) {
    __resetWorkflowActorForTests();
    actor = getWorkflowActor();
    ctx = actor.getSnapshot().context;
  }

  if (targetProduct && ctx.targetProduct !== targetProduct) {
    actor.send({ type: 'SET_TARGET', targetProduct });
  }

  for (const tool of GOLDEN_PATH_TOOL_IDS) {
    const status = toolStatus[tool];
    if (!status) continue;
    const eventType = GOLDEN_PATH_DONE_EVENT[tool];
    actor.send({ type: eventType as 'PATHD_DONE', status });
  }

  return actor.getSnapshot().value as WorkflowStateValue;
}

function dispatchEvidenceAdded(ids: string[]): void {
  if (!ids.length) return;
  getWorkflowActor().send({ type: 'EVIDENCE_ADDED', ids });
}

function dispatchLoopBack(): void {
  getWorkflowActor().send({ type: 'LOOP_BACK' });
}

function buildWorkflowControlSnapshot(
  state: Pick<WorkbenchState, 'project' | 'analyzeArtifact' | 'toolPayloads' | 'evidenceItems' | 'runArtifacts'>,
  runArtifactsOverride?: WorkbenchRunArtifact[],
): WorkbenchWorkflowControlSnapshot {
  const runArtifacts = runArtifactsOverride ?? state.runArtifacts;
  const toolStatus: Partial<Record<ToolId, WorkflowToolStatus>> = {};
  const projectIsDemo = Boolean(state.project?.isDemo);
  for (const tool of GOLDEN_PATH_TOOL_IDS) {
    const contract = tryGetToolContract(tool);
    const payload = state.toolPayloads[tool as keyof WorkbenchToolPayloadMap];
    if (contract && payload) {
      toolStatus[tool] = evaluateToolContract(contract, payload, { projectIsDemo }).status;
    }
  }

  const hasTarget = Boolean(state.project?.targetProduct || state.analyzeArtifact?.targetProduct);
  const targetProduct = state.project?.targetProduct ?? state.analyzeArtifact?.targetProduct ?? null;
  // Phase-2B.1 — actor is the authoritative owner of machine state and
  // iteration. inferWorkflowMachineState is retained only as a fallback
  // when the actor cannot be initialised (SSR / first paint).
  const actorState = syncWorkflowActor(hasTarget ? targetProduct : null, toolStatus);
  const machineState = hasTarget ? actorState : inferWorkflowMachineState(toolStatus, hasTarget);
  const iteration = getWorkflowActor().getSnapshot().context.iteration;
  const decision = buildWorkflowDecision({
    machineState,
    targetProduct,
    toolStatus,
    evidence: state.evidenceItems.map((item) => ({ id: item.id, sourceKind: item.sourceKind })),
    isAdapterRegistered: (id) => isAxonToolSupported(id as AxonTool),
  });
  const latestRun = runArtifacts[0] ?? null;
  const latestRunStatus = latestRun?.status ?? null;
  const latestRunContract = latestRun ? tryGetToolContract(latestRun.toolId) : undefined;
  const latestRunAffectsWorkflow = latestRunContract?.contractScope === 'workflow';
  const runGateStatus =
    latestRunAffectsWorkflow &&
    (latestRunStatus === 'blocked' || latestRunStatus === 'gated' || latestRunStatus === 'demoOnly')
      ? latestRunStatus
      : null;
  const status =
    runGateStatus === 'demoOnly'
      ? 'demoOnly'
      : runGateStatus ?? decision.status;

  return {
    machineState,
    status,
    currentToolId: decision.currentToolId,
    nextRecommendedNode:
      runGateStatus === 'blocked'
        ? ((latestRun?.blockingUpstreamToolIds?.[0] as ToolId | undefined) ?? decision.nextRecommendedNode)
        : decision.nextRecommendedNode,
    missingEvidence: decision.missingEvidence,
    confidence: decision.confidence,
    uncertainty: decision.uncertainty,
    validity: decision.validity,
    humanGateRequired: decision.humanGateRequired || status === 'gated' || status === 'demoOnly',
    nextNodeIsContractOnly: decision.nextNodeIsContractOnly,
    isDemoOnly: status === 'demoOnly',
    latestRunStatus,
    latestRunToolId: latestRun?.toolId ?? null,
    reasonCodes: [
      ...decision.reasonCodes,
      ...(runGateStatus ? [`LATEST_RUN_${runGateStatus.toUpperCase()}`] : []),
    ],
    explanation: runGateStatus && latestRun?.statusReason
      ? `${String(latestRun.toolId).toUpperCase()} did not advance: ${latestRun.statusReason}`
      : decision.explanation,
    iteration,
    updatedAt: Date.now(),
  };
}

function createInitialWorkflowControl(now = Date.now()): WorkbenchWorkflowControlSnapshot {
  return {
    machineState: 'idle',
    status: 'idle',
    currentToolId: null,
    nextRecommendedNode: 'pathd',
    missingEvidence: { minRequired: 0, have: 0, kinds: [] },
    confidence: null,
    uncertainty: null,
    validity: null,
    humanGateRequired: false,
    nextNodeIsContractOnly: false,
    isDemoOnly: false,
    latestRunStatus: null,
    latestRunToolId: null,
    reasonCodes: ['NO_TARGET'],
    explanation: 'No target product set. Set a target via /research or /analyze, then run PATHD.',
    iteration: 0,
    updatedAt: now,
  };
}

function createRunArtifact<K extends keyof WorkbenchToolPayloadMap>(
  state: WorkbenchState,
  toolId: K,
  payload: WorkbenchToolPayloadMap[K],
  options?: { revalidated?: boolean },
): WorkbenchRunArtifact {
  const stageId = getStageForTool(toolId)?.id ?? null;
  const analyzeArtifact = getAnalyzeArtifactForState(state);
  const execution = buildExecutionSnapshot({
    toolId,
    project: state.project,
    analyzeArtifact,
    runArtifacts: state.runArtifacts,
  });
  const summary = summarizePayload(toolId, payload);

  // Phase-1 — Workflow Control Plane: contract gate. We compute the
  // latest-run map once and ask the contract whether all required
  // upstream payloads are present and meet the floor. The decision lands
  // on the run artifact as `status` / `blockingUpstreamToolIds` so
  // downstream UI (Decision Trace) can render it without rerunning the
  // contract check.
  const latestByTool = new Map<string, WorkbenchRunArtifact>();
  state.runArtifacts.forEach((artifact) => {
    if (!latestByTool.has(artifact.toolId)) latestByTool.set(artifact.toolId, artifact);
  });
  const contractDecision = evaluateContractStatus(toolId, payload, latestByTool, Boolean(state.project?.isDemo));

  const isSimulated =
    contractDecision.status === 'blocked' ||
    contractDecision.status === 'simulated' ||
    contractDecision.status === 'demoOnly' ||
    inferToolSimulation(payload) ||
    Boolean(state.project?.isDemo);

  return {
    id: createId('run'),
    toolId,
    stageId,
    targetProduct: payload?.targetProduct ?? analyzeArtifact?.targetProduct ?? state.project?.targetProduct ?? 'Target Product',
    sourceArtifactId: payload?.sourceArtifactId ?? analyzeArtifact?.id,
    upstreamArtifactIds: execution.upstreamArtifactIds,
    execution,
    summary: options?.revalidated ? `${summary} · context refreshed` : summary,
    payloadSnapshot: payload,
    createdAt: payload?.updatedAt ?? Date.now(),
    isSimulated,
    status: contractDecision.status,
    statusReason: contractDecision.reason || undefined,
    blockingUpstreamToolIds:
      contractDecision.blockingUpstreamToolIds.length > 0
        ? contractDecision.blockingUpstreamToolIds
        : undefined,
    confidence: contractDecision.confidence ?? null,
    uncertainty: contractDecision.uncertainty ?? null,
    validity: contractDecision.validity ?? null,
    humanGateRequired: contractDecision.humanGateRequired,
    iteration: getWorkflowActor().getSnapshot().context.iteration,
    evidenceSnapshot: buildRunEvidenceSnapshot(state, toolId),
  };
}

function buildCanonicalSlice(state: Pick<
  WorkbenchState,
  | 'schemaVersion'
  | 'revision'
  | 'lastMutationAt'
  | 'activeArtifactId'
  | 'project'
  | 'evidenceItems'
  | 'selectedEvidenceIds'
  | 'draftAnalyzeInput'
  | 'workflowArtifact'
  | 'analyzeArtifact'
  | 'toolRuns'
  | 'toolPayloads'
  | 'payloadAdmissionDecisionsByToolId'
  | 'runArtifacts'
  | 'checkpoints'
  | 'nextRecommendations'
  | 'workflowControl'
>): WorkbenchCanonicalState {
  return {
    schemaVersion: state.schemaVersion,
    revision: state.revision,
    lastMutationAt: state.lastMutationAt,
    activeArtifactId: state.activeArtifactId,
    project: state.project,
    evidenceItems: state.evidenceItems,
    selectedEvidenceIds: state.selectedEvidenceIds,
    draftAnalyzeInput: state.draftAnalyzeInput,
    workflowArtifact: state.workflowArtifact,
    analyzeArtifact: state.analyzeArtifact,
    toolRuns: state.toolRuns,
    toolPayloads: state.toolPayloads,
    payloadAdmissionDecisionsByToolId: state.payloadAdmissionDecisionsByToolId,
    runArtifacts: state.runArtifacts,
    checkpoints: state.checkpoints,
    nextRecommendations: state.nextRecommendations,
    workflowControl: state.workflowControl,
  };
}

function touchState(state: WorkbenchState, patch: Partial<WorkbenchCanonicalState>) {
  const now = Date.now();
  return {
    ...patch,
    revision: state.revision + 1,
    lastMutationAt: now,
    syncStatus: state.hydratedFromServer ? 'saving' : state.syncStatus,
    syncError: null,
  };
}

function normalizeNonEmptyId(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isPayloadRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function payloadTimestamp(value: unknown): string | undefined {
  if (!isPayloadRecord(value) || typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) {
    return undefined;
  }
  return new Date(value.updatedAt).toISOString();
}

function outputAssumptionIdsForTool(toolId: string): string[] {
  return (TOOL_ASSUMPTIONS[toolId] ?? []).map((assumption) => assumption.id);
}

function provenanceIdsForToolPayloads(
  toolIds: readonly string[],
  toolPayloads: WorkbenchToolPayloadMap,
): string[] {
  return Array.from(new Set(
    toolIds.flatMap((upstreamToolId) =>
      collectProvenanceIds(toolPayloads[upstreamToolId as keyof WorkbenchToolPayloadMap]),
    ),
  ));
}

function maybeAttachPayloadProvenance<K extends keyof WorkbenchToolPayloadMap>(
  toolId: K,
  payload: WorkbenchToolPayloadMap[K],
  state: Pick<WorkbenchState, 'toolPayloads'>,
): WorkbenchToolPayloadMap[K] {
  const toolIdText = String(toolId);
  if (!PROVENANCE_MIDDLEWARE_TOOL_IDS.has(toolIdText)) return payload;
  if (isPayloadRecord(payload) && payload.runProvenance !== undefined) return payload;

  const startedAt = payloadTimestamp(payload);
  return withProvenanceSync(
    payload,
    {
      toolId: toolIdText,
      activityType: 'tool-run',
      surface: 'payload',
      outputAssumptionIds: outputAssumptionIdsForTool(toolIdText),
      upstreamProvenanceIds: provenanceIdsForToolPayloads(getUpstreamToolIds(toolIdText), state.toolPayloads),
      ...(startedAt ? { startedAt, completedAt: startedAt } : {}),
    },
    (currentPayload) => currentPayload,
  ).payload;
}

function summarizeWorkflowArtifactDebug(artifact: WorkflowArtifact | null | undefined) {
  if (!artifact) return null;
  return {
    id: normalizeNonEmptyId(artifact.id),
    status: artifact.status,
    schemaVersion: artifact.schemaVersion,
    version: artifact.version,
    hasGraph: Boolean(artifact.atomicPathwayGraph),
    nodeCount: artifact.atomicPathwayGraph?.nodes.length ?? 0,
    edgeCount: artifact.atomicPathwayGraph?.edges.length ?? 0,
    evidencePacketCount: artifact.evidencePackets.length,
    candidateRouteCount: artifact.candidateRoutes.length,
    scientificStage: artifact.workbench.scientificStage,
  };
}

function isValidPersistedWorkflowArtifact(artifact: WorkflowArtifact | null | undefined): artifact is WorkflowArtifact {
  return Boolean(
    artifact
    && normalizeNonEmptyId(artifact.id)
    && artifact.status === 'compiled'
    && artifact.atomicPathwayGraph
    && artifact.atomicPathwayGraph.nodes.length > 0,
  );
}

async function requestCanonicalState(
  method: 'GET' | 'PUT',
  state?: WorkbenchCanonicalState,
  options?: { projectId?: string | null; artifactId?: string | null },
) {
  const actorId = getWorkbenchActorId();
  const projectId = options?.projectId ?? state?.project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE;
  const artifactId = normalizeNonEmptyId(
    options?.artifactId
    ?? state?.activeArtifactId
    ?? state?.workflowArtifact?.id
    ?? null,
  );
  const url = artifactId
    ? `/api/workbench?artifact=${encodeURIComponent(artifactId)}`
    : '/api/workbench';
  const requestBody = method === 'PUT' ? { state } : undefined;
  const isCanonicalArtifactSave = method === 'PUT' && Boolean(state?.workflowArtifact);
  if (isCanonicalArtifactSave) {
    console.info('[workbench] canonical save request payload', {
      url,
      projectId,
      artifactId,
      state: requestBody?.state,
    });
  }
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-workbench-actor-id': actorId,
      'x-workbench-project-id': projectId,
    },
    cache: 'no-store',
    body: requestBody ? JSON.stringify(requestBody) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (isCanonicalArtifactSave) {
    console.info('[workbench] canonical save response payload', payload);
  }
  if (!response.ok) {
    const error = payload?.error ?? `${method} /api/workbench failed (${response.status})`;
    const conflictState = sanitizeWorkbenchState(payload?.state);
    const backendMeta = sanitizeWorkbenchBackendMeta(payload?.backend);
    const collaborators = sanitizeWorkbenchCollaborators(payload?.members);
    const experimentRecords = sanitizeWorkbenchExperimentRecords(payload?.experiments);
    const auditLog = sanitizeWorkbenchAuditLog(payload?.audit);
    const historyLog = sanitizeWorkbenchHistory(payload?.history);
    throw Object.assign(new Error(error), {
      status: response.status,
      state: conflictState,
      backendMeta,
      collaborators,
      experimentRecords,
      auditLog,
      historyLog,
    });
  }
  const canonicalState = sanitizeWorkbenchState(payload?.state);
  if (!canonicalState) {
    throw new Error('Workbench server returned an invalid canonical state');
  }
  return {
    canonicalState,
    backendMeta: sanitizeWorkbenchBackendMeta(payload?.backend),
    collaborators: sanitizeWorkbenchCollaborators(payload?.members),
    experimentRecords: sanitizeWorkbenchExperimentRecords(payload?.experiments),
    auditLog: sanitizeWorkbenchAuditLog(payload?.audit),
    historyLog: sanitizeWorkbenchHistory(payload?.history),
  };
}

function getAnalyzeArtifactForState(state: Pick<WorkbenchState, 'workflowArtifact' | 'analyzeArtifact'>) {
  return state.workflowArtifact
    ? deriveAnalyzeCompatibilityProjection(state.workflowArtifact)
    : state.analyzeArtifact;
}

function buildCanonicalPatchFromWorkflowArtifact(
  state: WorkbenchState,
  artifact: WorkflowArtifact,
): Partial<WorkbenchCanonicalState> {
  const analyzeArtifact = deriveAnalyzeCompatibilityProjection(artifact);
  const project = state.project ?? {
    id: createId('project'),
    title: analyzeArtifact.title,
    summary: analyzeArtifact.summary,
    targetProduct: analyzeArtifact.targetProduct,
    status: 'active' as const,
    isDemo: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    activeArtifactId: artifact.id || null,
    workflowArtifact: artifact,
    analyzeArtifact,
    project: {
      ...project,
      title: project.isDemo ? analyzeArtifact.title : project.title || analyzeArtifact.title,
      summary: analyzeArtifact.summary,
      targetProduct: analyzeArtifact.targetProduct,
      sourceQuery: artifact.intake.sourceQuery ?? project.sourceQuery,
      status: 'active',
      isDemo: false,
      updatedAt: Date.now(),
    },
    checkpoints: buildCheckpoints('stage-1', analyzeArtifact, state.toolRuns),
    nextRecommendations: buildRecommendationsFromToolIds(
      analyzeArtifact.recommendedNextTools,
      'analysis',
      'Recommended from canonical workflow artifact',
    ),
  };
}

export function buildAnalyzeArtifactFromStructuredAnalysis(
  payload: StructuredAnalysisPayload,
  evidenceTraceIds: string[] = [],
): WorkbenchAnalyzeArtifact {
  const targetProduct = deriveTargetProduct(payload.nodes);
  const thermodynamicConcerns = payload.edges
    .filter((edge) => (edge.predicted_delta_G_kJ_mol ?? 0) > 0 || String(edge.spontaneity || '').toLowerCase().includes('non'))
    .slice(0, 4)
    .map((edge) => `${edge.start} -> ${edge.end}: ${edge.spontaneity ?? 'Condition-dependent thermodynamics'}`);

  const bottleneckAssumptions = payload.bottlenecks.map((bottleneck: BottleneckEnzyme) => ({
    id: bottleneck.node_id,
    label: bottleneck.enzyme,
    detail: bottleneck.evidence,
    yieldLossPercent: bottleneck.yield_loss_percent,
  }));

  const enzymeCandidates = payload.designStrategies.map((strategy: DeNovoDesignStrategy) => ({
    id: strategy.node_id,
    label: strategy.node_id.replace(/_/g, ' '),
    rationale: strategy.de_novo_design_strategy.predicted_impact,
  }));

  const recommendedNextTools = payload.interaction?.options?.length
    ? payload.interaction.options.includes('flux_balance_optimization')
      ? ['pathd', 'fbasim', 'cethx', 'catdes']
      : ['pathd', 'catdes', 'dyncon']
    : ['pathd', 'fbasim', 'cethx'];

  return {
    id: createId('artifact'),
    title: `${targetProduct} pathway analysis`,
    summary: payload.interaction?.question
      ?? `Generated ${payload.nodes.length} nodes and ${payload.edges.length} edges for ${targetProduct}.`,
    targetProduct,
    nodes: payload.nodes,
    edges: payload.edges,
    pathwayCandidates: [
      {
        id: 'primary-route',
        label: `${payload.nodes[0]?.label ?? 'Source'} -> ${targetProduct}`,
        description: `${payload.nodes.length} nodes · ${payload.edges.length} edges · ${Math.max(payload.bottlenecks.length, 1)} modeled bottleneck checkpoint(s)`,
        nodeCount: payload.nodes.length,
        edgeCount: payload.edges.length,
      },
    ],
    bottleneckAssumptions,
    enzymeCandidates,
    thermodynamicConcerns,
    recommendedNextTools,
    evidenceTraceIds,
    sourceProvider: payload.sourceProvider,
    generatedAt: Date.now(),
  };
}

const initialState: Pick<
  WorkbenchState,
  | 'schemaVersion'
  | 'revision'
  | 'lastMutationAt'
  | 'activeArtifactId'
  | 'project'
  | 'evidenceItems'
  | 'selectedEvidenceIds'
  | 'draftAnalyzeInput'
  | 'workflowArtifact'
  | 'analyzeArtifact'
  | 'toolRuns'
  | 'toolPayloads'
  | 'payloadAdmissionDecisionsByToolId'
  | 'runArtifacts'
  | 'checkpoints'
  | 'nextRecommendations'
  | 'workflowControl'
  | 'currentToolId'
  | 'currentStageId'
  | 'backendMeta'
  | 'collaborators'
  | 'experimentRecords'
  | 'axonRuns'
  | 'axonLogs'
  | 'axonPlan'
  | 'syncAuditLog'
  | 'historyLog'
  | 'syncStatus'
  | 'syncError'
  | 'hydratedFromServer'
  | 'lastServerSyncAt'
  | 'lastServerSyncedRevision'
  | 'artifactLoadState'
  | 'artifactLoadError'
  | 'artifactRequestedId'
> = {
  schemaVersion: WORKBENCH_SCHEMA_VERSION,
  revision: 0,
  lastMutationAt: 0,
  activeArtifactId: null,
  project: null,
  evidenceItems: [],
  selectedEvidenceIds: [],
  draftAnalyzeInput: '',
  workflowArtifact: null,
  analyzeArtifact: null,
  toolRuns: [],
  toolPayloads: {},
  payloadAdmissionDecisionsByToolId: {},
  runArtifacts: [],
  checkpoints: createEmptyCheckpoints(),
  nextRecommendations: [],
  workflowControl: createInitialWorkflowControl(),
  currentToolId: null,
  currentStageId: null,
  backendMeta: null,
  collaborators: [],
  experimentRecords: [],
  axonRuns: [],
  axonLogs: [],
  axonPlan: null,
  syncAuditLog: [],
  historyLog: [],
  syncStatus: 'idle',
  syncError: null,
  hydratedFromServer: false,
  lastServerSyncAt: null,
  lastServerSyncedRevision: 0,
  artifactLoadState: 'idle',
  artifactLoadError: null,
  artifactRequestedId: null,
};

export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set, get) => ({
      ...initialState,

      ensureProject: (seed) => {
        const now = Date.now();
        set((state) => {
          const project = state.project
            ? {
                ...state.project,
                ...seed,
                updatedAt: now,
              }
            : {
                id: createId('project'),
                title: seed?.title ?? 'Synthetic Biology Program',
                summary: seed?.summary ?? 'Traceable workbench context for Research, Analyze, and Tools.',
                targetProduct: seed?.targetProduct ?? 'Target Product',
                sourceQuery: seed?.sourceQuery,
                status: seed?.status ?? 'draft',
                isDemo: seed?.isDemo ?? false,
                createdAt: now,
                updatedAt: now,
              };
          return touchState(state, {
            project,
            workflowControl: buildWorkflowControlSnapshot({ ...state, project }),
          });
        });
      },

      upsertEvidence: (item, options) => {
        const now = Date.now();
        const key = `${item.doi || item.url || item.title}`.toLowerCase();
        let finalId = '';

        set((state) => {
          const existing = state.evidenceItems.find((entry) =>
            `${entry.doi || entry.url || entry.title}`.toLowerCase() === key,
          );

          const evidenceId = existing?.id ?? createId('evidence');
          finalId = evidenceId;

          const nextEvidence: WorkbenchEvidenceItem = {
            ...existing,
            ...item,
            id: evidenceId,
            savedAt: existing?.savedAt ?? now,
          };

          const evidenceItems = existing
            ? state.evidenceItems.map((entry) => (entry.id === evidenceId ? nextEvidence : entry))
            : [nextEvidence, ...state.evidenceItems];

          const selectedEvidenceIds = options?.select
            ? Array.from(new Set([evidenceId, ...state.selectedEvidenceIds]))
            : state.selectedEvidenceIds;

          const project = state.project ?? {
            id: createId('project'),
            title: item.query ? `Research: ${item.query}` : 'Synthetic Biology Program',
            summary: 'Evidence-led project seeded from literature.',
            targetProduct: 'Target Product',
            status: 'draft' as const,
            isDemo: false,
            createdAt: now,
            updatedAt: now,
          };

          const nextProject = { ...project, updatedAt: now, sourceQuery: item.query ?? project.sourceQuery, isDemo: false };

          // Phase-2B.1 (R2) — let the workflow actor know an evidence id
          // joined the bundle. EVIDENCE_ADDED never moves the main FSM
          // state; it only updates context for downstream observability.
          if (!existing) dispatchEvidenceAdded([evidenceId]);

          return touchState(state, {
            project: nextProject,
            evidenceItems,
            selectedEvidenceIds,
            workflowControl: buildWorkflowControlSnapshot({
              ...state,
              project: nextProject,
              evidenceItems,
            }),
          });
        });

        return finalId;
      },

      toggleEvidenceSelection: (id) => {
        set((state) => touchState(state, {
          selectedEvidenceIds: state.selectedEvidenceIds.includes(id)
            ? state.selectedEvidenceIds.filter((entry) => entry !== id)
            : [...state.selectedEvidenceIds, id],
        }));
      },

      prepareAnalyzeFromEvidence: (ids) => {
        const state = get();
        const targetIds = ids?.length ? ids : state.selectedEvidenceIds;
        const selectedItems = state.evidenceItems.filter((item) => targetIds.includes(item.id));
        const composed = composeEvidenceText(selectedItems);

        if (selectedItems.length) {
          const title = state.project?.title && !state.project.isDemo
            ? state.project.title
            : selectedItems[0]?.query
              ? `Research: ${selectedItems[0].query}`
              : selectedItems[0].title;
          get().ensureProject({
            title,
            summary: `Evidence bundle with ${selectedItems.length} literature item(s).`,
            status: 'active',
            isDemo: false,
          });
        }

        set((currentState) => touchState(currentState, {
          draftAnalyzeInput: composed,
          selectedEvidenceIds: targetIds,
          checkpoints: buildCheckpoints('stage-1', getAnalyzeArtifactForState(currentState), currentState.toolRuns),
        }));

        set({ currentStageId: 'stage-1' });
        return composed;
      },

      setDraftAnalyzeInput: (text) => {
        set((state) => touchState(state, { draftAnalyzeInput: text }));
      },

      persistWorkflowArtifact: async (artifact) => {
        const state = get();
        const previousArtifact = state.workflowArtifact?.id === artifact.id
          ? state.workflowArtifact
          : null;
        const candidate: WorkflowArtifact = {
          ...artifact,
          status: artifact.status === 'error' ? 'error' : 'compiled',
          version: (previousArtifact?.version ?? 0) + 1,
          createdAt: previousArtifact?.createdAt ?? artifact.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          sourcePage: 'analyze',
        };
        console.info('[workbench] compiled artifact before save', summarizeWorkflowArtifactDebug(candidate));
        if (!candidate.atomicPathwayGraph || candidate.atomicPathwayGraph.nodes.length === 0) {
          const message = 'Compiled workflow artifact is missing an atomic pathway graph';
          set({
            syncStatus: 'error',
            syncError: message,
            artifactLoadState: 'error',
            artifactLoadError: message,
          });
          throw new Error(message);
        }
        const patch = buildCanonicalPatchFromWorkflowArtifact(state, candidate);
        const patchedState = {
          ...state,
          ...patch,
        };
        const canonicalState = buildCanonicalSlice({
          ...patchedState,
          workflowControl: buildWorkflowControlSnapshot(patchedState),
        });

        set({
          syncStatus: 'saving',
          syncError: null,
          artifactLoadState: 'loading',
          artifactLoadError: null,
          artifactRequestedId: normalizeNonEmptyId(candidate.id),
        });

        try {
          const { canonicalState: savedState, backendMeta, collaborators, experimentRecords, auditLog, historyLog } = await requestCanonicalState('PUT', canonicalState, {
            artifactId: normalizeNonEmptyId(candidate.id),
            projectId: canonicalState.project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE,
          });
          const savedArtifact = savedState.workflowArtifact;
          console.info('[workbench] persisted artifact returned from API', {
            workflowArtifact: summarizeWorkflowArtifactDebug(savedArtifact),
            activeArtifactId: savedState.activeArtifactId ?? null,
          });
          if (!isValidPersistedWorkflowArtifact(savedArtifact)) {
            const message = 'Canonical artifact save failed: response did not include a valid persisted WorkflowArtifact';
            set({
              syncStatus: 'error',
              syncError: message,
              artifactLoadState: 'error',
              artifactLoadError: message,
            });
            throw new Error(message);
          }

          set((currentState) => ({
            ...currentState,
            ...savedState,
            analyzeArtifact: savedState.workflowArtifact
              ? deriveAnalyzeCompatibilityProjection(savedState.workflowArtifact)
              : savedState.analyzeArtifact,
            workflowControl: savedState.workflowControl,
            backendMeta,
            collaborators,
            experimentRecords,
            syncAuditLog: auditLog,
            historyLog,
            syncStatus: 'synced',
            syncError: null,
            hydratedFromServer: true,
            lastServerSyncAt: Date.now(),
            lastServerSyncedRevision: savedState.revision,
            artifactLoadState: 'ready',
            artifactLoadError: null,
            artifactRequestedId: savedArtifact.id,
            currentStageId: 'stage-1',
          }));

          const installedState = get();
          console.info('[workbench] installed workflow artifact after save', {
            workflowArtifact: summarizeWorkflowArtifactDebug(installedState.workflowArtifact),
            activeArtifactId: installedState.activeArtifactId ?? null,
          });
          if (
            !isValidPersistedWorkflowArtifact(installedState.workflowArtifact)
            || installedState.workflowArtifact.id !== savedArtifact.id
            || installedState.activeArtifactId !== savedArtifact.id
          ) {
            const message = 'Canonical artifact save succeeded but the persisted WorkflowArtifact was not installed into client state';
            set({
              syncStatus: 'error',
              syncError: message,
              artifactLoadState: 'error',
              artifactLoadError: message,
            });
            throw new Error(message);
          }

          return installedState.workflowArtifact;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to persist canonical workflow artifact';
          console.error('[workbench] canonical artifact save failed', {
            error: message,
            workflowArtifact: summarizeWorkflowArtifactDebug(candidate),
          });
          set((currentState) => ({
            syncStatus: 'error',
            syncError: message,
            artifactLoadState: 'error',
            artifactLoadError: message,
            artifactRequestedId: normalizeNonEmptyId(candidate.id) ?? currentState.artifactRequestedId,
          }));
          throw (error instanceof Error ? error : new Error(message));
        }
      },

      visitTool: (toolId) => {
        if (!toolId) {
          set((state) => ({
            currentToolId: null,
            currentStageId: null,
            checkpoints: buildCheckpoints(null, getAnalyzeArtifactForState(state), state.toolRuns),
          }));
          return;
        }

        const stage = getStageForTool(toolId);
        // Phase-1 — Workflow Control Plane: silent demo seeding is gated.
        // The previous behaviour auto-injected an Artemisinin demo project
        // on the first tool visit, which let downstream tools paint
        // "complete" against fabricated state. Now demo seeding only fires
        // when the URL carries ?demo=1 (preserves the live deploy demo)
        // or when explicitly invoked via the seedDemoProject action.
        if (!get().project && shouldAutoSeedDemo()) {
          get().seedDemoProject(toolId);
        }

        set((state) => {
          const existing = state.toolRuns.find((run) => run.toolId === toolId && run.summary === 'Workbench opened');
          const toolRuns = existing
            ? state.toolRuns
            : [
                {
                  id: createId('toolrun'),
                  toolId,
                  stageId: stage?.id ?? null,
                  title: toolId.toUpperCase(),
                  summary: 'Workbench opened',
                  isSimulated: true,
                  createdAt: Date.now(),
                },
                ...state.toolRuns,
              ].slice(0, TOOL_RUN_LIMIT);
          return {
            ...touchState(state, {
              toolRuns,
              checkpoints: buildCheckpoints(stage?.id ?? null, getAnalyzeArtifactForState(state), toolRuns),
              nextRecommendations: buildRecommendationsFromToolIds(
                getNextToolIds(toolId),
                'flow',
                'Next step in the flowchart workbench',
              ),
            }),
            currentToolId: toolId,
            currentStageId: stage?.id ?? null,
          };
        });
      },

      addToolRun: (run) => {
        set((state) => {
          const stageId = run.stageId ?? getStageForTool(run.toolId)?.id ?? null;
          const toolRuns = [
            {
              id: createId('toolrun'),
              toolId: run.toolId,
              stageId,
              title: run.title,
              summary: run.summary,
              isSimulated: run.isSimulated,
              createdAt: Date.now(),
            },
            ...state.toolRuns,
          ].slice(0, TOOL_RUN_LIMIT);
          return touchState(state, {
            toolRuns,
            checkpoints: buildCheckpoints(state.currentStageId, getAnalyzeArtifactForState(state), toolRuns),
          });
        });
      },

      appendAxonRun: (record) => {
        set((state) => ({
          axonRuns: [record, ...state.axonRuns].slice(0, AXON_RUN_LIMIT),
        }));
      },

      clearAxonRuns: () => {
        set({ axonRuns: [] });
      },

      appendAxonLog: (entry) => {
        set((state) => ({
          axonLogs: [entry, ...state.axonLogs].slice(0, AXON_LOG_LIMIT),
        }));
      },

      clearAxonLogs: () => {
        set({ axonLogs: [] });
      },

      setAxonPlan: (plan) => {
        set({ axonPlan: plan });
      },

      updateAxonPlanStep: (planId, stepId, patch) => {
        set((state) => {
          const plan = state.axonPlan;
          if (!plan || plan.id !== planId) return state;
          return {
            axonPlan: {
              ...plan,
              steps: plan.steps.map((s) =>
                s.id === stepId ? { ...s, ...patch } : s,
              ),
            },
          };
        });
      },

      setToolPayload: (toolId, payload) => {
        set((state) => {
          const admittedPayload = maybeAttachPayloadProvenance(toolId, payload, state);
          const previousPayload = state.toolPayloads[toolId];
          const latestArtifactForTool = state.runArtifacts.find((artifact) => artifact.toolId === toolId);
          const nextExecution = buildExecutionSnapshot({
            toolId,
            project: state.project,
            analyzeArtifact: getAnalyzeArtifactForState(state),
            runArtifacts: state.runArtifacts,
          });
          const previousComparablePayload = previousPayload ?? latestArtifactForTool?.payloadSnapshot;
          const payloadStable = stableSerialize(previousComparablePayload) === stableSerialize(admittedPayload);
          const executionStable = latestArtifactForTool?.execution.dependencySignature === nextExecution.dependencySignature;

          if (payloadStable && executionStable) {
            return state;
          }

          const runArtifact = createRunArtifact(state, toolId, admittedPayload, {
            revalidated: payloadStable && !executionStable,
          });
          const admission = evaluateWorkbenchPayloadAdmission({
            ...inferAdmissionInputFromPayload({
              toolId: String(toolId),
              payload: admittedPayload,
              fallbackValidityTier: getToolValidity(String(toolId))?.level,
            }),
            mode: 'observe',
          });
          const toolRuns = [
            {
              id: createId('toolrun'),
              toolId,
              stageId: runArtifact.stageId,
              title: String(toolId).toUpperCase(),
              summary: runArtifact.summary,
              isSimulated: runArtifact.isSimulated,
              createdAt: runArtifact.createdAt,
            },
            ...state.toolRuns,
          ].slice(0, TOOL_RUN_LIMIT);
          const contract = tryGetToolContract(toolId as string);
          const blocksCanonicalPayload =
            contract?.contractScope === 'workflow' && runArtifact.status !== 'ok';
          const runArtifacts = [runArtifact, ...state.runArtifacts].slice(0, RUN_ARTIFACT_LIMIT);
          const toolPayloads = blocksCanonicalPayload
            ? state.toolPayloads
            : {
                ...state.toolPayloads,
                [toolId]: admittedPayload,
              };
          const workflowControl = buildWorkflowControlSnapshot({
            ...state,
            toolPayloads,
            runArtifacts,
          }, runArtifacts);
          const downstreamToolIds = getNextToolIds(toolId);
          const allowedDownstreamToolIds = downstreamToolIds.filter((nextToolId) =>
            canPassToDownstream(admittedPayload, nextToolId).allowed,
          );
          const blockedDownstreamToolIds = downstreamToolIds.filter((nextToolId) =>
            !canPassToDownstream(admittedPayload, nextToolId).allowed,
          );
          const recommendationToolIds = blocksCanonicalPayload
            ? runArtifact.blockingUpstreamToolIds ?? (workflowControl.nextRecommendedNode ? [workflowControl.nextRecommendedNode] : [])
            : allowedDownstreamToolIds;

          return touchState(state, {
            toolPayloads,
            payloadAdmissionDecisionsByToolId: {
              ...state.payloadAdmissionDecisionsByToolId,
              [String(toolId)]: admission.decision,
            },
            runArtifacts,
            toolRuns,
            checkpoints: buildCheckpoints(state.currentStageId, getAnalyzeArtifactForState(state), toolRuns),
            nextRecommendations: buildRecommendationsFromToolIds(
              recommendationToolIds,
              blocksCanonicalPayload ? 'flow' : 'tool',
              blocksCanonicalPayload
                ? runArtifact.statusReason ?? 'Workflow gate blocked downstream advancement'
                : blockedDownstreamToolIds.length > 0
                  ? `Runtime gate blocked ${blockedDownstreamToolIds.map((id) => id.toUpperCase()).join(', ')} from this output`
                  : `Live ${String(toolId).toUpperCase()} computation updated downstream recommendations`,
            ),
            workflowControl,
          });
        });
      },

      loopBackWorkflow: () => {
        set((state) => {
          // Only meaningful from dbtlCommitted. The actor's guard refuses
          // any other source state, so over-invoking is a no-op.
          const beforeIteration = getWorkflowActor().getSnapshot().context.iteration;
          dispatchLoopBack();
          const afterIteration = getWorkflowActor().getSnapshot().context.iteration;
          if (afterIteration === beforeIteration) {
            // Guard refused. No state change.
            return state;
          }
          // Clear golden-path payloads so downstream rows reblank for the
          // next iteration. Evidence + project persist by design.
          const toolPayloads: WorkbenchToolPayloadMap = { ...state.toolPayloads };
          for (const tool of GOLDEN_PATH_TOOL_IDS) {
            delete toolPayloads[tool as keyof WorkbenchToolPayloadMap];
          }
          const workflowControl = buildWorkflowControlSnapshot({
            ...state,
            toolPayloads,
          });
          return touchState(state, {
            toolPayloads,
            workflowControl,
          });
        });
      },

      seedDemoProject: (toolId) => {
        const stage = getStageForTool(toolId ?? null);
        const now = Date.now();
        set((state) => {
          const project = state.project ?? {
            id: createId('project'),
            title: 'Artemisinin Demonstration Program',
            summary: 'Default fallback context used when no research project has been injected yet.',
            targetProduct: 'Artemisinin',
            status: 'draft',
            isDemo: true,
            createdAt: now,
            updatedAt: now,
          };
          return {
            ...touchState(state, {
              project,
              checkpoints: buildCheckpoints(stage?.id ?? null, getAnalyzeArtifactForState(state), state.toolRuns),
              workflowControl: buildWorkflowControlSnapshot({ ...state, project }),
            }),
            currentStageId: state.currentStageId ?? stage?.id ?? null,
          };
        });
      },

      applyCanonicalState: (incomingState, options) => {
        const sanitized = sanitizeWorkbenchState(incomingState);
        if (!sanitized) return;
        const derivedAnalyzeArtifact = sanitized.workflowArtifact
          ? deriveAnalyzeCompatibilityProjection(sanitized.workflowArtifact)
          : sanitized.analyzeArtifact;
        set((state) => ({
          ...state,
          ...sanitized,
          activeArtifactId: sanitized.activeArtifactId ?? sanitized.workflowArtifact?.id ?? null,
          analyzeArtifact: derivedAnalyzeArtifact,
          workflowControl: sanitized.workflowControl,
          syncStatus: options?.conflict ? 'conflict' : options?.synced ? 'synced' : state.syncStatus,
          syncError: null,
          hydratedFromServer: options?.markHydrated ? true : state.hydratedFromServer,
          lastServerSyncAt: options?.synced || options?.markHydrated ? Date.now() : state.lastServerSyncAt,
          lastServerSyncedRevision: options?.synced || options?.markHydrated ? sanitized.revision : state.lastServerSyncedRevision,
        }));
      },

      loadFromServer: async (options) => {
        const artifactId = options?.artifactId ?? null;
        set({
          syncStatus: 'loading',
          syncError: null,
          artifactLoadState: artifactId ? 'loading' : get().artifactLoadState,
          artifactLoadError: artifactId ? null : get().artifactLoadError,
          artifactRequestedId: artifactId,
        });
        try {
          const { canonicalState, backendMeta, collaborators, experimentRecords, auditLog, historyLog } = await requestCanonicalState('GET', undefined, {
            artifactId,
            projectId: artifactId ? undefined : get().project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE,
          });
          const derivedAnalyzeArtifact = canonicalState.workflowArtifact
            ? deriveAnalyzeCompatibilityProjection(canonicalState.workflowArtifact)
            : canonicalState.analyzeArtifact;
          set((state) => {
            const currentArtifact = artifactId ? state.workflowArtifact : null;
            const incomingArtifact = artifactId ? canonicalState.workflowArtifact : null;
            const persistedArtifactIsNewer = Boolean(
              artifactId
              && currentArtifact
              && incomingArtifact
              && currentArtifact.id === incomingArtifact.id
              && incomingArtifact.version > currentArtifact.version
            );

            if (canonicalState.revision < state.revision && !persistedArtifactIsNewer) {
              return {
                backendMeta,
                collaborators,
                experimentRecords,
                syncAuditLog: auditLog,
                historyLog,
                syncStatus: 'synced',
                syncError: null,
                hydratedFromServer: true,
                lastServerSyncAt: Date.now(),
                lastServerSyncedRevision: canonicalState.revision,
                artifactLoadState: artifactId ? 'ready' : state.artifactLoadState,
                artifactLoadError: null,
                artifactRequestedId: artifactId,
              };
            }
            return {
              ...state,
              ...canonicalState,
              activeArtifactId: canonicalState.activeArtifactId ?? canonicalState.workflowArtifact?.id ?? state.activeArtifactId,
              analyzeArtifact: derivedAnalyzeArtifact,
              workflowControl: canonicalState.workflowControl,
              backendMeta,
              collaborators,
              experimentRecords,
              syncAuditLog: auditLog,
              historyLog,
              syncStatus: 'synced',
              syncError: null,
              hydratedFromServer: true,
              lastServerSyncAt: Date.now(),
              lastServerSyncedRevision: canonicalState.revision,
              artifactLoadState: artifactId ? 'ready' : state.artifactLoadState,
              artifactLoadError: null,
              artifactRequestedId: artifactId,
            };
          });
        } catch (error) {
          const status = error && typeof error === 'object' && 'status' in error
            ? Number((error as { status?: unknown }).status)
            : null;
          set({
            syncStatus: status === 404 ? 'synced' : 'error',
            syncError: status === 404
              ? null
              : error instanceof Error ? error.message : 'Failed to load canonical workbench state',
            hydratedFromServer: true,
            artifactLoadState: artifactId ? (status === 404 ? 'empty' : 'error') : get().artifactLoadState,
            artifactLoadError: artifactId
              ? error instanceof Error ? error.message : 'Failed to resolve canonical workflow artifact'
              : get().artifactLoadError,
            artifactRequestedId: artifactId,
            workflowArtifact: status === 404 && artifactId ? null : get().workflowArtifact,
            analyzeArtifact: status === 404 && artifactId ? null : get().analyzeArtifact,
            activeArtifactId: status === 404 && artifactId ? null : get().activeArtifactId,
          });
        }
      },

      syncToServer: async (options) => {
        const state = get();
        if (!state.hydratedFromServer) return;
        const canonicalState = buildCanonicalSlice(state);
        set({ syncStatus: 'saving', syncError: null });
        try {
          const { canonicalState: savedState, backendMeta, collaborators, experimentRecords, auditLog, historyLog } = await requestCanonicalState('PUT', canonicalState, {
            artifactId: options?.artifactId ?? canonicalState.activeArtifactId,
            projectId: canonicalState.project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE,
          });
          set((currentState) => ({
            ...currentState,
            ...savedState,
            activeArtifactId: savedState.activeArtifactId ?? savedState.workflowArtifact?.id ?? currentState.activeArtifactId,
            analyzeArtifact: savedState.workflowArtifact
              ? deriveAnalyzeCompatibilityProjection(savedState.workflowArtifact)
              : savedState.analyzeArtifact,
            workflowControl: savedState.workflowControl,
            backendMeta,
            collaborators,
            experimentRecords,
            syncAuditLog: auditLog,
            historyLog,
            syncStatus: 'synced',
            syncError: null,
            lastServerSyncAt: Date.now(),
            lastServerSyncedRevision: savedState.revision,
          }));
        } catch (error) {
          const conflictState = error && typeof error === 'object' && 'state' in error
            ? sanitizeWorkbenchState((error as { state?: unknown }).state)
            : null;
          const backendMeta = error && typeof error === 'object' && 'backendMeta' in error
            ? sanitizeWorkbenchBackendMeta((error as { backendMeta?: unknown }).backendMeta)
            : null;
          const collaborators = error && typeof error === 'object' && 'collaborators' in error
            ? sanitizeWorkbenchCollaborators((error as { collaborators?: unknown }).collaborators)
            : [];
          const experimentRecords = error && typeof error === 'object' && 'experimentRecords' in error
            ? sanitizeWorkbenchExperimentRecords((error as { experimentRecords?: unknown }).experimentRecords)
            : [];
          const auditLog = error && typeof error === 'object' && 'auditLog' in error
            ? sanitizeWorkbenchAuditLog((error as { auditLog?: unknown }).auditLog)
            : [];
          const historyLog = error && typeof error === 'object' && 'historyLog' in error
            ? sanitizeWorkbenchHistory((error as { historyLog?: unknown }).historyLog)
            : [];

          if (conflictState) {
            set((currentState) => ({
              ...currentState,
              ...conflictState,
              activeArtifactId: conflictState.activeArtifactId ?? conflictState.workflowArtifact?.id ?? currentState.activeArtifactId,
              analyzeArtifact: conflictState.workflowArtifact
                ? deriveAnalyzeCompatibilityProjection(conflictState.workflowArtifact)
                : conflictState.analyzeArtifact,
              workflowControl: conflictState.workflowControl,
              backendMeta,
              collaborators,
              experimentRecords,
              syncAuditLog: auditLog,
              historyLog,
              syncStatus: 'conflict',
              syncError: 'Server canonical state overrode a stale local revision.',
              hydratedFromServer: true,
              lastServerSyncAt: Date.now(),
              lastServerSyncedRevision: conflictState.revision,
            }));
            return;
          }

          set({
            syncStatus: 'error',
            syncError: error instanceof Error ? error.message : 'Failed to sync canonical workbench state',
          });
        }
      },

      resetWorkbench: () => {
        set({
          ...initialState,
          checkpoints: createEmptyCheckpoints(),
        });
      },
    }),
    {
      name: 'nexus-bio-workbench',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => buildCanonicalSlice(state),
      merge: (persistedState, currentState) => {
        const sanitized = sanitizeWorkbenchState(persistedState);
        return sanitized
          ? {
              ...currentState,
              ...sanitized,
              activeArtifactId: sanitized.activeArtifactId ?? sanitized.workflowArtifact?.id ?? null,
              analyzeArtifact: sanitized.workflowArtifact
                ? deriveAnalyzeCompatibilityProjection(sanitized.workflowArtifact)
                : sanitized.analyzeArtifact,
              workflowControl: sanitized.workflowControl,
            }
          : currentState;
      },
    },
  ),
);
