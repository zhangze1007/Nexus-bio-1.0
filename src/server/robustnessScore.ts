/**
 * Robustness Score Computation
 *
 * Computes composite robustness scores from Monte Carlo simulation results.
 * Every number is derived from real solver outputs — no LLM inference.
 *
 * Formula:
 *   R_yield   = 1 - CV(yield)
 *   R_timing  = 1 - CV(timeToHalfMax)
 *   R_energy  = 1 - |dYield/dATP|
 *   R_resource = 1 - |dYield/dRibosome|
 *   R_total   = 0.4*R_yield + 0.3*R_timing + 0.15*R_energy + 0.15*R_resource
 *
 * @scientific_provenance
 *   ALGORITHM: Weighted composite robustness score from coefficient of variation (CV) and sensitivity-derived components
 *   REFERENCE:
 *     N/A — custom scoring heuristic; weights (0.4, 0.3, 0.15, 0.15) are engineering judgment, not empirically derived
 *   KNOWN_LIMITATIONS:
 *     - Weight assignment is arbitrary; no validation against experimental robustness data
 *     - Energy and resource sensitivity components are optional and default to 0 when not provided
 *     - CV-based metric assumes Gaussian-like distributions; heavy-tailed distributions may be misleading
 *     - Scores are clamped to [0,1] but negative CV or high sensitivity can produce meaningless 0-floor results
 *     - No confidence intervals on the robustness score itself
 */

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface MonteCarloTrial {
  yield: number;
  timeToHalfMax: number;
  peakConc: number;
  converged: boolean;
  parameters: Record<string, number>;
}

export interface RobustnessComponent {
  score: number; // 0-1
  formula: string; // human-readable formula
  inputs: Record<string, number>; // raw values used
}

export interface RobustnessReport {
  yieldRobustness: RobustnessComponent;
  timingRobustness: RobustnessComponent;
  energyRobustness: RobustnessComponent;
  resourceRobustness: RobustnessComponent;
  overallRobustness: number;
  formulas: Record<string, string>;
  interpretation: string; // placeholder for LLM — filled by pipeline
  stats: {
    nTrials: number;
    nConverged: number;
    convergenceRate: number;
    yieldMean: number;
    yieldStd: number;
    yieldCV: number;
    timingMean: number;
    timingStd: number;
    timingCV: number;
  };
}

// ── Core Computation ────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function cv(values: number[]): number {
  const m = mean(values);
  if (Math.abs(m) < 1e-15) return 0;
  return std(values) / Math.abs(m);
}

/**
 * Compute robustness report from Monte Carlo trial results.
 *
 * @param trials - Array of simulation trial results
 * @param energySensitivity - dYield/dATP from sensitivity analysis (optional)
 * @param resourceSensitivity - dYield/dRibosome from sensitivity analysis (optional)
 * @returns Complete robustness report
 */
export function computeRobustness(
  trials: MonteCarloTrial[],
  energySensitivity?: number,
  resourceSensitivity?: number,
): RobustnessReport {
  const converged = trials.filter((t) => t.converged);
  const yields = converged.map((t) => t.yield);
  const timings = converged.map((t) => t.timeToHalfMax);

  // Yield robustness: 1 - CV(yield)
  const yieldCV = cv(yields);
  const yieldRobustness: RobustnessComponent = {
    score: Math.max(0, Math.min(1, 1 - yieldCV)),
    formula: "R_yield = 1 - CV(yield) = 1 - (std(yield) / mean(yield))",
    inputs: { mean: mean(yields), std: std(yields), cv: yieldCV },
  };

  // Timing robustness: 1 - CV(timeToHalfMax)
  const timingCV = cv(timings);
  const timingRobustness: RobustnessComponent = {
    score: Math.max(0, Math.min(1, 1 - timingCV)),
    formula: "R_timing = 1 - CV(timeToHalfMax)",
    inputs: { mean: mean(timings), std: std(timings), cv: timingCV },
  };

  // Energy robustness: 1 - |dYield/dATP|
  const energySens = energySensitivity ?? 0;
  const energyRobustness: RobustnessComponent = {
    score: Math.max(0, Math.min(1, 1 - Math.abs(energySens))),
    formula: "R_energy = 1 - |dYield/dATP|",
    inputs: { sensitivity: energySens },
  };

  // Resource robustness: 1 - |dYield/dRibosome|
  const resourceSens = resourceSensitivity ?? 0;
  const resourceRobustness: RobustnessComponent = {
    score: Math.max(0, Math.min(1, 1 - Math.abs(resourceSens))),
    formula: "R_resource = 1 - |dYield/dRibosome|",
    inputs: { sensitivity: resourceSens },
  };

  // Overall: weighted combination
  const overallRobustness =
    Math.round(
      (0.4 * yieldRobustness.score +
        0.3 * timingRobustness.score +
        0.15 * energyRobustness.score +
        0.15 * resourceRobustness.score) *
        1000,
    ) / 1000;

  return {
    yieldRobustness,
    timingRobustness,
    energyRobustness,
    resourceRobustness,
    overallRobustness,
    formulas: {
      yield: yieldRobustness.formula,
      timing: timingRobustness.formula,
      energy: energyRobustness.formula,
      resource: resourceRobustness.formula,
      overall: "R_total = 0.4*R_yield + 0.3*R_timing + 0.15*R_energy + 0.15*R_resource",
    },
    interpretation: "", // filled by LLM in pipeline
    stats: {
      nTrials: trials.length,
      nConverged: converged.length,
      convergenceRate: trials.length > 0 ? converged.length / trials.length : 0,
      yieldMean: Math.round(mean(yields) * 100) / 100,
      yieldStd: Math.round(std(yields) * 100) / 100,
      yieldCV: Math.round(yieldCV * 1000) / 1000,
      timingMean: Math.round(mean(timings) * 100) / 100,
      timingStd: Math.round(std(timings) * 100) / 100,
      timingCV: Math.round(timingCV * 1000) / 1000,
    },
  };
}
