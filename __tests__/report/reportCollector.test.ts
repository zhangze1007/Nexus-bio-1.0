import { collectReportData, SECTION_TEMPLATES } from '../../src/services/report/reportCollector';
import type {
  FBAWorkbenchPayload,
  CETHXWorkbenchPayload,
  CatalystWorkbenchPayload,
} from '../../src/store/workbenchPayloads';

// ═══════════════════════════════════════════════════════════════
//  Test Fixtures
// ═══════════════════════════════════════════════════════════════

function makeFBAPayload(overrides: Partial<FBAWorkbenchPayload> = {}): FBAWorkbenchPayload {
  return {
    toolId: 'fbasim',
    targetProduct: 'artemisinin',
    pathwayFocus: 'mevalonate',
    mode: 'single',
    objective: 'biomass',
    glucoseUptake: 10,
    oxygenUptake: 20,
    knockouts: [],
    validity: 'real',
    runProvenance: {
      toolId: 'fbasim',
      timestamp: Date.now(),
      inputAssumptions: [],
      outputAssumptions: [],
      evidence: [],
      validityTier: 'real',
      upstreamProvenance: [],
    },
    result: {
      growthRate: 0.87,
      atpYield: 30.5,
      nadhProduction: 12.3,
      carbonEfficiency: 0.72,
      feasible: true,
      sensitivityCoefficients: { glc: 0.45, o2: 0.32, atp: 0.23 },
      topFluxes: [
        { reactionId: 'PFK', flux: 8.5 },
        { reactionId: 'CS', flux: 6.2 },
        { reactionId: 'GAPD', flux: 5.1 },
      ],
    },
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeCETHXPayload(overrides: Partial<CETHXWorkbenchPayload> = {}): CETHXWorkbenchPayload {
  return {
    toolId: 'cethx',
    targetProduct: 'artemisinin',
    pathway: 'glycolysis',
    tempC: 37,
    pH: 7.0,
    validity: 'partial',
    runProvenance: {
      toolId: 'cethx',
      timestamp: Date.now(),
      inputAssumptions: [],
      outputAssumptions: [],
      evidence: [],
      validityTier: 'partial',
      upstreamProvenance: [],
    },
    result: {
      atpYield: 28,
      nadhYield: 10,
      gibbsFreeEnergy: -34.5,
      entropyProduction: 120.3,
      efficiency: 0.65,
      limitingStep: 'PFK',
    },
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeCatDesPayload(overrides: Partial<CatalystWorkbenchPayload> = {}): CatalystWorkbenchPayload {
  return {
    toolId: 'catdes',
    targetProduct: 'artemisinin',
    selectedEnzymeId: 'P12345',
    selectedEnzymeName: 'Amorpha-4,11-diene synthase',
    requiredFlux: 5.0,
    designCount: 3,
    validity: 'real',
    runProvenance: {
      toolId: 'catdes',
      timestamp: Date.now(),
      inputAssumptions: [],
      outputAssumptions: [],
      evidence: [],
      validityTier: 'real',
      upstreamProvenance: [],
    },
    result: {
      bindingKd: 0.45,
      overallBinding: 0.82,
      bestSequenceScore: 0.91,
      bestCAI: 0.78,
      totalMetabolicDrain: 0.15,
      growthPenalty: 0.03,
      isViable: true,
      bestPathway: 'mevalonate',
      topMutationSites: 4,
      recommendation: 'Proceed with directed evolution targeting positions 100, 132, 155, 201',
    },
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Tests
// ═══════════════════════════════════════════════════════════════

describe('reportCollector', () => {
  describe('collectReportData', () => {
    it('returns empty sections and metadata for an empty store', () => {
      const store = { toolPayloads: {} };
      const report = collectReportData(store);

      expect(report.sections).toEqual([]);
      expect(report.summary).toBe('');
      expect(report.metadata.projectTitle).toBe('Untitled Project');
      expect(report.metadata.targetProduct).toBe('Unknown');
      expect(report.metadata.generatedAt).toBeTruthy();
    });

    it('derives targetProduct from the first available payload', () => {
      const store = {
        toolPayloads: {
          fbasim: makeFBAPayload({ targetProduct: 'artemisinin' }),
        },
      };
      const report = collectReportData(store);
      expect(report.metadata.targetProduct).toBe('artemisinin');
    });

    it('derives projectTitle from targetProduct', () => {
      const store = {
        toolPayloads: {
          cethx: makeCETHXPayload({ targetProduct: 'artemisinin' }),
        },
      };
      const report = collectReportData(store);
      expect(report.metadata.projectTitle).toBe('Artemisinin Biosynthesis Report');
    });

    it('generates an FBA section with correct content and tables', () => {
      const store = {
        toolPayloads: {
          fbasim: makeFBAPayload(),
        },
      };
      const report = collectReportData(store);

      expect(report.sections).toHaveLength(1);
      const section = report.sections[0];
      expect(section.toolId).toBe('fbasim');
      expect(section.title).toBe('Flux Balance Analysis');
      expect(section.content).toContain('Growth rate');
      expect(section.content).toContain('0.87');
      expect(section.content).toContain('ATP yield');
      expect(section.content).toContain('30.5');
      expect(section.content).toContain('Carbon efficiency');
      expect(section.content).toContain('72');
      expect(section.tables.length).toBeGreaterThanOrEqual(1);
      expect(section.tables[0].headers).toContain('Reaction');
      expect(section.tables[0].rows).toHaveLength(3);
      expect(section.tables[0].rows[0]).toEqual(['PFK', '8.50']);
      expect(section.provenance.validityTier).toBe('real');
    });

    it('generates a CETHX section with thermodynamic data', () => {
      const store = {
        toolPayloads: {
          cethx: makeCETHXPayload(),
        },
      };
      const report = collectReportData(store);

      expect(report.sections).toHaveLength(1);
      const section = report.sections[0];
      expect(section.toolId).toBe('cethx');
      expect(section.title).toBe('Cell Thermodynamics');
      expect(section.content).toContain('Gibbs free energy');
      expect(section.content).toContain('-34.5');
      expect(section.content).toContain('Feasibility');
      expect(section.content).toContain('Limiting step');
      expect(section.content).toContain('PFK');
      expect(section.tables.length).toBeGreaterThanOrEqual(1);
      expect(section.provenance.validityTier).toBe('partial');
    });

    it('generates a CatDes section with enzyme design data', () => {
      const store = {
        toolPayloads: {
          catdes: makeCatDesPayload(),
        },
      };
      const report = collectReportData(store);

      expect(report.sections).toHaveLength(1);
      const section = report.sections[0];
      expect(section.toolId).toBe('catdes');
      expect(section.title).toBe('Catalyst Designer');
      expect(section.content).toContain('binding affinity');
      expect(section.content).toContain('0.82');
      expect(section.content).toContain('Viable');
      expect(section.content).toContain('metabolic drain');
      expect(section.tables.length).toBeGreaterThanOrEqual(1);
      expect(section.provenance.validityTier).toBe('real');
    });

    it('generates a generic section for tools without a specific template', () => {
      const store = {
        toolPayloads: {
          unknown_tool: {
            toolId: 'unknown_tool',
            targetProduct: 'artemisinin',
            validity: 'demo',
            result: { someValue: 42 },
            updatedAt: Date.now(),
          },
        },
      };
      const report = collectReportData(store);

      expect(report.sections).toHaveLength(1);
      const section = report.sections[0];
      expect(section.toolId).toBe('unknown_tool');
      expect(section.title).toBe('unknown_tool');
      expect(section.content).toContain('unknown_tool');
      expect(section.provenance.validityTier).toBe('demo');
    });

    it('collects multiple tool sections in order', () => {
      const store = {
        toolPayloads: {
          fbasim: makeFBAPayload(),
          cethx: makeCETHXPayload(),
          catdes: makeCatDesPayload(),
        },
      };
      const report = collectReportData(store);

      expect(report.sections).toHaveLength(3);
      expect(report.sections[0].toolId).toBe('fbasim');
      expect(report.sections[1].toolId).toBe('cethx');
      expect(report.sections[2].toolId).toBe('catdes');
      expect(report.summary).toContain('3 tool');
    });

    it('skips payloads with missing result', () => {
      const store = {
        toolPayloads: {
          fbasim: {
            toolId: 'fbasim',
            targetProduct: 'artemisinin',
            validity: 'demo',
            result: null,
            updatedAt: Date.now(),
          },
        },
      };
      const report = collectReportData(store);
      expect(report.sections).toHaveLength(0);
    });

    it('uses "demo" as default validity when runProvenance is absent', () => {
      const store = {
        toolPayloads: {
          fbasim: makeFBAPayload({ validity: 'demo', runProvenance: undefined }),
        },
      };
      const report = collectReportData(store);
      expect(report.sections[0].provenance.validityTier).toBe('demo');
    });
  });

  describe('SECTION_TEMPLATES', () => {
    it('has templates for all 13 tools', () => {
      const expectedTools = [
        'fbasim', 'cethx', 'catdes', 'cellfree', 'dyncon',
        'multio', 'scspatial', 'genmim', 'proevol', 'gecair',
        'pathd', 'dbtlflow', 'nexai',
      ];
      for (const toolId of expectedTools) {
        expect(SECTION_TEMPLATES[toolId]).toBeDefined();
      }
    });

    it('each template returns a valid ReportSection', () => {
      const fbaSection = SECTION_TEMPLATES.fbasim(makeFBAPayload());
      expect(fbaSection.toolId).toBe('fbasim');
      expect(fbaSection.title).toBe('Flux Balance Analysis');
      expect(typeof fbaSection.content).toBe('string');
      expect(Array.isArray(fbaSection.tables)).toBe(true);
      expect(Array.isArray(fbaSection.figures)).toBe(true);
      expect(fbaSection.provenance).toBeDefined();
    });
  });
});
