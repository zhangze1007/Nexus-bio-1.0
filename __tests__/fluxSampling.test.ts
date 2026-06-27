/** @jest-environment node */

import { sampleFlux, computeFluxRange } from '../src/services/fba/fluxSampling';
import type { LPModel } from '../src/server/highsSolver';
import { solveLP } from '../src/server/highsSolver';

/**
 * Simple 3-reaction network: unique optimum, no degeneracy.
 *
 *   A --[R1]--> B --[R2]--> C (product)
 *                \
 *                 --[R3]--> D (waste)
 *
 * Stoichiometry: R1 - R2 - R3 = 0
 * Objective: max R2
 * Bounds: R1 in [0, 10], R2 in [0, 10], R3 in [0, 10]
 *
 * Unique optimum: R2=10, R1=10, R3=0.
 */
function buildSimpleModel(): LPModel {
  return {
    name: 'test_simple',
    sense: 'maximize',
    objective: [{ name: 'R2', coef: 1 }],
    constraints: [
      {
        name: 'B_balance',
        vars: [
          { name: 'R1', coef: 1 },
          { name: 'R2', coef: -1 },
          { name: 'R3', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
    ],
    bounds: [
      { name: 'R1', lb: 0, ub: 10 },
      { name: 'R2', lb: 0, ub: 10 },
      { name: 'R3', lb: 0, ub: 10 },
    ],
  };
}

/**
 * Degenerate network: R3 can vary [0, 5] on the optimal face.
 *
 *   R1: S --> A     (lb=0, ub=15)
 *   R2: A --> P     (lb=0, ub=10)  ← objective
 *   R3: A --> W     (lb=0, ub=8)   ← free on optimal face
 *   R4: S --> A2    (lb=0, ub=10)
 *   R5: A2 --> P    (lb=0, ub=10)  ← objective
 *
 * Mass balance: R1 = R2 + R3, R4 = R5
 * At optimum: R2=10, R5=10 (total=20). R1=10+R3, R4=10.
 * R3 can vary [0, 5] since R1 <= 15.
 */
function buildDegenerateModel(): LPModel {
  return {
    name: 'test_degenerate',
    sense: 'maximize',
    objective: [
      { name: 'R2', coef: 1 },
      { name: 'R5', coef: 1 },
    ],
    constraints: [
      {
        name: 'A_balance',
        vars: [
          { name: 'R1', coef: 1 },
          { name: 'R2', coef: -1 },
          { name: 'R3', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: 'A2_balance',
        vars: [
          { name: 'R4', coef: 1 },
          { name: 'R5', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
    ],
    bounds: [
      { name: 'R1', lb: 0, ub: 15 },
      { name: 'R2', lb: 0, ub: 10 },
      { name: 'R3', lb: 0, ub: 8 },
      { name: 'R4', lb: 0, ub: 10 },
      { name: 'R5', lb: 0, ub: 10 },
    ],
  };
}

/**
 * Infeasible model: conflicting constraints.
 */
function buildInfeasibleModel(): LPModel {
  return {
    name: 'test_infeasible',
    sense: 'maximize',
    objective: [{ name: 'x', coef: 1 }],
    constraints: [
      {
        name: 'c1',
        vars: [{ name: 'x', coef: 1 }],
        lb: 10,
        ub: 5,
      },
    ],
    bounds: [
      { name: 'x', lb: 0, ub: Infinity },
    ],
  };
}

/**
 * Wide-bounds model: each variable has slack, allowing significant variation.
 *
 *   R1: S --> A     (lb=0, ub=20)
 *   R2: A --> P     (lb=0, ub=10)  ← objective
 *   R3: A --> W     (lb=0, ub=15)  ← free
 *
 * Mass balance: R1 = R2 + R3
 * At optimum: R2=10. R1=10+R3, R3 in [0, 10] (since R1 <= 20).
 */
function buildWideBoundsModel(): LPModel {
  return {
    name: 'test_wide',
    sense: 'maximize',
    objective: [{ name: 'R2', coef: 1 }],
    constraints: [
      {
        name: 'A_balance',
        vars: [
          { name: 'R1', coef: 1 },
          { name: 'R2', coef: -1 },
          { name: 'R3', coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
    ],
    bounds: [
      { name: 'R1', lb: 0, ub: 20 },
      { name: 'R2', lb: 0, ub: 10 },
      { name: 'R3', lb: 0, ub: 15 },
    ],
  };
}

describe('sampleFlux', () => {
  test('returns correct number of samples for degenerate model', async () => {
    const samples = await sampleFlux(buildDegenerateModel(), 5);
    expect(samples).toHaveLength(5);
  });

  test('returns single sample for unique optimum model', async () => {
    const samples = await sampleFlux(buildSimpleModel(), 5);
    // Simple model has a unique optimum, so only 1 distinct sample
    expect(samples).toHaveLength(1);
    expect(samples[0].fluxes['R2']).toBeCloseTo(10, 2);
  });

  test('returns empty array for nSamples = 0', async () => {
    const samples = await sampleFlux(buildSimpleModel(), 0);
    expect(samples).toHaveLength(0);
  });

  test('returns empty array for infeasible model', async () => {
    const samples = await sampleFlux(buildInfeasibleModel(), 5);
    expect(samples).toHaveLength(0);
  });

  test('each sample contains fluxes for all reactions', async () => {
    const samples = await sampleFlux(buildDegenerateModel(), 3);
    for (const sample of samples) {
      expect(sample.fluxes).toBeDefined();
      expect(sample.fluxes['R1']).toBeDefined();
      expect(sample.fluxes['R2']).toBeDefined();
      expect(sample.fluxes['R3']).toBeDefined();
    }
  });

  test('each sample has an objectiveValue', async () => {
    const samples = await sampleFlux(buildDegenerateModel(), 3);
    for (const sample of samples) {
      expect(typeof sample.objectiveValue).toBe('number');
      expect(sample.objectiveValue).toBeGreaterThan(0);
    }
  });

  test('objective values are near-optimal within tolerance', async () => {
    const model = buildDegenerateModel();
    const optResult = await solveLP(model);
    const optimal = optResult.objectiveValue;

    const samples = await sampleFlux(model, 10, 1e-4);
    for (const sample of samples) {
      expect(sample.objectiveValue).toBeGreaterThanOrEqual(optimal * (1 - 1e-3));
    }
  });

  test('mass balance constraint is satisfied in each sample', async () => {
    const samples = await sampleFlux(buildDegenerateModel(), 10);
    for (const sample of samples) {
      // A_balance: R1 - R2 - R3 = 0
      const residual = sample.fluxes['R1'] - sample.fluxes['R2'] - sample.fluxes['R3'];
      expect(Math.abs(residual)).toBeLessThan(0.1);
    }
  });

  test('samples vary across the degenerate optimal face', async () => {
    const model = buildDegenerateModel();
    const samples = await sampleFlux(model, 20);

    // R3 should vary on the optimal face (can be 0 to 5)
    const r3Values = samples.map((s) => s.fluxes['R3']);
    const r3Min = Math.min(...r3Values);
    const r3Max = Math.max(...r3Values);
    expect(r3Max - r3Min).toBeGreaterThan(0.5);
  });

  test('all flux values are finite numbers', async () => {
    const samples = await sampleFlux(buildDegenerateModel(), 5);
    for (const sample of samples) {
      for (const value of Object.values(sample.fluxes)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(Number.isNaN(value)).toBe(false);
      }
    }
  });

  test('fluxes respect variable bounds', async () => {
    const model = buildDegenerateModel();
    const samples = await sampleFlux(model, 10);

    for (const sample of samples) {
      expect(sample.fluxes['R1']).toBeGreaterThanOrEqual(-0.1);
      expect(sample.fluxes['R1']).toBeLessThanOrEqual(15.1);
      expect(sample.fluxes['R2']).toBeGreaterThanOrEqual(-0.1);
      expect(sample.fluxes['R2']).toBeLessThanOrEqual(10.1);
      expect(sample.fluxes['R3']).toBeGreaterThanOrEqual(-0.1);
      expect(sample.fluxes['R3']).toBeLessThanOrEqual(8.1);
    }
  });

  test('wide-bounds model produces varied samples', async () => {
    const samples = await sampleFlux(buildWideBoundsModel(), 10);
    expect(samples.length).toBeGreaterThanOrEqual(2);

    // R3 can vary [0, 10] on the optimal face
    const r3Values = samples.map((s) => s.fluxes['R3']);
    const r3Min = Math.min(...r3Values);
    const r3Max = Math.max(...r3Values);
    expect(r3Max - r3Min).toBeGreaterThan(0.5);
  });
});

describe('computeFluxRange', () => {
  test('returns ranges for all reactions', async () => {
    const ranges = await computeFluxRange(buildDegenerateModel(), 10);
    expect(ranges).toHaveLength(5);
    const ids = ranges.map((r) => r.reactionId);
    expect(ids).toContain('R1');
    expect(ids).toContain('R2');
    expect(ids).toContain('R3');
    expect(ids).toContain('R4');
    expect(ids).toContain('R5');
  });

  test('returns single-element ranges for unique optimum', async () => {
    const ranges = await computeFluxRange(buildSimpleModel(), 5);
    // Simple model has unique optimum, so std should be 0
    for (const range of ranges) {
      expect(range.std).toBeCloseTo(0, 4);
    }
  });

  test('returns empty array for zero samples', async () => {
    const ranges = await computeFluxRange(buildSimpleModel(), 0);
    expect(ranges).toHaveLength(0);
  });

  test('each range has min, max, mean, std', async () => {
    const ranges = await computeFluxRange(buildDegenerateModel(), 5);
    for (const range of ranges) {
      expect(typeof range.min).toBe('number');
      expect(typeof range.max).toBe('number');
      expect(typeof range.mean).toBe('number');
      expect(typeof range.std).toBe('number');
    }
  });

  test('min <= mean <= max for each reaction', async () => {
    const ranges = await computeFluxRange(buildDegenerateModel(), 20);
    for (const range of ranges) {
      expect(range.min).toBeLessThanOrEqual(range.mean + 1e-6);
      expect(range.mean).toBeLessThanOrEqual(range.max + 1e-6);
    }
  });

  test('std is non-negative', async () => {
    const ranges = await computeFluxRange(buildDegenerateModel(), 20);
    for (const range of ranges) {
      expect(range.std).toBeGreaterThanOrEqual(0);
    }
  });

  test('flux ranges reflect degeneracy in the model', async () => {
    const ranges = await computeFluxRange(buildDegenerateModel(), 30);

    // R3 should have non-zero std on the optimal face (can vary 0..5)
    const r3Range = ranges.find((r) => r.reactionId === 'R3');
    expect(r3Range).toBeDefined();
    expect(r3Range!.std).toBeGreaterThan(0.1);

    // R2 should have zero std (fixed at 10)
    const r2Range = ranges.find((r) => r.reactionId === 'R2');
    expect(r2Range).toBeDefined();
    expect(r2Range!.std).toBeLessThan(0.5);
  });

  test('all range values are finite', async () => {
    const ranges = await computeFluxRange(buildDegenerateModel(), 10);
    for (const range of ranges) {
      expect(Number.isFinite(range.min)).toBe(true);
      expect(Number.isFinite(range.max)).toBe(true);
      expect(Number.isFinite(range.mean)).toBe(true);
      expect(Number.isFinite(range.std)).toBe(true);
    }
  });

  test('range values are rounded to 4 decimal places', async () => {
    const ranges = await computeFluxRange(buildDegenerateModel(), 5);
    for (const range of ranges) {
      const decimals = (v: number) => {
        const str = v.toString();
        const dot = str.indexOf('.');
        return dot === -1 ? 0 : str.length - dot - 1;
      };
      expect(decimals(range.min)).toBeLessThanOrEqual(4);
      expect(decimals(range.max)).toBeLessThanOrEqual(4);
      expect(decimals(range.mean)).toBeLessThanOrEqual(4);
      expect(decimals(range.std)).toBeLessThanOrEqual(4);
    }
  });
});
