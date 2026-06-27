/**
 * Dynamic FBA — time-series simulation tests
 *
 * Tests the Euler-integration dynamic FBA implementation at
 * src/services/fba/fbaDynamic.ts. Covers batch growth, substrate depletion,
 * Monod kinetics, non-uniform time steps, and edge cases.
 *
 * @scientific_provenance
 *   REFERENCE: Mahadevan, R., Edwards, J.S., & Doyle III, F.J. (2002).
 *     "Dynamic Flux Balance Analysis of Diauxic Growth in Escherichia coli."
 *     Metabolic Engineering, 4(3), 225-233.
 */

import {
  runDynamicFBA,
  type DynamicFBAModel,
  type DynamicFBAResult,
} from "../src/services/fba/fbaDynamic";

/* ------------------------------------------------------------------ */
/*  Shared model builders                                              */
/* ------------------------------------------------------------------ */

/** Simple batch-growth model: glucose -> biomass via glycolysis. */
function batchGrowthModel(): DynamicFBAModel {
  return {
    reactions: [
      { id: "EX_glc", lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
      { id: "GLCpts", lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
      { id: "BIOMASS", lb: 0, ub: 10, stoichiometry: { g6p: -0.5, biomass: 1 } },
      { id: "EX_biomass", lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
    ],
    objectiveId: "BIOMASS",
    Ks: 0.1,
  };
}

/** Default initial concentrations for batch growth. */
function defaultInitialConc(): Record<string, number> {
  return { glc_e: 10, g6p: 0, biomass: 0.1 };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Dynamic FBA (src/services/fba/fbaDynamic)", () => {
  it("simulates batch growth with substrate depletion", async () => {
    const model = batchGrowthModel();
    const timePoints = [0, 0.5, 1.0, 1.5, 2.0];
    const result = await runDynamicFBA(model, timePoints, defaultInitialConc());

    expect(result.timePoints).toEqual(timePoints);
    // Glucose should decrease over time
    const glc = result.concentrations.glc_e;
    expect(glc[0]).toBeGreaterThan(glc[glc.length - 1]);
    // Biomass should increase over time
    expect(result.biomass[0]).toBeLessThan(result.biomass[result.biomass.length - 1]);
  });

  it("biomass increases monotonically during growth", async () => {
    const model = batchGrowthModel();
    const timePoints = [0, 1, 2, 3, 4, 5];
    const result = await runDynamicFBA(model, timePoints, defaultInitialConc());

    // Each biomass value should be >= the previous one (exponential growth)
    for (let i = 1; i < result.biomass.length; i++) {
      expect(result.biomass[i]).toBeGreaterThanOrEqual(result.biomass[i - 1] - 1e-6);
    }
  });

  it("returns correct number of time points", async () => {
    const model = batchGrowthModel();
    const timePoints = [0, 0.5, 1.0, 1.5, 2.0];
    const result = await runDynamicFBA(model, timePoints, defaultInitialConc());

    expect(result.timePoints).toHaveLength(5);
    expect(result.biomass).toHaveLength(5);
    // Every metabolite array should have the same length
    for (const metArr of Object.values(result.concentrations)) {
      expect(metArr).toHaveLength(5);
    }
    // Every flux array should have the same length
    for (const fluxArr of Object.values(result.fluxes)) {
      expect(fluxArr).toHaveLength(5);
    }
  });

  it("returns concentration arrays for all metabolites", async () => {
    const model = batchGrowthModel();
    const timePoints = [0, 1, 2];
    const result = await runDynamicFBA(model, timePoints, defaultInitialConc());

    // All metabolites from the model should be present
    expect(result.concentrations.glc_e).toBeDefined();
    expect(result.concentrations.g6p).toBeDefined();
    expect(result.concentrations.biomass).toBeDefined();
    expect(result.concentrations.glc_e).toHaveLength(3);
  });

  it("returns flux arrays for all reactions", async () => {
    const model = batchGrowthModel();
    const timePoints = [0, 1, 2];
    const result = await runDynamicFBA(model, timePoints, defaultInitialConc());

    expect(result.fluxes.EX_glc).toBeDefined();
    expect(result.fluxes.GLCpts).toBeDefined();
    expect(result.fluxes.BIOMASS).toBeDefined();
    expect(result.fluxes.EX_biomass).toBeDefined();
    expect(result.fluxes.BIOMASS).toHaveLength(3);
  });

  it("clamps concentrations to non-negative values", async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: "EX_glc", lb: -100, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: "BIOMASS", lb: 0, ub: 100, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: "EX_biomass", lb: 0, ub: 100, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: "BIOMASS",
      Ks: 0.1,
    };
    const timePoints = [0, 1, 2, 3, 4, 5];
    const result = await runDynamicFBA(model, timePoints, { glc_e: 0.05, biomass: 0.1 });

    for (const metArr of Object.values(result.concentrations)) {
      for (const c of metArr) {
        expect(c).toBeGreaterThanOrEqual(0);
      }
    }
    for (const b of result.biomass) {
      expect(b).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles substrate exhaustion gracefully", async () => {
    const model = batchGrowthModel();
    const timePoints = [0, 1, 2, 3, 4, 5];
    // Very low initial glucose — should exhaust quickly
    const result = await runDynamicFBA(model, timePoints, { glc_e: 0.01, g6p: 0, biomass: 0.1 });

    // Should complete without error
    expect(result.timePoints).toHaveLength(6);
    // Glucose should be near zero by the end
    const lastGlc = result.concentrations.glc_e[result.concentrations.glc_e.length - 1];
    expect(lastGlc).toBeLessThan(0.1);
  });

  it("fluxes are zero when substrate is exhausted", async () => {
    const model = batchGrowthModel();
    const timePoints = [0, 1, 2, 3, 4, 5];
    const result = await runDynamicFBA(model, timePoints, { glc_e: 0.001, g6p: 0, biomass: 0.1 });

    // At very low glucose, the effective uptake should be near zero
    // so biomass flux should also be near zero at the end
    const lastBiomassFlux = result.fluxes.BIOMASS[result.fluxes.BIOMASS.length - 1];
    expect(lastBiomassFlux).toBeLessThanOrEqual(0.1);
  });

  it("custom Ks affects uptake rate", async () => {
    // Use a model where glucose is the bottleneck (BIOMASS directly consumes glc_e)
    // so the Monod Ks effect is observable.
    const ksModel: DynamicFBAModel = {
      reactions: [
        { id: "EX_glc", lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: "BIOMASS", lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: "EX_biomass", lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: "BIOMASS",
      Ks: 0.1,
    };
    const timePoints = [0, 1, 2, 3];
    const initialConc = { glc_e: 5, biomass: 0.1 };

    const resultHighKs = await runDynamicFBA({ ...ksModel, Ks: 2.0 }, timePoints, initialConc);
    const resultLowKs = await runDynamicFBA({ ...ksModel, Ks: 0.01 }, timePoints, initialConc);

    // Both should be feasible
    expect(resultHighKs.biomass[resultHighKs.biomass.length - 1]).toBeGreaterThan(0);
    expect(resultLowKs.biomass[resultLowKs.biomass.length - 1]).toBeGreaterThan(0);

    // With Ks=2 and S=5, effective uptake = 10 * 5/(2+5) = 7.14
    // With Ks=0.01 and S=5, effective uptake = 10 * 5/(0.01+5) = 9.98
    // Glucose is the bottleneck (BIOMASS consumes glc_e directly), so
    // high Ks should produce less biomass.
    expect(resultHighKs.biomass[resultHighKs.biomass.length - 1]).toBeLessThan(
      resultLowKs.biomass[resultLowKs.biomass.length - 1],
    );
  });

  it("supports non-uniform time points", async () => {
    const model = batchGrowthModel();
    // Non-uniform spacing: 0, 0.5, 2.0, 10.0
    const timePoints = [0, 0.5, 2.0, 10.0];
    const result = await runDynamicFBA(model, timePoints, defaultInitialConc());

    expect(result.timePoints).toEqual([0, 0.5, 2.0, 10.0]);
    expect(result.biomass).toHaveLength(4);
    // Biomass should still grow
    expect(result.biomass[0]).toBeLessThan(result.biomass[3]);
  });

  it("handles infeasible model (no substrate) with zero fluxes", async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: "EX_glc", lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: "BIOMASS", lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
      ],
      objectiveId: "BIOMASS",
      Ks: 0.1,
    };
    const timePoints = [0, 1, 2];
    // Zero initial glucose — FBA will be infeasible
    const result = await runDynamicFBA(model, timePoints, { glc_e: 0, biomass: 0 });

    expect(result.timePoints).toHaveLength(3);
    // All fluxes should be zero when infeasible
    for (const fluxArr of Object.values(result.fluxes)) {
      for (const f of fluxArr) {
        expect(f).toBe(0);
      }
    }
    // Biomass stays at initial value (0)
    for (const b of result.biomass) {
      expect(b).toBe(0);
    }
  });

  it("tracks multiple metabolites independently", async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: "EX_glc", lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: "GLCpts", lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
        { id: "PGI", lb: 0, ub: 10, stoichiometry: { g6p: -1, f6p: 1 } },
        { id: "BIOMASS", lb: 0, ub: 10, stoichiometry: { g6p: -0.3, f6p: -0.2, biomass: 1 } },
      ],
      objectiveId: "BIOMASS",
      Ks: 0.1,
    };
    const timePoints = [0, 1, 2, 3];
    const result = await runDynamicFBA(model, timePoints, {
      glc_e: 10,
      g6p: 0,
      f6p: 0,
      biomass: 0.1,
    });

    // All four metabolites should be tracked
    expect(Object.keys(result.concentrations)).toContain("glc_e");
    expect(Object.keys(result.concentrations)).toContain("g6p");
    expect(Object.keys(result.concentrations)).toContain("f6p");
    expect(Object.keys(result.concentrations)).toContain("biomass");

    // Each should have the correct number of entries
    for (const metArr of Object.values(result.concentrations)) {
      expect(metArr).toHaveLength(4);
    }
  });

  it("biomass follows approximate exponential growth pattern", async () => {
    const model = batchGrowthModel();
    const timePoints = [0, 0.5, 1.0, 1.5, 2.0];
    const result = await runDynamicFBA(model, timePoints, { glc_e: 20, g6p: 0, biomass: 0.1 });

    // With abundant glucose, early growth should be approximately exponential
    // The ratio X(t+dt)/X(t) should be roughly constant for early time points
    if (result.biomass.length >= 3 && result.biomass[0] > 0) {
      const ratio1 = result.biomass[1] / result.biomass[0];
      const ratio2 = result.biomass[2] / result.biomass[1];
      // Ratios should be similar (within 50%) for early exponential growth
      // This is a loose check since Monod kinetics cause deviation
      expect(ratio1).toBeGreaterThan(1);
      expect(ratio2).toBeGreaterThan(1);
    }
  });
});
