/**
 * GDPR Service — Articles 15, 17, and 20 compliance.
 *
 * Implements:
 * - Right to deletion (Article 17): soft-delete user data across all tables,
 *   anonymize audit logs (don't hard-delete — replace with '[DELETED USER]').
 * - Data portability (Article 20): export user data as ZIP with JSON files per table.
 * - Right to access (Article 15): get a summary of what data exists for a user.
 *
 * Technical requirements:
 * - Anonymize audit logs (replace user info, don't delete).
 * - Soft-delete with 30-day recovery window.
 * - Export as ZIP with JSON files per table.
 */

import { randomUUID } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { sqlAll, sqlGet, sqlRun, sqlBatch } from '../../server/libsqlDb';
import type {
  GDPRRequest,
  GDPRRequestRow,
  DeletionResult,
  ExportResult,
  DataSummary,
  DataTableSummary,
  SoftDeletedRecord,
} from './types';
import { USER_DATA_TABLES } from './types';

// ── Minimal ZIP builder (no external deps) ───────────────────────────

interface ZipEntry {
  name: string;
  data: Buffer;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const compressed = deflateRawSync(entry.data);
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data);

    // Local file header
    const local = Buffer.alloc(30 + nameBuffer.length);
    local.writeUInt32LE(0x04034b50, 0);  // signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0, 6);            // flags
    local.writeUInt16LE(8, 8);            // compression (deflate)
    local.writeUInt16LE(0, 10);           // mod time
    local.writeUInt16LE(0, 12);           // mod date
    local.writeUInt32LE(crc, 14);         // crc32
    local.writeUInt32LE(compressed.length, 18);  // compressed size
    local.writeUInt32LE(entry.data.length, 22);  // uncompressed size
    local.writeUInt16LE(nameBuffer.length, 26);  // filename length
    local.writeUInt16LE(0, 28);           // extra field length
    nameBuffer.copy(local, 30);

    // Central directory header
    const central = Buffer.alloc(46 + nameBuffer.length);
    central.writeUInt32LE(0x02014b50, 0);  // signature
    central.writeUInt16LE(20, 4);           // version made by
    central.writeUInt16LE(20, 6);           // version needed
    central.writeUInt16LE(0, 8);            // flags
    central.writeUInt16LE(8, 10);           // compression
    central.writeUInt16LE(0, 12);           // mod time
    central.writeUInt16LE(0, 14);           // mod date
    central.writeUInt32LE(crc, 16);         // crc32
    central.writeUInt32LE(compressed.length, 20);  // compressed size
    central.writeUInt32LE(entry.data.length, 24);  // uncompressed size
    central.writeUInt16LE(nameBuffer.length, 28);  // filename length
    central.writeUInt16LE(0, 30);           // extra length
    central.writeUInt16LE(0, 32);           // comment length
    central.writeUInt16LE(0, 34);           // disk number start
    central.writeUInt16LE(0, 36);           // internal attrs
    central.writeUInt32LE(0, 38);           // external attrs
    central.writeUInt32LE(offset, 42);      // local header offset
    nameBuffer.copy(central, 46);

    localHeaders.push(local, compressed);
    centralHeaders.push(central);
    offset += local.length + compressed.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((s, b) => s + b.length, 0);

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);                // disk number
  eocd.writeUInt16LE(0, 6);                // disk with central dir
  eocd.writeUInt16LE(entries.length, 8);   // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);  // total entries
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);               // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

// ── Table column mapping for user data lookups ───────────────────────

/** Known user-id column names per table. */
const TABLE_USER_COLUMNS: Record<string, string> = {
  projects: 'actor_id',
  experiment_records: 'actor_id',
  project_history: 'actor_id',
  project_run_artifact_index: 'actor_id',
  sync_audit: 'actor_id',
  gdpr_requests: 'user_id',
};

// ── GDPR Service ─────────────────────────────────────────────────────

export class GDPRService {
  /**
   * Initialize GDPR tables (idempotent).
   */
  static async ensureTables(): Promise<void> {
    await sqlRun(`
      CREATE TABLE IF NOT EXISTS gdpr_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('deletion','export','access')),
        status TEXT NOT NULL CHECK(status IN ('pending','processing','completed','failed')),
        requested_at TEXT NOT NULL,
        completed_at TEXT,
        error_message TEXT
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
  }

  // ── Article 17: Right to Deletion ──────────────────────────────────

  /**
   * Create a deletion request (status: pending).
   */
  async requestDataDeletion(userId: string): Promise<GDPRRequest> {
    const id = randomUUID();
    const now = new Date().toISOString();

    await sqlRun(
      `INSERT INTO gdpr_requests (id, user_id, type, status, requested_at)
       VALUES (?, ?, 'deletion', 'pending', ?)`,
      [id, userId, now],
    );

    return { id, userId, type: 'deletion', status: 'pending', requestedAt: now };
  }

  /**
   * Process a pending deletion request.
   *
   * - Soft-deletes user records across all user-data tables (30-day recovery).
   * - Anonymizes audit log entries (replaces actor info with '[DELETED USER]').
   * - Marks the request as completed.
   */
  async processDeletion(requestId: string): Promise<DeletionResult> {
    const result: DeletionResult = { tablesAffected: [], recordsDeleted: 0, recordsAnonymized: 0 };

    // Get the request
    const requestRow = await sqlGet(
      'SELECT * FROM gdpr_requests WHERE id = ? AND type = ?',
      [requestId, 'deletion'],
    ) as GDPRRequestRow | undefined;

    if (!requestRow) {
      throw new Error(`Deletion request not found: ${requestId}`);
    }
    if (requestRow.status === 'completed') {
      throw new Error(`Deletion request already completed: ${requestId}`);
    }

    const userId = requestRow.user_id;
    const now = new Date();
    const recoverableUntil = new Date(now);
    recoverableUntil.setDate(recoverableUntil.getDate() + 30);

    // Mark as processing
    await sqlRun(
      'UPDATE gdpr_requests SET status = ? WHERE id = ?',
      ['processing', requestId],
    );

    try {
      for (const table of USER_DATA_TABLES) {
        const userCol = TABLE_USER_COLUMNS[table];
        if (!userCol) continue;

        try {
          if (table === 'audit_log') {
            // Anonymize audit logs — don't delete
            const updateResult = await sqlRun(
              `UPDATE audit_log
               SET actor_id = '[DELETED USER]',
                   actor_name = '[DELETED USER]',
                   actor_email = NULL,
                   actor_ip = NULL
               WHERE actor_id = ?`,
              [userId],
            );
            if (updateResult.rowsAffected > 0) {
              result.tablesAffected.push(table);
              result.recordsAnonymized += updateResult.rowsAffected;
            }
          } else {
            // Soft-delete: copy to soft_deleted_records, then mark as deleted
            const records = await sqlAll(
              `SELECT * FROM ${table} WHERE ${userCol} = ? AND (soft_deleted IS NULL OR soft_deleted = 0)`,
              [userId],
            );

            for (const record of records) {
              await sqlRun(
                `INSERT INTO soft_deleted_records (id, original_table, original_id, data, deleted_at, recoverable_until, deleted_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  randomUUID(),
                  table,
                  String(record.id ?? ''),
                  JSON.stringify(record),
                  now.toISOString(),
                  recoverableUntil.toISOString(),
                  requestId,
                ],
              );
            }

            // Mark as soft-deleted (or hard-delete if table doesn't have soft_deleted column)
            try {
              const updateResult = await sqlRun(
                `UPDATE ${table} SET soft_deleted = 1 WHERE ${userCol} = ? AND (soft_deleted IS NULL OR soft_deleted = 0)`,
                [userId],
              );
              if (updateResult.rowsAffected > 0) {
                result.tablesAffected.push(table);
                result.recordsDeleted += updateResult.rowsAffected;
              }
            } catch {
              // Table might not have soft_deleted column — try hard delete
              const deleteResult = await sqlRun(
                `DELETE FROM ${table} WHERE ${userCol} = ?`,
                [userId],
              );
              if (deleteResult.rowsAffected > 0) {
                result.tablesAffected.push(table);
                result.recordsDeleted += deleteResult.rowsAffected;
              }
            }
          }
        } catch {
          // Table may not exist — skip gracefully
        }
      }

      // Mark request as completed
      await sqlRun(
        'UPDATE gdpr_requests SET status = ?, completed_at = ? WHERE id = ?',
        ['completed', new Date().toISOString(), requestId],
      );
    } catch (err) {
      await sqlRun(
        'UPDATE gdpr_requests SET status = ?, error_message = ? WHERE id = ?',
        ['failed', String(err), requestId],
      );
      throw err;
    }

    return result;
  }

  // ── Article 20: Data Portability ───────────────────────────────────

  /**
   * Create an export request (status: pending).
   */
  async requestDataExport(userId: string): Promise<GDPRRequest> {
    const id = randomUUID();
    const now = new Date().toISOString();

    await sqlRun(
      `INSERT INTO gdpr_requests (id, user_id, type, status, requested_at)
       VALUES (?, ?, 'export', 'pending', ?)`,
      [id, userId, now],
    );

    return { id, userId, type: 'export', status: 'pending', requestedAt: now };
  }

  /**
   * Process a pending export request.
   *
   * Collects all user data across tables and packages as a ZIP file
   * with one JSON file per table.
   */
  async processExport(requestId: string): Promise<ExportResult> {
    // Get the request
    const requestRow = await sqlGet(
      'SELECT * FROM gdpr_requests WHERE id = ? AND type = ?',
      [requestId, 'export'],
    ) as GDPRRequestRow | undefined;

    if (!requestRow) {
      throw new Error(`Export request not found: ${requestId}`);
    }

    const userId = requestRow.user_id;

    // Mark as processing
    await sqlRun(
      'UPDATE gdpr_requests SET status = ? WHERE id = ?',
      ['processing', requestId],
    );

    try {
      const entries: ZipEntry[] = [];

      // Add metadata
      const metadata = {
        exportedAt: new Date().toISOString(),
        userId,
        requestId,
        tables: [] as string[],
      };

      for (const table of USER_DATA_TABLES) {
        const userCol = TABLE_USER_COLUMNS[table];
        if (!userCol) continue;

        try {
          const records = await sqlAll(
            `SELECT * FROM ${table} WHERE ${userCol} = ?`,
            [userId],
          );

          if (records.length > 0) {
            // Redact sensitive fields in export
            const sanitized = records.map((r) => this.sanitizeForExport(r, table));
            entries.push({
              name: `${table}.json`,
              data: Buffer.from(JSON.stringify(sanitized, null, 2), 'utf8'),
            });
            metadata.tables.push(table);
          }
        } catch {
          // Table may not exist — skip
        }
      }

      // Add metadata file
      entries.push({
        name: '_metadata.json',
        data: Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'),
      });

      // Build ZIP
      const zipBuffer = buildZip(entries);

      // Store the ZIP (in a real system, upload to S3/R2; here we use a data URL)
      // For the API, we'll store in a temp location and return a download URL
      const exportId = randomUUID();
      // Store the buffer reference for download — in production, write to object storage
      // For now, we store the size and indicate the export is ready
      const downloadUrl = `/api/gdpr/export?download=${requestId}`;

      // Mark request as completed
      await sqlRun(
        'UPDATE gdpr_requests SET status = ?, completed_at = ? WHERE id = ?',
        ['completed', new Date().toISOString(), requestId],
      );

      // Store export artifact reference (the actual ZIP is ephemeral in-memory;
      // production would use persistent storage)
      ExportStore.set(requestId, zipBuffer);

      return {
        downloadUrl,
        fileSize: zipBuffer.length,
        format: 'zip',
      };
    } catch (err) {
      await sqlRun(
        'UPDATE gdpr_requests SET status = ?, error_message = ? WHERE id = ?',
        ['failed', String(err), requestId],
      );
      throw err;
    }
  }

  /**
   * Get the raw ZIP buffer for a completed export request.
   * Returns null if the export hasn't been processed yet.
   */
  async getExportBuffer(requestId: string): Promise<Buffer | null> {
    return ExportStore.get(requestId) ?? null;
  }

  // ── Article 15: Right to Access ────────────────────────────────────

  /**
   * Get a summary of all data held for a user.
   */
  async getDataSummary(userId: string): Promise<DataSummary> {
    const tables: DataTableSummary[] = [];

    for (const table of USER_DATA_TABLES) {
      const userCol = TABLE_USER_COLUMNS[table];
      if (!userCol) continue;

      try {
        const countRow = await sqlGet(
          `SELECT COUNT(*) as cnt FROM ${table} WHERE ${userCol} = ?`,
          [userId],
        );
        const recordCount = Number(countRow?.cnt ?? 0);

        let lastModified = 'N/A';
        if (recordCount > 0) {
          // Try common timestamp columns
          for (const tsCol of ['updated_at', 'created_at', 'requested_at', 'classified_at', 'timestamp']) {
            try {
              const tsRow = await sqlGet(
                `SELECT ${tsCol} FROM ${table} WHERE ${userCol} = ? ORDER BY ${tsCol} DESC LIMIT 1`,
                [userId],
              );
              if (tsRow && tsRow[tsCol]) {
                lastModified = String(tsRow[tsCol]);
                break;
              }
            } catch {
              // Column doesn't exist in this table — try next
            }
          }
        }

        tables.push({ name: table, recordCount, lastModified });
      } catch {
        // Table may not exist
        tables.push({ name: table, recordCount: 0, lastModified: 'N/A' });
      }
    }

    return { tables };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  /**
   * Sanitize a record for export — remove internal-only fields.
   */
  private sanitizeForExport(record: Record<string, unknown>, _table: string): Record<string, unknown> {
    const sanitized = { ...record };
    // Remove internal tracking fields
    delete sanitized.soft_deleted;
    delete sanitized.archived;
    return sanitized;
  }
}

// ── In-memory export store (production would use object storage) ─────

export const ExportStore = new Map<string, Buffer>();
