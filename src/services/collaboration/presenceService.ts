/**
 * Presence service — tracks user online status and cursor positions per project.
 *
 * Uses libsql (Turso) via the shared libsqlDb helpers. One table:
 *   user_presence — per-user presence records with optional cursor coordinates
 *
 * Status lifecycle: online → idle → away → offline
 * Entries auto-expire after 5 minutes of inactivity (getPresence filters them out).
 * All timestamps are epoch milliseconds (consistent with workbenchDb).
 */

import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PresenceStatus = "online" | "idle" | "away" | "offline";

export interface CursorPosition {
  x: number;
  y: number;
  tool: string;
}

export interface Presence {
  userId: string;
  projectId: string;
  status: PresenceStatus;
  cursor: CursorPosition | null;
  lastSeenAt: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Presence entries older than this threshold are considered expired (5 minutes). */
const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000;

// ── Schema ─────────────────────────────────────────────────────────────────────

let schemaReady = false;

export async function ensurePresenceSchema(): Promise<void> {
  if (schemaReady) return;

  await sqlRun("PRAGMA journal_mode = WAL");
  await sqlRun("PRAGMA foreign_keys = ON");

  await sqlBatch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS user_presence (
          user_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'online',
          cursor_x REAL,
          cursor_y REAL,
          cursor_tool TEXT,
          last_seen_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, project_id)
        )
      `,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_presence_project ON user_presence (project_id, last_seen_at DESC)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence (project_id, status)",
    },
  ]);

  schemaReady = true;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Set or update a user's presence in a project.
 *
 * Upserts the presence record. If `cursor` is provided, the cursor position
 * is stored; otherwise cursor fields are cleared. `last_seen_at` is always
 * refreshed to the current time.
 */
export async function setPresence(
  userId: string,
  projectId: string,
  status: PresenceStatus,
  cursor?: CursorPosition,
): Promise<void> {
  await ensurePresenceSchema();

  const now = Date.now();

  await sqlRun(
    `INSERT INTO user_presence (user_id, project_id, status, cursor_x, cursor_y, cursor_tool, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, project_id) DO UPDATE SET
       status = excluded.status,
       cursor_x = excluded.cursor_x,
       cursor_y = excluded.cursor_y,
       cursor_tool = excluded.cursor_tool,
       last_seen_at = excluded.last_seen_at`,
    [userId, projectId, status, cursor?.x ?? null, cursor?.y ?? null, cursor?.tool ?? null, now],
  );
}

/**
 * Get all active presence records for a project.
 *
 * Returns only non-expired entries (last_seen_at within 5 minutes).
 * Entries that have gone stale are automatically cleaned up.
 * Ordered by last_seen_at descending (most recently active first).
 */
export async function getPresence(projectId: string): Promise<Presence[]> {
  await ensurePresenceSchema();

  const cutoff = Date.now() - INACTIVITY_THRESHOLD_MS;

  // Clean up expired entries for this project.
  await sqlRun("DELETE FROM user_presence WHERE project_id = ? AND last_seen_at < ?", [projectId, cutoff]);

  const rows = await sqlAll(
    `SELECT user_id, project_id, status, cursor_x, cursor_y, cursor_tool, last_seen_at
     FROM user_presence
     WHERE project_id = ?
     ORDER BY last_seen_at DESC`,
    [projectId],
  );

  return rows.map(mapRowToPresence);
}

/**
 * Clear a user's presence across all projects.
 *
 * Removes all presence records for the given user. Call this when a user
 * disconnects or logs out.
 */
export async function clearPresence(userId: string): Promise<void> {
  await ensurePresenceSchema();

  await sqlRun("DELETE FROM user_presence WHERE user_id = ?", [userId]);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapRowToPresence(row: Record<string, unknown>): Presence {
  const hasCursor = row.cursor_x !== null && row.cursor_y !== null && row.cursor_tool !== null;

  return {
    userId: row.user_id as string,
    projectId: row.project_id as string,
    status: row.status as PresenceStatus,
    cursor: hasCursor
      ? {
          x: row.cursor_x as number,
          y: row.cursor_y as number,
          tool: row.cursor_tool as string,
        }
      : null,
    lastSeenAt: row.last_seen_at as number,
  };
}
