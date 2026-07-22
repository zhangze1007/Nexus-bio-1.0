import { type Belief, updateBelief, updateBeliefSequence } from "../../src/services/learning/bayesianUpdate";

describe("bayesianUpdate", () => {
  it("moves the mean toward the observation and shrinks variance", () => {
    const prior: Belief = { mean: 10, variance: 4 };
    const post = updateBelief(prior, { value: 6, variance: 4 });
    expect(post.mean).toBeLessThan(prior.mean); // toward 6
    expect(post.mean).toBeGreaterThan(6); // but not all the way
    expect(post.mean).toBeCloseTo(8, 6); // k = 0.5 → midpoint
    expect(post.variance).toBeLessThan(prior.variance);
  });

  it("converges toward repeated consistent evidence with monotonic variance drop", () => {
    let belief: Belief = { mean: 10, variance: 4 };
    const obs = { value: 6, variance: 2 };
    const means: number[] = [];
    const variances: number[] = [];
    for (let i = 0; i < 8; i++) {
      belief = updateBelief(belief, obs);
      means.push(belief.mean);
      variances.push(belief.variance);
    }
    for (let i = 1; i < means.length; i++) {
      // monotonically approaching 6 from above (never overshoots / bounces)
      expect(means[i]).toBeLessThanOrEqual(means[i - 1] + 1e-12);
      expect(means[i]).toBeGreaterThanOrEqual(6 - 1e-9);
      // variance strictly decreasing (accumulates confidence)
      expect(variances[i]).toBeLessThan(variances[i - 1]);
    }
    expect(belief.mean).toBeGreaterThan(6);
    expect(belief.mean).toBeLessThan(6.5);
  });

  it("updateBeliefSequence equals folding updateBelief", () => {
    const prior: Belief = { mean: 0, variance: 1 };
    const obs = [
      { value: 5, variance: 1 },
      { value: 5, variance: 1 },
      { value: 5, variance: 1 },
    ];
    let folded = prior;
    for (const o of obs) folded = updateBelief(folded, o);
    expect(updateBeliefSequence(prior, obs)).toEqual(folded);
  });

  it("degenerate zero-variance update is safe", () => {
    expect(updateBelief({ mean: 3, variance: 0 }, { value: 9, variance: 0 })).toEqual({ mean: 3, variance: 0 });
  });
});
