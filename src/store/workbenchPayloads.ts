import type { PathwayKey } from '../data/mockCETHX';
import type { DBTLPhase } from '../types';

/**
 * Validity tag attached to every workbench payload (P0.4 from REVIEW_REPORT.md).
 * - 'real'    : algorithm matches its scientific name end-to-end
 * - 'partial' : core math is real, parameters/coupling are placeholders
 * - 'demo'    : visualization is real, but underlying numbers are reference
 *               tables or heuristic stand-ins
 *
 * The canonical default per tool lives in
 * src/components/tools/shared/toolValidity.ts and is rendered as a badge
 * in ToolShell. Individual payloads MAY override the default at runtime
 * (e.g. when a tool successfully fetches live data and upgrades from 'demo'
 * to 'partial').
 */
export type PayloadValidity = 'real' | 'partial' | 'demo';

export interface WorkbenchPayloadBase {
  validity?: PayloadValidity;
}

export interface PathDWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'pathd';
  targetProduct: string;
  sourceArtifactId?: string;
  activeRouteLabel: string;
  nodeCount: number;
  edgeCount: number;
  selectedNodeId: string | null;
  result: {
    pathwayCandidates: number;
    bottleneckCount: number;
    enzymeCandidates: number;
    thermodynamicConcerns: number;
    highlightedNode: string | null;
    recommendedNextTool: string;
    evidenceLinked: boolean;
  };
  updatedAt: number;
}

export interface FBAWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'fbasim';
  targetProduct: string;
  pathwayFocus: string;
  sourceArtifactId?: string;
  mode: 'single' | 'community';
  objective: 'biomass' | 'atp' | 'product';
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts: string[];
  result: {
    growthRate: number;
    atpYield: number;
    nadhProduction: number;
    carbonEfficiency: number;
    feasible: boolean;
    shadowPrices: {
      glc: number;
      o2: number;
      atp: number;
    };
    topFluxes: Array<{
      reactionId: string;
      flux: number;
    }>;
  };
  updatedAt: number;
}

export interface CETHXWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'cethx';
  targetProduct: string;
  sourceArtifactId?: string;
  pathway: PathwayKey;
  tempC: number;
  pH: number;
  result: {
    atpYield: number;
    nadhYield: number;
    gibbsFreeEnergy: number;
    entropyProduction: number;
    efficiency: number;
    limitingStep: string | null;
  };
  updatedAt: number;
}

export interface CatalystWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'catdes';
  targetProduct: string;
  sourceArtifactId?: string;
  selectedEnzymeId: string;
  selectedEnzymeName: string;
  selectedView: string;
  requiredFlux: number;
  designCount: number;
  result: {
    bindingKd: number;
    overallBinding: number;
    bestSequenceScore: number;
    bestCAI: number;
    totalMetabolicDrain: number;
    growthPenalty: number;
    isViable: boolean;
    bestPathway: string;
    topMutationSites: number;
    recommendation: string;
  };
  updatedAt: number;
}

export interface DynConWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'dyncon';
  targetProduct: string;
  sourceArtifactId?: string;
  controller: {
    kp: number;
    ki: number;
    kd: number;
    setpoint: number;
  };
  hill: {
    vmax: number;
    kd: number;
    n: number;
  };
  result: {
    productTiter: number;
    productivity: number;
    doRmse: number;
    stable: boolean;
    burdenIndex: number;
    currentFPP: number;
    adsExpression: number;
    rbsPart: string;
  };
  updatedAt: number;
}

export interface CellFreeWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'cellfree';
  targetProduct: string;
  sourceArtifactId?: string;
  targetConstruct: string;
  constructCount: number;
  temperature: number;
  simulationTime: number;
  result: {
    totalProteinYield: number;
    energyDepletionTime: number;
    isResourceLimited: boolean;
    invitroMaxProtein: number;
    invivoExpression: number | null;
    confidence: number | null;
  };
  updatedAt: number;
}

export interface DBTLWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'dbtlflow';
  targetProduct: string;
  sourceArtifactId?: string;
  proposedPhase: DBTLPhase;
  draftHypothesis: string;
  measuredResult: number;
  unit: string;
  passed: boolean;
  feedbackSource: 'draft' | 'committed';
  feedbackIterationId: number | null;
  result: {
    bestIteration: number;
    improvementRate: number;
    passRate: number;
    latestPhase: DBTLPhase;
    learnedParameters: string[];
  };
  updatedAt: number;
}

export interface ProEvolWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'proevol';
  targetProduct: string;
  sourceArtifactId?: string;
  mutationRate: number;
  rounds: number;
  result: {
    bestFitness: number;
    beneficialMutations: number;
    trajectoryLength: number;
    bestSequence: string;
  };
  updatedAt: number;
}

export interface GECAIRWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'gecair';
  targetProduct: string;
  sourceArtifactId?: string;
  gateType: 'NOT' | 'AND' | 'OR' | 'NAND';
  inputA: number;
  inputB: number;
  result: {
    outputLevel: number;
    nodeAOutput: number;
    nodeBOutput: number;
    noiseScore: number;
    circuitComplexity: number;
  };
  updatedAt: number;
}

export interface GenMIMWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'genmim';
  targetProduct: string;
  sourceArtifactId?: string;
  efficiencyThreshold: number;
  maxTargets: number;
  protectEssential: boolean;
  result: {
    selectedTargets: number;
    growthImpact: number;
    avgEfficiency: number;
    offTargetRisk: number;
    topGenes: string[];
  };
  updatedAt: number;
}

export interface MultiOWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'multio';
  targetProduct: string;
  sourceArtifactId?: string;
  selectedGene: string;
  activeView: string;
  thresholds: {
    fc: number;
    pv: number;
  };
  result: {
    significantCount: number;
    dominantLayer: string;
    bottleneckGene: string;
    bottleneckConfidence: number;
    mofaVarianceExplained: number;
    topEfficiencyGene: string;
    topEfficiencyScore: number;
    vaeElbo: number;
  };
  updatedAt: number;
}

export interface ScSpatialWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'scspatial';
  targetProduct: string;
  sourceArtifactId?: string;
  selectedCluster: number | null;
  highlightGene: string;
  activeView: string;
  result: {
    totalCells: number;
    passedCells: number;
    topSpatialGene: string;
    topMoranI: number;
    highestYieldCluster: string;
    latentDim: number;
  };
  updatedAt: number;
}

export interface NEXAIWorkbenchPayload extends WorkbenchPayloadBase {
  toolId: 'nexai';
  targetProduct: string;
  sourceArtifactId?: string;
  query: string;
  result: {
    confidence: number;
    citations: number;
    answerPreview: string;
    mode: 'pathway' | 'text' | 'mock' | 'idle';
  };
  updatedAt: number;
}

export interface WorkbenchToolPayloadMap {
  pathd?: PathDWorkbenchPayload;
  fbasim?: FBAWorkbenchPayload;
  cethx?: CETHXWorkbenchPayload;
  catdes?: CatalystWorkbenchPayload;
  dyncon?: DynConWorkbenchPayload;
  cellfree?: CellFreeWorkbenchPayload;
  dbtlflow?: DBTLWorkbenchPayload;
  proevol?: ProEvolWorkbenchPayload;
  gecair?: GECAIRWorkbenchPayload;
  genmim?: GenMIMWorkbenchPayload;
  multio?: MultiOWorkbenchPayload;
  scspatial?: ScSpatialWorkbenchPayload;
  nexai?: NEXAIWorkbenchPayload;
}
