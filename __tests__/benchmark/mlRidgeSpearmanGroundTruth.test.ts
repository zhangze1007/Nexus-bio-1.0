/**
 * CC-2 reference benchmark (ML primitives, foundation for the learning-curve
 * experiment): the platform's TS Ridge and a new Spearman must match
 * sklearn / scipy on fixed inputs.
 *
 * Ground truth: benchmarks/reference/ml/ridge_spearman.json
 *   - ridge:   sklearn Ridge coef/intercept/pred_test for alpha∈{0.1,1,10} ×
 *              fit_intercept∈{true,false}, tol 1e-4
 *   - spearman: scipy.stats.spearmanr (average-rank ties): no_ties 0.828571,
 *              with_ties -1.0, tol 1e-4
 *
 * Ridge convention (verified from source): RidgeRegression prepends a bias
 * column and sets reg[0][0]=0, i.e. it fits an *unregularized* intercept and
 * does NOT pre-center — the identical objective to sklearn fit_intercept=True.
 * So it is compared against the fit_intercept=True cases. (If it matched neither
 * True nor False, that would be a real convention bug — asserted, not hidden.)
 *
 * Honesty: tolerances (1e-4) and the fixture are fixed. A mismatch is a real
 * finding, never papered over.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ReferenceCase, runReferenceCase } from "../../src/services/benchmark/referenceRunner";
import { RidgeRegression } from "../../src/modules/ml/models";
import { spearmanCorrelation } from "../../src/modules/ml/spearman";

interface RidgeCase {
  coef: number[];
  intercept: number;
  pred_test: number[];
}
interface Fixture {
  ridge: {
    X: number[][];
    y: number[];
    X_test: number[][];
    cases: Record<string, RidgeCase>;
  };
  spearman: {
    inputs: { no_ties: number[][]; with_ties: number[][] };
    expected: { no_ties: number; with_ties: number };
    tolerance: number;
  };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "benchmarks", "reference", "ml", "ridge_spearman.json"), "utf8"),
) as Fixture;

const RIDGE_TOL = 1e-4;

// Extract intercept and per-feature coefficients from the (linear) model using
// only its public predict() — no source change needed. predict(x) = b + x·w.
function extractLinear(model: RidgeRegression, nFeatures: number): { intercept: number; coef: number[] } {
  const zero = new Array(nFeatures).fill(0);
  const intercept = model.predict([zero])[0];
  const coef = Array.from({ length: nFeatures }, (_, j) => {
    const e = new Array(nFeatures).fill(0);
    e[j] = 1;
    return model.predict([e])[0] - intercept;
  });
  return { intercept, coef };
}

describe("CC-2 benchmark — ML Ridge vs sklearn, Spearman vs scipy", () => {
  const { X, y, X_test, cases } = fixture.ridge;
  const nFeatures = X[0].length;

  it.each([
    ["0.1", 0.1],
    ["1.0", 1.0],
    ["10.0", 10.0],
  ])("RidgeRegression matches sklearn Ridge(fit_intercept=True) at alpha=%s", (label, alpha) => {
    const model = new RidgeRegression(alpha);
    model.fit(X, y);
    const { intercept, coef } = extractLinear(model, nFeatures);
    const predTest = model.predict(X_test);

    const expected = cases[`alpha${label}_fit_interceptTrue`];

    // The repo Ridge fits an intercept ⇒ it must NOT equal the fit_intercept=False
    // solution's zero intercept (sanity that we picked the right convention group).
    expect(Math.abs(intercept)).toBeGreaterThan(0); // fits a real intercept

    const coefRep = runReferenceCase((v: number[]) => v, {
      id: `ridge.a${label}.coef`,
      input: coef,
      expected: expected.coef,
      tolerance: RIDGE_TOL,
      metric: "abs",
      source: "sklearn Ridge",
    });
    const interceptRep = runReferenceCase((v: number) => v, {
      id: `ridge.a${label}.intercept`,
      input: intercept,
      expected: expected.intercept,
      tolerance: RIDGE_TOL,
      metric: "abs",
      source: "sklearn Ridge",
    });
    const predRep = runReferenceCase((v: number[]) => v, {
      id: `ridge.a${label}.pred_test`,
      input: predTest,
      expected: expected.pred_test,
      tolerance: RIDGE_TOL,
      metric: "abs",
      source: "sklearn Ridge",
    });

    // eslint-disable-next-line no-console
    console.info(
      `[T2-RIDGE] alpha=${label} intercept obs=${intercept.toFixed(6)} exp=${expected.intercept} coef=[${coef.map((c) => c.toFixed(6)).join(",")}]`,
    );
    for (const r of [...coefRep, interceptRep[0], ...predRep]) expect(r.ok).toBe(true);
  });

  it("spearmanCorrelation matches scipy.stats.spearmanr (no ties and with ties)", () => {
    const noTies = spearmanCorrelation(fixture.spearman.inputs.no_ties[0], fixture.spearman.inputs.no_ties[1]);
    const withTies = spearmanCorrelation(fixture.spearman.inputs.with_ties[0], fixture.spearman.inputs.with_ties[1]);
    const tol = fixture.spearman.tolerance;

    // eslint-disable-next-line no-console
    console.info(
      `[T2-SPEARMAN] no_ties obs=${noTies.toFixed(6)} exp=${fixture.spearman.expected.no_ties} | with_ties obs=${withTies.toFixed(6)} exp=${fixture.spearman.expected.with_ties}`,
    );

    const c: ReferenceCase<number[], number[]> = {
      id: "spearman",
      input: [noTies, withTies],
      expected: [fixture.spearman.expected.no_ties, fixture.spearman.expected.with_ties],
      tolerance: tol,
      metric: "abs",
      source: "scipy.stats.spearmanr",
    };
    for (const r of runReferenceCase((v: number[]) => v, c)) expect(r.ok).toBe(true);
  });
});
