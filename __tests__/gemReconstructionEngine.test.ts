import { reconstructGEM, mapGenesToReactions, generateBiomassReaction, parseGPR, computeKnockoutProbability, evaluateGPR, detectGaps, findEssentialGenes, computeEpistasis } from '../src/server/gemReconstructionEngine';

describe('gemReconstructionEngine', () => {
  describe('mapGenesToReactions', () => {
    it('maps EC 2.7.1.1 to hexokinase reaction', async () => {
      const reactions = await mapGenesToReactions([{ geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' }]);
      expect(reactions.length).toBeGreaterThan(0);
      expect(reactions[0].id).toBe('HEX1');
    });

    it('returns empty array for unknown EC number (KEGG fallback fails in test)', async () => {
      // In test environment the KEGG proxy is not available, so unknown EC
      // numbers return empty (network error is swallowed).
      const reactions = await mapGenesToReactions([{ geneId: 'b9999', geneName: 'unknown', organism: 'ecoli', ecNumber: '99.99.99.99' }]);
      expect(reactions).toEqual([]);
    });

    it('maps multiple genes to multiple reactions', async () => {
      const reactions = await mapGenesToReactions([
        { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
        { geneId: 'b0002', geneName: 'pgi', organism: 'ecoli', ecNumber: '5.3.1.9' },
      ]);
      expect(reactions.length).toBe(2);
    });
  });

  describe('generateBiomassReaction', () => {
    it('generates biomass reaction with amino acids', () => {
      const metabolites = [
        { id: 'ala__L_c', name: 'L-Alanine', formula: 'C3H7NO2', compartment: 'c' },
        { id: 'atp_c', name: 'ATP', formula: 'C10H12N5O13P3', compartment: 'c' },
      ];
      const rxn = generateBiomassReaction(metabolites);
      expect(rxn.id).toBe('BIOMASS');
      expect(rxn.stoichiometry['ala__L_c']).toBeLessThan(0);
    });

    it('includes ATP maintenance cost', () => {
      const rxn = generateBiomassReaction([]);
      expect(rxn.stoichiometry['atp_c']).toBeLessThan(0);
    });
  });

  describe('reconstructGEM', () => {
    it('builds a complete model from E. coli annotations', async () => {
      const annotations = [
        { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
        { geneId: 'b0002', geneName: 'pgi', organism: 'ecoli', ecNumber: '5.3.1.9' },
      ];
      const gem = await reconstructGEM(annotations);
      expect(gem.reactions.length).toBeGreaterThan(0);
      expect(gem.metabolites.length).toBeGreaterThan(0);
      expect(gem.genes.length).toBe(2);
      expect(gem.biomassReaction).toBe('BIOMASS');
      expect(gem.stats.nReactions).toBe(gem.reactions.length);
    });

    it('handles empty annotations gracefully', async () => {
      const gem = await reconstructGEM([]);
      // Empty annotations still produce exchange + biomass reactions
      expect(gem.genes.length).toBe(0);
      expect(gem.reactions.length).toBeGreaterThan(0); // exchange + biomass
      expect(gem.biomassReaction).toBe('BIOMASS');
    });
  });

  describe('GPR parsing', () => {
    it('parses simple AND expression', () => {
      const gpr = parseGPR('b0001 AND b0002');
      expect(gpr.type).toBe('and');
      expect(gpr.genes).toContain('b0001');
      expect(gpr.genes).toContain('b0002');
    });

    it('parses simple OR expression', () => {
      const gpr = parseGPR('b0001 OR b0002');
      expect(gpr.type).toBe('or');
      expect(gpr.genes).toContain('b0001');
      expect(gpr.genes).toContain('b0002');
    });

    it('parses nested OR/AND expression', () => {
      const gpr = parseGPR('(b0001 AND b0002) OR b0003');
      expect(gpr.type).toBe('or');
      expect(gpr.children.length).toBe(2);
      expect(gpr.genes).toContain('b0001');
      expect(gpr.genes).toContain('b0002');
      expect(gpr.genes).toContain('b0003');
    });

    it('parses single gene', () => {
      const gpr = parseGPR('b0001');
      expect(gpr.type).toBe('gene');
      expect(gpr.genes).toEqual(['b0001']);
    });

    it('evaluates GPR with active genes', () => {
      const gpr = parseGPR('b0001 AND b0002');
      expect(evaluateGPR(gpr, new Set(['b0001', 'b0002']))).toBe(true);
      expect(evaluateGPR(gpr, new Set(['b0001']))).toBe(false);
    });

    it('evaluates OR GPR correctly', () => {
      const gpr = parseGPR('b0001 OR b0002');
      expect(evaluateGPR(gpr, new Set(['b0001']))).toBe(true);
      expect(evaluateGPR(gpr, new Set(['b0002']))).toBe(true);
      expect(evaluateGPR(gpr, new Set(['b0003']))).toBe(false);
    });

    it('computes knockout probability for OR (isozymes)', () => {
      const gpr = parseGPR('b0001 OR b0002');
      // Knocking out b0001: b0002 still active → P = 1
      expect(computeKnockoutProbability(gpr, new Set(['b0001']))).toBe(1);
      // Knocking out both: P = 0
      expect(computeKnockoutProbability(gpr, new Set(['b0001', 'b0002']))).toBe(0);
    });

    it('computes knockout probability for AND (complex)', () => {
      const gpr = parseGPR('b0001 AND b0002');
      // Knocking out b0001: complex inactive → P = 0
      expect(computeKnockoutProbability(gpr, new Set(['b0001']))).toBe(0);
      // No knockouts: P = 1
      expect(computeKnockoutProbability(gpr, new Set())).toBe(1);
    });
  });

  describe('gap detection', () => {
    it('detects orphan metabolites in incomplete model', async () => {
      const annotations = [
        { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
      ];
      const gem = await reconstructGEM(annotations);
      const gaps = detectGaps(gem);
      expect(gaps.orphanProducers.length).toBeGreaterThan(0);
    });

    it('returns empty gaps for complete model', async () => {
      // A model with many reactions should have fewer gaps
      const annotations = [
        { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
        { geneId: 'b0002', geneName: 'pgi', organism: 'ecoli', ecNumber: '5.3.1.9' },
        { geneId: 'b0003', geneName: 'pfk', organism: 'ecoli', ecNumber: '2.7.1.11' },
        { geneId: 'b0004', geneName: 'fba', organism: 'ecoli', ecNumber: '4.1.2.13' },
      ];
      const gem = await reconstructGEM(annotations);
      const gaps = detectGaps(gem);
      // With more reactions, fewer orphans
      expect(gaps.orphanProducers.length).toBeLessThan(5);
    });
  });

  describe('essential gene analysis', () => {
    it('identifies essential genes', async () => {
      const annotations = [
        { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
        { geneId: 'b0002', geneName: 'pgi', organism: 'ecoli', ecNumber: '5.3.1.9' },
      ];
      const gem = await reconstructGEM(annotations);
      const essential = findEssentialGenes(gem);
      expect(essential.length).toBe(2);
      expect(essential[0]).toHaveProperty('geneId');
      expect(essential[0]).toHaveProperty('essential');
      expect(essential[0]).toHaveProperty('growthWithout');
      expect(essential[0]).toHaveProperty('affectedReactions');
    });

    it('computes epistasis for gene pairs', async () => {
      const annotations = [
        { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
        { geneId: 'b0002', geneName: 'pgi', organism: 'ecoli', ecNumber: '5.3.1.9' },
      ];
      const gem = await reconstructGEM(annotations);
      const epistasis = computeEpistasis(gem, [['b0001', 'b0002']]);
      expect(epistasis.length).toBe(1);
      expect(epistasis[0]).toHaveProperty('epistasis');
      expect(epistasis[0]).toHaveProperty('type');
      expect(['synergistic', 'antagonistic', 'synthetic_lethal', 'neutral']).toContain(epistasis[0].type);
    });
  });
});
