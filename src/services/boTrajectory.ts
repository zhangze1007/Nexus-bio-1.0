/**
 * Bayesian Optimization Trajectory Engine
 *
 * Multi-round BO simulation for protein evolution.  Starting from an initial
 * GP fit on observed variant data, the engine iterates through rounds of:
 *   1. Acquisition function evaluation (EI, UCB, or EHVI)
 *   2. Batch selection of top-K candidate variants
 *   3. "Propose" step — augments training set with predicted fitness
 *   4. GP refit with updated data
 *   5. Convergence check (EI below threshold)
 *
 * This models the inner loop of a real directed-evolution campaign where
 * each wet-lab round is expensive and the BO surrogate decides which
 * variants to synthesize next.
 *
 * @scientific_provenance
 *   ALGORITHM: Batch Bayesian Optimization with GP surrogate and
 *     EI / UCB / EHVI acquisition.  Convergence via acquisition decay.
 *   REFERENCE: González et al. (2016) "Batch Bayesian Optimization via
 *     Local Penalization." AISTATS.
 *   KNOWN_LIMITATIONS:
 *     - "Propose" adds predicted (not observed) fitness to training set;
 *       real campaigns would use measured fitness after wet-lab screening.
 *     - EHVI falls back to EI when only single-objective data is available.
 *     - Candidate pool is fixed; real BO would also generate novel sequences.
 */

import { GaussianProcess } from '../server/gaussianProcess';
import type { GPConfig, KernelType } from '../server/gaussianProcess';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BORound {
  /** Round number (1-indexed) */
  round: number;
  /** Feature vectors proposed this round */
  proposed: number[][];
  /** GP-predicted fitness for proposed variants */
  predicted: number[];
  /** GP standard deviation for proposed variants */
  uncertainty: number[];
  /** Acquisition values for proposed variants */
  acquisition: number[];
  /** Best fitness observed so far (across all rounds) */
  bestFitnessSoFar: number;
}

export type AcquisitionType = 'EI' | 'UCB' | 'EHVI';

export interface BOConfig {
  /** Number of BO rounds to simulate (default 5) */
  nRounds: number;
  /** Variants proposed per round (default 10) */
  batchSize: number;
  /** Acquisition function type */
  acquisitionType: AcquisitionType;
  /** EI threshold for early stopping (default 0.01) */
  stoppingThreshold?: number;
  /** UCB exploration weight (default 2.0) */
  ucbBeta?: number;
  /** Kernel type for GP (default 'rbf') */
  kernelType?: KernelType;
  /** Whether to optimize GP hyperparameters each round (default true) */
  optimizeHyperparams?: boolean;
}

export interface BOTrajectoryResult {
  /** Per-round details */
  rounds: BORound[];
  /** Round where best acquisition dropped below stopping threshold (0 if never) */
  convergenceRound: number;
  /** Best variant found across all rounds */
  finalBest: {
    features: number[];
    predictedFitness: number;
    uncertainty: number;
    round: number;
  };
  /** Best fitness per round (for plotting improvement trajectory) */
  improvementHistory: number[];
  /** Max acquisition value per round (for convergence plot) */
  acquisitionHistory: number[];
  /** Total variants proposed across all rounds */
  totalProposed: number;
  /** Config used */
  config: BOConfig;
}

// ── Default config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BOConfig = {
  nRounds: 5,
  batchSize: 10,
  acquisitionType: 'EI',
  stoppingThreshold: 0.01,
  ucbBeta: 2.0,
  kernelType: 'rbf',
  optimizeHyperparams: true,
};

// ── Acquisition functions ───────────────────────────────────────────────────

/** Normal CDF via Abramowitz & Stegun rational approximation (7.1.26). */
function normCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  return 0.5 * (1.0 + sign * y);
}

/** Normal PDF. */
function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Expected Improvement acquisition.
 * EI(x) = (mu - best - xi) * Phi(Z) + sigma * phi(Z)
 * where Z = (mu - best - xi) / sigma
 */
function computeEI(
  means: number[],
  stds: number[],
  bestY: number,
  xi = 0.01,
): number[] {
  return means.map((mu, i) => {
    const sigma = stds[i];
    if (sigma < 1e-9) return 0;
    const Z = (mu - bestY - xi) / sigma;
    const ei = (mu - bestY - xi) * normCDF(Z) + sigma * normPDF(Z);
    return Math.max(ei, 0);
  });
}

/**
 * Upper Confidence Bound acquisition.
 * UCB(x) = mu + beta * sigma
 */
function computeUCB(
  means: number[],
  stds: number[],
  beta: number,
): number[] {
  return means.map((mu, i) => mu + beta * stds[i]);
}

/**
 * EHVI acquisition — falls back to EI with xi=0.05 for single-objective.
 * True EHVI requires multi-objective predictions which aren't available here.
 */
function computeEHVI(
  means: number[],
  stds: number[],
  bestY: number,
): number[] {
  return computeEI(means, stds, bestY, 0.05);
}

// ── Candidate generation ────────────────────────────────────────────────────

/**
 * Generate novel candidate feature vectors by perturbing existing variants.
 * For each existing variant, creates perturbations by adding Gaussian noise
 * scaled to the feature range.  This simulates exploring the neighborhood
 * of promising variants — analogous to saturation mutagenesis in directed
 * evolution.
 *
 * @param existing     Existing feature vectors
 * @param nCandidates  Number of novel candidates to generate
 * @param perturbationScale  Noise scale relative to feature range (default 0.15)
 * @param seed         Random seed for reproducibility
 */
function generateCandidates(
  existing: number[][],
  nCandidates: number,
  perturbationScale = 0.15,
  seed = 42,
): number[][] {
  const rng = mulberry32(seed);
  const nFeatures = existing[0]?.length ?? 0;
  if (nFeatures === 0 || existing.length === 0) return [];

  // Compute per-feature range from existing data
  const mins = new Array(nFeatures).fill(Infinity);
  const maxs = new Array(nFeatures).fill(-Infinity);
  for (const row of existing) {
    for (let j = 0; j < nFeatures; j++) {
      if (row[j] < mins[j]) mins[j] = row[j];
      if (row[j] > maxs[j]) maxs[j] = row[j];
    }
  }
  const ranges = mins.map((mn, j) => Math.max(maxs[j] - mn, 1e-6));

  const candidates: number[][] = [];
  for (let i = 0; i < nCandidates; i++) {
    // Pick a random existing variant as base
    const baseIdx = Math.floor(rng() * existing.length);
    const base = existing[baseIdx];
    const perturbed = base.map((v, j) => {
      const noise = boxMullerSample(rng) * ranges[j] * perturbationScale;
      return v + noise;
    });
    candidates.push(perturbed);
  }

  return candidates;
}

/** Mulberry32 seeded PRNG. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal sample. */
function boxMullerSample(rng: () => number): number {
  const u1 = rng() || 1e-10;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── Main BO trajectory engine ───────────────────────────────────────────────

/**
 * Run a multi-round Bayesian optimization trajectory simulation.
 *
 * @param X0     Initial training feature vectors (existing variant data)
 * @param y0     Initial training fitness values
 * @param config BO configuration (optional — uses defaults if omitted)
 * @returns      Full trajectory with per-round details and convergence info
 *
 * @example
 * ```ts
 * const result = runBOTrajectory(X, y, { nRounds: 5, batchSize: 10, acquisitionType: 'EI' });
 * console.log(result.convergenceRound); // round where EI dropped below threshold
 * ```
 */
export function runBOTrajectory(
  X0: number[][],
  y0: number[],
  config?: Partial<BOConfig>,
): BOTrajectoryResult {
  const cfg: BOConfig = { ...DEFAULT_CONFIG, ...config };

  if (X0.length < 3) {
    throw new Error('Need at least 3 training points to fit GP');
  }
  if (X0.length !== y0.length) {
    throw new Error('X0 and y0 must have the same length');
  }

  // Deep-copy training data so we don't mutate the originals
  let XTrain: number[][] = X0.map((r) => [...r]);
  let yTrain: number[] = [...y0];

  const rounds: BORound[] = [];
  const improvementHistory: number[] = [];
  const acquisitionHistory: number[] = [];
  let convergenceRound = 0;
  let globalBestY = Math.max(...y0);

  // Track the best variant across all rounds
  let bestFeatures = X0[y0.indexOf(globalBestY)];
  let bestUncertainty = 0;
  let bestRound = 0;

  for (let round = 0; round < cfg.nRounds; round++) {
    // 1. Fit GP (optionally with hyperparameter optimization)
    const gp = new GaussianProcess({
      kernel: cfg.kernelType ?? 'rbf',
      lengthScale: 10.0,
      signalVariance: 1.0,
      noiseVariance: 0.1,
    });

    if (cfg.optimizeHyperparams && round > 0) {
      // Only optimize from round 2+ to avoid overhead on first round
      gp.fitOptimized(XTrain, yTrain, cfg.kernelType ?? 'rbf');
    } else {
      gp.fit(XTrain, yTrain);
    }

    // 2. Generate novel candidate variants
    const nCandidates = Math.max(cfg.batchSize * 3, 30);
    const candidates = generateCandidates(
      XTrain,
      nCandidates,
      0.15,
      42 + round * 7,
    );

    if (candidates.length === 0) break;

    // 3. Predict fitness for candidates
    const predictions = gp.predict(candidates);
    const means = predictions.map((p) => p.mean);
    const stds = predictions.map((p) => Math.sqrt(Math.max(p.variance, 0)));

    // 4. Compute acquisition values
    let acqValues: number[];
    switch (cfg.acquisitionType) {
      case 'UCB':
        acqValues = computeUCB(means, stds, cfg.ucbBeta ?? 2.0);
        break;
      case 'EHVI':
        acqValues = computeEHVI(means, stds, globalBestY);
        break;
      case 'EI':
      default:
        acqValues = computeEI(means, stds, globalBestY);
        break;
    }

    // 5. Select top-K by acquisition value
    const indices = acqValues
      .map((v, i) => ({ v, i }))
      .sort((a, b) => b.v - a.v)
      .slice(0, cfg.batchSize)
      .map((x) => x.i);

    const proposed = indices.map((i) => candidates[i]);
    const proposedPred = indices.map((i) => means[i]);
    const proposedStd = indices.map((i) => stds[i]);
    const proposedAcq = indices.map((i) => acqValues[i]);

    // 6. "Propose" — add to training set with predicted fitness
    XTrain = [...XTrain, ...proposed];
    yTrain = [...yTrain, ...proposedPred];

    // 7. Update global best
    const roundBestPred = Math.max(...proposedPred);
    const roundBestIdx = proposedPred.indexOf(roundBestPred);
    if (roundBestPred > globalBestY) {
      globalBestY = roundBestPred;
      bestFeatures = proposed[roundBestIdx];
      bestUncertainty = proposedStd[roundBestIdx];
      bestRound = round + 1;
    }

    improvementHistory.push(globalBestY);

    // 8. Max acquisition this round (for convergence tracking)
    const maxAcq = Math.max(...proposedAcq);
    acquisitionHistory.push(maxAcq);

    rounds.push({
      round: round + 1,
      proposed,
      predicted: proposedPred,
      uncertainty: proposedStd,
      acquisition: proposedAcq,
      bestFitnessSoFar: globalBestY,
    });

    // 9. Convergence check
    if (maxAcq < (cfg.stoppingThreshold ?? 0.01) && convergenceRound === 0) {
      convergenceRound = round + 1;
      // Don't break — finish remaining rounds for complete trajectory
    }
  }

  return {
    rounds,
    convergenceRound,
    finalBest: {
      features: bestFeatures,
      predictedFitness: globalBestY,
      uncertainty: bestUncertainty,
      round: bestRound,
    },
    improvementHistory,
    acquisitionHistory,
    totalProposed: rounds.reduce((sum, r) => sum + r.proposed.length, 0),
    config: cfg,
  };
}
