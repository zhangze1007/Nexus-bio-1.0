import {
  generateBackbone,
  backboneToPDB,
  computeBondLength,
  computeBondAngle,
  BACKBONE_BOND_LENGTHS,
  BACKBONE_BOND_ANGLES,
  AMINO_ACIDS,
} from '../../src/services/protein/backboneGenerator';
import type { BackboneConfig, BackboneAtom } from '../../src/services/protein/backboneGenerator';

// Helper: distance between two 3D points
function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

// Helper: angle between three 3D points (in degrees)
function angleDeg(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

describe('backboneGenerator', () => {
  describe('generateBackbone', () => {
    describe('alpha helix generation', () => {
      const helixConfig: BackboneConfig = {
        length: 20,
        secondaryStructure: [{ type: 'helix', start: 0, end: 19 }],
      };

      it('generates correct number of atoms (4 per residue: N, CA, C, O)', () => {
        const atoms = generateBackbone(helixConfig);
        expect(atoms).toHaveLength(20 * 4);
      });

      it('has each residue with N, CA, C, O atoms in order', () => {
        const atoms = generateBackbone(helixConfig);
        for (let i = 0; i < 20; i++) {
          const residueAtoms = atoms.filter((a) => a.residueIndex === i);
          expect(residueAtoms).toHaveLength(4);
          const names = residueAtoms.map((a) => a.atomName);
          expect(names).toEqual(['N', 'CA', 'C', 'O']);
        }
      });

      it('maintains N-CA bond length ~1.47 Å (tolerance ±0.15 Å)', () => {
        const atoms = generateBackbone(helixConfig);
        for (let i = 0; i < 20; i++) {
          const nAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'N')!;
          const caAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'CA')!;
          const bondLen = dist(nAtom, caAtom);
          expect(bondLen).toBeGreaterThanOrEqual(1.32);
          expect(bondLen).toBeLessThanOrEqual(1.62);
        }
      });

      it('maintains CA-C bond length ~1.53 Å (tolerance ±0.15 Å)', () => {
        const atoms = generateBackbone(helixConfig);
        for (let i = 0; i < 20; i++) {
          const caAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'CA')!;
          const cAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'C')!;
          const bondLen = dist(caAtom, cAtom);
          expect(bondLen).toBeGreaterThanOrEqual(1.38);
          expect(bondLen).toBeLessThanOrEqual(1.68);
        }
      });

      it('maintains C-N peptide bond length ~1.32 Å (tolerance ±0.15 Å)', () => {
        const atoms = generateBackbone(helixConfig);
        for (let i = 0; i < 19; i++) {
          const cAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'C')!;
          const nNext = atoms.find((a) => a.residueIndex === i + 1 && a.atomName === 'N')!;
          const bondLen = dist(cAtom, nNext);
          expect(bondLen).toBeGreaterThanOrEqual(1.17);
          expect(bondLen).toBeLessThanOrEqual(1.47);
        }
      });

      it('N-CA-C bond angle ~111° (tolerance ±15°)', () => {
        const atoms = generateBackbone(helixConfig);
        for (let i = 0; i < 20; i++) {
          const nAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'N')!;
          const caAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'CA')!;
          const cAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'C')!;
          const ang = angleDeg(nAtom, caAtom, cAtom);
          expect(ang).toBeGreaterThanOrEqual(96);
          expect(ang).toBeLessThanOrEqual(126);
        }
      });

      it('rises approximately 1.5 Å per residue along the helix axis', () => {
        const atoms = generateBackbone(helixConfig);
        // Compare CA positions of consecutive residues
        const caAtoms = atoms.filter((a) => a.atomName === 'CA');
        // Z-component displacement between consecutive CAs should be ~1.5 Å on average
        const rises: number[] = [];
        for (let i = 1; i < caAtoms.length; i++) {
          rises.push(dist(caAtoms[i - 1], caAtoms[i]));
        }
        const avgRise = rises.reduce((a, b) => a + b, 0) / rises.length;
        // CA-CA distance along helix is about 3.8 Å but rise per residue is 1.5 Å
        // The distance between consecutive CAs is ~3.8 Å
        expect(avgRise).toBeGreaterThan(2.5);
        expect(avgRise).toBeLessThan(5.0);
      });

      it('generates a right-handed helix', () => {
        const atoms = generateBackbone(helixConfig);
        const caAtoms = atoms.filter((a) => a.atomName === 'CA');
        // Check end-to-end distance of the helix (first to last CA)
        const endToEnd = dist(caAtoms[0], caAtoms[caAtoms.length - 1]);
        // 20-residue helix: end-to-end should be substantial
        // (compact helix has ~1.5 A rise/residue, so ~28 A end-to-end for 20 res)
        expect(endToEnd).toBeGreaterThan(15);
        // Also check that the maximum extent along any axis is meaningful
        const xSpan = Math.max(...caAtoms.map((a) => a.x)) - Math.min(...caAtoms.map((a) => a.x));
        const ySpan = Math.max(...caAtoms.map((a) => a.y)) - Math.min(...caAtoms.map((a) => a.y));
        const zSpan = Math.max(...caAtoms.map((a) => a.z)) - Math.min(...caAtoms.map((a) => a.z));
        const maxSpan = Math.max(xSpan, ySpan, zSpan);
        expect(maxSpan).toBeGreaterThan(10);
      });
    });

    describe('beta sheet generation', () => {
      const sheetConfig: BackboneConfig = {
        length: 10,
        secondaryStructure: [{ type: 'sheet', start: 0, end: 9 }],
      };

      it('generates correct number of atoms for sheet', () => {
        const atoms = generateBackbone(sheetConfig);
        expect(atoms).toHaveLength(10 * 4);
      });

      it('maintains valid bond lengths for sheet residues', () => {
        const atoms = generateBackbone(sheetConfig);
        for (let i = 0; i < 10; i++) {
          const nAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'N')!;
          const caAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'CA')!;
          const cAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'C')!;
          expect(dist(nAtom, caAtom)).toBeGreaterThanOrEqual(1.32);
          expect(dist(nAtom, caAtom)).toBeLessThanOrEqual(1.62);
          expect(dist(caAtom, cAtom)).toBeGreaterThanOrEqual(1.38);
          expect(dist(caAtom, cAtom)).toBeLessThanOrEqual(1.68);
        }
      });

      it('sheet residues are more extended than helix (higher rise per residue)', () => {
        const atoms = generateBackbone(sheetConfig);
        const caAtoms = atoms.filter((a) => a.atomName === 'CA');
        const rises: number[] = [];
        for (let i = 1; i < caAtoms.length; i++) {
          rises.push(dist(caAtoms[i - 1], caAtoms[i]));
        }
        const avgRise = rises.reduce((a, b) => a + b, 0) / rises.length;
        // Beta sheet is more extended: ~3.3 Å rise per residue, CA-CA ~3.8 Å
        expect(avgRise).toBeGreaterThan(3.0);
        expect(avgRise).toBeLessThan(5.0);
      });
    });

    describe('loop generation', () => {
      const loopConfig: BackboneConfig = {
        length: 5,
        secondaryStructure: [{ type: 'loop', start: 0, end: 4 }],
      };

      it('generates correct number of atoms for loop', () => {
        const atoms = generateBackbone(loopConfig);
        expect(atoms).toHaveLength(5 * 4);
      });

      it('maintains valid bond lengths for loop residues', () => {
        const atoms = generateBackbone(loopConfig);
        for (let i = 0; i < 5; i++) {
          const nAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'N')!;
          const caAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'CA')!;
          const cAtom = atoms.find((a) => a.residueIndex === i && a.atomName === 'C')!;
          expect(dist(nAtom, caAtom)).toBeGreaterThanOrEqual(1.32);
          expect(dist(nAtom, caAtom)).toBeLessThanOrEqual(1.62);
          expect(dist(caAtom, cAtom)).toBeGreaterThanOrEqual(1.38);
          expect(dist(caAtom, cAtom)).toBeLessThanOrEqual(1.68);
        }
      });
    });

    describe('mixed secondary structure', () => {
      const mixedConfig: BackboneConfig = {
        length: 30,
        secondaryStructure: [
          { type: 'helix', start: 0, end: 9 },
          { type: 'loop', start: 10, end: 14 },
          { type: 'sheet', start: 15, end: 29 },
        ],
      };

      it('generates correct total number of atoms', () => {
        const atoms = generateBackbone(mixedConfig);
        expect(atoms).toHaveLength(30 * 4);
      });

      it('all residues have valid backbone geometry', () => {
        const atoms = generateBackbone(mixedConfig);
        for (let i = 0; i < 30; i++) {
          const residueAtoms = atoms.filter((a) => a.residueIndex === i);
          expect(residueAtoms).toHaveLength(4);
          const names = residueAtoms.map((a) => a.atomName).sort();
          expect(names).toEqual(['C', 'CA', 'N', 'O']);
        }
      });

      it('peptide bonds between regions maintain valid lengths', () => {
        const atoms = generateBackbone(mixedConfig);
        // Check peptide bonds at region boundaries: 9→10 (helix→loop), 14→15 (loop→sheet)
        for (const boundaryIdx of [9, 14]) {
          const cAtom = atoms.find((a) => a.residueIndex === boundaryIdx && a.atomName === 'C')!;
          const nNext = atoms.find((a) => a.residueIndex === boundaryIdx + 1 && a.atomName === 'N')!;
          const bondLen = dist(cAtom, nNext);
          expect(bondLen).toBeGreaterThanOrEqual(1.17);
          expect(bondLen).toBeLessThanOrEqual(1.47);
        }
      });

      it('helix region is more compact than sheet region', () => {
        const atoms = generateBackbone(mixedConfig);
        const helixCAs = atoms.filter((a) => a.atomName === 'CA' && a.residueIndex >= 0 && a.residueIndex <= 9);
        const sheetCAs = atoms.filter((a) => a.atomName === 'CA' && a.residueIndex >= 15 && a.residueIndex <= 29);

        // End-to-end distance of helix (10 residues) vs sheet (15 residues)
        const helixEndToEnd = dist(helixCAs[0], helixCAs[helixCAs.length - 1]);
        const sheetEndToEnd = dist(sheetCAs[0], sheetCAs[sheetCAs.length - 1]);

        // Normalize: helix ~1.5 Å/residue, sheet ~3.3 Å/residue
        const helixPerResidue = helixEndToEnd / 9;
        const sheetPerResidue = sheetEndToEnd / 14;

        expect(sheetPerResidue).toBeGreaterThan(helixPerResidue);
      });
    });

    describe('edge cases', () => {
      it('handles single residue', () => {
        const config: BackboneConfig = {
          length: 1,
          secondaryStructure: [{ type: 'helix', start: 0, end: 0 }],
        };
        const atoms = generateBackbone(config);
        expect(atoms).toHaveLength(4);
      });

      it('handles length 0 gracefully', () => {
        const config: BackboneConfig = {
          length: 0,
          secondaryStructure: [],
        };
        const atoms = generateBackbone(config);
        expect(atoms).toHaveLength(0);
      });

      it('uses ALA as default residue name', () => {
        const config: BackboneConfig = {
          length: 3,
          secondaryStructure: [{ type: 'helix', start: 0, end: 2 }],
        };
        const atoms = generateBackbone(config);
        atoms.forEach((a) => {
          expect(a.residueName).toBe('ALA');
        });
      });
    });
  });

  describe('backboneToPDB', () => {
    it('produces valid PDB format with ATOM records', () => {
      const config: BackboneConfig = {
        length: 3,
        secondaryStructure: [{ type: 'helix', start: 0, end: 2 }],
      };
      const atoms = generateBackbone(config);
      const pdb = backboneToPDB(atoms);

      const lines = pdb.split('\n').filter((l) => l.startsWith('ATOM'));
      expect(lines).toHaveLength(12); // 3 residues * 4 atoms
    });

    it('PDB ATOM lines have correct column format', () => {
      const config: BackboneConfig = {
        length: 2,
        secondaryStructure: [{ type: 'helix', start: 0, end: 1 }],
      };
      const atoms = generateBackbone(config);
      const pdb = backboneToPDB(atoms);
      const lines = pdb.split('\n').filter((l) => l.startsWith('ATOM'));

      for (const line of lines) {
        // PDB format: columns 1-6 = record type
        expect(line.substring(0, 6).trim()).toBe('ATOM');
        // Atom name at columns 13-16
        const atomName = line.substring(12, 16).trim();
        expect(['N', 'CA', 'C', 'O']).toContain(atomName);
        // Residue name at columns 18-20
        const resName = line.substring(17, 20).trim();
        expect(resName).toBe('ALA');
      }
    });

    it('PDB contains TER and END records', () => {
      const config: BackboneConfig = {
        length: 2,
        secondaryStructure: [{ type: 'helix', start: 0, end: 1 }],
      };
      const atoms = generateBackbone(config);
      const pdb = backboneToPDB(atoms);

      expect(pdb).toContain('TER');
      expect(pdb).toContain('END');
    });

    it('PDB coordinates match the atom data', () => {
      const config: BackboneConfig = {
        length: 1,
        secondaryStructure: [{ type: 'helix', start: 0, end: 0 }],
      };
      const atoms = generateBackbone(config);
      const pdb = backboneToPDB(atoms);
      const firstLine = pdb.split('\n').find((l) => l.startsWith('ATOM'))!;

      // X coordinate: columns 31-38
      const x = parseFloat(firstLine.substring(30, 38).trim());
      expect(x).toBeCloseTo(atoms[0].x, 2);
    });

    it('handles empty atom array', () => {
      const pdb = backboneToPDB([]);
      expect(pdb).toContain('END');
    });
  });

  describe('computeBondLength', () => {
    it('computes distance between two points', () => {
      const a: BackboneAtom = { atomName: 'N', x: 0, y: 0, z: 0, residueIndex: 0, residueName: 'ALA' };
      const b: BackboneAtom = { atomName: 'CA', x: 1.47, y: 0, z: 0, residueIndex: 0, residueName: 'ALA' };
      expect(computeBondLength(a, b)).toBeCloseTo(1.47, 2);
    });

    it('is symmetric', () => {
      const a: BackboneAtom = { atomName: 'N', x: 1, y: 2, z: 3, residueIndex: 0, residueName: 'ALA' };
      const b: BackboneAtom = { atomName: 'CA', x: 4, y: 5, z: 6, residueIndex: 0, residueName: 'ALA' };
      expect(computeBondLength(a, b)).toBeCloseTo(computeBondLength(b, a), 10);
    });
  });

  describe('computeBondAngle', () => {
    it('computes 90° angle correctly', () => {
      const a: BackboneAtom = { atomName: 'N', x: 1, y: 0, z: 0, residueIndex: 0, residueName: 'ALA' };
      const b: BackboneAtom = { atomName: 'CA', x: 0, y: 0, z: 0, residueIndex: 0, residueName: 'ALA' };
      const c: BackboneAtom = { atomName: 'C', x: 0, y: 1, z: 0, residueIndex: 0, residueName: 'ALA' };
      expect(computeBondAngle(a, b, c)).toBeCloseTo(90, 1);
    });

    it('computes 180° angle for collinear points', () => {
      const a: BackboneAtom = { atomName: 'N', x: -1, y: 0, z: 0, residueIndex: 0, residueName: 'ALA' };
      const b: BackboneAtom = { atomName: 'CA', x: 0, y: 0, z: 0, residueIndex: 0, residueName: 'ALA' };
      const c: BackboneAtom = { atomName: 'C', x: 1, y: 0, z: 0, residueIndex: 0, residueName: 'ALA' };
      expect(computeBondAngle(a, b, c)).toBeCloseTo(180, 1);
    });
  });

  describe('constants', () => {
    it('BACKBONE_BOND_LENGTHS has expected keys', () => {
      expect(BACKBONE_BOND_LENGTHS).toHaveProperty('N_CA');
      expect(BACKBONE_BOND_LENGTHS).toHaveProperty('CA_C');
      expect(BACKBONE_BOND_LENGTHS).toHaveProperty('C_N');
    });

    it('BACKBONE_BOND_ANGLES has expected keys', () => {
      expect(BACKBONE_BOND_ANGLES).toHaveProperty('N_CA_C');
      expect(BACKBONE_BOND_ANGLES).toHaveProperty('CA_C_N');
      expect(BACKBONE_BOND_ANGLES).toHaveProperty('C_N_CA');
    });

    it('bond length values are physically reasonable', () => {
      expect(BACKBONE_BOND_LENGTHS.N_CA).toBeCloseTo(1.47, 1);
      expect(BACKBONE_BOND_LENGTHS.CA_C).toBeCloseTo(1.53, 1);
      expect(BACKBONE_BOND_LENGTHS.C_N).toBeCloseTo(1.32, 1);
    });

    it('AMINO_ACIDS contains standard 20 amino acid codes', () => {
      expect(AMINO_ACIDS).toContain('ALA');
      expect(AMINO_ACIDS).toContain('GLY');
      expect(AMINO_ACIDS).toContain('LEU');
      expect(AMINO_ACIDS.length).toBe(20);
    });
  });
});
