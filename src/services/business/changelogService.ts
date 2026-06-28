/**
 * Changelog Service
 *
 * Manages product changelog entries stored in a libSQL table.
 * Each entry records a semantic-version tag, an array of typed changes,
 * and a publish timestamp.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──

export interface ChangeItem {
  type: "feature" | "fix" | "improvement";
  description: string;
}

export interface ChangelogEntry {
  version: string;
  changes: ChangeItem[];
  publishedAt: string;
}

// ── Table DDL ──

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS changelog (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  changes_json TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

let schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await sqlRun(CREATE_TABLE_SQL);
  schemaReady = true;
}

// ── Public API ──

/**
 * Add a new changelog entry. Throws if the version already exists.
 */
export async function addChangelogEntry(version: string, changes: ChangeItem[]): Promise<void> {
  if (!version || typeof version !== "string") {
    throw new Error("version is required and must be a non-empty string");
  }
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error("changes must be a non-empty array");
  }
  for (const c of changes) {
    if (!["feature", "fix", "improvement"].includes(c.type)) {
      throw new Error(`Invalid change type: ${c.type}`);
    }
    if (!c.description || typeof c.description !== "string") {
      throw new Error("Each change must have a non-empty description");
    }
  }

  await ensureSchema();

  const existing = await sqlGet("SELECT id FROM changelog WHERE version = ?", [version]);
  if (existing) {
    throw new Error(`Version ${version} already exists`);
  }

  const id = randomUUID();
  const changesJson = JSON.stringify(changes);
  await sqlRun("INSERT INTO changelog (id, version, changes_json, published_at) VALUES (?, ?, ?, datetime('now'))", [
    id,
    version,
    changesJson,
  ]);
}

/**
 * Retrieve changelog entries ordered by publish date (newest first).
 * @param limit Maximum number of entries to return (default 50).
 */
export async function getChangelog(limit = 50): Promise<ChangelogEntry[]> {
  await ensureSchema();

  const rows = await sqlAll(
    "SELECT version, changes_json, published_at FROM changelog ORDER BY published_at DESC LIMIT ?",
    [limit],
  );

  return rows.map((row) => ({
    version: row.version as string,
    changes: JSON.parse(row.changes_json as string) as ChangeItem[],
    publishedAt: row.published_at as string,
  }));
}

/**
 * Return the latest (most recent) version string, or null if no entries exist.
 */
export async function getLatestVersion(): Promise<string | null> {
  await ensureSchema();

  const row = await sqlGet("SELECT version FROM changelog ORDER BY published_at DESC LIMIT 1");
  return row ? (row.version as string) : null;
}
