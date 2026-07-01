/**
 * SteadyCom Community FBA Tests
 *
 * Tests for the real SteadyCom algorithm (Chan, Simons & Maranas, 2017,
 * PLOS Comput Biol 13(5):e1005539). Bisection on community growth rate mu,
 * where each candidate mu is checked via ONE joint LP over all species
 * (per-species mass balance + shared-pool coupling + biomass-abundance
 * coupling + sum(X)=1) — see buildCommunityLPModel.
 *
 * FBA sign convention used in test models:
 *   - Uptake reaction: S(met) = -1, lb = -10, ub = 0
 *     -> v = -10 gives net met change = -10 * (-1) = +10 (met produced = uptake)
 *   - Secretion/drain: S(met) = -1, lb = 0, ub = large
 *     -> v > 0 gives net met change = v * (-1) = -v (met consumed = secretion)
 */

import { steadyCom, buildCommunityLPModel, type SteadyComSpecies } from '../src/server/fbaSteadyCom';

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
    // Coupled semantics: species with nonzero abundance (X_i > 0) grow exactly at the
    // community rate mu (v_biomass = mu * X_i); a species may have zero abundance (and
    // therefore zero growth) at the community optimum -- this is real SteadyCom behavior
    // (species can go "extinct" in the community), not an error. At least one species
    // must realize the community growth rate.
    const growths = Object.values(result.speciesGrowthRates);
    expect(growths.some((g) => Math.abs(g - result.communityGrowthRate) < 1e-3)).toBe(true);
    for (const g of growths) {
      expect(g).toBeGreaterThanOrEqual(-1e-6);
      expect(g).toBeLessThanOrEqual(result.communityGrowthRate + 1e-3);
    }
    expect(result.iterations).toBeLessThan(100);
    expect(result.convergenceHistory.length).toBeGreaterThan(0);
  });

  it('should return zero community growth for a model where biomass capacity is zero', async () => {
    // No species can grow at all (muHigh <= 0): the joint LP at mu=0 is still optimal
    // (zero growth is always feasible), so this is a valid "no-growth" community, not an error.
    const species = infeasibleModel();
    const result = await steadyCom(species, []);

    expect(result.status).toBe('optimal');
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

    // With no shared metabolites, species are only coupled via sum(X)=1 and each
    // v_biomass_i = mu*X_i. The joint LP can put all abundance on whichever species
    // reaches the higher community mu (here A, mu_max_A=5 > mu_max_B=3) rather than
    // being capped at min(individual) -- that old "coupling-less" invariant is exactly
    // what this rewrite fixes (do not re-assert mu <= min(individual)).
    expect(result.status).toBe('optimal');
    expect(result.communityGrowthRate).toBeGreaterThan(0);
    expect(result.communityGrowthRate).toBeLessThanOrEqual(5 + 1e-3);
    const growths = Object.values(result.speciesGrowthRates);
    expect(growths.some((g) => Math.abs(g - result.communityGrowthRate) < 1e-3)).toBe(true);
  });

  it('should return per-species flux distributions', async () => {
    const species = crossFeedingModel();
    const result = await steadyCom(species, ['acetate']);

    expect(result.status).toBe('optimal');
    expect(result.speciesFluxes['S1']).toBeDefined();
    expect(result.speciesFluxes['S2']).toBeDefined();
    // Every declared reaction has a (possibly zero) flux entry, de-namespaced correctly.
    for (const r of species.find((s) => s.id === 'S1')!.reactions) {
      expect(result.speciesFluxes['S1'][r.id]).toBeDefined();
    }
    for (const r of species.find((s) => s.id === 'S2')!.reactions) {
      expect(result.speciesFluxes['S2'][r.id]).toBeDefined();
    }
    // Whichever species realizes the community growth rate must carry nonzero flux
    // through its uptake reaction (it cannot grow on nothing).
    if (Math.abs(result.speciesGrowthRates['S1'] - result.communityGrowthRate) < 1e-3) {
      expect(Math.abs(result.speciesFluxes['S1']['glucose_uptake'])).toBeGreaterThan(0);
    }
    if (Math.abs(result.speciesGrowthRates['S2'] - result.communityGrowthRate) < 1e-3) {
      expect(Math.abs(result.speciesFluxes['S2']['acetate_uptake'])).toBeGreaterThan(0);
    }
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

// Producer P ferments substrate -> shared_c (+ grows); Consumer C grows ONLY on shared_c.
const producer: SteadyComSpecies = {
  id: 'P', name: 'P', biomassReaction: 'BIO_P', metabolites: ['s', 'p_int'],
  reactions: [
    { id: 'UP_S', stoichiometry: { s: 1 }, lowerBound: 0, upperBound: 10 },
    { id: 'FERM', stoichiometry: { s: -1, p_int: 1, shared_c: 1 }, lowerBound: 0, upperBound: 100 },
    { id: 'BIO_P', stoichiometry: { p_int: -1 }, lowerBound: 0, upperBound: 100 },
  ],
};
const consumer: SteadyComSpecies = {
  id: 'C', name: 'C', biomassReaction: 'BIO_C', metabolites: ['c_int'],
  reactions: [
    { id: 'UP_C', stoichiometry: { shared_c: -1, c_int: 1 }, lowerBound: 0, upperBound: 100 },
    { id: 'BIO_C', stoichiometry: { c_int: -1 }, lowerBound: 0, upperBound: 100 },
  ],
};

describe('steadyCom cross-feeding (coupled)', () => {
  it('consumer that cannot grow alone grows in community on producer secretion (syntrophy)', async () => {
    // Consumer alone: no shared_c source -> community of just C cannot grow.
    const soloC = await steadyCom([consumer], ['shared_c']);
    expect(soloC.communityGrowthRate).toBeCloseTo(0, 4);
    // Community P+C: C grows on P's secreted shared_c.
    const comm = await steadyCom([producer, consumer], ['shared_c']);
    expect(comm.status).toBe('optimal');
    expect(comm.communityGrowthRate).toBeGreaterThan(0);
  });

  it('shared pool is conserved: total secretion = total uptake', async () => {
    const comm = await steadyCom([producer, consumer], ['shared_c']);
    const secreted = comm.speciesFluxes['P']['FERM'];       // produces shared_c (coef +1)
    const consumed = comm.speciesFluxes['C']['UP_C'];        // consumes shared_c (coef -1)
    expect(secreted).toBeGreaterThan(0);
    expect(secreted).toBeCloseTo(consumed, 4);
  });

  it('is deterministic', async () => {
    const a = await steadyCom([producer, consumer], ['shared_c']);
    const b = await steadyCom([producer, consumer], ['shared_c']);
    expect(b.communityGrowthRate).toBe(a.communityGrowthRate);
  });
});
