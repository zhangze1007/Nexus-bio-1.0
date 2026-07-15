import {
  solveAuthorityFBA,
  buildAuthorityFBAModel,
  solveAuthorityCommunityFBA,
  type SingleSpeciesFBARequest,
  type CommunityFBARequest,
} from '../src/server/fbaEngine';
import { IJO1366_REACTIONS, IJO1366_METABOLITES } from '../src/data/iJO1366Subset';

// Physical ceiling for E. coli growth on glucose minimal media (real max ≈ 0.87 h⁻¹).
// The single-species E. coli path solves the real e_coli_core model, so growth must
// land in a biological band — NOT the 12–20 h⁻¹ the prior 10-reaction toy produced.
const ECOLI_MAX_GROWTH = 1.5;

/**
 * Tests for the HiGHS-backed FBA engine (src/server/fbaEngine.ts).
 *
 * E. coli single-species FBA solves the REAL e_coli_core stoichiometric model
 * (src/data/iJO1366Subset.ts; COBRApy-verified to ~0.87 h⁻¹). Its invariants are
 * genome-scale mass balance (S·v = 0 over every metabolite) and physical growth,
 * NOT the fixed linear chain of the old 10-reaction toy. The dedicated ground-truth
 * anchor lives in __tests__/fbaGroundTruthEcoli.test.ts.
 *
 * The yeast toy network (no e_coli_core-equivalent bundled offline) still enforces:
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

  test('E. coli LP objective value is in a positive, physical range for standard conditions', async () => {
    // growthRate = BIOMASS reaction flux (h⁻¹) from the real e_coli_core solve.
    // It must be positive and below the biological ceiling — the toy network's
    // 12–20 h⁻¹ would fail this bound.
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    expect(result.feasible).toBe(true);
    expect(result.growthRate).toBeGreaterThan(0);
    expect(result.growthRate).toBeLessThan(ECOLI_MAX_GROWTH);
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
  test('E. coli fluxes satisfy genome-scale mass balance (S·v = 0) for every metabolite', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    const v = result.fluxes;

    // Real invariant: for every metabolite, net production across all reactions is 0.
    // This checks the full e_coli_core stoichiometric matrix, not a fixed toy chain.
    for (const metId of IJO1366_METABOLITES) {
      let net = 0;
      for (const rxn of IJO1366_REACTIONS) {
        const coef = rxn.stoichiometry[metId];
        if (coef !== undefined) net += coef * (v[rxn.id] ?? 0);
      }
      expect(Math.abs(net)).toBeLessThan(1e-3);
    }
  });

  test('all E. coli fluxes respect their model bounds [lb, ub]', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    // The real model has both irreversible (lb=0) and reversible (lb<0) reactions;
    // the invariant is that every flux stays within its declared bounds. Exchange
    // uptake bounds are overridden by the request (glucose/O2), so exempt those.
    for (const rxn of IJO1366_REACTIONS) {
      if (rxn.id === 'EX_glc_e' || rxn.id === 'EX_o2_e') continue;
      const flux = result.fluxes[rxn.id] ?? 0;
      expect(flux).toBeGreaterThanOrEqual(rxn.lb - 1e-4);
      expect(flux).toBeLessThanOrEqual(rxn.ub + 1e-4);
    }
  });

  test('BIOMASS flux is maximized (physical) under biomass objective', async () => {
    const result = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    // With the biomass objective the real e_coli_core solve lands in the physical
    // growth band, and no carbon is diverted to the synthetic PRODUCT drain.
    expect(result.fluxes.BIOMASS).toBeGreaterThan(0.3);
    expect(result.fluxes.BIOMASS).toBeLessThan(ECOLI_MAX_GROWTH);
    expect(result.fluxes.PRODUCT).toBeCloseTo(0, 4);
    expect(result.growthRate).toBeCloseTo(result.fluxes.BIOMASS, 4);
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
  test('PFK knockout zeroes PFK flux but E. coli still grows (PPP bypass)', async () => {
    const wildtype = await solveAuthorityFBA(ECOLI_AEROBIC_BIOMASS);
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      knockouts: ['PFK'],
    });

    // PFK flux must be zero after knockout.
    expect(result.fluxes.PFK).toBeCloseTo(0, 4);
    // In real e_coli_core, ΔPFK is NOT lethal — carbon reroutes through the pentose
    // phosphate pathway to lower glycolysis. Growth is retained (and ≤ wild-type).
    expect(result.feasible).toBe(true);
    expect(result.growthRate).toBeGreaterThan(0);
    expect(result.growthRate).toBeLessThanOrEqual(wildtype.growthRate + 1e-6);
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

  test('product objective maximizes PRODUCT flux (carbon diverted away from biomass)', async () => {
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      objective: 'product',
    });
    // Under the product objective, the synthetic PRODUCT drain carries positive flux
    // and outcompetes biomass for carbon (BIOMASS → ~0).
    expect(result.feasible).toBe(true);
    expect(result.fluxes.PRODUCT).toBeGreaterThan(0);
    expect(result.fluxes.PRODUCT).toBeGreaterThan(result.fluxes.BIOMASS);
  });

  test('atp objective produces a feasible solution maximizing ATP maintenance turnover', async () => {
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      objective: 'atp',
    });
    // The 'atp' objective maximizes ATP maintenance (ATPM) flux — the ATP the network
    // can regenerate. It must be feasible with strongly positive ATPM turnover.
    expect(result.feasible).toBe(true);
    expect(result.fluxes.ATPM).toBeGreaterThan(1);
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
  test('builds the real e_coli_core LP model for E. coli (used by FVA/pFBA)', () => {
    const model = buildAuthorityFBAModel(ECOLI_AEROBIC_BIOMASS);
    expect(model.name).toBe('fba_ecoli_core');
    expect(model.sense).toBe('maximize');
    expect(model.objective.length).toBeGreaterThan(0);
    // One mass-balance row per metabolite, one bound per reaction — the real model,
    // not the 10-reaction toy.
    expect(model.constraints.length).toBe(IJO1366_METABOLITES.length);
    expect(model.bounds).toBeDefined();
    expect(model.bounds!.length).toBe(IJO1366_REACTIONS.length);
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

  test('glucose uptake clamp is reflected in the exchange lower bound', () => {
    const model = buildAuthorityFBAModel({
      ...ECOLI_AEROBIC_BIOMASS,
      glucoseUptake: 50, // exceeds clamp limit of 25
    });
    // In the real model, glucose uptake capacity is the EX_glc_e lower bound
    // (negative = uptake), clamped to -25.
    const glcBound = model.bounds!.find(b => b.name === 'EX_glc_e');
    expect(glcBound).toBeDefined();
    expect(glcBound!.lb).toBe(-25); // clamped to 25 mmol/gDW/h uptake
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Community FBA — two-species wrapper
// ═══════════════════════════════════════════════════════════════════════════════

// These tests exercise the REAL SteadyCom joint-LP community engine. Community
// growth, per-species growth, and exchange fluxes are LP decision variables — not
// a post-hoc weighted blend of independent single-species optima. No magic
// constants (1.6/2.4/1.4/2/0.018) may reappear here.
describe('FBA Engine — Community FBA (real SteadyCom)', () => {
  const baseReq = {
    objective: 'biomass' as const,
    ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
    yeast: { glucoseUptake: 10, oxygenUptake: 20 },
  };

  test('community FBA is feasible with positive community growth from the joint LP', async () => {
    const result = await solveAuthorityCommunityFBA(baseReq);
    expect(result.feasible).toBe(true);
    expect(result.ecoli.feasible).toBe(true);
    expect(result.yeast.feasible).toBe(true);
    expect(result.communityGrowthRate).toBeGreaterThan(0);
    expect(result.communityBiomassObjective).toBe(result.communityGrowthRate);
    // Each species grows within the community (biomass flux > 0).
    expect(result.ecoli.growthRate).toBeGreaterThan(0);
    expect(result.yeast.growthRate).toBeGreaterThan(0);
  });

  test('exchange fluxes are REAL bidirectional cross-feeding derived from the solve', async () => {
    const result = await solveAuthorityCommunityFBA(baseReq);
    expect(result.exchangeFluxes.length).toBe(2);
    for (const ef of result.exchangeFluxes) {
      expect(ef.id).toBe(`EX_${ef.metabolite}`);
      expect(Number.isFinite(ef.flux)).toBe(true);
      expect(ef.flux).toBeGreaterThan(0); // genuine mass transfer, not zero
    }
    // Direction is derived from model stoichiometry (producer = +coef).
    const acetate = result.exchangeFluxes.find((e) => e.metabolite === 'acetate_e');
    const ethanol = result.exchangeFluxes.find((e) => e.metabolite === 'ethanol_e');
    expect(acetate).toBeDefined();
    expect(ethanol).toBeDefined();
    // E. coli secretes acetate to yeast; yeast secretes ethanol to E. coli.
    expect(acetate?.fromStrain).toBe('ecoli');
    expect(acetate?.toStrain).toBe('yeast');
    expect(ethanol?.fromStrain).toBe('yeast');
    expect(ethanol?.toStrain).toBe('ecoli');
    // Obligate mutual cross-feeding: both directions carry positive flux.
    expect(acetate?.flux).toBeGreaterThan(0);
    expect(ethanol?.flux).toBeGreaterThan(0);
  });

  test('is deterministic for identical requests', async () => {
    const a = await solveAuthorityCommunityFBA(baseReq);
    const b = await solveAuthorityCommunityFBA(baseReq);
    expect(b.communityGrowthRate).toBe(a.communityGrowthRate);
    expect(b.ecoli.growthRate).toBe(a.ecoli.growthRate);
    expect(b.yeast.growthRate).toBe(a.yeast.growthRate);
    expect(b.exchangeFluxes).toEqual(a.exchangeFluxes);
  });

  test('no alpha => SteadyCom optimizes abundances (not pinned to a default split)', async () => {
    const optimized = await solveAuthorityCommunityFBA(baseReq); // no alpha provided
    const pinnedHalf = await solveAuthorityCommunityFBA({ ...baseReq, alpha: 0.5 });

    expect(optimized.feasible).toBe(true);
    expect(optimized.communityGrowthRate).toBeGreaterThan(0);
    // Optimizing the abundances can only match or beat any fixed composition
    // (the fixed-abundance LP is a restriction of the abundance-optimizing LP).
    expect(optimized.communityGrowthRate).toBeGreaterThanOrEqual(pinnedHalf.communityGrowthRate - 1e-4);
    // The composition is a genuine LP decision variable in (0,1), not forced to 0.5.
    const xYeastOpt = optimized.yeast.growthRate / optimized.communityGrowthRate;
    expect(xYeastOpt).toBeGreaterThan(0);
    expect(xYeastOpt).toBeLessThan(1);
  });

  test('alpha pins the community composition (fixed-abundance constraint)', async () => {
    const alpha = 0.7;
    const result = await solveAuthorityCommunityFBA({ ...baseReq, alpha });
    expect(result.feasible).toBe(true);
    expect(result.communityGrowthRate).toBeGreaterThan(0);
    // SteadyCom balanced growth: v_biomass_i = mu * X_i  =>  X_i = v_biomass_i / mu.
    // With alpha imposed, the recovered abundances must match the requested split.
    const mu = result.communityGrowthRate;
    const xYeast = result.yeast.growthRate / mu;
    const xEcoli = result.ecoli.growthRate / mu;
    expect(xYeast).toBeCloseTo(alpha, 3);
    expect(xEcoli).toBeCloseTo(1 - alpha, 3);
    expect(xYeast + xEcoli).toBeCloseTo(1, 6);
  });

  test('a different alpha yields a different (still-constrained) composition', async () => {
    const r1 = await solveAuthorityCommunityFBA({ ...baseReq, alpha: 0.3 });
    const r2 = await solveAuthorityCommunityFBA({ ...baseReq, alpha: 0.6 });
    const xYeast1 = r1.yeast.growthRate / r1.communityGrowthRate;
    const xYeast2 = r2.yeast.growthRate / r2.communityGrowthRate;
    expect(xYeast1).toBeCloseTo(0.3, 3);
    expect(xYeast2).toBeCloseTo(0.6, 3);
    expect(xYeast2).toBeGreaterThan(xYeast1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Edge cases — uptake clamping and zero inputs
// ═══════════════════════════════════════════════════════════════════════════════

describe('FBA Engine — Edge Cases', () => {
  test('uptake values are clamped to [0, 25]', async () => {
    // Request with absurdly high uptake — should be clamped to 25.
    const result = await solveAuthorityFBA({
      species: 'ecoli',
      objective: 'biomass',
      glucoseUptake: 100,
      oxygenUptake: 100,
    });
    // Glucose uptake (GLCpts flux) and O2 uptake (|EX_o2_e|) cannot exceed 25 —
    // this test verifies the clamp, not the growth magnitude (FBA is linear, so a
    // saturating 25 mmol/gDW/h substrate load legitimately drives growth above the
    // physiological ~0.87 that holds at the standard glucose uptake of 10).
    expect(result.fluxes.GLCpts).toBeLessThanOrEqual(25 + 1e-4);
    expect(result.fluxes.EX_o2_e).toBeGreaterThanOrEqual(-25 - 1e-4);
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

  test('zero oxygen: E. coli still grows by fermentation, but slower than aerobic', async () => {
    const anaerobic = await solveAuthorityFBA({
      species: 'ecoli',
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 0,
    });
    const aerobic = await solveAuthorityFBA({
      species: 'ecoli',
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 20,
    });
    // No O2 is taken up.
    expect(anaerobic.fluxes.EX_o2_e).toBeCloseTo(0, 4);
    // Real e_coli_core grows anaerobically on glucose (mixed-acid fermentation):
    // growth is positive but strictly below the aerobic optimum.
    expect(anaerobic.feasible).toBe(true);
    expect(anaerobic.growthRate).toBeGreaterThan(0);
    expect(anaerobic.growthRate).toBeLessThan(aerobic.growthRate);
  });

  test('duplicate knockouts are deduplicated', async () => {
    const result = await solveAuthorityFBA({
      ...ECOLI_AEROBIC_BIOMASS,
      knockouts: ['PFK', 'PFK', 'PFK'],
    });
    expect(result.fluxes.PFK).toBeCloseTo(0, 4);
  });
});
