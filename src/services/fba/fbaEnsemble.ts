/**
 * Ensemble FBA and Flux Variability Analysis (FVA).
 *
 * Provides two complementary analyses for constraint-based metabolic models:
 *
 * 1. **Ensemble FBA** — generates a distribution of alternative optimal flux
 *    distributions by repeatedly perturbing the objective function coefficients.
 *    Each sample solves the LP with a randomly perturbed objective, weighted
 *    by small additive noise on the original coefficients. The ensemble
 *    reveals which fluxes are tightly constrained by optimality vs. those
 *    that can vary freely (degenerate fluxes).
 *
 * 2. **Flux Variability Analysis (FVA)** — for each reaction, computes the
 *    minimum and maximum flux that is consistent with the optimal objective
 *    value. Reactions with a wide FVA range are degenerate (multiple optima
 *    exist); reactions with a narrow range are tightly determined.
 *
 * The ensemble approach uses random objective perturbation: for each sample,
 * each objective coefficient c_i is replaced by c_i + eps_i where eps_i is
 * drawn from a uniform distribution on [-delta, delta] * |c_i|. This
 * explores different optima within the feasible region while staying near
 * the original objective. The perturbation magnitude (delta) controls the
 * trade-off between exploration of alternative optima and proximity to the
 * original solution.
 *
 * @scientific_provenance
 *   ALGORITHM: Ensemble FBA via random objective perturbation
 *   REFERENCE: Reed, J.L. & Palsson, B.O. (2004) "Genome-scale in silico
 *     models of E. coli have multiple equivalent phenotypic states:
 *     assessment of correlated reaction subsets that comprise network states"
 *     Genome Research 14(9):1797-1805
 *   REFERENCE: Mahadevan, R. & Schilling, C.H. (2003) "The effects of
 *     alternate optimal solutions in constraint-based genome-scale metabolic
 *     models" Metabolic Engineering 5(4):264-276
 *   KNOWN_LIMITATIONS:
 *     - Objective perturbation explores a subset of the optimal face; it does
 *       not guarantee uniform sampling of all alternative optima
 *     - Each sample requires an independent LP solve; ensemble size directly
 *       controls computational cost
 *     - Perturbation magnitude (delta) is a heuristic; too large explores
 *       suboptimal solutions, too small yields identical samples
 *     - FVA requires 2 * n LP solves (min and max per variable), which is
 *       expensive for genome-scale models
 *     - Reactions with zero FVA range may still participate in alternative
 *       optima if coupled to other degenerate variables
 */

import { type LPModel, solveLP } from "../../server/highsSolver";
import { SeededRNG } from "../../utils/seededRng";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

/** A single solution from the ensemble. */
export interface EnsembleSolution {
  /** Reaction flux values (reaction ID -> flux). */
  fluxes: Record<string, number>;
  /** Objective value for this perturbed solve. */
  objectiveValue: number;
}

/** Result of an ensemble FBA run. */
export interface EnsembleResult {
  /** Individual solutions from each perturbed solve. */
  solutions: EnsembleSolution[];
  /** Per-reaction mean flux across all ensemble solutions. */
  meanFluxes: Record<string, number>;
  /** Per-reaction standard deviation of flux across ensemble solutions. */
  stdFluxes: Record<string, number>;
}

/** FVA result for a single reaction. */
export interface FVAReaction {
  /** Reaction identifier. */
  id: string;
  /** Minimum flux consistent with optimal objective. */
  min: number;
  /** Maximum flux consistent with optimal objective. */
  max: number;
  /** FVA variability: max - min. Zero means the flux is uniquely determined. */
  variability: number;
}

/** Result of a flux variability analysis run. */
export interface FVAResult {
  /** Per-reaction FVA bounds and variability. */
  reactions: FVAReaction[];
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
  };
}

/**
 * Collect all variable names from model bounds (in order).
 */
function collectVariableNames(model: LPModel): string[] {
  return (model.bounds ?? []).map((b) => b.name);
}

/**
 * Generate a uniform random number in [lo, hi] from a seeded PRNG.
 */
function uniformRandom(lo: number, hi: number, rng: SeededRNG): number {
  return lo + rng.next() * (hi - lo);
}

/* ------------------------------------------------------------------ */
/*  Ensemble FBA                                                       */
/* ------------------------------------------------------------------ */

/**
 * Run ensemble FBA by solving the LP multiple times with randomly perturbed
 * objective coefficients.
 *
 * For each sample, the original objective coefficient c_i is replaced by:
 *
 *   c_i' = c_i + eps_i,   eps_i ~ Uniform(-delta * |c_i|, delta * |c_i|)
 *
 * This perturbation explores alternative optima within (or near) the
 * original feasible region. The ensemble reveals flux distributions that
 * are consistent with (near-)optimal growth, exposing degenerate fluxes
 * that standard FBA hides.
 *
 * @param model      - The LP model to analyse
 * @param nSamples   - Number of ensemble samples to generate
 * @param delta      - Perturbation magnitude as a fraction of |c_i|
 *                     (default 0.1 = 10% perturbation)
 * @returns EnsembleResult with all solutions and per-reaction statistics
 */
export async function runEnsembleFBA(
  model: LPModel,
  nSamples: number,
  delta = 0.1,
  seed = 42,
): Promise<EnsembleResult> {
  if (nSamples <= 0) {
    return { solutions: [], meanFluxes: {}, stdFluxes: {} };
  }

  const varNames = collectVariableNames(model);
  const solutions: EnsembleSolution[] = [];
  const rng = new SeededRNG(seed);

  for (let i = 0; i < nSamples; i++) {
    // Build a perturbed model: clone and perturb objective coefficients
    const perturbed = cloneModel(model);
    perturbed.objective = model.objective.map((v) => {
      const noise = uniformRandom(-delta * Math.abs(v.coef), delta * Math.abs(v.coef), rng);
      return { name: v.name, coef: v.coef + noise };
    });

    const result = await solveLP(perturbed);

    if (result.status === "optimal") {
      const fluxes: Record<string, number> = {};
      for (const name of varNames) {
        fluxes[name] = round(result.primals[name] ?? 0);
      }
      solutions.push({
        fluxes,
        objectiveValue: round(result.objectiveValue),
      });
    } else {
      // Infeasible or error: record zeros (should be rare with small delta)
      const fluxes: Record<string, number> = {};
      for (const name of varNames) {
        fluxes[name] = 0;
      }
      solutions.push({ fluxes, objectiveValue: 0 });
    }
  }

  // Compute per-reaction statistics
  const meanFluxes: Record<string, number> = {};
  const stdFluxes: Record<string, number> = {};

  for (const name of varNames) {
    const values = solutions.map((s) => s.fluxes[name] ?? 0);
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
    meanFluxes[name] = round(mean);
    stdFluxes[name] = round(Math.sqrt(variance));
  }

  return { solutions, meanFluxes, stdFluxes };
}

/* ------------------------------------------------------------------ */
/*  Flux Variability Analysis                                          */
/* ------------------------------------------------------------------ */

/**
 * Compute Flux Variability Analysis (FVA) for all reactions in the model.
 *
 * For each reaction, FVA finds the minimum and maximum flux that is
 * consistent with the optimal objective value. This is done by:
 *
 * 1. Solving the original LP to find the optimal objective z*.
 * 2. Adding a constraint that the objective must equal z* (within tolerance).
 * 3. For each reaction, minimizing and maximizing its flux subject to
 *    all constraints plus the optimality constraint.
 *
 * The variability (max - min) indicates how much a reaction's flux can
 * change while maintaining optimality. A variability of zero means the
 * flux is uniquely determined; a large variability indicates degeneracy.
 *
 * @param model          - The LP model to analyse
 * @param objectiveTolerance - Fractional tolerance on the objective
 *                             (default 1e-6, i.e. maintain within 0.0001%)
 * @returns FVAResult with per-reaction min, max, and variability
 */
export async function computeFluxVariability(model: LPModel, objectiveTolerance = 1e-6): Promise<FVAResult> {
  // Step 1: Solve for optimal objective
  const optResult = await solveLP(model);
  if (optResult.status !== "optimal") {
    return { reactions: [] };
  }

  const optimalObjective = optResult.objectiveValue;
  if (optimalObjective <= 1e-12) {
    // Zero objective: all fluxes are zero by convention
    const varNames = collectVariableNames(model);
    return {
      reactions: varNames.map((id) => ({ id, min: 0, max: 0, variability: 0 })),
    };
  }

  // Step 2: Build a model with the optimality constraint
  const optLb = optimalObjective * (1 - objectiveTolerance);
  const optUb = optimalObjective * (1 + objectiveTolerance);
  const fvaBase = cloneModel(model);
  fvaBase.constraints.push({
    name: "__fva_optimality__",
    vars: model.objective.map((v) => ({ ...v })),
    lb: Math.min(optLb, optUb),
    ub: Math.max(optLb, optUb),
  });

  // Step 3: For each reaction, compute min and max flux
  const varNames = collectVariableNames(model);
  const reactions: FVAReaction[] = [];

  for (const rxnId of varNames) {
    // Minimize this reaction's flux
    const minModel = cloneModel(fvaBase);
    minModel.sense = "minimize";
    minModel.objective = [{ name: rxnId, coef: 1 }];

    // Maximize this reaction's flux
    const maxModel = cloneModel(fvaBase);
    maxModel.sense = "maximize";
    maxModel.objective = [{ name: rxnId, coef: 1 }];

    const [minResult, maxResult] = await Promise.all([solveLP(minModel), solveLP(maxModel)]);

    const minFlux = minResult.status === "optimal" ? round(minResult.objectiveValue) : 0;
    const maxFlux = maxResult.status === "optimal" ? round(maxResult.objectiveValue) : 0;

    reactions.push({
      id: rxnId,
      min: minFlux,
      max: maxFlux,
      variability: round(maxFlux - minFlux),
    });
  }

  return { reactions };
}
