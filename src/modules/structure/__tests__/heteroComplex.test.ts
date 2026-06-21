/**
 * Protein-DNA/RNA Complex Support Tests
 *
 * Tests for multi-type chain encoding, chain type-specific feature extraction,
 * complex encoding, and hetero-complex interface prediction.
 */

import {
  extractChainFeatures,
  encodeHeteroComplex,
  predictHeteroInterface,
} from '../heteroComplex';
import type { ProteinChain, HeteroComplex } from '../types';

// ── Test Data ─────────────────────────────────────────────────────────────────

const proteinChain: ProteinChain = {
  id: 'A',
  sequence: 'MKWVTFISLLFLFSSAYS',
  type: 'protein',
  description: 'Test protein',
};

const dnaChain: ProteinChain = {
  id: 'B',
  sequence: 'ATCGATCGATCG',
  type: 'dna',
  description: 'Test DNA',
};

const rnaChain: ProteinChain = {
  id: 'C',
  sequence: 'AUCGAUCGAUCG',
  type: 'rna',
  description: 'Test RNA',
};

const anotherProteinChain: ProteinChain = {
  id: 'D',
  sequence: 'GGGGGGGGGGGGGGGGGG',
  type: 'protein',
};

const emptyProteinChain: ProteinChain = {
  id: 'E',
  sequence: '',
  type: 'protein',
};

const emptyDnaChain: ProteinChain = {
  id: 'F',
  sequence: '',
  type: 'dna',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('heteroComplex', () => {
  // ── Chain Feature Extraction ─────────────────────────────────────────────────

  describe('extractChainFeatures', () => {
    it('returns features of correct length for protein chains', () => {
      const features = extractChainFeatures(proteinChain);

      // Protein features: 20 AA composition + 3 physicochemical + 1 length = 24
      expect(features.length).toBe(24);
    });

    it('returns features of correct length for DNA chains', () => {
      const features = extractChainFeatures(dnaChain);

      // DNA features: 4 nucleotide composition + 1 GC content + 1 length = 6
      expect(features.length).toBe(6);
    });

    it('returns features of correct length for RNA chains', () => {
      const features = extractChainFeatures(rnaChain);

      // RNA features: 4 nucleotide composition + 1 GC content + 1 length = 6
      expect(features.length).toBe(6);
    });

    it('computes correct GC content for DNA', () => {
      // ATCGATCGATCG: 6 G/C out of 12 = 0.5 GC content
      const features = extractChainFeatures(dnaChain);

      // GC content is at index 4 (after 4 nucleotide fractions)
      const gcContent = features[4];
      expect(gcContent).toBeCloseTo(0.5, 5);
    });

    it('computes correct GC content for RNA', () => {
      // AUCGAUCGAUCG: 6 G/C out of 12 = 0.5 GC content
      const features = extractChainFeatures(rnaChain);

      // GC content is at index 4 (after 4 nucleotide fractions)
      const gcContent = features[4];
      expect(gcContent).toBeCloseTo(0.5, 5);
    });

    it('gives different features for different chain types', () => {
      const proteinFeatures = extractChainFeatures(proteinChain);
      const dnaFeatures = extractChainFeatures(dnaChain);
      const rnaFeatures = extractChainFeatures(rnaChain);

      // Different chain types should produce different feature vector lengths
      expect(proteinFeatures.length).not.toBe(dnaFeatures.length);
      expect(proteinFeatures.length).not.toBe(rnaFeatures.length);
      expect(dnaFeatures.length).toBe(rnaFeatures.length); // DNA and RNA same structure
    });

    it('handles empty protein chain', () => {
      const features = extractChainFeatures(emptyProteinChain);

      expect(features.length).toBe(24);
      // All composition features should be 0
      expect(features.slice(0, 20).every(f => f === 0)).toBe(true);
    });

    it('handles empty DNA chain', () => {
      const features = extractChainFeatures(emptyDnaChain);

      expect(features.length).toBe(6);
      // All composition features should be 0
      expect(features.slice(0, 4).every(f => f === 0)).toBe(true);
      // GC content should be 0
      expect(features[4]).toBe(0);
    });

    it('returns all zeros for empty sequence', () => {
      const features = extractChainFeatures(emptyProteinChain);

      // Length feature should be 0
      expect(features[features.length - 1]).toBe(0);
    });
  });

  // ── Complex Encoding ────────────────────────────────────────────────────────

  describe('encodeHeteroComplex', () => {
    it('encodes protein-protein complex', () => {
      const chains = [proteinChain, anotherProteinChain];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chains.length).toBe(2);
      expect(complex.chainPairs.length).toBe(1);
      expect(complex.chainPairs[0].pairType).toBe('protein-protein');
    });

    it('encodes protein-DNA complex', () => {
      const chains = [proteinChain, dnaChain];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chains.length).toBe(2);
      expect(complex.chainPairs.length).toBe(1);
      expect(complex.chainPairs[0].pairType).toBe('protein-dna');
    });

    it('encodes protein-RNA complex', () => {
      const chains = [proteinChain, rnaChain];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chains.length).toBe(2);
      expect(complex.chainPairs.length).toBe(1);
      expect(complex.chainPairs[0].pairType).toBe('protein-rna');
    });

    it('correctly identifies all pair types', () => {
      const chains = [proteinChain, dnaChain, rnaChain];
      const complex = encodeHeteroComplex(chains);

      // 3 chains -> 3 pairs
      expect(complex.chainPairs.length).toBe(3);

      const pairTypes = complex.chainPairs.map(p => p.pairType).sort();
      expect(pairTypes).toEqual(['protein-dna', 'protein-rna', 'dna-rna'].sort());
    });

    it('preserves chain IDs in pairs', () => {
      const chains = [proteinChain, dnaChain];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chainPairs[0].chainA).toBe('A');
      expect(complex.chainPairs[0].chainB).toBe('B');
    });

    it('generates features for each chain', () => {
      const chains = [proteinChain, dnaChain];
      const complex = encodeHeteroComplex(chains);

      complex.chains.forEach(chain => {
        expect(chain.features.length).toBeGreaterThan(0);
        expect(chain.features.every(f => typeof f === 'number')).toBe(true);
      });
    });

    it('preserves chain sequences', () => {
      const chains = [proteinChain, dnaChain];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chains[0].sequence).toBe(proteinChain.sequence);
      expect(complex.chains[1].sequence).toBe(dnaChain.sequence);
    });

    it('preserves chain types', () => {
      const chains = [proteinChain, dnaChain, rnaChain];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chains[0].type).toBe('protein');
      expect(complex.chains[1].type).toBe('dna');
      expect(complex.chains[2].type).toBe('rna');
    });

    it('handles empty chains array', () => {
      const complex = encodeHeteroComplex([]);

      expect(complex.chains).toEqual([]);
      expect(complex.chainPairs).toEqual([]);
    });

    it('handles single chain', () => {
      const complex = encodeHeteroComplex([proteinChain]);

      expect(complex.chains.length).toBe(1);
      expect(complex.chainPairs.length).toBe(0);
    });
  });

  // ── Interface Prediction ────────────────────────────────────────────────────

  describe('predictHeteroInterface', () => {
    it('predicts protein-protein interface', async () => {
      const chains = [proteinChain, anotherProteinChain];
      const complex = encodeHeteroComplex(chains);
      const prediction = predictHeteroInterface(complex);

      expect(prediction.chainPairs.length).toBe(1);
      expect(prediction.chainPairs[0].chainA).toBe('A');
      expect(prediction.chainPairs[0].chainB).toBe('D');
      expect(prediction.chainPairs[0].similarity).toBeGreaterThanOrEqual(0);
      expect(prediction.chainPairs[0].contactProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.chainPairs[0].contactProbability).toBeLessThanOrEqual(1);
    });

    it('predicts protein-DNA interface', async () => {
      const chains = [proteinChain, dnaChain];
      const complex = encodeHeteroComplex(chains);
      const prediction = predictHeteroInterface(complex);

      expect(prediction.chainPairs.length).toBe(1);
      expect(prediction.chainPairs[0].chainA).toBe('A');
      expect(prediction.chainPairs[0].chainB).toBe('B');
    });

    it('returns correct confidence scores', async () => {
      const chains = [proteinChain, dnaChain];
      const complex = encodeHeteroComplex(chains);
      const prediction = predictHeteroInterface(complex);

      expect(prediction.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(prediction.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('handles missing embeddings gracefully', () => {
      const chains = [proteinChain, dnaChain];
      const complex = encodeHeteroComplex(chains);

      // Should not throw even without embeddings
      const prediction = predictHeteroInterface(complex);

      expect(prediction.chainPairs.length).toBe(1);
      expect(prediction.overallConfidence).toBeGreaterThanOrEqual(0);
    });

    it('predicts interfaces for multi-chain complex', () => {
      const chains = [proteinChain, dnaChain, rnaChain];
      const complex = encodeHeteroComplex(chains);
      const prediction = predictHeteroInterface(complex);

      // 3 chains -> 3 pairs
      expect(prediction.chainPairs.length).toBe(3);
    });

    it('returns empty pairs for single chain', () => {
      const complex = encodeHeteroComplex([proteinChain]);
      const prediction = predictHeteroInterface(complex);

      expect(prediction.chainPairs).toEqual([]);
      expect(prediction.overallConfidence).toBe(0);
    });

    it('returns empty pairs for empty complex', () => {
      const complex = encodeHeteroComplex([]);
      const prediction = predictHeteroInterface(complex);

      expect(prediction.chainPairs).toEqual([]);
      expect(prediction.overallConfidence).toBe(0);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles complex with all same chain types', () => {
      const chains = [proteinChain, anotherProteinChain];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chains.length).toBe(2);
      expect(complex.chainPairs[0].pairType).toBe('protein-protein');
    });

    it('handles DNA-DNA pair type', () => {
      const dnaChain2: ProteinChain = {
        id: 'G',
        sequence: 'GCTAGCTAGCTA',
        type: 'dna',
      };
      const chains = [dnaChain, dnaChain2];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chainPairs[0].pairType).toBe('dna-dna');
    });

    it('handles RNA-RNA pair type', () => {
      const rnaChain2: ProteinChain = {
        id: 'H',
        sequence: 'GCUAGCUAGCUA',
        type: 'rna',
      };
      const chains = [rnaChain, rnaChain2];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chainPairs[0].pairType).toBe('rna-rna');
    });

    it('handles mixed chain types with empty sequences', () => {
      const chains = [emptyProteinChain, emptyDnaChain];
      const complex = encodeHeteroComplex(chains);

      expect(complex.chains.length).toBe(2);
      expect(complex.chainPairs.length).toBe(1);
      expect(complex.chainPairs[0].pairType).toBe('protein-dna');
    });

    it('produces deterministic results', () => {
      const chains = [proteinChain, dnaChain];
      const complex1 = encodeHeteroComplex(chains);
      const complex2 = encodeHeteroComplex(chains);

      // Same input should produce same output
      expect(complex1.chains[0].features).toEqual(complex2.chains[0].features);
      expect(complex1.chains[1].features).toEqual(complex2.chains[1].features);
    });
  });
});
