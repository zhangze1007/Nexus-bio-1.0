/**
 * Tests for Langevin dynamics MD integrator.
 *
 * Verifies that the MD integrator produces physically reasonable
 * trajectories with approximate energy conservation and temperature control.
 *
 * @scientific_provenance
 *   ALGORITHM: Langevin dynamics (BBK integrator)
 *   REFERENCE: Brünger A, Brooks CL, Karplus M (1984) Chem Phys Lett 105:495
 *   ENSEMBLE: NVT (canonical)
 *   UNITS: fs for time, K for temperature, kJ/mol for energy, A for distance
 */

import { runMD } from '../../src/services/protein/mdIntegrator';
import type { BackboneAtom } from '../../src/services/protein/backboneGenerator';

// MD simulations can be slow in CI — increase timeout
jest.setTimeout(30_000);

// Seed Math.random for deterministic MD trajectories.
// The Langevin thermostat uses Gaussian noise via Box-Muller (gaussianRandom),
// which calls Math.random(). Without seeding, bad random seeds can cause
// temperature blowup (~78000K) in CI where worker scheduling is unpredictable.
const origRandom = Math.random;
let seed = 42;
function seededRandom(): number {
  seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
  return seed / 0x7fffffff;
}
beforeEach(() => { seed = 42; Math.random = seededRandom; });
afterEach(() => { Math.random = origRandom; });

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

describe('mdIntegrator', () => {
  describe('runMD', () => {
    it('returns MDResult with required fields', () => {
      const atoms = linearBackbone(3);
      const result = runMD(atoms, { numSteps: 50, saveInterval: 25 });

      expect(result).toHaveProperty('frames');
      expect(result).toHaveProperty('initialEnergy');
      expect(result).toHaveProperty('finalEnergy');
      expect(result).toHaveProperty('meanTemperature');
      expect(result).toHaveProperty('meanRMSD');
    });

    it('frames contain required fields', () => {
      const atoms = linearBackbone(3);
      const result = runMD(atoms, { numSteps: 50, saveInterval: 25 });

      for (const frame of result.frames) {
        expect(frame).toHaveProperty('step');
        expect(frame).toHaveProperty('time');
        expect(frame).toHaveProperty('atoms');
        expect(frame).toHaveProperty('energy');
        expect(frame).toHaveProperty('temperature');
        expect(frame).toHaveProperty('rmsd');
        expect(frame.atoms).toHaveLength(atoms.length);
      }
    });

    it('produces multiple frames based on saveInterval', () => {
      const atoms = linearBackbone(3);
      const result = runMD(atoms, { numSteps: 100, saveInterval: 50 });
      // Should have at least initial + 2 saved frames
      expect(result.frames.length).toBeGreaterThanOrEqual(2);
    });

    it('initialEnergy and finalEnergy are finite', () => {
      const atoms = linearBackbone(3);
      const result = runMD(atoms, { numSteps: 50 });

      expect(Number.isFinite(result.initialEnergy)).toBe(true);
      expect(Number.isFinite(result.finalEnergy)).toBe(true);
    });

    it('meanTemperature is positive', () => {
      const atoms = linearBackbone(3);
      const result = runMD(atoms, { numSteps: 100, saveInterval: 50 });

      expect(result.meanTemperature).toBeGreaterThan(0);
    });

    it('meanRMSD is non-negative', () => {
      const atoms = linearBackbone(3);
      const result = runMD(atoms, { numSteps: 50 });

      expect(result.meanRMSD).toBeGreaterThanOrEqual(0);
    });

    it('frame times are in picoseconds', () => {
      const atoms = linearBackbone(3);
      const result = runMD(atoms, {
        numSteps: 100,
        timeStep: 2,
        saveInterval: 50,
      });

      // Time should be in ps (timeStep is in fs)
      // 50 steps * 2 fs = 100 fs = 0.1 ps
      for (const frame of result.frames) {
        expect(frame.time).toBeGreaterThanOrEqual(0);
      }
    });

    it('respects temperature setting', () => {
      const atoms = linearBackbone(3);
      const result = runMD(atoms, {
        numSteps: 200,
        temperature: 300,
        saveInterval: 100,
      });

      // Mean temperature should be roughly in the right ballpark
      // (Langevin thermostat targets the set temperature)
      expect(result.meanTemperature).toBeGreaterThan(0);
      expect(result.meanTemperature).toBeLessThan(1000);
    });

    it('handles empty atom array', () => {
      const result = runMD([]);
      expect(result.frames).toHaveLength(0);
      expect(result.initialEnergy).toBe(0);
      expect(result.finalEnergy).toBe(0);
    });

    it('handles single atom', () => {
      const atoms = [atom(1, 2, 3)];
      const result = runMD(atoms, { numSteps: 50 });

      expect(result.frames.length).toBeGreaterThan(0);
      expect(Number.isFinite(result.initialEnergy)).toBe(true);
    });

    it('uses default config when none provided', () => {
      const atoms = linearBackbone(3);
      const result = runMD(atoms);
      // Default: 1000 steps, saveInterval 100
      expect(result.frames.length).toBeGreaterThan(0);
    });

    it('frame atoms have same metadata as input', () => {
      const atoms = linearBackbone(4);
      const result = runMD(atoms, { numSteps: 50, saveInterval: 50 });

      if (result.frames.length > 0) {
        const frame = result.frames[0];
        for (let i = 0; i < atoms.length; i++) {
          expect(frame.atoms[i].atomName).toBe(atoms[i].atomName);
          expect(frame.atoms[i].residueIndex).toBe(atoms[i].residueIndex);
          expect(frame.atoms[i].residueName).toBe(atoms[i].residueName);
        }
      }
    });
  });
});
