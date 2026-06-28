/**
 * Session Manager — Multi-device session tracking for Nexus-Bio
 *
 * Stores active sessions in the user_sessions table via libsql.
 * Supports per-user session listing, single revocation, and bulk revocation.
 *
 * Device types: desktop | mobile | tablet
 */

import { randomBytes } from "node:crypto";
import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ─── Types ────────────────────────────────────────────────────────────────

export type DeviceType = "desktop" | "mobile" | "tablet";

export interface DeviceInfo {
  deviceName: string;
  deviceType: DeviceType;
  ipAddress: string;
}

export interface Session {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: DeviceType;
  ipAddress: string;
  lastActive: string;
  createdAt: string;
  revokedAt: string | null;
}

// ─── Schema ───────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS user_sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    ip_address  TEXT NOT NULL,
    last_active TEXT NOT NULL DEFAULT (datetime('now')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at  TEXT
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON user_sessions (user_id)
`;

/**
 * Ensure the schema exists. Safe to call multiple times.
 */
export async function ensureSchema(): Promise<void> {
  await sqlRun(CREATE_TABLE_SQL);
  await sqlRun(CREATE_INDEX_SQL);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `sess_${randomBytes(16).toString("hex")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Create a new session for a user.
 *
 * @param userId   - The authenticated user's ID
 * @param deviceInfo - Device metadata captured from the request
 * @returns The newly created Session record
 */
export async function createSession(userId: string, deviceInfo: DeviceInfo): Promise<Session> {
  await ensureSchema();

  const id = generateSessionId();
  const ts = nowIso();

  await sqlRun(
    `INSERT INTO user_sessions (id, user_id, device_name, device_type, ip_address, last_active, created_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [id, userId, deviceInfo.deviceName, deviceInfo.deviceType, deviceInfo.ipAddress, ts, ts],
  );

  return {
    id,
    userId,
    deviceName: deviceInfo.deviceName,
    deviceType: deviceInfo.deviceType,
    ipAddress: deviceInfo.ipAddress,
    lastActive: ts,
    createdAt: ts,
    revokedAt: null,
  };
}

/**
 * List all active (non-revoked) sessions for a user, ordered by most
 * recently active first.
 */
export async function getActiveSessions(userId: string): Promise<Session[]> {
  await ensureSchema();

  const rows = await sqlAll(
    `SELECT id, user_id, device_name, device_type, ip_address, last_active, created_at, revoked_at
     FROM user_sessions
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY last_active DESC`,
    [userId],
  );

  return rows.map(mapRow);
}

/**
 * Revoke a single session. Only revokes if the session belongs to the
 * given user and is not already revoked.
 *
 * @throws Error if the session does not exist or does not belong to the user
 */
export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await ensureSchema();

  const existing = await sqlGet(`SELECT id, user_id, revoked_at FROM user_sessions WHERE id = ?`, [sessionId]);

  if (!existing) {
    throw new Error(`Session ${sessionId} not found`);
  }
  if (existing.user_id !== userId) {
    throw new Error(`Session ${sessionId} does not belong to user ${userId}`);
  }
  if (existing.revoked_at !== null && existing.revoked_at !== undefined) {
    return; // already revoked, idempotent
  }

  await sqlRun(`UPDATE user_sessions SET revoked_at = ? WHERE id = ?`, [nowIso(), sessionId]);
}

/**
 * Revoke all active sessions for a user. This is useful for a
 * "sign out everywhere" action or a security incident response.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await ensureSchema();

  await sqlRun(`UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [nowIso(), userId]);
}

// ─── Row mapper ───────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    deviceName: row.device_name as string,
    deviceType: row.device_type as DeviceType,
    ipAddress: row.ip_address as string,
    lastActive: row.last_active as string,
    createdAt: row.created_at as string,
    revokedAt: (row.revoked_at as string) ?? null,
  };
}
