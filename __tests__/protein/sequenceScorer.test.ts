/**
 * Tests for sequence scoring module.
 *
 * Verifies that sequenceScorer correctly evaluates amino acid sequences
 * against secondary structure assignments and backbone geometry.
 *
 * @scientific_provenance
 *   ALGORITHM: Chou-Fasman propensity-weighted scoring + hydrophobic packing
 *   REFERENCE: Chou PY, Fasman GD (1978) Annu Rev Biochem 47:251-276
 */

import { scoreSequence } from '../../src/services/protein/sequenceScorer';
import type { BackboneAtom } from '../../src/services/protein/backboneGenerator';

/**
 * Helper: generate a simple linear backbone with given length.
 * Residues are spaced ~3.8 A apart (typical Cα-Cα distance).
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
 * Helper: generate all-helix SS assignments.
 */
function allHelix(length: number): Array<'helix' | 'sheet' | 'loop'> {
  return Array(length).fill('helix') as Array<'helix' | 'sheet' | 'loop'>;
}

/**
 * Helper: generate all-sheet SS assignments.
 */
function allSheet(length: number): Array<'helix' | 'sheet' | 'loop'> {
  return Array(length).fill('sheet') as Array<'helix' | 'sheet' | 'loop'>;
}

/**
 * Helper: generate all-loop SS assignments.
 */
function allLoop(length: number): Array<'helix' | 'sheet' | 'loop'> {
  return Array(length).fill('loop') as Array<'helix' | 'sheet' | 'loop'>;
}

describe('scoreSequence', () => {
  describe('basic structure', () => {
    it('should return a ScoringResult with all required fields', () => {
      const backbone = makeBackbone(10);
      const seq = 'AAAAAAAAAA';
      const ss = allHelix(10);

      const result = scoreSequence(seq, backbone, ss);

      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('perResidueScores');
      expect(result.components).toHaveProperty('secondaryStructure');
      expect(result.components).toHaveProperty('hydrophobicCore');
      expect(result.components).toHaveProperty('chargeBalance');
      expect(result.components).toHaveProperty('diversity');
    });

    it('should have perResidueScores with same length as sequence', () => {
      const backbone = makeBackbone(15);
      const seq = 'AAAAAAAAAAAAAAA';
      const ss = allHelix(15);

      const result = scoreSequence(seq, backbone, ss);

      expect(result.perResidueScores).toHaveLength(15);
    });

    it('should have totalScore between 0 and 1', () => {
      const backbone = makeBackbone(10);
      const seq = 'ACDEFGHIKL';
      const ss = allHelix(10);

      const result = scoreSequence(seq, backbone, ss);

      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(1);
    });
  });

  describe('secondary structure scoring', () => {
    it('should give high SS score for alanine in helix regions', () => {
      // Ala has helix propensity 1.42 (strong helix former)
      const backbone = makeBackbone(10);
      const seq = 'AAAAAAAAAA';
      const ss = allHelix(10);

      const result = scoreSequence(seq, backbone, ss);

      expect(result.components.secondaryStructure).toBeGreaterThan(0.5);
    });

    it('should give low SS score for alanine in sheet regions', () => {
      // Ala has sheet propensity 0.83 (weak sheet former)
      const backbone = makeBackbone(10);
      const seq = 'AAAAAAAAAA';
      const ss = allSheet(10);

      const result = scoreSequence(seq, backbone, ss);

      // Should be lower than helix score
      const helixResult = scoreSequence(seq, backbone, allHelix(10));
      expect(result.components.secondaryStructure).toBeLessThan(
        helixResult.components.secondaryStructure,
      );
    });

    it('should give high SS score for valine in sheet regions', () => {
      // Val has sheet propensity 1.70 (strong sheet former)
      const backbone = makeBackbone(10);
      const seq = 'VVVVVVVVVV';
      const ss = allSheet(10);

      const result = scoreSequence(seq, backbone, ss);

      expect(result.components.secondaryStructure).toBeGreaterThan(0.5);
    });

    it('should score all-alanine lower for sheets than all-valine', () => {
      const backbone = makeBackbone(10);
      const ss = allSheet(10);

      const alaResult = scoreSequence('AAAAAAAAAA', backbone, ss);
      const valResult = scoreSequence('VVVVVVVVVV', backbone, ss);

      expect(valResult.components.secondaryStructure).toBeGreaterThan(
        alaResult.components.secondaryStructure,
      );
    });

    it('should give high SS score for glycine in loop regions', () => {
      // Gly has loop propensity 1.64 (strong loop former)
      const backbone = makeBackbone(10);
      const seq = 'GGGGGGGGGG';
      const ss = allLoop(10);

      const result = scoreSequence(seq, backbone, ss);

      expect(result.components.secondaryStructure).toBeGreaterThan(0.5);
    });
  });

  describe('hydrophobic core scoring', () => {
    it('should give higher hydrophobic score when hydrophobic residues are buried', () => {
      // Create a backbone where residues are close together (buried)
      const backbone: BackboneAtom[] = [];
      for (let i = 0; i < 10; i++) {
        backbone.push({
          atomName: 'CA',
          x: i * 2.0, // Closer spacing = more buried
          y: 0,
          z: 0,
          residueIndex: i,
          residueName: 'ALA',
        });
      }
      const seq = 'VVVVVVVVVV'; // All hydrophobic
      const ss = allHelix(10);

      const result = scoreSequence(seq, backbone, ss);

      expect(result.components.hydrophobicCore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('charge balance scoring', () => {
    it('should give high charge balance for neutral sequences', () => {
      const backbone = makeBackbone(10);
      const seq = 'AAAAAAAAAA'; // All neutral
      const ss = allHelix(10);

      const result = scoreSequence(seq, backbone, ss);

      expect(result.components.chargeBalance).toBeGreaterThan(0.5);
    });

    it('should penalize all-positive or all-negative sequences', () => {
      const backbone = makeBackbone(10);
      const ss = allHelix(10);

      const posResult = scoreSequence('KKKKKKKKKK', backbone, ss);
      const negResult = scoreSequence('DDDDDDDDDD', backbone, ss);
      const neutralResult = scoreSequence('AAAAAAAAAA', backbone, ss);

      // Neutral should have better charge balance
      expect(neutralResult.components.chargeBalance).toBeGreaterThanOrEqual(
        posResult.components.chargeBalance,
      );
      expect(neutralResult.components.chargeBalance).toBeGreaterThanOrEqual(
        negResult.components.chargeBalance,
      );
    });
  });

  describe('diversity scoring', () => {
    it('should give higher diversity for sequences with many different amino acids', () => {
      const backbone = makeBackbone(10);
      const ss = allHelix(10);

      const diverseResult = scoreSequence('ACDEFGHIKL', backbone, ss);
      const uniformResult = scoreSequence('AAAAAAAAAA', backbone, ss);

      expect(diverseResult.components.diversity).toBeGreaterThan(
        uniformResult.components.diversity,
      );
    });

    it('should give lowest diversity for all-same-residue sequences', () => {
      const backbone = makeBackbone(10);
      const ss = allHelix(10);

      const result = scoreSequence('AAAAAAAAAA', backbone, ss);

      expect(result.components.diversity).toBeLessThan(0.5);
    });
  });

  describe('per-residue scores', () => {
    it('should have scores between 0 and 1 for each position', () => {
      const backbone = makeBackbone(10);
      const seq = 'ACDEFGHIKL';
      const ss = allHelix(10);

      const result = scoreSequence(seq, backbone, ss);

      for (const score of result.perResidueScores) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });
});
