/**
 * Migration Runner — Database migration management for Nexus-Bio
 *
 * Reads .sql migration files from src/server/db/migrations/, tracks applied
 * migrations in a `migrations` table, and supports run/status/rollback.
 *
 * Uses @libsql/client via the libsqlDb helper (works with both Turso and local SQLite).
 *
 * Migration file naming convention:
 *   001_initial_schema.sql        — forward (up) migration
 *   001_initial_schema.down.sql  — rollback (down) migration (optional)
 *
 * Files are sorted by numeric prefix. Files without a numeric prefix are skipped.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { sqlAll, sqlGet, sqlRun, sqlBatch } from "../libsqlDb";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  failed: { name: string; error: string }[];
}

export interface MigrationStatus {
  id: number;
  name: string;
  applied_at: string;
  checksum: string;
  applied: boolean;
}

interface MigrationFile {
  name: string;
  filePath: string;
  order: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "server", "db", "migrations");

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Ensure the migrations tracking table exists.
 */
async function ensureMigrationsTable(): Promise<void> {
  await sqlRun(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL,
      checksum TEXT NOT NULL
    )
  `);
}

/**
 * Run all pending migrations in order.
 *
 * For each migration file whose name is not yet recorded in the `migrations`
 * table, the SQL is read, checksummed, and executed inside a write transaction.
 * Already-applied migrations are skipped. Failures are captured per-migration
 * and do not halt subsequent migrations.
 */
export async function runMigrations(): Promise<MigrationResult> {
  await ensureMigrationsTable();

  const result: MigrationResult = { applied: [], skipped: [], failed: [] };
  const files = await discoverMigrationFiles("up");
  const appliedRows = await sqlAll("SELECT name FROM migrations");
  const appliedNames = new Set(appliedRows.map((r) => r.name as string));

  for (const file of files) {
    if (appliedNames.has(file.name)) {
      result.skipped.push(file.name);
      continue;
    }

    try {
      const migration = await loadMigrationFile(file);
      await sqlBatch([
        { sql: migration.content, args: [] },
        {
          sql: "INSERT INTO migrations (name, applied_at, checksum) VALUES (?, ?, ?)",
          args: [file.name, new Date().toISOString(), migration.checksum],
        },
      ]);
      result.applied.push(file.name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({ name: file.name, error: message });
    }
  }

  return result;
}

/**
 * Return the status of every known migration (applied and pending).
 */
export async function getMigrationStatus(): Promise<MigrationStatus[]> {
  await ensureMigrationsTable();

  const files = await discoverMigrationFiles("up");
  const appliedRows = await sqlAll("SELECT id, name, applied_at, checksum FROM migrations ORDER BY id");
  const appliedMap = new Map<string, (typeof appliedRows)[number]>();
  for (const row of appliedRows) {
    appliedMap.set(row.name as string, row);
  }

  return files.map((file) => {
    const record = appliedMap.get(file.name);
    if (record) {
      return {
        id: record.id as number,
        name: file.name,
        applied_at: record.applied_at as string,
        checksum: record.checksum as string,
        applied: true,
      };
    }
    return {
      id: -1,
      name: file.name,
      applied_at: "",
      checksum: "",
      applied: false,
    };
  });
}

/**
 * Rollback a specific migration by name.
 *
 * Looks for a corresponding `.down.sql` file (e.g. `001_name.down.sql` for
 * `001_name.sql`). If the down file exists, its SQL is executed and the
 * migration record is removed. If no down file exists, the function throws.
 */
export async function rollbackMigration(migrationName: string): Promise<void> {
  await ensureMigrationsTable();

  const record = await sqlGet("SELECT id, name, checksum FROM migrations WHERE name = ?", [migrationName]);
  if (!record) {
    throw new Error(`Migration "${migrationName}" is not applied — nothing to rollback`);
  }

  const downFile = await findDownMigration(migrationName);
  if (!downFile) {
    throw new Error(
      `No rollback file found for "${migrationName}". ` +
        `Expected a .down.sql file in ${MIGRATIONS_DIR}.`,
    );
  }

  const content = await fs.readFile(downFile.filePath, "utf-8");

  await sqlBatch([
    { sql: content, args: [] },
    { sql: "DELETE FROM migrations WHERE name = ?", args: [migrationName] },
  ]);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Discover migration files from the migrations directory.
 *
 * Only files matching the pattern `NNN_*.sql` are included (where NNN is a
 * numeric prefix). Files ending in `.down.sql` are excluded when mode is
 * "up", and only `.down.sql` files are included when mode is "down".
 */
export async function discoverMigrationFiles(mode: "up" | "down" = "up"): Promise<MigrationFile[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(MIGRATIONS_DIR);
  } catch {
    return [];
  }

  const sqlFiles = entries.filter((name) => {
    if (!name.endsWith(".sql")) return false;
    if (mode === "up") return !name.endsWith(".down.sql");
    return name.endsWith(".down.sql");
  });

  return sqlFiles
    .map((name) => {
      const match = name.match(/^(\d+)_/);
      return {
        name,
        filePath: path.join(MIGRATIONS_DIR, name),
        order: match ? parseInt(match[1], 10) : NaN,
      };
    })
    .filter((f) => !isNaN(f.order))
    .sort((a, b) => a.order - b.order);
}

/**
 * Read a migration file from disk and compute its SHA-256 checksum.
 */
export async function loadMigrationFile(file: MigrationFile): Promise<{ content: string; checksum: string }> {
  const content = await fs.readFile(file.filePath, "utf-8");
  const checksum = computeChecksum(content);
  return { content, checksum };
}

/**
 * Compute a SHA-256 hex digest of the given content.
 */
export function computeChecksum(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Find the .down.sql file corresponding to an up migration name.
 *
 * E.g. for `001_initial_schema.sql` this looks for `001_initial_schema.down.sql`.
 */
export async function findDownMigration(upMigrationName: string): Promise<MigrationFile | null> {
  const downName = upMigrationName.replace(/\.sql$/, ".down.sql");
  const downPath = path.join(MIGRATIONS_DIR, downName);

  try {
    await fs.access(downPath);
    const match = downName.match(/^(\d+)_/);
    return {
      name: downName,
      filePath: downPath,
      order: match ? parseInt(match[1], 10) : 0,
    };
  } catch {
    return null;
  }
}
