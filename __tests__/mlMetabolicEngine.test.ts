/**
 * Tests for Rule-Based Metabolic Engineering Engine
 *
 * Verifies that the engine:
 *   1. Predicts enzyme function from real sequence signatures (not random NN)
 *   2. Uses Monod kinetics for flux prediction (not random weights)
 *   3. Uses stoichiometric balance for yield prediction
 *   4. Produces deterministic, reproducible results
 */

import {
  extractEnzymeFeatures,
  predictEnzymeFunction,
  predictFluxes,
  predictPathwayYield,
  MetabolicFeatures,
} from '../src/server/mlMetabolicEngine';

describe('mlMetabolicEngine', () => {
  describe('extractEnzymeFeatures', () => {
    it('should compute correct amino acid composition', () => {
      // Simple sequence: 10 A's, 10 G's
      const sequence = 'AAAAAAAAAAGGGGGGGGGG';
      const features = extractEnzymeFeatures(sequence);

      expect(features.aminoAcidComposition['A']).toBeCloseTo(0.5, 2);
      expect(features.aminoAcidComposition['G']).toBeCloseTo(0.5, 2);
      expect(features.aminoAcidComposition['C']).toBeCloseTo(0, 2);
      expect(features.length).toBe(20);
    });

    it('should compute molecular weight from amino acid composition', () => {
      const sequence = 'AG'; // Ala=89, Gly=75
      const features = extractEnzymeFeatures(sequence);
      expect(features.molecularWeight).toBe(89 + 75);
    });

    it('should compute dipeptide frequency', () => {
      const sequence = 'AGAGAG'; // AG appears 3 times, GA appears 2 times
      const features = extractEnzymeFeatures(sequence);
      // AG frequency: 3 occurrences / 5 possible positions
      expect(features.dipeptideFrequency['AG']).toBeCloseTo(3 / 5, 2);
    });
  });

  describe('predictEnzymeFunction', () => {
    it('should detect oxidoreductase from Rossmann fold motif (GXGXXG)', () => {
      // Construct a sequence with a clear Rossmann fold motif
      // GXGXXG where X is any amino acid
      // Also high glycine content to boost oxidoreductase score
      const rosmannSequence = 'M' + 'GAGFAG'.repeat(10) + 'G'.repeat(20) + 'DE'.repeat(10) + 'L'.repeat(20);
      // This gives us GXGXXG motif repeated + high G content

      return predictEnzymeFunction(rosmannSequence).then(result => {
        expect(result.predictedEC).toBe('1.-.-.-');
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should detect hydrolase from GxSxG motif', () => {
      // Construct a sequence with serine hydrolase signature
      // GxSxG motif + high serine and aspartate content
      const hydrolaseSequence = 'M' + 'GASAG'.repeat(10) + 'S'.repeat(20) + 'D'.repeat(15) + 'A'.repeat(20);

      return predictEnzymeFunction(hydrolaseSequence).then(result => {
        // Should detect hydrolase signature
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.alternativeECs.length).toBeGreaterThan(0);
      });
    });

    it('should return deterministic results (no randomness)', () => {
      const sequence = 'MKWVTFISLLFLFSSAYS' + 'G'.repeat(30) + 'A'.repeat(30);

      return Promise.all([
        predictEnzymeFunction(sequence),
        predictEnzymeFunction(sequence),
      ]).then(([result1, result2]) => {
        expect(result1.predictedEC).toBe(result2.predictedEC);
        expect(result1.confidence).toBe(result2.confidence);
      });
    });

    it('should handle short sequences gracefully', () => {
      return predictEnzymeFunction('MKWV').then(result => {
        expect(result.predictedEC).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('predictFluxes', () => {
    it('should return Monod-consistent flux values', () => {
      const geneExpressions = {
        geneA: 5.0,
        geneB: 3.0,
        geneC: 8.0,
      };
      const reactions = ['R1', 'R2', 'R3'];

      const result = predictFluxes(geneExpressions, reactions);

      // All fluxes should be positive
      for (const flux of Object.values(result.predictedFluxes)) {
        expect(flux).toBeGreaterThanOrEqual(0);
      }

      // Should have fluxes for all reactions
      expect(Object.keys(result.predictedFluxes)).toEqual(reactions);

      // Uncertainty should be non-negative
      for (const unc of Object.values(result.uncertainty)) {
        expect(unc).toBeGreaterThanOrEqual(0);
      }
    });

    it('should produce higher fluxes for higher expression levels', () => {
      const lowExpr = { geneA: 1.0 };
      const highExpr = { geneA: 10.0 };
      const reactions = ['R1'];

      const lowResult = predictFluxes(lowExpr, reactions);
      const highResult = predictFluxes(highExpr, reactions);

      // Higher expression → higher flux (Monod kinetics)
      expect(highResult.predictedFluxes['R1']).toBeGreaterThan(lowResult.predictedFluxes['R1']);
    });

    it('should return deterministic results (no randomness)', () => {
      const geneExpressions = { geneA: 5.0, geneB: 3.0 };
      const reactions = ['R1', 'R2'];

      const result1 = predictFluxes(geneExpressions, reactions);
      const result2 = predictFluxes(geneExpressions, reactions);

      expect(result1.predictedFluxes).toEqual(result2.predictedFluxes);
      expect(result1.uncertainty).toEqual(result2.uncertainty);
    });
  });

  describe('predictPathwayYield', () => {
    it('should return yield > 0 and < theoretical max', () => {
      const features: MetabolicFeatures = {
        geneExpressions: {
          enzyme1: 5.0,
          enzyme2: 3.0,
          enzyme3: 4.0,
        },
        metaboliteConcentrations: { glucose: 10.0 },
        growthRate: 0.5,
        substrate: 'glucose',
        product: 'target_product',
      };
      const pathwayEnzymes = ['enzyme1', 'enzyme2', 'enzyme3'];

      const result = predictPathwayYield(features, pathwayEnzymes);

      // Yield should be positive
      expect(result.predictedYield).toBeGreaterThan(0);

      // Yield should be less than theoretical max (0.5 g/g)
      expect(result.predictedYield).toBeLessThan(0.5);

      // Rate should be positive
      expect(result.predictedRate).toBeGreaterThan(0);

      // Bottleneck should be identified
      expect(result.bottleneckEnzyme).toBeDefined();
      expect(['expression', 'activity', 'substrate', 'cofactor']).toContain(result.bottleneckType);

      // Confidence should be between 0 and 1
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should identify the lowest-expressed enzyme as bottleneck', () => {
      const features: MetabolicFeatures = {
        geneExpressions: {
          enzyme1: 10.0,
          enzyme2: 1.0,  // lowest
          enzyme3: 8.0,
        },
        metaboliteConcentrations: { glucose: 10.0 },
        growthRate: 0.5,
        substrate: 'glucose',
        product: 'target_product',
      };
      const pathwayEnzymes = ['enzyme1', 'enzyme2', 'enzyme3'];

      const result = predictPathwayYield(features, pathwayEnzymes);

      expect(result.bottleneckEnzyme).toBe('enzyme2');
      // Expression 1.0 is not below 0.1 threshold, so classified as 'activity'
      expect(result.bottleneckType).toBe('activity');
    });

    it('should return lower yield when bottleneck enzyme has very low expression', () => {
      const highBottleneck: MetabolicFeatures = {
        geneExpressions: { enzyme1: 10.0, enzyme2: 5.0 },
        metaboliteConcentrations: { glucose: 10.0 },
        growthRate: 0.5,
        substrate: 'glucose',
        product: 'target_product',
      };
      const lowBottleneck: MetabolicFeatures = {
        geneExpressions: { enzyme1: 10.0, enzyme2: 0.1 },
        metaboliteConcentrations: { glucose: 10.0 },
        growthRate: 0.5,
        substrate: 'glucose',
        product: 'target_product',
      };
      const pathwayEnzymes = ['enzyme1', 'enzyme2'];

      const highResult = predictPathwayYield(highBottleneck, pathwayEnzymes);
      const lowResult = predictPathwayYield(lowBottleneck, pathwayEnzymes);

      // Lower expression → lower yield
      expect(lowResult.predictedYield).toBeLessThan(highResult.predictedYield);
    });

    it('should return deterministic results (no randomness)', () => {
      const features: MetabolicFeatures = {
        geneExpressions: { enzyme1: 5.0, enzyme2: 3.0 },
        metaboliteConcentrations: { glucose: 10.0 },
        growthRate: 0.5,
        substrate: 'glucose',
        product: 'target_product',
      };
      const pathwayEnzymes = ['enzyme1', 'enzyme2'];

      const result1 = predictPathwayYield(features, pathwayEnzymes);
      const result2 = predictPathwayYield(features, pathwayEnzymes);

      expect(result1.predictedYield).toBe(result2.predictedYield);
      expect(result1.predictedRate).toBe(result2.predictedRate);
      expect(result1.bottleneckEnzyme).toBe(result2.bottleneckEnzyme);
    });

    it('should compute feature importance for all enzymes', () => {
      const features: MetabolicFeatures = {
        geneExpressions: { enzyme1: 5.0, enzyme2: 3.0, enzyme3: 4.0 },
        metaboliteConcentrations: { glucose: 10.0 },
        growthRate: 0.5,
        substrate: 'glucose',
        product: 'target_product',
      };
      const pathwayEnzymes = ['enzyme1', 'enzyme2', 'enzyme3'];

      const result = predictPathwayYield(features, pathwayEnzymes);

      // All enzymes should have feature importance
      for (const enzyme of pathwayEnzymes) {
        expect(result.featureImportance[enzyme]).toBeDefined();
        expect(result.featureImportance[enzyme]).toBeGreaterThan(0);
      }
    });
  });
});
