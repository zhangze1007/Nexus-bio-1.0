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
 * 2-species OBLIGATE cross-feeding model.
 *
 * Constructed so that NEITHER species can grow alone — the only feasible
 * positive-growth solution requires S1 to feed S2 through the shared acetate
 * pool. This is the honest test of SteadyCom coupling: the closed shared pool
 * forces secretion == uptake, and balanced growth forces both species to grow
 * at the single community rate mu (v_biomass_i = mu * X_i, sum(X_i) = 1).
 *
 * S1 (Producer) — acetate is an OBLIGATE byproduct of ATP generation:
 *   glucose_uptake:    {glucose: -1},                 [-10, 0] -> uptake glucose
 *   glycolysis:        {glucose: -1, atp: 2, acetate_int: 2}, [0, 100]
 *   acetate_secretion: {acetate_int: -1, acetate: 1}, [0, 100] -> export to shared pool
 *   atp_sink:          {atp: -1},                     [0, 100]
 *   biomass_S1:        {atp: -1, glucose: -0.5},      [0, 100]
 *
 *   acetate_int (internal) balance: 2*v_glyc - v_secr = 0 -> v_secr = 2*v_glyc.
 *   ATP comes ONLY from glycolysis, which obligately makes acetate_int, which
 *   can leave ONLY via acetate_secretion into the CLOSED shared pool. So S1
 *   cannot generate ATP (cannot grow) unless the pool acetate is consumed by
 *   S2. => S1 alone: mu = 0.
 *
 * S2 (Consumer) — grows ONLY on acetate fed from the shared pool:
 *   acetate_uptake:     {acetate: -1, acetate_c: 1}, [0, 100] -> CONSUME-ONLY (lb=0)
 *   acetate_metabolism: {acetate_c: -1, atp: 3},     [0, 100]
 *   atp_sink_S2:        {atp: -1},                   [0, 100]
 *   biomass_S2:         {atp: -1},                   [0, 100]
 *
 *   acetate_uptake is IRREVERSIBLE (lb=0): S2 can only draw acetate FROM the
 *   pool, never manufacture it by running the exchange in reverse. With no
 *   producer, the pool has no acetate. => S2 alone: mu = 0.
 *
 * Community (shared 'acetate' pool): the closed pool forces
 *   acetate_secretion (S1) == acetate_uptake (S2), and balanced growth gives
 *   community mu = 10 with BOTH species growing (v_bio_S1 = 55/7 ~= 7.857,
 *   v_bio_S2 = 15/7 ~= 2.143, and v_bio_S1 + v_bio_S2 = mu because sum(X)=1).
 */
function crossFeedingModel(): SteadyComSpecies[] {
  return [
    {
      id: 'S1',
      name: 'Producer',
      reactions: [
        { id: 'glucose_uptake', stoichiometry: { glucose: -1 }, lowerBound: -10, upperBound: 0 },
        { id: 'glycolysis', stoichiometry: { glucose: -1, atp: 2, acetate_int: 2 }, lowerBound: 0, upperBound: 100 },
        { id: 'acetate_secretion', stoichiometry: { acetate_int: -1, acetate: 1 }, lowerBound: 0, upperBound: 100 },
        { id: 'atp_sink', stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: 100 },
        { id: 'biomass_S1', stoichiometry: { atp: -1, glucose: -0.5 }, lowerBound: 0, upperBound: 100 },
      ],
      metabolites: ['glucose', 'atp', 'acetate_int'],
      biomassReaction: 'biomass_S1',
    },
    {
      id: 'S2',
      name: 'Consumer',
      reactions: [
        { id: 'acetate_uptake', stoichiometry: { acetate: -1, acetate_c: 1 }, lowerBound: 0, upperBound: 100 },
        { id: 'acetate_metabolism', stoichiometry: { acetate_c: -1, atp: 3 }, lowerBound: 0, upperBound: 100 },
        { id: 'atp_sink_S2', stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: 100 },
        { id: 'biomass_S2', stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: 100 },
      ],
      metabolites: ['acetate', 'acetate_c', 'atp'],
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
 * SteadyCom maximizes the community growth rate mu (abundances are free, so an
 * uncompetitive species may drop to X=0). With no cross-feeding to couple them,
 * the max-mu solution concentrates abundance on the faster grower: mu = 5
 * (species B goes extinct, X_B = 0). This is NOT min(5, 3) — that would only
 * hold if coexistence were forced.
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

    // Neither species can grow alone: this is OBLIGATE cross-feeding, so any
    // positive community growth is proof that S1 fed S2 through the shared pool.
    const s1Solo = await steadyCom([species[0]], ['acetate']);
    const s2Solo = await steadyCom([species[1]], ['acetate']);
    expect(s1Solo.communityGrowthRate).toBeCloseTo(0, 4);
    expect(s2Solo.communityGrowthRate).toBeCloseTo(0, 4);

    const result = await steadyCom(species, ['acetate']);

    expect(result.status).toBe('optimal');

    // Cross-feeding-capped community rate: mu ~= 10 (the coupled optimum), NOT a
    // degenerate solo value. It is strictly positive only because cross-feeding
    // occurred (both solo communities above are 0).
    expect(result.communityGrowthRate).toBeCloseTo(10, 2);

    // BOTH species grow -- the producer is NOT zeroed and the consumer is NOT zeroed.
    // (The old degenerate solution zeroed the producer; these assertions FAIL on it.)
    const g1 = result.speciesGrowthRates['S1'];
    const g2 = result.speciesGrowthRates['S2'];
    expect(g1).toBeGreaterThan(1e-3);
    expect(g2).toBeGreaterThan(1e-3);
    expect(g1).toBeCloseTo(55 / 7, 2); // v_bio_S1 = mu * X_S1
    expect(g2).toBeCloseTo(15 / 7, 2); // v_bio_S2 = mu * X_S2

    // Balanced growth at a single community rate mu with sum(X_i) = 1:
    //   v_bio_i = mu * X_i  =>  sum_i v_bio_i = mu * sum_i X_i = mu.
    expect(g1 + g2).toBeCloseTo(result.communityGrowthRate, 3);

    // Shared-pool conservation: S1's acetate secretion == S2's acetate uptake > 0.
    const secretion = result.speciesFluxes['S1']['acetate_secretion'];
    const uptake = result.speciesFluxes['S2']['acetate_uptake'];
    expect(secretion).toBeGreaterThan(1e-3);
    expect(secretion).toBeCloseTo(uptake, 3);

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
    // Both species carry real flux at the coupled optimum (obligate cross-feeding):
    // the producer draws glucose and the consumer draws acetate from the shared pool.
    expect(Math.abs(result.speciesFluxes['S1']['glucose_uptake'])).toBeGreaterThan(1e-3);
    expect(Math.abs(result.speciesFluxes['S2']['acetate_uptake'])).toBeGreaterThan(1e-3);
    // Both biomass reactions carry flux -- neither species is zeroed out.
    expect(result.speciesFluxes['S1']['biomass_S1']).toBeGreaterThan(1e-3);
    expect(result.speciesFluxes['S2']['biomass_S2']).toBeGreaterThan(1e-3);
    // Shared-pool conservation: producer secretion == consumer uptake > 0.
    expect(result.speciesFluxes['S1']['acetate_secretion']).toBeGreaterThan(1e-3);
    expect(result.speciesFluxes['S1']['acetate_secretion']).toBeCloseTo(
      result.speciesFluxes['S2']['acetate_uptake'],
      3,
    );
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
    // The consumer itself actually grows in the community (cross-feeding occurred),
    // not merely the producer -- self-documents syntrophy without re-deriving LP algebra.
    expect(comm.speciesGrowthRates['C']).toBeGreaterThan(0);
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
