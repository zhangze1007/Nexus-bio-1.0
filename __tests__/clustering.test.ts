/**
 * Tests for UPGMA hierarchical clustering and Euclidean distance matrix.
 *
 * Covers:
 *   - calculateDistanceMatrix: basic correctness, symmetry, edge cases
 *   - upgma: merge distances, tree structure, single/zero input
 *   - getLeafOrder: correct ordering from dendrogram
 *   - getMaxDistance: root distance extraction
 */

import {
  type ClusterNode,
  calculateDistanceMatrix,
  getLeafLabels,
  getLeafOrder,
  getMaxDistance,
  upgma,
} from "../src/utils/clustering";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Collect all leaf indices from a ClusterNode tree. */
function collectLeaves(node: ClusterNode): number[] {
  const result: number[] = [];
  function walk(n: ClusterNode): void {
    if (n.index !== undefined) {
      result.push(n.index);
      return;
    }
    if (n.left) walk(n.left);
    if (n.right) walk(n.right);
  }
  walk(node);
  return result;
}

/** Check whether a ClusterNode is a leaf. */
function isLeaf(node: ClusterNode): boolean {
  return node.index !== undefined;
}

// ── calculateDistanceMatrix ──────────────────────────────────────────────────

describe("calculateDistanceMatrix", () => {
  it("returns a zero matrix for identical points", () => {
    const data = [
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ];
    const dist = calculateDistanceMatrix(data);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(dist[i][j]).toBeCloseTo(0);
      }
    }
  });

  it("computes correct 2D Euclidean distances", () => {
    const data = [
      [0, 0],
      [3, 4],
    ];
    const dist = calculateDistanceMatrix(data);
    expect(dist[0][1]).toBeCloseTo(5); // 3-4-5 triangle
    expect(dist[1][0]).toBeCloseTo(5);
  });

  it("is symmetric", () => {
    const data = [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 0],
    ];
    const dist = calculateDistanceMatrix(data);
    const n = data.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        expect(dist[i][j]).toBeCloseTo(dist[j][i]);
      }
    }
  });

  it("has zero diagonal", () => {
    const data = [
      [10, 20],
      [30, 40],
      [50, 60],
    ];
    const dist = calculateDistanceMatrix(data);
    for (let i = 0; i < data.length; i++) {
      expect(dist[i][i]).toBe(0);
    }
  });

  it("handles a single point", () => {
    const dist = calculateDistanceMatrix([[5, 10]]);
    expect(dist).toEqual([[0]]);
  });
});

// ── upgma ────────────────────────────────────────────────────────────────────

describe("upgma", () => {
  it("returns a leaf node for single-point input", () => {
    const dist = [[0]];
    const root = upgma(dist, ["A"]);
    expect(isLeaf(root)).toBe(true);
    expect(root.index).toBe(0);
    expect(root.label).toBe("A");
    expect(root.distance).toBe(0);
    expect(root.count).toBe(1);
  });

  it("merges two points at the correct distance", () => {
    // Two points at distance 10.
    const dist = [
      [0, 10],
      [10, 0],
    ];
    const root = upgma(dist, ["A", "B"]);
    expect(isLeaf(root)).toBe(false);
    // UPGMA merge distance = pair distance / 2.
    expect(root.distance).toBeCloseTo(5);
    expect(root.count).toBe(2);
    // Children are the original leaves.
    expect(root.left!.index).toBe(0);
    expect(root.right!.index).toBe(1);
  });

  it("preserves all leaf indices in the tree", () => {
    const dist = [
      [0, 5, 9],
      [5, 0, 7],
      [9, 7, 0],
    ];
    const root = upgma(dist, ["A", "B", "C"]);
    const leaves = collectLeaves(root);
    expect(leaves.sort()).toEqual([0, 1, 2]);
  });

  it("produces an ultrametric tree (all leaves at same distance from root)", () => {
    // 4-point example.
    const data = [
      [0, 0],
      [1, 0],
      [5, 0],
      [6, 0],
    ];
    const dist = calculateDistanceMatrix(data);
    const root = upgma(dist, ["A", "B", "C", "D"]);

    // Compute root-to-leaf distances.
    const leafDepths: number[] = [];
    function walk(node: ClusterNode, depth: number): void {
      if (isLeaf(node)) {
        leafDepths.push(depth + node.distance);
        return;
      }
      walk(node.left!, depth + node.distance);
      walk(node.right!, depth + node.distance);
    }
    walk(root, 0);

    // All leaf depths should be equal (ultrametric property).
    const first = leafDepths[0];
    for (const d of leafDepths) {
      expect(d).toBeCloseTo(first);
    }
  });

  it("merges closest pairs first", () => {
    // 3 points: A-B are close (dist=2), C is far (dist=10 from both).
    const dist = [
      [0, 2, 10],
      [2, 0, 10],
      [10, 10, 0],
    ];
    const root = upgma(dist);

    // First merge should be A-B (distance 2), so internal node distance = 1.
    // Then merge with C at distance 10, so root distance = 10/2 = 5.
    // The tree structure: root(5) -> internal(1) -> A, B  and  C
    expect(root.distance).toBeCloseTo(5);

    // One child is a leaf (C), the other is the A-B internal node.
    const leafChild = isLeaf(root.left!) ? root.left! : root.right!;
    const internalChild = isLeaf(root.left!) ? root.right! : root.left!;
    expect(isLeaf(leafChild)).toBe(true);
    expect(leafChild.index).toBe(2); // C
    expect(internalChild.distance).toBeCloseTo(1); // A-B merge
  });

  it("assigns labels to leaf nodes", () => {
    const dist = [
      [0, 3],
      [3, 0],
    ];
    const labels = ["gene_A", "gene_B"];
    const root = upgma(dist, labels);
    expect(root.left!.label).toBe("gene_A");
    expect(root.right!.label).toBe("gene_B");
  });

  it("works without labels", () => {
    const dist = [
      [0, 4, 6],
      [4, 0, 5],
      [6, 5, 0],
    ];
    const root = upgma(dist);
    expect(root.count).toBe(3);
    const leaves = collectLeaves(root);
    expect(leaves.sort()).toEqual([0, 1, 2]);
  });

  it("throws on empty input", () => {
    expect(() => upgma([])).toThrow("UPGMA requires at least one data point.");
  });

  it("handles 5 points and verifies internal structure", () => {
    // Create 5 points in two tight clusters: {0,1,2} and {3,4}.
    const data = [
      [0, 0],
      [0.1, 0],
      [0.2, 0],
      [5, 0],
      [5.1, 0],
    ];
    const dist = calculateDistanceMatrix(data);
    const root = upgma(dist, ["A", "B", "C", "D", "E"]);

    expect(root.count).toBe(5);
    const leaves = collectLeaves(root);
    expect(leaves.sort()).toEqual([0, 1, 2, 3, 4]);

    // The root should have two subtrees roughly corresponding to the two clusters.
    expect(root.left).toBeDefined();
    expect(root.right).toBeDefined();
  });
});

// ── getLeafOrder ─────────────────────────────────────────────────────────────

describe("getLeafOrder", () => {
  it("returns the single index for a leaf node", () => {
    const leaf: ClusterNode = { distance: 0, index: 3, count: 1 };
    expect(getLeafOrder(leaf)).toEqual([3]);
  });

  it("returns indices in in-order traversal", () => {
    // Build a small tree manually:
    //        root(2)
    //       /       \
    //    inner(1)    leaf(2)
    //    /     \
    // leaf(0)  leaf(1)
    const tree: ClusterNode = {
      distance: 2,
      count: 3,
      left: {
        distance: 1,
        count: 2,
        left: { distance: 0, index: 0, count: 1 },
        right: { distance: 0, index: 1, count: 1 },
      },
      right: { distance: 0, index: 2, count: 1 },
    };
    expect(getLeafOrder(tree)).toEqual([0, 1, 2]);
  });

  it("produces an ordering that groups similar items", () => {
    // Points: A(0,0), B(1,0), C(100,0), D(101,0)
    // A and B are close; C and D are close.
    const data = [
      [0, 0],
      [1, 0],
      [100, 0],
      [101, 0],
    ];
    const dist = calculateDistanceMatrix(data);
    const root = upgma(dist, ["A", "B", "C", "D"]);
    const order = getLeafOrder(root);

    // The order should place A adjacent to B, and C adjacent to D.
    const posA = order.indexOf(0);
    const posB = order.indexOf(1);
    const posC = order.indexOf(2);
    const posD = order.indexOf(3);

    expect(Math.abs(posA - posB)).toBeLessThanOrEqual(1);
    expect(Math.abs(posC - posD)).toBeLessThanOrEqual(1);
  });
});

// ── getLeafLabels ────────────────────────────────────────────────────────────

describe("getLeafLabels", () => {
  it("extracts labels in dendrogram order", () => {
    const dist = [
      [0, 2, 10],
      [2, 0, 10],
      [10, 10, 0],
    ];
    const root = upgma(dist, ["Alpha", "Beta", "Gamma"]);
    const labels = getLeafLabels(root);
    // A and B are closest, so they should be adjacent.
    expect(labels).toHaveLength(3);
    const posAlpha = labels.indexOf("Alpha");
    const posBeta = labels.indexOf("Beta");
    expect(Math.abs(posAlpha - posBeta)).toBeLessThanOrEqual(1);
  });
});

// ── getMaxDistance ────────────────────────────────────────────────────────────

describe("getMaxDistance", () => {
  it("returns 0 for a leaf node", () => {
    const leaf: ClusterNode = { distance: 0, index: 0, count: 1 };
    expect(getMaxDistance(leaf)).toBe(0);
  });

  it("returns the root distance for a simple tree", () => {
    const dist = [
      [0, 10],
      [10, 0],
    ];
    const root = upgma(dist);
    expect(getMaxDistance(root)).toBeCloseTo(5); // 10/2
  });

  it("returns the maximum merge distance in a larger tree", () => {
    const dist = [
      [0, 2, 10, 12],
      [2, 0, 10, 12],
      [10, 10, 0, 3],
      [12, 12, 3, 0],
    ];
    const root = upgma(dist);
    const maxDist = getMaxDistance(root);
    // The last merge (joining the two clusters) has the largest distance.
    expect(maxDist).toBeCloseTo(root.distance);
  });
});
