import { parseSMILES, SMILESGraph } from '../../src/utils/smilesParser';

describe('SMILES parser', () => {
  /* ---------------------------------------------------------------- */
  /*  Basic molecules                                                  */
  /* ---------------------------------------------------------------- */

  it('parses ethanol (CCO) correctly', () => {
    const result = parseSMILES('CCO');
    expect(result.atoms.length).toBe(3);
    expect(result.atoms[0].element).toBe('C');
    expect(result.atoms[1].element).toBe('C');
    expect(result.atoms[2].element).toBe('O');
    expect(result.bonds.length).toBe(2);
    expect(result.bonds[0]).toEqual({ from: 0, to: 1, order: 1, isAromatic: false });
    expect(result.bonds[1]).toEqual({ from: 1, to: 2, order: 1, isAromatic: false });
  });

  it('parses methane (C) as a single atom', () => {
    const result = parseSMILES('C');
    expect(result.atoms.length).toBe(1);
    expect(result.atoms[0].element).toBe('C');
    expect(result.bonds.length).toBe(0);
  });

  it('parses water (O) as a single atom', () => {
    const result = parseSMILES('O');
    expect(result.atoms.length).toBe(1);
    expect(result.atoms[0].element).toBe('O');
  });

  /* ---------------------------------------------------------------- */
  /*  Double and triple bonds                                          */
  /* ---------------------------------------------------------------- */

  it('parses acetic acid (CC(=O)O) correctly', () => {
    const result = parseSMILES('CC(=O)O');
    expect(result.atoms.length).toBe(4);

    // Elements: C, C, O, O
    expect(result.atoms.map(a => a.element)).toEqual(['C', 'C', 'O', 'O']);

    const doubleBonds = result.bonds.filter(b => b.order === 2);
    expect(doubleBonds.length).toBe(1);
    expect(doubleBonds[0].from).toBe(1);
    expect(doubleBonds[0].to).toBe(2);
  });

  it('parses formaldehyde (C=O) correctly', () => {
    const result = parseSMILES('C=O');
    expect(result.atoms.length).toBe(2);
    expect(result.bonds.length).toBe(1);
    expect(result.bonds[0].order).toBe(2);
  });

  it('parses hydrogen cyanide (C#N) correctly', () => {
    const result = parseSMILES('C#N');
    expect(result.atoms.length).toBe(2);
    expect(result.bonds.length).toBe(1);
    expect(result.bonds[0].order).toBe(3);
  });

  /* ---------------------------------------------------------------- */
  /*  Aromatic atoms                                                   */
  /* ---------------------------------------------------------------- */

  it('parses benzene (c1ccccc1) correctly', () => {
    const result = parseSMILES('c1ccccc1');
    expect(result.atoms.length).toBe(6);
    expect(result.atoms.every(a => a.isAromatic)).toBe(true);
    expect(result.atoms.every(a => a.element === 'C')).toBe(true);
    expect(result.bonds.length).toBe(6);
  });

  it('parses pyridine (c1ccncc1) correctly', () => {
    const result = parseSMILES('c1ccncc1');
    expect(result.atoms.length).toBe(6);
    const nitrogenIdx = result.atoms.findIndex(a => a.element === 'N');
    expect(nitrogenIdx).toBe(3);
    expect(result.atoms[nitrogenIdx].isAromatic).toBe(true);
  });

  /* ---------------------------------------------------------------- */
  /*  Branching                                                        */
  /* ---------------------------------------------------------------- */

  it('handles branching correctly — isobutane (CC(C)C)', () => {
    const result = parseSMILES('CC(C)C');
    expect(result.atoms.length).toBe(4);
    expect(result.atoms.map(a => a.element)).toEqual(['C', 'C', 'C', 'C']);

    // Bonds: 0-1, 1-2 (branch), 1-3 (main chain)
    expect(result.bonds.length).toBe(3);
    expect(result.bonds[0]).toEqual({ from: 0, to: 1, order: 1, isAromatic: false });
    expect(result.bonds[1]).toEqual({ from: 1, to: 2, order: 1, isAromatic: false });
    expect(result.bonds[2]).toEqual({ from: 1, to: 3, order: 1, isAromatic: false });
  });

  it('handles nested branching — neopentane (CC(C)(C)C)', () => {
    const result = parseSMILES('CC(C)(C)C');
    expect(result.atoms.length).toBe(5);
    expect(result.bonds.length).toBe(4);

    // Central carbon (index 1) should have 4 bonds
    const centralBonds = result.bonds.filter(b => b.from === 1 || b.to === 1);
    expect(centralBonds.length).toBe(4);
  });

  /* ---------------------------------------------------------------- */
  /*  Ring closures                                                    */
  /* ---------------------------------------------------------------- */

  it('parses cyclohexane (C1CCCCC1) correctly', () => {
    const result = parseSMILES('C1CCCCC1');
    expect(result.atoms.length).toBe(6);
    expect(result.bonds.length).toBe(6);

    // The ring-closing bond should connect atom 5 back to atom 0
    const ringBond = result.bonds.find(
      b => (b.from === 0 && b.to === 5) || (b.from === 5 && b.to === 0)
    );
    expect(ringBond).toBeDefined();
    expect(ringBond!.order).toBe(1);
  });

  it('parses cyclopropane (C1CC1) correctly', () => {
    const result = parseSMILES('C1CC1');
    expect(result.atoms.length).toBe(3);
    expect(result.bonds.length).toBe(3);
  });

  it('handles two-digit ring closures with %', () => {
    // Use %10 notation for a ring with >9 members
    const result = parseSMILES('C%10CCCCCCCCCCCC%10');
    expect(result.atoms.length).toBe(13);
    expect(result.bonds.length).toBe(13);
    // Ring-closing bond connects last atom back to first
    const ringBond = result.bonds.find(
      b => (b.from === 0 && b.to === 12) || (b.from === 12 && b.to === 0)
    );
    expect(ringBond).toBeDefined();
  });

  /* ---------------------------------------------------------------- */
  /*  Bracket atoms                                                    */
  /* ---------------------------------------------------------------- */

  it('parses bracket atoms with charge ([NH4+])', () => {
    const result = parseSMILES('[NH4+]');
    expect(result.atoms.length).toBe(1);
    expect(result.atoms[0].element).toBe('N');
    expect(result.atoms[0].charge).toBe(1);
  });

  it('parses bracket atoms with negative charge ([O-])', () => {
    const result = parseSMILES('[O-]');
    expect(result.atoms.length).toBe(1);
    expect(result.atoms[0].element).toBe('O');
    expect(result.atoms[0].charge).toBe(-1);
  });

  it('parses bracket atoms with explicit hydrogen count ([CH3])', () => {
    const result = parseSMILES('[CH3]');
    expect(result.atoms.length).toBe(1);
    expect(result.atoms[0].element).toBe('C');
  });

  /* ---------------------------------------------------------------- */
  /*  Halogens                                                         */
  /* ---------------------------------------------------------------- */

  it('parses chloroethane (CCl) correctly', () => {
    const result = parseSMILES('CCl');
    expect(result.atoms.length).toBe(2);
    expect(result.atoms[1].element).toBe('Cl');
    expect(result.bonds.length).toBe(1);
  });

  it('parses bromomethane (CBr) correctly', () => {
    const result = parseSMILES('CBr');
    expect(result.atoms.length).toBe(2);
    expect(result.atoms[1].element).toBe('Br');
  });

  it('parses fluoromethane (CF) correctly', () => {
    const result = parseSMILES('CF');
    expect(result.atoms.length).toBe(2);
    expect(result.atoms[1].element).toBe('F');
  });

  it('parses iodomethane (CI) correctly', () => {
    const result = parseSMILES('CI');
    expect(result.atoms.length).toBe(2);
    expect(result.atoms[1].element).toBe('I');
  });

  /* ---------------------------------------------------------------- */
  /*  Complex molecules                                                */
  /* ---------------------------------------------------------------- */

  it('parses aspirin (CC(=O)Oc1ccccc1C(=O)O) correctly', () => {
    const result = parseSMILES('CC(=O)Oc1ccccc1C(=O)O');
    // Atoms: C, C, O, O, C, C, C, C, C, C, C, O, O = 13
    expect(result.atoms.length).toBe(13);

    // Count aromatic carbons (the benzene ring: indices 4-9)
    const aromaticAtoms = result.atoms.filter(a => a.isAromatic);
    expect(aromaticAtoms.length).toBe(6);

    // Two C=O double bonds
    const doubleBonds = result.bonds.filter(b => b.order === 2);
    expect(doubleBonds.length).toBe(2);
  });

  it('parses dimethyl ether (COC) correctly', () => {
    const result = parseSMILES('COC');
    expect(result.atoms.length).toBe(3);
    expect(result.atoms[1].element).toBe('O');
    expect(result.bonds.length).toBe(2);
  });

  /* ---------------------------------------------------------------- */
  /*  Edge cases                                                       */
  /* ---------------------------------------------------------------- */

  it('returns empty graph for empty string', () => {
    const result = parseSMILES('');
    expect(result.atoms.length).toBe(0);
    expect(result.bonds.length).toBe(0);
  });

  it('all atom indices are sequential starting from 0', () => {
    const result = parseSMILES('CC(C)CC');
    result.atoms.forEach((atom, i) => {
      expect(atom.index).toBe(i);
    });
  });

  it('every bond references valid atom indices', () => {
    const result = parseSMILES('CC(=O)Oc1ccccc1C(=O)O');
    for (const bond of result.bonds) {
      expect(bond.from).toBeGreaterThanOrEqual(0);
      expect(bond.from).toBeLessThan(result.atoms.length);
      expect(bond.to).toBeGreaterThanOrEqual(0);
      expect(bond.to).toBeLessThan(result.atoms.length);
    }
  });
});
