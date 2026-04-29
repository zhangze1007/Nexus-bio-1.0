export interface DBTLLearnedMetrics {
  drainPercent?: number;
  doRmse?: number;
  cfpsConfidence?: number;
  bindingKdUM?: number;
  yieldChangePercent?: number;
  growthPenaltyPercent?: number;
  confidenceScore?: number;
}

export interface DBTLMetricSource {
  experimentRecordId?: string;
  provenanceEntryId?: string;
  derivedFromToolId: string;
  derivedAt: string;
  notes?: string;
}

export interface DBTLLearnedFeedback {
  learnedMetrics: DBTLLearnedMetrics;
  sources: DBTLMetricSource[];
  legacyText?: string[];
  schemaVersion: 'dbtl-feedback-v1';
}
