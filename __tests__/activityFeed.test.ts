/** @jest-environment node */
/**
 * activityFeed — unit/integration tests for the activity feed service.
 *
 * Tests the core CRUD operations: log activity, retrieve feed, filter by type,
 * count, and input validation. Uses a local SQLite database via libsql.
 */

import {
  getActivityFeed,
  getActivityCount,
  getActivityFeedByType,
  logActivity,
  ensureActivityFeedSchema,
  type ActivityType,
} from "../src/services/collaboration/activityFeed";
import { closeLibsqlClient, sqlRun } from "../src/server/libsqlDb";

const TEST_PROJECT = "test-activity-project";
const TEST_USER = "user-abc-123";
const TEST_USER_NAME = "Dr. Jane Doe";

afterAll(() => {
  closeLibsqlClient();
});

describe("activityFeed", () => {
  beforeAll(async () => {
    await ensureActivityFeedSchema();
    // Clean up any leftover test data
    await sqlRun("DELETE FROM activity_feed WHERE project_id = ?", [TEST_PROJECT]);
  });

  afterEach(async () => {
    // Clean up between tests
    await sqlRun("DELETE FROM activity_feed WHERE project_id = ?", [TEST_PROJECT]);
  });

  // ── logActivity ──────────────────────────────────────────────────────────

  test("logActivity inserts an activity item", async () => {
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "experiment_created", {
      experimentId: "exp-001",
      name: "Artemisinin FBA run",
    });

    const items = await getActivityFeed(TEST_PROJECT);
    expect(items).toHaveLength(1);
    expect(items[0].projectId).toBe(TEST_PROJECT);
    expect(items[0].userId).toBe(TEST_USER);
    expect(items[0].userName).toBe(TEST_USER_NAME);
    expect(items[0].type).toBe("experiment_created");
    expect(items[0].details).toEqual({ experimentId: "exp-001", name: "Artemisinin FBA run" });
    expect(items[0].timestamp).toBeGreaterThan(0);
    expect(items[0].id).toBeDefined();
  });

  test("logActivity with empty details defaults to {}", async () => {
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "member_joined");

    const items = await getActivityFeed(TEST_PROJECT);
    expect(items).toHaveLength(1);
    expect(items[0].details).toEqual({});
    expect(items[0].type).toBe("member_joined");
  });

  test("logActivity throws on missing projectId", async () => {
    await expect(logActivity("", TEST_USER, TEST_USER_NAME, "task_completed")).rejects.toThrow(
      "logActivity: projectId is required",
    );
  });

  test("logActivity throws on missing userId", async () => {
    await expect(logActivity(TEST_PROJECT, "", TEST_USER_NAME, "task_completed")).rejects.toThrow(
      "logActivity: userId is required",
    );
  });

  test("logActivity throws on missing userName", async () => {
    await expect(logActivity(TEST_PROJECT, TEST_USER, "", "task_completed")).rejects.toThrow(
      "logActivity: userName is required",
    );
  });

  test("logActivity throws on missing type", async () => {
    await expect(logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "" as ActivityType)).rejects.toThrow(
      "logActivity: type is required",
    );
  });

  // ── getActivityFeed ──────────────────────────────────────────────────────

  test("getActivityFeed returns items ordered by timestamp descending", async () => {
    // Log three activities with deliberate ordering
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "experiment_created", { seq: 1 });
    // Small delay to ensure distinct timestamps
    await new Promise((r) => setTimeout(r, 10));
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "task_completed", { seq: 2 });
    await new Promise((r) => setTimeout(r, 10));
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "comment_added", { seq: 3 });

    const items = await getActivityFeed(TEST_PROJECT);
    expect(items).toHaveLength(3);
    // Newest first
    expect(items[0].type).toBe("comment_added");
    expect(items[1].type).toBe("task_completed");
    expect(items[2].type).toBe("experiment_created");
    // Timestamps should be non-increasing
    expect(items[0].timestamp).toBeGreaterThanOrEqual(items[1].timestamp);
    expect(items[1].timestamp).toBeGreaterThanOrEqual(items[2].timestamp);
  });

  test("getActivityFeed respects limit parameter", async () => {
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "experiment_created", {});
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "task_completed", {});
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "comment_added", {});

    const items = await getActivityFeed(TEST_PROJECT, 2);
    expect(items).toHaveLength(2);
  });

  test("getActivityFeed returns empty array for unknown project", async () => {
    const items = await getActivityFeed("nonexistent-project-xyz");
    expect(items).toEqual([]);
  });

  test("getActivityFeed throws on empty projectId", async () => {
    await expect(getActivityFeed("")).rejects.toThrow("getActivityFeed: projectId is required");
  });

  // ── getActivityFeedByType ────────────────────────────────────────────────

  test("getActivityFeedByType filters by activity type", async () => {
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "experiment_created", { id: "e1" });
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "task_completed", { id: "t1" });
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "experiment_created", { id: "e2" });
    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "comment_added", { id: "c1" });

    const experiments = await getActivityFeedByType(TEST_PROJECT, "experiment_created");
    expect(experiments).toHaveLength(2);
    expect(experiments.every((a) => a.type === "experiment_created")).toBe(true);

    const comments = await getActivityFeedByType(TEST_PROJECT, "comment_added");
    expect(comments).toHaveLength(1);
    expect(comments[0].type).toBe("comment_added");
  });

  // ── getActivityCount ─────────────────────────────────────────────────────

  test("getActivityCount returns correct count", async () => {
    expect(await getActivityCount(TEST_PROJECT)).toBe(0);

    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "file_uploaded", {});
    expect(await getActivityCount(TEST_PROJECT)).toBe(1);

    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "analysis_run", {});
    expect(await getActivityCount(TEST_PROJECT)).toBe(2);
  });

  test("getActivityCount returns 0 for unknown project", async () => {
    expect(await getActivityCount("nonexistent-count-project")).toBe(0);
  });

  // ── Multiple users ───────────────────────────────────────────────────────

  test("activities from different users are stored correctly", async () => {
    await logActivity(TEST_PROJECT, "user-1", "Alice", "experiment_created", { lab: "wet" });
    await logActivity(TEST_PROJECT, "user-2", "Bob", "task_completed", { task: "review" });

    const items = await getActivityFeed(TEST_PROJECT);
    expect(items).toHaveLength(2);

    const alice = items.find((a) => a.userId === "user-1");
    const bob = items.find((a) => a.userId === "user-2");
    expect(alice).toBeDefined();
    expect(alice!.userName).toBe("Alice");
    expect(bob).toBeDefined();
    expect(bob!.userName).toBe("Bob");
  });

  // ── Project isolation ────────────────────────────────────────────────────

  test("activities are isolated per project", async () => {
    const otherProject = "test-activity-other-project";
    try {
      await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "experiment_created", {});
      await logActivity(otherProject, TEST_USER, TEST_USER_NAME, "task_completed", {});

      const itemsA = await getActivityFeed(TEST_PROJECT);
      const itemsB = await getActivityFeed(otherProject);

      expect(itemsA).toHaveLength(1);
      expect(itemsA[0].type).toBe("experiment_created");
      expect(itemsB).toHaveLength(1);
      expect(itemsB[0].type).toBe("task_completed");
    } finally {
      await sqlRun("DELETE FROM activity_feed WHERE project_id = ?", [otherProject]);
    }
  });

  // ── Details round-trip ───────────────────────────────────────────────────

  test("complex details object survives round-trip", async () => {
    const complexDetails = {
      experimentId: "exp-999",
      metrics: { growthRate: 0.87, titer: 12.4 },
      tags: ["fba", "artemisinin"],
      nested: { deep: { value: true } },
    };

    await logActivity(TEST_PROJECT, TEST_USER, TEST_USER_NAME, "tool_executed", complexDetails);

    const items = await getActivityFeed(TEST_PROJECT);
    expect(items).toHaveLength(1);
    expect(items[0].details).toEqual(complexDetails);
  });
});
