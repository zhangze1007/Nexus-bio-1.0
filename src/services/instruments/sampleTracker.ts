/**
 * Sample Tracker Service
 *
 * Persistent lab sample tracking backed by libSQL (Turso).
 * Manages sample lifecycle: creation, location moves, full event history,
 * and text-based search across sample metadata.
 *
 * Uses the shared libsqlDb helpers (sqlAll, sqlGet, sqlRun, sqlBatch)
 * so the connection is shared with the workbench ledger and other
 * server-side modules.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ─── Types ───────────────────────────────────────────────────────

/** Allowed sample categories. */
export type SampleType = "strain" | "plasmid" | "primer" | "chemical" | "media";

/** Canonical sample record returned to callers. */
export interface Sample {
  id: string;
  name: string;
  type: SampleType;
  location: string;
  status: string;
  created_at: number;
  updated_at: number;
}

/** Single event in a sample's provenance trail. */
export interface SampleEvent {
  id: string;
  sample_id: string;
  event_type: string;
  details: string;
  timestamp: number;
}

// ─── Schema ──────────────────────────────────────────────────────

/**
 * Ensure both tables exist. Safe to call repeatedly (idempotent).
 * Designed to run once at service startup or lazily on first call.
 */
export async function ensureSampleTrackerSchema(): Promise<void> {
  await sqlBatch([
    {
      sql: `CREATE TABLE IF NOT EXISTS samples (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        type       TEXT NOT NULL CHECK(type IN ('strain','plasmid','primer','chemical','media')),
        location   TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS sample_events (
        id         TEXT PRIMARY KEY,
        sample_id  TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        details    TEXT NOT NULL DEFAULT '',
        timestamp  INTEGER NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_sample_events_sample_id
            ON sample_events(sample_id)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_samples_name
            ON samples(name)`,
      args: [],
    },
  ]);
}

// ─── Internal helpers ────────────────────────────────────────────

function now(): number {
  return Date.now();
}

/** Insert a provenance event for a sample (inside or outside a batch). */
async function recordEvent(sampleId: string, eventType: string, details: string): Promise<void> {
  await sqlRun(
    `INSERT INTO sample_events (id, sample_id, event_type, details, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), sampleId, eventType, details, now()],
  );
}

/** Map a raw DB row to a typed Sample. */
function rowToSample(row: Record<string, unknown>): Sample {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as SampleType,
    location: row.location as string,
    status: row.status as string,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

/** Map a raw DB row to a typed SampleEvent. */
function rowToEvent(row: Record<string, unknown>): SampleEvent {
  return {
    id: row.id as string,
    sample_id: row.sample_id as string,
    event_type: row.event_type as string,
    details: row.details as string,
    timestamp: Number(row.timestamp),
  };
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Create a new sample and record a "created" provenance event atomically.
 *
 * @param name     Human-readable sample name (e.g. "pET28a-His-AmpR")
 * @param type     One of the five allowed sample categories
 * @param location Physical location string (e.g. "Freezer A, Rack 3, Box 2, Position B5")
 * @returns        The newly created Sample record
 * @throws         If type is not one of the allowed SampleType values
 */
export async function createSample(name: string, type: SampleType, location: string): Promise<Sample> {
  const validTypes: SampleType[] = ["strain", "plasmid", "primer", "chemical", "media"];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid sample type "${type}". Must be one of: ${validTypes.join(", ")}.`);
  }

  if (!name || name.trim().length === 0) {
    throw new Error("Sample name must not be empty.");
  }

  const id = randomUUID();
  const ts = now();

  // Insert sample + creation event in a single atomic batch
  await sqlBatch([
    {
      sql: `INSERT INTO samples (id, name, type, location, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      args: [id, name.trim(), type, location, ts, ts],
    },
    {
      sql: `INSERT INTO sample_events (id, sample_id, event_type, details, timestamp)
            VALUES (?, ?, ?, ?, ?)`,
      args: [randomUUID(), id, "created", `Sample "${name.trim()}" created in ${location}`, ts],
    },
  ]);

  return {
    id,
    name: name.trim(),
    type,
    location,
    status: "active",
    created_at: ts,
    updated_at: ts,
  };
}

/**
 * Move an existing sample to a new physical location.
 *
 * Records a "moved" provenance event with the previous and new locations.
 *
 * @param sampleId    ID of the sample to move
 * @param newLocation Target location string
 * @throws            If the sample does not exist
 */
export async function moveSample(sampleId: string, newLocation: string): Promise<void> {
  const sample = await sqlGet("SELECT * FROM samples WHERE id = ?", [sampleId]);
  if (!sample) {
    throw new Error(`Sample not found: ${sampleId}`);
  }

  const ts = now();
  const oldLocation = sample.location as string;

  await sqlBatch([
    {
      sql: `UPDATE samples SET location = ?, updated_at = ? WHERE id = ?`,
      args: [newLocation, ts, sampleId],
    },
    {
      sql: `INSERT INTO sample_events (id, sample_id, event_type, details, timestamp)
            VALUES (?, ?, ?, ?, ?)`,
      args: [randomUUID(), sampleId, "moved", `Moved from "${oldLocation}" to "${newLocation}"`, ts],
    },
  ]);
}

/**
 * Retrieve the full provenance history for a sample, ordered chronologically.
 *
 * @param sampleId  ID of the sample
 * @returns         Array of SampleEvent records (oldest first)
 * @throws          If the sample does not exist
 */
export async function getSampleHistory(sampleId: string): Promise<SampleEvent[]> {
  const sample = await sqlGet("SELECT id FROM samples WHERE id = ?", [sampleId]);
  if (!sample) {
    throw new Error(`Sample not found: ${sampleId}`);
  }

  const rows = await sqlAll(
    `SELECT * FROM sample_events
     WHERE sample_id = ?
     ORDER BY timestamp ASC`,
    [sampleId],
  );

  return rows.map(rowToEvent);
}

/**
 * Search for samples by name substring (case-insensitive).
 *
 * Supports optional type filtering to narrow results.
 *
 * @param query   Text to match against sample names (case-insensitive LIKE)
 * @param type    Optional type filter
 * @returns       Matching Sample records, ordered by most recently updated
 */
export async function searchSamples(query: string, type?: SampleType): Promise<Sample[]> {
  if (type) {
    const rows = await sqlAll(
      `SELECT * FROM samples
       WHERE name LIKE ? AND type = ?
       ORDER BY updated_at DESC`,
      [`%${query}%`, type],
    );
    return rows.map(rowToSample);
  }

  const rows = await sqlAll(
    `SELECT * FROM samples
     WHERE name LIKE ?
     ORDER BY updated_at DESC`,
    [`%${query}%`],
  );
  return rows.map(rowToSample);
}
