import {
  createSyncChannel,
  broadcastChange,
  subscribeToChanges,
  __resetSync,
  type Change,
  type SyncChannel,
} from "../src/services/collaboration/realTimeSync";

afterEach(() => {
  __resetSync();
});

// ---- createSyncChannel ------------------------------------------------

describe("createSyncChannel", () => {
  it("returns a channel with the correct projectId and id", () => {
    const ch = createSyncChannel("proj-1");
    expect(ch.projectId).toBe("proj-1");
    expect(ch.id).toBe("sync:proj-1");
  });

  it("starts with zero subscribers", () => {
    const ch = createSyncChannel("proj-1");
    expect(ch.subscribers).toBe(0);
  });

  it("returns the same channel instance for the same projectId", () => {
    const a = createSyncChannel("proj-1");
    const b = createSyncChannel("proj-1");
    expect(a.id).toBe(b.id);
    expect(a.projectId).toBe(b.projectId);
  });

  it("throws when projectId is empty", () => {
    expect(() => createSyncChannel("")).toThrow("projectId is required");
  });
});

// ---- subscribeToChanges ------------------------------------------------

describe("subscribeToChanges", () => {
  it("receives a broadcast change", () => {
    const ch = createSyncChannel("proj-2");
    const received: Change[] = [];

    subscribeToChanges(ch.id, (c) => received.push(c));

    const change: Change = {
      type: "node:add",
      entityId: "n1",
      data: { label: "A" },
      userId: "user-1",
      timestamp: "2026-01-01T00:00:00Z",
    };
    broadcastChange(ch.id, change);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(change);
  });

  it("supports multiple subscribers on the same channel", () => {
    const ch = createSyncChannel("proj-3");
    const a: Change[] = [];
    const b: Change[] = [];

    subscribeToChanges(ch.id, (c) => a.push(c));
    subscribeToChanges(ch.id, (c) => b.push(c));

    broadcastChange(ch.id, {
      type: "edge:update",
      entityId: "e1",
      data: {},
      userId: "u1",
      timestamp: "2026-01-01T00:00:00Z",
    });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("unsubscribes correctly (no further callbacks)", () => {
    const ch = createSyncChannel("proj-4");
    const received: Change[] = [];

    const unsub = subscribeToChanges(ch.id, (c) => received.push(c));
    unsub();

    broadcastChange(ch.id, {
      type: "x",
      entityId: "y",
      data: null,
      userId: "u",
      timestamp: "2026-01-01T00:00:00Z",
    });

    expect(received).toHaveLength(0);
  });

  it("calling unsubscribe twice is a no-op", () => {
    const ch = createSyncChannel("proj-dupe");
    const unsub = subscribeToChanges(ch.id, () => {});
    unsub();
    unsub(); // should not throw
  });

  it("throws when channelId is empty", () => {
    expect(() => subscribeToChanges("", () => {})).toThrow(
      "channelId is required",
    );
  });

  it("throws when callback is not a function", () => {
    const ch = createSyncChannel("proj-x");
    // @ts-expect-error — intentional bad input
    expect(() => subscribeToChanges(ch.id, "not-fn")).toThrow(
      "callback must be a function",
    );
  });

  it("throws when channel does not exist", () => {
    expect(() => subscribeToChanges("sync:ghost", () => {})).toThrow(
      "Channel not found",
    );
  });
});

// ---- broadcastChange ---------------------------------------------------

describe("broadcastChange", () => {
  it("auto-stamps a missing timestamp when undefined", () => {
    const ch = createSyncChannel("proj-5");
    const received: Change[] = [];
    subscribeToChanges(ch.id, (c) => received.push(c));

    broadcastChange(ch.id, {
      type: "a",
      entityId: "b",
      data: {},
      userId: "u",
      timestamp: undefined as unknown as string,
    });

    expect(received[0].timestamp).toBeTruthy();
    // Should be a valid ISO string close to now
    expect(new Date(received[0].timestamp).getTime()).toBeGreaterThan(
      Date.now() - 5000,
    );
  });

  it("throws when channelId is empty", () => {
    expect(() =>
      broadcastChange("", {
        type: "x",
        entityId: "y",
        data: {},
        userId: "u",
        timestamp: "",
      }),
    ).toThrow("channelId is required");
  });

  it("throws when channel does not exist", () => {
    expect(() =>
      broadcastChange("sync:missing", {
        type: "x",
        entityId: "y",
        data: {},
        userId: "u",
        timestamp: "",
      }),
    ).toThrow("Channel not found");
  });

  it("swallows listener errors without affecting other listeners", () => {
    const ch = createSyncChannel("proj-err");
    const good: Change[] = [];

    subscribeToChanges(ch.id, () => {
      throw new Error("boom");
    });
    subscribeToChanges(ch.id, (c) => good.push(c));

    broadcastChange(ch.id, {
      type: "t",
      entityId: "e",
      data: {},
      userId: "u",
      timestamp: "2026-01-01T00:00:00Z",
    });

    expect(good).toHaveLength(1);
  });
});

// ---- subscriber count tracking ----------------------------------------

describe("subscriber count", () => {
  it("reflects the current number of active subscribers", () => {
    const ch = createSyncChannel("proj-count");

    const u1 = subscribeToChanges(ch.id, () => {});
    const u2 = subscribeToChanges(ch.id, () => {});

    // Re-read channel to get fresh subscriber count
    const fresh = createSyncChannel("proj-count");
    expect(fresh.subscribers).toBe(2);

    u1();
    const afterUnsub = createSyncChannel("proj-count");
    expect(afterUnsub.subscribers).toBe(1);

    u2();
    const afterAll = createSyncChannel("proj-count");
    expect(afterAll.subscribers).toBe(0);
  });
});

// ---- isolation between projects ---------------------------------------

describe("project isolation", () => {
  it("changes on one channel do not leak to another", () => {
    const chA = createSyncChannel("iso-a");
    const chB = createSyncChannel("iso-b");

    const receivedA: Change[] = [];
    const receivedB: Change[] = [];

    subscribeToChanges(chA.id, (c) => receivedA.push(c));
    subscribeToChanges(chB.id, (c) => receivedB.push(c));

    broadcastChange(chA.id, {
      type: "only-a",
      entityId: "x",
      data: {},
      userId: "u",
      timestamp: "2026-01-01T00:00:00Z",
    });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);
  });
});
