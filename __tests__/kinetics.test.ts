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
});
