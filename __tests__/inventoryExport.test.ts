/**
 * Tests for inventoryExport service.
 *
 * Mocks `@/src/lib/db` to control sqlAll return values
 * without requiring a real database connection.
 */

// ── Mock setup (must be before imports) ────────────────────────────────

const mockSqlAll = jest.fn();

jest.mock("@/src/lib/db", () => ({
  sqlAll: (...args: unknown[]) => mockSqlAll(...args),
}));

import {
  exportToCSV,
  exportToJSON,
  generateInventoryReport,
} from "../src/services/inventory/inventoryExport";

// ── exportToCSV ────────────────────────────────────────────────────────

describe("exportToCSV", () => {
  it("returns empty string for empty input", () => {
    expect(exportToCSV([], "strains")).toBe("");
  });

  it("generates header row from item keys", () => {
    const items = [
      { id: "inv_1", name: "BL21", species: "E. coli" },
    ];
    const csv = exportToCSV(items, "strains");
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("id,name,species");
  });

  it("generates correct data rows", () => {
    const items = [
      { id: "inv_1", name: "BL21", species: "E. coli" },
      { id: "inv_2", name: "DH5a", species: "E. coli" },
    ];
    const csv = exportToCSV(items, "strains");
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toBe("inv_1,BL21,E. coli");
    expect(lines[2]).toBe("inv_2,DH5a,E. coli");
  });

  it("wraps fields containing commas in double quotes", () => {
    const items = [
      { id: "inv_1", name: "Luria-Bertani (LB)", notes: "Contains tryptone, yeast extract, NaCl" },
    ];
    const csv = exportToCSV(items, "chemicals");
    expect(csv).toContain('"Contains tryptone, yeast extract, NaCl"');
  });

  it("doubles internal double quotes per RFC-4180", () => {
    const items = [
      { id: "inv_1", name: 'He said "hello"' },
    ];
    const csv = exportToCSV(items, "strains");
    expect(csv).toContain('"He said ""hello"""');
  });

  it("converts null and undefined values to empty strings", () => {
    const items = [
      { id: "inv_1", name: "Test", notes: null, source: undefined },
    ];
    const csv = exportToCSV(items, "strains");
    const dataLine = csv.trim().split("\n")[1];
    // null and undefined both become empty between commas
    expect(dataLine).toBe("inv_1,Test,,");
  });

  it("collects keys from all items for the header", () => {
    const items = [
      { id: "inv_1", name: "A" },
      { id: "inv_2", name: "B", extra: "C" },
    ];
    const csv = exportToCSV(items, "test");
    const header = csv.trim().split("\n")[0];
    expect(header).toBe("id,name,extra");
  });

  it("ends with a trailing newline", () => {
    const items = [{ id: "inv_1", name: "X" }];
    const csv = exportToCSV(items, "test");
    expect(csv.endsWith("\n")).toBe(true);
  });
});

// ── exportToJSON ───────────────────────────────────────────────────────

describe("exportToJSON", () => {
  it("wraps items in an envelope with type, count, exportedAt, items", () => {
    const items = [{ id: "inv_1", name: "BL21" }];
    const json = exportToJSON(items, "strains");
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe("strains");
    expect(parsed.count).toBe(1);
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.items).toEqual(items);
  });

  it("returns pretty-printed JSON with 2-space indentation", () => {
    const items = [{ id: "inv_1" }];
    const json = exportToJSON(items, "test");
    // Pretty-printed JSON starts with "{\n  "
    expect(json).toContain("{\n  ");
  });

  it("sets count to 0 for empty array", () => {
    const json = exportToJSON([], "primers");
    const parsed = JSON.parse(json);
    expect(parsed.count).toBe(0);
    expect(parsed.items).toEqual([]);
  });

  it("produces a valid ISO 8601 timestamp", () => {
    const json = exportToJSON([], "test");
    const parsed = JSON.parse(json);
    expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt);
  });
});

// ── generateInventoryReport ────────────────────────────────────────────

describe("generateInventoryReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queries all 4 item tables with project_id filter", async () => {
    // 4 item table queries + expiring count + low-stock chemicals + low-stock strains = 7 calls
    mockSqlAll
      .mockResolvedValueOnce([]) // strains
      .mockResolvedValueOnce([]) // plasmids
      .mockResolvedValueOnce([]) // primers
      .mockResolvedValueOnce([]) // chemicals
      .mockResolvedValueOnce([{ cnt: 0 }]) // expiring
      .mockResolvedValueOnce([{ cnt: 0 }]) // low chemicals
      .mockResolvedValueOnce([{ cnt: 0 }]); // low strains

    await generateInventoryReport("proj-abc");

    // All 7 sqlAll calls should include project_id
    expect(mockSqlAll).toHaveBeenCalledTimes(7);
    for (const call of mockSqlAll.mock.calls) {
      const sql = call[0] as string;
      const args = call[1] as unknown[];
      expect(sql).toContain("project_id = ?");
      expect(args).toContain("proj-abc");
    }
  });

  it("returns correct summary totals", async () => {
    const strains = [
      { id: "s1", name: "BL21" },
      { id: "s2", name: "DH5a" },
    ];
    const plasmids = [{ id: "p1", name: "pUC19" }];
    const primers: Record<string, unknown>[] = [];
    const chemicals = [
      { id: "c1", name: "IPTG" },
      { id: "c2", name: "Amp" },
      { id: "c3", name: "Kan" },
    ];

    mockSqlAll
      .mockResolvedValueOnce(strains)
      .mockResolvedValueOnce(plasmids)
      .mockResolvedValueOnce(primers)
      .mockResolvedValueOnce(chemicals)
      .mockResolvedValueOnce([{ cnt: 1 }]) // expiring
      .mockResolvedValueOnce([{ cnt: 2 }]) // low chemicals
      .mockResolvedValueOnce([{ cnt: 0 }]); // low strains

    const report = await generateInventoryReport("proj-1");

    expect(report.summary.total).toBe(6); // 2 + 1 + 0 + 3
    expect(report.summary.byType).toEqual({
      strains: 2,
      plasmids: 1,
      primers: 0,
      chemicals: 3,
    });
    expect(report.summary.expiring).toBe(1);
    expect(report.summary.lowStock).toBe(2); // 2 + 0
  });

  it("returns per-type item arrays", async () => {
    const strains = [{ id: "s1", name: "BL21" }];
    const plasmids = [{ id: "p1", name: "pET28" }];
    const primers = [{ id: "r1", name: "Fwd" }];
    const chemicals = [{ id: "c1", name: "IPTG" }];

    mockSqlAll
      .mockResolvedValueOnce(strains)
      .mockResolvedValueOnce(plasmids)
      .mockResolvedValueOnce(primers)
      .mockResolvedValueOnce(chemicals)
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 0 }]);

    const report = await generateInventoryReport("proj-1");

    expect(report.items.strains).toEqual(strains);
    expect(report.items.plasmids).toEqual(plasmids);
    expect(report.items.primers).toEqual(primers);
    expect(report.items.chemicals).toEqual(chemicals);
  });

  it("sets generatedAt to a valid ISO 8601 string", async () => {
    mockSqlAll
      .mockResolvedValue([])
      .mockResolvedValue([])
      .mockResolvedValue([])
      .mockResolvedValue([])
      .mockResolvedValue([{ cnt: 0 }])
      .mockResolvedValue([{ cnt: 0 }])
      .mockResolvedValue([{ cnt: 0 }]);

    const before = new Date().toISOString();
    const report = await generateInventoryReport("proj-1");
    const after = new Date().toISOString();

    expect(report.generatedAt >= before).toBe(true);
    expect(report.generatedAt <= after).toBe(true);
  });

  it("defaults expiring and lowStock to 0 when counts are null", async () => {
    mockSqlAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{}])        // no cnt field
      .mockResolvedValueOnce([{}])        // no cnt field
      .mockResolvedValueOnce([{}]);       // no cnt field

    const report = await generateInventoryReport("proj-1");

    expect(report.summary.expiring).toBe(0);
    expect(report.summary.lowStock).toBe(0);
  });

  it("sums low-stock chemicals and low-aliquot strains correctly", async () => {
    mockSqlAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 5 }])  // low chemicals
      .mockResolvedValueOnce([{ cnt: 3 }]);  // low strains

    const report = await generateInventoryReport("proj-1");

    expect(report.summary.lowStock).toBe(8); // 5 + 3
  });
});
