import { SeededRNG } from "../utils/seededRng";

/**
 * OptKnock — Bilevel MILP knockout strategy for coupling growth to product formation.
 *
 * Reference: Burgard, A.P., Pharkya, P., & Maranas, C.D. (2003).
 *   OptKnock: A bilevel programming framework for identifying gene
 *   knockout strategies for microbial strain optimization.
 *   Biotechnol Bioeng, 84(6), 647-657.
 *
 * Implementation uses the strong-duality MILP reformulation (Burgard et al.):
 *   1. Solve wild-type FBA (growth objective) to get baseline fluxes.
 *   2. Identify candidate knockout reactions (non-EX, non-objective).
 *   3. Build a single-level MILP using strong duality of the inner LP:
 *      - Binary z_i for each candidate knockout
 *      - Coupling: v_i ≤ ub_i·(1-z_i), v_i ≥ lb_i·(1-z_i)
 *      - Dual feasibility: S^T·λ + μ - ν = c_biomass
 *      - Strong duality: c_biomass^T·v = μ^T·ub + ν^T·(-lb)
 *      - Big-M on duals: μ_i, ν_i ≤ M·(1-z_i) for candidates
 *   4. Maximize v_product subject to Σz_i ≤ K
 *   5. If >20 binary variables, fall back to sequential LP enumeration.
 *
 * @scientific_provenance
 *   REFERENCE: Burgard et al. (2003) Biotechnol Bioeng 84(6):647-657
 *   ALGORITHM: Bilevel MILP reformulation via strong duality
 *   KNOWN_LIMITATIONS:
 *     - Big-M formulation; tightness depends on flux capacity estimates
 *     - For >20 candidates, falls back to sequential LP approximation
 *     - Returns single optimal knockout set (no Pareto enumeration)
 */

import { type LPBound, type LPConstraint, type LPModel, type LPVariable, solveLP } from "./highsSolver";

/* ------------------------------------------------------------------ */
/*  Public interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface OptKnockReaction {
  id: string;
  lb: number;
  ub: number;
  stoichiometry: Record<string, number>;
  gpr?: string;
}

export interface OptKnockModel {
  reactions: OptKnockReaction[];
  objectiveId: string;
  productReactionId: string;
}

export interface KnockoutSet {
  reactions: string[];
  growthRate: number;
  productFlux: number;
}

export interface OptKnockResult {
  knockoutSets: KnockoutSet[];
  wildtypeGrowthRate: number;
  wildtypeProductFlux: number;
}

export interface OptKnockOptions {
  maxKnockouts?: number;
  glucoseUptake?: number;
  oxygenUptake?: number;
  growthFraction?: number;
  maxResults?: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Max candidates for MILP; beyond this, fall back to sequential LP. */
const MILP_CANDIDATE_THRESHOLD = 20;
/** Big-M value for dual variable bounding in MILP. */
const BIG_M = 10000;
/** Candidate count threshold for exhaustive enumeration (fallback). */
const EXHAUSTIVE_THRESHOLD = 15;
/** Number of random samples for large candidate sets (fallback). */
const RANDOM_SAMPLES = 100;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Generate all k-combinations of an array. */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const result: T[][] = [];
  function recurse(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i <= arr.length - (k - current.length); i++) {
      current.push(arr[i]);
      recurse(i + 1, current);
      current.pop();
    }
  }
  recurse(0, []);
  return result;
}

/** Randomly sample n unique k-combinations (Fisher-Yates partial shuffle). */
function sampleCombinations<T>(arr: T[], k: number, n: number): T[][] {
  const allCombos = combinations(arr, k);
  if (allCombos.length <= n) return allCombos;
  const rng = new SeededRNG(42);
  for (let i = allCombos.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [allCombos[i], allCombos[j]] = [allCombos[j], allCombos[i]];
  }
  return allCombos.slice(0, n);
}

/* ------------------------------------------------------------------ */
/*  LP construction — sequential (wild-type FBA + fallback)            */
/* ------------------------------------------------------------------ */

function buildOptKnockLP(
  reactions: OptKnockReaction[],
  objectiveId: string,
  knockouts: string[],
  growthLB: number,
  glucoseUptake: number,
  oxygenUptake: number,
): LPModel {
  const knockoutSet = new Set(knockouts);

  const allMetIds = new Set<string>();
  for (const r of reactions) {
    for (const metId of Object.keys(r.stoichiometry)) {
      allMetIds.add(metId);
    }
  }

  const objective = [{ name: objectiveId, coef: 1 }];

  const constraints = Array.from(allMetIds).map((metId) => ({
    name: `${metId}_balance`,
    vars: reactions
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
    lb: 0,
    ub: 0,
  }));

  const bounds = reactions.map((r) => {
    let lb = r.lb;
    if (r.id === "BIOMASS" || r.id === "BIOMASS_Ec_iML1515" || r.id === "BIOMASS_HP_published") {
      lb = Math.max(lb, growthLB);
    }
    if (r.id.startsWith("EX_")) {
      const isGlucose = r.id.includes("glc") || r.id.includes("glu");
      const isOxygen = r.id.includes("o2") || r.id.includes("O2");
      if (isGlucose) lb = -Math.abs(glucoseUptake);
      if (isOxygen) lb = -Math.abs(oxygenUptake);
    }
    return {
      name: r.id,
      lb,
      ub: knockoutSet.has(r.id) ? 0 : r.ub,
    };
  });

  return {
    name: "optknock",
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };
}

/* ------------------------------------------------------------------ */
/*  MILP construction — bilevel reformulation (Burgard et al. 2003)    */
/* ------------------------------------------------------------------ */

/**
 * Build the bilevel MILP for OptKnock using the strong-duality reformulation.
 *
 * Variables:
 *   v_i   — primal flux for reaction i
 *   z_i   — binary knockout indicator (1 = knocked out) for candidate i
 *   λ_j   — dual for stoichiometric balance (metabolite j), free
 *   μ_i   — dual for upper bound (reaction i), ≥ 0
 *   ν_i   — dual for lower bound (reaction i), ≥ 0
 *
 * Constraints:
 *   Primal feasibility:     S · v = 0
 *   Coupling (UB):          v_i + ub_i · z_i ≤ ub_i          (candidates)
 *   Coupling (LB):          v_i + lb_i · z_i ≥ lb_i          (candidates, lb < 0)
 *   Dual feasibility:       S^T · λ + μ - ν = c_biomass
 *   Strong duality:         v_biomass - Σ μ_i · ub_i + Σ ν_i · lb_i = 0
 *   Growth lower bound:     v_biomass ≥ growthLB
 *   Knockout budget:        Σ z_i ≤ maxKnockouts
 *   Big-M (μ):              μ_i + M · z_i ≤ M                 (candidates)
 *   Big-M (ν):              ν_i + M · z_i ≤ M                 (candidates)
 */
function buildOptKnockMILP(
  reactions: OptKnockReaction[],
  objectiveId: string,
  productReactionId: string,
  candidateIds: string[],
  growthLB: number,
  glucoseUptake: number,
  oxygenUptake: number,
  maxKnockouts: number,
): LPModel {
  // Collect all metabolite IDs
  const allMetIds = new Set<string>();
  for (const r of reactions) {
    for (const metId of Object.keys(r.stoichiometry)) {
      allMetIds.add(metId);
    }
  }
  const metIds = Array.from(allMetIds);

  // Objective: maximize product flux
  const objective: LPVariable[] = [{ name: `v_${productReactionId}`, coef: 1 }];

  const constraints: LPConstraint[] = [];

  // ── 1. Stoichiometric balance: S · v = 0 ──
  for (const metId of metIds) {
    const vars: LPVariable[] = reactions
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: `v_${r.id}`, coef: r.stoichiometry[metId] }));
    if (vars.length > 0) {
      constraints.push({ name: `stoich_${metId}`, vars, lb: 0, ub: 0 });
    }
  }

  // ── 2. Coupling upper bound: v_i + ub_i·z_i ≤ ub_i ──
  for (const cid of candidateIds) {
    const rxn = reactions.find((r) => r.id === cid);
    if (!rxn) continue;
    constraints.push({
      name: `c_ub_${cid}`,
      vars: [
        { name: `v_${cid}`, coef: 1 },
        { name: `z_${cid}`, coef: rxn.ub },
      ],
      lb: -Infinity,
      ub: rxn.ub,
    });
  }

  // ── 3. Coupling lower bound: v_i + lb_i·z_i ≥ lb_i (reversible candidates only) ──
  for (const cid of candidateIds) {
    const rxn = reactions.find((r) => r.id === cid);
    if (!rxn || rxn.lb >= 0) continue;
    constraints.push({
      name: `c_lb_${cid}`,
      vars: [
        { name: `v_${cid}`, coef: 1 },
        { name: `z_${cid}`, coef: rxn.lb },
      ],
      lb: rxn.lb,
      ub: Infinity,
    });
  }

  // ── 4. Dual feasibility: S^T · λ + μ - ν = c_biomass ──
  for (const rxn of reactions) {
    const c_j = rxn.id === objectiveId ? 1 : 0;
    const vars: LPVariable[] = [];
    for (const [metId, coeff] of Object.entries(rxn.stoichiometry)) {
      vars.push({ name: `lam_${metId}`, coef: coeff });
    }
    vars.push({ name: `mu_${rxn.id}`, coef: 1 });
    vars.push({ name: `nu_${rxn.id}`, coef: -1 });
    constraints.push({ name: `df_${rxn.id}`, vars, lb: c_j, ub: c_j });
  }

  // ── 5. Strong duality: v_biomass - Σ μ_i·ub_i + Σ ν_i·lb_i = 0 ──
  const sdVars: LPVariable[] = [{ name: `v_${objectiveId}`, coef: 1 }];
  for (const rxn of reactions) {
    if (rxn.ub !== 0) {
      sdVars.push({ name: `mu_${rxn.id}`, coef: -rxn.ub });
    }
    if (rxn.lb !== 0) {
      sdVars.push({ name: `nu_${rxn.id}`, coef: rxn.lb });
    }
  }
  constraints.push({ name: "strong_duality", vars: sdVars, lb: 0, ub: 0 });

  // ── 6. Growth lower bound: v_biomass ≥ growthLB ──
  if (growthLB > 0) {
    constraints.push({
      name: "growth_lb",
      vars: [{ name: `v_${objectiveId}`, coef: 1 }],
      lb: growthLB,
      ub: Infinity,
    });
  }

  // ── 7. Knockout budget: Σ z_i ≤ maxKnockouts ──
  constraints.push({
    name: "ko_budget",
    vars: candidateIds.map((id) => ({ name: `z_${id}`, coef: 1 })),
    lb: -Infinity,
    ub: maxKnockouts,
  });

  // ── 8. Big-M on μ: μ_i + M·z_i ≤ M (forces μ_i = 0 when z_i = 1) ──
  for (const cid of candidateIds) {
    constraints.push({
      name: `bm_mu_${cid}`,
      vars: [
        { name: `mu_${cid}`, coef: 1 },
        { name: `z_${cid}`, coef: BIG_M },
      ],
      lb: -Infinity,
      ub: BIG_M,
    });
  }

  // ── 9. Big-M on ν: ν_i + M·z_i ≤ M (forces ν_i = 0 when z_i = 1) ──
  for (const cid of candidateIds) {
    constraints.push({
      name: `bm_nu_${cid}`,
      vars: [
        { name: `nu_${cid}`, coef: 1 },
        { name: `z_${cid}`, coef: BIG_M },
      ],
      lb: -Infinity,
      ub: BIG_M,
    });
  }

  // ── Variable bounds ──
  const bounds: LPBound[] = [];

  // Primal flux bounds (with exchange uptake limits)
  for (const rxn of reactions) {
    let lb = rxn.lb;
    const ub = rxn.ub;
    if (rxn.id.startsWith("EX_")) {
      const isGlucose = rxn.id.includes("glc") || rxn.id.includes("glu");
      const isOxygen = rxn.id.includes("o2") || rxn.id.includes("O2");
      if (isGlucose) lb = -Math.abs(glucoseUptake);
      if (isOxygen) lb = -Math.abs(oxygenUptake);
    }
    bounds.push({ name: `v_${rxn.id}`, lb, ub });
  }

  // Dual variable bounds: μ ≥ 0, ν ≥ 0
  for (const rxn of reactions) {
    bounds.push({ name: `mu_${rxn.id}`, lb: 0, ub: BIG_M });
    bounds.push({ name: `nu_${rxn.id}`, lb: 0, ub: BIG_M });
  }

  // λ (free variables)
  for (const metId of metIds) {
    bounds.push({ name: `lam_${metId}`, lb: -Infinity, ub: Infinity });
  }

  // z (binary, [0, 1])
  for (const cid of candidateIds) {
    bounds.push({ name: `z_${cid}`, lb: 0, ub: 1 });
  }

  return {
    name: "optknock_milp",
    sense: "maximize",
    objective,
    constraints,
    bounds,
    binaries: candidateIds.map((id) => `z_${id}`),
  };
}

/* ------------------------------------------------------------------ */
/*  Core algorithm                                                     */
/* ------------------------------------------------------------------ */

/**
 * Run OptKnock analysis to find gene knockout strategies that couple
 * growth to product formation.
 *
 * For ≤20 candidate reactions, uses the Burgard et al. (2003) bilevel MILP
 * reformulation via strong duality. For larger models, falls back to
 * iterative LP enumeration with sampling.
 */
export async function runOptKnock(model: OptKnockModel, options: OptKnockOptions = {}): Promise<OptKnockResult> {
  const { maxKnockouts = 3, glucoseUptake = 10, oxygenUptake = 12, growthFraction = 0.01, maxResults = 10 } = options;

  // Validate product reaction exists
  const hasProduct = model.reactions.some((r) => r.id === model.productReactionId);
  if (!hasProduct) {
    return {
      knockoutSets: [],
      wildtypeGrowthRate: 0,
      wildtypeProductFlux: 0,
    };
  }

  // Step 1: Wild-type FBA — maximize growth
  const wtGrowthLP = buildOptKnockLP(model.reactions, model.objectiveId, [], 0, glucoseUptake, oxygenUptake);
  const wtGrowthResult = await solveLP(wtGrowthLP);

  if (wtGrowthResult.status !== "optimal") {
    return {
      knockoutSets: [],
      wildtypeGrowthRate: 0,
      wildtypeProductFlux: 0,
    };
  }

  const wildtypeGrowthRate = round(wtGrowthResult.objectiveValue);

  // Step 2: Wild-type — maximize product with growth constraint
  const growthLB = wildtypeGrowthRate * growthFraction;
  const wtProductLP = buildOptKnockLP(
    model.reactions,
    model.productReactionId,
    [],
    growthLB,
    glucoseUptake,
    oxygenUptake,
  );
  const wtProductResult = await solveLP(wtProductLP);
  const wildtypeProductFlux = wtProductResult.status === "optimal" ? round(wtProductResult.objectiveValue) : 0;

  // Step 3: Identify candidate reactions for knockout
  const candidateIds = model.reactions
    .map((r) => r.id)
    .filter((id) => !id.startsWith("EX_") && id !== model.objectiveId && id !== model.productReactionId);

  if (candidateIds.length === 0) {
    return {
      knockoutSets: [],
      wildtypeGrowthRate,
      wildtypeProductFlux,
    };
  }

  // ── Step 4: Bilevel MILP path (≤20 candidates) ──
  if (candidateIds.length <= MILP_CANDIDATE_THRESHOLD) {
    const milp = buildOptKnockMILP(
      model.reactions,
      model.objectiveId,
      model.productReactionId,
      candidateIds,
      growthLB,
      glucoseUptake,
      oxygenUptake,
      maxKnockouts,
    );
    const milpResult = await solveLP(milp);

    if (milpResult.status === "optimal") {
      const knockouts = candidateIds.filter((id) => (milpResult.primals[`z_${id}`] ?? 0) > 0.5);
      const growthRate = round(milpResult.primals[`v_${model.objectiveId}`] ?? 0);
      const productFlux = round(milpResult.primals[`v_${model.productReactionId}`] ?? 0);

      const results: KnockoutSet[] = [];
      if (productFlux > wildtypeProductFlux + 1e-6 && growthRate > 1e-6) {
        results.push({
          reactions: knockouts.sort(),
          growthRate,
          productFlux,
        });
      }

      return {
        knockoutSets: results.slice(0, maxResults),
        wildtypeGrowthRate,
        wildtypeProductFlux,
      };
    }

    // MILP failed — fall through to sequential LP
    console.warn("[OptKnock] MILP solver returned non-optimal status, falling back to sequential LP");
  } else {
    console.warn(
      `[OptKnock] ${candidateIds.length} candidates exceed ${MILP_CANDIDATE_THRESHOLD} threshold; using sequential LP fallback`,
    );
  }

  // ── Sequential LP fallback (original algorithm) ──
  const useExhaustive = candidateIds.length <= EXHAUSTIVE_THRESHOLD;
  const results: KnockoutSet[] = [];

  for (let k = 1; k <= maxKnockouts; k++) {
    const combos = useExhaustive ? combinations(candidateIds, k) : sampleCombinations(candidateIds, k, RANDOM_SAMPLES);

    for (const combo of combos) {
      const koGrowthLP = buildOptKnockLP(model.reactions, model.objectiveId, combo, 0, glucoseUptake, oxygenUptake);
      const koGrowthResult = await solveLP(koGrowthLP);

      if (koGrowthResult.status !== "optimal" || koGrowthResult.objectiveValue < 1e-6) {
        continue;
      }

      const koGrowthRate = round(koGrowthResult.objectiveValue);

      const koProductLP = buildOptKnockLP(
        model.reactions,
        model.productReactionId,
        combo,
        koGrowthRate * growthFraction,
        glucoseUptake,
        oxygenUptake,
      );
      const koProductResult = await solveLP(koProductLP);

      if (koProductResult.status !== "optimal") continue;

      const koProductFlux = round(koProductResult.objectiveValue);

      if (koProductFlux > wildtypeProductFlux + 1e-6) {
        results.push({
          reactions: [...combo].sort(),
          growthRate: koGrowthRate,
          productFlux: koProductFlux,
        });
      }
    }
  }

  results.sort((a, b) => b.productFlux - a.productFlux);

  return {
    knockoutSets: results.slice(0, maxResults),
    wildtypeGrowthRate,
    wildtypeProductFlux,
  };
}
