/**
 * Gene-Protein-Reaction (GPR) rule parser and knockout engine.
 *
 * GPR rules are boolean expressions like:
 *   "((b0001 AND b0002) OR b0003)"
 *
 * - AND = protein complex (all genes required)
 * - OR = isozymes (any gene sufficient)
 *
 * Gene knockout: if a gene is knocked out, evaluate the GPR rule.
 * If the rule evaluates to false, the reaction is knocked out (bounds set to 0).
 */

export type GPRTreeNode =
  | { type: 'gene'; id: string }
  | { type: 'and'; children: GPRTreeNode[] }
  | { type: 'or'; children: GPRTreeNode[] };

export interface GPRResult {
  geneId: string;
  affectedReactions: string[];
}

// ── Tokenizer ────────────────────────────────────────────────────────

function tokenize(rule: string): string[] {
  return rule.match(/\(|\)|AND|OR|[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
}

// ── Recursive descent parser ─────────────────────────────────────────

function parseExpression(tokens: string[], ctx: { pos: number }): GPRTreeNode {
  return parseOr(tokens, ctx);
}

function parseOr(tokens: string[], ctx: { pos: number }): GPRTreeNode {
  const children = [parseAnd(tokens, ctx)];
  while (ctx.pos < tokens.length && tokens[ctx.pos] === 'OR') {
    ctx.pos++; // skip OR
    children.push(parseAnd(tokens, ctx));
  }
  return children.length === 1 ? children[0] : { type: 'or', children };
}

function parseAnd(tokens: string[], ctx: { pos: number }): GPRTreeNode {
  const children = [parseAtom(tokens, ctx)];
  while (ctx.pos < tokens.length && tokens[ctx.pos] === 'AND') {
    ctx.pos++; // skip AND
    children.push(parseAtom(tokens, ctx));
  }
  return children.length === 1 ? children[0] : { type: 'and', children };
}

function parseAtom(tokens: string[], ctx: { pos: number }): GPRTreeNode {
  if (ctx.pos >= tokens.length) {
    throw new Error('Unexpected end of GPR expression');
  }
  if (tokens[ctx.pos] === '(') {
    ctx.pos++; // skip (
    const node = parseExpression(tokens, ctx);
    if (ctx.pos >= tokens.length || tokens[ctx.pos] !== ')') {
      throw new Error('Missing closing parenthesis in GPR expression');
    }
    ctx.pos++; // skip )
    return node;
  }
  // Gene ID
  const id = tokens[ctx.pos];
  if (id === 'AND' || id === 'OR' || id === ')') {
    throw new Error(`Unexpected token "${id}" in GPR expression`);
  }
  ctx.pos++;
  return { type: 'gene', id };
}

/**
 * Parse a GPR rule string into a nested boolean structure.
 * Supports: AND, OR, parentheses, gene IDs (alphanumeric + underscore)
 *
 * @example
 * parseGPR('(b0001 AND b0002) OR b0003')
 * // → { type: 'or', children: [
 * //     { type: 'and', children: [{ type: 'gene', id: 'b0001' }, { type: 'gene', id: 'b0002' }] },
 * //     { type: 'gene', id: 'b0003' }
 * //   ] }
 */
export function parseGPR(rule: string): GPRTreeNode {
  const tokens = tokenize(rule);
  if (tokens.length === 0) {
    throw new Error('Empty GPR expression');
  }
  const ctx = { pos: 0 };
  const node = parseExpression(tokens, ctx);
  if (ctx.pos < tokens.length) {
    throw new Error(`Unexpected trailing tokens in GPR expression: "${tokens.slice(ctx.pos).join(' ')}"`);
  }
  return node;
}

// ── Evaluator ────────────────────────────────────────────────────────

/**
 * Evaluate a GPR tree with a set of knocked-out genes.
 * Returns true if the reaction is active (at least one path is active).
 */
export function evaluateGPR(tree: GPRTreeNode, knockedOutGenes: Set<string>): boolean {
  switch (tree.type) {
    case 'gene':
      return !knockedOutGenes.has(tree.id);
    case 'and':
      return tree.children.every(child => evaluateGPR(child, knockedOutGenes));
    case 'or':
      return tree.children.some(child => evaluateGPR(child, knockedOutGenes));
  }
}

// ── Knockout engine ──────────────────────────────────────────────────

/**
 * Given a set of knocked-out genes and a map of reaction GPR rules,
 * return the list of reactions that are knocked out.
 *
 * Reactions with no GPR rule (or an empty rule) are treated as always active.
 */
export function getKnockoutReactions(
  knockedOutGenes: string[],
  gprRules: Record<string, string>,
): string[] {
  const geneSet = new Set(knockedOutGenes);
  const knockedOutReactions: string[] = [];

  for (const [reactionId, rule] of Object.entries(gprRules)) {
    if (!rule || rule.trim() === '') continue;
    try {
      const tree = parseGPR(rule);
      if (!evaluateGPR(tree, geneSet)) {
        knockedOutReactions.push(reactionId);
      }
    } catch {
      // Skip malformed rules
      continue;
    }
  }

  return knockedOutReactions.sort();
}

/**
 * Given a single gene knockout, return all reactions affected.
 * Returns an object with the gene ID and its affected reactions.
 */
export function getGeneKnockoutEffect(
  geneId: string,
  gprRules: Record<string, string>,
): GPRResult {
  return {
    geneId,
    affectedReactions: getKnockoutReactions([geneId], gprRules),
  };
}

/**
 * Collect all unique gene IDs mentioned in a set of GPR rules.
 */
export function extractGeneIds(gprRules: Record<string, string>): string[] {
  const geneIds = new Set<string>();
  for (const rule of Object.values(gprRules)) {
    if (!rule || rule.trim() === '') continue;
    const tokens = tokenize(rule);
    for (const token of tokens) {
      if (token !== 'AND' && token !== 'OR' && token !== '(' && token !== ')') {
        geneIds.add(token);
      }
    }
  }
  return Array.from(geneIds).sort();
}
