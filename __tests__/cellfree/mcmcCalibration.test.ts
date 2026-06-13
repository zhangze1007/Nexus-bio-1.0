/**
 * MCMC Parameter Calibration — Metropolis-Hastings sampler tests.
 *
 * Verifies that the sampler can recover known kinetic parameters from
 * synthetic time-series data and produces well-formed uncertainty estimates.
 */

import {
  calibrateParameters,
  type CalibrationData,
  type CalibrationConfig,
} from '../../src/server/mcmcCalibration';

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Exponential decay model: y(t) = a * exp(-b * t).
 * Both parameters are independently identifiable:
 *   - a controls the y-intercept
 *   - b controls the decay rate (time constant)
 */
function exponentialDecayModel(
  params: Record<string, number>,
  timepoints: number[],
): Record<string, number[]> {
  const { a, b } = params;
  return {
    y: timepoints.map(t => a * Math.exp(-b * t)),
  };
}

/**
 * Two-output reaction kinetics model:
 *   y(t) = Vmax / Km * t           (linear accumulation)
 *   z(t) = Vmax * (1 - exp(-t/Km)) (saturation)
 * Vmax and Km are independently identifiable from the two outputs.
 */
function reactionKineticsModel(
  params: Record<string, number>,
  timepoints: number[],
): Record<string, number[]> {
  const { Vmax, Km } = params;
  return {
    y: timepoints.map(t => (Vmax / Km) * t),
    z: timepoints.map(t => Vmax * (1 - Math.exp(-t / Km))),
  };
}

// ── tests ───────────────────────────────────────────────────────────────────

describe('MCMC calibration', () => {
  it('recovers known parameters from synthetic data (exponential decay)', () => {
    const trueParams = { a: 3.0, b: 0.5 };
    const timepoints = [0, 0.5, 1, 2, 3, 5, 8];
    const modelFn = (p: Record<string, number>) => exponentialDecayModel(p, timepoints);

    const syntheticData: CalibrationData = {
      timepoints,
      observations: modelFn(trueParams),
    };

    const config: CalibrationConfig = {
      nSamples: 1200,
      burnIn: 300,
      priorRanges: { a: [0.1, 10], b: [0.01, 3] },
    };

    const result = calibrateParameters(syntheticData, config, modelFn);

    // Posterior means should be close to true values
    expect(result.posteriorMean.a).toBeCloseTo(3.0, 0);
    expect(result.posteriorMean.b).toBeCloseTo(0.5, 0);
  });

  it('recovers known parameters from synthetic data (two-output model)', () => {
    const trueParams = { Vmax: 5.0, Km: 2.0 };
    const timepoints = [0, 0.5, 1, 2, 4, 6, 10];
    const modelFn = (p: Record<string, number>) => reactionKineticsModel(p, timepoints);

    const syntheticData: CalibrationData = {
      timepoints,
      observations: modelFn(trueParams),
    };

    const config: CalibrationConfig = {
      nSamples: 1200,
      burnIn: 300,
      priorRanges: { Vmax: [0.5, 20], Km: [0.1, 10] },
    };

    const result = calibrateParameters(syntheticData, config, modelFn);

    expect(result.posteriorMean.Vmax).toBeCloseTo(5.0, 0);
    expect(result.posteriorMean.Km).toBeCloseTo(2.0, 0);
  });

  it('provides uncertainty estimates with positive std and valid credible intervals', () => {
    const trueParams = { a: 3.0, b: 0.5 };
    const timepoints = [0, 0.5, 1, 2, 3, 5, 8];
    const modelFn = (p: Record<string, number>) => exponentialDecayModel(p, timepoints);

    const syntheticData: CalibrationData = {
      timepoints,
      observations: modelFn(trueParams),
    };

    const config: CalibrationConfig = {
      nSamples: 600,
      burnIn: 150,
      priorRanges: { a: [0.1, 10], b: [0.01, 3] },
    };

    const result = calibrateParameters(syntheticData, config, modelFn);

    // Std must be positive
    expect(result.posteriorStd.a).toBeGreaterThan(0);
    expect(result.posteriorStd.b).toBeGreaterThan(0);

    // Credible intervals: lower < mean < upper
    expect(result.credibleInterval.a).toHaveLength(2);
    expect(result.credibleInterval.a[0]).toBeLessThan(result.posteriorMean.a);
    expect(result.credibleInterval.a[1]).toBeGreaterThan(result.posteriorMean.a);

    expect(result.credibleInterval.b).toHaveLength(2);
    expect(result.credibleInterval.b[0]).toBeLessThan(result.posteriorMean.b);
    expect(result.credibleInterval.b[1]).toBeGreaterThan(result.posteriorMean.b);
  });

  it('acceptance rate is within a healthy range', () => {
    const trueParams = { a: 3.0, b: 0.5 };
    const timepoints = [0, 0.5, 1, 2, 3, 5, 8];
    const modelFn = (p: Record<string, number>) => exponentialDecayModel(p, timepoints);

    const syntheticData: CalibrationData = {
      timepoints,
      observations: modelFn(trueParams),
    };

    const config: CalibrationConfig = {
      nSamples: 500,
      burnIn: 100,
      priorRanges: { a: [0.1, 10], b: [0.01, 3] },
    };

    const result = calibrateParameters(syntheticData, config, modelFn);

    expect(result.acceptanceRate).toBeGreaterThan(0.05);
    expect(result.acceptanceRate).toBeLessThan(0.98);
  });

  it('returns the correct number of post-burn-in samples', () => {
    const trueParams = { a: 2.0, b: 0.3 };
    const timepoints = [0, 1, 3, 5];
    const modelFn = (p: Record<string, number>) => exponentialDecayModel(p, timepoints);

    const syntheticData: CalibrationData = {
      timepoints,
      observations: modelFn(trueParams),
    };

    const nSamples = 300;
    const burnIn = 100;
    const config: CalibrationConfig = {
      nSamples,
      burnIn,
      priorRanges: { a: [0.1, 10], b: [0.01, 3] },
    };

    const result = calibrateParameters(syntheticData, config, modelFn);

    // Post-burn-in samples should be nSamples - burnIn
    expect(result.samples.a).toHaveLength(nSamples - burnIn);
    expect(result.samples.b).toHaveLength(nSamples - burnIn);
  });

  it('respects prior ranges — no samples outside bounds', () => {
    const trueParams = { a: 3.0, b: 0.5 };
    const timepoints = [0, 0.5, 1, 2, 3, 5, 8];
    const modelFn = (p: Record<string, number>) => exponentialDecayModel(p, timepoints);

    const syntheticData: CalibrationData = {
      timepoints,
      observations: modelFn(trueParams),
    };

    const priorRanges: Record<string, [number, number]> = { a: [0.1, 10], b: [0.01, 3] };
    const config: CalibrationConfig = {
      nSamples: 400,
      burnIn: 100,
      priorRanges,
    };

    const result = calibrateParameters(syntheticData, config, modelFn);

    for (const param of ['a', 'b']) {
      const [lo, hi] = priorRanges[param];
      for (const v of result.samples[param]) {
        expect(v).toBeGreaterThanOrEqual(lo);
        expect(v).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('converges with custom proposal standard deviation', () => {
    const trueParams = { a: 5.0, b: 1.0 };
    const timepoints = [0, 0.5, 1, 1.5, 2, 3, 5];
    const modelFn = (p: Record<string, number>) => exponentialDecayModel(p, timepoints);

    const syntheticData: CalibrationData = {
      timepoints,
      observations: modelFn(trueParams),
    };

    const config: CalibrationConfig = {
      nSamples: 1000,
      burnIn: 300,
      priorRanges: { a: [0.1, 10], b: [0.01, 3] },
      proposalStd: { a: 0.5, b: 0.1 },
    };

    const result = calibrateParameters(syntheticData, config, modelFn);

    expect(result.posteriorMean.a).toBeCloseTo(5.0, 0);
    expect(result.posteriorMean.b).toBeCloseTo(1.0, 0);
  });

  it('sets converged to true when posterior is tight around true value', () => {
    const trueParams = { a: 3.0, b: 0.5 };
    const timepoints = [0, 0.5, 1, 2, 3, 5, 8];
    const modelFn = (p: Record<string, number>) => exponentialDecayModel(p, timepoints);

    const syntheticData: CalibrationData = {
      timepoints,
      observations: modelFn(trueParams),
    };

    const config: CalibrationConfig = {
      nSamples: 1200,
      burnIn: 300,
      priorRanges: { a: [0.1, 10], b: [0.01, 3] },
    };

    const result = calibrateParameters(syntheticData, config, modelFn);

    // With noiseless data and enough samples, convergence flag should be true
    expect(result.converged).toBe(true);
  });
});
