import type { DBTLLearnedMetrics } from "../../types/dbtlFeedback";
import type { FalsificationReport } from "../../types/falsification";
import type { NumericDelta } from "../../types/learnedDelta";
import { PRIMARY_PRIOR_KEY } from "../../config/seedFieldRegistry";
import type { BuildLearnedDeltaPackInput } from "../learnedDeltaBuilder";

const REL_ERROR_EPS = 1e-9;
/** 换算系数（before=1 的乘性修正）夹在此物理合理区间内，避免非有限/极端值。 */
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

/**
 * “残差方向 → 先验字段 / 阻尼” 映射表（首批覆盖 cellfree / fbasim / dyncon）。
 * `correlation = +1` 表示该先验与被预测量正相关：系统性高估 ⇒ 下调该先验。
 * 提案是对该先验的乘性修正（before=1 → after=scale），不臆造绝对旋钮值。
 */
interface PriorMapEntry {
  correlation: 1 | -1;
  rationale: string;
}

// priorKey is NOT stored here — it comes from PRIMARY_PRIOR_KEY (seedFieldRegistry),
// the single key source shared with the P2-1 application layer (P2-1.0 reconciliation),
// so proposals always target a real, whitelisted seed field.
const PRIOR_MAP: Record<string, PriorMapEntry> = {
  cellfree: {
    correlation: 1,
    rationale: "Cell-free expression scales with the ribosome budget; systematic over-prediction implies the ribosomeTotal prior is too high.",
  },
  fbasim: {
    correlation: 1,
    rationale: "Predicted flux scales with substrate (glucose) uptake; systematic over-prediction implies the uptake prior is too high.",
  },
  dyncon: {
    correlation: 1,
    rationale: "Controller output scales with proportional gain (kp); systematic over-prediction implies the kp prior is too high.",
  },
};

function median(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? Number.NaN : xs.reduce((s, x) => s + x, 0) / xs.length;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** 由残差重算带符号相对误差：>0 系统性高估，<0 系统性低估。 */
function signedRelErrors(report: FalsificationReport): number[] {
  return report.residuals.map((r) => (r.predicted - r.observed) / Math.max(Math.abs(r.observed), REL_ERROR_EPS));
}

/**
 * 由证伪结果推导“待审” delta 提案：仅 falsified 且工具在映射表内的报告参与。
 * 对每个工具，按其残差的带符号中位相对误差、经阻尼计算乘性修正 scale，
 * 生成 changedPriors。返回的 input 交给现有 buildLearnedDeltaPack()，
 * 天然 humanGateStatus: "pending"。无可行动报告时返回 null。
 */
export function proposeDeltaFromFalsification(
  reports: FalsificationReport[],
  opts: { sourceDbtlRunId: string; iteration: number; damping?: number },
): BuildLearnedDeltaPackInput | null {
  const damping = clamp(opts.damping ?? 0.5, 0, 1);

  const actionable = reports.filter(
    (r) =>
      r.verdict === "falsified" && PRIOR_MAP[r.sourceToolId] !== undefined && PRIMARY_PRIOR_KEY[r.sourceToolId] !== undefined,
  );
  if (actionable.length === 0) return null;

  const byTool = new Map<string, FalsificationReport[]>();
  for (const r of actionable) {
    const list = byTool.get(r.sourceToolId) ?? [];
    list.push(r);
    byTool.set(r.sourceToolId, list);
  }

  const changedPriors: Record<string, NumericDelta> = {};
  const experimentIds = new Set<string>();
  const provenanceIds = new Set<string>();
  const targetToolIds: string[] = [];
  const rmseValues: number[] = [];
  const coverageValues: number[] = [];

  for (const [toolId, toolReports] of byTool) {
    const entry = PRIOR_MAP[toolId];
    const priorKey = PRIMARY_PRIOR_KEY[toolId];
    const allSigned = toolReports.flatMap(signedRelErrors);
    const signedMedian = allSigned.length === 0 ? 0 : median(allSigned);
    const scale = clamp(1 - entry.correlation * damping * signedMedian, MIN_SCALE, MAX_SCALE);

    changedPriors[priorKey] = {
      before: 1,
      after: scale,
      unit: "relative-scale",
      rationale: `${entry.rationale} Signed median relative error ${signedMedian.toFixed(4)}, damping ${damping} → multiplicative correction ${scale.toFixed(4)}.`,
    };

    targetToolIds.push(toolId);
    for (const r of toolReports) {
      experimentIds.add(r.experimentRecordId);
      for (const id of r.sourceProvenanceIds ?? []) provenanceIds.add(id);
      rmseValues.push(r.rmse);
      coverageValues.push(r.intervalCoverage);
    }
  }

  const meanRmse = mean(rmseValues);
  const meanCoverage = mean(coverageValues);
  const learnedMetrics: DBTLLearnedMetrics = {
    ...(Number.isFinite(meanRmse) ? { doRmse: meanRmse } : {}),
    ...(Number.isFinite(meanCoverage) ? { confidenceScore: meanCoverage } : {}),
  };

  return {
    deltaPackId: `delta-fal-${opts.sourceDbtlRunId}-it${opts.iteration}`,
    iteration: opts.iteration,
    sourceDbtlRunId: opts.sourceDbtlRunId,
    sourceExperimentRecordIds: [...experimentIds],
    sourceProvenanceIds: [...provenanceIds],
    targetToolIds: [...new Set(targetToolIds)],
    changedPriors,
    learnedMetrics,
    // 证伪驱动的修正是把模型拉回实测，归类为 restorative。
    classification: "restorative",
    createdAt: new Date().toISOString(),
    notes: `Auto-proposed from ${actionable.length} falsified report(s) across ${byTool.size} tool(s); awaiting human gate.`,
  };
}
