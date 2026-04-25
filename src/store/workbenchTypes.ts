import type {
  AxonInteraction,
  BottleneckEnzyme,
  DeNovoDesignStrategy,
  PathwayEdge,
  PathwayNode,
} from '../types';
import type { WorkbenchToolPayloadMap } from './workbenchPayloads';
import type { WorkbenchStageId } from '../components/tools/shared/workbenchConfig';
import type { WorkflowArtifact } from '../domain/workflowArtifact';
import type { ToolId } from '../domain/workflowContract';

export type EvidenceSourceKind = 'literature' | 'analysis' | 'tool' | 'system';

export interface WorkbenchProjectBrief {
  id: string;
  title: string;
  summary: string;
  targetProduct: string;
  sourceQuery?: string;
  status: 'draft' | 'active' | 'iterating';
  isDemo: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WorkbenchEvidenceItem {
  id: string;
  sourceKind: EvidenceSourceKind;
  title: string;
  abstract: string;
  authors: string[];
  journal?: string;
  year?: string;
  doi?: string;
  url?: string;
  source?: string;
  query?: string;
  savedAt: number;
}

export interface PathwayCandidateSummary {
  id: string;
  label: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
}

export interface BottleneckAssumption {
  id: string;
  label: string;
  detail: string;
  yieldLossPercent?: number;
}

export interface EnzymeCandidateSummary {
  id: string;
  label: string;
  rationale: string;
}

export interface WorkbenchAnalyzeArtifact {
  id: string;
  title: string;
  summary: string;
  targetProduct: string;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  pathwayCandidates: PathwayCandidateSummary[];
  bottleneckAssumptions: BottleneckAssumption[];
  enzymeCandidates: EnzymeCandidateSummary[];
  thermodynamicConcerns: string[];
  recommendedNextTools: string[];
  evidenceTraceIds: string[];
  sourceProvider?: string | null;
  generatedAt: number;
}

export interface WorkbenchToolRun {
  id: string;
  toolId: string;
  stageId: WorkbenchStageId | null;
  title: string;
  summary: string;
  isSimulated: boolean;
  createdAt: number;
}

export interface StageCheckpoint {
  id: WorkbenchStageId;
  status: 'pending' | 'active' | 'complete';
  summary: string;
  updatedAt: number;
}

export interface NextStepRecommendation {
  id: string;
  toolId: string;
  source: 'analysis' | 'flow' | 'tool';
  reason: string;
}

export interface StructuredAnalysisPayload {
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  bottlenecks: BottleneckEnzyme[];
  designStrategies: DeNovoDesignStrategy[];
  interaction: AxonInteraction | null;
  sourceProvider?: string | null;
}

/**
 * Phase-1 — Workflow Control Plane. `status` is the explicit gate signal
 * the contract validator emits when `setToolPayload` runs:
 *   - 'ok'        : payload satisfies the tool's contract.
 *   - 'simulated' : tool's payload is demo-validity or runs on a demo project.
 *   - 'blocked'   : required upstream artifacts are missing — UI must
 *                   render the gate; downstream stage transitions refuse.
 *   - 'gated'     : evidence requirement / human-gate triggered.
 * Field is optional so older serialized projects (no status field) read
 * as `undefined` — call sites treat undefined as `'ok'` for back-compat.
 */
export type WorkbenchRunStatus = 'ok' | 'simulated' | 'blocked' | 'gated';

export interface WorkbenchRunArtifact {
  id: string;
  toolId: keyof WorkbenchToolPayloadMap;
  stageId: WorkbenchStageId | null;
  targetProduct: string;
  sourceArtifactId?: string;
  upstreamArtifactIds: string[];
  execution: {
    projectRef: string | null;
    analyzeRef: string | null;
    upstreamToolIds: string[];
    upstreamArtifactIds: string[];
    dependencySignature: string;
  };
  summary: string;
  payloadSnapshot: WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap];
  createdAt: number;
  isSimulated: boolean;
  status?: WorkbenchRunStatus;
  /** Optional human-readable reason; used when status !== 'ok'. */
  statusReason?: string;
  /**
   * When status='blocked', which upstream tool ids are missing required
   * payloads. Surfaced by the Decision Trace panel to point at the next
   * required step.
   */
  blockingUpstreamToolIds?: string[];
}

export interface WorkbenchBackendMeta {
  kind: 'sqlite';
  driver: 'better-sqlite3';
  scope: 'project';
  path: string;
  projectId: string;
  actorId: string;
  revision: number;
  updatedAt: number;
  runArtifactCount: number;
  auditCount: number;
  historyCount: number;
  experimentCount: number;
  memberCount: number;
  projectCount: number;
}

export interface WorkbenchSyncAuditEntry {
  id: number;
  projectId: string | null;
  actorId: string | null;
  revision: number;
  action: string;
  status: string;
  detail: string | null;
  createdAt: number;
}

export interface WorkbenchHistoryEntry {
  revision: number;
  projectId: string | null;
  actorId: string | null;
  projectTitle: string;
  targetProduct: string;
  analyzeTitle: string | null;
  analyzeGeneratedAt: number | null;
  runArtifactCount: number;
  mutationAt: number;
  updatedAt: number;
}

export interface WorkbenchCollaborator {
  actorId: string;
  displayName: string;
  role: string;
  lastSeenAt: number;
}

/**
 * Structured summary of a terminal Axon orchestrator task. Written by
 * the axonWriteback layer when a PATHD or FBASIM automation run
 * finishes. Lives in workbench state so it is visible across every
 * tool page, not just NEXAI.
 */
export interface AxonRunRecord {
  taskId: string;
  tool: ToolId;
  status: 'done' | 'error';
  label: string;
  summary: string;
  timestamp: number;
  provenance: {
    createdAt: number;
    startedAt?: number;
    retryCount: number;
  };
  resultPreview: Record<string, unknown> | null;
  error: string | null;
}

/**
 * PR-4: compact snapshot of an Axon plan, stored on the workbench so
 * plans survive navigation between tools. The planner produces richer
 * objects (see `axonPlanner.ts`) — this is the shape the store keeps.
 */
export interface WorkbenchAxonPlanStepRecord {
  id: string;
  title: string;
  tool: ToolId;
  objective: string;
  inputSummary: string;
  expectedOutput: string;
  dependsOn: string[];
  status:
    | 'planned'
    | 'enqueued'
    | 'running'
    | 'done'
    | 'error'
    | 'cancelled'
    | 'unsupported';
  reason: string;
  taskId?: string;
}

export interface WorkbenchAxonPlanRecord {
  id: string;
  createdAt: number;
  origin: 'user' | 'auto';
  request: string;
  steps: WorkbenchAxonPlanStepRecord[];
  warnings: string[];
  depth: number;
}

/**
 * PR-4: single trace entry surfaced in the shared live-log panel.
 * Mirrors `AxonLogEntry` from `axonExecutionLog.ts`; kept here so the
 * store has no runtime dependency on the services layer.
 */
export interface WorkbenchAxonLogEntry {
  id: string;
  timestamp: number;
  phase: string;
  message: string;
  taskId?: string;
  planId?: string;
  tool?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkbenchExperimentRecord {
  recordId: string;
  projectId: string;
  actorId: string;
  revision: number;
  toolId: string;
  stageId: WorkbenchStageId | null;
  category: 'analysis' | 'experiment';
  title: string;
  summary: string;
  status: string;
  authorityTier: 'simulated' | 'contextual' | 'evidence-linked' | 'experiment-backed';
  metrics: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkbenchCanonicalState {
  schemaVersion: number;
  revision: number;
  lastMutationAt: number;
  activeArtifactId: string | null;
  project: WorkbenchProjectBrief | null;
  evidenceItems: WorkbenchEvidenceItem[];
  selectedEvidenceIds: string[];
  draftAnalyzeInput: string;
  workflowArtifact: WorkflowArtifact | null;
  analyzeArtifact: WorkbenchAnalyzeArtifact | null;
  toolRuns: WorkbenchToolRun[];
  toolPayloads: WorkbenchToolPayloadMap;
  runArtifacts: WorkbenchRunArtifact[];
  checkpoints: StageCheckpoint[];
  nextRecommendations: NextStepRecommendation[];
}
