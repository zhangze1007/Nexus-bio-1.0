/**
 * Tests for Chou-Fasman amino acid propensity tables.
 *
 * Verifies published values from:
 *   Chou & Fasman (1978) Annu Rev Biochem 47:251-276
 *
 * @scientific_provenance
 *   ALGORITHM: Chou-Fasman secondary structure propensity tables
 *   REFERENCE: Chou PY, Fasman GD (1978) Annu Rev Biochem 47:251-276
 */

import {
  HELIX_PROPENSITIES,
  SHEET_PROPENSITIES,
  LOOP_PROPENSITIES,
  HYDROPHOBIC_CORE,
  CHARGE_PAIRS,
  ALL_AMINO_ACIDS,
} from '../../src/services/protein/propensity';

describe('Chou-Fasman propensity tables', () => {
  describe('HELIX_PROPENSITIES', () => {
    it('should have entries for all 20 amino acids', () => {
      expect(Object.keys(HELIX_PROPENSITIES)).toHaveLength(20);
      for (const aa of ALL_AMINO_ACIDS) {
        expect(HELIX_PROPENSITIES[aa]).toBeDefined();
      }
    });

    it('should have published Chou-Fasman values for key helix formers', () => {
      // Strong helix formers (Pa > 1.0)
      // Chou & Fasman (1978) Table I
      expect(HELIX_PROPENSITIES['A']).toBeCloseTo(1.42, 2); // Ala
      expect(HELIX_PROPENSITIES['E']).toBeCloseTo(1.51, 2); // Glu
      expect(HELIX_PROPENSITIES['L']).toBeCloseTo(1.21, 2); // Leu
      expect(HELIX_PROPENSITIES['M']).toBeCloseTo(1.45, 2); // Met
    });

    it('should have published values for helix breakers', () => {
      // Helix breakers (Pa < 1.0)
      expect(HELIX_PROPENSITIES['P']).toBeCloseTo(0.57, 2); // Pro
      expect(HELIX_PROPENSITIES['G']).toBeCloseTo(0.57, 2); // Gly
    });

    it('should have all values positive', () => {
      for (const aa of ALL_AMINO_ACIDS) {
        expect(HELIX_PROPENSITIES[aa]).toBeGreaterThan(0);
      }
    });
  });

  describe('SHEET_PROPENSITIES', () => {
    it('should have entries for all 20 amino acids', () => {
      expect(Object.keys(SHEET_PROPENSITIES)).toHaveLength(20);
      for (const aa of ALL_AMINO_ACIDS) {
        expect(SHEET_PROPENSITIES[aa]).toBeDefined();
      }
    });

    it('should have published values for strong sheet formers', () => {
      // Strong sheet formers (Pb > 1.0)
      // Chou & Fasman (1978) Table II
      expect(SHEET_PROPENSITIES['V']).toBeCloseTo(1.70, 2); // Val
      expect(SHEET_PROPENSITIES['I']).toBeCloseTo(1.60, 2); // Ile
      expect(SHEET_PROPENSITIES['Y']).toBeCloseTo(1.47, 2); // Tyr
      expect(SHEET_PROPENSITIES['F']).toBeCloseTo(1.38, 2); // Phe
    });

    it('should have published values for sheet breakers', () => {
      // Sheet breakers (Pb < 1.0)
      expect(SHEET_PROPENSITIES['E']).toBeCloseTo(0.37, 2); // Glu
      expect(SHEET_PROPENSITIES['D']).toBeCloseTo(0.54, 2); // Asp
    });

    it('should have all values positive', () => {
      for (const aa of ALL_AMINO_ACIDS) {
        expect(SHEET_PROPENSITIES[aa]).toBeGreaterThan(0);
      }
    });
  });

  describe('LOOP_PROPENSITIES', () => {
    it('should have entries for all 20 amino acids', () => {
      expect(Object.keys(LOOP_PROPENSITIES)).toHaveLength(20);
      for (const aa of ALL_AMINO_ACIDS) {
        expect(LOOP_PROPENSITIES[aa]).toBeDefined();
      }
    });

    it('should have high values for known turn-forming residues', () => {
      // Gly and Pro are strong turn/loop formers
      // Chou & Fasman (1978) Table III
      expect(LOOP_PROPENSITIES['G']).toBeCloseTo(1.64, 2); // Gly
      expect(LOOP_PROPENSITIES['P']).toBeCloseTo(1.91, 2); // Pro
      expect(LOOP_PROPENSITIES['N']).toBeCloseTo(1.56, 2); // Asn
      expect(LOOP_PROPENSITIES['D']).toBeCloseTo(1.46, 2); // Asp
    });

    it('should have all values positive', () => {
      for (const aa of ALL_AMINO_ACIDS) {
        expect(LOOP_PROPENSITIES[aa]).toBeGreaterThan(0);
      }
    });
  });

  describe('propensity consistency', () => {
    it('helix + sheet + loop propensities should all use same 20 amino acids', () => {
      const helixAAs = Object.keys(HELIX_PROPENSITIES).sort();
      const sheetAAs = Object.keys(SHEET_PROPENSITIES).sort();
      const loopAAs = Object.keys(LOOP_PROPENSITIES).sort();
      expect(helixAAs).toEqual(sheetAAs);
      expect(sheetAAs).toEqual(loopAAs);
    });

    it('ALL_AMINO_ACIDS should contain exactly 20 standard amino acids', () => {
      expect(ALL_AMINO_ACIDS).toHaveLength(20);
      const expected = 'ACDEFGHIKLMNPQRSTVWY'.split('').sort();
      expect([...ALL_AMINO_ACIDS].sort()).toEqual(expected);
    });
  });
});

describe('HYDROPHOBIC_CORE', () => {
  it('should contain Val, Ile, Leu, Phe, Trp, Met', () => {
    expect(HYDROPHOBIC_CORE.has('V')).toBe(true); // Val
    expect(HYDROPHOBIC_CORE.has('I')).toBe(true); // Ile
    expect(HYDROPHOBIC_CORE.has('L')).toBe(true); // Leu
    expect(HYDROPHOBIC_CORE.has('F')).toBe(true); // Phe
    expect(HYDROPHOBIC_CORE.has('W')).toBe(true); // Trp
    expect(HYDROPHOBIC_CORE.has('M')).toBe(true); // Met
  });

  it('should not contain charged or polar residues', () => {
    expect(HYDROPHOBIC_CORE.has('D')).toBe(false); // Asp (charged)
    expect(HYDROPHOBIC_CORE.has('K')).toBe(false); // Lys (charged)
    expect(HYDROPHOBIC_CORE.has('S')).toBe(false); // Ser (polar)
    expect(HYDROPHOBIC_CORE.has('T')).toBe(false); // Thr (polar)
  });

  it('should have 6 members (standard hydrophobic core residues)', () => {
    expect(HYDROPHOBIC_CORE.size).toBe(6);
  });
});

describe('CHARGE_PAIRS', () => {
  it('should include Asp-Lys pair (salt bridge)', () => {
    const hasPair = CHARGE_PAIRS.some(
      ([a, b]) => (a === 'D' && b === 'K') || (a === 'K' && b === 'D'),
    );
    expect(hasPair).toBe(true);
  });

  it('should include Glu-Arg pair (salt bridge)', () => {
    const hasPair = CHARGE_PAIRS.some(
      ([a, b]) => (a === 'E' && b === 'R') || (a === 'R' && b === 'E'),
    );
    expect(hasPair).toBe(true);
  });

  it('should include Asp-Arg pair', () => {
    const hasPair = CHARGE_PAIRS.some(
      ([a, b]) => (a === 'D' && b === 'R') || (a === 'R' && b === 'D'),
    );
    expect(hasPair).toBe(true);
  });

  it('should include Glu-Lys pair', () => {
    const hasPair = CHARGE_PAIRS.some(
      ([a, b]) => (a === 'E' && b === 'K') || (a === 'K' && b === 'E'),
    );
    expect(hasPair).toBe(true);
  });

  it('each pair should have exactly 2 elements', () => {
    for (const pair of CHARGE_PAIRS) {
      expect(pair).toHaveLength(2);
    }
  });
});
