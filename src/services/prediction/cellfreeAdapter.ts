import type { AssayType } from "../../types/experimentRecord";
import type { PredictionRecordV1, PredictionTimepoint } from "../../types/predictionRecord";
import { registerPredictionAdapter, type ToolPredictionAdapter } from "./predictionAdapters";
import { analyticInterval, intervalFromEnsemble, monteCarloEnsemble } from "./uncertainty";

/**
 * Workbench payload the cellfree tool emits for the prediction contract: a
 * predicted expression/titer time series for one construct, in one unit, plus
 * optional uncertainty inputs. This is the boundary the cellfree simulation
 * writes to — it does NOT change the cellfree engine's algorithm.
 */
export interface CellFreePredictionPayload {
  constructId: string;
  /** Defaults to "cell-free-expression"; set "product-titer" to match a titer assay. */
  assayType?: AssayType;
  measurementUnit: string;
  /** Predicted point-estimate time series (time axis must align with the wet-lab assay). */
  series: { timeHours: number; value: number }[];
  batchId?: string;
  sampleId?: string;
  /** Relative std of each point (e.g. 0.1 = 10%). Drives the interval when > 0. */
  relStd?: number;
  /** When true and relStd > 0, derive intervals from a SEEDED Monte-Carlo ensemble. */
  useMonteCarlo?: boolean;
  seed?: number;
  mcDraws?: number;
  intervalLevel?: number;
  provenanceIds?: string[];
}

const DEFAULT_SEED = 42;
const DEFAULT_LEVEL = 0.9;

export const cellFreePredictionAdapter: ToolPredictionAdapter<CellFreePredictionPayload> = {
  toolId: "cellfree",
  toPrediction(payload, ctx): PredictionRecordV1 | null {
    if (!payload || !Array.isArray(payload.series) || payload.series.length === 0) return null;
    if (!payload.constructId || !payload.measurementUnit) return null;

    const level = payload.intervalLevel ?? DEFAULT_LEVEL;
    const relStd = payload.relStd ?? 0;
    const useMc = Boolean(payload.useMonteCarlo) && relStd > 0;
    const seed = payload.seed ?? DEFAULT_SEED;
    const unit = payload.measurementUnit;

    let method: PredictionRecordV1["method"];
    let timepoints: PredictionTimepoint[];

    if (useMc) {
      method = "monte-carlo";
      const samples = monteCarloEnsemble(payload.series, relStd, seed, payload.mcDraws ?? 200);
      const byTime = new Map<number, typeof samples>();
      for (const s of samples) {
        const arr = byTime.get(s.timeHours) ?? [];
        arr.push(s);
        byTime.set(s.timeHours, arr);
      }
      timepoints = payload.series.map((pt) => {
        const iv = intervalFromEnsemble(
          byTime.get(pt.timeHours) ?? [{ timeHours: pt.timeHours, value: pt.value }],
          level,
        );
        return {
          timeHours: pt.timeHours,
          value: pt.value,
          unit,
          lower: iv.lower,
          upper: iv.upper,
          intervalLevel: level,
        };
      });
    } else if (relStd > 0) {
      method = "analytic-ci";
      timepoints = payload.series.map((pt) => {
        const iv = analyticInterval(pt.value, pt.value * relStd, level);
        return {
          timeHours: pt.timeHours,
          value: pt.value,
          unit,
          lower: iv.lower,
          upper: iv.upper,
          intervalLevel: level,
        };
      });
    } else {
      method = "point-estimate";
      timepoints = payload.series.map((pt) => ({ timeHours: pt.timeHours, value: pt.value, unit }));
    }

    const record: PredictionRecordV1 = {
      schemaVersion: "prediction-record-v1",
      // Deterministic id — no unseeded randomness (P0-3 constraint).
      predictionId: `cellfree-${payload.constructId}-${ctx.runId}${useMc ? `-s${seed}` : ""}`,
      constructId: payload.constructId,
      assayType: payload.assayType ?? "cell-free-expression",
      measurementUnit: unit,
      sourceToolId: "cellfree",
      sourceRunId: ctx.runId,
      method,
      modelVersion: ctx.modelVersion,
      timepoints,
      ...(payload.batchId ? { batchId: payload.batchId } : {}),
      ...(payload.sampleId ? { sampleId: payload.sampleId } : {}),
      ...(useMc ? { seed } : {}),
      ...(payload.provenanceIds ? { provenanceIds: payload.provenanceIds } : {}),
    };
    return record;
  },
};

/** Register the cellfree adapter into the shared registry. */
export function registerCellFreeAdapter(): void {
  registerPredictionAdapter(cellFreePredictionAdapter);
}

// Convenience: importing this module registers the adapter for app wiring.
registerCellFreeAdapter();
