import {
  createTrigger,
  removeTrigger,
  listTriggers,
  deactivateTrigger,
  activateTrigger,
  getActiveTriggersForEvent,
  dropTable,
  resetSchemaFlag,
} from "../src/services/integrations/n8nClient";
import { closeLibsqlClient } from "../src/server/libsqlDb";

afterAll(() => {
  closeLibsqlClient();
});

describe("n8nClient", () => {
  beforeEach(async () => {
    resetSchemaFlag();
    await dropTable();
  });

  afterEach(async () => {
    await dropTable();
  });

  // ---- createTrigger ----

  test("createTrigger inserts a trigger and returns it", async () => {
    const trigger = await createTrigger({
      eventType: "experiment.completed",
      callbackUrl: "https://n8n.example.com/webhook/abc123",
    });

    expect(trigger.id).toMatch(/^trg_/);
    expect(trigger.event_type).toBe("experiment.completed");
    expect(trigger.callback_url).toBe("https://n8n.example.com/webhook/abc123");
    expect(trigger.active).toBe(1);
    expect(trigger.created_at).toBeTruthy();
  });

  test("createTrigger trims whitespace from eventType and callbackUrl", async () => {
    const trigger = await createTrigger({
      eventType: "  fba.result_ready  ",
      callbackUrl: "  https://n8n.example.com/hook  ",
    });

    expect(trigger.event_type).toBe("fba.result_ready");
    expect(trigger.callback_url).toBe("https://n8n.example.com/hook");
  });

  test("createTrigger throws on empty eventType", async () => {
    await expect(
      createTrigger({ eventType: "", callbackUrl: "https://n8n.example.com/hook" }),
    ).rejects.toThrow("eventType is required");
  });

  test("createTrigger throws on invalid callbackUrl", async () => {
    await expect(
      createTrigger({ eventType: "test.event", callbackUrl: "not-a-url" }),
    ).rejects.toThrow("callbackUrl must be a valid http(s) URL");
  });

  test("createTrigger rejects ftp:// URLs", async () => {
    await expect(
      createTrigger({ eventType: "test.event", callbackUrl: "ftp://files.example.com/hook" }),
    ).rejects.toThrow("callbackUrl must be a valid http(s) URL");
  });

  // ---- removeTrigger ----

  test("removeTrigger deletes an existing trigger and returns true", async () => {
    const trigger = await createTrigger({
      eventType: "inventory.created",
      callbackUrl: "https://n8n.example.com/webhook/del",
    });

    const removed = await removeTrigger(trigger.id);
    expect(removed).toBe(true);

    const remaining = await listTriggers();
    expect(remaining).toHaveLength(0);
  });

  test("removeTrigger returns false for nonexistent id", async () => {
    const removed = await removeTrigger("trg_nonexistent");
    expect(removed).toBe(false);
  });

  test("removeTrigger throws on empty id", async () => {
    await expect(removeTrigger("")).rejects.toThrow("id is required");
  });

  // ---- listTriggers ----

  test("listTriggers returns all triggers ordered by created_at descending", async () => {
    await createTrigger({ eventType: "a.event", callbackUrl: "https://n8n.example.com/1" });
    await createTrigger({ eventType: "b.event", callbackUrl: "https://n8n.example.com/2" });
    await createTrigger({ eventType: "a.event", callbackUrl: "https://n8n.example.com/3" });

    const all = await listTriggers();
    expect(all).toHaveLength(3);
    // Most recent first
    expect(all[0].callback_url).toBe("https://n8n.example.com/3");
  });

  test("listTriggers filters by eventType", async () => {
    await createTrigger({ eventType: "fba.result_ready", callbackUrl: "https://n8n.example.com/fba" });
    await createTrigger({ eventType: "experiment.completed", callbackUrl: "https://n8n.example.com/exp" });
    await createTrigger({ eventType: "fba.result_ready", callbackUrl: "https://n8n.example.com/fba2" });

    const fbaTriggers = await listTriggers("fba.result_ready");
    expect(fbaTriggers).toHaveLength(2);
    expect(fbaTriggers.every((t) => t.event_type === "fba.result_ready")).toBe(true);
  });

  test("listTriggers returns empty array when no triggers exist", async () => {
    const triggers = await listTriggers();
    expect(triggers).toEqual([]);
  });

  // ---- deactivateTrigger / activateTrigger ----

  test("deactivateTrigger sets active to 0", async () => {
    const trigger = await createTrigger({
      eventType: "analysis.completed",
      callbackUrl: "https://n8n.example.com/analysis",
    });

    const deactivated = await deactivateTrigger(trigger.id);
    expect(deactivated).toBe(true);

    const all = await listTriggers();
    expect(all[0].active).toBe(0);
  });

  test("activateTrigger re-enables a deactivated trigger", async () => {
    const trigger = await createTrigger({
      eventType: "analysis.completed",
      callbackUrl: "https://n8n.example.com/analysis2",
    });

    await deactivateTrigger(trigger.id);
    const activated = await activateTrigger(trigger.id);
    expect(activated).toBe(true);

    const all = await listTriggers();
    expect(all[0].active).toBe(1);
  });

  test("deactivateTrigger returns false for nonexistent id", async () => {
    const result = await deactivateTrigger("trg_ghost");
    expect(result).toBe(false);
  });

  test("activateTrigger returns false for nonexistent id", async () => {
    const result = await activateTrigger("trg_ghost");
    expect(result).toBe(false);
  });

  // ---- getActiveTriggersForEvent ----

  test("getActiveTriggersForEvent returns only active triggers for the given event", async () => {
    const t1 = await createTrigger({ eventType: "protein.fold_ready", callbackUrl: "https://n8n.example.com/p1" });
    await createTrigger({ eventType: "protein.fold_ready", callbackUrl: "https://n8n.example.com/p2" });
    await createTrigger({ eventType: "other.event", callbackUrl: "https://n8n.example.com/other" });

    // Deactivate one
    await deactivateTrigger(t1.id);

    const active = await getActiveTriggersForEvent("protein.fold_ready");
    expect(active).toHaveLength(1);
    expect(active[0].callback_url).toBe("https://n8n.example.com/p2");
  });

  test("getActiveTriggersForEvent returns empty for event with no active triggers", async () => {
    const t = await createTrigger({ eventType: "orphan.event", callbackUrl: "https://n8n.example.com/orphan" });
    await deactivateTrigger(t.id);

    const active = await getActiveTriggersForEvent("orphan.event");
    expect(active).toHaveLength(0);
  });

  // ---- unique ids ----

  test("createTrigger generates unique ids for successive calls", async () => {
    const t1 = await createTrigger({ eventType: "test", callbackUrl: "https://n8n.example.com/1" });
    const t2 = await createTrigger({ eventType: "test", callbackUrl: "https://n8n.example.com/2" });
    expect(t1.id).not.toBe(t2.id);
  });
});
