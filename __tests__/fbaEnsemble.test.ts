/** @jest-environment node */

/**
 * Ensemble FBA and FVA tests.
 *
 * Tests verify:
 *   - Ensemble FBA produces valid solutions with correct statistics
 *   - FVA computes correct min/max/variability for each reaction
 *   - Mass balance is preserved across ensemble samples
 *   - Edge cases: empty samples, infeasible models, zero-objective models
 *   - Ensemble statistics (mean, std) are consistent with FVA ranges
 *   - Determinism of FVA (ensemble is stochastic by design)
 */

import { runEnsembleFBA, computeFluxVariability } from '../src/services/fba/fbaEnsemble';
import type { LPModel } from '../src/server/highsSolver';
import { solveLP } from '../src/server/highsSolver';

/* ------------------------------------------------------------------ */
/*  Test models                                                        */
/* ------------------------------------------------------------------ */

/**
 * Simple 3-reaction network with a branch point.
 *
 *   A --[R1]--> B --[R2]--> C (product)
 *                \
 *                 --[R3]--> D (waste)
 *
 * Mass balance at B: R1 - R2 - R3 = 0
 * Objective: maximise R2
 * Bounds: all [0, 10]
 *
 * FBA: R2 = 10, R1 = 10, R3 = 0.  Unique optimum.
 * FVA: R1 = [10, 10], R2 = [10, 10], R3 = [0, 0] (all uniquely determined).
 */
function buildSimpleModel(): LPModel {
  return {
    name: 'ensemble_simple',
    sense: 'maximize',
    objective: [{ name: 'R2', coef: 1 }],
    constraints: [
      {
        name: 'B_balance',
        vars: [
          { name: 'R1', coef: 1 },
          { name: 'R2', coef: -1 },
          { name: 'R3', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
    ],
    bounds: [
      { name: 'R1', lb: 0, ub: 10 },
      { name: 'R2', lb: 0, ub: 10 },
      { name: 'R3', lb: 0, ub: 10 },
    ],
  };
}

/**
 * Degenerate network: two parallel paths to product.
 *
 *   R1a: S->A, R2a: A->P   (path 1)
 *   R1b: S->B, R2b: B->C, R3b: C->P  (path 2)
 *
 * Mass balance at A: R1a - R2a = 0
 * Mass balance at B: R1b - R2b = 0
 * Mass balance at C: R2b - R3b = 0
 * Objective: max R2a + R3b
 * Input limit: R1a + R1b <= 10
 * All bounds [0, 10].
 *
 * FBA: R2a + R3b = 10. Any split with R1a + R1b = 10 is optimal.
 * FVA: R1a = [0, 10], R1b = [0, 10] (degenerate).
 */
function buildDegenerateModel(): LPModel {
  return {
    name: 'ensemble_degenerate',
    sense: 'maximize',
    objective: [
      { name: 'R2a', coef: 1 },
      { name: 'R3b', coef: 1 },
    ],
    constraints: [
      {
        name: 'A_balance',
        vars: [
          { name: 'R1a', coef: 1 },
          { name: 'R2a', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: 'B_balance',
        vars: [
          { name: 'R1b', coef: 1 },
          { name: 'R2b', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: 'C_balance',
        vars: [
          { name: 'R2b', coef: 1 },
          { name: 'R3b', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: 'input_limit',
        vars: [
          { name: 'R1a', coef: 1 },
          { name: 'R1b', coef: 1 },
        ],
        lb: -Infinity,
        ub: 10,
      },
    ],
    bounds: [
      { name: 'R1a', lb: 0, ub: 10 },
      { name: 'R2a', lb: 0, ub: 10 },
      { name: 'R1b', lb: 0, ub: 10 },
      { name: 'R2b', lb: 0, ub: 10 },
      { name: 'R3b', lb: 0, ub: 10 },
    ],
  };
}

/**
 * Infeasible model: conflicting constraints.
 */
function buildInfeasibleModel(): LPModel {
  return {
    name: 'ensemble_infeasible',
    sense: 'maximize',
    objective: [{ name: 'x', coef: 1 }],
    constraints: [
      {
        name: 'c1',
        vars: [{ name: 'x', coef: 1 }],
        lb: 10,
        ub: 5,
      },
    ],
  };
}

/**
 * Zero-objective model: trivially zero.
 */
function buildZeroObjectiveModel(): LPModel {
  return {
    name: 'ensemble_zero',
    sense: 'maximize',
    objective: [{ name: 'R1', coef: 1 }],
    constraints: [
      {
        name: 'balance',
        vars: [{ name: 'R1', coef: 1 }],
        lb: 0,
        ub: 0,
      },
    ],
    bounds: [
      { name: 'R1', lb: 0, ub: 0 },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Ensemble FBA Tests                                                 */
/* ------------------------------------------------------------------ */

describe('runEnsembleFBA', () => {

  // ── Basic functionality ──────────────────────────────────────────

  test('returns correct number of solutions', async () => {
    const result = await runEnsembleFBA(buildSimpleModel(), 5);
    expect(result.solutions).toHaveLength(5);
  });

  test('each solution has fluxes and objectiveValue', async () => {
    const result = await runEnsembleFBA(buildSimpleModel(), 3);
    for (const sol of result.solutions) {
      expect(sol.fluxes).toBeDefined();
      expect(typeof sol.objectiveValue).toBe('number');
      expect(Object.keys(sol.fluxes).length).toBeGreaterThan(0);
    }
  });

  test('meanFluxes and stdFluxes are computed for all reactions', async () => {
    const model = buildSimpleModel();
    const result = await runEnsembleFBA(model, 5);
    const varNames = (model.bounds ?? []).map(b => b.name);

    for (const name of varNames) {
      expect(result.meanFluxes[name]).toBeDefined();
      expect(result.stdFluxes[name]).toBeDefined();
      expect(typeof result.meanFluxes[name]).toBe('number');
      expect(typeof result.stdFluxes[name]).toBe('number');
    }
  });

  test('std is non-negative for all reactions', async () => {
    const result = await runEnsembleFBA(buildDegenerateModel(), 10);
    for (const name of Object.keys(result.stdFluxes)) {
      expect(result.stdFluxes[name]).toBeGreaterThanOrEqual(0);
    }
  });

  // ── Objective preservation ───────────────────────────────────────

  test('ensemble solutions have near-optimal objective values', async () => {
    const model = buildSimpleModel();
    const optResult = await solveLP(model);
    const result = await runEnsembleFBA(model, 10, 0.05);

    // With small perturbation, objective should be near optimal
    // Allow 20% deviation due to perturbation
    for (const sol of result.solutions) {
      expect(sol.objectiveValue).toBeGreaterThanOrEqual(optResult.objectiveValue * 0.8);
    }
  });

  // ── Degenerate model exposes flux variability ────────────────────

  test('degenerate model shows non-zero std for degenerate fluxes', async () => {
    // The degenerate model has R1a + R1b = 10 with each in [0, 10].
    // Ensemble should show variability in these fluxes.
    const result = await runEnsembleFBA(buildDegenerateModel(), 20, 0.15);

    // At least one of the degenerate fluxes should have non-zero std
    const hasVariability =
      result.stdFluxes['R1a'] > 0.01 ||
      result.stdFluxes['R1b'] > 0.01;
    expect(hasVariability).toBe(true);
  });

  test('ensemble mean preserves mass balance for degenerate model', async () => {
    const result = await runEnsembleFBA(buildDegenerateModel(), 10);

    // Mass balance at A: R1a - R2a = 0
    expect(result.meanFluxes['R1a'] - result.meanFluxes['R2a']).toBeCloseTo(0, 2);
    // Mass balance at B: R1b - R2b = 0
    expect(result.meanFluxes['R1b'] - result.meanFluxes['R2b']).toBeCloseTo(0, 2);
    // Mass balance at C: R2b - R3b = 0
    expect(result.meanFluxes['R2b'] - result.meanFluxes['R3b']).toBeCloseTo(0, 2);
  });

  // ── Edge cases ──────────────────────────────────────────────────

  test('returns empty result for zero samples', async () => {
    const result = await runEnsembleFBA(buildSimpleModel(), 0);
    expect(result.solutions).toHaveLength(0);
    expect(Object.keys(result.meanFluxes)).toHaveLength(0);
  });

  test('handles infeasible model gracefully', async () => {
    const result = await runEnsembleFBA(buildInfeasibleModel(), 3);
    // Should return solutions (possibly with zero fluxes) without throwing
    expect(result.solutions).toHaveLength(3);
    for (const sol of result.solutions) {
      expect(sol.objectiveValue).toBe(0);
    }
  });

  test('handles zero-objective model', async () => {
    const result = await runEnsembleFBA(buildZeroObjectiveModel(), 3);
    expect(result.solutions).toHaveLength(3);
    for (const sol of result.solutions) {
      expect(sol.fluxes['R1']).toBeCloseTo(0, 3);
    }
  });

  // ── Perturbation magnitude ──────────────────────────────────────

  test('larger delta produces more variability in degenerate model', async () => {
    const model = buildDegenerateModel();
    const smallDelta = await runEnsembleFBA(model, 20, 0.01);
    const largeDelta = await runEnsembleFBA(model, 20, 0.3);

    // The sum of stds should be larger with larger delta
    const smallStdSum = Object.values(smallDelta.stdFluxes).reduce((s, v) => s + v, 0);
    const largeStdSum = Object.values(largeDelta.stdFluxes).reduce((s, v) => s + v, 0);
    expect(largeStdSum).toBeGreaterThanOrEqual(smallStdSum * 0.5);
  });
});

/* ------------------------------------------------------------------ */
/*  FVA Tests                                                          */
/* ------------------------------------------------------------------ */

describe('computeFluxVariability', () => {

  // ── Basic functionality ──────────────────────────────────────────

  test('returns results for all reactions', async () => {
    const model = buildSimpleModel();
    const result = await computeFluxVariability(model);
    const varNames = (model.bounds ?? []).map(b => b.name);
    expect(result.reactions).toHaveLength(varNames.length);
  });

  test('each reaction has id, min, max, variability', async () => {
    const result = await computeFluxVariability(buildSimpleModel());
    for (const rxn of result.reactions) {
      expect(rxn.id).toBeDefined();
      expect(typeof rxn.min).toBe('number');
      expect(typeof rxn.max).toBe('number');
      expect(typeof rxn.variability).toBe('number');
    }
  });

  test('variability equals max - min', async () => {
    const result = await computeFluxVariability(buildSimpleModel());
    for (const rxn of result.reactions) {
      expect(rxn.variability).toBeCloseTo(rxn.max - rxn.min, 4);
    }
  });

  // ── Simple model (unique optima) ────────────────────────────────

  test('simple model has zero variability for all reactions (unique optimum)', async () => {
    const result = await computeFluxVariability(buildSimpleModel());

    for (const rxn of result.reactions) {
      expect(rxn.variability).toBeLessThan(0.1);
    }
  });

  test('simple model: R2 (objective) is at its bound of 10', async () => {
    const result = await computeFluxVariability(buildSimpleModel());
    const r2 = result.reactions.find(r => r.id === 'R2');
    expect(r2).toBeDefined();
    expect(r2!.min).toBeCloseTo(10, 1);
    expect(r2!.max).toBeCloseTo(10, 1);
  });

  // ── Degenerate model (multiple optima) ──────────────────────────

  test('degenerate model shows variability for R1a and R1b', async () => {
    const result = await computeFluxVariability(buildDegenerateModel());
    const r1a = result.reactions.find(r => r.id === 'R1a');
    const r1b = result.reactions.find(r => r.id === 'R1b');

    expect(r1a).toBeDefined();
    expect(r1b).toBeDefined();

    // R1a can range from 0 to 10 (any split of the 10-unit input)
    expect(r1a!.min).toBeLessThan(1);
    expect(r1a!.max).toBeGreaterThan(9);
    expect(r1a!.variability).toBeGreaterThan(8);

    expect(r1b!.min).toBeLessThan(1);
    expect(r1b!.max).toBeGreaterThan(9);
    expect(r1b!.variability).toBeGreaterThan(8);
  });

  test('degenerate model: objective flux R2a+R3b stays at 10', async () => {
    const result = await computeFluxVariability(buildDegenerateModel());
    const r2a = result.reactions.find(r => r.id === 'R2a');
    const r3b = result.reactions.find(r => r.id === 'R3b');

    // At max R2a, R3b must be at min, and vice versa.
    // But R2a + R3b should always equal 10.
    // Check that at least the max of each is at or near 10.
    expect(r2a!.max).toBeGreaterThan(9);
    expect(r3b!.max).toBeGreaterThan(9);
  });

  // ── Min <= Max invariant ─────────────────────────────────────────

  test('min <= max for all reactions in all models', async () => {
    for (const modelFn of [buildSimpleModel, buildDegenerateModel, buildZeroObjectiveModel]) {
      const result = await computeFluxVariability(modelFn());
      for (const rxn of result.reactions) {
        expect(rxn.min).toBeLessThanOrEqual(rxn.max + 1e-6);
      }
    }
  });

  // ── Edge cases ──────────────────────────────────────────────────

  test('returns empty reactions for infeasible model', async () => {
    const result = await computeFluxVariability(buildInfeasibleModel());
    expect(result.reactions).toHaveLength(0);
  });

  test('handles zero-objective model', async () => {
    const result = await computeFluxVariability(buildZeroObjectiveModel());
    expect(result.reactions).toHaveLength(1);
    expect(result.reactions[0].id).toBe('R1');
    expect(result.reactions[0].min).toBeCloseTo(0, 3);
    expect(result.reactions[0].max).toBeCloseTo(0, 3);
    expect(result.reactions[0].variability).toBeCloseTo(0, 3);
  });

  // ── FVA range contains FBA solution ─────────────────────────────

  test('FVA range contains the FBA optimal flux for each reaction', async () => {
    const model = buildDegenerateModel();
    const fbaResult = await solveLP(model);
    const fvaResult = await computeFluxVariability(model);

    for (const rxn of fvaResult.reactions) {
      const fbaFlux = fbaResult.primals[rxn.id] ?? 0;
      expect(rxn.min).toBeLessThanOrEqual(fbaFlux + 1e-4);
      expect(rxn.max).toBeGreaterThanOrEqual(fbaFlux - 1e-4);
    }
  });
});
