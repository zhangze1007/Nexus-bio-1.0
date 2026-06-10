/**
 * Thermodynamics calculations.
 * Extracted from ThermodynamicsPanel for testability and reuse.
 *
 * @scientific_provenance
 * VALIDITY_TIER: real (calcDeltaG, calcKeq) | demo (calcMassBalance)
 *
 * References:
 *   - Alberty (2003) Thermodynamics of Biochemical Reactions
 *   - eQuilibrator 3 (Beber et al. 2022, Nucleic Acids Research)
 */

export const R = 8.314e-3; // kJ/mol·K

/** Calculate actual ΔG from standard ΔG°, temperature, and concentrations.
 *  @param dG0 - standard Gibbs free energy change (kJ/mol)
 *  @param T - temperature (K)
 *  @param products - array of product concentrations (assumes unit stoichiometry)
 *  @param reactants - array of reactant concentrations (assumes unit stoichiometry)
 *  @param options - optional configuration
 *  NOTE: For reactions with non-unit stoichiometry (e.g., 2 NAD+ → 2 NADH),
 *  pass each species' concentration raised to its stoichiometric coefficient.
 */
export function calcDeltaG(
  dG0: number,
  T: number,
  products: number[],
  reactants: number[],
  options?: { warnOnExtremeQ?: boolean },
): { dG: number; warning?: string } {
  const productProd = products.reduce((a, b) => a * b, 1);
  const reactantProd = reactants.reduce((a, b) => a * b, 1);

  // Check for zero concentrations
  if (reactantProd === 0) {
    return { dG: -Infinity, warning: 'Zero reactant concentration → ΔG = -∞ (spontaneous)' };
  }
  if (productProd === 0) {
    return { dG: Infinity, warning: 'Zero product concentration → ΔG = +∞ (non-spontaneous)' };
  }

  const Q = productProd / reactantProd;
  const dG = dG0 + R * T * Math.log(Q);

  // Warn on extreme Q values
  if (options?.warnOnExtremeQ && (Q < 1e-10 || Q > 1e10)) {
    return { dG, warning: `Extreme reaction quotient Q=${Q.toExponential(2)}` };
  }

  return { dG };
}

/** Calculate equilibrium constant from ΔG°. */
export function calcKeq(dG0: number, T: number): number {
  if (T <= 0) throw new Error('Temperature must be positive (K)');
  return Math.exp(-dG0 / (R * T));
}

/**
 * DEMO ONLY: Qualitative illustration of substrate→product conversion driven by ΔG.
 *
 * @scientific_provenance
 * VALIDITY_TIER: demo
 * NOT_IMPLEMENTED:
 *   - Eyring equation rate constants (k = kT/h * exp(-ΔG‡/RT))
 *   - Michaelis-Menten parameters from BRENDA
 *   - Temperature-dependent activation energy
 *
 * KNOWN_LIMITATIONS:
 *   - Rate constants are ad-hoc (drivingForce = |ΔG| * 0.01)
 *   - Km hardcoded to 0.5 (no physical basis)
 *   - NOT calibrated to experimental data
 *
 * BLOCKING_ASSUMPTIONS:
 *   - thermodynamics.demo_mass_balance (severity: blocking)
 *
 * For quantitative predictions, use Eyring equation with measured ΔG‡
 * or Michaelis-Menten parameters from BRENDA database.
 */
export function calcMassBalance_DEMO(
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

/** @deprecated Use calcMassBalance_DEMO instead */
export const calcMassBalance = calcMassBalance_DEMO;
