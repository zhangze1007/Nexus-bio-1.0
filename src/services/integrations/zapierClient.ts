/**
 * Zapier Webhook Trigger Client for Nexus-Bio.
 *
 * Manages webhook triggers that allow Zapier Zaps to receive events
 * from Nexus-Bio (e.g. experiment completed, FBA result ready, inventory updated).
 * Uses libSQL via the shared Turso client for persistent storage.
 *
 * When firing, POSTs a Zapier-compatible JSON payload to each active
 * webhook URL for the given event type.
 *
 * Pure TypeScript -- no runtime dependencies beyond @libsql/client.
 */

import { sqlAll, sqlRun } from "../../server/libsqlDb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZapierTrigger {
  id: string;
  event_type: string;
  webhook_url: string;
  active: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS zapier_triggers (
    id           TEXT PRIMARY KEY,
    event_type   TEXT NOT NULL,
    webhook_url  TEXT NOT NULL,
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_zapier_triggers_event_type
  ON zapier_triggers (event_type)
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
  return `zap_${timestamp}_${random}`;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function rowToTrigger(row: Record<string, unknown>): ZapierTrigger {
  return {
    id: String(row.id),
    event_type: String(row.event_type),
    webhook_url: String(row.webhook_url),
    active: Number(row.active),
    created_at: String(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a new Zapier webhook trigger.
 *
 * @param eventType  The event type to subscribe to.
 * @param webhookUrl  The Zapier webhook URL to POST to.
 * @returns The newly created trigger id.
 * @throws {Error} If eventType or webhookUrl are invalid.
 */
export async function registerZapierTrigger(eventType: string, webhookUrl: string): Promise<string> {
  if (!eventType || !eventType.trim()) {
    throw new Error("eventType is required and must be non-empty");
  }
  if (!webhookUrl || !isValidUrl(webhookUrl)) {
    throw new Error("webhookUrl must be a valid http(s) URL");
  }

  await ensureSchema();

  const id = generateId();
  const createdAt = new Date().toISOString();

  await sqlRun("INSERT INTO zapier_triggers (id, event_type, webhook_url, active, created_at) VALUES (?, ?, ?, 1, ?)", [
    id,
    eventType.trim(),
    webhookUrl.trim(),
    createdAt,
  ]);

  return id;
}

/**
 * Remove (delete) a trigger by its id.
 *
 * @param id  The trigger id to remove.
 */
export async function removeZapierTrigger(id: string): Promise<void> {
  if (!id || !id.trim()) {
    throw new Error("id is required");
  }

  await ensureSchema();

  await sqlRun("DELETE FROM zapier_triggers WHERE id = ?", [id.trim()]);
}

/**
 * List all Zapier triggers.
 *
 * @returns Array of trigger records ordered by created_at descending.
 */
export async function listZapierTriggers(): Promise<ZapierTrigger[]> {
  await ensureSchema();

  const rows = await sqlAll("SELECT * FROM zapier_triggers ORDER BY created_at DESC");

  return rows.map(rowToTrigger);
}

/**
 * Fire all active Zapier triggers for a given event type.
 *
 * POSTs a Zapier-compatible JSON payload to each active webhook URL.
 * All webhook calls are made in parallel. Failures are swallowed so
 * one broken webhook does not block the others.
 *
 * @param eventType  The event type to fire triggers for.
 * @param payload    Arbitrary data to include in the webhook body.
 */
export async function fireZapierTriggers(eventType: string, payload: Record<string, unknown>): Promise<void> {
  if (!eventType || !eventType.trim()) {
    throw new Error("eventType is required and must be non-empty");
  }

  await ensureSchema();

  const rows = await sqlAll("SELECT * FROM zapier_triggers WHERE event_type = ? AND active = 1", [eventType.trim()]);

  const triggers = rows.map(rowToTrigger);

  if (triggers.length === 0) {
    return;
  }

  const webhookPayload = {
    event_type: eventType.trim(),
    timestamp: new Date().toISOString(),
    data: payload,
    source: "nexus-bio",
  };

  await Promise.allSettled(
    triggers.map(async (trigger) => {
      await fetch(trigger.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });
    }),
  );
}

/**
 * Drop the zapier_triggers table (for testing only).
 */
export async function dropTable(): Promise<void> {
  await sqlRun("DROP TABLE IF EXISTS zapier_triggers");
  schemaInitialized = false;
}
