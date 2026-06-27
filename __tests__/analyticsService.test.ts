/** @jest-environment node */

/**
 * Unit tests for the Analytics Service.
 *
 * Mocks the libsqlDb layer with in-memory tables so tests run without
 * a real database.
 */

/* ------------------------------------------------------------------ */
/*  In-memory mock tables                                              */
/* ------------------------------------------------------------------ */

const analyticsRows: Record<string, unknown>[] = [];

function resetTables(): void {
  analyticsRows.length = 0;
}

jest.mock("../src/server/libsqlDb", () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // Top events query
    if (sql.includes("GROUP BY event") && sql.includes("ORDER BY count DESC")) {
      const userId = args[0] as string;
      const cutoff = args[1] as number;
      const filtered = analyticsRows.filter(
        (r) => r.user_id === userId && (r.timestamp as number) >= cutoff,
      );
      const eventCounts = new Map<string, number>();
      for (const row of filtered) {
        const ev = row.event as string;
        eventCounts.set(ev, (eventCounts.get(ev) ?? 0) + 1);
      }
      return Array.from(eventCounts.entries())
        .map(([event, count]) => ({ event, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    // Daily counts query
    if (sql.includes("strftime")) {
      const userId = args[0] as string;
      const cutoff = args[1] as number;
      const filtered = analyticsRows.filter(
        (r) => r.user_id === userId && (r.timestamp as number) >= cutoff,
      );
      const dailyCounts = new Map<string, number>();
      for (const row of filtered) {
        const d = new Date(row.timestamp as number);
        const dateStr = d.toISOString().slice(0, 10);
        dailyCounts.set(dateStr, (dailyCounts.get(dateStr) ?? 0) + 1);
      }
      return Array.from(dailyCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return [];
  }),

  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    // Stats query — COUNT(*) and COUNT(DISTINCT user_id)
    if (sql.includes("COUNT(DISTINCT user_id)")) {
      const event = args[0] as string;
      const start = args[1] as number;
      const end = args[2] as number;
      const filtered = analyticsRows.filter(
        (r) => r.event === event && (r.timestamp as number) >= start && (r.timestamp as number) < end,
      );
      const uniqueUsers = new Set(filtered.map((r) => r.user_id)).size;
      return { total: filtered.length, uniqueUsers };
    }

    // Previous period count (for trend)
    if (sql.includes("COUNT(*) as total") && args.length === 3) {
      const event = args[0] as string;
      const start = args[1] as number;
      const end = args[2] as number;
      const filtered = analyticsRows.filter(
        (r) => r.event === event && (r.timestamp as number) >= start && (r.timestamp as number) < end,
      );
      return { total: filtered.length };
    }

    // User activity summary
    if (sql.includes("COUNT(DISTINCT event)")) {
      const userId = args[0] as string;
      const cutoff = args[1] as number;
      const filtered = analyticsRows.filter(
        (r) => r.user_id === userId && (r.timestamp as number) >= cutoff,
      );
      return { totalEvents: filtered.length, uniqueEvents: new Set(filtered.map((r) => r.event)).size };
    }

    return undefined;
  }),

  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes("CREATE TABLE")) return { rowsAffected: 0 };
    if (sql.includes("CREATE INDEX")) return { rowsAffected: 0 };
    if (sql.includes("PRAGMA")) return { rowsAffected: 0 };

    if (sql.includes("INSERT INTO analytics_events")) {
      analyticsRows.push({
        id: args[0],
        user_id: args[1],
        event: args[2],
        properties_json: args[3],
        timestamp: args[4],
        session_id: args[5],
      });
      return { rowsAffected: 1 };
    }

    return { rowsAffected: 0 };
  }),

  sqlBatch: jest.fn(async () => {}),
}));

// Import after mock
import {
  trackEvent,
  getEventStats,
  getUserActivity,
  ensureSchema,
} from "../src/services/business/analyticsService";

describe("analyticsService", () => {
  beforeEach(async () => {
    resetTables();
    // Reset schemaReady flag by calling ensureSchema
    await ensureSchema();
  });

  /* ---------------------------------------------------------------- */
  /*  trackEvent                                                       */
  /* ---------------------------------------------------------------- */

  describe("trackEvent", () => {
    it("stores an event with all fields", async () => {
      await trackEvent("user-1", "page_view", { page: "/tools/fbasim" }, "sess-abc");

      expect(analyticsRows).toHaveLength(1);
      expect(analyticsRows[0].user_id).toBe("user-1");
      expect(analyticsRows[0].event).toBe("page_view");
      expect(analyticsRows[0].properties_json).toBe('{"page":"/tools/fbasim"}');
      expect(analyticsRows[0].session_id).toBe("sess-abc");
    });

    it("stores an event without optional properties", async () => {
      await trackEvent("user-2", "tool_run");

      expect(analyticsRows).toHaveLength(1);
      expect(analyticsRows[0].properties_json).toBeNull();
      expect(analyticsRows[0].session_id).toBeNull();
    });

    it("stores an event with sessionId only", async () => {
      await trackEvent("user-3", "button_click", undefined, "sess-xyz");

      expect(analyticsRows).toHaveLength(1);
      expect(analyticsRows[0].session_id).toBe("sess-xyz");
    });

    it("throws on empty userId", async () => {
      await expect(trackEvent("", "event")).rejects.toThrow("userId is required");
    });

    it("throws on empty event", async () => {
      await expect(trackEvent("user-1", "")).rejects.toThrow("event is required");
    });

    it("trims whitespace from userId and event", async () => {
      await trackEvent("  user-4  ", "  click  ");

      expect(analyticsRows[0].user_id).toBe("user-4");
      expect(analyticsRows[0].event).toBe("click");
    });
  });

  /* ---------------------------------------------------------------- */
  /*  getEventStats                                                    */
  /* ---------------------------------------------------------------- */

  describe("getEventStats", () => {
    it("returns zero stats for empty data", async () => {
      const stats = await getEventStats("page_view", { start: 0, end: 1000 });

      expect(stats.total).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.trend).toBe(0);
    });

    it("counts total and unique users correctly", async () => {
      analyticsRows.push(
        { id: "1", user_id: "u1", event: "click", timestamp: 100, properties_json: null, session_id: null },
        { id: "2", user_id: "u1", event: "click", timestamp: 200, properties_json: null, session_id: null },
        { id: "3", user_id: "u2", event: "click", timestamp: 300, properties_json: null, session_id: null },
      );

      const stats = await getEventStats("click", { start: 50, end: 400 });

      expect(stats.total).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
    });

    it("computes positive trend", async () => {
      // Previous period: 2 events
      analyticsRows.push(
        { id: "1", user_id: "u1", event: "run", timestamp: 100, properties_json: null, session_id: null },
        { id: "2", user_id: "u2", event: "run", timestamp: 200, properties_json: null, session_id: null },
      );
      // Current period: 4 events (100% increase)
      analyticsRows.push(
        { id: "3", user_id: "u1", event: "run", timestamp: 1100, properties_json: null, session_id: null },
        { id: "4", user_id: "u2", event: "run", timestamp: 1200, properties_json: null, session_id: null },
        { id: "5", user_id: "u3", event: "run", timestamp: 1300, properties_json: null, session_id: null },
        { id: "6", user_id: "u4", event: "run", timestamp: 1400, properties_json: null, session_id: null },
      );

      const stats = await getEventStats("run", { start: 1000, end: 2000 });

      expect(stats.total).toBe(4);
      expect(stats.trend).toBe(100);
    });

    it("throws on empty event name", async () => {
      await expect(getEventStats("", { start: 0, end: 100 })).rejects.toThrow("event is required");
    });

    it("throws on invalid time range", async () => {
      await expect(getEventStats("click", { start: 500, end: 100 })).rejects.toThrow(
        "timeRange.start must be less than timeRange.end",
      );
    });
  });

  /* ---------------------------------------------------------------- */
  /*  getUserActivity                                                  */
  /* ---------------------------------------------------------------- */

  describe("getUserActivity", () => {
    it("returns zeroed summary for user with no events", async () => {
      const summary = await getUserActivity("ghost-user", 30);

      expect(summary.totalEvents).toBe(0);
      expect(summary.uniqueEvents).toBe(0);
      expect(summary.topEvents).toEqual([]);
      expect(summary.dailyCounts).toEqual([]);
    });

    it("returns correct totals and unique event count", async () => {
      const now = Date.now();
      analyticsRows.push(
        { id: "1", user_id: "u1", event: "page_view", timestamp: now - 1000, properties_json: null, session_id: null },
        { id: "2", user_id: "u1", event: "page_view", timestamp: now - 2000, properties_json: null, session_id: null },
        { id: "3", user_id: "u1", event: "tool_run", timestamp: now - 3000, properties_json: null, session_id: null },
      );

      const summary = await getUserActivity("u1", 1);

      expect(summary.totalEvents).toBe(3);
      expect(summary.uniqueEvents).toBe(2);
    });

    it("throws on empty userId", async () => {
      await expect(getUserActivity("", 7)).rejects.toThrow("userId is required");
    });

    it("throws on non-positive days", async () => {
      await expect(getUserActivity("u1", 0)).rejects.toThrow("days must be a positive number");
      await expect(getUserActivity("u1", -5)).rejects.toThrow("days must be a positive number");
    });
  });
});
