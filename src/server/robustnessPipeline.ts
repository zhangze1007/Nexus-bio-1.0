/**
 * Cell-Free Robustness Predictor Pipeline
 *
 * Unidirectional pipeline: Ideal Simulator → Quality Inspector → Optimizer
 *
 * Every numerical conclusion comes from a real solver call.
 * LLM role: interpret robustness score (Agent C output).
 *
 * Pipeline:
 *   1. Agent A (Ideal): nominal parameters → ideal ODE trajectory
 *   2. Agent B (Inspector): single-cell data → parameter distributions → Monte Carlo
 *   3. Agent C (Optimizer): Monte Carlo results → robustness score + sensitivity
 *
 * @scientific_provenance
 *   ALGORITHM: Pipeline orchestration — cell-free TX-TL ODE (RK4) + Monte Carlo perturbation + composite robustness scoring + finite-difference sensitivity
 *   REFERENCE: N/A — orchestration only; delegates to parameterDistributions, robustnessScore, and sensitivityAnalysis
 *     Cell-free TX-TL model basis: Stögbauer T, Windhager L, Zimmer R, Rädler JO (2012) "Experiment and mathematical modeling of gene expression dynamics in a cell-free system" Integr Biol 4:494-501
 *   KNOWN_LIMITATIONS:
 *     - Simplified 3-state ODE (mRNA, protein, ATP); no amino acid depletion, ribosome dynamics, or energy regeneration
 *     - ATP pool initialized at fixed 1000 nM; no NTP/energy system coupling
 *     - Monte Carlo assumes independent parameter perturbations; no correlated noise structure
 *     - Fixed 500 trials; no convergence criterion or adaptive sample sizing
 *     - Robustness score weights inherited from robustnessScore.ts (arbitrary, not validated)
 */

import {
  buildParameterDistributions,
  type CellFreeNominalParams,
  DEFAULT_CELL_FREE_NOMINAL,
  type SingleCellData,
  sampleBatch,
} from "./parameterDistributions";
import { computeRobustness, type MonteCarloTrial, type RobustnessReport } from "./robustnessScore";
import { computeSensitivity, type SensitivityReport } from "./sensitivityAnalysis";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface IdealSimulation {
  trajectory: Array<{ time: number; proteinConc: number }>;
  yield: number;
  timeToHalfMax: number;
  peakConc: number;
  steadyStateConc: number;
}

export interface MonteCarloResults {
  trials: MonteCarloTrial[];
  yieldDistribution: { mean: number; std: number; cv: number };
  timingDistribution: { mean: number; std: number; cv: number };
  convergenceRate: number;
}

export interface RobustnessPredictorResult {
  ideal: IdealSimulation;
  monteCarlo: MonteCarloResults;
  robustness: RobustnessReport;
  sensitivity: SensitivityReport;
  allSolverCalls: Array<{ solver: string; description: string }>;
}

// ── Cell-Free ODE Model ─────────────────────────────────────────────────────

/**
 * Cell-free TX-TL ODE model.
 *
 * State: [mRNA, protein, ATP]
 *
 * dmRNA/dt = k_tx * DNA_conc * Rnap_activity - d_mRNA * mRNA
 * dprotein/dt = k_tl * mRNA * AA_conc / (K_tl + mRNA) * energy - d_protein * protein
 * dATP/dt = -energy_decay * ATP - k_tl * mRNA * AA_conc / (K_tl + mRNA) * 0.01
 *
 * This is a version of CellFreeEngine.ts::simulateCFPS.
 * Uses the same RK4 integrator pattern.
 */
function cellFreeODE(
  params: Record<string, number>,
  duration = 300, // minutes
  dt = 0.5,
): { trajectory: Array<{ time: number; proteinConc: number }>; yield: number; peakConc: number } {
  const k_tx = params.k_tx ?? 5.0;
  const k_tl = params.k_tl ?? 0.2;
  const d_mRNA = params.d_mRNA ?? 0.05;
  const d_protein = params.d_protein ?? 0.005;
  const K_tl = params.K_tl ?? 100;
  const energy_decay = params.energy_decay ?? 0.01;
  const Rnap = params.Rnap_activity ?? 1.0;
  const AA = params.AA_conc ?? 2.0;
  const DNA = params.DNA_conc ?? 5.0;

  let mRNA = 0;
  let protein = 0;
  let ATP = 1000; // initial ATP pool

  const trajectory: Array<{ time: number; proteinConc: number }> = [];
  const steps = Math.floor(duration / dt);

  for (let step = 0; step <= steps; step++) {
    const t = step * dt;
    trajectory.push({ time: t, proteinConc: protein });

    if (step < steps) {
      // RK4
      const deriv = (m: number, p: number, a: number) => {
        const energy = Math.max(0, a) / 1000; // normalized energy
        const translation = ((k_tl * m * AA) / (K_tl + m)) * energy;
        return [k_tx * DNA * Rnap - d_mRNA * m, translation - d_protein * p, -energy_decay * a - translation * 0.01];
      };

      const [k1m, k1p, k1a] = deriv(mRNA, protein, ATP);
      const [k2m, k2p, k2a] = deriv(mRNA + (dt / 2) * k1m, protein + (dt / 2) * k1p, ATP + (dt / 2) * k1a);
      const [k3m, k3p, k3a] = deriv(mRNA + (dt / 2) * k2m, protein + (dt / 2) * k2p, ATP + (dt / 2) * k2a);
      const [k4m, k4p, k4a] = deriv(mRNA + dt * k3m, protein + dt * k3p, ATP + dt * k3a);

      mRNA = Math.max(0, mRNA + (dt / 6) * (k1m + 2 * k2m + 2 * k3m + k4m));
      protein = Math.max(0, protein + (dt / 6) * (k1p + 2 * k2p + 2 * k3p + k4p));
      ATP = Math.max(0, ATP + (dt / 6) * (k1a + 2 * k2a + 2 * k3a + k4a));
    }
  }

  const peakConc = Math.max(...trajectory.map((t) => t.proteinConc));
  return { trajectory, yield: trajectory[trajectory.length - 1].proteinConc, peakConc };
}

// ── Agent A: Ideal Simulator ────────────────────────────────────────────────

/**
 * Run ideal simulation with nominal parameters, no noise.
 */
function runIdealSimulation(nominalParams: CellFreeNominalParams = DEFAULT_CELL_FREE_NOMINAL): IdealSimulation {
  const params = { ...nominalParams } as unknown as Record<string, number>;
  const result = cellFreeODE(params);

  // Find time to half-max
  const halfMax = result.peakConc / 2;
  let timeToHalfMax = 0;
  for (const point of result.trajectory) {
    if (point.proteinConc >= halfMax) {
      timeToHalfMax = point.time;
      break;
    }
  }

  return {
    trajectory: result.trajectory,
    yield: result.yield,
    timeToHalfMax,
    peakConc: result.peakConc,
    steadyStateConc: result.yield,
  };
}

// ── Agent B: Quality Inspector ──────────────────────────────────────────────

/**
 * Run Monte Carlo perturbation with parameter distributions from single-cell data.
 */
function runMonteCarlo(
  singleCellData: SingleCellData[],
  nominalParams: CellFreeNominalParams = DEFAULT_CELL_FREE_NOMINAL,
  nTrials = 500,
  seed = 42,
): MonteCarloResults {
  const priors = buildParameterDistributions(singleCellData, nominalParams);
  const samples = sampleBatch(priors, nTrials, seed);

  const trials: MonteCarloTrial[] = samples.map((sampledParams, i) => {
    const result = cellFreeODE(sampledParams);

    // Find time to half-max
    const halfMax = result.peakConc / 2;
    let timeToHalfMax = 0;
    for (const point of result.trajectory) {
      if (point.proteinConc >= halfMax) {
        timeToHalfMax = point.time;
        break;
      }
    }

    return {
      yield: result.yield,
      timeToHalfMax,
      peakConc: result.peakConc,
      converged: result.yield > 0,
      parameters: sampledParams,
    };
  });

  const converged = trials.filter((t) => t.converged);
  const yields = converged.map((t) => t.yield);
  const timings = converged.map((t) => t.timeToHalfMax);

  return {
    trials,
    yieldDistribution: {
      mean: mean(yields),
      std: std(yields),
      cv: cv(yields),
    },
    timingDistribution: {
      mean: mean(timings),
      std: std(timings),
      cv: cv(timings),
    },
    convergenceRate: trials.length > 0 ? converged.length / trials.length : 0,
  };
}

// ── Agent C: Optimizer ──────────────────────────────────────────────────────

/**
 * Compute robustness score + sensitivity analysis.
 */
function runOptimizer(
  mcResults: MonteCarloResults,
  nominalParams: CellFreeNominalParams = DEFAULT_CELL_FREE_NOMINAL,
): { robustness: RobustnessReport; sensitivity: SensitivityReport } {
  // Sensitivity analysis: perturb each parameter by ±5%
  const nominal = { ...nominalParams } as unknown as Record<string, number>;
  const sensitivity = computeSensitivity((params) => {
    const result = cellFreeODE(params);
    return result.yield;
  }, nominal);

  // Extract energy and resource sensitivities for robustness score
  const energySens = sensitivity.results.find((r) => r.parameter === "energy_decay")?.sensitivity ?? 0;
  const resourceSens = sensitivity.results.find((r) => r.parameter === "Rnap_activity")?.sensitivity ?? 0;

  // Robustness score with real sensitivity values
  const robustness = computeRobustness(mcResults.trials, energySens, resourceSens);

  return { robustness, sensitivity };
}

// ── Pipeline Entry Point ────────────────────────────────────────────────────

/**
 * Run the complete Cell-Free Robustness Predictor pipeline.
 *
 * @param singleCellData - Expression mean/CV from single-cell measurements
 * @param nominalParams - Nominal cell-free parameters
 * @param nTrials - Number of Monte Carlo trials (default 500)
 * @returns Complete result with solver traces
 */
export function runRobustnessPredictor(
  singleCellData: SingleCellData[],
  nominalParams: CellFreeNominalParams = DEFAULT_CELL_FREE_NOMINAL,
  nTrials = 500,
): RobustnessPredictorResult {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // Agent A: Ideal simulation
  solverCalls.push({ solver: "cellFreeODE::ideal", description: "RK4 ODE with nominal parameters" });
  const ideal = runIdealSimulation(nominalParams);

  // Agent B: Monte Carlo
  solverCalls.push({
    solver: "parameterDistributions::build",
    description: `Distributions from ${singleCellData.length} genes`,
  });
  solverCalls.push({ solver: "cellFreeODE::monteCarlo", description: `${nTrials} perturbed ODE simulations` });
  const monteCarlo = runMonteCarlo(singleCellData, nominalParams, nTrials);

  // Agent C: Robustness + Sensitivity
  solverCalls.push({ solver: "robustnessScore::compute", description: "Composite robustness scoring" });
  solverCalls.push({ solver: "sensitivityAnalysis::compute", description: "Finite-difference parameter sensitivity" });
  const { robustness, sensitivity } = runOptimizer(monteCarlo, nominalParams);

  return { ideal, monteCarlo, robustness, sensitivity, allSolverCalls: solverCalls };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mean(v: number[]): number {
  return v.length > 0 ? v.reduce((s, x) => s + x, 0) / v.length : 0;
}
function std(v: number[]): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}
function cv(v: number[]): number {
  const m = mean(v);
  return Math.abs(m) > 1e-15 ? std(v) / Math.abs(m) : 0;
}
