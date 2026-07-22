/**
 * Acquisition functions over a GP posterior (mean, sd) for active learning.
 * Both are for MAXIMIZATION. Pure and deterministic (no randomness).
 */

function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Standard-normal CDF via the Abramowitz & Stegun 7.1.26 rational approximation. */
function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp((-absX * absX) / 2);
  return 0.5 * (1 + sign * y);
}

/**
 * Expected Improvement: EI(x) = (μ − best − ξ)·Φ(Z) + σ·φ(Z), Z = (μ − best − ξ)/σ.
 * Explores under-sampled high-uncertainty regions; ξ tunes exploration.
 */
export function expectedImprovement(mean: number, sd: number, best: number, xi = 0.01): number {
  if (sd <= 1e-12) return 0;
  const imp = mean - best - xi;
  const z = imp / sd;
  return Math.max(imp * normalCdf(z) + sd * normalPdf(z), 0);
}

/** Upper Confidence Bound: μ + κ·σ. Higher κ favors exploration. */
export function upperConfidenceBound(mean: number, sd: number, kappa = 2): number {
  return mean + kappa * sd;
}
