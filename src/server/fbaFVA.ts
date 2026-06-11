/**
 * Flux Variability Analysis (FVA).
 *
 * For each reaction, find the min and max flux while maintaining
 * the optimal objective value.
 *
 * Reference: Mahadevan & Schilling (2003) Metab Eng 5:264
 */
import { solveLP, type LPModel, type LPSolution } from './highsSolver';

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

  const varsToAnalyze = reactionIds || baseModel.objective.map(v => v.name);

  // Add objective constraint: obj >= (1 - tolerance) * optimal
  const objConstraint = {
    name: 'fva_obj_constraint',
    vars: baseModel.objective,
    lb: objectiveValue * (1 - tolerance),
    ub: Infinity,
  };

  const results: FVAResult[] = [];

  for (const varName of varsToAnalyze) {
    // Minimize this variable
    const minModel: LPModel = {
      ...baseModel,
      sense: 'minimize',
      objective: [{ name: varName, coef: 1 }],
      constraints: [...baseModel.constraints, objConstraint],
    };

    // Maximize this variable
    const maxModel: LPModel = {
      ...baseModel,
      sense: 'maximize',
      objective: [{ name: varName, coef: 1 }],
      constraints: [...baseModel.constraints, objConstraint],
    };

    const [minResult, maxResult] = await Promise.all([
      solveLP(minModel),
      solveLP(maxModel),
    ]);

    results.push({
      reactionId: varName,
      min: minResult.status === 'optimal' ? minResult.objectiveValue : 0,
      max: maxResult.status === 'optimal' ? maxResult.objectiveValue : 0,
    });
  }

  return {
    results,
    objectiveValue,
    solveTime: Date.now() - start,
  };
}
