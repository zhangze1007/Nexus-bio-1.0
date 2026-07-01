/**
 * UMAP Engine — Uniform Manifold Approximation and Projection
 *
 * Nonlinear dimensionality reduction for single-cell data.
 * Implements the core UMAP algorithm:
 *   1. k-NN graph construction (via KD-tree)
 *   2. Fuzzy simplicial set (Gaussian kernel + symmetrization)
 *   3. SGD embedding optimization (cross-entropy loss + negative sampling)
 *
 * @scientific_provenance
 *   ALGORITHM: Uniform Manifold Approximation and Projection (UMAP).
 *     Constructs a k-nearest-neighbor graph via KD-tree, converts it to a
 *     fuzzy simplicial set using per-point Gaussian kernels (sigma found by
 *     binary search to match target sum = log2(k)), symmetrized via
 *     w_ij = w_i + w_j - w_i*w_j. The 2D embedding is optimized by SGD
 *     with attractive forces on positive edges and repulsive negative
 *     sampling, using UMAP's a/b smooth curve parameterization.
 *   REFERENCE: McInnes L, Healy J, Melville J. "UMAP: Uniform Manifold
 *     Approximation and Projection for Dimension Reduction." arXiv preprint
 *     arXiv:1802.03426. 2018.
 *   KNOWN_LIMITATIONS:
 *     - Embedding initialization uses first-2-dimension projection (or random
 *       for small datasets) rather than spectral/Laplacian eigenmap as in
 *       the reference implementation; may converge to poorer local minima.
 *     - The a/b parameter is hardcoded to the default (minDist=0.1, spread=1)
 *       rather than fitted per-invocation via least-squares to the smooth
 *       curve as in the original UMAP.
 *     - Negative sampling is uniformly random; the reference implementation
 *       uses a more efficient edge-sampling strategy.
 *     - KD-tree k-NN is approximate for high-dimensional data; the reference
 *       uses NN-descent for scalability beyond ~10K points.
 */

import { euclideanDistance, KDTreeIndex } from "../utils/knnIndex";
import { SeededRNG } from "../utils/seededRng";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UMAPOptions {
  nNeighbors?: number; // k for k-NN (default 15)
  minDist?: number; // minimum distance in embedding (default 0.1)
  nEpochs?: number; // SGD epochs (default 200)
  learningRate?: number; // SGD learning rate (default 1.0)
  negativeSampleRate?: number; // negatives per positive (default 5)
  seed?: number; // RNG seed for reproducibility
  spread?: number; // effective scale of embedding (default 1.0)
}

export interface UMAPResult {
  embedding: Array<{ x: number; y: number }>;
  nCells: number;
  nEpochs: number;
  convergenceLoss: number;
  knnGraph: Array<Array<{ index: number; distance: number }>>;
}

// ── UMAP Engine ────────────────────────────────────────────────────────────

/**
 * Run UMAP dimensionality reduction.
 *
 * @param data - Input data matrix [nSamples × nFeatures]
 * @param options - UMAP hyperparameters
 * @returns 2D embedding + metadata
 */
export function runUMAP(data: number[][], options: UMAPOptions = {}): UMAPResult {
  const {
    nNeighbors = 15,
    minDist = 0.1,
    nEpochs = 200,
    learningRate = 1.0,
    negativeSampleRate = 5,
    seed = 42,
    spread = 1.0,
  } = options;

  const n = data.length;
  if (n === 0) return { embedding: [], nCells: 0, nEpochs: 0, convergenceLoss: 0, knnGraph: [] };
  if (n === 1) return { embedding: [{ x: 0, y: 0 }], nCells: 1, nEpochs: 0, convergenceLoss: 0, knnGraph: [[]] };

  const rng = new SeededRNG(seed);
  const k = Math.min(nNeighbors, n - 1);

  // Step 1: k-NN graph construction
  const knnGraph = buildKNNGraph(data, k);

  // Step 2: Fuzzy simplicial set (high-dimensional)
  const { sigmas, rhos } = computeSmoothKNNDistances(knnGraph, k);
  const highDimWeights = computeFuzzySimplicialSet(knnGraph, sigmas, rhos);

  // Step 3: Initialize embedding (spectral or random)
  const embedding = initializeEmbedding(data, n, rng);

  // Step 4: SGD optimization
  const { finalEmbedding, convergenceLoss } = optimizeEmbedding(
    embedding,
    highDimWeights,
    knnGraph,
    nEpochs,
    learningRate,
    minDist,
    spread,
    negativeSampleRate,
    rng,
  );

  return {
    embedding: finalEmbedding.map((e, i) => ({ x: e[0], y: e[1] })),
    nCells: n,
    nEpochs,
    convergenceLoss,
    knnGraph: knnGraph.map((neighbors) => neighbors.map((nb) => ({ index: nb.index, distance: nb.distance }))),
  };
}

// ── Step 1: k-NN Graph ─────────────────────────────────────────────────────

interface KNNeighbor {
  index: number;
  distance: number;
}

function buildKNNGraph(data: number[][], k: number): KNNeighbor[][] {
  const tree = new KDTreeIndex(data);
  const graph: KNNeighbor[][] = [];

  for (let i = 0; i < data.length; i++) {
    const neighbors = tree.query(data[i], k + 1); // +1 because self is included
    graph.push(
      neighbors
        .filter((nb) => nb.distance > 0) // exclude self
        .slice(0, k)
        .map((nb) => ({
          index: data.indexOf(nb.point),
          distance: nb.distance,
        })),
    );
  }

  return graph;
}

// ── Step 2: Fuzzy Simplicial Set ───────────────────────────────────────────

function computeSmoothKNNDistances(knnGraph: KNNeighbor[][], k: number): { sigmas: number[]; rhos: number[] } {
  const n = knnGraph.length;
  const sigmas: number[] = new Array(n).fill(1.0);
  const rhos: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const neighbors = knnGraph[i];
    if (neighbors.length === 0) continue;

    // rho = distance to nearest neighbor
    rhos[i] = neighbors[0].distance;

    // sigma = distance to k-th neighbor (scaled)
    // UMAP uses a binary search to find sigma such that
    // Σ exp(-(d_ij - rho_i) / sigma) = log2(k)
    // Use k-th neighbor distance
    const target = Math.log2(Math.max(k, 1));
    const kthDist = neighbors[Math.min(neighbors.length - 1, k - 1)].distance;

    // Binary search for sigma
    let lo = 1e-10;
    let hi = kthDist * 3;
    for (let iter = 0; iter < 32; iter++) {
      const mid = (lo + hi) / 2;
      let sum = 0;
      for (const nb of neighbors) {
        const d = nb.distance - rhos[i];
        if (d > 0) sum += Math.exp(-d / mid);
      }
      if (sum > target) lo = mid;
      else hi = mid;
    }
    sigmas[i] = (lo + hi) / 2;
  }

  return { sigmas, rhos };
}

function computeFuzzySimplicialSet(knnGraph: KNNeighbor[][], sigmas: number[], rhos: number[]): Map<string, number> {
  const weights = new Map<string, number>();
  const n = knnGraph.length;

  for (let i = 0; i < n; i++) {
    for (const nb of knnGraph[i]) {
      const j = nb.index;
      const d = nb.distance;
      const rho = rhos[i];
      const sigma = sigmas[i];

      // High-dimensional weight
      let w = 0;
      if (d > rho) {
        w = Math.exp(-(d - rho) / sigma);
      } else {
        w = 1; // within rho distance
      }

      const key = `${Math.min(i, j)}:${Math.max(i, j)}`;
      const existing = weights.get(key) ?? 0;
      // Symmetrize: w_ij = w_i + w_j - w_i * w_j
      weights.set(key, existing + w - existing * w);
    }
  }

  return weights;
}

// ── Step 3: Embedding Initialization ────────────────────────────────────────

function initializeEmbedding(data: number[][], n: number, rng: SeededRNG): number[][] {
  // Simple PCA-like initialization using first 2 principal components
  // For small datasets, random initialization works fine
  if (n < 100) {
    return Array.from({ length: n }, () => [(rng.next() - 0.5) * 20, (rng.next() - 0.5) * 20]);
  }

  // For larger datasets, use a simple spectral initialization
  // Compute centroid and spread
  const dim = data[0]?.length ?? 0;
  const centroid = new Array(dim).fill(0);
  for (const point of data) {
    for (let d = 0; d < dim; d++) centroid[d] += point[d];
  }
  for (let d = 0; d < dim; d++) centroid[d] /= n;

  // Project onto first 2 dimensions (simple but effective for initialization)
  return data.map((point) => [(point[0] - centroid[0]) * 10, (point[1] - centroid[1]) * 10]);
}

// ── Step 4: SGD Optimization ────────────────────────────────────────────────

function optimizeEmbedding(
  embedding: number[][],
  highDimWeights: Map<string, number>,
  knnGraph: KNNeighbor[][],
  nEpochs: number,
  learningRate: number,
  minDist: number,
  spread: number,
  negativeSampleRate: number,
  rng: SeededRNG,
): { finalEmbedding: number[][]; convergenceLoss: number } {
  const n = embedding.length;
  const dim = 2;

  // Convert minDist to UMAP's a/b parameters
  // UMAP uses: w = 1 / (1 + a * d^(2*b))
  // For spread=1, minDist=0.1: a ≈ 1.577, b ≈ 0.893
  const [a, b] = findAB(minDist, spread);

  // Build edge list from high-dimensional weights
  const edges: Array<{ i: number; j: number; weight: number }> = [];
  for (const [key, weight] of highDimWeights) {
    const [si, sj] = key.split(":");
    const i = parseInt(si);
    const j = parseInt(sj);
    if (i < n && j < n && weight > 0) {
      edges.push({ i, j, weight });
    }
  }

  if (edges.length === 0) {
    return { finalEmbedding: embedding, convergenceLoss: 1.0 };
  }

  // SGD epochs
  let totalLoss = 0;
  for (let epoch = 0; epoch < nEpochs; epoch++) {
    const alpha = learningRate * (1 - epoch / nEpochs); // linear decay
    let epochLoss = 0;

    // Positive edges (attractive)
    for (const edge of edges) {
      const { i, j, weight } = edge;
      const dx = embedding[i][0] - embedding[j][0];
      const dy = embedding[i][1] - embedding[j][1];
      const dist = Math.sqrt(dx * dx + dy * dy) + 1e-10;

      // Attractive gradient (UMAP paper eq. 4)
      const gradCoeff = (-2 * a * b * dist ** (2 * b - 1)) / (1 + a * dist ** (2 * b));
      const gx = (gradCoeff * dx) / dist;
      const gy = (gradCoeff * dy) / dist;

      embedding[i][0] -= alpha * weight * gx;
      embedding[i][1] -= alpha * weight * gy;
      embedding[j][0] += alpha * weight * gx;
      embedding[j][1] += alpha * weight * gy;

      epochLoss += weight * dist;
    }

    // Negative sampling (repulsive)
    // UMAP uses negativeSampleRate negatives per positive edge per epoch
    const nNegatives = Math.floor(edges.length * negativeSampleRate);
    for (let neg = 0; neg < nNegatives; neg++) {
      const i = Math.floor(rng.next() * n);
      const j = Math.floor(rng.next() * n);
      if (i === j) continue;

      const dx = embedding[i][0] - embedding[j][0];
      const dy = embedding[i][1] - embedding[j][1];
      const dist = Math.sqrt(dx * dx + dy * dy) + 1e-10;

      // Repulsive gradient (only for close points)
      if (dist < 2 * spread) {
        const gradCoeff = 2 / (dist * dist + 1e-10);
        const gx = (gradCoeff * dx) / dist;
        const gy = (gradCoeff * dy) / dist;

        embedding[i][0] += alpha * 0.01 * gx;
        embedding[i][1] += alpha * 0.01 * gy;
      }
    }

    totalLoss = epochLoss / edges.length;
  }

  return { finalEmbedding: embedding, convergenceLoss: totalLoss };
}

/**
 * Find UMAP's a/b parameters from minDist and spread by least-squares fit.
 *
 * Ports UMAP's `find_ab_params` (McInnes et al. 2018): fit the smooth curve
 *   w(x) = 1 / (1 + a * x^(2*b))
 * to the piecewise target
 *   y(x) = 1                              for x < minDist
 *   y(x) = exp(-(x - minDist) / spread)   for x >= minDist
 * sampled on x = linspace(0, spread*3, 300), using a Levenberg–Marquardt
 * nonlinear least-squares solve for (a, b).
 *
 * For minDist=0.1, spread=1.0 this reproduces the canonical a ≈ 1.577,
 * b ≈ 0.895. Unlike the previous implementation, the result genuinely depends
 * on both inputs.
 *
 * @returns [a, b] parameters for the UMAP curve
 */
export function findAB(minDist: number, spread: number): [number, number] {
  const N = 300;
  const xs: number[] = new Array(N);
  const ys: number[] = new Array(N);
  const xmax = spread * 3;
  for (let i = 0; i < N; i++) {
    const x = (xmax * i) / (N - 1);
    xs[i] = x;
    ys[i] = x < minDist ? 1.0 : Math.exp(-(x - minDist) / spread);
  }

  // Model and analytic partial derivatives.
  //   f(x) = 1 / (1 + a * x^(2b)),  u = a * x^(2b)
  //   df/da = -x^(2b) / (1+u)^2
  //   df/db = -(u * 2 ln x) / (1+u)^2        (0 at x = 0)
  const model = (x: number, a: number, b: number): number => {
    if (x <= 0) return 1.0;
    return 1.0 / (1.0 + a * Math.pow(x, 2 * b));
  };

  let a = 1.0;
  let b = 1.0;
  let lambda = 1e-3;

  const sse = (aa: number, bb: number): number => {
    let s = 0;
    for (let i = 0; i < N; i++) {
      const r = model(xs[i], aa, bb) - ys[i];
      s += r * r;
    }
    return s;
  };

  let err = sse(a, b);

  for (let iter = 0; iter < 200; iter++) {
    // Gauss-Newton normal equations J^T J and J^T r (2x2), with LM damping.
    let jtj00 = 0,
      jtj01 = 0,
      jtj11 = 0;
    let jtr0 = 0,
      jtr1 = 0;
    for (let i = 0; i < N; i++) {
      const x = xs[i];
      if (x <= 0) continue; // derivatives are 0 and residual is 0 at x=0
      const xb = Math.pow(x, 2 * b);
      const u = a * xb;
      const denom = (1 + u) * (1 + u);
      const da = -xb / denom;
      const db = -(u * 2 * Math.log(x)) / denom;
      const r = model(x, a, b) - ys[i];
      jtj00 += da * da;
      jtj01 += da * db;
      jtj11 += db * db;
      jtr0 += da * r;
      jtr1 += db * r;
    }

    // Solve (J^T J + lambda*diag) delta = -J^T r
    let solved = false;
    for (let tries = 0; tries < 30 && !solved; tries++) {
      const m00 = jtj00 * (1 + lambda);
      const m11 = jtj11 * (1 + lambda);
      const m01 = jtj01;
      const det = m00 * m11 - m01 * m01;
      if (Math.abs(det) < 1e-30) {
        lambda *= 10;
        continue;
      }
      const da = (-jtr0 * m11 + jtr1 * m01) / det;
      const db = (-jtr1 * m00 + jtr0 * m01) / det;
      const na = a + da;
      const nb = b + db;
      const newErr = sse(na, nb);
      if (newErr < err && na > 0 && nb > 0) {
        a = na;
        b = nb;
        err = newErr;
        lambda = Math.max(lambda * 0.5, 1e-12);
        solved = true;
      } else {
        lambda *= 10;
      }
    }
    if (!solved) break; // converged / cannot improve
  }

  return [a, b];
}
