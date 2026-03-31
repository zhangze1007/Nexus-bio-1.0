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

// ── MODULE: PROEVOL ───────────────────────────────────────────────────────────
export interface Mutation { position: number; from: string; to: string; ddG?: number; }
export interface FitnessPoint { mutationCount: number; fitness: number; sequence: string; }

// ── MODULE: GECAIR ────────────────────────────────────────────────────────────
export type GeneticPartType = 'promoter' | 'rbs' | 'cds' | 'terminator';
export interface GeneticPart { id: string; type: GeneticPartType; strength?: number; label?: string; }
export interface CircuitNode { id: string; parts: GeneticPart[]; outputLevel?: number; }

// ── MODULE: DYNCON ────────────────────────────────────────────────────────────
export interface ODEState { time: number; biomass: number; substrate: number; product: number; dissolvedO2: number; }
export interface ControllerParams { kp: number; ki: number; kd: number; setpoint: number; }

// ── MODULE: DBTLflow ──────────────────────────────────────────────────────────
export interface DBTLIteration {
  id: number;
  phase: 'Design' | 'Build' | 'Test' | 'Learn';
  hypothesis: string;
  result: number;
  unit: string;
  passed: boolean;
  notes?: string;
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
