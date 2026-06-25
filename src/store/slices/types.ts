/**
 * Shared types for workbenchStore slices.
 *
 * Defines the WorkbenchState interface used by all slice helpers.
 * This is the full state type including all actions, so slices can
 * reference each other's actions via StateCreator<WorkbenchState, ...>.
 */

import type { WorkbenchStageId } from "../../components/tools/shared/workbenchConfig";
import type { WorkflowArtifact } from "../../domain/workflowArtifact";
import type { GateDecision } from "../../protocol/nexusTrustRuntime";
import type { WorkbenchToolPayloadMap } from "../workbenchPayloads";
import type {
  AxonRunRecord,
  NextStepRecommendation,
  StageCheckpoint,
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
  WorkbenchRunArtifact,
  WorkbenchSyncAuditEntry,
  WorkbenchToolRun,
  WorkbenchWorkflowControlSnapshot,
} from "../workbenchTypes";

/**
 * Full WorkbenchState interface used by all slices.
 * Includes both data fields and action methods so slices can call
 * cross-slice actions via get().
 */
export interface WorkbenchState extends WorkbenchCanonicalState {
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
  syncStatus: "idle" | "loading" | "saving" | "synced" | "error" | "conflict";
  syncError: string | null;
  hydratedFromServer: boolean;
  lastServerSyncAt: number | null;
  lastServerSyncedRevision: number;
  artifactLoadState: "idle" | "loading" | "ready" | "empty" | "error";
  artifactLoadError: string | null;
  artifactRequestedId: string | null;
  // Actions (needed for cross-slice calls via get())
  ensureProject: (seed?: Partial<WorkbenchProjectBrief>) => void;
  upsertEvidence: (item: Omit<WorkbenchEvidenceItem, "id" | "savedAt">, options?: { select?: boolean }) => string;
  toggleEvidenceSelection: (id: string) => void;
  prepareAnalyzeFromEvidence: (ids?: string[]) => string;
  setDraftAnalyzeInput: (text: string) => void;
  persistWorkflowArtifact: (artifact: WorkflowArtifact) => Promise<WorkflowArtifact>;
  visitTool: (toolId: string | null) => void;
  addToolRun: (
    run: Omit<WorkbenchToolRun, "id" | "createdAt" | "stageId"> & { stageId?: WorkbenchStageId | null },
  ) => void;
  appendAxonRun: (record: AxonRunRecord) => void;
  clearAxonRuns: () => void;
  appendAxonLog: (entry: WorkbenchAxonLogEntry) => void;
  clearAxonLogs: () => void;
  setAxonPlan: (plan: WorkbenchAxonPlanRecord | null) => void;
  updateAxonPlanStep: (
    planId: string,
    stepId: string,
    patch: Partial<WorkbenchAxonPlanRecord["steps"][number]>,
  ) => void;
  setToolPayload: <K extends keyof WorkbenchToolPayloadMap>(toolId: K, payload: WorkbenchToolPayloadMap[K]) => void;
  loopBackWorkflow: () => void;
  seedDemoProject: (toolId?: string | null) => void;
  applyCanonicalState: (
    state: WorkbenchCanonicalState,
    options?: { markHydrated?: boolean; synced?: boolean; conflict?: boolean },
  ) => void;
  loadFromServer: (options?: { artifactId?: string | null }) => Promise<void>;
  syncToServer: (options?: { artifactId?: string | null }) => Promise<void>;
  resetWorkbench: () => void;
}
