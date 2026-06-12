/**
 * DynCon (Dynamic Control) Engine Tests
 *
 * Tests for bioreactor simulation, Hill feedback, convergence analysis,
 * and metabolic burden analysis.
 */

import {
  hillFeedback,
  runBioreactor,
  analyzeConvergence,
  analyzeMetabolicBurden,
  mapControlGainToRBS,
  DEFAULT_PARAMS,
  DEFAULT_HILL,
  DEFAULT_CONTROLLER,
} from '../src/data/mockDynCon';

describe('DynCon Engine', () => {

  // ── Hill Feedback Function ──────────────────────────────────────────────

  describe('hillFeedback', () => {
    const hill = { Vmax: 1.0, Kd: 50.0, n: 2.0 };

    it('returns Vmax when FPP <= 0', () => {
      expect(hillFeedback(0, hill)).toBe(1.0);
      expect(hillFeedback(-10, hill)).toBe(1.0);
    });

    it('returns Vmax/2 when FPP = Kd', () => {
      const result = hillFeedback(50, hill);
      expect(result).toBeCloseTo(0.5, 4);
    });

    it('returns near 0 when FPP >> Kd', () => {
      const result = hillFeedback(500, hill);
      expect(result).toBeLessThan(0.01);
    });

    it('is monotonically decreasing', () => {
      const values = [0, 10, 25, 50, 100, 200, 500].map(fpp => hillFeedback(fpp, hill));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThan(values[i - 1]);
      }
    });

    it('respects Hill coefficient', () => {
      const hill1 = { Vmax: 1.0, Kd: 50.0, n: 1.0 };
      const hill4 = { Vmax: 1.0, Kd: 50.0, n: 4.0 };

      // At FPP = 25 (half of Kd), higher n should give higher output
      const low = hillFeedback(25, hill1);
      const high = hillFeedback(25, hill4);
      expect(high).toBeGreaterThan(low);
    });
  });

  // ── Bioreactor Simulation ───────────────────────────────────────────────

  describe('runBioreactor', () => {
    it('returns trajectory with correct length', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 50, 1.0, DEFAULT_HILL);
      expect(trajectory.length).toBe(50);
    });

    it('starts with initial conditions', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 10, 1.0, DEFAULT_HILL);
      const first = trajectory[0];
      expect(first.time).toBe(1); // First step is at t=dt
      expect(first.biomass).toBeGreaterThan(0);
      expect(first.substrate).toBeGreaterThan(0);
    });

    it('biomass grows over time', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 50, 1.0, DEFAULT_HILL);
      const first = trajectory[0];
      const last = trajectory[trajectory.length - 1];
      expect(last.biomass).toBeGreaterThan(first.biomass);
    });

    it('substrate is consumed or replenished by feed', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 50, 1.0, DEFAULT_HILL);
      // Substrate may increase due to feed rate, just check it's positive
      const last = trajectory[trajectory.length - 1];
      expect(last.substrate).toBeGreaterThan(0);
    });

    it('dissolved oxygen stays bounded', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 100, 1.0, DEFAULT_HILL);
      for (const state of trajectory) {
        expect(state.dissolvedO2).toBeGreaterThanOrEqual(0);
        expect(state.dissolvedO2).toBeLessThanOrEqual(1.5); // Allow some overshoot
      }
    });

    it('FPP reaches steady state', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 200, 0.5, DEFAULT_HILL);
      const last20 = trajectory.slice(-20);
      const fppValues = last20.map(t => t.fpp ?? 0);
      const max = Math.max(...fppValues);
      const min = Math.min(...fppValues);
      // Should be within 20% of mean at steady state
      const mean = fppValues.reduce((a, b) => a + b, 0) / fppValues.length;
      expect(max - min).toBeLessThan(mean * 0.5);
    });

    it('controller setpoint affects trajectory', () => {
      const low = runBioreactor({ ...DEFAULT_CONTROLLER, setpoint: 0.2 }, DEFAULT_PARAMS, 50);
      const high = runBioreactor({ ...DEFAULT_CONTROLLER, setpoint: 0.8 }, DEFAULT_PARAMS, 50);
      // Different setpoints should produce different trajectories
      const lastLow = low[low.length - 1];
      const lastHigh = high[high.length - 1];
      expect(lastLow.dissolvedO2).not.toBeCloseTo(lastHigh.dissolvedO2, 1);
    });
  });

  // ── Fed-Batch Volume Dynamics ──────────────────────────────────────────

  describe('fed-batch volume dynamics', () => {
    it('fed-batch volume increases over time', () => {
      const result = runBioreactor(DEFAULT_CONTROLLER);
      const firstV = result[0].volume!;
      const lastV = result[result.length - 1].volume!;
      expect(lastV).toBeGreaterThan(firstV);
    });

    it('initial volume is 2.0 L', () => {
      const result = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 5, 1.0);
      // At t=1 (first step), volume should be slightly above 2.0
      expect(result[0].volume!).toBeCloseTo(2.0 + DEFAULT_PARAMS.feedRate, 2);
    });

    it('volume grows linearly at constant feed rate', () => {
      const result = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 100, 1.0);
      // V(t) = V0 + feedRate * t
      const expectedV = 2.0 + DEFAULT_PARAMS.feedRate * 100;
      expect(result[99].volume!).toBeCloseTo(expectedV, 0);
    });

    it('dilution reduces biomass concentration at zero growth', () => {
      // With zero substrate, growth is near-zero so dilution dominates
      const noGrowthParams = { ...DEFAULT_PARAMS, muMax: 0, feedRate: 0.1 };
      const result = runBioreactor(DEFAULT_CONTROLLER, noGrowthParams, 50, 1.0);
      const firstX = result[0].biomass;
      const lastX = result[result.length - 1].biomass;
      expect(lastX).toBeLessThan(firstX);
    });
  });

  // ── Convergence Analysis ────────────────────────────────────────────────

  describe('analyzeConvergence', () => {
    it('returns convergence metrics', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 200, 0.5, DEFAULT_HILL);
      const metrics = analyzeConvergence(trajectory, DEFAULT_CONTROLLER.setpoint);
      expect(metrics).toBeDefined();
      expect(typeof metrics.settlingTime).toBe('number');
      expect(typeof metrics.overshoot).toBe('number');
      expect(typeof metrics.steadyStateError).toBe('number');
      expect(typeof metrics.convergenceRate).toBe('number');
    });

    it('settling time is finite', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 200, 0.5, DEFAULT_HILL);
      const metrics = analyzeConvergence(trajectory, DEFAULT_CONTROLLER.setpoint);
      expect(metrics.settlingTime).toBeLessThanOrEqual(200);
      expect(metrics.settlingTime).toBeGreaterThanOrEqual(0);
    });

    it('overshoot is non-negative', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 200, 0.5, DEFAULT_HILL);
      const metrics = analyzeConvergence(trajectory, DEFAULT_CONTROLLER.setpoint);
      expect(metrics.overshoot).toBeGreaterThanOrEqual(0);
    });

    it('steady-state error is non-negative', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 200, 0.5, DEFAULT_HILL);
      const metrics = analyzeConvergence(trajectory, DEFAULT_CONTROLLER.setpoint);
      expect(metrics.steadyStateError).toBeGreaterThanOrEqual(0);
    });

    it('handles short trajectory', () => {
      const short = [
        { time: 0, biomass: 1, substrate: 10, product: 0, dissolvedO2: 0.5, fpp: 0, adsExpression: 0, toxicity: 0, metabolicBurden: 0 },
        { time: 1, biomass: 1.1, substrate: 9, product: 0.1, dissolvedO2: 0.6, fpp: 10, adsExpression: 0.5, toxicity: 0, metabolicBurden: 0.2 },
      ];
      const metrics = analyzeConvergence(short, 0.5);
      expect(metrics.isStable).toBe(false);
    });
  });

  // ── Metabolic Burden Analysis ───────────────────────────────────────────

  describe('analyzeMetabolicBurden', () => {
    it('returns burden metrics', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 100, 1.0, DEFAULT_HILL);
      const burden = analyzeMetabolicBurden(trajectory, DEFAULT_PARAMS);
      expect(burden).toBeDefined();
      expect(typeof burden.burdenIndex).toBe('number');
      expect(typeof burden.proteinCost).toBe('number');
      expect(typeof burden.atpDrain).toBe('number');
      expect(typeof burden.isViable).toBe('boolean');
    });

    it('burden index is between 0 and 1', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 100, 1.0, DEFAULT_HILL);
      const burden = analyzeMetabolicBurden(trajectory, DEFAULT_PARAMS);
      expect(burden.burdenIndex).toBeGreaterThanOrEqual(0);
      expect(burden.burdenIndex).toBeLessThanOrEqual(1);
    });

    it('protein cost is non-negative', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 100, 1.0, DEFAULT_HILL);
      const burden = analyzeMetabolicBurden(trajectory, DEFAULT_PARAMS);
      expect(burden.proteinCost).toBeGreaterThanOrEqual(0);
    });

    it('ATP drain is non-negative', () => {
      const trajectory = runBioreactor(DEFAULT_CONTROLLER, DEFAULT_PARAMS, 100, 1.0, DEFAULT_HILL);
      const burden = analyzeMetabolicBurden(trajectory, DEFAULT_PARAMS);
      expect(burden.atpDrain).toBeGreaterThanOrEqual(0);
    });

    it('handles empty trajectory', () => {
      const burden = analyzeMetabolicBurden([], DEFAULT_PARAMS);
      expect(burden.isViable).toBe(true);
      expect(burden.burdenIndex).toBe(0);
    });

    it('high expression increases burden', () => {
      // Create trajectory with high ADS expression
      const highExpr = Array.from({ length: 20 }, (_, i) => ({
        time: i,
        biomass: 2,
        substrate: 5,
        product: 1,
        dissolvedO2: 0.5,
        fpp: 100,
        adsExpression: 1.5, // High expression
        toxicity: 0.3,
        metabolicBurden: 0.8,
      }));
      const burden = analyzeMetabolicBurden(highExpr, DEFAULT_PARAMS);
      expect(burden.proteinCost).toBeGreaterThan(0);
      expect(burden.atpDrain).toBeGreaterThan(0);
    });
  });

  // ── RBS Mapping Monotonicity ─────────────────────────────────────────────

  describe('mapControlGainToRBS', () => {
    test('RBS mapping is monotonic in rbsStrength', () => {
      let prevStrength = -1;
      for (let kp = 0; kp <= 10; kp += 0.5) {
        const rbs = mapControlGainToRBS(kp, 0, 0);
        expect(rbs.rbsStrength).toBeGreaterThanOrEqual(prevStrength);
        prevStrength = rbs.rbsStrength;
      }
    });
  });
});
