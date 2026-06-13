import { runGillespie, StochasticModel } from '../../src/server/gillespieSSA';

describe('Gillespie SSA', () => {
  it('simulates birth-death process with correct steady-state mean', () => {
    const model: StochasticModel = {
      species: [{ id: 'mRNA', initialCount: 0 }],
      reactions: [
        { id: 'transcription', reactants: {}, products: { mRNA: 1 }, rate: 10 },
        { id: 'degradation', reactants: { mRNA: 1 }, products: {}, rate: 0.1 },
      ],
    };
    const result = runGillespie(model, { maxTime: 1000, seed: 42 });
    const mean = result.trajectories.mRNA.reduce((a, b) => a + b, 0) / result.trajectories.mRNA.length;
    expect(mean).toBeGreaterThan(50);
    expect(mean).toBeLessThan(150);
  });

  it('is deterministic with same seed', () => {
    const model: StochasticModel = {
      species: [{ id: 'x', initialCount: 10 }],
      reactions: [
        { id: 'birth', reactants: {}, products: { x: 1 }, rate: 1 },
        { id: 'death', reactants: { x: 1 }, products: {}, rate: 0.1 },
      ],
    };
    const r1 = runGillespie(model, { maxTime: 100, seed: 12345 });
    const r2 = runGillespie(model, { maxTime: 100, seed: 12345 });
    expect(r1.trajectories.x).toEqual(r2.trajectories.x);
  });

  it('handles zero propensity gracefully', () => {
    const model: StochasticModel = {
      species: [{ id: 'x', initialCount: 0 }],
      reactions: [
        { id: 'degrade', reactants: { x: 1 }, products: {}, rate: 1 },
      ],
    };
    const result = runGillespie(model, { maxTime: 100, seed: 42 });
    expect(result.trajectories.x.every(v => v === 0)).toBe(true);
  });

  it('respects maxSteps limit', () => {
    const model: StochasticModel = {
      species: [{ id: 'x', initialCount: 100 }],
      reactions: [
        { id: 'birth', reactants: {}, products: { x: 1 }, rate: 1000 },
        { id: 'death', reactants: { x: 1 }, products: {}, rate: 0.001 },
      ],
    };
    const result = runGillespie(model, { maxTime: 100000, seed: 42, maxSteps: 50 });
    expect(result.times.length).toBeLessThanOrEqual(51); // initial + 50 steps
  });

  it('tracks reaction event counts', () => {
    const model: StochasticModel = {
      species: [{ id: 'x', initialCount: 0 }],
      reactions: [
        { id: 'birth', reactants: {}, products: { x: 1 }, rate: 10 },
        { id: 'death', reactants: { x: 1 }, products: {}, rate: 0.1 },
      ],
    };
    const result = runGillespie(model, { maxTime: 100, seed: 42 });
    expect(result.reactionEvents['birth']).toBeGreaterThan(0);
    expect(typeof result.reactionEvents['death']).toBe('number');
    const totalEvents = Object.values(result.reactionEvents).reduce((a, b) => a + b, 0);
    expect(totalEvents).toBe(result.times.length - 1); // minus initial state
  });

  it('returns final state consistent with last trajectory point', () => {
    const model: StochasticModel = {
      species: [{ id: 'x', initialCount: 5 }, { id: 'y', initialCount: 3 }],
      reactions: [
        { id: 'convert', reactants: { x: 1 }, products: { y: 1 }, rate: 0.5 },
      ],
    };
    const result = runGillespie(model, { maxTime: 50, seed: 99 });
    expect(result.finalState['x']).toBe(result.trajectories.x[result.trajectories.x.length - 1]);
    expect(result.finalState['y']).toBe(result.trajectories.y[result.trajectories.y.length - 1]);
  });
});
