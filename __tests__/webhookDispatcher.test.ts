/** @jest-environment node */
/**
 * webhookDispatcher.test.ts — dispatch, signing, retry with exponential backoff.
 *
 * Mocks the libsqlDb layer to avoid real SQLite dependencies.
 * Mocks global fetch to simulate webhook delivery outcomes.
 */

import { createHmac } from "node:crypto";

// ─── In-memory mock store ───────────────────────────────────────────────────

const webhookStore: Map<string, Record<string, unknown>> = new Map();
const deliveryStore: Map<string, Record<string, unknown>> = new Map();

const mockSqlAll = jest.fn(async (sql: string, args: unknown[] = []) => {
  if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) return [];

  // Webhook queries
  if (sql.includes("FROM webhooks WHERE org_id")) {
    const orgId = args[0];
    return Array.from(webhookStore.values()).filter((r) => r.org_id === orgId);
  }
  if (sql.includes("FROM webhooks WHERE active")) {
    return Array.from(webhookStore.values()).filter((r) => r.active === 1);
  }
  if (sql.includes("FROM webhooks WHERE id")) {
    const id = args[0];
    const row = webhookStore.get(String(id));
    return row ? [row] : [];
  }
  if (sql.includes("FROM webhooks")) {
    return Array.from(webhookStore.values());
  }

  // Delivery queries — use broad matching since SQL may have newlines
  if (sql.includes("webhook_deliveries") && sql.includes("webhook_id")) {
    const webhookId = args[0];
    return Array.from(deliveryStore.values())
      .filter((r) => r.webhook_id === webhookId)
      .slice(0, Number(args[1]) || 50);
  }
  if (sql.includes("webhook_deliveries") && sql.includes("status = 'failed'")) {
    // retryFailed query: deliveries with status='failed' and next_retry_at <= now
    const now = String(args[0]);
    return Array.from(deliveryStore.values()).filter(
      (r) => r.status === "failed" && r.next_retry_at && String(r.next_retry_at) <= now,
    );
  }
  if (sql.includes("webhook_deliveries")) {
    return Array.from(deliveryStore.values());
  }

  return [];
});

const mockSqlGet = jest.fn(async (sql: string, args: unknown[] = []) => {
  if (sql.includes("FROM webhooks WHERE id")) {
    const id = args[0];
    return webhookStore.get(String(id));
  }
  return undefined;
});

const mockSqlRun = jest.fn(async (sql: string, args: unknown[] = []) => {
  if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
    return { rowsAffected: 0 };
  }

  // INSERT INTO webhooks — active is hardcoded as 1 in the SQL, not a parameter
  if (sql.includes("INSERT INTO webhooks")) {
    const row: Record<string, unknown> = {
      id: args[0],
      org_id: args[1],
      url: args[2],
      events: args[3],
      secret: args[4],
      active: 1, // hardcoded in SQL: VALUES (?, ?, ?, ?, ?, 1, ?)
      created_at: args[5],
    };
    webhookStore.set(String(args[0]), row);
    return { rowsAffected: 1 };
  }

  // INSERT INTO webhook_deliveries — status and retry_count are hardcoded in SQL
  if (sql.includes("INSERT INTO webhook_deliveries")) {
    const row: Record<string, unknown> = {
      id: args[0],
      webhook_id: args[1],
      event: args[2],
      payload: args[3],
      status: "pending", // hardcoded in SQL: VALUES (?, ?, ?, ?, 'pending', 0)
      response_code: null,
      response_body: null,
      delivered_at: null,
      retry_count: 0, // hardcoded in SQL
      next_retry_at: null,
    };
    deliveryStore.set(String(args[0]), row);
    return { rowsAffected: 1 };
  }

  // UPDATE webhook_deliveries
  if (sql.includes("UPDATE webhook_deliveries")) {
    // The WHERE id = ? is always the last parameter
    const id = String(args[args.length - 1]);
    const delivery = deliveryStore.get(id);
    if (!delivery) return { rowsAffected: 0 };

    // Delivered update: SET status = 'delivered', response_code = ?, response_body = ?, delivered_at = ?, next_retry_at = NULL
    // Args: [response_code, response_body, delivered_at, id]
    if (sql.includes("'delivered'")) {
      delivery.status = "delivered";
      delivery.response_code = args[0];
      delivery.response_body = args[1];
      delivery.delivered_at = args[2];
      delivery.next_retry_at = null;
    }
    // Failed with next_retry_at: SET status = 'failed', response_code = ?, response_body = ?, retry_count = ?, next_retry_at = ?
    // Args: [response_code, response_body, retry_count, next_retry_at, id]
    else if (sql.includes("next_retry_at = ?")) {
      delivery.status = "failed";
      delivery.response_code = args[0];
      delivery.response_body = args[1];
      delivery.retry_count = args[2];
      delivery.next_retry_at = args[3];
    }
    // Failed permanently (scheduleRetry path): SET status = 'failed', response_code = ?, response_body = ?, retry_count = ?, next_retry_at = NULL
    // Args: [response_code, response_body, retry_count, id]
    else if (sql.includes("next_retry_at = NULL") && sql.includes("response_code")) {
      delivery.status = "failed";
      delivery.response_code = args[0];
      delivery.response_body = args[1];
      delivery.retry_count = args[2];
      delivery.next_retry_at = null;
    }
    // Simple permanent fail (retryFailed path): SET status = 'failed', next_retry_at = NULL
    // Args: [id]
    else if (sql.includes("next_retry_at = NULL")) {
      delivery.status = "failed";
      delivery.next_retry_at = null;
    }

    return { rowsAffected: 1 };
  }

  // DELETE FROM webhooks
  if (sql.includes("DELETE FROM webhooks")) {
    const id = String(args[0]);
    if (webhookStore.has(id)) {
      webhookStore.delete(id);
      // Cascade delete deliveries
      for (const [delId, del] of deliveryStore.entries()) {
        if (del.webhook_id === id) deliveryStore.delete(delId);
      }
      return { rowsAffected: 1 };
    }
    return { rowsAffected: 0 };
  }

  return { rowsAffected: 0 };
});

jest.mock("../src/server/libsqlDb", () => ({
  sqlAll: mockSqlAll,
  sqlGet: mockSqlGet,
  sqlRun: mockSqlRun,
  sqlBatch: jest.fn(async () => {}),
  closeLibsqlClient: jest.fn(),
}));

// ─── Mock fetch ─────────────────────────────────────────────────────────────

const mockFetchImpl = jest.fn();
// Re-assign global.fetch before each test to ensure the mock is fresh
beforeEach(() => {
  global.fetch = mockFetchImpl as unknown as typeof fetch;
});

// ─── Import after mocks are set up ──────────────────────────────────────────

import {
  signPayload,
  generateWebhookSecret,
  registerWebhook,
  listWebhooks,
  getWebhook,
  deleteWebhook,
  getDeliveries,
  dispatch,
  retryFailed,
} from "../src/services/webhooks/webhookDispatcher";
import { WEBHOOK_RETRY_DELAYS_MS } from "../src/services/webhooks/types";

// ─── Reset between tests ────────────────────────────────────────────────────

beforeEach(() => {
  webhookStore.clear();
  deliveryStore.clear();
  mockFetchImpl.mockReset();
  mockSqlAll.mockClear();
  mockSqlGet.mockClear();
  mockSqlRun.mockClear();
});

// ─── Signing ────────────────────────────────────────────────────────────────

describe("signPayload", () => {
  it("produces a valid HMAC-SHA256 hex digest", () => {
    const secret = "test-secret-123";
    const payload = '{"event":"test"}';
    const sig = signPayload(payload, secret);

    const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
    expect(sig).toBe(expected);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different signatures for different secrets", () => {
    const payload = '{"event":"test"}';
    const sig1 = signPayload(payload, "secret-a");
    const sig2 = signPayload(payload, "secret-b");
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures for different payloads", () => {
    const secret = "same-secret";
    const sig1 = signPayload('{"event":"a"}', secret);
    const sig2 = signPayload('{"event":"b"}', secret);
    expect(sig1).not.toBe(sig2);
  });
});

// ─── generateWebhookSecret ──────────────────────────────────────────────────

describe("generateWebhookSecret", () => {
  it("returns a 64-character hex string (32 bytes)", () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns unique values on successive calls", () => {
    const s1 = generateWebhookSecret();
    const s2 = generateWebhookSecret();
    expect(s1).not.toBe(s2);
  });
});

// ─── registerWebhook ────────────────────────────────────────────────────────

describe("registerWebhook", () => {
  it("creates a webhook and returns it with a secret", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    expect(wh.id).toBeTruthy();
    expect(wh.orgId).toBe("org-1");
    expect(wh.url).toBe("https://example.com/hook");
    expect(wh.events).toEqual(["experiment.complete"]);
    expect(wh.secret).toMatch(/^[a-f0-9]{64}$/);
    expect(wh.active).toBe(true);
    expect(wh.createdAt).toBeTruthy();
  });

  it("rejects invalid event types", async () => {
    await expect(
      registerWebhook({
        orgId: "org-1",
        url: "https://example.com/hook",
        events: ["invalid.event"],
      }),
    ).rejects.toThrow("Invalid event types: invalid.event");
  });

  it("rejects invalid URLs", async () => {
    await expect(
      registerWebhook({
        orgId: "org-1",
        url: "not-a-url",
        events: ["experiment.complete"],
      }),
    ).rejects.toThrow("Invalid webhook URL");
  });

  it("rejects non-http(s) protocols", async () => {
    await expect(
      registerWebhook({
        orgId: "org-1",
        url: "ftp://example.com/hook",
        events: ["experiment.complete"],
      }),
    ).rejects.toThrow("Webhook URL must use http or https protocol");
  });

  it("accepts multiple event types", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete", "milestone.reached", "task.assigned"],
    });
    expect(wh.events).toHaveLength(3);
  });
});

// ─── listWebhooks / getWebhook / deleteWebhook ──────────────────────────────

describe("CRUD operations", () => {
  it("lists webhooks filtered by orgId", async () => {
    await registerWebhook({
      orgId: "org-a",
      url: "https://a.example.com/hook",
      events: ["experiment.complete"],
    });
    await registerWebhook({
      orgId: "org-b",
      url: "https://b.example.com/hook",
      events: ["task.assigned"],
    });

    const orgAWebhooks = await listWebhooks("org-a");
    expect(orgAWebhooks).toHaveLength(1);
    expect(orgAWebhooks[0].orgId).toBe("org-a");

    const allWebhooks = await listWebhooks();
    expect(allWebhooks).toHaveLength(2);
  });

  it("gets a single webhook by ID", async () => {
    const created = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    const found = await getWebhook(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it("returns null for non-existent webhook", async () => {
    const found = await getWebhook("non-existent-id");
    expect(found).toBeNull();
  });

  it("deletes a webhook and its deliveries", async () => {
    const created = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    // Simulate a delivery record
    deliveryStore.set("del-1", {
      id: "del-1",
      webhook_id: created.id,
      event: "experiment.complete",
      payload: "{}",
      status: "delivered",
    });

    const deleted = await deleteWebhook(created.id);
    expect(deleted).toBe(true);

    expect(webhookStore.has(created.id)).toBe(false);
    expect(deliveryStore.has("del-1")).toBe(false);
  });

  it("returns false when deleting non-existent webhook", async () => {
    const deleted = await deleteWebhook("non-existent");
    expect(deleted).toBe(false);
  });
});

// ─── dispatch ───────────────────────────────────────────────────────────────

describe("dispatch", () => {
  it("delivers event to matching webhooks", async () => {
    await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "OK",
    });

    await dispatch("experiment.complete", { experimentId: "exp-1" });

    expect(mockFetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetchImpl.mock.calls[0];
    expect(url).toBe("https://example.com/hook");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["X-Webhook-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(options.headers["X-Webhook-Event"]).toBe("experiment.complete");
    expect(options.headers["User-Agent"]).toBe("Nexus-Bio-Webhook/1.0");
  });

  it("does not deliver to webhooks subscribed to other events", async () => {
    await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["task.assigned"],
    });

    await dispatch("experiment.complete", { experimentId: "exp-1" });

    expect(mockFetchImpl).not.toHaveBeenCalled();
  });

  it("does not deliver to inactive webhooks", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    // Deactivate the webhook directly in the mock store
    const row = webhookStore.get(wh.id);
    if (row) row.active = 0;

    await dispatch("experiment.complete", { experimentId: "exp-1" });

    expect(mockFetchImpl).not.toHaveBeenCalled();
  });

  it("delivers to multiple matching webhooks", async () => {
    await registerWebhook({
      orgId: "org-1",
      url: "https://a.example.com/hook",
      events: ["experiment.complete"],
    });
    await registerWebhook({
      orgId: "org-1",
      url: "https://b.example.com/hook",
      events: ["experiment.complete", "task.assigned"],
    });

    mockFetchImpl.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "OK",
    });

    await dispatch("experiment.complete", { experimentId: "exp-1" });

    expect(mockFetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown event types", async () => {
    await expect(
      dispatch("unknown.event", {}),
    ).rejects.toThrow("Unknown event type: unknown.event");
  });

  it("records delivery as failed on non-2xx response and schedules retry", async () => {
    await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    mockFetchImpl.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await dispatch("experiment.complete", { experimentId: "exp-1" });

    expect(deliveryStore.size).toBeGreaterThan(0);
    const delivery = Array.from(deliveryStore.values())[0];
    expect(delivery.status).toBe("failed");
    expect(delivery.response_code).toBe(500);
    expect(delivery.retry_count).toBe(1);
    expect(delivery.next_retry_at).toBeTruthy();
  });

  it("records delivery as failed on network error and schedules retry", async () => {
    await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    mockFetchImpl.mockRejectedValueOnce(new Error("Connection refused"));

    await dispatch("experiment.complete", { experimentId: "exp-1" });

    expect(deliveryStore.size).toBeGreaterThan(0);
    const delivery = Array.from(deliveryStore.values())[0];
    expect(delivery.status).toBe("failed");
    expect(delivery.response_body).toBe("Connection refused");
    expect(delivery.retry_count).toBe(1);
    expect(delivery.next_retry_at).toBeTruthy();
  });

  it("sends correct HMAC signature in X-Webhook-Signature header", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "OK",
    });

    await dispatch("experiment.complete", { experimentId: "exp-1" });

    const sentBody = mockFetchImpl.mock.calls[0][1].body as string;
    const sentSignature = mockFetchImpl.mock.calls[0][1].headers["X-Webhook-Signature"];
    const expectedSig = `sha256=${signPayload(sentBody, wh.secret)}`;

    expect(sentSignature).toBe(expectedSig);
  });

  it("includes X-Webhook-Delivery header with delivery ID", async () => {
    await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "OK",
    });

    await dispatch("experiment.complete", { experimentId: "exp-1" });

    const deliveryHeader = mockFetchImpl.mock.calls[0][1].headers["X-Webhook-Delivery"];
    expect(deliveryHeader).toBeTruthy();
    expect(typeof deliveryHeader).toBe("string");
  });
});

// ─── retryFailed ────────────────────────────────────────────────────────────

describe("retryFailed", () => {
  it("retries deliveries whose nextRetryAt has passed", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    // Insert a failed delivery with a past retry time
    const pastTime = new Date(Date.now() - 1000).toISOString();
    deliveryStore.set("del-retry-1", {
      id: "del-retry-1",
      webhook_id: wh.id,
      event: "experiment.complete",
      payload: JSON.stringify({ event: "experiment.complete", payload: {}, timestamp: "now" }),
      status: "failed",
      response_code: 500,
      response_body: "Error",
      delivered_at: null,
      retry_count: 1,
      next_retry_at: pastTime,
    });

    mockFetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "OK",
    });

    const retried = await retryFailed();

    expect(retried).toBe(1);
    expect(mockFetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry deliveries whose nextRetryAt is in the future", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    const futureTime = new Date(Date.now() + 600_000).toISOString();
    deliveryStore.set("del-future", {
      id: "del-future",
      webhook_id: wh.id,
      event: "experiment.complete",
      payload: "{}",
      status: "failed",
      retry_count: 1,
      next_retry_at: futureTime,
    });

    const retried = await retryFailed();

    expect(retried).toBe(0);
    expect(mockFetchImpl).not.toHaveBeenCalled();
  });

  it("gives up after exhausting all retries", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    // Insert a delivery that has already exhausted retries
    const pastTime = new Date(Date.now() - 1000).toISOString();
    deliveryStore.set("del-exhausted", {
      id: "del-exhausted",
      webhook_id: wh.id,
      event: "experiment.complete",
      payload: JSON.stringify({ event: "experiment.complete", payload: {}, timestamp: "now" }),
      status: "failed",
      response_code: 500,
      response_body: "Error",
      delivered_at: null,
      retry_count: WEBHOOK_RETRY_DELAYS_MS.length, // already at max
      next_retry_at: pastTime,
    });

    mockFetchImpl.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Still broken",
    });

    const retried = await retryFailed();

    expect(retried).toBe(1);
    expect(mockFetchImpl).toHaveBeenCalledTimes(1);
  });

  it("skips retries for deactivated webhooks", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    // Deactivate the webhook
    const row = webhookStore.get(wh.id);
    if (row) row.active = 0;

    const pastTime = new Date(Date.now() - 1000).toISOString();
    deliveryStore.set("del-deactivated", {
      id: "del-deactivated",
      webhook_id: wh.id,
      event: "experiment.complete",
      payload: "{}",
      status: "failed",
      retry_count: 1,
      next_retry_at: pastTime,
    });

    const retried = await retryFailed();

    // Deactivated webhooks use `continue` in the loop, so retried stays 0
    // but the delivery IS still processed (marked as permanently failed)
    expect(retried).toBe(0);
    expect(mockFetchImpl).not.toHaveBeenCalled();
    // Delivery should be permanently failed
    const delivery = deliveryStore.get("del-deactivated");
    expect(delivery!.next_retry_at).toBeNull();
  });

  it("returns 0 when no deliveries need retry", async () => {
    const retried = await retryFailed();
    expect(retried).toBe(0);
  });
});

// ─── getDeliveries ──────────────────────────────────────────────────────────

describe("getDeliveries", () => {
  it("returns deliveries for a specific webhook", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    deliveryStore.set("d1", {
      id: "d1", webhook_id: wh.id, event: "experiment.complete",
      payload: "{}", status: "delivered", retry_count: 0,
    });
    deliveryStore.set("d2", {
      id: "d2", webhook_id: wh.id, event: "experiment.complete",
      payload: "{}", status: "failed", retry_count: 2,
    });

    const deliveries = await getDeliveries(wh.id);
    expect(deliveries).toHaveLength(2);
  });

  it("returns empty array for webhook with no deliveries", async () => {
    const wh = await registerWebhook({
      orgId: "org-1",
      url: "https://example.com/hook",
      events: ["experiment.complete"],
    });

    const deliveries = await getDeliveries(wh.id);
    expect(deliveries).toHaveLength(0);
  });
});
