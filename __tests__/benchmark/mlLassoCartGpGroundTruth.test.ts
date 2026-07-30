/**
 * CC-2 reference benchmark — remaining ML trainers + Gaussian Process, vs the
 * primitive foundation (scikit-learn / a fixed numpy GP).
 *
 * Ground truth: benchmarks/reference/ml/lasso_cart_gp.json
 *   - lasso: sklearn Lasso (objective (1/(2n))||y-Xw||² + alpha||w||₁,
 *            fit_intercept=True) coef/intercept/pred_test for alpha∈{0.01,0.1,1}, tol 1e-3
 *   - cart:  DecisionTreeRegressor(squared_error, max_depth=1) on clean separable
 *            data → split threshold 3.5, pred_test [1,5], tol 1e-6
 *   - gp:    RBF sv·exp(-||x-x'||²/(2ls²)) + noise on train diagonal → post_mean/std, tol 1e-4
 *   - random forest: behavioural only (RNG ensemble, not bit-matchable)
 *
 * Conventions verified from source (asserted, not assumed):
 *   - Lasso coordinate descent uses lambda = n·alpha/‖col‖², i.e. exactly the
 *     (1/(2n))·SSE + alpha·L1 objective, with an unregularized bias column ⇒
 *     same alpha as sklearn (no rescaling).
 *   - RBF k = σ²·exp(-0.5·Σ((xᵢ-x'ᵢ)/lᵢ)²) = σ²·exp(-‖x-x'‖²/(2ls²)) for shared ls.
 *
 * Honesty: fixture + tolerances are fixed. A mismatch is a real bug (wrong value
 * or wrong convention) to be reported and fixed at source — never papered over.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DecisionTree, LassoRegression, type MLModel, RandomForest } from "../../src/modules/ml/models";
import { GaussianProcess } from "../../src/server/gaussianProcess";
import { runReferenceCase } from "../../src/services/benchmark/referenceRunner";
import { gaussian, makeRng } from "../../src/utils/rng";

interface LinearCase {
  coef: number[];
  intercept: number;
  pred_test: number[];
}
interface Fixture {
  lasso: {
    X: number[][];
    y: number[];
    X_test: number[][];
    cases: Record<string, LinearCase>;
    tolerance: number;
  };
  gp: {
    length_scale: number;
    signal_var: number;
    noise: number;
    X: number[][];
    y: number[];
    X_test: number[][];
    post_mean: number[];
    post_std: number[];
    tolerance: number;
  };
  cart: {
    X: number[][];
    y: number[];
    X_test: number[][];
    pred_test: number[];
    expected_split_threshold: number;
    tolerance: number;
  };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "benchmarks", "reference", "ml", "lasso_cart_gp.json"), "utf8"),
) as Fixture;

/** Extract intercept + per-feature coefficients from any linear model via public predict(). */
function extractLinear(model: MLModel, nFeatures: number): { intercept: number; coef: number[] } {
  const zero = new Array(nFeatures).fill(0);
  const intercept = model.predict([zero])[0];
  const coef = Array.from({ length: nFeatures }, (_, j) => {
    const e = new Array(nFeatures).fill(0);
    e[j] = 1;
    return model.predict([e])[0] - intercept;
  });
  return { intercept, coef };
}

const mse = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length;

// ── 1. Lasso vs sklearn ──────────────────────────────────────────────────────
describe("CC-2 — Lasso vs sklearn (1/(2n)·SSE + alpha·L1, fit_intercept=True)", () => {
  const { X, y, X_test, cases, tolerance } = fixture.lasso;
  const nFeatures = X[0].length;

  it.each([
    ["0.01", 0.01],
    ["0.1", 0.1],
    ["1.0", 1.0],
  ])("matches sklearn Lasso at alpha=%s (tol %p)", (label, alpha) => {
    // Tight convergence so we compare CONVERGED solutions (sklearn iterates to tol too).
    const model = new LassoRegression(alpha, 100_000, 1e-10);
    model.fit(X, y);
    const { intercept, coef } = extractLinear(model, nFeatures);
    const predTest = model.predict(X_test);
    const expected = cases[`alpha${label}`];

    // eslint-disable-next-line no-console
    console.info(
      `[LASSO a=${label}] coef obs=[${coef.map((c) => c.toFixed(6)).join(", ")}] exp=[${expected.coef.join(", ")}] | intercept obs=${intercept.toFixed(6)} exp=${expected.intercept}`,
    );

    const reps = [
      ...runReferenceCase((v: number[]) => v, {
        id: `lasso.a${label}.coef`,
        input: coef,
        expected: expected.coef,
        tolerance,
        metric: "abs",
        source: "sklearn Lasso",
      }),
      ...runReferenceCase((v: number) => v, {
        id: `lasso.a${label}.intercept`,
        input: intercept,
        expected: expected.intercept,
        tolerance,
        metric: "abs",
        source: "sklearn Lasso",
      }),
      ...runReferenceCase((v: number[]) => v, {
        id: `lasso.a${label}.pred_test`,
        input: predTest,
        expected: expected.pred_test,
        tolerance,
        metric: "abs",
        source: "sklearn Lasso",
      }),
    ];
    for (const r of reps) expect(r.ok).toBe(true);
  });
});

// ── 2. Decision Tree (CART) exact on clean separable data ─────────────────────
describe("CC-2 — DecisionTree (CART) exact split on clean data", () => {
  const { X, y, X_test, pred_test, expected_split_threshold, tolerance } = fixture.cart;

  it(`splits at threshold ${expected_split_threshold} and predicts [${pred_test.join(", ")}]`, () => {
    const model = new DecisionTree(1); // max_depth=1, matching the fixture
    model.fit(X, y);
    const preds = model.predict(X_test);
    const root = JSON.parse(model.serialize()).tree as { featureIndex: number; threshold: number };

    // eslint-disable-next-line no-console
    console.info(
      `[CART] rootFeature=${root.featureIndex} threshold=${root.threshold} pred_test=[${preds.join(", ")}]`,
    );

    expect(root.featureIndex).toBe(0);
    expect(Math.abs(root.threshold - expected_split_threshold)).toBeLessThan(tolerance);
    for (const r of runReferenceCase((v: number[]) => v, {
      id: "cart.pred_test",
      input: preds,
      expected: pred_test,
      tolerance,
      metric: "abs",
      source: "sklearn DecisionTreeRegressor",
    })) {
      expect(r.ok).toBe(true);
    }
  });
});

// ── 3. Gaussian Process posterior vs fixed numpy GP ───────────────────────────
describe("CC-2 — GaussianProcess RBF posterior vs reference", () => {
  const { X, y, X_test, post_mean, post_std, length_scale, signal_var, noise, tolerance } = fixture.gp;

  it("matches post_mean and post_std (RBF, noise on train diagonal)", () => {
    const gp = new GaussianProcess({
      kernel: "rbf",
      lengthScale: length_scale,
      signalVariance: signal_var,
      noiseVariance: noise,
    });
    gp.fit(X, y);
    const preds = gp.predict(X_test);
    const mean = preds.map((p) => p.mean);
    const std = preds.map((p) => Math.sqrt(p.variance));

    // eslint-disable-next-line no-console
    console.info(
      `[GP] mean obs=[${mean.map((m) => m.toFixed(6)).join(", ")}] exp=[${post_mean.join(", ")}]\n` +
        `[GP] std  obs=[${std.map((s) => s.toFixed(6)).join(", ")}] exp=[${post_std.join(", ")}]`,
    );

    const reps = [
      ...runReferenceCase((v: number[]) => v, {
        id: "gp.post_mean",
        input: mean,
        expected: post_mean,
        tolerance,
        metric: "abs",
        source: "numpy GP (RBF)",
      }),
      ...runReferenceCase((v: number[]) => v, {
        id: "gp.post_std",
        input: std,
        expected: post_std,
        tolerance,
        metric: "abs",
        source: "numpy GP (RBF)",
      }),
    ];
    for (const r of reps) expect(r.ok).toBe(true);
  });
});

// ── 4. Random Forest — behavioural (RNG ensemble, not bit-matchable) ──────────
describe("CC-2 — RandomForest behavioural validation", () => {
  it("ensemble beats a single deep tree on held-out MSE and stays in range", () => {
    // Deterministic noisy dataset (seeded RNG — no bare Math.random on compute path).
    // High observation noise + a deep tree ⇒ the single tree overfits (high variance);
    // ALL features are informative so feature-subsampled trees still capture signal, and
    // averaging decorrelated trees reduces variance. This is the regime where bagging wins.
    const rng = makeRng(20260724);
    const N = 220;
    const D = 6;
    const w = [1.8, 1.5, 1.2, 1.0, 0.8, 0.6]; // every feature carries signal
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < N; i++) {
      const row = Array.from({ length: D }, () => gaussian(rng, 0, 1));
      const signal = row.reduce((s, v, j) => s + w[j] * v, 0);
      X.push(row);
      y.push(signal + gaussian(rng, 0, 2)); // observation noise sd=2 (single tree overfits it)
    }
    const nTr = 90;
    const Xtr = X.slice(0, nTr);
    const ytr = y.slice(0, nTr);
    const Xte = X.slice(nTr);
    const yte = y.slice(nTr);

    const tree = new DecisionTree(18); // deep ⇒ memorizes noisy training data
    tree.fit(Xtr, ytr);
    const treeMSE = mse(tree.predict(Xte), yte);

    const rf = new RandomForest(250, 4, 18, 2, 1, 42); // 250 trees, 4/6 feature subsample
    rf.fit(Xtr, ytr);
    const rfPred = rf.predict(Xte);
    const rfMSE = mse(rfPred, yte);

    const yMin = Math.min(...ytr);
    const yMax = Math.max(...ytr);

    // eslint-disable-next-line no-console
    console.info(
      `[RF] single-tree test MSE=${treeMSE.toFixed(4)}  forest test MSE=${rfMSE.toFixed(4)}  (train y∈[${yMin.toFixed(2)}, ${yMax.toFixed(2)}])`,
    );

    // Behavioural claims (NOT bit-vs-sklearn): variance reduction beats one deep tree,
    expect(rfMSE).toBeLessThan(treeMSE);
    // and averaged leaf means stay within the observed training range.
    for (const p of rfPred) {
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(yMin);
      expect(p).toBeLessThanOrEqual(yMax);
    }
  });
});
