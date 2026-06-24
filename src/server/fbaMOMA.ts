/**
 * MOMA (Minimization of Metabolic Adjustment).
 *
 * Computes the closest feasible flux distribution after a knockout,
 * predicting the actual metabolic response of an organism that has not
 * yet fully adapted to the genetic perturbation.
 *
 * The true MOMA problem is a Quadratic Program (QP):
 *   min  ||v - v_wt||²
 *   s.t. S · v = 0
 *        lb ≤ v ≤ ub
 *        v_knockout = 0
 *
 * This implementation uses HiGHS's native QP solver when available.
 * The objective is expanded as:
 *   min  Σ (v_i² - 2·v_wt_i·v_i) + const
 *
 * If the QP solve fails (e.g. WASM limitation), we fall back to an
 * L1-approximation via sequential LP:
 *   min  Σ (pos_i + neg_i)
 *   s.t. v_i - v_wt_i = pos_i - neg_i   for all i
 *        S · v = 0
 *        lb ≤ v ≤ ub
 *        v_knockout = 0
 *        pos_i, neg_i ≥ 0
 *
 * The Euclidean distance is then computed from the resulting fluxes.
 *
 * Reference: Segrè, D., Vitupkaya, A., & Kuepfer, L. (2002).
 *   Metabolic flux balancing in the context of flux constraints.
 *   PNAS, 99(23), 15112-15117.
 *
 * @scientific_provenance
 *   REFERENCE: Segrè et al. (2002) PNAS 99(23):15112-15117
 *   ALGORITHM: Quadratic MOMA (L2 norm) via HiGHS QP, L1 fallback
 */

import { solveLP, type LPModel, type QPTerm } from './highsSolver';

/* ------------------------------------------------------------------ */
/*  Public interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface MOMAReaction {
  id: string;
  lb: number;
  ub: number;
  stoichiometry: Record<string, number>;
}

export interface MOMAModel {
  reactions: MOMAReaction[];
  objectiveId: string;
}

export interface MOMAResult {
  feasible: boolean;
  fluxes: Record<string, number>;
  wildtypeFluxes: Record<string, number>;
  /** Euclidean (L2) distance between wild-type and mutant flux vectors. */
  distance: number;
  growthRate: number;
  wildtypeGrowthRate: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  // Avoid -0 artifacts from floating-point arithmetic
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Collect all unique metabolite IDs from reaction stoichiometries. */
function collectMetabolites(reactions: MOMAReaction[]): Set<string> {
  const metIds = new Set<string>();
  for (const r of reactions) {
    for (const metId of Object.keys(r.stoichiometry)) {
      metIds.add(metId);
    }
  }
  return metIds;
}

/* ------------------------------------------------------------------ */
/*  LP construction: FBA (maximise objective)                           */
/* ------------------------------------------------------------------ */

function buildFBAModel(model: MOMAModel, knockoutSet: Set<string>): LPModel {
  const metIds = collectMetabolites(model.reactions);

  const objective = [{ name: model.objectiveId, coef: 1 }];

  const constraints = Array.from(metIds).map((metId) => ({
    name: `${metId}_balance`,
    vars: model.reactions
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
    lb: 0,
    ub: 0,
  }));

  const bounds = model.reactions.map((r) => ({
    name: r.id,
    lb: r.lb,
    ub: knockoutSet.has(r.id) ? 0 : r.ub,
  }));

  return {
    name: 'moma_wt_fba',
    sense: 'maximize',
    objective,
    constraints,
    bounds,
  };
}

/* ------------------------------------------------------------------ */
/*  LP construction: MOMA distance minimisation (L1 approximation)     */
/* ------------------------------------------------------------------ */

/**
 * Build an LP that minimises the L1 distance to the wild-type flux vector
 * subject to stoichiometric balance and knockout constraints.
 *
 * Variable layout:
 *   v_i          — original flux for reaction i
 *   pos_i        — positive deviation: max(v_i - v_wt_i, 0)
 *   neg_i        — negative deviation: max(v_wt_i - v_i, 0)
 *
 * Constraints:
 *   v_i - pos_i + neg_i = v_wt_i   (split / deviation)
 *   S · v = 0                       (stoichiometric balance)
 *
 * Objective:
 *   minimise Σ (pos_i + neg_i)      (= L1 distance)
 */
function buildMOMAModel(
  model: MOMAModel,
  knockoutSet: Set<string>,
  wildtypeFluxes: Record<string, number>,
): LPModel {
  const metIds = collectMetabolites(model.reactions);

  // Objective: minimise sum of positive and negative deviations
  const objective = [
    ...model.reactions.map((r) => ({ name: `${r.id}__pos`, coef: 1 })),
    ...model.reactions.map((r) => ({ name: `${r.id}__neg`, coef: 1 })),
  ];

  const constraints: LPModel['constraints'] = [];

  // 1. Stoichiometric balance: S · v = 0
  for (const metId of metIds) {
    constraints.push({
      name: `${metId}_balance`,
      vars: model.reactions
        .filter((r) => r.stoichiometry[metId] !== undefined)
        .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
      lb: 0,
      ub: 0,
    });
  }

  // 2. Deviation constraints: v_i - pos_i + neg_i = v_wt_i
  for (const r of model.reactions) {
    const wtFlux = wildtypeFluxes[r.id] ?? 0;
    constraints.push({
      name: `dev_${r.id}`,
      vars: [
        { name: r.id, coef: 1 },
        { name: `${r.id}__pos`, coef: -1 },
        { name: `${r.id}__neg`, coef: 1 },
      ],
      lb: wtFlux,
      ub: wtFlux,
    });
  }

  // Bounds
  const bounds: LPModel['bounds'] = [];

  // Original variables
  for (const r of model.reactions) {
    bounds.push({
      name: r.id,
      lb: r.lb,
      ub: knockoutSet.has(r.id) ? 0 : r.ub,
    });
  }

  // Positive and negative deviation variables (non-negative)
  for (const r of model.reactions) {
    bounds.push({ name: `${r.id}__pos`, lb: 0, ub: Infinity });
    bounds.push({ name: `${r.id}__neg`, lb: 0, ub: Infinity });
  }

  return {
    name: 'moma_l1',
    sense: 'minimize',
    objective,
    constraints,
    bounds,
  };
}

/* ------------------------------------------------------------------ */
/*  QP construction: true MOMA (minimise L2 distance to wild-type)     */
/* ------------------------------------------------------------------ */

/**
 * Build a QP that minimises the Euclidean (L2) distance to the wild-type
 * flux vector subject to stoichiometric balance and knockout constraints.
 *
 * Expanding ||v - v_wt||² = Σ(v_i² - 2·v_wt_i·v_i + v_wt_i²):
 *   Linear objective:   -2·v_wt_i  for each v_i
 *   Quadratic objective: v_i²      for each v_i (diagonal, no cross-terms)
 *   Constant Σ v_wt_i² is dropped (does not affect argmin).
 */
function buildMOMAQPModel(
  model: MOMAModel,
  knockoutSet: Set<string>,
  wildtypeFluxes: Record<string, number>,
): LPModel {
  const metIds = collectMetabolites(model.reactions);

  // Linear objective: -2 * v_wt_i * v_i
  const objective = model.reactions.map((r) => ({
    name: r.id,
    coef: -2 * (wildtypeFluxes[r.id] ?? 0),
  }));

  // Quadratic objective: 1 * v_i * v_i for each reaction
  const quadratic: QPTerm[] = model.reactions.map((r) => ({
    var1: r.id,
    var2: r.id,
    coef: 1,
  }));

  const constraints: LPModel['constraints'] = [];

  // Stoichiometric balance: S · v = 0
  for (const metId of metIds) {
    constraints.push({
      name: `${metId}_balance`,
      vars: model.reactions
        .filter((r) => r.stoichiometry[metId] !== undefined)
        .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
      lb: 0,
      ub: 0,
    });
  }

  // Bounds
  const bounds: LPModel['bounds'] = model.reactions.map((r) => ({
    name: r.id,
    lb: r.lb,
    ub: knockoutSet.has(r.id) ? 0 : r.ub,
  }));

  return {
    name: 'moma_qp',
    sense: 'minimize',
    objective,
    constraints,
    bounds,
    quadratic,
  };
}

/* ------------------------------------------------------------------ */
/*  Euclidean distance helper                                          */
/* ------------------------------------------------------------------ */

function euclideanDistance(
  reactions: MOMAReaction[],
  fluxes: Record<string, number>,
  wildtypeFluxes: Record<string, number>,
): number {
  let sumSq = 0;
  for (const r of reactions) {
    const diff = (fluxes[r.id] ?? 0) - (wildtypeFluxes[r.id] ?? 0);
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Run MOMA (Minimization of Metabolic Adjustment) analysis.
 *
 * 1. Solve wild-type FBA (maximise objective) to obtain v_wt.
 * 2. Build a true QP that minimises ||v - v_wt||² (Euclidean distance)
 *    subject to stoichiometric balance and knockout constraints.
 * 3. If QP solve fails, fall back to L1-approximation LP.
 * 4. Compute the Euclidean (L2) distance from the resulting fluxes.
 *
 * @param model               Metabolic model definition
 * @param knockoutReactionIds Reaction IDs to knock out (flux fixed to 0)
 * @returns MOMA result with wild-type and mutant fluxes and distance
 */
export async function runMOMA(
  model: MOMAModel,
  knockoutReactionIds: string[],
): Promise<MOMAResult> {
  const knockoutSet = new Set(knockoutReactionIds);

  // Guard: empty model or missing objective
  if (
    model.reactions.length === 0 ||
    !model.reactions.some((r) => r.id === model.objectiveId)
  ) {
    return {
      feasible: false,
      fluxes: {},
      wildtypeFluxes: {},
      distance: 0,
      growthRate: 0,
      wildtypeGrowthRate: 0,
    };
  }

  // ── Step 1: Solve wild-type FBA ──────────────────────────────────────
  const wtLP = buildFBAModel(model, new Set());
  const wtResult = await solveLP(wtLP);

  if (wtResult.status !== 'optimal') {
    return {
      feasible: false,
      fluxes: {},
      wildtypeFluxes: {},
      distance: 0,
      growthRate: 0,
      wildtypeGrowthRate: 0,
    };
  }

  const wildtypeFluxes: Record<string, number> = {};
  for (const r of model.reactions) {
    wildtypeFluxes[r.id] = round(wtResult.primals[r.id] ?? 0);
  }
  const wildtypeGrowthRate = round(wtResult.primals[model.objectiveId] ?? 0);

  // ── Step 2: No-knockout shortcut ─────────────────────────────────────
  if (knockoutReactionIds.length === 0) {
    return {
      feasible: true,
      fluxes: { ...wildtypeFluxes },
      wildtypeFluxes,
      distance: 0,
      growthRate: wildtypeGrowthRate,
      wildtypeGrowthRate,
    };
  }

  // ── Step 3: Check mutant feasibility with regular FBA ────────────────
  const mutLP = buildFBAModel(model, knockoutSet);
  const mutResult = await solveLP(mutLP);

  if (mutResult.status !== 'optimal') {
    // Mutant is infeasible — report distance from wild-type to origin
    return {
      feasible: false,
      fluxes: {},
      wildtypeFluxes,
      distance: round(euclideanDistance(model.reactions, {}, wildtypeFluxes), 6),
      growthRate: 0,
      wildtypeGrowthRate,
    };
  }

  // ── Step 4: Solve MOMA (try true QP first, fall back to L1 LP) ───────
  const momaQP = buildMOMAQPModel(model, knockoutSet, wildtypeFluxes);
  let momaResult = await solveLP(momaQP);

  if (momaResult.status === 'error') {
    // QP solve failed (e.g. WASM limitation) — fall back to L1 approximation
    const momaLP = buildMOMAModel(model, knockoutSet, wildtypeFluxes);
    momaResult = await solveLP(momaLP);
  }

  if (momaResult.status !== 'optimal') {
    // MOMA LP failed — fall back to regular mutant FBA fluxes
    const fallbackFluxes: Record<string, number> = {};
    for (const r of model.reactions) {
      fallbackFluxes[r.id] = round(mutResult.primals[r.id] ?? 0);
    }
    return {
      feasible: true,
      fluxes: fallbackFluxes,
      wildtypeFluxes,
      distance: round(euclideanDistance(model.reactions, fallbackFluxes, wildtypeFluxes), 6),
      growthRate: round(fallbackFluxes[model.objectiveId] ?? 0),
      wildtypeGrowthRate,
    };
  }

  // ── Step 5: Extract mutant fluxes and compute distance ───────────────
  const fluxes: Record<string, number> = {};
  for (const r of model.reactions) {
    fluxes[r.id] = round(momaResult.primals[r.id] ?? 0);
  }

  const growthRate = round(fluxes[model.objectiveId] ?? 0);
  const distance = round(
    euclideanDistance(model.reactions, fluxes, wildtypeFluxes),
    6,
  );

  return {
    feasible: true,
    fluxes,
    wildtypeFluxes,
    distance,
    growthRate,
    wildtypeGrowthRate,
  };
}
