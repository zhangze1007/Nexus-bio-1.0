import { solveLP, type LPModel } from '../../src/server/highsSolver';

describe('HiGHS MILP support', () => {
  it('solves a simple binary LP (knockout selection)', async () => {
    const model: LPModel = {
      sense: 'maximize',
      objective: [
        { name: 'x1', coef: 2 },
        { name: 'x2', coef: 3 },
        { name: 'x3', coef: 1 },
      ],
      constraints: [
        {
          name: 'knockout_limit',
          vars: [
            { name: 'x1', coef: 1 },
            { name: 'x2', coef: 1 },
            { name: 'x3', coef: 1 },
          ],
          lb: -Infinity,
          ub: 2,
        },
      ],
      bounds: [
        { name: 'x1', lb: 0, ub: 1 },
        { name: 'x2', lb: 0, ub: 1 },
        { name: 'x3', lb: 0, ub: 1 },
      ],
      binaries: ['x1', 'x2', 'x3'],
    };

    const result = await solveLP(model);

    expect(result.status).toBe('optimal');
    // Best binary solution: x1=1, x2=1, x3=0 → objective = 2+3+0 = 5
    // But constraint sum <= 2 so at most 2 variables can be 1.
    // Pick the two highest: x1(2) + x2(3) = 5
    expect(result.objectiveValue).toBeCloseTo(5, 6);

    // All primal values should be exactly 0 or 1 (binary)
    for (const v of Object.values(result.primals)) {
      expect([0, 1]).toContain(Math.round(v));
    }

    // Exactly two variables should be 1
    const ones = Object.values(result.primals).filter(
      (v) => Math.round(v) === 1,
    );
    expect(ones.length).toBe(2);
  });

  it('solves an integer LP (gene copy number)', async () => {
    const model: LPModel = {
      sense: 'maximize',
      objective: [
        { name: 'copy_a', coef: 5 },
        { name: 'copy_b', coef: 3 },
      ],
      constraints: [
        {
          name: 'plasmid_capacity',
          vars: [
            { name: 'copy_a', coef: 1 },
            { name: 'copy_b', coef: 1 },
          ],
          lb: -Infinity,
          ub: 4,
        },
      ],
      bounds: [
        { name: 'copy_a', lb: 0, ub: 4 },
        { name: 'copy_b', lb: 0, ub: 4 },
      ],
      integers: ['copy_a', 'copy_b'],
    };

    const result = await solveLP(model);

    expect(result.status).toBe('optimal');
    // Best: copy_a=4, copy_b=0 → 5*4 = 20
    expect(result.objectiveValue).toBeCloseTo(20, 6);

    // All values should be integers
    for (const v of Object.values(result.primals)) {
      expect(v).toBeCloseTo(Math.round(v), 6);
    }
  });

  it('builds correct LP string with Binary section', () => {
    // We test the LP string indirectly by solving and checking status.
    // A pure CPLEX LP string with Binary section should be parseable by HiGHS.
    const model: LPModel = {
      sense: 'minimize',
      objective: [{ name: 'y', coef: 1 }],
      constraints: [
        {
          name: 'c1',
          vars: [{ name: 'y', coef: 1 }],
          lb: 0.5,
          ub: Infinity,
        },
      ],
      bounds: [{ name: 'y', lb: 0, ub: 1 }],
      binaries: ['y'],
    };

    // With binary constraint and y >= 0.5, y must be 1
    return solveLP(model).then((result) => {
      expect(result.status).toBe('optimal');
      expect(result.objectiveValue).toBeCloseTo(1, 6);
      expect(result.primals['y']).toBeCloseTo(1, 6);
    });
  });

  it('handles empty binaries and integers arrays gracefully', async () => {
    const model: LPModel = {
      sense: 'maximize',
      objective: [{ name: 'z', coef: 1 }],
      constraints: [
        {
          name: 'c1',
          vars: [{ name: 'z', coef: 1 }],
          lb: -Infinity,
          ub: 5,
        },
      ],
      bounds: [{ name: 'z', lb: 0, ub: 10 }],
      binaries: [],
      integers: [],
    };

    const result = await solveLP(model);
    expect(result.status).toBe('optimal');
    expect(result.objectiveValue).toBeCloseTo(5, 6);
  });
});
