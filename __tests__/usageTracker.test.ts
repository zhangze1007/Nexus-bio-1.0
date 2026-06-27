/**
 * Unit tests for usageTracker service.
 *
 * Tests trackUsage, getUsage, and checkLimit against an in-process
 * libsql (file-based SQLite) database. Validates schema creation,
 * input validation, aggregation, limit enforcement, and tier handling.
 */

import {
  trackUsage,
  getUsage,
  checkLimit,
  ensureUsageSchema,
  getNextMonthReset,
  getCurrentMonthStart,
  USAGE_RESOURCES,
  RESOURCE_COST_PER_UNIT,
  TIER_LIMITS,
  type UsageResource,
} from "../src/services/business/usageTracker";
import { sqlRun, sqlAll, closeLibsqlClient } from "../src/server/libsqlDb";

const TEST_USER = "test-user-001";
const TEST_USER_2 = "test-user-002";

beforeAll(async () => {
  await ensureUsageSchema();
});

afterAll(async () => {
  // Clean up test data
  await sqlRun("DELETE FROM usage_records WHERE user_id LIKE 'test-user-%'").catch(() => {});
  closeLibsqlClient();
});

beforeEach(async () => {
  // Clean test user records before each test
  await sqlRun("DELETE FROM usage_records WHERE user_id LIKE 'test-user-%'").catch(() => {});
});

describe("usageTracker", () => {
  // ─── trackUsage ──────────────────────────────────────────────────────────

  describe("trackUsage", () => {
    test("inserts a usage record successfully", async () => {
      await trackUsage(TEST_USER, "ai_queries", 1);

      const rows = await sqlAll(
        "SELECT * FROM usage_records WHERE user_id = ?",
        [TEST_USER],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe(TEST_USER);
      expect(rows[0].resource).toBe("ai_queries");
      expect(Number(rows[0].amount)).toBe(1);
    });

    test("rejects empty userId", async () => {
      await expect(trackUsage("", "ai_queries", 1)).rejects.toThrow("userId is required");
    });

    test("rejects invalid resource", async () => {
      await expect(trackUsage(TEST_USER, "invalid_resource", 1)).rejects.toThrow(
        'Invalid resource "invalid_resource"',
      );
    });

    test("rejects zero amount", async () => {
      await expect(trackUsage(TEST_USER, "ai_queries", 0)).rejects.toThrow(
        "amount must be a positive finite number",
      );
    });

    test("rejects negative amount", async () => {
      await expect(trackUsage(TEST_USER, "ai_queries", -5)).rejects.toThrow(
        "amount must be a positive finite number",
      );
    });

    test("rejects NaN amount", async () => {
      await expect(trackUsage(TEST_USER, "ai_queries", Number.NaN)).rejects.toThrow(
        "amount must be a positive finite number",
      );
    });

    test("accepts all valid resource types", async () => {
      for (const resource of USAGE_RESOURCES) {
        await trackUsage(TEST_USER, resource, 10);
      }
      const rows = await sqlAll(
        "SELECT DISTINCT resource FROM usage_records WHERE user_id = ?",
        [TEST_USER],
      );
      const resources = rows.map((r) => r.resource).sort();
      expect(resources).toEqual([...USAGE_RESOURCES].sort());
    });
  });

  // ─── getUsage ────────────────────────────────────────────────────────────

  describe("getUsage", () => {
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;
    const oneHourFromNow = now + 3_600_000;

    test("returns zero totals for user with no records", async () => {
      const summary = await getUsage("nonexistent-user", {
        start: oneHourAgo,
        end: oneHourFromNow,
      });

      expect(summary.totalCost).toBe(0);
      for (const resource of USAGE_RESOURCES) {
        expect(summary.byResource[resource].totalAmount).toBe(0);
        expect(summary.byResource[resource].cost).toBe(0);
      }
    });

    test("aggregates amounts by resource with correct costs", async () => {
      await trackUsage(TEST_USER, "ai_queries", 10);
      await trackUsage(TEST_USER, "ai_queries", 5);
      await trackUsage(TEST_USER, "fba_runs", 3);

      const summary = await getUsage(TEST_USER, {
        start: oneHourAgo,
        end: oneHourFromNow,
      });

      expect(summary.byResource.ai_queries.totalAmount).toBe(15);
      expect(summary.byResource.fba_runs.totalAmount).toBe(3);
      expect(summary.byResource.storage_bytes.totalAmount).toBe(0);

      const expectedAiCost = 15 * RESOURCE_COST_PER_UNIT.ai_queries;
      const expectedFbaCost = 3 * RESOURCE_COST_PER_UNIT.fba_runs;
      const expectedTotalCost = Math.round((expectedAiCost + expectedFbaCost) * 1_000_000) / 1_000_000;

      expect(summary.byResource.ai_queries.cost).toBeCloseTo(expectedAiCost, 6);
      expect(summary.byResource.fba_runs.cost).toBeCloseTo(expectedFbaCost, 6);
      expect(summary.totalCost).toBeCloseTo(expectedTotalCost, 6);
    });

    test("rejects empty userId", async () => {
      await expect(
        getUsage("", { start: oneHourAgo, end: oneHourFromNow }),
      ).rejects.toThrow("userId is required");
    });

    test("rejects invalid time range", async () => {
      await expect(
        getUsage(TEST_USER, { start: now, end: oneHourAgo }),
      ).rejects.toThrow("timeRange.start must be less than timeRange.end");
    });

    test("excludes records outside the time range", async () => {
      // Record with a timestamp far in the past (manually set)
      const oldTimestamp = now - 86_400_000 * 365; // 1 year ago
      await sqlRun(
        "INSERT INTO usage_records (id, user_id, resource, amount, timestamp) VALUES (?, ?, ?, ?, ?)",
        [`old-record-${TEST_USER}`, TEST_USER, "ai_queries", 999, oldTimestamp],
      );

      const summary = await getUsage(TEST_USER, {
        start: oneHourAgo,
        end: oneHourFromNow,
      });

      // Should not include the old record
      expect(summary.byResource.ai_queries.totalAmount).toBe(0);
    });

    test("isolates data between different users", async () => {
      await trackUsage(TEST_USER, "ai_queries", 10);
      await trackUsage(TEST_USER_2, "ai_queries", 20);

      const summary1 = await getUsage(TEST_USER, {
        start: oneHourAgo,
        end: oneHourFromNow,
      });
      const summary2 = await getUsage(TEST_USER_2, {
        start: oneHourAgo,
        end: oneHourFromNow,
      });

      expect(summary1.byResource.ai_queries.totalAmount).toBe(10);
      expect(summary2.byResource.ai_queries.totalAmount).toBe(20);
    });
  });

  // ─── checkLimit ──────────────────────────────────────────────────────────

  describe("checkLimit", () => {
    test("allows usage under free tier limit", async () => {
      const result = await checkLimit(TEST_USER, "ai_queries", "free");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(TIER_LIMITS.free.ai_queries);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    test("blocks usage when free tier limit is exceeded", async () => {
      // Record enough usage to exceed free tier limit
      const limit = TIER_LIMITS.free.fba_runs;
      await trackUsage(TEST_USER, "fba_runs", limit + 1);

      const result = await checkLimit(TEST_USER, "fba_runs", "free");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test("returns -1 remaining for unlimited team tier", async () => {
      await trackUsage(TEST_USER, "ai_queries", 10000);

      const result = await checkLimit(TEST_USER, "ai_queries", "team");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);
    });

    test("default tier is free", async () => {
      const result = await checkLimit(TEST_USER, "ai_queries");
      expect(result.remaining).toBe(TIER_LIMITS.free.ai_queries);
    });

    test("rejects empty userId", async () => {
      await expect(checkLimit("", "ai_queries")).rejects.toThrow("userId is required");
    });

    test("rejects invalid resource", async () => {
      await expect(checkLimit(TEST_USER, "bad_resource")).rejects.toThrow(
        'Invalid resource "bad_resource"',
      );
    });

    test("resetAt is always in the future", async () => {
      const result = await checkLimit(TEST_USER, "ai_queries", "free");
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    test("pro tier has higher limits than free tier", async () => {
      const freeResult = await checkLimit(TEST_USER, "ai_queries", "free");
      const proResult = await checkLimit(TEST_USER, "ai_queries", "pro");

      expect(proResult.remaining).toBeGreaterThan(freeResult.remaining);
    });
  });

  // ─── Helper functions ────────────────────────────────────────────────────

  describe("helper functions", () => {
    test("getNextMonthReset returns a future timestamp", () => {
      const reset = getNextMonthReset();
      expect(reset).toBeGreaterThan(Date.now());
    });

    test("getCurrentMonthStart returns a past or current timestamp", () => {
      const start = getCurrentMonthStart();
      expect(start).toBeLessThanOrEqual(Date.now());
    });

    test("current month start is before next month reset", () => {
      const start = getCurrentMonthStart();
      const reset = getNextMonthReset();
      expect(start).toBeLessThan(reset);
    });
  });
});
