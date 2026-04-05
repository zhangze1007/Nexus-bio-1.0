import GLPKFactory, { type GLPK, type LP } from 'glpk.js/node';
import { SHARED_METABOLITES, type CommunityFBAOutput, type FBAOutput } from '../data/mockFBA';

export type FBAObjective = 'biomass' | 'atp' | 'product';
export type FBASpecies = 'ecoli' | 'yeast';

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
  ecoli: Omit<SingleSpeciesFBARequest, 'species' | 'objective'>;
  yeast: Omit<SingleSpeciesFBARequest, 'species' | 'objective'>;
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
  deriveMetrics: (
    vars: Record<string, number>,
    request: SingleSpeciesFBARequest,
    status: number,
    objectiveValue: number,
  ) => Omit<FBAOutput, 'shadowPrices'>;
};

let glpkPromise: Promise<GLPK> | null = null;

function getGlpk() {
  glpkPromise ??= GLPKFactory();
  return glpkPromise;
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const ECOLI_NETWORK: NetworkSpec = {
  species: 'ecoli',
  reactions: [
    { id: 'GLCpts', lb: 0, ub: ({ glucoseUptake }) => clamp(glucoseUptake, 0, 25) },
    { id: 'PGI', lb: 0, ub: 100 },
    { id: 'PFK', lb: 0, ub: 100 },
    { id: 'FBA', lb: 0, ub: 100 },
    { id: 'GAPD', lb: 0, ub: 200 },
    { id: 'PYK', lb: 0, ub: 100 },
    { id: 'PDH', lb: 0, ub: 100 },
    { id: 'O2tx', lb: 0, ub: ({ oxygenUptake }) => clamp(oxygenUptake, 0, 25) },
    { id: 'BIOMASS', lb: 0, ub: 100 },
    { id: 'PRODUCT', lb: 0, ub: 100 },
  ],
  constraints: [
    { name: 'g6p_balance', vars: [{ name: 'GLCpts', coef: 1 }, { name: 'PGI', coef: -1 }] },
    { name: 'f6p_balance', vars: [{ name: 'PGI', coef: 1 }, { name: 'PFK', coef: -1 }] },
    { name: 'fbp_balance', vars: [{ name: 'PFK', coef: 1 }, { name: 'FBA', coef: -1 }] },
    { name: 'gap_balance', vars: [{ name: 'FBA', coef: 2 }, { name: 'GAPD', coef: -1 }] },
    { name: 'pep_balance', vars: [{ name: 'GAPD', coef: 1 }, { name: 'PYK', coef: -1 }] },
    { name: 'pyr_balance', vars: [{ name: 'PYK', coef: 1 }, { name: 'PDH', coef: -1 }] },
    { name: 'accoa_balance', vars: [{ name: 'PDH', coef: 1 }, { name: 'BIOMASS', coef: -1 }, { name: 'PRODUCT', coef: -1 }] },
    { name: 'oxygen_balance', vars: [{ name: 'O2tx', coef: 1 }, { name: 'PDH', coef: -1 }] },
  ],
  objectives: {
    biomass: [{ name: 'BIOMASS', coef: 1 }, { name: 'PRODUCT', coef: 0.08 }],
    product: [{ name: 'PRODUCT', coef: 1 }, { name: 'BIOMASS', coef: 0.05 }],
    atp: [
      { name: 'GAPD', coef: 1 },
      { name: 'PYK', coef: 1 },
      { name: 'PDH', coef: 1.2 },
      { name: 'BIOMASS', coef: 0.15 },
    ],
  },
  deriveMetrics: (vars, request, status, objectiveValue) => {
    const glc = vars.GLCpts ?? 0;
    const biomass = vars.BIOMASS ?? 0;
    const product = vars.PRODUCT ?? 0;
    const atpYield = glc > 1e-9 ? ((vars.GAPD ?? 0) + (vars.PYK ?? 0) - (vars.PFK ?? 0) + (vars.PDH ?? 0) * 0.5) / glc : 0;
    const carbonEfficiency = glc > 1e-9 ? (((biomass * 4.6) + (product * 6)) / (glc * 6)) * 100 : 0;
    const growthRate = biomass * 0.061;
    const feasible = [2, 5].includes(status) && objectiveValue > 1e-6;
    return {
      fluxes: {
        GLCpts: round(vars.GLCpts ?? 0),
        PGI: round(vars.PGI ?? 0),
        PFK: round(vars.PFK ?? 0),
        FBA: round(vars.FBA ?? 0),
        GAPD: round(vars.GAPD ?? 0),
        PGK: round(vars.GAPD ?? 0),
        ENO: round(vars.GAPD ?? 0),
        PYK: round(vars.PYK ?? 0),
        PDH: round(vars.PDH ?? 0),
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
  species: 'yeast',
  reactions: [
    { id: 'HXT', lb: 0, ub: ({ glucoseUptake }) => clamp(glucoseUptake, 0, 20) },
    { id: 'HXK', lb: 0, ub: 100 },
    { id: 'PGI_y', lb: 0, ub: 100 },
    { id: 'PFK_y', lb: 0, ub: 100 },
    { id: 'TPI', lb: 0, ub: 200 },
    { id: 'PDC', lb: 0, ub: 100 },
    { id: 'ADH', lb: 0, ub: 100 },
    { id: 'ACS', lb: 0, ub: 100 },
    { id: 'IDH', lb: 0, ub: 100 },
    { id: 'O2tx_y', lb: 0, ub: ({ oxygenUptake }) => clamp(oxygenUptake, 0, 20) },
    { id: 'BIOMASS_y', lb: 0, ub: 100 },
    { id: 'PRODUCT_y', lb: 0, ub: 100 },
  ],
  constraints: [
    { name: 'glc_balance', vars: [{ name: 'HXT', coef: 1 }, { name: 'HXK', coef: -1 }] },
    { name: 'g6p_balance', vars: [{ name: 'HXK', coef: 1 }, { name: 'PGI_y', coef: -1 }] },
    { name: 'f6p_balance', vars: [{ name: 'PGI_y', coef: 1 }, { name: 'PFK_y', coef: -1 }] },
    { name: 'fbp_balance', vars: [{ name: 'PFK_y', coef: 2 }, { name: 'TPI', coef: -1 }] },
    { name: 'fermentation_branch', vars: [{ name: 'TPI', coef: 1 }, { name: 'PDC', coef: -1 }] },
    { name: 'ethanol_branch', vars: [{ name: 'PDC', coef: 1 }, { name: 'ADH', coef: -1 }, { name: 'ACS', coef: -1 }] },
    { name: 'oxygen_balance', vars: [{ name: 'O2tx_y', coef: 1 }, { name: 'ACS', coef: -1 }] },
    { name: 'accoa_balance', vars: [{ name: 'ACS', coef: 1 }, { name: 'IDH', coef: -1 }] },
    { name: 'growth_balance', vars: [{ name: 'IDH', coef: 1 }, { name: 'BIOMASS_y', coef: -1 }, { name: 'PRODUCT_y', coef: -1 }] },
  ],
  objectives: {
    biomass: [{ name: 'BIOMASS_y', coef: 1 }, { name: 'PRODUCT_y', coef: 0.08 }],
    product: [{ name: 'PRODUCT_y', coef: 1 }, { name: 'BIOMASS_y', coef: 0.05 }],
    atp: [
      { name: 'TPI', coef: 0.8 },
      { name: 'ADH', coef: 0.3 },
      { name: 'IDH', coef: 1.1 },
      { name: 'BIOMASS_y', coef: 0.15 },
    ],
  },
  deriveMetrics: (vars, request, status, objectiveValue) => {
    const glc = vars.HXT ?? 0;
    const biomass = vars.BIOMASS_y ?? 0;
    const product = vars.PRODUCT_y ?? 0;
    const atpYield = glc > 1e-9 ? ((vars.TPI ?? 0) + (vars.ADH ?? 0) * 0.4 + (vars.IDH ?? 0) - (vars.PFK_y ?? 0)) / glc : 0;
    const carbonEfficiency = glc > 1e-9 ? (((biomass * 4.2) + (product * 5.6)) / (glc * 6)) * 100 : 0;
    const growthRate = biomass * 0.045;
    const feasible = [2, 5].includes(status) && objectiveValue > 1e-6;
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

function buildProblem(glpk: GLPK, network: NetworkSpec, request: SingleSpeciesFBARequest): LP {
  const knockoutSet = new Set(request.knockouts ?? []);
  return {
    name: `${network.species}-${request.objective}`,
    objective: {
      direction: glpk.GLP_MAX,
      name: request.objective,
      vars: network.objectives[request.objective],
    },
    subjectTo: network.constraints.map((constraint) => ({
      name: constraint.name,
      vars: constraint.vars,
      bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 },
    })),
    bounds: network.reactions.map((reaction) => {
      const rawUb = typeof reaction.ub === 'function' ? reaction.ub(request) : reaction.ub;
      if (knockoutSet.has(reaction.id)) {
        return { name: reaction.id, type: glpk.GLP_FX, lb: 0, ub: 0 };
      }
      return {
        name: reaction.id,
        type: glpk.GLP_DB,
        lb: reaction.lb,
        ub: rawUb,
      };
    }),
  };
}

async function solveNetwork(request: SingleSpeciesFBARequest): Promise<FBAOutput> {
  const glpk = await getGlpk();
  const network = NETWORKS[request.species];
  const problem = buildProblem(glpk, network, request);
  const solved = glpk.solve(problem, { msglev: glpk.GLP_MSG_OFF, presol: true });
  const vars = solved.result.vars ?? {};
  const status = solved.result.status;
  const base = network.deriveMetrics(vars, request, status, solved.result.z ?? 0);
  const epsilon = Math.max(0.05, request.glucoseUptake * 0.01);

  const solveGrowth = async (next: SingleSpeciesFBARequest) => {
    const nextProblem = buildProblem(glpk, network, next);
    const nextSolved = glpk.solve(nextProblem, { msglev: glpk.GLP_MSG_OFF, presol: true });
    return network.deriveMetrics(nextSolved.result.vars ?? {}, next, nextSolved.result.status, nextSolved.result.z ?? 0).growthRate;
  };

  const glucoseShadow = (
    await solveGrowth({ ...request, glucoseUptake: request.glucoseUptake + epsilon })
    - await solveGrowth({ ...request, glucoseUptake: Math.max(0, request.glucoseUptake - epsilon) })
  ) / (2 * epsilon);

  const oxygenShadow = (
    await solveGrowth({ ...request, oxygenUptake: request.oxygenUptake + epsilon })
    - await solveGrowth({ ...request, oxygenUptake: Math.max(0, request.oxygenUptake - epsilon) })
  ) / (2 * epsilon);

  return {
    ...base,
    shadowPrices: {
      glc: round(glucoseShadow, 4),
      o2: round(oxygenShadow, 4),
      atp: round(Math.max(0, base.atpYield / 12), 4),
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

export async function solveAuthorityCommunityFBA(request: CommunityFBARequest): Promise<CommunityFBAOutput> {
  const alpha = clamp(request.alpha ?? 0.5, 0, 1);
  const ecoli = await solveAuthorityFBA({
    species: 'ecoli',
    objective: request.objective,
    glucoseUptake: request.ecoli.glucoseUptake,
    oxygenUptake: request.ecoli.oxygenUptake,
    knockouts: request.ecoli.knockouts ?? [],
  });
  const yeast = await solveAuthorityFBA({
    species: 'yeast',
    objective: request.objective,
    glucoseUptake: request.yeast.glucoseUptake,
    oxygenUptake: request.yeast.oxygenUptake,
    knockouts: request.yeast.knockouts ?? [],
  });

  const exchangeFluxes = SHARED_METABOLITES.map((metabolite) => {
    const exporter = metabolite.exporterStrain === 'ecoli' ? ecoli : yeast;
    const importer = metabolite.importerStrain === 'ecoli' ? ecoli : yeast;
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
    .filter((flux) => flux.toStrain === 'ecoli')
    .reduce((sum, flux) => sum + flux.flux * 0.018, 0);
  const yeastFeedingBonus = exchangeFluxes
    .filter((flux) => flux.toStrain === 'yeast')
    .reduce((sum, flux) => sum + flux.flux * 0.018, 0);

  const adjustedEcoliGrowth = round(ecoli.growthRate + ecoliFeedingBonus, 4);
  const adjustedYeastGrowth = round(yeast.growthRate + yeastFeedingBonus, 4);
  const communityObjective = round((1 - alpha) * adjustedEcoliGrowth + alpha * adjustedYeastGrowth, 4);

  return {
    ecoli: {
      ...ecoli,
      growthRate: adjustedEcoliGrowth,
    },
    yeast: {
      ...yeast,
      growthRate: adjustedYeastGrowth,
    },
    exchangeFluxes,
    communityGrowthRate: communityObjective,
    communityBiomassObjective: communityObjective,
    feasible: ecoli.feasible || yeast.feasible,
  };
}
