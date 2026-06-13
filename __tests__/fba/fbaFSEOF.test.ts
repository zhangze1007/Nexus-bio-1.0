/**
 * FSEOF (Flux Scanning Based on Enforced Objective Flux) tests
 *
 * Reference: Choi et al. (2010) BMC Bioinformatics 11:616
 */

import { runFSEOF, type FSEOFModel, type FSEOFOptions } from '../../src/server/fbaFSEOF';

// Model where biomass and product use non-competing pathways:
//   EX_glc (-10) -> GLCpts -> PGI -> PFK -> PRODUCT (via fbp)
//                    GLCpts also -> BIOMASS (via acetyl_coa)
//
// Stoichiometry:
//   EX_glc:  glc_e = 1             (lb = -10)
//   GLCpts:  glc_e = -1, g6p = 1   (lb = 0, ub = 10)
//   PGI:     g6p = -1, f6p = 1     (lb = -10, ub = 10)
//   PFK:     f6p = -1, fbp = 1     (lb = 0, ub = 10)
//   BIOMASS: g6p = -1, biomass = 1 (lb = 0, ub = 10)
//   PRODUCT: fbp = -1, product = 1 (lb = 0, ub = 10)
//   EX_biomass: biomass = -1       (lb = 0, ub = 10)
//   EX_product: product = -1       (lb = 0, ub = 10)

function buildTestModel(): FSEOFModel {
  // Model where biomass and product use non-competing pathways:
  //   EX_glc (uptake) -> GLCpts -> PGI -> PFK -> PRODUCT (via fbp)
  //                       GLCpts also -> BIOMASS (via g6p)
  //
  // Exchange reactions follow iJO1366 convention: coef = -1 for metabolite.
  // Uptake = negative flux (removes metabolite from environment).
  return {
    reactions: [
      { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 } },
      { id: 'GLCpts', lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
      { id: 'PGI', lb: -10, ub: 10, stoichiometry: { g6p: -1, f6p: 1 } },
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

describe('FSEOF', () => {
  const defaultOpts: FSEOFOptions = { numSteps: 5, reductionFactor: 1.0 };

  it('identifies overexpression targets when product flux increases', async () => {
    const model = buildTestModel();
    const result = await runFSEOF(model, defaultOpts);

    expect(result.overexpressionTargets).toBeDefined();
    expect(Array.isArray(result.overexpressionTargets)).toBe(true);
    expect(result.maxGrowthRate).toBeGreaterThan(0);
    expect(result.maxProductFlux).toBeGreaterThanOrEqual(0);

    // PFK should be identified as overexpression target:
    // its flux increases as growth is relaxed and more carbon flows to product
    const pfk = result.overexpressionTargets.find((t) => t.reactionId === 'PFK');
    expect(pfk).toBeDefined();
    expect(pfk!.direction).toBe('up');
    expect(pfk!.monotonicityScore).toBeGreaterThanOrEqual(0.6);
  });

  it('returns valid steps with decreasing growth rate', async () => {
    const model = buildTestModel();
    const result = await runFSEOF(model, defaultOpts);

    expect(result.steps.length).toBeGreaterThan(1);

    for (let i = 1; i < result.steps.length; i++) {
      expect(result.steps[i].growthRate).toBeLessThanOrEqual(
        result.steps[i - 1].growthRate + 1e-10,
      );
    }
  });

  it('handles model with no product reaction gracefully', async () => {
    const badModel: FSEOFModel = {
      reactions: [
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { x: 1 } },
      ],
      objectiveId: 'BIOMASS',
      productReactionId: 'NONEXISTENT',
    };
    const result = await runFSEOF(badModel, { numSteps: 3 });
    expect(result.overexpressionTargets).toEqual([]);
    expect(result.knockoutTargets).toEqual([]);
    expect(result.steps).toEqual([]);
    expect(result.maxGrowthRate).toBe(0);
  });

  it('records fluxes at each step', async () => {
    const model = buildTestModel();
    const result = await runFSEOF(model, defaultOpts);

    for (const step of result.steps) {
      expect(typeof step.step).toBe('number');
      expect(typeof step.growthRate).toBe('number');
      expect(typeof step.productFlux).toBe('number');
      expect(typeof step.fluxes).toBe('object');
      // Each step should have flux values for all reactions in the model
      for (const r of model.reactions) {
        expect(step.fluxes[r.id]).toBeDefined();
      }
    }
  });

  it('excludes exchange and biomass reactions from targets', async () => {
    const model = buildTestModel();
    const result = await runFSEOF(model, defaultOpts);

    for (const target of result.overexpressionTargets) {
      expect(target.reactionId.startsWith('EX_')).toBe(false);
      expect(target.reactionId).not.toBe('BIOMASS');
      expect(target.reactionId).not.toBe('PRODUCT');
    }
    for (const ko of result.knockoutTargets) {
      expect(ko.startsWith('EX_')).toBe(false);
      expect(ko).not.toBe('BIOMASS');
      expect(ko).not.toBe('PRODUCT');
    }
  });

  it('handles infeasible model gracefully', async () => {
    // Model with conflicting constraints: BIOMASS requires biomass metabolite
    // but no reaction produces it
    const infeasibleModel: FSEOFModel = {
      reactions: [
        { id: 'BIOMASS', lb: 1, ub: 10, stoichiometry: { missing_met: -1, biomass: 1 } },
        { id: 'PRODUCT', lb: 0, ub: 10, stoichiometry: { x: 1 } },
        { id: 'EX_product', lb: 0, ub: 10, stoichiometry: { x: -1 } },
      ],
      objectiveId: 'BIOMASS',
      productReactionId: 'PRODUCT',
    };
    const result = await runFSEOF(infeasibleModel, { numSteps: 3 });
    expect(result.overexpressionTargets).toEqual([]);
    expect(result.maxGrowthRate).toBe(0);
  });

  it('respects custom options', async () => {
    const model = buildTestModel();
    const result = await runFSEOF(model, {
      numSteps: 3,
      reductionFactor: 0.8,
      monotonicityThreshold: 0.9,
    });

    // With fewer steps, should have exactly numSteps + 1 entries (step 0 + numSteps)
    // (unless infeasible intermediate steps reduce the count)
    expect(result.steps.length).toBeLessThanOrEqual(4);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('produces increasing product flux as growth constraint tightens', async () => {
    const model = buildTestModel();
    const result = await runFSEOF(model, { numSteps: 5, reductionFactor: 1.0 });

    if (result.steps.length >= 3) {
      // Product flux at the most constrained step should be >= step 0
      const lastProductFlux = result.steps[result.steps.length - 1].productFlux;
      const firstProductFlux = result.steps[0].productFlux;
      expect(lastProductFlux).toBeGreaterThanOrEqual(firstProductFlux - 1e-6);
    }
  });
});
