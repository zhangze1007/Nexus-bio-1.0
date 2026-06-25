/**
 * Grid Search with Pareto Evaluation
 *
 * Samples parameter space, evaluates each candidate through the full
 * solver pipeline (ODE → burden → Jacobian), and builds a Pareto front.
 *
 * Every evaluation calls real solvers — no LLM estimation.
 *
 * Sampling strategies:
 *   - Latin Hypercube: space-filling, good for initial exploration
 *   - Grid: exhaustive for small parameter spaces
 *   - Random: Monte Carlo sampling for large spaces
 */

import { SeededRNG } from "../utils/seededRng";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  /** Number of grid points (for grid sampling) */
  steps?: number;
}

export interface CandidateEvaluation {
  parameters: Record<string, number>;
  objectives: Record<string, number>;
  constraints: Record<string, { value: number; satisfied: boolean; threshold: number }>;
  feasible: boolean;
  paretoRank: number;
  dominatedBy: string[];
}

export interface GridSearchResult {
  candidates: CandidateEvaluation[];
  paretoFront: CandidateEvaluation[];
  bestByComposite: CandidateEvaluation;
  stats: {
    totalEvaluated: number;
    feasible: number;
    infeasible: number;
    paretoFrontSize: number;
  };
  compositeFormula: string;
}

// ── Sampling Strategies ─────────────────────────────────────────────────────

/**
 * Latin Hypercube Sampling: space-filling design that ensures each
 * parameter range is evenly sampled.
 */
export function latinHypercubeSample(
  ranges: ParameterRange[],
  nSamples: number,
  seed = 42,
): Array<Record<string, number>> {
  const rng = new SeededRNG(seed);
  const n = ranges.length;
  const samples: Array<Record<string, number>> = [];

  // Create stratified samples for each dimension
  const strata: number[][] = [];
  for (let i = 0; i < n; i++) {
    const stratum: number[] = [];
    for (let j = 0; j < nSamples; j++) {
      stratum.push((j + rng.next()) / nSamples);
    }
    // Shuffle
    for (let j = nSamples - 1; j > 0; j--) {
      const k = Math.floor(rng.next() * (j + 1));
      [stratum[j], stratum[k]] = [stratum[k], stratum[j]];
    }
    strata.push(stratum);
  }

  for (let j = 0; j < nSamples; j++) {
    const sample: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const range = ranges[i];
      sample[range.name] = range.min + strata[i][j] * (range.max - range.min);
    }
    samples.push(sample);
  }

  return samples;
}

/**
 * Grid sampling: exhaustive enumeration for small parameter spaces.
 */
export function gridSample(ranges: ParameterRange[]): Array<Record<string, number>> {
  if (ranges.length === 0) return [{}];

  const [first, ...rest] = ranges;
  const steps = first.steps ?? 5;
  const restSamples = gridSample(rest);
  const samples: Array<Record<string, number>> = [];

  for (let i = 0; i < steps; i++) {
    const value = first.min + (i / (steps - 1)) * (first.max - first.min);
    for (const restSample of restSamples) {
      samples.push({ [first.name]: value, ...restSample });
    }
  }

  return samples;
}

/**
 * Random Monte Carlo sampling.
 */
export function randomSample(ranges: ParameterRange[], nSamples: number, seed = 42): Array<Record<string, number>> {
  const rng = new SeededRNG(seed);
  const samples: Array<Record<string, number>> = [];

  for (let j = 0; j < nSamples; j++) {
    const sample: Record<string, number> = {};
    for (const range of ranges) {
      sample[range.name] = range.min + rng.next() * (range.max - range.min);
    }
    samples.push(sample);
  }

  return samples;
}

// ── Pareto Front ────────────────────────────────────────────────────────────

/**
 * Build Pareto front from candidate evaluations.
 * A candidate is Pareto-optimal if no other candidate dominates it
 * (better in ALL objectives).
 */
export function buildParetoFront(candidates: CandidateEvaluation[]): CandidateEvaluation[] {
  const feasible = candidates.filter((c) => c.feasible);
  const front: CandidateEvaluation[] = [];

  for (const c of feasible) {
    let dominated = false;
    for (const other of feasible) {
      if (other === c) continue;

      const objectives = Object.keys(c.objectives);
      let betterInAll = true;
      let strictlyBetter = false;

      for (const obj of objectives) {
        // Assuming higher is better for all objectives
        if ((other.objectives[obj] ?? 0) < (c.objectives[obj] ?? 0)) {
          betterInAll = false;
          break;
        }
        if ((other.objectives[obj] ?? 0) > (c.objectives[obj] ?? 0)) {
          strictlyBetter = true;
        }
      }

      if (betterInAll && strictlyBetter) {
        dominated = true;
        c.dominatedBy.push("candidate_" + feasible.indexOf(other));
        break;
      }
    }

    if (!dominated) {
      c.paretoRank = 0;
      front.push(c);
    }
  }

  return front;
}

// ── Full Grid Search ────────────────────────────────────────────────────────

/**
 * Run grid search with Pareto evaluation.
 *
 * @param ranges - Parameter ranges to search
 * @param evaluate - Function that takes parameters and returns objectives + constraints
 * @param samplingStrategy - 'lhs' | 'grid' | 'random'
 * @param nSamples - Number of samples (for LHS and random)
 * @param compositeWeights - Weights for composite ranking
 * @param seed - RNG seed
 * @returns Grid search result with Pareto front
 */
export function runGridSearch(
  ranges: ParameterRange[],
  evaluate: (params: Record<string, number>) => {
    objectives: Record<string, number>;
    constraints: Record<string, { value: number; satisfied: boolean; threshold: number }>;
  },
  samplingStrategy: "lhs" | "grid" | "random" = "lhs",
  nSamples = 50,
  compositeWeights?: Record<string, number>,
  seed = 42,
): GridSearchResult {
  // Generate samples
  let samples: Array<Record<string, number>>;
  switch (samplingStrategy) {
    case "grid":
      samples = gridSample(ranges);
      break;
    case "random":
      samples = randomSample(ranges, nSamples, seed);
      break;
    default:
      samples = latinHypercubeSample(ranges, nSamples, seed);
  }

  // Evaluate each sample
  const candidates: CandidateEvaluation[] = samples.map((params) => {
    const { objectives, constraints } = evaluate(params);

    const allConstraintsSatisfied = Object.values(constraints).every((c) => c.satisfied);

    return {
      parameters: params,
      objectives,
      constraints,
      feasible: allConstraintsSatisfied,
      paretoRank: -1,
      dominatedBy: [],
    };
  });

  // Build Pareto front
  const paretoFront = buildParetoFront(candidates);

  // Rank by composite score
  const objectiveNames = Object.keys(candidates[0]?.objectives ?? {});
  const weights =
    compositeWeights ?? Object.fromEntries(objectiveNames.map((name, i) => [name, 1 / objectiveNames.length]));

  // Normalize objectives to [0, 1]
  const ranges_: Record<string, { min: number; max: number }> = {};
  for (const obj of objectiveNames) {
    const values = candidates.filter((c) => c.feasible).map((c) => c.objectives[obj] ?? 0);
    ranges_[obj] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  for (const c of candidates) {
    let composite = 0;
    for (const obj of objectiveNames) {
      const range = ranges_[obj];
      const normalized = range.max > range.min ? ((c.objectives[obj] ?? 0) - range.min) / (range.max - range.min) : 0.5;
      composite += (weights[obj] ?? 0) * normalized;
    }
    (c as CandidateEvaluation & { composite?: number }).composite = composite;
  }

  // Find best by composite
  const feasibleCandidates = candidates.filter((c) => c.feasible);
  const bestByComposite =
    feasibleCandidates.length > 0
      ? feasibleCandidates.reduce((best, c) =>
          ((c as CandidateEvaluation & { composite?: number }).composite ?? 0) >
          ((best as CandidateEvaluation & { composite?: number }).composite ?? 0)
            ? c
            : best,
        )
      : candidates[0];

  const stats = {
    totalEvaluated: candidates.length,
    feasible: feasibleCandidates.length,
    infeasible: candidates.length - feasibleCandidates.length,
    paretoFrontSize: paretoFront.length,
  };

  const compositeFormula = objectiveNames.map((obj) => `${weights[obj]?.toFixed(2) ?? "?"}×${obj}`).join(" + ");

  return {
    candidates,
    paretoFront,
    bestByComposite,
    stats,
    compositeFormula: `composite = ${compositeFormula}`,
  };
}
