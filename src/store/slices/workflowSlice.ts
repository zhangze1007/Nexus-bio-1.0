/**
 * Workflow slice — workflow control plane and loop-back.
 *
 * State: workflowControl, workflowArtifact, analyzeArtifact
 * Actions: loopBackWorkflow
 */
import type { StateCreator } from 'zustand';
import type { WorkbenchState } from './types';
import type { WorkbenchWorkflowControlSnapshot } from '../workbenchTypes';
import type { WorkflowArtifact } from '../../domain/workflowArtifact';
import { GOLDEN_PATH_TOOL_IDS } from '../../domain/workflowContract';
import type { WorkbenchToolPayloadMap } from '../workbenchPayloads';
import {
  touchState,
  buildWorkflowControlSnapshot,
  getWorkflowActor,
  dispatchLoopBack,
  createInitialWorkflowControl,
} from './sharedHelpers';

export interface WorkflowSlice {
  workflowControl: WorkbenchWorkflowControlSnapshot;
  workflowArtifact: WorkflowArtifact | null;
  analyzeArtifact: import('../workbenchTypes').WorkbenchAnalyzeArtifact | null;
  loopBackWorkflow: () => void;
}

export const workflowInitialState = {
  workflowControl: createInitialWorkflowControl(),
  workflowArtifact: null as WorkflowArtifact | null,
  analyzeArtifact: null as import('../workbenchTypes').WorkbenchAnalyzeArtifact | null,
};

export const createWorkflowSlice: StateCreator<WorkbenchState, [], [], WorkflowSlice> = (set, get) => ({
  ...workflowInitialState,

  loopBackWorkflow: () => {
    set((state) => {
      const beforeIteration = getWorkflowActor().getSnapshot().context.iteration;
      dispatchLoopBack();
      const afterIteration = getWorkflowActor().getSnapshot().context.iteration;
      if (afterIteration === beforeIteration) {
        return state;
      }
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
});
