/**
 * Pure TypeScript bounded-variable simplex LP solver.
 *
 * Solves:  max  c^T x
 *          s.t. A x = b   (stoichiometric balance — b = 0 for FBA)
 *               0 ≤ x ≤ ub
 *
 * Algorithm:
 *   Variables:  y = x - lb  (shifted to lb = 0)
 *               s_j = u_j - y_j  (upper-bound slacks)
 *               a_k              (artificials for A y = bAdj rows)
 *
 *   Phase 1 (b = 0 case): pivot each artificial out greedily — no ratio
 *   test needed because all artificials start at value 0.
 *
 *   Phase 2: standard simplex minimising -c^T y; artificials are excluded
 *   from entering.
 *
 * Designed for small FBA networks (≤ 20 reactions, ≤ 12 constraints).
 */

export interface LPProblem {
  /** Objective coefficients (maximise c^T x). */
  c: number[];
  /** Constraint matrix, m × n. */
  A: number[][];
  /** RHS vector, length m.  Must be 0 for every row when lb = 0 (FBA). */
  b: number[];
  /** Upper bounds, length n. */
  ub: number[];
  /** Lower bounds, length n.  Defaults to all-zeros. */
  lb?: number[];
}

export interface LPSolution {
  feasible: boolean;
  z: number;
  x: number[];
}

const EPS = 1e-9;
const MAX_ITER = 8000;

export function solveLPSimplex({ c, A, b, ub, lb: lbRaw }: LPProblem): LPSolution {
  const m = A.length;
  const n = c.length;
  const lb = lbRaw ?? Array(n).fill(0);

  // Shift: y_i = x_i - lb_i  →  0 ≤ y_i ≤ u_i
  const u = ub.map((u_i, i) => Math.max(0, u_i - lb[i]));
  const bAdj = b.map((b_i, i) =>
    b_i - A[i].reduce((s, a_ij, j) => s + a_ij * lb[j], 0),
  );

  // Variable layout  (total nV = 2n + m):
  //   [0 .. n-1]        original y_j
  //   [n .. 2n-1]       upper-bound slack s_j  (s_j = u_j − y_j ≥ 0)
  //   [2n .. 2n+m-1]    artificial a_k
  //
  // Row layout  (total nR = m + n):
  //   [0 .. m-1]        stoichiometric:  A y + a = bAdj
  //   [m .. m+n-1]      upper bounds:    y_j + s_j = u_j
  const nV = 2 * n + m;
  const nR = m + n;
  const RHS = nV; // column index for right-hand side

  // ── Build initial tableau ────────────────────────────────────────────────
  const T: Float64Array[] = Array.from({ length: nR }, () => new Float64Array(nV + 1));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) T[i][j] = A[i][j];
    T[i][2 * n + i] = 1;    // artificial a_i
    T[i][RHS] = bAdj[i];
  }
  for (let j = 0; j < n; j++) {
    T[m + j][j] = 1;         // y_j
    T[m + j][n + j] = 1;     // s_j
    T[m + j][RHS] = u[j];
  }

  // Initial basis: artificials for stoichiometric rows, slacks for bound rows
  const basis = new Int32Array(nR);
  for (let i = 0; i < m; i++) basis[i] = 2 * n + i;
  for (let j = 0; j < n; j++) basis[m + j] = n + j;

  // ── Phase 1: drive degenerate artificials out (valid because bAdj = 0) ──
  // Since bAdj[i] = 0 all artificials are at value 0. We just find a non-
  // artificial column with non-zero coefficient in row i and pivot it in.
  // Stoichiometric row RHS stays 0 throughout (ratio of 0 / anything = 0),
  // so no feasibility can be lost.
  for (let i = 0; i < m; i++) {
    if (basis[i] < 2 * n) continue; // not an artificial
    let pivCol = -1;
    for (let j = 0; j < 2 * n; j++) {
      if (Math.abs(T[i][j]) > EPS) { pivCol = j; break; }
    }
    if (pivCol === -1) continue; // redundant row — leave artificial at 0

    basis[i] = pivCol;
    const piv = T[i][pivCol];
    for (let k = 0; k <= RHS; k++) T[i][k] /= piv;
    for (let ii = 0; ii < nR; ii++) {
      if (ii === i) continue;
      const f = T[ii][pivCol];
      if (Math.abs(f) < EPS) continue;
      for (let k = 0; k <= RHS; k++) T[ii][k] -= f * T[i][k];
    }
  }

  // ── Phase 2: maximise c^T y using the current basis ─────────────────────
  const obj = new Float64Array(nV + 1);
  for (let j = 0; j < n; j++) obj[j] = -c[j]; // negate → minimise

  // Canonicalise objective for current basis
  for (let i = 0; i < nR; i++) {
    const bv = basis[i];
    const coef = obj[bv];
    if (Math.abs(coef) > EPS) {
      for (let k = 0; k <= RHS; k++) obj[k] -= coef * T[i][k];
    }
  }

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Entering variable: most negative reduced cost (exclude artificials)
    let enterCol = -1;
    let minRC = -EPS;
    for (let j = 0; j < 2 * n; j++) {
      if (obj[j] < minRC) { minRC = obj[j]; enterCol = j; }
    }
    if (enterCol === -1) break; // optimal

    // Minimum-ratio test
    let leaveRow = -1;
    let minRatio = Infinity;
    for (let i = 0; i < nR; i++) {
      const aij = T[i][enterCol];
      if (aij > EPS) {
        const ratio = T[i][RHS] / aij;
        if (ratio < minRatio - EPS) { minRatio = ratio; leaveRow = i; }
      }
    }
    if (leaveRow === -1) break; // unbounded (shouldn't happen with finite ub)

    // Pivot
    basis[leaveRow] = enterCol;
    const piv = T[leaveRow][enterCol];
    for (let k = 0; k <= RHS; k++) T[leaveRow][k] /= piv;

    for (let i = 0; i < nR; i++) {
      if (i === leaveRow) continue;
      const f = T[i][enterCol];
      if (Math.abs(f) < EPS) continue;
      for (let k = 0; k <= RHS; k++) T[i][k] -= f * T[leaveRow][k];
    }
    const fo = obj[enterCol];
    if (Math.abs(fo) > EPS) {
      for (let k = 0; k <= RHS; k++) obj[k] -= fo * T[leaveRow][k];
    }
  }

  // ── Extract solution ─────────────────────────────────────────────────────
  const y = new Float64Array(n);
  for (let i = 0; i < nR; i++) {
    const bv = basis[i];
    if (bv < n) y[bv] = Math.max(0, T[i][RHS]);
  }

  // Feasibility: any artificial remaining as basic with non-zero value?
  let infeasAmt = 0;
  for (let i = 0; i < nR; i++) {
    if (basis[i] >= 2 * n) infeasAmt = Math.max(infeasAmt, Math.abs(T[i][RHS]));
  }

  const x = Array.from(y, (yi, i) => yi + lb[i]);
  const z = c.reduce((s, ci, i) => s + ci * x[i], 0);
  return { feasible: infeasAmt < 1e-4, z, x };
}
