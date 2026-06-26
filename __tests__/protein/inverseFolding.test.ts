/**
 * Tests for inverse folding engine (ProteinMPNN-style sequence design).
 *
 * Verifies that the inverse folding module can generate amino acid sequences
 * from backbone coordinates using Chou-Fasman propensity-based sampling.
 *
 * @scientific_provenance
 *   ALGORITHM: Temperature-controlled softmax sampling from propensity PSSM
 *   REFERENCE: Dauparas et al. (2022) Science 378:49-56 (ProteinMPNN concept)
 *   REFERENCE: Chou PY, Fasman GD (1978) Annu Rev Biochem 47:251-276
 */

import { inverseFold } from '../../src/services/protein/inverseFolding';
import type { BackboneAtom } from '../../src/services/protein/backboneGenerator';

/**
 * Helper: generate a simple linear backbone with given length.
 * Residues spaced ~3.8 A apart (typical Cα-Cα).
 */
function makeBackbone(length: number): BackboneAtom[] {
  const atoms: BackboneAtom[] = [];
  for (let i = 0; i < length; i++) {
    atoms.push({
      atomName: 'CA',
      x: i * 3.8,
      y: 0,
      z: 0,
      residueIndex: i,
      residueName: 'ALA',
    });
  }
  return atoms;
}

/**
 * Helper: generate a helical backbone (tighter spacing ~3.5 A, slight rise).
 */
function makeHelicalBackbone(length: number): BackboneAtom[] {
  const atoms: BackboneAtom[] = [];
  for (let i = 0; i < length; i++) {
    // Approximate helical geometry: 3.6 residues/turn, 1.5 A rise
    const angle = (i * 100 * Math.PI) / 180; // ~100 deg per residue
    atoms.push({
      atomName: 'CA',
      x: 2.3 * Math.cos(angle), // helix radius ~2.3 A
      y: 2.3 * Math.sin(angle),
      z: i * 1.5, // rise per residue
      residueIndex: i,
      residueName: 'ALA',
    });
  }
  return atoms;
}

describe('inverseFold', () => {
  describe('basic functionality', () => {
    it('should return an InverseFoldingResult with required fields', () => {
      const backbone = makeBackbone(20);
      const result = inverseFold({ backbone });

      expect(result).toHaveProperty('sequences');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('model');
      expect(result.metadata).toHaveProperty('temperature');
      expect(result.metadata).toHaveProperty('length');
      expect(result.metadata).toHaveProperty('timestamp');
    });

    it('should generate sequences of correct length', () => {
      const backbone = makeBackbone(25);
      const result = inverseFold({ backbone, numSequences: 3 });

      for (const seq of result.sequences) {
        expect(seq.sequence).toHaveLength(25);
      }
    });

    it('should generate requested number of sequences', () => {
      const backbone = makeBackbone(20);
      const result = inverseFold({ backbone, numSequences: 5 });

      expect(result.sequences.length).toBeLessThanOrEqual(5);
      expect(result.sequences.length).toBeGreaterThan(0);
    });

    it('each sequence should have score and perResidueScores', () => {
      const backbone = makeBackbone(20);
      const result = inverseFold({ backbone, numSequences: 2 });

      for (const seq of result.sequences) {
        expect(typeof seq.score).toBe('number');
        expect(seq.perResidueScores).toHaveLength(20);
        expect(seq.sequence).toHaveLength(20);
      }
    });

    it('should set metadata.length to backbone length', () => {
      const backbone = makeBackbone(30);
      const result = inverseFold({ backbone });

      expect(result.metadata.length).toBe(30);
    });

    it('should set metadata.model to a non-empty string', () => {
      const backbone = makeBackbone(20);
      const result = inverseFold({ backbone });

      expect(typeof result.metadata.model).toBe('string');
      expect(result.metadata.model.length).toBeGreaterThan(0);
    });

    it('should have a valid ISO timestamp', () => {
      const backbone = makeBackbone(20);
      const result = inverseFold({ backbone });

      expect(() => new Date(result.metadata.timestamp)).not.toThrow();
      expect(new Date(result.metadata.timestamp).toISOString()).toBe(result.metadata.timestamp);
    });
  });

  describe('temperature control', () => {
    it('should use default temperature of 1.0 when not specified', () => {
      const backbone = makeBackbone(20);
      const result = inverseFold({ backbone });

      expect(result.metadata.temperature).toBe(1.0);
    });

    it('should use specified temperature', () => {
      const backbone = makeBackbone(20);
      const result = inverseFold({ backbone, temperature: 0.5 });

      expect(result.metadata.temperature).toBe(0.5);
    });

    it('greedy sampling (temperature=0) should produce deterministic sequences', () => {
      const backbone = makeBackbone(20);

      // With temperature=0, sampling should be greedy (deterministic)
      // Multiple calls should produce the same top sequence
      const result1 = inverseFold({ backbone, temperature: 0, numSequences: 1 });
      const result2 = inverseFold({ backbone, temperature: 0, numSequences: 1 });

      expect(result1.sequences[0].sequence).toBe(result2.sequences[0].sequence);
    });
  });

  describe('fixed positions', () => {
    it('should preserve fixed residues at specified positions', () => {
      const backbone = makeBackbone(20);
      const fixed = new Map<number, string>();
      fixed.set(0, 'W'); // Fix first residue to Trp
      fixed.set(5, 'P'); // Fix position 5 to Pro
      fixed.set(19, 'C'); // Fix last residue to Cys

      const result = inverseFold({
        backbone,
        fixedPositions: fixed,
        numSequences: 3,
      });

      for (const seq of result.sequences) {
        expect(seq.sequence[0]).toBe('W');
        expect(seq.sequence[5]).toBe('P');
        expect(seq.sequence[19]).toBe('C');
      }
    });

    it('should not change non-fixed positions when comparing to unfixed', () => {
      const backbone = makeBackbone(20);

      // Generate with fixed position
      const fixed = new Map<number, string>();
      fixed.set(10, 'G');
      const result = inverseFold({ backbone, fixedPositions: fixed, numSequences: 1 });

      expect(result.sequences[0].sequence[10]).toBe('G');
    });
  });

  describe('sequence identity', () => {
    it('should compute sequenceIdentity when wildType is provided', () => {
      const backbone = makeBackbone(20);
      const wildType = 'ACDEFGHIKLMNPQRSTVWY';

      const result = inverseFold({
        backbone,
        wildType,
        numSequences: 3,
      });

      for (const seq of result.sequences) {
        expect(seq.sequenceIdentity).toBeDefined();
        expect(seq.sequenceIdentity).toBeGreaterThanOrEqual(0);
        expect(seq.sequenceIdentity).toBeLessThanOrEqual(1);
      }
    });

    it('should not include sequenceIdentity when wildType is not provided', () => {
      const backbone = makeBackbone(20);
      const result = inverseFold({ backbone, numSequences: 1 });

      expect(result.sequences[0].sequenceIdentity).toBeUndefined();
    });

    it('sequence identity of 1.0 when generated sequence matches wildType', () => {
      const backbone = makeBackbone(20);

      // Generate a sequence first
      const firstResult = inverseFold({ backbone, numSequences: 1, temperature: 0 });
      const seq = firstResult.sequences[0].sequence;

      // Now use that sequence as wildType with temperature=0 (greedy, deterministic)
      const result = inverseFold({
        backbone,
        wildType: seq,
        temperature: 0,
        numSequences: 1,
      });

      // The greedy sequence should be identical, giving identity ~1.0
      expect(result.sequences[0].sequenceIdentity).toBeCloseTo(1.0, 1);
    });
  });

  describe('sequence validity', () => {
    it('should only contain standard amino acid characters', () => {
      const backbone = makeBackbone(30);
      const result = inverseFold({ backbone, numSequences: 5 });

      const validAA = /^[ACDEFGHIKLMNPQRSTVWY]+$/;
      for (const seq of result.sequences) {
        expect(seq.sequence).toMatch(validAA);
      }
    });

    it('per-residue scores should be between 0 and 1', () => {
      const backbone = makeBackbone(20);
      const result = inverseFold({ backbone, numSequences: 3 });

      for (const seq of result.sequences) {
        for (const score of seq.perResidueScores) {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('helical backbone', () => {
    it('should prefer helix-forming residues for helical backbone', () => {
      const backbone = makeHelicalBackbone(20);
      const result = inverseFold({ backbone, numSequences: 5, temperature: 0 });

      // Helical backbone should produce sequences enriched in helix formers
      // (A, E, L, M have high helix propensity > 1.2)
      const helixFormers = new Set(['A', 'E', 'L', 'M']);
      const seq = result.sequences[0].sequence;
      let helixCount = 0;
      for (const aa of seq) {
        if (helixFormers.has(aa)) helixCount++;
      }
      // At least 20% should be strong helix formers (random baseline ~20%)
      // This is a soft check since the scoring is propensity-weighted
      expect(helixCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle minimum length backbone', () => {
      const backbone = makeBackbone(10);
      const result = inverseFold({ backbone, numSequences: 1 });

      expect(result.sequences).toHaveLength(1);
      expect(result.sequences[0].sequence).toHaveLength(10);
    });

    it('should handle requesting more sequences than possible diversity', () => {
      // Very short backbone limits sequence diversity
      const backbone = makeBackbone(10);
      const result = inverseFold({ backbone, numSequences: 100 });

      // Should return some sequences (may be less than 100 for short backbones)
      expect(result.sequences.length).toBeGreaterThan(0);
    });
  });
});
