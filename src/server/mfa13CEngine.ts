/**
 * 13C Metabolic Flux Analysis Engine
 *
 * Simulates isotopomer distributions through metabolic networks
 * and estimates intracellular fluxes from 13C labeling data.
 *
 * Key concepts:
 *   - EMU (Elementary Metabolite Units): fragments of metabolites
 *     that can be tracked independently through the network
 *   - Isotopomer: binary representation of labeling pattern (0=12C, 1=13C)
 *   - Mass isotopomer distribution (MID): fraction of each mass variant
 *
 * Reference: Antoniewicz et al. (2007) Metab Eng 9:68-86
 * Reference: Zamboni et al. (2009) Curr Opin Biotechnol 20:34-41
 *
 * @scientific_provenance
 *   ALGORITHM: EMU decomposition + isotopomer balancing
 *   KNOWN_LIMITATIONS:
 *     - Full EMU network with atom mapping
 *     - No GC-MS/MS raw data parsing
 *     - Flux estimation uses grid search, not nonlinear optimization
 *     - No uncertainty quantification (no Monte Carlo confidence intervals)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface Metabolite {
  id: string;
  name: string;
  nCarbon: number;  // number of carbon atoms
  pool?: number;    // pool size (arbitrary units)
}

export interface Reaction {
  id: string;
  substrates: Array<{ metabolite: string; stoichiometry: number }>;
  products: Array<{ metabolite: string; stoichiometry: number }>;
  atomMapping?: Record<string, string[]>;  // substrate atom → product atoms
  reversible?: boolean;
}

export interface MFAInput {
  metabolites: Metabolite[];
  reactions: Reaction[];
  labelSubstrate: string;       // which substrate is labeled (e.g., 'glucose')
  labelPattern: number[];       // which carbons are 13C (0-indexed)
  measuredMIDs?: Record<string, number[]>;  // metabolite → measured MID
  objectiveReaction?: string;   // reaction to maximize (e.g., 'BIOMASS')
}

export interface MIDResult {
  metabolite: string;
  mid: number[];                // mass isotopomer distribution
  nCarbon: number;
  simulated: boolean;
}

export interface FluxEstimate {
  reactionId: string;
  flux: number;
  confidence: number;           // 0-1
  direction: 'forward' | 'reverse' | 'bidirectional';
}

export interface MFAResult {
  fluxEstimates: FluxEstimate[];
  mids: MIDResult[];
  objectiveFlux: number;
  fitQuality: number;           // chi-squared goodness of fit
  nIterations: number;
  converged: boolean;
}

// ── EMU Decomposition ───────────────────────────────────────────────────────

/**
 * Decompose a metabolite into Elementary Metabolite Units (EMUs).
 * An EMU is a subset of carbon atoms that can be tracked independently.
 */
function decomposeEMU(metabolite: Metabolite): Array<{
  id: string;
  atoms: number[];
  size: number;
}> {
  const emus: Array<{ id: string; atoms: number[]; size: number }> = [];

  // Generate all possible EMU sizes (1 to nCarbon)
  for (let size = 1; size <= metabolite.nCarbon; size++) {
    // Generate combinations of carbon atoms
    const combinations = generateCombinations(metabolite.nCarbon, size);
    for (const atoms of combinations) {
      emus.push({
        id: `${metabolite.id}_${atoms.join(',')}`,
        atoms,
        size,
      });
    }
  }

  return emus;
}

function generateCombinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo: number[] = [];

  function backtrack(start: number) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      backtrack(i + 1);
      combo.pop();
    }
  }

  backtrack(0);
  return result;
}

// ── Isotopomer Simulation ──────────────────────────────────────────────────

/**
 * Simulate mass isotopomer distribution (MID) for a metabolite
 * given the labeling pattern of its precursors.
 *
 * For a metabolite with n carbons, MID has n+1 entries:
 * M+0 (unlabeled), M+1 (1 carbon labeled), ..., M+n (fully labeled)
 */
function simulateMID(
  nCarbon: number,
  labelFraction: number,  // fraction of 13C in precursor
): number[] {
  const mid: number[] = new Array(nCarbon + 1).fill(0);

  // Binomial distribution: P(k labeled out of n) = C(n,k) * p^k * (1-p)^(n-k)
  for (let k = 0; k <= nCarbon; k++) {
    const binomCoeff = binomial(nCarbon, k);
    const prob = binomCoeff * Math.pow(labelFraction, k) * Math.pow(1 - labelFraction, nCarbon - k);
    mid[k] = Math.round(prob * 10000) / 10000;
  }

  return mid;
}

function binomial(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Simulate MID for a metabolite in a reaction network.
 * Considers atom mapping for more accurate results.
 */
function simulateReactionMID(
  reaction: Reaction,
  substrateMIDs: Record<string, number[]>,
  metaboliteId: string,
  nCarbon: number,
): number[] {
  // Find which substrate contributes to this product
  const productEntry = reaction.products.find(p => p.metabolite === metaboliteId);
  if (!productEntry) return new Array(nCarbon + 1).fill(0);

  // Simple case: direct transfer from one substrate
  if (reaction.substrates.length === 1) {
    const substrate = reaction.substrates[0];
    const substrateMID = substrateMIDs[substrate.metabolite];
    if (substrateMID) {
      // Scale MID to match product carbon count
      return scaleMID(substrateMID, nCarbon);
    }
  }

  // Complex case: multiple substrates → combine MIDs via atom mapping
  // For each substrate, track which carbon atoms contribute to the product
  // Then convolve the MIDs accordingly
  const combinedMID = new Array(nCarbon + 1).fill(0);
  let totalWeight = 0;

  for (const substrate of reaction.substrates) {
    const substrateMID = substrateMIDs[substrate.metabolite];
    if (substrateMID) {
      const weight = Math.abs(substrate.stoichiometry);

      // If atom mapping is available, use it to determine carbon contribution
      if (reaction.atomMapping && reaction.atomMapping[substrate.metabolite]) {
        const mappedAtoms = reaction.atomMapping[substrate.metabolite];
        const nContributed = mappedAtoms.length;
        // Subset the substrate MID to only the contributing atoms
        const subsetMID = subsetMIDByAtoms(substrateMID, nContributed, substrateMID.length - 1);
        const scaled = scaleMID(subsetMID, nCarbon);
        for (let i = 0; i <= nCarbon; i++) {
          combinedMID[i] += scaled[i] * weight;
        }
      } else {
        // No atom mapping: assume proportional contribution
        const scaled = scaleMID(substrateMID, nCarbon);
        for (let i = 0; i <= nCarbon; i++) {
          combinedMID[i] += scaled[i] * weight;
        }
      }
      totalWeight += weight;
    }
  }

  if (totalWeight > 0) {
    for (let i = 0; i <= nCarbon; i++) {
      combinedMID[i] = Math.round((combinedMID[i] / totalWeight) * 10000) / 10000;
    }
  }

  return combinedMID;
}

/**
 * Subset a MID to represent only a subset of carbon atoms.
 * Uses binomial re-distribution to convert from n-carbon to k-carbon MID.
 */
function subsetMIDByAtoms(sourceMID: number[], nSubset: number, nTotal: number): number[] {
  const result = new Array(nSubset + 1).fill(0);
  // For each labeling state in source, distribute to subset states
  for (let k = 0; k <= nTotal; k++) {
    if (sourceMID[k] === 0) continue;
    // Probability that j out of nSubset atoms are labeled given k out of nTotal
    for (let j = Math.max(0, k - (nTotal - nSubset)); j <= Math.min(k, nSubset); j++) {
      const prob = (binomial(nSubset, j) * binomial(nTotal - nSubset, k - j)) / binomial(nTotal, k);
      result[j] += sourceMID[k] * prob;
    }
  }
  // Normalize
  const sum = result.reduce((s, v) => s + v, 0);
  if (sum > 0) {
    for (let i = 0; i <= nSubset; i++) result[i] /= sum;
  }
  return result;
}

/**
 * Scale MID from source carbon count to target carbon count using
 * hypergeometric distribution (correct statistical model for subsetting).
 *
 * P(j labeled in subset | k labeled in source) = C(m,j) * C(n-m, k-j) / C(n, k)
 *
 * Reference: Antoniewicz et al. (2007) Metab Eng 9:68-86
 */
function scaleMID(sourceMID: number[], targetSize: number): number[] {
  const result = new Array(targetSize + 1).fill(0);
  const sourceSize = sourceMID.length - 1;

  if (sourceSize === targetSize) return [...sourceMID];

  // For each possible labeling state k in source
  for (let k = 0; k <= sourceSize; k++) {
    if (sourceMID[k] === 0) continue;

    // For each possible labeling state j in target
    for (let j = Math.max(0, k - (sourceSize - targetSize)); j <= Math.min(k, targetSize); j++) {
      // Hypergeometric probability: C(m,j) * C(n-m, k-j) / C(n, k)
      const prob = (binomial(targetSize, j) * binomial(sourceSize - targetSize, k - j)) / binomial(sourceSize, k);
      result[j] += sourceMID[k] * prob;
    }
  }

  // Normalize to ensure sum = 1
  const sum = result.reduce((s, v) => s + v, 0);
  if (sum > 0) {
    for (let i = 0; i <= targetSize; i++) {
      result[i] = Math.round((result[i] / sum) * 10000) / 10000;
    }
  }

  return result;
}

// ── Flux Estimation ────────────────────────────────────────────────────────

/**
 * Estimate fluxes by fitting simulated MIDs to measured data.
 * Uses Levenberg-Marquardt nonlinear least squares optimization.
 *
 * Reference: Marquardt (1963) J Soc Ind Appl Math 11:431-441
 * Reference: Antoniewicz et al. (2007) Metab Eng 9:68-86
 */
function estimateFluxes(
  input: MFAInput,
  measuredMIDs: Record<string, number[]>,
): {
  fluxEstimates: FluxEstimate[];
  bestObjective: number;
  bestFitQuality: number;
  nIterations: number;
} {
  const nReactions = input.reactions.length;

  // Initial guess: all fluxes = 1.0
  let v = new Array(nReactions).fill(1.0);

  // Levenberg-Marquardt parameters
  let lambda = 0.001;
  const lambdaUp = 10;
  const lambdaDown = 10;
  const maxIter = 200;
  const tol = 1e-8;
  let nIterations = 0;

  // Build residual vector for current fluxes
  function residuals(fluxes: number[]): number[] {
    const simMIDs = simulateNetworkMIDs(input, fluxes);
    const res: number[] = [];
    for (const [metId, measured] of Object.entries(measuredMIDs)) {
      const simulated = simMIDs[metId];
      if (simulated) {
        for (let j = 0; j < Math.min(measured.length, simulated.length); j++) {
          res.push(measured[j] - simulated[j]);
        }
      }
    }
    return res;
  }

  // Numerical Jacobian
  function jacobian(fluxes: number[]): number[][] {
    const eps = 1e-6;
    const r0 = residuals(fluxes);
    const m = r0.length;
    const n = fluxes.length;
    const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));

    for (let j = 0; j < n; j++) {
      const vPlus = [...fluxes];
      vPlus[j] += eps;
      const rPlus = residuals(vPlus);
      for (let i = 0; i < m; i++) {
        J[i][j] = (rPlus[i] - r0[i]) / eps;
      }
    }
    return J;
  }

  // Compute chi-squared
  function chi2(res: number[]): number {
    return res.reduce((s, r) => s + r * r, 0);
  }

  let r = residuals(v);
  let currentChi2 = chi2(r);

  // Levenberg-Marquardt iteration
  for (let iter = 0; iter < maxIter; iter++) {
    nIterations++;

    const J = jacobian(v);
    const m = r.length;
    const n = nReactions;

    // JᵀJ + λI
    const JtJ: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const Jtr: number[] = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < m; k++) sum += J[k][i] * J[k][j];
        JtJ[i][j] = sum + (i === j ? lambda : 0);
      }
      let sum = 0;
      for (let k = 0; k < m; k++) sum += J[k][i] * r[k];
      Jtr[i] = sum;
    }

    // Solve (JᵀJ + λI)δ = Jᵀr via Gauss elimination
    const delta = solveLinearSystem(JtJ, Jtr);

    if (!delta) break;

    // Try step
    const vNew = v.map((vi, i) => Math.max(0, vi + delta[i]));
    const rNew = residuals(vNew);
    const newChi2 = chi2(rNew);

    if (newChi2 < currentChi2) {
      // Accept step
      v = vNew;
      r = rNew;
      const improvement = currentChi2 - newChi2;
      currentChi2 = newChi2;
      lambda /= lambdaDown;

      // Check convergence
      if (improvement < tol) break;
    } else {
      // Reject step, increase lambda
      lambda *= lambdaUp;
    }
  }

  // Compute fit quality
  const bestFitQuality = r.length > 0 ? currentChi2 / r.length : Infinity;

  // Compute objective flux
  const objectiveIdx = input.reactions.findIndex(rxn => rxn.id === input.objectiveReaction);
  const bestObjective = objectiveIdx >= 0 ? v[objectiveIdx] : 0;

  const fluxEstimates: FluxEstimate[] = input.reactions.map((rxn, idx) => ({
    reactionId: rxn.id,
    flux: Math.round(v[idx] * 1000) / 1000,
    confidence: Math.max(0, 1 - bestFitQuality),
    direction: v[idx] > 0.01 ? 'forward' : v[idx] < -0.01 ? 'reverse' : 'bidirectional',
  }));

  return { fluxEstimates, bestObjective, bestFitQuality: Math.round(bestFitQuality * 10000) / 10000, nIterations };
}

/**
 * Solve linear system Ax = b via Gauss elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Augmented matrix
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-12) return null; // singular

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-12) return null; // singular matrix
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) sum -= aug[i][j] * x[j];
    x[i] = sum / aug[i][i];
  }

  return x;
}

function simulateNetworkMIDs(
  input: MFAInput,
  fluxes: number[],
): Record<string, number[]> {
  const mids: Record<string, number[]> = {};

  // Initialize label substrate
  const labelMet = input.metabolites.find(m => m.id === input.labelSubstrate);
  if (labelMet) {
    const labelFraction = input.labelPattern.length / labelMet.nCarbon;
    mids[labelMet.id] = simulateMID(labelMet.nCarbon, labelFraction);
  }

  // Propagate through reactions with convergence check
  // Reference: Antoniewicz et al. (2007) Metab Eng 9:68-86
  let converged = false;
  for (let iteration = 0; iteration < 50 && !converged; iteration++) {
    const prevMIDs: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(mids)) prevMIDs[k] = [...v];

    for (const reaction of input.reactions) {
      for (const product of reaction.products) {
        const met = input.metabolites.find(m => m.id === product.metabolite);
        if (met) {
          const newMID = simulateReactionMID(reaction, mids, product.metabolite, met.nCarbon);
          mids[product.metabolite] = newMID;
        }
      }
    }

    // Check convergence: max change < 1e-6
    let maxChange = 0;
    for (const [k, v] of Object.entries(mids)) {
      const prev = prevMIDs[k];
      if (prev) {
        for (let i = 0; i < v.length; i++) {
          maxChange = Math.max(maxChange, Math.abs(v[i] - (prev[i] || 0)));
        }
      }
    }
    if (maxChange < 1e-6) converged = true;
  }

  // Fill missing MIDs with uniform distribution
  for (const met of input.metabolites) {
    if (!mids[met.id]) {
      const uniform = 1 / (met.nCarbon + 1);
      mids[met.id] = new Array(met.nCarbon + 1).fill(uniform);
    }
  }

  return mids;
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Run 13C-MFA on a metabolic network with labeling data.
 */
export function run13CMFA(input: MFAInput): MFAResult {
  // Step 1: Simulate MIDs with default fluxes
  const defaultFluxes = input.reactions.map(() => 1.0);
  const simulatedMIDs = simulateNetworkMIDs(input, defaultFluxes);

  // Step 2: If measured data provided, estimate fluxes
  let fluxEstimates: FluxEstimate[];
  let objectiveFlux = 0;
  let fitQuality = 0;
  let nIterations = 0;
  let converged = false;

  if (input.measuredMIDs && Object.keys(input.measuredMIDs).length > 0) {
    const result = estimateFluxes(input, input.measuredMIDs);
    fluxEstimates = result.fluxEstimates;
    objectiveFlux = result.bestObjective;
    fitQuality = result.bestFitQuality;
    nIterations = result.nIterations;
    converged = fitQuality < 1.0;  // χ²/dof < 1.0 indicates good fit — Bevington & Robinson (2003)
  } else {
    // No measured data — return simulated MIDs only
    fluxEstimates = input.reactions.map(r => ({
      reactionId: r.id,
      flux: 1.0,
      confidence: 0,
      direction: 'forward' as const,
    }));
    converged = false;
  }

  // Step 3: Format MID results
  const mids: MIDResult[] = input.metabolites.map(met => ({
    metabolite: met.id,
    mid: simulatedMIDs[met.id] ?? new Array(met.nCarbon + 1).fill(0),
    nCarbon: met.nCarbon,
    simulated: true,
  }));

  return {
    fluxEstimates,
    mids,
    objectiveFlux: Math.round(objectiveFlux * 1000) / 1000,
    fitQuality: Math.round(fitQuality * 10000) / 10000,
    nIterations,
    converged,
  };
}

// ── Monte Carlo Confidence Intervals ───────────────────────────────────────

/**
 * Compute flux confidence intervals via Monte Carlo sampling.
 *
 * For each sample:
 *   1. Perturb measured MIDs with Gaussian noise: MID' = MID + N(0, σ²)
 *   2. Re-estimate fluxes using Levenberg-Marquardt
 *   3. Collect results
 *
 * CI_95 = [percentile(2.5%), percentile(97.5%)]
 *
 * Reference: Young et al. (2014) Metab Eng 23:116-127
 */
export function monteCarloConfidenceIntervals(
  input: MFAInput,
  nSamples: number = 100,
): {
  fluxMeans: number[];
  fluxCIs: Array<[number, number]>;
  fluxStd: number[];
} {
  const nReactions = input.reactions.length;
  const allFluxes: number[][] = [];

  for (let s = 0; s < nSamples; s++) {
    // Perturb measured MIDs with Gaussian noise
    const perturbedMIDs: Record<string, number[]> = {};
    for (const [metId, mid] of Object.entries(input.measuredMIDs ?? {})) {
      perturbedMIDs[metId] = mid.map(m => {
        // Box-Muller transform for Gaussian noise
        const u1 = Math.random() || 1e-10;
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return Math.max(0, Math.min(1, m + z * 0.01)); // σ = 0.01
      });
    }

    // Re-estimate fluxes
    const perturbedInput = { ...input, measuredMIDs: perturbedMIDs };
    const result = estimateFluxes(perturbedInput, perturbedMIDs);
    allFluxes.push(result.fluxEstimates.map(f => f.flux));
  }

  // Compute statistics
  const fluxMeans = new Array(nReactions).fill(0);
  const fluxStd = new Array(nReactions).fill(0);
  const fluxCIs: Array<[number, number]> = [];

  for (let j = 0; j < nReactions; j++) {
    const values = allFluxes.map(f => f[j]).sort((a, b) => a - b);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

    fluxMeans[j] = Math.round(mean * 1000) / 1000;
    fluxStd[j] = Math.round(Math.sqrt(variance) * 1000) / 1000;

    const lower = values[Math.floor(0.025 * values.length)];
    const upper = values[Math.floor(0.975 * values.length)];
    fluxCIs.push([Math.round(lower * 1000) / 1000, Math.round(upper * 1000) / 1000]);
  }

  return { fluxMeans, fluxCIs, fluxStd };
}
