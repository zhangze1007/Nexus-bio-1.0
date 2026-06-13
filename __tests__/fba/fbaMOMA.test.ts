/**
 * MOMA (Minimization of Metabolic Adjustment) tests.
 *
 * Reference: Segrè et al. (2002) PNAS 99(23):15112-15117
 *
 * Test model topology (branch-point network):
 *
 *   EX_glc ──► GLCpts ──┬──► PGI ──► PFK ──► (fbp, dead end)
 *                        │     │
 *                        │     └──► BIOMASS (f6p -0.5, r5p -0.5)
 *                        │
 *                        └──► TALA ──► BIOMASS (r5p)
 *
 * Stoichiometry:
 *   EX_glc:    glc_e = -1               (lb = -10, exchange uptake)
 *   GLCpts:    glc_e = -1, g6p = 1      (lb = 0, ub = 10)
 *   PGI:       g6p = -1, f6p = 1        (lb = -10, ub = 10, reversible)
 *   PFK:       f6p = -1, fbp = 1        (lb = 0, ub = 10)
 *   TALA:      g6p = -1, r5p = 1        (lb = 0, ub = 10)
 *   BIOMASS:   f6p = -0.5, r5p = -0.5, biomass = 1  (lb = 0, ub = 10)
 *   EX_biomass: biomass = -1             (lb = 0, ub = 10)
 *
 * fbp has no consuming reaction, so PFK must carry zero flux at steady state.
 * Wild-type optimal: BIOMASS = 10, GLCpts = 10, PGI = 5, TALA = 5, PFK = 0.
 */

import { runMOMA, type MOMAModel } from '../../src/server/fbaMOMA';

function buildTestModel(): MOMAModel {
  return {
    reactions: [
      { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 } },
      { id: 'GLCpts', lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
      { id: 'PGI', lb: -10, ub: 10, stoichiometry: { g6p: -1, f6p: 1 } },
      { id: 'PFK', lb: 0, ub: 10, stoichiometry: { f6p: -1, fbp: 1 } },
      { id: 'TALA', lb: 0, ub: 10, stoichiometry: { g6p: -1, r5p: 1 } },
      { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { f6p: -0.5, r5p: -0.5, biomass: 1 } },
      { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
    ],
    objectiveId: 'BIOMASS',
  };
}

describe('MOMA', () => {
  it('computes flux adjustment after PFK knockout', async () => {
    const model = buildTestModel();
    const result = await runMOMA(model, ['PFK']);

    expect(result.feasible).toBe(true);
    expect(result.distance).toBeGreaterThanOrEqual(0);
    // PFK is knocked out — flux must be zero
    expect(result.fluxes['PFK']).toBe(0);
    // PFK was already zero at wild-type optimum (fbp dead end),
    // so the distance should be very small (ideally zero)
    expect(result.distance).toBeLessThan(1e-4);
  });

  it('returns wild-type flux when no knockouts', async () => {
    const model = buildTestModel();
    const result = await runMOMA(model, []);

    expect(result.distance).toBeCloseTo(0, 6);
    expect(result.growthRate).toBeCloseTo(result.wildtypeGrowthRate, 6);
    expect(result.feasible).toBe(true);
    // Verify wild-type fluxes are present
    expect(result.wildtypeFluxes['BIOMASS']).toBeGreaterThan(0);
    expect(result.wildtypeFluxes['GLCpts']).toBeGreaterThan(0);
  });

  it('reports reduced growth after essential reaction knockout', async () => {
    const model = buildTestModel();
    const result = await runMOMA(model, ['GLCpts']);

    expect(result.growthRate).toBeLessThan(result.wildtypeGrowthRate);
    expect(result.fluxes['GLCpts']).toBe(0);
    // With GLCpts knocked out, no glucose enters → growth = 0
    expect(result.growthRate).toBeCloseTo(0, 6);
    // Distance should be positive (mutant differs from wild-type)
    expect(result.distance).toBeGreaterThan(0);
  });

  it('returns feasible false for empty model', async () => {
    const emptyModel: MOMAModel = { reactions: [], objectiveId: 'BIOMASS' };
    const result = await runMOMA(emptyModel, []);

    expect(result.feasible).toBe(false);
    expect(result.growthRate).toBe(0);
    expect(result.distance).toBe(0);
  });

  it('returns feasible false when objective reaction is missing', async () => {
    const badModel: MOMAModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: -1 } },
        { id: 'GLCpts', lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
      ],
      objectiveId: 'NONEXISTENT',
    };
    const result = await runMOMA(badModel, []);

    expect(result.feasible).toBe(false);
  });

  it('returns feasible false for infeasible wild-type model', async () => {
    // Model where BIOMASS must carry flux (lb=1) but stoichiometry
    // forces it to zero (x is consumed but nothing produces it).
    // x balance: BIOMASS * (-1) = 0 → BIOMASS = 0, contradicting lb=1.
    const infeasibleModel: MOMAModel = {
      reactions: [
        { id: 'BIOMASS', lb: 1, ub: 10, stoichiometry: { x: -1, biomass: 1 } },
        { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      ],
      objectiveId: 'BIOMASS',
    };
    const result = await runMOMA(infeasibleModel, []);

    expect(result.feasible).toBe(false);
  });

  it('handles multiple simultaneous knockouts', async () => {
    const model = buildTestModel();
    const result = await runMOMA(model, ['GLCpts', 'PFK']);

    // GLCpts knockout alone already kills growth
    expect(result.fluxes['GLCpts']).toBe(0);
    expect(result.fluxes['PFK']).toBe(0);
    expect(result.growthRate).toBeCloseTo(0, 6);
    expect(result.growthRate).toBeLessThan(result.wildtypeGrowthRate);
  });

  it('knocked-out reactions have zero flux', async () => {
    const model = buildTestModel();
    const result = await runMOMA(model, ['PFK']);

    if (result.feasible) {
      expect(result.fluxes['PFK']).toBe(0);
    }
  });

  it('preserves wild-type flux values in no-knockout case', async () => {
    const model = buildTestModel();
    const result = await runMOMA(model, []);

    // Wild-type: BIOMASS = 10, GLCpts = 10, PGI = 5, TALA = 5, PFK = 0
    expect(result.wildtypeFluxes['BIOMASS']).toBeCloseTo(10, 4);
    expect(result.wildtypeFluxes['GLCpts']).toBeCloseTo(10, 4);
    expect(result.wildtypeFluxes['PGI']).toBeCloseTo(5, 4);
    expect(result.wildtypeFluxes['TALA']).toBeCloseTo(5, 4);
    expect(result.wildtypeFluxes['PFK']).toBeCloseTo(0, 4);

    // Mutant (no knockouts) should match wild-type exactly
    for (const rxn of model.reactions) {
      expect(result.fluxes[rxn.id]).toBeCloseTo(
        result.wildtypeFluxes[rxn.id],
        4,
      );
    }
  });

  it('distance is non-negative for any knockout', async () => {
    const model = buildTestModel();
    const result = await runMOMA(model, ['PGI']);

    if (result.feasible) {
      expect(result.distance).toBeGreaterThanOrEqual(0);
    }
  });
});
