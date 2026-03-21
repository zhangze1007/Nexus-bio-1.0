// ── Core pathway types ──────────────────────────────────────────────

export interface PathwayNode {
  id: string;
  label: string;
  position: [number, number, number];
  summary: string;
  citation: string;
  color: string;

  // Scientific credibility layer
  canonicalLabel?: string;
  nodeType?: NodeType;
  evidenceSnippet?: string;
  confidenceScore?: number;
  ecNumber?: string;
  chebiId?: string;
  uniprotId?: string;

  // Molecular structure data
  pubchemCID?: number;          // PubChem Compound ID for 3D SDF fetch
  smiles?: string;              // SMILES string (metadata)
  molecularFormula?: string;
  molecularWeight?: number;
  molecularStructure?: MolecularStructure; // inline atom/bond data if available
}

export type NodeType =
  | 'metabolite'
  | 'enzyme'
  | 'gene'
  | 'complex'
  | 'cofactor'
  | 'unknown';

export interface MolecularStructure {
  atoms: MolAtom[];
  bonds: MolBond[];
  optimized?: boolean;          // true if geometry-optimized conformer
}

export interface MolAtom {
  element: string;
  position: [number, number, number];
  charge?: number;
}

export interface MolBond {
  atomIndex1: number;
  atomIndex2: number;
  order: 1 | 2 | 3;            // bond order
}

export type RenderStyle = 'stick' | 'sphere' | 'cartoon' | 'surface';

// ── Edge types ──────────────────────────────────────────────────────

export interface PathwayEdge {
  start: string;
  end: string;
  relationshipType?: EdgeRelationshipType;
  evidence?: string;
  confidenceScore?: number;
  direction?: 'forward' | 'reverse' | 'bidirectional';
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

// ── Search types ──────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  title: string;
  extract: string;
  sourceLink: string;
  keywords: string[];
}

// ── Pathway generation output ─────────────────────────────────────────

export interface GeneratedPathway {
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  metadata?: {
    sourceText?: string;
    generatedAt?: string;
    modelUsed?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
}

// ── Validation helpers ────────────────────────────────────────────────

export function isValidNode(node: unknown): node is Partial<PathwayNode> {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  return typeof n.id === 'string' && n.id.length > 0 &&
    typeof n.label === 'string' && n.label.length > 0;
}

export function isValidEdge(edge: unknown): edge is PathwayEdge {
  if (!edge || typeof edge !== 'object') return false;
  const e = edge as Record<string, unknown>;
  return typeof e.start === 'string' && e.start.length > 0 &&
    typeof e.end === 'string' && e.end.length > 0;
}

export function sanitizeNodeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 64);
}

// ── Artemisinin showcase molecule PubChem CIDs ────────────────────────
// Used by MoleculeViewer to fetch 3D conformers from PubChem

export const SHOWCASE_PUBCHEM_CIDS: Record<string, number> = {
  acetyl_coa:          444493,
  hmg_coa:             439400,
  mevalonate:          441,
  fpp:                 445483,
  amorpha_4_11_diene:  11230765,
  artemisinic_acid:    5362031,
  artemisinin:         68827,
};
