/**
 * Unified ODE solver framework.
 *
 * Provides three numerical integrators for systems of ordinary differential equations:
 *   - solveRK4      — classical 4th-order Runge-Kutta  (fixed step, O(dt^4) error)
 *   - solveEuler    — forward Euler                     (fixed step, O(dt) error)
 *   - solveAdaptive — adaptive-step RK4 with embedded Euler error estimator
 *
 * All solvers share the same ODESystem / SolverOptions / ODESolution interfaces
 * so they can be swapped transparently in any simulation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Right-hand side of dy/dt = f(t, y).  Returns a derivative vector the same
 *  length as the state vector. */
export type ODERHS = (t: number, y: number[]) => number[];

/** Defines a complete ODE initial-value problem. */
export interface ODESystem {
  /** Derivative function f(t, y) → dy/dt. */
  fn: ODERHS;
  /** Initial state vector y(tStart). */
  initial: number[];
  /** Start of the integration interval. */
  tStart: number;
  /** End of the integration interval (must be > tStart). */
  tEnd: number;
}

/** Options common to all fixed-step solvers (RK4, Euler). */
export interface SolverOptions {
  /** Number of integration steps (determines dt = (tEnd - tStart) / steps). */
  steps: number;
  /** If true, clamp every state component to >= 0 after each step. */
  clampToZero?: boolean;
}

/** Options for the adaptive solver. */
export interface AdaptiveOptions {
  /** Local error tolerance that controls step-size adaptation. */
  tolerance: number;
  /** Minimum allowed step size (default 1e-10). */
  dtMin?: number;
  /** Maximum allowed step size (default (tEnd - tStart) / 2). */
  dtMax?: number;
  /** If true, clamp every state component to >= 0 after each step. */
  clampToZero?: boolean;
}

/** The result returned by every solver. */
export interface ODESolution {
  /** Time stamps of each sample point. */
  time: number[];
  /** states[i][j] = value of state variable i at time point j. */
  states: number[][];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp all state components to >= 0 in-place. */
function clampNonNeg(y: number[]): void {
  for (let i = 0; i < y.length; i++) {
    if (y[i] < 0) y[i] = 0;
  }
}

/** Deep-clone a number array. */
function clone(y: number[]): number[] {
  return y.slice();
}

// ---------------------------------------------------------------------------
// solveRK4 — classical 4th-order Runge-Kutta
// ---------------------------------------------------------------------------

export function solveRK4(system: ODESystem, opts: SolverOptions): ODESolution {
  const { fn, initial, tStart, tEnd } = system;
  const { steps, clampToZero = false } = opts;

  if (steps <= 0 || tEnd <= tStart) {
    return { time: [tStart], states: initial.map(v => [v]) };
  }

  const dt = (tEnd - tStart) / steps;
  const n = initial.length;
  const time: number[] = [tStart];
  const states: number[][] = initial.map(v => [v]);

  let t = tStart;
  let y = clone(initial);

  for (let s = 0; s < steps; s++) {
    // k1 = f(t, y)
    const k1 = fn(t, y);
    // k2 = f(t + dt/2, y + dt/2 * k1)
    const y2 = y.map((yi, i) => yi + 0.5 * dt * k1[i]);
    const k2 = fn(t + 0.5 * dt, y2);
    // k3 = f(t + dt/2, y + dt/2 * k2)
    const y3 = y.map((yi, i) => yi + 0.5 * dt * k2[i]);
    const k3 = fn(t + 0.5 * dt, y3);
    // k4 = f(t + dt, y + dt * k3)
    const y4 = y.map((yi, i) => yi + dt * k3[i]);
    const k4 = fn(t + dt, y4);

    // y_{n+1} = y_n + (dt/6)(k1 + 2*k2 + 2*k3 + k4)
    y = y.map((yi, i) =>
      yi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
    );
    t += dt;

    if (clampToZero) clampNonNeg(y);

    time.push(t);
    for (let i = 0; i < n; i++) states[i].push(y[i]);
  }

  return { time, states };
}

// ---------------------------------------------------------------------------
// solveEuler — forward Euler
// ---------------------------------------------------------------------------

export function solveEuler(system: ODESystem, opts: SolverOptions): ODESolution {
  const { fn, initial, tStart, tEnd } = system;
  const { steps, clampToZero = false } = opts;

  if (steps <= 0 || tEnd <= tStart) {
    return { time: [tStart], states: initial.map(v => [v]) };
  }

  const dt = (tEnd - tStart) / steps;
  const n = initial.length;
  const time: number[] = [tStart];
  const states: number[][] = initial.map(v => [v]);

  let t = tStart;
  let y = clone(initial);

  for (let s = 0; s < steps; s++) {
    const dy = fn(t, y);
    y = y.map((yi, i) => yi + dt * dy[i]);
    t += dt;

    if (clampToZero) clampNonNeg(y);

    time.push(t);
    for (let i = 0; i < n; i++) states[i].push(y[i]);
  }

  return { time, states };
}

// ---------------------------------------------------------------------------
// solveAdaptive — adaptive-step RK4 with embedded Euler error estimate
//
// Uses the difference between an RK4 step and an Euler step over the same dt
// as a local error estimator.  Step size is adjusted via the standard
// PI-controller formula:
//   dt_new = dt * safety * (tol / error)^(1/4)
//
// This keeps the per-step error near `tolerance` without the overhead of a
// full Dormand-Prince pair.
// ---------------------------------------------------------------------------

export function solveAdaptive(
  system: ODESystem,
  opts: AdaptiveOptions,
): ODESolution {
  const { fn, initial, tStart, tEnd } = system;
  const {
    tolerance,
    dtMin = 1e-10,
    dtMax = (tEnd - tStart) / 2,
    clampToZero = false,
  } = opts;

  if (tEnd <= tStart) {
    return { time: [tStart], states: initial.map(v => [v]) };
  }

  const n = initial.length;
  const safety = 0.9;
  const maxGrowth = 5.0;   // max factor by which dt can grow per step
  const minShrink = 0.2;   // min factor by which dt can shrink per step
  const maxIter = 2_000_000; // safety valve

  // Initial guess for dt
  let dt = Math.min(dtMax, (tEnd - tStart) / 100);
  let t = tStart;
  let y = clone(initial);

  const time: number[] = [tStart];
  const states: number[][] = initial.map(v => [v]);

  let iter = 0;
  while (t < tEnd && iter < maxIter) {
    iter++;

    // Don't overshoot
    if (t + dt > tEnd) dt = tEnd - t;

    // --- One RK4 step ---
    const k1 = fn(t, y);
    const y2 = y.map((yi, i) => yi + 0.5 * dt * k1[i]);
    const k2 = fn(t + 0.5 * dt, y2);
    const y3 = y.map((yi, i) => yi + 0.5 * dt * k2[i]);
    const k3 = fn(t + 0.5 * dt, y3);
    const y4 = y.map((yi, i) => yi + dt * k3[i]);
    const k4 = fn(t + dt, y4);

    const yRK4 = y.map((yi, i) =>
      yi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
    );

    // --- One Euler step (same dt) ---
    const yEuler = y.map((yi, i) => yi + dt * k1[i]);

    // --- Local error estimate (L2 norm of the difference) ---
    let errSq = 0;
    for (let i = 0; i < n; i++) {
      const d = yRK4[i] - yEuler[i];
      errSq += d * d;
    }
    const error = Math.sqrt(errSq / n);

    if (error === 0) {
      // Both agree exactly — accept and grow dt
      y = yRK4;
      t += dt;
      if (clampToZero) clampNonNeg(y);
      time.push(t);
      for (let i = 0; i < n; i++) states[i].push(y[i]);
      dt = Math.min(dtMax, dt * maxGrowth);
      continue;
    }

    if (error <= tolerance) {
      // Accept step
      y = yRK4;
      t += dt;
      if (clampToZero) clampNonNeg(y);
      time.push(t);
      for (let i = 0; i < n; i++) states[i].push(y[i]);
    }
    // else: reject step, t and y remain unchanged

    // Adjust dt (PI-controller-like)
    const factor = safety * Math.pow(tolerance / error, 0.25);
    const clampedFactor = Math.max(minShrink, Math.min(maxGrowth, factor));
    dt = Math.max(dtMin, Math.min(dtMax, dt * clampedFactor));
  }

  return { time, states };
}
