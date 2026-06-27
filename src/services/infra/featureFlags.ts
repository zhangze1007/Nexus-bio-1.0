/**
 * Feature Flags Service
 *
 * Provides percentage-based rollout support for feature flags.
 * All persistence goes through the shared @libsql/client helpers in
 * src/server/libsqlDb.ts.
 *
 * Schema: feature_flags (id, name, description, enabled, rollout_percentage,
 *                          created_at, updated_at)
 */

import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";
import { createHash } from "node:crypto";
import type { InStatement } from "@libsql/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Schema initialisation                                              */
/* ------------------------------------------------------------------ */

let schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;

  const statements: InStatement[] = [
    {
      sql: `CREATE TABLE IF NOT EXISTS feature_flags (
        id                TEXT PRIMARY KEY,
        name              TEXT NOT NULL UNIQUE,
        description       TEXT NOT NULL DEFAULT '',
        enabled           INTEGER NOT NULL DEFAULT 0,
        rollout_percentage INTEGER NOT NULL DEFAULT 100,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL
      )`,
    },
    {
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_name
            ON feature_flags(name)`,
    },
  ];

  await sqlBatch(statements);
  schemaReady = true;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function nowISO(): string {
  return new Date().toISOString();
}

function randomId(): string {
  return `ff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Deterministic hash for percentage-based rollout.
 * Given a flag name and a user id, produces a value in [0, 100).
 * If no userId is provided, a random value is used instead.
 */
function hashRollout(flagName: string, userId?: string): number {
  if (!userId) {
    return Math.random() * 100;
  }
  const hash = createHash("sha256").update(`${flagName}:${userId}`).digest("hex");
  // Take first 8 hex chars → 32-bit int → mod 100
  const intVal = Number.parseInt(hash.slice(0, 8), 16);
  return intVal % 100;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Check whether a feature flag is enabled for a given user.
 *
 * Evaluation logic:
 *   1. If the flag does not exist, return false.
 *   2. If the flag is disabled (enabled = 0), return false.
 *   3. If rollout_percentage is 100, return true.
 *   4. Otherwise, hash(flagName, userId) determines whether this user
 *      falls within the rollout window.
 */
export async function isEnabled(flagName: string, userId?: string): Promise<boolean> {
  await ensureSchema();

  const row = await sqlGet(
    "SELECT enabled, rollout_percentage FROM feature_flags WHERE name = ?",
    [flagName],
  );

  if (!row) return false;
  if (!row.enabled) return false;

  const pct = Number(row.rollout_percentage);
  if (pct >= 100) return true;
  if (pct <= 0) return false;

  return hashRollout(flagName, userId) < pct;
}

/**
 * List all feature flags, ordered by creation date descending.
 */
export async function getAllFlags(): Promise<FeatureFlag[]> {
  await ensureSchema();

  const rows = await sqlAll(
    "SELECT * FROM feature_flags ORDER BY created_at DESC",
  );

  return rows.map(rowToFlag);
}

/**
 * Create or update a feature flag.
 *
 * - If the flag already exists (matched by name), its `enabled`,
 *   `rollout_percentage`, and `updated_at` are updated.
 * - If it does not exist, a new row is inserted.
 */
export async function setFlag(
  flagName: string,
  enabled: boolean,
  rolloutPercentage?: number,
): Promise<void> {
  await ensureSchema();

  const ts = nowISO();
  const existing = await sqlGet("SELECT id FROM feature_flags WHERE name = ?", [flagName]);
  const pct = rolloutPercentage !== undefined ? clampPct(rolloutPercentage) : 100;

  if (existing) {
    await sqlRun(
      `UPDATE feature_flags
       SET enabled = ?, rollout_percentage = ?, updated_at = ?
       WHERE name = ?`,
      [enabled ? 1 : 0, pct, ts, flagName],
    );
  } else {
    await sqlRun(
      `INSERT INTO feature_flags (id, name, description, enabled, rollout_percentage, created_at, updated_at)
       VALUES (?, ?, '', ?, ?, ?, ?)`,
      [randomId(), flagName, enabled ? 1 : 0, pct, ts, ts],
    );
  }
}

/**
 * Delete a feature flag by name.
 */
export async function deleteFlag(flagName: string): Promise<boolean> {
  await ensureSchema();
  const result = await sqlRun("DELETE FROM feature_flags WHERE name = ?", [flagName]);
  return result.rowsAffected > 0;
}

/**
 * Get a single flag by name.
 */
export async function getFlag(flagName: string): Promise<FeatureFlag | null> {
  await ensureSchema();
  const row = await sqlGet("SELECT * FROM feature_flags WHERE name = ?", [flagName]);
  return row ? rowToFlag(row) : null;
}

/* ------------------------------------------------------------------ */
/*  Internals                                                          */
/* ------------------------------------------------------------------ */

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function rowToFlag(row: Record<string, unknown>): FeatureFlag {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    enabled: Boolean(row.enabled),
    rollout_percentage: Number(row.rollout_percentage),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
