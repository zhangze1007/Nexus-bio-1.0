/**
 * Project sharing service — generate and manage share links for workbench projects.
 *
 * Uses libsql (Turso) via the shared libsqlDb helpers.
 * Share tokens are 10-char URL-safe strings generated with crypto.randomBytes
 * (avoids ESM-only nanoid issue with Jest/ts-jest).
 *
 * All timestamps are epoch milliseconds (consistent with workbenchDb).
 */

import { randomBytes, randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SharePermission = "view" | "comment" | "edit";

export interface ShareLink {
  id: string;
  projectId: string;
  token: string;
  permission: SharePermission;
  createdBy: string;
  expiresAt: number | null;
  useCount: number;
  createdAt: number;
}

// ── Token generation ───────────────────────────────────────────────────────────

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateToken(length = 10): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return result;
}

// ── Schema ─────────────────────────────────────────────────────────────────────

let schemaReady = false;

export async function ensureShareSchema(): Promise<void> {
  if (schemaReady) return;

  await sqlRun("PRAGMA journal_mode = WAL");
  await sqlRun("PRAGMA foreign_keys = ON");

  await sqlBatch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS share_links (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          permission TEXT NOT NULL DEFAULT 'view',
          created_by TEXT NOT NULL,
          expires_at INTEGER,
          use_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )
      `,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_share_links_project ON share_links (project_id, created_at DESC)",
    },
    {
      sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_token ON share_links (token)",
    },
  ]);

  schemaReady = true;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create a share link for a project.
 *
 * @param projectId - The project to share
 * @param userId    - The user creating the link
 * @param permission - Access level: view, comment, or edit
 * @param ttlMs     - Optional time-to-live in milliseconds (null = no expiry)
 * @returns The created ShareLink with its unique token
 */
export async function shareProject(
  projectId: string,
  userId: string,
  permission: SharePermission = "view",
  ttlMs?: number | null,
): Promise<ShareLink> {
  await ensureShareSchema();

  const id = randomUUID();
  const token = generateToken(10);
  const timestamp = Date.now();
  const expiresAt = ttlMs != null && ttlMs > 0 ? timestamp + ttlMs : null;

  await sqlRun(
    `INSERT INTO share_links (id, project_id, token, permission, created_by, expires_at, use_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, projectId, token, permission, userId, expiresAt, timestamp],
  );

  return {
    id,
    projectId,
    token,
    permission,
    createdBy: userId,
    expiresAt,
    useCount: 0,
    createdAt: timestamp,
  };
}

/**
 * Look up a share link by its token. Increments use_count on access.
 * Returns null if the token does not exist or has expired.
 */
export async function getShareLink(token: string): Promise<ShareLink | null> {
  await ensureShareSchema();

  const row = await sqlGet(
    `SELECT id, project_id, token, permission, created_by, expires_at, use_count, created_at
     FROM share_links
     WHERE token = ?`,
    [token],
  );

  if (!row) return null;

  const expiresAt = row.expires_at as number | null;
  if (expiresAt != null && expiresAt < Date.now()) {
    return null;
  }

  // Increment use count
  await sqlRun("UPDATE share_links SET use_count = use_count + 1 WHERE token = ?", [token]);

  return {
    id: row.id as string,
    projectId: row.project_id as string,
    token: row.token as string,
    permission: row.permission as SharePermission,
    createdBy: row.created_by as string,
    expiresAt,
    useCount: (row.use_count as number) + 1,
    createdAt: row.created_at as number,
  };
}

/**
 * Revoke (delete) a share link by its token.
 * Throws if the token does not exist.
 */
export async function revokeShareLink(token: string): Promise<void> {
  await ensureShareSchema();

  const result = await sqlRun("DELETE FROM share_links WHERE token = ?", [token]);
  if (result.rowsAffected === 0) {
    throw new Error(`Share link not found: ${token}`);
  }
}

/**
 * List all active (non-expired) share links for a project.
 */
export async function listShareLinks(projectId: string): Promise<ShareLink[]> {
  await ensureShareSchema();

  const now = Date.now();
  const rows = await sqlAll(
    `SELECT id, project_id, token, permission, created_by, expires_at, use_count, created_at
     FROM share_links
     WHERE project_id = ? AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY created_at DESC`,
    [projectId, now],
  );

  return rows.map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string,
    token: row.token as string,
    permission: row.permission as SharePermission,
    createdBy: row.created_by as string,
    expiresAt: row.expires_at as number | null,
    useCount: row.use_count as number,
    createdAt: row.created_at as number,
  }));
}
