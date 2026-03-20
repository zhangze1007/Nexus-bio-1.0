// ── Core pathway types ──────────────────────────────────────────────

export interface PathwayNode {
  // Required (existing)
  id: string;
  label: string;
  position: [number, number, number];
  summary: string;
  citation: string;
  color: string;

  // ── Scientific identity layer ──
  canonicalLabel?: string;          // IUPAC / standard biochemical name
  nodeType?: NodeType;

  // ── Database identifiers ──
  chebiId?: string;                // metabolite
  pubchemCid?: string;             // 🔥 NEW
  smiles?: string;                 // 🔥 CORE: SMILES string
  inchi?: string;                  // optional chemical encoding

  uniprotId?: string;              // protein
  pdbId?: string;                  // 🔥 for enzyme 3D structure
  ecNumber?: string;

  // ── Structural data (关键升级) ──
  structure3D?: MolecularStructure;   // 🔥 REAL 3D geometry
  structure2D?: string;               // SVG / MOL block

  // ── AI / confidence ──
  confidenceScore?: number;
  evidenceSnippet?: string;

  // ── Rendering hints ──
  renderStyle?: RenderStyle;          // 🔥 sphere | stick | surface
  sizeScale?: number;
}


// ── Molecular 3D representation ─────────────────────────────────────

export interface MolecularStructure {
  atoms: Atom[];
  bonds: Bond[];
  format?: 'mol' | 'sdf' | 'pdb';

  // geometry quality
  optimized?: boolean;               // geometry optimization done?
}

export interface Atom {
  element: string;                   // C, H, O, N...
  position: [number, number, number];
}

export interface Bond {
  from: number;                      // atom index
  to: number;
  order: 1 | 2 | 3;                  // single/double/triple
}


// ── Rendering modes (VERY IMPORTANT) ────────────────────────────────

export type RenderStyle =
  | 'sphere'        // space-filling (CPK)
  | 'stick'         // bonds
  | 'ball-stick'    // hybrid
  | 'surface';      // protein-like


// ── Node classification ─────────────────────────────────────────────

export type NodeType =
  | 'metabolite'
  | 'enzyme'
  | 'gene'
  | 'complex'
  | 'cofactor'
  | 'unknown';


// ── Edges ───────────────────────────────────────────────────────────

export interface PathwayEdge {
  start: string;
  end: string;

  relationshipType?: EdgeRelationshipType;
  evidence?: string;
  confidenceScore?: number;

  direction?: 'forward' | 'reverse' | 'bidirectional';

  // 🔥 Flow strength / flux (future simulation)
  flux?: number;
}


// ── Edge relationships ──────────────────────────────────────────────

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


// ── Search types ─────────────────────────────────────────────────────

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

  return typeof n.id === 'string' &&
    typeof n.label === 'string';
}

export function isValidEdge(edge: unknown): edge is PathwayEdge {
  if (!edge || typeof edge !== 'object') return false;
  const e = edge as Record<string, unknown>;

  return typeof e.start === 'string' &&
    typeof e.end === 'string';
}

export function sanitizeNodeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 64);
}
