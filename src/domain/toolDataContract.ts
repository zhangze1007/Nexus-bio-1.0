/**
 * Tool Data Contract — Standard artifact types for inter-tool data flow.
 *
 * Defines the contract between tools: what each tool produces and what
 * downstream tools consume. This replaces the ad-hoc workbenchStore
 * payload system with typed, validated artifacts.
 *
 * @architecture
 *   Each tool produces exactly one artifact type.
 *   Downstream tools declare required and optional artifacts.
 *   The artifactStore persists artifacts across tool navigations.
 */

// ── Artifact Types ──────────────────────────────────────────────────────

/** PathD output — pathway design results */
export interface PathwayArtifact {
  type: "pathway";
  targetProduct: string;
  reactions: Array<{
    id: string;
    name: string;
    subsystem: string;
    deltaG?: number;
  }>;
  metabolites: Array<{
    id: string;
    name: string;
    formula?: string;
  }>;
  enzymes: Array<{
    geneId: string;
    organism: string;
    ecNumber?: string;
  }>;
  bottleneckCount: number;
  thermodynamicConcerns: number;
  pathwayScore: number;
  timestamp: number;
}

/** FBASim output — flux balance analysis results */
export interface FBAArtifact {
  type: "fba";
  species: "ecoli" | "yeast";
  objective: "biomass" | "atp" | "product";
  fluxes: Record<string, number>;
  shadowPrices: Record<string, number>;
  growthRate: number;
  atpYield: number;
  carbonEfficiency: number;
  feasible: boolean;
  bottleneckReactions: Array<{
    id: string;
    flux: number;
    shadowPrice: number;
  }>;
  knockouts: string[];
  timestamp: number;
}

/** CETHX output — thermodynamic feasibility results */
export interface ThermodynamicArtifact {
  type: "thermodynamic";
  steps: Array<{
    reactionId: string;
    deltaG: number;
    feasible: boolean;
    direction: "forward" | "reverse" | "reversible";
  }>;
  overallDeltaG: number;
  overallFeasible: boolean;
  bottleneckSteps: string[];
  timestamp: number;
}

/** CatDes output — catalyst design results */
export interface CatalystArtifact {
  type: "catalyst";
  bottlenecks: Array<{
    reactionId: string;
    currentFlux: number;
    requiredFlux: number;
    gap: number;
  }>;
  topBottleneck: {
    reactionId: string;
    gap: number;
  } | null;
  candidateEnzymes: Array<{
    name: string;
    organism: string;
    score: number;
  }>;
  timestamp: number;
}

/** DynCon output — dynamic control results */
export interface ControlArtifact {
  type: "control";
  pidParams: {
    kp: number;
    ki: number;
    kd: number;
  };
  steadyState: {
    biomass: number;
    product: number;
    substrate: number;
  };
  convergenceTime: number;
  stable: boolean;
  timestamp: number;
}

/** ProEvol output — protein evolution results */
export interface EvolutionArtifact {
  type: "evolution";
  bestVariant: string;
  fitnessScore: number;
  mutations: Array<{
    position: number;
    from: string;
    to: string;
    effect: number;
  }>;
  timestamp: number;
}

/** Union type for all artifacts */
export type ToolArtifact =
  | PathwayArtifact
  | FBAArtifact
  | ThermodynamicArtifact
  | CatalystArtifact
  | ControlArtifact
  | EvolutionArtifact;

/** Artifact type discriminator */
export type ArtifactType = ToolArtifact["type"];

// ── Tool Data Contract ──────────────────────────────────────────────────

export interface ToolDataContract {
  /** Tool ID */
  toolId: string;
  /** Artifacts required before this tool can run */
  requiredArtifacts: ArtifactType[];
  /** Artifacts that enhance but aren't required */
  optionalArtifacts: ArtifactType[];
  /** Artifact type this tool produces */
  producesArtifact: ArtifactType;
  /** Build tool input from upstream artifacts */
  buildInput: (artifacts: Partial<Record<ArtifactType, ToolArtifact>>) => Record<string, unknown>;
}

// ── Contracts ───────────────────────────────────────────────────────────

export const TOOL_DATA_CONTRACTS: Record<string, ToolDataContract> = {
  pathd: {
    toolId: "pathd",
    requiredArtifacts: [],
    optionalArtifacts: [],
    producesArtifact: "pathway",
    buildInput: () => ({}),
  },

  fbasim: {
    toolId: "fbasim",
    requiredArtifacts: [],
    optionalArtifacts: ["pathway"],
    producesArtifact: "fba",
    buildInput: (artifacts) => {
      const pathway = artifacts.pathway as PathwayArtifact | undefined;
      return {
        species: "ecoli",
        objective: "biomass",
        glucoseUptake: 10,
        oxygenUptake: 20,
        knockouts: [],
        targetProduct: pathway?.targetProduct ?? "PRODUCT",
      };
    },
  },

  cethx: {
    toolId: "cethx",
    requiredArtifacts: [],
    optionalArtifacts: ["pathway", "fba"],
    producesArtifact: "thermodynamic",
    buildInput: (artifacts) => {
      const pathway = artifacts.pathway as PathwayArtifact | undefined;
      const fba = artifacts.fba as FBAArtifact | undefined;
      return {
        reactions: pathway?.reactions.map(r => ({
          id: r.id,
          name: r.name,
          stoichiometry: {},
          deltaG0: r.deltaG ?? 0,
        })) ?? [],
        conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
        targetProduct: pathway?.targetProduct ?? "product",
      };
    },
  },

  catdes: {
    toolId: "catdes",
    requiredArtifacts: [],
    optionalArtifacts: ["fba", "thermodynamic"],
    producesArtifact: "catalyst",
    buildInput: (artifacts) => {
      const fba = artifacts.fba as FBAArtifact | undefined;
      const thermo = artifacts.thermodynamic as ThermodynamicArtifact | undefined;
      return {
        fluxes: fba?.fluxes ?? {},
        shadowPrices: fba?.shadowPrices ?? {},
        growthRate: fba?.growthRate ?? 0,
        carbonEfficiency: fba?.carbonEfficiency ?? 0,
        bottleneckReactions: fba?.bottleneckReactions ?? [],
        thermodynamicSteps: thermo?.steps ?? [],
      };
    },
  },

  dyncon: {
    toolId: "dyncon",
    requiredArtifacts: [],
    optionalArtifacts: ["fba", "thermodynamic", "catalyst"],
    producesArtifact: "control",
    buildInput: (artifacts) => {
      const fba = artifacts.fba as FBAArtifact | undefined;
      const catalyst = artifacts.catalyst as CatalystArtifact | undefined;
      return {
        growthRate: fba?.growthRate ?? 0.5,
        targetProduct: catalyst?.topBottleneck?.reactionId ?? "product",
        setpoint: 1.0,
      };
    },
  },

  proevol: {
    toolId: "proevol",
    requiredArtifacts: [],
    optionalArtifacts: ["catalyst", "thermodynamic"],
    producesArtifact: "evolution",
    buildInput: (artifacts) => {
      const catalyst = artifacts.catalyst as CatalystArtifact | undefined;
      return {
        targetEnzyme: catalyst?.topBottleneck?.reactionId ?? "unknown",
        sequence: "MKTAYIAKQRQISFVKSH",
      };
    },
  },
};
