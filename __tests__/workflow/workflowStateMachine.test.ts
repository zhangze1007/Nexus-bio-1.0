/** @jest-environment node */
import {
  createWorkflowActor,
  describeWorkflowState,
  meetsContract,
  type WorkflowStateValue,
  type WorkflowToolStatus,
} from '../../src/services/workflowStateMachine';

const REAL_OK: WorkflowToolStatus = {
  validity: 'real',
  confidence: 1,
  hasRequiredOutputs: true,
};

const PARTIAL_OK: WorkflowToolStatus = {
  validity: 'partial',
  confidence: 1,
  hasRequiredOutputs: true,
};

const DYNCON_OK: WorkflowToolStatus = {
  ...PARTIAL_OK,
  uncertainty: 0.1,
};

const DEMO_OK: WorkflowToolStatus = {
  validity: 'demo',
  confidence: 1,
  hasRequiredOutputs: true,
};

const PARTIAL_NO_OUTPUTS: WorkflowToolStatus = {
  validity: 'partial',
  confidence: 1,
  hasRequiredOutputs: false,
};

function snapshotValue(actor: ReturnType<typeof createWorkflowActor>): WorkflowStateValue {
  return actor.getSnapshot().value as WorkflowStateValue;
}

describe('workflowStateMachine — initial state', () => {
  it('starts in idle with empty tool status and zero iteration', () => {
    const actor = createWorkflowActor();
    actor.start();
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('idle');
    expect(snap.context.targetProduct).toBeNull();
    expect(snap.context.iteration).toBe(0);
    expect(Object.keys(snap.context.toolStatus)).toHaveLength(0);
    actor.stop();
  });
});

describe('workflowStateMachine — golden path advancement', () => {
  it('advances PATHD → FBASim → CatDes → DynCon → CellFree → DBTLflow when each contract is met', () => {
    const actor = createWorkflowActor();
    actor.start();

    actor.send({ type: 'SET_TARGET', targetProduct: 'artemisinin' });
    expect(snapshotValue(actor)).toBe('targetSet');

    actor.send({ type: 'PATHD_DONE', status: PARTIAL_OK });
    expect(snapshotValue(actor)).toBe('pathdReady');

    actor.send({ type: 'FBASIM_DONE', status: PARTIAL_OK });
    expect(snapshotValue(actor)).toBe('fbasimReady');

    actor.send({ type: 'CATDES_DONE', status: PARTIAL_OK });
    expect(snapshotValue(actor)).toBe('catdesReady');

    actor.send({ type: 'DYNCON_DONE', status: DYNCON_OK });
    expect(snapshotValue(actor)).toBe('dynconReady');

    // CellFree contract floor is 'demo' so partial is fine.
    actor.send({ type: 'CELLFREE_DONE', status: PARTIAL_OK });
    expect(snapshotValue(actor)).toBe('cellfreeReady');

    actor.send({ type: 'DBTL_COMMITTED', status: PARTIAL_OK });
    expect(snapshotValue(actor)).toBe('dbtlCommitted');

    actor.stop();
  });
});

describe('workflowStateMachine — guards refuse weak transitions', () => {
  it('refuses PATHD_DONE when validity floor is not met', () => {
    const actor = createWorkflowActor();
    actor.start();
    actor.send({ type: 'SET_TARGET', targetProduct: 'limonene' });
    // PATHD floor is 'partial' — demo must NOT advance.
    actor.send({ type: 'PATHD_DONE', status: DEMO_OK });
    expect(snapshotValue(actor)).toBe('targetSet');
    actor.stop();
  });

  it('refuses transitions when hasRequiredOutputs is false', () => {
    const actor = createWorkflowActor();
    actor.start();
    actor.send({ type: 'SET_TARGET', targetProduct: 'limonene' });
    actor.send({ type: 'PATHD_DONE', status: PARTIAL_NO_OUTPUTS });
    expect(snapshotValue(actor)).toBe('targetSet');
    actor.stop();
  });

  it('FBASim guard requires confidence >= 1 (feasible flag)', () => {
    const actor = createWorkflowActor();
    actor.start();
    actor.send({ type: 'SET_TARGET', targetProduct: 'limonene' });
    actor.send({ type: 'PATHD_DONE', status: PARTIAL_OK });
    expect(snapshotValue(actor)).toBe('pathdReady');
    // Infeasible LP → confidence (which mirrors `feasible` flag) below 1.
    actor.send({
      type: 'FBASIM_DONE',
      status: { ...PARTIAL_OK, confidence: 0 },
    });
    expect(snapshotValue(actor)).toBe('pathdReady');
    actor.stop();
  });
});

describe('workflowStateMachine — sidecars never move main state', () => {
  it('SIDECAR_UPDATE in any state is absorbed without transition', () => {
    const actor = createWorkflowActor();
    actor.start();
    actor.send({ type: 'SET_TARGET', targetProduct: 'limonene' });
    actor.send({ type: 'PATHD_DONE', status: PARTIAL_OK });
    expect(snapshotValue(actor)).toBe('pathdReady');
    actor.send({ type: 'SIDECAR_UPDATE', toolId: 'cethx', status: REAL_OK });
    expect(snapshotValue(actor)).toBe('pathdReady');
    expect(actor.getSnapshot().context.toolStatus.cethx).toEqual(REAL_OK);
    expect(actor.getSnapshot().context.lastSidecarToolId).toBe('cethx');
    actor.stop();
  });
});

describe('workflowStateMachine — LOOP_BACK preserves evidence', () => {
  it('LOOP_BACK clears tool status and bumps iteration but preserves evidence ids', () => {
    const actor = createWorkflowActor();
    actor.start();
    actor.send({ type: 'SET_TARGET', targetProduct: 'limonene' });
    actor.send({ type: 'EVIDENCE_ADDED', ids: ['ev-1', 'ev-2'] });
    actor.send({ type: 'PATHD_DONE', status: PARTIAL_OK });
    actor.send({ type: 'FBASIM_DONE', status: PARTIAL_OK });
    actor.send({ type: 'CATDES_DONE', status: PARTIAL_OK });
    actor.send({ type: 'DYNCON_DONE', status: DYNCON_OK });
    actor.send({ type: 'CELLFREE_DONE', status: PARTIAL_OK });
    actor.send({ type: 'DBTL_COMMITTED', status: PARTIAL_OK });
    expect(snapshotValue(actor)).toBe('dbtlCommitted');

    actor.send({ type: 'LOOP_BACK' });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('targetSet');
    expect(snap.context.iteration).toBe(1);
    expect(Object.keys(snap.context.toolStatus)).toHaveLength(0);
    // Evidence is preserved across LOOP_BACK.
    expect(snap.context.evidence.ids).toEqual(['ev-1', 'ev-2']);
    actor.stop();
  });

  it('LOOP_BACK only fires from dbtlCommitted', () => {
    const actor = createWorkflowActor();
    actor.start();
    actor.send({ type: 'SET_TARGET', targetProduct: 'x' });
    actor.send({ type: 'PATHD_DONE', status: PARTIAL_OK });
    actor.send({ type: 'LOOP_BACK' }); // ignored
    expect(snapshotValue(actor)).toBe('pathdReady');
    actor.stop();
  });
});

describe('meetsContract pure helper', () => {
  it('rejects when validity floor not met', () => {
    expect(meetsContract('pathd', DEMO_OK)).toBe(false);
  });
  it('accepts when validity meets / exceeds floor and outputs present', () => {
    expect(meetsContract('pathd', PARTIAL_OK)).toBe(true);
    expect(meetsContract('pathd', REAL_OK)).toBe(true);
  });
  it('rejects when confidence below threshold (FBASim feasible flag)', () => {
    expect(meetsContract('fbasim', { ...PARTIAL_OK, confidence: 0 })).toBe(false);
  });
});

describe('describeWorkflowState — labels exist for every state', () => {
  const states: WorkflowStateValue[] = [
    'idle',
    'targetSet',
    'pathdReady',
    'fbasimReady',
    'catdesReady',
    'dynconReady',
    'cellfreeReady',
    'dbtlCommitted',
  ];
  it.each(states)('%s has a non-empty label', (state) => {
    expect(describeWorkflowState(state).length).toBeGreaterThan(0);
  });
});
