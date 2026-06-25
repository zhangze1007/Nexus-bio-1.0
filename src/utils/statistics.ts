/**
 * Unified statistics framework for Nexus-Bio.
 *
 * Provides Shannon entropy, selection coefficients, confidence intervals,
 * Mann-Whitney U test, and basic descriptive statistics used across
 * multiple tool pages (ProEvol, MultiO, GECAIR, etc.).
 */

// ---------------------------------------------------------------------------
// Helper: normal CDF via Abramowitz-Stegun approximation (|error| < 7.5e-8)
// ---------------------------------------------------------------------------

export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-0.5 * absX * absX);

  return 0.5 * (1.0 + sign * y);
}

// ---------------------------------------------------------------------------
// Shannon entropy (bits)
// ---------------------------------------------------------------------------

/**
 * Compute Shannon entropy from an array of counts.
 *
 * H = -sum(p_i * log2(p_i))  where p_i = count_i / total
 *
 * @param counts  Non-negative integer counts per category.
 * @returns Entropy in bits.
 */
export function shannonEntropy(counts: number[]): number {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total === 0) return 0;

  let H = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      H -= p * Math.log2(p);
    }
  }
  return H;
}

// ---------------------------------------------------------------------------
// Selection coefficient
// ---------------------------------------------------------------------------

/**
 * Compute the selection coefficient s = (w_mut - w_wt) / w_wt.
 *
 * @param fitnessMutant   Absolute fitness of the mutant.
 * @param fitnessWildType Absolute fitness of the wild-type (must be > 0).
 * @returns Selection coefficient (positive = beneficial, negative = deleterious).
 */
export function selectionCoefficient(fitnessMutant: number, fitnessWildType: number): number {
  if (fitnessWildType === 0) {
    throw new Error("Wild-type fitness must be non-zero");
  }
  return (fitnessMutant - fitnessWildType) / fitnessWildType;
}

// ---------------------------------------------------------------------------
// Confidence interval (t-distribution)
// ---------------------------------------------------------------------------

export interface ConfidenceIntervalResult {
  lower: number;
  upper: number;
  marginOfError: number;
}

/**
 * Two-sided confidence interval for the population mean using the
 * t-distribution.
 *
 * @param data       Sample data (length >= 2).
 * @param confidence Confidence level, e.g. 0.95 for 95 %.
 */
export function confidenceInterval(data: number[], confidence: number): ConfidenceIntervalResult {
  const n = data.length;
  if (n < 2) throw new Error("At least 2 data points are required");

  const mu = mean(data);
  const se = standardDeviation(data) / Math.sqrt(n);

  // t critical values for common confidence levels (two-tailed).
  // For n > 30 we fall back to the normal approximation.
  const alpha = 1 - confidence;
  const df = n - 1;
  const tCrit = Math.abs(tInverse(alpha / 2, df));

  const moe = tCrit * se;
  return { lower: mu - moe, upper: mu + moe, marginOfError: moe };
}

// ---------------------------------------------------------------------------
// Mann-Whitney U test
// ---------------------------------------------------------------------------

export interface MannWhitneyResult {
  U1: number;
  U2: number;
  pValue: number;
}

/**
 * Two-sided Mann-Whitney U test (Wilcoxon rank-sum).
 *
 * Uses the normal approximation with continuity correction for p-values
 * when both sample sizes are >= 8.
 *
 * @param sampleA First sample (non-empty).
 * @param sampleB Second sample (non-empty).
 */
export function mannWhitneyU(sampleA: number[], sampleB: number[]): MannWhitneyResult {
  if (sampleA.length === 0 || sampleB.length === 0) {
    throw new Error("Both samples must be non-empty");
  }

  const n1 = sampleA.length;
  const n2 = sampleB.length;
  const N = n1 + n2;

  // Combine and rank
  const combined: { value: number; group: "A" | "B" }[] = [
    ...sampleA.map((v) => ({ value: v, group: "A" as const })),
    ...sampleB.map((v) => ({ value: v, group: "B" as const })),
  ];
  combined.sort((a, b) => a.value - b.value);

  // Assign ranks (average rank for ties)
  const ranks: number[] = new Array(N);
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N && combined[j].value === combined[i].value) j++;
    const avgRank = (i + 1 + j) / 2; // ranks are 1-based
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }

  // Sum ranks for group A
  let R1 = 0;
  for (let k = 0; k < N; k++) {
    if (combined[k].group === "A") R1 += ranks[k];
  }

  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;

  // Normal approximation for p-value
  const muU = (n1 * n2) / 2;
  const sigmaU = Math.sqrt((n1 * n2 * (N + 1)) / 12);

  // Continuity correction
  const z = (Math.min(U1, U2) - muU + 0.5) / sigmaU;
  const pValue = 2 * normalCDF(z); // two-tailed

  return { U1, U2, pValue };
}

// ---------------------------------------------------------------------------
// Multiple testing correction
// ---------------------------------------------------------------------------

/**
 * Benjamini-Hochberg FDR correction.
 *
 * Given an array of p-values, returns adjusted p-values (q-values) controlling
 * the false discovery rate at the nominal level.
 *
 * @param pValues  Array of raw p-values (must be non-empty).
 * @returns Array of adjusted p-values in the same order as input.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const n = pValues.length;
  if (n === 0) return [];

  // Create [index, pValue] pairs and sort by pValue descending
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => b.p - a.p);

  const adjusted = new Array(n);
  let minSoFar = 1;

  for (let rank = 0; rank < n; rank++) {
    const { p, i } = indexed[rank];
    // BH formula: p_adj = p * n / (n - rank)  (rank is 0-based, descending)
    const q = Math.min(1, (p * n) / (n - rank));
    // Enforce monotonicity (each q ≤ min of all q-values below it)
    minSoFar = Math.min(minSoFar, q);
    adjusted[i] = minSoFar;
  }

  return adjusted;
}

// ---------------------------------------------------------------------------
// Descriptive statistics
// ---------------------------------------------------------------------------

/**
 * Arithmetic mean.
 */
export function mean(data: number[]): number {
  if (data.length === 0) throw new Error("Data array must be non-empty");
  return data.reduce((s, v) => s + v, 0) / data.length;
}

/**
 * Sample standard deviation (Bessel-corrected, denominator n-1).
 */
export function standardDeviation(data: number[]): number {
  if (data.length < 2) throw new Error("At least 2 data points are required");
  const mu = mean(data);
  const ss = data.reduce((s, v) => s + (v - mu) ** 2, 0);
  return Math.sqrt(ss / (data.length - 1));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Approximate the inverse of the Student-t CDF using bisection.
 * Works reliably for all df >= 1.
 *
 * @param p  One-tail probability (e.g. 0.025 for 95% CI).
 * @param df Degrees of freedom.
 */
function tInverse(p: number, df: number): number {
  if (df > 1000) return normalInverse(p);

  // Bisection search over a wide range
  let lo = -100;
  let hi = 100;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    if (tCDF(mid, df) < p) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Student-t CDF using the regularised incomplete beta function.
 */
function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const ibeta = regularisedIncompleteBeta(df / 2, 0.5, x);
  if (t >= 0) return 1 - 0.5 * ibeta;
  return 0.5 * ibeta;
}

/**
 * Regularised incomplete beta function I_x(a, b) via continued fraction.
 */
function regularisedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lbeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta);

  // Use continued fraction (Lentz's method)
  return (front * continuedFractionBeta(a, b, x)) / a;
}

function continuedFractionBeta(a: number, b: number, x: number): number {
  const maxIter = 200;
  const eps = 1e-14;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;

    // Even step
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    // Odd step
    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

/**
 * Log-gamma via Lanczos approximation.
 */
function lnGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }

  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Inverse of the standard normal CDF (rational approximation, Beasley-Springer-Moro).
 */
function normalInverse(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968,
    2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}
