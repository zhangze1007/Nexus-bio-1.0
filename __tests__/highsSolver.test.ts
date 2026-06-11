import { solveLP, type LPModel } from '../src/server/highsSolver';

describe('highsSolver', () => {
  test('solves a simple LP: max 2x + 3y s.t. x + y <= 4, x <= 2', async () => {
    const model: LPModel = {
      sense: 'maximize',
      objective: [
        { name: 'x', coef: 2 },
        { name: 'y', coef: 3 },
      ],
      constraints: [
        {
          name: 'c1',
          vars: [
            { name: 'x', coef: 1 },
            { name: 'y', coef: 1 },
          ],
          lb: -Infinity,
          ub: 4,
        },
        {
          name: 'c2',
          vars: [{ name: 'x', coef: 1 }],
          lb: -Infinity,
          ub: 2,
        },
      ],
      bounds: [
        { name: 'x', lb: 0, ub: Infinity },
        { name: 'y', lb: 0, ub: Infinity },
      ],
    };

    const result = await solveLP(model);
    expect(result.status).toBe('optimal');
    // y has higher coefficient (3 > 2), so optimizer maximizes y: x=0, y=4
    expect(result.primals['x']).toBeCloseTo(0, 4);
    expect(result.primals['y']).toBeCloseTo(4, 4);
    expect(result.objectiveValue).toBeCloseTo(12, 4);
  });

  test('returns dual variables (shadow prices)', async () => {
    const model: LPModel = {
      sense: 'maximize',
      objective: [{ name: 'x', coef: 1 }],
      constraints: [
        {
          name: 'supply',
          vars: [{ name: 'x', coef: 1 }],
          lb: -Infinity,
          ub: 5,
        },
      ],
      bounds: [
        { name: 'x', lb: 0, ub: Infinity },
      ],
    };

    const result = await solveLP(model);
    expect(result.status).toBe('optimal');
    expect(result.duals['supply']).toBeDefined();
    expect(typeof result.duals['supply']).toBe('number');
  });

  test('detects infeasible problem', async () => {
    const model: LPModel = {
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

    const result = await solveLP(model);
    expect(result.status).not.toBe('optimal');
  });
});
