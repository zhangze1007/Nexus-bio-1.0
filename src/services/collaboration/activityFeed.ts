/**
 * Activity Feed — collaborative project activity logging and retrieval.
 *
 * Stores user actions (experiment created, task completed, comment added,
 * file uploaded, etc.) per project. Uses libsql via the shared libsqlDb
 * helpers so it works with both local SQLite and remote Turso.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType =
  | "experiment_created"
  | "task_completed"
  | "comment_added"
  | "file_uploaded"
  | "analysis_run"
  | "member_joined"
  | "member_left"
  | "project_updated"
  | "tool_executed"
  | "evidence_added";

export interface ActivityItem {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  type: ActivityType;
  details: Record<string, unknown>;
  timestamp: number;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

let schemaReady = false;

const VALID_TABLE_NAMES = new Set(["activity_feed"]);

async function hasTable(tableName: string): Promise<boolean> {
  if (!VALID_TABLE_NAMES.has(tableName)) {
    throw new Error(`hasTable: invalid table name "${tableName}"`);
  }
  const row = await sqlGet("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName]);
  return Boolean(row);
}

export async function ensureActivityFeedSchema(): Promise<void> {
  if (schemaReady) return;

  const exists = await hasTable("activity_feed");
  if (!exists) {
    await sqlBatch([
      {
        sql: `
          CREATE TABLE IF NOT EXISTS activity_feed (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            type TEXT NOT NULL,
            details_json TEXT NOT NULL DEFAULT '{}',
            created_at INTEGER NOT NULL
          )
        `,
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS idx_activity_feed_project_created ON activity_feed (project_id, created_at DESC)",
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS idx_activity_feed_project_type ON activity_feed (project_id, type, created_at DESC)",
      },
    ]);
  }

  schemaReady = true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve the activity feed for a project, ordered by most recent first.
 *
 * @param projectId - The project to retrieve activities for.
 * @param limit - Maximum number of items to return (1–100, default 50).
 * @returns Array of activity items, newest first.
 */
export async function getActivityFeed(projectId: string, limit?: number): Promise<ActivityItem[]> {
  if (!projectId || projectId.trim().length === 0) {
    throw new Error("getActivityFeed: projectId is required");
  }

  const safeLimit = Math.max(1, Math.min(limit ?? 50, 100));
  await ensureActivityFeedSchema();

  const rows = await sqlAll(
    `SELECT id, project_id, user_id, user_name, type, details_json, created_at
     FROM activity_feed
     WHERE project_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [projectId.trim(), safeLimit],
  );

  return rows.map(mapRowToActivityItem);
}

/**
 * Log a new activity to the feed.
 *
 * @param projectId - The project this activity belongs to.
 * @param userId - The ID of the user performing the action.
 * @param userName - The display name of the user.
 * @param type - The type of activity.
 * @param details - Arbitrary details object (stored as JSON).
 */
export async function logActivity(
  projectId: string,
  userId: string,
  userName: string,
  type: ActivityType,
  details: Record<string, unknown> = {},
): Promise<void> {
  if (!projectId || projectId.trim().length === 0) {
    throw new Error("logActivity: projectId is required");
  }
  if (!userId || userId.trim().length === 0) {
    throw new Error("logActivity: userId is required");
  }
  if (!userName || userName.trim().length === 0) {
    throw new Error("logActivity: userName is required");
  }
  if (!type || type.trim().length === 0) {
    throw new Error("logActivity: type is required");
  }

  await ensureActivityFeedSchema();

  const id = randomUUID();
  const timestamp = Date.now();

  await sqlRun(
    `INSERT INTO activity_feed (id, project_id, user_id, user_name, type, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, projectId.trim(), userId.trim(), userName.trim(), type, JSON.stringify(details), timestamp],
  );
}

/**
 * Get activity count for a project (useful for pagination metadata).
 */
export async function getActivityCount(projectId: string): Promise<number> {
  if (!projectId || projectId.trim().length === 0) {
    throw new Error("getActivityCount: projectId is required");
  }

  await ensureActivityFeedSchema();

  const row = await sqlGet("SELECT COUNT(*) as count FROM activity_feed WHERE project_id = ?", [projectId.trim()]);
  return (row?.count as number) ?? 0;
}

/**
 * Get activity feed filtered by type.
 */
export async function getActivityFeedByType(
  projectId: string,
  type: ActivityType,
  limit?: number,
): Promise<ActivityItem[]> {
  if (!projectId || projectId.trim().length === 0) {
    throw new Error("getActivityFeedByType: projectId is required");
  }
  if (!type || type.trim().length === 0) {
    throw new Error("getActivityFeedByType: type is required");
  }

  const safeLimit = Math.max(1, Math.min(limit ?? 50, 100));
  await ensureActivityFeedSchema();

  const rows = await sqlAll(
    `SELECT id, project_id, user_id, user_name, type, details_json, created_at
     FROM activity_feed
     WHERE project_id = ? AND type = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [projectId.trim(), type, safeLimit],
  );

  return rows.map(mapRowToActivityItem);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function mapRowToActivityItem(row: Record<string, unknown>): ActivityItem {
  let details: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.details_json as string);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      details = parsed;
    }
  } catch {
    // Malformed JSON — return empty details
  }

  return {
    id: row.id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    type: row.type as ActivityType,
    details,
    timestamp: row.created_at as number,
  };
}
