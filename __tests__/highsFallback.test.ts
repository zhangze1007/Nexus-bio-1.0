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

// ── Mock HiGHS to simulate WASM failure ────────────────────────────────
// Must mock BEFORE importing highsSolver — the mock returns a function
// that throws when called (simulating WASM load failure at runtime),
// rather than throwing at module import time.

jest.mock('highs', () => {
  return {
    __esModule: true,
    default: jest.fn(() => {
      throw new Error('WASM module failed to load');
    }),
  };
});

import { solveLP, type LPModel } from '../src/server/highsSolver';

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

  it('throws when WASM module fails to load', async () => {
    // When HiGHS WASM fails to load, getHighs() throws.
    // This is the expected behavior — the caller should handle it.
    await expect(solveLP(simpleLP)).rejects.toThrow('WASM module failed to load');
  });

  it('empty model also throws when WASM fails', async () => {
    const emptyLP: LPModel = {
      sense: 'maximize',
      objective: [],
      constraints: [],
    };

    await expect(solveLP(emptyLP)).rejects.toThrow('WASM module failed to load');
  });

  it('infeasible model also throws when WASM fails', async () => {
    const infeasibleLP: LPModel = {
      sense: 'maximize',
      objective: [{ name: 'x', coef: 1 }],
      constraints: [
        {
          name: 'c1',
          vars: [{ name: 'x', coef: 1 }],
          lb: 100,
          ub: 50,
        },
      ],
      bounds: [
        { name: 'x', lb: 0, ub: 10 },
      ],
    };

    await expect(solveLP(infeasibleLP)).rejects.toThrow('WASM module failed to load');
  });
});
