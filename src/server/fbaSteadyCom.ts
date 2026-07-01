/**
 * SteadyCom Community FBA
 *
 * Implements the SteadyCom algorithm for computing community growth rates
 * in microbial consortia.
 *
 * Algorithm: Bisection on community growth rate mu.
 *   1. Fix mu (candidate community growth rate)
 *   2. Solve ONE joint LP over all species (built by buildCommunityLPModel):
 *      - per-species stoichiometric mass balance (S . v = 0)
 *      - shared extracellular metabolite pool coupling
 *      - biomass-abundance coupling (v_biomass = mu * X_i)
 *      - sum(X_i) = 1 (community abundance normalization)
 *   3. If the joint LP is optimal at mu -> increase mu
 *   4. If the joint LP is infeasible at mu -> decrease mu
 *   5. Repeat until |mu_high - mu_low| < tolerance
 *
 * @scientific_provenance
 *   REFERENCE: Chan SHJ, Simons MN, Maranas CD (2017).
 *     "SteadyCom: Predicting microbial abundances while ensuring community stability."
 *     PLOS Computational Biology 13(5): e1005539. DOI 10.1371/journal.pcbi.1005539.
 *   ALGORITHM: SteadyCom -- one joint LP over all species (per-species mass balance +
 *     shared extracellular pool coupling + biomass-abundance coupling + sum(X)=1),
 *     bisection on community growth rate mu.
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
 * Each candidate community growth rate mu is checked by solving ONE joint LP
 * over all species (buildCommunityLPModel), so shared-pool cross-feeding and
 * biomass-abundance coupling are enforced directly by the solver rather than
 * approximated via independent per-species feasibility checks.
 *
 * @param species - Array of species in the community
 * @param sharedMetabolites - IDs of metabolites shared between species
 * @param maxIterations - Maximum bisection iterations (default: 100)
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

  const check = async (mu: number) => solveLP(buildCommunityLPModel(species, sharedMetabolites, mu));

  // mu = 0 must be feasible (no growth).
  const zero = await check(0);
  if (zero.status !== "optimal") {
    return {
      status: "infeasible",
      communityGrowthRate: 0,
      speciesFluxes: {},
      speciesGrowthRates: {},
      iterations: 0,
      convergenceHistory: [],
    };
  }

  // Upper bound: max individual growth over species (community mu cannot
  // exceed the fastest single species' unconstrained max growth rate).
  let muHigh = 0;
  for (const sp of species) muHigh = Math.max(muHigh, await findMaxGrowthRate(sp));
  if (muHigh <= 0) {
    return {
      status: "optimal",
      communityGrowthRate: 0,
      speciesFluxes: readFluxes(species, zero.primals),
      speciesGrowthRates: readGrowth(species, zero.primals),
      iterations: 0,
      convergenceHistory: [0],
    };
  }

  let muLow = 0;
  let best = zero;
  const convergenceHistory: number[] = [];
  let iterations = 0;
  while (muHigh - muLow > tolerance && iterations < maxIterations) {
    iterations++;
    const muMid = (muLow + muHigh) / 2;
    convergenceHistory.push(round(muMid));
    const sol = await check(muMid);
    if (sol.status === "optimal") {
      muLow = muMid;
      best = sol;
    } else {
      muHigh = muMid;
    }
  }

  return {
    status: "optimal",
    communityGrowthRate: round(muLow),
    speciesFluxes: readFluxes(species, best.primals),
    speciesGrowthRates: readGrowth(species, best.primals),
    iterations,
    convergenceHistory,
  };
}

/**
 * De-namespace joint LP primals back to per-species reaction fluxes.
 */
function readFluxes(
  species: SteadyComSpecies[],
  primals: Record<string, number>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const sp of species) {
    out[sp.id] = {};
    for (const r of sp.reactions) out[sp.id][r.id] = round(primals[`${sp.id}__${r.id}`] ?? 0);
  }
  return out;
}

/**
 * De-namespace joint LP primals back to per-species growth rates
 * (the flux through each species' biomass reaction).
 */
function readGrowth(species: SteadyComSpecies[], primals: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sp of species) out[sp.id] = round(primals[`${sp.id}__${sp.biomassReaction}`] ?? 0);
  return out;
}
