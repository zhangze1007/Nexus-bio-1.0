/**
 * UPGMA hierarchical clustering.
 *
 * Unweighted Pair Group Method with Arithmetic Mean (UPGMA) — a bottom-up
 * agglomerative clustering algorithm. Produces an ultrametric tree (all leaves
 * equidistant from the root) commonly used in phylogenetics and heatmap
 * dendrogram ordering.
 *
 * @scientific_provenance
 * VALIDITY_TIER: real (UPGMA algorithm, Euclidean distance)
 *
 * References:
 *   - Sokal & Michener (1958) "A statistical method for evaluating systematic
 *     relationships" — original UPGMA formulation
 *   - Jain & Dubes (1988) "Algorithms for Clustering Data" — algorithm analysis
 */

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * Binary tree node produced by UPGMA clustering.
 * Leaf nodes have `index` and `label`; internal nodes have `left` and `right`.
 */
export interface ClusterNode {
  /** Left child (only for internal nodes). */
  left?: ClusterNode;
  /** Right child (only for internal nodes). */
  right?: ClusterNode;
  /** Merge distance (height in the dendrogram). */
  distance: number;
  /** Original data index (only for leaf nodes). */
  index?: number;
  /** Human-readable label (only for leaf nodes). */
  label?: string;
  /** Number of leaf descendants — used by weighted linkage variants. */
  count: number;
}

// ── Euclidean distance matrix ────────────────────────────────────────────────

/**
 * Compute the pairwise Euclidean distance matrix for a set of data vectors.
 *
 * @param data - Array of numeric vectors (each row is one observation).
 * @returns Symmetric n x n distance matrix where d[i][j] = ||data[i] - data[j]||.
 */
export function calculateDistanceMatrix(data: number[][]): number[][] {
  const n = data.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let sumSq = 0;
      const dim = Math.min(data[i].length, data[j].length);
      for (let k = 0; k < dim; k++) {
        const diff = data[i][k] - data[j][k];
        sumSq += diff * diff;
      }
      const dist = Math.sqrt(sumSq);
      matrix[i][j] = dist;
      matrix[j][i] = dist;
    }
  }

  return matrix;
}

// ── UPGMA ────────────────────────────────────────────────────────────────────

/**
 * Perform UPGMA agglomerative clustering on a precomputed distance matrix.
 *
 * Algorithm:
 *   1. Start with each observation as its own cluster.
 *   2. Find the pair of clusters with the smallest distance.
 *   3. Merge them into a new cluster; set merge distance to half the pair distance.
 *   4. Recompute distances from the new cluster to all others using the
 *      UPGMA formula: d(new, k) = (n_i * d(i,k) + n_j * d(j,k)) / (n_i + n_j)
 *   5. Repeat until one cluster remains.
 *
 * @param distanceMatrix - Symmetric n x n distance matrix.
 * @param labels - Optional labels for leaf nodes.
 * @returns Root ClusterNode of the dendrogram.
 */
export function upgma(distanceMatrix: number[][], labels?: string[]): ClusterNode {
  const n = distanceMatrix.length;
  if (n === 0) {
    throw new Error("UPGMA requires at least one data point.");
  }
  if (n === 1) {
    return { distance: 0, index: 0, label: labels?.[0], count: 1 };
  }

  // Deep-copy the distance matrix so we don't mutate the caller's data.
  const dist: number[][] = distanceMatrix.map((row) => row.slice());

  // Initialize: each observation is a leaf cluster.
  const clusters: ClusterNode[] = Array.from({ length: n }, (_, i) => ({
    distance: 0,
    index: i,
    label: labels?.[i],
    count: 1,
  }));

  // Active cluster indices (shrinks as we merge).
  const active: number[] = Array.from({ length: n }, (_, i) => i);

  // We'll store distances in a flat map for O(1) lookup: "min,max" -> dist.
  // But since n is typically small for heatmap use, we keep the full matrix
  // and update rows/columns in-place.

  while (active.length > 1) {
    // 1. Find the closest pair among active clusters.
    let minDist = Infinity;
    let minI = -1;
    let minJ = -1;

    for (let ai = 0; ai < active.length; ai++) {
      for (let aj = ai + 1; aj < active.length; aj++) {
        const ci = active[ai];
        const cj = active[aj];
        if (dist[ci][cj] < minDist) {
          minDist = dist[ci][cj];
          minI = ai;
          minJ = aj;
        }
      }
    }

    const ci = active[minI];
    const cj = active[minJ];

    // 2. Create merged cluster (distance = half the pair distance for ultrametric).
    const merged: ClusterNode = {
      left: clusters[ci],
      right: clusters[cj],
      distance: minDist / 2,
      count: clusters[ci].count + clusters[cj].count,
    };

    // 3. Reuse the ci slot for the merged cluster.
    clusters[ci] = merged;

    // 4. Recompute distances from the merged cluster to all other active clusters.
    const ni = clusters[ci].count;
    // cj's old count before merge was ni - merged.count, but since we already
    // updated, we need the original counts. They are: ni_before = left.count,
    // nj_before = right.count.
    const niBefore = merged.left!.count;
    const njBefore = merged.right!.count;

    for (let ak = 0; ak < active.length; ak++) {
      const ck = active[ak];
      if (ck === ci || ck === cj) continue;
      // UPGMA linkage: weighted average of distances.
      const newDist = (niBefore * dist[ci][ck] + njBefore * dist[cj][ck]) / (niBefore + njBefore);
      dist[ci][ck] = newDist;
      dist[ck][ci] = newDist;
    }

    // 5. Remove cj from active list.
    active.splice(minJ, 1);
  }

  return clusters[active[0]];
}

// ── Dendrogram leaf order ────────────────────────────────────────────────────

/**
 * Extract the leaf order from a ClusterNode tree (in-order traversal).
 * This ordering groups similar observations together — suitable for heatmap
 * row/column reordering.
 *
 * @param root - Root of the dendrogram.
 * @returns Array of original data indices in dendrogram order.
 */
export function getLeafOrder(root: ClusterNode): number[] {
  const result: number[] = [];

  function walk(node: ClusterNode): void {
    if (node.index !== undefined) {
      result.push(node.index);
      return;
    }
    if (node.left) walk(node.left);
    if (node.right) walk(node.right);
  }

  walk(root);
  return result;
}

/**
 * Extract leaf labels from a ClusterNode tree (in-order traversal).
 *
 * @param root - Root of the dendrogram.
 * @returns Array of labels in dendrogram order.
 */
export function getLeafLabels(root: ClusterNode): string[] {
  const result: string[] = [];

  function walk(node: ClusterNode): void {
    if (node.label !== undefined) {
      result.push(node.label);
      return;
    }
    if (node.left) walk(node.left);
    if (node.right) walk(node.right);
  }

  walk(root);
  return result;
}

/**
 * Get the maximum distance in the dendrogram (root distance).
 * Used for scaling dendrogram axes.
 *
 * @param root - Root of the dendrogram.
 * @returns Maximum merge distance.
 */
export function getMaxDistance(root: ClusterNode): number {
  let max = root.distance;
  function walk(node: ClusterNode): void {
    if (node.distance > max) max = node.distance;
    if (node.left) walk(node.left);
    if (node.right) walk(node.right);
  }
  walk(root);
  return max;
}
