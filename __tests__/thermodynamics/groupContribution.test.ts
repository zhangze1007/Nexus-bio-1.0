/**
 * Tests for the graph-based group contribution module.
 *
 * Validates that the SMILES-parser-driven group detection correctly
 * identifies functional groups and estimates formation energies using
 * the Mavrovouniotis (1991) method.
 */

import {
  estimateFormationEnergy,
  GROUP_CONTRIBUTIONS,
  GroupContributionResult,
} from '../../src/utils/groupContribution';

describe('group contribution', () => {
  /* ---------------------------------------------------------------- */
  /*  Basic molecules                                                  */
  /* ---------------------------------------------------------------- */

  it('estimates formation energy for ethanol (CCO)', () => {
    const result = estimateFormationEnergy('CCO');
    expect(result.deltaGf).toBeDefined();
    expect(typeof result.deltaGf).toBe('number');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.matchedGroups.length).toBeGreaterThan(0);

    // Ethanol should contain CH3, CH2, and OH
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('CH3');
    expect(groupNames).toContain('CH2');
    expect(groupNames).toContain('OH');
  });

  it('estimates formation energy for acetic acid (CC(=O)O)', () => {
    const result = estimateFormationEnergy('CC(=O)O');
    expect(result.matchedGroups).toContainEqual(
      expect.objectContaining({ group: 'COOH' }),
    );

    // Should also have CH3
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('CH3');
  });

  it('returns low confidence for unrecognized molecules', () => {
    const result = estimateFormationEnergy('[Fe+2]');
    expect(result.confidence).toBeLessThan(0.5);
  });

  /* ---------------------------------------------------------------- */
  /*  Empty / edge cases                                               */
  /* ---------------------------------------------------------------- */

  it('returns zero deltaGf and confidence 0 for empty SMILES', () => {
    const result = estimateFormationEnergy('');
    expect(result.deltaGf).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.matchedGroups).toEqual([]);
  });

  it('returns zero deltaGf for whitespace-only input', () => {
    const result = estimateFormationEnergy('   ');
    expect(result.deltaGf).toBe(0);
    expect(result.confidence).toBe(0);
  });

  /* ---------------------------------------------------------------- */
  /*  Functional group detection                                       */
  /* ---------------------------------------------------------------- */

  it('detects C=C double bond in ethylene (C=C)', () => {
    const result = estimateFormationEnergy('C=C');
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('C=C');
  });

  it('detects SH (thiol) in methanethiol (CS)', () => {
    const result = estimateFormationEnergy('CS');
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('SH');
    expect(groupNames).toContain('CH3');
  });

  it('detects NH2 (primary amine) in methylamine (CN)', () => {
    const result = estimateFormationEnergy('CN');
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('NH2');
    expect(groupNames).toContain('CH3');
  });

  it('detects C=O (carbonyl) in acetone (CC(=O)C)', () => {
    const result = estimateFormationEnergy('CC(=O)C');
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('C=O');
    // Should have two CH3 groups
    const ch3Entry = result.matchedGroups.find(g => g.group === 'CH3');
    expect(ch3Entry?.count).toBe(2);
  });

  it('detects CHO (aldehyde) in acetaldehyde (CC=O)', () => {
    const result = estimateFormationEnergy('CC=O');
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('CHO');
    expect(groupNames).toContain('CH3');
  });

  it('detects amide in acetamide (CC(=O)N)', () => {
    const result = estimateFormationEnergy('CC(=O)N');
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('amide');
    expect(groupNames).toContain('CH3');
  });

  it('detects aromatic carbons in benzene (c1ccccc1)', () => {
    const result = estimateFormationEnergy('c1ccccc1');
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('aromatic_C');

    const aromaticEntry = result.matchedGroups.find(g => g.group === 'aromatic_C');
    expect(aromaticEntry?.count).toBe(6);
  });

  it('detects thioester in methyl thioacetate (CC(=O)SC)', () => {
    const result = estimateFormationEnergy('CC(=O)SC');
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('thioester');
  });

  /* ---------------------------------------------------------------- */
  /*  Energy calculations                                              */
  /* ---------------------------------------------------------------- */

  it('computes correct deltaGf for ethanol', () => {
    const result = estimateFormationEnergy('CCO');
    // Expected: CH3(-3.6) + CH2(0.56) + OH(-16.2) = -19.24
    const expected =
      GROUP_CONTRIBUTIONS['CH3'] +
      GROUP_CONTRIBUTIONS['CH2'] +
      GROUP_CONTRIBUTIONS['OH'];
    expect(result.deltaGf).toBeCloseTo(expected, 4);
  });

  it('computes correct deltaGf for acetic acid', () => {
    const result = estimateFormationEnergy('CC(=O)O');
    // Expected: CH3(-3.6) + COOH(-24.4) = -28.0
    const expected =
      GROUP_CONTRIBUTIONS['CH3'] +
      GROUP_CONTRIBUTIONS['COOH'];
    expect(result.deltaGf).toBeCloseTo(expected, 4);
  });

  /* ---------------------------------------------------------------- */
  /*  Confidence scoring                                               */
  /* ---------------------------------------------------------------- */

  it('returns medium confidence (0.7) for ethanol (3 groups)', () => {
    const result = estimateFormationEnergy('CCO');
    expect(result.confidence).toBe(0.7);
  });

  it('returns low confidence (0.3) for methane (C)', () => {
    const result = estimateFormationEnergy('C');
    expect(result.confidence).toBe(0.3);
  });

  it('returns zero confidence for [Fe+2]', () => {
    const result = estimateFormationEnergy('[Fe+2]');
    expect(result.confidence).toBe(0);
  });

  /* ---------------------------------------------------------------- */
  /*  Multi-group molecules                                            */
  /* ---------------------------------------------------------------- */

  it('detects multiple groups in aspirin (CC(=O)Oc1ccccc1C(=O)O)', () => {
    const result = estimateFormationEnergy('CC(=O)Oc1ccccc1C(=O)O');
    const groupNames = result.matchedGroups.map(g => g.group);

    // Should detect two COOH groups
    expect(groupNames).toContain('COOH');
    const coohEntry = result.matchedGroups.find(g => g.group === 'COOH');
    expect(coohEntry?.count).toBe(2);

    // Should detect aromatic carbons
    expect(groupNames).toContain('aromatic_C');

    // Should have more than 5 groups → high confidence
    expect(result.confidence).toBe(1.0);
  });

  it('detects OH and CH3 in methanol (CO)', () => {
    const result = estimateFormationEnergy('CO');
    const groupNames = result.matchedGroups.map(g => g.group);
    expect(groupNames).toContain('OH');
    expect(groupNames).toContain('CH3');
  });

  it('detects dimethyl ether (COC) without OH', () => {
    const result = estimateFormationEnergy('COC');
    const groupNames = result.matchedGroups.map(g => g.group);
    // O between two C with no carbonyl → not detected as any group (ether)
    expect(groupNames).not.toContain('OH');
    expect(groupNames).toContain('CH3');
  });
});
