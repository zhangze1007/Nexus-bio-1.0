/**
 * Experiment Tracker Service
 *
 * Persistent lab experiment tracking backed by libSQL (Turso).
 * Manages experiment lifecycle: creation, status transitions,
 * key-value data attachment, and full timeline reconstruction.
 *
 * Uses the shared libsqlDb helpers (sqlAll, sqlGet, sqlRun, sqlBatch)
 * so the connection is shared with the workbench ledger and other
 * server-side modules.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ─── Types ───────────────────────────────────────────────────────

/** Allowed experiment statuses. */
export type ExperimentStatus =
  | "planned"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "aborted";

/** Canonical experiment record returned to callers. */
export interface Experiment {
  id: string;
  name: string;
  protocol_id: string;
  project_id: string;
  status: ExperimentStatus;
  started_at: number | null;
  completed_at: number | null;
  created_by: string;
}

/** Single event in an experiment's timeline. */
export interface TimelineEvent {
  id: string;
  experiment_id: string;
  event_type: string;
  details: string;
  timestamp: number;
}

// ─── Schema ──────────────────────────────────────────────────────

/**
 * Ensure both tables exist. Safe to call repeatedly (idempotent).
 * Designed to run once at service startup or lazily on first call.
 */
export async function ensureExperimentTrackerSchema(): Promise<void> {
  await sqlBatch([
    {
      sql: `CREATE TABLE IF NOT EXISTS lab_experiments (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        protocol_id  TEXT NOT NULL,
        project_id   TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'planned'
                     CHECK(status IN ('planned','running','paused','completed','failed','aborted')),
        started_at   INTEGER,
        completed_at INTEGER,
        created_by   TEXT NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS lab_experiment_data (
        id            TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL REFERENCES lab_experiments(id) ON DELETE CASCADE,
        key           TEXT NOT NULL,
        value         TEXT NOT NULL,
        timestamp     INTEGER NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_lab_experiment_data_experiment_id
            ON lab_experiment_data(experiment_id)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_lab_experiments_project_id
            ON lab_experiments(project_id)`,
      args: [],
    },
    {
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_experiment_data_key
            ON lab_experiment_data(experiment_id, key)`,
      args: [],
    },
  ]);
}

// ─── Internal helpers ────────────────────────────────────────────

function now(): number {
  return Date.now();
}

const VALID_STATUSES: ExperimentStatus[] = [
  "planned",
  "running",
  "paused",
  "completed",
  "failed",
  "aborted",
];

/** Map a raw DB row to a typed Experiment. */
function rowToExperiment(row: Record<string, unknown>): Experiment {
  return {
    id: row.id as string,
    name: row.name as string,
    protocol_id: row.protocol_id as string,
    project_id: row.project_id as string,
    status: row.status as ExperimentStatus,
    started_at: row.started_at != null ? Number(row.started_at) : null,
    completed_at: row.completed_at != null ? Number(row.completed_at) : null,
    created_by: row.created_by as string,
  };
}

/** Map a raw DB row to a typed TimelineEvent. */
function rowToTimelineEvent(row: Record<string, unknown>): TimelineEvent {
  return {
    id: row.id as string,
    experiment_id: row.experiment_id as string,
    event_type: row.event_type as string,
    details: row.details as string,
    timestamp: Number(row.timestamp),
  };
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Create a new experiment and record a "created" timeline event atomically.
 *
 * @param name       Human-readable experiment name (e.g. "Artemisinin titer screen")
 * @param protocolId Reference to the protocol this experiment follows
 * @param projectId  Project this experiment belongs to
 * @param createdBy  Identity of the creator (user ID or email)
 * @returns          The newly created Experiment record
 * @throws           If name is empty
 */
export async function createExperiment(
  name: string,
  protocolId: string,
  projectId: string,
  createdBy: string = "system",
): Promise<Experiment> {
  if (!name || name.trim().length === 0) {
    throw new Error("Experiment name must not be empty.");
  }
  if (!protocolId || protocolId.trim().length === 0) {
    throw new Error("Protocol ID must not be empty.");
  }
  if (!projectId || projectId.trim().length === 0) {
    throw new Error("Project ID must not be empty.");
  }

  const id = randomUUID();
  const ts = now();

  await sqlBatch([
    {
      sql: `INSERT INTO lab_experiments
              (id, name, protocol_id, project_id, status, started_at, completed_at, created_by)
            VALUES (?, ?, ?, ?, 'planned', NULL, NULL, ?)`,
      args: [id, name.trim(), protocolId.trim(), projectId.trim(), createdBy],
    },
    {
      sql: `INSERT INTO lab_experiment_data (id, experiment_id, key, value, timestamp)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        id,
        "created",
        `Experiment "${name.trim()}" created for protocol ${protocolId.trim()}`,
        ts,
      ],
    },
  ]);

  return {
    id,
    name: name.trim(),
    protocol_id: protocolId.trim(),
    project_id: projectId.trim(),
    status: "planned",
    started_at: null,
    completed_at: null,
    created_by: createdBy,
  };
}

/**
 * Update the status of an existing experiment.
 *
 * Automatically sets `started_at` when transitioning to "running"
 * and `completed_at` when transitioning to a terminal state
 * (completed, failed, aborted).
 *
 * @param id     ID of the experiment to update
 * @param status New status value
 * @throws       If the experiment does not exist or status is invalid
 */
export async function updateExperimentStatus(
  id: string,
  status: ExperimentStatus,
): Promise<void> {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(
      `Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(", ")}.`,
    );
  }

  const experiment = await sqlGet(
    "SELECT * FROM lab_experiments WHERE id = ?",
    [id],
  );
  if (!experiment) {
    throw new Error(`Experiment not found: ${id}`);
  }

  const ts = now();
  const oldStatus = experiment.status as string;

  // Determine timestamp updates
  const isTerminal = status === "completed" || status === "failed" || status === "aborted";
  const startedAt =
    status === "running" && !experiment.started_at ? ts : experiment.started_at;
  const completedAt = isTerminal ? ts : experiment.completed_at;

  await sqlBatch([
    {
      sql: `UPDATE lab_experiments
            SET status = ?, started_at = ?, completed_at = ?
            WHERE id = ?`,
      args: [status, startedAt, completedAt, id],
    },
    {
      sql: `INSERT INTO lab_experiment_data (id, experiment_id, key, value, timestamp)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        id,
        "status_change",
        `Status changed from "${oldStatus}" to "${status}"`,
        ts,
      ],
    },
  ]);
}

/**
 * Attach a key-value data point to an experiment.
 *
 * If the key already exists for this experiment, its value is updated.
 * Otherwise a new data row is inserted.
 *
 * @param id    ID of the experiment
 * @param key   Data key (e.g. "titer_mg_per_L", "temperature_C")
 * @param value Data value (stored as text)
 * @throws      If the experiment does not exist or key is empty
 */
export async function addExperimentData(
  id: string,
  key: string,
  value: string,
): Promise<void> {
  if (!key || key.trim().length === 0) {
    throw new Error("Data key must not be empty.");
  }

  const experiment = await sqlGet(
    "SELECT id FROM lab_experiments WHERE id = ?",
    [id],
  );
  if (!experiment) {
    throw new Error(`Experiment not found: ${id}`);
  }

  const ts = now();

  // Upsert: try update first, fall back to insert
  const existing = await sqlGet(
    "SELECT id FROM lab_experiment_data WHERE experiment_id = ? AND key = ?",
    [id, key.trim()],
  );

  if (existing) {
    await sqlRun(
      "UPDATE lab_experiment_data SET value = ?, timestamp = ? WHERE experiment_id = ? AND key = ?",
      [value, ts, id, key.trim()],
    );
  } else {
    await sqlRun(
      "INSERT INTO lab_experiment_data (id, experiment_id, key, value, timestamp) VALUES (?, ?, ?, ?, ?)",
      [randomUUID(), id, key.trim(), value, ts],
    );
  }
}

/**
 * Retrieve the full timeline for an experiment, ordered chronologically.
 *
 * Timeline includes both the initial "created" event and all subsequent
 * data/status_change events recorded via addExperimentData and
 * updateExperimentStatus.
 *
 * @param id  ID of the experiment
 * @returns   Array of TimelineEvent records (oldest first)
 * @throws    If the experiment does not exist
 */
export async function getExperimentTimeline(
  id: string,
): Promise<TimelineEvent[]> {
  const experiment = await sqlGet(
    "SELECT id FROM lab_experiments WHERE id = ?",
    [id],
  );
  if (!experiment) {
    throw new Error(`Experiment not found: ${id}`);
  }

  const rows = await sqlAll(
    `SELECT * FROM lab_experiment_data
     WHERE experiment_id = ?
     ORDER BY timestamp ASC`,
    [id],
  );

  return rows.map(rowToTimelineEvent);
}
