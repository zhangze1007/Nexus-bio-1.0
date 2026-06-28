/**
 * Webhook Dispatcher — HMAC-signed delivery with exponential backoff retry.
 *
 * Manages webhook subscriptions, dispatches events to registered URLs,
 * and retries failed deliveries with exponential backoff (1min, 5min, 30min).
 *
 * Storage: webhooks + webhook_deliveries tables via @libsql/client (async).
 */

import { createHmac, randomBytes } from "node:crypto";
import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";
import {
  VALID_WEBHOOK_EVENTS,
  WEBHOOK_DELIVERY_TIMEOUT_MS,
  WEBHOOK_MAX_RETRIES,
  WEBHOOK_RETRY_DELAYS_MS,
  type Webhook,
  type WebhookDelivery,
  type WebhookEventType,
} from "./types";

// ─── Signing ────────────────────────────────────────────────────────────────

/**
 * Compute an HMAC-SHA256 signature over a payload string.
 *
 * @param payload - The raw JSON body to sign.
 * @param secret  - The webhook's shared secret.
 * @returns Hex-encoded HMAC-SHA256 digest.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Generate a cryptographically secure webhook secret (32-byte hex).
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

// ─── Table initialisation ───────────────────────────────────────────────────

let tablesInitialised = false;

/**
 * Ensure the webhook tables exist. Idempotent.
 */
async function ensureTables(): Promise<void> {
  if (tablesInitialised) return;

  await sqlRun(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id         TEXT PRIMARY KEY,
      org_id     TEXT NOT NULL,
      url        TEXT NOT NULL,
      events     TEXT NOT NULL,
      secret     TEXT NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  await sqlRun(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id             TEXT PRIMARY KEY,
      webhook_id     TEXT NOT NULL,
      event          TEXT NOT NULL,
      payload        TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'pending',
      response_code  INTEGER,
      response_body  TEXT,
      delivered_at   TEXT,
      retry_count    INTEGER NOT NULL DEFAULT 0,
      next_retry_at  TEXT,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
    )
  `);

  await sqlRun(`
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
    ON webhook_deliveries(status, next_retry_at)
  `);

  await sqlRun(`
    CREATE INDEX IF NOT EXISTS idx_webhooks_org
    ON webhooks(org_id)
  `);

  tablesInitialised = true;
}

// ─── CRUD helpers ───────────────────────────────────────────────────────────

/** Register a new webhook. Returns the created Webhook. */
export async function registerWebhook(params: { orgId: string; url: string; events: string[] }): Promise<Webhook> {
  await ensureTables();

  // Validate events
  const invalidEvents = params.events.filter((e) => !VALID_WEBHOOK_EVENTS.has(e));
  if (invalidEvents.length > 0) {
    throw new Error(`Invalid event types: ${invalidEvents.join(", ")}`);
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(params.url);
  } catch {
    throw new Error("Invalid webhook URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Webhook URL must use http or https protocol");
  }

  const id = crypto.randomUUID();
  const secret = generateWebhookSecret();
  const createdAt = new Date().toISOString();

  await sqlRun(
    `INSERT INTO webhooks (id, org_id, url, events, secret, active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [id, params.orgId, params.url, JSON.stringify(params.events), secret, createdAt],
  );

  return {
    id,
    orgId: params.orgId,
    url: params.url,
    events: params.events as WebhookEventType[],
    secret,
    active: true,
    createdAt,
  };
}

/** List webhooks for an org, or all webhooks if orgId is omitted. */
export async function listWebhooks(orgId?: string): Promise<Webhook[]> {
  await ensureTables();

  const rows = orgId
    ? await sqlAll("SELECT * FROM webhooks WHERE org_id = ? ORDER BY created_at DESC", [orgId])
    : await sqlAll("SELECT * FROM webhooks ORDER BY created_at DESC", []);

  return rows.map(rowToWebhook);
}

/** Get a single webhook by ID. */
export async function getWebhook(id: string): Promise<Webhook | null> {
  await ensureTables();
  const row = await sqlGet("SELECT * FROM webhooks WHERE id = ?", [id]);
  return row ? rowToWebhook(row) : null;
}

/** Delete a webhook by ID. Returns true if a row was deleted. */
export async function deleteWebhook(id: string): Promise<boolean> {
  await ensureTables();
  // Deliveries are cascade-deleted by the FK constraint
  const result = await sqlRun("DELETE FROM webhooks WHERE id = ?", [id]);
  return result.rowsAffected > 0;
}

/** Get deliveries for a webhook, most recent first. */
export async function getDeliveries(webhookId: string, limit = 50): Promise<WebhookDelivery[]> {
  await ensureTables();
  const rows = await sqlAll(
    "SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY delivered_at DESC, id DESC LIMIT ?",
    [webhookId, limit],
  );
  return rows.map(rowToDelivery);
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

/**
 * Dispatch an event to all active webhooks subscribed to that event type.
 *
 * For each matching webhook:
 *  1. Signs the JSON payload with the webhook secret (HMAC-SHA256).
 *  2. POSTs the payload with standard headers.
 *  3. Records the delivery attempt.
 *  4. On failure, schedules a retry using exponential backoff.
 */
export async function dispatch(event: string, payload: Record<string, unknown>): Promise<void> {
  await ensureTables();

  if (!VALID_WEBHOOK_EVENTS.has(event)) {
    throw new Error(`Unknown event type: ${event}`);
  }

  // Find all active webhooks subscribed to this event
  const rows = await sqlAll("SELECT * FROM webhooks WHERE active = 1", []);

  const matchingWebhooks = rows.map(rowToWebhook).filter((wh) => wh.events.includes(event as WebhookEventType));

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

  // Fire-and-record for each matching webhook
  await Promise.allSettled(matchingWebhooks.map((webhook) => deliverToWebhook(webhook, event, body)));
}

/**
 * Retry all failed deliveries that have passed their nextRetryAt time.
 *
 * Returns the number of deliveries retried.
 */
export async function retryFailed(): Promise<number> {
  await ensureTables();

  const now = new Date().toISOString();
  const failedRows = await sqlAll(
    `SELECT * FROM webhook_deliveries
     WHERE status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= ?`,
    [now],
  );

  const deliveries = failedRows.map(rowToDelivery);
  let retried = 0;

  for (const delivery of deliveries) {
    const webhook = await getWebhook(delivery.webhookId);
    if (!webhook || !webhook.active) {
      // Webhook was deleted or deactivated — mark delivery as permanently failed
      await sqlRun("UPDATE webhook_deliveries SET status = 'failed', next_retry_at = NULL WHERE id = ?", [delivery.id]);
      continue;
    }

    const body = JSON.stringify({
      event: delivery.event,
      payload: delivery.payload,
      timestamp: new Date().toISOString(),
    });

    await attemptDelivery(webhook, delivery, body);
    retried++;
  }

  return retried;
}

// ─── Internal delivery logic ────────────────────────────────────────────────

/**
 * Create a delivery record and attempt the first POST.
 */
async function deliverToWebhook(webhook: Webhook, event: string, body: string): Promise<void> {
  const deliveryId = crypto.randomUUID();

  // Insert initial delivery record as pending
  await sqlRun(
    `INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status, retry_count)
     VALUES (?, ?, ?, ?, 'pending', 0)`,
    [deliveryId, webhook.id, event, body],
  );

  const delivery: WebhookDelivery = {
    id: deliveryId,
    webhookId: webhook.id,
    event,
    payload: JSON.parse(body) as Record<string, unknown>,
    status: "pending",
    retryCount: 0,
  };

  await attemptDelivery(webhook, delivery, body);
}

/**
 * Perform an HTTP POST with HMAC signature and record the result.
 */
async function attemptDelivery(webhook: Webhook, delivery: WebhookDelivery, body: string): Promise<void> {
  const signature = signPayload(body, webhook.secret);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_DELIVERY_TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": delivery.event,
        "X-Webhook-Delivery": delivery.id,
        "User-Agent": "Nexus-Bio-Webhook/1.0",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      // Success
      await sqlRun(
        `UPDATE webhook_deliveries
         SET status = 'delivered', response_code = ?, response_body = ?,
             delivered_at = ?, next_retry_at = NULL
         WHERE id = ?`,
        [response.status, responseBody.slice(0, 4096), new Date().toISOString(), delivery.id],
      );
    } else {
      // Non-2xx response — schedule retry
      await scheduleRetry(delivery, response.status, responseBody);
    }
  } catch (err) {
    // Network error — schedule retry
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await scheduleRetry(delivery, undefined, errorMessage);
  }
}

/**
 * Record a failed delivery attempt and schedule the next retry if applicable.
 */
async function scheduleRetry(
  delivery: WebhookDelivery,
  responseCode: number | undefined,
  responseBody: string,
): Promise<void> {
  const newRetryCount = delivery.retryCount + 1;

  if (newRetryCount > WEBHOOK_MAX_RETRIES) {
    // Exhausted retries — mark as permanently failed
    await sqlRun(
      `UPDATE webhook_deliveries
       SET status = 'failed', response_code = ?, response_body = ?,
           retry_count = ?, next_retry_at = NULL
       WHERE id = ?`,
      [responseCode ?? null, responseBody.slice(0, 4096), newRetryCount, delivery.id],
    );
    return;
  }

  // Schedule next retry with exponential backoff
  const delayMs = WEBHOOK_RETRY_DELAYS_MS[newRetryCount - 1];
  const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

  await sqlRun(
    `UPDATE webhook_deliveries
     SET status = 'failed', response_code = ?, response_body = ?,
         retry_count = ?, next_retry_at = ?
     WHERE id = ?`,
    [responseCode ?? null, responseBody.slice(0, 4096), newRetryCount, nextRetryAt, delivery.id],
  );
}

// ─── Row mappers ────────────────────────────────────────────────────────────

function rowToWebhook(row: Record<string, unknown>): Webhook {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    url: String(row.url),
    events: JSON.parse(String(row.events)) as WebhookEventType[],
    secret: String(row.secret),
    active: Number(row.active) === 1,
    createdAt: String(row.created_at),
  };
}

function rowToDelivery(row: Record<string, unknown>): WebhookDelivery {
  return {
    id: String(row.id),
    webhookId: String(row.webhook_id),
    event: String(row.event),
    payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
    status: String(row.status) as WebhookDelivery["status"],
    responseCode: row.response_code != null ? Number(row.response_code) : undefined,
    responseBody: row.response_body != null ? String(row.response_body) : undefined,
    deliveredAt: row.delivered_at != null ? String(row.delivered_at) : undefined,
    retryCount: Number(row.retry_count),
    nextRetryAt: row.next_retry_at != null ? String(row.next_retry_at) : undefined,
  };
}
