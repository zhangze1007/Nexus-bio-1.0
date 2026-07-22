export type FalsificationVerdict = "corroborated" | "falsified" | "inconclusive";

export interface PointResidual {
  timeHours: number;
  predicted: number;
  observed: number;
  absError: number;
  /** |pred - obs| / max(|obs|, eps)。 */
  relError: number;
  /** 实测是否落入预测区间；无区间时为 false。 */
  withinInterval: boolean;
}

export interface FalsificationReport {
  schemaVersion: "falsification-report-v1";
  reportId: string;
  predictionId: string;
  experimentRecordId: string;
  constructId: string;
  assayType: string;
  /**
   * 产出被证伪预测的工具（取自 PredictionRecordV1.sourceToolId）。
   * 证伪→学习闭环据此把残差归因到具体工具的先验（见 toLearnedDelta 的映射表），
   * 并作为 delta pack 的 targetToolIds，因此在报告里显式携带、保证可追溯。
   */
  sourceToolId: string;
  /** 关联的预登记阈值 id（仅当阈值确属预登记时存在）。 */
  criteriaId?: string;
  residuals: PointResidual[];
  rmse: number;
  mae: number;
  /** withinInterval 的比例。 */
  intervalCoverage: number;
  medianRelError: number;
  /** 依据 criteria 判定；无有效预登记阈值时为 inconclusive。 */
  verdict: FalsificationVerdict;
  createdAt: string;
  /** 预测与实测记录的 provenance 并集，用于 delta pack 溯源（可为空）。 */
  sourceProvenanceIds?: string[];
  notes?: string;
}
