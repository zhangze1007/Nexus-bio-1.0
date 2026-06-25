/**
 * Shared pure helper functions for workbenchStore slices.
 *
 * These are stateless utilities used by multiple slices. They have no
 * store dependencies and perform no side effects.
 */

import { getStageForTool } from "../../components/tools/shared/workbenchConfig";
import { TOOL_ASSUMPTIONS } from "../../config/toolAssumptions";
import { getToolValidity } from "../../config/toolValidity";
import { buildExecutionSnapshot } from "../../config/workbenchExecution";
import { getUpstreamToolIds } from "../../config/workbenchGraph";
import type { WorkflowArtifact } from "../../domain/workflowArtifact";
import { deriveAnalyzeCompatibilityProjection } from "../../domain/workflowArtifactAdapters";
import { GOLDEN_PATH_TOOL_IDS, meetsValidityFloor, type ToolId } from "../../domain/workflowContract";
import type { AxonTool } from "../../services/AxonOrchestrator";
import { isAxonToolSupported } from "../../services/axonAdapterRegistry";
import { collectProvenanceIds, withProvenanceSync } from "../../services/provenanceMiddleware";
import {
  evaluateWorkbenchPayloadAdmission,
  inferAdmissionInputFromPayload,
} from "../../services/workbenchPayloadAdmission";
import { evaluateToolContract } from "../../services/workflowContractEvaluator";
import { tryGetToolContract } from "../../services/workflowRegistry";
import type { WorkflowActor, WorkflowStateValue, WorkflowToolStatus } from "../../services/workflowStateMachine";
import { buildWorkflowDecision } from "../../services/workflowSupervisor";
import type { WorkbenchToolPayloadMap } from "../workbenchPayloads";
import {
  createId as _createId,
  buildCheckpoints,
  buildRecommendationsFromToolIds,
  createId,
  DEFAULT_PROJECT_SYNC_SCOPE,
  getWorkbenchActorId,
  inferToolSimulation,
  normalizeNonEmptyId,
  PROVENANCE_MIDDLEWARE_TOOL_IDS,
  payloadValidity,
  stableSerialize,
  WORKBENCH_ACTOR_KEY,
} from "../workbenchStoreHelpers";
import type {
  EvidenceSourceKind,
  WorkbenchCanonicalState,
  WorkbenchEvidenceItem,
  WorkbenchRunArtifact,
  WorkbenchWorkflowControlSnapshot,
} from "../workbenchTypes";
import {
  sanitizeWorkbenchAuditLog,
  sanitizeWorkbenchBackendMeta,
  sanitizeWorkbenchCollaborators,
  sanitizeWorkbenchExperimentRecords,
  sanitizeWorkbenchHistory,
  sanitizeWorkbenchState,
} from "../workbenchValidation";
import type { WorkbenchState } from "./types";

// Re-export for slice convenience
export {
  buildCheckpoints,
  buildRecommendationsFromToolIds,
  createId,
  inferToolSimulation,
  normalizeNonEmptyId,
  payloadValidity,
  stableSerialize,
};

// ── Contract status decision ──
export type ContractStatusDecision = {
  status: WorkbenchRunArtifact["status"];
  blockingUpstreamToolIds: string[];
  reason: string;
  confidence: WorkbenchRunArtifact["confidence"];
  uncertainty: WorkbenchRunArtifact["uncertainty"];
  validity: WorkbenchRunArtifact["validity"];
  humanGateRequired: boolean;
};

const EVIDENCE_SOURCE_KINDS: EvidenceSourceKind[] = ["literature", "analysis", "tool", "system"];

// ── summarizePayload ──
export function summarizePayload<K extends keyof WorkbenchToolPayloadMap>(
  toolId: K,
  payload: WorkbenchToolPayloadMap[K],
) {
  if (!payload) return `${String(toolId).toUpperCase()} updated`;
  switch (toolId) {
    case "pathd": {
      const data = (payload as WorkbenchToolPayloadMap["pathd"])!;
      return `PATHD ${data.activeRouteLabel} · ${data.nodeCount} nodes · ${data.result.bottleneckCount} bottlenecks`;
    }
    case "fbasim": {
      const data = (payload as WorkbenchToolPayloadMap["fbasim"])!;
      return `FBA ${data.mode} run · growth ${data.result.growthRate.toFixed(3)} · feasible ${data.result.feasible ? "yes" : "no"}`;
    }
    case "cethx": {
      const data = (payload as WorkbenchToolPayloadMap["cethx"])!;
      return `Thermo ${data.pathway} · ΔG ${data.result.gibbsFreeEnergy.toFixed(1)} · η ${data.result.efficiency.toFixed(1)}%`;
    }
    case "catdes": {
      const data = (payload as WorkbenchToolPayloadMap["catdes"])!;
      return `Catalyst ${data.selectedEnzymeName} · ${data.designCount} designs · viable ${data.result.isViable ? "yes" : "no"}`;
    }
    case "dyncon": {
      const data = (payload as WorkbenchToolPayloadMap["dyncon"])!;
      return `Dynamic control · titer ${data.result.productTiter.toFixed(2)} · stable ${data.result.stable ? "yes" : "no"}`;
    }
    case "cellfree": {
      const data = (payload as WorkbenchToolPayloadMap["cellfree"])!;
      return `Cell-free ${data.targetConstruct} · ${data.result.totalProteinYield.toFixed(2)} mg/mL`;
    }
    case "dbtlflow": {
      const data = (payload as WorkbenchToolPayloadMap["dbtlflow"])!;
      const typedMetricCount = Object.values(data.result.feedback?.learnedMetrics ?? {}).filter(
        (value) => typeof value === "number",
      ).length;
      const legacyLearnedCount = data.result.learnedParameters?.length ?? 0;
      return `DBTL ${data.proposedPhase} · pass ${data.passed ? "yes" : "no"} · ${typedMetricCount || legacyLearnedCount} learned`;
    }
    case "proevol": {
      const data = (payload as WorkbenchToolPayloadMap["proevol"])!;
      return `PROEVOL ${data.targetProtein} · round ${data.currentRound}/${data.totalRounds} · lead ${data.result.leadVariantName}`;
    }
    case "gecair": {
      const data = (payload as WorkbenchToolPayloadMap["gecair"])!;
      return `Gene circuit ${data.gateType} · output ${data.result.outputLevel.toFixed(2)}`;
    }
    case "genmim": {
      const data = (payload as WorkbenchToolPayloadMap["genmim"])!;
      return `Genome minimizer · ${data.result.selectedTargets} targets · risk ${data.result.offTargetRisk.toFixed(2)}`;
    }
    case "multio": {
      const data = (payload as WorkbenchToolPayloadMap["multio"])!;
      return `Multi-omics ${data.selectedGene} · ${data.result.significantCount} significant signals`;
    }
    case "scspatial": {
      const data = (payload as WorkbenchToolPayloadMap["scspatial"])!;
      return `Spatial ${data.highlightGene} · cluster ${data.result.highestYieldCluster}`;
    }
    case "nexai": {
      const data = (payload as WorkbenchToolPayloadMap["nexai"])!;
      return `Axon ${data.result.mode} · ${data.result.citations} citations · ${(data.result.confidence * 100).toFixed(0)}% confidence`;
    }
    default:
      return `${String(toolId).toUpperCase()} updated`;
  }
}

// ── buildRunEvidenceSnapshot ──
export function buildRunEvidenceSnapshot(
  state: Pick<WorkbenchState, "evidenceItems" | "selectedEvidenceIds">,
  toolId: keyof WorkbenchToolPayloadMap,
): WorkbenchRunArtifact["evidenceSnapshot"] {
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
      ? "not-required"
      : count >= minRequired && missingKinds.length === 0
        ? "satisfied"
        : "missing";

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

// ── evaluateContractStatus ──
export function evaluateContractStatus(
  toolId: keyof WorkbenchToolPayloadMap,
  payload: WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap],
  latestByTool: Map<string, WorkbenchRunArtifact>,
  projectIsDemo: boolean,
): ContractStatusDecision {
  const contract = tryGetToolContract(toolId as string);
  if (!contract) {
    return {
      status: "ok",
      blockingUpstreamToolIds: [],
      reason: "",
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
    if (upstream.status === "blocked" || upstream.status === "gated" || upstream.status === "demoOnly") {
      blocking.push(ref.toolId);
      reasons.push(`${ref.toolId.toUpperCase()} is itself ${upstream.status}`);
    }
    if (upstream.status === "simulated") {
      blocking.push(ref.toolId);
      reasons.push(`${ref.toolId.toUpperCase()} is simulated`);
    }
  }

  if (blocking.length) {
    return {
      status: "blocked",
      blockingUpstreamToolIds: Array.from(new Set(blocking)),
      reason: reasons.join("; "),
      ...runMetadata,
    };
  }

  if (!current.status.hasRequiredOutputs) {
    return {
      status: "blocked",
      blockingUpstreamToolIds: [],
      reason: current.reason,
      ...runMetadata,
    };
  }

  if (current.isSimulated) {
    return {
      status: "demoOnly",
      blockingUpstreamToolIds: [],
      reason: current.reason,
      ...runMetadata,
      humanGateRequired: true,
    };
  }

  if (!current.validityOk || !current.confidenceOk || !current.uncertaintyOk) {
    return {
      status: "gated",
      blockingUpstreamToolIds: [],
      reason: current.reason,
      ...runMetadata,
      humanGateRequired: true,
    };
  }

  return {
    status: "ok",
    blockingUpstreamToolIds: [],
    reason: "",
    ...runMetadata,
  };
}

// ── createRunArtifact ──
export function createRunArtifact<K extends keyof WorkbenchToolPayloadMap>(
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

  const latestByTool = new Map<string, WorkbenchRunArtifact>();
  state.runArtifacts.forEach((artifact) => {
    if (!latestByTool.has(artifact.toolId)) latestByTool.set(artifact.toolId, artifact);
  });
  const contractDecision = evaluateContractStatus(toolId, payload, latestByTool, Boolean(state.project?.isDemo));

  const isSimulated =
    contractDecision.status === "blocked" ||
    contractDecision.status === "simulated" ||
    contractDecision.status === "demoOnly" ||
    inferToolSimulation(payload) ||
    Boolean(state.project?.isDemo);

  return {
    id: createId("run"),
    toolId,
    stageId,
    targetProduct:
      payload?.targetProduct ?? analyzeArtifact?.targetProduct ?? state.project?.targetProduct ?? "Target Product",
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
      contractDecision.blockingUpstreamToolIds.length > 0 ? contractDecision.blockingUpstreamToolIds : undefined,
    confidence: contractDecision.confidence ?? null,
    uncertainty: contractDecision.uncertainty ?? null,
    validity: contractDecision.validity ?? null,
    humanGateRequired: contractDecision.humanGateRequired,
    iteration: getWorkflowActor().getSnapshot().context.iteration,
    evidenceSnapshot: buildRunEvidenceSnapshot(state, toolId),
  };
}

// ── getAnalyzeArtifactForState ──
export function getAnalyzeArtifactForState(state: Pick<WorkbenchState, "workflowArtifact" | "analyzeArtifact">) {
  return state.workflowArtifact ? deriveAnalyzeCompatibilityProjection(state.workflowArtifact) : state.analyzeArtifact;
}

// ── buildCanonicalSlice ──
export function buildCanonicalSlice(
  state: Pick<
    WorkbenchState,
    | "schemaVersion"
    | "revision"
    | "lastMutationAt"
    | "activeArtifactId"
    | "project"
    | "evidenceItems"
    | "selectedEvidenceIds"
    | "draftAnalyzeInput"
    | "workflowArtifact"
    | "analyzeArtifact"
    | "toolRuns"
    | "toolPayloads"
    | "payloadAdmissionDecisionsByToolId"
    | "runArtifacts"
    | "checkpoints"
    | "nextRecommendations"
    | "workflowControl"
  >,
): WorkbenchCanonicalState {
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

// ── touchState ──
export function touchState(state: WorkbenchState, patch: Partial<WorkbenchCanonicalState>) {
  const now = Date.now();
  return {
    ...patch,
    revision: state.revision + 1,
    lastMutationAt: now,
    syncStatus: state.hydratedFromServer ? "saving" : state.syncStatus,
    syncError: null,
  };
}

// ── requestCanonicalState ──
export async function requestCanonicalState(
  method: "GET" | "PUT",
  state?: WorkbenchCanonicalState,
  options?: { projectId?: string | null; artifactId?: string | null },
) {
  const actorId = getWorkbenchActorId();
  const projectId = options?.projectId ?? state?.project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE;
  const artifactId = normalizeNonEmptyId(
    options?.artifactId ?? state?.activeArtifactId ?? state?.workflowArtifact?.id ?? null,
  );
  const url = artifactId ? `/api/workbench?artifact=${encodeURIComponent(artifactId)}` : "/api/workbench";
  const requestBody = method === "PUT" ? { state } : undefined;
  const isCanonicalArtifactSave = method === "PUT" && Boolean(state?.workflowArtifact);
  if (isCanonicalArtifactSave && process.env.NODE_ENV !== "production") {
    console.info("[workbench] canonical save request payload", {
      url,
      projectId,
      artifactId,
      state: requestBody?.state,
    });
  }
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-workbench-actor-id": actorId,
      "x-workbench-project-id": projectId,
    },
    cache: "no-store",
    body: requestBody ? JSON.stringify(requestBody) : undefined,
  });
  const payload = await response.json().catch(() => {
    console.warn(`[Workbench] Failed to parse JSON response (status ${response.status})`);
    return {};
  });
  if (isCanonicalArtifactSave && process.env.NODE_ENV !== "production") {
    console.info("[workbench] canonical save response payload", payload);
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
    throw new Error("Workbench server returned an invalid canonical state");
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

// ── buildCanonicalPatchFromWorkflowArtifact ──
export function buildCanonicalPatchFromWorkflowArtifact(
  state: WorkbenchState,
  artifact: WorkflowArtifact,
): Partial<WorkbenchCanonicalState> {
  const analyzeArtifact = deriveAnalyzeCompatibilityProjection(artifact);
  const project = state.project ?? {
    id: createId("project"),
    title: analyzeArtifact.title,
    summary: analyzeArtifact.summary,
    targetProduct: analyzeArtifact.targetProduct,
    status: "active" as const,
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
      status: "active",
      isDemo: false,
      updatedAt: Date.now(),
    },
    checkpoints: buildCheckpoints("stage-1", analyzeArtifact, state.toolRuns),
    nextRecommendations: buildRecommendationsFromToolIds(
      analyzeArtifact.recommendedNextTools,
      "analysis",
      "Recommended from canonical workflow artifact",
    ),
  };
}

// ── isValidPersistedWorkflowArtifact ──
export function isValidPersistedWorkflowArtifact(
  artifact: WorkflowArtifact | null | undefined,
): artifact is WorkflowArtifact {
  return Boolean(
    artifact &&
      normalizeNonEmptyId(artifact.id) &&
      artifact.status === "compiled" &&
      artifact.atomicPathwayGraph &&
      artifact.atomicPathwayGraph.nodes.length > 0,
  );
}

// ── summarizeWorkflowArtifactDebug ──
export function summarizeWorkflowArtifactDebug(artifact: WorkflowArtifact | null | undefined) {
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

// ── maybeAttachPayloadProvenance ──
function outputAssumptionIdsForTool(toolId: string): string[] {
  return (TOOL_ASSUMPTIONS[toolId] ?? []).map((assumption) => assumption.id);
}

function provenanceIdsForToolPayloads(toolIds: readonly string[], toolPayloads: WorkbenchToolPayloadMap): string[] {
  return Array.from(
    new Set(
      toolIds.flatMap((upstreamToolId) =>
        collectProvenanceIds(toolPayloads[upstreamToolId as keyof WorkbenchToolPayloadMap]),
      ),
    ),
  );
}

export function maybeAttachPayloadProvenance<K extends keyof WorkbenchToolPayloadMap>(
  toolId: K,
  payload: WorkbenchToolPayloadMap[K],
  state: Pick<WorkbenchState, "toolPayloads">,
): WorkbenchToolPayloadMap[K] {
  const toolIdText = String(toolId);
  if (!PROVENANCE_MIDDLEWARE_TOOL_IDS.has(toolIdText)) return payload;
  if (isPayloadRecord(payload) && payload.runProvenance !== undefined) return payload;

  const startedAt = payloadTimestamp(payload);
  return withProvenanceSync(
    payload,
    {
      toolId: toolIdText,
      activityType: "tool-run",
      surface: "payload",
      outputAssumptionIds: outputAssumptionIdsForTool(toolIdText),
      upstreamProvenanceIds: provenanceIdsForToolPayloads(getUpstreamToolIds(toolIdText), state.toolPayloads),
      ...(startedAt ? { startedAt, completedAt: startedAt } : {}),
    },
    (currentPayload) => currentPayload,
  ).payload;
}

// ── Workflow actor management ──
// These are module-level singletons shared across slices.
import { createWorkflowActor, GOLDEN_PATH_DONE_EVENT } from "../../services/workflowStateMachine";

let workflowActor: WorkflowActor | null = null;

export function getWorkflowActor(): WorkflowActor {
  if (!workflowActor) {
    workflowActor = createWorkflowActor();
    workflowActor.start();
  }
  return workflowActor;
}

export function resetWorkflowActor(): void {
  if (workflowActor) {
    try {
      workflowActor.stop();
    } catch {
      // ignore stop errors
    }
  }
  workflowActor = null;
}

/** Test helper. Delegates to resetWorkflowActor(). */
export function __resetWorkflowActorForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    console.warn("__resetWorkflowActorForTests called outside test environment");
    return;
  }
  resetWorkflowActor();
}

export function syncWorkflowActor(
  targetProduct: string | null,
  toolStatus: Partial<Record<ToolId, WorkflowToolStatus>>,
): WorkflowStateValue {
  let actor = getWorkflowActor();
  let ctx = actor.getSnapshot().context;

  if (ctx.targetProduct !== null && ctx.targetProduct !== targetProduct) {
    resetWorkflowActor();
    actor = getWorkflowActor();
    ctx = actor.getSnapshot().context;
  }

  if (targetProduct && ctx.targetProduct !== targetProduct) {
    actor.send({ type: "SET_TARGET", targetProduct });
  }

  for (const tool of GOLDEN_PATH_TOOL_IDS) {
    const status = toolStatus[tool];
    if (!status) continue;
    const eventType = GOLDEN_PATH_DONE_EVENT[tool];
    actor.send({ type: eventType as "PATHD_DONE", status });
  }

  return actor.getSnapshot().value as WorkflowStateValue;
}

export function dispatchEvidenceAdded(ids: string[]): void {
  if (!ids.length) return;
  getWorkflowActor().send({ type: "EVIDENCE_ADDED", ids });
}

export function dispatchLoopBack(): void {
  getWorkflowActor().send({ type: "LOOP_BACK" });
}

// ── buildWorkflowControlSnapshot ──
export function buildWorkflowControlSnapshot(
  state: Pick<WorkbenchState, "project" | "analyzeArtifact" | "toolPayloads" | "evidenceItems" | "runArtifacts">,
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
  const latestRunAffectsWorkflow = latestRunContract?.contractScope === "workflow";
  const runGateStatus =
    latestRunAffectsWorkflow &&
    (latestRunStatus === "blocked" || latestRunStatus === "gated" || latestRunStatus === "demoOnly")
      ? latestRunStatus
      : null;
  const status = runGateStatus === "demoOnly" ? "demoOnly" : (runGateStatus ?? decision.status);

  return {
    machineState,
    status,
    currentToolId: decision.currentToolId,
    nextRecommendedNode:
      runGateStatus === "blocked"
        ? ((latestRun?.blockingUpstreamToolIds?.[0] as ToolId | undefined) ?? decision.nextRecommendedNode)
        : decision.nextRecommendedNode,
    missingEvidence: decision.missingEvidence,
    confidence: decision.confidence,
    uncertainty: decision.uncertainty,
    validity: decision.validity,
    humanGateRequired: decision.humanGateRequired || status === "gated" || status === "demoOnly",
    nextNodeIsContractOnly: decision.nextNodeIsContractOnly,
    isDemoOnly: status === "demoOnly",
    latestRunStatus,
    latestRunToolId: latestRun?.toolId ?? null,
    reasonCodes: [...decision.reasonCodes, ...(runGateStatus ? [`LATEST_RUN_${runGateStatus.toUpperCase()}`] : [])],
    explanation:
      runGateStatus && latestRun?.statusReason
        ? `${String(latestRun.toolId).toUpperCase()} did not advance: ${latestRun.statusReason}`
        : decision.explanation,
    iteration,
    updatedAt: Date.now(),
  };
}

// ── inferWorkflowMachineState ──
export const STATE_AFTER_TOOL: Record<string, WorkflowStateValue> = {
  pathd: "pathdReady",
  fbasim: "fbasimReady",
  catdes: "catdesReady",
  dyncon: "dynconReady",
  cellfree: "cellfreeReady",
  dbtlflow: "dbtlCommitted",
};

export function inferWorkflowMachineState(
  toolStatus: Partial<Record<ToolId, WorkflowToolStatus>>,
  hasTarget: boolean,
): WorkflowStateValue {
  if (!hasTarget) return "idle";
  let state: WorkflowStateValue = "targetSet";
  for (const tool of GOLDEN_PATH_TOOL_IDS) {
    const status = toolStatus[tool];
    const contract = tryGetToolContract(tool);
    if (!status || !contract) break;
    const validityOk = status.validity !== null && meetsValidityFloor(status.validity, contract.validityBaseline.floor);
    const confidenceOk =
      contract.confidencePolicy.minToAdvance === null ||
      (status.confidence !== null && status.confidence >= contract.confidencePolicy.minToAdvance);
    const uncertaintyOk = !contract.uncertaintyPolicy.unboundedIsGate || status.uncertainty != null;
    if (!status.hasRequiredOutputs || status.isSimulated || !validityOk || !confidenceOk || !uncertaintyOk) break;
    state = STATE_AFTER_TOOL[tool];
  }
  return state;
}

// ── createInitialWorkflowControl ──
export function createInitialWorkflowControl(now = Date.now()): WorkbenchWorkflowControlSnapshot {
  return {
    machineState: "idle",
    status: "idle",
    currentToolId: null,
    nextRecommendedNode: "pathd",
    missingEvidence: { minRequired: 0, have: 0, kinds: [] },
    confidence: null,
    uncertainty: null,
    validity: null,
    humanGateRequired: false,
    nextNodeIsContractOnly: false,
    isDemoOnly: false,
    latestRunStatus: null,
    latestRunToolId: null,
    reasonCodes: ["NO_TARGET"],
    explanation: "No target product set. Set a target via /research or /analyze, then run PATHD.",
    iteration: 0,
    updatedAt: now,
  };
}

// Import missing helper from workbenchStoreHelpers
import { isPayloadRecord, payloadTimestamp } from "../workbenchStoreHelpers";
