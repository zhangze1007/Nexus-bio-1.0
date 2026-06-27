/**
 * Migration Runner Tests
 *
 * Mocks the libsql database layer and filesystem to test the migration
 * runner logic in isolation (no real DB or file I/O).
 */

// ── Mocks (must be before imports) ───────────────────────────────────────────

const mockSqlRun = jest.fn();
const mockSqlGet = jest.fn();
const mockSqlAll = jest.fn();
const mockSqlBatch = jest.fn();

jest.mock("../src/server/libsqlDb", () => ({
  sqlRun: (...args: unknown[]) => mockSqlRun(...args),
  sqlGet: (...args: unknown[]) => mockSqlGet(...args),
  sqlAll: (...args: unknown[]) => mockSqlAll(...args),
  sqlBatch: (...args: unknown[]) => mockSqlBatch(...args),
  closeLibsqlClient: jest.fn(),
}));

const mockReaddir = jest.fn();
const mockReadFile = jest.fn();
const mockAccess = jest.fn();

jest.mock("node:fs/promises", () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  access: (...args: unknown[]) => mockAccess(...args),
}));

import {
  runMigrations,
  getMigrationStatus,
  rollbackMigration,
  computeChecksum,
  discoverMigrationFiles,
} from "../src/server/migrations/migrationRunner";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MIGRATION_CONTENT_V1 = "CREATE TABLE users (id TEXT PRIMARY KEY);";
const MIGRATION_CONTENT_V2 = "ALTER TABLE users ADD COLUMN email TEXT;";
const DOWN_CONTENT = "DROP TABLE users;";

function setupDefaultMocks(opts?: { applied?: string[] }) {
  const applied = opts?.applied ?? [];

  // ensureMigrationsTable: CREATE TABLE IF NOT EXISTS
  mockSqlRun.mockResolvedValue({ rowsAffected: 0 });

  // discoverMigrationFiles: readdir returns two migration files
  mockReaddir.mockResolvedValue(["001_create_users.sql", "002_add_email.sql", "meta"]);

  // readFile for migration content
  mockReadFile.mockImplementation(async (filePath: string) => {
    if (filePath.includes("001_create_users")) return MIGRATION_CONTENT_V1;
    if (filePath.includes("002_add_email")) return MIGRATION_CONTENT_V2;
    if (filePath.includes("down")) return DOWN_CONTENT;
    throw new Error(`Unexpected readFile: ${filePath}`);
  });

  // Applied migrations
  mockSqlAll.mockResolvedValue(applied.map((name) => ({ name })));

  // Batch execution
  mockSqlBatch.mockResolvedValue(undefined);

  // access for down migration lookup
  mockAccess.mockRejectedValue(new Error("ENOENT"));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("migrationRunner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── computeChecksum ──────────────────────────────────────────────────────

  describe("computeChecksum", () => {
    test("returns consistent SHA-256 hex digest", () => {
      const hash = computeChecksum("hello world");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(computeChecksum("hello world"));
    });

    test("returns different hashes for different content", () => {
      const hash1 = computeChecksum("aaa");
      const hash2 = computeChecksum("bbb");
      expect(hash1).not.toBe(hash2);
    });
  });

  // ── runMigrations ────────────────────────────────────────────────────────

  describe("runMigrations", () => {
    test("applies all pending migrations", async () => {
      setupDefaultMocks();

      const result = await runMigrations();

      expect(result.applied).toEqual(["001_create_users.sql", "002_add_email.sql"]);
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(mockSqlBatch).toHaveBeenCalledTimes(2);
    });

    test("skips already-applied migrations", async () => {
      setupDefaultMocks({ applied: ["001_create_users.sql"] });

      const result = await runMigrations();

      expect(result.applied).toEqual(["002_add_email.sql"]);
      expect(result.skipped).toEqual(["001_create_users.sql"]);
      expect(result.failed).toEqual([]);
      expect(mockSqlBatch).toHaveBeenCalledTimes(1);
    });

    test("skips all when everything is already applied", async () => {
      setupDefaultMocks({ applied: ["001_create_users.sql", "002_add_email.sql"] });

      const result = await runMigrations();

      expect(result.applied).toEqual([]);
      expect(result.skipped).toEqual(["001_create_users.sql", "002_add_email.sql"]);
      expect(result.failed).toEqual([]);
      expect(mockSqlBatch).not.toHaveBeenCalled();
    });

    test("records failure when a migration SQL fails", async () => {
      setupDefaultMocks();
      mockSqlBatch
        .mockResolvedValueOnce(undefined) // first migration succeeds
        .mockRejectedValueOnce(new Error("syntax error near BAD")); // second fails

      const result = await runMigrations();

      expect(result.applied).toEqual(["001_create_users.sql"]);
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([{ name: "002_add_email.sql", error: "syntax error near BAD" }]);
    });

    test("continues processing after a failure", async () => {
      setupDefaultMocks();
      // Add a third migration
      mockReaddir.mockResolvedValue(["001_create_users.sql", "002_add_email.sql", "003_final.sql"]);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes("001")) return MIGRATION_CONTENT_V1;
        if (filePath.includes("002")) return MIGRATION_CONTENT_V2;
        if (filePath.includes("003")) return "CREATE TABLE final (id INT);";
        throw new Error("Unexpected path");
      });
      mockSqlBatch
        .mockResolvedValueOnce(undefined) // 001 succeeds
        .mockRejectedValueOnce(new Error("fail")) // 002 fails
        .mockResolvedValueOnce(undefined); // 003 succeeds

      const result = await runMigrations();

      expect(result.applied).toEqual(["001_create_users.sql", "003_final.sql"]);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].name).toBe("002_add_email.sql");
    });

    test("handles empty migrations directory", async () => {
      mockSqlRun.mockResolvedValue({ rowsAffected: 0 });
      mockReaddir.mockResolvedValue([]);
      mockSqlAll.mockResolvedValue([]);

      const result = await runMigrations();

      expect(result.applied).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    test("ignores non-numeric-prefixed files", async () => {
      mockSqlRun.mockResolvedValue({ rowsAffected: 0 });
      mockReaddir.mockResolvedValue([
        "001_valid.sql",
        "meta_journal.json",
        "readme.md",
        "no_prefix.sql",
      ]);
      mockSqlAll.mockResolvedValue([]);
      mockReadFile.mockResolvedValue("SELECT 1;");
      mockSqlBatch.mockResolvedValue(undefined);

      const result = await runMigrations();

      expect(result.applied).toEqual(["001_valid.sql"]);
    });

    test("ignores .down.sql files in forward run", async () => {
      mockSqlRun.mockResolvedValue({ rowsAffected: 0 });
      mockReaddir.mockResolvedValue(["001_schema.sql", "001_schema.down.sql"]);
      mockSqlAll.mockResolvedValue([]);
      mockReadFile.mockResolvedValue("SELECT 1;");
      mockSqlBatch.mockResolvedValue(undefined);

      const result = await runMigrations();

      expect(result.applied).toEqual(["001_schema.sql"]);
      expect(mockSqlBatch).toHaveBeenCalledTimes(1);
    });

    test("creates migrations table before running", async () => {
      setupDefaultMocks();

      await runMigrations();

      // First call should be CREATE TABLE IF NOT EXISTS
      expect(mockSqlRun.mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS migrations");
    });
  });

  // ── getMigrationStatus ───────────────────────────────────────────────────

  describe("getMigrationStatus", () => {
    test("returns all migrations with applied=false when none applied", async () => {
      setupDefaultMocks();

      const status = await getMigrationStatus();

      expect(status).toHaveLength(2);
      expect(status[0].name).toBe("001_create_users.sql");
      expect(status[0].applied).toBe(false);
      expect(status[0].id).toBe(-1);
      expect(status[1].applied).toBe(false);
    });

    test("returns correct status for applied and pending migrations", async () => {
      setupDefaultMocks({ applied: ["001_create_users.sql"] });
      const now = new Date().toISOString();
      const checksum = computeChecksum(MIGRATION_CONTENT_V1);
      mockSqlAll.mockResolvedValue([
        { id: 1, name: "001_create_users.sql", applied_at: now, checksum },
      ]);

      const status = await getMigrationStatus();

      expect(status).toHaveLength(2);
      expect(status[0]).toEqual({
        id: 1,
        name: "001_create_users.sql",
        applied_at: now,
        checksum,
        applied: true,
      });
      expect(status[1]).toEqual({
        id: -1,
        name: "002_add_email.sql",
        applied_at: "",
        checksum: "",
        applied: false,
      });
    });

    test("returns empty array when no migration files exist", async () => {
      mockSqlRun.mockResolvedValue({ rowsAffected: 0 });
      mockReaddir.mockResolvedValue([]);
      mockSqlAll.mockResolvedValue([]);

      const status = await getMigrationStatus();

      expect(status).toEqual([]);
    });
  });

  // ── rollbackMigration ────────────────────────────────────────────────────

  describe("rollbackMigration", () => {
    test("throws when migration is not applied", async () => {
      mockSqlRun.mockResolvedValue({ rowsAffected: 0 });
      mockSqlGet.mockResolvedValue(undefined);

      await expect(rollbackMigration("999_nonexistent.sql")).rejects.toThrow(
        'Migration "999_nonexistent.sql" is not applied',
      );
    });

    test("throws when no down migration file exists", async () => {
      mockSqlRun.mockResolvedValue({ rowsAffected: 0 });
      mockSqlGet.mockResolvedValue({ id: 1, name: "001_create_users.sql", checksum: "abc" });
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      await expect(rollbackMigration("001_create_users.sql")).rejects.toThrow(
        "No rollback file found",
      );
    });

    test("executes down migration and removes record", async () => {
      mockSqlRun.mockResolvedValue({ rowsAffected: 0 });
      mockSqlGet.mockResolvedValue({ id: 1, name: "001_create_users.sql", checksum: "abc" });
      mockAccess.mockResolvedValue(undefined); // file exists
      mockReadFile.mockResolvedValue(DOWN_CONTENT);
      mockSqlBatch.mockResolvedValue(undefined);

      await rollbackMigration("001_create_users.sql");

      expect(mockSqlBatch).toHaveBeenCalledTimes(1);
      const batchArgs = mockSqlBatch.mock.calls[0][0];
      expect(batchArgs[0].sql).toBe(DOWN_CONTENT);
      expect(batchArgs[1].sql).toContain("DELETE FROM migrations");
      expect(batchArgs[1].args).toEqual(["001_create_users.sql"]);
    });
  });

  // ── discoverMigrationFiles ───────────────────────────────────────────────

  describe("discoverMigrationFiles", () => {
    test("sorts files by numeric prefix", async () => {
      mockReaddir.mockResolvedValue(["003_c.sql", "001_a.sql", "002_b.sql"]);

      const files = await discoverMigrationFiles("up");

      expect(files.map((f) => f.name)).toEqual(["001_a.sql", "002_b.sql", "003_c.sql"]);
    });

    test("returns empty array when directory does not exist", async () => {
      mockReaddir.mockRejectedValue(new Error("ENOENT"));

      const files = await discoverMigrationFiles("up");

      expect(files).toEqual([]);
    });

    test("discovers only .down.sql files in down mode", async () => {
      mockReaddir.mockResolvedValue(["001_schema.sql", "001_schema.down.sql", "002_more.sql"]);

      const files = await discoverMigrationFiles("down");

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe("001_schema.down.sql");
    });
  });
});
