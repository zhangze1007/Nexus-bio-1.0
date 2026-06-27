/**
 * Tests for inventory CSV import service.
 *
 * Mocks `@/src/server/libsqlDb` to control sqlAll / sqlRun return values
 * without requiring a real database connection.
 */

// ── Mock setup (must be before imports) ────────────────────────────────

const mockSqlAll = jest.fn();
const mockSqlRun = jest.fn();

jest.mock("@/src/server/libsqlDb", () => ({
  sqlAll: (...args: unknown[]) => mockSqlAll(...args),
  sqlRun: (...args: unknown[]) => mockSqlRun(...args),
  sqlGet: (...args: unknown[]) => mockSqlAll(...args).then((r: unknown[]) => r?.[0]),
}));

import {
  parseCSV,
  parseCSVToRecords,
  importPrimersFromCSV,
  importStrainsFromCSV,
  importPlasmidsFromCSV,
} from "../src/services/inventory/inventoryImport";

// ── Helpers ────────────────────────────────────────────────────────────

const TEST_PROJECT_ID = "proj-test-001";
const TEST_USER_ID = "user-test-001";

/** Default empty-table mock: no existing items in the DB. */
function mockEmptyTable() {
  mockSqlAll.mockResolvedValue([]);
  mockSqlRun.mockResolvedValue({ rowsAffected: 1 });
}

/** Mock that the DB already contains items with the given names. */
function mockExistingNames(names: string[]) {
  mockSqlAll.mockResolvedValue(
    names.map((name) => ({ name })),
  );
  mockSqlRun.mockResolvedValue({ rowsAffected: 1 });
}

// ── parseCSV ───────────────────────────────────────────────────────────

describe("parseCSV", () => {
  it("parses a simple two-row CSV with no quoting", () => {
    const csv = "name,sequence\nprimerA,ATCGATCG";
    const rows = parseCSV(csv);
    expect(rows).toEqual([
      ["name", "sequence"],
      ["primerA", "ATCGATCG"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    const csv = 'name,notes\npET28a,"KanR, T7 promoter"';
    const rows = parseCSV(csv);
    expect(rows[1][1]).toBe("KanR, T7 promoter");
  });

  it("handles escaped quotes inside quoted fields", () => {
    const csv = 'name,notes\npUC19,"Contains ""lacZ"" gene"';
    const rows = parseCSV(csv);
    expect(rows[1][1]).toBe('Contains "lacZ" gene');
  });

  it("handles CRLF line endings", () => {
    const csv = "name,sequence\r\nfwd,ATCG\r\nrev,CGAT";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(3); // header + 2 data rows
    expect(rows[1][0]).toBe("fwd");
    expect(rows[2][0]).toBe("rev");
  });

  it("handles embedded newlines within quoted fields", () => {
    const csv = 'name,notes\npET28a,"line one\nline two"';
    const rows = parseCSV(csv);
    expect(rows[1][1]).toBe("line one\nline two");
  });

  it("returns empty array for empty input", () => {
    expect(parseCSV("")).toEqual([]);
  });

  it("handles a single header row with no data", () => {
    const rows = parseCSV("name,sequence");
    expect(rows).toEqual([["name", "sequence"]]);
  });

  it("handles trailing newline", () => {
    const csv = "name\nprimerA\n";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });
});

// ── parseCSVToRecords ──────────────────────────────────────────────────

describe("parseCSVToRecords", () => {
  it("converts header + data rows into record objects", () => {
    const csv = "name,sequence\ntest,ATCG\nrev,CGAT";
    const records = parseCSVToRecords(csv);
    expect(records).toEqual([
      { name: "test", sequence: "ATCG" },
      { name: "rev", sequence: "CGAT" },
    ]);
  });

  it("returns empty array when CSV has only a header", () => {
    const records = parseCSVToRecords("name,sequence");
    expect(records).toEqual([]);
  });

  it("skips entirely blank rows", () => {
    const csv = "name,sequence\ntest,ATCG\n,,\nrev,CGAT";
    const records = parseCSVToRecords(csv);
    expect(records).toHaveLength(2);
  });
});

// ── importPrimersFromCSV ───────────────────────────────────────────────

describe("importPrimersFromCSV", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("imports valid primer rows into the database", async () => {
    mockEmptyTable();

    const csv =
      "Name,Sequence,Target Gene\n" +
      "pBR322_fwd,ATCGATCGATCG,bla\n" +
      "pBR322_rev,CGATCGATCGAT,bla";

    const result = await importPrimersFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(mockSqlRun).toHaveBeenCalledTimes(2);
  });

  it("returns errors for rows missing required fields", async () => {
    mockEmptyTable();

    const csv =
      "Name,Sequence\n" +
      "validPrimer,ATCGATCG\n" +
      ",CGATCGAT"; // missing name

    const result = await importPrimersFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Row 3");
    expect(result.errors[0]).toContain("name");
  });

  it("deduplicates by name against existing DB records (case-insensitive)", async () => {
    mockExistingNames(["existing_primer"]);

    const csv =
      "Name,Sequence\n" +
      "existing_primer,ATCGATCG\n" +
      "new_primer,CGATCGAT";

    const result = await importPrimersFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("deduplicates within the same CSV batch", async () => {
    mockEmptyTable();

    const csv =
      "Name,Sequence\n" +
      "dupPrimer,ATCGATCG\n" +
      "dupPrimer,CGATCGAT";

    const result = await importPrimersFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("returns error when CSV has no recognized headers", async () => {
    mockEmptyTable();

    const csv = "foo,bar\nbaz,qux";

    const result = await importPrimersFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("No recognized column headers");
  });

  it("returns error when CSV is empty", async () => {
    const result = await importPrimersFromCSV("", TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("stamps projectId and createdBy on inserted rows", async () => {
    mockEmptyTable();

    const csv = "Name,Sequence\np001,ATCG";

    await importPrimersFromCSV(csv, "proj-test", "user-1");

    const insertSql = mockSqlRun.mock.calls[0][0] as string;
    const insertArgs = mockSqlRun.mock.calls[0][1] as unknown[];

    expect(insertSql).toContain("project_id");
    expect(insertSql).toContain("created_by");
    expect(insertArgs).toContain("proj-test");
    expect(insertArgs).toContain("user-1");
  });
});

// ── importStrainsFromCSV ───────────────────────────────────────────────

describe("importStrainsFromCSV", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("imports valid strain rows into the database", async () => {
    mockEmptyTable();

    const csv =
      "Name,Genotype,Species\n" +
      "BL21(DE3),F- ompT hsdS(rB- mB-) gal dcm,Escherichia coli\n" +
      "DH5alpha,F- Φ80lacZΔM15 Δ(lacZYA-argF),Escherichia coli";

    const result = await importStrainsFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(mockSqlRun).toHaveBeenCalledTimes(2);
  });

  it("accepts flexible header aliases for strains", async () => {
    mockEmptyTable();

    // Using "strain name" alias and "marker(s)" alias
    const csv =
      "strain name,genotype,marker(s)\n" +
      "MG1655,wild-type,KanR";

    const result = await importStrainsFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(1);
    const insertSql = mockSqlRun.mock.calls[0][0] as string;
    expect(insertSql).toContain("resistance_markers");
  });

  it("skips duplicate strain names from DB (case-insensitive)", async () => {
    mockExistingNames(["bl21(de3)"]);

    const csv =
      "Name,Species\n" +
      "BL21(DE3),Escherichia coli\n" +
      "NEB 10-beta,Escherichia coli";

    const result = await importStrainsFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });
});

// ── importPlasmidsFromCSV ──────────────────────────────────────────────

describe("importPlasmidsFromCSV", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("imports valid plasmid rows into the database", async () => {
    mockEmptyTable();

    const csv =
      "Name,Backbone,Resistance,Promoter\n" +
      "pET28a,pBR322,Kanamycin,T7\n" +
      "pUC19,pBR322,Ampicillin,lac";

    const result = await importPlasmidsFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(mockSqlRun).toHaveBeenCalledTimes(2);
  });

  it("handles numeric fields like insert_length_bp", async () => {
    mockEmptyTable();

    const csv =
      "Name,Backbone,Insert Length (bp)\n" +
      "pCustom,pET,5400";

    const result = await importPlasmidsFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(1);
    const insertArgs = mockSqlRun.mock.calls[0][1] as unknown[];
    // insert_length_bp should be coerced to a number
    expect(insertArgs).toContain(5400);
  });

  it("returns error when plasmid CSV has no name column", async () => {
    mockEmptyTable();

    const csv = "Backbone,Resistance\npBR322,Amp";

    const result = await importPlasmidsFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("name");
  });
});

// ── DB error handling ──────────────────────────────────────────────────

describe("DB error handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports DB insert failures as row-level errors", async () => {
    mockSqlAll.mockResolvedValue([]); // no existing items
    mockSqlRun.mockRejectedValue(new Error("UNIQUE constraint failed"));

    const csv = "Name,Sequence\nprimerA,ATCG";

    const result = await importPrimersFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Row 2");
    expect(result.errors[0]).toContain("UNIQUE constraint failed");
  });

  it("continues importing remaining rows after a DB failure", async () => {
    mockSqlAll.mockResolvedValue([]);
    // First insert fails, second succeeds
    mockSqlRun
      .mockRejectedValueOnce(new Error("duplicate"))
      .mockResolvedValueOnce({ rowsAffected: 1 });

    const csv =
      "Name,Sequence\n" +
      "primerA,ATCG\n" +
      "primerB,CGAT";

    const result = await importPrimersFromCSV(csv, TEST_PROJECT_ID, TEST_USER_ID);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Row 2");
    expect(result.errors[0]).toContain("duplicate");
  });
});
