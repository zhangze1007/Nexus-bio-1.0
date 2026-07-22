import * as fs from "fs";
import * as path from "path";
import type { PredictionRecordV1 } from "../../src/types/predictionRecord";
import { validatePredictionRecordV1 } from "../../src/validation/predictionRecordValidator";
import {
  cellFreePredictionAdapter,
  type CellFreePredictionPayload,
} from "../../src/services/prediction/cellfreeAdapter";

const example = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "examples", "experiment-records", "valid-wet-lab-like.json"), "utf8"),
) as { constructId: string; assayType: string; measurementUnit: string; timepoints: { timeHours: number }[] };

const CTX = { runId: "run-p01-test", modelVersion: "cellfree@test" };

/** A cellfree payload aligned to the example wet-lab record (same construct/assay/unit/time axis). */
function alignedPayload(overrides: Partial<CellFreePredictionPayload> = {}): CellFreePredictionPayload {
  return {
    constructId: example.constructId,
    assayType: example.assayType as CellFreePredictionPayload["assayType"],
    measurementUnit: example.measurementUnit,
    series: example.timepoints.map((tp, i) => ({ timeHours: tp.timeHours, value: [1.2, 40.0][i] ?? 10 })),
    ...overrides,
  };
}

describe("PredictionRecordV1", () => {
  it("validates a well-formed record", () => {
    const rec = cellFreePredictionAdapter.toPrediction(alignedPayload({ relStd: 0.1 }), CTX);
    expect(rec).not.toBeNull();
    const result = validatePredictionRecordV1(rec);
    expect(result.ok).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("flags inverted interval (lower > upper)", () => {
    const rec: PredictionRecordV1 = {
      schemaVersion: "prediction-record-v1",
      predictionId: "p-inv",
      constructId: "c1",
      assayType: "product-titer",
      measurementUnit: "mg/L",
      sourceToolId: "cellfree",
      sourceRunId: "r1",
      method: "analytic-ci",
      modelVersion: "v1",
      timepoints: [{ timeHours: 4, value: 40, unit: "mg/L", lower: 50, upper: 30, intervalLevel: 0.9 }],
    };
    const result = validatePredictionRecordV1(rec);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("interval-inverted");
  });

  it("flags missing unit and empty timepoints as errors (acceptance)", () => {
    const noUnit = validatePredictionRecordV1({ ...alignedRecord(), measurementUnit: "" });
    expect(noUnit.issues.some((i) => i.code === "missing-unit" && i.severity === "error")).toBe(true);
    const empty = validatePredictionRecordV1({ ...alignedRecord(), timepoints: [] });
    expect(empty.issues.some((i) => i.code === "empty-timepoints" && i.severity === "error")).toBe(true);
  });

  it("cellfree adapter yields unit-consistent timepoints vs ExperimentRecordV1", () => {
    const rec = cellFreePredictionAdapter.toPrediction(alignedPayload({ relStd: 0.1 }), CTX);
    expect(rec).not.toBeNull();
    if (!rec) return;
    // structurally matchable against the wet-lab example
    expect(rec.constructId).toBe(example.constructId);
    expect(rec.assayType).toBe(example.assayType);
    expect(rec.measurementUnit).toBe(example.measurementUnit);
    // every predicted timepoint carries the record's unit, on the same time axis
    expect(rec.timepoints.map((t) => t.unit)).toEqual(rec.timepoints.map(() => example.measurementUnit));
    expect(rec.timepoints.map((t) => t.timeHours)).toEqual(example.timepoints.map((t) => t.timeHours));
    expect(validatePredictionRecordV1(rec).ok).toBe(true);
    // an empty series is not enough to produce a comparable prediction
    expect(cellFreePredictionAdapter.toPrediction(alignedPayload({ series: [] }), CTX)).toBeNull();
  });

  it("is deterministic for a fixed seed (monte-carlo), and the seed actually matters", () => {
    const mc = (seed: number) =>
      cellFreePredictionAdapter.toPrediction(alignedPayload({ relStd: 0.2, useMonteCarlo: true, seed, mcDraws: 300 }), CTX);
    const a = mc(7);
    const b = mc(7);
    const c = mc(999);
    expect(a).toEqual(b); // same seed → byte-identical record (intervals included)
    // seed is not ignored (not a decoy): different seed → different interval bounds
    const bounds = (r: PredictionRecordV1 | null) => r?.timepoints.map((t) => [t.lower, t.upper]);
    expect(bounds(a)).not.toEqual(bounds(c));
  });
});

/** A minimal valid record object (plain, for validator negative cases). */
function alignedRecord(): PredictionRecordV1 {
  const rec = cellFreePredictionAdapter.toPrediction(alignedPayload({ relStd: 0.1 }), CTX);
  if (!rec) throw new Error("fixture adapter returned null");
  return rec;
}
