import { EHVI } from '../ehvi';
import type { AcquisitionInput } from '../base';

describe('EHVI', () => {
  const ehvi = new EHVI(50);

  it('scores with two objectives', () => {
    const input: AcquisitionInput = {
      candidates: [
        { index: 0, features: [1] },
        { index: 1, features: [2] },
      ],
      predictions: [
        { mu: 5, sigma: 1 },
        { mu: 10, sigma: 1 },
      ],
      multiObjectivePredictions: [
        { objectives: [{ mu: 5, sigma: 1 }, { mu: 10, sigma: 1 }] },
        { objectives: [{ mu: 10, sigma: 1 }, { mu: 5, sigma: 1 }] },
      ],
      paretoFront: [[8, 8]],
      referencePoint: [0, 0],
      seed: 42,
    };
    const scores = ehvi.score(input);
    expect(scores.length).toBe(2);
    scores.forEach(s => expect(typeof s).toBe('number'));
  });

  it('returns 0 when no multi-objective predictions', () => {
    const input: AcquisitionInput = {
      candidates: [{ index: 0, features: [1] }],
      predictions: [{ mu: 5, sigma: 1 }],
      seed: 42,
    };
    const scores = ehvi.score(input);
    expect(scores[0]).toBe(0);
  });

  it('handles empty Pareto front', () => {
    const input: AcquisitionInput = {
      candidates: [{ index: 0, features: [1] }],
      predictions: [{ mu: 5, sigma: 1 }],
      multiObjectivePredictions: [
        { objectives: [{ mu: 5, sigma: 1 }, { mu: 10, sigma: 1 }] },
      ],
      paretoFront: [],
      referencePoint: [0, 0],
      seed: 42,
    };
    const scores = ehvi.score(input);
    expect(scores.length).toBe(1);
    expect(scores[0]).toBeGreaterThanOrEqual(0);
  });
});
