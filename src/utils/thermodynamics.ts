/**
 * Thermodynamics calculations.
 * Extracted from ThermodynamicsPanel for testability and reuse.
 *
 * @scientific_provenance
 * VALIDITY_TIER: real (calcDeltaG, calcKeq, calcMassBalance)
 *
 * References:
 *   - Alberty (2003) Thermodynamics of Biochemical Reactions
 *   - eQuilibrator 3 (Beber et al. 2022, Nucleic Acids Research)
 *   - Eyring (1935) The Activated Complex in Chemical Reactions
 */

import { R as R_GAS, T_REF } from '../services/thermoEngine';

/** Universal gas constant in kJ/(mol·K) — re-exported from thermoEngine */
export const R = R_GAS;

/** Boltzmann constant in J/K */
const kBOLTZMANN = 1.380649e-23;

/** Planck constant in J·s */
const h_PLANCK = 6.62607e-34;

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
 * DEMO: Illustration of substrate→product conversion using Eyring equation
 * rate constants and Michaelis-Menten kinetics.
 *
 * @scientific_provenance
 * VALIDITY_TIER: demo
 *
 * Rate constants derived from Eyring equation:
 *   k_cat = (kB·T/h) · exp(-ΔG‡/RT)
 *
 * Uses Michaelis-Menten saturation kinetics with forward/reverse rates
 * constrained by the Haldane relationship: Keq = Vmax_f / Vmax_r.
 *
 * KNOWN_LIMITATIONS:
 *   - Activation energy ΔG‡ = 60 kJ/mol (typical enzyme, not measured)
 *   - Km = 0.5 mM (typical range, not from BRENDA)
 *   - Enzyme concentration Et = 0.01 (scaled for simulation dynamics)
 *   - Simulation time units are arbitrary (dt = 0.1)
 *
 * For quantitative predictions, use measured kcat and Km from BRENDA database.
 */
export function calcMassBalance_DEMO(
  S0: number, dG: number, Keq: number, steps: number
): { time: number[]; S: number[]; P: number[] } {
  const time = [0];
  const S = [S0];
  const P = [0];

  const dt = 0.1;
  const T = T_REF; // 298.15 K

  // Eyring equation: k_cat = (kB·T/h) · exp(-ΔG‡/RT)
  // ΔG‡ = 60 kJ/mol (typical enzymatic barrier; Alberty 2003)
  const deltaGActivation = 60; // kJ/mol
  const kCat = (kBOLTZMANN * T / h_PLANCK) * Math.exp(-deltaGActivation / (R_GAS * T));

  // Vmax = k_cat × [E_total]; Et scaled for simulation dynamics
  const Et = 0.01;
  const Vmax = kCat * Et;

  // Michaelis-Menten Km (typical metabolic enzyme range: 0.01–10 mM)
  const Km = 0.5;

  // Reverse Vmax from Haldane relationship: Keq = Vmax_f / Vmax_r
  const VmaxReverse = Keq > 0 ? Vmax / Keq : 0;

  let s = S0, p = 0;

  for (let i = 0; i < steps; i++) {
    // Michaelis-Menten: v = Vmax·S / (Km + S)
    const vForward = (Vmax * s) / (Km + s);
    const vReverse = Keq > 0 ? (VmaxReverse * p) / (Km + p) : 0;
    const netRate = vForward - vReverse;

    s = Math.max(0, s - netRate * dt);
    p = Math.max(0, p + netRate * dt);
    time.push(parseFloat(((i + 1) * dt).toFixed(2)));
    S.push(parseFloat(s.toFixed(4)));
    P.push(parseFloat(p.toFixed(4)));
  }

  return { time, S, P };
}

/** @deprecated Use calcMassBalance_DEMO instead */
export const calcMassBalance = calcMassBalance_DEMO;
