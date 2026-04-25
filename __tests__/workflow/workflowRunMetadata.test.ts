/** @jest-environment node */
import type { WorkbenchToolPayloadMap } from '../../src/store/workbenchPayloads';

type StoreModule = typeof import('../../src/store/workbenchStore');

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

function pathd(updatedAt: number): WorkbenchToolPayloadMap['pathd'] {
  return {
    validity: 'partial',
    toolId: 'pathd',
    targetProduct: 'limonene',
    activeRouteLabel: `route-${updatedAt}`,
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
    updatedAt,
  };
}

function fbasim(feasible: boolean, uncertainty: number, updatedAt: number): WorkbenchToolPayloadMap['fbasim'] {
  return {
    validity: 'partial',
    toolId: 'fbasim',
    targetProduct: 'limonene',
    pathwayFocus: 'route-1',
    mode: 'single',
    objective: 'product',
    glucoseUptake: 10,
    oxygenUptake: 5,
    knockouts: [],
    result: {
      growthRate: feasible ? 0.82 : 0,
      atpYield: 18,
      nadhProduction: 7,
      carbonEfficiency: 0.71,
      feasible,
      shadowPrices: {
        glc: -0.1,
        o2: -0.2,
        atp: uncertainty,
      },
      topFluxes: [{ reactionId: 'R1', flux: feasible ? 2.4 : 0 }],
    },
    updatedAt,
  };
}

const CATDES_OK: WorkbenchToolPayloadMap['catdes'] = {
  validity: 'partial',
  toolId: 'catdes',
  targetProduct: 'limonene',
  selectedEnzymeId: 'enz-1',
  selectedEnzymeName: 'Limonene synthase',
  selectedView: 'active-site',
  requiredFlux: 2.4,
  designCount: 4,
  result: {
    bindingKd: 0.2,
    overallBinding: 0.8,
    bestSequenceScore: 0.92,
    bestCAI: 0.82,
    totalMetabolicDrain: 0.18,
    growthPenalty: 0.04,
    isViable: true,
    bestPathway: 'route-1',
    topMutationSites: 3,
    recommendation: 'Proceed',
  },
  updatedAt: 3,
};

const DYNCON_OK: WorkbenchToolPayloadMap['dyncon'] = {
  validity: 'partial',
  toolId: 'dyncon',
  targetProduct: 'limonene',
  controller: { kp: 1, ki: 0.1, kd: 0.01, setpoint: 2 },
  hill: { vmax: 1, kd: 0.5, n: 2 },
  result: {
    productTiter: 2.1,
    productivity: 0.6,
    doRmse: 0.08,
    stable: true,
    burdenIndex: 0.2,
    currentFPP: 1.4,
    adsExpression: 0.9,
    rbsPart: 'B0034',
  },
  updatedAt: 4,
};

const CELLFREE_OK: WorkbenchToolPayloadMap['cellfree'] = {
  validity: 'partial',
  toolId: 'cellfree',
  targetProduct: 'limonene',
  targetConstruct: 'construct-1',
  constructCount: 2,
  temperature: 30,
  simulationTime: 120,
  result: {
    totalProteinYield: 42,
    energyDepletionTime: 45,
    isResourceLimited: false,
    invitroMaxProtein: 120,
    invivoExpression: 88,
    confidence: 0.72,
  },
  updatedAt: 5,
};

const DBTL_OK: WorkbenchToolPayloadMap['dbtlflow'] = {
  validity: 'partial',
  toolId: 'dbtlflow',
  targetProduct: 'limonene',
  proposedPhase: 'Learn',
  draftHypothesis: 'Improve route balance',
  measuredResult: 12,
  unit: 'mg/L',
  passed: true,
  feedbackSource: 'committed',
  feedbackIterationId: 1,
  result: {
    bestIteration: 1,
    improvementRate: 0.2,
    passRate: 0.8,
    latestPhase: 'Learn',
    learnedParameters: ['raise ADS expression'],
  },
  updatedAt: 6,
};

describe('workflow run artifact metadata (R4)', () => {
  it('preserves historical run metadata across workflow iterations', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      setTarget(useWorkbenchStore, 'limonene');

      useWorkbenchStore.getState().setToolPayload('pathd', pathd(1));
      useWorkbenchStore.getState().setToolPayload('fbasim', fbasim(true, 0.12, 2));
      useWorkbenchStore.getState().setToolPayload('catdes', CATDES_OK);
      useWorkbenchStore.getState().setToolPayload('dyncon', DYNCON_OK);
      useWorkbenchStore.getState().setToolPayload('cellfree', CELLFREE_OK);
      useWorkbenchStore.getState().setToolPayload('dbtlflow', DBTL_OK);

      expect(useWorkbenchStore.getState().workflowControl.machineState).toBe('dbtlCommitted');

      useWorkbenchStore.getState().loopBackWorkflow();
      expect(useWorkbenchStore.getState().workflowControl.iteration).toBe(1);

      useWorkbenchStore.getState().setToolPayload('pathd', pathd(11));
      useWorkbenchStore.getState().setToolPayload('fbasim', fbasim(false, 0.77, 12));

      const fbaRuns = useWorkbenchStore
        .getState()
        .runArtifacts
        .filter((artifact) => artifact.toolId === 'fbasim');

      expect(fbaRuns).toHaveLength(2);
      expect(fbaRuns[0]).toMatchObject({
        status: 'gated',
        confidence: 0,
        uncertainty: 0.77,
        validity: 'partial',
        humanGateRequired: true,
        iteration: 1,
      });
      expect(fbaRuns[1]).toMatchObject({
        status: 'ok',
        confidence: 1,
        uncertainty: 0.12,
        validity: 'partial',
        humanGateRequired: false,
        iteration: 0,
      });
    });
  });
});
