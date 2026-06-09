/**
 * Michaelis-Menten kinetics and RK4 ODE solver.
 * Extracted from KineticPanel for testability and reuse.
 */

export interface SimResult {
  time: number[];
  substrate: number[];
  product: number[];
  velocity: number[];
}

/** Michaelis-Menten velocity with optional competitive inhibition. */
export function mmVelocity(S: number, Vmax: number, Km: number, Ki?: number, I?: number): number {
  const sSafe = Math.max(0, S);
  const kmEff = Ki !== undefined && I !== undefined && Ki > 0 && I > 0
    ? Km * (1 + I / Ki)
    : Km;
  const denominator = kmEff + sSafe;
  if (denominator <= 0) return 0; // guard against Km=0, S=0
  return (Vmax * sSafe) / denominator;
}

/**
 * RK4 ODE solver for single-enzyme pathway.
 * dS/dt = -v(S) + formation_rate
 * dP/dt = +v(S) - degradation_rate * P
 */
export function runRK4(
  S0: number, P0: number,
  Vmax: number, Km: number,
  formationRate: number, degradationRate: number,
  Ki: number | undefined, I: number | undefined,
  duration: number, steps: number
): SimResult {
  // Guard against degenerate inputs
  if (steps <= 0 || duration <= 0) {
    return {
      time: [0],
      substrate: [S0],
      product: [P0],
      velocity: [mmVelocity(S0, Vmax, Km, Ki, I)],
    };
  }

  const dt = duration / steps;
  const time = [0];
  const substrate = [S0];
  const product = [P0];
  const velocity = [mmVelocity(S0, Vmax, Km, Ki, I)];

  let S = S0, P = P0;

  for (let i = 0; i < steps; i++) {
    const v = (s: number) => mmVelocity(Math.max(0, s), Vmax, Km, Ki, I);
    const dS = (s: number) => formationRate - v(s);
    const dP = (s: number, p: number) => v(s) - degradationRate * p;

    // Save original state for coupled RK4 — all k-values must reference the
    // same starting state to preserve conservation laws.
    const S0i = S, P0i = P;

    const k1s = dS(S0i);
    const k1p = dP(S0i, P0i);

    const k2s = dS(S0i + dt * k1s / 2);
    const k2p = dP(S0i + dt * k1s / 2, P0i + dt * k1p / 2);

    const k3s = dS(S0i + dt * k2s / 2);
    const k3p = dP(S0i + dt * k2s / 2, P0i + dt * k2p / 2);

    const k4s = dS(S0i + dt * k3s);
    const k4p = dP(S0i + dt * k3s, P0i + dt * k3p);

    S = Math.max(0, S0i + (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s));
    P = Math.max(0, P0i + (dt / 6) * (k1p + 2 * k2p + 2 * k3p + k4p));

    time.push(parseFloat(((i + 1) * dt).toFixed(3)));
    substrate.push(parseFloat(S.toFixed(4)));
    product.push(parseFloat(P.toFixed(4)));
    velocity.push(parseFloat(v(S).toFixed(4)));
  }

  return { time, substrate, product, velocity };
}
