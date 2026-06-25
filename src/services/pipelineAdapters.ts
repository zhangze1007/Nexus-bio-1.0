/**
 * Pipeline Adapters — Bridge multi-agent pipelines to AxonOrchestrator
 *
 * Each adapter wraps a pipeline function as an AxonAdapter so the
 * orchestrator can call it. Every adapter:
 *   1. Validates/transforms input
 *   2. Calls the real pipeline solver (via lazy dynamic import)
 *   3. Returns structured result with solver trace
 *
 * These are NOT mock adapters — they call real solvers.
 * All imports are lazy (inside function body) for Jest compatibility.
 */

import type { AxonAdapter, AxonAdapterContext } from "./AxonOrchestrator";

// ── Circuit Reasoner Adapter ─────────────────────────────────────────────

export const gecairAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runCircuitReasoner } = await import("../server/circuitReasonerPipeline");
  const params = input && typeof input === "object" ? input : {};
  const result = runCircuitReasoner({
    topology: "toggle_switch",
    sensitivityTarget: 0.7,
    burdenLimit: 0.15,
    ...(params as Record<string, unknown>),
  } as Parameters<typeof runCircuitReasoner>[0]);
  return { ...result, _pipeline: "circuitReasoner", _solverCalls: result.allSolverCalls ?? [] };
};

// ── Robustness Predictor Adapter ─────────────────────────────────────────

export const cellfreeAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runRobustnessPredictor } = await import("../server/robustnessPipeline");
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const result = runRobustnessPredictor(
    (p.singleCellData as Parameters<typeof runRobustnessPredictor>[0]) ?? [],
    undefined,
    (p.nTrials as number) ?? 200,
  );
  return { ...result, _pipeline: "robustness", _solverCalls: result.allSolverCalls ?? [] };
};

// ── FBA Strain Design Adapter ────────────────────────────────────────────

export const fbasimPipelineAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runStrainDesignPipeline } = await import("../server/fbaStrainPipeline");
  const result = await runStrainDesignPipeline({
    species: "ecoli",
    objective: "biomass",
    glucoseUptake: 10,
    oxygenUptake: 12,
    targetProduct: "PRODUCT",
    maxKnockouts: 3,
    growthFractionConstraint: 0.1,
    ...(input && typeof input === "object" ? input : {}),
  } as Parameters<typeof runStrainDesignPipeline>[0]);
  return { ...result, _pipeline: "fbaStrain", _solverCalls: result.allSolverCalls ?? [] };
};

// ── Protein Engineering Adapter ──────────────────────────────────────────

export const proevolAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runProteinDesignPipeline } = await import("../server/proevolPipeline");
  const result = runProteinDesignPipeline({
    sequence: "MSDKIVVVGSGPAGLTAAKYLLEKAGIEVSLIEREFLGGVCHTPYWDSIQLAELFGKMPVIPR",
    targetProperty: "stability",
    targetImprovement: 2.0,
    maxMutations: 3,
    ...(input && typeof input === "object" ? input : {}),
  } as Parameters<typeof runProteinDesignPipeline>[0]);
  return { ...result, _pipeline: "proevol", _solverCalls: result.allSolverCalls ?? [] };
};

// ── Dynamic Control Adapter ──────────────────────────────────────────────

export const dynconAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runControlDesignPipeline } = await import("../server/dynconPipeline");
  const result = runControlDesignPipeline({
    setpoint: 5.0,
    processGain: 1.0,
    timeConstant: 10.0,
    deadTime: 2.0,
    disturbanceMagnitude: 0.5,
    ...(input && typeof input === "object" ? input : {}),
  } as Parameters<typeof runControlDesignPipeline>[0]);
  return { ...result, _pipeline: "dyncon", _solverCalls: result.allSolverCalls ?? [] };
};

// ── Thermodynamic Adapter ────────────────────────────────────────────────

export const cethxAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runThermodynamicPipeline } = await import("../server/cethxPipeline");
  const result = runThermodynamicPipeline({
    reactions: [],
    conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298 },
    targetProduct: "",
    ...(input && typeof input === "object" ? input : {}),
  } as Parameters<typeof runThermodynamicPipeline>[0]);
  return { ...result, _pipeline: "cethx", _solverCalls: result.allSolverCalls ?? [] };
};

// ── Genome Minimization Adapter ──────────────────────────────────────────

export const genmimAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runMinimizationPipeline } = await import("../server/genmimPipeline");
  const result = await runMinimizationPipeline({
    species: "ecoli",
    objective: "biomass",
    glucoseUptake: 10,
    oxygenUptake: 12,
    targetGenomeReduction: 0.2,
    minGrowthFraction: 0.8,
    ...(input && typeof input === "object" ? input : {}),
  } as Parameters<typeof runMinimizationPipeline>[0]);
  return { ...result, _pipeline: "genmim", _solverCalls: result.allSolverCalls ?? [] };
};

// ── Multi-Omics Adapter ──────────────────────────────────────────────────

export const multioAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runMultiOmicsPipeline } = await import("../server/multioPipeline");
  const result = runMultiOmicsPipeline({
    datasets: [],
    nFactors: 5,
    maxIterations: 100,
    convergenceThreshold: 1e-6,
    ...(input && typeof input === "object" ? input : {}),
  } as Parameters<typeof runMultiOmicsPipeline>[0]);
  return { ...result, _pipeline: "multio", _solverCalls: result.allSolverCalls ?? [] };
};

// ── Single-Cell Spatial Adapter ──────────────────────────────────────────

export const scspatialAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runScSpatialPipeline } = await import("../server/scspatialPipeline");
  const result = runScSpatialPipeline({
    expressionMatrix: [],
    geneNames: [],
    cellCoordinates: [],
    ...(input && typeof input === "object" ? input : {}),
  } as Parameters<typeof runScSpatialPipeline>[0]);
  return { ...result, _pipeline: "scspatial", _solverCalls: result.allSolverCalls ?? [] };
};

// ── Research (NEXAI) Adapter ─────────────────────────────────────────────

export const nexaiResearchAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runResearchPipeline } = await import("../server/nexaiPipeline");
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const result = runResearchPipeline(
    (p.question as Parameters<typeof runResearchPipeline>[0]) ?? { topic: "", subtopics: [] },
    (p.papers as Parameters<typeof runResearchPipeline>[1]) ?? [],
  );
  return { ...result, _pipeline: "nexai", _solverCalls: result.allSolverCalls ?? [] };
};

// ── Catalyst Designer Adapter ────────────────────────────────────────────

export const catdesAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { identifyBottlenecks } = await import("./CatalystDesignerEngine");
  const result = identifyBottlenecks({
    pathwaySteps: [],
    ...(input && typeof input === "object" ? input : {}),
  } as Parameters<typeof identifyBottlenecks>[0]);
  return {
    ...result,
    _pipeline: "catdes",
    _solverCalls: [{ solver: "CatalystDesignerEngine::identifyBottlenecks", description: "Bottleneck identification" }],
  };
};

// ── Inverse Folding Adapter ────────────────────────────────────────────────

export const inverseFoldingAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runInverseFolding } = await import("../server/inverseFoldingEngine");
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const result = runInverseFolding({
    backbone: (p.backbone as Parameters<typeof runInverseFolding>[0]["backbone"]) ?? [],
    nSequences: (p.nSequences as number) ?? 8,
    temperature: (p.temperature as number) ?? 0.5,
    fixedPositions: p.fixedPositions as number[] | undefined,
    kNeighbors: (p.kNeighbors as number) ?? 16,
    messagePassingRounds: (p.messagePassingRounds as number) ?? 3,
  });
  return {
    ...result,
    _pipeline: "inverseFolding",
    _solverCalls: [
      {
        solver: "inverseFoldingEngine::runInverseFolding",
        description: `Designed ${result.sequences.length} sequences`,
      },
    ],
  };
};

// ── Multiplex CRISPR Adapter ───────────────────────────────────────────────

export const multiplexCRISPRAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runMultiplexCRISPR } = await import("../server/multiplexCRISPREngine");
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const result = runMultiplexCRISPR({
    genes: (p.genes as Parameters<typeof runMultiplexCRISPR>[0]["genes"]) ?? [],
    targetProduct: p.targetProduct as string | undefined,
    maxEdits: (p.maxEdits as number) ?? 5,
    minFitness: (p.minFitness as number) ?? 0.3,
    approach: (p.approach as "arrayed" | "pooled" | "mage_cycling") ?? "arrayed",
    includeOverexpression: (p.includeOverexpression as boolean) ?? false,
    topN: (p.topN as number) ?? 10,
  });
  return {
    ...result,
    _pipeline: "multiplexCRISPR",
    _solverCalls: [
      {
        solver: "multiplexCRISPREngine::runMultiplexCRISPR",
        description: `Found ${result.strategies.length} strategies`,
      },
    ],
  };
};

// ── Pathway Discovery Adapter ──────────────────────────────────────────────

export const pathwayDiscoveryAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runPathwayDiscovery } = await import("../server/pathwayDiscoveryEngine");
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const result = runPathwayDiscovery({
    target: (p.target as Parameters<typeof runPathwayDiscovery>[0]["target"]) ?? {
      id: "",
      name: "",
      functionalGroups: [],
      isPrecursor: false,
    },
    precursors: (p.precursors as Parameters<typeof runPathwayDiscovery>[0]["precursors"]) ?? [],
    maxLength: (p.maxLength as number) ?? 8,
    topN: (p.topN as number) ?? 5,
    preferredOrganism: p.preferredOrganism as string | undefined,
    includeNovel: (p.includeNovel as boolean) ?? false,
  });
  return {
    ...result,
    _pipeline: "pathwayDiscovery",
    _solverCalls: [
      {
        solver: "pathwayDiscoveryEngine::runPathwayDiscovery",
        description: `Discovered ${result.pathways.length} pathways`,
      },
    ],
  };
};

// ── Digital Twin Adapter ───────────────────────────────────────────────────

export const digitalTwinAdapter: AxonAdapter = async (input: unknown, _ctx: AxonAdapterContext) => {
  const { runDigitalTwin } = await import("../server/digitalTwinEngine");
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const result = runDigitalTwin(
    (p.config as Parameters<typeof runDigitalTwin>[0]) ?? {
      volume: 1,
      temperature: 37,
      pH: 7.0,
      dissolvedO2: 100,
      muMax: 0.5,
      ks: 0.5,
      yieldCoeff: 0.5,
      maintenanceCoeff: 0.02,
      productYield: 0.1,
      feedConcentration: 10,
      feedRate: 0.01,
      processNoise: 1.0,
      measurementNoise: 1.0,
      initialUncertainty: 1.0,
    },
    (p.sensorReadings as Parameters<typeof runDigitalTwin>[1]) ?? [],
    (p.forecastHorizon as number) ?? 24,
  );
  return {
    ...result,
    _pipeline: "digitalTwin",
    _solverCalls: [
      {
        solver: "digitalTwinEngine::runDigitalTwin",
        description: `Processed ${result.diagnostics.totalUpdates} readings`,
      },
    ],
  };
};
