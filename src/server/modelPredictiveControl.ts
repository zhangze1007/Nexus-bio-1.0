/**
 * Model Predictive Control (MPC) for bioreactor regulation.
 *
 * At each timestep:
 *   1. Linearise the state-space model around the current operating point
 *   2. Formulate and solve a Quadratic Programme (QP) over the prediction
 *      horizon to minimise  Σ (state_error² · Q  +  control_effort² · R)
 *   3. Apply the first control signal and advance the state
 *
 * The QP is solved with a projected gradient-descent loop so the module has
 * zero external dependencies (no BLAS, no IPOPT). Adequate for the small
 * state/control dimensions typical of bioreactor models (n_state <= 6).
 *
 * All arithmetic is plain Float64 arrays — no matrix libraries required.
 *
 * @scientific_provenance
 *   ALGORITHM: Receding-horizon Model Predictive Control (MPC). At each
 *     timestep the nonlinear model is linearised via finite-difference
 *     Jacobians, and a quadratic cost over the prediction horizon is minimised
 *     by projected gradient descent with adjoint-based gradient computation.
 *     Soft state-constraint penalties handle infeasible setpoints.
 *   REFERENCE: Garcia CE, Prett DM, Morari M. "Model predictive control:
 *     theory and practice — a survey." Automatica. 1989;25(3):335-348.
 *   KNOWN_LIMITATIONS:
 *     - QP solver is projected gradient descent, not a proper active-set or
 *       interior-point method; may not converge to the true optimum for
 *       tightly constrained problems.
 *     - Linearisation via finite differences is first-order accurate and
 *       requires the model function to be smooth; discontinuous models
 *       will produce poor Jacobians.
 *     - Soft state constraints use a fixed penalty weight (1000) and
 *       dead-zone margin (0.01); these are not tuned per-application.
 *     - Only the first control signal is applied (receding horizon);
 *       does not support multi-rate or cascaded control architectures.
 */

/* ═══════════════════════════════════════════════════════════════
 *  Public types
 * ═══════════════════════════════════════════════════════════════ */

export interface MPCConfig {
  /** Number of prediction steps. */
  predictionHorizon: number;
  /** Number of steps over which control is optimised (≤ predictionHorizon). */
  controlHorizon: number;
  /** Discretisation timestep (seconds). */
  dt: number;
  /** Target state vector (one value per state dimension). */
  setpoint: number[];
  /** Per-dimension state bounds. */
  stateConstraints: { min: number[]; max: number[] };
  /** Per-dimension control bounds. */
  controlConstraints: { min: number[]; max: number[] };
  /** Per-dimension penalty weights.  Lengths must match state / control dims. */
  costWeights: { state: number[]; control: number[] };
}

export interface MPCResult {
  /** trajectories[d] = state of dimension d at each timestep (length nSteps + 1). */
  trajectories: number[][];
  /** Control signal applied at each timestep (length nSteps). */
  controlSignals: number[];
  /** Cumulative cost over the entire run. */
  cost: number;
  /** Whether every optimisation sub-problem was feasible. */
  feasible: boolean;
}

/* ═══════════════════════════════════════════════════════════════
 *  Internal helpers — tiny linear-algebra layer
 * ═══════════════════════════════════════════════════════════════ */

/** Finite-difference Jacobian of f: R^n → R^n  w.r.t. `x`. */
function jacobianX(
  f: (x: number[], u: number[]) => number[],
  x: number[],
  u: number[],
): number[][] {
  const n = x.length;
  const eps = 1e-6;
  const f0 = f(x, u);
  const J: number[][] = Array.from({ length: n }, () => new Array(n));
  for (let j = 0; j < n; j++) {
    const xPert = [...x];
    xPert[j] += eps;
    const fPert = f(xPert, u);
    for (let i = 0; i < n; i++) {
      J[i][j] = (fPert[i] - f0[i]) / eps;
    }
  }
  return J;
}

/** Finite-difference Jacobian of f w.r.t. `u`. */
function jacobianU(
  f: (x: number[], u: number[]) => number[],
  x: number[],
  u: number[],
): number[][] {
  const n = x.length;
  const m = u.length;
  const eps = 1e-6;
  const f0 = f(x, u);
  const J: number[][] = Array.from({ length: n }, () => new Array(m));
  for (let j = 0; j < m; j++) {
    const uPert = [...u];
    uPert[j] += eps;
    const fPert = f(x, uPert);
    for (let i = 0; i < n; i++) {
      J[i][j] = (fPert[i] - f0[i]) / eps;
    }
  }
  return J;
}

/** Matrix–vector multiply:  y = M · v. */
function matVec(M: number[][], v: number[]): number[] {
  return M.map((row) => row.reduce((s, a, k) => s + a * v[k], 0));
}

/** Matrix–matrix multiply:  C = A · B. */
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < p; k++) s += A[i][k] * B[k][j];
      C[i][j] = s;
    }
  }
  return C;
}

/** Transpose of a matrix. */
function matT(M: number[][]): number[][] {
  const rows = M.length;
  const cols = M[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = M[i][j];
    }
  }
  return T;
}

/** Add two matrices element-wise. */
function matAdd(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

/** Add two vectors element-wise. */
function vecAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

/** Scalar × vector. */
function vecScale(a: number[], s: number): number[] {
  return a.map((v) => v * s);
}

/** Element-wise clamp of a vector. */
function vecClamp(v: number[], lo: number[], hi: number[]): number[] {
  return v.map((x, i) => Math.max(lo[i], Math.min(hi[i], x)));
}

/* ═══════════════════════════════════════════════════════════════
 *  QP solver — projected gradient descent on the control
 *  sequence  U = [u(0), u(1), …, u(Nc-1)]
 *
 *  Decision variables are stacked:  U ∈ R^{m*Nc}
 *  Cost:  ½ U^T H U  +  g^T U   (plus constants from setpoint)
 *  Subject to per-step box constraints.
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Build the predicted state trajectory over the prediction horizon
 * using the linearised model  x(k+1) = A·x(k) + B·u(k) + c
 * where  c = f(x0,u0) − A·x0 − B·u0  (affine correction).
 */
function buildPredictionMatrices(
  A: number[][],
  B: number[][],
  c: number[],
  Np: number,
  Nc: number,
): { PhiX: number[][]; PhiU: number[][]; PhiC: number[] } {
  const n = A.length;
  const m = B[0].length;

  // PhiX[k] = A^k   — contribution of initial state to step k
  const PhiXList: number[][][] = [];
  let Ak: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  for (let k = 0; k <= Np; k++) {
    PhiXList.push(Ak);
    Ak = matMul(A, Ak);
  }

  // For each prediction step k, we need the cumulative effect of
  // each control step j (j < min(k, Nc)) on state at step k.
  // state(k) = PhiX[k]·x0 + Σ_{j=0}^{min(k-1,Nc-1)} A^{k-1-j}·B·u(j) + cumulative c terms
  //
  // We build PhiU as a stacked matrix so that:
  //   x_pred = PhiX[Np]*x0 + PhiU * U_vec + PhiC
  // where U_vec = [u(0); u(1); …; u(Nc-1)] stacked.

  // Instead of building one big matrix, we build the cost directly.
  // Return per-step PhiX[k], per-step PhiU[k][j] and PhiC[k].
  return { PhiX: PhiXList.map((m) => matVec(m, new Array(n).fill(0))), PhiU: [], PhiC: new Array(n).fill(0) };
}

/**
 * Solve the MPC QP at one timestep.
 *
 * Given linearised dynamics  x(k+1) = A·x(k) + B·u(k) + d,
 * minimise  Σ_{k=0}^{Np-1} ‖x(k)−xref‖²_Q  +  Σ_{k=0}^{Nc-1} ‖u(k)‖²_R
 * subject to box constraints on u.
 *
 * Returns the optimal first control signal u(0).
 */
function solveQP(
  x0: number[],
  A: number[][],
  B: number[][],
  d: number[],
  xref: number[],
  Q: number[],
  R: number[],
  Np: number,
  Nc: number,
  uLo: number[],
  uHi: number[],
  xLo: number[],
  xHi: number[],
): { uOpt: number[]; feasible: boolean } {
  const n = x0.length;
  const m = B[0].length;

  // We use an iterative projected-gradient approach.
  // Decision variables:  U ∈ R^{m * Nc}  (stacked control sequence)
  // We evaluate cost and gradient by forward-simulating the linear model.

  // Soft state-constraint penalty weight (large to discourage violations).
  // A small dead-zone margin prevents the penalty from fighting setpoints
  // that sit right on the constraint boundary.
  const xPen = 1000;
  const margin = 0.01;

  // Helper: simulate forward and return (states, cost).
  function evaluate(U: number[]): { states: number[][]; cost: number } {
    const states: number[][] = [x0.slice()];
    let cost = 0;
    let x = x0.slice();
    for (let k = 0; k < Np; k++) {
      const j = Math.min(k, Nc - 1);
      const u = U.slice(j * m, (j + 1) * m);
      // x(k+1) = A·x(k) + B·u + d
      const xNext = vecAdd(vecAdd(matVec(A, x), matVec(B, u)), d);
      states.push(xNext);
      // state cost at k+1
      for (let i = 0; i < n; i++) {
        const err = xNext[i] - xref[i];
        cost += Q[i] * err * err;
        // Soft state constraints (with dead-zone margin at boundary)
        const overshoot = xNext[i] - xHi[i] - margin;
        if (overshoot > 0) cost += xPen * overshoot * overshoot;
        const undershoot = xLo[i] - xNext[i] - margin;
        if (undershoot > 0) cost += xPen * undershoot * undershoot;
      }
      // control cost
      for (let i = 0; i < m; i++) {
        cost += R[i] * u[i] * u[i];
      }
      x = xNext;
    }
    return { states, cost };
  }

  // Gradient of cost w.r.t. U via adjoint (backpropagation).
  function gradient(U: number[], states: number[][]): number[] {
    const grad = new Array(m * Nc).fill(0);
    const lambda = new Array(n).fill(0); // adjoint (costate)

    // Backward sweep
    for (let k = Np - 1; k >= 0; k--) {
      const xKp1 = states[k + 1];
      // ∂(state cost at k+1)/∂x(k+1) = 2 * Q * (x - xref) + soft constraint derivatives
      for (let i = 0; i < n; i++) {
        lambda[i] += 2 * Q[i] * (xKp1[i] - xref[i]);
        const overshoot = xKp1[i] - xHi[i] - margin;
        if (overshoot > 0) lambda[i] += 2 * xPen * overshoot;
        const undershoot = xLo[i] - xKp1[i] - margin;
        if (undershoot > 0) lambda[i] -= 2 * xPen * undershoot;
      }
      // ∂cost/∂u(k)  through B  (for the j-th control step)
      const j = Math.min(k, Nc - 1);
      for (let i = 0; i < m; i++) {
        let dBu = 0;
        for (let s = 0; s < n; s++) dBu += B[s][i] * lambda[s]; // B^T · lambda
        grad[j * m + i] += dBu;
      }
      // ∂(control cost)/∂u(k) = 2 * R * u
      {
        const u = U.slice(j * m, (j + 1) * m);
        for (let i = 0; i < m; i++) {
          grad[j * m + i] += 2 * R[i] * u[i];
        }
      }
      // Propagate lambda backward:  lambda = A^T · lambda
      const AT = matT(A);
      const newLambda = matVec(AT, lambda);
      for (let i = 0; i < n; i++) lambda[i] = newLambda[i];
    }
    return grad;
  }

  // Initialise U to zero (midpoint of constraints)
  let U = new Array(m * Nc).fill(0);
  // Clip to constraints
  for (let j = 0; j < Nc; j++) {
    for (let i = 0; i < m; i++) {
      U[j * m + i] = Math.max(uLo[i], Math.min(uHi[i], 0));
    }
  }

  // Projected gradient descent
  const maxIter = 200;
  let stepSize = 0.05;

  for (let iter = 0; iter < maxIter; iter++) {
    const { states, cost } = evaluate(U);
    const grad = gradient(U, states);

    // Gradient step with projection
    const UNew = new Array(m * Nc);
    for (let idx = 0; idx < m * Nc; idx++) {
      const j = Math.floor(idx / m);
      const i = idx % m;
      UNew[idx] = Math.max(uLo[i], Math.min(uHi[i], U[idx] - stepSize * grad[idx]));
    }

    // Check convergence
    let maxDelta = 0;
    for (let idx = 0; idx < m * Nc; idx++) {
      maxDelta = Math.max(maxDelta, Math.abs(UNew[idx] - U[idx]));
    }
    U = UNew;
    if (maxDelta < 1e-8) break;

    // Adaptive step: if cost increased, shrink
    const { cost: costNew } = evaluate(U);
    if (costNew > cost && iter > 10) {
      stepSize *= 0.5;
      if (stepSize < 1e-8) break;
    }
  }

  // Check state constraint feasibility
  const { states, cost } = evaluate(U);
  let feasible = true;
  for (let k = 1; k <= Np; k++) {
    for (let i = 0; i < n; i++) {
      if (states[k][i] < xLo[i] - 1e-2 || states[k][i] > xHi[i] + 1e-2) {
        feasible = false;
      }
    }
  }

  // Return first control signal
  return {
    uOpt: U.slice(0, m),
    feasible,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Main MPC loop
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Run Model Predictive Control over `nSteps` timesteps.
 *
 * @param initialState  Starting state vector.
 * @param config        MPC tuning parameters.
 * @param modelFn       Discrete-time state-transition function f(x, u) → x_next.
 * @param nSteps        Total simulation steps.
 * @returns trajectories, control signals, cumulative cost, feasibility flag.
 */
export function runMPC(
  initialState: number[],
  config: MPCConfig,
  modelFn: (state: number[], control: number[]) => number[],
  nSteps: number,
): MPCResult {
  const {
    predictionHorizon: Np,
    controlHorizon: Nc,
    setpoint,
    stateConstraints,
    controlConstraints,
    costWeights,
  } = config;

  const n = initialState.length;
  const m = costWeights.control.length;

  // State trajectory storage: trajectories[d][t]
  const trajectories: number[][] = Array.from({ length: n }, (_, d) =>
    new Array(nSteps + 1).fill(initialState[d]),
  );
  const controlSignals: number[] = new Array(nSteps);
  let totalCost = 0;
  let allFeasible = true;

  let x = initialState.slice();

  for (let t = 0; t < nSteps; t++) {
    // 1. Linearise around current state with a nominal zero control
    const uNom = new Array(m).fill(0);
    const A = jacobianX(modelFn, x, uNom);
    const B = jacobianU(modelFn, x, uNom);
    // Affine correction: d = f(x,0) - A·x - B·0 = f(x,0) - A·x
    const f0 = modelFn(x, uNom);
    const Ax = matVec(A, x);
    const d = f0.map((v, i) => v - Ax[i]);

    // 2. Solve QP
    const { uOpt, feasible } = solveQP(
      x, A, B, d,
      setpoint,
      costWeights.state,
      costWeights.control,
      Np,
      Nc,
      controlConstraints.min,
      controlConstraints.max,
      stateConstraints.min,
      stateConstraints.max,
    );

    // Note: QP feasibility flag is advisory; actual constraint compliance
    // is checked against the real (nonlinear) trajectory below.

    // 3. Apply first control signal and advance state
    const xNext = modelFn(x, uOpt);

    // Accumulate cost
    for (let i = 0; i < n; i++) {
      const err = xNext[i] - setpoint[i];
      totalCost += costWeights.state[i] * err * err;
    }
    for (let i = 0; i < m; i++) {
      totalCost += costWeights.control[i] * uOpt[i] * uOpt[i];
    }

    controlSignals[t] = uOpt[0]; // primary control channel
    for (let d = 0; d < n; d++) {
      trajectories[d][t + 1] = xNext[d];
      // Check actual state constraints (tolerance for numerical noise)
      if (
        xNext[d] < stateConstraints.min[d] - 1e-3 ||
        xNext[d] > stateConstraints.max[d] + 1e-3
      ) {
        allFeasible = false;
      }
    }
    x = xNext;
  }

  return {
    trajectories,
    controlSignals,
    cost: totalCost,
    feasible: allFeasible,
  };
}
