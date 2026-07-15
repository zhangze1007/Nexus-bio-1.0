/**
 * Tests for GPR (Gene-Protein-Reaction) parser and knockout engine.
 */
import {
  parseGPR,
  evaluateGPR,
  getKnockoutReactions,
  getGeneKnockoutEffect,
  extractGeneIds,
  applyGeneKnockoutsToModel,
  GPRTreeNode,
} from '../src/server/fbaGPR';
import { IJO1366_GPR_RULES } from '../src/data/iJO1366Subset';

// ── parseGPR ─────────────────────────────────────────────────────────

describe('parseGPR', () => {
  it('parses a single gene', () => {
    const tree = parseGPR('b0001');
    expect(tree).toEqual({ type: 'gene', id: 'b0001' });
  });

  it('parses a single gene in parentheses', () => {
    const tree = parseGPR('(b0001)');
    expect(tree).toEqual({ type: 'gene', id: 'b0001' });
  });

  it('parses AND expression', () => {
    const tree = parseGPR('b0001 AND b0002');
    expect(tree).toEqual({
      type: 'and',
      children: [
        { type: 'gene', id: 'b0001' },
        { type: 'gene', id: 'b0002' },
      ],
    });
  });

  it('parses OR expression', () => {
    const tree = parseGPR('b0001 OR b0002');
    expect(tree).toEqual({
      type: 'or',
      children: [
        { type: 'gene', id: 'b0001' },
        { type: 'gene', id: 'b0002' },
      ],
    });
  });

  it('parses nested AND inside OR', () => {
    const tree = parseGPR('(b0001 AND b0002) OR b0003');
    expect(tree).toEqual({
      type: 'or',
      children: [
        {
          type: 'and',
          children: [
            { type: 'gene', id: 'b0001' },
            { type: 'gene', id: 'b0002' },
          ],
        },
        { type: 'gene', id: 'b0003' },
      ],
    });
  });

  it('parses complex expression with multiple ORs and ANDs', () => {
    const tree = parseGPR('((b0001 AND b0002) OR (b0003 AND b0004))');
    expect(tree).toEqual({
      type: 'or',
      children: [
        {
          type: 'and',
          children: [
            { type: 'gene', id: 'b0001' },
            { type: 'gene', id: 'b0002' },
          ],
        },
        {
          type: 'and',
          children: [
            { type: 'gene', id: 'b0003' },
            { type: 'gene', id: 'b0004' },
          ],
        },
      ],
    });
  });

  it('parses multi-gene AND complex', () => {
    const tree = parseGPR('b0116 AND b0726 AND b0727');
    expect(tree).toEqual({
      type: 'and',
      children: [
        { type: 'gene', id: 'b0116' },
        { type: 'gene', id: 'b0726' },
        { type: 'gene', id: 'b0727' },
      ],
    });
  });

  it('parses multi-gene OR', () => {
    const tree = parseGPR('b1612 OR b4122 OR b1611');
    expect(tree).toEqual({
      type: 'or',
      children: [
        { type: 'gene', id: 'b1612' },
        { type: 'gene', id: 'b4122' },
        { type: 'gene', id: 'b1611' },
      ],
    });
  });

  it('parses deeply nested expression', () => {
    // ((A AND B) OR (C AND D)) OR E
    // outer OR has 2 children: inner-or(A,B,C,D) and gene E
    const tree = parseGPR('((b0001 AND b0002) OR (b0003 AND b0004)) OR b0005');
    expect(tree.type).toBe('or');
    if (tree.type === 'or') {
      expect(tree.children).toHaveLength(2);
      // First child is the parenthesized OR
      expect(tree.children[0].type).toBe('or');
      // Second child is the standalone gene
      expect(tree.children[1]).toEqual({ type: 'gene', id: 'b0005' });
    }
  });

  it('throws on empty expression', () => {
    expect(() => parseGPR('')).toThrow('Empty GPR expression');
  });

  it('throws on missing closing parenthesis', () => {
    expect(() => parseGPR('(b0001 AND b0002')).toThrow('Missing closing parenthesis');
  });

  it('throws on trailing tokens', () => {
    expect(() => parseGPR('b0001 b0002')).toThrow('Unexpected trailing tokens');
  });
});

// ── evaluateGPR ──────────────────────────────────────────────────────

describe('evaluateGPR', () => {
  it('single gene: active when not knocked out', () => {
    const tree: GPRTreeNode = { type: 'gene', id: 'b0001' };
    expect(evaluateGPR(tree, new Set())).toBe(true);
  });

  it('single gene: inactive when knocked out', () => {
    const tree: GPRTreeNode = { type: 'gene', id: 'b0001' };
    expect(evaluateGPR(tree, new Set(['b0001']))).toBe(false);
  });

  it('AND: all required — inactive when one is knocked out', () => {
    const tree: GPRTreeNode = {
      type: 'and',
      children: [
        { type: 'gene', id: 'b0001' },
        { type: 'gene', id: 'b0002' },
      ],
    };
    expect(evaluateGPR(tree, new Set(['b0001']))).toBe(false);
    expect(evaluateGPR(tree, new Set(['b0002']))).toBe(false);
    expect(evaluateGPR(tree, new Set(['b0001', 'b0002']))).toBe(false);
  });

  it('AND: active when no genes knocked out', () => {
    const tree: GPRTreeNode = {
      type: 'and',
      children: [
        { type: 'gene', id: 'b0001' },
        { type: 'gene', id: 'b0002' },
      ],
    };
    expect(evaluateGPR(tree, new Set())).toBe(true);
  });

  it('OR: active when at least one gene is present', () => {
    const tree: GPRTreeNode = {
      type: 'or',
      children: [
        { type: 'gene', id: 'b0001' },
        { type: 'gene', id: 'b0002' },
      ],
    };
    expect(evaluateGPR(tree, new Set())).toBe(true);
    expect(evaluateGPR(tree, new Set(['b0001']))).toBe(true);
    expect(evaluateGPR(tree, new Set(['b0002']))).toBe(true);
  });

  it('OR: inactive when all genes knocked out', () => {
    const tree: GPRTreeNode = {
      type: 'or',
      children: [
        { type: 'gene', id: 'b0001' },
        { type: 'gene', id: 'b0002' },
      ],
    };
    expect(evaluateGPR(tree, new Set(['b0001', 'b0002']))).toBe(false);
  });

  it('complex: (A AND B) OR C', () => {
    const tree: GPRTreeNode = {
      type: 'or',
      children: [
        {
          type: 'and',
          children: [
            { type: 'gene', id: 'b0001' },
            { type: 'gene', id: 'b0002' },
          ],
        },
        { type: 'gene', id: 'b0003' },
      ],
    };
    // All present → active
    expect(evaluateGPR(tree, new Set())).toBe(true);
    // Knock out A → still active via C
    expect(evaluateGPR(tree, new Set(['b0001']))).toBe(true);
    // Knock out C → still active via A AND B
    expect(evaluateGPR(tree, new Set(['b0003']))).toBe(true);
    // Knock out A and C → B alone is not enough (AND fails)
    expect(evaluateGPR(tree, new Set(['b0001', 'b0003']))).toBe(false);
    // Knock out all → inactive
    expect(evaluateGPR(tree, new Set(['b0001', 'b0002', 'b0003']))).toBe(false);
  });

  it('3-gene OR: only inactive when all 3 are knocked out', () => {
    const tree: GPRTreeNode = {
      type: 'or',
      children: [
        { type: 'gene', id: 'b1612' },
        { type: 'gene', id: 'b4122' },
        { type: 'gene', id: 'b1611' },
      ],
    };
    expect(evaluateGPR(tree, new Set(['b1612', 'b4122']))).toBe(true);
    expect(evaluateGPR(tree, new Set(['b1612', 'b4122', 'b1611']))).toBe(false);
  });
});

// ── getKnockoutReactions ─────────────────────────────────────────────

describe('getKnockoutReactions', () => {
  const sampleRules: Record<string, string> = {
    PFK: '(b3916 OR b0631)',
    PGI: '(b4025)',
    AKGDH: '(b0116 AND b0726 AND b0727)',
    SUCDi: '(b0721 AND b0722 AND b0723 AND b0724)',
    FUM: '(b1612 OR b4122 OR b1611)',
    CS: '(b0720)',
  };

  it('returns empty when no genes knocked out', () => {
    const result = getKnockoutReactions([], sampleRules);
    expect(result).toEqual([]);
  });

  it('knocks out single-gene reaction when gene is knocked out', () => {
    const result = getKnockoutReactions(['b4025'], sampleRules);
    expect(result).toContain('PGI');
    expect(result).not.toContain('PFK');
  });

  it('knocks out AND-complex when any subunit is knocked out', () => {
    const result = getKnockoutReactions(['b0726'], sampleRules);
    expect(result).toContain('AKGDH');
  });

  it('does not knock out AND-complex when no subunit is knocked out', () => {
    const result = getKnockoutReactions(['b9999'], sampleRules);
    expect(result).not.toContain('AKGDH');
  });

  it('does not knock out OR-isozyme when only one gene is knocked out', () => {
    const result = getKnockoutReactions(['b3916'], sampleRules);
    expect(result).not.toContain('PFK');
  });

  it('knocks out OR-isozyme when all genes are knocked out', () => {
    const result = getKnockoutReactions(['b3916', 'b0631'], sampleRules);
    expect(result).toContain('PFK');
  });

  it('returns sorted reaction IDs', () => {
    const result = getKnockoutReactions(['b0720', 'b4025'], sampleRules);
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it('handles empty rules gracefully', () => {
    const result = getKnockoutReactions(['b0001'], {});
    expect(result).toEqual([]);
  });

  it('handles malformed rules gracefully (skips them)', () => {
    const rules = { BAD: '((((((', GOOD: '(b0001)' };
    const result = getKnockoutReactions(['b0001'], rules);
    expect(result).toContain('GOOD');
    expect(result).not.toContain('BAD');
  });
});

// ── getGeneKnockoutEffect ────────────────────────────────────────────

describe('getGeneKnockoutEffect', () => {
  it('returns gene ID and affected reactions', () => {
    const rules = {
      PGI: '(b4025)',
      PFK: '(b3916 OR b0631)',
      CS: '(b0720)',
    };
    const result = getGeneKnockoutEffect('b4025', rules);
    expect(result.geneId).toBe('b4025');
    expect(result.affectedReactions).toContain('PGI');
    expect(result.affectedReactions).not.toContain('PFK');
    expect(result.affectedReactions).not.toContain('CS');
  });
});

// ── extractGeneIds ───────────────────────────────────────────────────

describe('extractGeneIds', () => {
  it('extracts all unique gene IDs from rules', () => {
    const rules = {
      PFK: '(b3916 OR b0631)',
      AKGDH: '(b0116 AND b0726 AND b0727)',
    };
    const genes = extractGeneIds(rules);
    expect(genes).toContain('b3916');
    expect(genes).toContain('b0631');
    expect(genes).toContain('b0116');
    expect(genes).toContain('b0726');
    expect(genes).toContain('b0727');
    expect(genes).toHaveLength(5);
  });

  it('returns sorted gene IDs', () => {
    const rules = { X: '(b0010 OR b0001)' };
    const genes = extractGeneIds(rules);
    expect(genes).toEqual(['b0001', 'b0010']);
  });

  it('returns empty array for empty rules', () => {
    expect(extractGeneIds({})).toEqual([]);
  });
});

// ── Integration with iJO1366 GPR rules ───────────────────────────────

describe('iJO1366 GPR rules integration', () => {
  it('IJO1366_GPR_RULES contains rules for key reactions', () => {
    // These are real BiGG GPR rules for E. coli iJO1366
    expect(IJO1366_GPR_RULES['PFK']).toBeDefined();
    expect(IJO1366_GPR_RULES['PGI']).toBeDefined();
    expect(IJO1366_GPR_RULES['CS']).toBeDefined();
    expect(IJO1366_GPR_RULES['AKGDH']).toBeDefined();
    expect(IJO1366_GPR_RULES['SUCDi']).toBeDefined();
    expect(IJO1366_GPR_RULES['PDH']).toBeDefined();
  });

  it('knocking out b4025 (PGI gene) knocks out PGI reaction', () => {
    const knockedOut = getKnockoutReactions(['b4025'], IJO1366_GPR_RULES);
    expect(knockedOut).toContain('PGI');
  });

  it('knocking out b3916 does NOT knock out PFK (isozyme b1723 remains)', () => {
    // e_coli_core PFK GPR = "b3916 OR b1723" (pfkA OR pfkB): either isozyme suffices.
    const knockedOut = getKnockoutReactions(['b3916'], IJO1366_GPR_RULES);
    expect(knockedOut).not.toContain('PFK');
  });

  it('knocking out both b3916 and b1723 knocks out PFK', () => {
    const knockedOut = getKnockoutReactions(['b3916', 'b1723'], IJO1366_GPR_RULES);
    expect(knockedOut).toContain('PFK');
  });

  it('knocking out one subunit of AKGDH complex knocks it out', () => {
    // AKGDH = b0116 AND b0726 AND b0727 — all 3 required
    const knockedOut = getKnockoutReactions(['b0116'], IJO1366_GPR_RULES);
    expect(knockedOut).toContain('AKGDH');
  });

  it('knocking out b0720 (CS gene) knocks out citrate synthase', () => {
    const knockedOut = getKnockoutReactions(['b0720'], IJO1366_GPR_RULES);
    expect(knockedOut).toContain('CS');
  });

  it('SUCDi requires all 4 subunits (b0721-b0724)', () => {
    // Knock out one subunit → reaction dead
    expect(getKnockoutReactions(['b0721'], IJO1366_GPR_RULES)).toContain('SUCDi');
    expect(getKnockoutReactions(['b0722'], IJO1366_GPR_RULES)).toContain('SUCDi');
    // No knockouts → reaction alive
    expect(getKnockoutReactions([], IJO1366_GPR_RULES)).not.toContain('SUCDi');
  });

  it('extractGeneIds returns genes from real iJO1366 rules', () => {
    const genes = extractGeneIds(IJO1366_GPR_RULES);
    expect(genes.length).toBeGreaterThan(50); // We have 40+ reactions with GPR
    expect(genes).toContain('b4025');  // PGI
    expect(genes).toContain('b0720');  // CS
    expect(genes).toContain('b3916');  // PFK
  });
});

// ── GPR-to-LP integration (applyGeneKnockoutsToModel) ───────────────

describe('GPR-to-LP integration', () => {
  it('knocks out reactions when their GPR genes are knocked out', () => {
    const model = {
      reactions: [
        { id: 'RXN_A', lb: -10, ub: 10, stoichiometry: { a: -1, b: 1 }, gpr: '(gene1 AND gene2)' },
        { id: 'RXN_B', lb: -10, ub: 10, stoichiometry: { b: -1, c: 1 }, gpr: '(gene3 OR gene4)' },
        { id: 'RXN_C', lb: -10, ub: 10, stoichiometry: { c: -1, d: 1 }, gpr: '(gene5)' },
      ],
    };
    const knockedOutGenes = ['gene1', 'gene3'];
    const modifiedModel = applyGeneKnockoutsToModel(model, knockedOutGenes);

    // RXN_A: gene1 AND gene2 → gene1 knocked out → RXN_A knocked out
    expect(modifiedModel.reactions[0].ub).toBe(0);
    expect(modifiedModel.reactions[0].lb).toBe(0);

    // RXN_B: gene3 OR gene4 → gene3 knocked out but gene4 still active → RXN_B active
    expect(modifiedModel.reactions[1].ub).toBe(10);

    // RXN_C: gene5 → not knocked out → RXN_C active
    expect(modifiedModel.reactions[2].ub).toBe(10);
  });

  it('handles complex nested GPR rules', () => {
    const model = {
      reactions: [
        { id: 'COMPLEX', lb: -10, ub: 10, stoichiometry: {}, gpr: '((g1 AND g2) OR (g3 AND g4))' },
      ],
    };
    const result = applyGeneKnockoutsToModel(model, ['g1', 'g3']);
    expect(result.reactions[0].ub).toBe(0);
  });

  it('leaves reactions without GPR rules unchanged', () => {
    const model = {
      reactions: [
        { id: 'NO_GPR', lb: -5, ub: 5, stoichiometry: {} },
        { id: 'WITH_GPR', lb: -5, ub: 5, stoichiometry: {}, gpr: '(gene1)' },
      ],
    };
    const result = applyGeneKnockoutsToModel(model, ['gene1']);
    expect(result.reactions[0].lb).toBe(-5);
    expect(result.reactions[0].ub).toBe(5);
    expect(result.reactions[1].lb).toBe(0);
    expect(result.reactions[1].ub).toBe(0);
  });

  it('does not mutate the original model', () => {
    const model = {
      reactions: [
        { id: 'RXN', lb: -10, ub: 10, stoichiometry: {}, gpr: '(gene1)' },
      ],
    };
    const result = applyGeneKnockoutsToModel(model, ['gene1']);
    expect(model.reactions[0].ub).toBe(10); // original unchanged
    expect(result.reactions[0].ub).toBe(0);  // copy is modified
  });

  it('no knockouts means all reactions stay active', () => {
    const model = {
      reactions: [
        { id: 'A', lb: -10, ub: 10, stoichiometry: {}, gpr: '(gene1 AND gene2)' },
        { id: 'B', lb: -10, ub: 10, stoichiometry: {}, gpr: '(gene3 OR gene4)' },
      ],
    };
    const result = applyGeneKnockoutsToModel(model, []);
    expect(result.reactions[0].ub).toBe(10);
    expect(result.reactions[1].ub).toBe(10);
  });
});
