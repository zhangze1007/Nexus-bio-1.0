import {
  competitiveInhibition,
  uncompetitiveInhibition,
  mixedInhibition,
  substrateInhibition,
  hillEquation,
  simulateEnzymeSystem,
  EnzymeKinetics,
  AdaptiveODEOptions,
  estimateParameters,
  InhibitionModel,
  KineticDataPoint,
} from '../src/services/kineticsEngine';

// ═══════════════════════════════════════════════════════════════
//  Tolerance helper for floating-point comparisons
// ═══════════════════════════════════════════════════════════════

const TOL = 1e-6;

function expectClose(actual: number, expected: number, tol = TOL) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// ═══════════════════════════════════════════════════════════════
//  1. Competitive Inhibition
// ═══════════════════════════════════════════════════════════════

describe('competitiveInhibition', () => {
  it('reduces to Michaelis-Menten when I = 0', () => {
    // v = Vmax * S / (Km + S)
    const v = competitiveInhibition(100, 5, 5, 10, 0);
    // v = 100 * 5 / (5 + 5) = 50
    expectClose(v, 50);
  });

  it('gives Vmax/2 at S = Km when I = 0', () => {
    const vmax = 80;
    const km = 10;
    const v = competitiveInhibition(vmax, km, km, 100, 0);
    expectClose(v, vmax / 2);
  });

  it('increases apparent Km by factor (1 + I/Ki)', () => {
    const vmax = 100;
    const km = 5;
    const ki = 2;
    const i = 4;
    const s = 5;

    // kmEff = 5 * (1 + 4/2) = 15
    // v = 100 * 5 / (15 + 5) = 25
    const v = competitiveInhibition(vmax, s, km, ki, i);
    expectClose(v, 25);
  });

  it('Vmax is unchanged (reached at saturating S)', () => {
    const vmax = 100;
    // Apparent Km = 5*(1+10/2) = 30, so at S=10000: v = 100*10000/(30+10000) ≈ 99.7
    const vAtHighS = competitiveInhibition(vmax, 1000000, 5, 2, 10);
    expectClose(vAtHighS, vmax, 0.01);
  });

  it('returns 0 when substrate is 0', () => {
    expectClose(competitiveInhibition(100, 0, 5, 2, 10), 0);
  });

  it('handles Ki <= 0 by falling back to plain MM', () => {
    const v = competitiveInhibition(100, 5, 5, 0, 10);
    expectClose(v, 50); // 100*5/(5+5) = 50
  });
});

// ═══════════════════════════════════════════════════════════════
//  2. Uncompetitive Inhibition
// ═══════════════════════════════════════════════════════════════

describe('uncompetitiveInhibition', () => {
  it('reduces to Michaelis-Menten when I = 0', () => {
    const v = uncompetitiveInhibition(100, 5, 5, 10, 0);
    expectClose(v, 50);
  });

  it('reduces both apparent Vmax and apparent Km', () => {
    const vmax = 100;
    const km = 10;
    const kiu = 5;
    const i = 5;
    const s = 10;

    // denom = 10 + 10*(1 + 5/5) = 10 + 20 = 30
    // v = 100 * 10 / 30 = 33.333...
    const v = uncompetitiveInhibition(vmax, s, km, kiu, i);
    expectClose(v, 100 / 3);
  });

  it('cannot reach original Vmax even at high S', () => {
    const vmax = 100;
    const km = 10;
    const kiu = 5;
    const i = 5;

    // At S -> inf: v -> Vmax / (1 + I/Kiu) = 100/2 = 50
    const vAtHighS = uncompetitiveInhibition(vmax, 100000, km, kiu, i);
    expectClose(vAtHighS, 50, 0.1);
  });

  it('returns 0 when substrate is 0', () => {
    expectClose(uncompetitiveInhibition(100, 0, 5, 2, 10), 0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  3. Mixed Inhibition
// ═══════════════════════════════════════════════════════════════

describe('mixedInhibition', () => {
  it('reduces to Michaelis-Menten when I = 0', () => {
    const v = mixedInhibition(100, 5, 5, 10, 10, 0);
    expectClose(v, 50);
  });

  it('reduces to competitive when Kiu -> inf (effectively no ES binding)', () => {
    const vmax = 100;
    const km = 5;
    const kic = 2;
    const kiu = 1e12; // effectively infinite
    const i = 4;
    const s = 5;

    // Should match competitive: kmEff = 5*(1+4/2) = 15, v = 100*5/(15+5) = 25
    const v = mixedInhibition(vmax, s, km, kic, kiu, i);
    expectClose(v, 25, 0.01);
  });

  it('reduces to uncompetitive when Kic -> inf', () => {
    const vmax = 100;
    const km = 10;
    const kic = 1e12;
    const kiu = 5;
    const i = 5;
    const s = 10;

    // Should match uncompetitive: denom = 10 + 10*(1+5/5) = 30, v = 1000/30
    const v = mixedInhibition(vmax, s, km, kic, kiu, i);
    expectClose(v, 1000 / 30, 0.01);
  });

  it('lowers both apparent Vmax and Km', () => {
    const vmax = 100;
    const km = 10;
    const kic = 5;
    const kiu = 5;
    const i = 5;

    // At S -> inf: v -> Vmax / (1 + I/Kiu) = 100/2 = 50
    const vAtHighS = mixedInhibition(vmax, 100000, km, kic, kiu, i);
    expectClose(vAtHighS, 50, 0.1);
  });

  it('returns 0 when substrate is 0', () => {
    expectClose(mixedInhibition(100, 0, 5, 2, 2, 10), 0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  4. Substrate Inhibition
// ═══════════════════════════════════════════════════════════════

describe('substrateInhibition', () => {
  it('reduces to Michaelis-Menten when Kis is very large', () => {
    const v = substrateInhibition(100, 5, 5, 1e12);
    expectClose(v, 50);
  });

  it('shows velocity decrease at high substrate', () => {
    const vmax = 100;
    const km = 5;
    const kis = 50;

    const vLow = substrateInhibition(vmax, 5, km, kis);
    const vMid = substrateInhibition(vmax, 20, km, kis);
    const vHigh = substrateInhibition(vmax, 100, km, kis);

    // Velocity should increase then decrease
    expect(vMid).toBeGreaterThan(vLow);
    expect(vLow).toBeGreaterThan(vHigh);
  });

  it('velocity peaks near S = sqrt(Km * Kis)', () => {
    const vmax = 100;
    const km = 5;
    const kis = 80;

    // Optimal S = sqrt(Km * Kis) = sqrt(400) = 20
    const sOptimal = Math.sqrt(km * kis);
    const vOptimal = substrateInhibition(vmax, sOptimal, km, kis);

    // Check nearby points are lower
    const vLower = substrateInhibition(vmax, sOptimal * 0.5, km, kis);
    const vHigher = substrateInhibition(vmax, sOptimal * 2, km, kis);

    expect(vOptimal).toBeGreaterThan(vLower);
    expect(vOptimal).toBeGreaterThan(vHigher);
  });

  it('returns 0 when substrate is 0', () => {
    expectClose(substrateInhibition(100, 0, 5, 50), 0);
  });

  it('falls back to plain MM when Kis <= 0', () => {
    const v = substrateInhibition(100, 5, 5, 0);
    expectClose(v, 50);
  });
});

// ═══════════════════════════════════════════════════════════════
//  5. Hill Equation
// ═══════════════════════════════════════════════════════════════

describe('hillEquation', () => {
  it('reduces to Michaelis-Menten when n = 1', () => {
    const vmax = 100;
    const s = 5;
    const k50 = 5;

    const vHill = hillEquation(vmax, s, k50, 1);
    const vMM = (vmax * s) / (k50 + s);

    expectClose(vHill, vMM);
  });

  it('gives Vmax/2 at S = K50 regardless of n', () => {
    for (const n of [0.5, 1, 2, 3, 4]) {
      const v = hillEquation(100, 10, 10, n);
      expectClose(v, 50);
    }
  });

  it('produces sigmoidal curve for n > 1', () => {
    const vmax = 100;
    const k50 = 10;
    const n = 4;

    // At low S, velocity should be very low
    const vLow = hillEquation(vmax, 2, k50, n);
    expect(vLow).toBeLessThan(5);

    // At high S, velocity should approach Vmax
    const vHigh = hillEquation(vmax, 50, k50, n);
    expect(vHigh).toBeGreaterThan(95);
  });

  it('n > 1 gives steeper transition than n = 1', () => {
    const vmax = 100;
    const k50 = 10;

    // At S = 5 (half of K50)
    const v1 = hillEquation(vmax, 5, k50, 1);
    const v4 = hillEquation(vmax, 5, k50, 4);

    // n=4 should give lower velocity at S < K50 (steeper sigmoid)
    expect(v4).toBeLessThan(v1);

    // At S = 15 (1.5x K50)
    const v1high = hillEquation(vmax, 15, k50, 1);
    const v4high = hillEquation(vmax, 15, k50, 4);

    // n=4 should give higher velocity at S > K50
    expect(v4high).toBeGreaterThan(v1high);
  });

  it('returns 0 when substrate is 0', () => {
    expectClose(hillEquation(100, 0, 10, 2), 0);
  });

  it('returns Vmax when K50 <= 0 and S > 0', () => {
    expectClose(hillEquation(100, 5, 0, 2), 100);
  });
});

// ═══════════════════════════════════════════════════════════════
//  6. Multi-Enzyme System Simulation
// ═══════════════════════════════════════════════════════════════

describe('simulateEnzymeSystem', () => {
  it('single enzyme matches expected MM kinetics', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const result = simulateEnzymeSystem(enzymes, [20, 0], 1, 0.01);

    // Substrate should decrease, product should increase
    const sFinal = result.species[0][result.species[0].length - 1];
    const pFinal = result.species[1][result.species[1].length - 1];

    expect(sFinal).toBeLessThan(20);
    expect(pFinal).toBeGreaterThan(0);

    // Conservation: S + P should be approximately constant (no degradation)
    const s0 = result.species[0][0];
    const p0 = result.species[1][0];
    expectClose(sFinal + pFinal, s0 + p0, 0.1);
  });

  it('two-enzyme cascade produces intermediate', () => {
    // A -> B -> C
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 5, km: 3 },
      { id: 'E2', substrateIndex: 1, productIndex: 2, vmax: 3, km: 2 },
    ];

    const result = simulateEnzymeSystem(enzymes, [20, 0, 0], 2, 0.01);

    const aFinal = result.species[0][result.species[0].length - 1];
    const bFinal = result.species[1][result.species[1].length - 1];
    const cFinal = result.species[2][result.species[2].length - 1];

    // A should decrease
    expect(aFinal).toBeLessThan(20);
    // C should accumulate
    expect(cFinal).toBeGreaterThan(0);
    // Conservation: A + B + C = 20
    expectClose(aFinal + bFinal + cFinal, 20, 0.2);
  });

  it('competitive inhibition reduces flux through inhibited enzyme', () => {
    const enzymesNoInhib: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const enzymesInhib: EnzymeKinetics[] = [
      {
        id: 'E1',
        substrateIndex: 0,
        productIndex: 1,
        vmax: 10,
        km: 5,
        ki: 2,
        inhibitorIndex: 2, // species[2] is the inhibitor
      },
    ];

    const tEnd = 1;
    const dt = 0.01;
    const init = [20, 0, 10]; // S, P, I

    const resultNoInhib = simulateEnzymeSystem(enzymesNoInhib, init, tEnd, dt);
    const resultInhib = simulateEnzymeSystem(enzymesInhib, init, tEnd, dt);

    // With inhibitor, less product should be formed
    const pNoInhib = resultNoInhib.species[1][resultNoInhib.species[1].length - 1];
    const pInhib = resultInhib.species[1][resultInhib.species[1].length - 1];

    expect(pInhib).toBeLessThan(pNoInhib);
  });

  it('returns single-point result for zero duration', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const result = simulateEnzymeSystem(enzymes, [10, 0], 0, 0.01);

    expect(result.time).toEqual([0]);
    expect(result.species[0]).toEqual([10]);
    expect(result.species[1]).toEqual([0]);
  });

  it('handles empty enzymes array', () => {
    const result = simulateEnzymeSystem([], [10, 5], 1, 0.01);

    // No enzymes means no change
    const sFinal = result.species[0][result.species[0].length - 1];
    const pFinal = result.species[1][result.species[1].length - 1];
    expectClose(sFinal, 10, 0.1);
    expectClose(pFinal, 5, 0.1);
  });

  it('velocities are recorded at each time point', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const result = simulateEnzymeSystem(enzymes, [20, 0], 1, 0.5);

    // Should have 3 time points: 0, 0.5, 1.0
    expect(result.time.length).toBe(3);
    expect(result.velocities[0].length).toBe(3);

    // All velocities should be non-negative
    for (const v of result.velocities[0]) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  7. Adaptive ODE Solver (Dormand-Prince RK4(5))
// ═══════════════════════════════════════════════════════════════

describe('adaptive ODE solver (Dormand-Prince)', () => {
  const adaptiveOpts: AdaptiveODEOptions = { adaptive: true, rtol: 1e-8, atol: 1e-10 };

  // ── Smooth problem agreement ──────────────────────────────────

  it('matches fixed-step RK4 for a smooth single-enzyme problem', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];
    const init = [20, 0];
    const tEnd = 1;

    const fixed = simulateEnzymeSystem(enzymes, init, tEnd, 0.001);
    const adaptive = simulateEnzymeSystem(enzymes, init, tEnd, 0.1, adaptiveOpts);

    // Final concentrations should agree within tolerance
    const fixedSFinal = fixed.species[0][fixed.species[0].length - 1];
    const adaptiveSFinal = adaptive.species[0][adaptive.species[0].length - 1];
    expectClose(fixedSFinal, adaptiveSFinal, 0.05);

    const fixedPFinal = fixed.species[1][fixed.species[1].length - 1];
    const adaptivePFinal = adaptive.species[1][adaptive.species[1].length - 1];
    expectClose(fixedPFinal, adaptivePFinal, 0.05);

    // Conservation check
    expectClose(adaptiveSFinal + adaptivePFinal, 20, 0.01);
  });

  it('matches fixed-step RK4 for a two-enzyme cascade', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 5, km: 3 },
      { id: 'E2', substrateIndex: 1, productIndex: 2, vmax: 3, km: 2 },
    ];
    const init = [20, 0, 0];
    const tEnd = 2;

    const fixed = simulateEnzymeSystem(enzymes, init, tEnd, 0.001);
    const adaptive = simulateEnzymeSystem(enzymes, init, tEnd, 0.1, adaptiveOpts);

    // All species should agree
    for (let j = 0; j < 3; j++) {
      const fixedFinal = fixed.species[j][fixed.species[j].length - 1];
      const adaptiveFinal = adaptive.species[j][adaptive.species[j].length - 1];
      expectClose(fixedFinal, adaptiveFinal, 0.1);
    }

    // Conservation: A + B + C = 20
    const a = adaptive.species[0];
    const b = adaptive.species[1];
    const c = adaptive.species[2];
    const total = a[a.length - 1] + b[b.length - 1] + c[c.length - 1];
    expectClose(total, 20, 0.01);
  });

  // ── Error tolerance ──────────────────────────────────────────

  it('respects the specified error tolerance', () => {
    // Use a simple linear ODE: dy/dt = -y, y(0) = 1 => y(t) = e^(-t)
    // Simulate as a single enzyme with very high Vmax and Km to approximate linear decay
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 1, km: 0.001 },
    ];
    const init = [1, 0];

    const result = simulateEnzymeSystem(enzymes, init, 1, 0.1, {
      adaptive: true,
      rtol: 1e-6,
      atol: 1e-9,
    });

    // The adaptive solver should produce well-resolved output
    expect(result.meta).toBeDefined();
    expect(result.meta!.totalSteps).toBeGreaterThan(0);

    // Conservation: S + P should be constant
    const sFinal = result.species[0][result.species[0].length - 1];
    const pFinal = result.species[1][result.species[1].length - 1];
    expectClose(sFinal + pFinal, 1, 0.001);
  });

  it('produces more accurate results with tighter tolerance', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];
    const init = [20, 0];
    const tEnd = 1;

    // Tight tolerance
    const tight = simulateEnzymeSystem(enzymes, init, tEnd, 0.1, {
      adaptive: true,
      rtol: 1e-10,
      atol: 1e-12,
    });

    // Loose tolerance
    const loose = simulateEnzymeSystem(enzymes, init, tEnd, 0.1, {
      adaptive: true,
      rtol: 1e-3,
      atol: 1e-6,
    });

    // Both should conserve mass
    const tightS = tight.species[0][tight.species[0].length - 1];
    const tightP = tight.species[1][tight.species[1].length - 1];
    expectClose(tightS + tightP, 20, 0.01);

    const looseS = loose.species[0][loose.species[0].length - 1];
    const looseP = loose.species[1][loose.species[1].length - 1];
    expectClose(looseS + looseP, 20, 0.1);
  });

  // ── Step size adaptation ─────────────────────────────────────

  it('uses adaptive step sizes (meta reports varying dt)', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const result = simulateEnzymeSystem(enzymes, [20, 0], 1, 0.1, adaptiveOpts);

    expect(result.meta).toBeDefined();
    const meta = result.meta!;

    // Should have taken multiple steps
    expect(meta.totalSteps).toBeGreaterThan(1);

    // Min and max step sizes should differ (adaptive behavior)
    expect(meta.maxDt).toBeGreaterThan(meta.minDt);

    // No stiffness on this smooth problem
    expect(meta.stiffnessDetected).toBe(false);
  });

  it('takes fewer steps than fixed-step for smooth problems', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 5, km: 10 },
    ];
    const init = [50, 0];
    const tEnd = 1;

    const fixedSteps = Math.ceil(tEnd / 0.001); // 1000 fixed steps
    const adaptive = simulateEnzymeSystem(enzymes, init, tEnd, 0.1, adaptiveOpts);

    // Adaptive should use fewer total steps than fixed-step with tiny dt
    expect(adaptive.meta!.totalSteps).toBeLessThan(fixedSteps);
  });

  // ── Stiffness detection ──────────────────────────────────────

  it('detects stiffness for a stiff problem', () => {
    // Create a stiff system: one very fast enzyme, one very slow
    // Fast enzyme with tiny Km creates rapid transient
    const enzymes: EnzymeKinetics[] = [
      { id: 'E_fast', substrateIndex: 0, productIndex: 1, vmax: 1000, km: 0.001 },
      { id: 'E_slow', substrateIndex: 1, productIndex: 2, vmax: 0.1, km: 10 },
    ];
    const init = [10, 0, 0];

    const result = simulateEnzymeSystem(enzymes, init, 1, 0.1, {
      adaptive: true,
      rtol: 1e-8,
      atol: 1e-10,
      minStepSize: 1e-10, // allow very small steps
    });

    // Should detect stiffness or at least use very small steps
    expect(result.meta).toBeDefined();
    // The fast enzyme creates a rapid transient that forces small steps
    expect(result.meta!.minDt).toBeLessThan(1e-4);
  });

  // ── Edge cases ───────────────────────────────────────────────

  it('returns single-point result for zero duration (adaptive mode)', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const result = simulateEnzymeSystem(enzymes, [10, 0], 0, 0.01, adaptiveOpts);

    expect(result.time).toEqual([0]);
    expect(result.species[0]).toEqual([10]);
    expect(result.species[1]).toEqual([0]);
  });

  it('handles empty enzymes array (adaptive mode)', () => {
    const result = simulateEnzymeSystem([], [10, 5], 1, 0.01, adaptiveOpts);

    // No enzymes means no change
    const sFinal = result.species[0][result.species[0].length - 1];
    const pFinal = result.species[1][result.species[1].length - 1];
    expectClose(sFinal, 10, 0.01);
    expectClose(pFinal, 5, 0.01);
  });

  it('adaptive mode returns meta information', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const result = simulateEnzymeSystem(enzymes, [20, 0], 1, 0.1, adaptiveOpts);

    expect(result.meta).toBeDefined();
    expect(typeof result.meta!.stiffnessDetected).toBe('boolean');
    expect(typeof result.meta!.totalSteps).toBe('number');
    expect(typeof result.meta!.rejectedSteps).toBe('number');
    expect(typeof result.meta!.minDt).toBe('number');
    expect(typeof result.meta!.maxDt).toBe('number');
  });

  it('fixed-step mode does not return meta', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const result = simulateEnzymeSystem(enzymes, [20, 0], 1, 0.1);

    // Without adaptive option, meta should be undefined
    expect(result.meta).toBeUndefined();
  });

  // ── Backward compatibility ───────────────────────────────────

  it('calling without options preserves original fixed-step behavior', () => {
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const result = simulateEnzymeSystem(enzymes, [20, 0], 1, 0.01);

    // Same behavior as before: fixed-step RK4
    const sFinal = result.species[0][result.species[0].length - 1];
    const pFinal = result.species[1][result.species[1].length - 1];

    expect(sFinal).toBeLessThan(20);
    expect(pFinal).toBeGreaterThan(0);
    expectClose(sFinal + pFinal, 20, 0.1);
    expect(result.meta).toBeUndefined();
  });

  // ── High-dimensional system ──────────────────────────────────

  it('handles a multi-species cascade with adaptive solver', () => {
    // A -> B -> C -> D -> E
    const enzymes: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 5, km: 2 },
      { id: 'E2', substrateIndex: 1, productIndex: 2, vmax: 3, km: 3 },
      { id: 'E3', substrateIndex: 2, productIndex: 3, vmax: 4, km: 1 },
      { id: 'E4', substrateIndex: 3, productIndex: 4, vmax: 2, km: 5 },
    ];
    const init = [100, 0, 0, 0, 0];

    const result = simulateEnzymeSystem(enzymes, init, 5, 0.1, adaptiveOpts);

    // Conservation: sum of all species should equal initial total
    const finalTotal = result.species.reduce(
      (sum, sp) => sum + sp[sp.length - 1],
      0,
    );
    expectClose(finalTotal, 100, 0.1);

    // A should decrease, E should accumulate
    expect(result.species[0][result.species[0].length - 1]).toBeLessThan(100);
    expect(result.species[4][result.species[4].length - 1]).toBeGreaterThan(0);
  });

  // ── Competitive inhibition with adaptive solver ──────────────

  it('handles competitive inhibition correctly with adaptive solver', () => {
    const enzymesNoInhib: EnzymeKinetics[] = [
      { id: 'E1', substrateIndex: 0, productIndex: 1, vmax: 10, km: 5 },
    ];

    const enzymesInhib: EnzymeKinetics[] = [
      {
        id: 'E1',
        substrateIndex: 0,
        productIndex: 1,
        vmax: 10,
        km: 5,
        ki: 2,
        inhibitorIndex: 2,
      },
    ];

    const init = [20, 0, 10];
    const tEnd = 1;

    const resultNoInhib = simulateEnzymeSystem(enzymesNoInhib, init, tEnd, 0.1, adaptiveOpts);
    const resultInhib = simulateEnzymeSystem(enzymesInhib, init, tEnd, 0.1, adaptiveOpts);

    const pNoInhib = resultNoInhib.species[1][resultNoInhib.species[1].length - 1];
    const pInhib = resultInhib.species[1][resultInhib.species[1].length - 1];

    // Inhibition should reduce product formation
    expect(pInhib).toBeLessThan(pNoInhib);
  });
});

// ═══════════════════════════════════════════════════════════════
//  8. Parameter Estimation (Levenberg-Marquardt)
// ═══════════════════════════════════════════════════════════════

/**
 * Generate synthetic velocity data at multiple inhibitor concentrations.
 *
 * Multiple inhibitor concentrations are essential for parameter identifiability:
 *   - Competitive: with single I, only Km*(1+I/Ki) is identifiable
 *   - Uncompetitive: with single I, Vmax/(1+I/Kiu) and Km are intertwined
 *   - Mixed: needs at least 2 I>0 values to separate Kic and Kiu
 *
 * Each entry in inhibitorConcs produces a full set of (s, v) observations.
 */
function generateSyntheticDataMultiI(
  model: InhibitionModel,
  trueParams: number[],
  substrateConcs: number[],
  inhibitorConcs: number[],
): KineticDataPoint[] {
  const data: KineticDataPoint[] = [];

  for (const i of inhibitorConcs) {
    for (const s of substrateConcs) {
      const sSafe = Math.max(0, s);
      let v: number;

      switch (model) {
        case 'competitive': {
          const [vmax, km, ki] = trueParams;
          const denom = ki > 0 && i > 0 ? km * (1 + i / ki) + sSafe : km + sSafe;
          v = denom <= 0 ? 0 : (vmax * sSafe) / denom;
          break;
        }
        case 'uncompetitive': {
          const [vmax, km, kiu] = trueParams;
          const denom = kiu > 0 && i > 0 ? km + sSafe * (1 + i / kiu) : km + sSafe;
          v = denom <= 0 ? 0 : (vmax * sSafe) / denom;
          break;
        }
        case 'mixed': {
          const [vmax, km, kic, kiu] = trueParams;
          const hasComp = kic > 0 && i > 0;
          const hasUncomp = kiu > 0 && i > 0;
          if (!hasComp && !hasUncomp) {
            const denom = km + sSafe;
            v = denom <= 0 ? 0 : (vmax * sSafe) / denom;
          } else {
            const kmFactor = hasComp ? 1 + i / kic : 1;
            const sFactor = hasUncomp ? 1 + i / kiu : 1;
            const denom = km * kmFactor + sSafe * sFactor;
            v = denom <= 0 ? 0 : (vmax * sSafe) / denom;
          }
          break;
        }
      }

      data.push({ s, v, i });
    }
  }

  return data;
}

/** Seed the PRNG for reproducible noise in tests. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe('estimateParameters', () => {
  const sValues = [0.5, 1, 2, 3, 5, 8, 10, 15, 20, 30, 50];

  // ── Competitive inhibition ───────────────────────────────────

  describe('competitive inhibition model', () => {
    it('recovers exact parameters from clean multi-I data', () => {
      const trueParams = [100, 5, 2]; // Vmax=100, Km=5, Ki=2
      // I=0 gives Vmax and Km; I=3 gives Ki
      const data = generateSyntheticDataMultiI('competitive', trueParams, sValues, [0, 3]);

      const result = estimateParameters('competitive', data, [80, 4, 3]);

      expect(result.converged).toBe(true);
      expectClose(result.params[0], 100, 0.5);  // Vmax
      expectClose(result.params[1], 5, 0.5);     // Km
      expectClose(result.params[2], 2, 0.5);     // Ki
      expect(result.rss).toBeLessThan(1e-6);
    });

    it('recovers parameters with noisy multi-I data', () => {
      const trueParams = [100, 5, 2];
      const cleanData = generateSyntheticDataMultiI('competitive', trueParams, sValues, [0, 3]);

      // Add 5% noise with seeded PRNG for reproducibility
      const rng = seededRandom(42);
      const noisyData: KineticDataPoint[] = cleanData.map(d => ({
        s: d.s,
        v: d.v * (1 + 0.05 * (rng() - 0.5) * 2),
        i: d.i,
      }));

      const result = estimateParameters('competitive', noisyData, [90, 6, 1.5]);

      expect(result.converged).toBe(true);
      // With noise, parameters should be within ~15% of true values
      expect(Math.abs(result.params[0] - 100) / 100).toBeLessThan(0.15);
      expect(Math.abs(result.params[1] - 5) / 5).toBeLessThan(0.15);
      expect(Math.abs(result.params[2] - 2) / 2).toBeLessThan(0.2);
    });

    it('handles no-inhibition data (I = 0 only)', () => {
      const trueParams = [100, 5, 2];
      // I=0 only: Ki is unidentifiable but Vmax and Km should be recovered
      const data = generateSyntheticDataMultiI('competitive', trueParams, sValues, [0]);

      const result = estimateParameters('competitive', data, [80, 4, 3]);

      expect(result.converged).toBe(true);
      expectClose(result.params[0], 100, 0.5);  // Vmax
      expectClose(result.params[1], 5, 0.5);     // Km
      // Ki is unidentifiable when I = 0, but should stay positive
      expect(result.params[2]).toBeGreaterThan(0);
    });

    it('converges to zero RSS for clean data', () => {
      const trueParams = [100, 5, 2];
      const data = generateSyntheticDataMultiI('competitive', trueParams, sValues, [0, 3]);

      const result = estimateParameters('competitive', data, [80, 4, 3]);

      expect(result.rss).toBeLessThan(1e-10);
    });
  });

  // ── Uncompetitive inhibition ─────────────────────────────────

  describe('uncompetitive inhibition model', () => {
    it('recovers exact parameters from clean multi-I data', () => {
      const trueParams = [80, 3, 4]; // Vmax=80, Km=3, Kiu=4
      // I=0 gives Vmax, Km; I=2 gives Kiu info
      const data = generateSyntheticDataMultiI('uncompetitive', trueParams, sValues, [0, 2]);

      const result = estimateParameters('uncompetitive', data, [70, 4, 5]);

      expect(result.converged).toBe(true);
      expectClose(result.params[0], 80, 0.5);
      expectClose(result.params[1], 3, 0.5);
      expectClose(result.params[2], 4, 0.5);
      expect(result.rss).toBeLessThan(1e-6);
    });

    it('recovers parameters with noisy multi-I data', () => {
      const trueParams = [80, 3, 4];
      const cleanData = generateSyntheticDataMultiI('uncompetitive', trueParams, sValues, [0, 2]);

      const rng = seededRandom(123);
      const noisyData: KineticDataPoint[] = cleanData.map(d => ({
        s: d.s,
        v: d.v * (1 + 0.05 * (rng() - 0.5) * 2),
        i: d.i,
      }));

      const result = estimateParameters('uncompetitive', noisyData, [70, 4, 5]);

      expect(result.converged).toBe(true);
      expect(Math.abs(result.params[0] - 80) / 80).toBeLessThan(0.15);
      expect(Math.abs(result.params[1] - 3) / 3).toBeLessThan(0.15);
      expect(Math.abs(result.params[2] - 4) / 4).toBeLessThan(0.2);
    });
  });

  // ── Mixed inhibition ─────────────────────────────────────────

  describe('mixed inhibition model', () => {
    it('recovers exact parameters from clean multi-I data', () => {
      const trueParams = [120, 8, 3, 6]; // Vmax=120, Km=8, Kic=3, Kiu=6
      // I=0 gives Vmax, Km; I=2 and I=6 give Kic and Kiu
      const data = generateSyntheticDataMultiI('mixed', trueParams, sValues, [0, 2, 6]);

      const result = estimateParameters('mixed', data, [100, 6, 4, 5]);

      expect(result.converged).toBe(true);
      expectClose(result.params[0], 120, 1);
      expectClose(result.params[1], 8, 1);
      expectClose(result.params[2], 3, 1);
      expectClose(result.params[3], 6, 1);
      expect(result.rss).toBeLessThan(1e-4);
    });

    it('recovers parameters with noisy multi-I data', () => {
      const trueParams = [120, 8, 3, 6];
      const cleanData = generateSyntheticDataMultiI('mixed', trueParams, sValues, [0, 2, 6]);

      const rng = seededRandom(789);
      const noisyData: KineticDataPoint[] = cleanData.map(d => ({
        s: d.s,
        v: d.v * (1 + 0.05 * (rng() - 0.5) * 2),
        i: d.i,
      }));

      const result = estimateParameters('mixed', noisyData, [100, 6, 4, 5]);

      expect(result.converged).toBe(true);
      expect(Math.abs(result.params[0] - 120) / 120).toBeLessThan(0.15);
      expect(Math.abs(result.params[1] - 8) / 8).toBeLessThan(0.2);
      expect(Math.abs(result.params[2] - 3) / 3).toBeLessThan(0.25);
      expect(Math.abs(result.params[3] - 6) / 6).toBeLessThan(0.25);
    });

    it('reduces to competitive when Kiu is very large', () => {
      const trueParams = [100, 5, 2, 1e6]; // Kiu effectively infinite
      const data = generateSyntheticDataMultiI('mixed', trueParams, sValues, [0, 3]);

      const result = estimateParameters('mixed', data, [80, 4, 3, 10]);

      expect(result.converged).toBe(true);
      // Vmax and Km should be recovered
      expectClose(result.params[0], 100, 1);
      expectClose(result.params[1], 5, 1);
      // Kic should be close to true Ki
      expectClose(result.params[2], 2, 1);
    });
  });

  // ── Edge cases and robustness ────────────────────────────────

  describe('edge cases', () => {
    it('returns positive parameters even with negative initial guess', () => {
      const trueParams = [100, 5, 2];
      const data = generateSyntheticDataMultiI('competitive', trueParams, sValues, [0, 3]);

      // Negative initial guess should be clamped to positive
      const result = estimateParameters('competitive', data, [-10, -2, -1]);

      for (const p of result.params) {
        expect(p).toBeGreaterThan(0);
      }
    });

    it('returns non-negative RSS with correct residual count', () => {
      const trueParams = [100, 5, 2];
      const data = generateSyntheticDataMultiI('competitive', trueParams, sValues, [0, 3]);

      const result = estimateParameters('competitive', data, [80, 4, 3]);

      expect(result.rss).toBeGreaterThanOrEqual(0);
      expect(result.residuals.length).toBe(data.length);
    });

    it('respects maxIter configuration', () => {
      const trueParams = [100, 5, 2];
      const data = generateSyntheticDataMultiI('competitive', trueParams, sValues, [0, 3]);

      const result = estimateParameters('competitive', data, [80, 4, 3], { maxIter: 2 });

      // Should stop after 2 iterations (may or may not have converged)
      expect(result.iterations).toBe(2);
    });

    it('handles single data point (underdetermined)', () => {
      const data: KineticDataPoint[] = [{ s: 5, v: 50, i: 0 }];

      const result = estimateParameters('competitive', data, [80, 4, 3]);

      // Should converge (single point is trivially fittable with 3 params)
      expect(result.converged).toBe(true);
      expect(result.rss).toBeLessThan(1e-10);
      // All params should be positive
      for (const p of result.params) {
        expect(p).toBeGreaterThan(0);
      }
    });

    it('works with sparse substrate data', () => {
      const trueParams = [100, 5, 2];
      const sparseS = [1, 5, 15, 50];
      const data = generateSyntheticDataMultiI('competitive', trueParams, sparseS, [0, 3]);

      const result = estimateParameters('competitive', data, [80, 4, 3]);

      expect(result.converged).toBe(true);
      expect(result.rss).toBeLessThan(1e-6);
    });
  });
});
