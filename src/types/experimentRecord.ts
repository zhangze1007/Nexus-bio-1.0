export const ASSAY_TYPES = [
  'fluorescence',
  'absorbance',
  'product-titer',
  'growth-rate',
  'protein-expression',
  'cell-free-expression',
  'enzyme-activity',
  'stability',
  'other',
] as const;

export type AssayType = (typeof ASSAY_TYPES)[number];

export const EXPERIMENT_RECORD_SOURCE_TYPES = [
  'wet-lab',
  'simulated-assay',
  'historical-dataset',
  'manual-entry',
  'imported-csv',
] as const;

export type ExperimentRecordSourceType = (typeof EXPERIMENT_RECORD_SOURCE_TYPES)[number];

export const EXPERIMENT_RECORD_QC_FLAGS = [
  'passed',
  'missing-unit',
  'missing-timepoint',
  'instrument-missing',
  'operator-missing',
  'outlier',
  'failed-control',
  'manual-review-required',
] as const;

export type ExperimentRecordQcFlag = (typeof EXPERIMENT_RECORD_QC_FLAGS)[number];

export interface ExperimentTimepoint {
  timeHours: number;
  value: number;
  unit: string;
  qcFlags?: ExperimentRecordQcFlag[];
  replicateId?: string;
}

export interface ExperimentRecordV1 {
  schemaVersion: 'experiment-record-v1';
  recordId: string;
  batchId: string;
  sampleId: string;
  constructId: string;
  assayType: AssayType;
  sourceType: ExperimentRecordSourceType;
  measurementUnit: string;
  instrument: string;
  operator: string;
  startedAt: string;
  completedAt?: string;
  timepoints: ExperimentTimepoint[];
  qcFlags: ExperimentRecordQcFlag[];
  sourceFileId?: string;
  provenanceIds?: string[];
  notes?: string;
}
