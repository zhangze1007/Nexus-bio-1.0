/**
 * Spearman rank correlation.
 *
 * Spearman's ρ is the Pearson correlation of the *ranks* of the two variables.
 * Tied values receive the average of the ranks they span (the "average" method
 * used by scipy.stats.rankdata / spearmanr), so this matches
 * scipy.stats.spearmanr exactly for both untied and tied inputs.
 */

/**
 * 1-indexed average ranks of `values`. Tied values (exactly equal) share the
 * mean of the positions they occupy, e.g. two values tied for positions 2 and 3
 * each get rank 2.5.
 */
export function averageRanks(values: number[]): number[] {
  const n = values.length;
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n).fill(0);
  let k = 0;
  while (k < n) {
    let j = k;
    while (j + 1 < n && order[j + 1].v === order[k].v) j++;
    // Positions k..j (0-indexed) ↔ ranks (k+1)..(j+1) (1-indexed); use their mean.
    const avg = (k + 1 + (j + 1)) / 2;
    for (let t = k; t <= j; t++) ranks[order[t].i] = avg;
    k = j + 1;
  }
  return ranks;
}

/** Pearson product-moment correlation coefficient of two equal-length vectors. */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || y.length !== n) return Number.NaN;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  const denom = Math.sqrt(vx * vy);
  return denom === 0 ? Number.NaN : cov / denom;
}

/**
 * Spearman rank correlation coefficient of `x` and `y` (average-rank ties).
 * Returns NaN for mismatched or empty inputs.
 */
export function spearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return Number.NaN;
  return pearsonCorrelation(averageRanks(x), averageRanks(y));
}
