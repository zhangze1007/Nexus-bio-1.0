import type { AssayType } from "./experimentRecord";

export const PREDICTION_METHODS = ["point-estimate", "monte-carlo", "ensemble", "analytic-ci"] as const;
export type PredictionMethod = (typeof PREDICTION_METHODS)[number];

/** 与 ExperimentTimepoint 一一对应，多出区间上下界。 */
export interface PredictionTimepoint {
  timeHours: number;
  value: number; // 预测点估计
  unit: string; // 必须与实测 unit 归一后一致
  lower?: number; // 预测区间下界（如 5%）
  upper?: number; // 预测区间上界（如 95%）
  intervalLevel?: number; // 区间置信水平，如 0.9
}

/** 预测记录：结构镜像 ExperimentRecordV1，键可与之匹配。 */
export interface PredictionRecordV1 {
  schemaVersion: "prediction-record-v1";
  predictionId: string;
  /** 关联同一实验的键；证伪引擎据此与 ExperimentRecordV1 匹配。 */
  batchId?: string;
  sampleId?: string;
  constructId: string;
  assayType: AssayType; // 复用实验记录的 assayType 枚举
  measurementUnit: string; // 预测量纲
  sourceToolId: string; // 产出该预测的工具，如 "cellfree" / "fbasim"
  sourceRunId: string; // 对应 workbench run / provenance
  method: PredictionMethod;
  modelVersion: string; // 引擎版本，保证可追溯
  seed?: number; // 若用 MC，记录随机种子（配合 P0-3）
  timepoints: PredictionTimepoint[];
  provenanceIds?: string[];
  notes?: string;
}
