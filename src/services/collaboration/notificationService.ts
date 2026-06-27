/**
 * Notification service — in-app notifications for collaboration events.
 *
 * Uses libsql (Turso) via the shared libsqlDb helpers. One table:
 *   notifications — per-user notification records with read/unread state
 *
 * All timestamps are epoch milliseconds (consistent with workbenchDb).
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "mention"
  | "comment"
  | "assignment"
  | "review"
  | "system"
  | "alert";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: number;
}

// ── Schema ─────────────────────────────────────────────────────────────────────

let schemaReady = false;

export async function ensureNotificationSchema(): Promise<void> {
  if (schemaReady) return;

  await sqlRun("PRAGMA journal_mode = WAL");
  await sqlRun("PRAGMA foreign_keys = ON");

  await sqlBatch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          link TEXT,
          read INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )
      `,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, read, created_at DESC)",
    },
  ]);

  schemaReady = true;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create a new notification for a user.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
): Promise<Notification> {
  await ensureNotificationSchema();

  const id = randomUUID();
  const timestamp = Date.now();

  await sqlRun(
    `INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, userId, type, title, body, link ?? null, timestamp],
  );

  return {
    id,
    userId,
    type,
    title,
    body,
    link: link ?? null,
    read: false,
    createdAt: timestamp,
  };
}

/**
 * Get notifications for a user, optionally filtered to unread only.
 * Results are ordered by created_at descending (newest first).
 */
export async function getNotifications(
  userId: string,
  unreadOnly = false,
): Promise<Notification[]> {
  await ensureNotificationSchema();

  const sql = unreadOnly
    ? `SELECT id, user_id, type, title, body, link, read, created_at
       FROM notifications
       WHERE user_id = ? AND read = 0
       ORDER BY created_at DESC`
    : `SELECT id, user_id, type, title, body, link, read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`;

  const rows = await sqlAll(sql, [userId]);

  return rows.map(mapRowToNotification);
}

/**
 * Mark a single notification as read.
 * Throws if the notification does not exist.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  await ensureNotificationSchema();

  const result = await sqlRun(
    "UPDATE notifications SET read = 1 WHERE id = ?",
    [notificationId],
  );

  if (result.rowsAffected === 0) {
    throw new Error(`Notification not found: ${notificationId}`);
  }
}

/**
 * Mark all unread notifications for a user as read.
 * Returns the number of notifications marked.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  await ensureNotificationSchema();

  const result = await sqlRun(
    "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0",
    [userId],
  );

  return result.rowsAffected;
}

/**
 * Get the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  await ensureNotificationSchema();

  const row = await sqlGet(
    "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read = 0",
    [userId],
  );

  return (row?.count as number) ?? 0;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapRowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as NotificationType,
    title: row.title as string,
    body: row.body as string,
    link: (row.link as string) ?? null,
    read: Boolean(row.read),
    createdAt: row.created_at as number,
  };
}
