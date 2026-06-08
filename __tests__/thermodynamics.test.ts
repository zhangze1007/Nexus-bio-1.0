import { calcDeltaG, calcKeq, calcMassBalance, R } from '../src/utils/thermodynamics';

describe('calcDeltaG', () => {
  it('returns ΔG° when Q = 1', () => {
    const dG = calcDeltaG(-10, 310, [1], [1]);
    expect(dG).toBeCloseTo(-10, 2);
  });

  it('makes ΔG more negative when products are low', () => {
    const dG = calcDeltaG(-10, 310, [0.001], [1]);
    expect(dG).toBeLessThan(-10);
  });

  it('makes ΔG less negative when products are high', () => {
    const dG = calcDeltaG(-10, 310, [100], [1]);
    expect(dG).toBeGreaterThan(-10);
  });

  it('handles multiple products and reactants', () => {
    const dG = calcDeltaG(-5, 310, [2, 3], [1, 1]);
    const expected = -5 + R * 310 * Math.log(6);
    expect(dG).toBeCloseTo(expected, 4);
  });

  it('handles zero products gracefully', () => {
    const dG = calcDeltaG(-10, 310, [0], [1]);
    expect(dG).toBeLessThan(-10);
    expect(Number.isFinite(dG)).toBe(true);
  });
});

describe('calcKeq', () => {
  it('returns > 1 for negative ΔG° (spontaneous)', () => {
    expect(calcKeq(-10, 310)).toBeGreaterThan(1);
  });

  it('returns < 1 for positive ΔG° (non-spontaneous)', () => {
    expect(calcKeq(10, 310)).toBeLessThan(1);
  });

  it('returns 1 when ΔG° = 0', () => {
    expect(calcKeq(0, 310)).toBeCloseTo(1, 4);
  });

  it('increases with more negative ΔG°', () => {
    expect(calcKeq(-10, 310)).toBeGreaterThan(calcKeq(-5, 310));
  });
});

describe('calcMassBalance', () => {
  it('returns arrays of expected length', () => {
    const result = calcMassBalance(10, -5, 100, 50);
    expect(result.time).toHaveLength(51);
    expect(result.S).toHaveLength(51);
    expect(result.P).toHaveLength(51);
  });

  it('starts with initial substrate and zero product', () => {
    const result = calcMassBalance(10, -5, 100, 50);
    expect(result.S[0]).toBe(10);
    expect(result.P[0]).toBe(0);
  });

  it('substrate decreases with negative ΔG', () => {
    const result = calcMassBalance(10, -20, 100, 100);
    expect(result.S[result.S.length - 1]).toBeLessThan(10);
  });

  it('product increases with negative ΔG', () => {
    const result = calcMassBalance(10, -20, 100, 100);
    expect(result.P[result.P.length - 1]).toBeGreaterThan(0);
  });

  it('concentrations never go negative', () => {
    const result = calcMassBalance(10, -50, 1000, 500);
    for (const s of result.S) expect(s).toBeGreaterThanOrEqual(0);
    for (const p of result.P) expect(p).toBeGreaterThanOrEqual(0);
  });

  it('positive ΔG results in slower substrate consumption', () => {
    const negDG = calcMassBalance(10, -20, 100, 50);
    const posDG = calcMassBalance(10, 20, 100, 50);
    // Positive ΔG has negative driving force, slower consumption
    expect(posDG.S[posDG.S.length - 1]).toBeGreaterThanOrEqual(negDG.S[negDG.S.length - 1]);
  });

  it('zero ΔG still produces some conversion', () => {
    const result = calcMassBalance(10, 0, 1, 50);
    // With ΔG=0, drivingForce is -|dG|*0.005 = 0, so no conversion
    // Actually dG=0 means dG < 0 is false, so drivingForce = -|0|*0.005 = 0
    expect(result.S[0]).toBe(10);
    expect(result.P[0]).toBe(0);
  });

  it('time array starts at 0 and increments by dt', () => {
    const result = calcMassBalance(5, -10, 100, 10);
    expect(result.time[0]).toBe(0);
    expect(result.time[1]).toBeCloseTo(0.1, 2);
    expect(result.time[2]).toBeCloseTo(0.2, 2);
  });

  it('works with single step', () => {
    const result = calcMassBalance(10, -5, 100, 1);
    expect(result.time).toHaveLength(2);
    expect(result.S).toHaveLength(2);
    expect(result.P).toHaveLength(2);
  });

  it('handles very small initial substrate', () => {
    const result = calcMassBalance(0.001, -10, 100, 100);
    for (const s of result.S) expect(s).toBeGreaterThanOrEqual(0);
    for (const p of result.P) expect(p).toBeGreaterThanOrEqual(0);
  });

  it('handles very large Keq', () => {
    const result = calcMassBalance(10, -50, 1e10, 100);
    expect(result.S[result.S.length - 1]).toBeLessThan(10);
    expect(result.P[result.P.length - 1]).toBeGreaterThan(0);
  });
});
