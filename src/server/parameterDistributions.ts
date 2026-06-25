/**
 * Parameter Distributions for Monte Carlo Robustness Analysis
 *
 * Maps single-cell expression data (mean, CV) to log-normal parameter
 * distributions for cell-free simulation perturbation.
 *
 * Key insight: single-cell expression heterogeneity (CV) reflects
 * intrinsic and extrinsic noise in transcription/translation machinery.
 * This noise distribution informs how much cell-free parameters should
 * vary in Monte Carlo simulations.
 *
 * @scientific_provenance
 *   ALGORITHM: Log-normal distribution fitting from coefficient of variation (CV) + Box-Muller transform sampling
 *   REFERENCE:
 *     Elowitz MB, Levine AJ, Siggia ED, Swain PS (2002) "Stochastic gene expression in a single cell" Science 297:1183-1186
 *     Raser JM, O'Shea EK (2005) "Noise in gene expression: origins, consequences, and control" Science 309:2010-2013
 *   KNOWN_LIMITATIONS:
 *     - Assumes log-normal distribution for all parameters; some (e.g., temperature) are better modeled as uniform
 *     - CV-to-parameter mapping ratios (k_tx:1.0, k_tl:0.5, d_mRNA:0.3) are heuristic, not experimentally calibrated
 *     - No correlation structure between parameters (each sampled independently)
 *     - Default CV (15%) is arbitrary when no single-cell data is provided
 *     - Box-Muller transform can produce extreme tails for small CV values
 */

import { SeededRNG } from "../utils/seededRng";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ParameterDistribution {
  name: string;
  nominal: number;
  distribution: "lognormal" | "normal" | "uniform";
  /** For lognormal: mu = ln(nominal), sigma = CV */
  mu: number;
  sigma: number;
  lower: number; // 2.5th percentile
  upper: number; // 97.5th percentile
}

export interface SingleCellData {
  geneId: string;
  meanExpression: number; // normalized expression level
  cvExpression: number; // coefficient of variation (std/mean)
  nCells: number; // number of cells measured
}

export interface ParameterPriors {
  parameters: ParameterDistribution[];
  source: string; // data source description
  nGenesUsed: number;
}

// ── Default Cell-Free Parameters ────────────────────────────────────────────

export interface CellFreeNominalParams {
  k_tx: number; // mRNA production rate (nM/min)
  k_tl: number; // translation rate (protein/mRNA/min)
  d_mRNA: number; // mRNA degradation rate (1/min)
  d_protein: number; // protein degradation rate (1/min)
  K_tl: number; // translation Michaelis constant (nM)
  energy_decay: number; // ATP depletion rate (1/min)
  Rnap_activity: number; // RNA polymerase activity (relative)
  AA_conc: number; // amino acid concentration (mM)
  DNA_conc: number; // template DNA concentration (nM)
  temperature: number; // K
}

export const DEFAULT_CELL_FREE_NOMINAL: CellFreeNominalParams = {
  k_tx: 5.0,
  k_tl: 0.2,
  d_mRNA: 0.05,
  d_protein: 0.005,
  K_tl: 100,
  energy_decay: 0.004,
  Rnap_activity: 1.0,
  AA_conc: 2.0,
  DNA_conc: 5.0,
  temperature: 298,
};

// ── Distribution Builder ────────────────────────────────────────────────────

/**
 * Build log-normal parameter distributions from single-cell expression data.
 *
 * Mapping logic:
 *   - k_tx CV ≈ expression CV (mRNA production tracks expression heterogeneity)
 *   - k_tl CV ≈ 0.5 × expression CV (translation is more buffered)
 *   - d_mRNA CV ≈ 0.3 × expression CV (degradation is more constrained)
 *   - Other parameters: default CV = 0.15 (15% uncertainty)
 *
 * @param singleCellData - Expression mean/CV from single-cell measurements
 * @param nominalParams - Nominal parameter values
 * @param defaultCV - Default CV for parameters without single-cell mapping (default 0.15)
 * @returns Parameter priors with log-normal distributions
 */
export function buildParameterDistributions(
  singleCellData: SingleCellData[],
  nominalParams: CellFreeNominalParams = DEFAULT_CELL_FREE_NOMINAL,
  defaultCV = 0.15,
): ParameterPriors {
  // Compute average CV across all genes
  const avgCV =
    singleCellData.length > 0
      ? singleCellData.reduce((s, d) => s + d.cvExpression, 0) / singleCellData.length
      : defaultCV;

  // Map expression CV to parameter CVs
  const k_tx_cv = avgCV; // direct mapping
  const k_tl_cv = avgCV * 0.5; // buffered
  const d_mRNA_cv = avgCV * 0.3; // constrained
  const d_protein_cv = defaultCV; // default
  const K_tl_cv = defaultCV;
  const energy_decay_cv = defaultCV;
  const Rnap_cv = avgCV * 0.4; // partially correlated
  const AA_cv = defaultCV * 0.5; // well-controlled in vitro
  const DNA_cv = defaultCV * 0.2; // precisely measured
  const temp_cv = 0.01; // tightly controlled

  const distributions: ParameterDistribution[] = [
    makeLogNormal("k_tx", nominalParams.k_tx, k_tx_cv),
    makeLogNormal("k_tl", nominalParams.k_tl, k_tl_cv),
    makeLogNormal("d_mRNA", nominalParams.d_mRNA, d_mRNA_cv),
    makeLogNormal("d_protein", nominalParams.d_protein, d_protein_cv),
    makeLogNormal("K_tl", nominalParams.K_tl, K_tl_cv),
    makeLogNormal("energy_decay", nominalParams.energy_decay, energy_decay_cv),
    makeLogNormal("Rnap_activity", nominalParams.Rnap_activity, Rnap_cv),
    makeLogNormal("AA_conc", nominalParams.AA_conc, AA_cv),
    makeLogNormal("DNA_conc", nominalParams.DNA_conc, DNA_cv),
    makeLogNormal("temperature", nominalParams.temperature, temp_cv),
  ];

  return {
    parameters: distributions,
    source:
      singleCellData.length > 0
        ? `single-cell expression data (${singleCellData.length} genes)`
        : "default CV (no single-cell data provided)",
    nGenesUsed: singleCellData.length,
  };
}

function makeLogNormal(name: string, nominal: number, cv: number): ParameterDistribution {
  // Log-normal parameterization: mu = ln(nominal), sigma ≈ cv for small cv
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const mu = Math.log(nominal) - (sigma * sigma) / 2;

  // 95% confidence interval
  const lower = Math.exp(mu - 1.96 * sigma);
  const upper = Math.exp(mu + 1.96 * sigma);

  return { name, nominal, distribution: "lognormal", mu, sigma, lower, upper };
}

// ── Sampling ────────────────────────────────────────────────────────────────

/**
 * Sample a parameter set from the distributions.
 *
 * @param priors - Parameter distributions
 * @param seed - RNG seed for reproducibility
 * @returns Sampled parameter values
 */
export function sampleParameters(priors: ParameterPriors, seed: number): Record<string, number> {
  const rng = new SeededRNG(seed);
  const result: Record<string, number> = {};

  for (const param of priors.parameters) {
    if (param.distribution === "lognormal") {
      // Box-Muller transform for normal sample, then exponentiate
      const u1 = Math.max(1e-10, rng.next());
      const u2 = rng.next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      result[param.name] = Math.exp(param.mu + param.sigma * z);
    } else if (param.distribution === "normal") {
      const u1 = Math.max(1e-10, rng.next());
      const u2 = rng.next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      result[param.name] = param.nominal + param.sigma * z;
    } else {
      result[param.name] = param.lower + rng.next() * (param.upper - param.lower);
    }
  }

  return result;
}

/**
 * Generate N parameter samples from the distributions.
 */
export function sampleBatch(priors: ParameterPriors, nSamples: number, baseSeed = 42): Array<Record<string, number>> {
  const samples: Array<Record<string, number>> = [];
  for (let i = 0; i < nSamples; i++) {
    samples.push(sampleParameters(priors, baseSeed + i));
  }
  return samples;
}
