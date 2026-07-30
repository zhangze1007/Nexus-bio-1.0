/**
 * CC-2 behavioural benchmark — is MultiO's TS UMAP (src/server/umapEngine.ts)
 * really doing NONLINEAR dimensionality reduction?
 *
 * UMAP is stochastic/optimisation-based, so it cannot be matched value-by-value
 * against sklearn. Instead we validate behaviourally with two deterministic
 * embedding-quality metrics (embeddingMetrics.ts), which are FIRST pinned to
 * scikit-learn on the fixture's PCA embeddings:
 *   - trustworthiness(swiss X, swiss PCA, k=15) == 0.8775   (tol 1e-3)
 *   - silhouette(blobs PCA, labels)             == 0.565    (tol 1e-3)
 * If a metric is wrong nothing downstream counts, so these are the gate.
 *
 * Then, with a fixed seed:
 *   - swiss-roll UMAP trustworthiness(k=15) must exceed 0.90 AND the PCA floor
 *     0.8775 — i.e. it preserves the nonlinear manifold's local neighbours
 *     BETTER than linear PCA.
 *   - blobs UMAP silhouette must exceed 0.45 — the 4 clusters stay separable.
 *
 * Honesty: thresholds + fixture are fixed. If UMAP cannot beat the PCA floor or
 * reach 0.90, that is a real finding (the engine's simplification is too lossy),
 * reported as-is — never softened.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { silhouette, trustworthiness } from "../../src/modules/ml/embeddingMetrics";
import { runUMAP } from "../../src/server/umapEngine";

interface Fixture {
  metric_check: {
    swiss_pca_embedding: number[][];
    swiss_trustworthiness_k15: number;
    blobs_pca_embedding: number[][];
    blobs_labels: number[];
    blobs_silhouette: number;
  };
  swiss_roll: {
    X: number[][];
    acceptance: { umap_trustworthiness_k15_min: number; must_exceed_pca_floor: number };
  };
  blobs: { X: number[][]; labels: number[]; acceptance: { umap_silhouette_min: number } };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "benchmarks", "reference", "ml", "umap_behavioral.json"), "utf8"),
) as Fixture;

describe("CC-2 — embedding metrics reproduce sklearn on PCA embeddings (the gate)", () => {
  it("trustworthiness(swiss X, swiss PCA, k=15) matches sklearn 0.8775", () => {
    const t = trustworthiness(fixture.swiss_roll.X, fixture.metric_check.swiss_pca_embedding, 15);
    // eslint-disable-next-line no-console
    console.info(`[METRIC] swiss PCA trustworthiness_k15 obs=${t.toFixed(6)} exp=${fixture.metric_check.swiss_trustworthiness_k15}`);
    expect(Math.abs(t - fixture.metric_check.swiss_trustworthiness_k15)).toBeLessThan(1e-3);
  });

  it("silhouette(blobs PCA, labels) matches sklearn 0.565", () => {
    const s = silhouette(fixture.metric_check.blobs_pca_embedding, fixture.metric_check.blobs_labels);
    // eslint-disable-next-line no-console
    console.info(`[METRIC] blobs PCA silhouette obs=${s.toFixed(6)} exp=${fixture.metric_check.blobs_silhouette}`);
    expect(Math.abs(s - fixture.metric_check.blobs_silhouette)).toBeLessThan(1e-3);
  });
});

describe("CC-2 — TS UMAP behavioural validation (fixed seed)", () => {
  it("swiss-roll UMAP trustworthiness(k=15) > 0.90 and > PCA floor 0.8775", () => {
    const res = runUMAP(fixture.swiss_roll.X, { nNeighbors: 15, seed: 42 });
    const emb = res.embedding.map((e) => [e.x, e.y]);
    const t = trustworthiness(fixture.swiss_roll.X, emb, 15);
    const { umap_trustworthiness_k15_min: min, must_exceed_pca_floor: floor } = fixture.swiss_roll.acceptance;
    // eslint-disable-next-line no-console
    console.info(`[UMAP] swiss trustworthiness_k15 obs=${t.toFixed(6)}  (need > ${min} AND > PCA ${floor})`);
    expect(t).toBeGreaterThan(floor);
    expect(t).toBeGreaterThan(min);
  });

  it("blobs UMAP silhouette > 0.45", () => {
    const res = runUMAP(fixture.blobs.X, { nNeighbors: 15, seed: 42 });
    const emb = res.embedding.map((e) => [e.x, e.y]);
    const s = silhouette(emb, fixture.blobs.labels);
    const min = fixture.blobs.acceptance.umap_silhouette_min;
    // eslint-disable-next-line no-console
    console.info(`[UMAP] blobs silhouette obs=${s.toFixed(6)}  (need > ${min})`);
    expect(s).toBeGreaterThan(min);
  });
});
