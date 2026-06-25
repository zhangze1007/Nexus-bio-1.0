/**
 * Jacobian Analysis
 *
 * Computes the Jacobian matrix of an ODE system at a given point using
 * finite differences, then finds eigenvalues via QR iteration.
 *
 * Used for stability analysis of gene circuit designs:
 *   - All eigenvalues < 0 → stable fixed point
 *   - Any eigenvalue > 0 → unstable
 *   - Complex eigenvalues → oscillatory behavior
 *
 * @scientific_provenance
 *   ALGORITHM: Central finite-difference Jacobian + QR iteration with Wilkinson shift (modified Gram-Schmidt)
 *   REFERENCE:
 *     Strogatz SH (2015) "Nonlinear Dynamics and Chaos" 2nd ed., Westview Press, ISBN 978-0813349107
 *     Golub GH, Van Loan CF (2013) "Matrix Computations" 4th ed., Johns Hopkins University Press (QR algorithm)
 *   KNOWN_LIMITATIONS:
 *     - Returns only real parts of eigenvalues; complex eigenvalue pairs require separate tracking
 *     - Oscillation detection is heuristic (Jacobian asymmetry threshold), not based on imaginary eigenvalue parts
 *     - Finite-difference step size h=1e-6 is fixed; stiff systems may need adaptive stepping
 *     - QR iteration may not converge for defective or nearly-defective matrices within 100 iterations
 *     - Condition number estimate uses eigenvalue ratio only; ignores off-diagonal structure
 */

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface JacobianResult {
  /** Jacobian matrix [dim × dim] */
  jacobian: number[][];
  /** Real parts of eigenvalues */
  eigenvalues: number[];
  /** Largest eigenvalue (real part) */
  maxEigenvalue: number;
  /** True if all eigenvalues are negative (stable fixed point) */
  isStable: boolean;
  /** True if any eigenvalue has significant imaginary component */
  isOscillatory: boolean;
  /** Condition number estimate (ratio of largest to smallest |eigenvalue|) */
  conditionNumber: number;
}

// ── Finite-Difference Jacobian ──────────────────────────────────────────────

/**
 * Compute the Jacobian matrix of f(y) at point y0 using central finite differences.
 *
 * J_ij = (f_i(y0 + h*e_j) - f_i(y0 - h*e_j)) / (2h)
 *
 * @param f - Derivatives function: dy/dt = f(t, y)
 * @param y0 - Point at which to evaluate the Jacobian
 * @param t0 - Time at which to evaluate (default 0)
 * @param h - Finite difference step size (default 1e-6)
 * @returns Jacobian matrix [dim × dim]
 */
export function computeJacobian(f: (t: number, y: number[]) => number[], y0: number[], t0 = 0, h = 1e-6): number[][] {
  const dim = y0.length;
  const f0 = f(t0, y0);
  const jacobian: number[][] = [];

  for (let i = 0; i < dim; i++) {
    jacobian.push(new Array(dim).fill(0));
  }

  for (let j = 0; j < dim; j++) {
    // Perturb y0 in direction j
    const yPlus = [...y0];
    const yMinus = [...y0];
    yPlus[j] += h;
    yMinus[j] -= h;

    const fPlus = f(t0, yPlus);
    const fMinus = f(t0, yMinus);

    for (let i = 0; i < dim; i++) {
      jacobian[i][j] = (fPlus[i] - fMinus[i]) / (2 * h);
    }
  }

  return jacobian;
}

// ── Eigenvalue Computation ──────────────────────────────────────────────────

/**
 * Find eigenvalues of a matrix using the QR algorithm with shifts.
 *
 * For small matrices (dim ≤ 20), this is efficient and accurate.
 * Returns real parts of eigenvalues.
 *
 * @param matrix - Square matrix [dim × dim]
 * @param maxIterations - Maximum QR iterations (default 100)
 * @param tolerance - Convergence tolerance (default 1e-10)
 * @returns Array of eigenvalue real parts
 */
export function findEigenvalues(matrix: number[][], maxIterations = 100, tolerance = 1e-10): number[] {
  const dim = matrix.length;
  if (dim === 0) return [];
  if (dim === 1) return [matrix[0][0]];

  // Make a working copy
  let A = matrix.map((row) => [...row]);

  // QR iteration with Wilkinson shift
  for (let iter = 0; iter < maxIterations; iter++) {
    // Check convergence: subdiagonal elements small
    let converged = true;
    for (let i = 0; i < dim - 1; i++) {
      if (Math.abs(A[i + 1][i]) > tolerance * (Math.abs(A[i][i]) + Math.abs(A[i + 1][i + 1]))) {
        converged = false;
        break;
      }
    }
    if (converged) break;

    // Wilkinson shift: use eigenvalue of bottom 2×2 block closest to A[n-1][n-1]
    const n = dim;
    const a = A[n - 2][n - 2];
    const b = A[n - 2][n - 1];
    const c = A[n - 1][n - 2];
    const d = A[n - 1][n - 1];
    const trace = a + d;
    const det = a * d - b * c;
    const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
    const lambda1 = trace / 2 + disc;
    const lambda2 = trace / 2 - disc;
    const shift = Math.abs(lambda1 - d) < Math.abs(lambda2 - d) ? lambda1 : lambda2;

    // Shift
    A = A.map((row, i) => row.map((val, j) => val - (i === j ? shift : 0)));

    // QR decomposition (Gram-Schmidt)
    const { Q, R } = qrDecomposition(A);

    // A = R*Q + shift
    A = multiplyMatrices(R, Q);
    A = A.map((row, i) => row.map((val, j) => val + (i === j ? shift : 0)));
  }

  // Extract eigenvalues from diagonal
  return A.map((row, i) => row[i]);
}

/**
 * QR decomposition using modified Gram-Schmidt.
 */
function qrDecomposition(A: number[][]): { Q: number[][]; R: number[][] } {
  const n = A.length;
  const Q: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const R: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  // Copy columns of A
  const columns: number[][] = [];
  for (let j = 0; j < n; j++) {
    columns.push(A.map((row) => row[j]));
  }

  for (let j = 0; j < n; j++) {
    let v = [...columns[j]];

    for (let i = 0; i < j; i++) {
      const qi = Q.map((row) => row[i]);
      const dot = v.reduce((s, val, k) => s + val * qi[k], 0);
      R[i][j] = dot;
      v = v.map((val, k) => val - dot * qi[k]);
    }

    const norm = Math.sqrt(v.reduce((s, val) => s + val * val, 0));
    R[j][j] = norm;

    if (norm > 1e-15) {
      for (let i = 0; i < n; i++) {
        Q[i][j] = v[i] / norm;
      }
    }
  }

  return { Q, R };
}

function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const C: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

// ── Full Analysis ───────────────────────────────────────────────────────────

/**
 * Perform complete Jacobian stability analysis at a given point.
 *
 * @param f - Derivatives function: dy/dt = f(t, y)
 * @param y0 - Steady-state point to analyze
 * @param t0 - Time (default 0)
 * @returns Full Jacobian analysis result
 */
export function analyzeStability(f: (t: number, y: number[]) => number[], y0: number[], t0 = 0): JacobianResult {
  const jacobian = computeJacobian(f, y0, t0);
  const eigenvalues = findEigenvalues(jacobian);
  const maxEigenvalue = Math.max(...eigenvalues);
  const isStable = eigenvalues.every((ev) => ev < 0);

  // Check for oscillatory behavior: significant imaginary components
  // We approximate this by checking if the Jacobian has asymmetric parts
  let asymmetry = 0;
  const dim = jacobian.length;
  for (let i = 0; i < dim; i++) {
    for (let j = i + 1; j < dim; j++) {
      asymmetry += Math.abs(jacobian[i][j] - jacobian[j][i]);
    }
  }
  const isOscillatory = asymmetry > 0.1 * dim;

  // Condition number
  const absEigenvalues = eigenvalues.map(Math.abs).filter((v) => v > 1e-15);
  const conditionNumber = absEigenvalues.length > 1 ? Math.max(...absEigenvalues) / Math.min(...absEigenvalues) : 1;

  return {
    jacobian,
    eigenvalues,
    maxEigenvalue: Math.round(maxEigenvalue * 1e6) / 1e6,
    isStable,
    isOscillatory,
    conditionNumber: Math.round(conditionNumber * 100) / 100,
  };
}
