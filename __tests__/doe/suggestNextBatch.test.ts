import type { DeckLayout } from "../../src/services/instruments/deckModel";
import {
  generateOpentronsProtocol,
  type ProtocolStep,
  validateExecutableProtocol,
} from "../../src/services/instruments/protocolGenerator";
import { type DesignPoint, type DesignSpace, sampleCandidates } from "../../src/services/doe/designSpace";
import { suggestNextBatch } from "../../src/services/doe/suggestNextBatch";
import { buildManifest, buildPlateMap, constructIdForWell } from "../../src/types/protocolManifest";
import type { FalsificationReport } from "../../src/types/falsification";

// Synthetic 1-D benchmark: maximize sin(x) on [0, 2π] (single peak at π/2).
const sineSpace: DesignSpace = { dimensions: [{ name: "x", min: 0, max: 2 * Math.PI, kind: "continuous" }] };
const sineObjective = (p: DesignPoint) => Math.sin(p.values.x as number);

function report(medianRelError: number): FalsificationReport {
  return {
    schemaVersion: "falsification-report-v1",
    reportId: "r",
    predictionId: "p",
    experimentRecordId: "e",
    constructId: "c",
    assayType: "product-titer",
    sourceToolId: "fbasim",
    residuals: [],
    rmse: 1,
    mae: 1,
    intervalCoverage: 0,
    medianRelError,
    verdict: "falsified",
    createdAt: "2026-06-01T00:00:00.000Z",
  };
}

function pointToConstructId(p: DesignPoint): string {
  return `con-${Object.values(p.values)
    .map((v) => (typeof v === "number" ? v.toFixed(3) : v))
    .join("_")}`;
}

describe("suggestNextBatch (DoE active learning)", () => {
  it("EI-guided search beats random search on the synthetic benchmark (same budget)", () => {
    const initial = sampleCandidates(sineSpace, 4, 1).map((pt) => ({ point: pt, observed: sineObjective(pt) }));

    // EI: extend the shared initial set with 10 acquisition-guided evaluations.
    const guided = [...initial];
    for (let i = 0; i < 10; i++) {
      const s = suggestNextBatch(sineSpace, guided, [], { batchSize: 1, strategy: "ei", seed: 300 + i });
      guided.push({ point: s.points[0], observed: sineObjective(s.points[0]) });
    }
    const bestEI = Math.max(...guided.map((h) => h.observed));

    // Random: same initial set + 10 random evaluations (same total budget).
    const randomExtra = sampleCandidates(sineSpace, 10, 5555).map(sineObjective);
    const bestRandom = Math.max(...initial.map((h) => h.observed), ...randomExtra);

    expect(bestEI).toBeGreaterThan(bestRandom);
    expect(bestEI).toBeGreaterThan(0.99); // EI actually locates the optimum
  });

  it("UCB-guided search also beats random search", () => {
    const initial = sampleCandidates(sineSpace, 4, 2).map((pt) => ({ point: pt, observed: sineObjective(pt) }));
    const guided = [...initial];
    for (let i = 0; i < 10; i++) {
      const s = suggestNextBatch(sineSpace, guided, [], { batchSize: 1, strategy: "ucb", seed: 400 + i });
      guided.push({ point: s.points[0], observed: sineObjective(s.points[0]) });
    }
    const bestUCB = Math.max(...guided.map((h) => h.observed));
    const randomExtra = sampleCandidates(sineSpace, 10, 6666).map(sineObjective);
    const bestRandom = Math.max(...initial.map((h) => h.observed), ...randomExtra);
    expect(bestUCB).toBeGreaterThan(bestRandom);
  });

  it("suggestions are deterministic for a fixed seed", () => {
    const history = sampleCandidates(sineSpace, 6, 3).map((pt) => ({ point: pt, observed: sineObjective(pt) }));
    const a = suggestNextBatch(sineSpace, history, [], { batchSize: 4, strategy: "ei", seed: 42 });
    const b = suggestNextBatch(sineSpace, history, [], { batchSize: 4, strategy: "ei", seed: 42 });
    expect(a).toEqual(b);
    // a different seed draws a different candidate pool → different picks
    const c = suggestNextBatch(sineSpace, history, [], { batchSize: 4, strategy: "ei", seed: 43 });
    expect(c.points).not.toEqual(a.points);
  });

  it("consumes recent falsification residuals (not a decoy input)", () => {
    const history = sampleCandidates(sineSpace, 6, 3).map((pt) => ({ point: pt, observed: sineObjective(pt) }));
    const noReports = suggestNextBatch(sineSpace, history, [], { batchSize: 3, strategy: "ucb", seed: 5 });
    const withReports = suggestNextBatch(sineSpace, history, [report(0.8)], { batchSize: 3, strategy: "ucb", seed: 5 });
    expect(withReports).not.toEqual(noReports); // residual boost changes UCB scores
    expect(withReports.rationale[0]).toContain("residual");
  });

  it("each suggested candidate yields a valid executable protocol + manifest (P1-1)", () => {
    const history = sampleCandidates(sineSpace, 6, 3).map((pt) => ({ point: pt, observed: sineObjective(pt) }));
    const suggestion = suggestNextBatch(sineSpace, history, [], { batchSize: 3, strategy: "ucb", seed: 7 });
    expect(suggestion.points).toHaveLength(3);
    expect(suggestion.rationale).toHaveLength(3);
    expect(suggestion.expectedInfoGain).toHaveLength(3);

    const samples = suggestion.points.map((pt, i) => ({ sampleId: `cand-${i}`, constructId: pointToConstructId(pt) }));
    const plateMap = buildPlateMap(samples, "sample_plate");
    const manifest = buildManifest({ batchId: "b-doe", dbtlRunId: "run-doe", plateMap });
    const layout: DeckLayout = {
      labware: [
        { id: "sample_plate", loadName: "nest_96_wellplate_200ul_flat", slot: 1, wells: 96 },
        { id: "tips20", loadName: "opentrons_96_tiprack_20ul", slot: 2, wells: 96 },
      ],
      pipettes: [{ id: "p20", model: "p20_single_gen2", mount: "left", minUl: 1, maxUl: 20 }],
    };
    const steps: ProtocolStep[] = suggestion.points.map((_, i) => ({
      type: "transfer",
      description: `seed candidate ${i}`,
      reagent: "culture",
      volume: 5 + i, // distinct volumes so it is not flagged a consecutive duplicate
      duration: 0,
      temperature: 0,
    }));

    const validation = validateExecutableProtocol(steps, layout, manifest);
    expect(validation.valid).toBe(true);

    const py = generateOpentronsProtocol(steps, manifest, layout);
    expect(py).toContain("sample_plate['");

    // manifest round-trips the candidate's constructId back from its well
    expect(constructIdForWell(manifest, plateMap[0].well)).toBe(samples[0].constructId);
  });
});
