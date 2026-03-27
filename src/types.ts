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

// Validation helpers
export function isValidNode(node: any): node is Partial<PathwayNode> {
  if (!node || typeof node !== 'object') return false;
  return typeof node.id === 'string' && node.id.length > 0;
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
};
