/**
 * Tests for inventoryAnalytics service.
 *
 * Mocks `@/src/lib/db` to control sqlAll / sqlGet return values
 * without requiring a real database connection.
 */

// ── Mock setup (must be before imports) ────────────────────────────────

const mockSqlAll = jest.fn();
const mockSqlGet = jest.fn();

jest.mock("@/src/lib/db", () => ({
  sqlAll: (...args: unknown[]) => mockSqlAll(...args),
  sqlGet: (...args: unknown[]) => mockSqlGet(...args),
}));

import {
  getInventoryStats,
  getExpiringItems,
  getLowStockItems,
} from "../src/services/inventory/inventoryAnalytics";

// ── Helpers ────────────────────────────────────────────────────────────

/** Set up default mock returns for getInventoryStats calls. */
function setupStatsMocks(overrides: {
  strainCount?: number;
  plasmidCount?: number;
  primerCount?: number;
  chemicalCount?: number;
  expiringCount?: number;
  lowChemicalCount?: number;
  lowStrainCount?: number;
} = {}) {
  const {
    strainCount = 5,
    plasmidCount = 3,
    primerCount = 10,
    chemicalCount = 8,
    expiringCount = 2,
    lowChemicalCount = 1,
    lowStrainCount = 0,
  } = overrides;

  // sqlGet is called for each table count, then expiring, then low-stock (x2)
  let callIndex = 0;
  mockSqlGet.mockImplementation(() => {
    const sequence = [
      { cnt: strainCount },       // strains count
      { cnt: plasmidCount },      // plasmids count
      { cnt: primerCount },       // primers count
      { cnt: chemicalCount },     // chemicals count
      { cnt: expiringCount },     // expiring count
      { cnt: lowChemicalCount },  // low-stock chemicals
      { cnt: lowStrainCount },    // low-stock strains
    ];
    return Promise.resolve(sequence[callIndex++] ?? { cnt: 0 });
  });
}

// ── getInventoryStats ──────────────────────────────────────────────────

describe("getInventoryStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns totalItems as the sum of all 4 type counts", async () => {
    setupStatsMocks({
      strainCount: 5,
      plasmidCount: 3,
      primerCount: 10,
      chemicalCount: 8,
    });

    const stats = await getInventoryStats();
    expect(stats.totalItems).toBe(26); // 5 + 3 + 10 + 8
  });

  it("returns correct byType breakdown", async () => {
    setupStatsMocks({
      strainCount: 12,
      plasmidCount: 7,
      primerCount: 20,
      chemicalCount: 4,
    });

    const stats = await getInventoryStats();
    expect(stats.byType).toEqual({
      strains: 12,
      plasmids: 7,
      primers: 20,
      chemicals: 4,
    });
  });

  it("returns zero counts when all tables are empty", async () => {
    setupStatsMocks({
      strainCount: 0,
      plasmidCount: 0,
      primerCount: 0,
      chemicalCount: 0,
      expiringCount: 0,
      lowChemicalCount: 0,
      lowStrainCount: 0,
    });

    const stats = await getInventoryStats();
    expect(stats.totalItems).toBe(0);
    expect(stats.byType).toEqual({ strains: 0, plasmids: 0, primers: 0, chemicals: 0 });
    expect(stats.expiringCount).toBe(0);
    expect(stats.lowStockCount).toBe(0);
  });

  it("includes expiringCount from chemicals with near-term expiry", async () => {
    setupStatsMocks({ expiringCount: 5 });

    const stats = await getInventoryStats();
    expect(stats.expiringCount).toBe(5);
  });

  it("includes lowStockCount as sum of low-stock chemicals and low-aliquot strains", async () => {
    setupStatsMocks({ lowChemicalCount: 3, lowStrainCount: 2 });

    const stats = await getInventoryStats();
    expect(stats.lowStockCount).toBe(5); // 3 + 2
  });

  it("passes projectId filter to all queries when provided", async () => {
    setupStatsMocks();

    await getInventoryStats("proj-abc");

    // Every sqlGet call should include projectId in args
    for (const call of mockSqlGet.mock.calls) {
      const sql = call[0] as string;
      const args = call[1] as unknown[];
      expect(sql).toContain("project_id = ?");
      expect(args).toContain("proj-abc");
    }
  });

  it("does not add project_id clause when projectId is undefined", async () => {
    setupStatsMocks();

    await getInventoryStats();

    for (const call of mockSqlGet.mock.calls) {
      const sql = call[0] as string;
      expect(sql).not.toContain("project_id = ?");
    }
  });
});

// ── getExpiringItems ───────────────────────────────────────────────────

describe("getExpiringItems", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns items sorted by expiry date ascending", async () => {
    mockSqlAll.mockResolvedValue([
      { id: "inv_1", name: "IPTG", type: "chemical", expiryDate: "2026-07-01", daysUntilExpiry: 5 },
      { id: "inv_2", name: "Ampicillin", type: "chemical", expiryDate: "2026-07-10", daysUntilExpiry: 14 },
      { id: "inv_3", name: "Kanamycin", type: "chemical", expiryDate: "2026-07-20", daysUntilExpiry: 24 },
    ]);

    const items = await getExpiringItems();
    expect(items).toHaveLength(3);
    expect(items[0].expiryDate).toBe("2026-07-01");
    expect(items[2].expiryDate).toBe("2026-07-20");
  });

  it("uses default 30 days when daysAhead is not specified", async () => {
    mockSqlAll.mockResolvedValue([]);

    await getExpiringItems();

    const sql = mockSqlAll.mock.calls[0][0] as string;
    const args = mockSqlAll.mock.calls[0][1] as unknown[];
    expect(sql).toContain("days");
    expect(args[0]).toBe(30);
  });

  it("passes custom daysAhead value to the query", async () => {
    mockSqlAll.mockResolvedValue([]);

    await getExpiringItems(undefined, 7);

    const args = mockSqlAll.mock.calls[0][1] as unknown[];
    expect(args[0]).toBe(7);
  });

  it("returns empty array when no items are expiring", async () => {
    mockSqlAll.mockResolvedValue([]);

    const items = await getExpiringItems();
    expect(items).toEqual([]);
  });

  it("maps row fields to ExpiringItem interface correctly", async () => {
    mockSqlAll.mockResolvedValue([
      { id: "inv_99", name: "DTT", type: "chemical", expiryDate: "2026-07-05", daysUntilExpiry: 9 },
    ]);

    const items = await getExpiringItems();
    expect(items[0]).toEqual({
      id: "inv_99",
      name: "DTT",
      type: "chemical",
      expiryDate: "2026-07-05",
      daysUntilExpiry: 9,
    });
  });

  it("passes projectId filter when provided", async () => {
    mockSqlAll.mockResolvedValue([]);

    await getExpiringItems("proj-xyz", 14);

    const sql = mockSqlAll.mock.calls[0][0] as string;
    const args = mockSqlAll.mock.calls[0][1] as unknown[];
    expect(sql).toContain("project_id = ?");
    expect(args).toContain("proj-xyz");
  });
});

// ── getLowStockItems ───────────────────────────────────────────────────

describe("getLowStockItems", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("combines low-stock chemicals and low-aliquot strains", async () => {
    // First sqlAll call = chemicals, second = strains
    mockSqlAll
      .mockResolvedValueOnce([
        { id: "inv_c1", name: "IPTG", type: "chemical", quantityRemaining: 0.5, quantityUnit: "g", reorderThreshold: 1.0, aliquotCount: null },
      ])
      .mockResolvedValueOnce([
        { id: "inv_s1", name: "BL21", type: "strain", quantityRemaining: null, quantityUnit: null, reorderThreshold: null, aliquotCount: 1 },
      ]);

    const items = await getLowStockItems();
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe("chemical");
    expect(items[1].type).toBe("strain");
  });

  it("returns empty array when no items are low stock", async () => {
    mockSqlAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const items = await getLowStockItems();
    expect(items).toEqual([]);
  });

  it("maps chemical fields correctly", async () => {
    mockSqlAll
      .mockResolvedValueOnce([
        { id: "inv_c5", name: "Ethanol", type: "chemical", quantityRemaining: 100, quantityUnit: "mL", reorderThreshold: 500, aliquotCount: null },
      ])
      .mockResolvedValueOnce([]);

    const items = await getLowStockItems();
    expect(items[0]).toEqual({
      id: "inv_c5",
      name: "Ethanol",
      type: "chemical",
      quantityRemaining: 100,
      quantityUnit: "mL",
      reorderThreshold: 500,
      aliquotCount: null,
    });
  });

  it("maps strain fields correctly with null chemical fields", async () => {
    mockSqlAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "inv_s3", name: "DH5alpha", type: "strain", quantityRemaining: null, quantityUnit: null, reorderThreshold: null, aliquotCount: 2 },
      ]);

    const items = await getLowStockItems();
    expect(items[0]).toEqual({
      id: "inv_s3",
      name: "DH5alpha",
      type: "strain",
      quantityRemaining: null,
      quantityUnit: null,
      reorderThreshold: null,
      aliquotCount: 2,
    });
  });

  it("passes projectId filter to both queries when provided", async () => {
    mockSqlAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getLowStockItems("proj-abc");

    for (const call of mockSqlAll.mock.calls) {
      const sql = call[0] as string;
      const args = call[1] as unknown[];
      expect(sql).toContain("project_id = ?");
      expect(args).toContain("proj-abc");
    }
  });

  it("does not include project_id clause when projectId is undefined", async () => {
    mockSqlAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getLowStockItems();

    for (const call of mockSqlAll.mock.calls) {
      const sql = call[0] as string;
      expect(sql).not.toContain("project_id = ?");
    }
  });
});
