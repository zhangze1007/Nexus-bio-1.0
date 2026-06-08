/**
 * Project slice — project lifecycle management.
 *
 * State: project
 * Actions: ensureProject, seedDemoProject, resetWorkbench
 */
import type { StateCreator } from 'zustand';
import type { WorkbenchState } from './types';
import type { WorkbenchProjectBrief } from '../workbenchTypes';
import {
  createId,
  buildCheckpoints,
  createEmptyCheckpoints,
  shouldAutoSeedDemo,
} from '../workbenchStoreHelpers';
import {
  touchState,
  buildWorkflowControlSnapshot,
  getAnalyzeArtifactForState,
} from './sharedHelpers';
import { getStageForTool } from '../../components/tools/shared/workbenchConfig';

// Initial state values that are canonical-state fields owned by project
export const projectInitialState = {
  project: null as WorkbenchProjectBrief | null,
};

export const createProjectSlice: StateCreator<WorkbenchState, [], [], {
  project: WorkbenchProjectBrief | null;
  ensureProject: (seed?: Partial<WorkbenchProjectBrief>) => void;
  seedDemoProject: (toolId?: string | null) => void;
  resetWorkbench: () => void;
}> = (set, get) => ({
  ...projectInitialState,

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

  resetWorkbench: () => {
    // Import initialState from the main store composition
    // We need to reset to the combined initial state
    set((state) => ({
      ...state,
      schemaVersion: 1,
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
      workflowControl: createInitialWorkflowControlDefault(),
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
      artifactLoadState: 'idle',
      artifactLoadError: null,
      artifactRequestedId: null,
      // Axon state preserved
      axonRuns: state.axonRuns,
      axonLogs: state.axonLogs,
      axonPlan: state.axonPlan,
    }));
  },
});

// Inline the initial workflow control to avoid circular dependency
function createInitialWorkflowControlDefault() {
  return {
    machineState: 'idle' as const,
    status: 'idle' as const,
    currentToolId: null,
    nextRecommendedNode: 'pathd' as const,
    missingEvidence: { minRequired: 0, have: 0, kinds: [] as string[] },
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
    updatedAt: Date.now(),
  };
}
