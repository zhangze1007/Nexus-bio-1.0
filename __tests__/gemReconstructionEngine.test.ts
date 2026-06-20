import { reconstructGEM, mapGenesToReactions, generateBiomassReaction } from '../src/server/gemReconstructionEngine';

describe('gemReconstructionEngine', () => {
  describe('mapGenesToReactions', () => {
    it('maps EC 2.7.1.1 to hexokinase reaction', () => {
      const reactions = mapGenesToReactions([{ geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' }]);
      expect(reactions.length).toBeGreaterThan(0);
      expect(reactions[0].id).toBe('HEX1');
    });

    it('returns empty array for unknown EC number', () => {
      const reactions = mapGenesToReactions([{ geneId: 'b9999', geneName: 'unknown', organism: 'ecoli', ecNumber: '99.99.99.99' }]);
      expect(reactions).toEqual([]);
    });

    it('maps multiple genes to multiple reactions', () => {
      const reactions = mapGenesToReactions([
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
    it('builds a complete model from E. coli annotations', () => {
      const annotations = [
        { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
        { geneId: 'b0002', geneName: 'pgi', organism: 'ecoli', ecNumber: '5.3.1.9' },
      ];
      const gem = reconstructGEM(annotations);
      expect(gem.reactions.length).toBeGreaterThan(0);
      expect(gem.metabolites.length).toBeGreaterThan(0);
      expect(gem.genes.length).toBe(2);
      expect(gem.biomassReaction).toBe('BIOMASS');
      expect(gem.stats.nReactions).toBe(gem.reactions.length);
    });

    it('handles empty annotations gracefully', () => {
      const gem = reconstructGEM([]);
      expect(gem.reactions.length).toBe(0);
      expect(gem.stats.nReactions).toBe(0);
    });
  });
});
