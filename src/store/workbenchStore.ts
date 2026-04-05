'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BottleneckEnzyme, DeNovoDesignStrategy, PathwayEdge, PathwayNode } from '../types';
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
import { buildExecutionSnapshot } from '../components/workbench/workbenchExecution';
import type {
  NextStepRecommendation,
  StageCheckpoint,
  StructuredAnalysisPayload,
  WorkbenchAnalyzeArtifact,
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
} from './workbenchTypes';

export type {
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
  WorkbenchRunArtifact,
  WorkbenchToolRun,
} from './workbenchTypes';

interface WorkbenchState extends WorkbenchCanonicalState {
  currentToolId: string | null;
  currentStageId: WorkbenchStageId | null;
  backendMeta: WorkbenchBackendMeta | null;
  collaborators: WorkbenchCollaborator[];
  experimentRecords: WorkbenchExperimentRecord[];
  syncAuditLog: WorkbenchSyncAuditEntry[];
  historyLog: WorkbenchHistoryEntry[];
  syncStatus: 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'conflict';
  syncError: string | null;
  hydratedFromServer: boolean;
  lastServerSyncAt: number | null;
  lastServerSyncedRevision: number;
  ensureProject: (seed?: Partial<WorkbenchProjectBrief>) => void;
  upsertEvidence: (item: Omit<WorkbenchEvidenceItem, 'id' | 'savedAt'>, options?: { select?: boolean }) => string;
  toggleEvidenceSelection: (id: string) => void;
  prepareAnalyzeFromEvidence: (ids?: string[]) => string;
  setDraftAnalyzeInput: (text: string) => void;
  setAnalyzeArtifact: (artifact: WorkbenchAnalyzeArtifact) => void;
  visitTool: (toolId: string | null) => void;
  addToolRun: (run: Omit<WorkbenchToolRun, 'id' | 'createdAt' | 'stageId'> & { stageId?: WorkbenchStageId | null }) => void;
  setToolPayload: <K extends keyof WorkbenchToolPayloadMap>(toolId: K, payload: WorkbenchToolPayloadMap[K]) => void;
  seedDemoProject: (toolId?: string | null) => void;
  applyCanonicalState: (state: WorkbenchCanonicalState, options?: { markHydrated?: boolean; synced?: boolean; conflict?: boolean }) => void;
  loadFromServer: () => Promise<void>;
  syncToServer: () => Promise<void>;
  resetWorkbench: () => void;
}

const STAGE_IDS: WorkbenchStageId[] = ['stage-1', 'stage-2', 'stage-3', 'stage-4'];
const WORKBENCH_SCHEMA_VERSION = 1;
const RUN_ARTIFACT_LIMIT = 160;
const TOOL_RUN_LIMIT = 120;
const WORKBENCH_ACTOR_KEY = 'nexus-bio:workbench-actor-id';
const DEFAULT_PROJECT_SYNC_SCOPE = 'default-workbench';

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
      return `DBTL ${data.proposedPhase} · pass ${data.passed ? 'yes' : 'no'} · ${data.result.learnedParameters.length} learned`;
    }
    case 'proevol': {
      const data = payload as WorkbenchToolPayloadMap['proevol'];
      return `Protein evolution · ${data.rounds} rounds · fitness ${data.result.bestFitness.toFixed(2)}`;
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

function inferToolSimulation(payload: WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap]) {
  if (!payload) return true;
  if ('result' in payload && payload.result && typeof payload.result === 'object') {
    if ('mode' in payload.result) {
      return payload.result.mode === 'mock' || payload.result.mode === 'idle';
    }
  }
  return false;
}

function createRunArtifact<K extends keyof WorkbenchToolPayloadMap>(
  state: WorkbenchState,
  toolId: K,
  payload: WorkbenchToolPayloadMap[K],
  options?: { revalidated?: boolean },
): WorkbenchRunArtifact {
  const stageId = getStageForTool(toolId)?.id ?? null;
  const execution = buildExecutionSnapshot({
    toolId,
    project: state.project,
    analyzeArtifact: state.analyzeArtifact,
    runArtifacts: state.runArtifacts,
  });
  const summary = summarizePayload(toolId, payload);

  return {
    id: createId('run'),
    toolId,
    stageId,
    targetProduct: payload?.targetProduct ?? state.analyzeArtifact?.targetProduct ?? state.project?.targetProduct ?? 'Target Product',
    sourceArtifactId: payload?.sourceArtifactId ?? state.analyzeArtifact?.id,
    upstreamArtifactIds: execution.upstreamArtifactIds,
    execution,
    summary: options?.revalidated ? `${summary} · context refreshed` : summary,
    payloadSnapshot: payload,
    createdAt: payload?.updatedAt ?? Date.now(),
    isSimulated: inferToolSimulation(payload) || Boolean(state.project?.isDemo),
  };
}

function buildCanonicalSlice(state: Pick<
  WorkbenchState,
  | 'schemaVersion'
  | 'revision'
  | 'lastMutationAt'
  | 'project'
  | 'evidenceItems'
  | 'selectedEvidenceIds'
  | 'draftAnalyzeInput'
  | 'analyzeArtifact'
  | 'toolRuns'
  | 'toolPayloads'
  | 'runArtifacts'
  | 'checkpoints'
  | 'nextRecommendations'
>): WorkbenchCanonicalState {
  return {
    schemaVersion: state.schemaVersion,
    revision: state.revision,
    lastMutationAt: state.lastMutationAt,
    project: state.project,
    evidenceItems: state.evidenceItems,
    selectedEvidenceIds: state.selectedEvidenceIds,
    draftAnalyzeInput: state.draftAnalyzeInput,
    analyzeArtifact: state.analyzeArtifact,
    toolRuns: state.toolRuns,
    toolPayloads: state.toolPayloads,
    runArtifacts: state.runArtifacts,
    checkpoints: state.checkpoints,
    nextRecommendations: state.nextRecommendations,
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

async function requestCanonicalState(
  method: 'GET' | 'PUT',
  state?: WorkbenchCanonicalState,
  options?: { projectId?: string | null },
) {
  const actorId = getWorkbenchActorId();
  const projectId = state?.project?.id ?? options?.projectId ?? DEFAULT_PROJECT_SYNC_SCOPE;
  const response = await fetch('/api/workbench', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-workbench-actor-id': actorId,
      'x-workbench-project-id': projectId,
    },
    cache: 'no-store',
    body: method === 'PUT' ? JSON.stringify({ state }) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
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
  | 'project'
  | 'evidenceItems'
  | 'selectedEvidenceIds'
  | 'draftAnalyzeInput'
  | 'analyzeArtifact'
  | 'toolRuns'
  | 'toolPayloads'
  | 'runArtifacts'
  | 'checkpoints'
  | 'nextRecommendations'
  | 'currentToolId'
  | 'currentStageId'
  | 'backendMeta'
  | 'collaborators'
  | 'experimentRecords'
  | 'syncAuditLog'
  | 'historyLog'
  | 'syncStatus'
  | 'syncError'
  | 'hydratedFromServer'
  | 'lastServerSyncAt'
  | 'lastServerSyncedRevision'
> = {
  schemaVersion: WORKBENCH_SCHEMA_VERSION,
  revision: 0,
  lastMutationAt: 0,
  project: null,
  evidenceItems: [],
  selectedEvidenceIds: [],
  draftAnalyzeInput: '',
  analyzeArtifact: null,
  toolRuns: [],
  toolPayloads: {},
  runArtifacts: [],
  checkpoints: createEmptyCheckpoints(),
  nextRecommendations: [],
  currentToolId: null,
  currentStageId: null,
  backendMeta: null,
  collaborators: [],
  experimentRecords: [],
  syncAuditLog: [],
  historyLog: [],
  syncStatus: 'idle',
  syncError: null,
  hydratedFromServer: false,
  lastServerSyncAt: null,
  lastServerSyncedRevision: 0,
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
          return touchState(state, { project });
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

          return touchState(state, {
            project: { ...project, updatedAt: now, sourceQuery: item.query ?? project.sourceQuery, isDemo: false },
            evidenceItems,
            selectedEvidenceIds,
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
          checkpoints: buildCheckpoints('stage-1', currentState.analyzeArtifact, currentState.toolRuns),
        }));

        set({ currentStageId: 'stage-1' });
        return composed;
      },

      setDraftAnalyzeInput: (text) => {
        set((state) => touchState(state, { draftAnalyzeInput: text }));
      },

      setAnalyzeArtifact: (artifact) => {
        const nextRecommendations = buildRecommendationsFromToolIds(
          artifact.recommendedNextTools,
          'analysis',
          'Recommended from Analyze output',
        );
        set((state) => {
          const project = state.project ?? {
            id: createId('project'),
            title: artifact.title,
            summary: artifact.summary,
            targetProduct: artifact.targetProduct,
            status: 'active' as const,
            isDemo: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          const updatedProject: WorkbenchProjectBrief = {
            ...project,
            title: project.isDemo ? artifact.title : project.title || artifact.title,
            summary: artifact.summary,
            targetProduct: artifact.targetProduct,
            status: 'active',
            isDemo: false,
            updatedAt: Date.now(),
          };

          return {
            ...touchState(state, {
              project: updatedProject,
              analyzeArtifact: artifact,
              checkpoints: buildCheckpoints('stage-1', artifact, state.toolRuns),
              nextRecommendations,
            }),
            currentStageId: 'stage-1',
          };
        });
      },

      visitTool: (toolId) => {
        if (!toolId) {
          set((state) => ({
            currentToolId: null,
            currentStageId: null,
            checkpoints: buildCheckpoints(null, state.analyzeArtifact, state.toolRuns),
          }));
          return;
        }

        const stage = getStageForTool(toolId);
        if (!get().project) {
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
              checkpoints: buildCheckpoints(stage?.id ?? null, state.analyzeArtifact, toolRuns),
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
            checkpoints: buildCheckpoints(state.currentStageId, state.analyzeArtifact, toolRuns),
          });
        });
      },

      setToolPayload: (toolId, payload) => {
        set((state) => {
          const previousPayload = state.toolPayloads[toolId];
          const latestArtifactForTool = state.runArtifacts.find((artifact) => artifact.toolId === toolId);
          const nextExecution = buildExecutionSnapshot({
            toolId,
            project: state.project,
            analyzeArtifact: state.analyzeArtifact,
            runArtifacts: state.runArtifacts,
          });
          const payloadStable = stableSerialize(previousPayload) === stableSerialize(payload);
          const executionStable = latestArtifactForTool?.execution.dependencySignature === nextExecution.dependencySignature;

          if (payloadStable && executionStable) {
            return state;
          }

          const runArtifact = createRunArtifact(state, toolId, payload, {
            revalidated: payloadStable && !executionStable,
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

          return touchState(state, {
            toolPayloads: {
              ...state.toolPayloads,
              [toolId]: payload,
            },
            runArtifacts: [runArtifact, ...state.runArtifacts].slice(0, RUN_ARTIFACT_LIMIT),
            toolRuns,
            checkpoints: buildCheckpoints(state.currentStageId, state.analyzeArtifact, toolRuns),
            nextRecommendations: buildRecommendationsFromToolIds(
              getNextToolIds(toolId),
              'tool',
              `Live ${String(toolId).toUpperCase()} computation updated downstream recommendations`,
            ),
          });
        });
      },

      seedDemoProject: (toolId) => {
        const stage = getStageForTool(toolId ?? null);
        const now = Date.now();
        set((state) => ({
          ...touchState(state, {
            project: state.project ?? {
              id: createId('project'),
              title: 'Artemisinin Demonstration Program',
              summary: 'Default fallback context used when no research project has been injected yet.',
              targetProduct: 'Artemisinin',
              status: 'draft',
              isDemo: true,
              createdAt: now,
              updatedAt: now,
            },
            checkpoints: buildCheckpoints(stage?.id ?? null, state.analyzeArtifact, state.toolRuns),
          }),
          currentStageId: state.currentStageId ?? stage?.id ?? null,
        }));
      },

      applyCanonicalState: (incomingState, options) => {
        const sanitized = sanitizeWorkbenchState(incomingState);
        if (!sanitized) return;
        set((state) => ({
          ...state,
          ...sanitized,
          syncStatus: options?.conflict ? 'conflict' : options?.synced ? 'synced' : state.syncStatus,
          syncError: null,
          hydratedFromServer: options?.markHydrated ? true : state.hydratedFromServer,
          lastServerSyncAt: options?.synced || options?.markHydrated ? Date.now() : state.lastServerSyncAt,
          lastServerSyncedRevision: options?.synced || options?.markHydrated ? sanitized.revision : state.lastServerSyncedRevision,
        }));
      },

      loadFromServer: async () => {
        set({ syncStatus: 'loading', syncError: null });
        try {
          const { canonicalState, backendMeta, collaborators, experimentRecords, auditLog, historyLog } = await requestCanonicalState('GET', undefined, {
            projectId: get().project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE,
          });
          set((state) => {
            if (canonicalState.revision < state.revision) {
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
              };
            }
            return {
              ...state,
              ...canonicalState,
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
            };
          });
        } catch (error) {
          set({
            syncStatus: 'error',
            syncError: error instanceof Error ? error.message : 'Failed to load canonical workbench state',
            hydratedFromServer: true,
          });
        }
      },

      syncToServer: async () => {
        const state = get();
        if (!state.hydratedFromServer) return;
        const canonicalState = buildCanonicalSlice(state);
        set({ syncStatus: 'saving', syncError: null });
        try {
          const { canonicalState: savedState, backendMeta, collaborators, experimentRecords, auditLog, historyLog } = await requestCanonicalState('PUT', canonicalState, {
            projectId: canonicalState.project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE,
          });
          set((currentState) => ({
            ...currentState,
            ...savedState,
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
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => buildCanonicalSlice(state),
      merge: (persistedState, currentState) => {
        const sanitized = sanitizeWorkbenchState(persistedState);
        return sanitized
          ? { ...currentState, ...sanitized }
          : currentState;
      },
    },
  ),
);
