/**
 * Flux Balance Analysis engine.
 *
 * Implements FBA (Orth et al., 2010) with a simplex LP solver for single-species
 * and community metabolic models. Supports biomass, ATP, and product objectives
 * with gene knockout and overexpression strategies.
 *
 * @references
 * - Orth, J.D., Thiele, I. & Palsson, B.O. (2010). What is flux balance analysis? Nat. Biotechnol. 28(3), 245-248.
 */

import { buildCommunityModel } from "../data/communityModel";
import { IJO1366_METABOLITES, IJO1366_REACTIONS, IJO1366_STATS } from "../data/iJO1366Subset";
import { type CommunityFBAOutput, type FBAOutput } from "../data/mockFBA";
import type { BiGGReaction } from "../services/database/biggClient";
import { steadyCom } from "./fbaSteadyCom";
import { type LPModel, solveLP } from "./highsSolver";

export type FBAObjective = "biomass" | "atp" | "product";
export type FBASpecies = "ecoli" | "yeast";

export interface SingleSpeciesFBARequest {
  species: FBASpecies;
  objective: FBAObjective;
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts?: string[];
}

export interface CommunityFBARequest {
  objective: FBAObjective;
  alpha?: number;
  ecoli: Omit<SingleSpeciesFBARequest, "species" | "objective">;
  yeast: Omit<SingleSpeciesFBARequest, "species" | "objective">;
}

type ReactionBound = {
  id: string;
  lb: number;
  ub: number | ((context: SingleSpeciesFBARequest) => number);
};

type Constraint = {
  name: string;
  vars: Array<{ name: string; coef: number }>;
};

type ObjectiveMap = Record<FBAObjective, Array<{ name: string; coef: number }>>;

type NetworkSpec = {
  species: FBASpecies;
  reactions: ReactionBound[];
  constraints: Constraint[];
  objectives: ObjectiveMap;
  /** Constraint name that captures glucose uptake shadow price */
  glucoseConstraint: string;
  /** Constraint name that captures oxygen uptake shadow price */
  oxygenConstraint: string;
  deriveMetrics: (
    vars: Record<string, number>,
    request: SingleSpeciesFBARequest,
    status: number,
    objectiveValue: number,
  ) => Omit<FBAOutput, "sensitivityCoefficients">;
};

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

import { clamp } from "../utils/math";

/** Carbon content of E. coli biomass: mol C per g dry weight (Neidhardt et al., 1990) */
const BIOMASS_CARBON_CONTENT_ECOLI = 4.6;
/** Carbon content of yeast biomass: mol C per g dry weight */
const BIOMASS_CARBON_CONTENT_YEAST = 4.2;
/** Carbon atoms per mol glucose */
const GLUCOSE_CARBON = 6;
/** Product carbon content for E. coli product (mol C per mol product) */
const PRODUCT_CARBON_ECOLI = 6;
/** Product carbon content for yeast product (mol C per mol product) */
const PRODUCT_CARBON_YEAST = 5.6;

// ⚠️ LEGACY / SUPERSEDED — DO NOT wire this back into the E. coli solve path.
// This 10-reaction toy network has no genuine biomass stoichiometry, so it solves
// to a biologically impossible 12–20 h⁻¹. E. coli single-species FBA now goes
// through the real e_coli_core model (see `solveEcoliCoreFBA` / `buildExpandedModel`
// below; COBRApy-verified ~0.87 h⁻¹). It is retained ONLY because `NETWORKS` is
// typed as a full Record<FBASpecies, …>; nothing selects `NETWORKS.ecoli` anymore.
const ECOLI_NETWORK: NetworkSpec = {
  species: "ecoli",
  reactions: [
    { id: "GLCpts", lb: 0, ub: ({ glucoseUptake }) => clamp(glucoseUptake, 0, 25) },
    { id: "PGI", lb: 0, ub: 100 },
    { id: "PFK", lb: 0, ub: 100 },
    { id: "FBA", lb: 0, ub: 100 },
    { id: "GAPD", lb: 0, ub: 200 },
    { id: "PYK", lb: 0, ub: 100 },
    { id: "PDH", lb: 0, ub: 100 },
    { id: "O2tx", lb: 0, ub: ({ oxygenUptake }) => clamp(oxygenUptake, 0, 25) },
    { id: "BIOMASS", lb: 0, ub: 100 },
    { id: "PRODUCT", lb: 0, ub: 100 },
  ],
  constraints: [
    {
      name: "g6p_balance",
      vars: [
        { name: "GLCpts", coef: 1 },
        { name: "PGI", coef: -1 },
      ],
    },
    {
      name: "f6p_balance",
      vars: [
        { name: "PGI", coef: 1 },
        { name: "PFK", coef: -1 },
      ],
    },
    {
      name: "fbp_balance",
      vars: [
        { name: "PFK", coef: 1 },
        { name: "FBA", coef: -1 },
      ],
    },
    {
      name: "gap_balance",
      vars: [
        { name: "FBA", coef: 2 },
        { name: "GAPD", coef: -1 },
      ],
    },
    {
      name: "pep_balance",
      vars: [
        { name: "GAPD", coef: 1 },
        { name: "PYK", coef: -1 },
      ],
    },
    {
      name: "pyr_balance",
      vars: [
        { name: "PYK", coef: 1 },
        { name: "PDH", coef: -1 },
      ],
    },
    {
      name: "accoa_balance",
      vars: [
        { name: "PDH", coef: 1 },
        { name: "BIOMASS", coef: -1 },
        { name: "PRODUCT", coef: -1 },
      ],
    },
    {
      name: "oxygen_balance",
      vars: [
        { name: "O2tx", coef: 1 },
        { name: "PDH", coef: -1 },
      ],
    },
  ],
  glucoseConstraint: "g6p_balance",
  oxygenConstraint: "oxygen_balance",
  objectives: {
    biomass: [
      { name: "BIOMASS", coef: 1 },
      { name: "PRODUCT", coef: 0.08 },
    ],
    product: [
      { name: "PRODUCT", coef: 1 },
      { name: "BIOMASS", coef: 0.05 },
    ],
    atp: [
      { name: "GAPD", coef: 1 },
      { name: "PYK", coef: 1 },
      { name: "BIOMASS", coef: 0.15 },
    ],
  },
  deriveMetrics: (vars, _request, status, objectiveValue) => {
    const glc = vars.GLCpts ?? 0;
    const biomass = vars.BIOMASS ?? 0;
    const product = vars.PRODUCT ?? 0;
    /** ATP yield from glycolysis per glucose: GAPD produces 1 ATP, PYK produces 1 ATP, PFK consumes 1 ATP. PDH is excluded as it produces NADH, not ATP. */
    const atpYield = glc > 1e-9 ? ((vars.GAPD ?? 0) + (vars.PYK ?? 0) - (vars.PFK ?? 0)) / glc : 0;
    const carbonEfficiency =
      glc > 1e-9
        ? ((biomass * BIOMASS_CARBON_CONTENT_ECOLI + product * PRODUCT_CARBON_ECOLI) / (glc * GLUCOSE_CARBON)) * 100
        : 0;
    const growthRate = biomass;
    const feasible = status === 2 && objectiveValue > 1e-6;
    return {
      fluxes: {
        GLCpts: round(vars.GLCpts ?? 0),
        PGI: round(vars.PGI ?? 0),
        PFK: round(vars.PFK ?? 0),
        FBA: round(vars.FBA ?? 0),
        GAPD: round(vars.GAPD ?? 0),
        // PGK and ENO carry the same flux as GAPD in this linear glycolysis
        // segment (GAPD → PGK → ENO → PYK). This is a simplification — the
        // legacy network does not include independent PGK/ENO variables.
        PGK: round(vars.GAPD ?? 0),
        ENO: round(vars.GAPD ?? 0),
        PYK: round(vars.PYK ?? 0),
        PDH: round(vars.PDH ?? 0),
        O2tx: round(vars.O2tx ?? 0),
        BIOMASS: round(vars.BIOMASS ?? 0),
        PRODUCT: round(vars.PRODUCT ?? 0),
      },
      growthRate: round(growthRate),
      atpYield: round(atpYield, 2),
      nadhProduction: round(vars.GAPD ?? 0, 2),
      carbonEfficiency: round(clamp(carbonEfficiency, 0, 100), 1),
      feasible,
    };
  },
};

/**
 * Yeast FBA network (R-30: SIMPLIFIED — no TCA cycle)
 *
 * This is a minimal glycolysis-only model for demonstration purposes.
 * It does NOT include:
 * - TCA cycle (citrate synthase, isocitrate dehydrogenase, α-ketoglutarate dehydrogenase, etc.)
 * - Electron transport chain
 * - Pentose phosphate pathway
 * - Amino acid biosynthesis
 *
 * For quantitative yeast metabolic modeling, use the Yeast8 consensus model
 * (Lu et al., 2019) or yEcoGSY (Sánchez et al., 2017).
 */
const YEAST_NETWORK: NetworkSpec = {
  species: "yeast",
  reactions: [
    { id: "HXT", lb: 0, ub: ({ glucoseUptake }) => clamp(glucoseUptake, 0, 20) },
    { id: "HXK", lb: 0, ub: 100 },
    { id: "PGI_y", lb: 0, ub: 100 },
    { id: "PFK_y", lb: 0, ub: 100 },
    { id: "TPI", lb: 0, ub: 200 },
    { id: "PDC", lb: 0, ub: 100 },
    { id: "ADH", lb: 0, ub: 100 },
    { id: "ACS", lb: 0, ub: 100 },
    { id: "IDH", lb: 0, ub: 100 },
    { id: "O2tx_y", lb: 0, ub: ({ oxygenUptake }) => clamp(oxygenUptake, 0, 20) },
    { id: "BIOMASS_y", lb: 0, ub: 100 },
    { id: "PRODUCT_y", lb: 0, ub: 100 },
  ],
  constraints: [
    {
      name: "glc_balance",
      vars: [
        { name: "HXT", coef: 1 },
        { name: "HXK", coef: -1 },
      ],
    },
    {
      name: "g6p_balance",
      vars: [
        { name: "HXK", coef: 1 },
        { name: "PGI_y", coef: -1 },
      ],
    },
    {
      name: "f6p_balance",
      vars: [
        { name: "PGI_y", coef: 1 },
        { name: "PFK_y", coef: -1 },
      ],
    },
    {
      name: "fbp_balance",
      vars: [
        { name: "PFK_y", coef: 1 },
        { name: "TPI", coef: -1 },
      ],
    },
    {
      name: "fermentation_branch",
      vars: [
        { name: "TPI", coef: 1 },
        { name: "PDC", coef: -1 },
      ],
    },
    {
      name: "ethanol_branch",
      vars: [
        { name: "PDC", coef: 1 },
        { name: "ADH", coef: -1 },
        { name: "ACS", coef: -1 },
      ],
    },
    {
      name: "oxygen_balance",
      vars: [
        { name: "O2tx_y", coef: 1 },
        { name: "ACS", coef: -1 },
      ],
    },
    {
      name: "accoa_balance",
      vars: [
        { name: "ACS", coef: 1 },
        { name: "IDH", coef: -1 },
      ],
    },
    {
      name: "growth_balance",
      vars: [
        { name: "IDH", coef: 1 },
        { name: "BIOMASS_y", coef: -1 },
        { name: "PRODUCT_y", coef: -1 },
      ],
    },
  ],
  glucoseConstraint: "glc_balance",
  oxygenConstraint: "oxygen_balance",
  objectives: {
    biomass: [
      { name: "BIOMASS_y", coef: 1 },
      { name: "PRODUCT_y", coef: 0.08 },
    ],
    product: [
      { name: "PRODUCT_y", coef: 1 },
      { name: "BIOMASS_y", coef: 0.05 },
    ],
    atp: [
      { name: "TPI", coef: 0.8 },
      { name: "ADH", coef: 0.3 },
      { name: "IDH", coef: 1.1 },
      { name: "BIOMASS_y", coef: 0.15 },
    ],
  },
  deriveMetrics: (vars, _request, status, objectiveValue) => {
    const glc = vars.HXT ?? 0;
    const biomass = vars.BIOMASS_y ?? 0;
    const product = vars.PRODUCT_y ?? 0;
    const atpYield =
      glc > 1e-9 ? ((vars.TPI ?? 0) + (vars.ADH ?? 0) * 0.4 + (vars.IDH ?? 0) - (vars.PFK_y ?? 0)) / glc : 0;
    const carbonEfficiency =
      glc > 1e-9
        ? ((biomass * BIOMASS_CARBON_CONTENT_YEAST + product * PRODUCT_CARBON_YEAST) / (glc * GLUCOSE_CARBON)) * 100
        : 0;
    const growthRate = biomass;
    const feasible = status === 2 && objectiveValue > 1e-6;
    return {
      fluxes: {
        HXT: round(vars.HXT ?? 0),
        HXK: round(vars.HXK ?? 0),
        PGI_y: round(vars.PGI_y ?? 0),
        PFK_y: round(vars.PFK_y ?? 0),
        TPI: round(vars.TPI ?? 0),
        PDC: round(vars.PDC ?? 0),
        ADH: round(vars.ADH ?? 0),
        ACS: round(vars.ACS ?? 0),
        IDH: round(vars.IDH ?? 0),
        O2tx_y: round(vars.O2tx_y ?? 0),
        BIOMASS_y: round(vars.BIOMASS_y ?? 0),
        PRODUCT_y: round(vars.PRODUCT_y ?? 0),
      },
      growthRate: round(growthRate),
      atpYield: round(atpYield, 2),
      nadhProduction: round((vars.TPI ?? 0) * 0.8 + (vars.ADH ?? 0) * 0.2, 2),
      carbonEfficiency: round(clamp(carbonEfficiency, 0, 100), 1),
      feasible,
    };
  },
};

const NETWORKS: Record<FBASpecies, NetworkSpec> = {
  ecoli: ECOLI_NETWORK,
  yeast: YEAST_NETWORK,
};

/**
 * Build an LPModel for the given network and request, then solve via HiGHS.
 * Returns primal variable values, status, objective value, and duals.
 */
async function buildAndSolve(
  network: NetworkSpec,
  request: SingleSpeciesFBARequest,
): Promise<{ vars: Record<string, number>; status: number; z: number; duals: Record<string, number> }> {
  const knockoutSet = new Set(request.knockouts ?? []);

  // Build LPModel for HiGHS
  const objective = network.objectives[request.objective];
  const constraints = network.constraints.map((c) => ({
    name: c.name,
    vars: c.vars,
    lb: 0,
    ub: 0,
  }));
  const bounds = network.reactions.map((r) => ({
    name: r.id,
    lb: r.lb,
    ub: knockoutSet.has(r.id) ? 0 : typeof r.ub === "function" ? r.ub(request) : r.ub,
  }));

  const model: LPModel = {
    name: `fba_${network.species}`,
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };

  const result = await solveLP(model);

  const vars: Record<string, number> = {};
  for (const rxn of network.reactions) {
    vars[rxn.id] = result.primals[rxn.id] ?? 0;
  }

  // status 2 = optimal (mirrors GLPK GLP_OPT), 4 = infeasible
  if (result.status === "error") {
    console.warn("[FBA] Solver error — returning zeroed fluxes. This usually indicates a HiGHS WASM issue.");
  }
  const status = result.status === "optimal" ? 2 : 4;
  return { vars, status, z: result.objectiveValue, duals: result.duals };
}

async function solveNetwork(request: SingleSpeciesFBARequest): Promise<FBAOutput> {
  const network = NETWORKS[request.species];

  const { vars, status, z, duals } = await buildAndSolve(network, request);
  const base = network.deriveMetrics(vars, request, status, z);

  // Extract shadow prices directly from LP dual variables
  const glucoseShadow = duals[network.glucoseConstraint] ?? 0;
  const oxygenShadow = duals[network.oxygenConstraint] ?? 0;

  return {
    ...base,
    sensitivityCoefficients: {
      glc: round(glucoseShadow, 4),
      o2: round(oxygenShadow, 4),
      atp: round(request.glucoseUptake > 1e-9 ? base.atpYield / request.glucoseUptake : 0, 4),
    },
  };
}

export async function solveAuthorityFBA(request: SingleSpeciesFBARequest): Promise<FBAOutput> {
  const clamped: SingleSpeciesFBARequest = {
    species: request.species,
    objective: request.objective,
    glucoseUptake: clamp(request.glucoseUptake, 0, 25),
    oxygenUptake: clamp(request.oxygenUptake, 0, 25),
    knockouts: Array.from(new Set(request.knockouts ?? [])),
  };
  // E. coli solves the REAL published e_coli_core stoichiometric model (the same
  // model `solveExpandedFBA` uses; COBRApy-verified to ~0.87 h⁻¹). Only yeast still
  // uses the 10-reaction legacy toy network below, which has no genome-scale
  // counterpart bundled offline (see YEAST_NETWORK's own SIMPLIFIED disclaimer).
  if (clamped.species === "ecoli") {
    return solveEcoliCoreFBA(clamped);
  }
  return solveNetwork(clamped);
}

/**
 * Build the LPModel for a single-species FBA without solving it.
 * Useful for FVA and pFBA which need the raw model.
 */
export function buildAuthorityFBAModel(request: SingleSpeciesFBARequest): LPModel {
  const clamped: SingleSpeciesFBARequest = {
    species: request.species,
    objective: request.objective,
    glucoseUptake: clamp(request.glucoseUptake, 0, 25),
    oxygenUptake: clamp(request.oxygenUptake, 0, 25),
    knockouts: Array.from(new Set(request.knockouts ?? [])),
  };

  // FVA / pFBA operate on the SAME model as the FBA solve. For E. coli that is the
  // real e_coli_core model; only yeast uses the legacy toy network.
  if (clamped.species === "ecoli") {
    return buildExpandedModel(clamped);
  }

  const network = NETWORKS[clamped.species];
  const knockoutSet = new Set(clamped.knockouts);
  const objective = network.objectives[clamped.objective];
  const constraints = network.constraints.map((c) => ({
    name: c.name,
    vars: c.vars,
    lb: 0,
    ub: 0,
  }));
  const bounds = network.reactions.map((r) => ({
    name: r.id,
    lb: r.lb,
    ub: knockoutSet.has(r.id) ? 0 : typeof r.ub === "function" ? r.ub(clamped) : r.ub,
  }));

  return {
    name: `fba_${network.species}`,
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };
}

/**
 * Community FBA via the SteadyCom joint-LP engine.
 *
 * Builds the curated 2-species community model (E. coli + S. cerevisiae, closed
 * shared acetate/ethanol pool) and solves ONE joint LP with biomass-abundance
 * coupling and bisection on the community growth rate mu (Chan et al. 2017).
 * Community growth, per-species growth, and cross-feeding exchange fluxes are all
 * REAL decision variables read directly from the LP solution — there are no
 * fabricated scalars, feeding bonuses, or invented flux-direction tables.
 *
 * The per-species `atpYield`, `nadhProduction`, `carbonEfficiency`, and shadow
 * prices reported alongside each strain come from the real single-species LP
 * (`solveAuthorityFBA`); the strain `growthRate`, community `communityGrowthRate`,
 * and `exchangeFluxes` come exclusively from the joint SteadyCom solve.
 *
 * When `alpha` is supplied (0 < alpha < 1) the community composition is pinned
 * via `fixedAbundance` (X_yeast = alpha, X_ecoli = 1 - alpha), threaded into the
 * joint LP as equality constraints on the abundance variables.
 *
 * @scientific_provenance
 *   METHOD: Chan SHJ, Simons MN, Maranas CD (2017). "SteadyCom: Predicting
 *     microbial abundances while ensuring community stability." PLOS
 *     Computational Biology 13(5): e1005539. DOI 10.1371/journal.pcbi.1005539.
 */
export async function solveAuthorityCommunityFBA(request: CommunityFBARequest): Promise<CommunityFBAOutput> {
  // Real single-species LP metrics (ATP yield, carbon efficiency, shadow prices).
  const ecoliMetrics = await solveAuthorityFBA({
    species: "ecoli",
    objective: request.objective,
    glucoseUptake: request.ecoli.glucoseUptake,
    oxygenUptake: request.ecoli.oxygenUptake,
    knockouts: request.ecoli.knockouts ?? [],
  });
  const yeastMetrics = await solveAuthorityFBA({
    species: "yeast",
    objective: request.objective,
    glucoseUptake: request.yeast.glucoseUptake,
    oxygenUptake: request.yeast.oxygenUptake,
    knockouts: request.yeast.knockouts ?? [],
  });

  // Real SteadyCom joint community LP (shared-pool coupling + biomass-abundance).
  const model = buildCommunityModel({
    ecoli: {
      glucoseUptake: request.ecoli.glucoseUptake,
      oxygenUptake: request.ecoli.oxygenUptake,
      knockouts: request.ecoli.knockouts,
    },
    yeast: {
      glucoseUptake: request.yeast.glucoseUptake,
      oxygenUptake: request.yeast.oxygenUptake,
      knockouts: request.yeast.knockouts,
    },
    alpha: request.alpha,
  });
  const result = await steadyCom(model.species, model.sharedMetabolites, undefined, undefined, model.fixedAbundance);

  // Cross-feeding exchange fluxes: for each shared metabolite, the producer is the
  // species whose reaction has a positive coefficient (secretion), the consumer the
  // one with a negative coefficient (uptake). Direction and magnitude are derived
  // from the model + the LP solution — never hardcoded.
  const exchangeFluxes = model.sharedMetabolites.map((metabolite) => {
    let fromStrain = "";
    let toStrain = "";
    let secretionReaction = "";
    for (const sp of model.species) {
      for (const r of sp.reactions) {
        const coef = r.stoichiometry[metabolite];
        if (coef === undefined || coef === 0) continue;
        if (coef > 0) {
          fromStrain = sp.id;
          secretionReaction = r.id;
        } else {
          toStrain = sp.id;
        }
      }
    }
    const flux = result.speciesFluxes[fromStrain]?.[secretionReaction] ?? 0;
    return {
      id: `EX_${metabolite}`,
      metabolite,
      fromStrain,
      toStrain,
      flux: round(flux, 4),
    };
  });

  const communityGrowthRate = round(result.communityGrowthRate, 4);
  const feasible = result.status === "optimal" && communityGrowthRate > 0;

  return {
    ecoli: { ...ecoliMetrics, growthRate: round(result.speciesGrowthRates.ecoli ?? 0, 4), feasible },
    yeast: { ...yeastMetrics, growthRate: round(result.speciesGrowthRates.yeast ?? 0, 4), feasible },
    exchangeFluxes,
    communityGrowthRate,
    communityBiomassObjective: communityGrowthRate,
    feasible,
  };
}

// ── Real e_coli_core FBA (single-species E. coli path + solveExpandedFBA) ──
// Uses the real published stoichiometric matrix (src/data/iJO1366Subset.ts,
// e_coli_core; COBRApy-verified to ~0.87 h⁻¹) rather than the hand-written
// 10-reaction legacy networks above. `buildExpandedModel` is the single source of
// truth for the LP, so the FBA solve, FVA, and pFBA all operate on the same model.

export interface ExpandedFBARequest {
  objective: "biomass" | "product";
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts?: string[];
}

export interface ExpandedFBAOutput {
  fluxes: Record<string, number>;
  growthRate: number;
  objectiveValue: number;
  feasible: boolean;
  stats: typeof IJO1366_STATS;
  subsystemFluxSums: Record<string, number>;
}

/**
 * Build the real e_coli_core LPModel (S·v = 0 mass balance) for a single-species
 * E. coli request. Exchange lower bounds carry the uptake capacities; a knockout
 * pins its reaction upper bound to 0. Objective: 'product' → PRODUCT, 'atp' →
 * ATPM (maximize the ATP-maintenance turnover the network can sustain), else
 * BIOMASS. This is the only place the single-species E. coli LP is assembled.
 */
function buildExpandedModel(request: {
  objective: FBAObjective;
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts?: string[];
}): LPModel {
  const knockoutSet = new Set(request.knockouts ?? []);
  const rxns = IJO1366_REACTIONS;
  const mets = IJO1366_METABOLITES;

  const objRxn = request.objective === "product" ? "PRODUCT" : request.objective === "atp" ? "ATPM" : "BIOMASS";
  const objective = [{ name: objRxn, coef: 1 }];

  // Stoichiometric constraints: S · v = 0 (mass balance)
  const constraints = mets.map((metId) => ({
    name: `${metId}_balance`,
    vars: rxns
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
    lb: 0,
    ub: 0,
  }));

  // Variable bounds; exchange reaction lower bounds carry the uptake capacity.
  const bounds = rxns.map((r) => {
    let lb = r.lb;
    if (r.id === "EX_glc_e") lb = -clamp(request.glucoseUptake, 0, 25);
    if (r.id === "EX_o2_e") lb = -clamp(request.oxygenUptake, 0, 25);
    return {
      name: r.id,
      lb,
      ub: knockoutSet.has(r.id) ? 0 : r.ub,
    };
  });

  return {
    name: "fba_ecoli_core",
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };
}

/**
 * Single-species E. coli FBA on the real e_coli_core model, adapted to the
 * `FBAOutput` contract the FBASim UI consumes. Every reported number is derived
 * from the LP flux solution and the true stoichiometric matrix — no fabricated
 * scalars:
 *   - growthRate       = BIOMASS reaction flux (h⁻¹)
 *   - atpYield         = gross ATP production Σ_r max(0, S[atp_c][r]·v_r) / glucose uptake
 *   - nadhProduction   = gross NADH production Σ_r max(0, S[nadh_c][r]·v_r)
 *   - carbonEfficiency = fraction of substrate carbon retained (not lost as CO₂)
 *   - sensitivityCoefficients = LP shadow prices (duals) on the glucose / O₂ balances
 */
async function solveEcoliCoreFBA(request: SingleSpeciesFBARequest): Promise<FBAOutput> {
  const model = buildExpandedModel({
    objective: request.objective,
    glucoseUptake: request.glucoseUptake,
    oxygenUptake: request.oxygenUptake,
    knockouts: request.knockouts,
  });
  const result = await solveLP(model);
  const primals = result.primals;

  const biomass = primals.BIOMASS ?? 0;
  // EX_glc_e stoichiometry is {glc__D_e: -1}: a negative flux is uptake.
  const glcUptake = Math.max(0, -(primals.EX_glc_e ?? 0));

  // Real ATP / NADH turnover from the flux solution + true stoichiometry.
  let atpProduction = 0;
  let nadhProduction = 0;
  for (const r of IJO1366_REACTIONS) {
    const v = primals[r.id] ?? 0;
    if (v === 0) continue;
    const sAtp = r.stoichiometry.atp_c;
    if (sAtp !== undefined && sAtp * v > 0) atpProduction += sAtp * v;
    const sNadh = r.stoichiometry.nadh_c;
    if (sNadh !== undefined && sNadh * v > 0) nadhProduction += sNadh * v;
  }
  const atpYield = glcUptake > 1e-9 ? atpProduction / glcUptake : 0;

  // Real carbon efficiency: fraction of substrate carbon NOT lost as CO₂.
  // glucose = 6 C in; CO₂ secretion = positive EX_co2_e flux (1 C each).
  const co2Secreted = Math.max(0, primals.EX_co2_e ?? 0);
  const carbonIn = glcUptake * GLUCOSE_CARBON;
  const carbonEfficiency = carbonIn > 1e-9 ? clamp(((carbonIn - co2Secreted) / carbonIn) * 100, 0, 100) : 0;

  // Shadow prices: LP duals on the extracellular substrate mass-balance rows.
  const glucoseShadow = result.duals.glc__D_e_balance ?? 0;
  const oxygenShadow = result.duals.o2_e_balance ?? 0;

  // Expose every e_coli_core reaction flux (BiGG ids). The UI flux-map keys
  // (GLCpts, PGI, PFK, FBA, GAPD, PYK, PDH, CS, MDH, ATPM, PGK, ENO) all exist in
  // this model, so the visualization is populated with real fluxes.
  const fluxes: Record<string, number> = {};
  for (const r of IJO1366_REACTIONS) fluxes[r.id] = round(primals[r.id] ?? 0);

  const feasible = result.status === "optimal" && result.objectiveValue > 1e-6;

  return {
    fluxes,
    growthRate: round(biomass),
    atpYield: round(atpYield, 2),
    nadhProduction: round(nadhProduction, 2),
    carbonEfficiency: round(carbonEfficiency, 1),
    feasible,
    sensitivityCoefficients: {
      glc: round(glucoseShadow, 4),
      o2: round(oxygenShadow, 4),
      atp: round(glcUptake > 1e-9 ? atpYield / glcUptake : 0, 4),
    },
  };
}

export async function solveExpandedFBA(request: ExpandedFBARequest): Promise<ExpandedFBAOutput> {
  const rxns = IJO1366_REACTIONS;
  const n = rxns.length;
  const rxnIds = rxns.map((r) => r.id);

  const model = buildExpandedModel(request);

  const result = await solveLP(model);

  const fluxes: Record<string, number> = {};
  for (let j = 0; j < n; j++) fluxes[rxnIds[j]] = round(result.primals[rxnIds[j]] ?? 0);

  // Subsystem flux sums
  const subsystemFluxSums: Record<string, number> = {};
  for (let j = 0; j < n; j++) {
    const sub = rxns[j].subsystem;
    subsystemFluxSums[sub] = (subsystemFluxSums[sub] ?? 0) + Math.abs(result.primals[rxnIds[j]] ?? 0);
  }
  for (const key of Object.keys(subsystemFluxSums)) {
    subsystemFluxSums[key] = round(subsystemFluxSums[key], 2);
  }

  return {
    fluxes,
    growthRate: round(fluxes.BIOMASS),
    objectiveValue: round(result.objectiveValue),
    feasible: result.status === "optimal" && result.objectiveValue > 1e-6,
    stats: IJO1366_STATS,
    subsystemFluxSums,
  };
}

// ── Dynamic FBA: solve from user-supplied reaction data (BiGG models) ──

export type DynamicReaction = BiGGReaction;

export interface DynamicFBAOptions {
  glucoseUptake?: number;
  oxygenUptake?: number;
  knockouts?: string[];
}

/**
 * Auto-detect the biomass reaction ID from a list of reactions.
 * BiGG models use various naming conventions:
 *   - "BIOMASS_Ec_iJO1366_core_53p95M" (iJO1366)
 *   - "BIOMASS_Ecoli_core" (e_coli_core)
 *   - Any reaction with "biomass" in the ID (case-insensitive)
 */
function detectBiomassReaction(reactions: DynamicReaction[]): string | null {
  // Priority 1: reaction ID starts with BIOMASS
  const byPrefix = reactions.find((r) => r.id.toUpperCase().startsWith("BIOMASS"));
  if (byPrefix) return byPrefix.id;
  // Priority 2: reaction name contains "biomass"
  const byName = reactions.find((r) => r.name.toLowerCase().includes("biomass"));
  if (byName) return byName.id;
  return null;
}

// External metabolite ids whose exchange uptake bound the FBASim UI controls.
// Identifying the substrate by its metabolite id — NOT by an "EX_"-name
// substring — prevents mis-clamping EX_co2_e (name contains "o2") or
// EX_glu__L_e (name contains "glu"); both are present in the bundled
// e_coli_core model, so the old `.includes("o2")` / `.includes("glu")` test
// forced their bounds open incorrectly.
// Exported so the strain-design modules (fbaFSEOF / fbaOptKnock / fbaRobustKnock)
// reuse the SAME correct identification instead of re-deriving the buggy
// name-substring test.
export const GLUCOSE_EXCHANGE_METS = new Set(["glc__D_e", "glc_e", "glc_D_e"]);
export const OXYGEN_EXCHANGE_METS = new Set(["o2_e"]);

/**
 * The single external metabolite id of a standard exchange reaction (id prefixed
 * "EX_", exactly one metabolite), or null if the reaction is not such an exchange.
 * Typed on the minimal `{ id, stoichiometry }` shape so every FBA module's
 * reaction type can pass its reactions in.
 */
export function exchangeMetaboliteId(r: { id: string; stoichiometry: Record<string, number> }): string | null {
  if (!r.id.startsWith("EX_")) return null;
  const metIds = Object.keys(r.stoichiometry);
  return metIds.length === 1 ? metIds[0] : null;
}

/** Find the exchange reaction whose external metabolite id is in `mets`. */
export function findExchangeByMetabolite<R extends { id: string; stoichiometry: Record<string, number> }>(
  reactions: R[],
  mets: Set<string>,
): R | undefined {
  return reactions.find((r) => {
    const m = exchangeMetaboliteId(r);
    return m !== null && mets.has(m);
  });
}

function findMetaboliteConstraint(metId: string): string {
  return `${metId}_balance`;
}

/**
 * Build an optimized metabolite → reaction index map for large models.
 * This avoids O(metCount * rxnCount) filtering when building constraints.
 */
function buildMetaboliteReactionIndex(
  reactions: DynamicReaction[],
): Map<string, Array<{ rxnId: string; coef: number }>> {
  const index = new Map<string, Array<{ rxnId: string; coef: number }>>();
  for (const rxn of reactions) {
    for (const [metId, coef] of Object.entries(rxn.stoichiometry)) {
      let entry = index.get(metId);
      if (!entry) {
        entry = [];
        index.set(metId, entry);
      }
      entry.push({ rxnId: rxn.id, coef });
    }
  }
  return index;
}

/**
 * Build the LPModel for a dynamic/BiGG FBA solve (S·v = 0 mass balance).
 *
 * The user-controlled glucose / oxygen uptake bounds are applied ONLY to the
 * true glucose and oxygen uptake exchanges, matched by their external metabolite
 * id (`GLUCOSE_EXCHANGE_METS` / `OXYGEN_EXCHANGE_METS`). Every other exchange —
 * including `EX_co2_e` and `EX_glu__L_e`, whose ids contain the substrings "o2"
 * and "glu" — keeps its native model bounds. Extracted (and exported) so the
 * bound assignment is unit-testable without a solver round-trip.
 */
export function buildDynamicFBAModel(
  reactions: DynamicReaction[],
  objectiveId: string,
  options: DynamicFBAOptions = {},
): LPModel {
  const knockoutSet = new Set(options.knockouts ?? []);
  const glucoseUptake = options.glucoseUptake ?? 10;
  const oxygenUptake = options.oxygenUptake ?? 12;

  // Build optimized metabolite → reaction index (O(total_stoich_entries) instead of O(mets * rxns))
  const metRxnIndex = buildMetaboliteReactionIndex(reactions);

  const objective = [{ name: objectiveId, coef: 1 }];

  const constraints = Array.from(metRxnIndex.entries()).map(([metId, rxns]) => ({
    name: `${metId}_balance`,
    vars: rxns.map((r) => ({ name: r.rxnId, coef: r.coef })),
    lb: 0,
    ub: 0,
  }));

  const bounds = reactions.map((r) => {
    let lb = r.lb;
    const exMet = exchangeMetaboliteId(r);
    if (exMet !== null) {
      if (GLUCOSE_EXCHANGE_METS.has(exMet)) lb = -Math.abs(glucoseUptake);
      else if (OXYGEN_EXCHANGE_METS.has(exMet)) lb = -Math.abs(oxygenUptake);
    }
    return {
      name: r.id,
      lb,
      ub: knockoutSet.has(r.id) ? 0 : r.ub,
    };
  });

  return {
    name: "fba_dynamic",
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };
}

export async function solveDynamicFBA(
  reactions: DynamicReaction[],
  objectiveId: string,
  options: DynamicFBAOptions = {},
): Promise<FBAOutput> {
  const glucoseUptake = options.glucoseUptake ?? 10;
  const oxygenUptake = options.oxygenUptake ?? 12;

  // Auto-detect biomass if objectiveId not found in reactions
  let effectiveObjectiveId = objectiveId;
  if (!reactions.find((r) => r.id === objectiveId)) {
    const detected = detectBiomassReaction(reactions);
    if (detected) effectiveObjectiveId = detected;
  }

  const model = buildDynamicFBAModel(reactions, effectiveObjectiveId, {
    glucoseUptake,
    oxygenUptake,
    knockouts: options.knockouts,
  });

  const result = await solveLP(model);

  const fluxes: Record<string, number> = {};
  for (const r of reactions) {
    fluxes[r.id] = round(result.primals[r.id] ?? 0);
  }

  const glcRxn = findExchangeByMetabolite(reactions, GLUCOSE_EXCHANGE_METS);
  const o2Rxn = findExchangeByMetabolite(reactions, OXYGEN_EXCHANGE_METS);
  const glcConstraint = glcRxn ? findMetaboliteConstraint(Object.keys(glcRxn.stoichiometry)[0]) : "";
  const o2Constraint = o2Rxn ? findMetaboliteConstraint(Object.keys(o2Rxn.stoichiometry)[0]) : "";

  const glucoseShadow = glcConstraint ? (result.duals[glcConstraint] ?? 0) : 0;
  const oxygenShadow = o2Constraint ? (result.duals[o2Constraint] ?? 0) : 0;

  const glcFlux = glcRxn ? Math.abs(fluxes[glcRxn.id] ?? 0) : glucoseUptake;
  const biomassFlux = fluxes[effectiveObjectiveId] ?? 0;

  // For dynamic models, ATP/NADH cannot be reliably computed without
  // explicit metabolite-level identification (stoichiometric coefficients
  // for ATP and NADH metabolites). Return 0 rather than heuristic guesses.
  const atpYield = 0;
  const carbonEfficiency = glcFlux > 1e-9 ? (biomassFlux / glcFlux) * 60 : 0;
  const growthRate = biomassFlux;
  const feasible = result.status === "optimal" && result.objectiveValue > 1e-6;

  return {
    fluxes,
    growthRate: round(growthRate),
    atpYield: round(atpYield, 2),
    nadhProduction: 0,
    carbonEfficiency: round(clamp(carbonEfficiency, 0, 100), 1),
    feasible,
    sensitivityCoefficients: {
      glc: round(glucoseShadow, 4),
      o2: round(oxygenShadow, 4),
      atp: round(glcFlux > 1e-9 ? atpYield / glcFlux : 0, 4),
    },
  };
}
