/** @jest-environment node */
/**
 * commentService — integration tests for the comment threading service.
 *
 * Uses a local file-based SQLite database via libsqlDb.
 * Cleans up test data between runs to ensure isolation.
 */

import {
  createThread,
  replyToThread,
  getThreads,
  resolveThread,
  getRecentActivity,
  ensureCommentSchema,
} from "../src/services/collaboration/commentService";
import { closeLibsqlClient, sqlRun } from "../src/server/libsqlDb";

const TEST_ENTITY_TYPE = "tool-run";
const TEST_ENTITY_ID = "test-entity-001";
const TEST_PROJECT_ID = "test-project-comments";
const TEST_USER = "test-user-1";
const TEST_USER_2 = "test-user-2";

afterAll(() => {
  closeLibsqlClient();
});

describe("commentService", () => {
  beforeAll(async () => {
    await ensureCommentSchema();
  });

  beforeEach(async () => {
    // Clean up test data — delete replies first (foreign key), then threads.
    await sqlRun("DELETE FROM comment_replies WHERE thread_id IN (SELECT id FROM comment_threads WHERE project_id = ?)", [TEST_PROJECT_ID]);
    await sqlRun("DELETE FROM comment_threads WHERE project_id = ?", [TEST_PROJECT_ID]);
  });

  // ── createThread ───────────────────────────────────────────────────────────

  test("createThread returns a thread with the initial reply", async () => {
    const thread = await createThread(
      TEST_ENTITY_TYPE,
      TEST_ENTITY_ID,
      TEST_PROJECT_ID,
      TEST_USER,
      "Initial comment on this FBA run",
    );

    expect(thread.id).toBeDefined();
    expect(thread.entityType).toBe(TEST_ENTITY_TYPE);
    expect(thread.entityId).toBe(TEST_ENTITY_ID);
    expect(thread.projectId).toBe(TEST_PROJECT_ID);
    expect(thread.createdBy).toBe(TEST_USER);
    expect(thread.resolved).toBe(false);
    expect(thread.createdAt).toBeGreaterThan(0);
    expect(thread.replies).toHaveLength(1);
    expect(thread.replies[0].message).toBe("Initial comment on this FBA run");
    expect(thread.replies[0].userId).toBe(TEST_USER);
  });

  test("createThread persists thread in database", async () => {
    const thread = await createThread(
      TEST_ENTITY_TYPE,
      "persist-test",
      TEST_PROJECT_ID,
      TEST_USER,
      "Persisted message",
    );

    const threads = await getThreads(TEST_ENTITY_TYPE, "persist-test");
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe(thread.id);
    expect(threads[0].replies[0].message).toBe("Persisted message");
  });

  // ── replyToThread ──────────────────────────────────────────────────────────

  test("replyToThread adds a reply to an existing thread", async () => {
    const thread = await createThread(
      TEST_ENTITY_TYPE,
      TEST_ENTITY_ID,
      TEST_PROJECT_ID,
      TEST_USER,
      "First message",
    );

    const reply = await replyToThread(thread.id, TEST_USER_2, "This is a reply");

    expect(reply.threadId).toBe(thread.id);
    expect(reply.userId).toBe(TEST_USER_2);
    expect(reply.message).toBe("This is a reply");
    expect(reply.createdAt).toBeGreaterThan(0);
  });

  test("replyToThread throws for nonexistent thread", async () => {
    await expect(
      replyToThread("nonexistent-thread-id", TEST_USER, "Hello"),
    ).rejects.toThrow("Thread not found");
  });

  // ── getThreads ─────────────────────────────────────────────────────────────

  test("getThreads returns empty array when no threads exist", async () => {
    const threads = await getThreads("nonexistent-type", "nonexistent-id");
    expect(threads).toEqual([]);
  });

  test("getThreads returns threads with replies in chronological order", async () => {
    const thread = await createThread(
      TEST_ENTITY_TYPE,
      "ordered-test",
      TEST_PROJECT_ID,
      TEST_USER,
      "First",
    );

    await replyToThread(thread.id, TEST_USER_2, "Second");
    await replyToThread(thread.id, TEST_USER, "Third");

    const threads = await getThreads(TEST_ENTITY_TYPE, "ordered-test");
    expect(threads).toHaveLength(1);
    expect(threads[0].replies).toHaveLength(3);
    expect(threads[0].replies[0].message).toBe("First");
    expect(threads[0].replies[1].message).toBe("Second");
    expect(threads[0].replies[2].message).toBe("Third");
  });

  test("getThreads returns multiple threads for the same entity", async () => {
    await createThread(TEST_ENTITY_TYPE, "multi-test", TEST_PROJECT_ID, TEST_USER, "Thread A");
    await createThread(TEST_ENTITY_TYPE, "multi-test", TEST_PROJECT_ID, TEST_USER_2, "Thread B");

    const threads = await getThreads(TEST_ENTITY_TYPE, "multi-test");
    expect(threads).toHaveLength(2);
    const messages = threads.map((t) => t.replies[0].message);
    expect(messages).toContain("Thread A");
    expect(messages).toContain("Thread B");
  });

  test("getThreads does not return threads from other entities", async () => {
    await createThread(TEST_ENTITY_TYPE, "entity-alpha", TEST_PROJECT_ID, TEST_USER, "Alpha thread");
    await createThread(TEST_ENTITY_TYPE, "entity-beta", TEST_PROJECT_ID, TEST_USER, "Beta thread");

    const alphaThreads = await getThreads(TEST_ENTITY_TYPE, "entity-alpha");
    expect(alphaThreads).toHaveLength(1);
    expect(alphaThreads[0].entityId).toBe("entity-alpha");
  });

  // ── resolveThread ──────────────────────────────────────────────────────────

  test("resolveThread marks a thread as resolved", async () => {
    const thread = await createThread(
      TEST_ENTITY_TYPE,
      "resolve-test",
      TEST_PROJECT_ID,
      TEST_USER,
      "Discussing bottleneck",
    );

    expect(thread.resolved).toBe(false);

    await resolveThread(thread.id);

    const threads = await getThreads(TEST_ENTITY_TYPE, "resolve-test");
    expect(threads[0].resolved).toBe(true);
  });

  test("resolveThread throws for nonexistent thread", async () => {
    await expect(
      resolveThread("nonexistent-thread-id"),
    ).rejects.toThrow("Thread not found");
  });

  // ── getRecentActivity ──────────────────────────────────────────────────────

  test("getRecentActivity returns activity for a project", async () => {
    await createThread(TEST_ENTITY_TYPE, "activity-1", TEST_PROJECT_ID, TEST_USER, "Check this flux");
    await createThread(TEST_ENTITY_TYPE, "activity-2", TEST_PROJECT_ID, TEST_USER_2, "Review growth rate");

    const activity = await getRecentActivity(TEST_PROJECT_ID);
    expect(activity.length).toBeGreaterThanOrEqual(2);
    expect(activity[0].projectId).toBe(TEST_PROJECT_ID);
    expect(activity[0].replyCount).toBeGreaterThanOrEqual(1);
  });

  test("getRecentActivity respects limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await createThread(TEST_ENTITY_TYPE, `limit-entity-${i}`, TEST_PROJECT_ID, TEST_USER, `Message ${i}`);
    }

    const activity = await getRecentActivity(TEST_PROJECT_ID, 3);
    expect(activity).toHaveLength(3);
  });

  test("getRecentActivity orders by most recent reply", async () => {
    const thread1 = await createThread(
      TEST_ENTITY_TYPE,
      "order-1",
      TEST_PROJECT_ID,
      TEST_USER,
      "Older thread",
    );

    // Small delay to ensure distinct timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    const thread2 = await createThread(
      TEST_ENTITY_TYPE,
      "order-2",
      TEST_PROJECT_ID,
      TEST_USER,
      "Newer thread",
    );

    // Reply to thread1 to make it most recent
    await new Promise((resolve) => setTimeout(resolve, 10));
    await replyToThread(thread1.id, TEST_USER_2, "Bumping thread 1");

    const activity = await getRecentActivity(TEST_PROJECT_ID);
    expect(activity.length).toBeGreaterThanOrEqual(2);
    // thread1 should now be first since it has the most recent reply
    expect(activity[0].threadId).toBe(thread1.id);
    expect(activity[0].lastMessage).toBe("Bumping thread 1");
  });

  test("getRecentActivity returns empty for project with no comments", async () => {
    const activity = await getRecentActivity("empty-project-xyz");
    expect(activity).toEqual([]);
  });
});
