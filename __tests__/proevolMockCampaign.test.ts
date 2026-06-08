/** @jest-environment node */

// Mock the catalyst designer data
jest.mock('../src/data/mockCatalystDesigner', () => ({
  ENZYME_STRUCTURES: [
    {
      id: 'ADS',
      name: 'Amorphadiene synthase',
      sequence: 'MKWKTGLSLLLSAFLATATTVQA',
      substrate: 'FPP',
      product: 'Amorphadiene',
      pdbId: '2ONH',
      length: 24,
    },
    {
      id: 'CYP71AV1',
      name: 'Cytochrome P450 71AV1',
      sequence: 'MDSLFEFILTAILFTLLYIYKTKGKGLRKG',
      substrate: 'Amorphadiene',
      product: 'Artemisinic acid',
      pdbId: '3CBD',
      length: 30,
    },
  ],
  RATE_LIMITING_ENZYME: {
    id: 'ADS',
    name: 'Amorphadiene synthase',
    sequence: 'MKWKTGLSLLLSAFLATATTVQA',
    substrate: 'FPP',
    product: 'Amorphadiene',
    pdbId: '2ONH',
    length: 24,
  },
}));

import { buildProEvolCampaignInput } from '../src/data/proevolMockCampaign';

describe('buildProEvolCampaignInput', () => {
  const baseOptions = {
    totalRounds: 5,
    librarySize: 100,
    survivorCount: 10,
    selectionStringency: 0.7,
  };

  it('returns a valid campaign input with minimal options', () => {
    const result = buildProEvolCampaignInput(baseOptions);

    expect(result.campaignName).toBeDefined();
    expect(result.targetProtein).toBeDefined();
    expect(result.enzymeName).toBeDefined();
    expect(result.wildTypeLabel).toBeDefined();
    expect(result.startingSequence).toBeDefined();
    expect(result.optimizationObjective).toBeDefined();
    expect(result.assayCondition).toBeDefined();
    expect(result.selectionPressure).toBeDefined();
    expect(result.hostSystem).toBeDefined();
    expect(result.screeningSystem).toBeDefined();
    expect(result.provenance).toBeDefined();
    expect(result.totalRounds).toBe(5);
    expect(result.librarySize).toBe(100);
    expect(result.survivorCount).toBe(10);
    expect(result.selectionStringency).toBe(0.7);
    expect(result.sitePool).toBeDefined();
    expect(result.sitePool.length).toBeGreaterThan(0);
    expect(result.upstreamSignals).toBeDefined();
    expect(result.scoreWeights).toBeDefined();
    expect(result.seed).toBeGreaterThan(0);
  });

  it('uses project title as target product when available', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      project: {
        id: 'proj-1',
        title: 'Artemisinin Production',
        summary: 'Improve artemisinin yield',
        targetProduct: 'Artemisinin',
        isDemo: false,
      } as any,
    });
    expect(result.campaignName).toContain('Artemisinin');
  });

  it('uses analyze artifact target product', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      analyzeArtifact: {
        targetProduct: 'Lycopene',
        enzymeCandidates: [],
        bottleneckAssumptions: [],
        evidenceTraceIds: [],
      } as any,
    });
    expect(result.campaignName).toContain('Lycopene');
  });

  it('derives "literature-backed" provenance with evidence', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      project: { id: 'p', title: 'T', summary: 'S', isDemo: false } as any,
      analyzeArtifact: {
        targetProduct: 'Test',
        enzymeCandidates: [],
        bottleneckAssumptions: [],
        evidenceTraceIds: ['ev-1', 'ev-2'],
      } as any,
    });
    expect(result.provenance).toBe('literature-backed');
  });

  it('derives "inferred" provenance with analyze artifact but no evidence', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      analyzeArtifact: {
        targetProduct: 'Test',
        enzymeCandidates: [],
        bottleneckAssumptions: [],
        evidenceTraceIds: [],
      } as any,
    });
    expect(result.provenance).toBe('inferred');
  });

  it('derives "inferred" provenance with catalyst only', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      catalyst: {
        selectedEnzymeId: 'ADS',
        selectedEnzymeName: 'Amorphadiene synthase',
        result: {
          overallBinding: 0.7,
          isViable: true,
          bestCAI: 0.65,
          growthPenalty: 5,
        },
      } as any,
    });
    expect(result.provenance).toBe('inferred');
  });

  it('derives "simulated" provenance with no upstream data', () => {
    const result = buildProEvolCampaignInput(baseOptions);
    expect(result.provenance).toBe('simulated');
  });

  it('uses catalyst enzyme when available', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      catalyst: {
        selectedEnzymeId: 'CYP71AV1',
        selectedEnzymeName: 'Cytochrome P450 71AV1',
        result: {
          overallBinding: 0.6,
          isViable: true,
          bestCAI: 0.5,
          growthPenalty: 10,
        },
      } as any,
    });
    expect(result.targetProtein).toBe('Cytochrome P450 71AV1');
  });

  it('uses analyze artifact enzyme hint', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      analyzeArtifact: {
        targetProduct: 'Test',
        enzymeCandidates: [{ label: 'amorphadiene' }],
        bottleneckAssumptions: [],
        evidenceTraceIds: [],
      } as any,
    });
    expect(result.targetProtein).toBeDefined();
  });

  it('handles FBA with product objective', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      fba: {
        objective: 'product',
        result: { carbonEfficiency: 40 },
      } as any,
    });
    expect(result.assayCondition).toContain('product-coupled');
  });

  it('handles FBA with biomass objective', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      fba: {
        objective: 'biomass',
        result: { carbonEfficiency: 70 },
      } as any,
    });
    expect(result.assayCondition).toContain('growth-coupled');
  });

  it('handles CETHX with limiting step', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      cethx: {
        result: { limitingStep: 'FPP_synthase', efficiency: 60, gibbsFreeEnergy: -20 },
      } as any,
    });
    expect(result.assayCondition).toContain('thermodynamic attention');
  });

  it('derives high selection pressure with low carbon efficiency', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      fba: {
        result: { carbonEfficiency: 30 },
      } as any,
    });
    expect(result.selectionPressure).toContain('High pathway pressure');
  });

  it('derives moderate selection pressure with high carbon efficiency', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      fba: {
        result: { carbonEfficiency: 75 },
      } as any,
    });
    expect(result.selectionPressure).toContain('Moderate pressure');
  });

  it('derives balanced selection pressure with medium carbon efficiency', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      fba: {
        result: { carbonEfficiency: 55 },
      } as any,
    });
    expect(result.selectionPressure).toContain('Balanced selection');
  });

  it('derives high pressure with high thermodynamic stress', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      cethx: {
        result: { efficiency: 50, gibbsFreeEnergy: -10 },
      } as any,
    });
    expect(result.selectionPressure).toContain('High pathway pressure');
  });

  it('derives yeast host system for artemisinin', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      project: { id: 'p', title: 'Artemisinin', summary: '', isDemo: false } as any,
    });
    expect(result.hostSystem).toContain('Saccharomyces');
  });

  it('derives E. coli host system', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      project: { id: 'p', title: 'ecoli production', summary: '', isDemo: false } as any,
    });
    expect(result.hostSystem).toContain('Escherichia');
  });

  it('derives generic host system for unknown', () => {
    const result = buildProEvolCampaignInput(baseOptions);
    expect(result.hostSystem).toContain('Heterologous');
  });

  it('derives burden-aware screening for non-viable catalyst', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      catalyst: {
        selectedEnzymeId: 'ADS',
        selectedEnzymeName: 'Test',
        result: {
          overallBinding: 0.3,
          isViable: false,
          bestCAI: 0.4,
          growthPenalty: 20,
        },
      } as any,
    });
    expect(result.screeningSystem).toContain('burden-aware');
  });

  it('derives standard screening for viable catalyst', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      catalyst: {
        selectedEnzymeId: 'ADS',
        selectedEnzymeName: 'Test',
        result: {
          overallBinding: 0.7,
          isViable: true,
          bestCAI: 0.6,
          growthPenalty: 5,
        },
      } as any,
    });
    expect(result.screeningSystem).toContain('96-well');
  });

  it('site pool has unique positions', () => {
    const result = buildProEvolCampaignInput(baseOptions);
    const unique = new Set(result.sitePool);
    expect(result.sitePool.length).toBe(unique.size);
  });

  it('upstream signals are in valid range', () => {
    const result = buildProEvolCampaignInput(baseOptions);
    for (const [key, value] of Object.entries(result.upstreamSignals)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('score weights are defined', () => {
    const result = buildProEvolCampaignInput(baseOptions);
    expect(result.scoreWeights!.activity).toBe(0.4);
    expect(result.scoreWeights!.stability).toBe(0.24);
    expect(result.scoreWeights!.expression).toBe(0.13);
    expect(result.scoreWeights!.specificity).toBe(0.11);
    expect(result.scoreWeights!.burden).toBe(3.8);
    expect(result.scoreWeights!.risk).toBe(4.4);
  });

  it('seed is deterministic for same inputs', () => {
    const a = buildProEvolCampaignInput(baseOptions);
    const b = buildProEvolCampaignInput(baseOptions);
    expect(a.seed).toBe(b.seed);
  });

  it('seed changes with different inputs', () => {
    const a = buildProEvolCampaignInput(baseOptions);
    const b = buildProEvolCampaignInput({ ...baseOptions, totalRounds: 10 });
    expect(a.seed).not.toBe(b.seed);
  });

  it('uses default target product when no project or analyze', () => {
    const result = buildProEvolCampaignInput(baseOptions);
    expect(result.campaignName).toContain('Target Product');
  });

  it('handles demo project with evidence as inferred', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      project: { id: 'p', title: 'Demo', summary: 'Demo project', isDemo: true } as any,
      analyzeArtifact: {
        targetProduct: 'Test',
        enzymeCandidates: [],
        bottleneckAssumptions: [],
        evidenceTraceIds: ['ev-1'],
      } as any,
    });
    // Demo project with evidence: not literature-backed (isDemo), but has analyzeArtifact
    // so it's 'inferred' not 'simulated'
    expect(result.provenance).toBe('inferred');
  });

  it('handles catalyst with non-viable result', () => {
    const result = buildProEvolCampaignInput({
      ...baseOptions,
      catalyst: {
        selectedEnzymeId: 'ADS',
        selectedEnzymeName: 'Test',
        result: {
          overallBinding: 0.2,
          isViable: false,
          bestCAI: 0.3,
          growthPenalty: 25,
        },
      } as any,
    });
    expect(result.upstreamSignals.catalystConfidence).toBeLessThan(0.5);
  });

  it('optimization objective has required fields', () => {
    const result = buildProEvolCampaignInput(baseOptions);
    expect(result.optimizationObjective.label).toBeDefined();
    expect(result.optimizationObjective.summary).toBeDefined();
    expect(result.optimizationObjective.primaryMetric).toBeDefined();
    expect(result.optimizationObjective.balancingMetrics.length).toBeGreaterThan(0);
  });
});
