import { predictGeneExpression } from '../src/server/geneExpressionPredictor';

describe('geneExpressionPredictor', () => {
  const samplePromoter = 'TTGACATATACATTAAGAATTCGATATCAATGACAAT';
  const sampleRBS = 'AAGAAGGAGATATACAT';
  const sampleCDS = 'ATGAAACGCACCAGCAACAGCACCAGCAACAGCACCAGCAACAGCACCAGCAACAGCAACTAA';
  const sampleTerminator = 'GGCGCGCCCCCTTTTTTTTT';

  describe('predictGeneExpression', () => {
    it('predicts expression for a valid construct', () => {
      const result = predictGeneExpression(samplePromoter, sampleRBS, sampleCDS, sampleTerminator, 'ecoli');
      expect(result.relativeExpression).toBeGreaterThanOrEqual(0);
      expect(result.relativeExpression).toBeLessThanOrEqual(1);
    });

    it('returns contributions for all components', () => {
      const result = predictGeneExpression(samplePromoter, sampleRBS, sampleCDS, sampleTerminator, 'ecoli');
      expect(result.contributions.promoter).toBeGreaterThanOrEqual(0);
      expect(result.contributions.rbs).toBeGreaterThanOrEqual(0);
      expect(result.contributions.cds).toBeGreaterThanOrEqual(0);
      expect(result.contributions.terminator).toBeGreaterThanOrEqual(0);
      expect(result.contributions.host).toBeGreaterThanOrEqual(0);
    });

    it('identifies bottlenecks', () => {
      const result = predictGeneExpression(samplePromoter, sampleRBS, sampleCDS, sampleTerminator, 'ecoli');
      expect(Array.isArray(result.bottlenecks)).toBe(true);
    });

    it('generates optimization suggestions', () => {
      const result = predictGeneExpression(samplePromoter, sampleRBS, sampleCDS, sampleTerminator, 'ecoli');
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('includes ESM-2 derived features', () => {
      const result = predictGeneExpression(samplePromoter, sampleRBS, sampleCDS, sampleTerminator, 'ecoli');
      expect(result.features.predictedSolubility).toBeGreaterThanOrEqual(0);
      expect(result.features.foldingBurden).toBeGreaterThanOrEqual(0);
      expect(result.features.structuralRisk).toBeGreaterThanOrEqual(0);
    });

    it('generates design notes', () => {
      const result = predictGeneExpression(samplePromoter, sampleRBS, sampleCDS, sampleTerminator, 'ecoli');
      expect(result.designNotes.length).toBeGreaterThan(0);
      expect(result.designNotes[0]).toContain('Predicted expression');
    });

    it('handles different hosts', () => {
      const ecoli = predictGeneExpression(samplePromoter, sampleRBS, sampleCDS, sampleTerminator, 'ecoli');
      const yeast = predictGeneExpression(samplePromoter, sampleRBS, sampleCDS, sampleTerminator, 'yeast');
      expect(ecoli.host).toBe('ecoli');
      expect(yeast.host).toBe('yeast');
      // Expression should differ due to different tRNA profiles
      expect(ecoli.relativeExpression).not.toEqual(yeast.relativeExpression);
    });

    it('throws on invalid CDS (no start codon)', () => {
      expect(() => {
        predictGeneExpression(samplePromoter, sampleRBS, 'AAACCCGGG', sampleTerminator, 'ecoli');
      }).toThrow('CDS must start with ATG');
    });

    it('computes CAI and tAI', () => {
      const result = predictGeneExpression(samplePromoter, sampleRBS, sampleCDS, sampleTerminator, 'ecoli');
      expect(result.features.cai).toBeGreaterThanOrEqual(0);
      expect(result.features.cai).toBeLessThanOrEqual(1);
      expect(result.features.tai).toBeGreaterThanOrEqual(0);
    });
  });
});
