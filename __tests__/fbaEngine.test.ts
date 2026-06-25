import {
  solveAuthorityFBA,
  buildAuthorityFBAModel,
  solveAuthorityCommunityFBA,
  type SingleSpeciesFBARequest,
  type CommunityFBARequest,
} from '../src/server/fbaEngine';

/**
 * Tests for the HiGHS-backed FBA engine (src/server/fbaEngine.ts).
 *
 * The E. coli toy network enforces these mass-balance constraints:
 *   GLCpts = PGI = PFK = FBA
 *   GAPD = 2 * FBA
 *   PYK = GAPD
 *   PDH = PYK
 *   O2tx = PDH
 *   BIOMASS + PRODUCT = PDH
 *
 * With glucose uptake = 10, oxygen uptake = 20:
 *   GLCpts = 10, PDH = 20, BIOMASS + PRODUCT = 20
 *
 * The yeast toy network enforces:
 *   HXT = HXK = PGI_y = PFK_y = TPI = PDC
 *   PDC = ADH + ACS
 *   ACS = O2tx_y = IDH
 *   IDH = BIOMASS_y + PRODUCT_y
 */

// ── Standard request fixtures ────────────────────────────────────────────────

const ECOLI_AEROBIC_BIOMASS: SingleSpeciesFBARequest = {
  species: 'ecoli',
  objective: 'biomass',
  glucoseUptake: 10,
  oxygenUptake: 20,
};

const YEAST_AEROBIC_BIOMASS: SingleSpeciesFBARequest = {
  species: 'yeast',
  objective: 'biomass',
  glucoseUptake: 10,
  oxygenUptake: 20,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Determinism — same input must produce byte-identical output
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — Determinism', () => {
  test('same E. coli request produces identical output on repeated runs', async () => {
    const first = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    const second = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    expect(second).toEqual(first);
  });

  test('same yeast request produces identical output on repeated runs', async () => {
    const first = await solveAuthorityFBA(YEAST_AEROBIC_BIOMASS);
    const second = await solveAuthorityFBA(YEAST_AEROBIC_BIOMASS);
    expect(second).toEqual(first);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Known-solution validation — E. coli aerobic glucose minimal media
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — Known-Solution Validation (E. coli)', () => {
  test('E. coli aerobic biomass is feasible with positive growth rate', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    expect(result.feasible).toBe(true);
    expect(result.growthRate).toBeGreaterThan(0);
  });

  test('E. coli growth rate is consistent across runs', async () => {
    const results = await Promise.all([
      solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS),
      solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS),
      solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS),
    ]);
    const rates = results.map(r => r.growthRate);
    // All three must be identical
    expect(rates[0]).toBe(rates[1]);
    expect(rates[1]).toBe(rates[2]);
  });

  test('E. coli LP objective value is in a positive finite range for standard conditions', async () => {
    // NOTE: growthRate = LP objective value (biomass flux, normalized biomass reaction)
    // The LP objective already represents h⁻¹ when the biomass reaction is properly normalized.
    // We only verify it is positive and within a reasonable upper bound.
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    expect(result.feasible).toBe(true);
    expect(result.growthRate).toBeGreaterThan(0);
    expect(result.growthRate).toBeLessThanOrEqual(50);
  });

  test('E. coli growth rate scales monotonically with glucose uptake (parameter sensitivity)', async () => {
    // 独立验证：glucoseUptake 增大 → growthRate 不应减小（生物学单调性）
    const low = await solveAuthorityFBA({ ...ECOLI_AEROBIC_BIOMASS, glucoseUptake: 5 });
    const high = await solveAuthorityFBA({ ...ECOLI_AEROBIC_BIOMASS, glucoseUptake: 15 });
    expect(high.growthRate).toBeGreaterThanOrEqual(low.growthRate);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Invariant checks — mass conservation, non-negativity, objective maximality
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — Invariant Checks', () => {
  test('E. coli fluxes satisfy mass-balance (S·v = 0) constraints', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    const v = result.fluxes;

    // g6p_balance: GLCpts - PGI = 0
    expect(v.GLCpts).toBeCloseTo(v.PGI, 4);
    // f6p_balance: PGI - PFK = 0
    expect(v.PGI).toBeCloseTo(v.PFK, 4);
    // fbp_balance: PFK - FBA = 0
    expect(v.PFK).toBeCloseTo(v.FBA, 4);
    // gap_balance: 2*FBA - GAPD = 0
    expect(2 * v.FBA).toBeCloseTo(v.GAPD, 4);
    // pep_balance: GAPD - PYK = 0
    expect(v.GAPD).toBeCloseTo(v.PYK, 4);
    // pyr_balance: PYK - PDH = 0
    expect(v.PYK).toBeCloseTo(v.PDH, 4);
    // accoa_balance: PDH - BIOMASS - PRODUCT = 0
    expect(v.PDH).toBeCloseTo(v.BIOMASS + v.PRODUCT, 4);
    // oxygen_balance: O2tx - PDH = 0
    expect(v.O2tx).toBeCloseTo(v.PDH, 4);
  });

  test('all E. coli irreversible fluxes are non-negative', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    // All reactions in the E. coli network have lb = 0 (irreversible)
    const irreversibleReactions = [
      'GLCpts', 'PGI', 'PFK', 'FBA', 'GAPD', 'PYK', 'PDH', 'O2tx', 'BIOMASS', 'PRODUCT',
    ];
    for (const rxn of irreversibleReactions) {
      expect(result.fluxes[rxn]).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  test('BIOMASS flux is maximized under biomass objective', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    // With biomass objective and no knockouts, BIOMASS should be at its maximum
    // Given the constraints, BIOMASS = PDH = 2*GLCpts = 20 (PRODUCT = 0)
    expect(result.fluxes.BIOMASS).toBeCloseTo(20, 1);
    expect(result.fluxes.PRODUCT).toBeCloseTo(0, 1);
  });

  test('E. coli carbon efficiency is within valid range [0, 100]', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    expect(result.carbonEfficiency).toBeGreaterThanOrEqual(0);
    expect(result.carbonEfficiency).toBeLessThanOrEqual(100);
  });

  test('E. coli sensitivity coefficients are present', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    expect(result.sensitivityCoefficients).toBeDefined();
    expect(typeof result.sensitivityCoefficients.glc).toBe('number');
    expect(typeof result.sensitivityCoefficients.o2).toBe('number');
    expect(typeof result.sensitivityCoefficients.atp).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Knockout test — PFK is essential for glycolysis
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — Knockout Tests', () => {
  test('PFK knockout makes E. coli infeasible or zero growth', async () => {
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      knockouts: ['PFK'],
    });

    if (result.feasible) {
      // If the model is still feasible, growth should be zero
      // because PFK=0 forces all downstream fluxes to zero
      expect(result.growthRate).toBeCloseTo(0, 4);
    }
    // Either way, PFK flux must be zero
    expect(result.fluxes.PFK).toBeCloseTo(0, 4);
  });

  test('PFK knockout reduces growth rate compared to wild-type', async () => {
    const wildtype = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    const knockout = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      knockouts: ['PFK'],
    });

    // Knockout growth must be less than or equal to wild-type
    expect(knockout.growthRate).toBeLessThanOrEqual(wildtype.growthRate);
  });

  test('GLCpts knockout (glucose transport) eliminates all flux', async () => {
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      knockouts: ['GLCpts'],
    });

    // Without glucose input, no flux can flow
    expect(result.fluxes.GLCpts).toBeCloseTo(0, 4);
    expect(result.growthRate).toBeCloseTo(0, 4);
  });

  test('non-essential reaction knockout (PRODUCT) preserves growth', async () => {
    const wildtype = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    const knockout = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      knockouts: ['PRODUCT'],
    });

    // PRODUCT is not essential for growth under biomass objective
    expect(knockout.feasible).toBe(true);
    expect(knockout.growthRate).toBeCloseTo(wildtype.growthRate, 2);
    expect(knockout.fluxes.PRODUCT).toBeCloseTo(0, 4);
  });

  test('yeast PFK_y knockout makes model infeasible or zero growth', async () => {
    const result = await solveAuthorityFBA({
      ...YEAST_AEROBIC_BIOMASS,
      knockouts: ['PFK_y'],
    });

    if (result.feasible) {
      expect(result.growthRate).toBeCloseTo(0, 4);
    }
    expect(result.fluxes.PFK_y).toBeCloseTo(0, 4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Species test — both E. coli and yeast produce feasible solutions
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — Species Tests', () => {
  test('E. coli produces a feasible solution', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    expect(result.feasible).toBe(true);
    expect(result.growthRate).toBeGreaterThan(0);
    // E. coli network should have GLCpts flux
    expect(result.fluxes.GLCpts).toBeGreaterThan(0);
  });

  test('yeast produces a feasible solution', async () => {
    const result = await solveAuthorityFBA(YEAST_AEROBIC_BIOMASS);
    expect(result.feasible).toBe(true);
    expect(result.growthRate).toBeGreaterThan(0);
    // Yeast network should have HXT flux
    expect(result.fluxes.HXT).toBeGreaterThan(0);
  });

  test('yeast fluxes satisfy mass-balance constraints', async () => {
    const result = await solveAuthorityFBA(YEAST_AEROBIC_BIOMASS);
    const v = result.fluxes;

    // glc_balance: HXT - HXK = 0
    expect(v.HXT).toBeCloseTo(v.HXK, 4);
    // g6p_balance: HXK - PGI_y = 0
    expect(v.HXK).toBeCloseTo(v.PGI_y, 4);
    // f6p_balance: PGI_y - PFK_y = 0
    expect(v.PGI_y).toBeCloseTo(v.PFK_y, 4);
    // fbp_balance: PFK_y - TPI = 0
    expect(v.PFK_y).toBeCloseTo(v.TPI, 4);
    // fermentation_branch: TPI - PDC = 0
    expect(v.TPI).toBeCloseTo(v.PDC, 4);
    // ethanol_branch: PDC - ADH - ACS = 0
    expect(v.PDC).toBeCloseTo(v.ADH + v.ACS, 4);
    // oxygen_balance: O2tx_y - ACS = 0
    expect(v.O2tx_y).toBeCloseTo(v.ACS, 4);
    // accoa_balance: ACS - IDH = 0
    expect(v.ACS).toBeCloseTo(v.IDH, 4);
    // growth_balance: IDH - BIOMASS_y - PRODUCT_y = 0
    expect(v.IDH).toBeCloseTo(v.BIOMASS_y + v.PRODUCT_y, 4);
  });

  test('yeast growth rate matches hand-calculated value', async () => {
    // HXT = HXK = PGI_y = PFK_y = TPI = PDC = 10
    // ACS = O2tx_y; max ACS limited by PDC = ADH + ACS and ADH >= 0
    // For biomass objective: maximize BIOMASS_y + 0.08*PRODUCT_y
    // IDH = BIOMASS_y + PRODUCT_y = ACS = O2tx_y
    // Max O2tx_y = 10 (limited by TPI = PDC = HXT = 10)
    // BIOMASS_y = 10, PRODUCT_y = 0
    // growthRate = BIOMASS_y = 10 (LP objective already in h⁻¹)
    const result = await solveAuthorityFBA(YEAST_AEROBIC_BIOMASS);
    expect(result.growthRate).toBeCloseTo(10, 1);
  });

  test('E. coli and yeast have distinct reaction IDs', async () => {
    const ecoli = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    const yeast = await solveAuthorityFBA(YEAST_AEROBIC_BIOMASS);

    // E. coli uses GLCpts, yeast uses HXT
    expect(ecoli.fluxes.GLCpts).toBeDefined();
    expect(ecoli.fluxes.HXT).toBeUndefined();
    expect(yeast.fluxes.HXT).toBeDefined();
    expect(yeast.fluxes.GLCpts).toBeUndefined();

    // E. coli uses BIOMASS, yeast uses BIOMASS_y
    expect(ecoli.fluxes.BIOMASS).toBeDefined();
    expect(ecoli.fluxes.BIOMASS_y).toBeUndefined();
    expect(yeast.fluxes.BIOMASS_y).toBeDefined();
    expect(yeast.fluxes.BIOMASS).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Objective test — biomass, atp, and product objectives
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — Objective Tests', () => {
  test('biomass objective maximizes BIOMASS flux', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    // Under biomass objective, BIOMASS should be maximized (PRODUCT ≈ 0)
    expect(result.fluxes.BIOMASS).toBeGreaterThan(result.fluxes.PRODUCT);
  });

  test('product objective maximizes PRODUCT flux', async () => {
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      objective: 'product',
    });
    // Under product objective, PRODUCT should be maximized (BIOMASS ≈ 0)
    // With constraints: BIOMASS + PRODUCT = 20
    // Product obj: max PRODUCT + 0.05*BIOMASS = PRODUCT + 0.05*(20-PRODUCT) = 0.95*PRODUCT + 1
    // → PRODUCT = 20, BIOMASS = 0
    expect(result.fluxes.PRODUCT).toBeGreaterThan(result.fluxes.BIOMASS);
    expect(result.fluxes.PRODUCT).toBeCloseTo(20, 1);
  });

  test('atp objective produces feasible solution', async () => {
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      objective: 'atp',
    });
    expect(result.feasible).toBe(true);
    // ATP objective: max GAPD + PYK + 1.2*PDH + 0.15*BIOMASS
    // All these are functions of GLCpts, maximized when GLCpts = 10
    // With GLCpts=10: GAPD=20, PYK=20, PDH=20
    expect(result.fluxes.GAPD).toBeCloseTo(20, 1);
    expect(result.fluxes.PYK).toBeCloseTo(20, 1);
    expect(result.fluxes.PDH).toBeCloseTo(20, 1);
  });

  test('product objective yields zero growth rate', async () => {
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      objective: 'product',
    });
    // growthRate = BIOMASS, and BIOMASS ≈ 0 under product objective
    expect(result.growthRate).toBeCloseTo(0, 2);
  });

  test('biomass objective yields higher growth rate than product objective', async () => {
    const biomass = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    const product = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      objective: 'product',
    });
    expect(biomass.growthRate).toBeGreaterThan(product.growthRate);
  });

  test('each objective maximizes its own flux for yeast', async () => {
    const biomassYeast = await solveAuthorityFBA(YEAST_AEROBIC_BIOMASS);
    const productYeast = await solveAuthorityFBA({
      ...YEAST_AEROBIC_BIOMASS,
      objective: 'product',
    });

    // Under biomass objective, BIOMASS_y > PRODUCT_y
    expect(biomassYeast.fluxes.BIOMASS_y).toBeGreaterThan(
      biomassYeast.fluxes.PRODUCT_y,
    );

    // Under product objective, PRODUCT_y > BIOMASS_y
    expect(productYeast.fluxes.PRODUCT_y).toBeGreaterThan(
      productYeast.fluxes.BIOMASS_y,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. buildAuthorityFBAModel — model construction without solving
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — buildAuthorityFBAModel', () => {
  test('builds a valid LP model for E. coli', () => {
    const model = buildAuthorityFBAModel(ECOLI_AEROBIC_BIOMASS);
    expect(model.name).toBe('fba_ecoli');
    expect(model.sense).toBe('maximize');
    expect(model.objective.length).toBeGreaterThan(0);
    expect(model.constraints.length).toBeGreaterThan(0);
    expect(model.bounds).toBeDefined();
    expect(model.bounds!.length).toBe(10); // 10 reactions
  });

  test('builds a valid LP model for yeast', () => {
    const model = buildAuthorityFBAModel(YEAST_AEROBIC_BIOMASS);
    expect(model.name).toBe('fba_yeast');
    expect(model.bounds!.length).toBe(12); // 12 reactions
  });

  test('knockout sets reaction upper bound to zero', () => {
    const model = buildAuthorityFBAModel({
      ...ECOLI_AEROBIC_BIOMASS,
      knockouts: ['PFK'],
    });
    const pfkBound = model.bounds!.find(b => b.name === 'PFK');
    expect(pfkBound).toBeDefined();
    expect(pfkBound!.ub).toBe(0);
  });

  test('glucose uptake clamp is reflected in bounds', () => {
    const model = buildAuthorityFBAModel({
      ...ECOLI_AEROBIC_BIOMASS,
      glucoseUptake: 50, // exceeds clamp limit of 25
    });
    const glcBound = model.bounds!.find(b => b.name === 'GLCpts');
    expect(glcBound).toBeDefined();
    expect(glcBound!.ub).toBe(25); // clamped to 25
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Community FBA — two-species wrapper
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — Community FBA', () => {
  test('community FBA returns feasible when both species are feasible', async () => {
    const result = await solveAuthorityCommunityFBA({
      objective: 'biomass',
      ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
      yeast: { glucoseUptake: 10, oxygenUptake: 20 },
    });
    expect(result.feasible).toBe(true);
    expect(result.ecoli.feasible).toBe(true);
    expect(result.yeast.feasible).toBe(true);
  });

  test('community growth rate is a weighted blend of individual rates', async () => {
    const result = await solveAuthorityCommunityFBA({
      objective: 'biomass',
      alpha: 0.5,
      ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
      yeast: { glucoseUptake: 10, oxygenUptake: 20 },
    });
    // communityGrowthRate should be between the two individual growth rates
    const minRate = Math.min(result.ecoli.growthRate, result.yeast.growthRate);
    const maxRate = Math.max(result.ecoli.growthRate, result.yeast.growthRate);
    expect(result.communityGrowthRate).toBeGreaterThanOrEqual(minRate - 0.01);
    expect(result.communityGrowthRate).toBeLessThanOrEqual(maxRate + 0.01);
  });

  test('community FBA produces exchange fluxes', async () => {
    const result = await solveAuthorityCommunityFBA({
      objective: 'biomass',
      ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
      yeast: { glucoseUptake: 10, oxygenUptake: 20 },
    });
    expect(result.exchangeFluxes.length).toBeGreaterThan(0);
    // Each exchange flux should have required fields
    for (const ef of result.exchangeFluxes) {
      expect(ef.id).toBeDefined();
      expect(ef.metabolite).toBeDefined();
      expect(ef.fromStrain).toBeDefined();
      expect(ef.toStrain).toBeDefined();
      expect(typeof ef.flux).toBe('number');
    }
  });

  test('alpha=0 weights entirely toward E. coli', async () => {
    const result = await solveAuthorityCommunityFBA({
      objective: 'biomass',
      alpha: 0,
      ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
      yeast: { glucoseUptake: 10, oxygenUptake: 20 },
    });
    // With alpha=0, community growth ≈ adjustedEcoliGrowth
    // (allowing small delta from exchange flux feeding bonus)
    expect(result.communityGrowthRate).toBeCloseTo(result.ecoli.growthRate, 1);
  });

  test('alpha=1 weights entirely toward yeast', async () => {
    const result = await solveAuthorityCommunityFBA({
      objective: 'biomass',
      alpha: 1,
      ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
      yeast: { glucoseUptake: 10, oxygenUptake: 20 },
    });
    // With alpha=1, community growth ≈ adjustedYeastGrowth
    expect(result.communityGrowthRate).toBeCloseTo(result.yeast.growthRate, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Edge cases — uptake clamping and zero inputs
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — Edge Cases', () => {
  test('uptake values are clamped to [0, 25]', async () => {
    // Request with absurdly high uptake — should be clamped to 25
    const result = await solveAuthorityFBA({
      species: 'ecoli',
      objective: 'biomass',
      glucoseUptake: 100,
      oxygenUptake: 100,
    });
    // GLCpts should not exceed 25 (the clamp limit)
    expect(result.fluxes.GLCpts).toBeLessThanOrEqual(25 + 1e-4);
    expect(result.fluxes.O2tx).toBeLessThanOrEqual(25 + 1e-4);
  });

  test('zero glucose uptake yields zero growth', async () => {
    const result = await solveAuthorityFBA({
      species: 'ecoli',
      objective: 'biomass',
      glucoseUptake: 0,
      oxygenUptake: 20,
    });
    expect(result.fluxes.GLCpts).toBeCloseTo(0, 4);
    expect(result.growthRate).toBeCloseTo(0, 4);
  });

  test('zero oxygen uptake with E. coli limits PDH', async () => {
    const result = await solveAuthorityFBA({
      species: 'ecoli',
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 0,
    });
    // O2tx = PDH = 0, so BIOMASS + PRODUCT = 0
    expect(result.fluxes.O2tx).toBeCloseTo(0, 4);
    expect(result.fluxes.PDH).toBeCloseTo(0, 4);
    expect(result.growthRate).toBeCloseTo(0, 4);
  });

  test('duplicate knockouts are deduplicated', async () => {
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      knockouts: ['PFK', 'PFK', 'PFK'],
    });
    expect(result.fluxes.PFK).toBeCloseTo(0, 4);
  });
});
