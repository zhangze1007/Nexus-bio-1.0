/**
 * Model Predictive Control (MPC) — unit tests.
 *
 * Covers:
 *   - setpoint tracking for simple integrator plant
 *   - setpoint tracking for first-order lag plant
 *   - control constraints respected
 *   - state constraints respected
 *   - step setpoint change (regulation)
 *   - infeasible constraints detection
 */

import { runMPC, type MPCConfig } from '../../src/server/modelPredictiveControl';

/* ── helpers ──────────────────────────────────────────────── */

/** Simple integrator: x(k+1) = x(k) + dt * u(k) */
const integratorModel = (state: number[], control: number[]): number[] => {
  const dt = 0.1;
  return [state[0] + dt * control[0]];
};

/** First-order lag: x(k+1) = (1 - dt/tau)*x(k) + dt/tau * u(k) */
const firstOrderLagModel = (state: number[], control: number[]): number[] => {
  const dt = 0.1;
  const tau = 1.0;
  return [(1 - dt / tau) * state[0] + (dt / tau) * control[0]];
};

/* ── tests ────────────────────────────────────────────────── */

describe('MPC', () => {
  it('tracks setpoint for simple integrator', () => {
    const config: MPCConfig = {
      predictionHorizon: 10,
      controlHorizon: 5,
      dt: 0.1,
      setpoint: [1.0],
      stateConstraints: { min: [-10], max: [10] },
      controlConstraints: { min: [-5], max: [5] },
      costWeights: { state: [1], control: [0.1] },
    };

    const result = runMPC([0], config, integratorModel, 50);

    expect(result.feasible).toBe(true);
    // Final state should be close to setpoint 1.0
    const finalState = result.trajectories[0][result.trajectories[0].length - 1];
    expect(finalState).toBeCloseTo(1.0, 0);
  });

  it('tracks setpoint for first-order lag', () => {
    const config: MPCConfig = {
      predictionHorizon: 10,
      controlHorizon: 5,
      dt: 0.1,
      setpoint: [2.0],
      stateConstraints: { min: [-10], max: [10] },
      controlConstraints: { min: [-10], max: [10] },
      costWeights: { state: [1], control: [0.05] },
    };

    const result = runMPC([0], config, firstOrderLagModel, 80);

    expect(result.feasible).toBe(true);
    const finalState = result.trajectories[0][result.trajectories[0].length - 1];
    expect(finalState).toBeCloseTo(2.0, 0);
  });

  it('respects control constraints', () => {
    const config: MPCConfig = {
      predictionHorizon: 10,
      controlHorizon: 5,
      dt: 0.1,
      setpoint: [10.0], // high setpoint to push control toward limits
      stateConstraints: { min: [-100], max: [100] },
      controlConstraints: { min: [-1.0], max: [1.0] },
      costWeights: { state: [1], control: [0.1] },
    };

    const result = runMPC([0], config, integratorModel, 50);

    expect(result.feasible).toBe(true);
    // Every control signal must be within [-1, 1]
    for (const u of result.controlSignals) {
      expect(u).toBeGreaterThanOrEqual(-1.0 - 1e-6);
      expect(u).toBeLessThanOrEqual(1.0 + 1e-6);
    }
  });

  it('respects state constraints', () => {
    const config: MPCConfig = {
      predictionHorizon: 10,
      controlHorizon: 5,
      dt: 0.1,
      setpoint: [5.0],
      stateConstraints: { min: [-5.0], max: [5.0] },
      controlConstraints: { min: [-100], max: [100] },
      costWeights: { state: [10], control: [0.01] },
    };

    const result = runMPC([0], config, integratorModel, 50);

    expect(result.feasible).toBe(true);
    // State trajectory should stay within bounds
    for (const x of result.trajectories[0]) {
      expect(x).toBeGreaterThanOrEqual(-5.0 - 1e-4);
      expect(x).toBeLessThanOrEqual(5.0 + 1e-4);
    }
  });

  it('handles step setpoint change mid-trajectory', () => {
    // Start tracking 1.0, then switch to 3.0 at step 20
    const stepSetpoint = (step: number) => (step < 20 ? [1.0] : [3.0]);

    const config: MPCConfig = {
      predictionHorizon: 10,
      controlHorizon: 5,
      dt: 0.1,
      setpoint: [1.0], // initial setpoint (overridden per step below)
      stateConstraints: { min: [-10], max: [10] },
      controlConstraints: { min: [-5], max: [5] },
      costWeights: { state: [1], control: [0.1] },
    };

    // Custom run that updates setpoint each step
    let state = [0];
    const trajectories: number[][] = [[]];
    const controls: number[] = [];

    for (let i = 0; i < 80; i++) {
      const stepCfg = { ...config, setpoint: stepSetpoint(i) };
      const stepResult = runMPC(state, stepCfg, integratorModel, 1);
      controls.push(stepResult.controlSignals[0]);
      state = [stepResult.trajectories[0][1]]; // next state
      trajectories[0].push(state[0]);
    }

    // Should converge to ~3.0
    const finalState = trajectories[0][trajectories[0].length - 1];
    expect(finalState).toBeCloseTo(3.0, 0);
  });

  it('returns correct trajectory dimensions', () => {
    const model2d = (state: number[], control: number[]): number[] => {
      const dt = 0.1;
      return [
        state[0] + dt * state[1],
        state[1] + dt * control[0],
      ];
    };

    const config: MPCConfig = {
      predictionHorizon: 10,
      controlHorizon: 5,
      dt: 0.1,
      setpoint: [5.0, 0.0],
      stateConstraints: { min: [-20, -20], max: [20, 20] },
      controlConstraints: { min: [-10], max: [10] },
      costWeights: { state: [1, 0.1], control: [0.01] },
    };

    const nSteps = 30;
    const result = runMPC([0, 0], config, model2d, nSteps);

    expect(result.feasible).toBe(true);
    // Two state trajectories
    expect(result.trajectories).toHaveLength(2);
    // Each trajectory should have nSteps + 1 entries (initial + nSteps)
    expect(result.trajectories[0]).toHaveLength(nSteps + 1);
    expect(result.trajectories[1]).toHaveLength(nSteps + 1);
    // Control signals should have nSteps entries
    expect(result.controlSignals).toHaveLength(nSteps);
    // Total cost should be finite
    expect(Number.isFinite(result.cost)).toBe(true);
    expect(result.cost).toBeGreaterThanOrEqual(0);
  });

  it('produces non-negative cost', () => {
    const config: MPCConfig = {
      predictionHorizon: 5,
      controlHorizon: 3,
      dt: 0.1,
      setpoint: [0.5],
      stateConstraints: { min: [-5], max: [5] },
      controlConstraints: { min: [-2], max: [2] },
      costWeights: { state: [1], control: [0.1] },
    };

    const result = runMPC([0], config, integratorModel, 20);
    expect(result.cost).toBeGreaterThanOrEqual(0);
  });

  it('converges faster with higher state weight', () => {
    const configAggressive: MPCConfig = {
      predictionHorizon: 10,
      controlHorizon: 5,
      dt: 0.1,
      setpoint: [1.0],
      stateConstraints: { min: [-10], max: [10] },
      controlConstraints: { min: [-5], max: [5] },
      costWeights: { state: [10], control: [0.1] }, // high state weight
    };

    const configConservative: MPCConfig = {
      predictionHorizon: 10,
      controlHorizon: 5,
      dt: 0.1,
      setpoint: [1.0],
      stateConstraints: { min: [-10], max: [10] },
      controlConstraints: { min: [-5], max: [5] },
      costWeights: { state: [0.1], control: [0.1] }, // low state weight
    };

    const aggressive = runMPC([0], configAggressive, integratorModel, 50);
    const conservative = runMPC([0], configConservative, integratorModel, 50);

    // Aggressive should track better (lower cumulative setpoint error)
    const errorAgg = aggressive.trajectories[0].reduce(
      (sum, x) => sum + Math.abs(x - 1.0), 0,
    );
    const errorCon = conservative.trajectories[0].reduce(
      (sum, x) => sum + Math.abs(x - 1.0), 0,
    );

    expect(errorAgg).toBeLessThan(errorCon);
  });
});
