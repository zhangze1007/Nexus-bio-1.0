/**
 * FBA Sensitivity Analysis and Metabolic Control Analysis (MCA).
 *
 * Provides two complementary analyses for constraint-based metabolic models:
 *
 * 1. **Sensitivity Analysis** — parametric sweep over a model parameter (e.g.
 *    glucose uptake bound) to characterise how fluxes and the objective respond.
 *    Each sweep point is an independent LP solve with the parameter clamped to
 *    a different value.  The result is a smooth flux-response curve together
 *    with finite-difference elasticity estimates.
 *
 * 2. **Metabolic Control Analysis (MCA)** — computes the three classic control
 *    coefficients (flux control, elasticity, concentration control) using
 *    finite-difference perturbation of each reaction's upper bound, following
 *    the approach described by Kacser & Burns (1973) and Heinrich & Rapoport
 *    (1974).  For LP-based FBA the "enzyme activity" proxy is the reaction's
 *    upper bound, and the elasticities are numerical derivatives of the
 *    steady-state flux with respect to that bound.
 *
 * @scientific_provenance
 *   ALGORITHM: Parametric FBA sensitivity + numerical MCA
 *   REFERENCES:
 *     - Kacser, H. & Burns, J.A. (1973) "The control of flux" Symp Soc Exp Biol 27:65-104
 *     - Heinrich, R. & Rapoport, T.A. (1974) "A linear steady-state treatment of
 *       enzymatic chains" Eur J Biochem 42:89-95
 *     - Fell, D.A. (1992) "Metabolic control analysis: a survey of its theoretical
 *       and experimental development" Biochem J 286:313-330
 *   KNOWN_LIMITATIONS:
 *     - Elasticities are numerical (finite-difference), not analytical
 *     - Concentration control coefficients are approximated from flux changes
 *       since FBA does not track metabolite concentrations directly
 *     - Only reactions with non-zero reference flux contribute to MCA
 *     - The summation theorem (sum of flux C.C. = 1) holds exactly only for
 *       the perturbation direction used; round-trip finite differences may
 *       deviate slightly from 1
 */

import type { LPModel } from "../../server/highsSolver";
import { solveLP } from "../../server/highsSolver";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface ParameterRange {
  /** Reaction or bound ID to sweep */
  parameterId: string;
  /** Sweep start value */
  min: number;
  /** Sweep end value */
  max: number;
  /** Number of sweep points (default 11) */
  steps?: number;
}

export interface SensitivityPoint {
  /** Parameter value at this sweep point */
  parameterValue: number;
  /** Objective (growth rate) at this parameter value */
  objectiveValue: number;
  /** All fluxes at this parameter value */
  fluxes: Record<string, number>;
}

export interface SensitivityResult {
  /** Which parameter was swept */
  parameter: string;
  /** Sweep values used */
  parameterValues: number[];
  /** Objective value at each sweep point */
  objectiveValues: number[];
  /** Full flux distribution at each sweep point */
  fluxResponse: SensitivityPoint[];
  /**
   * Finite-difference elasticity: d(objective)/d(parameter) normalised by
   * reference values.  Computed as (delta_J / J_ref) / (delta_p / p_ref).
   */
  elasticity: number;
  /** Reference (baseline) objective value */
  referenceObjective: number;
  /** Reference (baseline) parameter value */
  referenceParameter: number;
}

export interface ElasticityCoefficient {
  /** Reaction whose bound was perturbed */
  reactionId: string;
  /** Target reaction whose flux response was measured */
  targetReactionId: string;
  /** Elasticity value: (delta_v_target / v_target_ref) / (delta_ub / ub_ref) */
  value: number;
}

export interface MCAResult {
  /**
   * Flux control coefficients C^J_i for the objective reaction.
   * C^J_i = (delta_J / J_ref) / (delta_e_i / e_i_ref)
   * where e_i is the "enzyme activity" (upper bound) of reaction i.
   * Keyed by reaction ID.
   */
  fluxControlCoefficients: Record<string, number>;

  /**
   * Elasticity coefficients epsilon^v_i for each reaction pair.
   * Each entry describes how reaction j's flux responds to perturbation
   * of reaction i's upper bound.
   */
  elasticityCoefficients: ElasticityCoefficient[];

  /**
   * Approximate concentration control coefficients.
   * Since FBA does not track metabolite concentrations, these are estimated
   * from the shadow prices (dual variables) of the mass-balance constraints.
   * C^S_i = (delta_shadow / shadow_ref) / (delta_e_i / e_i_ref)
   * Keyed by constraint name.
   */
  concentrationControlCoefficients: Record<string, Record<string, number>>;

  /** Reference fluxes (baseline solve) */
  referenceFluxes: Record<string, number>;
  /** Reference objective value */
  referenceObjective: number;
  /** Reactions that were analysed (had non-zero reference flux) */
  analysedReactions: string[];
  /** Sum of flux control coefficients (should be ~1.0 by summation theorem) */
  fluxControlSum: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Find the bound entry for a given reaction ID in an LP model and return
 * a copy with the upper bound replaced.
 */
function withBoundOverride(model: LPModel, reactionId: string, newUb: number): LPModel {
  const bounds = (model.bounds ?? []).map((b) =>
    b.name === reactionId ? { ...b, ub: newUb } : { ...b },
  );
  return {
    ...model,
    objective: model.objective.map((v) => ({ ...v })),
    constraints: model.constraints.map((c) => ({
      ...c,
      vars: c.vars.map((v) => ({ ...v })),
    })),
    bounds,
  };
}

/**
 * Replace the objective with a single-reaction objective (coefficient 1).
 */
function withObjective(model: LPModel, reactionId: string): LPModel {
  return {
    ...model,
    objective: [{ name: reactionId, coef: 1 }],
    constraints: model.constraints.map((c) => ({
      ...c,
      vars: c.vars.map((v) => ({ ...v })),
    })),
    bounds: (model.bounds ?? []).map((b) => ({ ...b })),
  };
}

/* ------------------------------------------------------------------ */
/*  Sensitivity Analysis                                               */
/* ------------------------------------------------------------------ */

/**
 * Run a parametric sensitivity analysis on a constraint-based model.
 *
 * Sweeps one parameter (identified by its bound entry) from `min` to `max`
 * in `steps` increments, solving the LP at each point.  Returns the full
 * flux-response curve and a normalised elasticity estimate.
 *
 * @param model          - The LP model to analyse
 * @param objectiveReaction - Reaction ID whose flux is the objective to track
 * @param parameterRanges  - One or more parameter sweeps to run
 */
export async function runSensitivityAnalysis(
  model: LPModel,
  objectiveReaction: string,
  parameterRanges: ParameterRange[],
): Promise<SensitivityResult[]> {
  const results: SensitivityResult[] = [];

  // Baseline solve
  const baselineModel = withObjective(model, objectiveReaction);
  const baseline = await solveLP(baselineModel);
  const refObjective = baseline.objectiveValue;
  const refFluxes: Record<string, number> = {};
  for (const [k, v] of Object.entries(baseline.primals)) {
    refFluxes[k] = v;
  }

  for (const range of parameterRanges) {
    const steps = range.steps ?? 11;
    const stepSize = steps > 1 ? (range.max - range.min) / (steps - 1) : 0;
    const parameterValues: number[] = [];
    const objectiveValues: number[] = [];
    const fluxResponse: SensitivityPoint[] = [];

    // Find reference parameter value from the model bounds
    const refBound = (model.bounds ?? []).find((b) => b.name === range.parameterId);
    const refParamValue = refBound?.ub ?? 0;

    for (let i = 0; i < steps; i++) {
      const paramValue = round(range.min + i * stepSize, 4);
      parameterValues.push(paramValue);

      const perturbed = withBoundOverride(withObjective(model, objectiveReaction), range.parameterId, paramValue);
      const result = await solveLP(perturbed);

      const objVal = result.status === "optimal" ? round(result.objectiveValue, 6) : 0;
      objectiveValues.push(objVal);

      const pointFluxes: Record<string, number> = {};
      for (const [k, v] of Object.entries(result.primals)) {
        pointFluxes[k] = round(v, 6);
      }
      fluxResponse.push({
        parameterValue: paramValue,
        objectiveValue: objVal,
        fluxes: pointFluxes,
      });
    }

    // Finite-difference elasticity: (delta_J / J_ref) / (delta_p / p_ref)
    let elasticity = 0;
    if (
      steps >= 2 &&
      Math.abs(refObjective) > 1e-12 &&
      Math.abs(refParamValue) > 1e-12
    ) {
      const deltaJ = objectiveValues[steps - 1] - objectiveValues[0];
      const deltaP = parameterValues[steps - 1] - parameterValues[0];
      if (Math.abs(deltaP) > 1e-12) {
        elasticity = round((deltaJ / refObjective) / (deltaP / refParamValue), 6);
      }
    }

    results.push({
      parameter: range.parameterId,
      parameterValues,
      objectiveValues,
      fluxResponse,
      elasticity,
      referenceObjective: round(refObjective, 6),
      referenceParameter: round(refParamValue, 6),
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Metabolic Control Analysis                                         */
/* ------------------------------------------------------------------ */

/**
 * Perturbation fraction for MCA finite-difference computation.
 * A 1% perturbation balances numerical accuracy with LP conditioning.
 */
const MCA_PERTURBATION = 0.01;

/**
 * Run Metabolic Control Analysis on a constraint-based model.
 *
 * Computes the three classical MCA coefficient matrices by finite-difference
 * perturbation of each reaction's upper bound (proxy for enzyme activity):
 *
 *   - **Flux Control Coefficients** C^J_i: how much the objective flux
 *     changes per fractional change in reaction i's capacity.
 *   - **Elasticity Coefficients** epsilon: how each reaction's own flux
 *     responds to perturbation of every other reaction's capacity.
 *   - **Concentration Control Coefficients** (approximated): estimated from
 *     shadow price changes since FBA does not track concentrations.
 *
 * @param model - The LP model to analyse (solved with its original objective)
 */
export async function runMetabolicControlAnalysis(
  model: LPModel,
): Promise<MCAResult> {
  // ── Step 1: baseline solve ──────────────────────────────────────────
  const baseline = await solveLP(model);
  const refObjective = baseline.objectiveValue;
  const refFluxes: Record<string, number> = {};
  for (const [k, v] of Object.entries(baseline.primals)) {
    refFluxes[k] = round(v, 6);
  }
  const refDuals: Record<string, number> = {};
  for (const [k, v] of Object.entries(baseline.duals)) {
    refDuals[k] = v;
  }

  // Identify reactions with non-zero reference flux (or non-zero bound)
  const bounds = model.bounds ?? [];
  const reactionIds = bounds
    .map((b) => b.name)
    .filter((id) => {
      const flux = Math.abs(refFluxes[id] ?? 0);
      const bound = bounds.find((bb) => bb.name === id);
      const ub = bound?.ub ?? Infinity;
      return flux > 1e-9 || (ub > 1e-9 && ub < Infinity);
    });

  // ── Step 2: perturb each reaction's upper bound ─────────────────────
  const fluxControlCoefficients: Record<string, number> = {};
  const elasticityCoefficients: ElasticityCoefficient[] = [];
  const concentrationControlCoefficients: Record<string, Record<string, number>> = {};

  // Collect constraint names for concentration control
  const constraintNames = model.constraints.map((c) => c.name);

  for (const rxnId of reactionIds) {
    const bound = bounds.find((b) => b.name === rxnId);
    const refUb = bound?.ub ?? 0;
    if (refUb <= 1e-12) continue;

    const deltaUb = refUb * MCA_PERTURBATION;
    const newUb = refUb + deltaUb;

    // Solve with perturbed bound
    const perturbedModel = withBoundOverride(model, rxnId, newUb);
    const perturbed = await solveLP(perturbedModel);

    if (perturbed.status !== "optimal") continue;

    // ── Flux Control Coefficient ──────────────────────────────────
    // C^J_i = (delta_J / J_ref) / (delta_e / e_ref)
    if (Math.abs(refObjective) > 1e-12) {
      const deltaJ = perturbed.objectiveValue - refObjective;
      const cc = (deltaJ / refObjective) / MCA_PERTURBATION;
      fluxControlCoefficients[rxnId] = round(cc, 6);
    }

    // ── Elasticity Coefficients ───────────────────────────────────
    // epsilon^v_j_i = (delta_v_j / v_j_ref) / (delta_e_i / e_i_ref)
    for (const targetRxn of reactionIds) {
      const refFlux = refFluxes[targetRxn] ?? 0;
      if (Math.abs(refFlux) < 1e-12) continue;

      const pertFlux = perturbed.primals[targetRxn] ?? 0;
      const deltaV = pertFlux - refFlux;
      const eps = (deltaV / refFlux) / MCA_PERTURBATION;

      elasticityCoefficients.push({
        reactionId: rxnId,
        targetReactionId: targetRxn,
        value: round(eps, 6),
      });
    }

    // ── Concentration Control Coefficients (approximate) ──────────
    // Estimated from shadow price changes since FBA does not track
    // metabolite concentrations directly.
    const cccForRxn: Record<string, number> = {};
    for (const conName of constraintNames) {
      const refShadow = refDuals[conName] ?? 0;
      const pertShadow = perturbed.duals[conName] ?? 0;

      if (Math.abs(refShadow) > 1e-12) {
        const deltaShadow = pertShadow - refShadow;
        cccForRxn[conName] = round((deltaShadow / refShadow) / MCA_PERTURBATION, 6);
      } else if (Math.abs(pertShadow) > 1e-12) {
        // Ref shadow is zero but perturbed is not — use absolute ratio
        cccForRxn[conName] = round(pertShadow / (refUb * MCA_PERTURBATION), 6);
      } else {
        cccForRxn[conName] = 0;
      }
    }
    concentrationControlCoefficients[rxnId] = cccForRxn;
  }

  // ── Step 3: compute summation theorem check ─────────────────────
  const fluxControlSum = round(
    Object.values(fluxControlCoefficients).reduce((s, v) => s + v, 0),
    4,
  );

  return {
    fluxControlCoefficients,
    elasticityCoefficients,
    concentrationControlCoefficients,
    referenceFluxes: refFluxes,
    referenceObjective: round(refObjective, 6),
    analysedReactions: reactionIds,
    fluxControlSum,
  };
}
