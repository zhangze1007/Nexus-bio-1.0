/**
 * K-d Tree KNN Index
 *
 * A k-dimensional tree for efficient nearest-neighbor queries.
 * Build: O(n log n) average, Query: O(log n) average for k=1, O(k log n) for small k.
 */

export interface KDNode {
  point: number[];
  left: KDNode | null;
  right: KDNode | null;
  axis: number;
}

export interface NeighborResult {
  point: number[];
  distance: number;
}

/**
 * Euclidean distance between two points of equal dimensionality.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * K-d tree index for k-nearest-neighbor queries.
 */
export class KDTreeIndex {
  private root: KDNode | null;
  private _size: number;

  constructor(points: number[][]) {
    this._size = points.length;
    this.root = points.length > 0 ? this.build(points, 0) : null;
  }

  /**
   * Number of points in the index.
   */
  size(): number {
    return this._size;
  }

  /**
   * Recursively build a k-d tree from the given points at the given depth.
   */
  private build(points: number[][], depth: number): KDNode | null {
    if (points.length === 0) return null;

    const axis = depth % (points[0]?.length ?? 1);
    points.sort((a, b) => a[axis] - b[axis]);

    const mid = Math.floor(points.length / 2);

    return {
      point: points[mid],
      axis,
      left: this.build(points.slice(0, mid), depth + 1),
      right: this.build(points.slice(mid + 1), depth + 1),
    };
  }

  /**
   * Query the k nearest neighbors to the target point.
   * Returns results sorted by distance (ascending).
   */
  query(target: number[], k: number): NeighborResult[] {
    if (!this.root || k <= 0) return [];

    // Use a max-heap (array-based) to track the k closest neighbors.
    const best: NeighborResult[] = [];
    const bestDistances: number[] = [];

    const insertBest = (point: number[], dist: number) => {
      if (best.length < k) {
        // Insert in sorted position (ascending by distance)
        let idx = bestDistances.findIndex((d) => d > dist);
        if (idx === -1) idx = best.length;
        best.splice(idx, 0, { point, distance: dist });
        bestDistances.splice(idx, 0, dist);
      } else if (dist < bestDistances[best.length - 1]) {
        // Replace the worst (last) entry
        let idx = bestDistances.findIndex((d) => d > dist);
        if (idx === -1) idx = best.length - 1;
        best.splice(idx, 0, { point, distance: dist });
        bestDistances.splice(idx, 0, dist);
        best.pop();
        bestDistances.pop();
      }
    };

    const search = (node: KDNode | null) => {
      if (!node) return;

      const dist = euclideanDistance(target, node.point);
      insertBest(node.point, dist);

      const axisDiff = target[node.axis] - node.point[node.axis];
      const near = axisDiff <= 0 ? node.left : node.right;
      const far = axisDiff <= 0 ? node.right : node.left;

      search(near);

      // Only search the far branch if the splitting hyperplane is closer
      // than the current worst best distance.
      if (best.length < k || Math.abs(axisDiff) < bestDistances[best.length - 1]) {
        search(far);
      }
    };

    search(this.root);
    return best;
  }
}
