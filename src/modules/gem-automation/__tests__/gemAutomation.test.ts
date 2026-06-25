/**
 * GEM Automation Tests
 */

import { automateGEM } from '../gemAutomation';

describe('gemAutomation', () => {
  const sampleAnnotations = [
    { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
    { geneId: 'b0002', geneName: 'pgi', organism: 'ecoli', ecNumber: '5.3.1.9' },
    { geneId: 'b0003', geneName: 'pfk', organism: 'ecoli', ecNumber: '2.7.1.11' },
  ];

  describe('automateGEM', () => {
    it('reconstructs a model from annotations', async () => {
      const result = await automateGEM({
        annotations: sampleAnnotations,
        organism: 'ecoli',
      });
      expect(result.model.reactions.length).toBeGreaterThan(0);
      expect(result.model.metabolites.length).toBeGreaterThan(0);
      expect(result.model.biomassReaction).toBe('BIOMASS');
    });

    it('performs gap-filling', async () => {
      const result = await automateGEM({
        annotations: sampleAnnotations,
        organism: 'ecoli',
        gapFill: true,
      });
      expect(result.gapFilling).toBeDefined();
      expect(Array.isArray(result.gapFilling.addedReactions)).toBe(true);
    });

    it('identifies essential genes', async () => {
      const result = await automateGEM({
        annotations: sampleAnnotations,
        organism: 'ecoli',
      });
      expect(Array.isArray(result.essentialGenes)).toBe(true);
    });

    it('computes statistics', async () => {
      const result = await automateGEM({
        annotations: sampleAnnotations,
        organism: 'ecoli',
      });
      expect(result.stats.nReactions).toBeGreaterThan(0);
      expect(result.stats.nMetabolites).toBeGreaterThan(0);
      expect(result.stats.nGenes).toBe(3);
    });

    it('generates design notes', async () => {
      const result = await automateGEM({
        annotations: sampleAnnotations,
        organism: 'ecoli',
      });
      expect(result.designNotes.length).toBeGreaterThan(0);
      expect(result.designNotes[0]).toContain('Reconstructed');
    });

    it('handles empty annotations', async () => {
      const result = await automateGEM({
        annotations: [],
        organism: 'ecoli',
      });
      expect(result.model.reactions.length).toBeGreaterThan(0); // exchange + biomass
      expect(result.stats.nGenes).toBe(0);
    });
  });
});
