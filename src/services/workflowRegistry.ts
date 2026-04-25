/**
 * workflowRegistry — one ToolContract per tool id.
 *
 * The registry is the single declarative source of truth consumed by:
 *   - workflowStateMachine: guards golden-path transitions.
 *   - workflowSupervisor: explains state, missing evidence, gates.
 *   - workbenchStore: gates `setToolPayload` writes when upstream is missing.
 *   - axonPlanner: emits dependency-correct plans for any tool id.
 *
 * Adding a tool: add its id to TOOL_IDS in workflowContract.ts AND a record
 * here. The contract-parity test fails CI if these drift.
 */
import {
  GOLDEN_PATH_TOOL_IDS,
  TOOL_IDS,
  isGoldenPathToolId,
  type GoldenPathToolId,
  type ToolContract,
  type ToolId,
} from '../domain/workflowContract';

const NO_FAILURE: ToolContract['failureModes'] = [];

const NO_GATE: ToolContract['humanGatePolicy'] = {
  requiredFor: [],
  description: 'No human gate; tool advances on payload write.',
};

const NO_CONFIDENCE: ToolContract['confidencePolicy'] = {
  sourceField: null,
  minToAdvance: null,
};

const NO_UNCERTAINTY: ToolContract['uncertaintyPolicy'] = {
  sourceField: null,
  unboundedIsGate: false,
};

const NO_EVIDENCE: ToolContract['evidenceRequired'] = {
  minItems: 0,
  kinds: [],
  gateOnMissing: false,
};

const PATHD_CONTRACT: ToolContract = {
  toolId: 'pathd',
  stageId: 'stage-1',
  primaryIntent: 'design',
  requiredInputs: [],
  optionalInputs: [],
  outputArtifacts: [
    { toolId: 'pathd', payloadPath: 'result.pathwayCandidates', required: true, rationale: 'Candidate routes for downstream FBA seeding.' },
    { toolId: 'pathd', payloadPath: 'nodeCount', required: true, rationale: 'Pathway graph size; FBA requires non-zero nodes.' },
  ],
  evidenceRequired: { minItems: 1, kinds: ['literature', 'analysis'], gateOnMissing: false },
  validityBaseline: { floor: 'partial', reason: 'Pathway graph + ΔG° lookup are real; route synthesis is template-based.' },
  confidencePolicy: { sourceField: 'result.evidenceLinked', minToAdvance: null },
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['fbasim', 'cethx'],
  failureModes: [
    { code: 'NO_TARGET', detection: 'targetProduct empty or "Target Product"', recovery: 'Provide a real target via /research or /analyze.' },
    { code: 'EMPTY_GRAPH', detection: 'nodeCount === 0', recovery: 'Re-run analyze with stronger evidence bundle.' },
  ],
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: true,
};

const FBASIM_CONTRACT: ToolContract = {
  toolId: 'fbasim',
  stageId: 'stage-2',
  primaryIntent: 'simulate',
  requiredInputs: [
    { toolId: 'pathd', payloadPath: 'result.pathwayCandidates', required: true, rationale: 'FBA needs a candidate pathway to constrain.' },
  ],
  optionalInputs: [
    { toolId: 'cethx', payloadPath: 'result.gibbsFreeEnergy', required: false, rationale: 'Thermodynamic feasibility tightens flux bounds.' },
  ],
  outputArtifacts: [
    { toolId: 'fbasim', payloadPath: 'result.topFluxes', required: true, rationale: 'Bottleneck signal for CatDes.' },
    { toolId: 'fbasim', payloadPath: 'result.feasible', required: true, rationale: 'LP feasibility flag for downstream gating.' },
  ],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'partial', reason: 'Single-species FBA uses real two-phase simplex LP. Community mode is post-hoc scaled.' },
  confidencePolicy: { sourceField: 'result.feasible', minToAdvance: 1 },
  uncertaintyPolicy: { sourceField: 'result.shadowPrices.atp', unboundedIsGate: false },
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['catdes', 'cethx', 'genmim'],
  failureModes: [
    { code: 'INFEASIBLE', detection: 'result.feasible === false', recovery: 'Loosen knockouts or revisit pathway design.' },
  ],
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: true,
};

const CATDES_CONTRACT: ToolContract = {
  toolId: 'catdes',
  stageId: 'stage-2',
  primaryIntent: 'optimize',
  requiredInputs: [
    { toolId: 'fbasim', payloadPath: 'result.topFluxes', required: true, rationale: 'Catalyst targets are nominated by FBA bottlenecks.' },
  ],
  optionalInputs: [
    { toolId: 'cethx', payloadPath: 'result.efficiency', required: false, rationale: 'Thermodynamic penalty informs catalyst weighting.' },
  ],
  outputArtifacts: [
    { toolId: 'catdes', payloadPath: 'result.bestSequenceScore', required: true, rationale: 'Best variant for DynCon expression seed.' },
    { toolId: 'catdes', payloadPath: 'result.isViable', required: true, rationale: 'Drives DBTL pass/fail gating.' },
  ],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'partial', reason: 'Distance / orientation / VdW / electrostatic scoring is real; residue weights are curated.' },
  confidencePolicy: { sourceField: 'result.bestCAI', minToAdvance: 0.4 },
  uncertaintyPolicy: { sourceField: 'result.totalMetabolicDrain', unboundedIsGate: false },
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['dyncon', 'cellfree', 'proevol'],
  failureModes: [
    { code: 'INVIABLE', detection: 'result.isViable === false', recovery: 'Reduce required flux or expand candidate library.' },
  ],
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: true,
};

const DYNCON_CONTRACT: ToolContract = {
  toolId: 'dyncon',
  stageId: 'stage-3',
  primaryIntent: 'control',
  requiredInputs: [
    { toolId: 'catdes', payloadPath: 'result.bestSequenceScore', required: true, rationale: 'Controller tuning consumes catalyst expression bias.' },
  ],
  optionalInputs: [
    { toolId: 'gecair', payloadPath: 'result.outputLevel', required: false, rationale: 'Gene-circuit dynamics inform controller bandwidth.' },
  ],
  outputArtifacts: [
    { toolId: 'dyncon', payloadPath: 'result.stable', required: true, rationale: 'Stability flag gates CellFree validation.' },
    { toolId: 'dyncon', payloadPath: 'result.productTiter', required: true, rationale: 'Predicted titer for cell-free seed.' },
  ],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'partial', reason: 'Hill feedback + Monod growth + RK4 ODE are textbook-correct; bioreactor parameters are reference values.' },
  confidencePolicy: { sourceField: 'result.stable', minToAdvance: 1 },
  uncertaintyPolicy: { sourceField: 'result.doRmse', unboundedIsGate: true },
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['cellfree', 'dbtlflow'],
  failureModes: [
    { code: 'UNSTABLE', detection: 'result.stable === false', recovery: 'Retune kp/ki/kd or revisit setpoint.' },
  ],
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: true,
};

const CELLFREE_CONTRACT: ToolContract = {
  toolId: 'cellfree',
  stageId: 'stage-4',
  primaryIntent: 'validate',
  requiredInputs: [
    { toolId: 'dyncon', payloadPath: 'result.stable', required: true, rationale: 'Cell-free prototyping inherits DynCon controller assumptions.' },
  ],
  optionalInputs: [
    { toolId: 'catdes', payloadPath: 'result.bestCAI', required: false, rationale: 'CAI feeds expression rate prior.' },
  ],
  outputArtifacts: [
    { toolId: 'cellfree', payloadPath: 'result.confidence', required: true, rationale: 'CFPS confidence drives DBTL Build/Test gate.' },
    { toolId: 'cellfree', payloadPath: 'result.invivoExpression', required: false, rationale: 'IVIV-translated yield estimate.' },
  ],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'demo', reason: 'Cell-free expression yield uses a curated lookup; no live TXTL kinetic model yet.' },
  confidencePolicy: { sourceField: 'result.confidence', minToAdvance: 0.5 },
  uncertaintyPolicy: { sourceField: 'result.energyDepletionTime', unboundedIsGate: false },
  humanGatePolicy: { requiredFor: ['commit'], description: 'Operator must commit prototype results before they enter the DBTL ledger.' },
  nextRecommendedNodes: ['dbtlflow', 'multio'],
  failureModes: [
    { code: 'RESOURCE_LIMITED', detection: 'result.isResourceLimited === true', recovery: 'Increase ATP/GTP or shorten simulation time.' },
  ],
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: true,
};

const DBTLFLOW_CONTRACT: ToolContract = {
  toolId: 'dbtlflow',
  stageId: 'stage-4',
  primaryIntent: 'validate',
  requiredInputs: [
    { toolId: 'cellfree', payloadPath: 'result.confidence', required: true, rationale: 'DBTL Test/Learn phases consume CFPS confidence.' },
  ],
  optionalInputs: [
    { toolId: 'dyncon', payloadPath: 'result.productTiter', required: false, rationale: 'In-vivo titer estimate seeds Test scoring.' },
  ],
  outputArtifacts: [
    { toolId: 'dbtlflow', payloadPath: 'result.passRate', required: true, rationale: 'Loop-back signal feeding the next iteration.' },
    { toolId: 'dbtlflow', payloadPath: 'result.learnedParameters', required: true, rationale: 'Learned weights consumed by upstream seeders.' },
  ],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'partial', reason: 'Iteration ledger and SBOL serialization are real; learning loop weights are heuristic.' },
  confidencePolicy: { sourceField: 'result.passRate', minToAdvance: 0 },
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: { requiredFor: ['commit', 'loop-back'], description: 'Operator must explicitly commit a Learn cycle before parameters re-seed upstream tools.' },
  nextRecommendedNodes: ['pathd', 'fbasim', 'multio', 'scspatial'],
  failureModes: [
    { code: 'NO_FEEDBACK', detection: 'feedbackSource !== "committed"', recovery: 'Commit at least one Learn iteration to enable loop-back.' },
  ],
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: true,
};

// ── Sidecars (contract-defined but not on the golden path) ────────────────

const METABOLIC_ENG_CONTRACT: ToolContract = {
  toolId: 'metabolic-eng',
  stageId: 'stage-1',
  primaryIntent: 'design',
  requiredInputs: [],
  optionalInputs: [
    { toolId: 'pathd', payloadPath: 'result.pathwayCandidates', required: false, rationale: '3D lab consumes the active PATHD route when present.' },
  ],
  outputArtifacts: [],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'partial', reason: 'Same engine as PATHD with live FBA hooks; force layout is heuristic.' },
  confidencePolicy: NO_CONFIDENCE,
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['pathd', 'fbasim'],
  failureModes: NO_FAILURE,
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: false,
};

const CETHX_CONTRACT: ToolContract = {
  toolId: 'cethx',
  stageId: 'stage-2',
  primaryIntent: 'analyze',
  requiredInputs: [],
  optionalInputs: [
    { toolId: 'pathd', payloadPath: 'result.pathwayCandidates', required: false, rationale: 'Pathway choice drives ΔG cascade selection.' },
    { toolId: 'fbasim', payloadPath: 'result.topFluxes', required: false, rationale: 'Flux mix tightens the thermodynamic window.' },
  ],
  outputArtifacts: [
    { toolId: 'cethx', payloadPath: 'result.gibbsFreeEnergy', required: false, rationale: 'Optional input for CatDes scoring.' },
  ],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'demo', reason: 'ΔG° values are Lehninger reference (pH 7, 25°C); no live Alberty pH/T transform yet.' },
  confidencePolicy: NO_CONFIDENCE,
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['catdes', 'dyncon'],
  failureModes: NO_FAILURE,
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: false,
};

const PROEVOL_CONTRACT: ToolContract = {
  toolId: 'proevol',
  stageId: 'stage-2',
  primaryIntent: 'optimize',
  requiredInputs: [],
  optionalInputs: [
    { toolId: 'fbasim', payloadPath: 'result.topFluxes', required: false, rationale: 'Bottleneck enzymes nominate evolution targets.' },
    { toolId: 'catdes', payloadPath: 'result.bestSequenceScore', required: false, rationale: 'Lead variant seeds the campaign WT.' },
  ],
  outputArtifacts: [],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'partial', reason: 'Campaign scoring and lineage tracking are deterministic heuristics; outputs are simulated decision support.' },
  confidencePolicy: { sourceField: 'result.diversityIndex', minToAdvance: null },
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['catdes', 'cellfree'],
  failureModes: NO_FAILURE,
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: false,
};

const GENMIM_CONTRACT: ToolContract = {
  toolId: 'genmim',
  stageId: 'stage-3',
  primaryIntent: 'engineer',
  requiredInputs: [],
  optionalInputs: [
    { toolId: 'fbasim', payloadPath: 'result.topFluxes', required: false, rationale: 'Flux constraints prioritize chassis edits.' },
  ],
  outputArtifacts: [],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'partial', reason: 'Greedy CRISPRi ranker is real; viability uses additive growth-impact (no epistatic interactions).' },
  confidencePolicy: NO_CONFIDENCE,
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['gecair', 'dyncon', 'cellfree'],
  failureModes: NO_FAILURE,
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: false,
};

const GECAIR_CONTRACT: ToolContract = {
  toolId: 'gecair',
  stageId: 'stage-3',
  primaryIntent: 'engineer',
  requiredInputs: [],
  optionalInputs: [
    { toolId: 'genmim', payloadPath: 'result.topGenes', required: false, rationale: 'Chassis edits constrain insertion targets.' },
  ],
  outputArtifacts: [
    { toolId: 'gecair', payloadPath: 'result.outputLevel', required: false, rationale: 'Optional input to DynCon controller bandwidth.' },
  ],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'partial', reason: 'Hill curves and logic gate dynamics are real; circuit topology library is curated.' },
  confidencePolicy: NO_CONFIDENCE,
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['dyncon', 'dbtlflow'],
  failureModes: NO_FAILURE,
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: false,
};

const MULTIO_CONTRACT: ToolContract = {
  toolId: 'multio',
  stageId: 'stage-4',
  primaryIntent: 'analyze',
  requiredInputs: [],
  optionalInputs: [
    { toolId: 'dbtlflow', payloadPath: 'result.passRate', required: false, rationale: 'DBTL batches produce the measurements consumed here.' },
    { toolId: 'cellfree', payloadPath: 'result.confidence', required: false, rationale: 'Prototype results can be merged with omics.' },
  ],
  outputArtifacts: [],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'demo', reason: 'Integration uses deterministic factor decomposition and linear embeddings; legacy MOFA+/VAE/UMAP labels removed.' },
  confidencePolicy: { sourceField: 'result.bottleneckConfidence', minToAdvance: null },
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['scspatial', 'pathd'],
  failureModes: NO_FAILURE,
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: false,
};

const SCSPATIAL_CONTRACT: ToolContract = {
  toolId: 'scspatial',
  stageId: 'stage-4',
  primaryIntent: 'analyze',
  requiredInputs: [],
  optionalInputs: [
    { toolId: 'multio', payloadPath: 'result.bottleneckGene', required: false, rationale: 'Integrated omics findings seed spatial interrogation.' },
  ],
  outputArtifacts: [],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'partial', reason: 'h5ad ingestion, Moran I, neighborhood graphs, PAGA, UMAP are real when dataset fields are present.' },
  confidencePolicy: NO_CONFIDENCE,
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['pathd'],
  failureModes: NO_FAILURE,
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: false,
};

const NEXAI_CONTRACT: ToolContract = {
  toolId: 'nexai',
  stageId: 'stage-1',
  primaryIntent: 'supervise',
  requiredInputs: [],
  optionalInputs: [],
  outputArtifacts: [],
  evidenceRequired: NO_EVIDENCE,
  validityBaseline: { floor: 'real', reason: 'Answers come from Groq llama-3.3-70b-versatile via /api/analyze. No client-side template fallback.' },
  confidencePolicy: { sourceField: 'result.confidence', minToAdvance: null },
  uncertaintyPolicy: NO_UNCERTAINTY,
  humanGatePolicy: NO_GATE,
  nextRecommendedNodes: ['pathd', 'fbasim', 'dbtlflow'],
  failureModes: [
    { code: 'PROVIDER_DOWN', detection: '/api/analyze returns 503', recovery: 'Wait or switch provider in the Vercel dashboard.' },
  ],
  demoPolicy: { allowsDemoSeed: true, blockGoldenPath: false },
  isGoldenPath: false,
};

export const WORKFLOW_CONTRACTS: Record<ToolId, ToolContract> = {
  pathd: PATHD_CONTRACT,
  'metabolic-eng': METABOLIC_ENG_CONTRACT,
  fbasim: FBASIM_CONTRACT,
  cethx: CETHX_CONTRACT,
  catdes: CATDES_CONTRACT,
  proevol: PROEVOL_CONTRACT,
  dyncon: DYNCON_CONTRACT,
  gecair: GECAIR_CONTRACT,
  genmim: GENMIM_CONTRACT,
  cellfree: CELLFREE_CONTRACT,
  dbtlflow: DBTLFLOW_CONTRACT,
  multio: MULTIO_CONTRACT,
  scspatial: SCSPATIAL_CONTRACT,
  nexai: NEXAI_CONTRACT,
};

export function getToolContract(id: ToolId): ToolContract {
  const contract = WORKFLOW_CONTRACTS[id];
  if (!contract) {
    throw new Error(`workflowRegistry: no contract registered for tool id "${id}"`);
  }
  return contract;
}

export function tryGetToolContract(id: string): ToolContract | undefined {
  return (WORKFLOW_CONTRACTS as Record<string, ToolContract | undefined>)[id];
}

/**
 * Ordered golden path. The state machine consumes this directly so the
 * declared sequence and the executable sequence cannot drift.
 */
export function getGoldenPath(): readonly ToolId[] {
  return GOLDEN_PATH_TOOL_IDS;
}

export function getSidecarIds(): ToolId[] {
  return TOOL_IDS.filter((id) => !isGoldenPathToolId(id));
}

/** Successor on the golden path, or `null` if the input is not on it / is the terminal step. */
export function getGoldenPathSuccessor(id: ToolId): ToolId | null {
  const idx = GOLDEN_PATH_TOOL_IDS.indexOf(id as GoldenPathToolId);
  if (idx < 0 || idx === GOLDEN_PATH_TOOL_IDS.length - 1) return null;
  return GOLDEN_PATH_TOOL_IDS[idx + 1];
}

export function getGoldenPathPredecessor(id: ToolId): ToolId | null {
  const idx = GOLDEN_PATH_TOOL_IDS.indexOf(id as GoldenPathToolId);
  if (idx <= 0) return null;
  return GOLDEN_PATH_TOOL_IDS[idx - 1];
}

// Re-export for ergonomics — most consumers want to import GOLDEN_PATH_TOOL_IDS
// from one place.
export { GOLDEN_PATH_TOOL_IDS } from '../domain/workflowContract';
