import * as fs from "fs";
import * as path from "path";
import { LABWARE_MAP, PIPETTE_MAP } from "../src/server/labAutomationBridge";

/**
 * L1 ground truth (spec/lab-interface-groundtruth-v1.md).
 *
 * Every OT-2 labware / module / pipette load name the engine emits must be a real
 * identifier in the `opentrons_shared_data` library. The fixture is emitted FROM
 * the `opentrons` package (`__tests__/fixtures/opentronsGroundTruth.v9.1.1.json`,
 * produced by the reproduce script in the spec) — so this test compares engine
 * output to an EXTERNAL reference, not to itself (anti-fabrication rule 2).
 *
 * Regenerate the fixture (bumps version): run the L1 reproduce script from the
 * spec against a fresh `pip install opentrons`, then re-emit labware/modules/pipettes.
 */
const fixture: { version: string; labware: string[]; modules: string[]; pipettes: string[] } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "opentronsGroundTruth.v9.1.1.json"), "utf8"),
);

const labware = new Set(fixture.labware);
const modules = new Set(fixture.modules);
const pipettes = new Set(fixture.pipettes);

describe(`L1 — OT-2 IDs are real (opentrons_shared_data ${fixture.version})`, () => {
  it.each(Object.entries(LABWARE_MAP))(
    'labware/module role "%s" -> %s exists in the real library',
    (_role, id) => {
      expect(labware.has(id) || modules.has(id)).toBe(true);
    },
  );

  it.each(Object.entries(PIPETTE_MAP))('pipette role "%s" -> %s exists in the real library', (_role, id) => {
    expect(pipettes.has(id)).toBe(true);
  });

  it("regression: the fabricated `nest_24_wellplate_10.4ml_flat` is gone (real name has no _flat)", () => {
    expect(Object.values(LABWARE_MAP)).not.toContain("nest_24_wellplate_10.4ml_flat");
    expect(labware.has("nest_24_wellplate_10.4ml")).toBe(true); // the real one exists
    expect(labware.has("nest_24_wellplate_10.4ml_flat")).toBe(false); // the fabricated one never did
  });
});
