// ── Core pathway types ──────────────────────────────────────────────

export interface PathwayNode {
  id: string;
  label: string;
  position: [number, number, number];
  summary: string;
  citation: string;
  color: string;

  [span_2](start_span)[span_3](start_span)// Scientific & Commercial Intelligence Layer[span_2](end_span)[span_3](end_span)
  canonicalLabel?: string;
  nodeType?: NodeType;
  evidenceSnippet?: string;
  confidenceScore?: number;
  
  [span_4](start_span)// Nexus-Bio 1.1: 商业风险与合规字段[span_4](end_span)
  risk_score?: number;               // 0.0 - 1.0 风险评分
  audit_trail?: string;              [span_5](start_span)// 可验证的来源审计追踪[span_5](end_span)
  color_mapping?: NodeColorMapping;  // 驱动 3D 渲染的颜色逻辑
  thermodynamic_stability?: string;  // 热力学稳定性描述
  toxicity_impact?: string;          [span_6](start_span)// 潜在毒性评估 (商业合规关键)[span_6](end_span)
  separation_cost_index?: number;    // 分离成本指数 (0.0 - 1.0)
  
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

export type NodeType =
  | 'metabolite'
  | 'enzyme'
  | 'gene'
  | 'complex'
  | 'cofactor'
  | [span_7](start_span)'impurity'  // 新增：杂质类型[span_7](end_span)
  | 'intermediate' 
  | 'unknown';

export type NodeColorMapping = 
  | 'Green' | 'Yellow' | 'Orange' | 'Red' | 'Purple' | 'Blue';

export interface MolecularStructure {
  atoms: MolAtom[];
  bonds: MolBond[];
  optimized?: boolean;
}

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

// ── Edge types ──────────────────────────────────────────────────────

export interface PathwayEdge {
  start: string;
  end: string;
  relationshipType?: EdgeRelationshipType;
  evidence?: string;
  confidenceScore?: number;
  direction?: 'forward' | 'reverse' | 'bidirectional';
  
  [span_8](start_span)// Nexus-Bio 1.1: 热力学与产率数据[span_8](end_span)
  predicted_delta_G_kJ_mol?: number;  // 吉布斯自由能预测 (单位: kJ/mol)
  spontaneity?: string;               // 反应自发性评估
  yield_prediction?: string;          // 产率预测描述
  thickness_mapping?: 'Thick' | 'Medium' | 'Thin'; // 驱动 3D 连线厚度
  audit_trail?: string;
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

// ── 商业决策与报告类型 ──────────────────────────────────────────────

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

// ── Pathway generation output ─────────────────────────────────────────

export interface GeneratedPathway {
  project_name?: string;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  risk_report?: RiskReportEntry[];             [span_9](start_span)// 新增：杂质风险报告[span_9](end_span)
  yield_optimization_strategies?: YieldOptimizationStrategy[]; // 新增：优化策略
  metadata?: {
    sourceText?: string;
    generatedAt?: string;
    modelUsed?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
}

// ── Validation helpers ────────────────────────────────────────────────
// (保留原有验证逻辑并增强)
export function isValidNode(node: unknown): node is Partial<PathwayNode> {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  return typeof n.id === 'string' && n.id.length > 0;
}

// ── Artemisinin showcase CIDs ────────────────────────────────────────
export const SHOWCASE_PUBCHEM_CIDS: Record<string, number> = {
  acetyl_coa:          444493,
  hmg_coa:             439400,
  mevalonate:          441,
  fpp:                 445483,
  amorpha_4_11_diene:  11230765,
  artemisinic_acid:    5362031,
  artemisinin:         68827,
};
