import { solveLP, type LPModel } from '../src/server/highsSolver';
import { runFVA } from '../src/server/fbaFVA';

/**
 * Simple 3-variable model for FVA testing.
 *
 * Maximize: x + y + z
 * Subject to:
 *   x + y + z <= 10   (total capacity)
 *   x <= 4            (individual cap)
 *   y <= 4            (individual cap)
 *   z <= 4            (individual cap)
 *   x, y, z >= 0
 *
 * Optimal objective = 10.
 * Each variable can range from 2 to 4 while maintaining optimal.
 * (e.g. x=2, y=4, z=4 or x=4, y=3, z=3)
 */
const simpleModel: LPModel = {
  name: 'test_fva',
  sense: 'maximize',
  objective: [
    { name: 'x', coef: 1 },
    { name: 'y', coef: 1 },
    { name: 'z', coef: 1 },
  ],
  constraints: [
    {
      name: 'total_cap',
      vars: [
        { name: 'x', coef: 1 },
        { name: 'y', coef: 1 },
        { name: 'z', coef: 1 },
      ],
      lb: -Infinity,
      ub: 10,
    },
    {
      name: 'x_cap',
      vars: [{ name: 'x', coef: 1 }],
      lb: -Infinity,
      ub: 4,
    },
    {
      name: 'y_cap',
      vars: [{ name: 'y', coef: 1 }],
      lb: -Infinity,
      ub: 4,
    },
    {
      name: 'z_cap',
      vars: [{ name: 'z', coef: 1 }],
      lb: -Infinity,
      ub: 4,
    },
  ],
  bounds: [
    { name: 'x', lb: 0, ub: Infinity },
    { name: 'y', lb: 0, ub: Infinity },
    { name: 'z', lb: 0, ub: Infinity },
  ],
};

describe('FVA (Flux Variability Analysis)', () => {
  let optimalValue: number;

  beforeAll(async () => {
    const result = await solveLP(simpleModel);
    expect(result.status).toBe('optimal');
    optimalValue = result.objectiveValue;
  });

  test('base model solves to objective value 10', () => {
    expect(optimalValue).toBeCloseTo(10, 4);
  });

  test('produces FVA results for all objective variables by default', async () => {
    const output = await runFVA(simpleModel, optimalValue);
    expect(output.results).toHaveLength(3);
    const ids = output.results.map(r => r.reactionId);
    expect(ids).toContain('x');
    expect(ids).toContain('y');
    expect(ids).toContain('z');
  });

  test('each variable has FVA range [2, 4]', async () => {
    const output = await runFVA(simpleModel, optimalValue);

    for (const result of output.results) {
      expect(result.min).toBeCloseTo(2, 3);
      expect(result.max).toBeCloseTo(4, 3);
    }
  });

  test('FVA respects objective constraint (optimal value preserved)', async () => {
    const output = await runFVA(simpleModel, optimalValue);
    // Verify that at the extremes, the total still sums to 10
    // The min of one variable implies the others compensate
    for (const result of output.results) {
      // At min of this var, the other two must sum to 10 - min
      // Each other var is capped at 4, so 10 - min <= 8 => min >= 2
      expect(result.min).toBeGreaterThanOrEqual(2 - 1e-4);
    }
  });

  test('works with specified reactionIds subset', async () => {
    const output = await runFVA(simpleModel, optimalValue, ['x', 'z']);
    expect(output.results).toHaveLength(2);
    const ids = output.results.map(r => r.reactionId);
    expect(ids).toEqual(expect.arrayContaining(['x', 'z']));
    expect(ids).not.toContain('y');
  });

  test('reports objective value and solve time', async () => {
    const output = await runFVA(simpleModel, optimalValue);
    expect(output.objectiveValue).toBeCloseTo(10, 4);
    expect(output.solveTime).toBeGreaterThanOrEqual(0);
  });

  test('custom tolerance tightens objective constraint', async () => {
    // With very tight tolerance, the feasible region barely shrinks
    const output = await runFVA(simpleModel, optimalValue, undefined, 1e-9);
    for (const result of output.results) {
      expect(result.min).toBeCloseTo(2, 3);
      expect(result.max).toBeCloseTo(4, 3);
    }
  });
});
