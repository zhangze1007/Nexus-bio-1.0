/**
 * Retention Automation Service
 *
 * Orchestrates data retention enforcement across all policies for an org.
 * Builds on RetentionManager for per-policy enforcement and adds:
 * - Bulk enforcement across all policies for an org
 * - Entity-type-specific archival with explicit cutoff dates
 * - Aggregated status reporting
 */

import { randomUUID } from 'node:crypto';
import { sqlAll, sqlGet, sqlRun } from '../../server/libsqlDb';
import { RetentionManager, ensureRetentionTables } from './retentionManager';
import type {
  RetentionPolicy,
  RetentionEnforcementResult,
  RetentionStatusEntry,
  ArchiveResult,
} from './types';

// ── Enforcement ────────────────────────────────────────────────────────

/**
 * Enforce all retention policies for an org.
 *
 * Iterates every retention policy belonging to `orgId`, enforces each one
 * via RetentionManager, and aggregates the results.
 *
 * @param orgId — The organisation whose policies to enforce.
 * @returns Aggregated enforcement result (archived, deleted, errors).
 */
export async function enforceRetentionPolicies(
  orgId: string,
): Promise<RetentionEnforcementResult> {
  if (!orgId || typeof orgId !== 'string' || orgId.trim().length === 0) {
    throw new Error('orgId is required and must be a non-empty string');
  }

  await ensureRetentionTables();

  const policies = await sqlAll(
    'SELECT * FROM retention_policies WHERE org_id = ?',
    [orgId],
  );

  const manager = new RetentionManager();
  const aggregated: RetentionEnforcementResult = { archived: 0, deleted: 0, errors: [] };

  for (const row of policies) {
    const policy: RetentionPolicy = {
      id: String(row.id),
      orgId: String(row.org_id),
      entityType: String(row.entity_type),
      classification: String(row.classification) as RetentionPolicy['classification'],
      retentionDays: Number(row.retention_days),
      archiveAfterDays: Number(row.archive_after_days),
      autoDelete: Number(row.auto_delete) === 1,
    };

    try {
      const result = await manager.enforceRetentionPolicy(policy);
      aggregated.archived += result.archived;
      aggregated.deleted += result.deleted;
      aggregated.errors.push(...result.errors);
    } catch (err) {
      aggregated.errors.push(
        `Policy ${policy.id} (${policy.entityType}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return aggregated;
}

// ── Status ─────────────────────────────────────────────────────────────

/**
 * Get retention status for all entity types under an org.
 *
 * Returns per-entity-type stats: total records, expired records, archived records.
 *
 * @param orgId — The organisation to report on.
 * @returns Array of status entries, one per entity type with a retention policy.
 */
export async function getRetentionStatus(
  orgId: string,
): Promise<RetentionStatusEntry[]> {
  if (!orgId || typeof orgId !== 'string' || orgId.trim().length === 0) {
    throw new Error('orgId is required and must be a non-empty string');
  }

  await ensureRetentionTables();

  const manager = new RetentionManager();
  return manager.getRetentionStatus(orgId);
}

// ── Archival ───────────────────────────────────────────────────────────

/**
 * Archive expired records for a specific entity type.
 *
 * Moves records created before `cutoffDate` from the entity table into
 * the `archived_records` table, then marks them as archived in the source.
 *
 * @param entityType — The table name to scan for expired records.
 * @param cutoffDate — Records created before this date are archived.
 * @returns Archive result with count of archived records and any errors.
 */
export async function archiveExpiredData(
  entityType: string,
  cutoffDate: Date,
): Promise<ArchiveResult> {
  if (!entityType || typeof entityType !== 'string' || entityType.trim().length === 0) {
    throw new Error('entityType is required and must be a non-empty string');
  }
  if (!(cutoffDate instanceof Date) || isNaN(cutoffDate.getTime())) {
    throw new Error('cutoffDate must be a valid Date');
  }

  await ensureRetentionTables();

  const result: ArchiveResult = {
    entityType,
    archivedCount: 0,
    cutoffDate: cutoffDate.toISOString(),
    errors: [],
  };

  try {
    const expired = await sqlAll(
      `SELECT * FROM ${entityType}
       WHERE created_at < ? AND (archived IS NULL OR archived = 0)
       LIMIT 1000`,
      [cutoffDate.toISOString()],
    );

    const now = new Date().toISOString();

    for (const record of expired) {
      try {
        await sqlRun(
          `INSERT INTO archived_records (id, original_table, original_id, data, archived_at, archived_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            entityType,
            String(record.id ?? ''),
            JSON.stringify(record),
            now,
            'retention-automation',
          ],
        );
        await sqlRun(
          `UPDATE ${entityType} SET archived = 1 WHERE id = ?`,
          [record.id],
        );
        result.archivedCount++;
      } catch (rowErr) {
        result.errors.push(
          `Archive failed for ${entityType}:${record.id}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`,
        );
      }
    }
  } catch (tableErr) {
    result.errors.push(
      `Archive scan failed for ${entityType}: ${tableErr instanceof Error ? tableErr.message : String(tableErr)}`,
    );
  }

  return result;
}
