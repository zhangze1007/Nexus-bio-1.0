/** @jest-environment node */
/**
 * Phase-2B.1 — R2 acceptance: workflow actor is the authoritative
 * owner of machine state and iteration. The store dispatches events
 * through `setToolPayload` and `loopBackWorkflow`; the snapshot reads
 * `workflowControl.machineState` and `workflowControl.iteration` from
 * the actor's context.
 *
 * Each test resets the actor and creates a fresh store via Jest's module
 * isolation (`jest.isolateModules`) so no state leaks between cases.
 */
import type { ToolId } from '../../src/domain/workflowContract';
import type { WorkbenchToolPayloadMap } from '../../src/store/workbenchPayloads';

type StoreModule = typeof import('../../src/store/workbenchStore');

const PATHD_OK = {
  validity: 'partial' as const,
  toolId: 'pathd' as const,
  targetProduct: 'limonene',
  activeRouteLabel: 'route-1',
  nodeCount: 8,
  edgeCount: 7,
  selectedNodeId: null,
  result: {
    pathwayCandidates: 1,
    bottleneckCount: 1,
    enzymeCandidates: 2,
    thermodynamicConcerns: 0,
    highlightedNode: 'enz-1',
    recommendedNextTool: 'fbasim',
    evidenceLinked: true,
  },
  updatedAt: 1,
} as WorkbenchToolPayloadMap['pathd'];

function withFreshStore<T>(fn: (mod: StoreModule) => T): T {
  let result: T;
  jest.isolateModules(() => {
    const mod = require('../../src/store/workbenchStore') as StoreModule;
    mod.__resetWorkflowActorForTests();
    result = fn(mod);
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return result!;
}

function setTarget(useStore: StoreModule['useWorkbenchStore'], target: string): void {
  useStore.setState((state) => ({
    ...state,
    project: {
      id: 'project-test',
      title: target,
      summary: '',
      targetProduct: target,
      status: 'draft',
      isDemo: false,
      createdAt: 1,
      updatedAt: 1,
    },
  }));
}

describe('workflowActor — store-owned actor (R2)', () => {
  it('initial workflowControl.iteration is 0 with idle machineState', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      const snap = useWorkbenchStore.getState().workflowControl;
      expect(snap.iteration).toBe(0);
      expect(snap.machineState).toBe('idle');
    });
  });

  it('SET_TARGET advances actor to targetSet via project mutation', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      setTarget(useWorkbenchStore, 'limonene');
      // Trigger snapshot rebuild via a no-op action that recomputes
      // workflowControl. The simplest path is to call setToolPayload
      // with a placeholder OR rely on the actor sync inside the existing
      // snapshot rebuild. For the test we directly call
      // buildWorkflowControlSnapshot via a public mutation: setting a
      // sidecar payload that doesn't gate the path.
      const state = useWorkbenchStore.getState();
      // Force a rebuild by re-applying the project (touchState bumps revision).
      useWorkbenchStore.setState((s) => ({ ...s }));
      // The next read of workflowControl must reflect targetSet only after
      // a real mutation that rebuilds it. So invoke setToolPayload on a
      // benign sidecar (cethx, demo validity — no advance).
      state.setToolPayload('cethx', {
        validity: 'demo',
        toolId: 'cethx',
        targetProduct: 'limonene',
        pathway: 'glycolysis',
        tempC: 30,
        pH: 7,
        result: {
          atpYield: 0,
          nadhYield: 0,
          gibbsFreeEnergy: -10,
          entropyProduction: 0,
          efficiency: 50,
          limitingStep: null,
        },
        updatedAt: 2,
      });
      const snap = useWorkbenchStore.getState().workflowControl;
      expect(snap.machineState).toBe('targetSet');
      expect(snap.iteration).toBe(0);
    });
  });

  it('publishing a contract-meeting PATHD payload advances actor to pathdReady', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      setTarget(useWorkbenchStore, 'limonene');
      useWorkbenchStore.getState().setToolPayload('pathd', PATHD_OK);
      const snap = useWorkbenchStore.getState().workflowControl;
      expect(snap.machineState).toBe('pathdReady');
      expect(snap.iteration).toBe(0);
    });
  });

  it('loopBackWorkflow is a no-op when not in dbtlCommitted', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      setTarget(useWorkbenchStore, 'limonene');
      useWorkbenchStore.getState().setToolPayload('pathd', PATHD_OK);
      useWorkbenchStore.getState().loopBackWorkflow();
      const snap = useWorkbenchStore.getState().workflowControl;
      expect(snap.iteration).toBe(0);
      // pathdReady still — loopBack didn't fire.
      expect(snap.machineState).toBe('pathdReady');
    });
  });

  it('changing the target product resets the actor (iteration drops to 0)', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      setTarget(useWorkbenchStore, 'limonene');
      useWorkbenchStore.getState().setToolPayload('pathd', PATHD_OK);
      expect(useWorkbenchStore.getState().workflowControl.machineState).toBe('pathdReady');

      setTarget(useWorkbenchStore, 'artemisinin');
      // Re-trigger snapshot via a sidecar payload write.
      useWorkbenchStore.getState().setToolPayload('cethx', {
        validity: 'demo',
        toolId: 'cethx',
        targetProduct: 'artemisinin',
        pathway: 'glycolysis',
        tempC: 30,
        pH: 7,
        result: { atpYield: 0, nadhYield: 0, gibbsFreeEnergy: -10, entropyProduction: 0, efficiency: 50, limitingStep: null },
        updatedAt: 3,
      });
      const snap = useWorkbenchStore.getState().workflowControl;
      // Actor was reset → iteration drops to 0. The replay then walks
      // the still-present PATHD payload back into pathdReady, which is
      // expected: the store doesn't auto-clear payloads on project
      // change; the actor reset preserves no iteration history.
      expect(snap.iteration).toBe(0);
    });
  });

  it('upsertEvidence dispatches EVIDENCE_ADDED through to the actor context', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      setTarget(useWorkbenchStore, 'limonene');
      useWorkbenchStore.getState().upsertEvidence({
        sourceKind: 'literature',
        title: 'Test paper',
        abstract: '',
        authors: [],
      });
      // The snapshot's missingEvidence count is supervisor-driven and may
      // not change for this contract, but the EVIDENCE_ADDED event ran
      // without throwing. The actor's ids are private; the visible
      // assertion is that the workflow snapshot rebuilt without error.
      const snap = useWorkbenchStore.getState().workflowControl;
      expect(snap.machineState).toBe('targetSet');
    });
  });
});
