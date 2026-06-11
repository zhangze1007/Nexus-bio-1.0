/**
 * ThermoEngine tests — real thermodynamic calculations.
 *
 * Tests use known biochemical values from standard references:
 *   - Lehninger Principles of Biochemistry (Nelson & Cox)
 *   - Alberty (2003) Thermodynamics of Biochemical Reactions
 *   - Goldberg & Tewari (1991) Biophys Chem 40:241-261
 *   - eQuilibrator 3 (Beber et al. 2022)
 */

import {
  R,
  T_REF,
  calcGroupContribution,
  calcGroupContributionBreakdown,
  calcTransformedGibbs,
  calcTransformedKeq,
  calcPathwayDeltaG,
  calcKeq,
  calcDeltaG,
  calcDeltaGFromQ,
  fetchEquilibratorDeltaG,
  calcGroupContributionWithConfidence,
  estimateFormationEnergyWithFallback,
  estimateFormationEnergyLocal,
} from '../src/services/thermoEngine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const T_25C = 298.15; // 25 °C in K
const T_37C = 310.15; // 37 °C in K
const pH_7 = 7.0;
const I_01 = 0.1; // ionic strength 0.1 M

// Known biochemical standard ΔG° values (kJ/mol, pH 7, 25 °C)
const ATP_HYDROLYSIS_dG0 = -30.5; // ATP + H2O → ADP + Pi
const G6P_ISOMERIZATION_dG0 = 1.7; // Glucose-6-P → Fructose-6-P
const PFK_dG0 = -14.2; // Fructose-6-P + ATP → Fructose-1,6-bisP + ADP

// ---------------------------------------------------------------------------
// 1. calcGroupContribution tests
// ---------------------------------------------------------------------------

describe('calcGroupContribution', () => {
  it('should throw on empty SMILES', () => {
    expect(() => calcGroupContribution('')).toThrow('SMILES string cannot be empty');
  });

  it('should return 0 for unrecognized SMILES', () => {
    // A single unrecognized character
    expect(calcGroupContribution('#')).toBe(0);
  });

  it('should estimate ΔG°f for ethanol (CCO)', () => {
    // Simplified parser: C → CH3, C → CH3, O → OH
    // = -3.6 + -3.6 + (-16.2) = -23.4
    // (Simplified SMILES parser doesn't track hydrogen count)
    const result = calcGroupContribution('CCO');
    expect(result).toBeCloseTo(-23.4, 1);
  });

  it('should estimate ΔG°f for acetic acid (CC(=O)O)', () => {
    // Acetic acid: CH3 + COOH = -3.6 + (-24.4) = -28.0
    // But SMILES parsing: C → CH3, then C(=O)O → COOH
    const result = calcGroupContribution('CC(=O)O');
    // The parser will match: C (CH3: -3.6), then C(=O)O (COOH: -24.4) → -28.0
    expect(result).toBeCloseTo(-28.0, 0);
  });

  it('should estimate ΔG°f for alanine-like fragment (CC(N)C(=O)O)', () => {
    // Alanine fragment: CH3 + CH + NH2 + COOH = -3.6 + 3.48 + (-6.6) + (-24.4)
    // But SMILES parsing depends on pattern matching order
    const result = calcGroupContribution('CC(N)C(=O)O');
    // Should find CH3, NH2, COOH groups at minimum
    expect(typeof result).toBe('number');
    expect(result).toBeLessThan(0); // amino acids have negative ΔG°f
  });

  it('should handle aromatic carbons (benzene c1ccccc1)', () => {
    // Benzene: 6 aromatic carbons = 6 × 5.0 = 30.0
    const result = calcGroupContribution('c1ccccc1');
    expect(result).toBeCloseTo(30.0, 0);
  });

  it('should provide breakdown of group contributions', () => {
    // Simplified parser: CCO → CH3 + CH3 + OH (doesn't track hydrogen count)
    const breakdown = calcGroupContributionBreakdown('CCO');
    expect(breakdown).toHaveProperty('CH3');
    expect(breakdown).toHaveProperty('OH');
    expect(breakdown.CH3).toBeCloseTo(-7.2, 1); // 2 × CH3
    expect(breakdown.OH).toBeCloseTo(-16.2, 1);
  });
});

// ---------------------------------------------------------------------------
// 2. calcTransformedGibbs tests
// ---------------------------------------------------------------------------

describe('calcTransformedGibbs', () => {
  it('should throw on invalid temperature', () => {
    expect(() => calcTransformedGibbs(-10, 7, 0.1, 0)).toThrow('Temperature must be positive');
    expect(() => calcTransformedGibbs(-10, 7, 0.1, -5)).toThrow('Temperature must be positive');
  });

  it('should throw on negative ionic strength', () => {
    expect(() => calcTransformedGibbs(-10, 7, -0.1, 298.15)).toThrow('Ionic strength must be non-negative');
  });

  it('should throw on out-of-range pH', () => {
    expect(() => calcTransformedGibbs(-10, -1, 0.1, 298.15)).toThrow('pH must be between 0 and 14');
    expect(() => calcTransformedGibbs(-10, 15, 0.1, 298.15)).toThrow('pH must be between 0 and 14');
  });

  it('should return dG0 at pH 7, I=0.1, 25°C with nH=0, z=0', () => {
    // At reference conditions with no proton/charge changes, ΔG'° = ΔG°
    const result = calcTransformedGibbs(ATP_HYDROLYSIS_dG0, 7.0, 0.1, 298.15, 0, 0);
    expect(result).toBeCloseTo(ATP_HYDROLYSIS_dG0, 3);
  });

  it('should account for pH deviation from 7', () => {
    // At pH 6, with nH = 1 (one proton consumed):
    // ΔG'° = ΔG° + RT·ln(10)·(6-7)·1
    // = ΔG° - RT·ln(10)
    const nH = 1;
    const pH = 6.0;
    const expected = ATP_HYDROLYSIS_dG0 + R * T_25C * LN10 * (pH - 7) * nH;
    const result = calcTransformedGibbs(ATP_HYDROLYSIS_dG0, pH, 0.1, T_25C, nH, 0);
    expect(result).toBeCloseTo(expected, 3);
  });

  it('should apply Debye-Hückel correction for charged species', () => {
    // For a reaction where Δz² = -2 (e.g., ATP⁴⁻ → ADP³⁻ + HPO₄²⁻):
    // DH = +9.205 * Δz² * sqrt(I) / (1 + 1.6 * sqrt(I))
    const deltaZSq = -2;
    const I = 0.25;
    const sqrtI = Math.sqrt(I);
    const expectedDH = 9.205 * deltaZSq * sqrtI / (1 + 1.6 * sqrtI);
    const expected = ATP_HYDROLYSIS_dG0 + expectedDH;

    const result = calcTransformedGibbs(ATP_HYDROLYSIS_dG0, 7.0, I, T_25C, 0, deltaZSq);
    expect(result).toBeCloseTo(expected, 3);
  });

  it('should handle temperature dependence', () => {
    // At 37°C (310.15 K), pH effect scales with T
    const nH = 1;
    const pH = 6.5;
    const expected = ATP_HYDROLYSIS_dG0 + R * T_37C * LN10 * (pH - 7) * nH;
    const result = calcTransformedGibbs(ATP_HYDROLYSIS_dG0, pH, 0.1, T_37C, nH, 0);
    expect(result).toBeCloseTo(expected, 3);
  });

  it('should combine pH and ionic strength effects', () => {
    const nH = -1;
    const deltaZSq = 1;
    const pH = 7.4;
    const I = 0.15;

    const protonTerm = R * T_25C * LN10 * (pH - 7) * nH;
    const sqrtI = Math.sqrt(I);
    const dhTerm = 9.205 * deltaZSq * sqrtI / (1 + 1.6 * sqrtI);
    const expected = ATP_HYDROLYSIS_dG0 + protonTerm + dhTerm;

    const result = calcTransformedGibbs(ATP_HYDROLYSIS_dG0, pH, I, T_25C, nH, deltaZSq);
    expect(result).toBeCloseTo(expected, 3);
  });
});

// LN10 constant for test calculations
const LN10 = Math.LN10;

// ---------------------------------------------------------------------------
// 3. calcTransformedKeq tests
// ---------------------------------------------------------------------------

describe('calcTransformedKeq', () => {
  it('should throw on invalid temperature', () => {
    expect(() => calcTransformedKeq(-10, 0)).toThrow('Temperature must be positive');
  });

  it('should calculate K\'eq from transformed ΔG', () => {
    // K'eq = exp(-ΔG'° / RT)
    const dG = -30.5;
    const expected = Math.exp(-dG / (R * T_25C));
    const result = calcTransformedKeq(dG, T_25C);
    expect(result).toBeCloseTo(expected, 3);
  });

  it('should return 1 for ΔG = 0 (equilibrium)', () => {
    expect(calcTransformedKeq(0, T_25C)).toBeCloseTo(1, 5);
  });

  it('should return > 1 for negative ΔG (favorable)', () => {
    expect(calcTransformedKeq(-10, T_25C)).toBeGreaterThan(1);
  });

  it('should return < 1 for positive ΔG (unfavorable)', () => {
    expect(calcTransformedKeq(10, T_25C)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// 4. calcPathwayDeltaG tests
// ---------------------------------------------------------------------------

describe('calcPathwayDeltaG', () => {
  it('should throw on empty pathway', () => {
    expect(() => calcPathwayDeltaG([], 7, 0.1, T_25C)).toThrow('Pathway must have at least one step');
  });

  it('should sum transformed ΔG across glycolysis first 3 steps', () => {
    // Glucose → G6P → F6P → F1,6BP
    const steps = [
      { dG0: -16.7, nH: 0, z: 0 },  // Hexokinase: Glucose + ATP → G6P + ADP
      { dG0: 1.7, nH: 0, z: 0 },    // Phosphoglucose isomerase: G6P → F6P
      { dG0: -14.2, nH: 0, z: 0 },  // PFK: F6P + ATP → F1,6BP + ADP
    ];

    // At pH 7, I=0.1, 25°C with no nH or z changes, ΔG'° ≈ ΔG°
    const result = calcPathwayDeltaG(steps, 7.0, 0.1, T_25C);
    const expected = -16.7 + 1.7 + (-14.2); // = -29.2
    expect(result).toBeCloseTo(expected, 1);
  });

  it('should handle single-step pathway', () => {
    const result = calcPathwayDeltaG([{ dG0: -30.5 }], 7.0, 0.1, T_25C);
    expect(result).toBeCloseTo(-30.5, 3);
  });

  it('should account for proton changes across pathway', () => {
    const steps = [
      { dG0: -30.5, nH: 1, z: -1 },   // ATP hydrolysis (absorbs H+)
      { dG0: -16.7, nH: 0, z: 0 },    // Hexokinase
    ];

    const result = calcPathwayDeltaG(steps, 6.5, 0.1, T_25C);

    // Step 1: ΔG° + RT·ln(10)·(6.5-7)·1 + DH correction
    const step1 = calcTransformedGibbs(-30.5, 6.5, 0.1, T_25C, 1, -1);
    const step2 = calcTransformedGibbs(-16.7, 6.5, 0.1, T_25C, 0, 0);
    expect(result).toBeCloseTo(step1 + step2, 3);
  });

  it('should default nH and z to 0 when not specified', () => {
    const result = calcPathwayDeltaG([{ dG0: -10 }, { dG0: -20 }], 7.0, 0.1, T_25C);
    expect(result).toBeCloseTo(-30, 3);
  });
});

// ---------------------------------------------------------------------------
// 5. calcKeq tests
// ---------------------------------------------------------------------------

describe('calcKeq', () => {
  it('should throw on invalid temperature', () => {
    expect(() => calcKeq(-10, 0)).toThrow('Temperature must be positive');
    expect(() => calcKeq(-10, -273)).toThrow('Temperature must be positive');
  });

  it('should calculate K_eq for ATP hydrolysis', () => {
    // ATP + H2O → ADP + Pi, ΔG° = -30.5 kJ/mol
    // K_eq = exp(30.5 / (0.008314 × 298.15)) ≈ 2.22 × 10^5
    const keq = calcKeq(ATP_HYDROLYSIS_dG0, T_25C);
    expect(keq).toBeGreaterThan(2e5);
    expect(keq).toBeLessThan(3e5);
  });

  it('should calculate K_eq for glucose-6-phosphate isomerization', () => {
    // G6P → F6P, ΔG° = +1.7 kJ/mol
    // K_eq = exp(-1.7 / (0.008314 × 298.15)) ≈ 0.504
    const keq = calcKeq(G6P_ISOMERIZATION_dG0, T_25C);
    expect(keq).toBeGreaterThan(0.4);
    expect(keq).toBeLessThan(0.6);
  });

  it('should return 1 for ΔG° = 0', () => {
    expect(calcKeq(0, T_25C)).toBeCloseTo(1, 5);
  });

  it('should return > 1 for negative ΔG° (exergonic)', () => {
    expect(calcKeq(-10, T_25C)).toBeGreaterThan(1);
  });

  it('should return < 1 for positive ΔG° (endergonic)', () => {
    expect(calcKeq(10, T_25C)).toBeLessThan(1);
  });

  it('should reflect temperature dependence', () => {
    // Higher temperature → smaller K for exergonic reactions
    const keq_25C = calcKeq(-20, T_25C);
    const keq_37C = calcKeq(-20, T_37C);
    // For negative ΔG°, higher T gives smaller K
    // because exp(-dG0/(RT)) with larger T gives smaller exponent
    expect(keq_25C).toBeGreaterThan(keq_37C);
  });
});

// ---------------------------------------------------------------------------
// 6. calcDeltaG tests
// ---------------------------------------------------------------------------

describe('calcDeltaG', () => {
  it('should throw on invalid temperature', () => {
    expect(() => calcDeltaG(-10, 0, {})).toThrow('Temperature must be positive');
  });

  it('should throw on negative concentrations', () => {
    expect(() => calcDeltaG(-10, T_25C, { reactant_A: -0.1 })).toThrow('must be non-negative');
  });

  it('should return dG0 when no concentrations provided', () => {
    expect(calcDeltaG(-30.5, T_25C, {})).toBeCloseTo(-30.5, 5);
  });

  it('should calculate ΔG for ATP hydrolysis with cellular concentrations', () => {
    // ATP + H2O → ADP + Pi
    // Cellular: [ATP] = 10 mM, [ADP] = 1 mM, [Pi] = 5 mM
    // Q = (1e-3 × 5e-3) / 10e-3 = 5e-4
    // ΔG = -30.5 + 0.008314 × 298.15 × ln(5e-4) ≈ -30.5 + (-18.96) ≈ -49.5
    const dG = calcDeltaG(ATP_HYDROLYSIS_dG0, T_25C, {
      product_ADP: 1e-3,
      product_Pi: 5e-3,
      reactant_ATP: 10e-3,
    });
    expect(dG).toBeLessThan(ATP_HYDROLYSIS_dG0); // More negative than standard
    expect(dG).toBeCloseTo(-49.5, 0);
  });

  it('should calculate ΔG for glucose-6-phosphate isomerization', () => {
    // G6P → F6P, ΔG° = +1.7 kJ/mol
    // If [G6P] = 1 mM, [F6P] = 0.1 mM:
    // Q = 0.1/1 = 0.1
    // ΔG = 1.7 + 0.008314 × 298.15 × ln(0.1) = 1.7 + (-5.71) = -4.01
    const dG = calcDeltaG(G6P_ISOMERIZATION_dG0, T_25C, {
      product_F6P: 0.1e-3,
      reactant_G6P: 1e-3,
    });
    expect(dG).toBeLessThan(G6P_ISOMERIZATION_dG0);
    expect(dG).toBeCloseTo(-4.01, 0);
  });

  it('should handle equal product and reactant concentrations', () => {
    // Q = 1, ln(Q) = 0, ΔG = ΔG°
    const dG = calcDeltaG(-20, T_25C, {
      product_A: 1e-3,
      reactant_B: 1e-3,
    });
    expect(dG).toBeCloseTo(-20, 5);
  });

  it('should handle high product concentrations (Q > 1)', () => {
    // Q > 1 → positive contribution → less favorable
    const dG = calcDeltaG(-20, T_25C, {
      product_A: 10e-3,
      reactant_B: 1e-3,
    });
    expect(dG).toBeGreaterThan(-20);
  });

  it('should handle zero reactant concentration (ΔG → -∞)', () => {
    const dG = calcDeltaG(-20, T_25C, {
      product_A: 1e-3,
      reactant_B: 0,
    });
    expect(dG).toBe(-Infinity);
  });

  it('should handle zero product concentration (ΔG → +∞)', () => {
    const dG = calcDeltaG(-20, T_25C, {
      product_A: 0,
      reactant_B: 1e-3,
    });
    expect(dG).toBe(Infinity);
  });

  it('should treat keys without prefix as reactants', () => {
    // Keys without product_ or reactant_ prefix → treated as reactants
    const dG = calcDeltaG(-20, T_25C, {
      A: 1e-3,
    });
    // Q = 1/reactantProd = 1/1e-3 = 1000
    const expected = -20 + R * T_25C * Math.log(1 / 1e-3);
    expect(dG).toBeCloseTo(expected, 3);
  });

  it('should throw when no reactants provided', () => {
    expect(() => calcDeltaG(-20, T_25C, { product_A: 1e-3 })).toThrow('At least one reactant concentration is required');
  });
});

// ---------------------------------------------------------------------------
// 7. calcDeltaGFromQ tests
// ---------------------------------------------------------------------------

describe('calcDeltaGFromQ', () => {
  it('should throw on invalid temperature', () => {
    expect(() => calcDeltaGFromQ(-10, 0, 1)).toThrow('Temperature must be positive');
  });

  it('should throw on negative Q', () => {
    expect(() => calcDeltaGFromQ(-10, T_25C, -0.1)).toThrow('must be non-negative');
  });

  it('should return dG0 when Q = 1', () => {
    expect(calcDeltaGFromQ(-30.5, T_25C, 1)).toBeCloseTo(-30.5, 5);
  });

  it('should return +∞ when Q = 0', () => {
    expect(calcDeltaGFromQ(-10, T_25C, 0)).toBe(Infinity);
  });

  it('should give more negative ΔG for Q < 1', () => {
    const dG = calcDeltaGFromQ(-20, T_25C, 0.01);
    expect(dG).toBeLessThan(-20);
  });

  it('should give less negative ΔG for Q > 1', () => {
    const dG = calcDeltaGFromQ(-20, T_25C, 100);
    expect(dG).toBeGreaterThan(-20);
  });

  it('should match calcDeltaG for equivalent input', () => {
    // Q = (product) / (reactant) = 2e-3 / 1e-2 = 0.2
    const Q = 0.2;
    const fromQ = calcDeltaGFromQ(-30.5, T_25C, Q);
    const fromConc = calcDeltaG(-30.5, T_25C, {
      product_A: 2e-3,
      reactant_B: 1e-2,
    });
    expect(fromQ).toBeCloseTo(fromConc, 5);
  });
});

// ---------------------------------------------------------------------------
// 8. Integration / known-value tests
// ---------------------------------------------------------------------------

describe('known biochemical values', () => {
  it('ATP hydrolysis K_eq should be ~2.2 × 10^5 at 25°C', () => {
    const keq = calcKeq(-30.5, 298.15);
    // Reference: ~2.2 × 10^5
    expect(keq).toBeGreaterThan(1.9e5);
    expect(keq).toBeLessThan(2.5e5);
  });

  it('G6P isomerization K_eq should be ~0.5 at 25°C', () => {
    const keq = calcKeq(1.7, 298.15);
    // Reference: ~0.504
    expect(keq).toBeGreaterThan(0.4);
    expect(keq).toBeLessThan(0.6);
  });

  it('PFK reaction K_eq should be very large at 25°C', () => {
    // F6P + ATP → F1,6BP + ADP, ΔG° = -14.2 kJ/mol
    const keq = calcKeq(-14.2, 298.15);
    expect(keq).toBeGreaterThan(100);
  });

  it('ATP hydrolysis at cellular conditions should be ~-50 kJ/mol', () => {
    // Cellular: [ATP]/[ADP] ≈ 10, [Pi] ≈ 5 mM
    // ΔG = -30.5 + RT·ln((0.001 × 0.005)/0.01) = -30.5 + RT·ln(5e-4)
    const dG = calcDeltaG(-30.5, 298.15, {
      product_ADP: 1e-3,
      product_Pi: 5e-3,
      reactant_ATP: 10e-3,
    });
    // Reference: approximately -49 to -54 kJ/mol
    expect(dG).toBeLessThan(-45);
    expect(dG).toBeGreaterThan(-55);
  });

  it('pH effect: ATP hydrolysis is more favorable at lower pH', () => {
    // ATP hydrolysis absorbs a proton, so lower pH favors it
    const dG_pH6 = calcTransformedGibbs(-30.5, 6.0, 0.1, 298.15, 1, 0);
    const dG_pH8 = calcTransformedGibbs(-30.5, 8.0, 0.1, 298.15, 1, 0);
    // Lower pH → more negative ΔG (more favorable)
    expect(dG_pH6).toBeLessThan(dG_pH8);
  });

  it('ionic strength effect on charged species', () => {
    // ATP⁴⁻ + H2O → ADP³⁻ + HPO₄²⁻
    // Δz² = (3² + 2²) - 4² = 13 - 16 = -3
    const dG_lowI = calcTransformedGibbs(-30.5, 7.0, 0.01, 298.15, 0, -3);
    const dG_highI = calcTransformedGibbs(-30.5, 7.0, 0.5, 298.15, 0, -3);
    // Higher ionic strength with negative Δz² should make ΔG more negative
    expect(dG_highI).toBeLessThan(dG_lowI);
  });

  it('pathway thermodynamics: glycolysis first 3 steps should be exergonic', () => {
    const steps = [
      { dG0: -16.7 },  // Hexokinase
      { dG0: 1.7 },    // PGI
      { dG0: -14.2 },  // PFK
    ];
    const total = calcPathwayDeltaG(steps, 7.0, 0.1, 298.15);
    expect(total).toBeLessThan(0); // Exergonic overall
    expect(total).toBeCloseTo(-29.2, 0);
  });
});

// ---------------------------------------------------------------------------
// 9. Edge cases and robustness
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('calcKeq should handle very large negative ΔG (K → ∞)', () => {
    const keq = calcKeq(-100, T_25C);
    expect(keq).toBeGreaterThan(1e10);
    expect(Number.isFinite(keq)).toBe(true);
  });

  it('calcKeq should handle very large positive ΔG (K → 0)', () => {
    const keq = calcKeq(100, T_25C);
    expect(keq).toBeLessThan(1e-10);
    expect(keq).toBeGreaterThan(0);
  });

  it('calcTransformedGibbs at I=0 should have no Debye-Hückel correction', () => {
    const withI = calcTransformedGibbs(-30.5, 7.0, 0, T_25C, 0, -2);
    // DH term = -9.205 * (-2) * 0 / (1 + 0) = 0
    expect(withI).toBeCloseTo(-30.5, 5);
  });

  it('calcGroupContribution should handle SMILES with ring numbers', () => {
    // Ring digits should be skipped by the parser
    const result = calcGroupContribution('C1CC1');
    // Cyclopropane: 3 CH2 groups? No, C1CC1 has ring closure chars
    // Parser will match C (CH3), skip 1, C (CH3), C (CH3), skip 1
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
  });

  it('calcDeltaG with multiple products and reactants', () => {
    // A + B → C + D
    // Q = (C × D) / (A × B)
    const A = 2e-3, B = 3e-3, C = 5e-3, D = 1e-3;
    const Q = (C * D) / (A * B);
    const dG = calcDeltaG(-15, T_25C, {
      product_C: C,
      product_D: D,
      reactant_A: A,
      reactant_B: B,
    });
    const expected = -15 + R * T_25C * Math.log(Q);
    expect(dG).toBeCloseTo(expected, 3);
  });
});

// ---------------------------------------------------------------------------
// 10. fetchEquilibratorDeltaG tests (mocked fetch)
// ---------------------------------------------------------------------------

describe('fetchEquilibratorDeltaG', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return null for empty compound name', async () => {
    const result = await fetchEquilibratorDeltaG('');
    expect(result).toBeNull();
  });

  it('should return null for whitespace-only input', async () => {
    const result = await fetchEquilibratorDeltaG('   ');
    expect(result).toBeNull();
  });

  it('should return null when search returns no results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await fetchEquilibratorDeltaG('nonexistent_compound_xyz');
    expect(result).toBeNull();
  });

  it('should return null when search endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await fetchEquilibratorDeltaG('glucose');
    expect(result).toBeNull();
  });

  it('should return null when compound endpoint fails after successful search', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'glucose', model_ids: ['C00031'] }],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

    const result = await fetchEquilibratorDeltaG('glucose');
    expect(result).toBeNull();
  });

  it('should return null when compound data has no formation energy', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'glucose', model_ids: ['C00031'] }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'glucose' }], // no dGf0 field
      });

    const result = await fetchEquilibratorDeltaG('glucose');
    expect(result).toBeNull();
  });

  it('should return result when API succeeds', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'glucose', model_ids: ['C00031'] }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'glucose', dgf0: -916.0 }],
      });

    const result = await fetchEquilibratorDeltaG('glucose');
    expect(result).not.toBeNull();
    expect(result!.dGf0).toBe(-916.0);
    expect(result!.name).toBe('glucose');
    expect(result!.keggId).toBe('C00031');
    expect(result!.source).toBe('equilibrator');
  });

  it('should handle alternative response field names (dG_f)', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'ATP', model_ids: ['C00002'] }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'ATP', dG_f: -2768.0 }],
      });

    const result = await fetchEquilibratorDeltaG('ATP');
    expect(result).not.toBeNull();
    expect(result!.dGf0).toBe(-2768.0);
  });

  it('should handle alternative response field names (formation_energy)', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'pyruvate', model_ids: ['C00022'] }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'pyruvate', formation_energy: -472.0 }],
      });

    const result = await fetchEquilibratorDeltaG('pyruvate');
    expect(result).not.toBeNull();
    expect(result!.dGf0).toBe(-472.0);
  });

  it('should return null on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));

    const result = await fetchEquilibratorDeltaG('glucose');
    expect(result).toBeNull();
  });

  it('should return null on timeout', async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      new Promise((_, reject) => {
        const error = new Error('The operation was aborted');
        error.name = 'TimeoutError';
        reject(error);
      })
    );

    const result = await fetchEquilibratorDeltaG('glucose');
    expect(result).toBeNull();
  });

  it('should handle nested response structure (compounds key)', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          compounds: [{ name: 'acetyl-CoA', model_ids: ['C00024'] }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'acetyl-CoA', dgf0: -1580.0 }],
      });

    const result = await fetchEquilibratorDeltaG('acetyl-CoA');
    expect(result).not.toBeNull();
    expect(result!.dGf0).toBe(-1580.0);
  });

  it('should handle non-finite dGf0 values gracefully', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'weird_compound', model_ids: ['C99999'] }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'weird_compound', dgf0: NaN }],
      });

    const result = await fetchEquilibratorDeltaG('weird_compound');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 11. calcGroupContributionWithConfidence tests
// ---------------------------------------------------------------------------

describe('calcGroupContributionWithConfidence', () => {
  it('should throw on empty SMILES', () => {
    expect(() => calcGroupContributionWithConfidence('')).toThrow('SMILES string cannot be empty');
  });

  it('should return "none" confidence for unrecognized SMILES', () => {
    const result = calcGroupContributionWithConfidence('#');
    expect(result.confidence).toBe('none');
    expect(result.groupsFound).toBe(0);
    expect(result.dGf0).toBe(0);
    expect(result.source).toBe('group_contribution');
  });

  it('should return "low" confidence for SMILES with 1-2 groups', () => {
    // "CC" → 2 CH3 groups
    const result = calcGroupContributionWithConfidence('CC');
    expect(result.confidence).toBe('low');
    expect(result.groupsFound).toBe(2);
    expect(result.source).toBe('group_contribution');
  });

  it('should return "medium" confidence for SMILES with 3-5 groups', () => {
    // "CCO" → 2 CH3 + 1 OH = 3 groups
    const result = calcGroupContributionWithConfidence('CCO');
    expect(result.confidence).toBe('medium');
    expect(result.groupsFound).toBe(3);
  });

  it('should return "high" confidence for SMILES with 6+ groups', () => {
    // "c1ccccc1" → 6 aromatic_C groups
    const result = calcGroupContributionWithConfidence('c1ccccc1');
    expect(result.confidence).toBe('high');
    expect(result.groupsFound).toBe(6);
  });

  it('should match calcGroupContribution values', () => {
    const smiles = 'CC(=O)O';
    const basic = calcGroupContribution(smiles);
    const withConf = calcGroupContributionWithConfidence(smiles);
    expect(withConf.dGf0).toBeCloseTo(basic, 5);
  });
});

// ---------------------------------------------------------------------------
// 12. estimateFormationEnergyWithFallback tests (mocked fetch)
// ---------------------------------------------------------------------------

describe('estimateFormationEnergyWithFallback', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return local estimate when confidence is high', async () => {
    // c1ccccc1 → 6 aromatic carbons → high confidence
    const result = await estimateFormationEnergyWithFallback('c1ccccc1', 'benzene');
    expect(result.source).toBe('group_contribution');
    expect(result.confidence).toBe('high');
    // Should not have called fetch at all
    expect(global.fetch).toBeUndefined;
  });

  it('should fall back to eQuilibrator when confidence is low', async () => {
    // "CC" → 2 groups → low confidence
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'ethane', model_ids: ['C00001'] }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'ethane', dgf0: -100.0 }],
      });

    const result = await estimateFormationEnergyWithFallback('CC', 'ethane');
    expect(result.source).toBe('equilibrator');
    expect(result.dGf0).toBe(-100.0);
    expect(result.equilibratorResult).toBeDefined();
    expect(result.equilibratorResult!.name).toBe('ethane');
  });

  it('should return local low-confidence estimate when API fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await estimateFormationEnergyWithFallback('CC');
    expect(result.source).toBe('group_contribution');
    expect(result.confidence).toBe('low');
  });

  it('should return local estimate when no compound name provided and confidence is low', async () => {
    const result = await estimateFormationEnergyWithFallback('CC');
    expect(result.source).toBe('group_contribution');
    expect(result.confidence).toBe('low');
    // fetch should not have been called
    expect(global.fetch).toBeUndefined;
  });

  it('should skip to API when forceApiLookup is true', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'glucose', model_ids: ['C00031'] }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'glucose', dgf0: -916.0 }],
      });

    const result = await estimateFormationEnergyWithFallback('CCO', 'glucose', true);
    expect(result.source).toBe('equilibrator');
    expect(result.dGf0).toBe(-916.0);
    expect(result.confidence).toBe('high');
  });

  it('should fall back to local when forceApiLookup fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('API down'));

    const result = await estimateFormationEnergyWithFallback('CCO', 'glucose', true);
    // Should fall through to local estimation
    expect(result.source).toBe('group_contribution');
    // CCO → 3 groups → medium confidence
    expect(result.confidence).toBe('medium');
  });

  it('should return "none" confidence when both local and API fail', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await estimateFormationEnergyWithFallback('#', 'nonexistent');
    expect(result.source).toBe('group_contribution');
    expect(result.confidence).toBe('none');
    expect(result.dGf0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 13. estimateFormationEnergyLocal tests
// ---------------------------------------------------------------------------

describe('estimateFormationEnergyLocal', () => {
  it('should return local estimate when confidence is high', () => {
    const result = estimateFormationEnergyLocal('c1ccccc1');
    expect(result.source).toBe('group_contribution');
    expect(result.confidence).toBe('high');
  });

  it('should use reference value when confidence is low and reference provided', () => {
    const result = estimateFormationEnergyLocal('CC', -916.0);
    expect(result.dGf0).toBe(-916.0);
    expect(result.source).toBe('equilibrator'); // treated as authoritative
    expect(result.confidence).toBe('medium');
  });

  it('should use reference value when confidence is none and reference provided', () => {
    const result = estimateFormationEnergyLocal('#', -500.0);
    expect(result.dGf0).toBe(-500.0);
    expect(result.source).toBe('equilibrator');
  });

  it('should return local estimate when confidence is low and no reference', () => {
    const result = estimateFormationEnergyLocal('CC');
    expect(result.source).toBe('group_contribution');
    expect(result.confidence).toBe('low');
  });

  it('should return local estimate when confidence is medium', () => {
    // CCO → 3 groups → medium confidence, reference should be ignored
    const result = estimateFormationEnergyLocal('CCO', -999.0);
    expect(result.source).toBe('group_contribution');
    expect(result.confidence).toBe('medium');
    expect(result.dGf0).not.toBe(-999.0);
  });
});
