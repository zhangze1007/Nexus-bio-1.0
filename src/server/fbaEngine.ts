import { IJO1366_METABOLITES, IJO1366_REACTIONS, IJO1366_STATS } from "../data/iJO1366Subset";
import { type CommunityFBAOutput, type FBAOutput, SHARED_METABOLITES } from "../data/mockFBA";
import type { BiGGReaction } from "../services/database/biggClient";
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
      { name: "PDH", coef: 1.2 },
      { name: "BIOMASS", coef: 0.15 },
    ],
  },
  deriveMetrics: (vars, _request, status, objectiveValue) => {
    const glc = vars.GLCpts ?? 0;
    const biomass = vars.BIOMASS ?? 0;
    const product = vars.PRODUCT ?? 0;
    const atpYield =
      glc > 1e-9 ? ((vars.GAPD ?? 0) + (vars.PYK ?? 0) - (vars.PFK ?? 0) + (vars.PDH ?? 0) * 0.5) / glc : 0;
    const carbonEfficiency = glc > 1e-9 ? ((biomass * 4.6 + product * 6) / (glc * 6)) * 100 : 0;
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
        // toy network does not include independent PGK/ENO variables.
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
    const carbonEfficiency = glc > 1e-9 ? ((biomass * 4.2 + product * 5.6) / (glc * 6)) * 100 : 0;
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
  return solveNetwork({
    species: request.species,
    objective: request.objective,
    glucoseUptake: clamp(request.glucoseUptake, 0, 25),
    oxygenUptake: clamp(request.oxygenUptake, 0, 25),
    knockouts: Array.from(new Set(request.knockouts ?? [])),
  });
}

/**
 * Build the LPModel for a single-species FBA without solving it.
 * Useful for FVA and pFBA which need the raw model.
 */
export function buildAuthorityFBAModel(request: SingleSpeciesFBARequest): LPModel {
  const network = NETWORKS[request.species];
  const clamped: SingleSpeciesFBARequest = {
    species: request.species,
    objective: request.objective,
    glucoseUptake: clamp(request.glucoseUptake, 0, 25),
    oxygenUptake: clamp(request.oxygenUptake, 0, 25),
    knockouts: Array.from(new Set(request.knockouts ?? [])),
  };

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
 * @scientific_provenance
 *
 * REFERENCE:
 *   MOCK_DATA: no peer-reviewed source for this community wrapper.
 *   The single-species LP solver is real, but this function is only a
 *   two-species heuristic and is not SteadyCom, cFBA, or a joint community LP.
 *
 * NOT_IMPLEMENTED:
 *   - Joint community stoichiometric matrix
 *   - Species-specific biomass variables in one optimization problem
 *   - Shared exchange metabolite mass-balance constraints
 *   - Cross-feeding uptake/secretion coupling constraints
 *   - Community objective with feasibility proof
 *   - Community-level infeasibility diagnostics
 *
 * KNOWN_LIMITATIONS:
 *   - Exchange fluxes are post-hoc scaled comparisons, not LP decision variables.
 *   - Community growth is a linear blend of two independent host optima.
 *   - Knockouts and uptake bounds do not propagate through shared metabolite pools.
 *   - Outputs must not be interpreted as microbiome stoichiometric optima.
 */
export async function solveAuthorityCommunityFBA(request: CommunityFBARequest): Promise<CommunityFBAOutput> {
  const alpha = clamp(request.alpha ?? 0.5, 0, 1);
  const ecoli = await solveAuthorityFBA({
    species: "ecoli",
    objective: request.objective,
    glucoseUptake: request.ecoli.glucoseUptake,
    oxygenUptake: request.ecoli.oxygenUptake,
    knockouts: request.ecoli.knockouts ?? [],
  });
  const yeast = await solveAuthorityFBA({
    species: "yeast",
    objective: request.objective,
    glucoseUptake: request.yeast.glucoseUptake,
    oxygenUptake: request.yeast.oxygenUptake,
    knockouts: request.yeast.knockouts ?? [],
  });

  const exchangeFluxes = SHARED_METABOLITES.map((metabolite) => {
    const exporter = metabolite.exporterStrain === "ecoli" ? ecoli : yeast;
    const importer = metabolite.importerStrain === "ecoli" ? ecoli : yeast;
    const exporterScale = exporter.feasible ? Math.max(exporter.growthRate, exporter.carbonEfficiency / 100) : 0;
    const importerScale = importer.feasible ? Math.max(importer.growthRate, importer.atpYield / 4) : 0;
    const flux = metabolite.baseFlux * clamp(exporterScale * 1.6, 0, 2.4) * clamp(importerScale * 1.4, 0, 2);

    return {
      id: `EX_${metabolite.id}`,
      metabolite: metabolite.name,
      fromStrain: metabolite.exporterStrain,
      toStrain: metabolite.importerStrain,
      flux: round(flux, 3),
    };
  });

  const ecoliFeedingBonus = exchangeFluxes
    .filter((flux) => flux.toStrain === "ecoli")
    .reduce((sum, flux) => sum + flux.flux * 0.018, 0);
  const yeastFeedingBonus = exchangeFluxes
    .filter((flux) => flux.toStrain === "yeast")
    .reduce((sum, flux) => sum + flux.flux * 0.018, 0);

  const adjustedEcoliGrowth = round(ecoli.growthRate + ecoliFeedingBonus, 4);
  const adjustedYeastGrowth = round(yeast.growthRate + yeastFeedingBonus, 4);
  const communityObjective = round((1 - alpha) * adjustedEcoliGrowth + alpha * adjustedYeastGrowth, 4);

  return {
    ecoli: { ...ecoli, growthRate: adjustedEcoliGrowth },
    yeast: { ...yeast, growthRate: adjustedYeastGrowth },
    exchangeFluxes,
    communityGrowthRate: communityObjective,
    communityBiomassObjective: communityObjective,
    // Community is feasible only if BOTH species solve successfully
    feasible: ecoli.feasible && yeast.feasible,
  };
}

// ── P3.1: Expanded FBA using iJO1366 subset (~95 rxns, ~78 metabolites) ──
// This uses the real stoichiometric matrix from the genome-scale model rather
// than the hand-written 10-reaction toy networks above.

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

export async function solveExpandedFBA(request: ExpandedFBARequest): Promise<ExpandedFBAOutput> {
  const knockoutSet = new Set(request.knockouts ?? []);
  const rxns = IJO1366_REACTIONS;
  const mets = IJO1366_METABOLITES;
  const n = rxns.length;
  const rxnIds = rxns.map((r) => r.id);

  // Build LPModel for HiGHS
  const objRxn = request.objective === "product" ? "PRODUCT" : "BIOMASS";
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

  // Variable bounds
  const bounds = rxns.map((r) => {
    let lb = r.lb;
    // Set exchange reaction lower bounds as maximum uptake allowed
    if (r.id === "EX_glc_e") lb = -clamp(request.glucoseUptake, 0, 25);
    if (r.id === "EX_o2_e") lb = -clamp(request.oxygenUptake, 0, 25);
    return {
      name: r.id,
      lb,
      ub: knockoutSet.has(r.id) ? 0 : r.ub,
    };
  });

  const model: LPModel = {
    name: "fba_iJO1366",
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };

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

function findExchangeReaction(reactions: DynamicReaction[], metaboliteSuffix: string): DynamicReaction | undefined {
  return reactions.find((r) => r.id.startsWith("EX_") && r.id.includes(metaboliteSuffix));
}

function findMetaboliteConstraint(metId: string): string {
  return `${metId}_balance`;
}

export async function solveDynamicFBA(
  reactions: DynamicReaction[],
  objectiveId: string,
  options: DynamicFBAOptions = {},
): Promise<FBAOutput> {
  const knockoutSet = new Set(options.knockouts ?? []);
  const glucoseUptake = options.glucoseUptake ?? 10;
  const oxygenUptake = options.oxygenUptake ?? 12;

  const allMetIds = new Set<string>();
  for (const r of reactions) {
    for (const metId of Object.keys(r.stoichiometry)) {
      allMetIds.add(metId);
    }
  }

  const objective = [{ name: objectiveId, coef: 1 }];

  const constraints = Array.from(allMetIds).map((metId) => ({
    name: `${metId}_balance`,
    vars: reactions
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
    lb: 0,
    ub: 0,
  }));

  const bounds = reactions.map((r) => {
    let lb = r.lb;
    if (r.id.startsWith("EX_")) {
      const isGlucose = r.id.includes("glc") || r.id.includes("glu");
      const isOxygen = r.id.includes("o2") || r.id.includes("O2");
      if (isGlucose) lb = -Math.abs(glucoseUptake);
      if (isOxygen) lb = -Math.abs(oxygenUptake);
    }
    return {
      name: r.id,
      lb,
      ub: knockoutSet.has(r.id) ? 0 : r.ub,
    };
  });

  const model: LPModel = {
    name: "fba_dynamic",
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };

  const result = await solveLP(model);

  const fluxes: Record<string, number> = {};
  for (const r of reactions) {
    fluxes[r.id] = round(result.primals[r.id] ?? 0);
  }

  const glcRxn = findExchangeReaction(reactions, "glc");
  const o2Rxn = findExchangeReaction(reactions, "o2");
  const glcConstraint = glcRxn ? findMetaboliteConstraint(Object.keys(glcRxn.stoichiometry)[0]) : "";
  const o2Constraint = o2Rxn ? findMetaboliteConstraint(Object.keys(o2Rxn.stoichiometry)[0]) : "";

  const glucoseShadow = glcConstraint ? (result.duals[glcConstraint] ?? 0) : 0;
  const oxygenShadow = o2Constraint ? (result.duals[o2Constraint] ?? 0) : 0;

  const glcFlux = glcRxn ? Math.abs(fluxes[glcRxn.id] ?? 0) : glucoseUptake;
  const biomassFlux = fluxes[objectiveId] ?? 0;

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
