/**
 * newickParser.test.ts — Unit tests for the Newick tree parser.
 *
 * Covers:
 *   - Basic parsing (leaves, internal nodes, root)
 *   - Branch lengths
 *   - Edge cases (empty names, missing lengths, single node)
 *   - Error handling (malformed input)
 *   - Round-trip serialization
 *   - Metadata computation (leaves, depth, rootDistance)
 */

import {
  NewickParseError,
  type PhyloNode,
  collectInternalNodes,
  findNodeByName,
  parseNewick,
  toNewick,
} from "../src/utils/newickParser";

// ── Test 1: Simple two-leaf tree ──────────────────────────────────────────────

describe("parseNewick", () => {
  test("parses a simple two-leaf tree with branch lengths", () => {
    const result = parseNewick("(A:0.1,B:0.2);");

    expect(result.root).toBeDefined();
    expect(result.root.children).toHaveLength(2);
    expect(result.root.children[0].name).toBe("A");
    expect(result.root.children[0].branchLength).toBeCloseTo(0.1);
    expect(result.root.children[1].name).toBe("B");
    expect(result.root.children[1].branchLength).toBeCloseTo(0.2);
  });

  // ── Test 2: Three-leaf nested tree ───────────────────────────────────────

  test("parses a three-leaf nested tree", () => {
    const result = parseNewick("((A:0.1,B:0.2):0.3,C:0.4);");

    expect(result.root.children).toHaveLength(2);
    // First child is an internal node
    const internal = result.root.children[0];
    expect(internal.name).toBe("");
    expect(internal.branchLength).toBeCloseTo(0.3);
    expect(internal.children).toHaveLength(2);
    expect(internal.children[0].name).toBe("A");
    expect(internal.children[1].name).toBe("B");
    // Second child is a leaf
    expect(result.root.children[1].name).toBe("C");
    expect(result.root.children[1].branchLength).toBeCloseTo(0.4);
  });

  // ── Test 3: Single leaf ──────────────────────────────────────────────────

  test("parses a single leaf node", () => {
    const result = parseNewick("A;");

    expect(result.root.name).toBe("A");
    expect(result.root.children).toHaveLength(0);
    expect(result.leaves).toHaveLength(1);
    expect(result.nodeCount).toBe(1);
  });

  // ── Test 4: Leaf without branch length defaults to 0 ────────────────────

  test("defaults branch length to 0 when omitted", () => {
    const result = parseNewick("(A,B:0.5);");

    expect(result.root.children[0].name).toBe("A");
    expect(result.root.children[0].branchLength).toBe(0);
    expect(result.root.children[1].name).toBe("B");
    expect(result.root.children[1].branchLength).toBeCloseTo(0.5);
  });

  // ── Test 5: Internal node with a name ────────────────────────────────────

  test("parses internal node names", () => {
    const result = parseNewick("((A:0.1,B:0.2)Ancestor:0.3,C:0.4);");

    const ancestor = result.root.children[0];
    expect(ancestor.name).toBe("Ancestor");
    expect(ancestor.branchLength).toBeCloseTo(0.3);
  });

  // ── Test 6: Metadata — leaf count and node count ─────────────────────────

  test("computes correct leaf count and node count", () => {
    // Tree: ((A,B),(C,D))
    const result = parseNewick("((A,B),(C,D));");

    expect(result.leaves).toHaveLength(4);
    expect(result.nodeCount).toBe(7); // root + 2 internal + 4 leaves
  });

  // ── Test 7: Metadata — max root distance ─────────────────────────────────

  test("computes max root distance correctly", () => {
    // A path: root -> internal (0.3) -> A (0.1) = 0.4
    // B path: root -> internal (0.3) -> B (0.2) = 0.5
    // C path: root -> C (0.4) = 0.4
    const result = parseNewick("((A:0.1,B:0.2):0.3,C:0.4);");

    expect(result.maxRootDistance).toBeCloseTo(0.5);
  });

  // ── Test 8: Metadata — tree height (max depth) ───────────────────────────

  test("computes tree height correctly", () => {
    const result = parseNewick("((A:0.1,B:0.2):0.3,C:0.4);");

    // root depth=0, internal depth=1, leaves depth=2
    expect(result.maxHeight).toBe(2);
  });

  // ── Test 9: Node depths are assigned correctly ───────────────────────────

  test("assigns correct depths to all nodes", () => {
    const result = parseNewick("((A:0.1,B:0.2):0.3,C:0.4);");

    expect(result.root.depth).toBe(0);
    expect(result.root.children[0].depth).toBe(1); // internal
    expect(result.root.children[0].children[0].depth).toBe(2); // A
    expect(result.root.children[0].children[1].depth).toBe(2); // B
    expect(result.root.children[1].depth).toBe(1); // C
  });

  // ── Test 10: Node root distances are assigned correctly ──────────────────

  test("assigns correct root distances", () => {
    const result = parseNewick("((A:0.1,B:0.2):0.3,C:0.4);");

    expect(result.root.rootDistance).toBeCloseTo(0);
    expect(result.root.children[0].rootDistance).toBeCloseTo(0.3);
    expect(result.root.children[0].children[0].rootDistance).toBeCloseTo(0.4);
    expect(result.root.children[0].children[1].rootDistance).toBeCloseTo(0.5);
    expect(result.root.children[1].rootDistance).toBeCloseTo(0.4);
  });

  // ── Test 11: Handles whitespace gracefully ───────────────────────────────

  test("handles whitespace in input", () => {
    const result = parseNewick(" ( ( A : 0.1 , B : 0.2 ) : 0.3 , C : 0.4 ) ; ");

    expect(result.root.children).toHaveLength(2);
    expect(result.root.children[0].children[0].name).toBe("A");
  });

  // ── Test 12: Five-leaf tree (realistic phylogeny) ────────────────────────

  test("parses a five-leaf tree", () => {
    const newick = "(((Human:0.1,Chimp:0.05):0.05,Gorilla:0.15):0.1,(Mouse:0.3,Rat:0.25):0.2);";
    const result = parseNewick(newick);

    expect(result.leaves).toHaveLength(5);
    expect(result.leaves.map((l) => l.name)).toEqual([
      "Human",
      "Chimp",
      "Gorilla",
      "Mouse",
      "Rat",
    ]);
    expect(result.nodeCount).toBe(9); // 5 leaves + 4 internal
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("parseNewick error handling", () => {
  test("throws on empty input", () => {
    expect(() => parseNewick("")).toThrow(NewickParseError);
    expect(() => parseNewick("")).toThrow("empty");
  });

  test("throws on non-string input", () => {
    expect(() => parseNewick(null as unknown as string)).toThrow(
      NewickParseError,
    );
  });

  test("throws on unmatched parenthesis", () => {
    expect(() => parseNewick("(A:0.1,B:0.2;")).toThrow(NewickParseError);
  });

  test("throws on invalid branch length", () => {
    expect(() => parseNewick("(A:abc,B:0.2);")).toThrow(NewickParseError);
  });
});

// ── toNewick serialization ────────────────────────────────────────────────────

describe("toNewick", () => {
  test("round-trips a simple tree", () => {
    const original = "(A:0.1,B:0.2);";
    const { root } = parseNewick(original);
    const serialized = toNewick(root) + ";";

    // Re-parse and compare structure
    const reparsed = parseNewick(serialized);
    expect(reparsed.leaves.map((l) => l.name).sort()).toEqual(["A", "B"]);
    expect(reparsed.root.children[0].branchLength).toBeCloseTo(0.1);
    expect(reparsed.root.children[1].branchLength).toBeCloseTo(0.2);
  });

  test("serializes internal node names", () => {
    const { root } = parseNewick("((A:0.1,B:0.2)Anc:0.3,C:0.4);");
    const serialized = toNewick(root) + ";";

    expect(serialized).toContain("Anc");
    const reparsed = parseNewick(serialized);
    expect(reparsed.root.children[0].name).toBe("Anc");
  });
});

// ── collectInternalNodes ──────────────────────────────────────────────────────

describe("collectInternalNodes", () => {
  test("returns all non-leaf nodes", () => {
    const { root } = parseNewick("((A:0.1,B:0.2):0.3,C:0.4);");
    const internals = collectInternalNodes(root);

    expect(internals).toHaveLength(2); // root + one internal
    expect(internals.every((n) => n.children.length > 0)).toBe(true);
  });
});

// ── findNodeByName ────────────────────────────────────────────────────────────

describe("findNodeByName", () => {
  test("finds a leaf node by name", () => {
    const { root } = parseNewick("((A:0.1,B:0.2):0.3,C:0.4);");
    const node = findNodeByName(root, "B");

    expect(node).not.toBeNull();
    expect(node!.name).toBe("B");
    expect(node!.branchLength).toBeCloseTo(0.2);
  });

  test("finds an internal node by name", () => {
    const { root } = parseNewick("((A:0.1,B:0.2)Anc:0.3,C:0.4);");
    const node = findNodeByName(root, "Anc");

    expect(node).not.toBeNull();
    expect(node!.children).toHaveLength(2);
  });

  test("returns null for non-existent name", () => {
    const { root } = parseNewick("((A:0.1,B:0.2):0.3,C:0.4);");
    const node = findNodeByName(root, "NonExistent");

    expect(node).toBeNull();
  });
});
