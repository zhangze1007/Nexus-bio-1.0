/** @jest-environment node */

import { runMOFA, type MOFAInput, type MOFAResult } from '../../src/server/mofaPlus';

// Helper: generate random matrix [rows x cols]
function randMatrix(rows: number, cols: number, scale = 1): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (Math.random() - 0.5) * 2 * scale),
  );
}

// Helper: matrix multiply A[m x k] * B[k x n] -> [m x n]
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const k = A[0].length;
  const n = B[0].length;
  const out: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += A[i][p] * B[p][j];
      out[i][j] = s;
    }
  }
  return out;
}

// Helper: transpose [m x n] -> [n x m]
function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const out: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) out[j][i] = A[i][j];
  }
  return out;
}

describe('MOFA+', () => {
  it('returns correct result shape', () => {
    const n = 20;
    const view1 = randMatrix(n, 4);
    const view2 = randMatrix(n, 3);
    const result = runMOFA({ views: { v1: view1, v2: view2 }, nFactors: 2, maxIterations: 10 });

    expect(result.factors.length).toBe(n);
    expect(result.factors[0].length).toBe(2);
    expect(result.loadings.v1.length).toBe(4);
    expect(result.loadings.v1[0].length).toBe(2);
    expect(result.loadings.v2.length).toBe(3);
    expect(result.loadings.v2[0].length).toBe(2);
    expect(typeof result.converged).toBe('boolean');
    expect(typeof result.iterations).toBe('number');
  });

  it('learns shared latent factors from multi-omics data', () => {
    const n = 50;
    const k = 2;
    // Generate synthetic data with shared structure
    const Z = randMatrix(n, k);
    const W1 = [[1, 0], [0, 1], [0.5, 0.5], [0.2, 0.8]];
    const W2 = [[0, 1], [1, 0], [0.7, 0.3]];
    const view1 = matMul(Z, transpose(W1));
    const view2 = matMul(Z, transpose(W2));

    const result = runMOFA({ views: { v1: view1, v2: view2 }, nFactors: 2, maxIterations: 50 });

    expect(result.factors.length).toBe(n);
    expect(result.factors[0].length).toBe(2);
    expect(result.varianceExplained.v1).toBeDefined();
    expect(result.varianceExplained.v2).toBeDefined();
    expect(result.varianceExplained.v1.length).toBe(2);
    expect(result.varianceExplained.v2.length).toBe(2);

    // Variance explained should be non-negative
    for (const viewName of ['v1', 'v2']) {
      for (const r2 of result.varianceExplained[viewName]) {
        expect(r2).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('handles missing data (NaN values)', () => {
    const view1 = [[1, 2], [3, 4], [5, 6]];
    const view2 = [[7, 8], [NaN, NaN], [11, 12]];
    const result = runMOFA({ views: { v1: view1, v2: view2 }, nFactors: 1, maxIterations: 20 });

    expect(result.factors.length).toBe(3);
    expect(result.factors[0].length).toBe(1);
    expect(result.loadings.v1).toBeDefined();
    expect(result.loadings.v2).toBeDefined();

    // Factors for the missing-data sample should still be finite numbers
    expect(Number.isFinite(result.factors[1][0])).toBe(true);
  });

  it('variance explained increases with more iterations (basic convergence)', () => {
    const n = 30;
    const Z = randMatrix(n, 2);
    const W = [[2, 0], [0, 2], [1, 1]];
    const view1 = matMul(Z, transpose(W));

    const few = runMOFA({ views: { v1: view1 }, nFactors: 2, maxIterations: 5 });
    const more = runMOFA({ views: { v1: view1 }, nFactors: 2, maxIterations: 100 });

    const totalFew = few.varianceExplained.v1.reduce((a, b) => a + b, 0);
    const totalMore = more.varianceExplained.v1.reduce((a, b) => a + b, 0);

    // More iterations should generally capture more variance
    expect(totalMore).toBeGreaterThanOrEqual(totalFew - 0.05);
  });

  it('handles single view', () => {
    const view1 = randMatrix(15, 5);
    const result = runMOFA({ views: { gex: view1 }, nFactors: 3, maxIterations: 20 });

    expect(result.factors.length).toBe(15);
    expect(result.factors[0].length).toBe(3);
    expect(result.loadings.gex.length).toBe(5);
    expect(result.loadings.gex[0].length).toBe(3);
    expect(result.varianceExplained.gex.length).toBe(3);
  });

  it('handles many views (>2)', () => {
    const n = 20;
    const views = {
      transcriptomics: randMatrix(n, 6),
      proteomics: randMatrix(n, 4),
      metabolomics: randMatrix(n, 3),
    };
    const result = runMOFA({ views, nFactors: 2, maxIterations: 30 });

    expect(result.factors.length).toBe(n);
    expect(result.loadings.transcriptomics.length).toBe(6);
    expect(result.loadings.proteomics.length).toBe(4);
    expect(result.loadings.metabolomics.length).toBe(3);
    expect(Object.keys(result.varianceExplained)).toHaveLength(3);
  });

  it('returns NaN-free factors for clean input', () => {
    const view1 = randMatrix(10, 3);
    const view2 = randMatrix(10, 2);
    const result = runMOFA({ views: { v1: view1, v2: view2 }, nFactors: 2, maxIterations: 50 });

    for (const row of result.factors) {
      for (const val of row) {
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });

  it('respects nFactors parameter', () => {
    const view1 = randMatrix(20, 8);
    for (const nf of [1, 3, 5]) {
      const result = runMOFA({ views: { v1: view1 }, nFactors: nf, maxIterations: 15 });
      expect(result.factors[0].length).toBe(nf);
      expect(result.loadings.v1[0].length).toBe(nf);
      expect(result.varianceExplained.v1.length).toBe(nf);
    }
  });

  it('defaults nFactors to 5 when not specified', () => {
    const view1 = randMatrix(15, 10);
    const result = runMOFA({ views: { v1: view1 }, maxIterations: 5 });
    expect(result.factors[0].length).toBe(5);
  });

  it('clamps nFactors to min(nSamples, nFeatures)', () => {
    const view1 = randMatrix(4, 3); // only 4 samples, 3 features
    const result = runMOFA({ views: { v1: view1 }, nFactors: 10, maxIterations: 10 });
    // nFactors should be clamped to min(samples, minFeatures) = min(4, 3) = 3
    expect(result.factors[0].length).toBeLessThanOrEqual(Math.min(4, 3));
  });
});
