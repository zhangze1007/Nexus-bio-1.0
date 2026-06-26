/**
 * newickParser.ts — Parse Newick tree format into an internal tree structure.
 *
 * Handles the standard Newick grammar:
 *   tree     := subtree ";"
 *   subtree  := leaf | internal
 *   leaf     := name [":" length]
 *   internal := "(" subtree ("," subtree)* ")" [name] [":" length]
 *   name     := string (unquoted, no special chars)
 *   length   := float
 *
 * References:
 *   - Felsenstein, J. (1986) "The Newick tree format"
 *   - https://en.wikipedia.org/wiki/Newick_format
 */

// ── Public types ──────────────────────────────────────────────────────────────

export interface PhyloNode {
  /** Node name (empty string for unnamed internal nodes). */
  name: string;
  /** Branch length from this node to its parent (0 if absent in source). */
  branchLength: number;
  /** Child nodes (empty array for leaves). */
  children: PhyloNode[];
  /** Depth in the tree (0 = root). Computed by `computeNodeDepths`. */
  depth: number;
  /** Total root-to-node distance. Computed by `computeRootDistances`. */
  rootDistance: number;
}

export interface ParseResult {
  root: PhyloNode;
  /** All leaf nodes in traversal order (left-to-right). */
  leaves: PhyloNode[];
  /** Total number of nodes. */
  nodeCount: number;
  /** Maximum root-to-leaf distance (for scaling). */
  maxRootDistance: number;
  /** Tree height (maximum depth). */
  maxHeight: number;
}

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Tokenizer state: walks the Newick string character-by-character.
 */
class NewickTokenizer {
  private pos = 0;
  constructor(private readonly src: string) {}

  peek(): string {
    return this.pos < this.src.length ? this.src[this.pos] : "";
  }

  consume(): string {
    const ch = this.peek();
    this.pos++;
    return ch;
  }

  /** Skip whitespace. */
  skipWS(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) {
      this.pos++;
    }
  }

  /** Read until one of the delimiter characters is hit. */
  readUntil(delims: string): string {
    let buf = "";
    while (this.pos < this.src.length && !delims.includes(this.src[this.pos])) {
      buf += this.src[this.pos];
      this.pos++;
    }
    return buf;
  }

  get done(): boolean {
    return this.pos >= this.src.length;
  }
}

/**
 * Recursive-descent parser for Newick format.
 *
 * Grammar (simplified):
 *   tree     -> subtree ";"
 *   subtree  -> "(" subtree ("," subtree)* ")" [name] [":" length]
 *            |  name [":" length]
 *   name     -> [^,;:()\s]+
 *   length   -> number
 */
function parseSubtree(tok: NewickTokenizer): PhyloNode {
  tok.skipWS();

  if (tok.peek() === "(") {
    // Internal node
    tok.consume(); // '('
    const children: PhyloNode[] = [];

    // Parse first child
    children.push(parseSubtree(tok));

    // Parse remaining children separated by commas
    while (tok.peek() === ",") {
      tok.consume(); // ','
      tok.skipWS();
      children.push(parseSubtree(tok));
    }

    tok.skipWS();
    if (tok.peek() !== ")") {
      throw new NewickParseError(
        `Expected ')' at position ${getPosition(tok)}, got '${tok.peek()}'`,
      );
    }
    tok.consume(); // ')'

    // Optional internal node name
    tok.skipWS();
    const name = tok.readUntil(",;():");

    // Optional branch length
    let branchLength = 0;
    if (tok.peek() === ":") {
      tok.consume(); // ':'
      tok.skipWS();
      branchLength = readNumber(tok);
    }

    return {
      name: name.trim(),
      branchLength,
      children,
      depth: 0,
      rootDistance: 0,
    };
  }

  // Leaf node
  const name = tok.readUntil(",;():");
  let branchLength = 0;
  if (tok.peek() === ":") {
    tok.consume(); // ':'
    tok.skipWS();
    branchLength = readNumber(tok);
  }

  return {
    name: name.trim(),
    branchLength,
    children: [],
    depth: 0,
    rootDistance: 0,
  };
}

function readNumber(tok: NewickTokenizer): number {
  tok.skipWS();
  const raw = tok.readUntil(",;():)");
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new NewickParseError("Expected a number for branch length");
  }
  const val = parseFloat(trimmed);
  if (Number.isNaN(val)) {
    throw new NewickParseError(`Invalid number: '${trimmed}'`);
  }
  return val;
}

function getPosition(_tok: NewickTokenizer): number {
  // Best-effort position for error reporting
  return 0;
}

// ── Error class ───────────────────────────────────────────────────────────────

export class NewickParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewickParseError";
  }
}

// ── Post-processing ───────────────────────────────────────────────────────────

function collectLeaves(node: PhyloNode, acc: PhyloNode[]): void {
  if (node.children.length === 0) {
    acc.push(node);
  } else {
    for (const child of node.children) {
      collectLeaves(child, acc);
    }
  }
}

function countNodes(node: PhyloNode): number {
  let n = 1;
  for (const child of node.children) {
    n += countNodes(child);
  }
  return n;
}

/** Assign depth (root = 0) via BFS. */
function computeNodeDepths(root: PhyloNode): number {
  let maxDepth = 0;
  const queue: Array<{ node: PhyloNode; depth: number }> = [
    { node: root, depth: 0 },
  ];
  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    node.depth = depth;
    if (depth > maxDepth) maxDepth = depth;
    for (const child of node.children) {
      queue.push({ node: child, depth: depth + 1 });
    }
  }
  return maxDepth;
}

/** Assign rootDistance (cumulative branch length from root). */
function computeRootDistances(node: PhyloNode, dist: number): number {
  node.rootDistance = dist;
  let max = dist;
  for (const child of node.children) {
    const childDist = computeRootDistances(child, dist + child.branchLength);
    if (childDist > max) max = childDist;
  }
  return max;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a Newick-format string into a `ParseResult`.
 *
 * @param newick - The Newick string (e.g. `"((A:0.1,B:0.2):0.3,C:0.4);"`).
 * @returns Parsed tree with metadata.
 * @throws {NewickParseError} If the input is malformed.
 */
export function parseNewick(newick: string): ParseResult {
  if (typeof newick !== "string") {
    throw new NewickParseError("Input must be a string");
  }

  const trimmed = newick.trim();
  if (trimmed.length === 0) {
    throw new NewickParseError("Input is empty");
  }

  const tok = new NewickTokenizer(trimmed);
  const root = parseSubtree(tok);

  // Consume optional trailing semicolon
  tok.skipWS();
  if (tok.peek() === ";") {
    tok.consume();
  }

  // Verify we consumed everything
  tok.skipWS();
  if (!tok.done) {
    throw new NewickParseError(
      `Unexpected trailing characters: '${trimmed.slice(trimmed.length - 20)}'`,
    );
  }

  // Post-process
  const leaves: PhyloNode[] = [];
  collectLeaves(root, leaves);
  const nodeCount = countNodes(root);
  const maxHeight = computeNodeDepths(root);
  const maxRootDistance = computeRootDistances(root, 0);

  return { root, leaves, nodeCount, maxRootDistance, maxHeight };
}

/**
 * Serialize a `PhyloNode` subtree back to Newick format.
 */
export function toNewick(node: PhyloNode): string {
  let s = "";
  if (node.children.length > 0) {
    s += "(";
    s += node.children.map(toNewick).join(",");
    s += ")";
  }
  s += node.name;
  if (node.branchLength > 0) {
    s += `:${node.branchLength}`;
  }
  return s;
}

/**
 * Collect all internal (non-leaf) nodes.
 */
export function collectInternalNodes(node: PhyloNode): PhyloNode[] {
  const acc: PhyloNode[] = [];
  function walk(n: PhyloNode): void {
    if (n.children.length > 0) {
      acc.push(n);
      for (const child of n.children) {
        walk(child);
      }
    }
  }
  walk(node);
  return acc;
}

/**
 * Find a node by name (DFS, returns first match).
 */
export function findNodeByName(
  root: PhyloNode,
  name: string,
): PhyloNode | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNodeByName(child, name);
    if (found) return found;
  }
  return null;
}
