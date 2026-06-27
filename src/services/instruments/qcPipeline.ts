/**
 * Instrument Data Quality Control Pipeline
 *
 * Pure-TypeScript utilities for validating, normalizing, and cleaning
 * numerical instrument data before downstream analysis.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QCOptions {
  /** Flag data as failed if more than this fraction of points are outliers (0-1). Default: 0.1 */
  outlierThreshold?: number;
  /** Minimum acceptable coefficient of variation (std / mean). Default: 0 (no check) */
  minCV?: number;
  /** Maximum acceptable coefficient of variation. Default: Infinity (no check) */
  maxCV?: number;
  /** Allowed range -- flag if any value falls outside [allowedMin, allowedMax] */
  allowedRange?: { min: number; max: number };
  /** Expected number of data points -- flag if length mismatches */
  expectedLength?: number;
  /** Outlier detection method. Default: 'iqr' */
  outlierMethod?: 'zscore' | 'iqr';
  /** Z-score threshold when outlierMethod is 'zscore'. Default: 3 */
  zThreshold?: number;
}

export interface QCFlag {
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  indices: number[];
}

export interface QCStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
}

export interface QCResult {
  passed: boolean;
  flags: QCFlag[];
  stats: QCStats;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((s, v) => s + v, 0) / data.length;
}

function median(data: number[]): number {
  if (data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function std(data: number[], mu: number): number {
  if (data.length < 2) return 0;
  const variance =
    data.reduce((s, v) => s + (v - mu) ** 2, 0) / (data.length - 1);
  return Math.sqrt(variance);
}

/* ------------------------------------------------------------------ */
/*  Core functions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Compute descriptive statistics for a numeric array.
 */
function computeStats(data: number[]): QCStats {
  const m = mean(data);
  return {
    mean: m,
    std: std(data, m),
    min: data.length > 0 ? Math.min(...data) : 0,
    max: data.length > 0 ? Math.max(...data) : 0,
    median: median(data),
  };
}

/**
 * Detect outlier indices using the Z-score or IQR method.
 *
 * @param data   Numeric observations.
 * @param method 'zscore' (|z| > threshold) or 'iqr' (1.5 * IQR rule).
 * @param zThreshold  Z-score cutoff when method is 'zscore'. Default 3.
 * @returns Array of indices flagged as outliers.
 */
export function detectOutliers(
  data: number[],
  method: 'zscore' | 'iqr' = 'iqr',
  zThreshold = 3,
): number[] {
  if (data.length === 0) return [];

  if (method === 'zscore') {
    const mu = mean(data);
    const sigma = std(data, mu);
    if (sigma === 0) return [];
    const indices: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (Math.abs((data[i] - mu) / sigma) > zThreshold) {
        indices.push(i);
      }
    }
    return indices;
  }

  // IQR method
  const sorted = [...data].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const indices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] < lower || data[i] > upper) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Normalize a numeric array.
 *
 * @param data   Raw observations.
 * @param method 'minmax' -> [0,1], 'zscore' -> zero-mean unit-variance,
 *               'robust' -> median / IQR scaling.
 * @returns Normalized array (same length).
 */
export function normalizeData(
  data: number[],
  method: 'minmax' | 'zscore' | 'robust',
): number[] {
  if (data.length === 0) return [];

  if (method === 'minmax') {
    const lo = Math.min(...data);
    const hi = Math.max(...data);
    const range = hi - lo;
    if (range === 0) return data.map(() => 0);
    return data.map((v) => (v - lo) / range);
  }

  if (method === 'zscore') {
    const mu = mean(data);
    const sigma = std(data, mu);
    if (sigma === 0) return data.map(() => 0);
    return data.map((v) => (v - mu) / sigma);
  }

  // Robust scaling: (x - median) / IQR
  const sorted = [...data].sort((a, b) => a - b);
  const med = median(data);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return data.map(() => 0);
  return data.map((v) => (v - med) / iqr);
}

/**
 * Run the full QC pipeline on instrument data.
 *
 * Checks performed:
 * 1. Empty / too-short data
 * 2. NaN / Infinity contamination
 * 3. Length mismatch (if expectedLength provided)
 * 4. Outlier fraction exceeding threshold
 * 5. Coefficient of variation outside bounds
 * 6. Values outside allowed range
 *
 * @param data    Raw numeric observations from an instrument.
 * @param options Optional QC thresholds and method overrides.
 * @returns QCResult with pass/fail, flags, and descriptive statistics.
 */
export function runQC(data: number[], options?: QCOptions): QCResult {
  const opts: Required<QCOptions> = {
    outlierThreshold: 0.1,
    minCV: 0,
    maxCV: Infinity,
    allowedRange: { min: -Infinity, max: Infinity },
    expectedLength: 0,
    outlierMethod: 'iqr',
    zThreshold: 3,
    ...options,
  };

  const flags: QCFlag[] = [];

  // --- Compute stats early (works even on degenerate input) ---
  const stats = computeStats(data);

  // 1. Empty data
  if (data.length === 0) {
    flags.push({
      type: 'empty_data',
      severity: 'error',
      message: 'Data array is empty.',
      indices: [],
    });
    return { passed: false, flags, stats };
  }

  // 2. Non-finite values
  const nonFiniteIndices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (!Number.isFinite(data[i])) {
      nonFiniteIndices.push(i);
    }
  }
  if (nonFiniteIndices.length > 0) {
    flags.push({
      type: 'non_finite',
      severity: 'error',
      message: `Found ${nonFiniteIndices.length} non-finite value(s) (NaN/Infinity).`,
      indices: nonFiniteIndices,
    });
  }

  // 3. Length mismatch
  if (opts.expectedLength > 0 && data.length !== opts.expectedLength) {
    flags.push({
      type: 'length_mismatch',
      severity: 'warning',
      message: `Expected ${opts.expectedLength} points but received ${data.length}.`,
      indices: [],
    });
  }

  // Work with finite-only subset for statistical checks
  const finiteData = data.filter(Number.isFinite);

  if (finiteData.length >= 2) {
    // 4. Outlier detection
    const outlierIdx = detectOutliers(
      finiteData,
      opts.outlierMethod,
      opts.zThreshold,
    );
    // Map back to original indices
    const finiteToOrig = new Map<number, number>();
    let fi = 0;
    for (let i = 0; i < data.length; i++) {
      if (Number.isFinite(data[i])) {
        finiteToOrig.set(fi, i);
        fi++;
      }
    }
    const outlierOrigIdx = outlierIdx.map((i) => finiteToOrig.get(i)!);

    const outlierFraction = outlierIdx.length / finiteData.length;
    if (outlierFraction > opts.outlierThreshold) {
      flags.push({
        type: 'outlier_excess',
        severity: 'warning',
        message: `${outlierIdx.length} outlier(s) (${(outlierFraction * 100).toFixed(1)}%) exceed ${(opts.outlierThreshold * 100).toFixed(1)}% threshold.`,
        indices: outlierOrigIdx,
      });
    }

    // 5. Coefficient of variation
    if (stats.mean !== 0) {
      const cv = stats.std / Math.abs(stats.mean);
      if (cv < opts.minCV) {
        flags.push({
          type: 'low_cv',
          severity: 'info',
          message: `Coefficient of variation ${(cv * 100).toFixed(2)}% is below minimum ${(opts.minCV * 100).toFixed(2)}%. Data may be unrealistically uniform.`,
          indices: [],
        });
      }
      if (cv > opts.maxCV) {
        flags.push({
          type: 'high_cv',
          severity: 'warning',
          message: `Coefficient of variation ${(cv * 100).toFixed(2)}% exceeds maximum ${(opts.maxCV * 100).toFixed(2)}%.`,
          indices: [],
        });
      }
    }
  }

  // 6. Allowed range
  const outOfRangeIdx: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (!Number.isFinite(data[i])) continue;
    if (
      data[i] < opts.allowedRange.min ||
      data[i] > opts.allowedRange.max
    ) {
      outOfRangeIdx.push(i);
    }
  }
  if (outOfRangeIdx.length > 0) {
    flags.push({
      type: 'out_of_range',
      severity: 'warning',
      message: `${outOfRangeIdx.length} value(s) outside allowed range [${opts.allowedRange.min}, ${opts.allowedRange.max}].`,
      indices: outOfRangeIdx,
    });
  }

  // --- Pass / fail ---
  const hasError = flags.some((f) => f.severity === 'error');
  const passed = !hasError;

  return { passed, flags, stats };
}
