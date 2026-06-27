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

  test("registerZapierTrigger inserts a trigger and returns its id", async () => {
    const id = await registerZapierTrigger(
      "experiment.completed",
      "https://hooks.zapier.com/hooks/catch/123/abc/",
    );

    expect(id).toMatch(/^zap_/);
    expect(typeof id).toBe("string");

    const all = await listZapierTriggers();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(id);
    expect(all[0].event_type).toBe("experiment.completed");
    expect(all[0].webhook_url).toBe(
      "https://hooks.zapier.com/hooks/catch/123/abc/",
    );
    expect(all[0].active).toBe(1);
    expect(all[0].created_at).toBeTruthy();
  });

  test("registerZapierTrigger trims whitespace from eventType and webhookUrl", async () => {
    const id = await registerZapierTrigger(
      "  fba.result_ready  ",
      "  https://hooks.zapier.com/hooks/catch/456/  ",
    );

    const all = await listZapierTriggers();
    const trigger = all.find((t) => t.id === id);
    expect(trigger).toBeDefined();
    expect(trigger!.event_type).toBe("fba.result_ready");
    expect(trigger!.webhook_url).toBe("https://hooks.zapier.com/hooks/catch/456/");
  });

  test("registerZapierTrigger throws on empty eventType", async () => {
    await expect(
      registerZapierTrigger("", "https://hooks.zapier.com/hooks/catch/1/"),
    ).rejects.toThrow("eventType is required");
  });

  test("registerZapierTrigger throws on invalid webhookUrl", async () => {
    await expect(
      registerZapierTrigger("test.event", "not-a-url"),
    ).rejects.toThrow("webhookUrl must be a valid http(s) URL");
  });

  test("registerZapierTrigger rejects ftp:// URLs", async () => {
    await expect(
      registerZapierTrigger("test.event", "ftp://files.example.com/hook"),
    ).rejects.toThrow("webhookUrl must be a valid http(s) URL");
  });

  // ---- removeZapierTrigger ----

  test("removeZapierTrigger deletes an existing trigger", async () => {
    const id = await registerZapierTrigger(
      "inventory.created",
      "https://hooks.zapier.com/hooks/catch/del/",
    );

    await removeZapierTrigger(id);

    const remaining = await listZapierTriggers();
    expect(remaining).toHaveLength(0);
  });

  test("removeZapierTrigger is a no-op for nonexistent id (does not throw)", async () => {
    await expect(removeZapierTrigger("zap_nonexistent")).resolves.toBeUndefined();
  });

  test("removeZapierTrigger throws on empty id", async () => {
    await expect(removeZapierTrigger("")).rejects.toThrow("id is required");
  });

  // ---- listZapierTriggers ----

  test("listZapierTriggers returns all triggers ordered by created_at descending", async () => {
    await registerZapierTrigger("a.event", "https://hooks.zapier.com/hooks/catch/1/");
    await registerZapierTrigger("b.event", "https://hooks.zapier.com/hooks/catch/2/");
    await registerZapierTrigger("a.event", "https://hooks.zapier.com/hooks/catch/3/");

    const all = await listZapierTriggers();
    expect(all).toHaveLength(3);
    // Most recently created first
    expect(all[0].webhook_url).toBe("https://hooks.zapier.com/hooks/catch/3/");
  });

  test("listZapierTriggers returns empty array when no triggers exist", async () => {
    const triggers = await listZapierTriggers();
    expect(triggers).toEqual([]);
  });

  // ---- fireZapierTriggers ----

  test("fireZapierTriggers POSTs Zapier-compatible payload to each active webhook", async () => {
    await registerZapierTrigger(
      "experiment.completed",
      "https://hooks.zapier.com/hooks/catch/hook1/",
    );
    await registerZapierTrigger(
      "experiment.completed",
      "https://hooks.zapier.com/hooks/catch/hook2/",
    );

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    await fireZapierTriggers("experiment.completed", { experimentId: "exp-42" });

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify payload structure on first call
    const firstCall = mockFetch.mock.calls[0];
    const body = JSON.parse(firstCall[1].body);
    expect(body.event_type).toBe("experiment.completed");
    expect(body.source).toBe("nexus-bio");
    expect(body.timestamp).toBeTruthy();
    expect(body.data).toEqual({ experimentId: "exp-42" });
    expect(firstCall[1].method).toBe("POST");
    expect(firstCall[1].headers["Content-Type"]).toBe("application/json");
  });

  test("fireZapierTriggers does nothing when no active triggers match", async () => {
    await fireZapierTriggers("no.such.event", { x: 1 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("fireZapierTriggers does not fire triggers for a different event type", async () => {
    await registerZapierTrigger(
      "fba.result_ready",
      "https://hooks.zapier.com/hooks/catch/fba/",
    );
    await registerZapierTrigger(
      "experiment.completed",
      "https://hooks.zapier.com/hooks/catch/exp/",
    );

    mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

    await fireZapierTriggers("fba.result_ready", { flux: 42 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe("https://hooks.zapier.com/hooks/catch/fba/");
  });

  test("fireZapierTriggers silently swallows fetch errors so other webhooks still fire", async () => {
    await registerZapierTrigger(
      "analysis.completed",
      "https://hooks.zapier.com/hooks/catch/fail/",
    );
    await registerZapierTrigger(
      "analysis.completed",
      "https://hooks.zapier.com/hooks/catch/ok/",
    );

    mockFetch
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    // Should not throw even though the first webhook fails
    await expect(
      fireZapierTriggers("analysis.completed", { result: "ok" }),
    ).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("fireZapierTriggers throws on empty eventType", async () => {
    await expect(fireZapierTriggers("", { x: 1 })).rejects.toThrow(
      "eventType is required",
    );
  });

  // ---- unique ids ----

  test("registerZapierTrigger generates unique ids for successive calls", async () => {
    const id1 = await registerZapierTrigger("test", "https://hooks.zapier.com/hooks/catch/u1/");
    const id2 = await registerZapierTrigger("test", "https://hooks.zapier.com/hooks/catch/u2/");
    expect(id1).not.toBe(id2);
  });

  // ---- multiple triggers per event ----

  test("multiple triggers for the same event type are all stored independently", async () => {
    await registerZapierTrigger("experiment.completed", "https://hooks.zapier.com/hooks/catch/a/");
    await registerZapierTrigger("experiment.completed", "https://hooks.zapier.com/hooks/catch/b/");
    await registerZapierTrigger("experiment.completed", "https://hooks.zapier.com/hooks/catch/c/");

    const all = await listZapierTriggers();
    expect(all).toHaveLength(3);
    expect(all.every((t) => t.event_type === "experiment.completed")).toBe(true);

    const urls = all.map((t) => t.webhook_url).sort();
    expect(urls).toEqual([
      "https://hooks.zapier.com/hooks/catch/a/",
      "https://hooks.zapier.com/hooks/catch/b/",
      "https://hooks.zapier.com/hooks/catch/c/",
    ]);
  });
});
