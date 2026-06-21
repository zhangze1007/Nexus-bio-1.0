/**
 * Structure Predictor Tests
 */

import { predictStructure } from '../structurePredictor';

describe('structurePredictor', () => {
  const sampleSequence = 'MKWVTFISLLFLFSSAYS';

  describe('predictStructure', () => {
    it('predicts single chain structure', async () => {
      const result = await predictStructure({
        chains: [{ id: 'A', sequence: sampleSequence, type: 'protein' }],
        mode: 'single_chain',
        source: 'esmfold',
        predictComplex: false,
      });
      expect(result.chains.length).toBe(1);
      expect(result.chains[0].chainId).toBe('A');
    });

    it('predicts multi-chain complex', async () => {
      const result = await predictStructure({
        chains: [
          { id: 'A', sequence: sampleSequence, type: 'protein' },
          { id: 'B', sequence: sampleSequence, type: 'protein' },
        ],
        mode: 'multi_chain',
        source: 'esmfold',
        predictComplex: true,
      });
      expect(result.chains.length).toBe(2);
      expect(result.complexMetrics).toBeDefined();
    });

    it('includes evidence from ESMFold', async () => {
      const result = await predictStructure({
        chains: [{ id: 'A', sequence: sampleSequence, type: 'protein' }],
        mode: 'single_chain',
        source: 'esmfold',
        predictComplex: false,
      });
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0].source).toBe('ESMFold');
    });

    it('generates design notes', async () => {
      const result = await predictStructure({
        chains: [{ id: 'A', sequence: sampleSequence, type: 'protein' }],
        mode: 'single_chain',
        source: 'esmfold',
        predictComplex: false,
      });
      expect(result.designNotes.length).toBeGreaterThan(0);
      expect(result.designNotes.length).toBeGreaterThan(0);
    });

    it('skips non-protein chains', async () => {
      const result = await predictStructure({
        chains: [
          { id: 'A', sequence: sampleSequence, type: 'protein' },
          { id: 'B', sequence: 'ATCGATCG', type: 'dna' },
        ],
        mode: 'protein_dna',
        source: 'esmfold',
        predictComplex: false,
      });
      // Only protein chain should be predicted
      expect(result.chains.length).toBe(1);
    });
  });
});
