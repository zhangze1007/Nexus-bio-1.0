/**
 * Inter-tool data flow integration tests.
 *
 * Verifies that the seed functions in workbenchDataflow produce valid
 * downstream parameters when given upstream payloads, and degrade
 * gracefully when upstream data is missing.
 */

import {
  buildCETHXSeed,
  buildCatalystSeed,
  buildDynConSeed,
  buildCellFreeSeed,
  buildDBTLDraft,
} from '../../src/components/tools/shared/workbenchDataflow';

import type {
  FBAWorkbenchPayload,
  CETHXWorkbenchPayload,
  CatalystWorkbenchPayload,
  DynConWorkbenchPayload,
  CellFreeWorkbenchPayload,
  DBTLWorkbenchPayload,
} from '../../src/store/workbenchPayloads';

// ---------------------------------------------------------------------------
// Mock payloads — realistic values for artemisinin pathway
// ---------------------------------------------------------------------------

const mockFBA: FBAWorkbenchPayload = {
  toolId: 'fbasim',
  targetProduct: 'artemisinin',
  pathwayFocus: 'glycolysis',
  mode: 'single',
  objective: 'biomass',
  glucoseUptake: 10,
  oxygenUptake: 8,
  knockouts: [],
  result: {
    growthRate: 0.87,
    atpYield: 18.5,
    nadhProduction: 12.3,
    carbonEfficiency: 0.72,
    feasible: true,
    topFluxes: [
      { reactionId: 'BIOMASS', flux: 0.87 },
      { reactionId: 'PFK', flux: 7.2 },
      { reactionId: 'PDH', flux: 3.5 },
    ],
    sensitivityCoefficients: { glc: 0.9, o2: 0.8, atp: 0.7 },
  },
  updatedAt: Date.now(),
  validity: 'real',
};

const mockCETHX: CETHXWorkbenchPayload = {
  toolId: 'cethx',
  targetProduct: 'artemisinin',
  pathway: 'glycolysis',
  tempC: 31,
  pH: 7.3,
  result: {
    atpYield: 18.5,
    nadhYield: 12.3,
    gibbsFreeEnergy: -45.2,
    entropyProduction: 2.1,
    efficiency: 0.85,
    limitingStep: 'ADS',
  },
  updatedAt: Date.now(),
  validity: 'partial',
};

const mockCatalyst: CatalystWorkbenchPayload = {
  toolId: 'catdes',
  targetProduct: 'artemisinin',
  selectedEnzymeId: 'ads',
  selectedEnzymeName: 'Amorpha-4,11-diene synthase',
  requiredFlux: 1.8,
  designCount: 8,
  result: {
    bindingKd: 2.4,
    overallBinding: 0.78,
    bestSequenceScore: 0.65,
    bestCAI: 0.72,
    totalMetabolicDrain: 0.15,
    growthPenalty: 3.2,
    isViable: true,
    bestPathway: 'glycolysis',
    topMutationSites: 4,
    recommendation: 'Proceed to cell-free validation',
  },
  updatedAt: Date.now(),
  validity: 'partial',
};

const mockDynCon: DynConWorkbenchPayload = {
  toolId: 'dyncon',
  targetProduct: 'artemisinin',
  controller: { kp: 2.5, ki: 0.8, kd: 0.15, setpoint: 0.45 },
  hill: { vmax: 1.2, kd: 50, n: 2.1 },
  result: {
    productTiter: 4.2,
    productivity: 0.65,
    doRmse: 0.042,
    stable: true,
    burdenIndex: 0.18,
    currentFPP: 2.8,
    adsExpression: 0.85,
    rbsPart: 'BBa_B0034',
  },
  updatedAt: Date.now(),
  validity: 'partial',
};

const mockCellFree: CellFreeWorkbenchPayload = {
  toolId: 'cellfree',
  targetProduct: 'artemisinin',
  targetConstruct: 'ads',
  constructCount: 3,
  temperature: 30,
  simulationTime: 240,
  result: {
    totalProteinYield: 125.4,
    energyDepletionTime: 180,
    isResourceLimited: false,
    invitroMaxProtein: 150.2,
    invivoExpression: 85.6,
    confidence: 0.72,
    brendaOverrides: null,
  },
  updatedAt: Date.now(),
  validity: 'partial',
};

const mockDBTL: DBTLWorkbenchPayload = {
  toolId: 'dbtlflow',
  targetProduct: 'artemisinin',
  proposedPhase: 'Test',
  draftHypothesis: 'ADS expression at 30C will yield detectable product',
  measuredResult: 42.5,
  unit: 'mg/L',
  passed: true,
  feedbackSource: 'draft',
  feedbackIterationId: 1,
  result: {
    bestIteration: 2,
    improvementRate: 0.15,
    passRate: 0.75,
    latestPhase: 'Test',
    learnedDeltaPacks: [],
    learnedParameters: [],
  },
  updatedAt: Date.now(),
  validity: 'partial',
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Inter-tool data flow', () => {
  // ---- buildCETHXSeed ----------------------------------------------------

  describe('buildCETHXSeed', () => {
    it('reads FBA flux data to infer pathway and adjust temperature', () => {
      const seed = buildCETHXSeed(null, null, mockFBA, null);

      expect(seed).toBeDefined();
      expect(seed.pathway).toBeDefined();
      expect(seed.tempC).toBeGreaterThan(0);
      expect(seed.pH).toBeGreaterThan(0);
    });

    it('clamps temperature and pH within valid ranges', () => {
      const seed = buildCETHXSeed(null, null, mockFBA, null);

      expect(seed.tempC).toBeGreaterThanOrEqual(20);
      expect(seed.tempC).toBeLessThanOrEqual(60);
      expect(seed.pH).toBeGreaterThanOrEqual(5.5);
      expect(seed.pH).toBeLessThanOrEqual(9);
    });

    it('returns default values when upstreams are null', () => {
      const seed = buildCETHXSeed(null, null, null, null);

      expect(seed).toBeDefined();
      expect(seed.pathway).toBeDefined();
      expect(seed.tempC).toBeGreaterThan(0);
      expect(seed.pH).toBeGreaterThan(0);
    });
  });

  // ---- buildCatalystSeed --------------------------------------------------

  describe('buildCatalystSeed', () => {
    it('uses FBA growth rate and CETHX thermodynamics to compute requiredFlux', () => {
      const seed = buildCatalystSeed(null, null, mockFBA, mockCETHX, null);

      expect(seed).toBeDefined();
      expect(seed.requiredFlux).toBeGreaterThan(0);
      expect(seed.enzymeIndex).toBeGreaterThanOrEqual(0);
      expect(seed.designCount).toBeGreaterThanOrEqual(6);
    });

    it('picks up temperature and pH from CETHX payload', () => {
      const seed = buildCatalystSeed(null, null, mockFBA, mockCETHX, null);

      // CETHX temp is 31
      expect(seed.tempC).toBeCloseTo(31, 0);
      // CETHX pH is 7.3
      expect(seed.pH).toBeCloseTo(7.3, 0);
    });

    it('returns sensible defaults when all upstreams are null', () => {
      const seed = buildCatalystSeed(null, null, null, null, null);

      expect(seed).toBeDefined();
      expect(seed.requiredFlux).toBeGreaterThanOrEqual(0.15);
      expect(seed.designCount).toBeGreaterThanOrEqual(6);
      expect(seed.tempC).toBeGreaterThan(0);
      expect(seed.pH).toBeGreaterThan(0);
    });
  });

  // ---- buildDynConSeed ----------------------------------------------------

  describe('buildDynConSeed', () => {
    it('derives controller gains from upstream CETHX and Catalyst data', () => {
      const seed = buildDynConSeed(mockFBA, mockCETHX, mockCatalyst, null);

      expect(seed).toBeDefined();
      expect(seed.controller.kp).toBeGreaterThan(0);
      expect(seed.controller.ki).toBeGreaterThan(0);
      expect(seed.controller.kd).toBeGreaterThan(0);
      expect(seed.controller.setpoint).toBeGreaterThan(0);
    });

    it('derives Hill function parameters from Catalyst output', () => {
      const seed = buildDynConSeed(mockFBA, mockCETHX, mockCatalyst, null);

      expect(seed.hill.vmax).toBeGreaterThan(0);
      expect(seed.hill.kd).toBeGreaterThan(0);
      expect(seed.hill.n).toBeGreaterThanOrEqual(1);
    });

    it('degrades gracefully with null upstreams', () => {
      const seed = buildDynConSeed(null, null, null, null);

      expect(seed).toBeDefined();
      expect(seed.controller.kp).toBeGreaterThan(0);
      expect(seed.hill.vmax).toBeGreaterThan(0);
    });
  });

  // ---- buildCellFreeSeed --------------------------------------------------

  describe('buildCellFreeSeed', () => {
    it('produces constructs and params from Catalyst and DynCon data', () => {
      const seed = buildCellFreeSeed(null, null, mockCatalyst, mockDynCon, mockCETHX, null);

      expect(seed).toBeDefined();
      expect(seed.constructs).toBeDefined();
      expect(seed.constructs.length).toBeGreaterThan(0);
      expect(seed.params).toBeDefined();
      expect(seed.params.temperature).toBeGreaterThan(0);
      expect(seed.params.simulationTime).toBeGreaterThan(0);
    });

    it('sets temperature and pH from CETHX payload', () => {
      const seed = buildCellFreeSeed(null, null, mockCatalyst, mockDynCon, mockCETHX, null);

      // CETHX temp 31
      expect(seed.params.temperature).toBe(31);
      // CETHX pH 7.3
      expect(seed.params.pH).toBeCloseTo(7.3, 0);
    });

    it('uses DynCon RBS part for the primary construct', () => {
      const seed = buildCellFreeSeed(null, null, mockCatalyst, mockDynCon, mockCETHX, null);

      // DynCon rbsPart is 'BBa_B0034'
      const primary = seed.constructs[1];
      expect(primary.rbs).toBe('BBa_B0034');
    });

    it('returns defaults with null upstreams', () => {
      const seed = buildCellFreeSeed(null, null, null, null, null, null);

      expect(seed).toBeDefined();
      expect(seed.constructs.length).toBeGreaterThan(0);
      expect(seed.params.temperature).toBeGreaterThan(0);
    });
  });

  // ---- buildDBTLDraft -----------------------------------------------------

  describe('buildDBTLDraft', () => {
    it('assembles phase, hypothesis, and feedback from all upstream tools', () => {
      const draft = buildDBTLDraft(
        null,
        null,
        mockCatalyst,
        mockDynCon,
        mockCellFree,
        mockCETHX,
      );

      expect(draft).toBeDefined();
      expect(draft.phase).toBeDefined();
      // Hypothesis references the enzyme name from Catalyst payload
      expect(draft.hypothesis).toContain('Amorpha-4,11-diene synthase');
      expect(draft.feedback).toBeDefined();
      expect(draft.feedback.learnedMetrics).toBeDefined();
      expect(draft.feedback.sources.length).toBeGreaterThan(0);
    });

    it('promotes to Build phase when confidence, stability, and viability are met', () => {
      const highConfidenceCellFree: CellFreeWorkbenchPayload = {
        ...mockCellFree,
        result: {
          ...mockCellFree.result,
          confidence: 0.85,
        },
      };

      const draft = buildDBTLDraft(
        null,
        null,
        mockCatalyst, // isViable: true
        mockDynCon,   // stable: true
        highConfidenceCellFree,
        mockCETHX,
      );

      expect(draft.phase).toBe('Build');
      expect(draft.passed).toBe(true);
    });

    it('falls back to Test phase when catalyst is not viable but confidence is still moderate', () => {
      const nonViableCatalyst: CatalystWorkbenchPayload = {
        ...mockCatalyst,
        result: {
          ...mockCatalyst.result,
          isViable: false,
        },
      };

      const draft = buildDBTLDraft(
        null,
        null,
        nonViableCatalyst,
        mockDynCon,
        mockCellFree,
        mockCETHX,
      );

      // confidence=0.72 >= 0.5 triggers Test even with isViable=false
      expect(draft.phase).toBe('Test');
    });

    it('falls back to Learn phase when confidence is low, unstable, and not viable', () => {
      const nonViableCatalyst: CatalystWorkbenchPayload = {
        ...mockCatalyst,
        result: {
          ...mockCatalyst.result,
          isViable: false,
        },
      };
      const unstableDynCon: DynConWorkbenchPayload = {
        ...mockDynCon,
        result: {
          ...mockDynCon.result,
          stable: false,
        },
      };
      const lowConfidenceCellFree: CellFreeWorkbenchPayload = {
        ...mockCellFree,
        result: {
          ...mockCellFree.result,
          confidence: 0.3,
        },
      };

      const draft = buildDBTLDraft(
        null,
        null,
        nonViableCatalyst,
        unstableDynCon,
        lowConfidenceCellFree,
        mockCETHX,
      );

      expect(draft.phase).toBe('Learn');
    });

    it('includes CETHX thermodynamics in learned metrics when present', () => {
      const draft = buildDBTLDraft(
        null,
        null,
        mockCatalyst,
        mockDynCon,
        mockCellFree,
        mockCETHX,
      );

      expect(draft.feedback.learnedMetrics.gibbsFreeEnergy).toBe(-45.2);
      expect(draft.feedback.learnedMetrics.thermoEfficiency).toBe(0.85);
    });

    it('includes Catalyst binding and drain metrics in learned feedback', () => {
      const draft = buildDBTLDraft(
        null,
        null,
        mockCatalyst,
        mockDynCon,
        mockCellFree,
        mockCETHX,
      );

      expect(draft.feedback.learnedMetrics.bindingKdUM).toBeCloseTo(2.4, 1);
      expect(draft.feedback.learnedMetrics.drainPercent).toBeCloseTo(15, 0);
    });

    it('returns sensible defaults with null upstreams', () => {
      const draft = buildDBTLDraft(null, null, null, null, null, null);

      expect(draft).toBeDefined();
      expect(draft.phase).toBe('Design');
      expect(draft.hypothesis).toBeDefined();
      expect(draft.feedback).toBeDefined();
      expect(draft.learnedParameters).toBeDefined();
      expect(draft.unit).toBeDefined();
    });
  });

  // ---- Full chain ---------------------------------------------------------

  describe('full data flow chain (FBA -> CETHX -> CatDes -> DynCon -> CellFree -> DBTL)', () => {
    it('produces a coherent DBTL draft from the complete chain', () => {
      // Step 1: FBA -> CETHX
      const cethxSeed = buildCETHXSeed(null, null, mockFBA, null);
      expect(cethxSeed.pathway).toBeDefined();

      // Step 2: FBA + CETHX -> CatDes
      const catalystSeed = buildCatalystSeed(null, null, mockFBA, mockCETHX, null);
      expect(catalystSeed.requiredFlux).toBeGreaterThan(0);

      // Step 3: FBA + CETHX + CatDes -> DynCon
      const dynConSeed = buildDynConSeed(mockFBA, mockCETHX, mockCatalyst, null);
      expect(dynConSeed.controller.kp).toBeGreaterThan(0);

      // Step 4: CatDes + DynCon + CETHX -> CellFree
      const cellFreeSeed = buildCellFreeSeed(null, null, mockCatalyst, mockDynCon, mockCETHX, null);
      expect(cellFreeSeed.constructs.length).toBeGreaterThan(0);

      // Step 5: All upstreams -> DBTL
      const dbtlDraft = buildDBTLDraft(
        null,
        null,
        mockCatalyst,
        mockDynCon,
        mockCellFree,
        mockCETHX,
      );
      expect(dbtlDraft.phase).toBeDefined();
      expect(dbtlDraft.feedback.sources.length).toBeGreaterThan(0);

      // The DBTL draft hypothesis references the enzyme name from Catalyst
      expect(dbtlDraft.hypothesis).toContain('Amorpha-4,11-diene synthase');
    });

    it('full chain degrades gracefully when all upstreams are null', () => {
      // Each function should return sensible defaults, not throw
      const cethxSeed = buildCETHXSeed(null, null, null, null);
      const catalystSeed = buildCatalystSeed(null, null, null, null, null);
      const dynConSeed = buildDynConSeed(null, null, null, null);
      const cellFreeSeed = buildCellFreeSeed(null, null, null, null, null, null);
      const dbtlDraft = buildDBTLDraft(null, null, null, null, null, null);

      expect(cethxSeed.pathway).toBeDefined();
      expect(catalystSeed.requiredFlux).toBeGreaterThan(0);
      expect(dynConSeed.controller.kp).toBeGreaterThan(0);
      expect(cellFreeSeed.constructs.length).toBeGreaterThan(0);
      expect(dbtlDraft.phase).toBe('Design');
    });

    it('partial chain (only FBA) still produces valid downstream seeds', () => {
      // Only FBA data available — downstream tools should use defaults for missing inputs
      const cethxSeed = buildCETHXSeed(null, null, mockFBA, null);
      const catalystSeed = buildCatalystSeed(null, null, mockFBA, null, null);
      const dynConSeed = buildDynConSeed(mockFBA, null, null, null);

      expect(cethxSeed.tempC).toBeGreaterThan(20);
      expect(catalystSeed.enzymeIndex).toBeGreaterThanOrEqual(0);
      expect(dynConSeed.hill.vmax).toBeGreaterThan(0);
    });
  });
});
