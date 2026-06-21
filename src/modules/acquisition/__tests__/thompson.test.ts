import { ThompsonSampling, batchThompsonSampling } from '../thompson';
import type { AcquisitionInput } from '../base';

describe('ThompsonSampling', () => {
  const ts = new ThompsonSampling(42);

  const makeInput = (mus: number[], sigmas: number[]): AcquisitionInput => ({
    candidates: mus.map((_, i) => ({ index: i, features: [i] })),
    predictions: mus.map((mu, i) => ({ mu, sigma: sigmas[i] })),
    seed: 42,
  });

  it('scores single candidate', () => {
    const scores = ts.score(makeInput([5], [1]));
    expect(scores.length).toBe(1);
    expect(typeof scores[0]).toBe('number');
  });

  it('returns mean when sigma is 0', () => {
    const scores = ts.score(makeInput([5, 10], [0, 0]));
    expect(scores[0]).toBe(5);
    expect(scores[1]).toBe(10);
  });

  it('produces different results with different seeds', () => {
    const input = makeInput([5, 10, 3], [1, 1, 1]);
    const s1 = ts.score({ ...input, seed: 42 });
    const s2 = ts.score({ ...input, seed: 123 });
    // Very unlikely to be identical with different seeds
    expect(s1).not.toEqual(s2);
  });

  it('selects top-k candidates', () => {
    const input = makeInput([5, 10, 3], [1, 1, 1]);
    const result = ts.select(input, 2);
    expect(result.topK.length).toBe(2);
    expect(result.ranked.length).toBe(3);
  });

  it('batch sampling returns requested count', () => {
    const input = makeInput([5, 10, 3, 8], [1, 1, 1, 1]);
    const selected = batchThompsonSampling(input, 2, 42);
    expect(selected.length).toBe(2);
  });
});
