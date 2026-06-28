/**
 * Flux Sampling for Constraint-Based Metabolic Models.
 *
 * Implements hit-and-run Markov Chain Monte Carlo (MCMC) sampling of the
 * flux solution space within the optimal face of a constraint-based metabolic
 * model (FBA). The algorithm starts from the FBA-optimal solution (warm-start)
 * and generates uniformly distributed flux samples by:
 *
 * 1. Computing the null space of the equality constraints (mass balance)
 * 2. Generating random directions within that null space
 * 3. Computing analytical step bounds from variable bounds and the
 *    optimality constraint (no LP solves needed per step)
 * 4. Sampling uniformly along each direction
 *
 * Each sample maintains the optimal objective value within a configurable
 * tolerance, ensuring all samples represent biologically equivalent optimal
 * flux distributions. The warm-starting approach reduces burn-in time by
 * initializing the chain at a known feasible point on the optimal face.
 *
 * Reference: Kaufman, D.E. & Smith, R.L. (1998) "Direction choice for
 * accelerated convergence in hit-and-run sampling" Operations Research
 * 46(1):84-95
 *
 * Reference: Schellenberger, J. & Palsson, B.O. (2009) "Use of randomized
 * sampling for analysis of metabolic networks" Journal of Biological
 * Chemistry 284(9):5457-5461
 *
 * @scientific_provenance
 *   ALGORITHM: Hit-and-Run MCMC Flux Sampling
 *   REFERENCE: Kaufman, D.E. & Smith, R.L. (1998) Operations Research 46(1):84-95
 *   REFERENCE: Schellenberger, J. & Palsson, B.O. (2009) J. Biol. Chem. 284(9):5457-5461
 *   KNOWN_LIMITATIONS:
 *     - Convergence to the uniform distribution depends on mixing time, which
 *       scales with the dimension and geometry of the feasible region
 *     - Null space computation via Gaussian elimination is O(n^3) for n variables;
 *       acceptable for small/medium models but costly for genome-scale
 *     - Degenerate feasible regions (zero-volume faces) produce identical samples
 *     - The optimality tolerance may exclude near-optimal flux distributions
 *       that are biologically relevant
 */

import { type LPModel, solveLP } from "../../server/highsSolver";

/* ------------------------------------------------------------------ */
/*  Public types                                                        */
/* ------------------------------------------------------------------ */

/** A single flux sample from the solution space. */
export interface FluxSample {
  /** Reaction flux values (reaction ID -> flux). */
  fluxes: Record<string, number>;
  /** Objective value for this sample (should be near-optimal). */
  objectiveValue: number;
}

/** Statistical summary of flux ranges across all samples for one reaction. */
export interface FluxRange {
  /** Reaction identifier. */
  reactionId: string;
  /** Minimum observed flux across samples. */
  min: number;
  /** Maximum observed flux across samples. */
  max: number;
  /** Mean flux across samples. */
  mean: number;
  /** Standard deviation of flux across samples. */
  std: number;
}

/* ------------------------------------------------------------------ */
/*  Linear algebra helpers                                              */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Compute a basis for the null space of matrix A (m x n, m < n)
 * using Gaussian elimination with partial pivoting.
 *
 * Returns an array of basis vectors, each of length n.
 * The null space dimension is n - rank(A).
 */
function nullSpaceBasis(A: number[][]): number[][] {
  const m = A.length;
  if (m === 0) return [];
  const n = A[0].length;
  if (n === 0) return [];

  // Work on a copy (augmented with identity for back-substitution)
  // RREF approach: row-reduce A, then read off null space vectors
  const mat: number[][] = A.map((row) => [...row]);

  // Gaussian elimination with partial pivoting
  const pivotCols: number[] = [];
  let row = 0;
  const EPS = 1e-10;

  for (let col = 0; col < n && row < m; col++) {
    // Find pivot
    let maxVal = 0;
    let maxRow = -1;
    for (let r = row; r < m; r++) {
      const absVal = Math.abs(mat[r][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = r;
      }
    }

    if (maxVal < EPS) continue; // skip free column

    // Swap rows
    if (maxRow !== row) {
      [mat[row], mat[maxRow]] = [mat[maxRow], mat[row]];
    }

    // Scale pivot row
    const pivot = mat[row][col];
    for (let j = 0; j < n; j++) mat[row][j] /= pivot;

    // Eliminate column in other rows
    for (let r = 0; r < m; r++) {
      if (r === row) continue;
      const factor = mat[r][col];
      if (Math.abs(factor) < EPS) continue;
      for (let j = 0; j < n; j++) {
        mat[r][j] -= factor * mat[row][j];
      }
    }

    pivotCols.push(col);
    row++;
  }

  const rank = pivotCols.length;
  const freeCols: number[] = [];
  for (let col = 0; col < n; col++) {
    if (!pivotCols.includes(col)) freeCols.push(col);
  }

  // Construct null space vectors from free columns
  const basis: number[][] = [];
  for (const freeCol of freeCols) {
    const vec = new Array(n).fill(0);
    vec[freeCol] = 1;
    for (let i = 0; i < rank; i++) {
      vec[pivotCols[i]] = -mat[i][freeCol];
    }
    basis.push(vec);
  }

  return basis;
}

/**
 * Project a direction vector onto the span of a set of basis vectors.
 * Uses Gram-Schmidt orthogonalization.
 */
function projectOntoSpan(direction: number[], basis: number[][]): number[] {
  if (basis.length === 0) return direction.map(() => 0);

  const n = direction.length;
  const proj = new Array(n).fill(0);

  // Gram-Schmidt: project onto each basis vector
  for (const basisVec of basis) {
    let dotNum = 0;
    let dotDen = 0;
    for (let i = 0; i < n; i++) {
      dotNum += direction[i] * basisVec[i];
      dotDen += basisVec[i] * basisVec[i];
    }
    if (dotDen < 1e-20) continue;
    const scale = dotNum / dotDen;
    for (let i = 0; i < n; i++) {
      proj[i] += scale * basisVec[i];
    }
  }

  return proj;
}

/**
 * Generate a random direction in the null space of the equality constraints.
 * Generates a random vector and projects it onto the null space basis.
 */
function randomNullSpaceDirection(n: number, nullBasis: number[][]): number[] {
  if (nullBasis.length === 0) return Array(n).fill(0);

  // Generate random vector
  const rand: number[] = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.random() || 1e-300;
    const u2 = Math.random();
    rand.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  }

  // Project onto null space
  const proj = projectOntoSpan(rand, nullBasis);

  // Normalize
  const norm = Math.sqrt(proj.reduce((s, v) => s + v * v, 0));
  if (norm > 1e-12) {
    for (let i = 0; i < n; i++) proj[i] /= norm;
  }

  return proj;
}

/* ------------------------------------------------------------------ */
/*  Step bound computation (analytical, no LP)                          */
/* ------------------------------------------------------------------ */

/**
 * Compute the feasible step range [minStep, maxStep] along a direction
 * from the current point using analytical bounds from:
 *
 * 1. Variable bounds: lb_i <= current_i + t * d_i <= ub_i
 * 2. Optimality constraint: c^T * (current + t * d) >= (1 - tol) * z*
 *
 * Since the direction is in the null space of equality constraints,
 * mass balance is automatically satisfied for any t.
 *
 * At t=0 we are at the current (feasible) point, so the range contains 0.
 */
function findStepBounds(
  current: number[],
  direction: number[],
  varLb: number[],
  varUb: number[],
  objCoefs: Record<string, number>,
  varNames: string[],
  objTarget: number,
): { minStep: number; maxStep: number } {
  let minStep = -Infinity;
  let maxStep = Infinity;

  const n = varNames.length;

  // Bounds from variable constraints
  for (let i = 0; i < n; i++) {
    const d = direction[i];
    if (Math.abs(d) < 1e-15) continue;

    const lbT = (varLb[i] - current[i]) / d;
    const ubT = (varUb[i] - current[i]) / d;

    if (d > 0) {
      // t >= lbT and t <= ubT
      if (lbT > minStep) minStep = lbT;
      if (ubT < maxStep) maxStep = ubT;
    } else {
      // t <= lbT and t >= ubT (inequalities flip)
      if (ubT > minStep) minStep = ubT;
      if (lbT < maxStep) maxStep = lbT;
    }
  }

  // Optimality constraint: obj(current + t*d) >= objTarget
  // => obj(current) + t * obj(d) >= objTarget
  const objAtCurrent = varNames.reduce((s, name, i) => s + (objCoefs[name] ?? 0) * current[i], 0);
  const objAlongDir = varNames.reduce((s, name, i) => s + (objCoefs[name] ?? 0) * direction[i], 0);
  const rhs = objTarget - objAtCurrent;

  if (Math.abs(objAlongDir) > 1e-15) {
    const bound = rhs / objAlongDir;
    if (objAlongDir > 0) {
      // t >= bound
      if (bound > minStep) minStep = bound;
    } else {
      // t <= bound
      if (bound < maxStep) maxStep = bound;
    }
  } else if (rhs > 1e-10) {
    // obj(d) = 0 but obj(current) < target: infeasible
    // This shouldn't happen if current is feasible, but guard against it
    minStep = 0;
    maxStep = 0;
  }

  // Numerical safety: ensure the range contains 0 (current point is feasible)
  if (minStep > 0) minStep = 0;
  if (maxStep < 0) maxStep = 0;

  return { minStep, maxStep };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sample flux distributions from the optimal face of a constraint-based
 * metabolic model using hit-and-run MCMC.
 *
 * The algorithm:
 * 1. Solves the FBA to find the optimal objective value (warm-start)
 * 2. Identifies equality vs inequality constraints from the model
 * 3. Computes the null space of equality constraints (mass balance)
 * 4. Iteratively generates random directions in the null space and samples
 *    along them within the feasible region using analytical step bounds
 *
 * @param model - The LP model (from buildAuthorityFBAModel or equivalent)
 * @param nSamples - Number of flux samples to generate
 * @param tolerance - Fraction of objective to allow (default 1e-6)
 * @returns Array of FluxSample objects with fluxes and objective values
 */
export async function sampleFlux(model: LPModel, nSamples: number, tolerance = 1e-6): Promise<FluxSample[]> {
  if (nSamples <= 0) return [];

  // Collect variable names from model bounds (in order)
  const varNames = (model.bounds ?? []).map((b) => b.name);
  const n = varNames.length;
  if (n === 0) return [];

  // Step 1: Solve for optimal objective (warm-start)
  const optResult = await solveLP(model);
  if (optResult.status !== "optimal" || optResult.objectiveValue <= 0) {
    return [];
  }

  const optimalObjective = optResult.objectiveValue;
  const objTarget = optimalObjective * (1 - tolerance);

  // Step 2: Find an interior point on the optimal face via FVA centering.
  // The FBA vertex is often at a bound, blocking most null-space directions.
  // We compute each variable's range on the optimal face (like FVA), then
  // use the midpoint as a well-centered starting point for hit-and-run.
  const varLb: number[] = [];
  const varUb: number[] = [];
  const boundsMap = new Map((model.bounds ?? []).map((b) => [b.name, b]));
  for (const name of varNames) {
    const b = boundsMap.get(name);
    varLb.push(b?.lb ?? 0);
    varUb.push(b?.ub ?? Infinity);
  }

  const optConstraint = {
    name: "flux_sample_optimality",
    vars: model.objective,
    lb: optimalObjective * (1 - tolerance),
    ub: Infinity,
  };

  // FVA: compute min and max for each variable on the optimal face
  const fvaModel: LPModel = {
    ...model,
    name: "flux_sample_fva",
    constraints: [...model.constraints, optConstraint],
  };

  const varMin: number[] = new Array(n).fill(0);
  const varMax: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const name = varNames[i];
    const minModel: LPModel = {
      ...fvaModel,
      sense: "minimize",
      objective: [{ name, coef: 1 }],
    };
    const maxModel: LPModel = {
      ...fvaModel,
      sense: "maximize",
      objective: [{ name, coef: 1 }],
    };
    const [minR, maxR] = await Promise.all([solveLP(minModel), solveLP(maxModel)]);
    varMin[i] = minR.status === "optimal" ? minR.objectiveValue : (optResult.primals[name] ?? 0);
    varMax[i] = maxR.status === "optimal" ? maxR.objectiveValue : (optResult.primals[name] ?? 0);
  }

  // Use midpoint of FVA range as starting point
  const current: number[] = varNames.map((_, i) => (varMin[i] + varMax[i]) / 2);

  // Step 3: Identify equality constraints (lb == ub within tolerance)
  const eqConstraints = model.constraints.filter(
    (c) => Math.abs(c.lb - c.ub) < 1e-10 && c.lb !== Infinity && c.lb !== -Infinity,
  );

  // Build the equality constraint matrix for null space computation
  const varIndex = new Map(varNames.map((name, i) => [name, i]));
  const Aeq: number[][] = eqConstraints.map((c) => {
    const row = new Array(n).fill(0);
    for (const v of c.vars) {
      const idx = varIndex.get(v.name);
      if (idx !== undefined) row[idx] = v.coef;
    }
    return row;
  });

  // Step 4: Compute null space basis including active bound constraints.
  // Variables with very narrow FVA ranges on the optimal face are effectively
  // fixed, so we add unit constraints (d_i = 0) to the null space computation.
  // This ensures random directions don't move variables that can't actually change.
  const RANGE_TOL = 1e-4;
  const AeqWithBounds = [...Aeq];
  for (let i = 0; i < n; i++) {
    if (varMax[i] - varMin[i] < RANGE_TOL) {
      const row = new Array(n).fill(0);
      row[i] = 1;
      AeqWithBounds.push(row);
    }
  }
  const nullBasis = nullSpaceBasis(AeqWithBounds);

  // If null space is empty (fully constrained), no sampling possible
  if (nullBasis.length === 0) {
    // Return a single sample at the optimal point
    const fluxes: Record<string, number> = {};
    for (let j = 0; j < n; j++) fluxes[varNames[j]] = round(current[j]);
    const objVal = model.objective.reduce((s, v) => s + v.coef * (fluxes[v.name] ?? 0), 0);
    return [{ fluxes, objectiveValue: round(objVal) }];
  }

  // Precompute objective coefficients
  const objCoefs: Record<string, number> = {};
  for (const v of model.objective) objCoefs[v.name] = (objCoefs[v.name] ?? 0) + v.coef;

  // Step 5: Hit-and-run sampling
  const samples: FluxSample[] = [];

  for (let i = 0; i < nSamples; i++) {
    // Generate random direction in the null space of equality constraints
    const direction = randomNullSpaceDirection(n, nullBasis);

    // Check direction is non-trivial
    const dirNorm = Math.sqrt(direction.reduce((s, v) => s + v * v, 0));
    if (dirNorm < 1e-12) {
      // Degenerate direction, record current point
      const fluxes: Record<string, number> = {};
      for (let j = 0; j < n; j++) fluxes[varNames[j]] = round(current[j]);
      const objVal = model.objective.reduce((s, v) => s + v.coef * (fluxes[v.name] ?? 0), 0);
      samples.push({ fluxes, objectiveValue: round(objVal) });
      continue;
    }

    // Find feasible step range (analytical, no LP solves)
    const { minStep, maxStep } = findStepBounds(current, direction, varLb, varUb, objCoefs, varNames, objTarget);

    if (maxStep - minStep < 1e-12) {
      // Degenerate: no room to move, record current point
      const fluxes: Record<string, number> = {};
      for (let j = 0; j < n; j++) fluxes[varNames[j]] = round(current[j]);
      const objVal = model.objective.reduce((s, v) => s + v.coef * (fluxes[v.name] ?? 0), 0);
      samples.push({ fluxes, objectiveValue: round(objVal) });
      continue;
    }

    // Sample uniformly along the feasible segment
    const t = minStep + Math.random() * (maxStep - minStep);

    // Update current point
    for (let j = 0; j < n; j++) {
      current[j] += t * direction[j];
    }

    // Record sample
    const fluxes: Record<string, number> = {};
    for (let j = 0; j < n; j++) fluxes[varNames[j]] = round(current[j]);
    const objVal = model.objective.reduce((s, v) => s + v.coef * (fluxes[v.name] ?? 0), 0);
    samples.push({ fluxes, objectiveValue: round(objVal) });
  }

  return samples;
}

/**
 * Compute flux ranges (min, max, mean, std) for each reaction by sampling
 * the optimal flux solution space.
 *
 * This is a convenience wrapper around sampleFlux that computes per-reaction
 * statistics. The resulting ranges are analogous to FVA but reflect the
 * distribution of fluxes across sampled optima rather than absolute bounds.
 *
 * @param model - The LP model (from buildAuthorityFBAModel or equivalent)
 * @param nSamples - Number of samples to draw (default 100)
 * @param tolerance - Fraction of objective to allow (default 1e-6)
 * @returns Array of FluxRange objects with per-reaction statistics
 */
export async function computeFluxRange(model: LPModel, nSamples = 100, tolerance = 1e-6): Promise<FluxRange[]> {
  const samples = await sampleFlux(model, nSamples, tolerance);
  if (samples.length === 0) return [];

  // Collect all reaction IDs from the first sample
  const reactionIds = Object.keys(samples[0].fluxes);

  return reactionIds.map((reactionId) => {
    const values = samples.map((s) => s.fluxes[reactionId] ?? 0);
    const n = values.length;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    return {
      reactionId,
      min: round(min),
      max: round(max),
      mean: round(mean),
      std: round(std),
    };
  });
}
