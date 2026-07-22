import { buildFBASeed } from "../../src/components/tools/shared/workbenchDataflow";
import { proposeDeltaFromFalsification } from "../../src/services/falsification/toLearnedDelta";
import { filterApprovedLearnedDeltaPacks } from "../../src/services/learnedDeltaApplication";
import { buildLearnedDeltaPack } from "../../src/services/learnedDeltaBuilder";
import type { DBTLWorkbenchPayload } from "../../src/store/workbenchPayloads";
import type { FalsificationReport } from "../../src/types/falsification";
import type { LearnedDeltaPack } from "../../src/types/learnedDelta";

/** A falsified report where fbasim SYSTEMATICALLY OVER-predicts (predicted > observed). */
function overPredictedFbasimReport(): FalsificationReport {
  return {
    schemaVersion: "falsification-report-v1",
    reportId: "fal-e2e-1",
    predictionId: "pred-1",
    experimentRecordId: "exp-1",
    constructId: "con-1",
    assayType: "product-titer",
    sourceToolId: "fbasim",
    residuals: [
      { timeHours: 4, predicted: 100, observed: 60, absError: 40, relError: 0.667, withinInterval: false },
      { timeHours: 8, predicted: 120, observed: 70, absError: 50, relError: 0.714, withinInterval: false },
    ],
    rmse: 45,
    mae: 45,
    intervalCoverage: 0,
    medianRelError: 0.69,
    verdict: "falsified",
    createdAt: "2026-05-01T00:00:00.000Z",
    sourceProvenanceIds: ["prov-1"],
  };
}

function dbtlWith(packs: LearnedDeltaPack[]): DBTLWorkbenchPayload {
  return {
    validity: "partial",
    toolId: "dbtlflow",
    targetProduct: "artemisinin",
    proposedPhase: "Learn",
    draftHypothesis: "Retune route",
    measuredResult: 12,
    unit: "mg/L",
    passed: false,
    feedbackSource: "committed",
    feedbackIterationId: 1,
    result: {
      bestIteration: 1,
      improvementRate: 0.1,
      passRate: 60,
      latestPhase: "Learn",
      learnedDeltaPacks: packs,
    },
    updatedAt: Date.UTC(2026, 4, 1),
  };
}

describe("end-to-end feedback: falsified → propose → approve → apply (P2-1)", () => {
  it("moves the target seed in the expected direction (over-prediction ⇒ lower uptake)", () => {
    // 1. Propose from the falsified over-prediction report.
    const input = proposeDeltaFromFalsification([overPredictedFbasimReport()], {
      sourceDbtlRunId: "run-e2e",
      iteration: 1,
    });
    expect(input).not.toBeNull();
    if (!input) return;

    // Key is aligned to the registry (previously "fbasim.params.substrateUptakeScale" → silently skipped).
    const prior = input.changedPriors?.["fbasim.glucoseUptake"];
    expect(prior).toBeDefined();
    expect(prior?.unit).toBe("relative-scale");
    expect(prior?.after).toBeLessThan(1); // over-prediction ⇒ scale down

    // 2. Build the pack — the human gate is unchanged (pending).
    const pending = buildLearnedDeltaPack(input);
    expect(pending.humanGateStatus).toBe("pending");
    expect(filterApprovedLearnedDeltaPacks([pending])).toHaveLength(0);

    const trulyBaseline = buildFBASeed(null, null, null).glucoseUptake;
    // A pending pack must NOT move the seed.
    expect(buildFBASeed(null, null, dbtlWith([pending])).glucoseUptake).toBe(trulyBaseline);

    // 3. Approve → filter → apply through the seed builder.
    const approved: LearnedDeltaPack = { ...pending, humanGateStatus: "approved" };
    const applicable = filterApprovedLearnedDeltaPacks([approved]);
    expect(applicable).toHaveLength(1);
    const relearned = buildFBASeed(null, null, dbtlWith(applicable)).glucoseUptake;

    // 4. The seed moved DOWN (expected direction) and actually changed — not a no-op.
    expect(relearned).toBeLessThan(trulyBaseline);
  });
});
