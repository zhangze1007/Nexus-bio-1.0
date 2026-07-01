import { designPromoter } from '../src/server/regulatoryDesignEngine';

/**
 * T1-2 anti-fabrication: promoter design must be reproducible under a fixed
 * seed and must actually hit the requested target strength (targeted search,
 * not a single random draw).
 */
describe('designPromoter', () => {
  it('returns the same sequence twice for a fixed seed', () => {
    const a = designPromoter(0.8, 7);
    const b = designPromoter(0.8, 7);
    expect(a.sequence).toBe(b.sequence);
  });

  it('produces a strength within tolerance of the target', () => {
    const tol = 0.05;
    for (const target of [0.4, 0.6, 0.8]) {
      const d = designPromoter(target, 7, tol);
      expect(Math.abs(d.strength - target)).toBeLessThanOrEqual(tol + 0.01);
    }
  });

  it('varies with the seed', () => {
    const a = designPromoter(0.8, 1);
    const b = designPromoter(0.8, 2);
    // Different seeds should generally yield different candidate sequences.
    expect(a.sequence).not.toBe(b.sequence);
  });
});
