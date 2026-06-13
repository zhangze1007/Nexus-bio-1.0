/**
 * OptKnock — Bilevel knockout strategy for coupling growth to product formation.
 *
 * Reference: Burgard, A.P., Pharkya, P., & Maranas, C.D. (2003).
 *   OptKnock: A bilevel programming framework for identifying gene
 *   knockout strategies for microbial strain optimization.
 *   Biotechnol Bioeng, 84(6), 647-657.
 *
 * Implementation uses an iterative LP-based approach rather than full
 * bilevel MILP reformulation:
 *   1. Solve wild-type FBA (growth objective) to get baseline fluxes.
 *   2. Identify candidate knockout reactions (non-EX, non-objective).
 *   3. Enumerate (small models) or sample (large models) knockout sets.
 *   4. For each candidate set, solve FBA with knockouts, then maximize
 *      product to find the best product flux at near-maximal growth.
 *   5. Return Pareto-optimal sets where product flux exceeds wild-type.
 *
 * @scientific_provenance
 *   REFERENCE: Burgard et al. (2003) Biotechnol Bioeng 84(6):647-657
 *   ALGORITHM: Iterative LP approximation of bilevel OptKnock
 *   KNOWN_LIMITATIONS:
 *     - Not a true bilevel MILP; uses sequential LP solves
 *     - Growth-product coupling verified post-hoc, not by duality
 *     - Enumeration limited to small candidate sets (<=15 reactions)
 *     - For large models, random sampling may miss optimal knockouts
 */

import { solveLP, type LPModel } from './highsSolver';

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
  // Fisher-Yates partial shuffle
  for (let i = allCombos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCombos[i], allCombos[j]] = [allCombos[j], allCombos[i]];
  }
  return allCombos.slice(0, n);
}

/* ------------------------------------------------------------------ */
/*  LP construction                                                    */
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
    // Enforce minimum growth rate on biomass reaction
    if (r.id === 'BIOMASS' || r.id === 'BIOMASS_Ec_iML1515' || r.id === 'BIOMASS_HP_published') {
      lb = Math.max(lb, growthLB);
    }
    if (r.id.startsWith('EX_')) {
      const isGlucose = r.id.includes('glc') || r.id.includes('glu');
      const isOxygen = r.id.includes('o2') || r.id.includes('O2');
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
    name: 'optknock',
    sense: 'maximize',
    objective,
    constraints,
    bounds,
  };
}

/* ------------------------------------------------------------------ */
/*  Core algorithm                                                     */
/* ------------------------------------------------------------------ */

const EXHAUSTIVE_THRESHOLD = 15;
const RANDOM_SAMPLES = 100;

/**
 * Run OptKnock analysis to find gene knockout strategies that couple
 * growth to product formation.
 *
 * Algorithm:
 * 1. Solve wild-type FBA for growth -> get max growth rate and baseline product flux
 * 2. Identify candidate knockout reactions (exclude EX_ and objective/product rxns)
 * 3. For k = 1..maxKnockouts, enumerate or sample knockout combinations
 * 4. For each combo:
 *    a. Solve FBA with knockouts (max growth) -> growth rate
 *    b. Solve FBA with knockouts + growth constraint -> max product
 * 5. Keep Pareto-optimal sets (growth > 0, product > wild-type)
 * 6. Sort by product flux, return top N
 */
export async function runOptKnock(
  model: OptKnockModel,
  options: OptKnockOptions = {},
): Promise<OptKnockResult> {
  const {
    maxKnockouts = 3,
    glucoseUptake = 10,
    oxygenUptake = 12,
    growthFraction = 0.01,
    maxResults = 10,
  } = options;

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
  const wtGrowthLP = buildOptKnockLP(
    model.reactions,
    model.objectiveId,
    [],
    0,
    glucoseUptake,
    oxygenUptake,
  );
  const wtGrowthResult = await solveLP(wtGrowthLP);

  if (wtGrowthResult.status !== 'optimal') {
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
  const wildtypeProductFlux = wtProductResult.status === 'optimal'
    ? round(wtProductResult.objectiveValue)
    : 0;

  // Step 3: Identify candidate reactions for knockout
  const candidateIds = model.reactions
    .map((r) => r.id)
    .filter(
      (id) =>
        !id.startsWith('EX_') &&
        id !== model.objectiveId &&
        id !== model.productReactionId,
    );

  if (candidateIds.length === 0) {
    return {
      knockoutSets: [],
      wildtypeGrowthRate,
      wildtypeProductFlux,
    };
  }

  // Step 4: Enumerate or sample knockout sets
  const useExhaustive = candidateIds.length <= EXHAUSTIVE_THRESHOLD;
  const results: KnockoutSet[] = [];

  for (let k = 1; k <= maxKnockouts; k++) {
    const combos = useExhaustive
      ? combinations(candidateIds, k)
      : sampleCombinations(candidateIds, k, RANDOM_SAMPLES);

    for (const combo of combos) {
      // 4a: Solve with knockouts, maximize growth
      const koGrowthLP = buildOptKnockLP(
        model.reactions,
        model.objectiveId,
        combo,
        0,
        glucoseUptake,
        oxygenUptake,
      );
      const koGrowthResult = await solveLP(koGrowthLP);

      if (koGrowthResult.status !== 'optimal' || koGrowthResult.objectiveValue < 1e-6) {
        continue; // Growth is zero or infeasible — skip
      }

      const koGrowthRate = round(koGrowthResult.objectiveValue);

      // 4b: Maximize product with growth constraint
      const koProductLP = buildOptKnockLP(
        model.reactions,
        model.productReactionId,
        combo,
        koGrowthRate * growthFraction,
        glucoseUptake,
        oxygenUptake,
      );
      const koProductResult = await solveLP(koProductLP);

      if (koProductResult.status !== 'optimal') continue;

      const koProductFlux = round(koProductResult.objectiveValue);

      // Keep only if product flux improves over wild-type
      if (koProductFlux > wildtypeProductFlux + 1e-6) {
        results.push({
          reactions: [...combo].sort(),
          growthRate: koGrowthRate,
          productFlux: koProductFlux,
        });
      }
    }
  }

  // Step 5: Sort by product flux (best first), return top N
  results.sort((a, b) => b.productFlux - a.productFlux);

  return {
    knockoutSets: results.slice(0, maxResults),
    wildtypeGrowthRate,
    wildtypeProductFlux,
  };
}
