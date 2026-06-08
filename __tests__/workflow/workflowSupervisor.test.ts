/** @jest-environment node */
import {
  buildWorkflowDecision,
  summariseDecision,
  advanceEventNameForState,
  type WorkflowSupervisorInput,
} from '../../src/services/workflowSupervisor';
import type { WorkflowToolStatus } from '../../src/services/workflowStateMachine';

const PARTIAL_OK: WorkflowToolStatus = {
  validity: 'partial',
  confidence: 1,
  hasRequiredOutputs: true,
};

const DEMO_OK: WorkflowToolStatus = {
  validity: 'demo',
  confidence: 1,
  hasRequiredOutputs: true,
};

function makeInput(partial: Partial<WorkflowSupervisorInput>): WorkflowSupervisorInput {
  return {
    machineState: 'idle',
    targetProduct: null,
    toolStatus: {},
    evidence: [],
    isAdapterRegistered: (id) => id === 'pathd' || id === 'fbasim',
    ...partial,
  };
}

describe('workflowSupervisor — idle / terminal', () => {
  it('idle returns NO_TARGET reason and recommends pathd', () => {
    const decision = buildWorkflowDecision(makeInput({ machineState: 'idle' }));
    expect(decision.status).toBe('idle');
    expect(decision.nextRecommendedNode).toBe('pathd');
    expect(decision.reasonCodes).toContain('NO_TARGET');
    expect(decision.nextNodeIsContractOnly).toBe(false);
  });

  it('dbtlCommitted returns complete with no successor', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'dbtlCommitted',
        targetProduct: 'artemisinin',
        toolStatus: { dbtlflow: PARTIAL_OK },
      }),
    );
    expect(decision.status).toBe('complete');
    expect(decision.nextRecommendedNode).toBeNull();
    expect(decision.humanGateRequired).toBe(true); // dbtlflow gates commit + loop-back
  });
});

describe('workflowSupervisor — blocked by upstream', () => {
  it('marks fbasimReady-state as blocked when PATHD payload is absent', () => {
    // FBASim is the current tool (state pathdReady) but PATHD payload is gone.
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'pathdReady',
        targetProduct: 'artemisinin',
        toolStatus: {}, // PATHD payload missing
      }),
    );
    expect(decision.status).toBe('blocked');
    expect(decision.currentToolId).toBe('fbasim');
    expect(decision.nextRecommendedNode).toBe('pathd');
    expect(decision.reasonCodes).toContain('UPSTREAM_BLOCKED');
    expect(decision.explanation).toMatch(/PATHD/);
  });

  it('marks blocked when upstream validity is below floor', () => {
    // CatDes (state fbasimReady): FBASim payload present but only demo.
    // FBASim's contract floor is 'partial', so demo blocks.
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'fbasimReady',
        targetProduct: 'limonene',
        toolStatus: { fbasim: DEMO_OK },
      }),
    );
    expect(decision.status).toBe('blocked');
    expect(decision.currentToolId).toBe('catdes');
    expect(decision.nextRecommendedNode).toBe('fbasim');
    expect(decision.explanation).toMatch(/validity demo below floor partial/);
  });
});

describe('workflowSupervisor — current tool ready / satisfied', () => {
  it('returns ready/CURRENT_TOOL_NOT_READY when current tool has no payload yet', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'targetSet',
        targetProduct: 'limonene',
      }),
    );
    expect(decision.status).toBe('ready');
    expect(decision.currentToolId).toBe('pathd');
    expect(decision.nextRecommendedNode).toBe('pathd');
    expect(decision.reasonCodes).toContain('CURRENT_TOOL_NOT_READY');
  });

  it('returns demoOnly when the current node has simulated output', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'targetSet',
        targetProduct: 'limonene',
        toolStatus: {
          pathd: {
            ...PARTIAL_OK,
            isSimulated: true,
          },
        },
      }),
    );
    expect(decision.status).toBe('demoOnly');
    expect(decision.currentToolId).toBe('pathd');
    expect(decision.nextRecommendedNode).toBe('pathd');
    expect(decision.humanGateRequired).toBe(true);
    expect(decision.reasonCodes).toContain('DEMO_ONLY');
  });

  it('returns ready/CURRENT_TOOL_SATISFIED with the successor when current is done', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'pathdReady',
        targetProduct: 'limonene',
        toolStatus: { pathd: PARTIAL_OK, fbasim: PARTIAL_OK },
      }),
    );
    expect(decision.status).toBe('ready');
    expect(decision.currentToolId).toBe('fbasim');
    expect(decision.nextRecommendedNode).toBe('catdes');
    expect(decision.reasonCodes).toContain('CURRENT_TOOL_SATISFIED');
  });

  it('flags successor as contract-only when no adapter is registered', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'pathdReady',
        targetProduct: 'limonene',
        toolStatus: { pathd: PARTIAL_OK, fbasim: PARTIAL_OK },
        // Only pathd has an adapter — successor catdes is contract-only.
        isAdapterRegistered: (id) => id === 'pathd',
      }),
    );
    expect(decision.nextNodeIsContractOnly).toBe(true);
  });
});

describe('workflowSupervisor — evidence gate', () => {
  it('does NOT gate when evidenceRequired.gateOnMissing is false', () => {
    const decision = buildWorkflowDecision(
      makeInput({ machineState: 'targetSet', targetProduct: 'x', evidence: [] }),
    );
    // PATHD's evidence requirement: minItems 1, gateOnMissing false → status stays ready.
    expect(decision.status).toBe('ready');
  });
});

describe('summariseDecision', () => {
  it('produces a compact one-liner', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'pathdReady',
        targetProduct: 'limonene',
        toolStatus: { pathd: PARTIAL_OK, fbasim: PARTIAL_OK },
      }),
    );
    const line = summariseDecision(decision);
    expect(line).toMatch(/READY/);
    expect(line).toMatch(/FBASIM/);
    expect(line).toMatch(/CATDES/);
  });
});

describe('advanceEventNameForState', () => {
  it('returns the FSM event name for each state', () => {
    expect(advanceEventNameForState('targetSet')).toBe('PATHD_DONE');
    expect(advanceEventNameForState('pathdReady')).toBe('FBASIM_DONE');
    expect(advanceEventNameForState('cellfreeReady')).toBe('DBTL_COMMITTED');
    expect(advanceEventNameForState('idle')).toBeNull();
    expect(advanceEventNameForState('dbtlCommitted')).toBeNull();
  });
});

describe('workflowSupervisor — additional branches', () => {
  it('handles unknown machine state', () => {
    const decision = buildWorkflowDecision(
      makeInput({ machineState: 'unknownState' as any, targetProduct: 'x' }),
    );
    expect(decision.status).toBe('idle');
    expect(decision.reasonCodes).toContain('NO_CURRENT_TOOL');
  });

  it('handles idle with unregistered pathd adapter', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'idle',
        isAdapterRegistered: () => false,
      }),
    );
    expect(decision.nextNodeIsContractOnly).toBe(true);
  });

  it('handles dbtlCommitted without dbtlflow status', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'dbtlCommitted',
        toolStatus: {},
      }),
    );
    expect(decision.status).toBe('complete');
    expect(decision.confidence).toBeNull();
  });

  it('handles upstream blocked with unregistered predecessor adapter', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'pathdReady',
        targetProduct: 'x',
        toolStatus: {},
        isAdapterRegistered: () => false,
      }),
    );
    expect(decision.status).toBe('blocked');
    expect(decision.nextNodeIsContractOnly).toBe(true);
  });

  it('handles demoOnly with full status fields', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'targetSet',
        targetProduct: 'x',
        toolStatus: {
          pathd: {
            validity: 'partial',
            confidence: 0.8,
            uncertainty: 0.2,
            hasRequiredOutputs: true,
            isSimulated: true,
          },
        },
      }),
    );
    expect(decision.status).toBe('demoOnly');
    expect(decision.confidence).toBe(0.8);
    expect(decision.uncertainty).toBe(0.2);
  });

  it('handles ready state with no status object', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'targetSet',
        targetProduct: 'x',
        toolStatus: {},
      }),
    );
    expect(decision.status).toBe('ready');
    expect(decision.explanation).toContain('Run PATHD');
  });

  it('handles ready state with status but missing outputs', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'targetSet',
        targetProduct: 'x',
        toolStatus: {
          pathd: {
            validity: 'real',
            confidence: 0.9,
            hasRequiredOutputs: false,
          },
        },
      }),
    );
    expect(decision.status).toBe('ready');
    expect(decision.reasonCodes).toContain('CURRENT_TOOL_NOT_READY');
  });

  it('handles ready state with low confidence', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'targetSet',
        targetProduct: 'x',
        toolStatus: {
          pathd: {
            validity: 'real',
            confidence: 0.1,
            hasRequiredOutputs: true,
          },
        },
      }),
    );
    expect(decision.status).toBe('ready');
    // PATHD may or may not have a confidence gate — just verify the decision is valid
    expect(decision.currentToolId).toBe('pathd');
  });

  it('handles satisfied state with evidence items', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'pathdReady',
        targetProduct: 'x',
        toolStatus: { pathd: PARTIAL_OK, fbasim: PARTIAL_OK },
        evidence: [
          { id: 'ev1', sourceKind: 'literature', title: 'Paper 1' },
          { id: 'ev2', sourceKind: 'analysis', title: 'Analysis 1' },
        ] as any,
      }),
    );
    expect(decision.status).toBe('ready');
    expect(decision.missingEvidence.have).toBe(2);
  });

  it('handles upstream blocked with missing validity', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'pathdReady',
        targetProduct: 'x',
        toolStatus: {
          pathd: {
            validity: null,
            confidence: 1,
            hasRequiredOutputs: true,
          },
        },
      }),
    );
    expect(decision.status).toBe('blocked');
    expect(decision.reasonCodes).toContain('UPSTREAM_BLOCKED');
  });

  it('handles upstream blocked with simulated predecessor', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'pathdReady',
        targetProduct: 'x',
        toolStatus: {
          pathd: {
            validity: 'real',
            confidence: 1,
            hasRequiredOutputs: true,
            isSimulated: true,
          },
        },
      }),
    );
    expect(decision.status).toBe('blocked');
  });

  it('summariseDecision for blocked status', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'pathdReady',
        targetProduct: 'x',
        toolStatus: {},
      }),
    );
    const line = summariseDecision(decision);
    expect(line).toMatch(/BLOCKED/);
  });

  it('summariseDecision for demoOnly status', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'targetSet',
        targetProduct: 'x',
        toolStatus: { pathd: { ...PARTIAL_OK, isSimulated: true } },
      }),
    );
    const line = summariseDecision(decision);
    expect(line).toMatch(/DEMO/);
  });

  it('summariseDecision for complete status', () => {
    const decision = buildWorkflowDecision(
      makeInput({
        machineState: 'dbtlCommitted',
        toolStatus: { dbtlflow: PARTIAL_OK },
      }),
    );
    const line = summariseDecision(decision);
    expect(line).toMatch(/COMPLETE/);
  });

  it('summariseDecision for idle status', () => {
    const decision = buildWorkflowDecision(makeInput({ machineState: 'idle' }));
    const line = summariseDecision(decision);
    expect(line).toMatch(/IDLE/);
  });

  it('advanceEventNameForState handles all states', () => {
    expect(advanceEventNameForState('fbasimReady')).toBe('CATDES_DONE');
    expect(advanceEventNameForState('catdesReady')).toBe('DYNCON_DONE');
    expect(advanceEventNameForState('dynconReady')).toBe('CELLFREE_DONE');
    expect(advanceEventNameForState('cellfreeReady')).toBe('DBTL_COMMITTED');
  });
});
