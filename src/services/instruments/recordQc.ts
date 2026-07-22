import type { ExperimentRecordQcFlag, ExperimentRecordV1 } from "../../types/experimentRecord";

/** Replicate coefficient-of-variation above this fraction flags `outlier`. */
const CV_THRESHOLD = 0.2;

export interface RecordQcResult {
  flags: ExperimentRecordQcFlag[];
  blankCorrected: boolean;
  /** Max replicate-well coefficient of variation (undefined when no replicates). */
  replicateCV?: number;
  controlPassed: boolean;
  /** Record with blank-subtracted values and merged qcFlags (ready for the learn gate). */
  correctedRecord: ExperimentRecordV1;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

function coefficientOfVariation(xs: number[]): number | undefined {
  if (xs.length < 2) return undefined;
  const m = mean(xs);
  if (m === 0) return undefined;
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance) / Math.abs(m);
}

/** Max CV across replicate wells, grouped by timepoint. */
function maxReplicateCV(timepoints: Array<{ timeHours: number; value: number }>): number | undefined {
  const byTime = new Map<number, number[]>();
  for (const tp of timepoints) {
    const arr = byTime.get(tp.timeHours) ?? [];
    arr.push(tp.value);
    byTime.set(tp.timeHours, arr);
  }
  let max: number | undefined;
  for (const vals of byTime.values()) {
    const cv = coefficientOfVariation(vals);
    if (cv !== undefined) max = max === undefined ? cv : Math.max(max, cv);
  }
  return max;
}

/**
 * Record-level QC: blank subtraction, positive/negative control check, replicate
 * CV, and unit presence. Produces a corrected record (blank-subtracted values +
 * merged qcFlags). Pure and deterministic (no RNG).
 *
 * Rules:
 *  - blank present → subtract mean(blank) from each value (clamped ≥ 0).
 *  - positive control present and mean ≤ mean(negControl) → `failed-control`.
 *  - any replicate group CV > 20% → `outlier`.
 *  - empty measurementUnit → `missing-unit`.
 */
export function runRecordQc(
  record: ExperimentRecordV1,
  controls: { blank?: number[]; posControl?: number[]; negControl?: number[] },
): RecordQcResult {
  const flags = new Set<ExperimentRecordQcFlag>(record.qcFlags);

  const hasBlank = Array.isArray(controls.blank) && controls.blank.length > 0;
  const blankMean = hasBlank ? mean(controls.blank as number[]) : 0;
  const timepoints = record.timepoints.map((tp) => ({ ...tp, value: Math.max(0, tp.value - blankMean) }));

  const negMean = controls.negControl && controls.negControl.length > 0 ? mean(controls.negControl) : 0;
  let controlPassed = true;
  if (controls.posControl && controls.posControl.length > 0) {
    const posMean = mean(controls.posControl);
    if (posMean <= negMean) {
      controlPassed = false;
      flags.add("failed-control");
    }
  }

  const replicateCV = maxReplicateCV(timepoints);
  if (replicateCV !== undefined && replicateCV > CV_THRESHOLD) flags.add("outlier");

  if (!record.measurementUnit || record.measurementUnit.trim().length === 0) flags.add("missing-unit");

  const correctedRecord: ExperimentRecordV1 = { ...record, timepoints, qcFlags: [...flags] };

  return {
    flags: [...flags],
    blankCorrected: hasBlank,
    ...(replicateCV !== undefined ? { replicateCV } : {}),
    controlPassed,
    correctedRecord,
  };
}
