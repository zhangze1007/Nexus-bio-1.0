/**
 * 预登记验收阈值（acceptance criteria）。
 *
 * 必须在实验开始前登记：`registeredAt` 早于 `ExperimentRecord.startedAt`，
 * 用于锁定判据、防止事后挑数据（post-hoc threshold tuning）。证伪引擎只在
 * 阈值确属预登记时才判 corroborated/falsified；否则一律 inconclusive。
 */
export interface ValidationThreshold {
  schemaVersion: "acceptance-criteria-v1";
  criteriaId: string;
  constructId: string;
  assayType: string;
  /** 必须早于 ExperimentRecord.startedAt，否则该实验只能得到 inconclusive。 */
  registeredAt: string;
  /** 允许的最大（中位）相对残差，如 0.5 = 50%。 */
  maxRelativeError: number;
  /** 实测落入预测区间的最低比例，如 0.8。 */
  minIntervalCoverage: number;
  registeredBy?: string;
}
