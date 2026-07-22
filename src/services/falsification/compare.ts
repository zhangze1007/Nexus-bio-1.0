import type { ValidationThreshold } from "../../types/acceptanceCriteria";
import type { FalsificationReport, FalsificationVerdict, PointResidual } from "../../types/falsification";
import type { MatchedPair } from "./matchRecords";

const REL_ERROR_EPS = 1e-9;

function median(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** 并集去重预测与实测记录的 provenanceIds。 */
function mergeProvenance(pair: MatchedPair): string[] {
  const ids = new Set<string>();
  for (const id of pair.prediction.provenanceIds ?? []) ids.add(id);
  for (const id of pair.experiment.provenanceIds ?? []) ids.add(id);
  return [...ids];
}

/**
 * 阈值是否真正“预登记”并适用于本配对：construct/assay 一致，且 registeredAt 早于
 * 实验 startedAt。任一不满足 → 视为无有效阈值（只能 inconclusive），防止事后判定。
 */
function criteriaApplies(pair: MatchedPair, criteria: ValidationThreshold): boolean {
  if (criteria.constructId !== pair.experiment.constructId) return false;
  if (criteria.assayType !== pair.experiment.assayType) return false;
  const registered = Date.parse(criteria.registeredAt);
  const started = Date.parse(pair.experiment.startedAt);
  if (Number.isNaN(registered) || Number.isNaN(started)) return false;
  return registered < started;
}

/**
 * 计算残差 / RMSE / MAE / 区间覆盖 / 中位相对误差，并对照预登记阈值判定 verdict。
 *
 * verdict 规则：
 *   有有效预登记阈值 且 有对齐点 且 单位已归一：
 *     medianRelError ≤ maxRelativeError 且 intervalCoverage ≥ minIntervalCoverage → corroborated
 *     任一超限 → falsified
 *   否则（无阈值 / 阈值非预登记 / 时间点不足 / 单位无法归一） → inconclusive
 */
export function compareToFalsification(pair: MatchedPair, criteria?: ValidationThreshold): FalsificationReport {
  const residuals: PointResidual[] = pair.aligned.map((p) => {
    const absError = Math.abs(p.predicted - p.observed);
    const relError = absError / Math.max(Math.abs(p.observed), REL_ERROR_EPS);
    const withinInterval =
      p.predLower !== undefined && p.predUpper !== undefined && p.observed >= p.predLower && p.observed <= p.predUpper;
    return { timeHours: p.timeHours, predicted: p.predicted, observed: p.observed, absError, relError, withinInterval };
  });

  const absErrors = residuals.map((r) => r.absError);
  const rmse = residuals.length === 0 ? 0 : Math.sqrt(mean(absErrors.map((e) => e * e)));
  const mae = residuals.length === 0 ? 0 : mean(absErrors);
  const medianRelError = residuals.length === 0 ? 0 : median(residuals.map((r) => r.relError));
  const intervalCoverage = residuals.length === 0 ? 0 : mean(residuals.map((r) => (r.withinInterval ? 1 : 0)));

  const validCriteria = criteria !== undefined && criteriaApplies(pair, criteria);
  const comparable = validCriteria && pair.unitNormalized && residuals.length > 0;

  let verdict: FalsificationVerdict;
  let notes: string | undefined;
  if (!comparable) {
    verdict = "inconclusive";
    if (!pair.unitNormalized) {
      notes = `Prediction unit "${pair.prediction.measurementUnit}" could not be normalized to experiment unit "${pair.experiment.measurementUnit}".`;
    } else if (!validCriteria) {
      notes = "No pre-registered acceptance criteria apply; cannot judge (prevents post-hoc corroboration).";
    } else {
      notes = "Insufficient overlapping timepoints to compare.";
    }
  } else {
    const relOk = medianRelError <= (criteria as ValidationThreshold).maxRelativeError;
    const coverageOk = intervalCoverage >= (criteria as ValidationThreshold).minIntervalCoverage;
    verdict = relOk && coverageOk ? "corroborated" : "falsified";
  }

  const provenance = mergeProvenance(pair);

  return {
    schemaVersion: "falsification-report-v1",
    reportId: `fal-${pair.prediction.predictionId}-${pair.experiment.recordId}`,
    predictionId: pair.prediction.predictionId,
    experimentRecordId: pair.experiment.recordId,
    constructId: pair.experiment.constructId,
    assayType: pair.experiment.assayType,
    sourceToolId: pair.prediction.sourceToolId,
    ...(validCriteria ? { criteriaId: (criteria as ValidationThreshold).criteriaId } : {}),
    residuals,
    rmse,
    mae,
    intervalCoverage,
    medianRelError,
    verdict,
    createdAt: new Date().toISOString(),
    ...(provenance.length > 0 ? { sourceProvenanceIds: provenance } : {}),
    ...(notes ? { notes } : {}),
  };
}
