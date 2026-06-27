// Core pathway types — PathwayNode, PathwayEdge, GeneratedPathway, and Axon enrichment

export type NodeColorMapping = "Green" | "Yellow" | "Orange" | "Red" | "Purple" | "Blue";

export type NodeType =
  | "metabolite"
  | "enzyme"
  | "gene"
  | "complex"
  | "cofactor"
  | "impurity"
  | "intermediate"
  | "unknown";

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
  | "catalyzes"
  | "produces"
  | "consumes"
  | "activates"
  | "inhibits"
  | "converts"
  | "transports"
  | "regulates"
  | "unknown";

export interface PathwayEdge {
  start: string;
  end: string;
  relationshipType?: EdgeRelationshipType;
  evidence?: string;
  confidenceScore?: number;
  direction?: "forward" | "reverse" | "bidirectional";

  // Nexus-Bio 1.1: Thermodynamic data
  predicted_delta_G_kJ_mol?: number;
  spontaneity?: string;
  yield_prediction?: string;
  thickness_mapping?: "Thick" | "Medium" | "Thin";
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

// Axon Predictive Design Agent types

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
  disclosure_phase?: "socratic" | "revealed";
}

export interface AxonEnrichedResponse {
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  bottleneck_enzymes: BottleneckEnzyme[];
  de_novo_design_strategies: DeNovoDesignStrategy[];
  axon_interaction: AxonInteraction;
}

export interface GeneratedPathway {
  project_name?: string;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  risk_report?: RiskReportEntry[];
  yield_optimization_strategies?: YieldOptimizationStrategy[];
  // Axon predictive design fields (populated by /api/analyze enrichAxonOutput)
  bottleneck_enzymes?: BottleneckEnzyme[];
  de_novo_design_strategies?: DeNovoDesignStrategy[];
  axon_interaction?: AxonInteraction;
  metadata?: {
    sourceText?: string;
    generatedAt?: string;
    modelUsed?: string;
    confidence?: "high" | "medium" | "low";
  };
}

// Helpers

export function isValidNode(node: unknown): node is Partial<PathwayNode> {
  if (!node || typeof node !== "object") return false;
  const n = node as Record<string, unknown>;
  return typeof n.id === "string" && (n.id as string).length > 0;
}

export function isValidEdge(edge: unknown): edge is PathwayEdge {
  if (!edge || typeof edge !== "object") return false;
  const e = edge as Record<string, unknown>;
  return (
    typeof e.start === "string" &&
    (e.start as string).length > 0 &&
    typeof e.end === "string" &&
    (e.end as string).length > 0
  );
}

export function sanitizeNodeId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 64);
}

// Artemisinin showcase CIDs
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
