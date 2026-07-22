import { passesLearnGate } from "../../src/services/instruments/qcGate";
import { runRecordQc } from "../../src/services/instruments/recordQc";
import { convertOrNull, normalizeUnit } from "../../src/services/instruments/unitNormalization";
import type { ExperimentRecordV1 } from "../../src/types/experimentRecord";

function record(o: Partial<ExperimentRecordV1> = {}): ExperimentRecordV1 {
  return {
    schemaVersion: "experiment-record-v1",
    recordId: "r1",
    batchId: "b",
    sampleId: "s",
    constructId: "c",
    assayType: "product-titer",
    sourceType: "wet-lab",
    measurementUnit: "mg/L",
    instrument: "reader",
    operator: "op",
    startedAt: "2026-02-01T00:00:00.000Z",
    timepoints: [{ timeHours: 4, value: 50, unit: "mg/L" }],
    qcFlags: ["passed"],
    ...o,
  };
}

describe("record QC + learn gate (P1-3)", () => {
  it("blank subtraction lowers reported titer", () => {
    const res = runRecordQc(record(), { blank: [10, 10, 10] });
    expect(res.blankCorrected).toBe(true);
    expect(res.correctedRecord.timepoints[0].value).toBe(40); // 50 − mean(blank)=10
    expect(res.correctedRecord.timepoints[0].value).toBeLessThan(50);
  });

  it("failed positive control sets failed-control and blocks the learn gate", () => {
    const res = runRecordQc(record(), { posControl: [0.1], negControl: [0.5] });
    expect(res.controlPassed).toBe(false);
    expect(res.flags).toContain("failed-control");
    const gate = passesLearnGate(res.correctedRecord);
    expect(gate.ok).toBe(false);
    expect(gate.blockedBy).toContain("failed-control");
  });

  it("replicate CV over threshold flags outlier", () => {
    const rec = record({
      timepoints: [
        { timeHours: 4, value: 10, unit: "mg/L", replicateId: "a" },
        { timeHours: 4, value: 100, unit: "mg/L", replicateId: "b" },
      ],
    });
    const res = runRecordQc(rec, {});
    expect(res.replicateCV).toBeGreaterThan(0.2);
    expect(res.flags).toContain("outlier");
  });

  it("normalizeUnit unifies g/L and mg/L", () => {
    expect(normalizeUnit(2, "g/L", "mg/L")).toBe(2000);
    expect(normalizeUnit(500, "mg/L", "g/L")).toBe(0.5);
    expect(normalizeUnit(5, "mg/L", "mg/L")).toBe(5);
    // Incompatible (RFU) stays null so P0-2 pairing remains inconclusive.
    expect(convertOrNull(5, "RFU", "mg/L")).toBeNull();
  });

  it("normalizeUnit converts OD ↔ %transmittance (nonlinear)", () => {
    expect(normalizeUnit(0, "OD", "%T")).toBeCloseTo(100, 6);
    expect(normalizeUnit(2, "OD", "%T")).toBeCloseTo(1, 6);
    expect(normalizeUnit(100, "%T", "OD")).toBeCloseTo(0, 6);
  });

  it("a clean record passes the learn gate", () => {
    expect(passesLearnGate(record()).ok).toBe(true);
  });
});
