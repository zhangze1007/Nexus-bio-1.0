/** @jest-environment node */

/**
 * Unit tests for the Account Lockout service.
 *
 * Mocks the libsql layer (src/server/libsqlDb) with in-memory
 * tables so tests run without a real database.
 */

/* ------------------------------------------------------------------ */
/*  In-memory mock table                                               */
/* ------------------------------------------------------------------ */

let lockouts: Record<string, unknown>[] = [];

function resetTable(): void {
  lockouts = [];
}

jest.mock("../src/server/libsqlDb", () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
      return [];
    }

    // SELECT all for user
    if (sql.includes("FROM account_lockouts") && sql.includes("WHERE user_id")) {
      const userId = args[0];
      return lockouts.filter((r) => r.user_id === userId);
    }

    return [];
  }),

  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
      return undefined;
    }

    // SELECT single lockout by user_id
    if (sql.includes("FROM account_lockouts") && sql.includes("WHERE user_id")) {
      const userId = args[0];
      return lockouts.find((r) => r.user_id === userId) ?? undefined;
    }

    return undefined;
  }),

  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
      return { rowsAffected: 0 };
    }

    // INSERT
    if (sql.includes("INSERT INTO account_lockouts")) {
      const [id, userId, failedAttempts, lockedUntil, lastAttemptAt] = args;
      lockouts.push({
        id,
        user_id: userId,
        failed_attempts: failedAttempts,
        locked_until: lockedUntil,
        last_attempt_at: lastAttemptAt,
      });
      return { rowsAffected: 1 };
    }

    // UPDATE
    if (sql.includes("UPDATE account_lockouts")) {
      const userId = args[args.length - 1]; // user_id is always the last param
      const record = lockouts.find((r) => r.user_id === userId);
      if (!record) return { rowsAffected: 0 };

      if (sql.includes("SET failed_attempts = 0")) {
        // resetFailedAttempts
        record.failed_attempts = 0;
        record.locked_until = null;
      } else {
        // recordFailedAttempt update
        const [failedAttempts, lockedUntil, lastAttemptAt] = args;
        record.failed_attempts = failedAttempts;
        record.locked_until = lockedUntil;
        record.last_attempt_at = lastAttemptAt;
      }
      return { rowsAffected: 1 };
    }

    return { rowsAffected: 0 };
  }),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mock)                                               */
/* ------------------------------------------------------------------ */

import {
  recordFailedAttempt,
  checkAccountLocked,
  resetFailedAttempts,
  getLockoutStatus,
} from "../src/services/auth/accountLockout";

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("accountLockout", () => {
  beforeEach(() => {
    resetTable();
    jest.clearAllMocks();
  });

  // ── recordFailedAttempt ─────────────────────────────────────────────

  describe("recordFailedAttempt", () => {
    it("creates a new lockout record on the first failed attempt", async () => {
      const status = await recordFailedAttempt("user-1");

      expect(status.userId).toBe("user-1");
      expect(status.failedAttempts).toBe(1);
      expect(status.lockedUntil).toBeNull();
      expect(status.isLocked).toBe(false);
      expect(status.lastAttemptAt).toBeTruthy();
    });

    it("increments the failed attempt counter on subsequent attempts", async () => {
      await recordFailedAttempt("user-1");
      await recordFailedAttempt("user-1");
      const status = await recordFailedAttempt("user-1");

      expect(status.failedAttempts).toBe(3);
      expect(status.isLocked).toBe(false);
    });

    it("locks the account after 5 failed attempts", async () => {
      for (let i = 0; i < 4; i++) {
        await recordFailedAttempt("user-1");
      }

      const status = await recordFailedAttempt("user-1");

      expect(status.failedAttempts).toBe(5);
      expect(status.isLocked).toBe(true);
      expect(status.lockedUntil).toBeTruthy();

      // locked_until should be roughly 30 minutes in the future
      const lockedUntilDate = new Date(status.lockedUntil!);
      const diffMs = lockedUntilDate.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(25 * 60 * 1000); // at least 25 min
      expect(diffMs).toBeLessThanOrEqual(31 * 60 * 1000); // at most 31 min
    });

    it("does not extend the lockout window when already locked", async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("user-1");
      }
      const lockedStatus = await getLockoutStatus("user-1");
      const originalLockedUntil = lockedStatus.lockedUntil;

      // Record another attempt while locked
      await recordFailedAttempt("user-1");

      const afterStatus = await getLockoutStatus("user-1");
      expect(afterStatus.lockedUntil).toBe(originalLockedUntil);
      expect(afterStatus.failedAttempts).toBe(6);
    });

    it("tracks attempts independently per user", async () => {
      await recordFailedAttempt("user-1");
      await recordFailedAttempt("user-1");
      await recordFailedAttempt("user-2");

      const status1 = await getLockoutStatus("user-1");
      const status2 = await getLockoutStatus("user-2");

      expect(status1.failedAttempts).toBe(2);
      expect(status2.failedAttempts).toBe(1);
    });
  });

  // ── checkAccountLocked ──────────────────────────────────────────────

  describe("checkAccountLocked", () => {
    it("returns false for a user with no lockout record", async () => {
      expect(await checkAccountLocked("nonexistent")).toBe(false);
    });

    it("returns false for a user below the lockout threshold", async () => {
      await recordFailedAttempt("user-1");
      await recordFailedAttempt("user-1");

      expect(await checkAccountLocked("user-1")).toBe(false);
    });

    it("returns true for a user who has been locked out", async () => {
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("user-1");
      }

      expect(await checkAccountLocked("user-1")).toBe(true);
    });
  });

  // ── resetFailedAttempts ─────────────────────────────────────────────

  describe("resetFailedAttempts", () => {
    it("resets the failed attempt counter and clears lockout", async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("user-1");
      }
      expect(await checkAccountLocked("user-1")).toBe(true);

      // Reset
      await resetFailedAttempts("user-1");

      const status = await getLockoutStatus("user-1");
      expect(status.failedAttempts).toBe(0);
      expect(status.lockedUntil).toBeNull();
      expect(status.isLocked).toBe(false);
    });

    it("is idempotent — calling on a user with no record does not error", async () => {
      await expect(resetFailedAttempts("nonexistent")).resolves.toBeUndefined();
    });

    it("allows login attempts again after reset", async () => {
      // Lock and reset
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("user-1");
      }
      await resetFailedAttempts("user-1");

      // Should be able to accumulate attempts again without immediate lock
      const status = await recordFailedAttempt("user-1");
      expect(status.failedAttempts).toBe(1);
      expect(status.isLocked).toBe(false);
    });
  });

  // ── getLockoutStatus ────────────────────────────────────────────────

  describe("getLockoutStatus", () => {
    it("returns a default unlocked status for a user with no record", async () => {
      const status = await getLockoutStatus("nonexistent");

      expect(status.userId).toBe("nonexistent");
      expect(status.failedAttempts).toBe(0);
      expect(status.lockedUntil).toBeNull();
      expect(status.lastAttemptAt).toBeNull();
      expect(status.isLocked).toBe(false);
    });

    it("reflects the current lock state accurately", async () => {
      await recordFailedAttempt("user-1");
      await recordFailedAttempt("user-1");

      const status = await getLockoutStatus("user-1");

      expect(status.userId).toBe("user-1");
      expect(status.failedAttempts).toBe(2);
      expect(status.isLocked).toBe(false);
      expect(status.lastAttemptAt).toBeTruthy();
    });
  });
});
