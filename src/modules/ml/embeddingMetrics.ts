/**
 * Embedding-quality metrics for behavioural validation of dimensionality
 * reduction (UMAP/PCA/t-SNE). These are deterministic and match scikit-learn's
 * definitions so an embedding can be scored against a known floor.
 *
 * - `trustworthiness` = sklearn.manifold.trustworthiness: how well the LOCAL
 *   neighbour structure of the original space is preserved in the embedding.
 * - `silhouette` = sklearn.metrics.silhouette_score (euclidean): how separated
 *   labelled clusters are in the embedding.
 *
 * References: Venna & Kaski (2001) for trustworthiness; Rousseeuw (1987) for the
 * silhouette coefficient.
 */

import { pearsonCorrelation } from "./spearman";

/**
 * Factor-recovery score for latent-variable models (MOFA+/PCA/ICA). Latent
 * factors are only identifiable up to sign and permutation, so for each TRUE
 * factor (a column of `trueFactors`) we report the best |Pearson correlation|
 * over all ESTIMATED factor columns. Higher = better recovery; 1 = perfect.
 *
 * @param trueFactors [samples x nTrue]
 * @param estFactors  [samples x nEst]
 * @returns length-nTrue array: best |corr| match for each true factor.
 */
export function bestAbsCorrPerFactor(trueFactors: number[][], estFactors: number[][]): number[] {
  if (trueFactors.length !== estFactors.length) throw new Error("factor matrices must have the same number of rows");
  const nTrue = trueFactors[0]?.length ?? 0;
  const nEst = estFactors[0]?.length ?? 0;
  const col = (M: number[][], c: number) => M.map((row) => row[c]);
  const out: number[] = [];
  for (let t = 0; t < nTrue; t++) {
    const tc = col(trueFactors, t);
    let best = 0;
    for (let e = 0; e < nEst; e++) {
      const c = Math.abs(pearsonCorrelation(tc, col(estFactors, e)));
      if (Number.isFinite(c) && c > best) best = c;
    }
    out.push(best);
  }
  return out;
}

/** Euclidean distance between two equal-length vectors. */
export function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/**
 * scikit-learn `trustworthiness(X, X_embedded, n_neighbors=k)`.
 *
 * For each point, take its k nearest neighbours in the EMBEDDING; any that are
 * NOT within the k nearest in the ORIGINAL space are penalised by how far their
 * original-space rank exceeds k. Self is excluded (original rank: nearest
 * other = 1, …, self = n).
 *
 *   T(k) = 1 - (2 / (n·k·(2n - 3k - 1))) · Σ_i Σ_{j∈U_i} (rank_X(i,j) - k)
 *
 * where U_i = embedding-k-NN(i) with rank_X(i,j) > k. T ∈ [0,1], higher = better.
 */
export function trustworthiness(X: number[][], embedding: number[][], k: number): number {
  const n = X.length;
  if (n !== embedding.length) throw new Error("X and embedding must have the same number of rows");
  if (k < 1 || k >= n) throw new Error(`n_neighbors (${k}) must satisfy 1 <= k < n (${n})`);

  let penalty = 0;
  for (let i = 0; i < n; i++) {
    // Original-space ranks from i: nearest other = 1, …, self = n (self last, dist ∞).
    const ordX: Array<{ idx: number; d: number }> = new Array(n);
    for (let j = 0; j < n; j++) ordX[j] = { idx: j, d: i === j ? Number.POSITIVE_INFINITY : euclidean(X[i], X[j]) };
    ordX.sort((a, b) => a.d - b.d || a.idx - b.idx);
    const rankX = new Array<number>(n);
    for (let p = 0; p < n; p++) rankX[ordX[p].idx] = p + 1; // 1-based

    // k nearest neighbours of i in the embedding (excluding self).
    const ordE: Array<{ idx: number; d: number }> = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      ordE.push({ idx: j, d: euclidean(embedding[i], embedding[j]) });
    }
    ordE.sort((a, b) => a.d - b.d || a.idx - b.idx);

    for (let p = 0; p < k; p++) {
      const r = rankX[ordE[p].idx];
      if (r > k) penalty += r - k;
    }
  }

  const denom = n * k * (2 * n - 3 * k - 1);
  return 1 - (2 / denom) * penalty;
}

/**
 * scikit-learn `silhouette_score(embedding, labels)` (euclidean, unweighted mean
 * of per-sample silhouette coefficients).
 *
 *   s(i) = (b(i) - a(i)) / max(a(i), b(i)),  singleton cluster ⇒ s(i) = 0
 *
 * a(i) = mean distance to other points in i's cluster;
 * b(i) = min over other clusters of the mean distance from i to that cluster.
 */
export function silhouette(embedding: number[][], labels: number[]): number {
  const n = embedding.length;
  if (n !== labels.length) throw new Error("embedding and labels must have the same length");

  const byLabel = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const arr = byLabel.get(labels[i]);
    if (arr) arr.push(i);
    else byLabel.set(labels[i], [i]);
  }
  if (byLabel.size < 2) throw new Error("silhouette requires at least 2 labels");

  // Pairwise distance matrix (symmetric).
  const D: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = euclidean(embedding[i], embedding[j]);
      D[i][j] = d;
      D[j][i] = d;
    }
  }

  let total = 0;
  for (let i = 0; i < n; i++) {
    const own = byLabel.get(labels[i]) as number[];
    if (own.length === 1) continue; // s(i) = 0

    let aSum = 0;
    for (const j of own) if (j !== i) aSum += D[i][j];
    const a = aSum / (own.length - 1);

    let b = Number.POSITIVE_INFINITY;
    for (const [c, idxs] of byLabel) {
      if (c === labels[i]) continue;
      let sum = 0;
      for (const j of idxs) sum += D[i][j];
      const mean = sum / idxs.length;
      if (mean < b) b = mean;
    }

    total += (b - a) / Math.max(a, b);
  }
  return total / n;
}
