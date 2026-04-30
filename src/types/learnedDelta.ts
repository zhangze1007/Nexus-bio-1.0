import type { DBTLLearnedMetrics } from './dbtlFeedback';

export const LEARNED_DELTA_CLASSIFICATIONS = [
  'restorative',
  'conservative',
  'exploratory',
  'aggressive',
] as const;

export type LearnedDeltaClassification = (typeof LEARNED_DELTA_CLASSIFICATIONS)[number];

export const LEARNED_DELTA_HUMAN_GATE_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const;

export type LearnedDeltaHumanGateStatus = (typeof LEARNED_DELTA_HUMAN_GATE_STATUSES)[number];

export interface NumericDelta {
  before: number;
  after: number;
  unit?: string;
  rationale?: string;
}

export interface BoundDelta {
  before: [number, number];
  after: [number, number];
  unit?: string;
  rationale?: string;
}

export interface LearnedDeltaPack {
  schemaVersion: 'learned-delta-pack-v1';
  deltaPackId: string;
  iteration: number;
  sourceDbtlRunId: string;
  sourceExperimentRecordIds: string[];
  sourceProvenanceIds: string[];
  targetToolIds: string[];
  changedBounds: Record<string, BoundDelta>;
  changedPriors: Record<string, NumericDelta>;
  changedWeights: Record<string, NumericDelta>;
  learnedMetrics: DBTLLearnedMetrics;
  classification: LearnedDeltaClassification;
  humanGateStatus: LearnedDeltaHumanGateStatus;
  createdAt: string;
  createdBy?: string;
  notes?: string;
}
