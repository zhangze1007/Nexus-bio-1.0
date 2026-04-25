/** @jest-environment jsdom */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import WorkbenchDecisionTracePanel from '../../src/components/workbench/WorkbenchDecisionTracePanel';
import {
  __resetWorkflowActorForTests,
  useWorkbenchStore,
} from '../../src/store/workbenchStore';
import type {
  WorkbenchRunArtifact,
  WorkbenchWorkflowControlSnapshot,
} from '../../src/store/workbenchTypes';

const WORKFLOW_CONTROL: WorkbenchWorkflowControlSnapshot = {
  machineState: 'pathdReady',
  status: 'ready',
  currentToolId: 'fbasim',
  nextRecommendedNode: 'fbasim',
  missingEvidence: { minRequired: 10, have: 99, kinds: ['literature'] },
  confidence: null,
  uncertainty: null,
  validity: null,
  humanGateRequired: false,
  nextNodeIsContractOnly: false,
  isDemoOnly: false,
  latestRunStatus: null,
  latestRunToolId: null,
  reasonCodes: [],
  explanation: 'Current workflow snapshot should not overwrite historical run evidence.',
  iteration: 7,
  updatedAt: 1,
};

const RUN: WorkbenchRunArtifact = {
  id: 'run-fbasim-1',
  toolId: 'fbasim',
  stageId: 'stage-2',
  targetProduct: 'limonene',
  upstreamArtifactIds: [],
  execution: {
    projectRef: 'project-1',
    analyzeRef: null,
    upstreamToolIds: [],
    upstreamArtifactIds: [],
    dependencySignature: 'sig',
  },
  summary: 'FBASIM historical run',
  payloadSnapshot: {
    toolId: 'fbasim',
    validity: 'partial',
    updatedAt: 1,
  } as WorkbenchRunArtifact['payloadSnapshot'],
  createdAt: 1,
  isSimulated: false,
  status: 'ok',
  confidence: 0.82,
  uncertainty: 0.14,
  validity: 'partial',
  humanGateRequired: false,
  iteration: 3,
  evidenceSnapshot: {
    count: 2,
    selectedCount: 1,
    evidenceItemIds: ['ev-1', 'ev-2'],
    selectedEvidenceIds: ['ev-1'],
    status: 'missing',
    missingEvidence: {
      minRequired: 4,
      have: 2,
      kinds: ['literature', 'analysis'],
      missingKinds: ['analysis'],
    },
  },
};

describe('WorkbenchDecisionTracePanel — historical ledger evidence', () => {
  beforeEach(() => {
    act(() => {
      __resetWorkflowActorForTests();
      useWorkbenchStore.getState().resetWorkbench();
      useWorkbenchStore.setState({
        runArtifacts: [RUN],
        workflowControl: WORKFLOW_CONTROL,
        nextRecommendations: [],
      });
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      useWorkbenchStore.getState().resetWorkbench();
      __resetWorkflowActorForTests();
    });
  });

  it('renders per-run evidence snapshot instead of the current workflow evidence count', () => {
    render(<WorkbenchDecisionTracePanel limit={1} />);

    const runCard = screen.getByText(/FBASIM artifact generated/i).parentElement?.parentElement;
    expect(runCard).toBeTruthy();
    const runScope = within(runCard as HTMLElement);

    expect(runScope.getByText(/evidence · 2\/4 · missing/i)).toBeTruthy();
    expect(runScope.queryByText(/evidence · 99/i)).toBeNull();
    expect(runScope.getByText(/confidence · 0\.82/i)).toBeTruthy();
    expect(runScope.getByText(/uncertainty · 0\.14/i)).toBeTruthy();
    expect(runScope.getByText(/validity · partial/i)).toBeTruthy();
    expect(runScope.getByText(/iteration · 3/i)).toBeTruthy();
  });
});
