// ── Core pathway types ──────────────────────────────────────────────

export interface PathwayNode {
  // Required (existing)
  id: string;
  label: string;
  position: [number, number, number];
  summary: string;
  citation: string;
  color: string;

  // Extended — scientific credibility layer (optional for backward compat)
  canonicalLabel?: string;          // IUPAC or standard biochemical name
  nodeType?: NodeType;              // metabolite | enzyme | gene | complex | cofactor
  evidenceSnippet?: string;         // Direct quote or paraphrase from source
  confidenceScore?: number;         // 0–1, derived from pLDDT or AI confidence
  ecNumber?: string;                // Enzyme Commission number if applicable
  chebiId?: string;                 // ChEBI identifier for metabolites
  uniprotId?: string;               // UniProt ID for proteins/enzymes
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

  // Extended (optional)
  relationshipType?: EdgeRelationshipType;
  evidence?: string;                // Supporting text from literature
  confidenceScore?: number;         // 0–1
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
