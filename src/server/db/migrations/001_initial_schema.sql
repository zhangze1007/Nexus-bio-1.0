-- Nexus-Bio Workbench Database Schema
-- Migration 001: Initial schema
-- Compatible with both SQLite (better-sqlite3) and Turso (libSQL)

CREATE TABLE IF NOT EXISTS actors (
  actor_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'researcher',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_product TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  added_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, actor_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actors(actor_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_state (
  project_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  last_mutation_at INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  last_actor_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (last_actor_id) REFERENCES actors(actor_id)
);

CREATE TABLE IF NOT EXISTS project_run_artifact_index (
  artifact_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  tool_id TEXT NOT NULL,
  stage_id TEXT,
  target_product TEXT NOT NULL,
  source_artifact_id TEXT,
  upstream_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  authority_tier TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  is_simulated INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_run_artifact_project_revision
  ON project_run_artifact_index (project_id, revision DESC);

CREATE INDEX IF NOT EXISTS idx_project_run_artifact_project_tool
  ON project_run_artifact_index (project_id, tool_id, created_at DESC);

CREATE TABLE IF NOT EXISTS experiment_records (
  record_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  stage_id TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  authority_tier TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actors(actor_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_records_project_created
  ON experiment_records (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sync_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actors(actor_id)
);

CREATE TABLE IF NOT EXISTS project_history (
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, revision),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actors(actor_id)
);
