/**
 * BiGG to LP Converter
 *
 * Converts a BiGG metabolic model (FullBiGGModel) into an LP model
 * suitable for the HiGHS solver. Handles:
 *   - Stoichiometric matrix construction (S * v = 0)
 *   - Reaction bounds from BiGG data
 *   - Exchange reaction detection
 *   - Biomass reaction identification
 *   - Gene knockout support (lb = ub = 0)
 *
 * @scientific_provenance
 *   ALGORITHM: Flux Balance Analysis LP formulation
 *   REFERENCE: Orth JD et al. (2010) Nat Biotechnol 28:245-248
 */

import type { FullBiGGModel, BiGGReaction } from "../services/database/biggClient";
import type { LPModel, LPConstraint, LPVariable } from "./highsSolver";

// ── Types ──────────────────────────────────────────────────────────────

export interface BiGGToFBAOptions {
  /** Reactions to knock out (set lb = ub = 0) */
  knockouts?: string[];
  /** Custom glucose uptake rate (default: 10 mmol/gDW/h) */
  glucoseUptake?: number;
  /** Custom oxygen uptake rate (default: 20 mmol/gDW/h) */
  oxygenUptake?: number;
  /** Objective reaction ID (default: auto-detect biomass) */
  objectiveId?: string;
  /** Maximize (true) or minimize (false) objective */
  maximize?: boolean;
}

export interface BiGGToFBAResult {
  /** LP model for HiGHS solver */
  lpModel: LPModel;
  /** Reaction IDs (order matches LP variables) */
  reactionIds: string[];
  /** Metabolite IDs (order matches LP constraints) */
  metaboliteIds: string[];
  /** Biomass reaction ID */
  biomassId: string | null;
  /** Exchange reactions */
  exchangeReactions: string[];
}

// ── Constants ──────────────────────────────────────────────────────────

/** Default exchange reaction prefixes */
const EXCHANGE_PREFIXES = ["EX_", "DM_", "SK_"];

/** Default transport reaction suffixes */
const TRANSPORT_SUFFIXES = ["_tex", "_tpp", "_abcpp", "_e", "_p", "_c"];

// ── Main Converter ─────────────────────────────────────────────────────

/**
 * Convert a BiGG model to an LP model for FBA.
 */
export function biggToLP(model: FullBiGGModel, options: BiGGToFBAOptions = {}): BiGGToFBAResult {
  const { knockouts = [], glucoseUptake = 10, oxygenUptake = 20, maximize = true } = options;

  // 1. Identify reactions
  const reactions = model.reactions;
  const reactionIds = reactions.map((r) => r.id);

  // 2. Identify metabolites
  const metaboliteSet = new Set<string>();
  for (const rxn of reactions) {
    for (const met of Object.keys(rxn.stoichiometry)) {
      metaboliteSet.add(met);
    }
  }
  const metaboliteIds = Array.from(metaboliteSet);

  // 3. Identify biomass reaction
  const biomassId = options.objectiveId ?? findBiomassReaction(reactions);

  // 4. Identify exchange reactions
  const exchangeReactions = reactions.filter((r) => isExchangeReaction(r.id)).map((r) => r.id);

  // 5. Build stoichiometric matrix
  // S[metabolite][reaction] = stoichiometric coefficient
  const S: number[][] = metaboliteIds.map(() => reactionIds.map(() => 0));

  for (let j = 0; j < reactions.length; j++) {
    const rxn = reactions[j];
    for (const [metId, coeff] of Object.entries(rxn.stoichiometry)) {
      const i = metaboliteIds.indexOf(metId);
      if (i >= 0) {
        S[i][j] = coeff;
      }
    }
  }

  // 6. Build LP variables (one per reaction)
  const variables: LPVariable[] = reactions.map((rxn, j) => {
    let lb = rxn.lb;
    let ub = rxn.ub;

    // Apply knockouts
    if (knockouts.includes(rxn.id)) {
      lb = 0;
      ub = 0;
    }

    // Apply custom uptake rates
    if (rxn.id === "EX_glc__D_e" || rxn.id === "GLCpts") {
      lb = -glucoseUptake;
    }
    if (rxn.id === "EX_o2_e" || rxn.id === "O2tx") {
      lb = -oxygenUptake;
    }

    return { name: rxn.id, coef: 0 };
  });

  // 7. Build constraints (S * v = 0 for each metabolite)
  const constraints: LPConstraint[] = [];

  for (let i = 0; i < metaboliteIds.length; i++) {
    const vars: Array<{ name: string; coef: number }> = [];
    for (let j = 0; j < reactionIds.length; j++) {
      if (Math.abs(S[i][j]) > 1e-10) {
        vars.push({ name: reactionIds[j], coef: S[i][j] });
      }
    }
    if (vars.length > 0) {
      constraints.push({
        name: `met_${metaboliteIds[i]}`,
        vars,
        lb: 0,
        ub: 0,
      });
    }
  }

  // 8. Set objective
  const objective: LPVariable[] = reactionIds.map((id) => ({
    name: id,
    coef: id === biomassId ? (maximize ? -1 : 1) : 0,
  }));

  // 9. Build bounds
  const bounds = reactions.map((rxn, j) => {
    let lb = rxn.lb;
    let ub = rxn.ub;

    if (knockouts.includes(rxn.id)) {
      lb = 0;
      ub = 0;
    }
    if (rxn.id === "EX_glc__D_e" || rxn.id === "GLCpts") {
      lb = -glucoseUptake;
    }
    if (rxn.id === "EX_o2_e" || rxn.id === "O2tx") {
      lb = -oxygenUptake;
    }

    return { name: rxn.id, lb, ub };
  });

  const lpModel: LPModel = {
    sense: maximize ? "maximize" : ("minimize" as "maximize" | "minimize"),
    objective,
    constraints,
    bounds,
  };

  return {
    lpModel,
    reactionIds,
    metaboliteIds,
    biomassId,
    exchangeReactions,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function findBiomassReaction(reactions: BiGGReaction[]): string | null {
  // Common biomass reaction IDs
  const biomassIds = ["BIOMASS_Ecoli_core_w_GAM", "BIOMASS_Ecoli_core", "BIOMASS", "Biomass"];

  for (const id of biomassIds) {
    if (reactions.some((r) => r.id === id)) {
      return id;
    }
  }

  // Fallback: find reaction with "biomass" in name
  const biomass = reactions.find(
    (r) => r.name.toLowerCase().includes("biomass") || r.id.toLowerCase().includes("biomass"),
  );
  return biomass?.id ?? null;
}

function isExchangeReaction(id: string): boolean {
  return (
    EXCHANGE_PREFIXES.some((prefix) => id.startsWith(prefix)) ||
    TRANSPORT_SUFFIXES.some((suffix) => id.endsWith(suffix))
  );
}
