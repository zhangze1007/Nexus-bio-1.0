xport interface PathwayNode {
  id: string;
  label: string;
  canonicalLabel?: string;
  position: [number, number, number];
  nodeType?: string;
  summary?: string;
  confidenceScore?: number;
  molecularStructure?: string;
  evidenceSnippet?: string;
  citation?: string;
  ecNumber?: string;
  chebiId?: string;
  uniprotId?: string;
  pubchemCID?: string;
  color?: string;
}

export interface PathwayEdge {
  start: string;
  end: string;
  relationshipType?: string;
  direction?: 'forward' | 'reverse' | 'bidirectional';
  confidenceScore?: number;
}

export type NodeType = 'metabolite' | 'enzyme' | 'gene' | 'complex' | 'cofactor' | 'unknown';
export type EdgeRelationshipType = 'catalyzes' | 'produces' | 'consumes' | 'activates' | 'inhibits' | 'converts' | 'transports' | 'regulates' | 'unknown';

export const SHOWCASE_PUBCHEM_CIDS: Record<string, string> = {
  acetyl_coa: '444493',
  hmg_coa: '446059',
  mevalonate: '439610',
  fpp: '445012',
  amorpha_4_11_diene: '10142942',
  artemisinic_acid: '11667468',
  artemisinin: '68827',
};

export function sanitizeNodeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

export function isValidNode(node: any): node is PathwayNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    typeof node.id === 'string' &&
    typeof node.label === 'string' &&
    Array.isArray(node.position) &&
    node.position.length === 3 &&
    node.position.every((n: any) => typeof n === 'number')
  );
}

export function isValidEdge(edge: any): edge is PathwayEdge {
  return (
    typeof edge === 'object' &&
    edge !== null &&
    typeof edge.start === 'string' &&
    typeof edge.end === 'string'
  );
}
