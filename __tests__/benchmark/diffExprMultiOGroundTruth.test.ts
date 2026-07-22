/**
 * CC-2 reference benchmark (omics cluster, T2): validate the de-stubbed
 * `runDifferentialExpression` against scipy — and honestly surface the statistic
 * it actually uses.
 *
 * Ground truth: benchmarks/reference/omics/diffexpr_ttest.json — two groups A/B,
 * matrixA/matrixB (8 genes × 5 samples), per-gene scipy.stats.ttest_ind(equal_var)
 * t / p-value / log2 fold-change. Tolerances t_abs 0.05 / pvalue_abs 0.02 /
 * log2fc_abs 0.02.
 *
 * FINDING (the statistic-formula inconsistency the goal anticipated):
 *   `runDifferentialExpression` computes a **Mann-Whitney U** rank-sum test by
 *   documented design (multiOmicsPipeline docstring) — its `statistic` is U and
 *   its `pValue` is the rank-sum p, NOT scipy's Student-t t / p. So its t/p
 *   cannot (and should not) equal the parametric fixture by construction. This
 *   is reported, not hidden or tolerance-widened.
 *
 * What is therefore validated here, without changing any default behaviour:
 *   (A) runDifferentialExpression's group means + log2 fold-change match scipy
 *       (the test-independent outputs of the de-stubbed function);
 *   (B) the repo's own t-distribution machinery (`tCDF`, exported for
 *       visibility) reproduces scipy's ttest_ind t / p to tolerance — i.e. the
 *       parametric statistic IS computable correctly from repo primitives.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ReferenceCase, runReferenceCase } from "../../src/services/benchmark/referenceRunner";
import { runDifferentialExpression } from "../../src/services/omics/multiOmicsPipeline";
import { tCDF } from "../../src/utils/statistics";

interface GeneExpected {
  meanA: number;
  meanB: number;
  log2fc: number;
  t: number;
  pvalue: number;
}
interface DiffExprFixture {
  source: string;
  groupA_samples: string[];
  groupB_samples: string[];
  genes: string[];
  matrixA: number[][]; // [gene][sample]
  matrixB: number[][];
  expected: Record<string, GeneExpected>;
  tolerance: { t_abs: number; pvalue_abs: number; log2fc_abs: number };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "benchmarks", "reference", "omics", "diffexpr_ttest.json"), "utf8"),
) as DiffExprFixture;

const mean = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
const sampleVar = (v: number[], m: number): number => v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1);

/** scipy.stats.ttest_ind(a, b, equal_var=True), signed so +t ⇒ higher in B. */
function studentTEqualVar(a: number[], b: number[]): { t: number; p: number } {
  const nA = a.length;
  const nB = b.length;
  const mA = mean(a);
  const mB = mean(b);
  const sp2 = ((nA - 1) * sampleVar(a, mA) + (nB - 1) * sampleVar(b, mB)) / (nA + nB - 2);
  const se = Math.sqrt(sp2 * (1 / nA + 1 / nB));
  const t = (mB - mA) / se;
  const df = nA + nB - 2;
  const p = 2 * (1 - tCDF(Math.abs(t), df)); // uses the repo's t-distribution CDF
  return { t, p };
}

describe("CC-2 benchmark — MultiO differential expression vs scipy", () => {
  const genes = fixture.genes;
  const nGenes = genes.length;

  // Assemble runDifferentialExpression input: data[gene][sample] = A-cols then B-cols.
  const data = genes.map((_, gi) => [...fixture.matrixA[gi], ...fixture.matrixB[gi]]);
  // Unique sample names per group ⇒ no technical-replicate collapsing.
  const sampleNames = [...fixture.groupA_samples, ...fixture.groupB_samples];
  const groups = [...fixture.groupA_samples.map(() => "A"), ...fixture.groupB_samples.map(() => "B")];

  const de = runDifferentialExpression(data, genes, sampleNames, groups);
  const byGene = new Map(de.features.map((f) => [f.feature, f]));

  it("(finding) runDifferentialExpression uses Mann-Whitney U, not the scipy t-test", () => {
    // The de-stubbed function's `statistic` is the Mann-Whitney U — a different
    // test from the parametric fixture. Surface the divergence explicitly.
    const g0 = byGene.get("g0");
    expect(g0).toBeDefined();
    // eslint-disable-next-line no-console
    console.info(
      "[T2-DE] runDifferentialExpression is Mann-Whitney U (rank-sum). g0: U=" +
        `${g0?.statistic} MW-p=${g0?.pValue?.toFixed(4)} vs scipy t=${fixture.expected.g0.t} t-p=${fixture.expected.g0.pvalue}`,
    );
    // It genuinely runs and returns a value per gene.
    expect(byGene.size).toBe(nGenes);
  });

  it("(A) runDifferentialExpression group means match scipy", () => {
    const obsMeanA = genes.map((g) => byGene.get(g)?.meanGroup1 ?? Number.NaN);
    const obsMeanB = genes.map((g) => byGene.get(g)?.meanGroup2 ?? Number.NaN);
    const expMeanA = genes.map((g) => fixture.expected[g].meanA);
    const expMeanB = genes.map((g) => fixture.expected[g].meanB);

    const rA = runReferenceCase((xs: number[]) => xs, {
      id: "de.meanA",
      input: obsMeanA,
      expected: expMeanA,
      tolerance: 1e-3,
      metric: "abs",
      source: fixture.source,
    });
    const rB = runReferenceCase((xs: number[]) => xs, {
      id: "de.meanB",
      input: obsMeanB,
      expected: expMeanB,
      tolerance: 1e-3,
      metric: "abs",
      source: fixture.source,
    });
    for (const r of [...rA, ...rB]) expect(r.ok).toBe(true);
  });

  it("(A) runDifferentialExpression log2 fold-change matches scipy", () => {
    const observed = genes.map((g) => byGene.get(g)?.log2FoldChange ?? Number.NaN);
    const expectedVals = genes.map((g) => fixture.expected[g].log2fc);
    const c: ReferenceCase<number[], number[]> = {
      id: "de.log2fc",
      input: observed,
      expected: expectedVals,
      tolerance: fixture.tolerance.log2fc_abs,
      metric: "abs",
      source: fixture.source,
    };
    const reports = runReferenceCase((xs: number[]) => xs, c);
    let maxDiff = 0;
    for (let i = 0; i < observed.length; i++) maxDiff = Math.max(maxDiff, Math.abs(observed[i] - expectedVals[i]));
    // eslint-disable-next-line no-console
    console.info(`[T2-DE] log2fc maxAbsDiff=${maxDiff.toFixed(5)} (tol ${fixture.tolerance.log2fc_abs})`);
    for (const r of reports) expect(r.ok).toBe(true);
  });

  it("(B) repo t-distribution machinery (tCDF) reproduces scipy ttest_ind t within tol", () => {
    const observed = genes.map((_, gi) => studentTEqualVar(fixture.matrixA[gi], fixture.matrixB[gi]).t);
    const expectedVals = genes.map((g) => fixture.expected[g].t);
    const c: ReferenceCase<number[], number[]> = {
      id: "de.ttest.t",
      input: observed,
      expected: expectedVals,
      tolerance: fixture.tolerance.t_abs,
      metric: "abs",
      source: fixture.source,
    };
    const reports = runReferenceCase((xs: number[]) => xs, c);
    // eslint-disable-next-line no-console
    console.info("[T2-DE] t-stat:", genes.map((g, gi) => `${g}=${observed[gi].toFixed(3)}(exp ${fixture.expected[g].t})`).join(" "));
    for (const r of reports) expect(r.ok).toBe(true);
  });

  it("(B) repo t-distribution machinery (tCDF) reproduces scipy ttest_ind p-value within tol", () => {
    const observed = genes.map((_, gi) => studentTEqualVar(fixture.matrixA[gi], fixture.matrixB[gi]).p);
    const expectedVals = genes.map((g) => fixture.expected[g].pvalue);
    const c: ReferenceCase<number[], number[]> = {
      id: "de.ttest.pvalue",
      input: observed,
      expected: expectedVals,
      tolerance: fixture.tolerance.pvalue_abs,
      metric: "abs",
      source: fixture.source,
    };
    const reports = runReferenceCase((xs: number[]) => xs, c);
    let maxDiff = 0;
    for (let i = 0; i < observed.length; i++) maxDiff = Math.max(maxDiff, Math.abs(observed[i] - expectedVals[i]));
    // eslint-disable-next-line no-console
    console.info(`[T2-DE] t-test p-value maxAbsDiff=${maxDiff.toFixed(5)} (tol ${fixture.tolerance.pvalue_abs})`);
    for (const r of reports) expect(r.ok).toBe(true);
  });
});
