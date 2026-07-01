import { findAB } from '../src/server/umapEngine';

/**
 * T0-3 anti-decoy tests for UMAP's find_ab_params.
 *
 * The previous implementation returned hardcoded constants (1.929, 0.7915)
 * regardless of inputs. These tests assert the function is (a) genuinely
 * sensitive to its inputs and (b) matches the canonical UMAP reference values
 * (McInnes et al. 2018 / Python umap.umap_.find_ab_params).
 */
describe('findAB (UMAP find_ab_params)', () => {
  it('is sensitive to minDist — MUST differ (fails if hardcoded)', () => {
    const [a1, b1] = findAB(0.1, 1.0);
    const [a2, b2] = findAB(0.5, 1.0);
    expect(a1).not.toBeCloseTo(a2, 3);
    expect(b1).not.toBeCloseTo(b2, 3);
  });

  it('is sensitive to spread', () => {
    const [a1] = findAB(0.1, 1.0);
    const [a2] = findAB(0.1, 2.0);
    expect(a1).not.toBeCloseTo(a2, 3);
  });

  it('matches the canonical a≈1.577, b≈0.895 for minDist=0.1, spread=1.0', () => {
    const [a, b] = findAB(0.1, 1.0);
    expect(a).toBeCloseTo(1.577, 2);
    expect(b).toBeCloseTo(0.895, 2);
  });

  it('is deterministic (same input -> same output)', () => {
    expect(findAB(0.3, 1.5)).toEqual(findAB(0.3, 1.5));
  });
});
