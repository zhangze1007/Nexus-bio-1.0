/**
 * Acquisition Function Base Interface
 *
 * All acquisition functions implement this interface for consistent
 * integration with the Bayesian optimization loop.
 *
 * Reference: Shahriari et al. (2016) Proc IEEE 104:148-175
 */

export interface CandidatePoint {
  /** Candidate index in the original array */
  index: number;
  /** Feature vector */
  features: number[];
}

export interface SurrogatePrediction {
  /** Predicted mean */
  mu: number;
  /** Predicted standard deviation */
  sigma: number;
}

export interface MultiObjectivePrediction {
  /** Per-objective predictions */
  objectives: SurrogatePrediction[];
}

export interface AcquisitionInput {
  /** Candidate points */
  candidates: CandidatePoint[];
  /** Surrogate predictions for each candidate */
  predictions: SurrogatePrediction[];
  /** Multi-objective predictions (optional, for EHVI) */
  multiObjectivePredictions?: MultiObjectivePrediction[];
  /** Current best observed value */
  bestValue?: number;
  /** Current Pareto front (for multi-objective) */
  paretoFront?: number[][];
  /** Reference point for hypervolume computation */
  referencePoint?: number[];
  /** Constraint feasibility probabilities (0-1) per candidate */
  feasibility?: number[];
  /** Hard constraint mask: true = feasible */
  hardMask?: boolean[];
  /** Random seed for reproducibility */
  seed?: number;
}

export interface AcquisitionOutput {
  /** Scored candidates sorted by acquisition value (descending) */
  ranked: Array<{
    index: number;
    score: number;
  }>;
  /** Top-k recommended candidates */
  topK: number[];
}

/**
 * Unified acquisition function interface.
 */
export interface AcquisitionFunction {
  /** Name of the acquisition function */
  name: string;
  /** Score all candidates */
  score(input: AcquisitionInput): number[];
  /** Rank candidates and return top-k */
  select(input: AcquisitionInput, topK?: number): AcquisitionOutput;
}

/**
 * Base class with shared utilities.
 */
export abstract class BaseAcquisition implements AcquisitionFunction {
  abstract name: string;

  abstract score(input: AcquisitionInput): number[];

  select(input: AcquisitionInput, topK: number = 1): AcquisitionOutput {
    const scores = this.score(input);

    // Apply hard constraints
    let maskedScores = scores;
    if (input.hardMask) {
      maskedScores = scores.map((s, i) => input.hardMask![i] ? s : -Infinity);
    }

    // Apply soft constraints (feasibility)
    if (input.feasibility) {
      maskedScores = maskedScores.map((s, i) => s * (input.feasibility![i] ?? 1));
    }

    // Rank by score (descending)
    const ranked = maskedScores
      .map((score, index) => ({ index: input.candidates[index].index, score }))
      .sort((a, b) => b.score - a.score);

    const topKIndices = ranked.slice(0, topK).map(r => r.index);

    return { ranked, topK: topKIndices };
  }
}

/**
 * Create a seeded pseudo-random number generator (mulberry32).
 * Returns a function that produces numbers in [0, 1).
 */
export function createRNG(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform for generating normal random numbers.
 */
export function normalSample(rng: () => number): number {
  const u1 = rng() || 1e-10;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
