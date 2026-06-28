/**
 * n8n Webhook Trigger Client for Nexus-Bio.
 *
 * Manages webhook triggers that allow n8n workflows to receive events
 * from Nexus-Bio (e.g. experiment completed, FBA result ready, inventory updated).
 * Uses libSQL via the shared Turso client for persistent storage.
 *
 * Pure TypeScript -- no runtime dependencies beyond @libsql/client.
 */

import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface N8nTrigger {
  id: string;
  event_type: string;
  callback_url: string;
  active: number;
  created_at: string;
}

export interface CreateTriggerInput {
  eventType: string;
  callbackUrl: string;
}

export type N8nEventType =
  | "experiment.completed"
  | "experiment.failed"
  | "fba.result_ready"
  | "fba.error"
  | "inventory.created"
  | "inventory.updated"
  | "inventory.deleted"
  | "analysis.completed"
  | "analysis.error"
  | "protein.fold_ready"
  | "workflow.state_changed";

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS n8n_triggers (
    id           TEXT PRIMARY KEY,
    event_type   TEXT NOT NULL,
    callback_url TEXT NOT NULL,
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_n8n_triggers_event_type
  ON n8n_triggers (event_type)
`;

let schemaInitialized = false;

async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;
  await sqlRun(CREATE_TABLE_SQL);
  await sqlRun(CREATE_INDEX_SQL);
  schemaInitialized = true;
}

/** Reset the schema-initialization flag (for testing). */
export function resetSchemaFlag(): void {
  schemaInitialized = false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `trg_${timestamp}_${random}`;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function rowToTrigger(row: Record<string, unknown>): N8nTrigger {
  return {
    id: String(row.id),
    event_type: String(row.event_type),
    callback_url: String(row.callback_url),
    active: Number(row.active),
    created_at: String(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new n8n webhook trigger.
 *
 * @param input  Event type and callback URL.
 * @returns The newly created trigger record.
 * @throws {Error} If eventType or callbackUrl are invalid.
 */
export async function createTrigger(input: CreateTriggerInput): Promise<N8nTrigger> {
  const { eventType, callbackUrl } = input;

  if (!eventType || !eventType.trim()) {
    throw new Error("eventType is required and must be non-empty");
  }
  if (!callbackUrl || !isValidUrl(callbackUrl)) {
    throw new Error("callbackUrl must be a valid http(s) URL");
  }

  await ensureSchema();

  const id = generateId();
  const createdAt = new Date().toISOString();

  await sqlRun("INSERT INTO n8n_triggers (id, event_type, callback_url, active, created_at) VALUES (?, ?, ?, 1, ?)", [
    id,
    eventType.trim(),
    callbackUrl.trim(),
    createdAt,
  ]);

  return {
    id,
    event_type: eventType.trim(),
    callback_url: callbackUrl.trim(),
    active: 1,
    created_at: createdAt,
  };
}

/**
 * Remove (delete) a trigger by its id.
 *
 * @param id  The trigger id to remove.
 * @returns `true` if a row was deleted, `false` if no trigger matched.
 */
export async function removeTrigger(id: string): Promise<boolean> {
  if (!id || !id.trim()) {
    throw new Error("id is required");
  }

  await ensureSchema();

  const result = await sqlRun("DELETE FROM n8n_triggers WHERE id = ?", [id.trim()]);
  return result.rowsAffected > 0;
}

/**
 * List all triggers, optionally filtered by event type.
 *
 * @param eventType  If provided, only return triggers for this event type.
 * @returns Array of trigger records ordered by created_at descending.
 */
export async function listTriggers(eventType?: string): Promise<N8nTrigger[]> {
  await ensureSchema();

  let rows: Record<string, unknown>[];
  if (eventType) {
    rows = await sqlAll("SELECT * FROM n8n_triggers WHERE event_type = ? ORDER BY created_at DESC", [eventType]);
  } else {
    rows = await sqlAll("SELECT * FROM n8n_triggers ORDER BY created_at DESC");
  }

  return rows.map(rowToTrigger);
}

/**
 * Deactivate a trigger without deleting it.
 *
 * @param id  The trigger id to deactivate.
 * @returns `true` if the trigger was found and deactivated.
 */
export async function deactivateTrigger(id: string): Promise<boolean> {
  if (!id || !id.trim()) {
    throw new Error("id is required");
  }

  await ensureSchema();

  const result = await sqlRun("UPDATE n8n_triggers SET active = 0 WHERE id = ?", [id.trim()]);
  return result.rowsAffected > 0;
}

/**
 * Activate a previously deactivated trigger.
 *
 * @param id  The trigger id to activate.
 * @returns `true` if the trigger was found and activated.
 */
export async function activateTrigger(id: string): Promise<boolean> {
  if (!id || !id.trim()) {
    throw new Error("id is required");
  }

  await ensureSchema();

  const result = await sqlRun("UPDATE n8n_triggers SET active = 1 WHERE id = ?", [id.trim()]);
  return result.rowsAffected > 0;
}

/**
 * List all active triggers for a given event type.
 * Convenience wrapper used by the event dispatch layer.
 *
 * @param eventType  The event type to filter on.
 * @returns Active triggers for that event.
 */
export async function getActiveTriggersForEvent(eventType: string): Promise<N8nTrigger[]> {
  await ensureSchema();

  const rows = await sqlAll("SELECT * FROM n8n_triggers WHERE event_type = ? AND active = 1 ORDER BY created_at DESC", [
    eventType,
  ]);

  return rows.map(rowToTrigger);
}

/**
 * Drop the n8n_triggers table (for testing only).
 */
export async function dropTable(): Promise<void> {
  await sqlRun("DROP TABLE IF EXISTS n8n_triggers");
  schemaInitialized = false;
}
