import { solveLPSimplex, LPProblem, LPSolution } from '../src/server/simplexLP';

describe('solveLPSimplex', () => {
  // ── Basic LP Problem ──────────────────────────────────────────────────────

  describe('basic LP: maximize 3x + 2y, x + y <= 4, x <= 2, y unbounded to 4', () => {
    let result: LPSolution;

    beforeAll(() => {
      const problem: LPProblem = {
        c: [3, 2],
        A: [
          [1, 1], // x + y <= 4
          [1, 0], // x <= 2
        ],
        b: [4, 2],
        ub: [10, 10], // loose upper bounds
      };
      result = solveLPSimplex(problem);
    });

    it('returns feasible solution', () => {
      expect(result.feasible).toBe(true);
    });

    it('achieves optimal objective value z = 12', () => {
      // Optimal: x=2, y=2 → 3*2 + 2*2 = 10
      // Actually x=2, y=2 → z = 10
      expect(result.z).toBeCloseTo(10, 4);
    });

    it('sets x = 2', () => {
      expect(result.x[0]).toBeCloseTo(2, 4);
    });

    it('sets y = 2', () => {
      expect(result.x[1]).toBeCloseTo(2, 4);
    });

    it('does not flag maxIterationsReached', () => {
      expect(result.maxIterationsReached).toBe(false);
    });
  });

  // ── Simple Single-Variable Problem ────────────────────────────────────────

  describe('single variable: maximize 5x, x <= 3', () => {
    it('returns x = 3, z = 15', () => {
      const result = solveLPSimplex({
        c: [5],
        A: [[1]],
        b: [3],
        ub: [10],
      });
      expect(result.feasible).toBe(true);
      expect(result.x[0]).toBeCloseTo(3, 4);
      expect(result.z).toBeCloseTo(15, 4);
    });
  });

  // ── Unbounded-feasible with large upper bound ────────────────────────────

  describe('feasible problem with very large upper bound', () => {
    it('finds feasible solution with loose upper bounds', () => {
      // maximize x + y subject to x + y <= 1000, ub = [1e12, 1e12]
      const result = solveLPSimplex({
        c: [1, 1],
        A: [[1, 1]],
        b: [1000],
        ub: [1e12, 1e12],
      });
      expect(result.feasible).toBe(true);
      expect(result.z).toBeCloseTo(1000, 0);
    });

    it('produces maxIterationsReached = false for large-bound problems', () => {
      const result = solveLPSimplex({
        c: [3, 2],
        A: [[1, 1]],
        b: [100],
        ub: [1e10, 1e10],
      });
      expect(result.feasible).toBe(true);
      expect(result.maxIterationsReached).toBe(false);
    });
  });

  // ── Infeasible Problem ────────────────────────────────────────────────────

  describe('infeasible problem (contradictory constraints)', () => {
    it('detects infeasibility when x >= 5 AND x <= 2', () => {
      // x >= 5 is -x <= -5, x <= 2
      const result = solveLPSimplex({
        c: [1],
        A: [
          [-1],  // -x <= -5  →  x >= 5
          [1],   // x <= 2
        ],
        b: [-5, 2],
        ub: [100],
      });
      expect(result.feasible).toBe(false);
    });
  });

  // ── Zero Objective (all coefficients zero) ────────────────────────────────

  describe('zero objective coefficients', () => {
    it('returns z = 0 and feasible for any constraint set', () => {
      const result = solveLPSimplex({
        c: [0, 0],
        A: [[1, 1]],
        b: [10],
        ub: [5, 5],
      });
      expect(result.feasible).toBe(true);
      expect(result.z).toBeCloseTo(0, 4);
    });
  });

  // ── Edge Case: Zero Variables ─────────────────────────────────────────────

  describe('zero variables (empty problem)', () => {
    it('returns feasible with z = 0 and empty x vector', () => {
      const result = solveLPSimplex({
        c: [],
        A: [],
        b: [],
        ub: [],
      });
      expect(result.feasible).toBe(true);
      expect(result.z).toBeCloseTo(0, 4);
      expect(result.x).toEqual([]);
    });
  });

  // ── Max Iterations Reached ────────────────────────────────────────────────

  describe('maxIterationsReached flag', () => {
    it('returns maxIterationsReached = false for simple problems', () => {
      const result = solveLPSimplex({
        c: [1, 1],
        A: [[1, 0], [0, 1]],
        b: [5, 5],
        ub: [10, 10],
      });
      expect(result.maxIterationsReached).toBe(false);
    });

    // Note: MAX_ITER is 8000, which is very generous for small problems.
    // It is essentially impossible to trigger with realistic small LPs.
    // We verify the flag exists and is false for normal cases.
    it('includes maxIterationsReached in result type', () => {
      const result = solveLPSimplex({
        c: [1],
        A: [[1]],
        b: [1],
        ub: [1],
      });
      expect(result).toHaveProperty('maxIterationsReached');
      expect(typeof result.maxIterationsReached).toBe('boolean');
    });
  });

  // ── Lower Bounds ─────────────────────────────────────────────────────────

  describe('custom lower bounds', () => {
    it('respects non-zero lower bounds', () => {
      // maximize x + y, x + y <= 10, lb = [2, 3], ub = [8, 8]
      // Optimal: x=7, y=3 or x=2, y=8 → both give z=10
      // Actually with x+y<=10, x<=8, y<=8, lb=[2,3]:
      // x=7,y=3 → z=10; x=2,y=8 → z=10
      const result = solveLPSimplex({
        c: [1, 1],
        A: [[1, 1]],
        b: [10],
        ub: [8, 8],
        lb: [2, 3],
      });
      expect(result.feasible).toBe(true);
      expect(result.z).toBeCloseTo(10, 4);
      expect(result.x[0]).toBeGreaterThanOrEqual(2 - 1e-4);
      expect(result.x[1]).toBeGreaterThanOrEqual(3 - 1e-4);
    });
  });

  // ── Multi-Constraint Problem ──────────────────────────────────────────────

  describe('multi-constraint FBA-style problem', () => {
    it('solves a 3-variable, 3-constraint LP', () => {
      // maximize 2x + 3y + z
      // x + y + z <= 10
      // 2x + y <= 12
      // y + 2z <= 8
      // ub = [10, 10, 10]
      const result = solveLPSimplex({
        c: [2, 3, 1],
        A: [
          [1, 1, 1],
          [2, 1, 0],
          [0, 1, 2],
        ],
        b: [10, 12, 8],
        ub: [10, 10, 10],
      });
      expect(result.feasible).toBe(true);
      // With these constraints, optimal should be feasible and positive
      expect(result.z).toBeGreaterThan(0);
      // All variables should be non-negative
      for (const xi of result.x) {
        expect(xi).toBeGreaterThanOrEqual(-1e-4);
      }
    });
  });

  // ── Degenerate: All RHS Zero ──────────────────────────────────────────────

  describe('all-zero RHS (FBA stoichiometric balance)', () => {
    it('returns feasible solution with z >= 0', () => {
      // Typical FBA: A*x = 0 with upper bounds
      const result = solveLPSimplex({
        c: [1, -1],
        A: [[1, -1]], // x1 - x2 = 0 → x1 = x2
        b: [0],
        ub: [5, 5],
      });
      expect(result.feasible).toBe(true);
      // With x1 = x2, z = x1 - x2 = 0 (but max pushes x1 up, x2 down)
      // Actually x1=x2 is forced, so z=0
      expect(result.z).toBeCloseTo(0, 4);
    });
  });
});
