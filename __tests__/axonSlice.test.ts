/**
 * Tests for src/store/slices/axonSlice.ts
 *
 * Covers all slice actions: appendAxonRun, clearAxonRuns, appendAxonLog,
 * clearAxonLogs, setAxonPlan, updateAxonPlanStep.
 */

import {
  createAxonSlice,
  axonInitialState,
  AXON_RUN_LIMIT,
  AXON_LOG_LIMIT,
} from '../src/store/slices/axonSlice';
import type { AxonRunRecord, WorkbenchAxonLogEntry, WorkbenchAxonPlanRecord } from '../src/store/workbenchTypes';

// Helper to create a Zustand-like set/get for testing slice creators.
// Uses a mutable container object so store.state always reflects latest.
function createTestStore() {
  const container: { state: any } = { state: {} };
  const set = jest.fn((updater: any) => {
    if (typeof updater === 'function') {
      container.state = { ...container.state, ...updater(container.state) };
    } else {
      container.state = { ...container.state, ...updater };
    }
  });
  const get = jest.fn(() => container.state);
  const slice = createAxonSlice(set, get, {} as any);
  container.state = { ...container.state, ...slice };
  return { get state() { return container.state; }, set, get, slice };
}

function makeRun(overrides?: Partial<AxonRunRecord>): AxonRunRecord {
  return {
    taskId: 'task-1',
    tool: 'pathd',
    status: 'done',
    label: 'Test run',
    summary: 'Test summary',
    timestamp: Date.now(),
    provenance: { createdAt: Date.now(), retryCount: 0 },
    resultPreview: null,
    error: null,
    ...overrides,
  };
}

function makeLog(overrides?: Partial<WorkbenchAxonLogEntry>): WorkbenchAxonLogEntry {
  return {
    id: 'log-1',
    timestamp: Date.now(),
    phase: 'execute',
    message: 'Test message',
    ...overrides,
  };
}

function makePlan(overrides?: Partial<WorkbenchAxonPlanRecord>): WorkbenchAxonPlanRecord {
  return {
    id: 'plan-1',
    createdAt: Date.now(),
    origin: 'user',
    request: 'Test request',
    steps: [
      {
        id: 'step-1',
        title: 'Step 1',
        tool: 'pathd',
        objective: 'Design pathway',
        inputSummary: 'Artemisinin',
        expectedOutput: 'Pathway blueprint',
        dependsOn: [],
        status: 'planned',
        reason: '',
      },
      {
        id: 'step-2',
        title: 'Step 2',
        tool: 'fbasim',
        objective: 'Simulate flux',
        inputSummary: 'Pathway',
        expectedOutput: 'Flux distribution',
        dependsOn: ['step-1'],
        status: 'planned',
        reason: '',
      },
    ],
    warnings: [],
    depth: 2,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────
// Initial state
// ────────────────────────────────────────────────────────
describe('axonInitialState', () => {
  it('has expected defaults', () => {
    expect(axonInitialState.axonRuns).toEqual([]);
    expect(axonInitialState.axonLogs).toEqual([]);
    expect(axonInitialState.axonPlan).toBeNull();
  });

  it('AXON_RUN_LIMIT is 80', () => {
    expect(AXON_RUN_LIMIT).toBe(80);
  });

  it('AXON_LOG_LIMIT is 400', () => {
    expect(AXON_LOG_LIMIT).toBe(400);
  });
});

// ────────────────────────────────────────────────────────
// appendAxonRun
// ────────────────────────────────────────────────────────
describe('appendAxonRun', () => {
  it('prepends a new run to axonRuns', () => {
    const store = createTestStore();
    store.slice.appendAxonRun(makeRun({ taskId: 'task-1' }));
    store.slice.appendAxonRun(makeRun({ taskId: 'task-2' }));
    expect(store.state.axonRuns[0].taskId).toBe('task-2');
    expect(store.state.axonRuns[1].taskId).toBe('task-1');
  });

  it('respects AXON_RUN_LIMIT', () => {
    const store = createTestStore();
    for (let i = 0; i < AXON_RUN_LIMIT + 10; i++) {
      store.slice.appendAxonRun(makeRun({ taskId: `task-${i}` }));
    }
    expect(store.state.axonRuns.length).toBe(AXON_RUN_LIMIT);
    // Latest should be first
    expect(store.state.axonRuns[0].taskId).toBe(`task-${AXON_RUN_LIMIT + 10 - 1}`);
  });
});

// ────────────────────────────────────────────────────────
// clearAxonRuns
// ────────────────────────────────────────────────────────
describe('clearAxonRuns', () => {
  it('empties axonRuns', () => {
    const store = createTestStore();
    store.slice.appendAxonRun(makeRun());
    store.slice.appendAxonRun(makeRun());
    expect(store.state.axonRuns.length).toBe(2);
    store.slice.clearAxonRuns();
    expect(store.state.axonRuns).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────
// appendAxonLog
// ────────────────────────────────────────────────────────
describe('appendAxonLog', () => {
  it('prepends a new log entry', () => {
    const store = createTestStore();
    store.slice.appendAxonLog(makeLog({ id: 'log-1' }));
    store.slice.appendAxonLog(makeLog({ id: 'log-2' }));
    expect(store.state.axonLogs[0].id).toBe('log-2');
    expect(store.state.axonLogs[1].id).toBe('log-1');
  });

  it('respects AXON_LOG_LIMIT', () => {
    const store = createTestStore();
    for (let i = 0; i < AXON_LOG_LIMIT + 5; i++) {
      store.slice.appendAxonLog(makeLog({ id: `log-${i}` }));
    }
    expect(store.state.axonLogs.length).toBe(AXON_LOG_LIMIT);
    expect(store.state.axonLogs[0].id).toBe(`log-${AXON_LOG_LIMIT + 5 - 1}`);
  });
});

// ────────────────────────────────────────────────────────
// clearAxonLogs
// ────────────────────────────────────────────────────────
describe('clearAxonLogs', () => {
  it('empties axonLogs', () => {
    const store = createTestStore();
    store.slice.appendAxonLog(makeLog());
    store.slice.clearAxonLogs();
    expect(store.state.axonLogs).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────
// setAxonPlan
// ────────────────────────────────────────────────────────
describe('setAxonPlan', () => {
  it('sets a plan', () => {
    const store = createTestStore();
    const plan = makePlan();
    store.slice.setAxonPlan(plan);
    expect(store.state.axonPlan).toBe(plan);
    expect(store.state.axonPlan!.id).toBe('plan-1');
  });

  it('sets plan to null', () => {
    const store = createTestStore();
    store.slice.setAxonPlan(makePlan());
    expect(store.state.axonPlan).not.toBeNull();
    store.slice.setAxonPlan(null);
    expect(store.state.axonPlan).toBeNull();
  });
});

// ────────────────────────────────────────────────────────
// updateAxonPlanStep
// ────────────────────────────────────────────────────────
describe('updateAxonPlanStep', () => {
  it('updates a step in the current plan', () => {
    const store = createTestStore();
    store.slice.setAxonPlan(makePlan());
    store.slice.updateAxonPlanStep('plan-1', 'step-1', { status: 'running', reason: 'In progress' });
    expect(store.state.axonPlan!.steps[0].status).toBe('running');
    expect(store.state.axonPlan!.steps[0].reason).toBe('In progress');
    // Other step unchanged
    expect(store.state.axonPlan!.steps[1].status).toBe('planned');
  });

  it('does nothing when planId does not match', () => {
    const store = createTestStore();
    store.slice.setAxonPlan(makePlan());
    store.slice.updateAxonPlanStep('wrong-plan', 'step-1', { status: 'running' });
    expect(store.state.axonPlan!.steps[0].status).toBe('planned');
  });

  it('does nothing when axonPlan is null', () => {
    const store = createTestStore();
    store.slice.setAxonPlan(null);
    // Should not throw
    store.slice.updateAxonPlanStep('plan-1', 'step-1', { status: 'running' });
    expect(store.state.axonPlan).toBeNull();
  });

  it('does nothing when stepId does not match', () => {
    const store = createTestStore();
    store.slice.setAxonPlan(makePlan());
    store.slice.updateAxonPlanStep('plan-1', 'nonexistent-step', { status: 'done' });
    expect(store.state.axonPlan!.steps[0].status).toBe('planned');
    expect(store.state.axonPlan!.steps[1].status).toBe('planned');
  });

  it('can update taskId field', () => {
    const store = createTestStore();
    store.slice.setAxonPlan(makePlan());
    store.slice.updateAxonPlanStep('plan-1', 'step-1', { taskId: 'task-abc' });
    expect(store.state.axonPlan!.steps[0].taskId).toBe('task-abc');
  });

  it('preserves other step properties when patching', () => {
    const store = createTestStore();
    store.slice.setAxonPlan(makePlan());
    store.slice.updateAxonPlanStep('plan-1', 'step-1', { status: 'done' });
    const step = store.state.axonPlan!.steps[0];
    expect(step.title).toBe('Step 1');
    expect(step.tool).toBe('pathd');
    expect(step.objective).toBe('Design pathway');
    expect(step.dependsOn).toEqual([]);
  });
});
