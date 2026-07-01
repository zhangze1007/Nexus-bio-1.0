import { computePCA } from '../src/server/bioreactorAnalyticsEngine';

/**
 * T1-3 anti-fabrication: PCA power-iteration is now seeded with a fixed sign
 * convention, so eigenvectors are identical run-to-run (was Math.random init).
 */
describe('computePCA reproducibility', () => {
  // A fixed matrix with strong correlation between cols 0 and 1.
  const matrix = [
    [2.0, 2.1, 0.1],
    [4.0, 3.9, 0.2],
    [6.0, 6.2, 0.0],
    [8.0, 7.8, 0.3],
    [10.0, 10.1, 0.1],
    [1.0, 1.2, 0.2],
  ];

  it('produces identical loadings on repeated runs', () => {
    const a = computePCA(matrix);
    const b = computePCA(matrix);
    expect(a.loadings).toEqual(b.loadings);
    expect(a.explainedVariance).toEqual(b.explainedVariance);
  });

  it('captures the dominant correlated direction in PC1', () => {
    const { loadings, explainedVariance } = computePCA(matrix);
    // PC1 should load heavily on the two correlated columns, not on the noise col.
    const pc1 = loadings[0];
    expect(Math.abs(pc1[0]) + Math.abs(pc1[1])).toBeGreaterThan(Math.abs(pc1[2]));
    // PC1 explains the majority of variance for this near-collinear data.
    expect(explainedVariance[0]).toBeGreaterThan(0.5);
  });
});
