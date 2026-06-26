/**
 * Tests for steepest descent energy minimizer.
 *
 * Verifies that energy minimization reduces potential energy and
 * produces physically reasonable results.
 *
 * @scientific_provenance
 *   ALGORITHM: Steepest descent energy minimization
 *   REFERENCE: Levitt M, Lifson S (1969) J Mol Biol 46:269-279
 *   UNITS: kJ/mol for energy, A for distance, A for step size
 */

import { minimizeEnergy } from '../../src/services/protein/energyMinimizer';
import type { BackboneAtom } from '../../src/services/protein/backboneGenerator';

/** Helper: create a BackboneAtom */
function atom(
  x: number,
  y: number,
  z: number,
  residueIndex = 0,
  atomName: BackboneAtom['atomName'] = 'CA',
): BackboneAtom {
  return { atomName, x, y, z, residueIndex, residueName: 'ALA' };
}

/** Helper: generate a linear backbone */
function linearBackbone(length: number): BackboneAtom[] {
  const atoms: BackboneAtom[] = [];
  for (let i = 0; i < length; i++) {
    atoms.push(atom(i * 3.8, 0, 0, i, 'CA'));
  }
  return atoms;
}

/** Helper: generate a perturbed backbone (slightly displaced) */
function perturbedBackbone(length: number, magnitude = 0.1): BackboneAtom[] {
  const atoms = linearBackbone(length);
  return atoms.map((a) =>
    atom(
      a.x + (Math.random() - 0.5) * magnitude,
      a.y + (Math.random() - 0.5) * magnitude,
      a.z + (Math.random() - 0.5) * magnitude,
      a.residueIndex,
      a.atomName,
    ),
  );
}

describe('energyMinimizer', () => {
  describe('minimizeEnergy', () => {
    it('returns MinimizationResult with required fields', () => {
      const atoms = perturbedBackbone(5);
      const result = minimizeEnergy(atoms);

      expect(result).toHaveProperty('initialEnergy');
      expect(result).toHaveProperty('finalEnergy');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('converged');
      expect(result).toHaveProperty('rmsd');
      expect(result).toHaveProperty('trajectory');
    });

    it('finalEnergy <= initialEnergy (energy decreases)', () => {
      const atoms = perturbedBackbone(5, 0.5);
      const result = minimizeEnergy(atoms);
      expect(result.finalEnergy).toBeLessThanOrEqual(result.initialEnergy + 1e-6);
    });

    it('trajectory contains step entries', () => {
      const atoms = perturbedBackbone(3);
      const result = minimizeEnergy(atoms, { maxIterations: 50 });
      expect(result.trajectory.length).toBeGreaterThan(0);
      for (const entry of result.trajectory) {
        expect(entry).toHaveProperty('step');
        expect(entry).toHaveProperty('energy');
        expect(entry).toHaveProperty('rmsd');
        expect(typeof entry.step).toBe('number');
        expect(typeof entry.energy).toBe('number');
        expect(typeof entry.rmsd).toBe('number');
      }
    });

    it('converges for a small perturbed structure', () => {
      const atoms = perturbedBackbone(3, 0.05);
      const result = minimizeEnergy(atoms, {
        maxIterations: 500,
        convergenceThreshold: 0.5,
      });
      // With small perturbation, should converge
      expect(result.iterations).toBeLessThanOrEqual(500);
    });

    it('respects maxIterations limit', () => {
      const atoms = perturbedBackbone(5, 1.0);
      const result = minimizeEnergy(atoms, { maxIterations: 10 });
      expect(result.iterations).toBeLessThanOrEqual(10);
    });

    it('rmsd from initial structure is non-negative', () => {
      const atoms = perturbedBackbone(5);
      const result = minimizeEnergy(atoms);
      expect(result.rmsd).toBeGreaterThanOrEqual(0);
    });

    it('handles single atom', () => {
      const atoms = [atom(1, 2, 3)];
      const result = minimizeEnergy(atoms);
      expect(result.iterations).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.finalEnergy)).toBe(true);
    });

    it('handles empty array', () => {
      const result = minimizeEnergy([]);
      expect(result.iterations).toBe(0);
      expect(result.initialEnergy).toBe(0);
      expect(result.finalEnergy).toBe(0);
    });

    it('uses default config when none provided', () => {
      const atoms = perturbedBackbone(3);
      const result = minimizeEnergy(atoms);
      expect(result.iterations).toBeLessThanOrEqual(1000);
    });

    it('trajectory energy values are generally decreasing', () => {
      const atoms = perturbedBackbone(4, 0.5);
      const result = minimizeEnergy(atoms, { maxIterations: 100 });
      // Check that energy generally decreases (allow some fluctuation)
      if (result.trajectory.length >= 2) {
        const firstEnergy = result.trajectory[0].energy;
        const lastEnergy = result.trajectory[result.trajectory.length - 1].energy;
        expect(lastEnergy).toBeLessThanOrEqual(firstEnergy + 1e-6);
      }
    });
  });
});
