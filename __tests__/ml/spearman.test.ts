/**
 * Unit + hand-computed self-checks for the Spearman rank correlation
 * (src/modules/ml/spearman.ts). The external scipy cross-check lives in
 * __tests__/benchmark/mlRidgeSpearmanGroundTruth.test.ts; this file pins the
 * primitives (average ranks, Pearson) and a by-hand example.
 */
import { averageRanks, pearsonCorrelation, spearmanCorrelation } from "../../src/modules/ml/spearman";

describe("averageRanks", () => {
  it("ranks distinct values 1..n by order", () => {
    expect(averageRanks([3, 1, 2])).toEqual([3, 1, 2]);
    expect(averageRanks([10, -5, 0, 7])).toEqual([4, 1, 2, 3]);
  });

  it("assigns tied values the mean of their positions", () => {
    // 5,5 occupy positions 2 and 3 → rank 2.5 each; 1 → rank 1.
    expect(averageRanks([5, 5, 1])).toEqual([2.5, 2.5, 1]);
    // three-way tie for the last three positions (2,3,4) → 3 each.
    expect(averageRanks([1, 4, 4, 4])).toEqual([1, 3, 3, 3]);
  });
});

describe("pearsonCorrelation", () => {
  it("is +1 / -1 for perfectly (anti)correlated data", () => {
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12);
    expect(pearsonCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 12);
  });
  it("returns NaN when a variable has zero variance", () => {
    expect(Number.isNaN(pearsonCorrelation([1, 1, 1], [1, 2, 3]))).toBe(true);
  });
});

describe("spearmanCorrelation (hand-computed)", () => {
  it("is +1 for any strictly increasing relationship", () => {
    expect(spearmanCorrelation([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12);
    expect(spearmanCorrelation([1, 2, 3, 4], [1, 8, 27, 64])).toBeCloseTo(1, 12); // monotone, nonlinear
  });

  it("is -1 for any strictly decreasing relationship", () => {
    expect(spearmanCorrelation([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 12);
  });

  it("matches a fully hand-computed tied example (= 0.5)", () => {
    // x = [1,1,2] → ranks [1.5, 1.5, 3]; y = [1,2,2] → ranks [1, 2.5, 2.5].
    // Pearson of those ranks: cov=0.75, var=1.5 each → 0.75/1.5 = 0.5.
    expect(spearmanCorrelation([1, 1, 2], [1, 2, 2])).toBeCloseTo(0.5, 12);
  });

  it("returns NaN for empty or mismatched-length inputs", () => {
    expect(Number.isNaN(spearmanCorrelation([], []))).toBe(true);
    expect(Number.isNaN(spearmanCorrelation([1, 2], [1]))).toBe(true);
  });
});
