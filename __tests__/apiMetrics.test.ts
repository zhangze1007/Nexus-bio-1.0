/** @jest-environment node */

/**
 * Unit tests for the API Metrics Service.
 *
 * Mocks the libsqlDb layer with in-memory tables so tests run without
 * a real database.
 */

/* ------------------------------------------------------------------ */
/*  In-memory mock tables                                              */
/* ------------------------------------------------------------------ */

const apiMetricRows: Record<string, unknown>[] = [];

function resetTables(): void {
  apiMetricRows.length = 0;
}

jest.mock("../src/server/libsqlDb", () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // p95 duration query — ordered by duration_ms ASC
    if (sql.includes("ORDER BY duration_ms ASC")) {
      let filtered = [...apiMetricRows];
      if (sql.includes("WHERE endpoint =")) {
        const endpoint = args[0] as string;
        filtered = filtered.filter((r) => r.endpoint === endpoint);
      }
      if (sql.includes("AND timestamp >= ?")) {
        const start = args[1] as number;
        const end = args[2] as number;
        filtered = filtered.filter(
          (r) => (r.timestamp as number) >= start && (r.timestamp as number) < end,
        );
      }
      filtered.sort((a, b) => (a.duration_ms as number) - (b.duration_ms as number));
      return filtered.map((r) => ({ duration_ms: r.duration_ms }));
    }

    // Top endpoints query — GROUP BY endpoint
    if (sql.includes("GROUP BY endpoint") && sql.includes("ORDER BY count DESC")) {
      const start = args[0] as number;
      const end = args[1] as number;
      const filtered = apiMetricRows.filter(
        (r) => (r.timestamp as number) >= start && (r.timestamp as number) < end,
      );
      const endpointCounts = new Map<string, number>();
      for (const row of filtered) {
        const ep = row.endpoint as string;
        endpointCounts.set(ep, (endpointCounts.get(ep) ?? 0) + 1);
      }
      return Array.from(endpointCounts.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    return [];
  }),

  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    // Aggregate stats with errorRate (getApiMetrics)
    if (sql.includes("SUM(CASE WHEN status_code >= 400") && args.length === 2) {
      const start = args[0] as number;
      const end = args[1] as number;
      const filtered = apiMetricRows.filter(
        (r) => (r.timestamp as number) >= start && (r.timestamp as number) < end,
      );
      const totalCalls = filtered.length;
      const avgDuration =
        totalCalls > 0
          ? filtered.reduce((s, r) => s + (r.duration_ms as number), 0) / totalCalls
          : 0;
      const errorCount = filtered.filter((r) => (r.status_code as number) >= 400).length;
      const errorRate = totalCalls > 0 ? errorCount / totalCalls : 0;
      return { totalCalls, avgDuration, errorRate };
    }

    // Aggregate stats for getEndpointStats (with WHERE endpoint =)
    if (sql.includes("SUM(CASE WHEN status_code >= 400") && args.length >= 1) {
      const endpoint = args[0] as string;
      let filtered = apiMetricRows.filter((r) => r.endpoint === endpoint);
      if (args.length === 3) {
        const start = args[1] as number;
        const end = args[2] as number;
        filtered = filtered.filter(
          (r) => (r.timestamp as number) >= start && (r.timestamp as number) < end,
        );
      }
      const calls = filtered.length;
      const avgDuration =
        calls > 0
          ? filtered.reduce((s, r) => s + (r.duration_ms as number), 0) / calls
          : 0;
      const errorCount = filtered.filter((r) => (r.status_code as number) >= 400).length;
      const errorRate = calls > 0 ? errorCount / calls : 0;
      return { calls, avgDuration, errorRate };
    }

    return undefined;
  }),

  sqlRun: jest.fn(async () => ({ rowsAffected: 0 })),

  sqlBatch: jest.fn(async () => undefined),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mock)                                               */
/* ------------------------------------------------------------------ */

import {
  trackApiCall,
  getApiMetrics,
  getEndpointStats,
  type TimeRange,
} from "../src/services/api/apiMetrics";

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("apiMetrics", () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();

    // Intercept sqlRun to capture inserts into the in-memory table
    const { sqlRun } = require("../src/server/libsqlDb");
    (sqlRun as jest.Mock).mockImplementation(async (sql: string, args: unknown[] = []) => {
      if (sql.startsWith("INSERT INTO api_metrics")) {
        apiMetricRows.push({
          id: args[0],
          endpoint: args[1],
          method: args[2],
          status_code: args[3],
          duration_ms: args[4],
          timestamp: args[5],
          user_id: args[6],
        });
      }
      return { rowsAffected: sql.startsWith("INSERT") ? 1 : 0 };
    });
  });

  // ── trackApiCall ──────────────────────────────────────────────────────

  test("trackApiCall inserts a row with correct fields", async () => {
    await trackApiCall("/api/analyze", "GET", 200, 45.3, "user-1");
    expect(apiMetricRows).toHaveLength(1);
    const row = apiMetricRows[0];
    expect(row.endpoint).toBe("/api/analyze");
    expect(row.method).toBe("GET");
    expect(row.status_code).toBe(200);
    expect(row.duration_ms).toBe(45.3);
    expect(row.user_id).toBe("user-1");
    expect(typeof row.id).toBe("string");
    expect(typeof row.timestamp).toBe("number");
  });

  test("trackApiCall normalises method to uppercase", async () => {
    await trackApiCall("/api/fba", "post", 201, 100);
    expect(apiMetricRows[0].method).toBe("POST");
  });

  test("trackApiCall allows null userId", async () => {
    await trackApiCall("/api/kegg", "GET", 200, 12);
    expect(apiMetricRows[0].user_id).toBeNull();
  });

  test("trackApiCall rejects empty endpoint", async () => {
    await expect(trackApiCall("", "GET", 200, 10)).rejects.toThrow("endpoint is required");
  });

  test("trackApiCall rejects empty method", async () => {
    await expect(trackApiCall("/api/test", "", 200, 10)).rejects.toThrow("method is required");
  });

  test("trackApiCall rejects invalid statusCode", async () => {
    await expect(trackApiCall("/api/test", "GET", 99, 10)).rejects.toThrow(
      "statusCode must be an integer between 100 and 599",
    );
    await expect(trackApiCall("/api/test", "GET", 600, 10)).rejects.toThrow(
      "statusCode must be an integer between 100 and 599",
    );
  });

  test("trackApiCall rejects negative durationMs", async () => {
    await expect(trackApiCall("/api/test", "GET", 200, -5)).rejects.toThrow(
      "durationMs must be a non-negative number",
    );
  });

  // ── getApiMetrics ─────────────────────────────────────────────────────

  test("getApiMetrics returns correct aggregates", async () => {
    // Seed data
    await trackApiCall("/api/a", "GET", 200, 100);
    await trackApiCall("/api/a", "GET", 200, 200);
    await trackApiCall("/api/b", "POST", 500, 300);

    // All timestamps are Date.now(), so use a wide range
    const now = Date.now();
    const range: TimeRange = { start: now - 60_000, end: now + 60_000 };

    const metrics = await getApiMetrics(range);
    expect(metrics.totalCalls).toBe(3);
    expect(metrics.avgDuration).toBe(200); // (100+200+300)/3
    expect(metrics.errorRate).toBeCloseTo(1 / 3, 4);
    expect(metrics.topEndpoints).toHaveLength(2);
    expect(metrics.topEndpoints[0].endpoint).toBe("/api/a");
    expect(metrics.topEndpoints[0].count).toBe(2);
  });

  test("getApiMetrics returns zeros for empty range", async () => {
    const range: TimeRange = { start: 0, end: 1 };
    const metrics = await getApiMetrics(range);
    expect(metrics.totalCalls).toBe(0);
    expect(metrics.avgDuration).toBe(0);
    expect(metrics.errorRate).toBe(0);
    expect(metrics.topEndpoints).toHaveLength(0);
  });

  test("getApiMetrics rejects invalid range", async () => {
    await expect(getApiMetrics({ start: 100, end: 50 })).rejects.toThrow(
      "timeRange.start must be less than timeRange.end",
    );
  });

  // ── getEndpointStats ──────────────────────────────────────────────────

  test("getEndpointStats returns correct stats for an endpoint", async () => {
    await trackApiCall("/api/fba", "GET", 200, 10);
    await trackApiCall("/api/fba", "GET", 200, 20);
    await trackApiCall("/api/fba", "POST", 200, 30);
    await trackApiCall("/api/fba", "GET", 500, 40);

    const stats = await getEndpointStats("/api/fba");
    expect(stats.calls).toBe(4);
    expect(stats.avgDuration).toBe(25); // (10+20+30+40)/4
    expect(stats.errorRate).toBe(0.25);
    // p95: 4 items, index = floor(4*0.95) = 3 → duration 40
    expect(stats.p95Duration).toBe(40);
  });

  test("getEndpointStats respects timeRange filter", async () => {
    // Insert with timestamps that we control by mocking
    const { sqlGet, sqlAll } = require("../src/server/libsqlDb");

    // Pre-populate with known timestamps
    apiMetricRows.push(
      { id: "1", endpoint: "/api/x", method: "GET", status_code: 200, duration_ms: 50, timestamp: 1000, user_id: null },
      { id: "2", endpoint: "/api/x", method: "GET", status_code: 200, duration_ms: 60, timestamp: 2000, user_id: null },
      { id: "3", endpoint: "/api/x", method: "GET", status_code: 200, duration_ms: 70, timestamp: 3000, user_id: null },
    );

    // Query only the middle record
    const stats = await getEndpointStats("/api/x", { start: 1500, end: 2500 });
    expect(stats.calls).toBe(1);
    expect(stats.avgDuration).toBe(60);
  });

  test("getEndpointStats returns zeros for unknown endpoint", async () => {
    const stats = await getEndpointStats("/api/nonexistent");
    expect(stats.calls).toBe(0);
    expect(stats.avgDuration).toBe(0);
    expect(stats.p95Duration).toBe(0);
    expect(stats.errorRate).toBe(0);
  });

  test("getEndpointStats rejects empty endpoint", async () => {
    await expect(getEndpointStats("")).rejects.toThrow("endpoint is required");
  });

  test("getEndpointStats rejects invalid timeRange", async () => {
    await expect(getEndpointStats("/api/test", { start: 100, end: 50 })).rejects.toThrow(
      "timeRange.start must be less than timeRange.end",
    );
  });
});
