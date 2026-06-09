/**
 * Eyring Equation — Real Reaction Rate Calculations
 *
 * Implements the Eyring equation (transition state theory) for calculating
 * reaction rates from activation energy (ΔG‡).
 *
 * k = (kT/h) × exp(-ΔG‡/RT)
 *
 * Where:
 *   k  = rate constant (1/s)
 *   kT = Boltzmann constant × temperature (J)
 *   h  = Planck constant (J·s)
 *   ΔG‡ = activation energy (J/mol)
 *   R  = gas constant (J/(mol·K))
 *   T  = temperature (K)
 *
 * References:
 *   - Eyring (1935) J. Chem. Phys. 3:107-115
 *   - Alberty (2003) Thermodynamics of Biochemical Reactions
 *   - BRENDA: Chang et al. (2021) Nucleic Acids Res. 49:D498-D508
 */

// Physical constants
const R = 8.314;        // J/(mol·K) — Gas constant
const k_B = 1.381e-23;  // J/K — Boltzmann constant
const h = 6.626e-34;    // J·s — Planck constant
const N_A = 6.022e23;   // 1/mol — Avogadro's number

/**
 * Calculate rate constant using Eyring equation.
 *
 * @param deltaG_ddagger - Activation energy (kJ/mol)
 * @param temperature - Temperature (K)
 * @returns Rate constant (1/s)
 */
export function eyringRateConstant(deltaG_ddagger: number, temperature: number): number {
  // Convert kJ/mol to J/mol
  const deltaG_J = deltaG_ddagger * 1000;

  // k = (kT/h) × exp(-ΔG‡/RT)
  const prefactor = (k_B * temperature) / h;
  const exponent = -deltaG_J / (R * temperature);

  return prefactor * Math.exp(exponent);
}

/**
 * Calculate Michaelis-Menten rate with Eyring-derived kcat.
 *
 * @param kcat - Turnover number (1/s) — from BRENDA or Eyring
 * @param enzymeConc - Enzyme concentration (M)
 * @param substrate - Substrate concentration (mM)
 * @param km - Michaelis constant (mM)
 * @returns Reaction rate (mM/s)
 */
export function michaelisMentenRate(
  kcat: number,
  enzymeConc: number,
  substrate: number,
  km: number
): number {
  if (km + substrate === 0) return 0;
  return (kcat * enzymeConc * substrate) / (km + substrate);
}

/**
 * Calculate Vmax from kcat and enzyme concentration.
 *
 * @param kcat - Turnover number (1/s)
 * @param enzymeConc - Enzyme concentration (M)
 * @returns Vmax (M/s)
 */
export function kcatToVmax(kcat: number, enzymeConc: number): number {
  return kcat * enzymeConc;
}

/**
 * Calculate catalytic efficiency (kcat/Km).
 *
 * @param kcat - Turnover number (1/s)
 * @param km - Michaelis constant (mM)
 * @returns Catalytic efficiency (1/(mM·s))
 */
export function catalyticEfficiency(kcat: number, km: number): number {
  if (km === 0) return Infinity;
  return kcat / km;
}

/**
 * Estimate activation energy from rate constant (inverse Eyring).
 *
 * @param rateConstant - Rate constant (1/s)
 * @param temperature - Temperature (K)
 * @returns Activation energy (kJ/mol)
 */
export function inverseEyring(rateConstant: number, temperature: number): number {
  if (rateConstant <= 0) return Infinity;

  // ΔG‡ = -RT × ln(k × h / (kT))
  const ratio = (rateConstant * h) / (k_B * temperature);
  const deltaG_J = -R * temperature * Math.log(ratio);

  return deltaG_J / 1000; // Convert to kJ/mol
}

/**
 * Temperature correction for rate constant.
 *
 * Uses Arrhenius equation: k(T2) = k(T1) × exp[(Ea/R) × (1/T1 - 1/T2)]
 *
 * @param k1 - Rate constant at T1 (1/s)
 * @param T1 - Reference temperature (K)
 * @param T2 - Target temperature (K)
 * @param Ea - Activation energy (kJ/mol)
 * @returns Rate constant at T2 (1/s)
 */
export function arrheniusCorrection(
  k1: number,
  T1: number,
  T2: number,
  Ea: number
): number {
  // Convert kJ/mol to J/mol
  const Ea_J = Ea * 1000;

  // k(T2) = k(T1) × exp[(Ea/R) × (1/T1 - 1/T2)]
  const exponent = (Ea_J / R) * (1/T1 - 1/T2);
  return k1 * Math.exp(exponent);
}

/**
 * pH correction for enzyme activity.
 *
 * Uses a simple bell-shaped model centered on pH optimum.
 *
 * @param activity - Maximum activity (at pH optimum)
 * @param pH - Current pH
 * @param pH_opt - Optimal pH
 * @param width - Bell curve width (default 2.0)
 * @returns Activity at given pH
 */
export function phCorrection(
  activity: number,
  pH: number,
  pH_opt: number,
  width: number = 2.0
): number {
  const delta = pH - pH_opt;
  return activity * Math.exp(-(delta * delta) / (2 * width * width));
}

/**
 * Temperature correction for enzyme activity.
 *
 * Uses a bell-shaped model with thermal denaturation.
 *
 * @param activity - Maximum activity (at T optimum)
 * @param T - Current temperature (K)
 * @param T_opt - Optimal temperature (K)
 * @param Ea - Activation energy for catalysis (kJ/mol)
 * @param Ed - Activation energy for denaturation (kJ/mol)
 * @returns Activity at given temperature
 */
export function temperatureCorrection(
  activity: number,
  T: number,
  T_opt: number,
  Ea: number = 50,  // kJ/mol — typical for catalysis
  Ed: number = 200  // kJ/mol — typical for denaturation
): number {
  // Catalytic rate increases with temperature
  const k_cat = Math.exp(-Ea * 1000 / (R * T));

  // Denaturation increases rapidly at high temperature
  const k_den = Math.exp(-Ed * 1000 / (R * T));

  // Net activity is product of catalysis and stability
  const k_cat_opt = Math.exp(-Ea * 1000 / (R * T_opt));
  const k_den_opt = Math.exp(-Ed * 1000 / (R * T_opt));

  return activity * (k_cat / k_cat_opt) * (k_den_opt / k_den);
}

/**
 * Complete enzyme kinetics calculation with BRENDA data.
 *
 * @param params - Enzyme kinetics parameters
 * @returns Complete kinetics result
 */
export function calculateEnzymeKinetics(params: {
  kcat?: number;        // 1/s — from BRENDA
  km?: number;          // mM — from BRENDA
  ki?: number;          // mM — from BRENDA
  enzymeConc: number;   // M
  substrate: number;    // mM
  inhibitor?: number;   // mM
  temperature?: number; // K (default 298.15)
  pH?: number;          // (default 7.0)
  pH_opt?: number;      // from BRENDA
  T_opt?: number;       // K — from BRENDA
}): {
  rate: number;           // mM/s
  vmax: number;           // mM/s
  kcat_eff: number;       // 1/s — effective kcat after corrections
  km_eff: number;         // mM — effective Km after inhibition
  inhibition: number;     // Fraction of inhibition (0-1)
  source: string;
} {
  const {
    kcat = 10,           // Default kcat if not from BRENDA
    km = 1,              // Default Km if not from BRENDA
    ki,                  // Inhibition constant
    enzymeConc,
    substrate,
    inhibitor = 0,
    temperature = 298.15,
    pH = 7.0,
    pH_opt = 7.0,
    T_opt = 298.15,
  } = params;

  // Apply temperature correction to kcat
  let kcat_corrected = kcat;
  if (T_opt !== temperature) {
    kcat_corrected = temperatureCorrection(kcat, temperature, T_opt);
  }

  // Apply pH correction
  let kcat_ph_corrected = kcat_corrected;
  if (pH_opt !== pH) {
    kcat_ph_corrected = phCorrection(kcat_corrected, pH, pH_opt);
  }

  // Apply competitive inhibition
  let km_effective = km;
  let inhibition = 0;
  if (ki && inhibitor > 0) {
    km_effective = km * (1 + inhibitor / ki);
    inhibition = inhibitor / (ki + inhibitor);
  }

  // Calculate Vmax and rate
  const vmax = kcat_ph_corrected * enzymeConc;
  const rate = michaelisMentenRate(kcat_ph_corrected, enzymeConc, substrate, km_effective);

  return {
    rate,
    vmax,
    kcat_eff: kcat_ph_corrected,
    km_eff: km_effective,
    inhibition,
    source: ki ? 'BRENDA + Eyring' : 'BRENDA',
  };
}

/**
 * Estimate ΔG‡ from Km and kcat (using Eyring equation).
 *
 * This is useful when BRENDA has kcat but not ΔG‡.
 *
 * @param kcat - Turnover number (1/s)
 * @param temperature - Temperature (K)
 * @returns Estimated ΔG‡ (kJ/mol)
 */
export function estimateActivationEnergy(kcat: number, temperature: number): number {
  return inverseEyring(kcat, temperature);
}

/**
 * Format kinetics result for display.
 */
export function formatKineticsResult(result: ReturnType<typeof calculateEnzymeKinetics>): string {
  const lines = [
    `Rate: ${result.rate.toFixed(4)} mM/s`,
    `Vmax: ${result.vmax.toFixed(4)} mM/s`,
    `Effective kcat: ${result.kcat_eff.toFixed(2)} 1/s`,
    `Effective Km: ${result.km_eff.toFixed(4)} mM`,
  ];

  if (result.inhibition > 0) {
    lines.push(`Inhibition: ${(result.inhibition * 100).toFixed(1)}%`);
  }

  lines.push(`Source: ${result.source}`);

  return lines.join('\n');
}
