import {
  competitiveInhibition,
  uncompetitiveInhibition,
  mixedInhibition,
  substrateInhibition,
  hillEquation,
  simulateEnzymeSystem,
  EnzymeKinetics,
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
