/**
 * Thompson Sampling Acquisition Function
 *
 * For each candidate, samples a value from N(mu, sigma²) and selects
 * the candidate with the highest sampled value.
 *
 * CPU-only, no external dependencies. Supports seeded RNG for reproducibility.
 *
 * Reference: Thompson (1933) Biometrika 25:285-294
 * Reference: Chapelle & Li (2011) Advances in Neural Information Processing Systems
 *
 * @scientific_provenance
 *   ALGORITHM: Thompson Sampling from Gaussian posterior
 */

import { type AcquisitionInput, BaseAcquisition, createRNG, normalSample } from "./base";

export class ThompsonSampling extends BaseAcquisition {
  name = "Thompson Sampling";

  private seed: number;

  constructor(seed: number = 42) {
    super();
    this.seed = seed;
  }

  score(input: AcquisitionInput): number[] {
    const rng = createRNG(input.seed ?? this.seed);

    return input.predictions.map((pred) => {
      if (pred.sigma <= 0) return pred.mu; // no uncertainty → return mean
      return pred.mu + normalSample(rng) * pred.sigma;
    });
  }
}

/**
 * Batch Thompson Sampling: sample multiple candidates without replacement.
 *
 * For batch BO: sample N candidates, then remove the selected one
 * and resample for the next slot.
 */
export function batchThompsonSampling(input: AcquisitionInput, batchSize: number, seed: number = 42): number[] {
  const ts = new ThompsonSampling(seed);
  const selected: number[] = [];
  const remaining = input.candidates.map((_, i) => i);

  for (let b = 0; b < batchSize && remaining.length > 0; b++) {
    const subset: AcquisitionInput = {
      ...input,
      candidates: remaining.map((i) => input.candidates[i]),
      predictions: remaining.map((i) => input.predictions[i]),
      seed: seed + b,
    };

    const scores = ts.score(subset);
    const bestIdx = scores.indexOf(Math.max(...scores));
    selected.push(input.candidates[remaining[bestIdx]].index);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}
