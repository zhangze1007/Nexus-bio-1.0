# Direction L: Cell-Free & Control

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add parameter calibration (Bayesian estimation from experimental data) to CELLFREE and model predictive control (MPC) to DYNCON.

**Architecture:** Parameter calibration via MCMC sampling (Metropolis-Hastings) over TX-TL ODE parameters. MPC via linearized state-space model + quadratic programming at each timestep.

**Tech Stack:** TypeScript, MCMC sampler, QP solver

---

## Task L1: Implement MCMC Parameter Calibration for CELLFREE

**Files:**
- Create: `src/server/mcmcCalibration.ts`
- Test: `__tests__/cellfree/mcmcCalibration.test.ts`

### Step 1: Write failing test

```typescript
import { calibrateParameters, type CalibrationData, type CalibrationConfig } from '../../src/server/mcmcCalibration';

describe('MCMC calibration', () => {
  it('recovers known parameters from synthetic data', () => {
    // Generate synthetic data with known parameters
    const trueParams = { k_tx: 0.5, k_tl: 2.0, d_mRNA: 0.05 };
    const syntheticData = generateSyntheticData(trueParams);

    const result = calibrateParameters(syntheticData, {
      nSamples: 1000,
      burnIn: 200,
      priorRanges: { k_tx: [0.01, 5], k_tl: [0.1, 20], d_mRNA: [0.001, 0.5] },
    });

    // Posterior mean should be close to true values
    expect(result.posteriorMean.k_tx).toBeCloseTo(0.5, 0);
    expect(result.posteriorMean.k_tl).toBeCloseTo(2.0, 0);
    expect(result.posteriorMean.d_mRNA).toBeCloseTo(0.05, 1);
  });

  it('provides uncertainty estimates', () => {
    const result = calibrateParameters(syntheticData, { nSamples: 500, burnIn: 100 });
    expect(result.posteriorStd.k_tx).toBeGreaterThan(0);
    expect(result.credibleInterval.k_tx).toHaveLength(2); // [lower, upper]
  });
});
```

### Step 2-5: TDD implementation

Metropolis-Hastings MCMC:
- Likelihood: Gaussian noise model on observed time-series
- Prior: uniform on parameter ranges
- Proposal: Gaussian random walk
- Posterior: samples from MCMC chain → mean, std, credible intervals

---

## Task L2: Implement MPC for DYNCON

**Files:**
- Create: `src/server/modelPredictiveControl.ts`
- Test: `__tests__/dyncon/mpc.test.ts`

### Step 1: Write failing test

```typescript
import { runMPC, type MPCConfig, type MPCResult } from '../../src/server/modelPredictiveControl';

describe('MPC', () => {
  it('tracks setpoint with constraint satisfaction', () => {
    const config: MPCConfig = {
      predictionHorizon: 10,
      controlHorizon: 5,
      dt: 0.1,
      setpoint: 1.0,
      stateConstraints: { min: [0, 0, 0], max: [10, 10, 10] },
      controlConstraints: { min: [0], max: [3] },
      costWeights: { state: [1, 0, 0], control: 0.1 },
    };
    const initialState = [0.5, 0.3, 0.1]; // biomass, substrate, product
    const result = runMPC(initialState, config, 100); // 100 steps

    // Should converge to setpoint
    const finalBiomass = result.trajectories[0][result.trajectories[0].length - 1];
    expect(finalBiomass).toBeCloseTo(1.0, 1);

    // Control should stay within bounds
    expect(result.controlSignals.every(u => u >= 0 && u <= 3)).toBe(true);
  });
});
```

### Step 2-5: TDD implementation

MPC:
- Linearize state-space model at each timestep
- Solve QP: minimize sum(setpoint_error² + control_effort²)
- Apply first control signal, advance state, repeat
- Use existing RK4 as internal model

---

## Task L3: Add Calibration UI to CELLFREE

**Files:** Modify: `src/components/tools/CellFreePage.tsx`

### Step 1: Add "Calibration" tab with data upload, MCMC progress, posterior distributions.

### Step 2: Commit

---

## Task L4: Add MPC Mode to DYNCON

**Files:** Modify: `src/components/tools/DynConPage.tsx`

### Step 1: Add MPC controller option alongside PID. Show prediction horizon, constraint violations, cost function.

### Step 2: Commit

---

## Summary

| Task | What It Builds | Priority |
|------|---------------|----------|
| L1 | MCMC parameter calibration | 🟡 IMPORTANT |
| L2 | Model predictive control | 🟡 IMPORTANT |
| L3 | Calibration UI | 🟡 IMPORTANT |
| L4 | MPC UI | 🟡 IMPORTANT |

**Total: 4 tasks, ~12 commits**
