/** @jest-environment node */
/**
 * presenceService — integration tests for the user presence service.
 *
 * Uses a local file-based SQLite database via libsqlDb.
 * Cleans up test data between runs to ensure isolation.
 */

import {
  setPresence,
  getPresence,
  clearPresence,
  ensurePresenceSchema,
} from "../src/services/collaboration/presenceService";
import type { CursorPosition, PresenceStatus } from "../src/services/collaboration/presenceService";
import { closeLibsqlClient, sqlRun } from "../src/server/libsqlDb";

const TEST_USER = "test-presence-user-1";
const TEST_USER_2 = "test-presence-user-2";
const TEST_USER_3 = "test-presence-user-3";
const TEST_PROJECT = "test-presence-project-1";
const TEST_PROJECT_2 = "test-presence-project-2";

afterAll(() => {
  closeLibsqlClient();
});

describe("presenceService", () => {
  beforeAll(async () => {
    await ensurePresenceSchema();
  });

  beforeEach(async () => {
    // Clean up test data before each test.
    await sqlRun("DELETE FROM user_presence WHERE user_id IN (?, ?, ?)", [
      TEST_USER,
      TEST_USER_2,
      TEST_USER_3,
    ]);
  });

  // ── setPresence ─────────────────────────────────────────────────────────────

  test("setPresence creates a presence record", async () => {
    await setPresence(TEST_USER, TEST_PROJECT, "online");

    const presences = await getPresence(TEST_PROJECT);
    expect(presences).toHaveLength(1);
    expect(presences[0].userId).toBe(TEST_USER);
    expect(presences[0].projectId).toBe(TEST_PROJECT);
    expect(presences[0].status).toBe("online");
    expect(presences[0].cursor).toBeNull();
    expect(presences[0].lastSeenAt).toBeGreaterThan(0);
  });

  test("setPresence stores cursor position when provided", async () => {
    const cursor: CursorPosition = { x: 150.5, y: 275.3, tool: "fbasim" };
    await setPresence(TEST_USER, TEST_PROJECT, "online", cursor);

    const presences = await getPresence(TEST_PROJECT);
    expect(presences).toHaveLength(1);
    expect(presences[0].cursor).toEqual({ x: 150.5, y: 275.3, tool: "fbasim" });
  });

  test("setPresence upserts on duplicate (user_id, project_id)", async () => {
    await setPresence(TEST_USER, TEST_PROJECT, "online");
    await new Promise((resolve) => setTimeout(resolve, 10));

    const cursor: CursorPosition = { x: 10, y: 20, tool: "catdes" };
    await setPresence(TEST_USER, TEST_PROJECT, "idle", cursor);

    const presences = await getPresence(TEST_PROJECT);
    expect(presences).toHaveLength(1);
    expect(presences[0].status).toBe("idle");
    expect(presences[0].cursor).toEqual({ x: 10, y: 20, tool: "catdes" });
  });

  test("setPresence clears cursor when called without cursor argument", async () => {
    const cursor: CursorPosition = { x: 50, y: 60, tool: "cethx" };
    await setPresence(TEST_USER, TEST_PROJECT, "online", cursor);

    // Update without cursor — should clear it
    await setPresence(TEST_USER, TEST_PROJECT, "idle");

    const presences = await getPresence(TEST_PROJECT);
    expect(presences[0].cursor).toBeNull();
    expect(presences[0].status).toBe("idle");
  });

  test("setPresence supports all status values", async () => {
    const statuses: PresenceStatus[] = ["online", "idle", "away", "offline"];

    for (const status of statuses) {
      await setPresence(TEST_USER, TEST_PROJECT, status);
      const presences = await getPresence(TEST_PROJECT);
      expect(presences[0].status).toBe(status);
    }
  });

  // ── getPresence ─────────────────────────────────────────────────────────────

  test("getPresence returns empty array when no presence exists", async () => {
    const presences = await getPresence("nonexistent-project");
    expect(presences).toEqual([]);
  });

  test("getPresence returns only entries for the specified project", async () => {
    await setPresence(TEST_USER, TEST_PROJECT, "online");
    await setPresence(TEST_USER_2, TEST_PROJECT, "idle");
    await setPresence(TEST_USER, TEST_PROJECT_2, "away");

    const proj1 = await getPresence(TEST_PROJECT);
    expect(proj1).toHaveLength(2);
    const proj1Ids = proj1.map((p) => p.userId).sort();
    expect(proj1Ids).toEqual([TEST_USER, TEST_USER_2].sort());

    const proj2 = await getPresence(TEST_PROJECT_2);
    expect(proj2).toHaveLength(1);
    expect(proj2[0].userId).toBe(TEST_USER);
  });

  test("getPresence orders results by last_seen_at descending", async () => {
    await setPresence(TEST_USER, TEST_PROJECT, "online");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await setPresence(TEST_USER_2, TEST_PROJECT, "online");

    const presences = await getPresence(TEST_PROJECT);
    expect(presences).toHaveLength(2);
    // Most recently active user should come first
    expect(presences[0].userId).toBe(TEST_USER_2);
    expect(presences[1].userId).toBe(TEST_USER);
  });

  test("getPresence filters out expired entries (older than 5 minutes)", async () => {
    // Insert a record with a stale last_seen_at (6 minutes ago).
    const staleTime = Date.now() - 6 * 60 * 1000;
    await sqlRun(
      `INSERT INTO user_presence (user_id, project_id, status, cursor_x, cursor_y, cursor_tool, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [TEST_USER_3, TEST_PROJECT, "online", null, null, null, staleTime],
    );

    // Insert a fresh record.
    await setPresence(TEST_USER, TEST_PROJECT, "online");

    const presences = await getPresence(TEST_PROJECT);
    expect(presences).toHaveLength(1);
    expect(presences[0].userId).toBe(TEST_USER);
  });

  test("getPresence returns multiple users with different cursors", async () => {
    await setPresence(TEST_USER, TEST_PROJECT, "online", { x: 100, y: 200, tool: "fbasim" });
    await setPresence(TEST_USER_2, TEST_PROJECT, "idle", { x: 300, y: 400, tool: "proevol" });

    const presences = await getPresence(TEST_PROJECT);
    expect(presences).toHaveLength(2);

    const byUser = Object.fromEntries(presences.map((p) => [p.userId, p]));
    expect(byUser[TEST_USER].cursor).toEqual({ x: 100, y: 200, tool: "fbasim" });
    expect(byUser[TEST_USER_2].cursor).toEqual({ x: 300, y: 400, tool: "proevol" });
  });

  // ── clearPresence ───────────────────────────────────────────────────────────

  test("clearPresence removes all presence records for a user", async () => {
    await setPresence(TEST_USER, TEST_PROJECT, "online");
    await setPresence(TEST_USER, TEST_PROJECT_2, "idle");

    await clearPresence(TEST_USER);

    const proj1 = await getPresence(TEST_PROJECT);
    const proj2 = await getPresence(TEST_PROJECT_2);
    expect(proj1).toHaveLength(0);
    expect(proj2).toHaveLength(0);
  });

  test("clearPresence does not affect other users", async () => {
    await setPresence(TEST_USER, TEST_PROJECT, "online");
    await setPresence(TEST_USER_2, TEST_PROJECT, "idle");

    await clearPresence(TEST_USER);

    const presences = await getPresence(TEST_PROJECT);
    expect(presences).toHaveLength(1);
    expect(presences[0].userId).toBe(TEST_USER_2);
  });

  test("clearPresence is a no-op for a user with no presence records", async () => {
    // Should not throw
    await clearPresence("nonexistent-user");

    const presences = await getPresence(TEST_PROJECT);
    expect(presences).toHaveLength(0);
  });
});
