import { computePCA } from '../src/server/bioreactorAnalyticsEngine';
import { findAB } from '../src/server/umapEngine';

/**
 * T4 ground-truth checks (the anti-fabrication insurance).
 *
 * These assert engine outputs against EXTERNAL / ANALYTIC references — not
 * against values produced by the same commit. They run in the JS test suite
 * (hence CI) with no Python dependency.
 *
 * Python-dependent ground-truth comparisons (COBRApy iJO1366 growth,
 * eQuilibrator ΔG, Doench 2016 Rule Set 2) require a Python environment and are
 * documented (with expected values + provenance) in
 * reference_impl_py/scientific/README.md. They are BLOCKED in this environment
 * (no system Python; Pyodide+COBRApy is incompatible — see pyodideCobra.test.ts)
 * and are intentionally NOT asserted here rather than fabricated.
 */
describe('ground-truth: UMAP find_ab_params vs Python umap', () => {
  // Reference: Python `umap.umap_.find_ab_params(spread=1.0, min_dist=0.1)`
  // returns a ≈ 1.5769, b ≈ 0.8951 (McInnes et al. 2018).
  it('matches Python umap.find_ab_params(1.0, 0.1)', () => {
    const [a, b] = findAB(0.1, 1.0);
    expect(a).toBeCloseTo(1.577, 2);
    expect(b).toBeCloseTo(0.895, 2);
  });
});

describe('ground-truth: PCA top eigenvector vs analytic result', () => {
  // For two perfectly (linearly) correlated variables, the standardized data
  // has correlation matrix [[1,1],[1,1]], whose leading eigenvector is
  // [1/√2, 1/√2] ≈ [0.7071, 0.7071] with eigenvalue 2 (100% of variance).
  // This is the same result numpy.linalg.svd / sklearn PCA produce.
  it('recovers [0.7071, 0.7071] for perfectly correlated columns', () => {
    const col1 = [1, 2, 3, 4, 5, 6];
    // col2 is a strictly increasing affine function of col1 → perfect correlation.
    const data = col1.map((x) => [x, 3 * x + 2]);
    const { loadings, explainedVariance } = computePCA(data);
    const pc1 = loadings[0];
    const inv = 1 / Math.SQRT2; // 0.70710678
    expect(Math.abs(pc1[0])).toBeCloseTo(inv, 3);
    expect(Math.abs(pc1[1])).toBeCloseTo(inv, 3);
    // The two loadings share the same sign (both point along the correlation axis).
    expect(Math.sign(pc1[0])).toBe(Math.sign(pc1[1]));
    // PC1 explains ~all the variance.
    expect(explainedVariance[0]).toBeCloseTo(1.0, 2);
  });
});
