/**
 * Unified Michaelis-Menten kinetics module.
 *
 * Consolidates all Michaelis-Menten implementations into a single,
 * well-tested module with proper TypeScript types.
 *
 * Mathematical basis:
 *   v = Vmax * [S] / (Km + [S])
 *
 * With temperature/pH correction:
 *   Vmax_eff = Vmax * f(T) * f(pH) * ([E] / [E]ref)
 *   f(T) = exp(-((T - T_opt)^2) / (2 * sigma_T^2))
 *   f(pH) = exp(-((pH - pH_opt)^2) / (2 * sigma_pH^2))
 *
 * With competitive inhibition:
 *   Km_eff = Km * (1 + [I] / Ki)
 *   v = Vmax * [S] / (Km_eff + [S])
 *
 * References:
 *   - Michaelis & Menten (1913) Biochemische Zeitschrift
 *   - Eyring (1935) Chemical Reviews
 *   - Segel (1975) Enzyme Kinetics
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface MichaelisMentenParams {
  /** Maximum reaction rate (units depend on context) */
  vmax: number;
  /** Michaelis constant (same units as substrate concentration) */
  km: number;
  /** Substrate concentration */
  substrate: number;
  /** Temperature in Celsius (default: 37) */
  temperature?: number;
  /** pH value (default: 7.4) */
  pH?: number;
  /** Enzyme concentration relative to reference (default: 1.0) */
  enzyme?: number;
  /** Inhibitor concentration (for competitive inhibition) */
  inhibitor?: number;
  /** Inhibition constant (for competitive inhibition) */
  ki?: number;
}

export interface TemperatureCorrection {
  /** Optimal temperature in Celsius */
  optimal: number;
  /** Standard deviation of temperature sensitivity */
  sigma: number;
}

export interface PhCorrection {
  /** Optimal pH value */
  optimal: number;
  /** Standard deviation of pH sensitivity */
  sigma: number;
}

// ── Default correction parameters ──────────────────────────────────────

/** Temperature correction: Gaussian centered at 37°C (mammalian/E. coli physiology) */
const DEFAULT_TEMP_CORRECTION: TemperatureCorrection = {
  optimal: 37,
  sigma: 14.14, // sqrt(200) ≈ 14.14°C standard deviation
};

/** pH correction: Gaussian centered at 7.4 (physiological pH) */
const DEFAULT_PH_CORRECTION: PhCorrection = {
  optimal: 7.4,
  sigma: 1.10, // sqrt(1.2) ≈ 1.10 pH units standard deviation
};

/** Reference enzyme concentration */
const DEFAULT_ENZYME_REF = 5.0;

// ── Core functions ─────────────────────────────────────────────────────

/**
 * Calculate Michaelis-Menten reaction rate with optional corrections.
 *
 * @param params - Reaction parameters
 * @returns Reaction rate (same units as Vmax)
 */
export function michaelisRate(params: MichaelisMentenParams): number {
  const {
    vmax,
    km,
    substrate,
    temperature = 37,
    pH = 7.4,
    enzyme = 1.0,
    inhibitor,
    ki,
  } = params;

  // Guard against invalid inputs
  if (vmax <= 0 || km < 0 || substrate < 0) {
    return 0;
  }

  // Temperature correction: Gaussian sensitivity
  const tempFactor = Math.exp(
    -((temperature - DEFAULT_TEMP_CORRECTION.optimal) ** 2) /
    (2 * DEFAULT_TEMP_CORRECTION.sigma ** 2)
  );

  // pH correction: Gaussian sensitivity
  const phFactor = Math.exp(
    -((pH - DEFAULT_PH_CORRECTION.optimal) ** 2) /
    (2 * DEFAULT_PH_CORRECTION.sigma ** 2)
  );

  // Effective Vmax with corrections
  const vmaxEff = vmax * tempFactor * phFactor * (enzyme / DEFAULT_ENZYME_REF);

  // Competitive inhibition: Km_eff = Km * (1 + [I]/Ki)
  const kmEff = (inhibitor && ki && ki > 0 && inhibitor > 0)
    ? km * (1 + inhibitor / ki)
    : km;

  // Michaelis-Menten equation
  const denominator = kmEff + Math.max(0, substrate);
  if (denominator <= 0) return 0;

  return (vmaxEff * Math.max(0, substrate)) / denominator;
}

/**
 * Calculate Michaelis-Menten rate without temperature/pH corrections.
 * Useful for basic kinetics calculations.
 *
 * @param substrate - Substrate concentration
 * @param vmax - Maximum reaction rate
 * @param km - Michaelis constant
 * @param ki - Inhibition constant (optional)
 * @param inhibitor - Inhibitor concentration (optional)
 * @returns Reaction rate
 */
export function mmVelocity(
  substrate: number,
  vmax: number,
  km: number,
  ki?: number,
  inhibitor?: number,
): number {
  const sSafe = Math.max(0, substrate);
  const kmEff = (ki && inhibitor && ki > 0 && inhibitor > 0)
    ? km * (1 + inhibitor / ki)
    : km;
  const denominator = kmEff + sSafe;
  if (denominator <= 0) return 0;
  return (vmax * sSafe) / denominator;
}

/**
 * Calculate substrate concentration at given reaction rate.
 * Inverse of Michaelis-Menten equation.
 *
 * @param rate - Reaction rate
 * @param vmax - Maximum reaction rate
 * @param km - Michaelis constant
 * @returns Substrate concentration
 */
export function substrateFromRate(
  rate: number,
  vmax: number,
  km: number,
): number {
  if (rate <= 0 || vmax <= 0 || rate >= vmax) {
    return rate <= 0 ? 0 : Infinity;
  }
  return (km * rate) / (vmax - rate);
}

/**
 * Calculate Km from Vmax and rate at given substrate concentration.
 *
 * @param rate - Measured reaction rate
 * @param substrate - Substrate concentration
 * @param vmax - Maximum reaction rate
 * @returns Michaelis constant
 */
export function kmFromRate(
  rate: number,
  substrate: number,
  vmax: number,
): number {
  if (rate <= 0 || vmax <= 0 || substrate <= 0 || rate >= vmax) {
    return NaN;
  }
  return substrate * (vmax - rate) / rate;
}

// ── Utility functions ──────────────────────────────────────────────────

/**
 * Calculate catalytic efficiency (kcat/Km).
 *
 * @param kcat - Catalytic constant (1/time)
 * @param km - Michaelis constant (concentration)
 * @returns Catalytic efficiency (1/(time * concentration))
 */
export function catalyticEfficiency(kcat: number, km: number): number {
  if (km <= 0) return Infinity;
  return kcat / km;
}

/**
 * Calculate substrate saturation fraction.
 *
 * @param substrate - Substrate concentration
 * @param km - Michaelis constant
 * @returns Saturation fraction (0 to 1)
 */
export function saturationFraction(substrate: number, km: number): number {
  if (km <= 0) return 1;
  return substrate / (km + substrate);
}
