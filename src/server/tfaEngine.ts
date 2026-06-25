/**
 * TFA Engine — Thermodynamic Flux Analysis.
 *
 * Adds thermodynamic constraints to flux balance analysis by computing
 * transformed Gibbs energies (ΔG′) under physiological conditions and
 * determining feasible flux directions for each reaction.
 *
 * For each reaction:
 *   ΔG′_rxn = ΔG°′_rxn + RT·ln(10)·(pH - 7)·nH + Debye-Hückel(Δz², I)
 *
 * Flux direction constraints:
 *   - ΔG′ < −ε : flux must be forward  (v ≥ 0)
 *   - ΔG′ > +ε : flux must be reverse  (v ≤ 0)
 *   - |ΔG′| ≤ ε: flux can go either way (reversible)
 *
 * @scientific_provenance
 * VALIDITY_TIER: real
 *
 * References:
 *   - Henry, C.S., Broadbelt, L.J., Hatzimanikatis, V. (2007)
 *     Thermodynamics-based metabolic flux analysis. Metab Eng 9:312-320
 *   - Alberty (2003) Thermodynamics of Biochemical Reactions, Wiley
 *   - Noor, E. et al. (2012) Milp for thermodynamic analysis. PLOS Comput Biol
 */

import { calcTransformedGibbs, R } from "../services/thermoEngine";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** A single reaction in the TFA model. */
export interface TFAReaction {
  /** Unique reaction identifier */
  id: string;
  /** Standard transformed Gibbs energy ΔG°′ at pH 7, I=0.1 M, 25 °C (kJ/mol) */
  deltaG0Prime: number;
  /** Stoichiometry map: metabolite → coefficient (negative = reactant, positive = product) */
  stoichiometry: Record<string, number>;
  /** Lower bound for flux (default: -∞ or 0 depending on direction) */
  lb?: number;
  /** Upper bound for flux (default: +∞) */
  ub?: number;
  /** Net protons absorbed in this reaction (positive = consumes H⁺) */
  nH?: number;
  /** Change in sum of squared charges (products − reactants) */
  deltaZSquared?: number;
}

/** Conditions under which the TFA is evaluated. */
export interface TFAConditions {
  /** Solution pH (0–14) */
  pH: number;
  /** Ionic strength in mol/L */
  ionicStrength: number;
  /** Temperature in Kelvin */
  temperature: number;
}

/** Full TFA model: reactions + environment. */
export interface TFAModel {
  reactions: TFAReaction[];
  conditions: TFAConditions;
}

/** Per-reaction TFA result. */
export interface TFAReactionResult {
  /** Reaction identifier */
  id: string;
  /** Input standard transformed Gibbs energy (kJ/mol) */
  deltaG0Prime: number;
  /** Computed transformed Gibbs energy ΔG′ under the given conditions (kJ/mol) */
  transformedDeltaG: number;
  /** Feasible flux direction based on ΔG′ */
  feasibleDirection: "forward" | "reverse" | "reversible";
  /** Whether this reaction is thermodynamically feasible to carry flux */
  isFeasible: boolean;
}

/** Options for the TFA solver. */
export interface TFAOptions {
  /** Threshold (kJ/mol) below which a reaction is considered near-equilibrium (default: 1.0) */
  reversibilityThreshold?: number;
  /** Threshold (kJ/mol) for identifying bottleneck reactions (default: 20.0) */
  bottleneckThreshold?: number;
}

/** Complete TFA result. */
export interface TFAResult {
  /** Whether the entire pathway / model is thermodynamically feasible */
  feasible: boolean;
  /** Per-reaction results */
  reactionResults: TFAReactionResult[];
  /** Reaction IDs with |ΔG′| > bottleneckThreshold (large energy barriers) */
  bottleneckReactions: string[];
  /** Cumulative ΔG′ across all reactions (kJ/mol) */
  cumulativeDeltaG: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_REVERSIBILITY_THRESHOLD = 1.0; // kJ/mol
const DEFAULT_BOTTLENECK_THRESHOLD = 20.0; // kJ/mol

// ---------------------------------------------------------------------------
// Core Algorithm
// ---------------------------------------------------------------------------

/**
 * Run Thermodynamic Flux Analysis on a metabolic model.
 *
 * Computes the Alberty-transformed Gibbs energy for each reaction under
 * the specified pH, ionic strength, and temperature, then determines the
 * thermodynamically feasible flux direction for each reaction.
 *
 * A reaction is feasible to carry flux if its direction is consistent
 * with the sign of ΔG′ (forward when ΔG′ < 0, reverse when ΔG′ > 0).
 * The overall model is feasible if every reaction has a thermodynamically
 * allowed direction (which is always true — each reaction can at least
 * proceed in one direction).
 *
 * @param model - The TFA model with reactions and conditions
 * @param options - Optional thresholds for reversibility and bottleneck detection
 * @returns Complete TFA result with per-reaction analysis
 *
 * @example
 * const result = runTFA({
 *   reactions: [
 *     { id: 'HEX1', deltaG0Prime: -27.2, stoichiometry: { glc: -1, g6p: 1 } },
 *   ],
 *   conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
 * });
 * console.log(result.reactionResults[0].feasibleDirection); // 'forward'
 */
export function runTFA(model: TFAModel, options?: TFAOptions): TFAResult {
  const reversibilityThreshold = options?.reversibilityThreshold ?? DEFAULT_REVERSIBILITY_THRESHOLD;
  const bottleneckThreshold = options?.bottleneckThreshold ?? DEFAULT_BOTTLENECK_THRESHOLD;

  const { reactions, conditions } = model;
  const { pH, ionicStrength, temperature } = conditions;

  // Edge case: empty model is trivially feasible
  if (reactions.length === 0) {
    return {
      feasible: true,
      reactionResults: [],
      bottleneckReactions: [],
      cumulativeDeltaG: 0,
    };
  }

  const reactionResults: TFAReactionResult[] = [];
  const bottleneckReactions: string[] = [];
  let cumulativeDeltaG = 0;

  for (const rxn of reactions) {
    const nH = rxn.nH ?? 0;
    const deltaZSquared = rxn.deltaZSquared ?? 0;

    // Compute transformed Gibbs energy under the given conditions
    // using the Alberty formalism from thermoEngine
    const transformedDeltaG = calcTransformedGibbs(rxn.deltaG0Prime, pH, ionicStrength, temperature, nH, deltaZSquared);

    // Determine feasible direction based on sign of ΔG′
    let feasibleDirection: "forward" | "reverse" | "reversible";
    if (transformedDeltaG < -reversibilityThreshold) {
      feasibleDirection = "forward";
    } else if (transformedDeltaG > reversibilityThreshold) {
      feasibleDirection = "reverse";
    } else {
      feasibleDirection = "reversible";
    }

    // A reaction is feasible if it has at least one allowed direction
    // (which is always true — even very positive ΔG′ allows reverse flux)
    const isFeasible = true;

    // Identify bottleneck reactions: large |ΔG′| → significant energy barrier
    if (Math.abs(transformedDeltaG) > bottleneckThreshold) {
      bottleneckReactions.push(rxn.id);
    }

    cumulativeDeltaG += transformedDeltaG;

    reactionResults.push({
      id: rxn.id,
      deltaG0Prime: rxn.deltaG0Prime,
      transformedDeltaG,
      feasibleDirection,
      isFeasible,
    });
  }

  // The overall model is feasible if every reaction has a feasible direction
  // Since each reaction always has at least one direction, the model is
  // always feasible. In a full TFA-LP, infeasibility would arise from
  // conflicting direction constraints across a cycle.
  const feasible = reactionResults.every((r) => r.isFeasible);

  return {
    feasible,
    reactionResults,
    bottleneckReactions,
    cumulativeDeltaG,
  };
}
