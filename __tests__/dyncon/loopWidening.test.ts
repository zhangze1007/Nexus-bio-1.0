import {
  applyChangedBound,
  applyChangedWeight,
  buildDynConSeed,
  buildFBASeed,
} from "../../src/components/tools/shared/workbenchDataflow";
import type { DBTLWorkbenchPayload } from "../../src/store/workbenchPayloads";
import type { LearnedDeltaPack } from "../../src/types/learnedDelta";

function pack(overrides: Partial<LearnedDeltaPack> = {}): LearnedDeltaPack {
  return {
    schemaVersion: "learned-delta-pack-v1",
    deltaPackId: "ldp-loop-1",
    iteration: 1,
    sourceDbtlRunId: "run-1",
    sourceExperimentRecordIds: ["er-1"],
    sourceProvenanceIds: ["prov-1"],
    targetToolIds: ["fbasim"],
    changedBounds: {},
    changedPriors: {},
    changedWeights: {},
    learnedMetrics: {},
    classification: "conservative",
    humanGateStatus: "approved",
    createdAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function dbtl(packs: LearnedDeltaPack[]): DBTLWorkbenchPayload {
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
    result: { bestIteration: 1, improvementRate: 0.1, passRate: 60, latestPhase: "Learn", learnedDeltaPacks: packs },
    updatedAt: Date.UTC(2026, 4, 1),
  };
}

describe("loop widening: changedBounds / changedWeights application (P2-1)", () => {
  it("applyChangedBound updates fbasim uptake bounds", () => {
    const packs = [pack({ changedBounds: { "fbasim.fluxBounds.glucose": { before: [0, 10], after: [0, 18] } } })];
    expect(applyChangedBound([0, 10], packs, "fbasim.fluxBounds.glucose")).toEqual([0, 18]);
  });

  it("absent or invalid bound is skipped safely (keeps current)", () => {
    const good = [pack({ changedBounds: { "fbasim.fluxBounds.glucose": { before: [0, 10], after: [0, 18] } } })];
    expect(applyChangedBound([0, 10], good, "fbasim.unknown.bound")).toEqual([0, 10]);
    const bad = [pack({ changedBounds: { "fbasim.fluxBounds.glucose": { before: [0, 10], after: [20, 5] } } })];
    expect(applyChangedBound([0, 10], bad, "fbasim.fluxBounds.glucose")).toEqual([0, 10]);
  });

  it("applyChangedWeight updates and clamps the dyncon tracking weight", () => {
    const packs = [pack({ changedWeights: { "dyncon.weights.tracking": { before: 1, after: 3 } } })];
    expect(applyChangedWeight(1, packs, "dyncon.weights.tracking", 0, 5)).toBe(3);
    const over = [pack({ changedWeights: { "dyncon.weights.tracking": { before: 1, after: 99 } } })];
    expect(applyChangedWeight(1, over, "dyncon.weights.tracking", 0, 5)).toBe(5);
  });

  it("bound/weight deltas actually change the tool seeds", () => {
    const fbaSeed = buildFBASeed(
      null,
      null,
      dbtl([pack({ targetToolIds: ["fbasim"], changedBounds: { "fbasim.fluxBounds.glucose": { before: [0, 10], after: [1, 19] } } })]),
    );
    expect(fbaSeed.glucoseUptakeBounds).toEqual([1, 19]);

    const dynSeed = buildDynConSeed(
      null,
      null,
      null,
      dbtl([pack({ targetToolIds: ["dyncon"], changedWeights: { "dyncon.weights.tracking": { before: 1, after: 4 } } })]),
    );
    expect(dynSeed.weights.tracking).toBe(4);
  });

  it("unregistered prior field is skipped safely in the seed builder", () => {
    const d = dbtl([
      pack({
        targetToolIds: ["fbasim"],
        changedPriors: { "fbasim.nonexistent": { before: 1, after: 999, unit: "relative-scale" } },
      }),
    ]);
    expect(() => buildFBASeed(null, null, d)).not.toThrow();
    expect(buildFBASeed(null, null, d).glucoseUptake).toBe(buildFBASeed(null, null, null).glucoseUptake);
  });
});
