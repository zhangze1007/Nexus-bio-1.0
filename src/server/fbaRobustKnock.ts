import { SeededRNG } from '../utils/seededRng';

/**
 * RobustKnock — Guaranteed minimum product flux under ALL optimal growth solutions.
 *
 * Reference: Tepper, N. & Shlomi, T. (2010).
 *   Computational design of auxotrophy-dependent microbial metabolic engineering
 *   for the production of biochemicals.
 *   BMC Bioinformatics, 11, 167.
 *
 * Key insight: If the minimum product flux across all FBA optima is > 0,
 * production is guaranteed regardless of which alternative optimal solution
 * the cell chooses.
 *
 * Algorithm:
 *   1. Solve wild-type FBA (max growth) -> baseline growth rate and product range.
 *   2. Identify candidate knockout reactions (non-EX, non-objective, non-product).
 *   3. For each candidate knockout set (exhaustive if <= 15 candidates, else sample):
 *      a. Solve FBA with knockouts (max growth) -> growth rate.
 *      b. Fix growth at optimal, MINIMIZE product -> worst-case product flux.
 *      c. Fix growth at optimal, MAXIMIZE product -> best-case product flux.
 *      d. If min product > 0, production is robust (guaranteed).
 *   4. Return knockout sets sorted by minimum product flux (best worst-case first).
 *
 * @scientific_provenance
 *   REFERENCE: Tepper & Shlomi (2010) BMC Bioinformatics 11:167
 *   ALGORITHM: Sequential LP approach to RobustKnock (min product at max growth)
 *   KNOWN_LIMITATIONS:
 *     - Not a true bilevel MILP; uses sequential LP solves
 *     - Growth-product robustness verified post-hoc, not by duality
 *     - Enumeration limited to small candidate sets (<= 15 reactions)
 *     - For large models, random sampling may miss optimal knockouts
 */

import { solveLP, type LPModel } from './highsSolver';

/* ------------------------------------------------------------------ */
/*  Public interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface RobustKnockReaction {
  id: string;
  lb: number;
  ub: number;
  stoichiometry: Record<string, number>;
}

export interface RobustKnockModel {
  reactions: RobustKnockReaction[];
  objectiveId: string;
  productReactionId: string;
}

export interface RobustKnockSet {
  reactions: string[];
  growthRate: number;
  minProductFlux: number;
  maxProductFlux: number;
}

export interface RobustKnockResult {
  knockoutSets: RobustKnockSet[];
  wildtypeGrowthRate: number;
  wildtypeMinProductFlux: number;
}

export interface RobustKnockOptions {
  maxKnockouts?: number;
  glucoseUptake?: number;
  oxygenUptake?: number;
  growthTolerance?: number;
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
  // Fisher-Yates partial shuffle (seeded for reproducibility)
  const rng = new SeededRNG(42);
  for (let i = allCombos.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [allCombos[i], allCombos[j]] = [allCombos[j], allCombos[i]];
  }
  return allCombos.slice(0, n);
}

/* ------------------------------------------------------------------ */
/*  LP construction                                                    */
/* ------------------------------------------------------------------ */

function collectMetabolites(reactions: RobustKnockReaction[]): Set<string> {
  const metIds = new Set<string>();
  for (const r of reactions) {
    for (const metId of Object.keys(r.stoichiometry)) {
      metIds.add(metId);
    }
  }
  return metIds;
}

function buildStoichiometricConstraints(
  reactions: RobustKnockReaction[],
  metIds: Set<string>,
) {
  return Array.from(metIds).map((metId) => ({
    name: `${metId}_balance`,
    vars: reactions
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
    lb: 0,
    ub: 0,
  }));
}

function buildBounds(
  reactions: RobustKnockReaction[],
  knockouts: string[],
  glucoseUptake: number,
  oxygenUptake: number,
  growthLB?: number,
  objectiveId?: string,
) {
  const knockoutSet = new Set(knockouts);
  return reactions.map((r) => {
    let lb = r.lb;
    // Enforce minimum growth rate on biomass/objective reaction
    if (objectiveId && growthLB !== undefined && r.id === objectiveId) {
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
}

/**
 * Build an LP to maximize or minimize a target reaction flux.
 */
function buildFluxLP(
  reactions: RobustKnockReaction[],
  targetId: string,
  knockouts: string[],
  glucoseUptake: number,
  oxygenUptake: number,
  growthLB: number,
  objectiveId: string,
  sense: 'maximize' | 'minimize',
): LPModel {
  const metIds = collectMetabolites(reactions);
  const constraints = buildStoichiometricConstraints(reactions, metIds);
  const bounds = buildBounds(reactions, knockouts, glucoseUptake, oxygenUptake, growthLB, objectiveId);

  return {
    name: `robustknock_${sense}_${targetId}`,
    sense,
    objective: [{ name: targetId, coef: 1 }],
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
 * Run RobustKnock analysis to find gene knockout strategies with
 * guaranteed minimum product flux across all optimal growth solutions.
 *
 * @param model - Metabolic model with reactions, objective, and product reaction
 * @param options - Algorithm options
 * @returns Knockout sets with min/max product flux, sorted by min product (best worst-case first)
 */
export async function runRobustKnock(
  model: RobustKnockModel,
  options: RobustKnockOptions = {},
): Promise<RobustKnockResult> {
  const {
    maxKnockouts = 3,
    glucoseUptake = 10,
    oxygenUptake = 12,
    growthTolerance = 0.01,
    maxResults = 10,
  } = options;

  // Validate product reaction exists
  const hasProduct = model.reactions.some((r) => r.id === model.productReactionId);
  if (!hasProduct) {
    return {
      knockoutSets: [],
      wildtypeGrowthRate: 0,
      wildtypeMinProductFlux: 0,
    };
  }

  // Step 1: Wild-type FBA — maximize growth
  const wtGrowthLP = buildFluxLP(
    model.reactions,
    model.objectiveId,
    [],
    glucoseUptake,
    oxygenUptake,
    0,
    model.objectiveId,
    'maximize',
  );
  const wtGrowthResult = await solveLP(wtGrowthLP);

  if (wtGrowthResult.status !== 'optimal') {
    return {
      knockoutSets: [],
      wildtypeGrowthRate: 0,
      wildtypeMinProductFlux: 0,
    };
  }

  const wildtypeGrowthRate = round(wtGrowthResult.objectiveValue);

  // Step 1b: Wild-type — minimize product at max growth (worst-case baseline)
  const wtGrowthLB = wildtypeGrowthRate * (1 - growthTolerance);
  const wtMinProductLP = buildFluxLP(
    model.reactions,
    model.productReactionId,
    [],
    glucoseUptake,
    oxygenUptake,
    wtGrowthLB,
    model.objectiveId,
    'minimize',
  );
  const wtMinProductResult = await solveLP(wtMinProductLP);
  const wildtypeMinProductFlux = wtMinProductResult.status === 'optimal'
    ? round(wtMinProductResult.objectiveValue)
    : 0;

  // Step 2: Identify candidate reactions for knockout
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
      wildtypeMinProductFlux,
    };
  }

  // Step 3: Enumerate or sample knockout sets
  const useExhaustive = candidateIds.length <= EXHAUSTIVE_THRESHOLD;
  const results: RobustKnockSet[] = [];

  for (let k = 1; k <= maxKnockouts; k++) {
    const combos = useExhaustive
      ? combinations(candidateIds, k)
      : sampleCombinations(candidateIds, k, RANDOM_SAMPLES);

    for (const combo of combos) {
      // 3a: Solve with knockouts, maximize growth -> growth rate
      const koGrowthLP = buildFluxLP(
        model.reactions,
        model.objectiveId,
        combo,
        glucoseUptake,
        oxygenUptake,
        0,
        model.objectiveId,
        'maximize',
      );
      const koGrowthResult = await solveLP(koGrowthLP);

      if (koGrowthResult.status !== 'optimal' || koGrowthResult.objectiveValue < 1e-6) {
        continue; // Growth is zero or infeasible — skip
      }

      const koGrowthRate = round(koGrowthResult.objectiveValue);

      // Fix growth at near-optimal (within tolerance)
      const koGrowthLB = koGrowthRate * (1 - growthTolerance);

      // 3b: Fix growth, MINIMIZE product -> worst-case product flux
      const koMinProductLP = buildFluxLP(
        model.reactions,
        model.productReactionId,
        combo,
        glucoseUptake,
        oxygenUptake,
        koGrowthLB,
        model.objectiveId,
        'minimize',
      );
      const koMinProductResult = await solveLP(koMinProductLP);

      if (koMinProductResult.status !== 'optimal') continue;

      const koMinProduct = round(koMinProductResult.objectiveValue);

      // 3c: Fix growth, MAXIMIZE product -> best-case product flux
      const koMaxProductLP = buildFluxLP(
        model.reactions,
        model.productReactionId,
        combo,
        glucoseUptake,
        oxygenUptake,
        koGrowthLB,
        model.objectiveId,
        'maximize',
      );
      const koMaxProductResult = await solveLP(koMaxProductLP);

      if (koMaxProductResult.status !== 'optimal') continue;

      const koMaxProduct = round(koMaxProductResult.objectiveValue);

      // 3d: If min product > 0, production is robust (guaranteed)
      if (koMinProduct > 1e-6) {
        results.push({
          reactions: [...combo].sort(),
          growthRate: koGrowthRate,
          minProductFlux: koMinProduct,
          maxProductFlux: koMaxProduct,
        });
      }
    }
  }

  // Step 4: Sort by min product flux (best worst-case first), return top N
  results.sort((a, b) => b.minProductFlux - a.minProductFlux);

  return {
    knockoutSets: results.slice(0, maxResults),
    wildtypeGrowthRate,
    wildtypeMinProductFlux,
  };
}
