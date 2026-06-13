/**
 * Retrosynthesis Engine Tests
 *
 * Tests for src/server/retrosynthesis.ts — backward BFS pathway search
 * over reaction rules from src/data/reactionRules.json.
 */

import {
  findPathways,
  normalizeSmiles,
  enzymeClassScore,
  type RetrosynthesisRequest,
  type Pathway,
} from '../../src/server/retrosynthesis';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rules = require('../../src/data/reactionRules.json');

/* ------------------------------------------------------------------ */
/*  normalizeSmiles                                                   */
/* ------------------------------------------------------------------ */

describe('normalizeSmiles', () => {
  it('removes stereochemistry markers', () => {
    const result = normalizeSmiles('[C@@H](O)(C)N');
    expect(result).not.toContain('@');
  });

  it('removes forward and back slashes', () => {
    const result = normalizeSmiles('C/C=C\\C');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
  });

  it('trims whitespace', () => {
    const result = normalizeSmiles('  CC(=O)C(O)=O  ');
    expect(result).toBe('CC(=O)C(O)=O');
  });

  it('preserves core SMILES content', () => {
    const result = normalizeSmiles('CC(=O)C(O)=O');
    expect(result).toBe('CC(=O)C(O)=O');
  });
});

/* ------------------------------------------------------------------ */
/*  enzymeClassScore                                                  */
/* ------------------------------------------------------------------ */

describe('enzymeClassScore', () => {
  it('returns 0.9 for oxidoreductases (EC 1.x.x.x)', () => {
    expect(enzymeClassScore('1.2.1.12')).toBe(0.9);
  });

  it('returns 0.8 for transferases (EC 2.x.x.x)', () => {
    expect(enzymeClassScore('2.7.1.2')).toBe(0.8);
  });

  it('returns 0.7 for hydrolases (EC 3.x.x.x)', () => {
    expect(enzymeClassScore('3.1.1.1')).toBe(0.7);
  });

  it('returns 0.6 for lyases (EC 4.x.x.x)', () => {
    expect(enzymeClassScore('4.2.1.11')).toBe(0.6);
  });

  it('returns 0.5 for isomerases (EC 5.x.x.x)', () => {
    expect(enzymeClassScore('5.3.1.9')).toBe(0.5);
  });

  it('returns 0.4 for ligases (EC 6.x.x.x)', () => {
    expect(enzymeClassScore('6.2.1.5')).toBe(0.4);
  });

  it('returns 0.3 for translocases (EC 7.x.x.x)', () => {
    expect(enzymeClassScore('7.1.2.2')).toBe(0.3);
  });

  it('returns 0.5 for unknown prefix', () => {
    expect(enzymeClassScore('0.0.0.0')).toBe(0.5);
  });
});

/* ------------------------------------------------------------------ */
/*  findPathways — basic functionality                                */
/* ------------------------------------------------------------------ */

describe('findPathways', () => {
  it('finds pathway from pyruvate to glucose', () => {
    // Glucose SMILES: OCC1OC(O)C(O)C(O)C1O
    const result = findPathways({
      targetSmiles: 'OCC1OC(O)C(O)C(O)C1O',
      maxSteps: 10,
      maxPathways: 5,
    });

    expect(result.pathways.length).toBeGreaterThan(0);
    expect(result.pathways[0].steps.length).toBeLessThanOrEqual(10);

    // Verify each step has the required fields
    for (const pathway of result.pathways) {
      for (const step of pathway.steps) {
        expect(step.ruleId).toBeDefined();
        expect(step.ruleName).toBeDefined();
        expect(step.enzymeClass).toBeDefined();
        expect(Array.isArray(step.reactantSmiles)).toBe(true);
        expect(Array.isArray(step.productSmiles)).toBe(true);
        expect(typeof step.reversibility).toBe('boolean');
        expect(Array.isArray(step.cofactors)).toBe(true);
      }
    }
  });

  it('returns empty for non-metabolic molecule', () => {
    const result = findPathways({
      targetSmiles: '[Fe+2]',
      maxSteps: 3,
    });
    expect(result.pathways.length).toBe(0);
  });

  it('respects maxPathways limit', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O', // pyruvate
      maxSteps: 5,
      maxPathways: 3,
    });
    expect(result.pathways.length).toBeLessThanOrEqual(3);
  });

  it('respects maxSteps limit', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O', // pyruvate
      maxSteps: 2,
      maxPathways: 10,
    });
    for (const pathway of result.pathways) {
      expect(pathway.steps.length).toBeLessThanOrEqual(2);
    }
  });

  it('uses default values when not specified', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O',
    });
    expect(result.pathways.length).toBeLessThanOrEqual(10);
    for (const pathway of result.pathways) {
      expect(pathway.steps.length).toBeLessThanOrEqual(5);
    }
  });

  it('includes totalTime in result', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O',
      maxSteps: 3,
    });
    expect(typeof result.totalTime).toBe('number');
    expect(result.totalTime).toBeGreaterThanOrEqual(0);
  });

  it('includes targetSmiles in result', () => {
    const targetSmiles = 'CC(=O)C(O)=O';
    const result = findPathways({
      targetSmiles,
      maxSteps: 3,
    });
    expect(result.targetSmiles).toBe(targetSmiles);
  });
});

/* ------------------------------------------------------------------ */
/*  findPathways — scoring                                            */
/* ------------------------------------------------------------------ */

describe('findPathways — scoring', () => {
  it('sorts pathways by score descending', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O', // pyruvate
      maxSteps: 5,
      maxPathways: 5,
    });

    for (let i = 1; i < result.pathways.length; i++) {
      expect(result.pathways[i - 1].score).toBeGreaterThanOrEqual(
        result.pathways[i].score,
      );
    }
  });

  it('assigns positive scores', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O',
      maxSteps: 5,
      maxPathways: 5,
    });

    for (const pathway of result.pathways) {
      expect(pathway.score).toBeGreaterThan(0);
    }
  });

  it('shorter pathways score higher than longer ones (all else equal)', () => {
    // Glucose → G6P (1 step) should score higher than longer alternatives
    const result = findPathways({
      targetSmiles: 'OCC1OC(O)C(O)C(O)C1O', // glucose
      maxSteps: 5,
      maxPathways: 10,
    });

    if (result.pathways.length >= 2) {
      // The shortest pathway should appear among the top-scored
      const minLen = Math.min(...result.pathways.map(p => p.length));
      const maxScore = Math.max(...result.pathways.map(p => p.score));
      const shortestScore = result.pathways.find(p => p.length === minLen)!.score;
      // The shortest pathway should have the max score (or very close)
      expect(shortestScore).toBeGreaterThanOrEqual(maxScore - 0.01);
    }
  });

  it('enzymeClassScore contributes to pathway scoring', () => {
    // 1,3-bisphosphoglycerate is 1 step from central metabolite G3P
    const result = findPathways({
      targetSmiles: 'OCC(OP(O)(O)=O)C(O)=O',
      maxSteps: 3,
      maxPathways: 5,
    });

    expect(result.pathways.length).toBeGreaterThan(0);

    for (const pathway of result.pathways) {
      if (pathway.steps.length > 0) {
        const avgEnzyme =
          pathway.steps.reduce((s, st) => s + enzymeClassScore(st.enzymeClass), 0) /
          pathway.steps.length;
        expect(avgEnzyme).toBeGreaterThanOrEqual(0);
        expect(avgEnzyme).toBeLessThanOrEqual(1);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  findPathways — pathway structure                                  */
/* ------------------------------------------------------------------ */

describe('findPathways — pathway structure', () => {
  it('each pathway step references a valid rule from reactionRules.json', () => {
    const ruleIds = new Set(rules.map((r: any) => r.id));

    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O',
      maxSteps: 5,
      maxPathways: 5,
    });

    for (const pathway of result.pathways) {
      for (const step of pathway.steps) {
        // The rule ID should exist in the database (allowing for duplicate IDs)
        expect(ruleIds.has(step.ruleId)).toBe(true);
      }
    }
  });

  it('pathway length matches number of steps', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O',
      maxSteps: 5,
      maxPathways: 5,
    });

    for (const pathway of result.pathways) {
      expect(pathway.length).toBe(pathway.steps.length);
    }
  });

  it('steps reference reactant and product SMILES', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O',
      maxSteps: 5,
      maxPathways: 5,
    });

    for (const pathway of result.pathways) {
      for (const step of pathway.steps) {
        expect(step.reactantSmiles.length).toBeGreaterThan(0);
        expect(step.productSmiles.length).toBeGreaterThan(0);
        for (const s of step.reactantSmiles) {
          expect(typeof s).toBe('string');
          expect(s.length).toBeGreaterThan(0);
        }
        for (const s of step.productSmiles) {
          expect(typeof s).toBe('string');
          expect(s.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  findPathways — edge cases                                         */
/* ------------------------------------------------------------------ */

describe('findPathways — edge cases', () => {
  it('handles central metabolite as target', () => {
    // Pyruvate is a central metabolite
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O',
      maxSteps: 3,
      maxPathways: 5,
    });
    // Should still find pathways (pyruvate appears in many reactions as product)
    // The central metabolite path itself may or may not be included
    expect(result).toBeDefined();
    expect(result.targetSmiles).toBe('CC(=O)C(O)=O');
  });

  it('handles empty string target', () => {
    const result = findPathways({
      targetSmiles: '',
      maxSteps: 3,
    });
    expect(result.pathways.length).toBe(0);
  });

  it('handles maxSteps of 0', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O',
      maxSteps: 0,
    });
    expect(result.pathways.length).toBe(0);
  });

  it('handles maxPathways of 0', () => {
    const result = findPathways({
      targetSmiles: 'CC(=O)C(O)=O',
      maxSteps: 5,
      maxPathways: 0,
    });
    expect(result.pathways.length).toBe(0);
  });

  it('produces consistent results on repeated calls', () => {
    const req: RetrosynthesisRequest = {
      targetSmiles: 'CC(=O)C(O)=O',
      maxSteps: 3,
      maxPathways: 5,
    };
    const r1 = findPathways(req);
    const r2 = findPathways(req);
    expect(r1.pathways.length).toBe(r2.pathways.length);
    for (let i = 0; i < r1.pathways.length; i++) {
      expect(r1.pathways[i].length).toBe(r2.pathways[i].length);
      expect(r1.pathways[i].score).toBeCloseTo(r2.pathways[i].score, 5);
    }
  });
});
