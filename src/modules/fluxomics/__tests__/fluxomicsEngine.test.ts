/**
 * Fluxomics Engine Tests
 */

import { analyzeFluxomics } from '../fluxomicsEngine';

describe('fluxomicsEngine', () => {
  const sampleInput = {
    fluxEstimates: [
      { reactionId: 'HEX1', flux: 10, confidence: 0.9 },
      { reactionId: 'PFK', flux: 8, confidence: 0.85 },
      { reactionId: 'PYK', flux: 6, confidence: 0.8 },
      { reactionId: 'BIOMASS', flux: 0.5, confidence: 0.9 },
    ],
    geneExpression: {
      'HEX1': 0.8,
      'PFK': 0.6,
      'PYK': 0.3,
    },
    growthRate: 0.5,
  };

  describe('analyzeFluxomics', () => {
    it('computes flux-expression correlations', () => {
      const result = analyzeFluxomics(sampleInput);
      expect(result.correlations.length).toBeGreaterThan(0);
      expect(result.correlations[0]).toHaveProperty('correlation');
      expect(result.correlations[0]).toHaveProperty('pValue');
    });

    it('identifies bottlenecks', () => {
      const result = analyzeFluxomics(sampleInput);
      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks[0]).toHaveProperty('isBottleneck');
      expect(result.bottlenecks[0]).toHaveProperty('utilization');
    });

    it('computes efficiency metrics', () => {
      const result = analyzeFluxomics(sampleInput);
      expect(result.efficiency.carbonEfficiency).toBeGreaterThanOrEqual(0);
      expect(result.efficiency.oxygenEfficiency).toBeGreaterThanOrEqual(0);
      expect(result.efficiency.atpEfficiency).toBeGreaterThanOrEqual(0);
    });

    it('generates design notes', () => {
      const result = analyzeFluxomics(sampleInput);
      expect(result.designNotes.length).toBeGreaterThan(0);
      expect(result.designNotes[0]).toContain('Analyzed');
    });
  });
});
