/**
 * GDPR Consent Manager — Records, queries, and revokes user consent.
 *
 * Manages consent records for GDPR Article 7 compliance. Each consent grant
 * is stored immutably with a timestamp; revocation sets revoked_at without
 * deleting the original record (right to withdraw, Art. 7(3)).
 *
 * Storage: consent_records table via @libsql/client.
 */

import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──

/** The four consent categories tracked by the system. */
export type ConsentType =
  | "analytics"
  | "marketing"
  | "data_processing"
  | "third_party_sharing";

/** All valid consent types, used for validation. */
export const VALID_CONSENT_TYPES: readonly ConsentType[] = [
  "analytics",
  "marketing",
  "data_processing",
  "third_party_sharing",
];

/** A single consent record as returned by the database. */
export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  grantedAt: string;
  revokedAt: string | null;
  ipAddress: string | null;
}

/** Summary of a user's consent status across all types. */
export interface ConsentStatus {
  userId: string;
  consents: {
    consentType: ConsentType;
    granted: boolean;
    grantedAt: string;
    revokedAt: string | null;
  }[];
}

// ── Schema bootstrap ──

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 1,
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  ip_address TEXT
)`;

const CREATE_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_consent_user_type
  ON consent_records (user_id, consent_type)`;

let tablesEnsured = false;

async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  await sqlRun(CREATE_TABLE_SQL);
  await sqlRun(CREATE_INDEX_SQL);
  tablesEnsured = true;
}

// ── Validation ──

function validateConsentType(consentType: string): asserts consentType is ConsentType {
  if (!VALID_CONSENT_TYPES.includes(consentType as ConsentType)) {
    throw new Error(
      `Invalid consent type '${consentType}'. Must be one of: ${VALID_CONSENT_TYPES.join(", ")}`,
    );
  }
}

function validateUserId(userId: string): void {
  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error("userId must be a non-empty string.");
  }
}

// ── Public API ──

/**
 * Record a consent grant for a user.
 *
 * @param userId    - The user identifier.
 * @param consentType - The category of consent (analytics, marketing, etc.).
 * @param granted   - Whether consent is being granted (true) or denied (false).
 * @param ipAddress - Optional IP address for audit trail (GDPR Art. 7(1)).
 */
export async function recordConsent(
  userId: string,
  consentType: ConsentType,
  granted: boolean,
  ipAddress?: string,
): Promise<void> {
  validateUserId(userId);
  validateConsentType(consentType);

  await ensureTables();

  const id = crypto.randomUUID();
  const grantedAt = new Date().toISOString();

  await sqlRun(
    `INSERT INTO consent_records (id, user_id, consent_type, granted, granted_at, revoked_at, ip_address)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [id, userId.trim(), consentType, granted ? 1 : 0, grantedAt, ipAddress ?? null],
  );
}

/**
 * Get the current consent status for a user.
 * Returns the latest record for each consent type.
 *
 * @param userId - The user identifier.
 * @returns Array of consent statuses, one per type that has a record.
 */
export async function getConsentStatus(userId: string): Promise<ConsentStatus> {
  validateUserId(userId);

  await ensureTables();

  // Get the latest record per consent_type for this user.
  // Uses GROUP BY with MAX(granted_at) to find the most recent record per type.
  const rows = await sqlAll(
    `SELECT consent_type, granted, granted_at, revoked_at
     FROM consent_records
     WHERE user_id = ?
     AND id IN (
       SELECT id FROM consent_records
       WHERE user_id = ?
       GROUP BY consent_type
       HAVING granted_at = MAX(granted_at)
     )
     ORDER BY consent_type`,
    [userId.trim(), userId.trim()],
  );

  const consents = rows.map((row) => ({
    consentType: String(row.consent_type) as ConsentType,
    granted: Number(row.granted) === 1,
    grantedAt: String(row.granted_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
  }));

  return {
    userId: userId.trim(),
    consents,
  };
}

/**
 * Revoke a previously granted consent.
 *
 * Finds the latest active (non-revoked) consent record for the given type
 * and sets revoked_at to the current timestamp. Does nothing if no active
 * record exists.
 *
 * @param userId      - The user identifier.
 * @param consentType - The category of consent to revoke.
 * @returns true if a record was revoked, false if no active consent found.
 */
export async function revokeConsent(
  userId: string,
  consentType: ConsentType,
): Promise<boolean> {
  validateUserId(userId);
  validateConsentType(consentType);

  await ensureTables();

  const revokedAt = new Date().toISOString();

  // Find the latest active consent record for this user+type
  const latest = await sqlGet(
    `SELECT id FROM consent_records
     WHERE user_id = ? AND consent_type = ? AND revoked_at IS NULL
     ORDER BY granted_at DESC
     LIMIT 1`,
    [userId.trim(), consentType],
  );

  if (!latest) {
    return false;
  }

  await sqlRun(
    `UPDATE consent_records SET revoked_at = ? WHERE id = ?`,
    [revokedAt, String(latest.id)],
  );

  return true;
}

/**
 * Get all consent records for a user (full history, not just latest).
 * Useful for GDPR Article 15 (right of access) data export.
 *
 * @param userId - The user identifier.
 * @returns All consent records for the user, ordered by date descending.
 */
export async function getConsentHistory(userId: string): Promise<ConsentRecord[]> {
  validateUserId(userId);

  await ensureTables();

  const rows = await sqlAll(
    `SELECT id, user_id, consent_type, granted, granted_at, revoked_at, ip_address
     FROM consent_records
     WHERE user_id = ?
     ORDER BY granted_at DESC`,
    [userId.trim()],
  );

  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    consentType: String(row.consent_type) as ConsentType,
    granted: Number(row.granted) === 1,
    grantedAt: String(row.granted_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
  }));
}
