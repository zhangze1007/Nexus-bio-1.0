/**
 * ML Model Serving — Prompt Versioning
 *
 * Manages versioned prompt templates per tool. Each tool can have multiple
 * prompt versions, but only one is active at a time. Uses libsql (Turso)
 * for persistence via the shared libsqlDb helpers.
 */

import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

export interface PromptVersion {
  id: string;
  tool_id: string;
  template: string;
  version: string;
  active: number; // 0 or 1 (SQLite boolean)
  created_at: string;
}

let tableEnsured = false;

/**
 * Ensure the prompt_versions table exists. Called lazily on first DB access.
 */
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await sqlRun(`
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      template TEXT NOT NULL,
      version TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await sqlRun(
    `CREATE INDEX IF NOT EXISTS idx_prompt_versions_tool_id ON prompt_versions(tool_id)`
  );
  tableEnsured = true;
}

/**
 * Create a new prompt version for a tool.
 * The new version is inactive by default unless it is the first version
 * for that tool (in which case it is auto-activated).
 */
export async function createPromptVersion(
  toolId: string,
  template: string,
  version: string,
): Promise<PromptVersion> {
  await ensureTable();

  const id = `${toolId}_${version}_${Date.now()}`;

  // Check if this tool already has any versions
  const existing = await sqlGet(
    "SELECT COUNT(*) as cnt FROM prompt_versions WHERE tool_id = ?",
    [toolId],
  );
  const isFirst = existing && (existing.cnt as number) === 0;

  await sqlRun(
    "INSERT INTO prompt_versions (id, tool_id, template, version, active) VALUES (?, ?, ?, ?, ?)",
    [id, toolId, template, version, isFirst ? 1 : 0],
  );

  const created = await sqlGet("SELECT * FROM prompt_versions WHERE id = ?", [id]);
  return created as unknown as PromptVersion;
}

/**
 * Get the currently active prompt version for a tool.
 * Returns undefined if no active version exists.
 */
export async function getActivePrompt(toolId: string): Promise<PromptVersion | undefined> {
  await ensureTable();
  return (await sqlGet(
    "SELECT * FROM prompt_versions WHERE tool_id = ? AND active = 1",
    [toolId],
  )) as unknown as PromptVersion | undefined;
}

/**
 * List all prompt versions for a tool, ordered by creation date (newest first).
 */
export async function listPromptVersions(toolId: string): Promise<PromptVersion[]> {
  await ensureTable();
  return (await sqlAll(
    "SELECT * FROM prompt_versions WHERE tool_id = ? ORDER BY created_at DESC",
    [toolId],
  )) as unknown as PromptVersion[];
}

/**
 * Activate a specific prompt version by its ID.
 * Deactivates all other versions for the same tool atomically.
 */
export async function activatePrompt(versionId: string): Promise<void> {
  await ensureTable();

  // Find the target version to get its tool_id
  const target = await sqlGet("SELECT * FROM prompt_versions WHERE id = ?", [versionId]);
  if (!target) {
    throw new Error(`Prompt version not found: ${versionId}`);
  }

  const toolId = target.tool_id as string;

  // Deactivate all versions for this tool, then activate the target
  await sqlRun("UPDATE prompt_versions SET active = 0 WHERE tool_id = ?", [toolId]);
  await sqlRun("UPDATE prompt_versions SET active = 1 WHERE id = ?", [versionId]);
}

/**
 * Reset the table-ensured flag (for testing).
 */
export function resetTableEnsured(): void {
  tableEnsured = false;
}
