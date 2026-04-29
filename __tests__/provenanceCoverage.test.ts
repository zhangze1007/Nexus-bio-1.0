/** @jest-environment node */
import type { WorkbenchToolPayloadMap } from '../src/store/workbenchPayloads';
import type { ProvenanceEntry as WorkbenchProvenanceEntry } from '../src/types/assumptions';

type StoreModule = typeof import('../src/store/workbenchStore');

function withFreshStore<T>(fn: (mod: StoreModule) => T): T {
  let result: T;
  jest.isolateModules(() => {
    const mod = require('../src/store/workbenchStore') as StoreModule;
    mod.__resetWorkflowActorForTests();
    result = fn(mod);
  });
  return result as T;
}

function setTarget(useStore: StoreModule['useWorkbenchStore'], target: string): void {
  useStore.setState((state) => ({
    ...state,
    project: {
      id: 'project-provenance-coverage',
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

function workbenchProvenance(toolId: string, timestamp: number): WorkbenchProvenanceEntry {
  return {
    toolId,
    timestamp,
    inputAssumptions: [],
    outputAssumptions: [`${toolId}.existing_output`],
    evidence: [],
    validityTier: 'partial',
    upstreamProvenance: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function provenanceEntries(payload: unknown): WorkbenchProvenanceEntry[] {
  if (!isRecord(payload)) return [];
  const value = payload.runProvenance;
  const candidates = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return candidates.filter((entry): entry is WorkbenchProvenanceEntry =>
    isRecord(entry)
    && typeof entry.toolId === 'string'
    && typeof entry.timestamp === 'number'
    && Array.isArray(entry.evidence),
  );
}

function latestPayload(
  mod: StoreModule,
  toolId: keyof WorkbenchToolPayloadMap,
): WorkbenchToolPayloadMap[keyof WorkbenchToolPayloadMap] | undefined {
  const state = mod.useWorkbenchStore.getState();
  return state.toolPayloads[toolId] ?? state.runArtifacts.find((artifact) => artifact.toolId === toolId)?.payloadSnapshot;
}

function pathd(updatedAt = 1): WorkbenchToolPayloadMap['pathd'] {
  return {
    validity: 'partial',
    toolId: 'pathd',
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
    runProvenance: workbenchProvenance('fbasim', updatedAt),
    updatedAt,
  };
}

function catdes(updatedAt = 3): WorkbenchToolPayloadMap['catdes'] {
  return {
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
    updatedAt,
  };
}

function dyncon(updatedAt = 4): WorkbenchToolPayloadMap['dyncon'] {
  return {
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
    updatedAt,
  };
}

function cellfree(updatedAt = 5): WorkbenchToolPayloadMap['cellfree'] {
  return {
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
    runProvenance: workbenchProvenance('cellfree', updatedAt),
    updatedAt,
  };
}

function dbtlflow(updatedAt = 6): WorkbenchToolPayloadMap['dbtlflow'] {
  return {
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
    },
    updatedAt,
  };
}

describe('Step 8B provenance coverage', () => {
  it('records or preserves runProvenance for at least six key payload paths', () => {
    withFreshStore((mod) => {
      const { useWorkbenchStore } = mod;
      setTarget(useWorkbenchStore, 'limonene');

      useWorkbenchStore.getState().setToolPayload('pathd', pathd(1));
      useWorkbenchStore.getState().setToolPayload('fbasim', fbasim(2));
      useWorkbenchStore.getState().setToolPayload('catdes', catdes(3));
      useWorkbenchStore.getState().setToolPayload('dyncon', dyncon(4));
      useWorkbenchStore.getState().setToolPayload('cellfree', cellfree(5));
      useWorkbenchStore.getState().setToolPayload('dbtlflow', dbtlflow(6));

      const coveredToolIds: Array<keyof WorkbenchToolPayloadMap> = [
        'pathd',
        'fbasim',
        'catdes',
        'dyncon',
        'cellfree',
        'dbtlflow',
      ];

      coveredToolIds.forEach((toolId) => {
        const [entry] = provenanceEntries(latestPayload(mod, toolId));
        expect(entry).toBeDefined();
        expect(entry.toolId).toBe(toolId);
        expect(entry.evidence).toEqual([]);
      });
    });
  });

  it('does not duplicate a payload provenance snapshot that already exists', () => {
    withFreshStore((mod) => {
      const { useWorkbenchStore } = mod;
      setTarget(useWorkbenchStore, 'limonene');
      const existing = workbenchProvenance('catdes', 99);

      useWorkbenchStore.getState().setToolPayload('catdes', {
        ...catdes(99),
        runProvenance: existing,
      });

      const entries = provenanceEntries(latestPayload(mod, 'catdes'));
      expect(entries).toHaveLength(1);
      expect(entries[0]).toBe(existing);
    });
  });
});
