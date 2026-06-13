/**
 * Dynamic FBA — time-series simulation tests
 *
 * Reference: Mahadevan et al. (2002) Metab Eng 4(3):225-233
 *
 * Tests a batch-growth model where glucose is consumed and biomass
 * accumulates, verifying substrate depletion and growth kinetics.
 */

import { runDynamicFBA, type DynamicFBAModel } from '../../src/server/fbaDynamic';

describe('Dynamic FBA', () => {
  it('simulates batch growth with substrate depletion', async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: 'GLCpts', lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { g6p: -0.5, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
      initialConcentrations: { glc_e: 10, g6p: 0, biomass: 0.1 },
      maxTime: 10,
      dt: 0.5,
    };
    const result = await runDynamicFBA(model);
    expect(result.feasible).toBe(true);
    expect(result.times.length).toBeGreaterThan(0);
    // Glucose should decrease
    expect(result.concentrations.glc_e[0]).toBeGreaterThan(
      result.concentrations.glc_e[result.concentrations.glc_e.length - 1]
    );
    // Biomass should increase
    expect(result.concentrations.biomass[0]).toBeLessThan(
      result.concentrations.biomass[result.concentrations.biomass.length - 1]
    );
  });

  it('handles substrate exhaustion gracefully', async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
      initialConcentrations: { glc_e: 0.01, biomass: 0.1 }, // very low glucose
      maxTime: 5,
      dt: 0.1,
    };
    const result = await runDynamicFBA(model);
    // Should complete without error
    expect(result.times.length).toBeGreaterThan(0);
  });

  it('records correct number of time points', async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
      initialConcentrations: { glc_e: 10, biomass: 0.1 },
      maxTime: 2,
      dt: 0.5,
    };
    const result = await runDynamicFBA(model);
    // maxTime/dt = 4 steps + initial = 5 time points
    expect(result.times).toEqual([0, 0.5, 1.0, 1.5, 2.0]);
    expect(result.concentrations.glc_e.length).toBe(5);
    expect(result.fluxes.BIOMASS.length).toBe(5);
    expect(result.growthRates.length).toBe(5);
  });

  it('fluxes are zero when substrate is exhausted', async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
      initialConcentrations: { glc_e: 0.001, biomass: 0.1 },
      maxTime: 3,
      dt: 1.0,
    };
    const result = await runDynamicFBA(model);
    // At very low glucose, the effective uptake should be near zero
    // so biomass flux should also be near zero
    const lastBiomassFlux = result.fluxes.BIOMASS[result.fluxes.BIOMASS.length - 1];
    expect(lastBiomassFlux).toBeLessThanOrEqual(0.1);
  });

  it('returns all metabolite concentration arrays', async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: 'GLCpts', lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { g6p: -0.5, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
      initialConcentrations: { glc_e: 10, g6p: 0, biomass: 0.1 },
      maxTime: 2,
      dt: 1.0,
    };
    const result = await runDynamicFBA(model);
    // All three metabolites should have concentration arrays
    expect(result.concentrations.glc_e).toBeDefined();
    expect(result.concentrations.g6p).toBeDefined();
    expect(result.concentrations.biomass).toBeDefined();
    expect(result.concentrations.glc_e.length).toBe(result.times.length);
  });

  it('supports custom K_s half-saturation constant', async () => {
    const baseModel: DynamicFBAModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
      initialConcentrations: { glc_e: 5, biomass: 0.1 },
      maxTime: 2,
      dt: 1.0,
    };
    const resultHighKs = await runDynamicFBA({ ...baseModel, Ks: 2.0 });
    const resultLowKs = await runDynamicFBA({ ...baseModel, Ks: 0.01 });
    expect(resultHighKs.feasible).toBe(true);
    expect(resultLowKs.feasible).toBe(true);
    // With K_s=2 and S=5, effective uptake is 10 * 5/(2+5) ≈ 7.14
    // With K_s=0.01 and S=5, effective uptake ≈ 10 * 5/(0.01+5) ≈ 9.98
    // So high K_s should produce less biomass
    expect(resultHighKs.concentrations.biomass[resultHighKs.concentrations.biomass.length - 1])
      .toBeLessThan(resultLowKs.concentrations.biomass[resultLowKs.concentrations.biomass.length - 1]);
  });

  it('supports Euler integration method', async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
      initialConcentrations: { glc_e: 10, biomass: 0.1 },
      maxTime: 5,
      dt: 0.5,
      method: 'euler',
    };
    const result = await runDynamicFBA(model);
    expect(result.feasible).toBe(true);
    expect(result.concentrations.biomass[0]).toBeLessThan(
      result.concentrations.biomass[result.concentrations.biomass.length - 1]
    );
  });

  it('supports RK4 integration method', async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
      initialConcentrations: { glc_e: 10, biomass: 0.1 },
      maxTime: 5,
      dt: 0.5,
      method: 'rk4',
    };
    const result = await runDynamicFBA(model);
    expect(result.feasible).toBe(true);
    expect(result.concentrations.biomass[0]).toBeLessThan(
      result.concentrations.biomass[result.concentrations.biomass.length - 1]
    );
  });

  it('clamps concentrations to non-negative values', async () => {
    const model: DynamicFBAModel = {
      reactions: [
        { id: 'EX_glc', lb: -100, ub: 0, stoichiometry: { glc_e: -1 }, isExchange: true },
        { id: 'BIOMASS', lb: 0, ub: 100, stoichiometry: { glc_e: -1, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 100, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
      initialConcentrations: { glc_e: 0.05, biomass: 0.1 },
      maxTime: 5,
      dt: 1.0,
    };
    const result = await runDynamicFBA(model);
    // All concentrations should be non-negative
    for (const met of Object.keys(result.concentrations)) {
      for (const c of result.concentrations[met]) {
        expect(c).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
