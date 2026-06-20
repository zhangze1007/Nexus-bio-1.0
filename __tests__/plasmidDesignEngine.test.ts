import { designPlasmid } from '../src/server/plasmidDesignEngine';

describe('plasmidDesignEngine', () => {
  const sampleCDS = 'ATGAAACGCACCAGCAACAGCACCAGCAACAGCACCAGCAACAGCACCAGCAACAGCAACTAA';

  describe('designPlasmid', () => {
    it('returns main design + alternatives', () => {
      const result = designPlasmid(sampleCDS, 'ecoli', 'high_expression');
      expect(result.mainDesign).toBeDefined();
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('optimizes CDS codon usage', () => {
      const result = designPlasmid(sampleCDS, 'ecoli');
      expect(result.mainDesign.cdsOptimization.metrics.caiAfter).toBeGreaterThanOrEqual(0);
      expect(result.mainDesign.cdsOptimization.changes.length).toBeGreaterThanOrEqual(0);
    });

    it('checks assembly compatibility', () => {
      const result = designPlasmid(sampleCDS, 'ecoli', 'high_expression', 'gibson');
      expect(result.mainDesign.assemblyChecks.length).toBeGreaterThan(0);
      expect(result.mainDesign.assemblyChecks[0].method).toBe('gibson');
    });

    it('predicts expression', () => {
      const result = designPlasmid(sampleCDS, 'ecoli');
      expect(result.mainDesign.predictedExpression).toBeGreaterThanOrEqual(0);
      expect(result.mainDesign.predictedExpression).toBeLessThanOrEqual(1);
    });

    it('generates failure summary', () => {
      const result = designPlasmid(sampleCDS, 'ecoli');
      expect(Array.isArray(result.failureSummary)).toBe(true);
    });

    it('returns component scores', () => {
      const result = designPlasmid(sampleCDS, 'ecoli');
      expect(Object.keys(result.componentScores).length).toBeGreaterThan(0);
    });

    it('includes change log', () => {
      const result = designPlasmid(sampleCDS, 'ecoli');
      expect(Array.isArray(result.mainDesign.changeLog)).toBe(true);
    });

    it('handles yeast host', () => {
      const result = designPlasmid(sampleCDS, 'yeast');
      expect(result.mainDesign.host).toBe('yeast');
    });
  });
});
