/**
 * COBRApy-JSON → repo-FBA-solver adapter (CC-2, T2-FBA benchmark).
 *
 * Loads a standard COBRA JSON model (the format `cobra.io.save_json_model`
 * emits) and feeds it, unchanged, into the repo's own LP solver (`solveLP`,
 * HiGHS) as a mass-balance FBA:
 *
 *     maximize  cᵀ·v      subject to   S·v = 0,   lbᵣ ≤ vᵣ ≤ ubᵣ
 *
 * The model's native reaction bounds already encode the growth medium (e.g.
 * `EX_glc__D_e ≥ -10`, `EX_o2_e ≥ -1000`, `ATPM ≥ 8.39`), so NO medium is
 * injected or overridden here — the whole point of the benchmark is to
 * reproduce the reference tool's solve on the byte-identical model, not to
 * re-guess uptake bounds. (This is why the adapter builds the LP directly
 * rather than routing through `solveDynamicFBA`, whose `EX_*` name heuristics
 * would clobber `EX_co2_e` / `EX_glu__L_e` bounds.)
 */
import { type LPModel, type LPSolution, solveLP } from "../../server/highsSolver";

/** One reaction in a COBRA JSON model (`cobra.io.model_to_dict`). */
export interface CobraReaction {
  id: string;
  name?: string;
  /** metabolite id → stoichiometric coefficient (negative = consumed). */
  metabolites: Record<string, number>;
  lower_bound: number;
  upper_bound: number;
  /** Linear objective weight; absent/0 for non-objective reactions. */
  objective_coefficient?: number;
  gene_reaction_rule?: string;
}

/** One metabolite in a COBRA JSON model. */
export interface CobraMetabolite {
  id: string;
  name?: string;
  compartment?: string;
}

/** Minimal COBRA JSON model shape needed for FBA. */
export interface CobraModel {
  id?: string;
  reactions: CobraReaction[];
  metabolites: CobraMetabolite[];
}

/**
 * Optional per-reaction `[lb, ub]` bound overrides — e.g. a medium change that
 * closes O2 uptake (`EX_o2_e: [0, 1000]`) or switches the carbon source. Keyed by
 * reaction id; any reaction not listed keeps its native model bounds.
 */
export type BoundOverrides = Record<string, readonly number[]>;

/** Result of running a COBRA JSON model through the repo LP solver. */
export interface CobraFBAResult {
  status: LPSolution["status"];
  /** Optimal objective (biomass) value. */
  objectiveValue: number;
  /** Flux of every reaction, keyed by reaction id. */
  fluxes: Record<string, number>;
}

/**
 * Convert a COBRA JSON model into the repo's `LPModel`:
 *   - objective   = Σ objective_coefficient · v_rxn   (maximized)
 *   - constraints = one `S·v = 0` mass-balance row per metabolite
 *   - bounds      = each reaction's native `[lower_bound, upper_bound]`, unless
 *                   `boundOverrides` supplies a replacement `[lb, ub]` for that
 *                   reaction id (a medium change).
 *
 * Coefficients and (un-overridden) bounds are copied verbatim from the model.
 * With no `boundOverrides` this is byte-for-byte the original behavior.
 */
export function cobraToLPModel(model: CobraModel, boundOverrides?: BoundOverrides): LPModel {
  const objective = model.reactions
    .filter((r) => (r.objective_coefficient ?? 0) !== 0)
    .map((r) => ({ name: r.id, coef: r.objective_coefficient as number }));

  // metabolite id → the reactions that touch it (so each balance row is sparse).
  const metToRxns = new Map<string, Array<{ name: string; coef: number }>>();
  for (const m of model.metabolites) metToRxns.set(m.id, []);
  for (const r of model.reactions) {
    for (const [metId, coef] of Object.entries(r.metabolites)) {
      if (coef === 0) continue;
      let entry = metToRxns.get(metId);
      if (!entry) {
        entry = [];
        metToRxns.set(metId, entry);
      }
      entry.push({ name: r.id, coef });
    }
  }

  const constraints = [...metToRxns.entries()].map(([metId, vars]) => ({
    name: `${metId}_balance`,
    vars,
    lb: 0,
    ub: 0,
  }));

  const bounds = model.reactions.map((r) => {
    const ov = boundOverrides?.[r.id];
    return ov ? { name: r.id, lb: ov[0], ub: ov[1] } : { name: r.id, lb: r.lower_bound, ub: r.upper_bound };
  });

  return { name: model.id ?? "cobra_fba", sense: "maximize", objective, constraints, bounds };
}

/**
 * Load a COBRA JSON model into the repo's LP solver and run FBA, optionally
 * applying `boundOverrides` (a medium change) before solving.
 */
export async function runCobraFBA(model: CobraModel, boundOverrides?: BoundOverrides): Promise<CobraFBAResult> {
  const lp = cobraToLPModel(model, boundOverrides);
  const sol = await solveLP(lp);
  return { status: sol.status, objectiveValue: sol.objectiveValue, fluxes: sol.primals };
}
