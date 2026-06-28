/**
 * Schema Migration System (R-14)
 *
 * Provides versioned schema migrations for the workbench database.
 * Each migration has a version number and an up() function that applies the migration.
 * Migrations are tracked in a schema_migrations table.
 *
 * Usage:
 *   import { runMigrations } from './schemaMigrations';
 *   await runMigrations();
 */

import { sqlAll, sqlRun, sqlGet } from "./libsqlDb";

interface Migration {
  version: number;
  name: string;
  up: () => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: async () => {
      // Tables already created in workbenchDb.ts ensureSchema()
      // This migration just records that v1 exists
    },
  },
  {
    version: 2,
    name: "add_soft_deleted_to_experiment_records",
    up: async () => {
      try {
        await sqlRun(`ALTER TABLE experiment_records ADD COLUMN soft_deleted INTEGER NOT NULL DEFAULT 0`);
      } catch {
        // Column may already exist
      }
    },
  },
  {
    version: 3,
    name: "add_soft_deleted_to_project_members",
    up: async () => {
      try {
        await sqlRun(`ALTER TABLE project_members ADD COLUMN soft_deleted INTEGER NOT NULL DEFAULT 0`);
      } catch {
        // Column may already exist
      }
    },
  },
];

export async function runMigrations(): Promise<void> {
  // Ensure migrations tracking table exists
  await sqlRun(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);

  // Get current version
  const row = await sqlGet("SELECT MAX(version) as version FROM schema_migrations");
  const currentVersion = (row?.version as number) ?? 0;

  // Run pending migrations
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      await migration.up();
      await sqlRun(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [migration.version, migration.name, Date.now()]
      );
    }
  }
}

export async function getSchemaVersion(): Promise<number> {
  try {
    const row = await sqlGet("SELECT MAX(version) as version FROM schema_migrations");
    return (row?.version as number) ?? 0;
  } catch {
    return 0;
  }
}
