/**
 * CC-2 behavioural benchmark — can MultiO's MOFA+ (src/server/mofaPlus.ts)
 * recover the true latent factors from multi-omics data?
 *
 * MOFA+ is variational/optimisation-based, so (like UMAP) it is validated
 * behaviourally, not value-by-value. Ground truth: two views generated from 2
 * known factors Z as V_v = Z·W_vᵀ + 0.3·noise (benchmarks/reference/ml/
 * mofa_factor_recovery.json).
 *
 * Factors are identifiable only up to sign + permutation, so for each TRUE
 * factor we take the best |Pearson corr| over the estimated factors. Acceptance:
 * each true factor's best |corr| ≥ 0.80. A concat-PCA baseline recovers them at
 * |corr| = [0.895, 0.821] — the capability reference.
 *
 * Honesty: thresholds + fixture are fixed. If MOFA+ cannot recover the factors
 * (best |corr| well under 0.80, or below the PCA baseline), that is a real
 * finding to report + diagnose (variational-update bug, init, or a linear
 * placeholder) — never softened by relaxing the bar, editing the fixture, or
 * cherry-picking a seed (the engine's seed is fixed at 42 internally anyway).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bestAbsCorrPerFactor } from "../../src/modules/ml/embeddingMetrics";
import { type MOFAResult, runMOFA } from "../../src/server/mofaPlus";

interface Fixture {
  design: { n_samples: number; n_factors: number; noise_sd: number };
  true_factors: number[][];
  view1: number[][];
  view2: number[][];
  reference_check: { pca_abs_corr_per_factor: number[] };
  acceptance: { min_abs_corr_per_true_factor: number };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "benchmarks", "reference", "ml", "mofa_factor_recovery.json"), "utf8"),
) as Fixture;

const views = { view1: fixture.view1, view2: fixture.view2 };

/** Total variance explained by the full Z·Wᵀ reconstruction of a view (R², mean-centred). */
function totalVE(Y: number[][], result: MOFAResult, viewName: string): number {
  const Z = result.factors;
  const W = result.loadings[viewName]; // [features x factors]
  const nS = Y.length;
  const nf = Y[0].length;
  const k = Z[0].length;
  const mean = new Array(nf).fill(0);
  for (let i = 0; i < nS; i++) for (let j = 0; j < nf; j++) mean[j] += Y[i][j];
  for (let j = 0; j < nf; j++) mean[j] /= nS;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < nS; i++) {
    for (let j = 0; j < nf; j++) {
      let pred = 0;
      for (let a = 0; a < k; a++) pred += Z[i][a] * W[j][a];
      const centered = Y[i][j] - mean[j];
      ssRes += (centered - pred) * (centered - pred);
      ssTot += centered * centered;
    }
  }
  return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

describe("CC-2 — MOFA+ latent factor recovery", () => {
  const minCorr = fixture.acceptance.min_abs_corr_per_true_factor;
  const pca = fixture.reference_check.pca_abs_corr_per_factor;

  it(`recovers each true factor with best |corr| ≥ ${minCorr}`, () => {
    const result = runMOFA({ views, nFactors: fixture.design.n_factors });
    const scores = bestAbsCorrPerFactor(fixture.true_factors, result.factors);

    // eslint-disable-next-line no-console
    console.info(
      `[MOFA] best |corr| per true factor = [${scores.map((s) => s.toFixed(4)).join(", ")}]  ` +
        `| concat-PCA baseline = [${pca.join(", ")}]  | need ≥ ${minCorr}`,
    );

    expect(scores.length).toBe(fixture.true_factors[0].length);
    for (const s of scores) expect(s).toBeGreaterThanOrEqual(minCorr);
  });

  it("variance explained is in [0,1] and total VE is non-decreasing in the number of factors", () => {
    const res2 = runMOFA({ views, nFactors: 2 });
    for (const vn of Object.keys(views)) {
      for (const r2 of res2.varianceExplained[vn]) {
        expect(r2).toBeGreaterThanOrEqual(0);
        expect(r2).toBeLessThanOrEqual(1);
      }
    }

    // Total reconstruction VE per view should not decrease as capacity grows.
    const ks = [1, 2, 3];
    const veByK = ks.map((k) => {
      const r = runMOFA({ views, nFactors: k });
      return { view1: totalVE(fixture.view1, r, "view1"), view2: totalVE(fixture.view2, r, "view2") };
    });
    // eslint-disable-next-line no-console
    console.info(
      `[MOFA] total VE by nFactors ${JSON.stringify(ks)}: ` +
        `view1=[${veByK.map((v) => v.view1.toFixed(4)).join(", ")}] view2=[${veByK.map((v) => v.view2.toFixed(4)).join(", ")}]`,
    );
    for (const vn of ["view1", "view2"] as const) {
      for (let i = 1; i < veByK.length; i++) {
        expect(veByK[i][vn]).toBeGreaterThanOrEqual(veByK[i - 1][vn] - 1e-9);
        expect(veByK[i][vn]).toBeGreaterThanOrEqual(0);
        expect(veByK[i][vn]).toBeLessThanOrEqual(1);
      }
    }
  });
});
