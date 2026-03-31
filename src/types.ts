// Core pathway types
export type NodeColorMapping = 'Green' | 'Yellow' | 'Orange' | 'Red' | 'Purple' | 'Blue';

export type NodeType =
  | 'metabolite'
  | 'enzyme'
  | 'gene'
  | 'complex'
  | 'cofactor'
  | 'impurity'
  | 'intermediate'
  | 'unknown';

export interface MolAtom {
  element: string;
  position: [number, number, number];
  charge?: number;
}

export interface MolBond {
  atomIndex1: number;
  atomIndex2: number;
  order: 1 | 2 | 3;
}

export interface MolecularStructure {
  atoms: MolAtom[];
  bonds: MolBond[];
  optimized?: boolean;
}

export interface PathwayNode {
  id: string;
  label: string;
  position: [number, number, number];
  summary: string;
  citation: string;
  color: string;

  // Scientific & Commercial Intelligence Layer
  canonicalLabel?: string;
  nodeType?: NodeType;
  evidenceSnippet?: string;
  confidenceScore?: number;
  
  // Nexus-Bio 1.1: Risk and Compliance
  risk_score?: number;
  audit_trail?: string;
  color_mapping?: NodeColorMapping;
  thermodynamic_stability?: string;
  toxicity_impact?: string;
  separation_cost_index?: number;

  // Nexus-Bio 1.2: Metabolic Engineering Intelligence
  cofactor_balance?: string;
  carbon_efficiency?: number;
  gene_recommendation?: string;

  // Nexus-Bio 1.3: Industrial Metrics & DSP Intelligence
  genetic_intervention?: string;
  atom_economy?: number;
  dsp_bottleneck?: string;
  ic50_toxicity?: string;
  
  // Molecular structure data
  ecNumber?: string;
  chebiId?: string;
  uniprotId?: string;
  pubchemCID?: number;
  smiles?: string;
  molecularFormula?: string;
  molecularWeight?: number;
  molecularStructure?: MolecularStructure;
}

export type EdgeRelationshipType =
  | 'catalyzes'
  | 'produces'
  | 'consumes'
  | 'activates'
  | 'inhibits'
  | 'converts'
  | 'transports'
  | 'regulates'
  | 'unknown';

export interface PathwayEdge {
  start: string;
  end: string;
  relationshipType?: EdgeRelationshipType;
  evidence?: string;
  confidenceScore?: number;
  direction?: 'forward' | 'reverse' | 'bidirectional';
  
  // Nexus-Bio 1.1: Thermodynamic data
  predicted_delta_G_kJ_mol?: number;
  spontaneity?: string;
  yield_prediction?: string;
  thickness_mapping?: 'Thick' | 'Medium' | 'Thin';
  audit_trail?: string;
}

export interface RiskReportEntry {
  impurity_name: string;
  source_pathway: string;
  reason: string;
  risk_score: number;
  audit_trail: string;
}

export interface YieldOptimizationStrategy {
  strategy_type: string;
  description: string;
  target_nodes: string[];
  audit_trail: string;
}

export interface GeneratedPathway {
  project_name?: string;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  risk_report?: RiskReportEntry[];
  yield_optimization_strategies?: YieldOptimizationStrategy[];
  metadata?: {
    sourceText?: string;
    generatedAt?: string;
    modelUsed?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
}

// RESTORED HELPERS for PaperAnalyzer.tsx
export function isValidNode(node: any): node is Partial<PathwayNode> {
  if (!node || typeof node !== 'object') return false;
  return typeof node.id === 'string' && node.id.length > 0;
}

export function isValidEdge(edge: any): edge is PathwayEdge {
  if (!edge || typeof edge !== 'object') return false;
  return typeof edge.start === 'string' && edge.start.length > 0 &&
         typeof edge.end === 'string' && edge.end.length > 0;
}

export function sanitizeNodeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 64);
}

// ── IDE Console entry ─────────────────────────────────────────────────────────
export interface ConsoleEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  module: string;
  message: string;
}

// ── MODULE: FBAsim ────────────────────────────────────────────────────────────
export interface FBAReaction {
  id: string;
  name: string;
  subsystem?: string;
  lb: number;
  ub: number;
  flux?: number;
}
export interface FBAResult {
  objectiveValue: number;
  reactions: FBAReaction[];
  shadowPrices: Record<string, number>;
  feasible: boolean;
}

// ── Community FBA (Multi-species) ──
export interface StrainConfig {
  id: string;
  name: string;
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts: string[];
}

export interface ExchangeReaction {
  id: string;
  metabolite: string;
  fromStrain: string;
  toStrain: string;
  flux: number;
  lb: number;
  ub: number;
}

export interface CommunityFBAResult {
  strainResults: Record<string, {
    fluxes: Record<string, number>;
    growthRate: number;
    atpYield: number;
    nadhProduction: number;
    carbonEfficiency: number;
    feasible: boolean;
  }>;
  exchangeFluxes: ExchangeReaction[];
  communityGrowthRate: number;
  communityBiomassObjective: number;
  crossFeedingMetabolites: string[];
  feasible: boolean;
}

// ── MODULE: PROEVOL ───────────────────────────────────────────────────────────
export interface Mutation { position: number; from: string; to: string; ddG?: number; }
export interface FitnessPoint { mutationCount: number; fitness: number; sequence: string; }

// ── MODULE: GECAIR ────────────────────────────────────────────────────────────
export type GeneticPartType = 'promoter' | 'rbs' | 'cds' | 'terminator';
export interface GeneticPart { id: string; type: GeneticPartType; strength?: number; label?: string; }
export interface CircuitNode { id: string; parts: GeneticPart[]; outputLevel?: number; }

// ── MODULE: DYNCON ────────────────────────────────────────────────────────────
export interface ODEState {
  time: number;
  biomass: number;
  substrate: number;
  product: number;
  dissolvedO2: number;
  // Extended state for artemisinin pathway
  fpp?: number;            // FPP intermediate concentration (μM)
  adsExpression?: number;  // ADS enzyme expression level (a.u.)
  toxicity?: number;       // Toxicity index (0–1)
  metabolicBurden?: number;// Metabolic burden penalty (0–1)
}

export interface ControllerParams { kp: number; ki: number; kd: number; setpoint: number; }

export interface HillParams {
  Vmax: number;  // Maximum expression rate
  Kd: number;    // Dissociation constant (μM)
  n: number;     // Hill coefficient (cooperativity)
}

export interface ConvergenceMetrics {
  settlingTime: number;        // Time to reach ±5% of setpoint (h)
  overshoot: number;           // Maximum overshoot (%)
  steadyStateError: number;    // Final offset from setpoint
  convergenceRate: number;     // Exponential decay rate (h⁻¹)
  oscillationCount: number;    // Number of zero-crossings
  isStable: boolean;
}

export interface RBSMapping {
  controlGain: number;          // Normalized gain (0–1)
  rbsName: string;              // Registry part name
  rbsStrength: number;          // Relative translation initiation rate
  translationRate: number;      // au/min
  sequence: string;             // DNA sequence (5'→3')
  registryId: string;           // iGEM Registry ID
}

export interface MetabolicBurdenResult {
  burdenIndex: number;          // 0–1 composite score
  proteinCost: number;          // Fraction of ribosome budget consumed
  atpDrain: number;             // mmol ATP/gDW/h diverted
  growthPenalty: number;        // Fractional growth rate reduction
  isViable: boolean;            // Host cell viability prediction
  recommendation: string;
}

// ── MODULE: DBTLflow ──────────────────────────────────────────────────────────
export interface DBTLIteration {
  id: number;
  phase: 'Design' | 'Build' | 'Test' | 'Learn';
  hypothesis: string;
  result: number;
  unit: string;
  passed: boolean;
  notes?: string;
  // Automation extensions
  protocol?: GeneratedProtocol;
  qcStatus?: 'valid' | 'sensor_anomaly' | 'unchecked';
  theoreticalMax?: number;
}

// ── DBTL Automation Suite ─────────────────────────────────────────────────────
export type DBTLPhase = 'Design' | 'Build' | 'Test' | 'Learn';

export interface LabwareSlot {
  slot: number;
  labware: string;
  label: string;
}

export interface PipettingStep {
  action: 'aspirate' | 'dispense' | 'mix' | 'transfer';
  pipette: string;
  volume_ul: number;
  source: string;
  destination: string;
  mix_cycles?: number;
  new_tip?: boolean;
  volumeTracking?: boolean;
}

export interface IncubationStep {
  temperature_c: number;
  duration_min: number;
  shaking_rpm?: number;
  label: string;
}

export interface GeneratedProtocol {
  api_version: string;
  metadata: { protocolName: string; author: string; description: string };
  labware: LabwareSlot[];
  pipettes: { mount: 'left' | 'right'; pipette: string }[];
  pipetting_logic: PipettingStep[];
  incubation_steps: IncubationStep[];
  python_code: string;
}

export interface TestDataRow {
  sample_id: string;
  strain: string;
  condition: string;
  yield_mg_L: number;
  biomass_OD600: number;
  substrate_consumed_mM: number;
  timestamp?: string;
}

export interface NextIterationSuggestion {
  parameter: string;
  current_value: number;
  suggested_value: number;
  rationale: string;
  predicted_improvement_percent: number;
}

export interface FeedbackLoopResult {
  iteration_id: number;
  test_summary: {
    mean_yield: number;
    std_yield: number;
    best_sample: string;
    worst_sample: string;
  };
  qc_flags: QCFlag[];
  next_iteration_suggestions: NextIterationSuggestion[];
  optimization_objective: string;
}

export interface QCFlag {
  sample_id: string;
  flag_type: 'sensor_anomaly' | 'outlier' | 'below_detection';
  measured_value: number;
  theoretical_max: number;
  message: string;
}

// ── MODULE: MULTIO ────────────────────────────────────────────────────────────
export interface OmicsRow {
  id: string;
  gene: string;
  transcript?: number;
  protein?: number;
  metabolite?: number;
  fold_change?: number;
  pValue?: number;
}

export type OmicsLayer = 'transcriptomics' | 'proteomics' | 'metabolomics';

export interface EmbeddingPoint {
  id: string;
  gene: string;
  layer: OmicsLayer;
  coords: [number, number, number]; // UMAP 3D
  normalizedValue: number;          // z-score normalized
  rawValue: number;
}

export interface AttentionHead {
  name: string;
  layer: OmicsLayer;
  weight: number; // 0–1 attention weight
  signal_strength: number;
  bottleneck_contribution: number;
}

export interface BottleneckSignal {
  dominant_layer: OmicsLayer;
  attention_heads: AttentionHead[];
  reasoning: string;
  confidence: number;
}

export interface PerturbationResult {
  gene: string;
  original_expression: number;
  perturbed_expression: number;
  reasoning_chain: ReasoningStep[];
  predicted_yield_change_percent: number;
  metabolite_shifts: { metabolite: string; delta: number; direction: 'up' | 'down' }[];
  confidence: number;
}

export interface ReasoningStep {
  step: string;
  description: string;
  evidence: string;
}

export interface InternalThought {
  timestamp: number;
  thought: string;
  layer_context: OmicsLayer[];
  action_taken: string;
}

// ── MODULE: CETHX ─────────────────────────────────────────────────────────────
export interface ThermoStep { step: string; deltaG: number; cumulative: number; atpYield: number; }
export interface ThermoState { atp_yield: number; nadh_yield: number; entropy_production: number; gibbs_free_energy: number; }

// ── MODULE: GENMIM ────────────────────────────────────────────────────────────
export interface CRISPRiTarget {
  gene: string;
  position: number;
  essential: boolean;
  knockdown_efficiency: number;
  phenotype?: string;
  growth_impact?: number;
}

// ── MODULE: NEXAI ─────────────────────────────────────────────────────────────
export interface AIQuery { id: string; text: string; timestamp: number; }
export interface CitationNode {
  id: string;
  title: string;
  authors: string;
  year: number;
  doi?: string;
  relevance: number;
  x?: number;
  y?: number;
}
export interface NEXAIResult {
  query: string;
  answer: string;
  citations: CitationNode[];
  confidence: number;
  generatedAt: number;
}

// ── Axon Predictive Design Agent types ──────────────────────────────────────

export interface BottleneckEnzyme {
  node_id: string;
  enzyme: string;
  efficiency_percent: number;
  yield_loss_percent: number;
  evidence: string;
}

export interface DeNovoDesignStrategy {
  node_id: string;
  de_novo_design_strategy: {
    active_site_remodeling: string;
    thermal_stability_enhancement: string;
    substrate_specificity_tuning: string;
    predicted_impact: string;
  };
}

export interface AxonInteraction {
  yield_loss_percent: number;
  step: string;
  question: string;
  options: string[];
  disclosure_phase?: 'socratic' | 'revealed';
}

export interface AxonEnrichedResponse {
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  bottleneck_enzymes: BottleneckEnzyme[];
  de_novo_design_strategies: DeNovoDesignStrategy[];
  axon_interaction: AxonInteraction;
}

// ── Artemisinin showcase CIDs
export const SHOWCASE_PUBCHEM_CIDS: Record<string, number> = {
  acetyl_coa: 444493,
  hmg_coa: 439400,
  mevalonate: 441,
  fpp: 445483,
  amorpha_4_11_diene: 11230765,
  artemisinic_acid: 5362031,
  artemisinin: 68827,
  epi_cedrol: 91458,
  arteannuin_b: 11282394,
};
