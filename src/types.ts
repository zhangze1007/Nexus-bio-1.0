// ── Core pathway types ──────────────────────────────────────────────

export interface PathwayNode {
  id: string;
  label: string;
  position: [number, number, number];
  summary: string;
  citation: string;
  color: string;

  // Scientific credibility layer (optional)
  canonicalLabel?: string;
  nodeType?: NodeType;
  evidenceSnippet?: string;
  confidenceScore?: number;
  ecNumber?: string;
  chebiId?: string;
  uniprotId?: string;

  // Molecular structure (optional — enables real atom/bond rendering)
  molecularStructure?: MolecularStructure;
  smiles?: string;
  molecule3dUrl?: string;
  renderStyle?: RenderStyle;
}

export type NodeType =
  | 'metabolite'
  | 'enzyme'
  | 'gene'
  | 'complex'
  | 'cofactor'
  | 'unknown';

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

// ── Molecular structure types ─────────────────────────────────────────

export interface MolecularAtom {
  element: string;
  position: [number, number, number];
  charge?: number;
  label?: string;
}

export interface MolecularBond {
  from: number;  // index into atoms array
  to: number;
  order?: 1 | 2 | 3;  // single, double, triple
}

export interface MolecularStructure {
  atoms: MolecularAtom[];
  bonds?: MolecularBond[];
  optimized?: boolean;  // true = energy-minimized 3D conformer
}

export type RenderStyle = 'glyph' | 'molecular' | 'auto';

// ── Search types ──────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  title: string;
  extract: string;
  sourceLink: string;
  keywords: string[];
}

// ── Generated pathway ─────────────────────────────────────────────────

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
