import * as ts from "typescript";

/**
 * Canned-output detector: flags a named `function` declaration that has ≥1 real
 * parameter but uses NONE of them — its output is independent of ALL inputs, i.e.
 * it returns canned/hardcoded data regardless of what it is given. In a file that
 * claims real science (provenance/citation) this is the "fabricated data presented
 * as real" signal the Math.random / partial-decoy detectors cannot see (a
 * `return 0.87` under a Nature citation has no RNG and no *partially*-ignored param).
 *
 * Only named FunctionDeclarations are covered (arrows/methods are out of scope, as
 * in the decoy detector). `_`-prefixed, rest, `this`, and destructuring params are
 * skipped when deciding whether the function has real inputs.
 */
export interface CannedHit {
  file: string;
  line: number;
  fn: string;
}

function simpleParamName(p: ts.ParameterDeclaration): string | null {
  if (!ts.isIdentifier(p.name)) return null; // destructuring pattern
  if (p.dotDotDotToken) return null; // rest
  const name = p.name.text;
  if (name === "this" || name.startsWith("_")) return null;
  return name;
}

// Is `name` referenced anywhere in `body`, NOT counting nested function scopes
// that redeclare (shadow) the same name?
function usesName(body: ts.Node, name: string): boolean {
  let used = false;
  const walk = (n: ts.Node): void => {
    if (used) return;
    if (
      (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) &&
      n.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === name)
    ) {
      return; // shadowed in this nested scope — do not descend
    }
    if (ts.isIdentifier(n) && n.text === name) {
      used = true;
      return;
    }
    ts.forEachChild(n, walk);
  };
  ts.forEachChild(body, walk);
  return used;
}

export function scanCannedReturns(source: string, file: string): CannedHit[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const hits: CannedHit[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const params = node.parameters
        .map(simpleParamName)
        .filter((x): x is string => x !== null);
      // Has real inputs, but uses NONE of them → output is input-independent.
      if (params.length > 0 && params.every((p) => !usesName(node.body!, p))) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        hits.push({ file, line, fn: node.name.text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}
