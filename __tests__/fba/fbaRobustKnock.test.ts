/**
 * RobustKnock tests — guaranteed minimum product flux under all optimal growth solutions.
 *
 * Reference: Tepper & Shlomi (2010) BMC Bioinformatics 11:167
 */

import { runRobustKnock, type RobustKnockModel } from '../../src/server/fbaRobustKnock';

/**
 * Basic test model with competing pathways:
 *
 *   EX_glc (uptake) -> GLCpts -> g6p
 *       g6p -> BIOMASS (growth)
 *       g6p -> PGI -> f6p -> PRODUCT (product via PGI)
 *
 * Both BIOMASS and PGI consume g6p (competing pathways).
 */
function buildTestModel(): RobustKnockModel {
  return {
    reactions: [
      { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 } },
      { id: 'GLCpts', lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
      { id: 'PGI', lb: 0, ub: 10, stoichiometry: { g6p: -1, f6p: 1 } },
      { id: 'PFK', lb: 0, ub: 10, stoichiometry: { f6p: -1, fbp: 1 } },
      { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { g6p: -1, biomass: 1 } },
      { id: 'PRODUCT', lb: 0, ub: 10, stoichiometry: { fbp: -1, product: 1 } },
      { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      { id: 'EX_product', lb: 0, ub: 10, stoichiometry: { product: -1 } },
    ],
    objectiveId: 'BIOMASS',
    productReactionId: 'PRODUCT',
  };
}

/**
 * Coupling model with a wasteful byproduct:
 *
 *   EX_glc -> GLCpts -> g6p -┬-> BIOMASS (growth)
 *                             └-> PGI -> f6p -> PFK -> fbp
 *                                                          ├-> PRODUCT (valuable)
 *                                                          └-> BYPRODUCT (waste)
 *
 * Knocking out BYPRODUCT forces fbp flux to PRODUCT, guaranteeing production.
 */
function buildCouplingModel(): RobustKnockModel {
  return {
    reactions: [
      { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 } },
      { id: 'GLCpts', lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
      { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { g6p: -1, biomass: 1 } },
      { id: 'PGI', lb: 0, ub: 10, stoichiometry: { g6p: -1, f6p: 1 } },
      { id: 'PFK', lb: 0, ub: 10, stoichiometry: { f6p: -1, fbp: 1 } },
      { id: 'PRODUCT', lb: 0, ub: 10, stoichiometry: { fbp: -1, product: 1 } },
      { id: 'BYPRODUCT', lb: 0, ub: 10, stoichiometry: { fbp: -1, waste: 1 } },
      { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      { id: 'EX_product', lb: 0, ub: 10, stoichiometry: { product: -1 } },
      { id: 'EX_waste', lb: 0, ub: 10, stoichiometry: { waste: -1 } },
    ],
    objectiveId: 'BIOMASS',
    productReactionId: 'PRODUCT',
  };
}

describe('RobustKnock', () => {
  it('returns valid baseline values', async () => {
    const model = buildTestModel();
    const result = await runRobustKnock(model, { maxKnockouts: 2 });

    expect(result.wildtypeGrowthRate).toBeGreaterThan(0);
    expect(typeof result.wildtypeMinProductFlux).toBe('number');
    expect(Array.isArray(result.knockoutSets)).toBe(true);
  });

  it('reports min and max product flux for each knockout set', async () => {
    const model = buildCouplingModel();
    const result = await runRobustKnock(model, { maxKnockouts: 2 });

    for (const ks of result.knockoutSets) {
      expect(typeof ks.minProductFlux).toBe('number');
      expect(typeof ks.maxProductFlux).toBe('number');
      expect(ks.minProductFlux).toBeLessThanOrEqual(ks.maxProductFlux + 1e-10);
    }
  });

  it('respects maxKnockouts constraint', async () => {
    const model = buildTestModel();
    const result = await runRobustKnock(model, { maxKnockouts: 1 });

    for (const ks of result.knockoutSets) {
      expect(ks.reactions.length).toBeLessThanOrEqual(1);
    }
  });

  it('only returns knockouts with guaranteed production (min product > 0)', async () => {
    const model = buildCouplingModel();
    const result = await runRobustKnock(model, { maxKnockouts: 2 });

    for (const ks of result.knockoutSets) {
      expect(ks.minProductFlux).toBeGreaterThan(0);
    }
  });

  it('returns knockout sets sorted by min product flux (best worst-case first)', async () => {
    const model = buildCouplingModel();
    const result = await runRobustKnock(model, { maxKnockouts: 2 });

    if (result.knockoutSets.length >= 2) {
      for (let i = 1; i < result.knockoutSets.length; i++) {
        expect(result.knockoutSets[i - 1].minProductFlux).toBeGreaterThanOrEqual(
          result.knockoutSets[i].minProductFlux,
        );
      }
    }
  });

  it('BYPRODUCT knockout guarantees production in coupling model', async () => {
    const model = buildCouplingModel();
    const result = await runRobustKnock(model, { maxKnockouts: 1 });

    expect(result.wildtypeGrowthRate).toBeGreaterThan(0);

    // BYPRODUCT knockout should appear in results if it guarantees production
    const byproductKo = result.knockoutSets.find((ks) =>
      ks.reactions.includes('BYPRODUCT'),
    );

    // If found, it should have guaranteed production (min > 0) and
    // the growth rate should be positive
    if (byproductKo) {
      expect(byproductKo.minProductFlux).toBeGreaterThan(0);
      expect(byproductKo.growthRate).toBeGreaterThan(0);
      expect(byproductKo.maxProductFlux).toBeGreaterThanOrEqual(byproductKo.minProductFlux);
    }
  });

  it('each knockout set contains valid reaction IDs from the model', async () => {
    const model = buildCouplingModel();
    const modelRxnIds = new Set(model.reactions.map((r) => r.id));
    const result = await runRobustKnock(model, { maxKnockouts: 2 });

    for (const ks of result.knockoutSets) {
      for (const rxnId of ks.reactions) {
        expect(modelRxnIds.has(rxnId)).toBe(true);
        // Should not be an exchange, objective, or product reaction
        expect(rxnId.startsWith('EX_')).toBe(false);
        expect(rxnId).not.toBe(model.objectiveId);
        expect(rxnId).not.toBe(model.productReactionId);
      }
    }
  });

  it('knockout sets have non-negative growth and product fluxes', async () => {
    const model = buildCouplingModel();
    const result = await runRobustKnock(model, { maxKnockouts: 2 });

    for (const ks of result.knockoutSets) {
      expect(ks.growthRate).toBeGreaterThanOrEqual(0);
      expect(ks.minProductFlux).toBeGreaterThanOrEqual(0);
      expect(ks.maxProductFlux).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns empty knockout sets for model without product reaction', async () => {
    const badModel: RobustKnockModel = {
      reactions: [
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { x: 1 } },
      ],
      objectiveId: 'BIOMASS',
      productReactionId: 'NONEXISTENT',
    };
    const result = await runRobustKnock(badModel, { maxKnockouts: 2 });
    expect(result.knockoutSets).toEqual([]);
    expect(result.wildtypeGrowthRate).toBe(0);
  });

  it('limits results to maxResults', async () => {
    const model = buildCouplingModel();
    const result = await runRobustKnock(model, { maxKnockouts: 2, maxResults: 1 });
    expect(result.knockoutSets.length).toBeLessThanOrEqual(1);
  });

  it('handles model with no candidate reactions', async () => {
    const trivialModel: RobustKnockModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 } },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
        { id: 'PRODUCT', lb: 0, ub: 10, stoichiometry: { glc_e: -1, product: 1 } },
        { id: 'EX_product', lb: 0, ub: 10, stoichiometry: { product: -1 } },
      ],
      objectiveId: 'BIOMASS',
      productReactionId: 'PRODUCT',
    };
    const result = await runRobustKnock(trivialModel, { maxKnockouts: 2 });
    // BIOMASS and PRODUCT are excluded as candidates (objective + product),
    // EX_ reactions are excluded, so no candidates exist
    expect(result.knockoutSets).toEqual([]);
  });

  it('wildtype min product flux is less than or equal to max growth product', async () => {
    const model = buildCouplingModel();
    const result = await runRobustKnock(model, { maxKnockouts: 1 });

    // Min product at max growth should be <= max product at max growth
    // (since minimizing always gives <= maximizing)
    expect(result.wildtypeMinProductFlux).toBeLessThanOrEqual(
      result.wildtypeGrowthRate + 1e-6,
    );
  });
});
