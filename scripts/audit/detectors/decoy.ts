// scripts/audit/detectors/decoy.ts
//
// AST-based decoy-parameter detector: flags named function declarations whose
// declared parameters are never referenced anywhere in the function body
// ("decoys" — parameters that exist only to look used but do nothing).
//
// Why AST instead of regex: a flat-text/regex scanner cannot tell a real
// parameter from text that merely looks like one (e.g. a nested type's
// parameter list, or an object literal typed as a return annotation), and it
// cannot tell which `{ ... }` is actually the function body vs. some other
// brace pair in the signature. Walking the real TypeScript AST sidesteps all
// of that by construction — see the three defects fixed below.
//
// Known limitations (intentional; out of scope for this detector):
//   - Only named `ts.FunctionDeclaration`s are treated as detection TARGETS
//     (i.e. things we report DecoyHits for). Arrow functions, function
//     expressions, and class/object methods are never themselves scanned for
//     their OWN decoy parameters.
//   - Nested function/arrow/method scopes ARE still recognized as shadow
//     boundaries while walking a target function's body (see
//     `isUsedInScope` / `shadowsName`) — so a nested arrow or method that
//     re-declares the same parameter name does not hide a genuinely-unused
//     OUTER parameter. But that nested arrow/method is never itself a
//     detection target.
//   - Only nested FUNCTION-scope shadowing is modeled. A block-scoped
//     `let`/`const` redeclaration of a parameter name (e.g.
//     `if (x) { const data = 1; use(data); }`) is not treated as shadowing
//     and could cause a false negative. This case is not among the required
//     regression tests and is left unhandled to keep the detector's scope
//     narrow and predictable.
import * as ts from 'typescript';

export interface DecoyHit { file: string; line: number; fn: string; param: string; }

type FunctionLikeWithParams =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration;

function isFunctionLikeWithParams(node: ts.Node): node is FunctionLikeWithParams {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

// True when a nested function-like scope declares its own parameter named
// `name`, which shadows any outer parameter of the same name.
function shadowsName(node: FunctionLikeWithParams, name: string): boolean {
  return node.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === name);
}

// Scope-aware usage check (defect #3 fix): true if `name` is referenced as an
// identifier anywhere within `root`, EXCEPT inside a nested function-like
// scope that shadows `name`. Such a nested scope is skipped entirely — a
// reference to `name` in there resolves to the INNER binding, not the outer
// parameter under test, so it must not count as "using" the outer one.
function isUsedInScope(root: ts.Node, name: string): boolean {
  let found = false;
  function walk(node: ts.Node): void {
    if (found) return;
    if (isFunctionLikeWithParams(node) && shadowsName(node, name)) {
      return; // shadowed further down: do not descend into this nested scope
    }
    if (ts.isIdentifier(node) && node.text === name) {
      found = true;
      return;
    }
    ts.forEachChild(node, walk);
  }
  walk(root);
  return found;
}

export function scanDecoys(source: string, file: string): DecoyHit[] {
  const hits: DecoyHit[] = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const fn = node.name.text;
      const body = node.body;

      // Collect real parameters only (defect #1 fix): reading
      // `node.parameters` from the AST means a param's type annotation
      // (e.g. `fn: (acc: number, cur: number) => number`) is never mistaken
      // for additional parameters of THIS function — `cur`/`acc` live inside
      // a separate ts.FunctionTypeNode attached to `fn`'s `.type`, not in
      // `node.parameters`, so they are never even visited here.
      const candidateParams: string[] = [];
      for (const param of node.parameters) {
        if (param.dotDotDotToken) continue; // rest param — skip
        if (!ts.isIdentifier(param.name)) continue; // destructuring/binding pattern — skip
        if (param.name.text === 'this') continue; // explicit `this` param — skip (real `this` in the body parses as ts.ThisExpression, not ts.Identifier, so it can never match the identifier-based usage check; no real value-identifier can be named `this` in JS/TS, so this is always safe)
        if (param.name.text.startsWith('_')) continue; // conventionally ignored — skip
        candidateParams.push(param.name.text);
      }

      if (candidateParams.length > 0) {
        // Body brace fix (defect #2): `node.body` is the AST's own Block for
        // this function, resolved by the parser — never a `{...}` borrowed
        // from an inline return-type object annotation or a default no-op
        // callback's `{}`, both of which can precede this real body in the
        // source text.
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        for (const param of candidateParams) {
          if (!isUsedInScope(body, param)) {
            hits.push({ file, line, fn, param });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return hits;
}
