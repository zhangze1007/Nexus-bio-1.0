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
  const denominator = Ki && I ? Km * (1 + I / Ki) + S : Km + S;
  return (Vmax * S) / denominator;
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
  const dt = duration / steps;
  const time = [0];
  const substrate = [S0];
  const product = [P0];
  const velocity = [mmVelocity(S0, Vmax, Km, Ki, I)];

  let S = S0, P = P0;

  for (let i = 0; i < steps; i++) {
    const v = (s: number) => mmVelocity(Math.max(0, s), Vmax, Km, Ki, I);

    const k1s = formationRate - v(S);
    const k2s = formationRate - v(S + dt * k1s / 2);
    const k3s = formationRate - v(S + dt * k2s / 2);
    const k4s = formationRate - v(S + dt * k3s);
    S = Math.max(0, S + (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s));

    const k1p = v(substrate[i]) - degradationRate * P;
    const k2p = v(substrate[i]) - degradationRate * (P + dt * k1p / 2);
    const k3p = v(substrate[i]) - degradationRate * (P + dt * k2p / 2);
    const k4p = v(substrate[i]) - degradationRate * (P + dt * k3p);
    P = Math.max(0, P + (dt / 6) * (k1p + 2 * k2p + 2 * k3p + k4p));

    time.push(parseFloat(((i + 1) * dt).toFixed(3)));
    substrate.push(parseFloat(S.toFixed(4)));
    product.push(parseFloat(P.toFixed(4)));
    velocity.push(parseFloat(v(S).toFixed(4)));
  }

  return { time, substrate, product, velocity };
}
