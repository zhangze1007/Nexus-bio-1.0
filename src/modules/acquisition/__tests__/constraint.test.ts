import { ThompsonSampling } from '../thompson';
import { withConstraints } from '../constraint';
import type { AcquisitionInput } from '../base';

describe('ConstrainedAcquisition', () => {
  const ts = new ThompsonSampling(42);

  const makeInput = (features: number[][]): AcquisitionInput => ({
    candidates: features.map((f, i) => ({ index: i, features: f })),
    predictions: features.map(() => ({ mu: 5, sigma: 1 })),
    seed: 42,
  });

  it('eliminates hard-constrained candidates', () => {
    const constrained = withConstraints(ts, {
      hardConstraints: [(f) => f[0] < 0.5], // only allow features < 0.5
    });

    const input = makeInput([[0.3], [0.8], [0.2]]);
    const scores = constrained.score(input);

    // Index 1 (0.8) should have -Infinity score
    expect(scores[1]).toBe(-Infinity);
    // Others should have finite scores
    expect(scores[0]).toBeGreaterThan(-Infinity);
    expect(scores[2]).toBeGreaterThan(-Infinity);
  });

  it('applies soft constraints as multipliers', () => {
    const constrained = withConstraints(ts, {
      softConstraints: [(f) => f[0]], // feasibility = feature value
    });

    const input = makeInput([[0.9], [0.1]]);
    const scores = constrained.score(input);

    // Both should have scores, but the one with higher feasibility should score higher
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });

  it('combines multiple constraints', () => {
    const constrained = withConstraints(ts, {
      hardConstraints: [(f) => f[0] > 0.2],
      softConstraints: [(f) => f[0]],
    });

    const input = makeInput([[0.1], [0.5], [0.8]]);
    const scores = constrained.score(input);

    // Index 0 (0.1) should be eliminated by hard constraint
    expect(scores[0]).toBe(-Infinity);
    // Index 1 (0.5) should have reduced score (soft constraint)
    expect(scores[1]).toBeLessThan(10);
    // Index 2 (0.8) should have higher score than index 1
    expect(scores[2]).toBeGreaterThan(scores[1]);
  });

  it('all candidates feasible returns same ranking as unconstrained', () => {
    const constrained = withConstraints(ts, {
      hardConstraints: [() => true],
      softConstraints: [() => 1],
    });

    const input = makeInput([[0.3], [0.8], [0.2]]);
    const unconstrained = ts.select(input, 3);
    const constrainedResult = constrained.select(input, 3);

    expect(constrainedResult.topK).toEqual(unconstrained.topK);
  });
});
