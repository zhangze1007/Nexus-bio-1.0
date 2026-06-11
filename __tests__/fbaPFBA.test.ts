/** @jest-environment node */

import { runPFBA } from '../src/server/fbaPFBA';
import type { LPModel } from '../src/server/highsSolver';

/**
 * Simple 3-reaction network for pFBA testing.
 *
 *   A --[R1]--> B --[R2]--> C (product)
 *                \
 *                 --[R3]--> D (waste)
 *
 * Stoichiometry (mass balance at B): R1 - R2 - R3 = 0
 * Objective: maximize R2 (product)
 * Bounds: R1 in [0, 10], R2 in [0, 10], R3 in [0, 10]
 *
 * FBA maximizes R2 subject to R1 = R2 + R3.
 * The optimum is R2 = 10, R1 = 10, R3 = 0 (all flux to product).
 * But if we allow R2 in [0, 10] with an alternative where R2 = 10 is also
 * achievable with R3 > 0, pFBA should prefer R3 = 0 (minimum total flux).
 *
 * In this case FBA already gives R3 = 0 at optimum, so pFBA should match.
 */
function buildSimpleModel(): LPModel {
  return {
    name: 'test_simple',
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
 * Degenerate network: FBA has multiple optimal solutions.
 *
 *   R1: S --> A     (lb=0, ub=10)
 *   R2: A --> P     (lb=0, ub=10)  ← objective
 *   R3: A --> W     (lb=0, ub=10)  ← alternative drain
 *   R4: S --> A2    (lb=0, ub=10)  ← parallel input
 *   R5: A2 --> P    (lb=0, ub=10)
 *
 * Mass balance at A:  R1 - R2 - R3 = 0
 * Mass balance at A2: R4 - R5 = 0
 * Mass balance at P:  R2 + R5 = (output)
 *
 * Objective: max R2 + R5 (total product)
 *
 * At optimum: R2 + R5 = 20 (both at max).
 * Multiple solutions: R1=10,R2=10,R3=0,R4=10,R5=10  (total flux = 40)
 *                 or  R1=10,R2=10,R3=0,R4=10,R5=10  (same, unique here)
 *
 * To create degeneracy, let's make R2 and R5 share a limited resource.
 */
function buildDegenerateModel(): LPModel {
  return {
    name: 'test_degenerate',
    sense: 'maximize',
    objective: [
      { name: 'R2', coef: 1 },
      { name: 'R5', coef: 1 },
    ],
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
      {
        name: 'A2_balance',
        vars: [
          { name: 'R4', coef: 1 },
          { name: 'R5', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        // Total input flux limited to 15
        name: 'input_limit',
        vars: [
          { name: 'R1', coef: 1 },
          { name: 'R4', coef: 1 },
        ],
        lb: -Infinity,
        ub: 15,
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
 * Infeasible model: conflicting constraints.
 */
function buildInfeasibleModel(): LPModel {
  return {
    name: 'test_infeasible',
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

describe('runPFBA', () => {
  test('returns optimal result for simple model', async () => {
    const result = await runPFBA(buildSimpleModel());

    expect(result.objectiveValue).toBeCloseTo(10, 3);
    expect(result.fluxes).toBeDefined();
    expect(result.fluxes['R1']).toBeDefined();
    expect(result.fluxes['R2']).toBeDefined();
    expect(result.fluxes['R3']).toBeDefined();
    expect(result.solveTime).toBeGreaterThanOrEqual(0);
  });

  test('preserves optimal objective value', async () => {
    const result = await runPFBA(buildSimpleModel());

    // R2 (product) should be at its maximum = 10
    expect(result.objectiveValue).toBeCloseTo(10, 3);
    expect(result.fluxes['R2']).toBeCloseTo(10, 3);
  });

  test('satisfies mass balance constraint', async () => {
    const result = await runPFBA(buildSimpleModel());

    // B_balance: R1 - R2 - R3 = 0
    const R1 = result.fluxes['R1'];
    const R2 = result.fluxes['R2'];
    const R3 = result.fluxes['R3'];
    expect(R1 - R2 - R3).toBeCloseTo(0, 3);
  });

  test('pFBA minimizes total flux (R3 should be zero)', async () => {
    const result = await runPFBA(buildSimpleModel());

    // With R2=10 fixed, mass balance gives R1 = R2 + R3.
    // pFBA minimizes |R1| + |R2| + |R3| = (10+R3) + 10 + R3 = 20 + 2*R3.
    // Minimum at R3 = 0.
    expect(result.fluxes['R3']).toBeCloseTo(0, 3);
    expect(result.fluxes['R1']).toBeCloseTo(10, 3);
  });

  test('totalFlux is sum of absolute fluxes', async () => {
    const result = await runPFBA(buildSimpleModel());

    const expectedTotal =
      Math.abs(result.fluxes['R1']) +
      Math.abs(result.fluxes['R2']) +
      Math.abs(result.fluxes['R3']);
    expect(result.totalFlux).toBeCloseTo(expectedTotal, 3);
  });

  test('totalFlux equals 20 for simple model (R1=10, R2=10, R3=0)', async () => {
    const result = await runPFBA(buildSimpleModel());

    // Optimal pFBA: R1=10, R2=10, R3=0 => total = 20
    expect(result.totalFlux).toBeCloseTo(20, 3);
  });

  test('handles degenerate model by selecting minimum-flux solution', async () => {
    const result = await runPFBA(buildDegenerateModel());

    // Optimal objective: R2 + R5 = 15 (limited by input_limit)
    expect(result.objectiveValue).toBeCloseTo(15, 3);

    // Mass balance at A: R1 = R2 + R3
    const R1 = result.fluxes['R1'];
    const R2 = result.fluxes['R2'];
    const R3 = result.fluxes['R3'];
    const R4 = result.fluxes['R4'];
    const R5 = result.fluxes['R5'];

    expect(R1 - R2 - R3).toBeCloseTo(0, 3);
    // Mass balance at A2: R4 = R5
    expect(R4 - R5).toBeCloseTo(0, 3);

    // pFBA should minimize R3 (the waste drain)
    expect(R3).toBeCloseTo(0, 3);

    // Input limit: R1 + R4 <= 15
    expect(R1 + R4).toBeLessThanOrEqual(15.01);
  });

  test('returns empty fluxes for infeasible model', async () => {
    const result = await runPFBA(buildInfeasibleModel());

    expect(result.objectiveValue).toBe(0);
    expect(result.totalFlux).toBe(0);
    expect(Object.keys(result.fluxes)).toHaveLength(0);
  });

  test('solveTime is non-negative', async () => {
    const result = await runPFBA(buildSimpleModel());
    expect(result.solveTime).toBeGreaterThanOrEqual(0);
  });
});
