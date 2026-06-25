/**
 * Flux Variability Analysis (FVA).
 *
 * For each reaction in a constraint-based metabolic model, FVA determines the
 * minimum and maximum flux values that are consistent with an optimal objective
 * value (e.g., maximal biomass). This reveals the full range of feasible flux
 * distributions and identifies reactions with uniquely determined fluxes versus
 * those with metabolic flexibility. Each reaction is solved as two LP problems
 * (minimize and maximize) subject to an objective optimality constraint.
 *
 * Reference: Mahadevan, R. & Schilling, C.H. (2003) "The effects of alternate
 * optimal solutions in constraint-based genome-scale metabolic models"
 * Metabolic Engineering 5(4):264-276
 *
 * @scientific_provenance
 *   ALGORITHM: Flux Variability Analysis (FVA)
 *   REFERENCE: Mahadevan, R. & Schilling, C.H. (2003) Metabolic Engineering 5(4):264-276
 *   KNOWN_LIMITATIONS:
 *     - Scales linearly with the number of reactions analyzed, making it slow for genome-scale models with thousands of reactions
 *     - Solutions at the boundaries of the feasible space may not reflect biologically realistic flux distributions
 *     - Does not account for thermodynamic constraints or enzyme capacity limits
 */
import { type LPModel, type LPSolution, solveLP } from "./highsSolver";

export interface FVAResult {
  reactionId: string;
  min: number;
  max: number;
}

export interface FVAOutput {
  results: FVAResult[];
  objectiveValue: number;
  solveTime: number;
}

/**
 * Run FVA on a model.
 *
 * @param baseModel - The base LP model (already solved for optimal objective)
 * @param objectiveValue - The optimal objective value from the base solve
 * @param reactionIds - Reaction IDs to analyze (defaults to all objective vars)
 * @param tolerance - Fraction of objective to allow (default 1e-6)
 */
export async function runFVA(
  baseModel: LPModel,
  objectiveValue: number,
  reactionIds?: string[],
  tolerance = 1e-6,
): Promise<FVAOutput> {
  const start = Date.now();

  const varsToAnalyze = reactionIds || baseModel.objective.map((v) => v.name);

  // Add objective constraint: obj >= (1 - tolerance) * optimal
  const objConstraint = {
    name: "fva_obj_constraint",
    vars: baseModel.objective,
    lb: objectiveValue * (1 - tolerance),
    ub: Infinity,
  };

  const results: FVAResult[] = [];

  for (const varName of varsToAnalyze) {
    // Minimize this variable
    const minModel: LPModel = {
      ...baseModel,
      sense: "minimize",
      objective: [{ name: varName, coef: 1 }],
      constraints: [...baseModel.constraints, objConstraint],
    };

    // Maximize this variable
    const maxModel: LPModel = {
      ...baseModel,
      sense: "maximize",
      objective: [{ name: varName, coef: 1 }],
      constraints: [...baseModel.constraints, objConstraint],
    };

    const [minResult, maxResult] = await Promise.all([solveLP(minModel), solveLP(maxModel)]);

    results.push({
      reactionId: varName,
      min: minResult.status === "optimal" ? minResult.objectiveValue : 0,
      max: maxResult.status === "optimal" ? maxResult.objectiveValue : 0,
    });
  }

  return {
    results,
    objectiveValue,
    solveTime: Date.now() - start,
  };
}
