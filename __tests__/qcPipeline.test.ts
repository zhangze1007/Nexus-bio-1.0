import {
  runQC,
  normalizeData,
  detectOutliers,
} from '../src/services/instruments/qcPipeline';

/* ------------------------------------------------------------------ */
/*  detectOutliers                                                     */
/* ------------------------------------------------------------------ */

describe('detectOutliers', () => {
  it('returns empty array for empty input', () => {
    expect(detectOutliers([], 'iqr')).toEqual([]);
  });

  it('returns empty array when no outliers exist (iqr)', () => {
    const data = [10, 11, 12, 13, 14, 15];
    expect(detectOutliers(data, 'iqr')).toEqual([]);
  });

  it('detects extreme outliers with IQR method', () => {
    const data = [10, 11, 12, 13, 14, 15, 100];
    const outliers = detectOutliers(data, 'iqr');
    expect(outliers).toContain(6); // index of 100
  });

  it('detects outliers with z-score method', () => {
    const data = [1, 1, 1, 1, 1, 1, 1, 1, 1, 500];
    const outliers = detectOutliers(data, 'zscore', 2.5);
    expect(outliers).toContain(9);
  });

  it('returns empty when all values identical (zscore)', () => {
    expect(detectOutliers([5, 5, 5, 5], 'zscore')).toEqual([]);
  });

  it('detects outliers on both tails (iqr)', () => {
    const data = [-1000, 2, 3, 4, 5, 6, 7, 1000];
    const outliers = detectOutliers(data, 'iqr');
    expect(outliers).toContain(0);
    expect(outliers).toContain(7);
  });
});

/* ------------------------------------------------------------------ */
/*  normalizeData                                                      */
/* ------------------------------------------------------------------ */

describe('normalizeData', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeData([], 'minmax')).toEqual([]);
  });

  it('minmax normalizes to [0, 1]', () => {
    const data = [2, 4, 6, 8, 10];
    const norm = normalizeData(data, 'minmax');
    expect(norm[0]).toBeCloseTo(0);
    expect(norm[4]).toBeCloseTo(1);
    expect(norm[2]).toBeCloseTo(0.5);
  });

  it('minmax returns all zeros when range is zero', () => {
    const norm = normalizeData([5, 5, 5], 'minmax');
    expect(norm).toEqual([0, 0, 0]);
  });

  it('zscore produces zero mean and unit variance', () => {
    const data = [2, 4, 6, 8, 10];
    const norm = normalizeData(data, 'zscore');
    const mu = norm.reduce((s, v) => s + v, 0) / norm.length;
    expect(mu).toBeCloseTo(0, 10);
    const variance =
      norm.reduce((s, v) => s + (v - mu) ** 2, 0) / (norm.length - 1);
    expect(Math.sqrt(variance)).toBeCloseTo(1, 5);
  });

  it('robust scaling centers on median and divides by IQR', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const norm = normalizeData(data, 'robust');
    // Median of [1..10] is 5.5, Q1=3, Q3=8, IQR=5
    const med = 5.5;
    const iqr = 8 - 3;
    for (let i = 0; i < data.length; i++) {
      expect(norm[i]).toBeCloseTo((data[i] - med) / iqr, 5);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  runQC                                                              */
/* ------------------------------------------------------------------ */

describe('runQC', () => {
  it('fails on empty data', () => {
    const result = runQC([]);
    expect(result.passed).toBe(false);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe('empty_data');
    expect(result.flags[0].severity).toBe('error');
  });

  it('passes on clean numeric data', () => {
    const data = [10, 11, 12, 13, 14, 15];
    const result = runQC(data);
    expect(result.passed).toBe(true);
    expect(result.flags).toHaveLength(0);
    expect(result.stats.mean).toBeCloseTo(12.5);
    expect(result.stats.min).toBe(10);
    expect(result.stats.max).toBe(15);
    expect(result.stats.median).toBeCloseTo(12.5);
  });

  it('flags NaN values as non_finite error', () => {
    const data = [1, 2, NaN, 4];
    const result = runQC(data);
    expect(result.passed).toBe(false);
    const nf = result.flags.find((f) => f.type === 'non_finite');
    expect(nf).toBeDefined();
    expect(nf!.indices).toContain(2);
    expect(nf!.severity).toBe('error');
  });

  it('flags Infinity values as non_finite error', () => {
    const data = [1, 2, Infinity, 4];
    const result = runQC(data);
    expect(result.passed).toBe(false);
    const nf = result.flags.find((f) => f.type === 'non_finite');
    expect(nf).toBeDefined();
    expect(nf!.indices).toContain(2);
  });

  it('flags length mismatch as warning', () => {
    const data = [1, 2, 3];
    const result = runQC(data, { expectedLength: 5 });
    expect(result.passed).toBe(true); // warning, not error
    const lm = result.flags.find((f) => f.type === 'length_mismatch');
    expect(lm).toBeDefined();
    expect(lm!.severity).toBe('warning');
  });

  it('flags outliers that exceed the threshold fraction', () => {
    // 1 outlier among 6 points = 16.7% > 10% default threshold
    const data = [10, 11, 12, 13, 14, 100];
    const result = runQC(data);
    const ol = result.flags.find((f) => f.type === 'outlier_excess');
    expect(ol).toBeDefined();
    expect(ol!.severity).toBe('warning');
    expect(ol!.indices).toContain(5);
  });

  it('does not flag outliers below threshold fraction', () => {
    // 1 outlier among 100 points = 1% < 10% threshold
    const data = Array.from({ length: 99 }, () => 10);
    data.push(1000);
    const result = runQC(data, { outlierMethod: 'zscore', zThreshold: 3 });
    const ol = result.flags.find((f) => f.type === 'outlier_excess');
    expect(ol).toBeUndefined();
  });

  it('flags values outside allowed range', () => {
    const data = [0.5, 0.6, 0.7, 5.0, 0.9];
    const result = runQC(data, {
      allowedRange: { min: 0, max: 1 },
    });
    const oor = result.flags.find((f) => f.type === 'out_of_range');
    expect(oor).toBeDefined();
    expect(oor!.indices).toContain(3);
  });

  it('flags low coefficient of variation', () => {
    // Very uniform data
    const data = [100, 100, 100, 100.01, 100.01];
    const result = runQC(data, { minCV: 0.01 });
    const lcv = result.flags.find((f) => f.type === 'low_cv');
    expect(lcv).toBeDefined();
    expect(lcv!.severity).toBe('info');
  });

  it('flags high coefficient of variation', () => {
    const data = [1, 100, 1, 100, 1];
    const result = runQC(data, { maxCV: 0.5 });
    const hcv = result.flags.find((f) => f.type === 'high_cv');
    expect(hcv).toBeDefined();
    expect(hcv!.severity).toBe('warning');
  });

  it('computes correct stats for single-element data', () => {
    const result = runQC([42]);
    expect(result.stats.mean).toBe(42);
    expect(result.stats.min).toBe(42);
    expect(result.stats.max).toBe(42);
    expect(result.stats.median).toBe(42);
    expect(result.stats.std).toBe(0);
  });

  it('handles data with mixed finite and non-finite values', () => {
    const data = [1, 2, NaN, 4, 5, NaN, 7];
    const result = runQC(data, { outlierMethod: 'zscore' });
    const nf = result.flags.find((f) => f.type === 'non_finite');
    expect(nf!.indices).toEqual([2, 5]);
    // Stats are computed on all values including NaN -> mean will be NaN
    expect(result.passed).toBe(false);
  });

  it('result.stats.median is correct for even-length data', () => {
    const result = runQC([1, 2, 3, 4]);
    expect(result.stats.median).toBe(2.5);
  });

  it('uses zscore outlier method when specified', () => {
    const data = [1, 1, 1, 1, 1, 1, 1, 1, 1, 500];
    const result = runQC(data, {
      outlierMethod: 'zscore',
      zThreshold: 2.5,
      outlierThreshold: 0.05,
    });
    const ol = result.flags.find((f) => f.type === 'outlier_excess');
    expect(ol).toBeDefined();
    expect(ol!.indices).toContain(9);
  });
});
