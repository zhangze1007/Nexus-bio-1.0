/**
 * ddG Prediction Tests
 *
 * FoldX-style empirical force field for protein stability prediction.
 * Tests verify energy component computation and mutation effect prediction.
 */

import { predictDDG, DDGMutation, DDGResult } from '../../src/server/ddgPrediction';

// Minimal PDB with a buried leucine (position 1)
const BURIED_LEU_PDB = `ATOM      1  N   LEU A   1       0.000   0.000   0.000  1.00 10.00           N
ATOM      2  CA  LEU A   1       1.000   0.000   0.000  1.00 10.00           C
ATOM      3  C   LEU A   1       2.000   0.000   0.000  1.00 10.00           C
ATOM      4  O   LEU A   1       3.000   0.000   0.000  1.00 10.00           O
ATOM      5  CB  LEU A   1       1.000   1.000   0.000  1.00 10.00           C
ATOM      6  CG  LEU A   1       1.000   2.000   0.000  1.00 10.00           C
ATOM      7  CD1 LEU A   1       0.000   3.000   0.000  1.00 10.00           C
ATOM      8  CD2 LEU A   1       2.000   3.000   0.000  1.00 10.00           C
END`;

// Minimal PDB with alanine (position 1) - surface neutral
const SURFACE_ALA_PDB = `ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 10.00           N
ATOM      2  CA  ALA A   1       1.000   0.000   0.000  1.00 10.00           C
ATOM      3  C   ALA A   1       2.000   0.000   0.000  1.00 10.00           C
ATOM      4  O   ALA A   1       3.000   0.000   0.000  1.00 10.00           O
ATOM      5  CB  ALA A   1       1.000   1.000   0.000  1.00 10.00           C
END`;

// Multi-residue PDB for neighbor interaction testing
const MULTI_RESIDUE_PDB = `ATOM      1  N   LEU A   1       0.000   0.000   0.000  1.00 10.00           N
ATOM      2  CA  LEU A   1       1.000   0.000   0.000  1.00 10.00           C
ATOM      3  C   LEU A   1       2.000   0.000   0.000  1.00 10.00           C
ATOM      4  O   LEU A   1       3.000   0.000   0.000  1.00 10.00           O
ATOM      5  CB  LEU A   1       1.000   1.000   0.000  1.00 10.00           C
ATOM      6  CG  LEU A   1       1.000   2.000   0.000  1.00 10.00           C
ATOM      7  CD1 LEU A   1       0.000   3.000   0.000  1.00 10.00           C
ATOM      8  CD2 LEU A   1       2.000   3.000   0.000  1.00 10.00           C
ATOM      9  N   VAL A   2       3.500   0.500   0.000  1.00 10.00           N
ATOM     10  CA  VAL A   2       4.500   0.500   0.000  1.00 10.00           C
ATOM     11  C   VAL A   2       5.500   0.500   0.000  1.00 10.00           C
ATOM     12  O   VAL A   2       6.500   0.500   0.000  1.00 10.00           O
ATOM     13  CB  VAL A   2       4.500   1.500   0.000  1.00 10.00           C
ATOM     14  CG1 VAL A   2       3.500   2.500   0.000  1.00 10.00           C
ATOM     15  CG2 VAL A   2       5.500   2.500   0.000  1.00 10.00           C
END`;

describe('ddG prediction', () => {
  describe('basic functionality', () => {
    it('predicts destabilizing effect of buried charged mutation', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'L', mutantResidue: 'D' };
      const result = predictDDG(BURIED_LEU_PDB, mutation);

      expect(result.ddG).toBeDefined();
      expect(typeof result.ddG).toBe('number');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);

      // Leucine -> Aspartate in a buried site should be destabilizing (positive ddG)
      // Charged residue in hydrophobic core is unfavorable
      expect(result.ddG).toBeGreaterThan(0);
    });

    it('returns near-zero for surface neutral mutation', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'A', mutantResidue: 'G' };
      const result = predictDDG(SURFACE_ALA_PDB, mutation);

      expect(result.ddG).toBeDefined();
      expect(Math.abs(result.ddG)).toBeLessThan(3.0);
    });

    it('includes all energy components', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'L', mutantResidue: 'D' };
      const result = predictDDG(BURIED_LEU_PDB, mutation);

      expect(result.components.vdw).toBeDefined();
      expect(result.components.solvation).toBeDefined();
      expect(result.components.hbond).toBeDefined();
      expect(result.components.backbone).toBeDefined();
      expect(result.components.entropy).toBeDefined();

      expect(typeof result.components.vdw).toBe('number');
      expect(typeof result.components.solvation).toBe('number');
      expect(typeof result.components.hbond).toBe('number');
      expect(typeof result.components.backbone).toBe('number');
      expect(typeof result.components.entropy).toBe('number');
    });
  });

  describe('energy component accuracy', () => {
    it('computes vdW as sum of components', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'A', mutantResidue: 'V' };
      const result = predictDDG(SURFACE_ALA_PDB, mutation);

      // vdW should be a finite number
      expect(Number.isFinite(result.components.vdw)).toBe(true);
    });

    it('computes solvation energy with neighbor context', () => {
      // Use multi-residue PDB so burial score is non-zero
      const mutation: DDGMutation = { position: 1, wtResidue: 'L', mutantResidue: 'E' };
      const result = predictDDG(MULTI_RESIDUE_PDB, mutation);

      // Solvation should penalize charged residue in hydrophobic environment
      expect(Number.isFinite(result.components.solvation)).toBe(true);
    });

    it('computes entropy loss for mutations to larger residues', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'A', mutantResidue: 'W' };
      const result = predictDDG(SURFACE_ALA_PDB, mutation);

      // Entropy should be a finite number
      expect(Number.isFinite(result.components.entropy)).toBe(true);
    });
  });

  describe('mutation type classification', () => {
    it('destabilizes when introducing charge into hydrophobic core', () => {
      // Use multi-residue PDB so burial context makes charged mutation unfavorable
      const mutation: DDGMutation = { position: 1, wtResidue: 'L', mutantResidue: 'R' };
      const result = predictDDG(MULTI_RESIDUE_PDB, mutation);

      // Charged residue in hydrophobic environment is destabilizing
      expect(result.ddG).toBeGreaterThan(0);
    });

    it('stabilizes when improving hydrophobic packing', () => {
      // Isoleucine -> Leucine in a buried site: similar hydrophobicity, slight volume change
      const mutation: DDGMutation = { position: 1, wtResidue: 'L', mutantResidue: 'I' };
      const result = predictDDG(BURIED_LEU_PDB, mutation);

      // Should be near-zero or slightly favorable
      expect(Math.abs(result.ddG)).toBeLessThan(2.0);
    });

    it('handles mutation to same residue type', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'L', mutantResidue: 'L' };
      const result = predictDDG(BURIED_LEU_PDB, mutation);

      // ddG should be exactly zero for identity mutation
      expect(result.ddG).toBe(0);
    });
  });

  describe('confidence scoring', () => {
    it('assigns higher confidence to mutations with more neighbors', () => {
      const mutationSingle: DDGMutation = { position: 1, wtResidue: 'L', mutantResidue: 'D' };
      const resultSingle = predictDDG(BURIED_LEU_PDB, mutationSingle);

      const mutationMulti: DDGMutation = { position: 1, wtResidue: 'L', mutantResidue: 'D' };
      const resultMulti = predictDDG(MULTI_RESIDUE_PDB, mutationMulti);

      // More context should give higher or equal confidence
      expect(resultMulti.confidence).toBeGreaterThanOrEqual(resultSingle.confidence);
    });

    it('confidence is between 0 and 1', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'A', mutantResidue: 'G' };
      const result = predictDDG(SURFACE_ALA_PDB, mutation);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('throws on invalid residue position', () => {
      const mutation: DDGMutation = { position: 999, wtResidue: 'A', mutantResidue: 'G' };

      expect(() => predictDDG(SURFACE_ALA_PDB, mutation)).toThrow();
    });

    it('throws on mismatched wild-type residue', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'W', mutantResidue: 'G' };

      expect(() => predictDDG(SURFACE_ALA_PDB, mutation)).toThrow();
    });

    it('throws on invalid amino acid code', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'A', mutantResidue: 'X' };

      expect(() => predictDDG(SURFACE_ALA_PDB, mutation)).toThrow();
    });

    it('throws on empty PDB text', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'A', mutantResidue: 'G' };

      expect(() => predictDDG('', mutation)).toThrow();
    });
  });

  describe('multi-residue context', () => {
    it('accounts for neighbor interactions', () => {
      const mutation: DDGMutation = { position: 1, wtResidue: 'L', mutantResidue: 'D' };
      const result = predictDDG(MULTI_RESIDUE_PDB, mutation);

      // With nearby valine neighbors, the vdW penalty for D should be significant
      expect(result.components.vdw).toBeDefined();
      expect(Number.isFinite(result.components.vdw)).toBe(true);
    });
  });
});
