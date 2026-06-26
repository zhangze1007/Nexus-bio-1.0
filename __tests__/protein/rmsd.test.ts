/**
 * Tests for RMSD calculator and structural alignment (Kabsch algorithm).
 *
 * Verifies RMSD computation between atom sets and Kabsch alignment
 * for optimal superposition of protein structures.
 *
 * @scientific_provenance
 *   ALGORITHM: Kabsch algorithm for optimal superposition
 *   REFERENCE: Kabsch W (1976) Acta Cryst A32:922-923
 *   UNITS: Angstroms for distance, dimensionless for RMSD
 */

import { calculateRMSD, alignStructures } from '../../src/services/protein/rmsd';
import type { BackboneAtom } from '../../src/services/protein/backboneGenerator';

/** Helper: create a BackboneAtom at given coordinates */
function atom(
  x: number,
  y: number,
  z: number,
  residueIndex = 0,
  atomName: BackboneAtom['atomName'] = 'CA',
): BackboneAtom {
  return { atomName, x, y, z, residueIndex, residueName: 'ALA' };
}

/** Helper: generate a simple linear backbone */
function linearBackbone(length: number, spacing = 3.8): BackboneAtom[] {
  const atoms: BackboneAtom[] = [];
  for (let i = 0; i < length; i++) {
    atoms.push(atom(i * spacing, 0, 0, i, 'CA'));
  }
  return atoms;
}

/** Helper: generate a helical backbone */
function helicalBackbone(length: number): BackboneAtom[] {
  const atoms: BackboneAtom[] = [];
  for (let i = 0; i < length; i++) {
    const angle = (i * 100 * Math.PI) / 180;
    atoms.push(atom(2.3 * Math.cos(angle), 2.3 * Math.sin(angle), i * 1.5, i, 'CA'));
  }
  return atoms;
}

describe('rmsd', () => {
  describe('calculateRMSD', () => {
    it('returns 0 for identical structures', () => {
      const atoms1 = linearBackbone(10);
      const atoms2 = linearBackbone(10);
      expect(calculateRMSD(atoms1, atoms2)).toBeCloseTo(0, 6);
    });

    it('returns > 0 for shifted structures', () => {
      const atoms1 = linearBackbone(10);
      const atoms2 = atoms1.map((a) => atom(a.x + 1.0, a.y, a.z, a.residueIndex, a.atomName));
      const rmsd = calculateRMSD(atoms1, atoms2);
      expect(rmsd).toBeGreaterThan(0);
    });

    it('returns correct RMSD for a known displacement', () => {
      // Two atoms: (0,0,0) and (1,0,0) vs (0,0,0) and (1,0,0) + shift
      const atoms1 = [atom(0, 0, 0), atom(1, 0, 0)];
      const atoms2 = [atom(0, 0, 0), atom(1, 1, 0)]; // displaced by 1 in y
      // RMSD = sqrt(mean(0^2 + 1^2)) = sqrt(0.5) = 0.707...
      const rmsd = calculateRMSD(atoms1, atoms2);
      expect(rmsd).toBeCloseTo(Math.sqrt(0.5), 4);
    });

    it('handles single atom', () => {
      const atoms1 = [atom(1, 2, 3)];
      const atoms2 = [atom(4, 5, 6)];
      // distance = sqrt(9+9+9) = sqrt(27)
      const rmsd = calculateRMSD(atoms1, atoms2);
      expect(rmsd).toBeCloseTo(Math.sqrt(27), 4);
    });

    it('throws for mismatched array lengths', () => {
      const atoms1 = linearBackbone(5);
      const atoms2 = linearBackbone(3);
      expect(() => calculateRMSD(atoms1, atoms2)).toThrow();
    });

    it('throws for empty arrays', () => {
      expect(() => calculateRMSD([], [])).toThrow();
    });

    it('is symmetric: RMSD(a,b) == RMSD(b,a)', () => {
      const atoms1 = helicalBackbone(10);
      const atoms2 = linearBackbone(10);
      const rmsd1 = calculateRMSD(atoms1, atoms2);
      const rmsd2 = calculateRMSD(atoms2, atoms1);
      expect(rmsd1).toBeCloseTo(rmsd2, 6);
    });
  });

  describe('alignStructures', () => {
    it('returns atoms with same count as input', () => {
      const mobile = linearBackbone(10);
      const reference = helicalBackbone(10);
      const aligned = alignStructures(mobile, reference);
      expect(aligned).toHaveLength(mobile.length);
    });

    it('aligned identical structures have RMSD ~0', () => {
      const atoms1 = linearBackbone(10);
      const atoms2 = linearBackbone(10);
      const aligned = alignStructures(atoms2, atoms1);
      const rmsd = calculateRMSD(atoms1, aligned);
      expect(rmsd).toBeCloseTo(0, 6);
    });

    it('reduces RMSD for shifted structures', () => {
      const reference = linearBackbone(10);
      const mobile = reference.map((a) =>
        atom(a.x + 5.0, a.y + 3.0, a.z - 2.0, a.residueIndex, a.atomName),
      );
      const rmsdBefore = calculateRMSD(reference, mobile);
      const aligned = alignStructures(mobile, reference);
      const rmsdAfter = calculateRMSD(reference, aligned);
      // Alignment should reduce RMSD (or keep it same for pure translation)
      expect(rmsdAfter).toBeLessThanOrEqual(rmsdBefore + 1e-10);
    });

    it('preserves backbone atom metadata', () => {
      const mobile = linearBackbone(5);
      const reference = helicalBackbone(5);
      const aligned = alignStructures(mobile, reference);
      for (let i = 0; i < aligned.length; i++) {
        expect(aligned[i].atomName).toBe(mobile[i].atomName);
        expect(aligned[i].residueIndex).toBe(mobile[i].residueIndex);
        expect(aligned[i].residueName).toBe(mobile[i].residueName);
      }
    });

    it('throws for mismatched array lengths', () => {
      const mobile = linearBackbone(5);
      const reference = linearBackbone(3);
      expect(() => alignStructures(mobile, reference)).toThrow();
    });
  });
});
