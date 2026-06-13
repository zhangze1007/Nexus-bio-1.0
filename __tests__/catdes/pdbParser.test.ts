import { parsePDB } from '../../src/utils/pdbParser';

describe('PDB parser', () => {
  it('parses ATOM records', () => {
    const pdb = `ATOM      1  N   ALA A   1       1.000   2.000   3.000  1.00 10.00           N
ATOM      2  CA  ALA A   1       2.000   3.000   4.000  1.00 10.00           C
END`;
    const result = parsePDB(pdb);
    expect(result.atoms.length).toBe(2);
    expect(result.atoms[0].element).toBe('N');
    expect(result.atoms[0].x).toBeCloseTo(1.0);
  });

  it('computes distances', () => {
    const pdb = `ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 10.00           N
ATOM      2  CA  ALA A   1       3.000   4.000   0.000  1.00 10.00           C
END`;
    const result = parsePDB(pdb);
    expect(result.distance(0, 1)).toBeCloseTo(5.0);
  });

  it('finds atoms near a point', () => {
    const pdb = `ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 10.00           N
ATOM      2  CA  ALA A   1       1.000   0.000   0.000  1.00 10.00           C
ATOM      3  C   ALA A   1      10.000   0.000   0.000  1.00 10.00           C
END`;
    const result = parsePDB(pdb);
    const near = result.atomsNear([0, 0, 0], 2.0);
    expect(near.length).toBe(2);
  });

  it('finds residues near an atom', () => {
    const pdb = `ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 10.00           N
ATOM      2  CA  ALA A   1       1.000   0.000   0.000  1.00 10.00           C
ATOM      3  N   GLY B   2       1.500   0.000   0.000  1.00 10.00           N
END`;
    const result = parsePDB(pdb);
    const residues = result.residuesNear(0, 3.0);
    expect(residues.length).toBeGreaterThan(0);
  });
});
