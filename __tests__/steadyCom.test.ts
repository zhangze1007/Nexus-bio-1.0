/**
 * SteadyCom Community FBA Tests
 *
 * Tests for the real SteadyCom algorithm (Heinken et al., 2015).
 * Binary search on community growth rate with per-species LP feasibility checks.
 *
 * FBA sign convention used in test models:
 *   - Uptake reaction: S(met) = -1, lb = -10, ub = 0
 *     -> v = -10 gives net met change = -10 * (-1) = +10 (met produced = uptake)
 *   - Secretion/drain: S(met) = -1, lb = 0, ub = large
 *     -> v > 0 gives net met change = v * (-1) = -v (met consumed = secretion)
 */

import { steadyCom, type SteadyComSpecies } from '../src/server/fbaSteadyCom';

// -- Test fixtures ------------------------------------------------------------

/**
 * 2-species cross-feeding model.
 *
 * S1 (Producer):
 *   glucose_uptake: {glucose: -1}, [-10, 0] -> uptake glucose
 *   glycolysis: {glucose: -1, atp: 2, acetate: 2}, [0, 100]
 *   acetate_secretion: {acetate: -1}, [0, 100] -> secrete acetate to environment
 *   atp_sink: {atp: -1}, [0, 100]
 *   biomass_S1: {atp: -1, glucose: -0.5}, [0, 100]
 *
 * Mass balance (glucose): (-1)*v_uptake + (-1)*v_glyc + (-0.5)*v_bio = 0
 *   With v_uptake = -10: v_glyc = 10 - 0.5*mu
 *   v_sink = 2*v_glyc - mu = 20 - 2*mu -> requires mu <= 10
 *   mu_max_S1 = 10
 *
 * S2 (Consumer):
 *   acetate_uptake: {acetate: -1}, [-10, 0] -> uptake acetate
 *   acetate_metabolism: {acetate: -1, atp: 3}, [0, 100]
 *   atp_sink_S2: {atp: -1}, [0, 100]
 *   biomass_S2: {atp: -1}, [0, 100]
 *
 * Mass balance (acetate): (-1)*v_uptake + (-1)*v_met = 0
 *   With v_uptake = -10: v_met = 10
 *   v_sink = 3*10 - mu = 30 - mu -> requires mu <= 30
 *   mu_max_S2 = 30
 *
 * Community rate: min(10, 30) = 10
 */
function crossFeedingModel(): SteadyComSpecies[] {
  return [
    {
      id: 'S1',
      name: 'Producer',
      reactions: [
        { id: 'glucose_uptake', stoichiometry: { glucose: -1 }, lowerBound: -10, upperBound: 0 },
        { id: 'glycolysis', stoichiometry: { glucose: -1, atp: 2, acetate: 2 }, lowerBound: 0, upperBound: 100 },
        { id: 'acetate_secretion', stoichiometry: { acetate: -1 }, lowerBound: 0, upperBound: 100 },
        { id: 'atp_sink', stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: 100 },
        { id: 'biomass_S1', stoichiometry: { atp: -1, glucose: -0.5 }, lowerBound: 0, upperBound: 100 },
      ],
      metabolites: ['glucose', 'atp', 'acetate'],
      biomassReaction: 'biomass_S1',
    },
    {
      id: 'S2',
      name: 'Consumer',
      reactions: [
        { id: 'acetate_uptake', stoichiometry: { acetate: -1 }, lowerBound: -10, upperBound: 0 },
        { id: 'acetate_metabolism', stoichiometry: { acetate: -1, atp: 3 }, lowerBound: 0, upperBound: 100 },
        { id: 'atp_sink_S2', stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: 100 },
        { id: 'biomass_S2', stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: 100 },
      ],
      metabolites: ['acetate', 'atp'],
      biomassReaction: 'biomass_S2',
    },
  ];
}

/**
 * Single-species model (edge case).
 *
 *   glucose_uptake: {glucose: -1}, [-10, 0] -> uptake glucose
 *   metabolism: {glucose: -1, atp: 2}, [0, 100]
 *   atp_leak: {atp: -1}, [0, 100]
 *   biomass: {atp: -1}, [0, 100]
 *
 * Mass balance: v_meta = 10 (with v_uptake=-10)
 *   v_leak = 20 - mu -> requires mu <= 20
 *   But also v_meta must satisfy glucose: (-1)*(-10) + (-1)*v_meta = 0 -> v_meta = 10
 *   ATP: 2*10 - v_leak - mu = 0 -> v_leak = 20 - mu -> mu <= 20
 *   mu_max = 20
 */
function singleSpeciesModel(): SteadyComSpecies[] {
  return [
    {
      id: 'Solo',
      name: 'Solo',
      reactions: [
        { id: 'glucose_uptake', stoichiometry: { glucose: -1 }, lowerBound: -10, upperBound: 0 },
        { id: 'metabolism', stoichiometry: { glucose: -1, atp: 2 }, lowerBound: 0, upperBound: 100 },
        { id: 'atp_leak', stoichiometry: {atp: -1 }, lowerBound: 0, upperBound: 100 },
        { id: 'biomass', stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: 100 },
      ],
      metabolites: ['glucose', 'atp'],
      biomassReaction: 'biomass',
    },
  ];
}

/**
 * Independent species (no shared metabolites):
 *   A: a_uptake {a: -1} [-5, 0] -> a_biomass {a: -1} [0, 100]
 *   Mass balance: (-1)*(-5) + (-1)*v_bio = 0 -> v_bio = 5 -> mu_max_A = 5
 *
 *   B: b_uptake {b: -1} [-3, 0] -> b_biomass {b: -1} [0, 100]
 *   Mass balance: (-1)*(-3) + (-1)*v_bio = 0 -> v_bio = 3 -> mu_max_B = 3
 *
 * Community rate: min(5, 3) = 3
 */
function independentModel(): SteadyComSpecies[] {
  return [
    {
      id: 'A',
      name: 'A',
      reactions: [
        { id: 'a_uptake', stoichiometry: { a: -1 }, lowerBound: -5, upperBound: 0 },
        { id: 'a_biomass', stoichiometry: { a: -1 }, lowerBound: 0, upperBound: 100 },
      ],
      metabolites: ['a'],
      biomassReaction: 'a_biomass',
    },
    {
      id: 'B',
      name: 'B',
      reactions: [
        { id: 'b_uptake', stoichiometry: { b: -1 }, lowerBound: -3, upperBound: 0 },
        { id: 'b_biomass', stoichiometry: { b: -1 }, lowerBound: 0, upperBound: 100 },
      ],
      metabolites: ['b'],
      biomassReaction: 'b_biomass',
    },
  ];
}

/**
 * Infeasible model: biomass reaction has upper bound = 0, so no growth is possible.
 *   nutrient: {x: -1}, [-10, 0] -> uptake x
 *   biomass_dead: {x: -1}, [0, 0] -> biomass flux must be 0 (capped at 0)
 *
 * Since biomass must be 0, mu_max = 0, community is infeasible (mu > 0 impossible).
 */
function infeasibleModel(): SteadyComSpecies[] {
  return [
    {
      id: 'Dead',
      name: 'Dead',
      reactions: [
        { id: 'nutrient', stoichiometry: { x: -1 }, lowerBound: -10, upperBound: 0 },
        { id: 'biomass_dead', stoichiometry: { x: -1 }, lowerBound: 0, upperBound: 0 },
      ],
      metabolites: ['x'],
      biomassReaction: 'biomass_dead',
    },
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe('SteadyCom Community FBA', () => {
  it('should solve a 2-species cross-feeding model', async () => {
    const species = crossFeedingModel();
    const result = await steadyCom(species, ['acetate']);

    expect(result.status).toBe('optimal');
    expect(result.communityGrowthRate).toBeGreaterThan(0);
    // All species growth rates must equal the community rate
    expect(result.speciesGrowthRates['S1']).toBeCloseTo(result.communityGrowthRate, 3);
    expect(result.speciesGrowthRates['S2']).toBeCloseTo(result.communityGrowthRate, 3);
    expect(result.iterations).toBeLessThan(100);
    expect(result.convergenceHistory.length).toBeGreaterThan(0);
  });

  it('should return infeasible for a model where biomass capacity is zero', async () => {
    const species = infeasibleModel();
    const result = await steadyCom(species, []);

    expect(result.status).toBe('infeasible');
    expect(result.communityGrowthRate).toBe(0);
  });

  it('should converge within tolerance', async () => {
    const species = crossFeedingModel();
    const result = await steadyCom(species, ['acetate'], 100, 1e-6);

    expect(result.status).toBe('optimal');
    // Convergence history should show progression
    const history = result.convergenceHistory;
    expect(history.length).toBeGreaterThan(1);
    expect(result.iterations).toBeLessThan(100);
  });

  it('should solve a single-species model (community of 1)', async () => {
    const species = singleSpeciesModel();
    const result = await steadyCom(species, []);

    expect(result.status).toBe('optimal');
    expect(result.communityGrowthRate).toBeGreaterThan(0);
    expect(result.speciesGrowthRates['Solo']).toBeCloseTo(result.communityGrowthRate, 3);
  });

  it('should handle independent species (no shared metabolites)', async () => {
    const species = independentModel();
    const result = await steadyCom(species, []);

    // Both species are individually feasible, so the community rate
    // should be the minimum of their individual max growth rates
    expect(result.status).toBe('optimal');
    expect(result.communityGrowthRate).toBeGreaterThan(0);
    expect(result.communityGrowthRate).toBeCloseTo(3, 0); // min(5, 3) = 3
    expect(result.speciesGrowthRates['A']).toBeCloseTo(result.communityGrowthRate, 3);
    expect(result.speciesGrowthRates['B']).toBeCloseTo(result.communityGrowthRate, 3);
  });

  it('should return per-species flux distributions', async () => {
    const species = crossFeedingModel();
    const result = await steadyCom(species, ['acetate']);

    expect(result.status).toBe('optimal');
    expect(result.speciesFluxes['S1']).toBeDefined();
    expect(result.speciesFluxes['S2']).toBeDefined();
    // S1 should have non-zero glucose uptake
    expect(Math.abs(result.speciesFluxes['S1']['glucose_uptake'])).toBeGreaterThan(0);
    // S2 should have non-zero acetate uptake
    expect(Math.abs(result.speciesFluxes['S2']['acetate_uptake'])).toBeGreaterThan(0);
  });

  it('should respect custom maxIterations', async () => {
    const species = crossFeedingModel();
    const result = await steadyCom(species, ['acetate'], 5);

    // With only 5 iterations, it may or may not converge, but should not crash
    expect(['optimal', 'infeasible']).toContain(result.status);
    expect(result.iterations).toBeLessThanOrEqual(5);
  });

  it('should return error for empty species array', async () => {
    const result = await steadyCom([], []);
    expect(result.status).toBe('error');
  });

  it('should return error for missing biomass reaction', async () => {
    const species: SteadyComSpecies[] = [{
      id: 'Bad',
      name: 'Bad',
      reactions: [{ id: 'r1', stoichiometry: { x: -1 }, lowerBound: -10, upperBound: 0 }],
      metabolites: ['x'],
      biomassReaction: 'nonexistent',
    }];
    const result = await steadyCom(species, []);
    expect(result.status).toBe('error');
  });
});
