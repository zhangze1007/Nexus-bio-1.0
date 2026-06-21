import { KnowledgeGradient } from '../kg';
import type { AcquisitionInput } from '../base';

describe('KnowledgeGradient', () => {
  const kg = new KnowledgeGradient(50);

  const makeInput = (mus: number[], sigmas: number[], best?: number): AcquisitionInput => ({
    candidates: mus.map((_, i) => ({ index: i, features: [i] })),
    predictions: mus.map((mu, i) => ({ mu, sigma: sigmas[i] })),
    bestValue: best,
    seed: 42,
  });

  it('scores candidates', () => {
    const scores = kg.score(makeInput([5, 10, 3], [1, 1, 1]));
    expect(scores.length).toBe(3);
    scores.forEach(s => expect(s).toBeGreaterThanOrEqual(0));
  });

  it('returns 0 for zero uncertainty', () => {
    const scores = kg.score(makeInput([5, 10], [0, 0]));
    expect(scores[0]).toBe(0);
    expect(scores[1]).toBe(0);
  });

  it('higher sigma tends to give higher KG', () => {
    // Uncertain candidate should have higher KG than certain one
    const scores = kg.score(makeInput([5, 5], [0.01, 5], 4));
    // The one with higher sigma should have higher KG on average
    expect(scores[1]).toBeGreaterThan(scores[0]);
  });

  it('selects top candidates', () => {
    const result = kg.select(makeInput([5, 10, 3], [1, 1, 1]), 1);
    expect(result.topK.length).toBe(1);
  });
});
