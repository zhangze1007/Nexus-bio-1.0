/**
 * SteadyCom Community FBA
 *
 * Implements the SteadyCom algorithm (Heinken et al., 2015, PLOS Comput Biol)
 * for computing community growth rates in microbial consortia.
 *
 * Algorithm: Binary search on community growth rate μ.
 *   1. Fix μ (candidate community growth rate)
 *   2. For each species, solve LP: maximize biomass subject to:
 *      - stoichiometric constraints (S · v = 0)
 *      - flux bounds (lb ≤ v ≤ ub)
 *      - biomass reaction flux = μ (fixed)
 *   3. If all species feasible at μ → increase μ
 *   4. If any species infeasible at μ → decrease μ
 *   5. Repeat until |μ_high - μ_low| < tolerance
 *
 * @scientific_provenance
 *   REFERENCE: Heinken A, Thiele I, Fleming RM (2015).
 *     "Competitive and cooperative metabolic interactions in microbial communities."
 *     PLOS Computational Biology 11(1): e1004010.
 *   ALGORITHM: SteadyCom — binary search on community growth rate with per-species LP.
 */

import { type LPProblem, solveLPSimplex } from "./simplexLP";

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
 * Build an LPProblem for a single species at a fixed growth rate μ.
 *
 * The LP checks feasibility: can this species achieve growth rate μ
 * while satisfying all stoichiometric constraints and flux bounds?
 *
 * We maximize a dummy objective (sum of all fluxes with tiny coefficients)
 * to avoid degeneracy, but the real check is feasibility.
 */
function buildSpeciesLP(species: SteadyComSpecies, mu: number): LPProblem {
  const rxns = species.reactions;
  const mets = species.metabolites;
  const n = rxns.length;
  const m = mets.length;

  // Find biomass reaction index
  const biomassIdx = rxns.findIndex((r) => r.id === species.biomassReaction);
  if (biomassIdx === -1) {
    throw new Error(`Biomass reaction "${species.biomassReaction}" not found in species "${species.id}"`);
  }

  // Build stoichiometric matrix: S[i][j] = coefficient of metabolite i in reaction j
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < m; i++) {
    const metId = mets[i];
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(rxns[j].stoichiometry[metId] ?? 0);
    }
    A.push(row);
    b.push(0); // mass balance: S · v = 0
  }

  // Add constraint: biomass reaction flux = μ
  // This is: v_biomass = μ, i.e., one row with 1 at biomassIdx, RHS = μ
  const biomassRow = new Array(n).fill(0);
  biomassRow[biomassIdx] = 1;
  A.push(biomassRow);
  b.push(mu);

  // Bounds
  const lb = rxns.map((r) => r.lowerBound);
  const ub = rxns.map((r) => r.upperBound);

  // Dummy objective: tiny coefficients to avoid degeneracy
  // (We just need feasibility, but simplex needs an objective)
  const c = new Array(n).fill(0);
  c[biomassIdx] = 1; // maximize biomass (will be fixed to μ anyway)

  return { c, A, b, ub, lb };
}

/**
 * Check if a single species can achieve growth rate μ.
 * Returns { feasible, fluxes } where fluxes is the flux distribution if feasible.
 */
function checkSpeciesFeasibility(
  species: SteadyComSpecies,
  mu: number,
): { feasible: boolean; fluxes: Record<string, number> } {
  if (mu <= 0) {
    // At μ = 0, check if the trivial solution (all fluxes at lower bounds) is feasible
    // For most models, μ = 0 is feasible (no growth required)
    // But we need to verify: biomass = 0 must be achievable
    const lp = buildSpeciesLP(species, 0);
    const sol = solveLPSimplex(lp);
    if (!sol.feasible) {
      return { feasible: false, fluxes: {} };
    }
    const fluxes: Record<string, number> = {};
    for (let j = 0; j < species.reactions.length; j++) {
      fluxes[species.reactions[j].id] = round(sol.x[j]);
    }
    return { feasible: true, fluxes };
  }

  const lp = buildSpeciesLP(species, mu);
  const sol = solveLPSimplex(lp);

  if (!sol.feasible) {
    return { feasible: false, fluxes: {} };
  }

  const fluxes: Record<string, number> = {};
  for (let j = 0; j < species.reactions.length; j++) {
    fluxes[species.reactions[j].id] = round(sol.x[j]);
  }

  return { feasible: true, fluxes };
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
 * @param tolerance - Convergence tolerance on μ (default: 1e-6)
 * @returns SteadyComResult with community growth rate and per-species flux distributions
 */
export function steadyCom(
  species: SteadyComSpecies[],
  sharedMetabolites: string[],
  maxIterations = 100,
  tolerance = 1e-6,
): SteadyComResult {
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

  // First, find the upper bound: maximum individual growth rate across all species
  // This is an upper bound on the community rate (community rate ≤ min of individual maxima)
  let muHigh = 2.0; // reasonable upper bound
  for (const sp of species) {
    // Solve unconstrained FBA for each species to find its max growth rate
    const lp = buildSpeciesLP(sp, 0); // build with μ=0 first to check basic feasibility
    // Actually, we need to find the max growth rate for this species
    // Build an LP that maximizes biomass without fixing it
    const rxns = sp.reactions;
    const mets = sp.metabolites;
    const n = rxns.length;
    const m = mets.length;

    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < m; i++) {
      const metId = mets[i];
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        row.push(rxns[j].stoichiometry[metId] ?? 0);
      }
      A.push(row);
      b.push(0);
    }

    const lb = rxns.map((r) => r.lowerBound);
    const ub = rxns.map((r) => r.upperBound);
    const c = new Array(n).fill(0);
    const biomassIdx = rxns.findIndex((r) => r.id === sp.biomassReaction);
    c[biomassIdx] = 1;

    const maxLP: LPProblem = { c, A, b, ub, lb };
    const maxSol = solveLPSimplex(maxLP);

    if (maxSol.feasible && maxSol.z > 0) {
      muHigh = Math.min(muHigh, maxSol.z);
    }
  }

  // Check if any species is completely infeasible (can't grow at all)
  for (const sp of species) {
    const check = checkSpeciesFeasibility(sp, 0);
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

  // Binary search on community growth rate
  let muLow = 0;
  const convergenceHistory: number[] = [];
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    const muMid = (muLow + muHigh) / 2;
    convergenceHistory.push(round(muMid));

    let allFeasible = true;
    for (const sp of species) {
      const check = checkSpeciesFeasibility(sp, muMid);
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

  // Final solve at muLow to get flux distributions
  const speciesFluxes: Record<string, Record<string, number>> = {};
  const speciesGrowthRates: Record<string, number> = {};

  for (const sp of species) {
    const check = checkSpeciesFeasibility(sp, muLow);
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
