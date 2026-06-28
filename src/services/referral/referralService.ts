/**
 * Referral Program Service
 *
 * Manages referral codes, tracks referrals, and handles the $5 credit system.
 * Storage: referral_codes + referral_records tables via @libsql/client (async).
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Constants ──

const REFERRAL_CODE_LENGTH = 8;
const CODE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CREDIT_PER_REFERRAL = 500; // $5.00 in cents

// ── Table DDL ──

const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS referral_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS referral_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    referrer_user_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL UNIQUE,
    credit_amount_cents INTEGER NOT NULL DEFAULT ${CREDIT_PER_REFERRAL},
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (code) REFERENCES referral_codes(code)
  )`,
];

/** Ensure referral tables exist. Safe to call on every request. */
export async function ensureReferralTables(): Promise<void> {
  for (const sql of CREATE_TABLES_SQL) {
    await sqlRun(sql);
  }
}

// ── Code Generation ──

/**
 * Generate a cryptographically random referral code of `REFERRAL_CODE_LENGTH` characters.
 * Uses the Web Crypto API via randomUUID, then extracts alphanumeric characters.
 */
function generateRandomCode(): string {
  const uuid = randomUUID().replace(/-/g, ""); // 32 hex chars
  let code = "";
  for (let i = 0; code.length < REFERRAL_CODE_LENGTH && i < uuid.length; i++) {
    const char = uuid[i];
    // Map hex chars (0-9, a-f) into the full charset range
    const idx = parseInt(char, 16);
    code += CODE_CHARSET[idx % CODE_CHARSET.length];
  }
  // If we still need more characters (unlikely), pad from a second UUID
  while (code.length < REFERRAL_CODE_LENGTH) {
    const extra = randomUUID().replace(/-/g, "")[0];
    const idx = parseInt(extra, 16);
    code += CODE_CHARSET[idx % CODE_CHARSET.length];
  }
  return code;
}

/**
 * Generate and persist a unique referral code for a user.
 * Returns the existing code if the user already has one.
 */
export async function generateReferralCode(userId: string): Promise<{ code: string; isNew: boolean }> {
  if (!userId || typeof userId !== "string") {
    throw new Error("userId is required and must be a non-empty string");
  }

  await ensureReferralTables();

  // Return existing code if user already has one
  const existing = await sqlGet("SELECT code FROM referral_codes WHERE user_id = ?", [userId]);
  if (existing) {
    return { code: String(existing.code), isNew: false };
  }

  // Generate a unique code (retry on collision)
  let code: string;
  let attempts = 0;
  const MAX_ATTEMPTS = 10;
  do {
    code = generateRandomCode();
    const collision = await sqlGet("SELECT id FROM referral_codes WHERE code = ?", [code]);
    if (!collision) break;
    attempts++;
  } while (attempts < MAX_ATTEMPTS);

  if (attempts >= MAX_ATTEMPTS) {
    throw new Error("Failed to generate a unique referral code after maximum attempts");
  }

  const id = randomUUID();
  await sqlRun("INSERT INTO referral_codes (id, user_id, code) VALUES (?, ?, ?)", [id, userId, code]);

  return { code, isNew: true };
}

// ── Validation ──

/** Check whether a referral code exists and is valid. Returns the referrer's userId or null. */
export async function validateReferralCode(code: string): Promise<{ valid: boolean; referrerUserId: string | null }> {
  if (!code || typeof code !== "string") {
    return { valid: false, referrerUserId: null };
  }

  await ensureReferralTables();

  const row = await sqlGet("SELECT user_id FROM referral_codes WHERE code = ?", [code.trim()]);
  if (!row) {
    return { valid: false, referrerUserId: null };
  }

  return { valid: true, referrerUserId: String(row.user_id) };
}

// ── Recording Referrals ──

/**
 * Record a successful referral: a new user signed up with the given referral code.
 * Awards CREDIT_PER_REFERRAL to the referrer.
 * Returns the created record or null if the code is invalid.
 * Throws if the referred user was already referred.
 */
export async function recordReferral(
  code: string,
  newUserId: string,
): Promise<{ referralId: string; referrerUserId: string; creditAmount: number } | null> {
  if (!code || typeof code !== "string") {
    throw new Error("code is required and must be a non-empty string");
  }
  if (!newUserId || typeof newUserId !== "string") {
    throw new Error("newUserId is required and must be a non-empty string");
  }

  await ensureReferralTables();

  // Look up the referrer
  const referrer = await sqlGet("SELECT user_id FROM referral_codes WHERE code = ?", [code.trim()]);
  if (!referrer) {
    return null;
  }

  const referrerUserId = String(referrer.user_id);

  // Prevent self-referral
  if (referrerUserId === newUserId) {
    throw new Error("Users cannot refer themselves");
  }

  // Check if this user was already referred
  const alreadyReferred = await sqlGet("SELECT id FROM referral_records WHERE referred_user_id = ?", [newUserId]);
  if (alreadyReferred) {
    throw new Error("This user has already been referred");
  }

  const referralId = randomUUID();
  await sqlRun(
    `INSERT INTO referral_records (id, code, referrer_user_id, referred_user_id, credit_amount_cents)
     VALUES (?, ?, ?, ?, ?)`,
    [referralId, code.trim(), referrerUserId, newUserId, CREDIT_PER_REFERRAL],
  );

  return { referralId, referrerUserId, creditAmount: CREDIT_PER_REFERRAL };
}

// ── Stats ──

/** Returned by getReferralStats. */
export interface ReferralStats {
  userId: string;
  code: string | null;
  totalReferrals: number;
  totalCreditsCents: number;
  referrals: Array<{
    id: string;
    referredUserId: string;
    creditAmount: number;
    createdAt: string;
  }>;
}

/**
 * Get referral statistics for a user: their code, referral count, total credits,
 * and the list of individual referrals.
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  if (!userId || typeof userId !== "string") {
    throw new Error("userId is required and must be a non-empty string");
  }

  await ensureReferralTables();

  const codeRow = await sqlGet("SELECT code FROM referral_codes WHERE user_id = ?", [userId]);
  const code = codeRow ? String(codeRow.code) : null;

  const records = await sqlAll(
    "SELECT id, referred_user_id, credit_amount_cents, created_at FROM referral_records WHERE referrer_user_id = ? ORDER BY created_at DESC",
    [userId],
  );

  const referrals = records.map((r) => ({
    id: String(r.id),
    referredUserId: String(r.referred_user_id),
    creditAmount: Number(r.credit_amount_cents),
    createdAt: String(r.created_at),
  }));

  const totalCreditsCents = referrals.reduce((sum, r) => sum + r.creditAmount, 0);

  return {
    userId,
    code,
    totalReferrals: referrals.length,
    totalCreditsCents,
    referrals,
  };
}
