/**
 * Conjugate Gaussian belief update — replaces the old single-point overwrite of
 * learned seeds with an accumulative posterior. Repeated consistent evidence
 * moves the mean monotonically toward the observation and shrinks the variance
 * (it accumulates instead of jumping back and forth).
 */

export interface Belief {
  mean: number;
  variance: number;
}

/** Prior Belief + observation(value, variance) → posterior Belief. */
export function updateBelief(prior: Belief, obs: { value: number; variance: number }): Belief {
  const denom = prior.variance + obs.variance;
  if (!(denom > 0)) return { mean: prior.mean, variance: prior.variance };
  const k = prior.variance / denom;
  return {
    mean: prior.mean + k * (obs.value - prior.mean),
    variance: (1 - k) * prior.variance,
  };
}

/** Fold a sequence of observations into a prior (each posterior becomes the next prior). */
export function updateBeliefSequence(prior: Belief, observations: Array<{ value: number; variance: number }>): Belief {
  return observations.reduce((belief, obs) => updateBelief(belief, obs), prior);
}
