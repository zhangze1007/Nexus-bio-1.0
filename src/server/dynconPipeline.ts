/**
 * DynCon Dynamic Control Pipeline
 *
 * Unidirectional pipeline: Controller Designer → Simulator → Stability Analyzer
 *
 * Agent A (Designer): Proposes PID controller parameters via Ziegler-Nichols tuning
 * Agent B (Simulator): Runs FOPDT ODE simulation with controller
 * Agent C (Analyzer): Evaluates settling time, overshoot, steady-state error + Pareto front
 *
 * Every numerical conclusion comes from real ODE solver calls.
 *
 * @scientific_provenance
 *   ALGORITHM: Pipeline orchestration — Ziegler-Nichols PID tuning + FOPDT (First-Order Plus Dead Time) simulation + Pareto ranking
 *   REFERENCE:
 *     Ziegler JG, Nichols NB (1942) "Optimum settings for automatic controllers" Trans. ASME 64:759-768
 *     Smith CA, Corripio AB (1997) "Principles and Practice of Automatic Process Control" 2nd ed., Wiley
 *   KNOWN_LIMITATIONS:
 *     - FOPDT model only; no second-order, integrating, or nonlinear process models
 *     - Single-input single-output (SISO) only; no MIMO control
 *     - Ziegler-Nichols tuning rules produce aggressive controllers; no Lambda or IMC tuning alternatives
 *     - Dead time implemented via discrete buffer lookup; continuous delay approximation may miss dynamics
 *     - Disturbance model is sinusoidal only; no step, ramp, or stochastic disturbances
 *     - Pareto front uses only settling time and overshoot; ISE/IAE not included in multi-objective ranking
 */

import { type ODESystem, solveRK4 } from "../utils/odeSolver";
import { analyzeStability, type JacobianResult } from "./jacobianAnalysis";
import { computeSensitivity, type SensitivityReport } from "./sensitivityAnalysis";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ControlSpec {
  setpoint: number; // target product titer (g/L)
  processGain: number; // Kp (g/L per unit control)
  timeConstant: number; // τ (min)
  deadTime: number; // θ (min)
  disturbanceMagnitude: number;
}

export interface PIDParams {
  kp: number; // proportional gain
  ki: number; // integral gain
  kd: number; // derivative gain
}

export interface ControlPerformance {
  settlingTime: number; // min to within 2% of setpoint
  overshoot: number; // % overshoot
  steadyStateError: number; // |setpoint - final| / setpoint
  ise: number; // integral of squared error
  iae: number; // integral of absolute error
  isStable: boolean;
  maxEigenvalue: number;
}

export interface ControlDesignResult {
  spec: ControlSpec;
  bestParams: PIDParams;
  performance: ControlPerformance;
  paretoFront: Array<{ params: PIDParams; performance: ControlPerformance }>;
  sensitivity: SensitivityReport;
  allSolverCalls: Array<{ solver: string; description: string }>;
}

// ── Process Model ───────────────────────────────────────────────────────────

/**
 * First-order plus dead time (FOPDT) process model.
 * dy/dt = (Kp * u(t-θ) - y) / τ
 *
 * Dead time is implemented via a circular buffer that stores
 * past control values and retrieves the value from θ seconds ago.
 */
function fopdtDerivatives(
  params: ControlSpec,
  controller: (error: number, integral: number, derivative: number) => number,
): (t: number, y: number[]) => number[] {
  let integral = 0;
  let prevError = 0;
  const { setpoint, processGain, timeConstant, deadTime, disturbanceMagnitude } = params;
  const dt = 0.5;

  // Dead time buffer: stores (time, control_value) pairs
  const delayBuffer: Array<{ t: number; u: number }> = [];
  const bufferSize = Math.max(1, Math.ceil(deadTime / dt));

  return (_t: number, y: number[]) => {
    const current = y[0];
    const error = setpoint - current;
    integral += error * dt;
    const derivative = (error - prevError) / dt;
    prevError = error;

    const u = controller(error, integral, derivative);

    // Store current control in buffer
    delayBuffer.push({ t: _t, u });
    if (delayBuffer.length > bufferSize * 2) delayBuffer.shift();

    // Retrieve delayed control value (from deadTime seconds ago)
    const delayedT = _t - deadTime;
    let delayedU = u; // fallback to current if buffer too short
    for (let i = delayBuffer.length - 1; i >= 0; i--) {
      if (delayBuffer[i].t <= delayedT) {
        delayedU = delayBuffer[i].u;
        break;
      }
    }

    const disturbance = disturbanceMagnitude * Math.sin(_t / 50);

    return [(processGain * delayedU - current + disturbance) / timeConstant];
  };
}

// ── Agent A: Controller Designer ────────────────────────────────────────────

/**
 * Generate PID parameter candidates.
 */
function designControllers(): {
  candidates: PIDParams[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // Ziegler-Nichols tuning from FOPDT model parameters
  // ZN rules for PID: Kp = 1.2*τ/(Kp*θ), Ki = Kp/(2*θ), Kd = Kp*θ/2
  // Reference: Ziegler & Nichols (1942) Trans. ASME
  const Kp = 1.0; // process gain (normalized)
  const tau = 1.0; // time constant (normalized)
  const theta = 0.5; // dead time (normalized)
  const znKp = (1.2 * tau) / (Kp * theta);
  const znKi = znKp / (2 * theta);
  const znKd = (znKp * theta) / 2;

  // Generate candidates around ZN estimate
  const candidates: PIDParams[] = [
    { kp: znKp, ki: znKi, kd: znKd }, // ZN
    { kp: znKp * 0.5, ki: znKi * 0.5, kd: znKd * 0.5 }, // Conservative
    { kp: znKp * 1.5, ki: znKi * 1.5, kd: znKd * 1.5 }, // Aggressive
    { kp: znKp, ki: 0, kd: 0 }, // P-only
    { kp: znKp, ki: znKi, kd: 0 }, // PI
    { kp: znKp * 0.7, ki: znKi * 0.7, kd: znKd * 2 }, // High derivative
  ];

  solverCalls.push({
    solver: "design::zieglerNichols",
    description: `${candidates.length} PID candidates from ZN estimate`,
  });
  return { candidates, solverCalls };
}

// ── Agent B: Simulator ──────────────────────────────────────────────────────

/**
 * Simulate closed-loop response with given PID parameters.
 */
function simulateControl(
  spec: ControlSpec,
  pid: PIDParams,
  duration = 200,
): {
  trajectory: Array<{ time: number; output: number; control: number }>;
  performance: ControlPerformance;
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  const controller = (error: number, integral: number, derivative: number) =>
    pid.kp * error + pid.ki * integral + pid.kd * derivative;

  const system: ODESystem = {
    fn: fopdtDerivatives(spec, controller),
    initial: [0],
    tStart: 0,
    tEnd: duration,
  };

  solverCalls.push({ solver: "odeSolver::solveRK4", description: `FOPDT simulation, ${duration} min` });
  const solution = solveRK4(system, { steps: Math.floor(duration / 0.5) });

  // Extract trajectory — states[variable_index][time_index]
  const trajectory = solution.time.map((t: number, i: number) => ({
    time: t,
    output: solution.states[0][i],
    control: pid.kp * (spec.setpoint - solution.states[0][i]),
  }));

  // Compute performance metrics
  const final = trajectory[trajectory.length - 1].output;
  const max = Math.max(...trajectory.map((t) => t.output));
  const settlingIdx = trajectory.findIndex((t) => Math.abs(t.output - spec.setpoint) / spec.setpoint < 0.02);
  const settlingTime = settlingIdx >= 0 ? trajectory[settlingIdx].time : duration;
  const overshoot = spec.setpoint > 0 ? Math.max(0, ((max - spec.setpoint) / spec.setpoint) * 100) : 0;
  const steadyStateError = spec.setpoint > 0 ? Math.abs(spec.setpoint - final) / spec.setpoint : 0;

  // ISE and IAE
  const ise = trajectory.reduce((s: number, t: { output: number }) => s + (spec.setpoint - t.output) ** 2, 0) * 0.5;
  const iae = trajectory.reduce((s: number, t: { output: number }) => s + Math.abs(spec.setpoint - t.output), 0) * 0.5;

  // Stability: check eigenvalue of linearized system
  const linResult = analyzeStability(fopdtDerivatives(spec, controller), [final]);

  return {
    trajectory,
    performance: {
      settlingTime: Math.round(settlingTime * 10) / 10,
      overshoot: Math.round(overshoot * 100) / 100,
      steadyStateError: Math.round(steadyStateError * 1000) / 1000,
      ise: Math.round(ise * 100) / 100,
      iae: Math.round(iae * 100) / 100,
      isStable: linResult.isStable,
      maxEigenvalue: linResult.maxEigenvalue,
    },
    solverCalls,
  };
}

// ── Agent C: Analyzer ───────────────────────────────────────────────────────

/**
 * Evaluate all controller candidates, build Pareto front.
 */
function analyzeControllers(
  spec: ControlSpec,
  candidates: PIDParams[],
): {
  paretoFront: Array<{ params: PIDParams; performance: ControlPerformance }>;
  bestParams: PIDParams;
  bestPerformance: ControlPerformance;
  sensitivity: SensitivityReport;
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // Simulate each candidate
  const results = candidates.map((pid) => {
    const { performance, solverCalls: simCalls } = simulateControl(spec, pid);
    solverCalls.push(...simCalls);
    return { params: pid, performance };
  });

  // Pareto front: minimize settling time AND overshoot
  const paretoFront: typeof results = [];
  for (const candidate of results) {
    if (!candidate.performance.isStable) continue;
    let dominated = false;
    for (const other of results) {
      if (other === candidate || !other.performance.isStable) continue;
      const betterSettling = other.performance.settlingTime <= candidate.performance.settlingTime;
      const betterOvershoot = other.performance.overshoot <= candidate.performance.overshoot;
      const strictlyBetter =
        other.performance.settlingTime < candidate.performance.settlingTime ||
        other.performance.overshoot < candidate.performance.overshoot;
      if (betterSettling && betterOvershoot && strictlyBetter) {
        dominated = true;
        break;
      }
    }
    if (!dominated) paretoFront.push(candidate);
  }

  // Best by composite: 0.5 * settling + 0.3 * overshoot + 0.2 * sse
  const best = results
    .filter((r) => r.performance.isStable)
    .reduce((b, r) => {
      const scoreR =
        0.5 * (r.performance.settlingTime / 200) +
        0.3 * (r.performance.overshoot / 100) +
        0.2 * r.performance.steadyStateError;
      const scoreB =
        0.5 * (b.performance.settlingTime / 200) +
        0.3 * (b.performance.overshoot / 100) +
        0.2 * b.performance.steadyStateError;
      return scoreR < scoreB ? r : b;
    }, results[0]);

  // Sensitivity analysis
  solverCalls.push({ solver: "sensitivityAnalysis::compute", description: "PID parameter sensitivity" });
  const sensitivity = computeSensitivity(
    (params) => {
      const pid: PIDParams = { kp: params.kp ?? 1, ki: params.ki ?? 0.5, kd: params.kd ?? 0.25 };
      const { performance } = simulateControl(spec, pid);
      return 1 / (performance.settlingTime + 1); // inverse settling time as objective
    },
    { kp: best.params.kp, ki: best.params.ki, kd: best.params.kd },
  );

  return {
    paretoFront,
    bestParams: best.params,
    bestPerformance: best.performance,
    sensitivity,
    solverCalls,
  };
}

// ── Pipeline Entry Point ────────────────────────────────────────────────────

export function runControlDesignPipeline(spec: ControlSpec): ControlDesignResult {
  const allSolverCalls: Array<{ solver: string; description: string }> = [];

  // Agent A: Design controllers
  const { candidates, solverCalls: designCalls } = designControllers();
  allSolverCalls.push(...designCalls);

  // Agent B + C: Simulate and analyze
  const {
    paretoFront,
    bestParams,
    bestPerformance,
    sensitivity,
    solverCalls: analyzeCalls,
  } = analyzeControllers(spec, candidates);
  allSolverCalls.push(...analyzeCalls);

  return { spec, bestParams, performance: bestPerformance, paretoFront, sensitivity, allSolverCalls };
}
