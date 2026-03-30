import type { ODEState, ControllerParams } from '../types';

// Fed-batch bioreactor ODE simulation (Monod kinetics + DO2 PID control)
// State: [X: biomass, S: substrate, P: product, O: dissolved O2]

export const DEFAULT_CONTROLLER: ControllerParams = { kp: 2.0, ki: 0.5, kd: 0.1, setpoint: 0.4 };

export interface BioreactorParams {
  muMax: number;    // max growth rate h-1
  Ks: number;       // substrate affinity constant g/L
  Yxs: number;      // biomass yield g/g
  Yps: number;      // product yield g/g
  kLa: number;      // oxygen transfer coefficient h-1
  OstarSat: number; // O2 saturation mg/L
  feedConc: number; // substrate feed concentration g/L
  feedRate: number; // feed rate L/h
}

export const DEFAULT_PARAMS: BioreactorParams = {
  muMax: 0.4, Ks: 0.15, Yxs: 0.45, Yps: 0.38,
  kLa: 250, OstarSat: 8, feedConc: 400, feedRate: 0.02,
};

function monodRate(S: number, O: number, p: BioreactorParams) {
  const muO = O > 0 ? O / (0.2 + O) : 0;
  return p.muMax * (S / (p.Ks + S)) * muO;
}

export function runBioreactor(
  controller: ControllerParams,
  params: BioreactorParams = DEFAULT_PARAMS,
  steps = 100,
  dt = 1.0,
): ODEState[] {
  const states: ODEState[] = [];
  let X = 0.5, S = 20.0, P = 0.0, O = params.OstarSat;
  let integral = 0, prevErr = 0;
  const V = 2.0; // working volume L

  for (let i = 0; i < steps; i++) {
    const mu = monodRate(S, O, params);
    const dX = mu * X;
    const dS = -dX / params.Yxs + params.feedRate * (params.feedConc - S) / V;
    const dP = params.Yps * dX;
    const dO = params.kLa * (params.OstarSat - O) - mu * X * 0.18;

    // PID controller on airflow (affects kLa scaling)
    const err = controller.setpoint - O / params.OstarSat;
    integral += err * dt;
    const derivative = (err - prevErr) / dt;
    const airflowScale = Math.max(0, Math.min(3, 1 + controller.kp * err + controller.ki * integral + controller.kd * derivative));
    prevErr = err;

    X = Math.max(0, X + dX * dt);
    S = Math.max(0, S + dS * dt);
    P = Math.max(0, P + dP * dt);
    O = Math.max(0, Math.min(params.OstarSat * 1.2, O + dO * dt * airflowScale));

    states.push({ time: i * dt, biomass: X, substrate: S, product: P, dissolvedO2: O / params.OstarSat });
  }
  return states;
}

export const BASELINE_TRAJECTORY = runBioreactor(DEFAULT_CONTROLLER);
