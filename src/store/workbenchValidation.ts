import { isValidEdge, isValidNode } from '../types';
import type {
  WorkflowArtifact,
  WorkflowArtifactEdge,
  WorkflowArtifactNode,
} from '../domain/workflowArtifact';
import type {
  WorkbenchBackendMeta,
  WorkbenchCollaborator,
  WorkbenchExperimentRecord,
  WorkbenchHistoryEntry,
  BottleneckAssumption,
  EnzymeCandidateSummary,
  NextStepRecommendation,
  PathwayCandidateSummary,
  StageCheckpoint,
  WorkbenchAnalyzeArtifact,
  WorkbenchCanonicalState,
  WorkbenchEvidenceItem,
  WorkbenchProjectBrief,
  WorkbenchRunArtifact,
  WorkbenchSyncAuditEntry,
  WorkbenchToolRun,
} from './workbenchTypes';
import type { WorkbenchToolPayloadMap } from './workbenchPayloads';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function sanitizeProject(value: unknown): WorkbenchProjectBrief | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id),
    title: asString(value.title, 'Synthetic Biology Program'),
    summary: asString(value.summary),
    targetProduct: asString(value.targetProduct, 'Target Product'),
    sourceQuery: typeof value.sourceQuery === 'string' ? value.sourceQuery : undefined,
    status: value.status === 'active' || value.status === 'iterating' ? value.status : 'draft',
    isDemo: Boolean(value.isDemo),
    createdAt: asNumber(value.createdAt, Date.now()),
    updatedAt: asNumber(value.updatedAt, Date.now()),
  };
}

function sanitizeEvidenceItem(value: unknown): WorkbenchEvidenceItem | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    sourceKind: value.sourceKind === 'analysis' || value.sourceKind === 'tool' || value.sourceKind === 'system' ? value.sourceKind : 'literature',
    title: asString(value.title),
    abstract: asString(value.abstract),
    authors: asStringArray(value.authors),
    journal: typeof value.journal === 'string' ? value.journal : undefined,
    year: typeof value.year === 'string' ? value.year : undefined,
    doi: typeof value.doi === 'string' ? value.doi : undefined,
    url: typeof value.url === 'string' ? value.url : undefined,
    source: typeof value.source === 'string' ? value.source : undefined,
    query: typeof value.query === 'string' ? value.query : undefined,
    savedAt: asNumber(value.savedAt, Date.now()),
  };
}

function sanitizePathwayCandidate(value: unknown): PathwayCandidateSummary | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    label: asString(value.label),
    description: asString(value.description),
    nodeCount: asNumber(value.nodeCount),
    edgeCount: asNumber(value.edgeCount),
  };
}

function sanitizeBottleneck(value: unknown): BottleneckAssumption | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    label: asString(value.label),
    detail: asString(value.detail),
    yieldLossPercent: typeof value.yieldLossPercent === 'number' ? value.yieldLossPercent : undefined,
  };
}

function sanitizeEnzymeCandidate(value: unknown): EnzymeCandidateSummary | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    label: asString(value.label),
    rationale: asString(value.rationale),
  };
}

function sanitizeAnalyzeArtifact(value: unknown): WorkbenchAnalyzeArtifact | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const nodes = Array.isArray(value.nodes) ? value.nodes.filter(isValidNode) : [];
  const edges = Array.isArray(value.edges) ? value.edges.filter(isValidEdge) : [];
  return {
    id: value.id,
    title: asString(value.title),
    summary: asString(value.summary),
    targetProduct: asString(value.targetProduct, 'Target Product'),
    nodes: nodes as WorkbenchAnalyzeArtifact['nodes'],
    edges: edges as WorkbenchAnalyzeArtifact['edges'],
    pathwayCandidates: (Array.isArray(value.pathwayCandidates) ? value.pathwayCandidates : []).map(sanitizePathwayCandidate).filter(Boolean) as PathwayCandidateSummary[],
    bottleneckAssumptions: (Array.isArray(value.bottleneckAssumptions) ? value.bottleneckAssumptions : []).map(sanitizeBottleneck).filter(Boolean) as BottleneckAssumption[],
    enzymeCandidates: (Array.isArray(value.enzymeCandidates) ? value.enzymeCandidates : []).map(sanitizeEnzymeCandidate).filter(Boolean) as EnzymeCandidateSummary[],
    thermodynamicConcerns: asStringArray(value.thermodynamicConcerns),
    recommendedNextTools: asStringArray(value.recommendedNextTools),
    evidenceTraceIds: asStringArray(value.evidenceTraceIds),
    sourceProvider: typeof value.sourceProvider === 'string' ? value.sourceProvider : undefined,
    generatedAt: asNumber(value.generatedAt, Date.now()),
  };
}

function sanitizeWorkflowArtifactNode(value: unknown): WorkflowArtifactNode | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const role = value.role;
  if (
    role !== 'metabolite'
    && role !== 'enzyme'
    && role !== 'gene'
    && role !== 'cofactor'
    && role !== 'intermediate'
    && role !== 'impurity'
    && role !== 'hypothesis'
  ) {
    return null;
  }
  return {
    ...(value as unknown as WorkflowArtifactNode),
    id: asString(value.id),
    label: asString(value.label),
    summary: asString(value.summary),
    citation: asString(value.citation),
    color: asString(value.color),
    role,
  };
}

function sanitizeWorkflowArtifactEdge(value: unknown): WorkflowArtifactEdge | null {
  if (!isRecord(value) || typeof value.start !== 'string' || typeof value.end !== 'string') return null;
  const role = value.role;
  if (
    role !== 'evidence-backed-transition'
    && role !== 'inferred-transition'
    && role !== 'catalysis'
    && role !== 'regulation'
    && role !== 'abstraction'
  ) {
    return null;
  }
  const key = asString(value.key);
  if (!key) return null;
  return {
    ...(value as unknown as WorkflowArtifactEdge),
    start: asString(value.start),
    end: asString(value.end),
    key,
    role,
  };
}

function sanitizeWorkflowArtifact(value: unknown): WorkflowArtifact | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const status = value.status === 'compiled' || value.status === 'error' ? value.status : 'draft';
  const sourcePage = value.sourcePage === 'research' || value.sourcePage === 'pathd' ? value.sourcePage : 'analyze';
  const intake = isRecord(value.intake) ? value.intake : {};
  const provenance = isRecord(value.provenance) ? value.provenance : {};
  const workbench = isRecord(value.workbench) ? value.workbench : {};
  const atomicPathwayGraph = isRecord(value.atomicPathwayGraph)
    ? {
        nodes: (Array.isArray(value.atomicPathwayGraph.nodes) ? value.atomicPathwayGraph.nodes : [])
          .map(sanitizeWorkflowArtifactNode)
          .filter(Boolean) as WorkflowArtifactNode[],
        edges: (Array.isArray(value.atomicPathwayGraph.edges) ? value.atomicPathwayGraph.edges : [])
          .map(sanitizeWorkflowArtifactEdge)
          .filter(Boolean) as WorkflowArtifactEdge[],
      }
    : null;

  return {
    id: value.id,
    schemaVersion: Math.max(1, asNumber(value.schemaVersion, 1)),
    version: Math.max(0, asNumber(value.version)),
    status,
    sourcePage,
    intake: {
      sourceQuery: typeof intake.sourceQuery === 'string' ? intake.sourceQuery : undefined,
      targetMolecule: typeof intake.targetMolecule === 'string' ? intake.targetMolecule : undefined,
      projectIntent: typeof intake.projectIntent === 'string' ? intake.projectIntent : undefined,
      rawAnalyzeInput: asString(intake.rawAnalyzeInput),
    },
    evidencePackets: (Array.isArray(value.evidencePackets) ? value.evidencePackets : []).map((packet) => {
      if (!isRecord(packet) || typeof packet.id !== 'string') return null;
      return {
        id: packet.id,
        sourceKind: packet.sourceKind === 'analysis' || packet.sourceKind === 'tool' || packet.sourceKind === 'system' ? packet.sourceKind : 'literature',
        title: asString(packet.title),
        abstract: asString(packet.abstract),
        authors: asStringArray(packet.authors),
        journal: typeof packet.journal === 'string' ? packet.journal : undefined,
        year: typeof packet.year === 'string' ? packet.year : undefined,
        doi: typeof packet.doi === 'string' ? packet.doi : undefined,
        url: typeof packet.url === 'string' ? packet.url : undefined,
        source: typeof packet.source === 'string' ? packet.source : undefined,
        query: typeof packet.query === 'string' ? packet.query : undefined,
      };
    }).filter(Boolean) as WorkflowArtifact['evidencePackets'],
    atomicPathwayGraph,
    candidateRoutes: (Array.isArray(value.candidateRoutes) ? value.candidateRoutes : []).map((route) => {
      if (!isRecord(route) || typeof route.id !== 'string') return null;
      return {
        id: route.id,
        label: asString(route.label),
        nodeIds: asStringArray(route.nodeIds),
        edgeKeys: asStringArray(route.edgeKeys),
        rank: Math.max(1, asNumber(route.rank, 1)),
      };
    }).filter(Boolean) as WorkflowArtifact['candidateRoutes'],
    provenance: {
      compiledFrom:
        provenance.compiledFrom === 'literature-bundle'
        || provenance.compiledFrom === 'pdf'
        || provenance.compiledFrom === 'image'
        || provenance.compiledFrom === 'url'
          ? provenance.compiledFrom
          : 'manual-text',
      evidencePacketIds: asStringArray(provenance.evidencePacketIds),
      sourceProvider: typeof provenance.sourceProvider === 'string' ? provenance.sourceProvider : undefined,
    },
    workbench: {
      scientificStage:
        workbench.scientificStage === 'simulate-optimize'
        || workbench.scientificStage === 'engineer-host'
        || workbench.scientificStage === 'test-learn'
          ? workbench.scientificStage
          : 'design',
    },
    thermodynamics: isRecord(value.thermodynamics)
      ? {
          status: 'placeholder',
          concerns: asStringArray(value.thermodynamics.concerns),
        }
      : undefined,
    flux: isRecord(value.flux)
      ? {
          status: 'placeholder',
          notes: asStringArray(value.flux.notes),
        }
      : undefined,
    createdAt: asNumber(value.createdAt, Date.now()),
    updatedAt: asNumber(value.updatedAt, Date.now()),
  };
}

function sanitizeToolRun(value: unknown): WorkbenchToolRun | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.toolId !== 'string') return null;
  return {
    id: value.id,
    toolId: value.toolId,
    stageId: typeof value.stageId === 'string' ? value.stageId as WorkbenchToolRun['stageId'] : null,
    title: asString(value.title),
    summary: asString(value.summary),
    isSimulated: Boolean(value.isSimulated),
    createdAt: asNumber(value.createdAt, Date.now()),
  };
}

function sanitizeCheckpoint(value: unknown): StageCheckpoint | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const status = value.status === 'active' || value.status === 'complete' ? value.status : 'pending';
  return {
    id: value.id as StageCheckpoint['id'],
    status,
    summary: asString(value.summary),
    updatedAt: asNumber(value.updatedAt, Date.now()),
  };
}

function sanitizeRecommendation(value: unknown): NextStepRecommendation | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.toolId !== 'string') return null;
  return {
    id: value.id,
    toolId: value.toolId,
    source: value.source === 'analysis' || value.source === 'tool' ? value.source : 'flow',
    reason: asString(value.reason),
  };
}

const VALID_PAYLOAD_KEYS = new Set([
  'pathd',
  'fbasim',
  'cethx',
  'catdes',
  'dyncon',
  'cellfree',
  'dbtlflow',
  'proevol',
  'gecair',
  'genmim',
  'multio',
  'scspatial',
  'nexai',
]);

function sanitizeToolPayloads(value: unknown): WorkbenchToolPayloadMap {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).filter(([key, payload]) => {
    if (!VALID_PAYLOAD_KEYS.has(key) || !isRecord(payload)) return false;
    if (payload.validity !== 'real' && payload.validity !== 'partial' && payload.validity !== 'demo') return false;
    return typeof payload.toolId === 'string' && typeof payload.updatedAt === 'number';
  });
  return Object.fromEntries(entries) as WorkbenchToolPayloadMap;
}

function sanitizeRunArtifact(value: unknown): WorkbenchRunArtifact | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.toolId !== 'string' || !isRecord(value.payloadSnapshot)) return null;
  const execution = isRecord(value.execution)
    ? {
        projectRef: typeof value.execution.projectRef === 'string' ? value.execution.projectRef : null,
        analyzeRef: typeof value.execution.analyzeRef === 'string' ? value.execution.analyzeRef : null,
        upstreamToolIds: asStringArray(value.execution.upstreamToolIds),
        upstreamArtifactIds: asStringArray(value.execution.upstreamArtifactIds),
        dependencySignature: asString(value.execution.dependencySignature),
      }
    : {
        projectRef: null,
        analyzeRef: null,
        upstreamToolIds: [],
        upstreamArtifactIds: asStringArray(value.upstreamArtifactIds),
        dependencySignature: '',
      };
  return {
    id: value.id,
    toolId: value.toolId as WorkbenchRunArtifact['toolId'],
    stageId: typeof value.stageId === 'string' ? value.stageId as WorkbenchRunArtifact['stageId'] : null,
    targetProduct: asString(value.targetProduct, 'Target Product'),
    sourceArtifactId: typeof value.sourceArtifactId === 'string' ? value.sourceArtifactId : undefined,
    upstreamArtifactIds: asStringArray(value.upstreamArtifactIds),
    execution,
    summary: asString(value.summary),
    payloadSnapshot: value.payloadSnapshot as unknown as WorkbenchRunArtifact['payloadSnapshot'],
    createdAt: asNumber(value.createdAt, Date.now()),
    isSimulated: Boolean(value.isSimulated),
  };
}

export function sanitizeWorkbenchState(value: unknown): WorkbenchCanonicalState | null {
  if (!isRecord(value)) return null;
  return {
    schemaVersion: 1,
    revision: Math.max(0, asNumber(value.revision)),
    lastMutationAt: Math.max(0, asNumber(value.lastMutationAt)),
    activeArtifactId: typeof value.activeArtifactId === 'string' ? value.activeArtifactId : null,
    project: sanitizeProject(value.project),
    evidenceItems: (Array.isArray(value.evidenceItems) ? value.evidenceItems : []).map(sanitizeEvidenceItem).filter(Boolean) as WorkbenchEvidenceItem[],
    selectedEvidenceIds: asStringArray(value.selectedEvidenceIds),
    draftAnalyzeInput: asString(value.draftAnalyzeInput),
    workflowArtifact: sanitizeWorkflowArtifact(value.workflowArtifact),
    analyzeArtifact: sanitizeAnalyzeArtifact(value.analyzeArtifact),
    toolRuns: (Array.isArray(value.toolRuns) ? value.toolRuns : []).map(sanitizeToolRun).filter(Boolean) as WorkbenchToolRun[],
    toolPayloads: sanitizeToolPayloads(value.toolPayloads),
    runArtifacts: (Array.isArray(value.runArtifacts) ? value.runArtifacts : []).map(sanitizeRunArtifact).filter(Boolean) as WorkbenchRunArtifact[],
    checkpoints: (Array.isArray(value.checkpoints) ? value.checkpoints : []).map(sanitizeCheckpoint).filter(Boolean) as StageCheckpoint[],
    nextRecommendations: (Array.isArray(value.nextRecommendations) ? value.nextRecommendations : []).map(sanitizeRecommendation).filter(Boolean) as NextStepRecommendation[],
  };
}

export function sanitizeWorkbenchBackendMeta(value: unknown): WorkbenchBackendMeta | null {
  if (!isRecord(value)) return null;
  if (value.kind !== 'sqlite' || typeof value.path !== 'string') return null;
  return {
    kind: 'sqlite',
    driver: value.driver === 'better-sqlite3' ? value.driver : 'better-sqlite3',
    scope: value.scope === 'project' ? value.scope : 'project',
    path: value.path,
    projectId: asString(value.projectId, 'default-workbench'),
    actorId: asString(value.actorId, 'system'),
    revision: Math.max(0, asNumber(value.revision)),
    updatedAt: Math.max(0, asNumber(value.updatedAt)),
    runArtifactCount: Math.max(0, asNumber(value.runArtifactCount)),
    auditCount: Math.max(0, asNumber(value.auditCount)),
    historyCount: Math.max(0, asNumber(value.historyCount)),
    experimentCount: Math.max(0, asNumber(value.experimentCount)),
    memberCount: Math.max(0, asNumber(value.memberCount)),
    projectCount: Math.max(0, asNumber(value.projectCount)),
  };
}

function sanitizeSyncAuditEntry(value: unknown): WorkbenchSyncAuditEntry | null {
  if (!isRecord(value)) return null;
  return {
    id: Math.max(0, asNumber(value.id)),
    projectId: typeof value.projectId === 'string' ? value.projectId : null,
    actorId: typeof value.actorId === 'string' ? value.actorId : null,
    revision: Math.max(0, asNumber(value.revision)),
    action: asString(value.action),
    status: asString(value.status),
    detail: typeof value.detail === 'string' ? value.detail : null,
    createdAt: Math.max(0, asNumber(value.createdAt)),
  };
}

export function sanitizeWorkbenchAuditLog(value: unknown): WorkbenchSyncAuditEntry[] {
  return (Array.isArray(value) ? value : []).map(sanitizeSyncAuditEntry).filter(Boolean) as WorkbenchSyncAuditEntry[];
}

function sanitizeHistoryEntry(value: unknown): WorkbenchHistoryEntry | null {
  if (!isRecord(value)) return null;
  return {
    revision: Math.max(0, asNumber(value.revision)),
    projectId: typeof value.projectId === 'string' ? value.projectId : null,
    actorId: typeof value.actorId === 'string' ? value.actorId : null,
    projectTitle: asString(value.projectTitle, 'Synthetic Biology Program'),
    targetProduct: asString(value.targetProduct, 'Target Product'),
    analyzeTitle: typeof value.analyzeTitle === 'string' ? value.analyzeTitle : null,
    analyzeGeneratedAt: typeof value.analyzeGeneratedAt === 'number' ? Math.max(0, value.analyzeGeneratedAt) : null,
    runArtifactCount: Math.max(0, asNumber(value.runArtifactCount)),
    mutationAt: Math.max(0, asNumber(value.mutationAt)),
    updatedAt: Math.max(0, asNumber(value.updatedAt)),
  };
}

export function sanitizeWorkbenchHistory(value: unknown): WorkbenchHistoryEntry[] {
  return (Array.isArray(value) ? value : []).map(sanitizeHistoryEntry).filter(Boolean) as WorkbenchHistoryEntry[];
}

function sanitizeCollaborator(value: unknown): WorkbenchCollaborator | null {
  if (!isRecord(value)) return null;
  const actorId = asString(value.actorId);
  if (!actorId) return null;
  return {
    actorId,
    displayName: asString(value.displayName, actorId),
    role: asString(value.role, 'researcher'),
    lastSeenAt: Math.max(0, asNumber(value.lastSeenAt)),
  };
}

export function sanitizeWorkbenchCollaborators(value: unknown): WorkbenchCollaborator[] {
  return (Array.isArray(value) ? value : []).map(sanitizeCollaborator).filter(Boolean) as WorkbenchCollaborator[];
}

function sanitizeExperimentRecord(value: unknown): WorkbenchExperimentRecord | null {
  if (!isRecord(value)) return null;
  const recordId = asString(value.recordId);
  const projectId = asString(value.projectId);
  const actorId = asString(value.actorId);
  if (!recordId || !projectId || !actorId) return null;
  return {
    recordId,
    projectId,
    actorId,
    revision: Math.max(0, asNumber(value.revision)),
    toolId: asString(value.toolId),
    stageId: typeof value.stageId === 'string' ? value.stageId as WorkbenchExperimentRecord['stageId'] : null,
    category: value.category === 'experiment' ? 'experiment' : 'analysis',
    title: asString(value.title),
    summary: asString(value.summary),
    status: asString(value.status),
    authorityTier:
      value.authorityTier === 'experiment-backed'
      || value.authorityTier === 'evidence-linked'
      || value.authorityTier === 'contextual'
        ? value.authorityTier
        : 'simulated',
    metrics: asStringArray(value.metrics),
    createdAt: Math.max(0, asNumber(value.createdAt)),
    updatedAt: Math.max(0, asNumber(value.updatedAt)),
  };
}

export function sanitizeWorkbenchExperimentRecords(value: unknown): WorkbenchExperimentRecord[] {
  return (Array.isArray(value) ? value : []).map(sanitizeExperimentRecord).filter(Boolean) as WorkbenchExperimentRecord[];
}
