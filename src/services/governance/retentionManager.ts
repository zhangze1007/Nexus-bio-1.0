/**
 * Retention Manager — Enforces data retention policies.
 *
 * Responsibilities:
 * - Enforce retention policies: archive records past archiveAfterDays,
 *   soft-delete records past retentionDays.
 * - Provide retention status dashboards per org.
 * - Soft-deleted records go into a recovery table with a 30-day window.
 * - Archived records move to an archive table (still queryable, not active).
 */

import { randomUUID } from 'node:crypto';
import { sqlAll, sqlGet, sqlRun, sqlBatch } from '../../server/libsqlDb';
import type {
  RetentionPolicy,
  RetentionEnforcementResult,
  RetentionStatusEntry,
  SoftDeletedRecord,
} from './types';

// ── Table Initialization (idempotent) ────────────────────────────────

/**
 * Ensure the governance tables exist. Call once at startup or lazily.
 */
export async function ensureRetentionTables(): Promise<void> {
  await sqlRun(`
    CREATE TABLE IF NOT EXISTS retention_policies (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      classification TEXT NOT NULL,
      retention_days INTEGER NOT NULL,
      archive_after_days INTEGER NOT NULL,
      auto_delete INTEGER NOT NULL DEFAULT 0,
      UNIQUE(org_id, entity_type)
    )
  `);

  await sqlRun(`
    CREATE TABLE IF NOT EXISTS soft_deleted_records (
      id TEXT PRIMARY KEY,
      original_table TEXT NOT NULL,
      original_id TEXT NOT NULL,
      data TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      recoverable_until TEXT NOT NULL,
      deleted_by TEXT NOT NULL DEFAULT 'system'
    )
  `);

  await sqlRun(`
    CREATE TABLE IF NOT EXISTS archived_records (
      id TEXT PRIMARY KEY,
      original_table TEXT NOT NULL,
      original_id TEXT NOT NULL,
      data TEXT NOT NULL,
      archived_at TEXT NOT NULL,
      archived_by TEXT NOT NULL DEFAULT 'system'
    )
  `);
}

// ── Retention Manager Class ──────────────────────────────────────────

export class RetentionManager {
  /**
   * Enforce a single retention policy.
   *
   * For records in the target entity type table:
   * - Records older than `archiveAfterDays` but younger than `retentionDays`
   *   are moved to the archive table.
   * - Records older than `retentionDays` are soft-deleted (30-day recovery).
   * - If `autoDelete` is true, records past recovery window are permanently deleted.
   *
   * @param policy — The retention policy to enforce.
   * @param actorId — Who triggered the enforcement (for audit).
   */
  async enforceRetentionPolicy(
    policy: RetentionPolicy,
    actorId: string = 'system',
  ): Promise<RetentionEnforcementResult> {
    const result: RetentionEnforcementResult = { archived: 0, deleted: 0, errors: [] };
    const now = new Date();

    try {
      // Calculate cutoff timestamps
      const archiveCutoff = new Date(now);
      archiveCutoff.setDate(archiveCutoff.getDate() - policy.archiveAfterDays);

      const deleteCutoff = new Date(now);
      deleteCutoff.setDate(deleteCutoff.getDate() - policy.retentionDays);

      // 1. Archive: records older than archiveAfterDays but not yet archived
      try {
        const archivable = await sqlAll(
          `SELECT * FROM ${policy.entityType}
           WHERE created_at < ? AND (archived IS NULL OR archived = 0)
           LIMIT 1000`,
          [archiveCutoff.toISOString()],
        );

        for (const record of archivable) {
          try {
            await sqlRun(
              `INSERT INTO archived_records (id, original_table, original_id, data, archived_at, archived_by)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                randomUUID(),
                policy.entityType,
                String(record.id ?? ''),
                JSON.stringify(record),
                now.toISOString(),
                actorId,
              ],
            );
            await sqlRun(
              `UPDATE ${policy.entityType} SET archived = 1 WHERE id = ?`,
              [record.id],
            );
            result.archived++;
          } catch (rowErr) {
            result.errors.push(`Archive failed for ${policy.entityType}:${record.id}: ${String(rowErr)}`);
          }
        }
      } catch (tableErr) {
        // Table may not exist or lack created_at column — skip gracefully
        result.errors.push(`Archive scan skipped for ${policy.entityType}: ${String(tableErr)}`);
      }

      // 2. Soft-delete: records older than retentionDays
      try {
        const deletable = await sqlAll(
          `SELECT * FROM ${policy.entityType}
           WHERE created_at < ? AND (soft_deleted IS NULL OR soft_deleted = 0)
           LIMIT 1000`,
          [deleteCutoff.toISOString()],
        );

        const recoverableUntil = new Date(now);
        recoverableUntil.setDate(recoverableUntil.getDate() + 30);

        for (const record of deletable) {
          try {
            await sqlRun(
              `INSERT INTO soft_deleted_records (id, original_table, original_id, data, deleted_at, recoverable_until, deleted_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                randomUUID(),
                policy.entityType,
                String(record.id ?? ''),
                JSON.stringify(record),
                now.toISOString(),
                recoverableUntil.toISOString(),
                actorId,
              ],
            );
            await sqlRun(
              `UPDATE ${policy.entityType} SET soft_deleted = 1 WHERE id = ?`,
              [record.id],
            );
            result.deleted++;
          } catch (rowErr) {
            result.errors.push(`Soft-delete failed for ${policy.entityType}:${record.id}: ${String(rowErr)}`);
          }
        }
      } catch (tableErr) {
        result.errors.push(`Delete scan skipped for ${policy.entityType}: ${String(tableErr)}`);
      }

      // 3. Permanent delete: if autoDelete, purge expired soft-deleted records
      if (policy.autoDelete) {
        try {
          const expired = await sqlAll(
            `SELECT * FROM soft_deleted_records WHERE original_table = ? AND recoverable_until < ?`,
            [policy.entityType, now.toISOString()],
          );
          for (const record of expired) {
            try {
              await sqlRun('DELETE FROM soft_deleted_records WHERE id = ?', [record.id]);
            } catch (rowErr) {
              result.errors.push(`Permanent delete failed for record ${record.id}: ${String(rowErr)}`);
            }
          }
        } catch (tableErr) {
          result.errors.push(`Permanent delete scan skipped: ${String(tableErr)}`);
        }
      }
    } catch (err) {
      result.errors.push(`Policy enforcement failed: ${String(err)}`);
    }

    return result;
  }

  /**
   * Get retention status summary for an org.
   *
   * Returns per-entity-type stats: total records, expired records, archived records.
   */
  async getRetentionStatus(orgId: string): Promise<RetentionStatusEntry[]> {
    // Get all policies for this org
    const policies = await sqlAll(
      'SELECT * FROM retention_policies WHERE org_id = ?',
      [orgId],
    );

    const entries: RetentionStatusEntry[] = [];

    for (const policy of policies) {
      const entityType = String(policy.entity_type);
      const retentionDays = Number(policy.retention_days);

      try {
        // Total active records
        const totalRow = await sqlGet(
          `SELECT COUNT(*) as cnt FROM ${entityType} WHERE soft_deleted IS NULL OR soft_deleted = 0`,
        );
        const totalRecords = Number(totalRow?.cnt ?? 0);

        // Expired records (past retention)
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);
        const expiredRow = await sqlGet(
          `SELECT COUNT(*) as cnt FROM ${entityType} WHERE created_at < ? AND (soft_deleted IS NULL OR soft_deleted = 0)`,
          [cutoff.toISOString()],
        );
        const expiredRecords = Number(expiredRow?.cnt ?? 0);

        // Archived records
        const archivedRow = await sqlGet(
          `SELECT COUNT(*) as cnt FROM archived_records WHERE original_table = ?`,
          [entityType],
        );
        const archivedRecords = Number(archivedRow?.cnt ?? 0);

        entries.push({ entityType, totalRecords, expiredRecords, archivedRecords });
      } catch {
        // Table may not exist — report zeros
        entries.push({ entityType, totalRecords: 0, expiredRecords: 0, archivedRecords: 0 });
      }
    }

    return entries;
  }
}
