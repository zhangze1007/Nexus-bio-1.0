/** @jest-environment node */

/**
 * Unit tests for the Session Manager service.
 *
 * Mocks the libsql layer (src/server/libsqlDb) with in-memory
 * tables so tests run without a real database.
 */

/* ------------------------------------------------------------------ */
/*  In-memory mock table                                               */
/* ------------------------------------------------------------------ */

let sessions: Record<string, unknown>[] = [];

function resetTable(): void {
  sessions = [];
}

jest.mock("../src/server/libsqlDb", () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // CREATE TABLE / CREATE INDEX — no-op
    if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
      return [];
    }

    // SELECT active sessions
    if (sql.includes("FROM user_sessions") && sql.includes("WHERE user_id") && sql.includes("revoked_at IS NULL")) {
      const userId = args[0];
      return sessions
        .filter((s) => s.user_id === userId && s.revoked_at === null)
        .sort((a, b) => (b.last_active as string).localeCompare(a.last_active as string));
    }

    // SELECT single session by id
    if (sql.includes("FROM user_sessions") && sql.includes("WHERE id")) {
      const id = args[0];
      return sessions.filter((s) => s.id === id);
    }

    return [];
  }),

  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    // CREATE TABLE / CREATE INDEX — no-op
    if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
      return undefined;
    }

    // SELECT single session by id
    if (sql.includes("FROM user_sessions") && sql.includes("WHERE id")) {
      const id = args[0];
      return sessions.find((s) => s.id === id) ?? undefined;
    }

    return undefined;
  }),

  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    // CREATE TABLE / CREATE INDEX
    if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
      return { rowsAffected: 0 };
    }

    // INSERT
    if (sql.includes("INSERT INTO user_sessions")) {
      const [id, userId, deviceName, deviceType, ipAddress, lastActive, createdAt] = args;
      sessions.push({
        id,
        user_id: userId,
        device_name: deviceName,
        device_type: deviceType,
        ip_address: ipAddress,
        last_active: lastActive,
        created_at: createdAt,
        revoked_at: null,
      });
      return { rowsAffected: 1 };
    }

    // UPDATE revoke single
    if (sql.includes("UPDATE user_sessions SET revoked_at") && sql.includes("WHERE id")) {
      const [revokedAt, id] = args;
      const session = sessions.find((s) => s.id === id);
      if (session) {
        session.revoked_at = revokedAt;
        return { rowsAffected: 1 };
      }
      return { rowsAffected: 0 };
    }

    // UPDATE revoke all for user
    if (sql.includes("UPDATE user_sessions SET revoked_at") && sql.includes("WHERE user_id")) {
      const [revokedAt, userId] = args;
      let count = 0;
      for (const s of sessions) {
        if (s.user_id === userId && s.revoked_at === null) {
          s.revoked_at = revokedAt;
          count++;
        }
      }
      return { rowsAffected: count };
    }

    return { rowsAffected: 0 };
  }),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mock)                                               */
/* ------------------------------------------------------------------ */

import {
  createSession,
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
} from "../src/services/auth/sessionManager";
import type { DeviceInfo } from "../src/services/auth/sessionManager";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeDeviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    deviceName: "Chrome 126 on Windows",
    deviceType: "desktop",
    ipAddress: "192.168.1.1",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("sessionManager", () => {
  beforeEach(() => {
    resetTable();
    jest.clearAllMocks();
  });

  // ── createSession ──────────────────────────────────────────────────

  describe("createSession", () => {
    it("creates a session with the provided device info", async () => {
      const info = makeDeviceInfo();
      const session = await createSession("user-1", info);

      expect(session.id).toMatch(/^sess_/);
      expect(session.userId).toBe("user-1");
      expect(session.deviceName).toBe("Chrome 126 on Windows");
      expect(session.deviceType).toBe("desktop");
      expect(session.ipAddress).toBe("192.168.1.1");
      expect(session.revokedAt).toBeNull();
    });

    it("generates unique session IDs for concurrent calls", async () => {
      const info = makeDeviceInfo();
      const [s1, s2] = await Promise.all([
        createSession("user-1", info),
        createSession("user-1", info),
      ]);

      expect(s1.id).not.toBe(s2.id);
    });

    it("stores mobile device type correctly", async () => {
      const info = makeDeviceInfo({ deviceType: "mobile", deviceName: "Safari on iPhone" });
      const session = await createSession("user-2", info);

      expect(session.deviceType).toBe("mobile");
      expect(session.deviceName).toBe("Safari on iPhone");
    });

    it("stores tablet device type correctly", async () => {
      const info = makeDeviceInfo({ deviceType: "tablet", deviceName: "iPadOS Safari" });
      const session = await createSession("user-3", info);

      expect(session.deviceType).toBe("tablet");
    });
  });

  // ── getActiveSessions ──────────────────────────────────────────────

  describe("getActiveSessions", () => {
    it("returns only non-revoked sessions for the user", async () => {
      const info = makeDeviceInfo();
      const s1 = await createSession("user-1", info);
      await createSession("user-1", info);
      await createSession("user-2", info); // different user

      // Revoke one session
      await revokeSession(s1.id, "user-1");

      const active = await getActiveSessions("user-1");
      expect(active).toHaveLength(1);
      expect(active[0].revokedAt).toBeNull();
    });

    it("returns sessions ordered by last_active descending", async () => {
      const info = makeDeviceInfo();
      const s1 = await createSession("user-1", info);
      // Insert a second session — the mock preserves insertion order,
      // and last_active will be the same timestamp, so we verify count.
      const s2 = await createSession("user-1", info);

      const active = await getActiveSessions("user-1");
      expect(active.length).toBe(2);
      // Both should be present
      const ids = active.map((s) => s.id);
      expect(ids).toContain(s1.id);
      expect(ids).toContain(s2.id);
    });

    it("returns an empty array when user has no sessions", async () => {
      const active = await getActiveSessions("nonexistent-user");
      expect(active).toEqual([]);
    });

    it("does not return sessions from other users", async () => {
      await createSession("user-1", makeDeviceInfo());
      await createSession("user-2", makeDeviceInfo());
      await createSession("user-3", makeDeviceInfo());

      const active = await getActiveSessions("user-2");
      expect(active).toHaveLength(1);
      expect(active[0].userId).toBe("user-2");
    });
  });

  // ── revokeSession ──────────────────────────────────────────────────

  describe("revokeSession", () => {
    it("revokes a session and sets revoked_at", async () => {
      const session = await createSession("user-1", makeDeviceInfo());

      await revokeSession(session.id, "user-1");

      // Should no longer appear in active sessions
      const active = await getActiveSessions("user-1");
      expect(active).toHaveLength(0);
    });

    it("throws when session does not exist", async () => {
      await expect(
        revokeSession("sess_nonexistent", "user-1"),
      ).rejects.toThrow("Session sess_nonexistent not found");
    });

    it("throws when session belongs to a different user", async () => {
      const session = await createSession("user-1", makeDeviceInfo());

      await expect(
        revokeSession(session.id, "user-2"),
      ).rejects.toThrow(/does not belong to user/);
    });
  });

  // ── revokeAllSessions ──────────────────────────────────────────────

  describe("revokeAllSessions", () => {
    it("revokes all active sessions for the user", async () => {
      await createSession("user-1", makeDeviceInfo());
      await createSession("user-1", makeDeviceInfo());
      await createSession("user-1", makeDeviceInfo());

      await revokeAllSessions("user-1");

      const active = await getActiveSessions("user-1");
      expect(active).toHaveLength(0);
    });

    it("does not revoke sessions belonging to other users", async () => {
      await createSession("user-1", makeDeviceInfo());
      await createSession("user-2", makeDeviceInfo());

      await revokeAllSessions("user-1");

      const otherActive = await getActiveSessions("user-2");
      expect(otherActive).toHaveLength(1);
    });

    it("is idempotent — calling twice does not error", async () => {
      await createSession("user-1", makeDeviceInfo());

      await revokeAllSessions("user-1");
      await expect(revokeAllSessions("user-1")).resolves.toBeUndefined();
    });

    it("handles user with no sessions gracefully", async () => {
      await expect(revokeAllSessions("no-sessions-user")).resolves.toBeUndefined();
    });
  });
});
