import { runMD } from '../src/services/protein/mdIntegrator';
import type { BackboneAtom } from '../src/services/protein/backboneGenerator';

jest.setTimeout(30_000);

function linearBackbone(length: number): BackboneAtom[] {
  const atoms: BackboneAtom[] = [];
  for (let i = 0; i < length; i++) {
    atoms.push({ atomName: 'CA', x: i * 3.8, y: 0, z: 0, residueIndex: i, residueName: 'ALA' });
  }
  return atoms;
}

/**
 * T2 reproducibility: seeded Langevin dynamics — same seed => identical
 * trajectory, different seed => different trajectory.
 */
describe('runMD seeding', () => {
  it('same seed => identical trajectory', () => {
    const a = runMD(linearBackbone(6), { numSteps: 40, saveInterval: 20, seed: 7 });
    const b = runMD(linearBackbone(6), { numSteps: 40, saveInterval: 20, seed: 7 });
    expect(b.finalEnergy).toBe(a.finalEnergy);
    expect(b.meanTemperature).toBe(a.meanTemperature);
    expect(b.frames.map((f) => f.energy)).toEqual(a.frames.map((f) => f.energy));
  });

  it('different seed => different trajectory', () => {
    const a = runMD(linearBackbone(6), { numSteps: 40, saveInterval: 20, seed: 1 });
    const b = runMD(linearBackbone(6), { numSteps: 40, saveInterval: 20, seed: 2 });
    expect(b.finalEnergy).not.toBe(a.finalEnergy);
  });
});
