/**
 * AI Response Cache — TTL-based caching for LLM responses using libSQL.
 *
 * Stores responses keyed by a deterministic hash of (prompt, model, params).
 * Entries expire after a configurable TTL to avoid stale results while
 * still reducing redundant API calls during burst traffic.
 *
 * Schema: ai_cache (id, cache_key, response, model, tokens_used, created_at, expires_at)
 */

import { createHash } from "node:crypto";
import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──

export interface CachedResponse {
  id: string;
  cacheKey: string;
  response: string;
  model: string;
  tokensUsed: number;
  createdAt: string;
  expiresAt: string;
}

// ── Schema bootstrap ──

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ai_cache (
    id          TEXT PRIMARY KEY,
    cache_key   TEXT NOT NULL UNIQUE,
    response    TEXT NOT NULL,
    model       TEXT NOT NULL,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_cache (cache_key)
`;

const CREATE_EXPIRY_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_cache (expires_at)
`;

let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await sqlRun(CREATE_TABLE_SQL);
  await sqlRun(CREATE_INDEX_SQL);
  await sqlRun(CREATE_EXPIRY_INDEX_SQL);
  schemaEnsured = true;
}

// ── Public API ──

/**
 * Generate a deterministic cache key from prompt, model, and params.
 * Uses SHA-256 to produce a fixed-length key regardless of input size.
 */
export function generateCacheKey(
  prompt: string,
  model: string,
  params: Record<string, unknown> = {},
): string {
  const canonical = JSON.stringify({
    prompt: prompt.trim(),
    model: model.trim(),
    params: Object.keys(params)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = params[k];
        return acc;
      }, {}),
  });

  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Retrieve a cached response by key. Returns null if missing or expired.
 * Expired entries are lazily pruned on read.
 */
export async function getCachedResponse(key: string): Promise<CachedResponse | null> {
  await ensureSchema();

  const now = new Date().toISOString();
  const row = await sqlGet(
    "SELECT * FROM ai_cache WHERE cache_key = ? AND expires_at > ?",
    [key, now],
  );

  if (!row) return null;

  return {
    id: row.id as string,
    cacheKey: row.cache_key as string,
    response: row.response as string,
    model: row.model as string,
    tokensUsed: row.tokens_used as number,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  };
}

/**
 * Store a response in the cache with a TTL.
 * Uses upsert (INSERT OR REPLACE) so repeated calls with the same key
 * refresh the entry rather than failing on UNIQUE constraint.
 */
export async function setCachedResponse(
  key: string,
  response: string,
  ttlSeconds: number,
  model = "unknown",
  tokensUsed = 0,
): Promise<void> {
  await ensureSchema();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const id = createHash("sha256")
    .update(`${key}:${now.toISOString()}`)
    .digest("hex")
    .slice(0, 32);

  await sqlRun(
    `INSERT OR REPLACE INTO ai_cache (id, cache_key, response, model, tokens_used, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, key, response, model, tokensUsed, now.toISOString(), expiresAt],
  );
}

/**
 * Delete all entries from the cache. Returns the number of rows removed.
 */
export async function clearCache(): Promise<number> {
  await ensureSchema();
  const result = await sqlRun("DELETE FROM ai_cache");
  return result.rowsAffected;
}

/**
 * Remove all expired entries. Returns the number of rows pruned.
 * Useful for periodic cleanup beyond lazy pruning on read.
 */
export async function pruneExpired(): Promise<number> {
  await ensureSchema();
  const now = new Date().toISOString();
  const result = await sqlRun("DELETE FROM ai_cache WHERE expires_at <= ?", [now]);
  return result.rowsAffected;
}

/**
 * Return the current number of (non-expired) cache entries.
 */
export async function cacheSize(): Promise<number> {
  await ensureSchema();
  const now = new Date().toISOString();
  const rows = await sqlAll(
    "SELECT COUNT(*) as cnt FROM ai_cache WHERE expires_at > ?",
    [now],
  );
  return (rows[0]?.cnt as number) ?? 0;
}

/**
 * Reset schemaEnsured flag — for testing only.
 */
export function _resetSchemaEnsured(): void {
  schemaEnsured = false;
}
