'use client';

export type EvidenceSourceType =
  | 'literature'
  | 'database'
  | 'simulation'
  | 'experimental'
  | 'ai-generated'
  | 'project-material';

export interface EvidenceRecord {
  id: string;
  label: string;
  sourceType: EvidenceSourceType;
  sourceRef?: string;
  confidence?: number;
  note?: string;
}

export interface BioEntity {
  id: string;
  label: string;
  entityType: 'metabolite' | 'enzyme' | 'gene' | 'cell' | 'pathway' | 'unknown';
  canonicalId?: string;
  externalIds?: Record<string, string | number>;
  evidence?: EvidenceRecord[];
}

export interface SimulationRun {
  id: string;
  toolId: string;
  mode: 'analysis' | 'design' | 'simulation';
  parameters: Record<string, unknown>;
  outputs: Record<string, unknown>;
  evidence?: EvidenceRecord[];
}

export interface DesignCandidate {
  id: string;
  toolId: string;
  title: string;
  rationale: string;
  targets?: string[];
  expectedOutputs?: string[];
  evidence?: EvidenceRecord[];
}
