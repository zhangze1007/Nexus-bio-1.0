export interface DBTLLearnedMetrics {
  drainPercent?: number;
  doRmse?: number;
  cfpsConfidence?: number;
  bindingKdUM?: number;
  yieldChangePercent?: number;
  growthPenaltyPercent?: number;
  confidenceScore?: number;
  /** CETHX: Gibbs free energy (kJ/mol) of the pathway. */
  gibbsFreeEnergy?: number;
  /** CETHX: thermodynamic efficiency (0-1). */
  thermoEfficiency?: number;
  /** CETHX: temperature used for thermodynamic analysis (deg C). */
  thermoTempC?: number;
}

export interface DBTLMetricSource {
  experimentRecordId?: string;
  sourceExperimentRecordIds?: string[];
  provenanceEntryId?: string;
  derivedFromToolId: string;
  derivedAt: string;
  notes?: string;
}

export interface DBTLLearnedFeedback {
  learnedMetrics: DBTLLearnedMetrics;
  sources: DBTLMetricSource[];
  legacyText?: string[];
  schemaVersion: "dbtl-feedback-v1";
}
