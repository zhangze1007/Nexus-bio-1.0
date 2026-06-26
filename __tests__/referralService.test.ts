/** @jest-environment node */

/**
 * In-memory mock of referral tables for unit testing.
 * Avoids SQLite file locking issues when Jest runs test files in parallel.
 */
const referralCodes: Record<string, unknown>[] = [];
const referralRecords: Record<string, unknown>[] = [];

jest.mock("../src/server/libsqlDb", () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // Table creation — no-op
    if (sql.startsWith("CREATE TABLE")) return [];

    // referral_codes queries
    if (sql.includes("FROM referral_codes WHERE user_id")) {
      return referralCodes.filter((r) => r.user_id === args[0]);
    }
    if (sql.includes("FROM referral_codes WHERE code")) {
      return referralCodes.filter((r) => r.code === args[0]);
    }

    // referral_records queries
    if (sql.includes("FROM referral_records WHERE referrer_user_id")) {
      return referralRecords
        .filter((r) => r.referrer_user_id === args[0])
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }
    if (sql.includes("FROM referral_records WHERE referred_user_id")) {
      return referralRecords.filter((r) => r.referred_user_id === args[0]);
    }

    return [];
  }),
  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith("CREATE TABLE")) return undefined;

    if (sql.includes("FROM referral_codes WHERE user_id")) {
      return referralCodes.find((r) => r.user_id === args[0]) ?? undefined;
    }
    if (sql.includes("FROM referral_codes WHERE code")) {
      return referralCodes.find((r) => r.code === args[0]) ?? undefined;
    }
    if (sql.includes("FROM referral_codes WHERE id")) {
      return referralCodes.find((r) => r.id === args[0]) ?? undefined;
    }
    if (sql.includes("FROM referral_records WHERE referred_user_id")) {
      return referralRecords.find((r) => r.referred_user_id === args[0]) ?? undefined;
    }
    if (sql.includes("FROM referral_records WHERE id")) {
      return referralRecords.find((r) => r.id === args[0]) ?? undefined;
    }

    return undefined;
  }),
  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith("CREATE TABLE")) return { rowsAffected: 0 };

    if (sql.startsWith("INSERT INTO referral_codes")) {
      referralCodes.push({
        id: args[0],
        user_id: args[1],
        code: args[2],
        created_at: new Date().toISOString(),
      });
      return { rowsAffected: 1 };
    }
    if (sql.startsWith("INSERT INTO referral_records")) {
      referralRecords.push({
        id: args[0],
        code: args[1],
        referrer_user_id: args[2],
        referred_user_id: args[3],
        credit_amount_cents: args[4],
        created_at: new Date().toISOString(),
      });
      return { rowsAffected: 1 };
    }

    return { rowsAffected: 0 };
  }),
}));

import {
  generateReferralCode,
  validateReferralCode,
  recordReferral,
  getReferralStats,
} from "../src/services/referral/referralService";

beforeEach(() => {
  referralCodes.length = 0;
  referralRecords.length = 0;
});

// ── Code Generation ──

describe("generateReferralCode", () => {
  test("generates an 8-character alphanumeric code", async () => {
    const { code, isNew } = await generateReferralCode("user-1");
    expect(isNew).toBe(true);
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  test("returns existing code if user already has one", async () => {
    const first = await generateReferralCode("user-2");
    const second = await generateReferralCode("user-2");
    expect(second.isNew).toBe(false);
    expect(second.code).toBe(first.code);
  });

  test("generates unique codes for different users", async () => {
    const a = await generateReferralCode("user-a");
    const b = await generateReferralCode("user-b");
    expect(a.code).not.toBe(b.code);
  });

  test("throws if userId is empty", async () => {
    await expect(generateReferralCode("")).rejects.toThrow("userId is required");
  });

  test("throws if userId is not a string", async () => {
    await expect(generateReferralCode(null as unknown as string)).rejects.toThrow("userId is required");
  });
});

// ── Validation ──

describe("validateReferralCode", () => {
  test("returns valid=true and referrerUserId for an existing code", async () => {
    await generateReferralCode("referrer-1");
    const { code } = await generateReferralCode("referrer-1");
    const result = await validateReferralCode(code);
    expect(result.valid).toBe(true);
    expect(result.referrerUserId).toBe("referrer-1");
  });

  test("returns valid=false for a non-existent code", async () => {
    const result = await validateReferralCode("NONEXIST");
    expect(result.valid).toBe(false);
    expect(result.referrerUserId).toBeNull();
  });

  test("returns valid=false for empty input", async () => {
    const result = await validateReferralCode("");
    expect(result.valid).toBe(false);
    expect(result.referrerUserId).toBeNull();
  });

  test("trims whitespace from code before validation", async () => {
    await generateReferralCode("referrer-2");
    const { code } = await generateReferralCode("referrer-2");
    const result = await validateReferralCode(`  ${code}  `);
    expect(result.valid).toBe(true);
    expect(result.referrerUserId).toBe("referrer-2");
  });
});

// ── Recording Referrals ──

describe("recordReferral", () => {
  test("records a referral and returns credit info", async () => {
    await generateReferralCode("referrer-3");
    const { code } = await generateReferralCode("referrer-3");
    const result = await recordReferral(code, "new-user-1");
    expect(result).not.toBeNull();
    expect(result!.referrerUserId).toBe("referrer-3");
    expect(result!.creditAmount).toBe(500);
    expect(result!.referralId).toBeDefined();
  });

  test("returns null for an invalid code", async () => {
    const result = await recordReferral("INVALID", "new-user-2");
    expect(result).toBeNull();
  });

  test("throws if the referred user was already referred", async () => {
    await generateReferralCode("referrer-4");
    const { code } = await generateReferralCode("referrer-4");
    await recordReferral(code, "new-user-3");
    await expect(recordReferral(code, "new-user-3")).rejects.toThrow("already been referred");
  });

  test("prevents self-referral", async () => {
    await generateReferralCode("self-user");
    const { code } = await generateReferralCode("self-user");
    await expect(recordReferral(code, "self-user")).rejects.toThrow("cannot refer themselves");
  });

  test("throws if code is empty", async () => {
    await expect(recordReferral("", "new-user-4")).rejects.toThrow("code is required");
  });

  test("throws if newUserId is empty", async () => {
    await expect(recordReferral("SOMECODE", "")).rejects.toThrow("newUserId is required");
  });
});

// ── Stats ──

describe("getReferralStats", () => {
  test("returns zero stats for a user with no referrals", async () => {
    const stats = await getReferralStats("lonely-user");
    expect(stats.totalReferrals).toBe(0);
    expect(stats.totalCreditsCents).toBe(0);
    expect(stats.referrals).toHaveLength(0);
    expect(stats.code).toBeNull();
  });

  test("returns code and referral details for an active referrer", async () => {
    await generateReferralCode("active-referrer");
    const { code } = await generateReferralCode("active-referrer");
    await recordReferral(code, "referred-1");
    await recordReferral(code, "referred-2");

    const stats = await getReferralStats("active-referrer");
    expect(stats.code).toBe(code);
    expect(stats.totalReferrals).toBe(2);
    expect(stats.totalCreditsCents).toBe(1000);
    expect(stats.referrals).toHaveLength(2);
    expect(stats.referrals[0].referredUserId).toBeDefined();
    expect(stats.referrals[0].creditAmount).toBe(500);
    expect(stats.referrals[0].createdAt).toBeDefined();
  });

  test("throws if userId is empty", async () => {
    await expect(getReferralStats("")).rejects.toThrow("userId is required");
  });
});
