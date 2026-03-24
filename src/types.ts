export type NodeType =
  | 'metabolite'
  | 'enzyme'
  | 'gene'
  | 'complex'
  | 'cofactor'
  | 'unknown';

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

export interface PathwayNode {
  id: string;
  label: string;
  canonicalLabel?: string;

  position: [number, number, number];
  color: string;

  nodeType?: NodeType;
  summary?: string;
  citation?: string;
  evidenceSnippet?: string;

  confidenceScore?: number;

  // Molecular / structure metadata
  smiles?: string;
  molecule3dUrl?: string;
  molBlock?: string;

  // External identifiers
  ecNumber?: string;
  chebiId?: string;
  uniprotId?: string;
  pubchemCID?: number | string;
}

export interface PathwayEdge {
  start: string;
  end: string;
  relationshipType?: EdgeRelationshipType;
  direction?: 'forward' | 'reverse' | 'bidirectional';
  confidenceScore?: number;
  evidence?: string;
}

export const SHOWCASE_PUBCHEM_CIDS: Record<string, number> = {
  acetyl_coa: 444493,
  hmg_coa: 445014,
  mevalonate: 750,
  fpp: 123730,
  amorpha_4_11_diene: 5281781,
  artemisinic_acid: 68934,
  artemisinin: 68827,
  pyruvate: 1060,
  glucose: 5793,
  ethanol: 702,
};
