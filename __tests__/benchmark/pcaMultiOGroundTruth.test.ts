/**
 * CC-2 reference benchmark (omics cluster, T2 — first non-metabolic tool): the
 * repo's MultiO PCA (`runPCA`, covariance PCA with Jacobi eigendecomposition)
 * must reproduce a reference PCA on a fixed matrix.
 *
 * Ground truth: benchmarks/reference/omics/pca_smallmatrix.json — a fixed 24×10
 * input matrix, column-center-only preprocessing (no scaling), top-3 component
 * loadings + explained_variance_ratio, and the sign convention "each component's
 * largest-|loading| entry is made positive". Tolerances loading_abs / evr_abs.
 *
 * `runPCA` centers per feature and does NOT scale (verified) — apples-to-apples
 * with the fixture — so it is exercised directly (no algorithm change).
 *
 * Honesty: tolerances and fixture are fixed. A loadings/EVR mismatch is exactly
 * the non-FBA weakness this tier is meant to expose (SVD/eigendecomposition bug
 * or a preprocessing inconsistency) — reported with real numbers, never widened.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ReferenceCase, runReferenceCase } from "../../src/services/benchmark/referenceRunner";
import { runPCA } from "../../src/services/omics/multiOmicsPipeline";

interface PCAFixture {
  source: string;
  preprocessing: string;
  n_samples: number;
  n_genes: number;
  n_components: number;
  sign_convention: string;
  input_matrix: number[][];
  explained_variance_ratio: number[];
  loadings: number[][];
  tolerance: { loading_abs: number; evr_abs: number };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "benchmarks", "reference", "omics", "pca_smallmatrix.json"), "utf8"),
) as PCAFixture;

/** Canonicalize a loading vector's sign: make its largest-|value| entry positive. */
function signNormalize(v: number[]): number[] {
  let maxAbs = -1;
  let maxIdx = 0;
  for (let i = 0; i < v.length; i++) {
    const a = Math.abs(v[i]);
    if (a > maxAbs) {
      maxAbs = a;
      maxIdx = i;
    }
  }
  return v[maxIdx] < 0 ? v.map((x) => -x) : v.slice();
}

const result = runPCA(fixture.input_matrix, fixture.n_components);

describe("CC-2 benchmark — MultiO PCA vs reference (column-center only)", () => {
  it("uses the expected matrix shape and produces top-3 components", () => {
    expect(fixture.input_matrix.length).toBe(fixture.n_samples);
    expect(fixture.input_matrix[0].length).toBe(fixture.n_genes);
    expect(result.loadings.length).toBe(fixture.n_components);
    expect(result.loadings[0].length).toBe(fixture.n_genes);
  });

  it("reproduces the explained variance ratio (top-3) within tolerance", () => {
    const observed = result.varianceExplained.slice(0, fixture.n_components);
    const c: ReferenceCase<number[], number[]> = {
      id: "pca.evr",
      input: observed,
      expected: fixture.explained_variance_ratio,
      tolerance: fixture.tolerance.evr_abs,
      metric: "abs",
      source: fixture.source,
    };
    const reports = runReferenceCase((xs: number[]) => xs, c);
    // eslint-disable-next-line no-console
    console.info(
      `[T2-PCA] EVR observed=[${observed.map((x) => x.toFixed(6)).join(",")}] expected=[${fixture.explained_variance_ratio.join(",")}]`,
    );
    for (const r of reports) expect(r.ok).toBe(true);
  });

  it("reproduces the top-3 loadings within tolerance (after the sign convention)", () => {
    const mineFlat: number[] = [];
    const expFlat: number[] = [];
    for (let k = 0; k < fixture.n_components; k++) {
      mineFlat.push(...signNormalize(result.loadings[k]));
      expFlat.push(...signNormalize(fixture.loadings[k]));
    }

    let maxDiff = 0;
    for (let i = 0; i < mineFlat.length; i++) maxDiff = Math.max(maxDiff, Math.abs(mineFlat[i] - expFlat[i]));

    const c: ReferenceCase<number[], number[]> = {
      id: "pca.loadings",
      input: mineFlat,
      expected: expFlat,
      tolerance: fixture.tolerance.loading_abs,
      metric: "abs",
      source: fixture.source,
    };
    const reports = runReferenceCase((xs: number[]) => xs, c);
    // eslint-disable-next-line no-console
    console.info(`[T2-PCA] loadings maxAbsDiff=${maxDiff.toFixed(5)} (tol ${fixture.tolerance.loading_abs})`);
    for (const r of reports) expect(r.ok).toBe(true);
  });
});
