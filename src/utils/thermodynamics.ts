/**
 * Thermodynamics calculations.
 * Extracted from ThermodynamicsPanel for testability and reuse.
 */

export const R = 8.314e-3; // kJ/mol·K

/** Calculate actual ΔG from standard ΔG°, temperature, and concentrations.
 *  @param products - array of product concentrations (assumes unit stoichiometry)
 *  @param reactants - array of reactant concentrations (assumes unit stoichiometry)
 *  NOTE: For reactions with non-unit stoichiometry (e.g., 2 NAD+ → 2 NADH),
 *  pass each species' concentration raised to its stoichiometric coefficient.
 */
export function calcDeltaG(dG0: number, T: number, products: number[], reactants: number[]): number {
  const Q = products.reduce((a, b) => a * b, 1) / reactants.reduce((a, b) => a * b, 1);
  const Q_SAFE = Math.max(1e-15, Math.min(1e15, Q));
  return dG0 + R * T * Math.log(Q_SAFE);
}

/** Calculate equilibrium constant from ΔG°. */
export function calcKeq(dG0: number, T: number): number {
  if (T <= 0) return dG0 < 0 ? Infinity : dG0 > 0 ? 0 : 1;
  return Math.exp(-dG0 / (R * T));
}

/**
 * Qualitative illustration of substrate→product conversion driven by ΔG.
 * NOT calibrated to experimental data — rate constants are ad-hoc.
 * For quantitative predictions, use Eyring equation with measured ΔG‡.
 */
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
