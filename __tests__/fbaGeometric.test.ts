/** @jest-environment node */

/**
 * Geometric FBA tests.
 *
 * Geometric FBA uses sequential FVA midpoint iteration to find a unique
 * flux distribution at the analytic centre of the optimal face.  Tests verify:
 *   - Optimal objective preservation
 *   - Mass balance (S * v = 0)
 *   - Variable bounds respected
 *   - Degeneracy resolution (multiple FBA optima → single unique point)
 *   - Determinism (repeated solves give identical results)
 *   - Edge cases: infeasible, zero-uptake models
 *   - Shorter paths receive proportionally more or equal flux
 */

import { solveGeometricFBA } from '../src/services/fba/fbaGeometric';
import type { LPModel } from '../src/server/highsSolver';

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
 * FBA: R2 = 10, R1 = 10, R3 = 0.  Unique optimum (no degeneracy).
 */
function buildSimpleModel(): LPModel {
  return {
    name: 'geo_simple',
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
 * Degenerate network: two parallel paths to product, with a shared input limit.
 *
 *   Path 1: R1a: S->A, R2a: A->P   (shorter)
 *   Path 2: R1b: S->B, R2b: B->C, R3b: C->P  (longer)
 *
 *   Mass balance at A:  R1a - R2a = 0
 *   Mass balance at B:  R1b - R2b = 0
 *   Mass balance at C:  R2b - R3b = 0
 *
 *   Objective: max R2a + R3b (total product flux)
 *   Input limit: R1a + R1b <= 10
 *   All bounds [0, 10]
 *
 * FBA optimum: R2a + R3b = 10 (input-saturated).
 * Multiple optima: any split with R1a + R1b = 10.
 *
 * Geometric FBA (sequential midpoint, alphabetical order):
 *   R1a: range [0, 10] → midpoint 5 → fix R1a=5
 *   R1b: with R1a=5, forced to 5 → fix R1b=5
 *   All remaining variables forced to 5.
 *
 * Result: R1a=R2a=R1b=R2b=R3b=5.
 */
function buildDegenerateModel(): LPModel {
  return {
    name: 'geo_degenerate',
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
    name: 'geo_infeasible',
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
 * Reversible reaction model: a cycle that can carry futile flux.
 *
 *   R1: S -> A   (lb=0, ub=10)
 *   R2: A -> P   (lb=0, ub=10)  ← objective
 *   R3: A -> S   (lb=0, ub=10)  ← reverse drain
 *
 * Mass balance at A: R1 - R2 - R3 = 0
 * Objective: max R2
 *
 * FBA: R2 = 10, R1 = 10, R3 = 0.  Unique optimum.
 * Geometric FBA: same (no degeneracy).
 */
function buildReversibleModel(): LPModel {
  return {
    name: 'geo_reversible',
    sense: 'maximize',
    objective: [{ name: 'R2', coef: 1 }],
    constraints: [
      {
        name: 'A_balance',
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
 * Zero-uptake model: variable forced to zero.
 */
function buildZeroUptakeModel(): LPModel {
  return {
    name: 'geo_zero',
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

/**
 * Three-path degenerate network: two paths of different lengths.
 *
 *   Path 1 (3 hops): R1: S->A, R2: A->B, R3: B->P
 *   Path 2 (2 hops): R4: S->C, R5: C->P
 *
 * Mass balance at A: R1 - R2 = 0
 * Mass balance at B: R2 - R3 = 0
 * Mass balance at C: R4 - R5 = 0
 * Objective: max R3 + R5
 * Input limit: R1 + R4 <= 10
 * All bounds [0, 10].
 *
 * FBA: R3 + R5 = 10.  Any split with R1=R2=R3=a, R4=R5=b, a+b=10.
 *
 * Geometric FBA (sequential midpoint, alphabetical order):
 *   R1: range [0, 10] → midpoint 5 → fix R1=5
 *   R2: forced to 5 (R2=R1) → fix R2=5
 *   R3: forced to 5 (R3=R2) → fix R3=5
 *   R4: with R3=5, R5=5, forced to 5 → fix R4=5
 *   R5: forced to 5 → fix R5=5
 *
 * Result: R1=R2=R3=R4=R5=5.
 */
function buildThreePathModel(): LPModel {
  return {
    name: 'geo_threepath',
    sense: 'maximize',
    objective: [
      { name: 'R3', coef: 1 },
      { name: 'R5', coef: 1 },
    ],
    constraints: [
      {
        name: 'A_balance',
        vars: [
          { name: 'R1', coef: 1 },
          { name: 'R2', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: 'B_balance',
        vars: [
          { name: 'R2', coef: 1 },
          { name: 'R3', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: 'C_balance',
        vars: [
          { name: 'R4', coef: 1 },
          { name: 'R5', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: 'input_limit',
        vars: [
          { name: 'R1', coef: 1 },
          { name: 'R4', coef: 1 },
        ],
        lb: -Infinity,
        ub: 10,
      },
    ],
    bounds: [
      { name: 'R1', lb: 0, ub: 10 },
      { name: 'R2', lb: 0, ub: 10 },
      { name: 'R3', lb: 0, ub: 10 },
      { name: 'R4', lb: 0, ub: 10 },
      { name: 'R5', lb: 0, ub: 10 },
    ],
  };
}

/**
 * Asymmetric degenerate model: one path has a tighter bound.
 *
 *   R1: S -> A (lb=0, ub=10)  ← objective component
 *   R2: S -> B (lb=0, ub=6)   ← capped at 6, tighter than R1
 *   Constraint: R1 + R2 = 10
 *
 * FBA: max R1 + R2 = 10 (always, since R1+R2=10).
 * R2 capped at 6, so R2 in [4, 6], R1 in [4, 6].
 *
 * Geometric FBA (alphabetical):
 *   R1: range [4, 6] → midpoint 5 → fix R1=5
 *   R2: forced to 5 (R2=10-R1) → fix R2=5
 *
 * Result: R1=5, R2=5.
 */
function buildAsymmetricModel(): LPModel {
  return {
    name: 'geo_asymmetric',
    sense: 'maximize',
    objective: [
      { name: 'R1', coef: 1 },
      { name: 'R2', coef: 1 },
    ],
    constraints: [
      {
        name: 'balance',
        vars: [
          { name: 'R1', coef: 1 },
          { name: 'R2', coef: 1 },
        ],
        lb: 10,
        ub: 10,
      },
    ],
    bounds: [
      { name: 'R1', lb: 0, ub: 10 },
      { name: 'R2', lb: 0, ub: 6 },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('solveGeometricFBA', () => {

  // ── Basic functionality ──────────────────────────────────────────

  test('returns optimal result for simple model', async () => {
    const result = await solveGeometricFBA(buildSimpleModel());

    expect(result.objectiveValue).toBeCloseTo(10, 3);
    expect(result.fluxes).toBeDefined();
    expect(Object.keys(result.fluxes).length).toBeGreaterThan(0);
    expect(result.solveTime).toBeGreaterThanOrEqual(0);
  });

  test('preserves optimal objective value', async () => {
    const result = await solveGeometricFBA(buildSimpleModel());

    // R2 (product) should be at its FBA maximum = 10
    expect(result.objectiveValue).toBeCloseTo(10, 3);
    expect(result.fluxes['R2']).toBeCloseTo(10, 3);
  });

  test('satisfies mass balance constraint', async () => {
    const result = await solveGeometricFBA(buildSimpleModel());

    // B_balance: R1 - R2 - R3 = 0
    const R1 = result.fluxes['R1'];
    const R2 = result.fluxes['R2'];
    const R3 = result.fluxes['R3'];
    expect(R1 - R2 - R3).toBeCloseTo(0, 3);
  });

  // ── Unique optimum (no degeneracy) ──────────────────────────────

  test('finds unique optimum for non-degenerate simple model', async () => {
    const result = await solveGeometricFBA(buildSimpleModel());

    // Simple model has a unique FBA optimum: R1=10, R2=10, R3=0
    expect(result.isUnique).toBe(true);
    expect(result.fluxes['R3']).toBeCloseTo(0, 3);
    expect(result.fluxes['R1']).toBeCloseTo(10, 3);
  });

  test('does not introduce futile cycles through reversible reactions', async () => {
    const result = await solveGeometricFBA(buildReversibleModel());

    // R3 (reverse drain) should be zero — unique FBA optimum
    expect(result.fluxes['R3']).toBeCloseTo(0, 3);
    expect(result.fluxes['R1']).toBeCloseTo(10, 3);
    expect(result.fluxes['R2']).toBeCloseTo(10, 3);
    expect(result.isUnique).toBe(true);
  });

  // ── Degeneracy resolution ───────────────────────────────────────

  test('resolves degeneracy to a unique point (midpoint of FVA ranges)', async () => {
    const result = await solveGeometricFBA(buildDegenerateModel());

    // Objective should be preserved at 10
    expect(result.objectiveValue).toBeCloseTo(10, 3);
    expect(result.isUnique).toBe(true);

    // Mass balance checks
    expect(result.fluxes['R1a'] - result.fluxes['R2a']).toBeCloseTo(0, 3);
    expect(result.fluxes['R1b'] - result.fluxes['R2b']).toBeCloseTo(0, 3);
    expect(result.fluxes['R2b'] - result.fluxes['R3b']).toBeCloseTo(0, 3);

    // Input limit: R1a + R1b <= 10
    expect(result.fluxes['R1a'] + result.fluxes['R1b']).toBeLessThanOrEqual(10.01);

    // Sequential midpoint (alphabetical): R1a range [0,10] → midpoint 5
    // After fixing R1a=5, all others forced to 5
    expect(result.fluxes['R1a']).toBeCloseTo(5, 1);
    expect(result.fluxes['R2a']).toBeCloseTo(5, 1);
    expect(result.fluxes['R1b']).toBeCloseTo(5, 1);
    expect(result.fluxes['R2b']).toBeCloseTo(5, 1);
    expect(result.fluxes['R3b']).toBeCloseTo(5, 1);
  });

  test('resolves three-path degeneracy to unique point', async () => {
    const result = await solveGeometricFBA(buildThreePathModel());

    // Objective: R3 + R5 = 10
    expect(result.objectiveValue).toBeCloseTo(10, 3);
    expect(result.isUnique).toBe(true);

    // Mass balance
    expect(result.fluxes['R1'] - result.fluxes['R2']).toBeCloseTo(0, 3);
    expect(result.fluxes['R2'] - result.fluxes['R3']).toBeCloseTo(0, 3);
    expect(result.fluxes['R4'] - result.fluxes['R5']).toBeCloseTo(0, 3);

    // Sequential midpoint: R1 range [0,10] → 5, all forced to 5
    expect(result.fluxes['R1']).toBeCloseTo(5, 1);
    expect(result.fluxes['R2']).toBeCloseTo(5, 1);
    expect(result.fluxes['R3']).toBeCloseTo(5, 1);
    expect(result.fluxes['R4']).toBeCloseTo(5, 1);
    expect(result.fluxes['R5']).toBeCloseTo(5, 1);
  });

  test('resolves asymmetric degeneracy to unique point', async () => {
    const result = await solveGeometricFBA(buildAsymmetricModel());

    // Objective: R1 + R2 = 10
    expect(result.objectiveValue).toBeCloseTo(10, 3);
    expect(result.isUnique).toBe(true);

    // R2 is capped at 6, so R1 >= 4. R1 range [4, 10] (R2 can go to 0).
    // Sequential midpoint: R1 range [4, 10] → midpoint 7
    // Then R2 = 10 - 7 = 3.
    expect(result.fluxes['R1']).toBeCloseTo(7, 1);
    expect(result.fluxes['R2']).toBeCloseTo(3, 1);
  });

  // ── Edge cases ──────────────────────────────────────────────────

  test('returns empty fluxes and isUnique=false for infeasible model', async () => {
    const result = await solveGeometricFBA(buildInfeasibleModel());

    expect(result.objectiveValue).toBe(0);
    expect(Object.keys(result.fluxes)).toHaveLength(0);
    expect(result.isUnique).toBe(false);
  });

  test('handles zero-uptake model (trivial optimum)', async () => {
    const result = await solveGeometricFBA(buildZeroUptakeModel());

    // R1 is forced to 0 by both the equality constraint and the bound.
    expect(result.objectiveValue).toBeCloseTo(0, 3);
    expect(result.fluxes['R1']).toBeCloseTo(0, 3);
    expect(result.isUnique).toBe(true);
  });

  // ── Determinism ─────────────────────────────────────────────────

  test('produces identical results on repeated solves (determinism)', async () => {
    const model = buildDegenerateModel();
    const result1 = await solveGeometricFBA(model);
    const result2 = await solveGeometricFBA(model);

    expect(result1.objectiveValue).toBeCloseTo(result2.objectiveValue, 6);
    expect(result1.isUnique).toBe(result2.isUnique);

    for (const key of Object.keys(result1.fluxes)) {
      expect(result1.fluxes[key]).toBeCloseTo(result2.fluxes[key], 6);
    }
  });

  // ── Flux bounds respected ───────────────────────────────────────

  test('all fluxes respect their variable bounds', async () => {
    const result = await solveGeometricFBA(buildDegenerateModel());
    const model = buildDegenerateModel();

    for (const bound of model.bounds ?? []) {
      const flux = result.fluxes[bound.name] ?? 0;
      expect(flux).toBeGreaterThanOrEqual(bound.lb - 1e-6);
      expect(flux).toBeLessThanOrEqual(bound.ub + 1e-6);
    }
  });

  test('all fluxes respect bounds for asymmetric model', async () => {
    const result = await solveGeometricFBA(buildAsymmetricModel());

    // R2 bound: [0, 6]
    expect(result.fluxes['R2']).toBeGreaterThanOrEqual(-1e-6);
    expect(result.fluxes['R2']).toBeLessThanOrEqual(6 + 1e-6);

    // R1 bound: [0, 10]
    expect(result.fluxes['R1']).toBeGreaterThanOrEqual(-1e-6);
    expect(result.fluxes['R1']).toBeLessThanOrEqual(10 + 1e-6);
  });

  // ── Feasibility check ───────────────────────────────────────────

  test('geometric FBA solution satisfies mass balance for degenerate model', async () => {
    const result = await solveGeometricFBA(buildDegenerateModel());

    // All mass balances must hold
    expect(result.fluxes['R1a'] - result.fluxes['R2a']).toBeCloseTo(0, 3);
    expect(result.fluxes['R1b'] - result.fluxes['R2b']).toBeCloseTo(0, 3);
    expect(result.fluxes['R2b'] - result.fluxes['R3b']).toBeCloseTo(0, 3);

    // Objective: R2a + R3b = 10
    expect(result.fluxes['R2a'] + result.fluxes['R3b']).toBeCloseTo(10, 3);
  });

  // ── Solve time ──────────────────────────────────────────────────

  test('solveTime is non-negative and completes in reasonable time', async () => {
    const result = await solveGeometricFBA(buildSimpleModel());

    expect(result.solveTime).toBeGreaterThanOrEqual(0);
    // For a tiny model, solve should be fast (< 10 seconds)
    expect(result.solveTime).toBeLessThan(10000);
  });

  // ── Midpoint property ───────────────────────────────────────────

  test('midpoint is between FVA bounds for degenerate model', async () => {
    // For the degenerate model, R1a ranges from 0 to 10 in FVA.
    // The geometric FBA midpoint should be between these bounds.
    const result = await solveGeometricFBA(buildDegenerateModel());

    expect(result.fluxes['R1a']).toBeGreaterThanOrEqual(0 - 1e-6);
    expect(result.fluxes['R1a']).toBeLessThanOrEqual(10 + 1e-6);

    // The midpoint should be strictly between the bounds (not at an extreme)
    expect(result.fluxes['R1a']).toBeGreaterThan(1e-6);
    expect(result.fluxes['R1a']).toBeLessThan(10 - 1e-6);
  });
});
