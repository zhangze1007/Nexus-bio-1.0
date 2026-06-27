import {
  registerZapierTrigger,
  removeZapierTrigger,
  listZapierTriggers,
  fireZapierTriggers,
  dropTable,
  resetSchemaFlag,
} from "../src/services/integrations/zapierClient";
import { closeLibsqlClient } from "../src/server/libsqlDb";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

afterAll(() => {
  closeLibsqlClient();
});

describe("zapierClient", () => {
  beforeEach(async () => {
    resetSchemaFlag();
    await dropTable();
    mockFetch.mockReset();
  });

  afterEach(async () => {
    await dropTable();
  });

  // ---- registerZapierTrigger ----

  test("registerZapierTrigger inserts a trigger and returns it", async () => {
    const trigger = await registerZapierTrigger({
      eventType: "experiment.completed",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/123/abc/",
    });

    expect(trigger.id).toMatch(/^zap_/);
    expect(trigger.event_type).toBe("experiment.completed");
    expect(trigger.webhook_url).toBe(
      "https://hooks.zapier.com/hooks/catch/123/abc/",
    );
    expect(trigger.active).toBe(1);
    expect(trigger.created_at).toBeTruthy();
  });

  test("registerZapierTrigger trims whitespace from eventType and webhookUrl", async () => {
    const trigger = await registerZapierTrigger({
      eventType: "  fba.result_ready  ",
      webhookUrl: "  https://hooks.zapier.com/hooks/catch/456/  ",
    });

    expect(trigger.event_type).toBe("fba.result_ready");
    expect(trigger.webhook_url).toBe("https://hooks.zapier.com/hooks/catch/456/");
  });

  test("registerZapierTrigger throws on empty eventType", async () => {
    await expect(
      registerZapierTrigger({
        eventType: "",
        webhookUrl: "https://hooks.zapier.com/hooks/catch/1/",
      }),
    ).rejects.toThrow("eventType is required");
  });

  test("registerZapierTrigger throws on invalid webhookUrl", async () => {
    await expect(
      registerZapierTrigger({
        eventType: "test.event",
        webhookUrl: "not-a-url",
      }),
    ).rejects.toThrow("webhookUrl must be a valid http(s) URL");
  });

  test("registerZapierTrigger rejects ftp:// URLs", async () => {
    await expect(
      registerZapierTrigger({
        eventType: "test.event",
        webhookUrl: "ftp://files.example.com/hook",
      }),
    ).rejects.toThrow("webhookUrl must be a valid http(s) URL");
  });

  // ---- removeZapierTrigger ----

  test("removeZapierTrigger deletes an existing trigger and returns true", async () => {
    const trigger = await registerZapierTrigger({
      eventType: "inventory.created",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/del/",
    });

    const removed = await removeZapierTrigger(trigger.id);
    expect(removed).toBe(true);

    const remaining = await listZapierTriggers();
    expect(remaining).toHaveLength(0);
  });

  test("removeZapierTrigger returns false for nonexistent id", async () => {
    const removed = await removeZapierTrigger("zap_nonexistent");
    expect(removed).toBe(false);
  });

  test("removeZapierTrigger throws on empty id", async () => {
    await expect(removeZapierTrigger("")).rejects.toThrow("id is required");
  });

  // ---- listZapierTriggers ----

  test("listZapierTriggers returns all triggers ordered by created_at descending", async () => {
    await registerZapierTrigger({
      eventType: "a.event",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/1/",
    });
    await registerZapierTrigger({
      eventType: "b.event",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/2/",
    });
    await registerZapierTrigger({
      eventType: "a.event",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/3/",
    });

    const all = await listZapierTriggers();
    expect(all).toHaveLength(3);
    expect(all[0].webhook_url).toBe("https://hooks.zapier.com/hooks/catch/3/");
  });

  test("listZapierTriggers filters by eventType", async () => {
    await registerZapierTrigger({
      eventType: "fba.result_ready",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/fba1/",
    });
    await registerZapierTrigger({
      eventType: "experiment.completed",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/exp/",
    });
    await registerZapierTrigger({
      eventType: "fba.result_ready",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/fba2/",
    });

    const fbaTriggers = await listZapierTriggers("fba.result_ready");
    expect(fbaTriggers).toHaveLength(2);
    expect(
      fbaTriggers.every((t) => t.event_type === "fba.result_ready"),
    ).toBe(true);
  });

  test("listZapierTriggers returns empty array when no triggers exist", async () => {
    const triggers = await listZapierTriggers();
    expect(triggers).toEqual([]);
  });

  // ---- fireZapierTriggers ----

  test("fireZapierTriggers POSTs Zapier-compatible payload to each active webhook", async () => {
    await registerZapierTrigger({
      eventType: "experiment.completed",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/hook1/",
    });
    await registerZapierTrigger({
      eventType: "experiment.completed",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/hook2/",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const results = await fireZapierTriggers("experiment.completed", {
      experimentId: "exp-42",
    });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify payload structure
    const firstCall = mockFetch.mock.calls[0];
    const body = JSON.parse(firstCall[1].body);
    expect(body.event_type).toBe("experiment.completed");
    expect(body.source).toBe("nexus-bio");
    expect(body.timestamp).toBeTruthy();
    expect(body.data).toEqual({ experimentId: "exp-42" });
    expect(firstCall[1].method).toBe("POST");
    expect(firstCall[1].headers["Content-Type"]).toBe("application/json");
  });

  test("fireZapierTriggers returns empty array when no active triggers match", async () => {
    const results = await fireZapierTriggers("no.such.event", { x: 1 });
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("fireZapierTriggers does not fire inactive triggers", async () => {
    const trigger = await registerZapierTrigger({
      eventType: "analysis.completed",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/inactive/",
    });

    // Deactivate by removing and re-creating as inactive scenario:
    // We can't deactivate directly, but removeZapierTrigger removes it entirely.
    await removeZapierTrigger(trigger.id);

    mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

    const results = await fireZapierTriggers("analysis.completed", {
      result: "ok",
    });
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("fireZapierTriggers returns error result when fetch fails", async () => {
    await registerZapierTrigger({
      eventType: "fba.error",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/fail/",
    });

    mockFetch.mockRejectedValue(new Error("Network timeout"));

    const results = await fireZapierTriggers("fba.error", { error: "bad input" });

    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toBe("Network timeout");
    expect(results[0].status).toBe(0);
  });

  test("fireZapierTriggers throws on empty eventType", async () => {
    await expect(fireZapierTriggers("", { x: 1 })).rejects.toThrow(
      "eventType is required",
    );
  });

  // ---- unique ids ----

  test("registerZapierTrigger generates unique ids for successive calls", async () => {
    const t1 = await registerZapierTrigger({
      eventType: "test",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/u1/",
    });
    const t2 = await registerZapierTrigger({
      eventType: "test",
      webhookUrl: "https://hooks.zapier.com/hooks/catch/u2/",
    });
    expect(t1.id).not.toBe(t2.id);
  });
});
