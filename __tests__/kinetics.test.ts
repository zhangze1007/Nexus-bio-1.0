import { mmVelocity, runRK4 } from '../src/utils/kinetics';

describe('mmVelocity', () => {
  it('calculates basic Michaelis-Menten velocity', () => {
    const v = mmVelocity(10, 100, 5);
    expect(v).toBeCloseTo(66.667, 2);
  });

  it('returns 0 when substrate is 0', () => {
    expect(mmVelocity(0, 100, 5)).toBe(0);
  });

  it('approaches Vmax at high substrate', () => {
    const v = mmVelocity(10000, 100, 5);
    expect(v).toBeCloseTo(100, 0);
  });

  it('equals Vmax/2 when S = Km', () => {
    const v = mmVelocity(5, 100, 5);
    expect(v).toBeCloseTo(50, 2);
  });

  it('applies competitive inhibition correctly', () => {
    const vNoInh = mmVelocity(10, 100, 5);
    const vWithInh = mmVelocity(10, 100, 5, 2, 4);
    expect(vWithInh).toBeLessThan(vNoInh);
    expect(vWithInh).toBeCloseTo(40, 2);
  });

  it('ignores inhibition when Ki or I is undefined', () => {
    expect(mmVelocity(10, 100, 5, undefined, 4)).toBeCloseTo(66.667, 2);
    expect(mmVelocity(10, 100, 5, 2, undefined)).toBeCloseTo(66.667, 2);
  });
});

describe('runRK4', () => {
  it('returns arrays of equal length', () => {
    const result = runRK4(10, 0, 100, 5, 0, 0, undefined, undefined, 10, 100);
    expect(result.time).toHaveLength(101);
    expect(result.substrate).toHaveLength(101);
    expect(result.product).toHaveLength(101);
    expect(result.velocity).toHaveLength(101);
  });

  it('starts with initial conditions', () => {
    const result = runRK4(10, 2, 100, 5, 0, 0, undefined, undefined, 10, 50);
    expect(result.time[0]).toBe(0);
    expect(result.substrate[0]).toBe(10);
    expect(result.product[0]).toBe(2);
  });

  it('substrate decreases without formation', () => {
    const result = runRK4(10, 0, 100, 5, 0, 0, undefined, undefined, 10, 100);
    const lastS = result.substrate[result.substrate.length - 1];
    expect(lastS).toBeLessThan(10);
  });

  it('product increases from enzyme activity', () => {
    const result = runRK4(10, 0, 100, 5, 0, 0, undefined, undefined, 10, 100);
    const lastP = result.product[result.product.length - 1];
    expect(lastP).toBeGreaterThan(0);
  });

  it('substrate never goes negative', () => {
    const result = runRK4(0.1, 0, 100, 5, 0, 0, undefined, undefined, 100, 1000);
    for (const s of result.substrate) {
      expect(s).toBeGreaterThanOrEqual(0);
    }
  });

  it('formation rate sustains substrate level', () => {
    const result = runRK4(10, 0, 10, 5, 10, 0, undefined, undefined, 20, 200);
    const lastS = result.substrate[result.substrate.length - 1];
    expect(lastS).toBeGreaterThan(0);
  });

  it('time array spans the correct duration', () => {
    const result = runRK4(10, 0, 100, 5, 0, 0, undefined, undefined, 5, 50);
    expect(result.time[result.time.length - 1]).toBeCloseTo(5, 1);
  });

  it('works with inhibition parameters', () => {
    const result = runRK4(10, 0, 100, 5, 0, 0, 2, 4, 10, 100);
    expect(result.time).toHaveLength(101);
    // With inhibition, velocity should be lower
    const noInh = runRK4(10, 0, 100, 5, 0, 0, undefined, undefined, 10, 100);
    expect(result.velocity[0]).toBeLessThan(noInh.velocity[0]);
  });

  it('degradation reduces product accumulation', () => {
    const noDegrade = runRK4(10, 0, 100, 5, 0, 0, undefined, undefined, 10, 100);
    const withDegrade = runRK4(10, 0, 100, 5, 0, 0.5, undefined, undefined, 10, 100);
    expect(withDegrade.product[withDegrade.product.length - 1]).toBeLessThan(
      noDegrade.product[noDegrade.product.length - 1],
    );
  });

  it('product never goes negative', () => {
    const result = runRK4(10, 5, 100, 5, 0, 10, undefined, undefined, 10, 100);
    for (const p of result.product) {
      expect(p).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles zero initial substrate', () => {
    const result = runRK4(0, 0, 100, 5, 0, 0, undefined, undefined, 10, 10);
    expect(result.substrate[0]).toBe(0);
    expect(result.velocity[0]).toBe(0);
  });

  it('velocity array has correct length', () => {
    const result = runRK4(5, 0, 50, 2, 1, 0.1, undefined, undefined, 5, 25);
    expect(result.velocity).toHaveLength(26);
  });

  it('works with single step', () => {
    const result = runRK4(10, 0, 100, 5, 0, 0, undefined, undefined, 1, 1);
    expect(result.time).toHaveLength(2);
    expect(result.time[0]).toBe(0);
    expect(result.time[1]).toBeCloseTo(1);
  });

  it('velocity values are non-negative', () => {
    const result = runRK4(10, 0, 100, 5, 0, 0, undefined, undefined, 10, 100);
    for (const v of result.velocity) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
