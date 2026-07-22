import { passesLearnGate } from "../../src/services/instruments/qcGate";
import { BenchlingClient } from "../../src/services/lims/benchlingClient";
import { clearEntityLinks, resolveConstructId, upsertEntityLink } from "../../src/services/lims/entityMap";
import { GenericLIMSAdapter } from "../../src/services/lims/genericAdapter";
import { assayPullToExperimentRecord } from "../../src/services/lims/resultToExperimentRecord";
import { runSync } from "../../src/services/lims/syncEngine";
import type { LIMSConfig } from "../../src/services/lims/types";
import type { ExperimentRecordV1 } from "../../src/types/experimentRecord";
import { validateExperimentRecordV1 } from "../../src/validation/experimentRecordValidator";

/** Injected fetch returning a canned JSON payload — never touches the network. */
function mockFetch(payload: unknown): typeof fetch {
  return ((_url: string, _init?: RequestInit) =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(JSON.stringify(payload)),
    })) as unknown as typeof fetch;
}

function benchlingConfig(): LIMSConfig {
  return {
    id: "cfg1",
    name: "test",
    type: "benchling",
    baseUrl: "https://x.benchling.com",
    authType: "api_key",
    credentials: { api_key: "key" },
    syncDirection: "bidirectional",
  };
}

describe("LIMS bidirectional sync (P1-2)", () => {
  it("pullAssayResults maps to a valid ExperimentRecordV1", async () => {
    const client = new BenchlingClient(benchlingConfig(), {
      fetchFn: mockFetch({
        assayResults: [
          {
            id: "ar1",
            entityId: "seq_123",
            assayType: "product-titer",
            unit: "mg/L",
            startedAt: "2026-02-01T00:00:00.000Z",
            timepoints: [
              { timeHours: 0, value: 0 },
              { timeHours: 4, value: 42 },
            ],
          },
        ],
      }),
    });

    const pulls = await client.pullAssayResults({ batchId: "b1" });
    expect(pulls).toHaveLength(1);
    expect(pulls[0].externalId).toBe("seq_123");

    const record = assayPullToExperimentRecord(pulls[0], {
      batchId: "b1",
      sampleId: "s1",
      constructId: "con-1",
      designProvenanceIds: ["prov-1"],
    });
    expect(record.sourceType).toBe("wet-lab");
    expect(record.provenanceIds).toEqual(["prov-1"]);
    expect(record.qcFlags).toContain("passed");
    const v = validateExperimentRecordV1(record);
    expect(v.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("record without provenance is flagged manual-review-required and blocked", () => {
    const record = assayPullToExperimentRecord(
      {
        externalId: "seq_9",
        assayType: "product-titer",
        unit: "mg/L",
        startedAt: "2026-02-01T00:00:00.000Z",
        timepoints: [{ timeHours: 4, value: 10 }],
      },
      { batchId: "b", sampleId: "s", constructId: "c", designProvenanceIds: [] },
    );
    expect(record.qcFlags).toContain("manual-review-required");
    // Still a VALID record (the flag is a warning), but the learn gate holds it.
    expect(validateExperimentRecordV1(record).ok).toBe(true);
    const gate = passesLearnGate(record);
    expect(gate.ok).toBe(false);
    expect(gate.blockedBy).toContain("manual-review-required");
  });

  it("entityMap resolves construct from LIMS externalId", () => {
    clearEntityLinks();
    upsertEntityLink({
      nexusConstructId: "con-42",
      limsEntityId: "seq_123",
      limsType: "plasmid",
      linkedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(resolveConstructId("seq_123")).toBe("con-42");
    expect(resolveConstructId("unknown")).toBeUndefined();
  });

  it("runSync pulls, joins via entityMap, and creates only validated joined records", async () => {
    clearEntityLinks();
    upsertEntityLink({
      nexusConstructId: "con-1",
      limsEntityId: "seq_123",
      limsType: "sample",
      linkedAt: "2026-01-01T00:00:00.000Z",
    });
    const client = new BenchlingClient(benchlingConfig(), {
      fetchFn: mockFetch({
        assayResults: [
          { entityId: "seq_123", assayType: "product-titer", unit: "mg/L", startedAt: "2026-02-01T00:00:00.000Z", timepoints: [{ timeHours: 4, value: 20 }] },
          { entityId: "unmapped", assayType: "product-titer", unit: "mg/L", startedAt: "2026-02-01T00:00:00.000Z", timepoints: [{ timeHours: 4, value: 5 }] },
        ],
      }),
    });

    const created: ExperimentRecordV1[] = [];
    const report = await runSync("cfg1", "pull", {
      client,
      params: { batchId: "b1" },
      resolveContext: (pull) => {
        const constructId = resolveConstructId(pull.externalId);
        if (!constructId) return null;
        return { batchId: "b1", sampleId: pull.externalId, constructId, designProvenanceIds: ["prov-1"] };
      },
      onRecord: (r) => created.push(r),
    });

    expect(report.pulled).toBe(2);
    expect(report.recordsCreated).toBe(1); // the unmapped result is skipped
    expect(report.errors).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(created[0].constructId).toBe("con-1");
    expect(created[0].sourceType).toBe("wet-lab");
  });

  it("GenericLIMSAdapter exposes the same pullAssayResults contract", async () => {
    const adapter = new GenericLIMSAdapter(
      {
        id: "g",
        name: "generic",
        type: "generic",
        baseUrl: "https://lims.example",
        authType: "api_key",
        credentials: { api_key: "k" },
        syncDirection: "pull",
      },
      {
        fetchFn: mockFetch([
          { externalId: "x1", assayType: "product-titer", unit: "mg/L", startedAt: "2026-02-01T00:00:00.000Z", timepoints: [{ timeHours: 4, value: 12 }] },
        ]),
      },
    );
    const pulls = await adapter.pullAssayResults({ batchId: "b1" });
    expect(pulls).toHaveLength(1);
    expect(pulls[0].externalId).toBe("x1");
    const rec = assayPullToExperimentRecord(pulls[0], {
      batchId: "b1",
      sampleId: "s",
      constructId: "c",
      designProvenanceIds: ["p"],
    });
    expect(validateExperimentRecordV1(rec).ok).toBe(true);
  });
});
