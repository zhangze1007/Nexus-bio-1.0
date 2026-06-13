/**
 * Gillespie Stochastic Simulation Algorithm (SSA)
 *
 * Reference: Gillespie (1977) J Phys Chem 81(25):2340-2361
 *
 * Exact stochastic simulation of chemical reaction networks.
 * Uses the Direct Method: compute propensities, draw exponential
 * time to next reaction, select reaction proportional to propensity.
 */

export interface StochasticSpecies {
  id: string;
  initialCount: number;
}

export interface StochasticReaction {
  id: string;
  reactants: Record<string, number>;
  products: Record<string, number>;
  rate: number;
  hillRepression?: { species: string; K: number; n: number };
  hillActivation?: { species: string; K: number; n: number };
}

export interface StochasticModel {
  species: StochasticSpecies[];
  reactions: StochasticReaction[];
}

export interface GillespieResult {
  trajectories: Record<string, number[]>;
  times: number[];
  reactionEvents: Record<string, number>;
  finalState: Record<string, number>;
}

interface GillespieOptions {
  maxTime: number;
  seed?: number;
  maxSteps?: number;
}

/**
 * Xorshift128+ PRNG for deterministic reproducibility.
 * Returns a function that produces unsigned 32-bit integers.
 */
function createRNG(seed: number): () => number {
  let s0 = seed >>> 0;
  let s1 = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s1 ^= s0;
    s0 = ((s0 << 11) | (s0 >>> 21)) ^ s1 ^ (s1 >>> 19);
    s1 = (s1 << 7) | (s1 >>> 25);
    return (s0 + s1) >>> 0;
  };
}

/**
 * Run the Gillespie SSA on a stochastic reaction model.
 *
 * @param model - Species and reactions defining the chemical system
 * @param options - Simulation parameters (maxTime required, seed and maxSteps optional)
 * @returns Trajectories, timestamps, reaction event counts, and final state
 */
export function runGillespie(
  model: StochasticModel,
  options: GillespieOptions,
): GillespieResult {
  const { maxTime, seed = 0, maxSteps } = options;
  const rng = createRNG(seed);

  // Initialize species counts
  const speciesIds = model.species.map(s => s.id);
  const state: Record<string, number> = {};
  for (const sp of model.species) {
    state[sp.id] = sp.initialCount;
  }

  // Initialize trajectories with initial state
  const trajectories: Record<string, number[]> = {};
  for (const id of speciesIds) {
    trajectories[id] = [state[id]];
  }
  const times: number[] = [0];

  // Initialize reaction event counts
  const reactionEvents: Record<string, number> = {};
  for (const rxn of model.reactions) {
    reactionEvents[rxn.id] = 0;
  }

  let currentTime = 0;
  let step = 0;

  // Constants for PRNG-to-float conversion
  const MAX_U32 = 4294967295; // 2^32 - 1

  while (currentTime < maxTime) {
    // Check maxSteps limit
    if (maxSteps !== undefined && step >= maxSteps) {
      break;
    }

    // Compute propensities for each reaction
    const propensities: number[] = [];
    let totalPropensity = 0;

    for (let i = 0; i < model.reactions.length; i++) {
      const rxn = model.reactions[i];
      let propensity = rxn.rate;

      // For each reactant, multiply by the count (combinatorial)
      for (const [species, stoich] of Object.entries(rxn.reactants)) {
        const count = state[species] ?? 0;
        // If any reactant is depleted, propensity is 0
        if (count < stoich) {
          propensity = 0;
          break;
        }
        // For first-order reactions, propensity = rate * count
        // For higher-order, use falling factorial: n * (n-1) * ... * (n-k+1)
        for (let k = 0; k < stoich; k++) {
          propensity *= (count - k);
        }
      }

      // Apply Hill-function modulation if specified
      if (propensity > 0 && (rxn.hillRepression || rxn.hillActivation)) {
        const hill = rxn.hillRepression ?? rxn.hillActivation!;
        const x = state[hill.species] ?? 0;
        const Kn = Math.pow(hill.K, hill.n);
        const xn = Math.pow(x, hill.n);
        if (rxn.hillRepression) {
          // Repression: propensity = rate * K^n / (K^n + x^n)
          propensity *= Kn / (Kn + xn);
        } else {
          // Activation: propensity = rate * x^n / (K^n + x^n)
          propensity *= xn / (Kn + xn);
        }
      }

      propensities.push(propensity);
      totalPropensity += propensity;
    }

    // If total propensity is zero, no reactions can fire — stop
    if (totalPropensity === 0) {
      break;
    }

    // Draw tau from exponential distribution: tau = -ln(r1) / totalPropensity
    // r1 is uniform on (0, 1]
    let r1 = rng() / MAX_U32;
    // Avoid log(0) by ensuring r1 > 0
    while (r1 === 0) {
      r1 = rng() / MAX_U32;
    }
    const tau = -Math.log(r1) / totalPropensity;

    // Check if this would exceed maxTime
    if (currentTime + tau > maxTime) {
      break;
    }

    // Select which reaction fires: draw r2 uniform on (0, 1]
    let r2 = rng() / MAX_U32;
    while (r2 === 0) {
      r2 = rng() / MAX_U32;
    }
    const threshold = r2 * totalPropensity;

    let cumulativePropensity = 0;
    let selectedReaction = -1;
    for (let i = 0; i < propensities.length; i++) {
      cumulativePropensity += propensities[i];
      if (cumulativePropensity >= threshold) {
        selectedReaction = i;
        break;
      }
    }

    // Fallback to last reaction (handles floating-point edge case)
    if (selectedReaction === -1) {
      selectedReaction = propensities.length - 1;
    }

    // Update time
    currentTime += tau;

    // Fire the selected reaction: subtract reactants, add products
    const rxn = model.reactions[selectedReaction];
    for (const [species, stoich] of Object.entries(rxn.reactants)) {
      state[species] = (state[species] ?? 0) - stoich;
    }
    for (const [species, stoich] of Object.entries(rxn.products)) {
      state[species] = (state[species] ?? 0) + stoich;
    }

    // Record event
    reactionEvents[rxn.id]++;

    // Record trajectory
    times.push(currentTime);
    for (const id of speciesIds) {
      trajectories[id].push(state[id]);
    }

    step++;
  }

  // Build final state from last trajectory point
  const finalState: Record<string, number> = {};
  for (const id of speciesIds) {
    finalState[id] = trajectories[id][trajectories[id].length - 1];
  }

  return {
    trajectories,
    times,
    reactionEvents,
    finalState,
  };
}
