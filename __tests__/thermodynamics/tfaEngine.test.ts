/**
 * Tests for the TFA (Thermodynamic Flux Analysis) engine.
 *
 * Validates that the TFA engine correctly:
 *   1. Computes transformed Gibbs energies under physiological conditions
 *   2. Determines feasible flux directions (forward / reverse / reversible)
 *   3. Identifies bottleneck reactions with large |ΔG|
 *   4. Rejects thermodynamically infeasible pathways
 *
 * @scientific_provenance
 * Henry, C.S., Broadbelt, L.J., Hatzimanikatis, V. (2007)
 * Thermodynamics-based metabolic flux analysis. Metab Eng 9:312-320
 */

import { runTFA, TFAModel } from '../../src/server/tfaEngine';

describe('TFA', () => {
  // ------------------------------------------------------------------
  // 1. Basic glycolysis fragment — thermodynamically feasible
  // ------------------------------------------------------------------

  it('verifies thermodynamic consistency of glycolysis', () => {
    const model: TFAModel = {
      reactions: [
        { id: 'HEX1', deltaG0Prime: -27.2, stoichiometry: { glc: -1, g6p: 1 } },
        { id: 'PGI',  deltaG0Prime: 1.7,   stoichiometry: { g6p: -1, f6p: 1 } },
        { id: 'PFK',  deltaG0Prime: -14.2, stoichiometry: { f6p: -1, fbp: 1 } },
      ],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    expect(result.feasible).toBe(true);
    expect(result.reactionResults.length).toBe(3);
  });

  // ------------------------------------------------------------------
  // 2. Infeasible pathway — positive ΔG forces reverse direction
  // ------------------------------------------------------------------

  it('detects thermodynamically infeasible pathway', () => {
    const model: TFAModel = {
      reactions: [
        { id: 'FORWARD', deltaG0Prime: 100, stoichiometry: { a: -1, b: 1 } },
      ],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    expect(result.reactionResults[0].feasibleDirection).toBe('reverse');
  });

  // ------------------------------------------------------------------
  // 3. Bottleneck identification
  // ------------------------------------------------------------------

  it('identifies bottleneck reactions', () => {
    const model: TFAModel = {
      reactions: [
        { id: 'EASY', deltaG0Prime: -5,  stoichiometry: { a: -1, b: 1 } },
        { id: 'HARD', deltaG0Prime: -50, stoichiometry: { b: -1, c: 1 } },
      ],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    expect(result.bottleneckReactions).toContain('HARD');
  });

  // ------------------------------------------------------------------
  // 4. Near-equilibrium reactions are classified as reversible
  // ------------------------------------------------------------------

  it('classifies near-equilibrium reactions as reversible', () => {
    const model: TFAModel = {
      reactions: [
        { id: 'EQUIL', deltaG0Prime: 0.5, stoichiometry: { a: -1, b: 1 } },
      ],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    expect(result.reactionResults[0].feasibleDirection).toBe('reversible');
  });

  // ------------------------------------------------------------------
  // 5. pH shift changes feasible direction
  // ------------------------------------------------------------------

  it('accounts for pH-dependent direction changes', () => {
    // At pH 7, this is near-zero and reversible
    // At pH 6, the proton term shifts ΔG′ significantly
    const model: TFAModel = {
      reactions: [
        {
          id: 'PROTON_SENSITIVE',
          deltaG0Prime: 0,
          stoichiometry: { a: -1, b: 1 },
          nH: 2,  // absorbs 2 protons
          deltaZSquared: 0,
        },
      ],
      conditions: { pH: 6.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    // At pH 6 with nH=2: ΔG′ = 0 + RT·ln(10)·(6-7)·2 ≈ -11.4 kJ/mol → forward
    expect(result.reactionResults[0].feasibleDirection).toBe('forward');
    expect(result.reactionResults[0].transformedDeltaG).toBeLessThan(0);
  });

  // ------------------------------------------------------------------
  // 6. Empty model
  // ------------------------------------------------------------------

  it('handles empty model', () => {
    const model: TFAModel = {
      reactions: [],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    expect(result.feasible).toBe(true);
    expect(result.reactionResults).toEqual([]);
    expect(result.bottleneckReactions).toEqual([]);
  });

  // ------------------------------------------------------------------
  // 7. Bottleneck threshold respects custom value
  // ------------------------------------------------------------------

  it('respects custom bottleneck threshold', () => {
    const model: TFAModel = {
      reactions: [
        { id: 'MODERATE', deltaG0Prime: -15, stoichiometry: { a: -1, b: 1 } },
      ],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    // With threshold 10, this should be a bottleneck
    const result = runTFA(model, { bottleneckThreshold: 10 });
    expect(result.bottleneckReactions).toContain('MODERATE');
    // With threshold 20, it should not
    const result2 = runTFA(model, { bottleneckThreshold: 20 });
    expect(result2.bottleneckReactions).not.toContain('MODERATE');
  });

  // ------------------------------------------------------------------
  // 8. Ionic strength affects Debye-Hückel correction
  // ------------------------------------------------------------------

  it('applies Debye-Hückel correction for charged species', () => {
    const model: TFAModel = {
      reactions: [
        {
          id: 'CHARGED',
          deltaG0Prime: -2,
          stoichiometry: { a_neg2: -1, b_0: 1 },
          deltaZSquared: 4, // large charge change
        },
      ],
      conditions: { pH: 7.0, ionicStrength: 0.25, temperature: 298.15 },
    };
    const result = runTFA(model);
    // The Debye-Hückel term should push ΔG′ positive (destabilizing charged reactant)
    const charged = result.reactionResults[0];
    expect(charged.transformedDeltaG).toBeGreaterThan(charged.deltaG0Prime);
  });

  // ------------------------------------------------------------------
  // 9. All forward-reaction pathway is feasible
  // ------------------------------------------------------------------

  it('reports feasible when all reactions proceed forward', () => {
    const model: TFAModel = {
      reactions: [
        { id: 'R1', deltaG0Prime: -10, stoichiometry: { a: -1, b: 1 } },
        { id: 'R2', deltaG0Prime: -20, stoichiometry: { b: -1, c: 1 } },
        { id: 'R3', deltaG0Prime: -15, stoichiometry: { c: -1, d: 1 } },
      ],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    expect(result.feasible).toBe(true);
    for (const r of result.reactionResults) {
      expect(r.isFeasible).toBe(true);
    }
  });

  // ------------------------------------------------------------------
  // 10. Cumulative ΔG is reported
  // ------------------------------------------------------------------

  it('computes cumulative ΔG across the pathway', () => {
    const model: TFAModel = {
      reactions: [
        { id: 'R1', deltaG0Prime: -10, stoichiometry: { a: -1, b: 1 } },
        { id: 'R2', deltaG0Prime: -20, stoichiometry: { b: -1, c: 1 } },
      ],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    // cumulativeDeltaG should be the sum of transformed ΔG values
    const totalFromResults = result.reactionResults.reduce(
      (s, r) => s + r.transformedDeltaG,
      0,
    );
    expect(result.cumulativeDeltaG).toBeCloseTo(totalFromResults, 6);
  });
});
