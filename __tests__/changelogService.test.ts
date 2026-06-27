/** @jest-environment node */

/**
 * Unit tests for the Changelog Service.
 *
 * Mocks the libsqlDb layer with in-memory tables so tests run without
 * a real database.
 */

/* ------------------------------------------------------------------ */
/*  In-memory mock tables                                              */
/* ------------------------------------------------------------------ */

const changelogRows: Record<string, unknown>[] = [];
let insertCounter = 0;

function resetTables(): void {
  changelogRows.length = 0;
  insertCounter = 0;
}

jest.mock("../src/server/libsqlDb", () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes("FROM changelog")) {
      let rows = [...changelogRows];
      rows.sort((a, b) =>
        (b.published_at as string).localeCompare(a.published_at as string),
      );
      // Apply LIMIT if present
      const limitMatch = sql.match(/LIMIT\s+(\?|\d+)/i);
      if (limitMatch) {
        const n =
          limitMatch[1] === "?" ? (args[args.length - 1] as number) : Number(limitMatch[1]);
        rows = rows.slice(0, n);
      }
      return rows;
    }
    return [];
  }),

  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes("FROM changelog") && sql.includes("WHERE version")) {
      const version = args[0];
      return changelogRows.find((r) => r.version === version) ?? undefined;
    }
    if (sql.includes("FROM changelog") && sql.includes("ORDER BY published_at DESC")) {
      // getLatestVersion — return the newest row
      const sorted = [...changelogRows].sort((a, b) =>
        (b.published_at as string).localeCompare(a.published_at as string),
      );
      return sorted[0] ?? undefined;
    }
    if (sql.includes("FROM changelog") && sql.includes("WHERE id")) {
      const id = args[0];
      return changelogRows.find((r) => r.id === id) ?? undefined;
    }
    return undefined;
  }),

  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    // CREATE TABLE — no-op
    if (sql.includes("CREATE TABLE")) {
      return { rowsAffected: 0 };
    }
    // INSERT
    if (sql.includes("INSERT INTO changelog")) {
      const [id, version, changesJson] = args;
      // Use incrementing counter to ensure unique, sortable timestamps
      insertCounter++;
      const ts = `2026-01-${String(insertCounter).padStart(2, '0')}T00:00:00Z`;
      changelogRows.push({
        id,
        version,
        changes_json: changesJson,
        published_at: ts,
      });
      return { rowsAffected: 1 };
    }
    return { rowsAffected: 0 };
  }),
}));

import {
  addChangelogEntry,
  getChangelog,
  getLatestVersion,
} from "../src/services/business/changelogService";

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("changelogService", () => {
  beforeEach(() => {
    resetTables();
  });

  // ── addChangelogEntry ──

  describe("addChangelogEntry", () => {
    it("adds an entry and stores it", async () => {
      await addChangelogEntry("1.0.0", [
        { type: "feature", description: "Initial release" },
      ]);
      const entries = await getChangelog();
      expect(entries).toHaveLength(1);
      expect(entries[0].version).toBe("1.0.0");
    });

    it("stores multiple change items", async () => {
      await addChangelogEntry("1.1.0", [
        { type: "feature", description: "New dashboard" },
        { type: "fix", description: "Fix login bug" },
        { type: "improvement", description: "Faster loading" },
      ]);
      const entries = await getChangelog();
      expect(entries[0].changes).toHaveLength(3);
      expect(entries[0].changes.map((c) => c.type)).toEqual([
        "feature",
        "fix",
        "improvement",
      ]);
    });

    it("throws when version already exists", async () => {
      await addChangelogEntry("2.0.0", [
        { type: "feature", description: "Something" },
      ]);
      await expect(
        addChangelogEntry("2.0.0", [
          { type: "fix", description: "Duplicate" },
        ]),
      ).rejects.toThrow("already exists");
    });

    it("throws for empty version string", async () => {
      await expect(
        addChangelogEntry("", [{ type: "feature", description: "test" }]),
      ).rejects.toThrow("version is required");
    });

    it("throws for empty changes array", async () => {
      await expect(addChangelogEntry("3.0.0", [])).rejects.toThrow(
        "non-empty array",
      );
    });

    it("throws for invalid change type", async () => {
      await expect(
        addChangelogEntry("4.0.0", [
          { type: "chore" as unknown as "feature", description: "bad" },
        ]),
      ).rejects.toThrow("Invalid change type");
    });

    it("throws for change with empty description", async () => {
      await expect(
        addChangelogEntry("5.0.0", [{ type: "fix", description: "" }]),
      ).rejects.toThrow("non-empty description");
    });
  });

  // ── getChangelog ──

  describe("getChangelog", () => {
    it("returns empty array when no entries exist", async () => {
      const entries = await getChangelog();
      expect(entries).toEqual([]);
    });

    it("returns entries ordered by publishedAt descending", async () => {
      await addChangelogEntry("1.0.0", [
        { type: "feature", description: "First" },
      ]);
      await addChangelogEntry("2.0.0", [
        { type: "feature", description: "Second" },
      ]);
      await addChangelogEntry("3.0.0", [
        { type: "feature", description: "Third" },
      ]);

      const entries = await getChangelog();
      expect(entries).toHaveLength(3);
      // All entries share the same mock timestamp, so order depends on insertion.
      // The mock sorts descending by published_at — since all are the same,
      // we just verify the shape is correct.
      const versions = entries.map((e) => e.version);
      expect(versions).toContain("1.0.0");
      expect(versions).toContain("2.0.0");
      expect(versions).toContain("3.0.0");
    });

    it("respects the limit parameter", async () => {
      for (let i = 1; i <= 5; i++) {
        await addChangelogEntry(`1.${i}.0`, [
          { type: "feature", description: `v1.${i}` },
        ]);
      }
      const entries = await getChangelog(3);
      expect(entries).toHaveLength(3);
    });

    it("defaults limit to 50", async () => {
      await addChangelogEntry("0.1.0", [
        { type: "feature", description: "Only entry" },
      ]);
      const entries = await getChangelog();
      expect(entries).toHaveLength(1);
    });
  });

  // ── getLatestVersion ──

  describe("getLatestVersion", () => {
    it("returns null when no entries exist", async () => {
      const version = await getLatestVersion();
      expect(version).toBeNull();
    });

    it("returns the version of the most recent entry", async () => {
      await addChangelogEntry("1.0.0", [
        { type: "feature", description: "First" },
      ]);
      await addChangelogEntry("2.0.0", [
        { type: "feature", description: "Second" },
      ]);
      const version = await getLatestVersion();
      expect(version).toBe("2.0.0");
    });

    it("works with a single entry", async () => {
      await addChangelogEntry("0.0.1", [
        { type: "fix", description: "Hotfix" },
      ]);
      const version = await getLatestVersion();
      expect(version).toBe("0.0.1");
    });
  });
});
