/**
 * Comment threading service — real-time collaboration comments on workbench entities.
 *
 * Uses libsql (Turso) via the shared libsqlDb helpers. Two tables:
 *   comment_threads  — one per discussion thread anchored to an entity
 *   comment_replies  — individual messages within a thread
 *
 * All timestamps are epoch milliseconds (consistent with workbenchDb).
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CommentThread {
  id: string;
  entityType: string;
  entityId: string;
  projectId: string;
  createdBy: string;
  resolved: boolean;
  createdAt: number;
}

export interface CommentReply {
  id: string;
  threadId: string;
  userId: string;
  message: string;
  createdAt: number;
}

export interface ThreadWithReplies extends CommentThread {
  replies: CommentReply[];
}

export interface RecentActivity {
  threadId: string;
  entityType: string;
  entityId: string;
  projectId: string;
  lastMessage: string;
  lastMessageBy: string;
  replyCount: number;
  resolved: boolean;
  updatedAt: number;
}

// ── Schema ─────────────────────────────────────────────────────────────────────

let schemaReady = false;

export async function ensureCommentSchema(): Promise<void> {
  if (schemaReady) return;

  await sqlRun("PRAGMA journal_mode = WAL");
  await sqlRun("PRAGMA foreign_keys = ON");

  await sqlBatch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS comment_threads (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          resolved INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )
      `,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_comment_threads_entity ON comment_threads (entity_type, entity_id)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_comment_threads_project ON comment_threads (project_id, created_at DESC)",
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS comment_replies (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (thread_id) REFERENCES comment_threads(id) ON DELETE CASCADE
        )
      `,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_comment_replies_thread ON comment_replies (thread_id, created_at ASC)",
    },
  ]);

  schemaReady = true;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create a new comment thread with an initial message.
 */
export async function createThread(
  entityType: string,
  entityId: string,
  projectId: string,
  userId: string,
  message: string,
): Promise<ThreadWithReplies> {
  await ensureCommentSchema();

  const threadId = randomUUID();
  const replyId = randomUUID();
  const timestamp = Date.now();

  await sqlBatch([
    {
      sql: `
        INSERT INTO comment_threads (id, entity_type, entity_id, project_id, created_by, resolved, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `,
      args: [threadId, entityType, entityId, projectId, userId, timestamp],
    },
    {
      sql: `
        INSERT INTO comment_replies (id, thread_id, user_id, message, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [replyId, threadId, userId, message, timestamp],
    },
  ]);

  return {
    id: threadId,
    entityType,
    entityId,
    projectId,
    createdBy: userId,
    resolved: false,
    createdAt: timestamp,
    replies: [{ id: replyId, threadId, userId, message, createdAt: timestamp }],
  };
}

/**
 * Add a reply to an existing thread.
 */
export async function replyToThread(threadId: string, userId: string, message: string): Promise<CommentReply> {
  await ensureCommentSchema();

  const thread = await sqlGet("SELECT id FROM comment_threads WHERE id = ?", [threadId]);
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  const replyId = randomUUID();
  const timestamp = Date.now();

  await sqlRun(
    `INSERT INTO comment_replies (id, thread_id, user_id, message, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [replyId, threadId, userId, message, timestamp],
  );

  return { id: replyId, threadId, userId, message, createdAt: timestamp };
}

/**
 * Get all threads for a given entity, including their replies.
 */
export async function getThreads(entityType: string, entityId: string): Promise<ThreadWithReplies[]> {
  await ensureCommentSchema();

  const threads = await sqlAll(
    `SELECT id, entity_type, entity_id, project_id, created_by, resolved, created_at
     FROM comment_threads
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY created_at DESC`,
    [entityType, entityId],
  );

  if (threads.length === 0) return [];

  const threadIds = threads.map((t) => t.id as string);
  const placeholders = threadIds.map(() => "?").join(", ");
  const replies = await sqlAll(
    `SELECT id, thread_id, user_id, message, created_at
     FROM comment_replies
     WHERE thread_id IN (${placeholders})
     ORDER BY created_at ASC`,
    threadIds,
  );

  const repliesByThread = new Map<string, CommentReply[]>();
  for (const reply of replies) {
    const tid = reply.thread_id as string;
    if (!repliesByThread.has(tid)) repliesByThread.set(tid, []);
    repliesByThread.get(tid)!.push({
      id: reply.id as string,
      threadId: tid,
      userId: reply.user_id as string,
      message: reply.message as string,
      createdAt: reply.created_at as number,
    });
  }

  return threads.map((t) => ({
    id: t.id as string,
    entityType: t.entity_type as string,
    entityId: t.entity_id as string,
    projectId: t.project_id as string,
    createdBy: t.created_by as string,
    resolved: Boolean(t.resolved),
    createdAt: t.created_at as number,
    replies: repliesByThread.get(t.id as string) ?? [],
  }));
}

/**
 * Mark a thread as resolved.
 */
export async function resolveThread(threadId: string): Promise<void> {
  await ensureCommentSchema();

  const result = await sqlRun("UPDATE comment_threads SET resolved = 1 WHERE id = ?", [threadId]);

  if (result.rowsAffected === 0) {
    throw new Error(`Thread not found: ${threadId}`);
  }
}

/**
 * Get recent comment activity across a project, ordered by most recent reply.
 */
export async function getRecentActivity(projectId: string, limit = 20): Promise<RecentActivity[]> {
  await ensureCommentSchema();

  const safeLimit = Math.max(1, Math.min(limit, 100));

  const rows = await sqlAll(
    `SELECT
       t.id AS thread_id,
       t.entity_type,
       t.entity_id,
       t.project_id,
       t.resolved,
       r.message AS last_message,
       r.user_id AS last_message_by,
       r.created_at AS updated_at,
       COUNT(r2.id) AS reply_count
     FROM comment_threads t
     INNER JOIN comment_replies r
       ON r.thread_id = t.id
       AND r.created_at = (
         SELECT MAX(created_at) FROM comment_replies WHERE thread_id = t.id
       )
     INNER JOIN comment_replies r2
       ON r2.thread_id = t.id
     WHERE t.project_id = ?
     GROUP BY t.id
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [projectId, safeLimit],
  );

  return rows.map((row) => ({
    threadId: row.thread_id as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    projectId: row.project_id as string,
    lastMessage: row.last_message as string,
    lastMessageBy: row.last_message_by as string,
    replyCount: row.reply_count as number,
    resolved: Boolean(row.resolved),
    updatedAt: row.updated_at as number,
  }));
}
