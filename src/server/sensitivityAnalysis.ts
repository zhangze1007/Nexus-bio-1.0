/**
 * Parameter Sensitivity Analysis
 *
 * Computes normalized sensitivity indices (∂Y/∂θ × θ/Y) using
 * central finite differences. Each evaluation calls a real simulator.
 *
 * Morris elementary effects and Sobol indices are extensions that
 * can be built on top of this foundation.
 *
 * @scientific_provenance
 *   ALGORITHM: Local sensitivity via central finite differences — normalized elasticity coefficient S_i = (dY/dθ_i) * (θ_i/Y)
 *   REFERENCE:
 *     Saltelli A, Ratto M, Andres T, et al. (2008) "Global Sensitivity Analysis: The Primer" Wiley, ISBN 978-0470059975
 *     Hamby DM (1994) "A review of techniques for parameter sensitivity analysis of environmental models" Environ Monit Assess 32:135-154
 *   KNOWN_LIMITATIONS:
 *     - Local sensitivity only — captures first-order effects at the nominal point, not global interactions
 *     - No Morris elementary effects or Sobol indices implemented (noted as future extensions)
 *     - Fixed perturbation fraction (5%); does not adapt to parameter scale or stiffness
 *     - Single-output only; multi-output sensitivity requires separate calls per output
 *     - Central difference assumes smooth response; discontinuous simulators will produce noisy gradients
 */

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface SensitivityResult {
  /** Parameter name */
  parameter: string;
  /** Normalized sensitivity: (dY/dθ) × (θ/Y) */
  sensitivity: number;
  /** Absolute sensitivity (unnormalized) */
  rawSensitivity: number;
  /** Perturbation size used */
  perturbation: number;
  /** Output at nominal */
  yNominal: number;
  /** Output at θ + h */
  yPlus: number;
  /** Output at θ - h */
  yMinus: number;
}

export interface SensitivityReport {
  results: SensitivityResult[];
  /** Parameters ranked by |sensitivity|, most sensitive first */
  ranking: string[];
  /** Total sensitivity index (sum of |sensitivities|, normalized) */
  totalSensitivity: number;
  /** Dominant parameter (highest |sensitivity|) */
  dominantParameter: string;
  formula: string;
}

// ── Core Computation ────────────────────────────────────────────────────────

/**
 * Compute sensitivity of a scalar output to each input parameter.
 *
 * @param simulate - Function that takes parameter values and returns a scalar output
 * @param nominalParams - Nominal parameter values
 * @param outputKey - Which output to track (e.g., 'yield', 'peakConc')
 * @param perturbationFraction - Fraction of nominal to perturb (default 0.05 = 5%)
 * @returns Sensitivity report
 */
export function computeSensitivity(
  simulate: (params: Record<string, number>) => number,
  nominalParams: Record<string, number>,
  perturbationFraction = 0.05,
): SensitivityReport {
  const paramNames = Object.keys(nominalParams);
  const yNominal = simulate(nominalParams);
  const results: SensitivityResult[] = [];

  for (const paramName of paramNames) {
    const nominalValue = nominalParams[paramName];
    const h = nominalValue * perturbationFraction;

    if (Math.abs(h) < 1e-15) {
      // Zero nominal — skip
      results.push({
        parameter: paramName,
        sensitivity: 0,
        rawSensitivity: 0,
        perturbation: 0,
        yNominal,
        yPlus: yNominal,
        yMinus: yNominal,
      });
      continue;
    }

    // Central finite difference
    const paramsPlus = { ...nominalParams, [paramName]: nominalValue + h };
    const paramsMinus = { ...nominalParams, [paramName]: nominalValue - h };

    const yPlus = simulate(paramsPlus);
    const yMinus = simulate(paramsMinus);

    const rawSensitivity = (yPlus - yMinus) / (2 * h);
    // Normalized: (dY/dθ) × (θ/Y)
    const normalizedSensitivity = Math.abs(yNominal) > 1e-15
      ? rawSensitivity * (nominalValue / yNominal)
      : 0;

    results.push({
      parameter: paramName,
      sensitivity: Math.round(normalizedSensitivity * 1000) / 1000,
      rawSensitivity: Math.round(rawSensitivity * 1000) / 1000,
      perturbation: Math.round(h * 1000) / 1000,
      yNominal: Math.round(yNominal * 100) / 100,
      yPlus: Math.round(yPlus * 100) / 100,
      yMinus: Math.round(yMinus * 100) / 100,
    });
  }

  // Rank by |sensitivity|
  const sorted = [...results].sort((a, b) => Math.abs(b.sensitivity) - Math.abs(a.sensitivity));
  const ranking = sorted.map(r => r.parameter);
  const totalSensitivity = results.reduce((s, r) => s + Math.abs(r.sensitivity), 0);

  return {
    results,
    ranking,
    totalSensitivity: Math.round(totalSensitivity * 1000) / 1000,
    dominantParameter: ranking[0] ?? '',
    formula: 'S_i = (dY/dθ_i) × (θ_i/Y) — central finite difference, perturbation = ±5%',
  };
}
