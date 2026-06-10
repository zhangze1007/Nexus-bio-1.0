import {
  shannonEntropy,
  selectionCoefficient,
  confidenceInterval,
  mannWhitneyU,
  mean,
  standardDeviation,
} from '../src/utils/statistics';

describe('statistics', () => {
  describe('shannonEntropy', () => {
    it('returns log2(n) for a uniform distribution of n elements', () => {
      // 8 equally-likely outcomes → entropy = 3 bits
      const counts = [100, 100, 100, 100, 100, 100, 100, 100];
      const H = shannonEntropy(counts);
      expect(H).toBeCloseTo(3.0, 5);
    });

    it('returns 0 for a single-element distribution', () => {
      const counts = [500];
      expect(shannonEntropy(counts)).toBe(0);
    });

    it('returns 1 bit for a fair two-outcome distribution', () => {
      const counts = [50, 50];
      expect(shannonEntropy(counts)).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for all-zero counts', () => {
      expect(shannonEntropy([0, 0, 0])).toBe(0);
    });

    it('is higher for more uniform distributions', () => {
      const uniform = shannonEntropy([100, 100, 100]);
      const skewed = shannonEntropy([280, 10, 10]);
      expect(uniform).toBeGreaterThan(skewed);
    });
  });

  describe('selectionCoefficient', () => {
    it('returns ~0 when fitness is equal (no selection)', () => {
      const s = selectionCoefficient(1.0, 1.0);
      expect(s).toBeCloseTo(0, 10);
    });

    it('returns positive value for beneficial mutation', () => {
      const s = selectionCoefficient(1.2, 1.0);
      expect(s).toBeCloseTo(0.2, 10);
      expect(s).toBeGreaterThan(0);
    });

    it('returns negative value for deleterious mutation', () => {
      const s = selectionCoefficient(0.85, 1.0);
      expect(s).toBeCloseTo(-0.15, 10);
      expect(s).toBeLessThan(0);
    });

    it('throws when wild-type fitness is zero', () => {
      expect(() => selectionCoefficient(1.0, 0)).toThrow();
    });
  });

  describe('confidenceInterval', () => {
    it('returns mean +/- margin for a known sample', () => {
      const data = [10, 12, 14, 16, 18];
      const { lower, upper, marginOfError } = confidenceInterval(data, 0.95);
      // mean = 14
      expect(lower).toBeLessThan(14);
      expect(upper).toBeGreaterThan(14);
      expect(upper - lower).toBeCloseTo(2 * marginOfError, 10);
    });

    it('interval narrows with more data (same mean/stdev)', () => {
      const small = [10, 12, 14, 16, 18];
      const large = Array.from({ length: 100 }, (_, i) => 10 + (i % 9));
      const ciSmall = confidenceInterval(small, 0.95);
      const ciLarge = confidenceInterval(large, 0.95);
      expect(ciLarge.marginOfError).toBeLessThan(ciSmall.marginOfError);
    });

    it('throws for fewer than 2 data points', () => {
      expect(() => confidenceInterval([5], 0.95)).toThrow();
    });
  });

  describe('mannWhitneyU', () => {
    it('returns non-significant p-value for identical distributions', () => {
      const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = mannWhitneyU(a, b);
      expect(result.pValue).toBeGreaterThan(0.05);
    });

    it('returns significant p-value for clearly different distributions', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [10, 11, 12, 13, 14];
      const result = mannWhitneyU(a, b);
      expect(result.pValue).toBeLessThan(0.05);
    });

    it('U statistics sum to n1*n2', () => {
      const a = [3, 5, 7];
      const b = [2, 4, 6, 8];
      const result = mannWhitneyU(a, b);
      expect(result.U1 + result.U2).toBeCloseTo(a.length * b.length, 10);
    });

    it('throws for empty arrays', () => {
      expect(() => mannWhitneyU([], [1, 2])).toThrow();
      expect(() => mannWhitneyU([1, 2], [])).toThrow();
    });
  });

  describe('mean', () => {
    it('computes arithmetic mean', () => {
      expect(mean([2, 4, 6, 8])).toBeCloseTo(5, 10);
    });

    it('returns the value itself for single-element array', () => {
      expect(mean([42])).toBe(42);
    });

    it('handles negative values', () => {
      expect(mean([-2, 2])).toBeCloseTo(0, 10);
    });
  });

  describe('standardDeviation', () => {
    it('returns 0 for identical values', () => {
      expect(standardDeviation([5, 5, 5, 5])).toBe(0);
    });

    it('computes correct sample standard deviation', () => {
      // data: [2, 4, 4, 4, 5, 5, 7, 9], mean=5, sample variance=32/7, stdev~2.138
      const sd = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(sd).toBeCloseTo(Math.sqrt(32 / 7), 5);
    });

    it('throws for single-element array', () => {
      expect(() => standardDeviation([1])).toThrow();
    });
  });
});
