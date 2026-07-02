/**
 * Curated 2-species community metabolic model (E. coli + S. cerevisiae).
 *
 * A minimal, mass-consistent, literature-grounded consortium designed to be run
 * through the SteadyCom joint-LP engine (`steadyCom`, `buildCommunityLPModel`).
 * It produces REAL mutual cross-feeding: E. coli secretes acetate that yeast
 * consumes, and yeast secretes ethanol that E. coli consumes. No numeric OUTPUT
 * is hardcoded here — this module only declares stoichiometry and bounds; all
 * fluxes/growth rates come from the LP solve.
 *
 * ── Cross-feeding biology ────────────────────────────────────────────────────
 *   - E. coli overflows ACETATE: under glycolytic growth, acetate secretion is
 *     an obligate byproduct of ATP-generating carbon flux (overflow metabolism).
 *   - Yeast ferments glucose to ETHANOL even in the presence of oxygen
 *     (Crabtree effect): ethanol is an obligate fermentation byproduct.
 *   - The shared extracellular pool (`acetate_e`, `ethanol_e`) is CLOSED — it has
 *     NO environmental source. A shared metabolite can reach a consumer ONLY via
 *     the partner species' secretion. Uptake reactions are IRREVERSIBLE
 *     (lowerBound 0, consume-only) so a consumer can never manufacture the shared
 *     metabolite by running the exchange in reverse. This makes the cross-feeding
 *     genuine (not a self-supply artifact) and coexistence obligately mutual.
 *
 * ── Three-id convention per shared metabolite (prevents self-supply loops) ────
 *   acetate:  producer-internal `acetate_int` (E. coli) -> shared `acetate_e`
 *             -> consumer-internal `ac_yc` (yeast)
 *   ethanol:  producer-internal `ethanol_int` (yeast)  -> shared `ethanol_e`
 *             -> consumer-internal `eth_ec` (E. coli)
 *   Only `acetate_e` and `ethanol_e` appear in `sharedMetabolites`; the internal
 *   ids are balanced inside their species (excluded from the shared-pool balance).
 *
 * ── FBA sign / orientation convention ────────────────────────────────────────
 *   - Substrate uptake reactions PRODUCE the internal substrate: {glc: +1},
 *     [0, uptakeCapacity]; the request sets the upperBound (capacity).
 *   - Secretion: {producer_int: -1, shared: +1}, irreversible [0, +].
 *   - Uptake of a shared metabolite: {shared: -1, consumer_int: +1}, IRREVERSIBLE
 *     [0, +] (consume-only).
 *   - Oxygen uptake defaults to 0 (anaerobic/fermentative baseline); when the
 *     request supplies `oxygenUptake > 0`, aerobic respiration of the imported
 *     cross-fed byproduct yields extra ATP (still gated on cross-feeding, so it
 *     cannot bypass the obligate coupling).
 *
 * @scientific_provenance
 *   METHOD:  Chan SHJ, Simons MN, Maranas CD (2017). "SteadyCom: Predicting
 *     microbial abundances while ensuring community stability." PLOS
 *     Computational Biology 13(5): e1005539. DOI 10.1371/journal.pcbi.1005539.
 *   ACETATE OVERFLOW: Basan M, Hui S, Okano H, Zhang Z, Shen Y, Williamson JR,
 *     Hwa T (2015). "Overflow metabolism in Escherichia coli results from
 *     efficient proteome allocation." Nature 528:99-104. DOI 10.1038/nature15765.
 *   ETHANOL FERMENTATION (Crabtree effect): De Deken RH (1966). "The Crabtree
 *     effect: a regulatory system in yeast." Journal of General Microbiology
 *     44(2):149-156. PMID 5969497.
 */

import type { SteadyComSpecies } from "../server/fbaSteadyCom";

/* ------------------------------------------------------------------ */
/*  Public interface                                                   */
/* ------------------------------------------------------------------ */

/** The two extracellular, community-balanced (closed-pool) shared metabolites. */
export const COMMUNITY_SHARED_METABOLITES: string[] = ["acetate_e", "ethanol_e"];

/** Default uptake capacities (upper bounds) when a request omits them. */
const DEFAULT_GLUCOSE_UPTAKE = 10;
const DEFAULT_OXYGEN_UPTAKE = 0; // fermentative baseline; O2 is opt-in
/** Generous internal-flux ceiling (never binding; real caps come from uptake). */
const FLUX_MAX = 1000;

export interface CommunityModelRequest {
  ecoli: { glucoseUptake?: number; oxygenUptake?: number };
  yeast: { glucoseUptake?: number; oxygenUptake?: number };
  /** Optional fixed abundance fraction for yeast (0 < alpha < 1). */
  alpha?: number;
}

export interface CommunityModel {
  species: SteadyComSpecies[];
  sharedMetabolites: string[];
  fixedAbundance?: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/*  Base species builders (fresh objects every call — no shared state) */
/* ------------------------------------------------------------------ */

/**
 * E. coli: grows on glucose; ATP-generating glycolytic flux OBLIGATELY co-produces
 * acetate (Basan 2015) that must be exported to the closed pool. Can additionally
 * assimilate ethanol imported from yeast for extra biomass precursor + ATP.
 */
function buildEcoli(glucoseUptake: number, oxygenUptake: number): SteadyComSpecies {
  return {
    id: "ecoli",
    name: "Escherichia coli",
    biomassReaction: "BIOMASS_ecoli",
    metabolites: ["glc", "atp", "accoa", "acetate_int", "eth_ec", "o2"],
    reactions: [
      // Glucose uptake (capacity = request). Produces internal glucose.
      { id: "EX_glc", stoichiometry: { glc: 1 }, lowerBound: 0, upperBound: glucoseUptake },
      // Glycolysis: glucose -> 1 acetyl-CoA (biomass carbon) + 1 acetate_int
      // (obligate overflow, fixed 1:1) + 2 ATP.
      {
        id: "GLYC",
        stoichiometry: { glc: -1, atp: 2, accoa: 1, acetate_int: 1 },
        lowerBound: 0,
        upperBound: FLUX_MAX,
      },
      // Acetate secretion into the shared pool (irreversible).
      { id: "EX_ac", stoichiometry: { acetate_int: -1, acetate_e: 1 }, lowerBound: 0, upperBound: FLUX_MAX },
      // Biomass: consumes acetyl-CoA (carbon) + ATP (energy).
      { id: "BIOMASS_ecoli", stoichiometry: { accoa: -1, atp: -1 }, lowerBound: 0, upperBound: FLUX_MAX },
      // Ethanol uptake from the shared pool (irreversible, consume-only).
      { id: "UP_etoh", stoichiometry: { ethanol_e: -1, eth_ec: 1 }, lowerBound: 0, upperBound: FLUX_MAX },
      // Ethanol assimilation: ethanol -> acetyl-CoA + ATP.
      { id: "ETOH_ASSIM", stoichiometry: { eth_ec: -1, accoa: 1, atp: 1 }, lowerBound: 0, upperBound: FLUX_MAX },
      // Oxygen uptake (capacity = request; default 0).
      { id: "EX_o2", stoichiometry: { o2: 1 }, lowerBound: 0, upperBound: oxygenUptake },
      // Aerobic respiration of imported ethanol for extra ATP (gated on O2 + ethanol).
      { id: "RESP", stoichiometry: { o2: -1, eth_ec: -1, atp: 3 }, lowerBound: 0, upperBound: FLUX_MAX },
      // ATP maintenance / non-growth sink.
      { id: "ATPM", stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: FLUX_MAX },
    ],
  };
}

/**
 * S. cerevisiae: grows on glucose; glycolytic flux OBLIGATELY co-produces ethanol
 * (Crabtree effect; De Deken 1966) that must be exported to the closed pool. Can
 * additionally assimilate acetate imported from E. coli for extra precursor + ATP.
 */
function buildYeast(glucoseUptake: number, oxygenUptake: number): SteadyComSpecies {
  return {
    id: "yeast",
    name: "Saccharomyces cerevisiae",
    biomassReaction: "BIOMASS_yeast",
    metabolites: ["glc_y", "atp", "pyr", "ethanol_int", "ac_yc", "o2"],
    reactions: [
      // Glucose uptake (capacity = request). Produces internal glucose.
      { id: "EX_glc_y", stoichiometry: { glc_y: 1 }, lowerBound: 0, upperBound: glucoseUptake },
      // Glycolysis + fermentation: glucose -> 1 pyruvate (biomass carbon) +
      // 1 ethanol_int (obligate Crabtree overflow, fixed 1:1) + 2 ATP.
      {
        id: "GLYC_y",
        stoichiometry: { glc_y: -1, atp: 2, pyr: 1, ethanol_int: 1 },
        lowerBound: 0,
        upperBound: FLUX_MAX,
      },
      // Ethanol secretion into the shared pool (irreversible).
      { id: "EX_etoh", stoichiometry: { ethanol_int: -1, ethanol_e: 1 }, lowerBound: 0, upperBound: FLUX_MAX },
      // Biomass: consumes pyruvate (carbon) + ATP (energy).
      { id: "BIOMASS_yeast", stoichiometry: { pyr: -1, atp: -1 }, lowerBound: 0, upperBound: FLUX_MAX },
      // Acetate uptake from the shared pool (irreversible, consume-only).
      { id: "UP_ac", stoichiometry: { acetate_e: -1, ac_yc: 1 }, lowerBound: 0, upperBound: FLUX_MAX },
      // Acetate assimilation: acetate -> pyruvate + ATP.
      { id: "AC_ASSIM", stoichiometry: { ac_yc: -1, pyr: 1, atp: 1 }, lowerBound: 0, upperBound: FLUX_MAX },
      // Oxygen uptake (capacity = request; default 0).
      { id: "EX_o2_y", stoichiometry: { o2: 1 }, lowerBound: 0, upperBound: oxygenUptake },
      // Aerobic respiration of imported acetate for extra ATP (gated on O2 + acetate).
      { id: "RESP_y", stoichiometry: { o2: -1, ac_yc: -1, atp: 3 }, lowerBound: 0, upperBound: FLUX_MAX },
      // ATP maintenance / non-growth sink.
      { id: "ATPM_y", stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: FLUX_MAX },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Public builder                                                     */
/* ------------------------------------------------------------------ */

/**
 * Build the curated 2-species community for a given request.
 *
 * Sets each species' glucose/oxygen uptake upperBounds from the request and,
 * when `alpha` is provided (0 < alpha < 1), returns a `fixedAbundance` map
 * `{ yeast: alpha, ecoli: 1 - alpha }` for the engine to impose. Returns fresh
 * objects on every call so callers may safely mutate (e.g. knock out reactions).
 */
export function buildCommunityModel(req: CommunityModelRequest): CommunityModel {
  const ecoli = buildEcoli(
    req.ecoli.glucoseUptake ?? DEFAULT_GLUCOSE_UPTAKE,
    req.ecoli.oxygenUptake ?? DEFAULT_OXYGEN_UPTAKE,
  );
  const yeast = buildYeast(
    req.yeast.glucoseUptake ?? DEFAULT_GLUCOSE_UPTAKE,
    req.yeast.oxygenUptake ?? DEFAULT_OXYGEN_UPTAKE,
  );

  const model: CommunityModel = {
    species: [ecoli, yeast],
    sharedMetabolites: [...COMMUNITY_SHARED_METABOLITES],
  };

  if (req.alpha !== undefined && req.alpha > 0 && req.alpha < 1) {
    model.fixedAbundance = { yeast: req.alpha, ecoli: 1 - req.alpha };
  }

  return model;
}
