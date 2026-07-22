import type { ValidationThreshold } from "../../src/types/acceptanceCriteria";
import type { ExperimentRecordV1 } from "../../src/types/experimentRecord";
import type { PredictionRecordV1 } from "../../src/types/predictionRecord";
import { compareToFalsification } from "../../src/services/falsification/compare";
import { matchPredictionsToExperiments } from "../../src/services/falsification/matchRecords";
import { proposeDeltaFromFalsification } from "../../src/services/falsification/toLearnedDelta";
import { buildLearnedDeltaPack } from "../../src/services/learnedDeltaBuilder";
import { validateLearnedDeltaPack } from "../../src/validation/learnedDeltaValidator";

function prediction(overrides: Partial<PredictionRecordV1> = {}): PredictionRecordV1 {
  return {
    schemaVersion: "prediction-record-v1",
    predictionId: "pred-1",
    batchId: "b1",
    sampleId: "s1",
    constructId: "c-gfp",
    assayType: "product-titer",
    measurementUnit: "mg/L",
    sourceToolId: "cellfree",
    sourceRunId: "run-1",
    method: "analytic-ci",
    modelVersion: "v-test",
    timepoints: [
      { timeHours: 0, value: 0, unit: "mg/L", lower: 0, upper: 0, intervalLevel: 0.9 },
      { timeHours: 4, value: 40, unit: "mg/L", lower: 30, upper: 50, intervalLevel: 0.9 },
    ],
    provenanceIds: ["prov-pred-1"],
    ...overrides,
  };
}

function experiment(overrides: Partial<ExperimentRecordV1> = {}): ExperimentRecordV1 {
  return {
    schemaVersion: "experiment-record-v1",
    recordId: "exp-1",
    batchId: "b1",
    sampleId: "s1",
    constructId: "c-gfp",
    assayType: "product-titer",
    sourceType: "wet-lab",
    measurementUnit: "mg/L",
    instrument: "plate-reader",
    operator: "tester",
    startedAt: "2026-02-01T00:00:00.000Z",
    timepoints: [
      { timeHours: 0, value: 0, unit: "mg/L" },
      { timeHours: 4, value: 42, unit: "mg/L" },
    ],
    qcFlags: ["passed"],
    provenanceIds: ["prov-exp-1"],
    ...overrides,
  };
}

function criteria(overrides: Partial<ValidationThreshold> = {}): ValidationThreshold {
  return {
    schemaVersion: "acceptance-criteria-v1",
    criteriaId: "crit-1",
    constructId: "c-gfp",
    assayType: "product-titer",
    // Pre-registered strictly before experiment.startedAt (2026-02-01).
    registeredAt: "2026-01-01T00:00:00.000Z",
    maxRelativeError: 0.5,
    minIntervalCoverage: 0.8,
    ...overrides,
  };
}

/** A falsified single-point pair for a mapped tool (predicted 40, observed 100). */
function falsifiedReport() {
  const pred = prediction({
    timepoints: [
      { timeHours: 0, value: 0, unit: "mg/L", lower: 0, upper: 0, intervalLevel: 0.9 },
      { timeHours: 4, value: 40, unit: "mg/L", lower: 0, upper: 200, intervalLevel: 0.9 },
    ],
  });
  const exp = experiment({ timepoints: [{ timeHours: 4, value: 100, unit: "mg/L" }] });
  const [pair] = matchPredictionsToExperiments([pred], [exp]);
  return compareToFalsification(pair, criteria());
}

describe("falsification/compare", () => {
  it("corroborates when relError and coverage within criteria", () => {
    const [pair] = matchPredictionsToExperiments([prediction()], [experiment()]);
    const report = compareToFalsification(pair, criteria());
    expect(report.verdict).toBe("corroborated");
    expect(report.intervalCoverage).toBe(1);
    expect(report.medianRelError).toBeLessThanOrEqual(0.5);
  });

  it("falsifies when medianRelError exceeds maxRelativeError", () => {
    const report = falsifiedReport();
    // Coverage still passes (100 ∈ [0, 200]) — isolates relError as the failing dimension.
    expect(report.intervalCoverage).toBe(1);
    expect(report.medianRelError).toBeGreaterThan(0.5);
    expect(report.verdict).toBe("falsified");
  });

  it("returns inconclusive without pre-registered criteria", () => {
    const [pair] = matchPredictionsToExperiments([prediction()], [experiment()]);
    // No criteria at all → cannot corroborate (prevents post-hoc judgment).
    expect(compareToFalsification(pair).verdict).toBe("inconclusive");
    // Criteria registered AFTER the experiment started is not pre-registration → inconclusive.
    const postHoc = compareToFalsification(pair, criteria({ registeredAt: "2026-03-01T00:00:00.000Z" }));
    expect(postHoc.verdict).toBe("inconclusive");
    // A pair whose units cannot be normalized is inconclusive, never falsified.
    const [mismatch] = matchPredictionsToExperiments(
      [prediction({ measurementUnit: "RFU", timepoints: [{ timeHours: 4, value: 40, unit: "RFU" }] })],
      [experiment({ timepoints: [{ timeHours: 4, value: 42, unit: "mg/L" }] })],
    );
    expect(mismatch.unitNormalized).toBe(false);
    expect(compareToFalsification(mismatch, criteria()).verdict).toBe("inconclusive");
  });

  it("proposed delta is pending and passes learnedDelta validation", () => {
    const report = falsifiedReport();
    expect(report.verdict).toBe("falsified");
    expect(report.sourceToolId).toBe("cellfree");

    const input = proposeDeltaFromFalsification([report], { sourceDbtlRunId: "run-1", iteration: 2 });
    expect(input).not.toBeNull();
    if (!input) return;

    expect(input.sourceExperimentRecordIds).toContain("exp-1");
    expect(input.targetToolIds).toContain("cellfree");

    const pack = buildLearnedDeltaPack(input);
    expect(pack.humanGateStatus).toBe("pending");
    expect(pack.sourceExperimentRecordIds.length).toBeGreaterThan(0);

    const validation = validateLearnedDeltaPack(pack);
    expect(validation.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(validation.ok).toBe(true);
  });

  it("proposes no delta when nothing is falsified", () => {
    const [pair] = matchPredictionsToExperiments([prediction()], [experiment()]);
    const corroborated = compareToFalsification(pair, criteria());
    expect(proposeDeltaFromFalsification([corroborated], { sourceDbtlRunId: "run-1", iteration: 1 })).toBeNull();
  });
});
