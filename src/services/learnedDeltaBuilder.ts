import type { DBTLLearnedMetrics } from "../types/dbtlFeedback";
import type { BoundDelta, LearnedDeltaClassification, LearnedDeltaPack, NumericDelta } from "../types/learnedDelta";

export interface BuildLearnedDeltaPackInput {
  deltaPackId: string;
  iteration: number;
  sourceDbtlRunId: string;
  sourceExperimentRecordIds: string[];
  sourceProvenanceIds?: string[];
  targetToolIds: string[];
  changedBounds?: Record<string, BoundDelta>;
  changedPriors?: Record<string, NumericDelta>;
  changedWeights?: Record<string, NumericDelta>;
  learnedMetrics: DBTLLearnedMetrics;
  classification?: LearnedDeltaClassification;
  createdAt: string;
  createdBy?: string;
  notes?: string;
}

export function buildLearnedDeltaPack(input: BuildLearnedDeltaPackInput): LearnedDeltaPack {
  return {
    schemaVersion: "learned-delta-pack-v1",
    deltaPackId: input.deltaPackId,
    iteration: input.iteration,
    sourceDbtlRunId: input.sourceDbtlRunId,
    sourceExperimentRecordIds: [...input.sourceExperimentRecordIds],
    sourceProvenanceIds: input.sourceProvenanceIds ? [...input.sourceProvenanceIds] : [],
    targetToolIds: [...input.targetToolIds],
    changedBounds: input.changedBounds ? { ...input.changedBounds } : {},
    changedPriors: input.changedPriors ? { ...input.changedPriors } : {},
    changedWeights: input.changedWeights ? { ...input.changedWeights } : {},
    learnedMetrics: { ...input.learnedMetrics },
    classification: input.classification ?? "conservative",
    humanGateStatus: "pending",
    createdAt: input.createdAt,
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
}
