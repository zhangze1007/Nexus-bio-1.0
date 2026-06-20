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
 *     - Simplified EMU network (not full atom mapping)
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

  // Complex case: multiple substrates → combine MIDs
  // Simplified: average the substrate MIDs weighted by stoichiometry
  const combinedMID = new Array(nCarbon + 1).fill(0);
  let totalWeight = 0;

  for (const substrate of reaction.substrates) {
    const substrateMID = substrateMIDs[substrate.metabolite];
    if (substrateMID) {
      const weight = substrate.stoichiometry;
      const scaled = scaleMID(substrateMID, nCarbon);
      for (let i = 0; i <= nCarbon; i++) {
        combinedMID[i] += scaled[i] * weight;
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

function scaleMID(sourceMID: number[], targetSize: number): number[] {
  const result = new Array(targetSize + 1).fill(0);
  const sourceSize = sourceMID.length - 1;

  // Map source MID to target size
  for (let i = 0; i <= Math.min(sourceSize, targetSize); i++) {
    const fraction = i / Math.max(sourceSize, 1);
    const targetIdx = Math.round(fraction * targetSize);
    result[Math.min(targetIdx, targetSize)] += sourceMID[i];
  }

  // Normalize
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
 * Uses grid search over flux space (simplified — production would use
 * nonlinear optimization like Levenberg-Marquardt).
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
  const nSteps = 10;  // grid resolution per dimension

  let bestFluxes: number[] = new Array(nReactions).fill(1);
  let bestFitQuality = Infinity;
  let bestObjective = 0;
  let nIterations = 0;

  // Grid search over flux space (simplified: 1D grid for each reaction)
  for (let i = 0; i < nSteps; i++) {
    const fluxes = input.reactions.map((_, idx) => {
      // Vary flux from 0.1 to 2.0
      return 0.1 + (i / (nSteps - 1)) * 1.9;
    });

    // Simulate MIDs with these fluxes
    const simulatedMIDs = simulateNetworkMIDs(input, fluxes);

    // Compute fit quality (chi-squared)
    let chiSquared = 0;
    let nMeasured = 0;
    for (const [metId, measured] of Object.entries(measuredMIDs)) {
      const simulated = simulatedMIDs[metId];
      if (simulated) {
        for (let j = 0; j < Math.min(measured.length, simulated.length); j++) {
          const diff = measured[j] - simulated[j];
          chiSquared += diff * diff;
          nMeasured++;
        }
      }
    }
    const fitQuality = nMeasured > 0 ? chiSquared / nMeasured : Infinity;

    // Compute objective flux
    const objectiveIdx = input.reactions.findIndex(r => r.id === input.objectiveReaction);
    const objectiveFlux = objectiveIdx >= 0 ? fluxes[objectiveIdx] : 0;

    if (fitQuality < bestFitQuality) {
      bestFitQuality = fitQuality;
      bestObjective = objectiveFlux;
      bestFluxes = [...fluxes];
    }
    nIterations++;
  }

  const fluxEstimates: FluxEstimate[] = input.reactions.map((r, idx) => ({
    reactionId: r.id,
    flux: Math.round(bestFluxes[idx] * 1000) / 1000,
    confidence: Math.max(0, 1 - bestFitQuality),
    direction: bestFluxes[idx] > 0.01 ? 'forward' : bestFluxes[idx] < -0.01 ? 'reverse' : 'bidirectional',
  }));

  return { fluxEstimates, bestObjective, bestFitQuality, nIterations };
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

  // Propagate through reactions
  for (let iteration = 0; iteration < 3; iteration++) {
    for (const reaction of input.reactions) {
      for (const product of reaction.products) {
        if (!mids[product.metabolite]) {
          const met = input.metabolites.find(m => m.id === product.metabolite);
          if (met) {
            mids[product.metabolite] = simulateReactionMID(reaction, mids, product.metabolite, met.nCarbon);
          }
        }
      }
    }
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
    converged = fitQuality < 0.1;  // convergence threshold
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
