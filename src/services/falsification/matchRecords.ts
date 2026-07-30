import type { ExperimentRecordV1 } from "../../types/experimentRecord";
import type { PredictionRecordV1 } from "../../types/predictionRecord";
import { convertOrNull, normalizeFactor } from "../instruments/unitNormalization";

/**
 * 时间点对齐后的一对 (预测, 实测)。`predicted`/`predLower`/`predUpper` 已归一到
 * 实测记录的 measurementUnit。当预测与实测的单位无法归一时，`unitNormalized`
 * 为 false 且 `aligned` 为空——compare 据此判 inconclusive（绝不 falsified）。
 */
export interface MatchedPair {
  prediction: PredictionRecordV1;
  experiment: ExperimentRecordV1;
  /** 单位是否成功归一到实测记录的 measurementUnit。 */
  unitNormalized: boolean;
  aligned: Array<{
    timeHours: number;
    predicted: number;
    observed: number;
    predLower?: number;
    predUpper?: number;
  }>;
}

// 单位归一统一走共享表（src/services/instruments/unitNormalization.ts）。行为与
// 原最小实现保持一致（相同单位恒等、质量浓度族按比例、其余 null），P0-2 配对/证伪
// 不受影响。保留原有导出（re-export + 包装）以免破坏既有引用。
export { normalizeFactor };

/** 把 `value` 从单位 `from` 归一到 `to`；无法归一时返回 null（back-compat 包装）。 */
export function normalizeUnit(value: number, from: string, to: string): number | null {
  return convertOrNull(value, from, to);
}

interface SeriesPoint {
  timeHours: number;
  value: number;
  lower?: number;
  upper?: number;
}

/** 在升序序列上做线性插值取 t 处的值；超出范围（外推）返回 null。 */
function interpolateAt(series: SeriesPoint[], t: number): { value: number; lower?: number; upper?: number } | null {
  if (series.length === 0) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (t < first.timeHours || t > last.timeHours) return null;
  for (let i = 0; i < series.length - 1; i++) {
    const a = series[i];
    const b = series[i + 1];
    if (t >= a.timeHours && t <= b.timeHours) {
      const span = b.timeHours - a.timeHours;
      const frac = span === 0 ? 0 : (t - a.timeHours) / span;
      const lerp = (x: number, y: number) => x + (y - x) * frac;
      const hasBounds =
        a.lower !== undefined && a.upper !== undefined && b.lower !== undefined && b.upper !== undefined;
      return {
        value: lerp(a.value, b.value),
        ...(hasBounds
          ? { lower: lerp(a.lower as number, b.lower as number), upper: lerp(a.upper as number, b.upper as number) }
          : {}),
      };
    }
  }
  // 单点序列且 t 恰好落在该点。
  if (series.length === 1 && t === first.timeHours) {
    return {
      value: first.value,
      ...(first.lower !== undefined && first.upper !== undefined ? { lower: first.lower, upper: first.upper } : {}),
    };
  }
  return null;
}

/** 预测与实测是否指向同一样本：construct + assay 必配；prediction 若带 batch/sample 则须一致。 */
function keysMatch(prediction: PredictionRecordV1, experiment: ExperimentRecordV1): boolean {
  if (prediction.constructId !== experiment.constructId) return false;
  if (prediction.assayType !== experiment.assayType) return false;
  if (prediction.batchId !== undefined && prediction.batchId !== experiment.batchId) return false;
  if (prediction.sampleId !== undefined && prediction.sampleId !== experiment.sampleId) return false;
  return true;
}

/**
 * 按 constructId + assayType (+ prediction 携带的 batchId/sampleId) 匹配预测与实测；
 * 时间点用线性插值对齐到实测的时间轴，单位经 normalizeUnit 归一到实测记录的 measurementUnit。
 */
export function matchPredictionsToExperiments(
  predictions: PredictionRecordV1[],
  experiments: ExperimentRecordV1[],
): MatchedPair[] {
  const pairs: MatchedPair[] = [];

  for (const prediction of predictions) {
    for (const experiment of experiments) {
      if (!keysMatch(prediction, experiment)) continue;

      // 预测序列的单位以 prediction.measurementUnit 为准；归一到实测记录单位。
      const factor = normalizeFactor(prediction.measurementUnit, experiment.measurementUnit);
      if (factor === null) {
        // 单位无法归一：产出可见的配对，但不可比 → compare 判 inconclusive。
        pairs.push({ prediction, experiment, unitNormalized: false, aligned: [] });
        continue;
      }

      const predSeries: SeriesPoint[] = [...prediction.timepoints]
        .sort((a, b) => a.timeHours - b.timeHours)
        .map((tp) => ({
          timeHours: tp.timeHours,
          value: tp.value * factor,
          ...(tp.lower !== undefined ? { lower: tp.lower * factor } : {}),
          ...(tp.upper !== undefined ? { upper: tp.upper * factor } : {}),
        }));

      const aligned: MatchedPair["aligned"] = [];
      for (const obs of experiment.timepoints) {
        // 实测点归一到实测记录的 measurementUnit（通常恒等）。
        const observed = normalizeUnit(obs.value, obs.unit, experiment.measurementUnit);
        if (observed === null) continue;
        const predicted = interpolateAt(predSeries, obs.timeHours);
        if (predicted === null) continue;
        aligned.push({
          timeHours: obs.timeHours,
          predicted: predicted.value,
          observed,
          ...(predicted.lower !== undefined ? { predLower: predicted.lower } : {}),
          ...(predicted.upper !== undefined ? { predUpper: predicted.upper } : {}),
        });
      }

      pairs.push({ prediction, experiment, unitNormalized: true, aligned });
    }
  }

  return pairs;
}
