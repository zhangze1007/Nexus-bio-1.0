/**
 * Tests for backupManager — backup automation service.
 *
 * Covers:
 * - createBackup: creates a VACUUM INTO snapshot, records metadata
 * - listBackups: returns backups ordered by timestamp descending
 * - restoreBackup: copies backup over the main database
 * - verifyBackup: checks file existence, size, table counts, integrity
 * - Error handling: missing backups, failed backups, missing files
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  createBackup,
  listBackups,
  restoreBackup,
  verifyBackup,
} from "../src/server/backup/backupManager";
import { sqlRun, sqlGet, sqlAll, closeLibsqlClient } from "../src/server/libsqlDb";

const BACKUP_DIR = path.join(process.cwd(), ".nexus", "backups");

afterAll(() => {
  closeLibsqlClient();
});

describe("backupManager", () => {
  // Ensure the backup directory exists before tests
  beforeAll(async () => {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  });

  // Clean up backup files after each test
  afterEach(async () => {
    try {
      const files = await fs.readdir(BACKUP_DIR);
      for (const file of files) {
        if (file.endsWith(".db")) {
          await fs.unlink(path.join(BACKUP_DIR, file)).catch(() => {});
        }
      }
    } catch {
      // Directory may not exist
    }
    // Clean up backup metadata
    await sqlRun("DELETE FROM backups").catch(() => {});
  });

  describe("createBackup", () => {
    test("creates a backup with valid id, timestamp, size, and table counts", async () => {
      const result = await createBackup();

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.tables).toBeDefined();
      expect(typeof result.tables).toBe("object");
    });

    test("backup file exists on disk after creation", async () => {
      const result = await createBackup();
      const filePath = path.join(BACKUP_DIR, `${result.id}.db`);

      await expect(fs.access(filePath)).resolves.toBeUndefined();
    });

    test("records metadata in backups table", async () => {
      const result = await createBackup();

      const row = await sqlGet("SELECT * FROM backups WHERE id = ?", [result.id]);
      expect(row).toBeDefined();
      expect(row!.id).toBe(result.id);
      expect(row!.timestamp).toBe(result.timestamp);
      expect(row!.size_bytes).toBe(result.sizeBytes);
      expect(row!.status).toBe("completed");
      expect(JSON.parse(row!.table_counts as string)).toEqual(result.tables);
    });

    test("successive backups have unique ids and increasing timestamps", async () => {
      const first = await createBackup();
      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = await createBackup();

      expect(first.id).not.toBe(second.id);
      expect(second.timestamp).toBeGreaterThanOrEqual(first.timestamp);
    });

    test("backup file is a valid SQLite database", async () => {
      const result = await createBackup();

      // Open the backup file as a separate database and verify it's valid
      const { createClient } = await import("@libsql/client");
      const backupClient = createClient({ url: `file:${path.join(BACKUP_DIR, `${result.id}.db`)}` });

      // Verify the file is a valid SQLite database by querying its schema
      const schemaResult = await backupClient.execute("SELECT name FROM sqlite_master WHERE type='table'");
      expect(schemaResult.rows.length).toBeGreaterThanOrEqual(0);

      // Verify integrity check passes
      const integrityResult = await backupClient.execute("PRAGMA integrity_check");
      const firstRow = integrityResult.rows[0];
      expect(firstRow?.integrity_check === "ok" || firstRow?.[0] === "ok").toBe(true);

      backupClient.close();
    });
  });

  describe("listBackups", () => {
    test("returns empty array when no backups exist", async () => {
      const backups = await listBackups();
      expect(backups).toEqual([]);
    });

    test("returns backups ordered by timestamp descending", async () => {
      const first = await createBackup();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = await createBackup();

      const backups = await listBackups();
      expect(backups).toHaveLength(2);
      // Most recent first
      expect(backups[0].id).toBe(second.id);
      expect(backups[1].id).toBe(first.id);
    });

    test("includes all required fields", async () => {
      await createBackup();
      const backups = await listBackups();

      expect(backups).toHaveLength(1);
      const backup = backups[0];
      expect(backup.id).toBeDefined();
      expect(backup.timestamp).toBeGreaterThan(0);
      expect(backup.sizeBytes).toBeGreaterThan(0);
      expect(backup.tableCounts).toBeDefined();
      expect(backup.status).toBe("completed");
    });
  });

  describe("restoreBackup", () => {
    test("throws when backup id does not exist", async () => {
      await expect(restoreBackup("nonexistent-id")).rejects.toThrow("Backup not found");
    });

    test("throws when backup has failed status", async () => {
      // Manually insert a failed backup record
      const fakeId = crypto.randomUUID();
      await sqlRun(
        `INSERT INTO backups (id, timestamp, size_bytes, table_counts, status) VALUES (?, ?, ?, ?, ?)`,
        [fakeId, Date.now(), 0, "{}", "failed"],
      );

      await expect(restoreBackup(fakeId)).rejects.toThrow("Cannot restore a failed backup");
    });

    test("throws when backup file is missing from disk", async () => {
      // Insert metadata but don't create the actual file
      const fakeId = crypto.randomUUID();
      await sqlRun(
        `INSERT INTO backups (id, timestamp, size_bytes, table_counts, status) VALUES (?, ?, ?, ?, ?)`,
        [fakeId, Date.now(), 100, "{}", "completed"],
      );

      await expect(restoreBackup(fakeId)).rejects.toThrow("Backup file not found on disk");
    });

    test("successfully restores from a valid backup", async () => {
      const backup = await createBackup();
      const result = await restoreBackup(backup.id);

      expect(result.id).toBe(`restore-${backup.id}`);
      expect(result.restoredFrom).toBe(backup.id);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.tables).toBeDefined();
    });
  });

  describe("verifyBackup", () => {
    test("throws when backup id does not exist", async () => {
      await expect(verifyBackup("nonexistent-id")).rejects.toThrow("Backup not found");
    });

    test("reports invalid when backup file is missing", async () => {
      const fakeId = crypto.randomUUID();
      await sqlRun(
        `INSERT INTO backups (id, timestamp, size_bytes, table_counts, status) VALUES (?, ?, ?, ?, ?)`,
        [fakeId, Date.now(), 100, "{}", "completed"],
      );

      const result = await verifyBackup(fakeId);
      expect(result.valid).toBe(false);
      expect(result.checks.fileExists).toBe(false);
      expect(result.details).toContain("Backup file not found");
    });

    test("passes all checks for a valid backup", async () => {
      const backup = await createBackup();
      const result = await verifyBackup(backup.id);

      expect(result.valid).toBe(true);
      expect(result.checks.fileExists).toBe(true);
      expect(result.checks.sizeMatch).toBe(true);
      expect(result.checks.integrityOk).toBe(true);
      expect(result.details).toBe("All checks passed");
    });

    test("detects size mismatch when file is tampered", async () => {
      const backup = await createBackup();
      const filePath = path.join(BACKUP_DIR, `${backup.id}.db`);

      // Append garbage bytes to tamper with the file
      await fs.appendFile(filePath, Buffer.from("tampered"));

      const result = await verifyBackup(backup.id);
      expect(result.valid).toBe(false);
      expect(result.checks.fileExists).toBe(true);
      expect(result.checks.sizeMatch).toBe(false);
    });
  });
});
