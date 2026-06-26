/**
 * Immutable Audit Logger — GxP-ready with SHA-256 hash chaining.
 *
 * Every audit event is recorded with actor identity, timestamp, before/after
 * state, and a cryptographic hash chain for tamper detection.
 *
 * Storage: audit_log table via @libsql/client (async).
 */

import { createHash } from "crypto";
import { sqlAll, sqlRun } from "../../server/libsqlDb";

export interface AuditEvent {
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  actorIp?: string;
  action: string; // create, update, delete, export, sign, login, share, fork
  entityType?: string; // project, experiment, task, inventory, etc.
  entityId?: string;
  projectId?: string;
  beforeState?: unknown; // JSON snapshot before change
  afterState?: unknown; // JSON snapshot after change
  changeSummary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Compute the SHA-256 hash for an audit entry.
 * The hash covers: timestamp, actorId, action, entityType, entityId, previousHash.
 */
function computeEntryHash(entry: {
  timestamp: string;
  actorId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  previousHash: string;
}): string {
  const hashInput = JSON.stringify({
    timestamp: entry.timestamp,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    previousHash: entry.previousHash,
  });
  return createHash("sha256").update(hashInput).digest("hex");
}

const GENESIS_HASH = "0".repeat(64);

/**
 * Log an immutable audit event with hash chaining.
 *
 * Returns the entry's UUID and computed hash.
 */
export async function logAuditEvent(
  event: AuditEvent,
): Promise<{ id: string; hash: string }> {
  // Get the previous hash and next sequence number from the last chain entry
  const lastEntry = await sqlAll(
    "SELECT hash, sequence_number FROM audit_log ORDER BY sequence_number DESC LIMIT 1",
  );

  const previousHash = lastEntry.length > 0 ? String(lastEntry[0].hash) : GENESIS_HASH;
  const nextSeq =
    lastEntry.length > 0 ? Number(lastEntry[0].sequence_number) + 1 : 1;

  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();

  // Compute hash from the deterministic fields
  const hash = computeEntryHash({
    timestamp,
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    previousHash,
  });

  await sqlRun(
    `INSERT INTO audit_log (
      id, sequence_number, timestamp,
      actor_id, actor_name, actor_email, actor_ip,
      action, entity_type, entity_id, project_id,
      before_state, after_state, change_summary,
      hash, previous_hash, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      nextSeq,
      timestamp,
      event.actorId,
      event.actorName ?? null,
      event.actorEmail ?? null,
      event.actorIp ?? null,
      event.action,
      event.entityType ?? null,
      event.entityId ?? null,
      event.projectId ?? null,
      event.beforeState ? JSON.stringify(event.beforeState) : null,
      event.afterState ? JSON.stringify(event.afterState) : null,
      event.changeSummary ?? null,
      hash,
      previousHash,
      event.metadata ? JSON.stringify(event.metadata) : null,
    ],
  );

  return { id, hash };
}
