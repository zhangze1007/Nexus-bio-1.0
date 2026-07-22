import { ASSAY_TYPES, type AssayType, type ExperimentRecordQcFlag, type ExperimentRecordV1 } from "../../types/experimentRecord";
import type { AssayPull } from "./benchlingClient";

function coerceAssayType(value: string): AssayType {
  return (ASSAY_TYPES as readonly string[]).includes(value) ? (value as AssayType) : "other";
}

/**
 * Identity + provenance context for a pulled result. `batchId`/`sampleId`/
 * `constructId` come from the P1-1 manifest join (or entityMap); the caller
 * resolves them before calling.
 */
export interface AssayRecordContext {
  batchId: string;
  sampleId: string;
  constructId: string;
  designProvenanceIds: string[];
  sourceFileId?: string;
  instrument?: string;
  operator?: string;
}

/**
 * LIMS pull → typed ExperimentRecordV1 (sourceType `wet-lab`).
 *
 * provenanceIds is FORCED: when the design-provenance chain is empty the record
 * is flagged `manual-review-required` (still a valid record, but held out of
 * falsification/learning by the QC gate) rather than being silently accepted.
 * Each timepoint carries the record's measurementUnit so validateExperimentRecordV1
 * passes (it requires timepoint.unit === measurementUnit).
 */
export function assayPullToExperimentRecord(pull: AssayPull, ctx: AssayRecordContext): ExperimentRecordV1 {
  const hasProvenance = ctx.designProvenanceIds.length > 0;
  const qcFlags: ExperimentRecordQcFlag[] = hasProvenance ? ["passed"] : ["manual-review-required"];
  const unit = pull.unit;

  return {
    schemaVersion: "experiment-record-v1",
    recordId: `lims-${pull.externalId}-${ctx.batchId}-${ctx.sampleId}`,
    batchId: ctx.batchId,
    sampleId: ctx.sampleId,
    constructId: ctx.constructId,
    assayType: coerceAssayType(pull.assayType),
    sourceType: "wet-lab",
    measurementUnit: unit,
    instrument: pull.instrument ?? ctx.instrument ?? "lims-import",
    operator: pull.operator ?? ctx.operator ?? "lims-import",
    startedAt: pull.startedAt,
    ...(pull.completedAt ? { completedAt: pull.completedAt } : {}),
    timepoints: pull.timepoints.map((tp) => ({ timeHours: tp.timeHours, value: tp.value, unit })),
    qcFlags,
    ...(ctx.sourceFileId ? { sourceFileId: ctx.sourceFileId } : {}),
    ...(hasProvenance ? { provenanceIds: [...ctx.designProvenanceIds] } : {}),
    ...(hasProvenance ? {} : { notes: "No design provenance linked; flagged for manual review." }),
  };
}
