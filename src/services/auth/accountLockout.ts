/**
 * Account Lockout Service — Brute-force protection for Nexus-Bio
 *
 * Tracks failed login attempts per user in the account_lockouts table via libsql.
 * After 5 consecutive failed attempts the account is locked for 30 minutes.
 * Successful authentication resets the counter via resetFailedAttempts().
 */

import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LockoutStatus {
  userId: string;
  failedAttempts: number;
  lockedUntil: string | null;
  lastAttemptAt: string | null;
  isLocked: boolean;
}

// ─── Schema ────────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS account_lockouts (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL UNIQUE,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    last_attempt_at TEXT
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_account_lockouts_user_id
  ON account_lockouts (user_id)
`;

/**
 * Ensure the schema exists. Safe to call multiple times.
 */
export async function ensureSchema(): Promise<void> {
  await sqlRun(CREATE_TABLE_SQL);
  await sqlRun(CREATE_INDEX_SQL);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateId(): string {
  return `lock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function isLockedRow(row: Record<string, unknown> | undefined): boolean {
  if (!row || !row.locked_until) return false;
  return new Date(row.locked_until as string).getTime() > Date.now();
}

function mapRow(row: Record<string, unknown>): LockoutStatus {
  return {
    userId: row.user_id as string,
    failedAttempts: row.failed_attempts as number,
    lockedUntil: (row.locked_until as string) ?? null,
    lastAttemptAt: (row.last_attempt_at as string) ?? null,
    isLocked: isLockedRow(row),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Record a failed login attempt for a user.
 *
 * - If the user has no existing record, one is created with failed_attempts = 1.
 * - If the user has a record, failed_attempts is incremented.
 * - When failed_attempts reaches MAX_FAILED_ATTEMPTS (5), the account is
 *   locked for LOCKOUT_DURATION_MS (30 minutes).
 * - If the account is already locked, the lockout window is NOT extended;
 *   the attempt is still counted but the locked_until stays as-is.
 *
 * @returns The updated LockoutStatus
 */
export async function recordFailedAttempt(userId: string): Promise<LockoutStatus> {
  await ensureSchema();

  const existing = await sqlGet(
    `SELECT id, user_id, failed_attempts, locked_until, last_attempt_at
     FROM account_lockouts
     WHERE user_id = ?`,
    [userId],
  );

  const ts = nowIso();

  if (!existing) {
    // First failed attempt — create record
    const id = generateId();
    const attempts = 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS
      ? addMinutes(new Date(), LOCKOUT_DURATION_MS / 60_000).toISOString()
      : null;

    await sqlRun(
      `INSERT INTO account_lockouts (id, user_id, failed_attempts, locked_until, last_attempt_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, attempts, lockedUntil, ts],
    );

    return {
      userId,
      failedAttempts: attempts,
      lockedUntil,
      lastAttemptAt: ts,
      isLocked: lockedUntil !== null,
    };
  }

  // Existing record — increment attempts
  const prevAttempts = existing.failed_attempts as number;
  const newAttempts = prevAttempts + 1;
  const prevLockedUntil = existing.locked_until as string | null;

  // Only set locked_until if we just crossed the threshold and aren't already locked
  let newLockedUntil = prevLockedUntil;
  if (newAttempts >= MAX_FAILED_ATTEMPTS && !isLockedRow(existing)) {
    newLockedUntil = addMinutes(new Date(), LOCKOUT_DURATION_MS / 60_000).toISOString();
  }

  await sqlRun(
    `UPDATE account_lockouts
     SET failed_attempts = ?, locked_until = ?, last_attempt_at = ?
     WHERE user_id = ?`,
    [newAttempts, newLockedUntil, ts, userId],
  );

  return {
    userId,
    failedAttempts: newAttempts,
    lockedUntil: newLockedUntil,
    lastAttemptAt: ts,
    isLocked: isLockedRow({ locked_until: newLockedUntil }),
  };
}

/**
 * Check whether a user's account is currently locked.
 *
 * An account is locked if locked_until is set and is in the future.
 * If locked_until has expired, the account is considered unlocked (the
 * stale lock is not auto-cleared here — call resetFailedAttempts after
 * a successful login to clean up).
 */
export async function checkAccountLocked(userId: string): Promise<boolean> {
  await ensureSchema();

  const row = await sqlGet(
    `SELECT locked_until FROM account_lockouts WHERE user_id = ?`,
    [userId],
  );

  return isLockedRow(row);
}

/**
 * Reset the failed-attempt counter for a user.
 *
 * Called after a successful authentication. Clears failed_attempts to 0
 * and removes any active lockout.
 */
export async function resetFailedAttempts(userId: string): Promise<void> {
  await ensureSchema();

  await sqlRun(
    `UPDATE account_lockouts
     SET failed_attempts = 0, locked_until = NULL
     WHERE user_id = ?`,
    [userId],
  );
}

/**
 * Retrieve the full lockout status for a user.
 *
 * Returns a default (unlocked) status if no record exists for the user.
 */
export async function getLockoutStatus(userId: string): Promise<LockoutStatus> {
  await ensureSchema();

  const row = await sqlGet(
    `SELECT user_id, failed_attempts, locked_until, last_attempt_at
     FROM account_lockouts
     WHERE user_id = ?`,
    [userId],
  );

  if (!row) {
    return {
      userId,
      failedAttempts: 0,
      lockedUntil: null,
      lastAttemptAt: null,
      isLocked: false,
    };
  }

  return mapRow(row);
}
