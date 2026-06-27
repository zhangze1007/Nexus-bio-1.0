/** @jest-environment node */
/**
 * notificationService — integration tests for the notification service.
 *
 * Uses a local file-based SQLite database via libsqlDb.
 * Cleans up test data between runs to ensure isolation.
 */

import {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  ensureNotificationSchema,
} from "../src/services/collaboration/notificationService";
import type { NotificationType } from "../src/services/collaboration/notificationService";
import { closeLibsqlClient, sqlRun } from "../src/server/libsqlDb";

const TEST_USER = "test-notif-user-1";
const TEST_USER_2 = "test-notif-user-2";

afterAll(() => {
  closeLibsqlClient();
});

describe("notificationService", () => {
  beforeAll(async () => {
    await ensureNotificationSchema();
  });

  beforeEach(async () => {
    // Clean up test data before each test.
    await sqlRun("DELETE FROM notifications WHERE user_id IN (?, ?)", [TEST_USER, TEST_USER_2]);
  });

  // ── createNotification ─────────────────────────────────────────────────────

  test("createNotification returns a notification with correct fields", async () => {
    const notif = await createNotification(
      TEST_USER,
      "mention",
      "You were mentioned",
      "Alice mentioned you in a comment on FBA run #42",
      "/tools/fbasim?run=42",
    );

    expect(notif.id).toBeDefined();
    expect(typeof notif.id).toBe("string");
    expect(notif.userId).toBe(TEST_USER);
    expect(notif.type).toBe("mention");
    expect(notif.title).toBe("You were mentioned");
    expect(notif.body).toBe("Alice mentioned you in a comment on FBA run #42");
    expect(notif.link).toBe("/tools/fbasim?run=42");
    expect(notif.read).toBe(false);
    expect(notif.createdAt).toBeGreaterThan(0);
  });

  test("createNotification works without optional link", async () => {
    const notif = await createNotification(
      TEST_USER,
      "system",
      "System maintenance",
      "Scheduled maintenance at 2 AM UTC",
    );

    expect(notif.link).toBeNull();
    expect(notif.type).toBe("system");
  });

  test("createNotification persists to database", async () => {
    await createNotification(TEST_USER, "alert", "Test Alert", "Something happened");

    const notifs = await getNotifications(TEST_USER);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe("Test Alert");
    expect(notifs[0].type).toBe("alert");
  });

  // ── getNotifications ──────────────────────────────────────────────────────

  test("getNotifications returns empty array when no notifications exist", async () => {
    const notifs = await getNotifications("nonexistent-user");
    expect(notifs).toEqual([]);
  });

  test("getNotifications returns notifications ordered by newest first", async () => {
    await createNotification(TEST_USER, "comment", "First", "Older notification");
    // Small delay to ensure distinct timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createNotification(TEST_USER, "comment", "Second", "Newer notification");

    const notifs = await getNotifications(TEST_USER);
    expect(notifs).toHaveLength(2);
    expect(notifs[0].title).toBe("Second");
    expect(notifs[1].title).toBe("First");
  });

  test("getNotifications with unreadOnly filters correctly", async () => {
    const notif1 = await createNotification(TEST_USER, "mention", "Unread", "Not read yet");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createNotification(TEST_USER, "comment", "Also unread", "Also not read");

    // Mark the first one as read
    await markAsRead(notif1.id);

    const unreadOnly = await getNotifications(TEST_USER, true);
    expect(unreadOnly).toHaveLength(1);
    expect(unreadOnly[0].title).toBe("Also unread");
    expect(unreadOnly[0].read).toBe(false);

    // All notifications should still be 2
    const all = await getNotifications(TEST_USER, false);
    expect(all).toHaveLength(2);
  });

  test("getNotifications does not return notifications from other users", async () => {
    await createNotification(TEST_USER, "system", "User 1 notif", "For user 1");
    await createNotification(TEST_USER_2, "system", "User 2 notif", "For user 2");

    const user1Notifs = await getNotifications(TEST_USER);
    expect(user1Notifs).toHaveLength(1);
    expect(user1Notifs[0].title).toBe("User 1 notif");

    const user2Notifs = await getNotifications(TEST_USER_2);
    expect(user2Notifs).toHaveLength(1);
    expect(user2Notifs[0].title).toBe("User 2 notif");
  });

  // ── markAsRead ────────────────────────────────────────────────────────────

  test("markAsRead marks a notification as read", async () => {
    const notif = await createNotification(TEST_USER, "review", "Review requested", "Review PR #7");
    expect(notif.read).toBe(false);

    await markAsRead(notif.id);

    const notifs = await getNotifications(TEST_USER);
    expect(notifs[0].read).toBe(true);
  });

  test("markAsRead throws for nonexistent notification", async () => {
    await expect(
      markAsRead("nonexistent-notif-id"),
    ).rejects.toThrow("Notification not found");
  });

  // ── markAllAsRead ─────────────────────────────────────────────────────────

  test("markAllAsRead marks all unread notifications as read", async () => {
    await createNotification(TEST_USER, "mention", "Notif 1", "Body 1");
    await createNotification(TEST_USER, "comment", "Notif 2", "Body 2");
    await createNotification(TEST_USER, "alert", "Notif 3", "Body 3");

    const marked = await markAllAsRead(TEST_USER);
    expect(marked).toBe(3);

    const unread = await getUnreadCount(TEST_USER);
    expect(unread).toBe(0);
  });

  test("markAllAsRead returns 0 when no unread notifications exist", async () => {
    const marked = await markAllAsRead("user-with-no-notifs");
    expect(marked).toBe(0);
  });

  // ── getUnreadCount ────────────────────────────────────────────────────────

  test("getUnreadCount returns correct count", async () => {
    await createNotification(TEST_USER, "mention", "N1", "B1");
    await createNotification(TEST_USER, "comment", "N2", "B2");
    await createNotification(TEST_USER, "system", "N3", "B3");

    expect(await getUnreadCount(TEST_USER)).toBe(3);

    // Mark one as read
    const notifs = await getNotifications(TEST_USER);
    await markAsRead(notifs[0].id);

    expect(await getUnreadCount(TEST_USER)).toBe(2);
  });

  test("getUnreadCount returns 0 for user with no notifications", async () => {
    expect(await getUnreadCount("empty-user")).toBe(0);
  });

  // ── Notification types ────────────────────────────────────────────────────

  test("createNotification supports all notification types", async () => {
    const types: NotificationType[] = ["mention", "comment", "assignment", "review", "system", "alert"];

    for (const type of types) {
      await createNotification(TEST_USER, type, `Type: ${type}`, `Body for ${type}`);
    }

    const notifs = await getNotifications(TEST_USER);
    expect(notifs).toHaveLength(types.length);

    const storedTypes = notifs.map((n) => n.type).sort();
    expect(storedTypes).toEqual([...types].sort());
  });
});
