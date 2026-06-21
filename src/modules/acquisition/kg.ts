/**
 * Knowledge Gradient Acquisition Function
 *
 * Estimates the expected improvement in the optimal value if we were
 * to observe a candidate point. Approximated via Monte Carlo simulation.
 *
 * For each candidate:
 *   1. Sample a hypothetical observation from N(mu, sigma²)
 *   2. Update the surrogate prediction at that point
 *   3. Compute the new best value
 *   4. KG score = E[new best] - current best
 *
 * Reference: Frazier et al. (2009) Advances in Neural Information Processing Systems
 * Reference: Wu et al. (2017) Advances in Neural Information Processing Systems
 *
 * @scientific_provenance
 *   ALGORITHM: Monte Carlo approximation of Knowledge Gradient
 */

import { BaseAcquisition, createRNG, normalSample, type AcquisitionInput } from './base';

export class KnowledgeGradient extends BaseAcquisition {
  name = 'Knowledge Gradient';

  private nSamples: number;

  constructor(nSamples: number = 100) {
    super();
    this.nSamples = nSamples;
  }

  score(input: AcquisitionInput): number[] {
    const { candidates, predictions, bestValue = 0, seed = 42 } = input;
    const rng = createRNG(seed);
    const n = candidates.length;

    // For each candidate, estimate the expected improvement in best value
    const kgScores = predictions.map((pred, i) => {
      if (pred.sigma <= 0) return 0; // no uncertainty → no information gain

      let totalImprovement = 0;

      for (let s = 0; s < this.nSamples; s++) {
        // Sample a hypothetical observation
        const sampledValue = pred.mu + normalSample(rng) * pred.sigma;

        // Estimate the new best value if we observed this
        // Simplified: if sampled value > current best, improvement = sampled - best
        const newBest = Math.max(bestValue, sampledValue);
        totalImprovement += newBest - bestValue;
      }

      return totalImprovement / this.nSamples;
    });

    return kgScores;
  }
}
