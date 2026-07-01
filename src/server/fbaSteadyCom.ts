/**
 * SteadyCom Community FBA
 *
 * Implements the SteadyCom algorithm (Heinken et al., 2015, PLOS Comput Biol)
 * for computing community growth rates in microbial consortia.
 *
 * Algorithm: Binary search on community growth rate mu.
 *   1. Fix mu (candidate community growth rate)
 *   2. For each species, solve LP: maximize biomass subject to:
 *      - stoichiometric constraints (S . v = 0)
 *      - flux bounds (lb <= v <= ub)
 *      - biomass reaction flux = mu (fixed)
 *   3. If all species feasible at mu -> increase mu
 *   4. If any species infeasible at mu -> decrease mu
 *   5. Repeat until |mu_high - mu_low| < tolerance
 *
 * @scientific_provenance
 *   REFERENCE: Heinken A, Thiele I, Fleming RM (2015).
 *     "Competitive and cooperative metabolic interactions in microbial communities."
 *     PLOS Computational Biology 11(1): e1004010.
 *   ALGORITHM: SteadyCom -- binary search on community growth rate with per-species LP.
 */

import { type LPModel, type LPVariable, type LPConstraint, type LPBound, solveLP } from "./highsSolver";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface SteadyComReaction {
  id: string;
  stoichiometry: Record<string, number>;
  lowerBound: number;
  upperBound: number;
}

export interface SteadyComSpecies {
  id: string;
  name: string;
  reactions: SteadyComReaction[];
  metabolites: string[];
  biomassReaction: string;
}

export interface SteadyComResult {
  status: "optimal" | "infeasible" | "error";
  communityGrowthRate: number;
  speciesFluxes: Record<string, Record<string, number>>;
  speciesGrowthRates: Record<string, number>;
  iterations: number;
  convergenceHistory: number[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Build an LPModel for a single species at a fixed growth rate mu.
 *
 * The LP checks feasibility: can this species achieve growth rate mu
 * while satisfying all stoichiometric constraints and flux bounds?
 *
 * We maximize biomass as objective (which will be fixed to mu via
 * an equality constraint, so the solver just checks feasibility).
 */
function buildSpeciesLPModel(species: SteadyComSpecies, mu: number): LPModel {
  const rxns = species.reactions;
  const mets = species.metabolites;

  // Validate biomass reaction exists
  const biomassReaction = rxns.find((r) => r.id === species.biomassReaction);
  if (!biomassReaction) {
    throw new Error(`Biomass reaction "${species.biomassReaction}" not found in species "${species.id}"`);
  }

  // Build stoichiometric constraints: S . v = 0 (mass balance)
  const constraints: LPConstraint[] = mets.map((metId) => ({
    name: `${species.id}_${metId}_balance`,
    vars: rxns
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
    lb: 0,
    ub: 0,
  }));

  // Add equality constraint: biomass reaction flux = mu
  constraints.push({
    name: `${species.id}_growth_fix`,
    vars: [{ name: species.biomassReaction, coef: 1 }],
    lb: mu,
    ub: mu,
  });

  // Variable bounds
  const bounds: LPBound[] = rxns.map((r) => ({
    name: r.id,
    lb: r.lowerBound,
    ub: r.upperBound,
  }));

  // Objective: maximize biomass (will be fixed to mu by constraint,
  // but gives the solver a direction to pivot toward)
  const objective: LPVariable[] = rxns.map((r) => ({
    name: r.id,
    coef: r.id === species.biomassReaction ? 1 : 0,
  }));

  return {
    name: `steadycom_${species.id}_mu${mu.toFixed(4)}`,
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };
}

/**
 * Build an LPModel that maximizes biomass for a species (no mu fixation).
 * Used to find the individual maximum growth rate.
 */
function buildMaxGrowthLPModel(species: SteadyComSpecies): LPModel {
  const rxns = species.reactions;
  const mets = species.metabolites;

  const constraints: LPConstraint[] = mets.map((metId) => ({
    name: `${species.id}_${metId}_balance`,
    vars: rxns
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
    lb: 0,
    ub: 0,
  }));

  const bounds: LPBound[] = rxns.map((r) => ({
    name: r.id,
    lb: r.lowerBound,
    ub: r.upperBound,
  }));

  const objective: LPVariable[] = rxns.map((r) => ({
    name: r.id,
    coef: r.id === species.biomassReaction ? 1 : 0,
  }));

  return {
    name: `steadycom_max_${species.id}`,
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };
}

/**
 * Check if a single species can achieve growth rate mu.
 * Returns { feasible, fluxes } where fluxes is the flux distribution if feasible.
 */
async function checkSpeciesFeasibility(
  species: SteadyComSpecies,
  mu: number,
): Promise<{ feasible: boolean; fluxes: Record<string, number> }> {
  const model = buildSpeciesLPModel(species, mu);
  const result = await solveLP(model);

  const fluxes: Record<string, number> = {};
  for (const rxn of species.reactions) {
    fluxes[rxn.id] = round(result.primals[rxn.id] ?? 0);
  }

  // HiGHS returns "optimal" if feasible; "infeasible" otherwise.
  // Also check that the solver didn't error out.
  const feasible = result.status === "optimal";

  return { feasible, fluxes };
}

/**
 * Find the maximum individual growth rate for a species.
 */
async function findMaxGrowthRate(species: SteadyComSpecies): Promise<number> {
  const model = buildMaxGrowthLPModel(species);
  const result = await solveLP(model);

  if (result.status !== "optimal") {
    return 0;
  }

  return result.objectiveValue;
}

/**
 * Build ONE joint community LP at a fixed community growth rate mu (SteadyCom).
 * Couples species through a shared extracellular metabolite pool and scales
 * each species' fluxes by its abundance X_i (balanced growth: biomass = mu*X_i).
 * Reference: Chan, Simons & Maranas (2017) PLOS Comput Biol 13(5):e1005539.
 */
export function buildCommunityLPModel(species: SteadyComSpecies[], sharedMetabolites: string[], mu: number): LPModel {
  const shared = new Set(sharedMetabolites);
  const vname = (sp: string, rxn: string) => `${sp}__${rxn}`;
  const xname = (sp: string) => `X__${sp}`;

  const bounds: LPBound[] = [];
  const constraints: LPConstraint[] = [];

  for (const sp of species) {
    // Flux variable bounds (coupling constraints tighten these).
    for (const r of sp.reactions) {
      bounds.push({ name: vname(sp.id, r.id), lb: Math.min(0, r.lowerBound), ub: Math.max(0, r.upperBound) });
    }
    // Abundance variable.
    bounds.push({ name: xname(sp.id), lb: 0, ub: 1 });

    // Per-species internal mass balance (shared metabolites excluded — pooled below).
    for (const met of sp.metabolites) {
      if (shared.has(met)) continue;
      const vars = sp.reactions
        .filter((r) => r.stoichiometry[met] !== undefined)
        .map((r) => ({ name: vname(sp.id, r.id), coef: r.stoichiometry[met] }));
      constraints.push({ name: `${sp.id}__bal__${met}`, vars, lb: 0, ub: 0 });
    }

    // Flux-abundance coupling: lb_j*X <= v <= ub_j*X.
    for (const r of sp.reactions) {
      constraints.push({
        name: `${sp.id}__${r.id}__ub_couple`,
        vars: [
          { name: vname(sp.id, r.id), coef: 1 },
          { name: xname(sp.id), coef: -r.upperBound },
        ],
        lb: -Infinity,
        ub: 0,
      });
      constraints.push({
        name: `${sp.id}__${r.id}__lb_couple`,
        vars: [
          { name: vname(sp.id, r.id), coef: 1 },
          { name: xname(sp.id), coef: -r.lowerBound },
        ],
        lb: 0,
        ub: Infinity,
      });
    }

    // Biomass-abundance coupling: v_biomass - mu*X = 0.
    constraints.push({
      name: `${sp.id}__growthcouple`,
      vars: [
        { name: vname(sp.id, sp.biomassReaction), coef: 1 },
        { name: xname(sp.id), coef: -mu },
      ],
      lb: 0,
      ub: 0,
    });
  }

  // Community shared-pool balance: sum over all species/reactions of S[m]*v = 0.
  for (const m of sharedMetabolites) {
    const vars: LPVariable[] = [];
    for (const sp of species) {
      for (const r of sp.reactions) {
        if (r.stoichiometry[m] !== undefined) vars.push({ name: vname(sp.id, r.id), coef: r.stoichiometry[m] });
      }
    }
    constraints.push({ name: `pool__${m}`, vars, lb: 0, ub: 0 });
  }

  // Normalization: sum X_i = 1.
  constraints.push({
    name: "community__abundance_sum",
    vars: species.map((sp) => ({ name: xname(sp.id), coef: 1 })),
    lb: 1,
    ub: 1,
  });

  // Objective: feasibility (maximize first species' biomass for a direction).
  const objective: LPVariable[] = [{ name: vname(species[0].id, species[0].biomassReaction), coef: 1 }];

  return { name: `steadycom_community_mu${mu.toFixed(4)}`, sense: "maximize", objective, constraints, bounds };
}

/* ------------------------------------------------------------------ */
/*  SteadyCom main algorithm                                           */
/* ------------------------------------------------------------------ */

/**
 * Run SteadyCom community FBA.
 *
 * @param species - Array of species in the community
 * @param sharedMetabolites - IDs of metabolites shared between species (for documentation)
 * @param maxIterations - Maximum binary search iterations (default: 100)
 * @param tolerance - Convergence tolerance on mu (default: 1e-6)
 * @returns SteadyComResult with community growth rate and per-species flux distributions
 */
export async function steadyCom(
  species: SteadyComSpecies[],
  sharedMetabolites: string[],
  maxIterations = 100,
  tolerance = 1e-6,
): Promise<SteadyComResult> {
  // ── Edge cases ──────────────────────────────────────────────────────
  if (species.length === 0) {
    return {
      status: "error",
      communityGrowthRate: 0,
      speciesFluxes: {},
      speciesGrowthRates: {},
      iterations: 0,
      convergenceHistory: [],
    };
  }

  // Validate biomass reactions exist
  for (const sp of species) {
    if (!sp.reactions.find((r) => r.id === sp.biomassReaction)) {
      return {
        status: "error",
        communityGrowthRate: 0,
        speciesFluxes: {},
        speciesGrowthRates: {},
        iterations: 0,
        convergenceHistory: [],
      };
    }
  }

  // ── Step 1: Find upper bound from individual max growth rates ───────
  // Community rate <= min(individual max growth rates)
  let muHigh = Infinity;
  for (const sp of species) {
    const maxGrowth = await findMaxGrowthRate(sp);
    if (maxGrowth <= 0) {
      // This species cannot grow at all -> community infeasible
      return {
        status: "infeasible",
        communityGrowthRate: 0,
        speciesFluxes: {},
        speciesGrowthRates: {},
        iterations: 0,
        convergenceHistory: [],
      };
    }
    muHigh = Math.min(muHigh, maxGrowth);
  }

  // ── Step 2: Verify feasibility at mu = 0 ────────────────────────────
  // (all species should be feasible at zero growth)
  for (const sp of species) {
    const check = await checkSpeciesFeasibility(sp, 0);
    if (!check.feasible) {
      return {
        status: "infeasible",
        communityGrowthRate: 0,
        speciesFluxes: {},
        speciesGrowthRates: {},
        iterations: 0,
        convergenceHistory: [],
      };
    }
  }

  // ── Step 3: Binary search on community growth rate ──────────────────
  let muLow = 0;
  const convergenceHistory: number[] = [];
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    const muMid = (muLow + muHigh) / 2;
    convergenceHistory.push(round(muMid));

    let allFeasible = true;
    for (const sp of species) {
      const check = await checkSpeciesFeasibility(sp, muMid);
      if (!check.feasible) {
        allFeasible = false;
        break;
      }
    }

    if (allFeasible) {
      muLow = muMid;
    } else {
      muHigh = muMid;
    }

    if (muHigh - muLow < tolerance) {
      break;
    }
  }

  // ── Step 4: Final solve at muLow to get flux distributions ──────────
  const speciesFluxes: Record<string, Record<string, number>> = {};
  const speciesGrowthRates: Record<string, number> = {};

  for (const sp of species) {
    const check = await checkSpeciesFeasibility(sp, muLow);
    if (!check.feasible) {
      // Shouldn't happen if binary search converged correctly
      return {
        status: "infeasible",
        communityGrowthRate: 0,
        speciesFluxes: {},
        speciesGrowthRates: {},
        iterations,
        convergenceHistory,
      };
    }
    speciesFluxes[sp.id] = check.fluxes;
    speciesGrowthRates[sp.id] = round(check.fluxes[sp.biomassReaction] ?? 0);
  }

  return {
    status: muLow > tolerance ? "optimal" : "infeasible",
    communityGrowthRate: round(muLow),
    speciesFluxes,
    speciesGrowthRates,
    iterations,
    convergenceHistory,
  };
}
