/** @jest-environment node */
import type { ProvenanceEntry } from '../src/protocol/nexusTrustRuntime';
import type { WorkbenchToolPayloadMap } from '../src/store/workbenchPayloads';
import type { ProvenanceEntry as WorkbenchProvenanceEntry } from '../src/types/assumptions';
import {
  appendRunProvenance,
  collectProvenanceIds,
  findMissingUpstreamProvenance,
  getProvenanceChainLength,
  withProvenance,
  withProvenanceSync,
} from '../src/services/provenanceMiddleware';

type StoreModule = typeof import('../src/store/workbenchStore');

function withFreshStore<T>(fn: (mod: StoreModule) => T): T {
  let result: T;
  jest.isolateModules(() => {
    const mod = require('../src/store/workbenchStore') as StoreModule;
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

function protocolProvenance(overrides: Partial<ProvenanceEntry> = {}): ProvenanceEntry {
  return {
    provenanceId: 'provenance:pathd:tool-run:test',
    toolId: 'pathd',
    activityType: 'tool-run',
    startedAt: '2026-04-29T00:00:00.000Z',
    completedAt: '2026-04-29T00:00:00.000Z',
    inputAssumptionIds: [],
    outputAssumptionIds: ['pathd.template_route_synthesis'],
    evidenceIds: [],
    upstreamProvenanceIds: [],
    ...overrides,
  };
}

function pathd(updatedAt = 1): WorkbenchToolPayloadMap['pathd'] {
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

function fbasim(updatedAt = 2): WorkbenchToolPayloadMap['fbasim'] {
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
      growthRate: 0.82,
      atpYield: 18,
      nadhProduction: 7,
      carbonEfficiency: 0.71,
      feasible: true,
      shadowPrices: { glc: -0.1, o2: -0.2, atp: 0.12 },
      topFluxes: [{ reactionId: 'R1', flux: 2.4 }],
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
    feedback: {
      learnedMetrics: {},
      sources: [
        {
          derivedFromToolId: 'dbtlflow',
          derivedAt: '2026-04-29T00:00:00.000Z',
        },
      ],
      schemaVersion: 'dbtl-feedback-v1',
    },
    learnedParameters: ['raise ADS expression'],
  },
  updatedAt: 6,
};

describe('provenance middleware', () => {
  it('creates a protocol provenance entry and returns the async runner output payload', async () => {
    const input = { value: 1 };
    const result = await withProvenance(
      input,
      {
        toolId: 'pathd',
        activityType: 'tool-run',
        surface: 'payload',
        actor: 'tester',
        outputAssumptionIds: ['pathd.template_route_synthesis'],
        evidenceIds: ['existing-evidence-id'],
        upstreamProvenanceIds: ['upstream-1'],
        startedAt: '2026-04-29T00:00:00.000Z',
        completedAt: '2026-04-29T00:00:01.000Z',
      },
      async (payload) => ({ ...payload, value: 2 }),
    );

    expect(result.payload).toMatchObject({ value: 2 });
    expect(result.provenanceEntry).toMatchObject({
      toolId: 'pathd',
      activityType: 'tool-run',
      surface: 'payload',
      startedAt: '2026-04-29T00:00:00.000Z',
      completedAt: '2026-04-29T00:00:01.000Z',
      outputAssumptionIds: ['pathd.template_route_synthesis'],
      evidenceIds: ['existing-evidence-id'],
      upstreamProvenanceIds: ['upstream-1'],
      actor: 'tester',
    });
    expect(result.provenanceEntry.provenanceId).toMatch(/^provenance:pathd:tool-run:/);
    expect(input).toEqual({ value: 1 });
  });

  it('creates provenance with the sync runner and does not invent evidence ids', () => {
    const result = withProvenanceSync(
      { value: 1 },
      {
        toolId: 'dyncon',
        activityType: 'tool-run',
        startedAt: '2026-04-29T00:00:00.000Z',
        completedAt: '2026-04-29T00:00:00.000Z',
      },
      (payload) => ({ ...payload, value: 3 }),
    );

    expect(result.payload).toMatchObject({ value: 3 });
    expect(result.provenanceEntry.evidenceIds).toEqual([]);
    expect(result.provenanceEntry.provenanceId).toMatch(/^provenance:dyncon:tool-run:/);
  });

  it('attaches workbench-compatible runProvenance to object payloads', () => {
    const payload = appendRunProvenance<{ value: number; runProvenance?: WorkbenchProvenanceEntry }>(
      { value: 1 },
      protocolProvenance({
        evidenceIds: ['existing-evidence-id'],
        upstreamProvenanceIds: ['pathd:1'],
      }),
    );

    expect(payload).toMatchObject({
      value: 1,
      runProvenance: {
        toolId: 'pathd',
        inputAssumptions: [],
        outputAssumptions: ['pathd.template_route_synthesis'],
        upstreamProvenance: ['pathd:1'],
      },
    });
    expect(payload.runProvenance.evidence).toEqual([]);
  });

  it('does not crash on primitive payloads', () => {
    expect(appendRunProvenance('payload', protocolProvenance())).toBe('payload');
  });

  it('preserves existing runProvenance and appends a new entry', () => {
    const payload = appendRunProvenance(
      {
        runProvenance: {
          toolId: 'pathd',
          timestamp: 1,
          inputAssumptions: [],
          outputAssumptions: [],
          evidence: [],
          validityTier: 'partial' as const,
          upstreamProvenance: [],
        },
      },
      protocolProvenance({ toolId: 'dyncon' }),
    );

    expect(Array.isArray(payload.runProvenance)).toBe(true);
    expect(payload.runProvenance).toHaveLength(2);
  });

  it('collects provenance ids and detects local missing upstream references', () => {
    const payload = {
      runProvenance: [
        {
          toolId: 'pathd',
          timestamp: 1,
          inputAssumptions: [],
          outputAssumptions: [],
          evidence: [],
          validityTier: 'partial' as const,
          upstreamProvenance: [],
        },
        {
          toolId: 'dyncon',
          timestamp: 2,
          inputAssumptions: [],
          outputAssumptions: [],
          evidence: [],
          validityTier: 'partial' as const,
          upstreamProvenance: ['pathd:1', 'missing:3'],
        },
      ],
    };

    expect(collectProvenanceIds(payload)).toEqual(['pathd:1', 'dyncon:2']);
    expect(getProvenanceChainLength(payload)).toBe(2);
    expect(findMissingUpstreamProvenance(payload)).toEqual(['missing:3']);
  });

  it('adds runProvenance to initial pathd, dyncon, and dbtlflow store writes', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      setTarget(useWorkbenchStore, 'limonene');
      useWorkbenchStore.getState().setToolPayload('pathd', pathd(1));
      useWorkbenchStore.getState().setToolPayload('fbasim', fbasim(2));
      useWorkbenchStore.getState().setToolPayload('catdes', CATDES_OK);
      useWorkbenchStore.getState().setToolPayload('dyncon', DYNCON_OK);
      useWorkbenchStore.getState().setToolPayload('cellfree', CELLFREE_OK);
      useWorkbenchStore.getState().setToolPayload('dbtlflow', DBTL_OK);

      const state = useWorkbenchStore.getState();
      expect(state.toolPayloads.pathd?.runProvenance).toMatchObject({
        toolId: 'pathd',
        outputAssumptions: ['pathd.template_route_synthesis', 'pathd.delta_g_lookup_real'],
      });
      expect(state.toolPayloads.dyncon?.runProvenance).toMatchObject({
        toolId: 'dyncon',
        outputAssumptions: ['dyncon.rk4_real', 'dyncon.parameters_reference', 'dyncon.no_noise'],
      });
      const dbtlRun = state.runArtifacts.find((artifact) => artifact.toolId === 'dbtlflow');
      expect(dbtlRun?.payloadSnapshot).toMatchObject({
        runProvenance: {
          toolId: 'dbtlflow',
          outputAssumptions: ['dbtlflow.heuristic_learning', 'dbtlflow.sbol_real'],
        },
      });
      expect(state.toolPayloads.dbtlflow?.runProvenance ?? dbtlRun?.payloadSnapshot.runProvenance).toMatchObject({
        toolId: 'dbtlflow',
        outputAssumptions: ['dbtlflow.heuristic_learning', 'dbtlflow.sbol_real'],
      });
    });
  });

  it('does not replace an existing runProvenance snapshot in the store integration', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      setTarget(useWorkbenchStore, 'limonene');
      const existing = {
        toolId: 'pathd',
        timestamp: 99,
        inputAssumptions: [],
        outputAssumptions: ['existing.assumption'],
        evidence: [],
        validityTier: 'partial' as const,
        upstreamProvenance: [],
      };

      useWorkbenchStore.getState().setToolPayload('pathd', {
        ...pathd(99),
        runProvenance: existing,
      });

      expect(useWorkbenchStore.getState().toolPayloads.pathd?.runProvenance).toBe(existing);
    });
  });
});
