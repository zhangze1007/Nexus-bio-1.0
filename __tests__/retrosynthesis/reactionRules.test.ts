import { parseSMILES } from '../../src/utils/smilesParser';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rules = require('../../src/data/reactionRules.json');

describe('reaction rules database', () => {
  it('has at least 50 rules', () => {
    expect(rules.length).toBeGreaterThanOrEqual(50);
  });

  it('all rules have required fields', () => {
    for (const rule of rules) {
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.enzymeClass).toBeDefined();
      expect(Array.isArray(rule.reactants)).toBe(true);
      expect(Array.isArray(rule.products)).toBe(true);
      expect(typeof rule.reversibility).toBe('boolean');
      expect(Array.isArray(rule.cofactors)).toBe(true);
    }
  });

  it('all reactant SMILES are parseable', () => {
    const errors: string[] = [];
    for (const rule of rules) {
      for (const smi of rule.reactants) {
        try {
          const g = parseSMILES(smi);
          if (g.atoms.length === 0) errors.push(`${rule.id}: empty reactant "${smi}"`);
        } catch (e) {
          errors.push(`${rule.id}: unparseable reactant "${smi}": ${e}`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('all product SMILES are parseable', () => {
    const errors: string[] = [];
    for (const rule of rules) {
      for (const smi of rule.products) {
        try {
          const g = parseSMILES(smi);
          if (g.atoms.length === 0) errors.push(`${rule.id}: empty product "${smi}"`);
        } catch (e) {
          errors.push(`${rule.id}: unparseable product "${smi}": ${e}`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('covers glycolysis reactions', () => {
    const names = rules.map((r: any) => r.name.toLowerCase());
    expect(names.some((n: string) => n.includes('hexokinase'))).toBe(true);
    expect(names.some((n: string) => n.includes('pyruvate kinase'))).toBe(true);
    expect(names.some((n: string) => n.includes('aldolase'))).toBe(true);
  });

  it('covers TCA cycle reactions', () => {
    const names = rules.map((r: any) => r.name.toLowerCase());
    expect(names.some((n: string) => n.includes('citrate synthase'))).toBe(true);
    expect(names.some((n: string) => n.includes('isocitrate dehydrogenase'))).toBe(true);
    expect(names.some((n: string) => n.includes('succinate dehydrogenase'))).toBe(true);
  });

  it('covers isoprenoid pathway', () => {
    const names = rules.map((r: any) => r.name.toLowerCase());
    expect(names.some((n: string) => n.includes('hmg-coa reductase'))).toBe(true);
    expect(names.some((n: string) => n.includes('fpp synthase'))).toBe(true);
  });
});
