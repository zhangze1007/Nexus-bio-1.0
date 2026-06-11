/**
 * Kinetics Engine Core
 *
 * Comprehensive enzyme kinetics models covering:
 *   - Competitive, uncompetitive, mixed, and substrate inhibition
 *   - Hill equation for cooperative binding
 *   - Multi-enzyme coupled ODE simulation via RK4
 *
 * All functions use SI units where:
 *   - Vmax in concentration/time (e.g. mM/s)
 *   - Km, Ki, K50 in concentration (e.g. mM)
 *   - S, I in concentration (e.g. mM)
 *   - n (Hill coefficient) is dimensionless
 */

// ─── Inhibition Models ──────────────────────────────────────────

/**
 * Competitive inhibition.
 * Inhibitor competes with substrate for the active site.
 *
 * v = Vmax * S / (Km * (1 + I/Ki) + S)
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param km    Michaelis constant
 * @param ki    Inhibition constant
 * @param i     Inhibitor concentration
 */
export function competitiveInhibition(
  vmax: number,
  s: number,
  km: number,
  ki: number,
  i: number,
): number {
  const sSafe = Math.max(0, s);
  if (ki <= 0 || i <= 0) {
    // No effective inhibition — reduce to plain MM
    const denom = km + sSafe;
    return denom <= 0 ? 0 : (vmax * sSafe) / denom;
  }
  const kmEff = km * (1 + i / ki);
  const denom = kmEff + sSafe;
  if (denom <= 0) return 0;
  return (vmax * sSafe) / denom;
}

/**
 * Uncompetitive inhibition.
 * Inhibitor binds only to the enzyme-substrate complex.
 *
 * v = Vmax * S / (Km + S * (1 + I/Kiu))
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param km    Michaelis constant
 * @param kiu   Uncompetitive inhibition constant
 * @param i     Inhibitor concentration
 */
export function uncompetitiveInhibition(
  vmax: number,
  s: number,
  km: number,
  kiu: number,
  i: number,
): number {
  const sSafe = Math.max(0, s);
  if (kiu <= 0 || i <= 0) {
    const denom = km + sSafe;
    return denom <= 0 ? 0 : (vmax * sSafe) / denom;
  }
  const denom = km + sSafe * (1 + i / kiu);
  if (denom <= 0) return 0;
  return (vmax * sSafe) / denom;
}

/**
 * Mixed inhibition.
 * Inhibitor binds both free enzyme and ES complex with different constants.
 *
 * v = Vmax * S / (Km * (1 + I/Kic) + S * (1 + I/Kiu))
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param km    Michaelis constant
 * @param kic   Competitive inhibition constant (binding to free E)
 * @param kiu   Uncompetitive inhibition constant (binding to ES)
 * @param i     Inhibitor concentration
 */
export function mixedInhibition(
  vmax: number,
  s: number,
  km: number,
  kic: number,
  kiu: number,
  i: number,
): number {
  const sSafe = Math.max(0, s);
  const hasCompetitive = kic > 0 && i > 0;
  const hasUncompetitive = kiu > 0 && i > 0;

  if (!hasCompetitive && !hasUncompetitive) {
    const denom = km + sSafe;
    return denom <= 0 ? 0 : (vmax * sSafe) / denom;
  }

  const kmFactor = hasCompetitive ? 1 + i / kic : 1;
  const sFactor = hasUncompetitive ? 1 + i / kiu : 1;
  const denom = km * kmFactor + sSafe * sFactor;
  if (denom <= 0) return 0;
  return (vmax * sSafe) / denom;
}

/**
 * Substrate inhibition.
 * Excess substrate inhibits the enzyme (common in oxidases, esterases).
 *
 * v = Vmax * S / (Km + S + S^2 / Kis)
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param km    Michaelis constant
 * @param kis   Substrate inhibition constant
 */
export function substrateInhibition(
  vmax: number,
  s: number,
  km: number,
  kis: number,
): number {
  const sSafe = Math.max(0, s);
  if (kis <= 0) {
    // No substrate inhibition — plain MM
    const denom = km + sSafe;
    return denom <= 0 ? 0 : (vmax * sSafe) / denom;
  }
  const denom = km + sSafe + (sSafe * sSafe) / kis;
  if (denom <= 0) return 0;
  return (vmax * sSafe) / denom;
}

// ─── Parameter Estimation (Levenberg-Marquardt) ────────────────

/** Inhibition model types for parameter estimation. */
export type InhibitionModel = 'competitive' | 'uncompetitive' | 'mixed';

/** A single (substrate, velocity) observation. */
export interface KineticDataPoint {
  s: number;
  v: number;
  /** Inhibitor concentration (required for inhibition models) */
  i?: number;
}

/** Configuration for parameter estimation. */
export interface ParameterEstimationConfig {
  /** Maximum iterations (default: 500) */
  maxIter?: number;
  /** Parameter tolerance for convergence (default: 1e-8) */
  tolP?: number;
  /** Gradient tolerance for convergence (default: 1e-8) */
  tolG?: number;
  /** Initial damping factor (default: 1e-3) */
  lambda0?: number;
  /** Damping growth/shrink factors (default: 10) */
  lambdaUp?: number;
  lambdaDown?: number;
}

/** Result of parameter estimation. */
export interface ParameterEstimationResult {
  /** Best-fit parameters (always positive after clamping) */
  params: number[];
  /** Residual sum of squares at convergence */
  rss: number;
  /** Number of iterations used */
  iterations: number;
  /** Whether the solver converged (vs hit max iterations) */
  converged: boolean;
  /** Per-point residuals at convergence */
  residuals: number[];
}

/**
 * Compute model velocity for a given inhibition model.
 *
 * This is an internal helper used by the LM solver to evaluate the model
 * at different parameter values during optimization.
 *
 * @param model   Inhibition model type
 * @param params  Parameter array:
 *                  competitive: [Vmax, Km, Ki]
 *                  uncompetitive: [Vmax, Km, Kiu]
 *                  mixed: [Vmax, Km, Kic, Kiu]
 * @param s       Substrate concentration
 * @param i       Inhibitor concentration (0 or undefined = no inhibition)
 */
function modelVelocity(
  model: InhibitionModel,
  params: number[],
  s: number,
  i: number,
): number {
  const sSafe = Math.max(0, s);
  const iVal = Math.max(0, i);

  switch (model) {
    case 'competitive': {
      const [vmax, km, ki] = params;
      if (ki <= 0 || iVal <= 0) {
        const denom = km + sSafe;
        return denom <= 0 ? 0 : (vmax * sSafe) / denom;
      }
      const denom = km * (1 + iVal / ki) + sSafe;
      return denom <= 0 ? 0 : (vmax * sSafe) / denom;
    }
    case 'uncompetitive': {
      const [vmax, km, kiu] = params;
      if (kiu <= 0 || iVal <= 0) {
        const denom = km + sSafe;
        return denom <= 0 ? 0 : (vmax * sSafe) / denom;
      }
      const denom = km + sSafe * (1 + iVal / kiu);
      return denom <= 0 ? 0 : (vmax * sSafe) / denom;
    }
    case 'mixed': {
      const [vmax, km, kic, kiu] = params;
      const hasComp = kic > 0 && iVal > 0;
      const hasUncomp = kiu > 0 && iVal > 0;
      if (!hasComp && !hasUncomp) {
        const denom = km + sSafe;
        return denom <= 0 ? 0 : (vmax * sSafe) / denom;
      }
      const kmFactor = hasComp ? 1 + iVal / kic : 1;
      const sFactor = hasUncomp ? 1 + iVal / kiu : 1;
      const denom = km * kmFactor + sSafe * sFactor;
      return denom <= 0 ? 0 : (vmax * sSafe) / denom;
    }
  }
}

/**
 * Compute residuals: r_j = model(s_j, params) - v_obs_j
 */
function computeResiduals(
  model: InhibitionModel,
  params: number[],
  data: KineticDataPoint[],
): number[] {
  return data.map(d => {
    const vPred = modelVelocity(model, params, d.s, d.i ?? 0);
    return vPred - d.v;
  });
}

/**
 * Compute the Jacobian matrix via central finite differences.
 *
 * J[j][k] = d(r_j) / d(params_k) ≈ (f(p + eps) - f(p - eps)) / (2 * eps)
 *
 * This avoids the need for analytical derivatives for each model variant,
 * at the cost of 2*nParams function evaluations per iteration.
 */
function computeJacobian(
  model: InhibitionModel,
  params: number[],
  data: KineticDataPoint[],
): number[][] {
  const nParams = params.length;
  const nData = data.length;
  const J: number[][] = Array.from({ length: nData }, () => new Array(nParams));

  for (let k = 0; k < nParams; k++) {
    // Scale epsilon relative to parameter magnitude for numerical stability
    const eps = Math.max(1e-8, 1e-5 * Math.abs(params[k]));

    // Perturb parameter k upward
    const pPlus = [...params];
    pPlus[k] = params[k] + eps;

    // Perturb parameter k downward
    const pMinus = [...params];
    pMinus[k] = params[k] - eps;

    for (let j = 0; j < nData; j++) {
      const vPlus = modelVelocity(model, pPlus, data[j].s, data[j].i ?? 0);
      const vMinus = modelVelocity(model, pMinus, data[j].s, data[j].i ?? 0);
      J[j][k] = (vPlus - vMinus) / (2 * eps);
    }
  }

  return J;
}

/**
 * Estimate kinetic parameters by fitting to experimental data using
 * Levenberg-Marquardt optimization.
 *
 * Supports three inhibition models:
 *   - **competitive**: fits [Vmax, Km, Ki]
 *   - **uncompetitive**: fits [Vmax, Km, Kiu]
 *   - **mixed**: fits [Vmax, Km, Kic, Kiu]
 *
 * The algorithm iteratively minimizes the sum of squared residuals between
 * model predictions and observed velocities using the update rule:
 *
 *   (J^T J + lambda * diag(J^T J)) * delta = J^T * r
 *
 * where lambda grows on failed steps (gradient descent) and shrinks on
 * successful steps (Gauss-Newton). Parameters are clamped to positive values
 * since Km, Vmax, and Ki are physical quantities that must be > 0.
 *
 * @param model         Inhibition model type
 * @param experimentalData  Array of {s, v, i?} observations
 * @param initialGuess  Starting parameter values [Vmax, Km, ...]
 * @param config        Optional solver configuration
 * @returns             Fitted parameters, RSS, convergence info
 */
export function estimateParameters(
  model: InhibitionModel,
  experimentalData: KineticDataPoint[],
  initialGuess: number[],
  config?: ParameterEstimationConfig,
): ParameterEstimationResult {
  const maxIter = config?.maxIter ?? 500;
  const tolP = config?.tolP ?? 1e-8;
  const tolG = config?.tolG ?? 1e-8;
  let lambda = config?.lambda0 ?? 1e-3;
  const lambdaUp = config?.lambdaUp ?? 10;
  const lambdaDown = config?.lambdaDown ?? 10;

  const nParams = initialGuess.length;
  const nData = experimentalData.length;
  let params = initialGuess.map(p => Math.max(1e-12, p));
  let residuals = computeResiduals(model, params, experimentalData);
  let rss = residuals.reduce((s, r) => s + r * r, 0);

  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    const J = computeJacobian(model, params, experimentalData);

    // J^T * J
    const JtJ: number[][] = Array.from({ length: nParams }, () => new Array(nParams).fill(0));
    for (let k = 0; k < nParams; k++) {
      for (let l = 0; l < nParams; l++) {
        let sum = 0;
        for (let j = 0; j < nData; j++) {
          sum += J[j][k] * J[j][l];
        }
        JtJ[k][l] = sum;
      }
    }

    // J^T * r
    const JtR: number[] = new Array(nParams).fill(0);
    for (let k = 0; k < nParams; k++) {
      let sum = 0;
      for (let j = 0; j < nData; j++) {
        sum += J[j][k] * residuals[j];
      }
      JtR[k] = sum;
    }

    // Check gradient convergence: ||J^T * r|| / nData < tolG
    const gradNorm = Math.sqrt(JtR.reduce((s, g) => s + g * g, 0)) / nData;
    if (gradNorm < tolG) {
      converged = true;
      break;
    }

    // Build damped normal equations with Tikhonov regularization:
    //   (J^T J + lambda * diag(J^T J) + eps * I) * delta = -J^T * r
    // The eps*I term ensures positive-definiteness for rank-deficient Jacobians
    // (e.g., when I=0 makes Ki unidentifiable in competitive inhibition).
    const eps = 1e-10;
    const A: number[][] = JtJ.map((row, k) =>
      row.map((val, l) => (k === l ? val + lambda * JtJ[k][k] + eps : val)),
    );
    const b: number[] = JtR.map(g => -g);

    // Solve via Gauss elimination with partial pivoting
    const delta = solveLinearSystem(A, b);

    if (delta !== null) {
      // Candidate new parameters (clamp to positive)
      const pNew = params.map((p, k) => Math.max(1e-12, p + delta[k]));

      // Evaluate new residuals and RSS
      const rNew = computeResiduals(model, pNew, experimentalData);
      const rssNew = rNew.reduce((s, r) => s + r * r, 0);

      // Compute predicted reduction from quadratic model
      let predictedReduction = 0;
      for (let k = 0; k < nParams; k++) {
        predictedReduction += delta[k] * (lambda * JtJ[k][k] * delta[k] + JtR[k]);
      }
      const actualReduction = rss - rssNew;

      if (actualReduction > 0) {
        // Step accepted — compute gain ratio
        const gainRatio = predictedReduction > 0
          ? actualReduction / predictedReduction
          : 1.0; // If predicted is negative/zero, model is wrong — treat as okay step

        const paramDelta = params.map((p, k) =>
          Math.abs(pNew[k] - p) / Math.max(1e-12, Math.abs(p)),
        );
        const maxParamDelta = Math.max(...paramDelta);

        params = pNew;
        residuals = rNew;
        rss = rssNew;

        // Update lambda using gain ratio
        if (gainRatio > 0.75) {
          lambda = Math.max(1e-15, lambda / (lambdaDown * lambdaDown));
        } else if (gainRatio > 0.25) {
          lambda = Math.max(1e-15, lambda / lambdaDown);
        }
        // gainRatio <= 0.25: keep lambda unchanged

        // Check parameter convergence
        if (maxParamDelta < tolP) {
          converged = true;
          break;
        }
      } else {
        // Step rejected — grow lambda
        lambda = Math.min(1e12, lambda * lambdaUp);
      }
    } else {
      // Singular system — grow lambda and retry
      lambda = Math.min(1e12, lambda * lambdaUp);
    }
  }

  return { params, rss, iterations, converged, residuals };
}

/**
 * Solve a linear system Ax = b via Gauss elimination with partial pivoting.
 *
 * Returns null if the system is singular (detected pivot < epsilon).
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Augmented matrix
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxVal = Math.abs(M[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-14) return null; // Singular

    // Swap rows
    if (maxRow !== col) {
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back-substitution
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    if (Math.abs(M[row][row]) < 1e-14) return null;
    let sum = M[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= M[row][col] * x[col];
    }
    x[row] = sum / M[row][row];
  }

  return x;
}

// ─── Hill Equation ──────────────────────────────────────────────

/**
 * Hill equation for cooperative substrate binding.
 *
 * v = Vmax * S^n / (K50^n + S^n)
 *
 * When n = 1 this reduces to standard Michaelis-Menten.
 * When n > 1 the curve is sigmoidal (positive cooperativity).
 * When n < 1 the curve is sub-hyperbolic (negative cooperativity).
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param k50   Substrate concentration at half-max velocity
 * @param n     Hill coefficient
 */
export function hillEquation(
  vmax: number,
  s: number,
  k50: number,
  n: number,
): number {
  const sSafe = Math.max(0, s);
  if (k50 <= 0) return sSafe > 0 ? vmax : 0;
  const sn = Math.pow(sSafe, n);
  const k50n = Math.pow(k50, n);
  const denom = k50n + sn;
  if (denom <= 0) return 0;
  return (vmax * sn) / denom;
}

// ─── Dormand-Prince Adaptive ODE Solver ───────────────────────

/** Result of a single Dormand-Prince step. */
interface DPStepResult {
  /** Accepted state at t + h */
  yNew: number[];
  /** 4th order solution (for error estimation) */
  y4th: number[];
  /** Error estimate (|y5 - y4| per component) */
  error: number[];
  /** The step size used */
  h: number;
}

/**
 * Dormand-Prince RK4(5) coefficients.
 *
 * 7-stage embedded Runge-Kutta pair. The 5th-order solution advances
 * the state; the difference between 5th and 4th order provides the
 * error estimate for adaptive step control.
 */
const DP_A: number[][] = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];

/** 5th order weights (solution that advances the state). */
const DP_B5: number[] = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];

/** 4th order weights (embedded solution for error estimation). */
const DP_B4: number[] = [
  5179 / 57600,
  0,
  7571 / 16695,
  393 / 640,
  -92097 / 339200,
  187 / 2100,
  1 / 40,
];

/** Error weights: B5 - B4 per stage. */
const DP_E: number[] = DP_B5.map((b5, i) => b5 - DP_B4[i]);

/** Default adaptive step control parameters. */
const DP_SAFETY = 0.9;
const DP_MIN_SHRINK = 0.2;
const DP_MAX_GROWTH = 5.0;

/** Options for the adaptive ODE solver. */
export interface AdaptiveODEOptions {
  /** Use adaptive step size (Dormand-Prince RK4(5)) instead of fixed-step RK4 */
  adaptive?: boolean;
  /** Relative tolerance for error control (default: 1e-6) */
  rtol?: number;
  /** Absolute tolerance for error control (default: 1e-9) */
  atol?: number;
  /** Minimum step size before declaring stiffness (default: 1e-12) */
  minStepSize?: number;
  /** Maximum number of steps (default: 1_000_000) */
  maxSteps?: number;
  /** Initial step size hint (auto-estimated if not provided) */
  initialDt?: number;
}

/** Metadata returned alongside the simulation result. */
export interface AdaptiveSimMeta {
  /** Whether stiffness was detected */
  stiffnessDetected: boolean;
  /** Total steps taken (accepted + rejected) */
  totalSteps: number;
  /** Number of rejected steps */
  rejectedSteps: number;
  /** Minimum step size achieved */
  minDt: number;
  /** Maximum step size achieved */
  maxDt: number;
}

/**
 * Perform a single Dormand-Prince RK4(5) step.
 *
 * @param f      Derivative function: f(t, y) -> dy/dt
 * @param t      Current time
 * @param y      Current state
 * @param h      Step size to try
 * @returns      Step result with yNew, error estimate, and used step size
 */
function dormandPrinceStep(
  f: (t: number, y: number[]) => number[],
  t: number,
  y: number[],
  h: number,
): DPStepResult {
  const n = y.length;

  // Stage 1
  const k1 = f(t, y);

  // Stage 2
  const y2 = new Array(n);
  for (let j = 0; j < n; j++) {
    y2[j] = y[j] + h * DP_A[1][0] * k1[j];
  }
  const k2 = f(t + h * (1 / 5), y2);

  // Stage 3
  const y3 = new Array(n);
  for (let j = 0; j < n; j++) {
    y3[j] = y[j] + h * (DP_A[2][0] * k1[j] + DP_A[2][1] * k2[j]);
  }
  const k3 = f(t + h * (3 / 10), y3);

  // Stage 4
  const y4 = new Array(n);
  for (let j = 0; j < n; j++) {
    y4[j] = y[j] + h * (DP_A[3][0] * k1[j] + DP_A[3][1] * k2[j] + DP_A[3][2] * k3[j]);
  }
  const k4 = f(t + h * (4 / 5), y4);

  // Stage 5
  const y5 = new Array(n);
  for (let j = 0; j < n; j++) {
    y5[j] =
      y[j] +
      h * (DP_A[4][0] * k1[j] + DP_A[4][1] * k2[j] + DP_A[4][2] * k3[j] + DP_A[4][3] * k4[j]);
  }
  const k5 = f(t + h * (8 / 9), y5);

  // Stage 6
  const y6 = new Array(n);
  for (let j = 0; j < n; j++) {
    y6[j] =
      y[j] +
      h *
        (DP_A[5][0] * k1[j] +
          DP_A[5][1] * k2[j] +
          DP_A[5][2] * k3[j] +
          DP_A[5][3] * k4[j] +
          DP_A[5][4] * k5[j]);
  }
  const k6 = f(t + h, y6);

  // Stage 7 — uses the 5th-order solution as input
  const y5th = new Array(n);
  for (let j = 0; j < n; j++) {
    y5th[j] =
      y[j] +
      h *
        (DP_B5[0] * k1[j] +
          DP_B5[1] * k2[j] +
          DP_B5[2] * k3[j] +
          DP_B5[3] * k4[j] +
          DP_B5[4] * k5[j] +
          DP_B5[5] * k6[j]);
  }
  const k7 = f(t + h, y5th);

  // 5th order solution (used for stepping — local extrapolation)
  const yNew = new Array(n);
  for (let j = 0; j < n; j++) {
    yNew[j] =
      y[j] +
      h *
        (DP_B5[0] * k1[j] +
          DP_B5[1] * k2[j] +
          DP_B5[2] * k3[j] +
          DP_B5[3] * k4[j] +
          DP_B5[4] * k5[j] +
          DP_B5[5] * k6[j] +
          DP_B5[6] * k7[j]);
  }

  // 4th order solution (for error estimation)
  const y4th = new Array(n);
  for (let j = 0; j < n; j++) {
    y4th[j] =
      y[j] +
      h *
        (DP_B4[0] * k1[j] +
          DP_B4[1] * k2[j] +
          DP_B4[2] * k3[j] +
          DP_B4[3] * k4[j] +
          DP_B4[4] * k5[j] +
          DP_B4[5] * k6[j] +
          DP_B4[6] * k7[j]);
  }

  // Error estimate: |y5th - y4th| per component
  // This equals h * sum((B5_i - B4_i) * k_i) — the local truncation error
  const error = new Array(n);
  for (let j = 0; j < n; j++) {
    error[j] = Math.abs(yNew[j] - y4th[j]);
  }

  return { yNew, y4th, error, h };
}

/**
 * Estimate an initial step size for the adaptive solver.
 *
 * Uses the algorithm from Hairer & Wanner: h0 = 0.01 * ||y0|| / ||f(t0, y0)||,
 * clamped to reasonable bounds.
 */
function estimateInitialStep(
  f: (t: number, y: number[]) => number[],
  t0: number,
  y0: number[],
  tEnd: number,
): number {
  const d0 = Math.sqrt(y0.reduce((s, yi) => s + yi * yi, 0));
  const f0 = f(t0, y0);
  const f0Norm = Math.sqrt(f0.reduce((s, fi) => s + fi * fi, 0));

  const h0 = f0Norm > 0 ? (0.01 * Math.max(d0, 1e-6)) / f0Norm : 1e-6;
  const h1 = tEnd - t0;
  return Math.min(h0, h1);
}

/**
 * Compute error norm for adaptive step control.
 *
 * Uses weighted RMS: sqrt(1/n * sum((err_i / (atol + rtol * |y_i|))^2))
 */
function errorNorm(
  error: number[],
  y: number[],
  rtol: number,
  atol: number,
): number {
  const n = error.length;
  if (n === 0) return 0;

  let sumSq = 0;
  for (let j = 0; j < n; j++) {
    const scale = atol + rtol * Math.abs(y[j]);
    const ratio = scale > 0 ? error[j] / scale : error[j];
    sumSq += ratio * ratio;
  }

  return Math.sqrt(sumSq / n);
}

// ─── Multi-Enzyme System Simulation ────────────────────────────

/** Describes a single enzyme in a coupled system. */
export interface EnzymeKinetics {
  /** Unique identifier for this enzyme */
  id: string;
  /** Index of the substrate species this enzyme consumes */
  substrateIndex: number;
  /** Index of the product species this enzyme produces */
  productIndex: number;
  /** Maximum velocity */
  vmax: number;
  /** Michaelis constant */
  km: number;
  /** Optional: competitive inhibition constant */
  ki?: number;
  /** Optional: index into the species array for the inhibitor */
  inhibitorIndex?: number;
}

/** Result of a multi-enzyme system simulation. */
export interface SystemSimResult {
  /** Time points */
  time: number[];
  /** Concentration trajectories for each species (speciesIndex -> concentration[]) */
  species: number[][];
  /** Velocity of each enzyme at each time point (enzymeIndex -> velocity[]) */
  velocities: number[][];
}

/**
 * Simulate a coupled multi-enzyme ODE system.
 *
 * Each enzyme converts one substrate species to one product species.
 * Multiple enzymes can share species (substrate of one = product of another).
 *
 * dX_j/dt = sum over enzymes that produce j (v_e)
 *         - sum over enzymes that consume j (v_e)
 *
 * Supports two solvers:
 *   - Fixed-step RK4 (default, backward compatible)
 *   - Dormand-Prince RK4(5) adaptive step size (when options.adaptive = true)
 *
 * @param enzymes               Array of enzyme definitions
 * @param initialConcentrations  Initial concentrations for each species
 * @param tEnd                  Simulation end time
 * @param dt                    Time step (used as initial step hint in adaptive mode)
 * @param options               Adaptive solver options (optional)
 */
export function simulateEnzymeSystem(
  enzymes: EnzymeKinetics[],
  initialConcentrations: number[],
  tEnd: number,
  dt: number,
  options?: AdaptiveODEOptions,
): SystemSimResult & { meta?: AdaptiveSimMeta } {
  if (options?.adaptive) {
    return simulateAdaptive(enzymes, initialConcentrations, tEnd, dt, options);
  }
  return simulateFixedRK4(enzymes, initialConcentrations, tEnd, dt);
}

/**
 * Fixed-step RK4 simulation (original implementation).
 */
function simulateFixedRK4(
  enzymes: EnzymeKinetics[],
  initialConcentrations: number[],
  tEnd: number,
  dt: number,
): SystemSimResult {
  const nSpecies = initialConcentrations.length;
  const nEnzymes = enzymes.length;

  if (tEnd <= 0 || dt <= 0 || nSpecies === 0) {
    const singlePoint = initialConcentrations.map(c => [c]);
    const zeroVel = enzymes.map(() => [0]);
    return {
      time: [0],
      species: singlePoint,
      velocities: zeroVel,
    };
  }

  const steps = Math.ceil(tEnd / dt);
  const actualDt = tEnd / steps;

  // Initialize storage
  const time: number[] = [0];
  const species: number[][] = initialConcentrations.map(c => [c]);
  const velocities: number[][] = enzymes.map(enz => [
    computeEnzymeVelocity(enz, initialConcentrations),
  ]);

  // Working arrays
  let concentrations = [...initialConcentrations];

  for (let step = 0; step < steps; step++) {
    const t = (step + 1) * actualDt;

    // RK4 for the coupled system
    const c0 = [...concentrations];

    // k1
    const k1 = computeDerivatives(enzymes, concentrations, nSpecies);

    // k2
    const c2 = concentrations.map((c, j) => c + (actualDt * k1[j]) / 2);
    const k2 = computeDerivatives(enzymes, c2, nSpecies);

    // k3
    const c3 = concentrations.map((c, j) => c + (actualDt * k2[j]) / 2);
    const k3 = computeDerivatives(enzymes, c3, nSpecies);

    // k4
    const c4 = concentrations.map((c, j) => c + actualDt * k3[j]);
    const k4 = computeDerivatives(enzymes, c4, nSpecies);

    // Update concentrations
    concentrations = concentrations.map((c, j) =>
      Math.max(0, c + (actualDt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])),
    );

    // Record
    time.push(parseFloat(t.toFixed(6)));
    for (let j = 0; j < nSpecies; j++) {
      species[j].push(parseFloat(concentrations[j].toFixed(6)));
    }
    for (let e = 0; e < nEnzymes; e++) {
      velocities[e].push(
        parseFloat(computeEnzymeVelocity(enzymes[e], concentrations).toFixed(6)),
      );
    }
  }

  return { time, species, velocities };
}

/**
 * Dormand-Prince adaptive step size simulation.
 *
 * Uses RK4(5) embedded pair with adaptive step control:
 *   - 5th order solution advances the state (local extrapolation)
 *   - 4th order embedded solution provides error estimate
 *   - Step size grows when error is small (up to DP_MAX_GROWTH)
 *   - Step size shrinks when error is large (down to DP_MIN_SHRINK)
 *   - Stiffness detected if step size repeatedly hits minimum
 *
 * Output is sampled at uniform intervals (using linear interpolation
 * between adaptive steps) for compatibility with the fixed-step API.
 */
function simulateAdaptive(
  enzymes: EnzymeKinetics[],
  initialConcentrations: number[],
  tEnd: number,
  dt: number,
  options: AdaptiveODEOptions,
): SystemSimResult & { meta: AdaptiveSimMeta } {
  const nSpecies = initialConcentrations.length;
  const nEnzymes = enzymes.length;
  const rtol = options.rtol ?? 1e-6;
  const atol = options.atol ?? 1e-9;
  const minStepSize = options.minStepSize ?? 1e-12;
  const maxSteps = options.maxSteps ?? 1_000_000;

  if (tEnd <= 0 || nSpecies === 0) {
    const singlePoint = initialConcentrations.map(c => [c]);
    const zeroVel = enzymes.map(() => [0]);
    return {
      time: [0],
      species: singlePoint,
      velocities: zeroVel,
      meta: { stiffnessDetected: false, totalSteps: 0, rejectedSteps: 0, minDt: 0, maxDt: 0 },
    };
  }

  // Derivative function for the coupled enzyme system
  const f = (_t: number, y: number[]): number[] => {
    return computeDerivatives(enzymes, y, nSpecies);
  };

  // Estimate initial step size
  let h = options.initialDt ?? estimateInitialStep(f, 0, [...initialConcentrations], tEnd);
  h = Math.max(h, minStepSize);
  h = Math.min(h, tEnd);

  // Sampling grid — we record at uniform intervals matching the dt parameter
  const nSamples = Math.ceil(tEnd / dt);
  const sampleDt = tEnd / nSamples;

  // Initialize output storage
  const time: number[] = [0];
  const species: number[][] = initialConcentrations.map(c => [c]);
  const velocities: number[][] = enzymes.map(enz => [
    computeEnzymeVelocity(enz, initialConcentrations),
  ]);

  // Working state
  let t = 0;
  let y = [...initialConcentrations];
  let nextSampleTime = sampleDt;
  let sampleIndex = 1;

  // Stiffness tracking
  let consecutiveMinSteps = 0;
  const STIFFNESS_THRESHOLD = 10; // consecutive min-step hits before declaring stiffness
  let stiffnessDetected = false;

  // Step tracking
  let totalSteps = 0;
  let rejectedSteps = 0;
  let actualMinDt = h;
  let actualMaxDt = h;

  while (t < tEnd && totalSteps < maxSteps) {
    // Don't overshoot the end time
    if (t + h > tEnd) {
      h = tEnd - t;
    }

    // Attempt a Dormand-Prince step
    const stepResult = dormandPrinceStep(f, t, y, h);
    const errNorm = errorNorm(stepResult.error, stepResult.yNew, rtol, atol);

    if (errNorm <= 1.0) {
      // Step accepted
      t += h;
      y = stepResult.yNew.map(c => Math.max(0, c)); // enforce non-negative concentrations

      // Track step sizes
      actualMinDt = Math.min(actualMinDt, h);
      actualMaxDt = Math.max(actualMaxDt, h);

      // Check for stiffness (step at minimum for too long)
      if (h <= minStepSize * 1.01) {
        consecutiveMinSteps++;
        if (consecutiveMinSteps >= STIFFNESS_THRESHOLD) {
          stiffnessDetected = true;
        }
      } else {
        consecutiveMinSteps = 0;
      }

      // Sample at uniform intervals
      while (sampleIndex <= nSamples && t >= nextSampleTime - 1e-12) {
        time.push(parseFloat(nextSampleTime.toFixed(6)));
        for (let j = 0; j < nSpecies; j++) {
          species[j].push(parseFloat(y[j].toFixed(6)));
        }
        for (let e = 0; e < nEnzymes; e++) {
          velocities[e].push(
            parseFloat(computeEnzymeVelocity(enzymes[e], y).toFixed(6)),
          );
        }

        nextSampleTime += sampleDt;
        sampleIndex++;
      }

      // Compute new step size
      if (errNorm > 0) {
        const scale = DP_SAFETY * Math.pow(1 / errNorm, 1 / 5);
        h = h * Math.min(DP_MAX_GROWTH, Math.max(DP_MIN_SHRINK, scale));
      } else {
        // Error is zero — grow aggressively
        h = h * DP_MAX_GROWTH;
      }
      h = Math.max(h, minStepSize);
      h = Math.min(h, tEnd - t > 0 ? tEnd - t : tEnd);

      totalSteps++;
    } else {
      // Step rejected — shrink and retry
      rejectedSteps++;
      const scale = DP_SAFETY * Math.pow(1 / errNorm, 1 / 5);
      h = h * Math.max(DP_MIN_SHRINK, scale);
      h = Math.max(h, minStepSize);
      totalSteps++;
    }
  }

  return {
    time,
    species,
    velocities,
    meta: {
      stiffnessDetected,
      totalSteps,
      rejectedSteps,
      minDt: actualMinDt,
      maxDt: actualMaxDt,
    },
  };
}

/** Compute velocity for a single enzyme given current concentrations. */
function computeEnzymeVelocity(enzyme: EnzymeKinetics, concentrations: number[]): number {
  const s = Math.max(0, concentrations[enzyme.substrateIndex] ?? 0);

  if (enzyme.ki !== undefined && enzyme.inhibitorIndex !== undefined) {
    const i = Math.max(0, concentrations[enzyme.inhibitorIndex] ?? 0);
    return competitiveInhibition(enzyme.vmax, s, enzyme.km, enzyme.ki, i);
  }

  // Plain Michaelis-Menten
  const denom = enzyme.km + s;
  return denom <= 0 ? 0 : (enzyme.vmax * s) / denom;
}

/** Compute dX/dt for all species given current concentrations. */
function computeDerivatives(
  enzymes: EnzymeKinetics[],
  concentrations: number[],
  nSpecies: number,
): number[] {
  const dCdt = new Array(nSpecies).fill(0) as number[];

  for (const enz of enzymes) {
    const v = computeEnzymeVelocity(enz, concentrations);
    // Enzyme consumes substrate
    if (enz.substrateIndex < nSpecies) {
      dCdt[enz.substrateIndex] -= v;
    }
    // Enzyme produces product
    if (enz.productIndex < nSpecies) {
      dCdt[enz.productIndex] += v;
    }
  }

  return dCdt;
}
