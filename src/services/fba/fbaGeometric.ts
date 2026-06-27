/**
 * Geometric Flux Balance Analysis (Geometric FBA).
 *
 * Geometric FBA finds the unique flux distribution in the optimal solution
 * space of a constraint-based metabolic model. Standard FBA admits a convex
 * polytope of optimal solutions when the solution is degenerate; geometric
 * FBA selects the centroid-like point that minimises the sum of squared
 * fluxes (L2 norm) while maintaining the optimal objective value.
 *
 * Algorithm (sequential FVA midpoint iteration):
 *   1. Solve standard FBA (LP) to find the optimal objective value z*.
 *   2. Fix the objective at z* (equality constraint).
 *   3. For each flux variable v_i (in deterministic order):
 *      a. Minimise v_i subject to all constraints (lower bound of FVA range).
 *      b. Maximise v_i subject to all constraints (upper bound of FVA range).
 *      c. Fix v_i at the midpoint (min + max) / 2 by adding an equality
 *         constraint.  The midpoint is always feasible (convex combination
 *         of two feasible extreme points).
 *   4. After processing all variables, every flux is uniquely determined.
 *
 * This LP-only approach approximates the true L2-norm geometric FBA (which
 * requires QP).  The sequential midpoint iteration converges to the analytic
 * center of the optimal face, which closely approximates the L2 minimiser
 * for well-conditioned metabolic models.  The result is order-independent
 * when the optimal face is a product of intervals (no coupling between
 * degenerate fluxes); for coupled degeneracies, the processing order
 * (alphabetical by variable name) ensures determinism.
 *
 * Reference: Smallbone, K. & Simeonidis, E. (2009) "Flux balance analysis:
 *   a geometric perspective" J Theor Biol 258(2):281-286
 *
 * @scientific_provenance
 *   ALGORITHM: Geometric FBA via sequential FVA midpoint iteration
 *   REFERENCE: Smallbone, K. & Simeonidis, E. (2009) J Theor Biol 258(2):281-286
 *   KNOWN_LIMITATIONS:
 *     - Sequential midpoint iteration approximates the true L2 minimiser;
 *       exact L2 requires QP (not available in all solver builds)
 *     - Processing order affects the result for coupled degeneracies;
 *       alphabetical order is used for determinism
 *     - O(2n) LP solves where n is the number of variables; for very large
 *       models (>10k reactions) this may be slow
 *     - Assumes the objective function (e.g., biomass) is correctly defined
 *     - The uniqueness guarantee holds only when the feasible region is
 *       non-empty and bounded; unbounded models require careful bound setup
 */

import { type LPModel, solveLP } from "../../server/highsSolver";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

/**
 * Result of a geometric FBA solve.
 */
export interface GeometricFBAResult {
  /** Unique flux distribution at the analytic centre of the optimal face. */
  fluxes: Record<string, number>;
  /** Optimal objective value from the initial FBA solve (e.g., growth rate). */
  objectiveValue: number;
  /**
   * Whether the returned flux distribution is provably unique.
   * True when the sequential midpoint iteration completes successfully,
   * which is always the case for a non-empty bounded feasible region.
   * False only when the model is infeasible/unbounded or an intermediate
   * LP solve fails.
   */
  isUnique: boolean;
  /** Wall-clock solve time in milliseconds. */
  solveTime: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Deep-copy an LPModel so that modifications do not affect the original.
 */
function cloneModel(model: LPModel): LPModel {
  return {
    name: model.name,
    sense: model.sense,
    objective: model.objective.map((v) => ({ ...v })),
    constraints: model.constraints.map((c) => ({
      name: c.name,
      vars: c.vars.map((v) => ({ ...v })),
      lb: c.lb,
      ub: c.ub,
    })),
    bounds: model.bounds?.map((b) => ({ ...b })),
    quadratic: model.quadratic?.map((q) => ({ ...q })),
    binaries: model.binaries?.slice(),
    integers: model.integers?.slice(),
  };
}

/**
 * Collect all variable names referenced in an LP model (objective,
 * constraints, and bounds).
 */
function collectVariables(model: LPModel): string[] {
  const vars = new Set<string>();
  for (const v of model.objective) {
    vars.add(v.name);
  }
  for (const c of model.constraints) {
    for (const v of c.vars) {
      vars.add(v.name);
    }
  }
  if (model.bounds) {
    for (const b of model.bounds) {
      vars.add(b.name);
    }
  }
  // Sort for deterministic processing order
  return Array.from(vars).sort();
}

/* ------------------------------------------------------------------ */
/*  Core algorithm                                                     */
/* ------------------------------------------------------------------ */

/**
 * Run Geometric FBA on a constraint-based metabolic model.
 *
 * Step 1: Solve the input LP (as-is) to find the optimal objective value.
 * Step 2: Build a working model with the objective fixed at its optimum.
 * Step 3: For each variable, compute the FVA range (min, max) and fix
 *         the variable at the midpoint.  The midpoint is always feasible.
 * Step 4: After all variables are fixed, the solution is unique.
 *
 * @param baseModel - The FBA LP model (maximise or minimise objective).
 *                    Must include stoichiometric balance constraints, variable
 *                    bounds, and an objective function.
 * @returns GeometricFBAResult with the unique flux distribution, or empty
 *          fluxes if the model is infeasible.
 */
export async function solveGeometricFBA(baseModel: LPModel): Promise<GeometricFBAResult> {
  const start = Date.now();

  // ── Step 1: Solve standard FBA for optimal objective ───────────────
  const fbaResult = await solveLP(baseModel);

  if (fbaResult.status !== "optimal") {
    return {
      fluxes: {},
      objectiveValue: 0,
      isUnique: false,
      solveTime: Date.now() - start,
    };
  }

  const objectiveValue = fbaResult.objectiveValue;

  // ── Step 2: Build working model with fixed objective ──────────────
  const workingModel = cloneModel(baseModel);

  // Fix objective at its optimal value (equality constraint).
  // Use a tight tolerance to allow for numerical noise in the LP solve.
  const tolerance = 1e-6;
  const objLb = objectiveValue * (1 - tolerance);
  const objUb = objectiveValue * (1 + tolerance);

  workingModel.constraints.push({
    name: "fix_objective",
    vars: baseModel.objective.map((v) => ({ ...v })),
    lb: Math.min(objLb, objUb),
    ub: Math.max(objLb, objUb),
  });

  // ── Step 3: Sequential FVA midpoint iteration ─────────────────────
  // For each variable, minimise and maximise it, then fix at midpoint.
  const varNames = collectVariables(baseModel);
  const fluxes: Record<string, number> = {};

  for (const varName of varNames) {
    // Minimise v_i
    const minModel = cloneModel(workingModel);
    minModel.sense = "minimize";
    minModel.objective = [{ name: varName, coef: 1 }];
    // Remove any quadratic terms (we're doing pure LP now)
    delete minModel.quadratic;

    const minResult = await solveLP(minModel);
    if (minResult.status !== "optimal") {
      // If minimisation fails, the system may have become infeasible
      return {
        fluxes,
        objectiveValue: round(objectiveValue),
        isUnique: false,
        solveTime: Date.now() - start,
      };
    }

    // Maximise v_i
    const maxModel = cloneModel(workingModel);
    maxModel.sense = "maximize";
    maxModel.objective = [{ name: varName, coef: 1 }];
    delete maxModel.quadratic;

    const maxResult = await solveLP(maxModel);
    if (maxResult.status !== "optimal") {
      return {
        fluxes,
        objectiveValue: round(objectiveValue),
        isUnique: false,
        solveTime: Date.now() - start,
      };
    }

    const minVal = minResult.objectiveValue;
    const maxVal = maxResult.objectiveValue;
    const midpoint = (minVal + maxVal) / 2;

    fluxes[varName] = round(midpoint);

    // Fix v_i at its midpoint by adding an equality constraint.
    // This constrains the feasible region for subsequent variables.
    workingModel.constraints.push({
      name: `fix_${varName}`,
      vars: [{ name: varName, coef: 1 }],
      lb: midpoint,
      ub: midpoint,
    });
  }

  return {
    fluxes,
    objectiveValue: round(objectiveValue),
    isUnique: true,
    solveTime: Date.now() - start,
  };
}
