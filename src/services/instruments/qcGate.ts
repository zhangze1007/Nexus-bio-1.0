import type { ExperimentRecordQcFlag, ExperimentRecordV1 } from "../../types/experimentRecord";

/**
 * QC flags that HARD-BLOCK a record from entering P0-2 falsification and P2
 * learning. A record carrying any of these must not influence a wet-lab
 * decision until a human resolves it.
 */
export const LEARN_GATE_BLOCKING_FLAGS: ExperimentRecordQcFlag[] = [
  "failed-control",
  "manual-review-required",
  "missing-unit",
];

/**
 * Learn gate: only records that clear it may feed falsification/learning.
 * Returns the blocking flags so callers can surface WHY a record was held.
 */
export function passesLearnGate(record: ExperimentRecordV1): { ok: boolean; blockedBy: ExperimentRecordQcFlag[] } {
  const blockedBy = record.qcFlags.filter((f) => LEARN_GATE_BLOCKING_FLAGS.includes(f));
  return { ok: blockedBy.length === 0, blockedBy };
}

/** Keep only records that clear the learn gate — call upstream of matchRecords/learning. */
export function filterLearnableRecords(records: ExperimentRecordV1[]): ExperimentRecordV1[] {
  return records.filter((r) => passesLearnGate(r).ok);
}
