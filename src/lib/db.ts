import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Shared database singleton for Nexus-Bio.
 *
 * Extracted from workbenchDb.ts so both the workbench and auth systems
 * share the same connection and schema.
 *
 * Storage:
 *   Local: .nexus/workbench.db
 *   Vercel: /tmp/.nexus/workbench.db (ephemeral — cold start resets)
 *
 * Future: migrate to Turso (libSQL) for persistent serverless storage.
 * See .env.example for TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.
 */

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const isVercel = !!process.env.VERCEL;
  const dbDir = isVercel
    ? path.join('/tmp', '.nexus')
    : path.join(process.cwd(), '.nexus');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'workbench.db');
  _db = new Database(dbPath);

  // Performance pragmas
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('foreign_keys = ON');

  // Ensure all tables exist
  ensureTables(_db);

  return _db;
}

function ensureTables(db: Database.Database) {
  db.exec(`
    -- Researcher accounts (populated by Auth.js signIn callback)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      image TEXT,
      institution TEXT,
      research_area TEXT,
      orcid TEXT,
      bio TEXT,
      provider TEXT,
      provider_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Actors (legacy workbench identity, now links to users when authenticated)
    CREATE TABLE IF NOT EXISTS actors (
      actor_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'researcher',
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Projects
    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_product TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Project membership
    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, actor_id)
    );

    -- Canonical state per project
    CREATE TABLE IF NOT EXISTS project_state (
      project_id TEXT PRIMARY KEY REFERENCES projects(project_id) ON DELETE CASCADE,
      state_json TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Run artifacts
    CREATE TABLE IF NOT EXISTS project_run_artifact_index (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
      tool_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      data_json TEXT
    );

    -- Experiment records
    CREATE TABLE IF NOT EXISTS experiment_records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
      tool_id TEXT NOT NULL,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      data_json TEXT
    );

    -- Sync audit log
    CREATE TABLE IF NOT EXISTS sync_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT,
      actor_id TEXT,
      action TEXT NOT NULL,
      revision INTEGER,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Project history (revision snapshots)
    CREATE TABLE IF NOT EXISTS project_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      actor_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_actors_user_id ON actors(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_project ON project_run_artifact_index(project_id);
    CREATE INDEX IF NOT EXISTS idx_experiments_project ON experiment_records(project_id);
    CREATE INDEX IF NOT EXISTS idx_history_project ON project_history(project_id);
  `);
}
