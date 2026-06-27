/**
 * Feedback persistence layer — libSQL (Turso) backed.
 *
 * Stores user feedback submissions (bugs, feature requests, general)
 * in the feedback_submissions table. Uses sqlAll/sqlGet/sqlRun from libsqlDb.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeedbackType = "bug" | "feature_request" | "general";
export type FeedbackStatus = "open" | "in_review" | "resolved" | "closed";

export interface Feedback {
  id: string;
  userId: string;
  type: FeedbackType;
  description: string;
  pageUrl: string | null;
  status: FeedbackStatus;
  createdAt: number;
  updatedAt: number;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const VALID_TYPES: ReadonlySet<string> = new Set(["bug", "feature_request", "general"]);
const VALID_STATUSES: ReadonlySet<string> = new Set(["open", "in_review", "resolved", "closed"]);

let schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;

  await sqlRun("PRAGMA journal_mode = WAL");
  await sqlRun("PRAGMA synchronous = NORMAL");

  await sqlBatch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS feedback_submissions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('bug', 'feature_request', 'general')),
          description TEXT NOT NULL,
          page_url TEXT,
          status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_review', 'resolved', 'closed')),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_submissions (user_id, created_at DESC)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_submissions (status, created_at DESC)",
    },
  ]);

  schemaReady = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function rowToFeedback(row: Record<string, unknown>): Feedback {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as FeedbackType,
    description: row.description as string,
    pageUrl: (row.page_url as string) ?? null,
    status: row.status as FeedbackStatus,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Submit new feedback. Returns the created Feedback record.
 */
export async function submitFeedback(
  userId: string,
  type: FeedbackType,
  description: string,
  pageUrl?: string | null,
): Promise<Feedback> {
  await ensureSchema();

  if (!userId || userId.trim().length === 0) {
    throw new Error("userId is required");
  }
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Invalid feedback type: ${type}. Must be one of: ${Array.from(VALID_TYPES).join(", ")}`);
  }
  if (!description || description.trim().length === 0) {
    throw new Error("description is required");
  }

  const id = randomUUID();
  const timestamp = now();
  const normalizedUrl = pageUrl && pageUrl.trim().length > 0 ? pageUrl.trim() : null;

  await sqlRun(
    `INSERT INTO feedback_submissions (id, user_id, type, description, page_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
    [id, userId.trim(), type, description.trim(), normalizedUrl, timestamp, timestamp],
  );

  return {
    id,
    userId: userId.trim(),
    type,
    description: description.trim(),
    pageUrl: normalizedUrl,
    status: "open",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * List feedback submissions, optionally filtered by status.
 * Returns results ordered by created_at descending (newest first).
 */
export async function listFeedback(status?: FeedbackStatus): Promise<Feedback[]> {
  await ensureSchema();

  if (status !== undefined && !VALID_STATUSES.has(status)) {
    throw new Error(`Invalid feedback status: ${status}. Must be one of: ${Array.from(VALID_STATUSES).join(", ")}`);
  }

  const rows = status
    ? await sqlAll(
        `SELECT id, user_id, type, description, page_url, status, created_at, updated_at
         FROM feedback_submissions
         WHERE status = ?
         ORDER BY created_at DESC`,
        [status],
      )
    : await sqlAll(
        `SELECT id, user_id, type, description, page_url, status, created_at, updated_at
         FROM feedback_submissions
         ORDER BY created_at DESC`,
      );

  return rows.map(rowToFeedback);
}

/**
 * Update the status of an existing feedback submission.
 */
export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  await ensureSchema();

  if (!id || id.trim().length === 0) {
    throw new Error("id is required");
  }
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid feedback status: ${status}. Must be one of: ${Array.from(VALID_STATUSES).join(", ")}`);
  }

  const result = await sqlRun(
    `UPDATE feedback_submissions
     SET status = ?, updated_at = ?
     WHERE id = ?`,
    [status, now(), id],
  );

  if (result.rowsAffected === 0) {
    throw new Error(`Feedback with id "${id}" not found`);
  }
}
