import { SeededRNG } from "../../utils/seededRng";

export interface EnsembleSample {
  timeHours: number;
  value: number;
}

export interface Interval {
  value: number;
  lower: number;
  upper: number;
  intervalLevel: number;
}

/** Linear-interpolated quantile of an ascending-sorted numeric array. */
function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return Number.NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const clamped = Math.min(1, Math.max(0, q));
  const pos = clamped * (sortedAsc.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const frac = pos - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

/**
 * 由多次带扰动/多种子仿真的样本，按分位数得到预测区间。
 * `samples` are the ensemble values at ONE timepoint (their .value is used).
 */
export function intervalFromEnsemble(samples: EnsembleSample[], level = 0.9): Interval {
  const lvl = Math.min(0.9999, Math.max(0, level));
  const values = samples.map((s) => s.value).sort((a, b) => a - b);
  const alpha = (1 - lvl) / 2;
  return {
    value: quantile(values, 0.5),
    lower: quantile(values, alpha),
    upper: quantile(values, 1 - alpha),
    intervalLevel: lvl,
  };
}

// Two-sided z-scores for common confidence levels (fallback: 90%).
const Z_BY_LEVEL: Record<string, number> = {
  "0.5": 0.6745,
  "0.8": 1.2816,
  "0.9": 1.6449,
  "0.95": 1.96,
  "0.99": 2.5758,
};
function zForLevel(level: number): number {
  return Z_BY_LEVEL[level.toFixed(2)] ?? Z_BY_LEVEL[String(level)] ?? 1.6449;
}

/** Analytic (normal-approximation) interval from a point estimate and its std. */
export function analyticInterval(value: number, std: number, level = 0.9): Interval {
  const z = zForLevel(level);
  const half = z * Math.abs(std);
  return { value, lower: value - half, upper: value + half, intervalLevel: level };
}

/**
 * Seeded Monte-Carlo ensemble: perturbs each series point by a multiplicative
 * Gaussian of relative std `relStd`. Deterministic for a fixed `seed` (uses
 * SeededRNG — no unseeded Math.random). Values are clamped to be non-negative.
 * Returns `draws × series.length` samples tagged by timeHours.
 */
export function monteCarloEnsemble(
  series: { timeHours: number; value: number }[],
  relStd: number,
  seed: number,
  draws = 200,
): EnsembleSample[] {
  const rng = new SeededRNG(seed);
  const out: EnsembleSample[] = [];
  for (let d = 0; d < draws; d++) {
    for (const pt of series) {
      const perturbed = pt.value * (1 + relStd * rng.gaussian());
      out.push({ timeHours: pt.timeHours, value: Math.max(0, perturbed) });
    }
  }
  return out;
}
