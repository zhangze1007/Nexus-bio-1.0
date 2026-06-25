/**
 * Constraint-Aware Acquisition Wrapper
 *
 * Wraps any acquisition function with constraint handling:
 *   - Hard constraints: infeasible candidates are eliminated
 *   - Soft constraints: scores are multiplied by feasibility probability
 *   - Multi-constraint: combined via product of probabilities
 *
 * Reference: Gardner et al. (2014) Advances in Neural Information Processing Systems
 * Reference: Gelbart et al. (2014) Uncertainty in Artificial Intelligence
 *
 * @scientific_provenance
 *   ALGORITHM: Constrained Expected Improvement (GP classification for feasibility)
 */

import { type AcquisitionFunction, type AcquisitionInput, type AcquisitionOutput, BaseAcquisition } from "./base";

export interface ConstraintConfig {
  /** Hard constraint: candidate must satisfy (eliminated if not) */
  hardConstraints?: Array<(features: number[]) => boolean>;
  /** Soft constraint: returns feasibility probability [0, 1] */
  softConstraints?: Array<(features: number[]) => number>;
  /** Pre-computed feasibility probabilities per candidate */
  precomputedFeasibility?: number[];
}

export class ConstrainedAcquisition extends BaseAcquisition {
  name: string;
  private inner: AcquisitionFunction;
  private config: ConstraintConfig;

  constructor(inner: AcquisitionFunction, config: ConstraintConfig) {
    super();
    this.inner = inner;
    this.config = config;
    this.name = `Constrained(${inner.name})`;
  }

  score(input: AcquisitionInput): number[] {
    // Get base scores from inner acquisition function
    const baseScores = this.inner.score(input);

    // Apply hard constraints: infeasible candidates get -Infinity
    let maskedScores = baseScores;
    if (this.config.hardConstraints && this.config.hardConstraints.length > 0) {
      maskedScores = baseScores.map((score, i) => {
        const features = input.candidates[i]?.features ?? [];
        const feasible = this.config.hardConstraints!.every((c) => c(features));
        return feasible ? score : -Infinity;
      });
    }

    // Apply soft constraints: multiply by feasibility probability
    if (this.config.softConstraints && this.config.softConstraints.length > 0) {
      maskedScores = maskedScores.map((score, i) => {
        if (score === -Infinity) return score;
        const features = input.candidates[i]?.features ?? [];
        const feasibility = this.config.softConstraints!.reduce((prod, c) => prod * c(features), 1.0);
        return score * feasibility;
      });
    }

    // Apply precomputed feasibility
    if (this.config.precomputedFeasibility) {
      maskedScores = maskedScores.map((score, i) => {
        if (score === -Infinity) return score;
        return score * (this.config.precomputedFeasibility![i] ?? 1);
      });
    }

    return maskedScores;
  }

  // Override select to not apply input.hardMask/feasibility (already applied in score)
  select(input: AcquisitionInput, topK: number = 1) {
    const scores = this.score(input);

    const ranked = scores
      .map((score, index) => ({ index: input.candidates[index].index, score }))
      .sort((a, b) => b.score - a.score);

    const topKIndices = ranked.slice(0, topK).map((r) => r.index);

    return { ranked, topK: topKIndices };
  }
}

/**
 * Create a constrained version of any acquisition function.
 */
export function withConstraints(inner: AcquisitionFunction, config: ConstraintConfig): ConstrainedAcquisition {
  return new ConstrainedAcquisition(inner, config);
}
