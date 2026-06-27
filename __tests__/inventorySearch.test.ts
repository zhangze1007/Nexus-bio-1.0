/**
 * Tests for inventorySearch service.
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
  searchInventory,
  getSearchSuggestions,
} from "../src/services/inventory/inventorySearch";

// ── Helpers ────────────────────────────────────────────────────────────

/** Create a mock DB row for a strain. */
function strainRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_s1",
    name: "BL21-DE3",
    genotype: "F- ompT hsdS(rB- mB-) gal dcm",
    species: "E. coli",
    source: "NEB",
    resistance_markers: null,
    notes: "Common expression strain",
    project_id: "proj-1",
    archived: 0,
    ...overrides,
  };
}

/** Create a mock DB row for a plasmid. */
function plasmidRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_p1",
    name: "pET28a-GFP",
    backbone: "pET28a",
    insert_description: "GFP coding sequence",
    resistance: "kanamycin",
    promoter: "T7",
    notes: "His-tagged GFP",
    project_id: "proj-1",
    archived: 0,
    ...overrides,
  };
}

/** Create a mock DB row for a primer. */
function primerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_pr1",
    name: "GFP-Fwd",
    sequence_5to3: "ATGGTGAGCAAGGGCGAG",
    target_gene: "GFP",
    vendor: "IDT",
    notes: "Forward primer for GFP amplification",
    project_id: "proj-1",
    archived: 0,
    ...overrides,
  };
}

/** Create a mock DB row for a chemical. */
function chemicalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv_c1",
    name: "Ampicillin",
    cas_number: "69-52-3",
    molecular_formula: "C16H19N3O4S",
    vendor: "Sigma-Aldrich",
    catalog_number: "A9518",
    notes: "Stock solution 100 mg/mL",
    project_id: "proj-1",
    archived: 0,
    ...overrides,
  };
}

// ── searchInventory ────────────────────────────────────────────────────

describe("searchInventory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns results from all 4 tables by default", async () => {
    // Each table search returns one result
    mockSqlAll
      .mockResolvedValueOnce([strainRow()])      // strains
      .mockResolvedValueOnce([plasmidRow()])      // plasmids
      .mockResolvedValueOnce([primerRow()])        // primers
      .mockResolvedValueOnce([chemicalRow()]);     // chemicals

    const results = await searchInventory("GFP");
    expect(results).toHaveLength(4);
    expect(mockSqlAll).toHaveBeenCalledTimes(4);
  });

  it("filters by type when types parameter is provided", async () => {
    mockSqlAll
      .mockResolvedValueOnce([strainRow()])   // strains only
      .mockResolvedValueOnce([primerRow()]);  // primers only

    const results = await searchInventory("test", undefined, ["strain", "primer"]);
    expect(results).toHaveLength(2);
    expect(mockSqlAll).toHaveBeenCalledTimes(2);

    // Verify only strain and primer tables were queried
    const sql1 = mockSqlAll.mock.calls[0][0] as string;
    const sql2 = mockSqlAll.mock.calls[1][0] as string;
    expect(sql1).toContain("inventory_strains");
    expect(sql2).toContain("inventory_primers");
  });

  it("adds project_id clause when projectId is provided", async () => {
    mockSqlAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await searchInventory("test", "proj-abc");

    for (const call of mockSqlAll.mock.calls) {
      const sql = call[0] as string;
      const args = call[1] as unknown[];
      expect(sql).toContain("project_id = ?");
      expect(args).toContain("proj-abc");
    }
  });

  it("does not add project_id clause when projectId is undefined", async () => {
    mockSqlAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await searchInventory("test");

    for (const call of mockSqlAll.mock.calls) {
      const sql = call[0] as string;
      expect(sql).not.toContain("project_id = ?");
    }
  });

  it("returns empty array for empty query", async () => {
    const results = await searchInventory("");
    expect(results).toEqual([]);
    expect(mockSqlAll).not.toHaveBeenCalled();
  });

  it("returns empty array for whitespace-only query", async () => {
    const results = await searchInventory("   ");
    expect(results).toEqual([]);
    expect(mockSqlAll).not.toHaveBeenCalled();
  });

  it("sorts results by relevance descending then name ascending", async () => {
    // Strain table returns exact match and contains match
    mockSqlAll
      .mockResolvedValueOnce([
        strainRow({ id: "s1", name: "GFP" }),         // exact match -> 1.0
        strainRow({ id: "s2", name: "GFP-variant" }),  // starts-with -> 0.8
        strainRow({ id: "s3", name: "Anti-GFP" }),     // contains -> 0.6
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const results = await searchInventory("GFP");
    expect(results).toHaveLength(3);
    expect(results[0].name).toBe("GFP");
    expect(results[0].relevance).toBe(1.0);
    expect(results[1].name).toBe("GFP-variant");
    expect(results[1].relevance).toBe(0.8);
    expect(results[2].name).toBe("Anti-GFP");
    expect(results[2].relevance).toBe(0.6);
  });

  it("assigns 0.4 relevance for matches in non-name columns", async () => {
    // Match found in genotype but not name
    mockSqlAll
      .mockResolvedValueOnce([
        strainRow({ name: "BL21", genotype: "contains GFP marker" }),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const results = await searchInventory("GFP");
    expect(results).toHaveLength(1);
    expect(results[0].relevance).toBe(0.4);
  });

  it("extracts highlight snippets from matching columns", async () => {
    mockSqlAll
      .mockResolvedValueOnce([
        strainRow({
          name: "BL21-DE3",
          notes: "This strain has been engineered with GFP reporter gene for fluorescence screening",
        }),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const results = await searchInventory("GFP");
    expect(results).toHaveLength(1);
    expect(results[0].highlights.length).toBeGreaterThanOrEqual(1);
    // The highlight should contain the query
    expect(results[0].highlights[0].toLowerCase()).toContain("gfp");
  });

  it("limits highlights to 3 snippets", async () => {
    // Row where query appears in many columns
    mockSqlAll
      .mockResolvedValueOnce([
        strainRow({
          name: "GFP strain",
          genotype: "GFP marker present",
          species: "GFP-optimized E. coli",
          source: "GFP lab stock",
          notes: "GFP positive control",
        }),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const results = await searchInventory("GFP");
    expect(results).toHaveLength(1);
    expect(results[0].highlights.length).toBeLessThanOrEqual(3);
  });

  it("returns correct SearchResult structure with all required fields", async () => {
    mockSqlAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([plasmidRow()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const results = await searchInventory("pET");
    expect(results).toHaveLength(1);

    const result = results[0];
    expect(result).toHaveProperty("type");
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("relevance");
    expect(result).toHaveProperty("highlights");
    expect(typeof result.type).toBe("string");
    expect(typeof result.id).toBe("string");
    expect(typeof result.name).toBe("string");
    expect(typeof result.relevance).toBe("number");
    expect(Array.isArray(result.highlights)).toBe(true);
  });

  it("assigns correct type labels to each table's results", async () => {
    mockSqlAll
      .mockResolvedValueOnce([strainRow({ id: "s1" })])
      .mockResolvedValueOnce([plasmidRow({ id: "p1" })])
      .mockResolvedValueOnce([primerRow({ id: "pr1" })])
      .mockResolvedValueOnce([chemicalRow({ id: "c1" })]);

    const results = await searchInventory("test");
    expect(results).toHaveLength(4);

    const types = results.map((r) => r.type).sort();
    expect(types).toEqual(["chemical", "plasmid", "primer", "strain"]);
  });

  it("handles LIKE special characters in query safely", async () => {
    mockSqlAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    // Should not throw even with SQL LIKE wildcards in the query
    const results = await searchInventory("100%_test");
    expect(results).toEqual([]);
    expect(mockSqlAll).toHaveBeenCalledTimes(4);
  });
});

// ── getSearchSuggestions ────────────────────────────────────────────────

describe("getSearchSuggestions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns suggestions from all 4 tables", async () => {
    mockSqlAll
      .mockResolvedValueOnce([{ name: "BL21-DE3" }])      // strains
      .mockResolvedValueOnce([{ name: "pET28a" }])         // plasmids
      .mockResolvedValueOnce([{ name: "GFP-Fwd" }])        // primers
      .mockResolvedValueOnce([{ name: "Ampicillin" }]);    // chemicals

    const suggestions = await getSearchSuggestions("test");
    expect(suggestions).toHaveLength(4);
    expect(mockSqlAll).toHaveBeenCalledTimes(4);
  });

  it("deduplicates suggestions case-insensitively", async () => {
    mockSqlAll
      .mockResolvedValueOnce([{ name: "Ampicillin" }])     // strains
      .mockResolvedValueOnce([{ name: "ampicillin" }])     // plasmids
      .mockResolvedValueOnce([{ name: "AMPICILLIN" }])     // primers
      .mockResolvedValueOnce([]);                           // chemicals

    const suggestions = await getSearchSuggestions("amp");
    expect(suggestions).toHaveLength(1);
    // Preserves the first-seen casing
    expect(suggestions[0]).toBe("Ampicillin");
  });

  it("sorts suggestions alphabetically", async () => {
    mockSqlAll
      .mockResolvedValueOnce([{ name: "Zymomonas" }, { name: "Arabidopsis" }])
      .mockResolvedValueOnce([{ name: "Bacillus" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const suggestions = await getSearchSuggestions("test");
    expect(suggestions).toEqual(["Arabidopsis", "Bacillus", "Zymomonas"]);
  });

  it("returns empty array for empty query", async () => {
    const suggestions = await getSearchSuggestions("");
    expect(suggestions).toEqual([]);
    expect(mockSqlAll).not.toHaveBeenCalled();
  });

  it("returns empty array for whitespace-only query", async () => {
    const suggestions = await getSearchSuggestions("   ");
    expect(suggestions).toEqual([]);
    expect(mockSqlAll).not.toHaveBeenCalled();
  });

  it("limits results to 10 suggestions", async () => {
    // Return 15 unique names across tables
    const names = Array.from({ length: 15 }, (_, i) => ({ name: `Item_${String(i).padStart(2, "0")}` }));
    mockSqlAll
      .mockResolvedValueOnce(names.slice(0, 5))
      .mockResolvedValueOnce(names.slice(5, 10))
      .mockResolvedValueOnce(names.slice(10, 15))
      .mockResolvedValueOnce([]);

    const suggestions = await getSearchSuggestions("item");
    expect(suggestions).toHaveLength(10);
  });

  it("uses LIKE with wildcards for partial matching", async () => {
    mockSqlAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getSearchSuggestions("amp");

    for (const call of mockSqlAll.mock.calls) {
      const args = call[1] as unknown[];
      expect(args[0]).toBe("%amp%");
    }
  });

  it("includes archived = 0 filter in all queries", async () => {
    mockSqlAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getSearchSuggestions("test");

    for (const call of mockSqlAll.mock.calls) {
      const sql = call[0] as string;
      expect(sql).toContain("archived = 0");
    }
  });
});
