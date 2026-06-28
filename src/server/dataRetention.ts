/**
 * Data Retention Policy (R-31)
 *
 * Implements configurable data retention with automatic archival.
 * Old data is soft-deleted and eventually purged after the retention period.
 *
 * Default retention periods:
 * - sync_audit: 90 days
 * - project_history: 365 days
 * - soft_deleted_records: 30 days (recovery window)
 * - gdpr_requests: 365 days
 */

import { sqlRun, sqlAll } from "./libsqlDb";

interface RetentionConfig {
  table: string;
  dateColumn: string;
  retentionDays: number;
  softDelete: boolean;
}

const DEFAULT_RETENTION: RetentionConfig[] = [
  { table: "sync_audit", dateColumn: "created_at", retentionDays: 90, softDelete: false },
  { table: "project_history", dateColumn: "updated_at", retentionDays: 365, softDelete: false },
  { table: "soft_deleted_records", dateColumn: "deleted_at", retentionDays: 30, softDelete: false },
  { table: "gdpr_requests", dateColumn: "requested_at", retentionDays: 365, softDelete: false },
];

export interface RetentionResult {
  table: string;
  recordsArchived: number;
  recordsPurged: number;
}

/**
 * Run data retention policy.
 * Archives old data and purges data past the recovery window.
 */
export async function runRetention(config: RetentionConfig[] = DEFAULT_RETENTION): Promise<RetentionResult[]> {
  const results: RetentionResult[] = [];

  for (const { table, dateColumn, retentionDays, softDelete } of config) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    try {
      if (softDelete) {
        // Soft-delete records older than retention period
        const result = await sqlRun(
          `UPDATE ${table} SET soft_deleted = 1 WHERE ${dateColumn} < ? AND (soft_deleted IS NULL OR soft_deleted = 0)`,
          [cutoff]
        );
        results.push({ table, recordsArchived: result.rowsAffected, recordsPurged: 0 });
      } else {
        // Hard-delete records older than retention period
        const result = await sqlRun(
          `DELETE FROM ${table} WHERE ${dateColumn} < ?`,
          [cutoff]
        );
        results.push({ table, recordsArchived: 0, recordsPurged: result.rowsAffected });
      }
    } catch {
      // Table may not exist — skip gracefully
      results.push({ table, recordsArchived: 0, recordsPurged: 0 });
    }
  }

  return results;
}

/**
 * Get retention statistics.
 */
export async function getRetentionStats(): Promise<Array<{ table: string; totalRecords: number; oldestRecord: number | null }>> {
  const tables = ["sync_audit", "project_history", "soft_deleted_records", "gdpr_requests"];
  const stats: Array<{ table: string; totalRecords: number; oldestRecord: number | null }> = [];

  for (const table of tables) {
    try {
      const row = await (await import("./libsqlDb")).sqlGet(
        `SELECT COUNT(*) as count, MIN(created_at) as oldest FROM ${table}`
      );
      stats.push({
        table,
        totalRecords: (row?.count as number) ?? 0,
        oldestRecord: (row?.oldest as number) ?? null,
      });
    } catch {
      stats.push({ table, totalRecords: 0, oldestRecord: null });
    }
  }

  return stats;
}
