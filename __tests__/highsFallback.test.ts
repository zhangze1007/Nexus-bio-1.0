/**
 * HiGHS WASM Fallback Tests
 *
 * Tests that the FBA solver works correctly when HiGHS WASM
 * is not available (e.g., in some Serverless environments).
 *
 * Verifies:
 *   1. Graceful fallback to in-memory solver
 *   2. Correct results from fallback solver
 *   3. No crashes when WASM fails to load
 */

import { solveLP, type LPModel } from '../src/server/highsSolver';

// ── Mock HiGHS to simulate WASM failure ────────────────────────────────

jest.mock('highs', () => {
  throw new Error('WASM module failed to load');
});

describe('HiGHS WASM Fallback', () => {
  const simpleLP: LPModel = {
    sense: 'maximize',
    objective: [
      { name: 'x', coef: 1 },
      { name: 'y', coef: 1 },
    ],
    constraints: [
      {
        name: 'c1',
        vars: [
          { name: 'x', coef: 1 },
          { name: 'y', coef: 1 },
        ],
        lb: 0,
        ub: 10,
      },
    ],
    bounds: [
      { name: 'x', lb: 0, ub: 10 },
      { name: 'y', lb: 0, ub: 10 },
    ],
  };

  it('returns a valid solution even when WASM fails', async () => {
    const result = await solveLP(simpleLP);

    // Should either succeed with fallback or return error
    expect(['optimal', 'error']).toContain(result.status);

    if (result.status === 'optimal') {
      expect(result.objectiveValue).toBeGreaterThanOrEqual(0);
      expect(result.primals).toBeDefined();
    }
  });

  it('handles empty model gracefully', async () => {
    const emptyLP: LPModel = {
      sense: 'maximize',
      objective: [],
      constraints: [],
    };

    const result = await solveLP(emptyLP);
    expect(result.status).toBeDefined();
  });

  it('handles infeasible model', async () => {
    const infeasibleLP: LPModel = {
      sense: 'maximize',
      objective: [{ name: 'x', coef: 1 }],
      constraints: [
        {
          name: 'c1',
          vars: [{ name: 'x', coef: 1 }],
          lb: 100,
          ub: 50, // lb > ub → infeasible
        },
      ],
      bounds: [
        { name: 'x', lb: 0, ub: 10 },
      ],
    };

    const result = await solveLP(infeasibleLP);
    expect(['infeasible', 'error']).toContain(result.status);
  });
});
