/** @jest-environment node */

import {
  BASE_REACTIONS,
  METABOLIC_NODES,
  FLUX_EDGES,
  REACTION_DEFS,
  runFBA,
  computeFBAResult,
  YEAST_REACTIONS,
  YEAST_NODES,
  YEAST_FLUX_EDGES,
  YEAST_REACTION_DEFS,
  SHARED_METABOLITES,
  runYeastFBA,
  calculateCommunityFlux,
} from '../src/data/mockFBA';

// ── Static data arrays ──────────────────────────────────────────────────────

describe('BASE_REACTIONS', () => {
  it('has 10 reactions', () => {
    expect(BASE_REACTIONS).toHaveLength(10);
  });

  it('has required fields on every reaction', () => {
    for (const r of BASE_REACTIONS) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.name).toBe('string');
      expect(typeof r.subsystem).toBe('string');
      expect(typeof r.lb).toBe('number');
      expect(typeof r.ub).toBe('number');
      expect(typeof r.flux).toBe('number');
    }
  });

  it('has valid subsystem values', () => {
    const validSubsystems = ['Glycolysis', 'TCA', 'Energy'];
    for (const r of BASE_REACTIONS) {
      expect(validSubsystems).toContain(r.subsystem);
    }
  });
});

describe('METABOLIC_NODES', () => {
  it('has 10 nodes', () => {
    expect(METABOLIC_NODES).toHaveLength(10);
  });

  it('has x/y coordinates on every node', () => {
    for (const n of METABOLIC_NODES) {
      expect(typeof n.x).toBe('number');
      expect(typeof n.y).toBe('number');
      expect(typeof n.label).toBe('string');
    }
  });
});

describe('FLUX_EDGES', () => {
  it('has 9 edges', () => {
    expect(FLUX_EDGES).toHaveLength(9);
  });

  it('references valid reaction IDs', () => {
    const reactionIds = new Set(BASE_REACTIONS.map(r => r.id));
    for (const edge of FLUX_EDGES) {
      expect(reactionIds.has(edge.reactionId)).toBe(true);
    }
  });

  it('has from, to, baseFlux on every edge', () => {
    for (const e of FLUX_EDGES) {
      expect(typeof e.from).toBe('string');
      expect(typeof e.to).toBe('string');
      expect(typeof e.baseFlux).toBe('number');
    }
  });
});

describe('REACTION_DEFS', () => {
  it('has 10 reaction definitions', () => {
    expect(REACTION_DEFS).toHaveLength(10);
  });

  it('has valid subsystem types', () => {
    const validSubsystems = ['Glycolysis', 'TCA', 'Energy'];
    for (const r of REACTION_DEFS) {
      expect(validSubsystems).toContain(r.subsystem);
    }
  });
});

describe('YEAST static data', () => {
  it('YEAST_REACTIONS has 10 reactions', () => {
    expect(YEAST_REACTIONS).toHaveLength(10);
  });

  it('YEAST_NODES has 9 nodes', () => {
    expect(YEAST_NODES).toHaveLength(9);
  });

  it('YEAST_FLUX_EDGES has 8 edges', () => {
    expect(YEAST_FLUX_EDGES).toHaveLength(8);
  });

  it('YEAST_REACTION_DEFS has 10 definitions', () => {
    expect(YEAST_REACTION_DEFS).toHaveLength(10);
  });
});

describe('SHARED_METABOLITES', () => {
  it('has 4 shared metabolites', () => {
    expect(SHARED_METABOLITES).toHaveLength(4);
  });

  it('has valid exporter/importer strains', () => {
    for (const m of SHARED_METABOLITES) {
      expect(['ecoli', 'yeast']).toContain(m.exporterStrain);
      expect(['ecoli', 'yeast']).toContain(m.importerStrain);
      expect(m.exporterStrain).not.toBe(m.importerStrain);
    }
  });

  it('has positive baseFlux', () => {
    for (const m of SHARED_METABOLITES) {
      expect(m.baseFlux).toBeGreaterThan(0);
    }
  });
});

// ── runFBA ──────────────────────────────────────────────────────────────────

describe('runFBA', () => {
  it('returns feasible output at standard conditions', () => {
    const result = runFBA(10, 20);
    expect(result.feasible).toBe(true);
    expect(result.growthRate).toBeGreaterThan(0);
    expect(result.fluxes).toBeDefined();
    expect(result.atpYield).toBeGreaterThan(0);
    expect(result.nadhProduction).toBeGreaterThan(0);
    expect(result.carbonEfficiency).toBeGreaterThan(0);
    expect(result.carbonEfficiency).toBeLessThanOrEqual(100);
  });

  it('has sensitivity coefficients for glc, o2, atp', () => {
    const result = runFBA(10, 20);
    expect(typeof result.sensitivityCoefficients.glc).toBe('number');
    expect(typeof result.sensitivityCoefficients.o2).toBe('number');
    expect(typeof result.sensitivityCoefficients.atp).toBe('number');
  });

  it('returns all expected flux keys', () => {
    const result = runFBA(10, 20);
    const expectedKeys = ['GLCpts', 'PGI', 'PFK', 'FBA', 'GAPD', 'PGK', 'ENO', 'PYK', 'PDH', 'BIOMASS'];
    for (const key of expectedKeys) {
      expect(result.fluxes).toHaveProperty(key);
    }
  });

  it('knocking out GLCpts zeroes all fluxes', () => {
    const result = runFBA(10, 20, ['GLCpts']);
    for (const v of Object.values(result.fluxes)) {
      expect(v).toBe(0);
    }
    expect(result.feasible).toBe(false);
  });

  it('knocking out GAPD zeroes all fluxes', () => {
    const result = runFBA(10, 20, ['GAPD']);
    for (const v of Object.values(result.fluxes)) {
      expect(v).toBe(0);
    }
    expect(result.feasible).toBe(false);
  });

  it('knocking out PYK zeroes PDH and BIOMASS', () => {
    const result = runFBA(10, 20, ['PYK']);
    expect(result.fluxes['PYK']).toBe(0);
    expect(result.fluxes['PDH']).toBe(0);
    expect(result.fluxes['BIOMASS']).toBe(0);
    // GLCpts should still be non-zero
    expect(result.fluxes['GLCpts']).toBe(10);
  });

  it('knocking out PDH zeroes BIOMASS', () => {
    const result = runFBA(10, 20, ['PDH']);
    expect(result.fluxes['PDH']).toBe(0);
    expect(result.fluxes['BIOMASS']).toBe(0);
  });

  it('knocking out a non-essential reaction preserves growth', () => {
    const base = runFBA(10, 20);
    const ko = runFBA(10, 20, ['PGI']);
    expect(ko.fluxes['PGI']).toBe(0);
    expect(ko.feasible).toBe(true);
  });

  it('zero oxygen makes it infeasible (anaerobic)', () => {
    const result = runFBA(10, 0);
    expect(result.feasible).toBe(false);
    expect(result.growthRate).toBe(0);
  });

  it('scales fluxes with glucose uptake', () => {
    const low = runFBA(5, 20);
    const high = runFBA(15, 20);
    expect(high.fluxes['GLCpts']).toBeGreaterThan(low.fluxes['GLCpts']!);
  });

  it('handles zero glucose uptake', () => {
    const result = runFBA(0, 20);
    expect(result.fluxes['GLCpts']).toBe(0);
    expect(result.growthRate).toBe(0);
    expect(result.feasible).toBe(false);
  });

  it('multiple knockouts work', () => {
    const result = runFBA(10, 20, ['PGI', 'PFK']);
    expect(result.fluxes['PGI']).toBe(0);
    expect(result.fluxes['PFK']).toBe(0);
    expect(result.fluxes['GLCpts']).toBe(10);
  });

  it('empty knockouts array is equivalent to no knockouts', () => {
    const noKo = runFBA(10, 20);
    const emptyKo = runFBA(10, 20, []);
    expect(noKo).toEqual(emptyKo);
  });
});

// ── computeFBAResult (legacy API) ───────────────────────────────────────────

describe('computeFBAResult', () => {
  it('returns feasible result at default conditions', () => {
    const result = computeFBAResult(10, 12);
    expect(result.feasible).toBe(true);
    expect(result.objectiveValue).toBeGreaterThan(0);
    expect(result.reactions).toHaveLength(10);
  });

  it('scales TCA reactions by oxygen', () => {
    const lowO2 = computeFBAResult(10, 6);
    const highO2 = computeFBAResult(10, 24);
    // TCA reactions should differ with oxygen
    const tcaLow = lowO2.reactions.filter(r => r.subsystem === 'TCA');
    const tcaHigh = highO2.reactions.filter(r => r.subsystem === 'TCA');
    expect(tcaHigh[0].flux).not.toBe(tcaLow[0].flux);
  });

  it('scales fluxes proportionally with glucose', () => {
    const base = computeFBAResult(10, 12);
    const doubled = computeFBAResult(20, 12);
    // Non-TCA reactions should roughly double
    const baseGlycolysis = base.reactions.find(r => r.id === 'GLCpts');
    const doubledGlycolysis = doubled.reactions.find(r => r.id === 'GLCpts');
    expect(doubledGlycolysis!.flux).toBeCloseTo(baseGlycolysis!.flux! * 2, 5);
  });

  it('has sensitivity coefficients', () => {
    const result = computeFBAResult(10, 12);
    expect(typeof result.sensitivityCoefficients.glc).toBe('number');
    expect(typeof result.sensitivityCoefficients.o2).toBe('number');
    expect(typeof result.sensitivityCoefficients.atp).toBe('number');
  });
});

// ── runYeastFBA ─────────────────────────────────────────────────────────────

describe('runYeastFBA', () => {
  it('returns feasible output at standard conditions', () => {
    const result = runYeastFBA(8, 15);
    expect(result.feasible).toBe(true);
    expect(result.growthRate).toBeGreaterThan(0);
    expect(result.fluxes).toBeDefined();
  });

  it('has all expected yeast flux keys', () => {
    const result = runYeastFBA(8, 15);
    const expectedKeys = ['HXT', 'HXK', 'PGI_y', 'PFK_y', 'TPI', 'PDC', 'ADH', 'ACS', 'IDH', 'BIOMASS_y'];
    for (const key of expectedKeys) {
      expect(result.fluxes).toHaveProperty(key);
    }
  });

  it('knocking out HXT zeroes all fluxes', () => {
    const result = runYeastFBA(8, 15, ['HXT']);
    for (const v of Object.values(result.fluxes)) {
      expect(v).toBe(0);
    }
    expect(result.feasible).toBe(false);
  });

  it('knocking out TPI zeroes all fluxes', () => {
    const result = runYeastFBA(8, 15, ['TPI']);
    for (const v of Object.values(result.fluxes)) {
      expect(v).toBe(0);
    }
  });

  it('knocking out PDC zeroes ADH', () => {
    const result = runYeastFBA(8, 15, ['PDC']);
    expect(result.fluxes['PDC']).toBe(0);
    expect(result.fluxes['ADH']).toBe(0);
  });

  it('knocking out ACS reduces BIOMASS_y and zeroes IDH', () => {
    const base = runYeastFBA(8, 15);
    const result = runYeastFBA(8, 15, ['ACS']);
    expect(result.fluxes['ACS']).toBe(0);
    expect(result.fluxes['IDH']).toBe(0);
    expect(result.fluxes['BIOMASS_y']).toBeLessThan(base.fluxes['BIOMASS_y']!);
  });

  it('zero oxygen reduces aerobic fluxes', () => {
    const aerobic = runYeastFBA(8, 15);
    const anaerobic = runYeastFBA(8, 0);
    expect(anaerobic.fluxes['ACS']).toBeLessThan(aerobic.fluxes['ACS']!);
    expect(anaerobic.fluxes['IDH']).toBeLessThan(aerobic.fluxes['IDH']!);
  });

  it('has sensitivity coefficients', () => {
    const result = runYeastFBA(8, 15);
    expect(typeof result.sensitivityCoefficients.glc).toBe('number');
    expect(typeof result.sensitivityCoefficients.o2).toBe('number');
    expect(typeof result.sensitivityCoefficients.atp).toBe('number');
  });

  it('handles zero glucose', () => {
    const result = runYeastFBA(0, 15);
    expect(result.fluxes['HXT']).toBe(0);
    expect(result.feasible).toBe(false);
  });
});

// ── calculateCommunityFlux ──────────────────────────────────────────────────

describe('calculateCommunityFlux', () => {
  it('returns feasible community output', () => {
    const result = calculateCommunityFlux(10, 20, [], 8, 15, []);
    expect(result.feasible).toBe(true);
    expect(result.ecoli).toBeDefined();
    expect(result.yeast).toBeDefined();
    expect(result.exchangeFluxes).toBeDefined();
    expect(result.communityGrowthRate).toBeGreaterThanOrEqual(0);
    expect(result.communityBiomassObjective).toBeGreaterThanOrEqual(0);
  });

  it('exchange fluxes cover all shared metabolites', () => {
    const result = calculateCommunityFlux(10, 20, [], 8, 15, []);
    expect(result.exchangeFluxes).toHaveLength(SHARED_METABOLITES.length);
    for (const ef of result.exchangeFluxes) {
      expect(typeof ef.id).toBe('string');
      expect(typeof ef.metabolite).toBe('string');
      expect(['ecoli', 'yeast']).toContain(ef.fromStrain);
      expect(['ecoli', 'yeast']).toContain(ef.toStrain);
    }
  });

  it('alpha=0 weights ecoli fully', () => {
    const result = calculateCommunityFlux(10, 20, [], 8, 15, [], 0);
    // Community growth should be close to adjusted ecoli growth
    expect(result.communityGrowthRate).toBeGreaterThan(0);
  });

  it('alpha=1 weights yeast fully', () => {
    const result = calculateCommunityFlux(10, 20, [], 8, 15, [], 1);
    expect(result.communityGrowthRate).toBeGreaterThan(0);
  });

  it('knocking out ecoli key enzyme affects community', () => {
    const base = calculateCommunityFlux(10, 20, [], 8, 15, []);
    const ko = calculateCommunityFlux(10, 20, ['GLCpts'], 8, 15, []);
    expect(ko.ecoli.feasible).toBe(false);
    expect(ko.communityGrowthRate).toBeLessThan(base.communityGrowthRate);
  });

  it('knocking out yeast key enzyme affects community', () => {
    const base = calculateCommunityFlux(10, 20, [], 8, 15, []);
    const ko = calculateCommunityFlux(10, 20, [], 8, 15, ['HXT']);
    expect(ko.yeast.feasible).toBe(false);
    expect(ko.communityGrowthRate).toBeLessThan(base.communityGrowthRate);
  });

  it('both infeasible makes community infeasible', () => {
    const result = calculateCommunityFlux(0, 0, [], 0, 0, []);
    expect(result.feasible).toBe(false);
  });

  it('exchange fluxes are zero when exporter is infeasible', () => {
    const result = calculateCommunityFlux(10, 20, ['GLCpts'], 8, 15, []);
    // ecoli exports acetate, succinate, lactate — should be 0 since ecoli is infeasible
    const ecoliExports = result.exchangeFluxes.filter(e => e.fromStrain === 'ecoli');
    for (const ef of ecoliExports) {
      expect(ef.flux).toBe(0);
    }
  });

  it('default alpha is 0.5', () => {
    const explicit = calculateCommunityFlux(10, 20, [], 8, 15, [], 0.5);
    const implicit = calculateCommunityFlux(10, 20, [], 8, 15, []);
    expect(explicit.communityGrowthRate).toBe(implicit.communityGrowthRate);
  });
});
