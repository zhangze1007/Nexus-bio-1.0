import { type ExperimentProtocol, exportOT2Protocol } from "../../src/server/labAutomationBridge";
import { type DeckLayout, validateDeck, validatePipetteVolumes } from "../../src/services/instruments/deckModel";
import {
  generateOpentronsProtocol,
  type ProtocolStep,
  validateExecutableProtocol,
} from "../../src/services/instruments/protocolGenerator";
import {
  buildManifest,
  buildPlateMap,
  constructIdForWell,
  lookupWell,
  type WellAssignment,
} from "../../src/types/protocolManifest";

function step(o: Partial<ProtocolStep> = {}): ProtocolStep {
  return { type: "transfer", description: "move sample", reagent: "LB broth", volume: 5, duration: 0, temperature: 0, ...o };
}

function layout(): DeckLayout {
  return {
    labware: [
      { id: "sample_plate", loadName: "nest_96_wellplate_200ul_flat", slot: 1, wells: 96 },
      { id: "reaction_plate", loadName: "nest_96_wellplate_200ul_flat", slot: 2, wells: 96 },
      { id: "tips20", loadName: "opentrons_96_tiprack_20ul", slot: 3, wells: 96 },
    ],
    pipettes: [{ id: "p20", model: "p20_single_gen2", mount: "left", minUl: 1, maxUl: 20 }],
  };
}

function experimentProtocol(): ExperimentProtocol {
  return {
    name: "Test Protocol",
    description: "round-trip fixture",
    author: "test",
    version: "1.0.0",
    labware: { plate_96: "plate_96" },
    pipettes: { p20: "p20_single" },
    steps: [{ id: "s1", type: "transfer", description: "add SOC media", volume: 5 }],
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", dbtlStage: "build" },
  };
}

describe("protocol executability + read-back (P1-1)", () => {
  it("emitOpentronsStep uses labwareMap + plate map (no hard-coded A1/B1)", () => {
    const plateMap: WellAssignment[] = [
      { well: "C3", labwareId: "sample_plate", sampleId: "s1", constructId: "con-1", role: "sample" },
      { well: "D4", labwareId: "reaction_plate", sampleId: "s2", constructId: "con-2", role: "sample" },
      { well: "E5", labwareId: "sample_plate", sampleId: "ctrl", constructId: "control-neg", role: "control-neg" },
      { well: "F6", labwareId: "sample_plate", sampleId: "blk", constructId: "blank", role: "blank" },
    ];
    const manifest = buildManifest({ batchId: "b1", dbtlRunId: "run1", plateMap });
    const py = generateOpentronsProtocol([step()], manifest, layout());

    // Wells come from the manifest, labware var from the layout — not the default plates.
    expect(py).toContain("sample_plate['C3']");
    expect(py).not.toContain("source_plate[");
    expect(py).not.toContain("['A1']");
    // Deck-driven header loads the real labware + pipette.
    expect(py).toContain("protocol.load_labware('nest_96_wellplate_200ul_flat', '1')");
    expect(py).toContain("protocol.load_instrument('p20_single_gen2', 'left'");
    // Liquid class emitted (addresses the prior no-liquid-class limitation).
    expect(py).toContain("flow_rate.aspirate");
  });

  it("default (no-manifest) path stays backward compatible", () => {
    const py = generateOpentronsProtocol([step({ description: "Move DNA" }), step({ description: "Move DNA 2" })]);
    expect(py).toContain("source_plate['A1']");
    expect(py).toContain("dest_plate['B1']");
  });

  it("exported manifest round-trips well → constructId and carries identity", () => {
    const plate = buildPlateMap(
      [
        { sampleId: "s1", constructId: "gfp-v1" },
        { sampleId: "s2", constructId: "rfp-v2" },
      ],
      "sample_plate",
    );
    const manifest = buildManifest({ batchId: "batch-7", dbtlRunId: "dbtl-3", plateMap: plate });

    expect(constructIdForWell(manifest, "A1")).toBe("gfp-v1");
    expect(constructIdForWell(manifest, "B1")).toBe("rfp-v2");
    expect(lookupWell(manifest, "A1")?.sampleId).toBe("s1");
    expect(manifest.batchId).toBe("batch-7");
    // at least one negative control + one blank
    expect(plate.some((w) => w.role === "control-neg")).toBe(true);
    expect(plate.some((w) => w.role === "blank")).toBe(true);

    // …and through the bridge export
    const out = exportOT2Protocol(experimentProtocol(), {
      batchId: "batch-7",
      dbtlRunId: "dbtl-3",
      samples: [{ sampleId: "s1", constructId: "gfp-v1" }],
    });
    expect(out.manifest).toBeDefined();
    expect(out.manifest && constructIdForWell(out.manifest, "A1")).toBe("gfp-v1");
    expect(out.manifest?.batchId).toBe("batch-7");
  });

  it("validation rejects volume exceeding pipette max", () => {
    const pipettes = layout().pipettes; // p20: max 20 µL
    expect(validatePipetteVolumes(pipettes, [5])).toEqual([]);
    const errs = validatePipetteVolumes(pipettes, [500]);
    expect(errs.some((e) => /exceeds the largest pipette capacity/.test(e))).toBe(true);

    const manifest = buildManifest({
      batchId: "b",
      dbtlRunId: "r",
      plateMap: buildPlateMap([{ sampleId: "s", constructId: "c" }], "sample_plate"),
    });
    const res = validateExecutableProtocol([step({ volume: 500 })], layout(), manifest);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /exceeds the largest pipette capacity/.test(e))).toBe(true);
  });

  it("validateDeck flags slot conflicts and missing controls", () => {
    const conflict: DeckLayout = {
      labware: [
        { id: "a", loadName: "nest_96_wellplate_200ul_flat", slot: 1, wells: 96 },
        { id: "b", loadName: "opentrons_96_tiprack_20ul", slot: 1, wells: 96 },
      ],
      pipettes: [{ id: "p20", model: "p20_single_gen2", mount: "left", minUl: 1, maxUl: 20 }],
    };
    const manifest = buildManifest({
      batchId: "b",
      dbtlRunId: "r",
      plateMap: [{ well: "A1", labwareId: "a", sampleId: "s", constructId: "c", role: "sample" }],
    });
    const errs = validateDeck(conflict, manifest);
    expect(errs.some((e) => /slot 1 conflict/i.test(e))).toBe(true);
    expect(errs.some((e) => /negative control/i.test(e))).toBe(true);
    expect(errs.some((e) => /blank/i.test(e))).toBe(true);
  });
});
