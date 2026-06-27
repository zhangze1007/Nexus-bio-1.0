/**
 * Tests for AI/ML Model Evaluation Service
 *
 * Covers: evaluateModelPerformance, compareModels, getModelDrift
 */

import {
  evaluateModelPerformance,
  compareModels,
  getModelDrift,
  type TestDataPoint,
} from "../src/services/ai/modelEvaluation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate n perfect predictions. */
function perfectData(n: number): TestDataPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    actual: i % 2 === 0 ? 1 : 0,
    predicted: i % 2 === 0 ? 1 : 0,
  }));
}

/** Generate n random-ish predictions with known noise level. */
function noisyData(n: number, noiseRate: number, seed = 42): TestDataPoint[] {
  let s = seed;
  const next = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };

  return Array.from({ length: n }, (_, i) => {
    const actual = i % 2 === 0 ? 1 : 0;
    const flip = next() < noiseRate;
    return { actual, predicted: flip ? 1 - actual : actual };
  });
}

/** Generate regression-style data. */
function regressionData(
  values: number[],
  noise = 0,
  seed = 99,
): TestDataPoint[] {
  let s = seed;
  const next = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };

  return values.map((v) => ({
    actual: v,
    predicted: v + (next() - 0.5) * 2 * noise,
  }));
}

// ---------------------------------------------------------------------------
// evaluateModelPerformance
// ---------------------------------------------------------------------------

describe("evaluateModelPerformance", () => {
  it("returns perfect metrics for perfect predictions", async () => {
    const data = perfectData(100);
    const m = await evaluateModelPerformance("test-model", data);

    expect(m.accuracy).toBe(1);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
    expect(m.f1).toBe(1);
    expect(m.r2).toBeCloseTo(1, 5);
    expect(m.rmse).toBeCloseTo(0, 10);
  });

  it("returns zero precision when all predictions are false positives", async () => {
    // All actual=0, all predicted=1 -> all FP
    const data: TestDataPoint[] = Array.from({ length: 20 }, () => ({
      actual: 0,
      predicted: 1,
    }));
    const m = await evaluateModelPerformance("fp-model", data);

    expect(m.precision).toBe(0);
    expect(m.accuracy).toBe(0);
  });

  it("returns zero recall when model misses all positives", async () => {
    // All actual=1, all predicted=0 -> all FN
    const data: TestDataPoint[] = Array.from({ length: 20 }, () => ({
      actual: 1,
      predicted: 0,
    }));
    const m = await evaluateModelPerformance("fn-model", data);

    expect(m.recall).toBe(0);
    expect(m.f1).toBe(0);
  });

  it("throws on empty test data", async () => {
    await expect(
      evaluateModelPerformance("empty", []),
    ).rejects.toThrow("must not be empty");
  });

  it("handles mixed classification data with expected accuracy", async () => {
    // 80 correct out of 100 -> accuracy 0.8
    const data = noisyData(100, 0.2, seed);
    const m = await evaluateModelPerformance("mixed", data);

    expect(m.accuracy).toBeGreaterThanOrEqual(0.65);
    expect(m.accuracy).toBeLessThanOrEqual(1);
    expect(m.f1).toBeGreaterThanOrEqual(0);
    expect(m.f1).toBeLessThanOrEqual(1);
  });

  it("computes correct R2 and RMSE for regression data", async () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const data = regressionData(values, 0); // perfect regression
    const m = await evaluateModelPerformance("regression", data);

    expect(m.r2).toBeCloseTo(1, 5);
    expect(m.rmse).toBeCloseTo(0, 10);
  });

  it("returns R2 < 1 and RMSE > 0 for noisy regression", async () => {
    const values = [10, 20, 30, 40, 50];
    const data = regressionData(values, 5); // significant noise
    const m = await evaluateModelPerformance("noisy-reg", data);

    expect(m.r2).toBeLessThan(1);
    expect(m.rmse).toBeGreaterThan(0);
  });

  it("respects custom per-point threshold", async () => {
    // With threshold=0.3, predicted=0.4 is positive
    const data: TestDataPoint[] = [
      { actual: 1, predicted: 0.4, threshold: 0.3 },
      { actual: 0, predicted: 0.2, threshold: 0.3 },
      { actual: 1, predicted: 0.5, threshold: 0.3 },
      { actual: 0, predicted: 0.1, threshold: 0.3 },
    ];
    const m = await evaluateModelPerformance("threshold", data);

    // All 4 classified correctly with threshold 0.3
    expect(m.accuracy).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// compareModels
// ---------------------------------------------------------------------------

describe("compareModels", () => {
  it("ranks a perfect model above a noisy model", async () => {
    const good = perfectData(50);
    const bad = noisyData(50, 0.45, seed);

    const result = await compareModels(
      ["good", "bad"],
      { good, bad },
    );

    expect(result.models).toHaveLength(2);
    expect(result.models[0].modelId).toBe("good");
    expect(result.models[0].rank).toBe(1);
    expect(result.models[1].modelId).toBe("bad");
    expect(result.models[1].rank).toBe(2);
  });

  it("identifies the most discriminating metric", async () => {
    const a = perfectData(40);
    const b = noisyData(40, 0.5, seed);

    const result = await compareModels(["a", "b"], { a, b });

    expect(result.mostDiscriminatingMetric).toBeDefined();
    expect(
      ["accuracy", "precision", "recall", "f1", "r2", "rmse"]).toContain(
      result.mostDiscriminatingMetric,
    );
  });

  it("throws on empty modelIds", async () => {
    await expect(compareModels([], {})).rejects.toThrow(
      "must not be empty",
    );
  });

  it("throws when test data is missing for a model", async () => {
    await expect(
      compareModels(["x"], {}),
    ).rejects.toThrow('no test data for model "x"');
  });
});

// ---------------------------------------------------------------------------
// getModelDrift
// ---------------------------------------------------------------------------

describe("getModelDrift", () => {
  it("reports no drift for identical baseline and new data", async () => {
    const data = perfectData(60);
    const result = await getModelDrift("stable", data, data);

    expect(result.driftScore).toBeCloseTo(0, 5);
    expect(result.isDrifting).toBe(false);
    expect(result.recommendations.some((r) => r.includes("No action"))).toBe(
      true,
    );
  });

  it("detects drift when new data is much noisier", async () => {
    const baseline = perfectData(80);
    const degraded = noisyData(80, 0.5, seed);

    const result = await getModelDrift("drifting", baseline, degraded);

    expect(result.driftScore).toBeGreaterThan(0);
    expect(result.isDrifting).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("stays below drift threshold for minor noise", async () => {
    const baseline = perfectData(200);
    const slightlyNoisy = noisyData(200, 0.01, seed);

    const result = await getModelDrift("minor", baseline, slightlyNoisy);

    // With only 1% noise on a larger set, drift should stay under threshold
    expect(result.driftScore).toBeLessThan(0.15);
    expect(result.isDrifting).toBe(false);
  });

  it("throws when either dataset is empty", async () => {
    const data = perfectData(10);
    await expect(getModelDrift("x", [], data)).rejects.toThrow(
      "non-empty",
    );
    await expect(getModelDrift("x", data, [])).rejects.toThrow(
      "non-empty",
    );
  });
});

// Deterministic seed constant used across noisy data generators.
const seed = 42;
