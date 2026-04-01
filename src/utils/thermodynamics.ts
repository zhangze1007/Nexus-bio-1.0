/**
 * Thermodynamics calculations.
 * Extracted from ThermodynamicsPanel for testability and reuse.
 */

export const R = 8.314e-3; // kJ/mol·K

/** Calculate actual ΔG from standard ΔG°, temperature, and concentrations. */
export function calcDeltaG(dG0: number, T: number, products: number[], reactants: number[]): number {
  const Q = products.reduce((a, b) => a * b, 1) / reactants.reduce((a, b) => a * b, 1);
  return dG0 + R * T * Math.log(Q || 1e-10);
}

/** Calculate equilibrium constant from ΔG°. */
export function calcKeq(dG0: number, T: number): number {
  return Math.exp(-dG0 / (R * T));
}

/** Simplified mass balance simulation driven by ΔG. */
export function calcMassBalance(
  S0: number, dG: number, Keq: number, steps: number
): { time: number[]; S: number[]; P: number[] } {
  const time = [0];
  const S = [S0];
  const P = [0];

  const dt = 0.1;
  let s = S0, p = 0;

  for (let i = 0; i < steps; i++) {
    const drivingForce = dG < 0 ? Math.abs(dG) * 0.01 : -Math.abs(dG) * 0.005;
    const rate = drivingForce * s / (s + 0.5);
    s = Math.max(0, s - rate * dt);
    p = Math.max(0, p + rate * dt);
    time.push(parseFloat(((i + 1) * dt).toFixed(2)));
    S.push(parseFloat(s.toFixed(4)));
    P.push(parseFloat(p.toFixed(4)));
  }

  return { time, S, P };
}
