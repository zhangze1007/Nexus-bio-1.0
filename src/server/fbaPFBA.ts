/**
 * Parsimonious Flux Balance Analysis (pFBA).
 *
 * pFBA is a two-stage linear programming approach that first identifies the
 * optimal objective value (e.g., maximal growth rate), then selects the flux
 * distribution that minimizes the total sum of absolute fluxes while maintaining
 * that optimum. This yields the most thermodynamically and enzymatically efficient
 * solution among all optima, reflecting the biological principle that cells tend
 * to minimize unnecessary metabolic activity. Absolute values are linearized by
 * splitting each flux variable into positive and negative components.
 *
 * Reference: Lewis, N.E., Hixson, K.K., Conrad, T.M., Lerman, J.A., Charusanti, P.,
 * Polpitiya, A.D., Adkins, J.N., Schramm, G., Purvine, S.O., Lopez-Ferrer, D.,
 * Weitz, K.K., Eils, R., Konig, R., Smith, R.D. & Palsson, B.O. (2010)
 * "Omic data from evolved E. coli are consistent with computed optimal growth
 * from genome-scale models" Molecular Systems Biology 6:390
 *
 * @scientific_provenance
 *   ALGORITHM: Parsimonious Flux Balance Analysis (pFBA)
 *   REFERENCE: Lewis, N.E. et al. (2010) Molecular Systems Biology 6:390
 *   KNOWN_LIMITATIONS:
 *     - The LP relaxation of absolute value minimization does not guarantee a unique solution when multiple flux distributions achieve the same minimal total flux
 *     - Assumes the objective function (e.g., biomass) is correctly defined; results are sensitive to the choice of objective
 *     - Does not account for enzyme expression costs or metabolite concentrations; only minimizes total flux magnitude
 */
import { type LPModel, type LPSolution, solveLP } from "./highsSolver";

export interface pFBAOutput {
  fluxes: Record<string, number>;
  totalFlux: number;
  objectiveValue: number;
  solveTime: number;
}

/**
 * Run pFBA on a model.
 *
 * Step 1: Solve for optimal objective
 * Step 2: Fix objective at optimum, minimize sum of absolute fluxes
 *
 * For minimization of |v_i|, we split each variable into v_i_pos and v_i_neg
 * where v_i = v_i_pos - v_i_neg, v_i_pos >= 0, v_i_neg >= 0,
 * and minimize sum(v_i_pos + v_i_neg).
 */
export async function runPFBA(baseModel: LPModel): Promise<pFBAOutput> {
  const start = Date.now();

  // Step 1: Solve for optimal objective
  const optResult = await solveLP(baseModel);
  if (optResult.status !== "optimal") {
    return {
      fluxes: {},
      totalFlux: 0,
      objectiveValue: 0,
      solveTime: Date.now() - start,
    };
  }

  const objectiveValue = optResult.objectiveValue;

  // Step 2: Build pFBA model
  const pfbaModel: LPModel = {
    name: "pfba",
    sense: "minimize",
    objective: [],
    constraints: [],
    bounds: [],
  };

  // Collect all original variable names from constraints and bounds
  const originalVars = new Set<string>();
  for (const c of baseModel.constraints) {
    for (const v of c.vars) {
      originalVars.add(v.name);
    }
  }
  if (baseModel.bounds) {
    for (const b of baseModel.bounds) {
      originalVars.add(b.name);
    }
  }

  // For each original variable v_i, create v_i_pos and v_i_neg
  // These are non-negative: min |v_i| = min (v_i_pos + v_i_neg)
  for (const varName of originalVars) {
    pfbaModel.objective.push({ name: `${varName}_pos`, coef: 1 });
    pfbaModel.objective.push({ name: `${varName}_neg`, coef: 1 });
    pfbaModel.bounds!.push({ name: `${varName}_pos`, lb: 0, ub: Infinity });
    pfbaModel.bounds!.push({ name: `${varName}_neg`, lb: 0, ub: Infinity });
  }

  // Mark original variables as free so they can take negative values.
  // CPLEX LP defaults unbounded variables to [0, +inf], which would
  // incorrectly constrain fluxes that can be reversible.
  // Only add free bounds for variables NOT already bounded by the base model,
  // since the LP builder uses find() which returns the first matching bound.
  const baseBoundedVars = new Set((baseModel.bounds ?? []).map((b) => b.name));
  for (const varName of originalVars) {
    if (!baseBoundedVars.has(varName)) {
      pfbaModel.bounds!.push({ name: varName, lb: -Infinity, ub: Infinity });
    }
  }

  // Constraint: v_i = v_i_pos - v_i_neg for each variable (equality)
  for (const varName of originalVars) {
    pfbaModel.constraints.push({
      name: `split_${varName}`,
      vars: [
        { name: varName, coef: 1 },
        { name: `${varName}_pos`, coef: -1 },
        { name: `${varName}_neg`, coef: 1 },
      ],
      lb: 0,
      ub: 0,
    });
  }

  // Copy original constraints
  for (const c of baseModel.constraints) {
    pfbaModel.constraints.push(c);
  }

  // Copy original bounds (for variables not already in the bounds list)
  if (baseModel.bounds) {
    for (const b of baseModel.bounds) {
      pfbaModel.bounds!.push(b);
    }
  }

  // Fix objective at optimum: the original objective must remain optimal.
  // Since we solved for maximum, fixing at objectiveValue with a lower bound
  // ensures we stay at the optimum while minimizing total flux.
  pfbaModel.constraints.push({
    name: "fix_objective",
    vars: baseModel.objective,
    lb: objectiveValue * (1 - 1e-6),
    ub: Infinity,
  });

  // Step 3: Solve pFBA
  const pfbaResult = await solveLP(pfbaModel);

  // Extract original fluxes: v_i = v_i_pos - v_i_neg
  const fluxes: Record<string, number> = {};
  let totalFlux = 0;

  for (const varName of originalVars) {
    const pos = pfbaResult.primals[`${varName}_pos`] || 0;
    const neg = pfbaResult.primals[`${varName}_neg`] || 0;
    fluxes[varName] = pos - neg;
    totalFlux += pos + neg;
  }

  return {
    fluxes,
    totalFlux,
    objectiveValue,
    solveTime: Date.now() - start,
  };
}
