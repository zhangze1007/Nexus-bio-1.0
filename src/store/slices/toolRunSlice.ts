/**
 * Tool run slice — tool visit tracking, payload management, run artifacts.
 *
 * State: currentToolId, currentStageId, toolRuns, toolPayloads, runArtifacts,
 *        payloadAdmissionDecisionsByToolId, checkpoints, nextRecommendations
 * Actions: visitTool, addToolRun, setToolPayload
 */
import type { StateCreator } from 'zustand';
import type { WorkbenchState } from './types';
import type {
  WorkbenchToolRun,
  WorkbenchRunArtifact,
  StageCheckpoint,
  NextStepRecommendation,
} from '../workbenchTypes';
import type { WorkbenchToolPayloadMap } from '../workbenchPayloads';
import type { WorkbenchStageId } from '../../components/tools/shared/workbenchConfig';
import {
  createId,
  buildCheckpoints,
  buildRecommendationsFromToolIds,
  stableSerialize,
  shouldAutoSeedDemo,
  RUN_ARTIFACT_LIMIT,
  TOOL_RUN_LIMIT,
} from '../workbenchStoreHelpers';
import { getStageForTool, getNextToolIds } from '../../components/tools/shared/workbenchConfig';
import { canPassToDownstream } from '../../utils/runtimeGating';
import { tryGetToolContract } from '../../services/workflowRegistry';
import { buildExecutionSnapshot } from '../../config/workbenchExecution';
import { getToolValidity } from '../../config/toolValidity';
import {
  evaluateWorkbenchPayloadAdmission,
  inferAdmissionInputFromPayload,
} from '../../services/workbenchPayloadAdmission';
import {
  touchState,
  createRunArtifact,
  maybeAttachPayloadProvenance,
  getAnalyzeArtifactForState,
  buildWorkflowControlSnapshot,
} from './sharedHelpers';

export interface ToolRunSlice {
  currentToolId: string | null;
  currentStageId: WorkbenchStageId | null;
  toolRuns: WorkbenchToolRun[];
  toolPayloads: WorkbenchToolPayloadMap;
  runArtifacts: WorkbenchRunArtifact[];
  payloadAdmissionDecisionsByToolId: Record<string, import('../../protocol/nexusTrustRuntime').GateDecision>;
  checkpoints: StageCheckpoint[];
  nextRecommendations: NextStepRecommendation[];
  visitTool: (toolId: string | null) => void;
  addToolRun: (run: Omit<WorkbenchToolRun, 'id' | 'createdAt' | 'stageId'> & { stageId?: WorkbenchStageId | null }) => void;
  setToolPayload: <K extends keyof WorkbenchToolPayloadMap>(toolId: K, payload: WorkbenchToolPayloadMap[K]) => void;
}

export const toolRunInitialState = {
  currentToolId: null as string | null,
  currentStageId: null as WorkbenchStageId | null,
  toolRuns: [] as WorkbenchToolRun[],
  toolPayloads: {} as WorkbenchToolPayloadMap,
  runArtifacts: [] as WorkbenchRunArtifact[],
  payloadAdmissionDecisionsByToolId: {} as Record<string, import('../../protocol/nexusTrustRuntime').GateDecision>,
  checkpoints: [] as StageCheckpoint[],
  nextRecommendations: [] as NextStepRecommendation[],
};

export const createToolRunSlice: StateCreator<WorkbenchState, [], [], ToolRunSlice> = (set, get) => ({
  ...toolRunInitialState,

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
});
