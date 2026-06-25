/**
 * Metropolis-Hastings MCMC sampler for kinetic parameter calibration.
 *
 * Fits model parameters to experimental time-series data by sampling from
 * the posterior distribution. Uses Gaussian proposals with reflecting
 * boundaries enforced by the prior ranges. Includes a grid-search plus
 * hill-climbing warm-up to find a good starting point before sampling.
 *
 * @scientific_provenance
 *   ALGORITHM: Metropolis-Hastings MCMC with Gaussian random-walk proposals,
 *     reflecting boundary enforcement, and uniform priors. Uses xoshiro128**
 *     PRNG with Box-Muller normal variates. Warm-up via coarse grid search
 *     (first 2 parameters) plus iterative hill-climbing refinement. Posterior
 *     statistics include mean, std, and 95% credible intervals.
 *   REFERENCE: Metropolis N, Rosenbluth AW, Rosenbluth MN, Teller AH,
 *     Teller E. "Equation of State Calculations by Fast Computing Machines."
 *     J Chem Phys. 1953;21(6):1087-1092. Hastings WK. "Monte Carlo sampling
 *     methods using Markov chains and their applications." Biometrika.
 *     1970;57(1):97-109.
 *   KNOWN_LIMITATIONS:
 *     - Proposal standard deviation defaults to 10% of prior range; may be
 *       suboptimal for highly correlated posteriors or multi-modal landscapes.
 *     - Grid search is limited to first 2 parameters; higher-dimensional
 *       problems may start from poor initial points.
 *     - Convergence check (posterior std < 30% of prior range) is heuristic
 *       and does not replace formal diagnostics like R-hat or effective
 *       sample size.
 *     - Reflecting boundaries can cause artifacts near constraint edges;
 *       truncated proposals would be more principled.
 */

// ── public interfaces ───────────────────────────────────────────────────────

export interface CalibrationData {
  /** Observation time-points (ascending). */
  timepoints: number[];
  /** Variable name → observed values at each timepoint. */
  observations: Record<string, number[]>;
}

export interface CalibrationConfig {
  /** Total number of MCMC iterations (including burn-in). */
  nSamples: number;
  /** Number of initial samples to discard as burn-in. */
  burnIn: number;
  /** Parameter name → [min, max] uniform prior bounds. */
  priorRanges: Record<string, [number, number]>;
  /** Parameter name → Gaussian proposal std.  Defaults to 1 % of prior range. */
  proposalStd?: Record<string, number>;
  /** Observation noise σ² used in the Gaussian likelihood.  Defaults to 1. */
  noiseVariance?: number;
}

export interface CalibrationResult {
  /** Posterior mean for each parameter. */
  posteriorMean: Record<string, number>;
  /** Posterior standard deviation for each parameter. */
  posteriorStd: Record<string, number>;
  /** 95 % credible interval [2.5th, 97.5th percentile] for each parameter. */
  credibleInterval: Record<string, [number, number]>;
  /** All post-burn-in samples for each parameter. */
  samples: Record<string, number[]>;
  /** Fraction of proposals accepted (burn-in excluded). */
  acceptanceRate: boolean | number;
  /** True when every posterior std is below 30 % of its prior range width. */
  converged: boolean;
}

// ── PRNG (xoshiro128**) ─────────────────────────────────────────────────────

/** Deterministic PRNG so results are reproducible across runs. */
function makeRng(seed = 42) {
  let s0 = seed >>> 0;
  let s1 = (seed * 1664525 + 1013904223) >>> 0;
  let s2 = (s1 * 1664525 + 1013904223) >>> 0;
  let s3 = (s2 * 1664525 + 1013904223) >>> 0;

  function rotl(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }

  /** Returns a uniform float in [0, 1). */
  function next(): number {
    const result = (rotl((s1 * 5) >>> 0, 7) * 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result / 0x100000000;
  }

  return { next };
}

// ── Box-Muller transform ────────────────────────────────────────────────────

/** Generate a standard normal variate using Box-Muller with a cached second. */
function makeNormalRng(rng: { next: () => number }) {
  let spare: number | null = null;

  return function randn(): number {
    if (spare !== null) {
      const val = spare;
      spare = null;
      return val;
    }
    let u: number, v: number, s: number;
    do {
      u = 2 * rng.next() - 1;
      v = 2 * rng.next() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return u * mul;
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function std(arr: number[], mu: number): number {
  let ss = 0;
  for (let i = 0; i < arr.length; i++) ss += (arr[i] - mu) * (arr[i] - mu);
  return Math.sqrt(ss / arr.length);
}

/** Clamp a value into [lo, hi]. */
function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Reflect x into [lo, hi] — avoids hard-edge rejection. */
function reflect(x: number, lo: number, hi: number): number {
  const range = hi - lo;
  if (range <= 0) return lo;
  let y = x - lo;
  // Reflect until inside [0, range)
  // Handle negative and large positive values
  y = y % (2 * range);
  if (y < 0) y += 2 * range;
  if (y > range) y = 2 * range - y;
  return y + lo;
}

/** Compute the p-th percentile of a sorted array. */
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── core sampler ────────────────────────────────────────────────────────────

export function calibrateParameters(
  data: CalibrationData,
  config: CalibrationConfig,
  modelFn: (params: Record<string, number>) => Record<string, number[]>,
): CalibrationResult {
  const { nSamples, burnIn, priorRanges, noiseVariance = 1.0 } = config;

  const paramNames = Object.keys(priorRanges);
  const nParams = paramNames.length;
  const rng = makeRng(42);
  const randn = makeNormalRng(rng);

  // Default proposal std: 10 % of prior range width (tuned for ~20-60 % acceptance)
  const proposalStdMap: Record<string, number> = {};
  for (const p of paramNames) {
    const [lo, hi] = priorRanges[p];
    proposalStdMap[p] = config.proposalStd?.[p] ?? (hi - lo) * 0.1;
  }

  // ── log-likelihood (Gaussian, independent observations) ────────────────
  function logLikelihood(params: Record<string, number>): number {
    const predictions = modelFn(params);
    let ll = 0;
    for (const varName of Object.keys(data.observations)) {
      const obs = data.observations[varName];
      const pred = predictions[varName];
      if (!pred) continue;
      for (let i = 0; i < obs.length; i++) {
        const residual = obs[i] - pred[i];
        ll -= (residual * residual) / (2 * noiseVariance);
      }
    }
    return ll;
  }

  // ── log-prior (uniform — 0 inside bounds, -Infinity outside) ───────────
  function logPrior(params: Record<string, number>): number {
    for (const p of paramNames) {
      const [lo, hi] = priorRanges[p];
      if (params[p] < lo || params[p] > hi) return -Infinity;
    }
    return 0;
  }

  // ── grid-search + hill-climbing warm-up for a better starting point ─────
  // Coarse grid over prior ranges to find a good initial candidate.
  const gridSteps = 6;
  let bestScore = -Infinity;
  const current: Record<string, number> = {};

  // Generate grid coordinates
  const grids: Record<string, number[]> = {};
  for (const p of paramNames) {
    const [lo, hi] = priorRanges[p];
    grids[p] = [];
    for (let i = 0; i < gridSteps; i++) {
      grids[p].push(lo + ((hi - lo) * i) / (gridSteps - 1));
    }
  }

  // Iterative grid: try all combos for first 2 params, keep others at midpoints
  function searchGrid(depth: number, partial: Record<string, number>) {
    if (depth === paramNames.length || depth >= 2) {
      // Fill remaining params at midpoints
      const trial: Record<string, number> = { ...partial };
      for (let i = depth; i < paramNames.length; i++) {
        const p = paramNames[i];
        const [lo, hi] = priorRanges[p];
        trial[p] = (lo + hi) / 2;
      }
      const ll = logLikelihood(trial);
      if (ll > bestScore) {
        bestScore = ll;
        for (const p of paramNames) current[p] = trial[p];
      }
      return;
    }
    const p = paramNames[depth];
    for (const v of grids[p]) {
      searchGrid(depth + 1, { ...partial, [p]: v });
    }
  }
  searchGrid(0, {});

  // Hill-climbing refinement (100 iterations per param)
  for (let round = 0; round < 100; round++) {
    let improved = false;
    for (const p of paramNames) {
      const [lo, hi] = priorRanges[p];
      const step = (hi - lo) * 0.02;
      for (const delta of [-step, step]) {
        const trial: Record<string, number> = { ...current, [p]: reflect(current[p] + delta, lo, hi) };
        const ll = logLikelihood(trial);
        if (ll > bestScore) {
          bestScore = ll;
          current[p] = trial[p];
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  let currentLL = logLikelihood(current);
  let currentLP = logPrior(current);

  // ── sampling loop ─────────────────────────────────────────────────────
  const allSamples: Record<string, number[]> = {};
  for (const p of paramNames) allSamples[p] = [];

  let accepts = 0;
  let postBurnInTrials = 0;

  for (let iter = 0; iter < nSamples; iter++) {
    // Propose new parameters
    const proposed: Record<string, number> = {};
    for (const p of paramNames) {
      proposed[p] = reflect(current[p] + randn() * proposalStdMap[p], priorRanges[p][0], priorRanges[p][1]);
    }

    // Evaluate proposed state
    const proposedLP = logPrior(proposed);
    let proposedLL: number;
    if (proposedLP === -Infinity) {
      proposedLL = -Infinity;
    } else {
      proposedLL = logLikelihood(proposed);
    }

    // Metropolis acceptance ratio (log scale)
    const logAlpha = proposedLL + proposedLP - currentLL - currentLP;
    const accepted = logAlpha >= 0 || Math.log(rng.next()) < logAlpha;

    if (accepted) {
      for (const p of paramNames) current[p] = proposed[p];
      currentLL = proposedLL;
      currentLP = proposedLP;
    }

    // Record post-burn-in samples
    if (iter >= burnIn) {
      for (const p of paramNames) allSamples[p].push(current[p]);
      postBurnInTrials++;
      if (accepted) accepts++;
    }
  }

  // ── posterior statistics ───────────────────────────────────────────────
  const posteriorMean: Record<string, number> = {};
  const posteriorStd: Record<string, number> = {};
  const credibleInterval: Record<string, [number, number]> = {};

  for (const p of paramNames) {
    const samples = allSamples[p];
    const mu = mean(samples);
    const sigma = std(samples, mu);
    posteriorMean[p] = mu;
    posteriorStd[p] = sigma;

    const sorted = [...samples].sort((a, b) => a - b);
    credibleInterval[p] = [percentile(sorted, 2.5), percentile(sorted, 97.5)];
  }

  // ── convergence check: posterior std < 30 % of prior range width ───────
  let converged = true;
  for (const p of paramNames) {
    const [lo, hi] = priorRanges[p];
    if (posteriorStd[p] > 0.3 * (hi - lo)) {
      converged = false;
      break;
    }
  }

  return {
    posteriorMean,
    posteriorStd,
    credibleInterval,
    samples: allSamples,
    acceptanceRate: postBurnInTrials > 0 ? accepts / postBurnInTrials : 0,
    converged,
  };
}
