/** @jest-environment node */

/**
 * Unit tests for the A/B Testing Service.
 *
 * Mocks the @libsql/client layer (src/server/libsqlDb) with in-memory
 * tables so tests run without a real SQLite database.
 */

/* ------------------------------------------------------------------ */
/*  In-memory mock tables                                              */
/* ------------------------------------------------------------------ */

const experiments: Record<string, unknown>[] = [];
const assignments: Record<string, unknown>[] = [];
const outcomes: Record<string, unknown>[] = [];

function resetTables(): void {
  experiments.length = 0;
  assignments.length = 0;
  outcomes.length = 0;
}

jest.mock("../src/server/libsqlDb", () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // Experiment queries
    if (sql.includes("FROM ab_experiments") && sql.includes("ORDER BY")) {
      return [...experiments].sort(
        (a, b) => (a.created_at as string).localeCompare(b.created_at as string),
      );
    }
    if (sql.includes("FROM ab_experiments") && sql.includes("WHERE id")) {
      const id = args[0];
      return experiments.filter((e) => e.id === id);
    }

    // Assignment count per variant
    if (sql.includes("COUNT(*)") && sql.includes("ab_assignments")) {
      const expId = args[0];
      const grouped: Record<string, number> = {};
      for (const a of assignments) {
        if (a.experiment_id === expId) {
          const vid = a.variant_id as string;
          grouped[vid] = (grouped[vid] ?? 0) + 1;
        }
      }
      return Object.entries(grouped).map(([variant_id, cnt]) => ({
        variant_id,
        cnt,
      }));
    }

    // Outcome count per variant+outcome
    if (sql.includes("COUNT(*)") && sql.includes("ab_outcomes")) {
      const expId = args[0];
      const grouped: Record<string, Record<string, number>> = {};
      for (const o of outcomes) {
        if (o.experiment_id === expId) {
          const vid = o.variant_id as string;
          const out = o.outcome as string;
          if (!grouped[vid]) grouped[vid] = {};
          grouped[vid][out] = (grouped[vid][out] ?? 0) + 1;
        }
      }
      const rows: Record<string, unknown>[] = [];
      for (const [vid, breakdown] of Object.entries(grouped)) {
        for (const [out, cnt] of Object.entries(breakdown)) {
          rows.push({ variant_id: vid, outcome: out, cnt });
        }
      }
      return rows;
    }

    return [];
  }),

  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes("FROM ab_experiments") && sql.includes("WHERE id")) {
      const id = args[0];
      return experiments.find((e) => e.id === id) ?? undefined;
    }
    if (sql.includes("FROM ab_assignments")) {
      const expId = args[0];
      const userId = args[1];
      return (
        assignments.find(
          (a) => a.experiment_id === expId && a.user_id === userId,
        ) ?? undefined
      );
    }
    return undefined;
  }),

  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith("INSERT INTO ab_experiments")) {
      experiments.push({
        id: args[0],
        name: args[1],
        status: args[2],
        variants: args[3],
        created_at: args[4],
      });
      return { rowsAffected: 1 };
    }
    if (sql.startsWith("INSERT INTO ab_assignments")) {
      assignments.push({
        experiment_id: args[0],
        user_id: args[1],
        variant_id: args[2],
        assigned_at: args[3],
      });
      return { rowsAffected: 1 };
    }
    if (sql.startsWith("INSERT INTO ab_outcomes")) {
      outcomes.push({
        experiment_id: args[0],
        user_id: args[1],
        variant_id: args[2],
        outcome: args[3],
        recorded_at: args[4],
      });
      return { rowsAffected: 1 };
    }
    return { rowsAffected: 0 };
  }),

  sqlBatch: jest.fn(async () => {
    // Schema creation — no-op in tests
  }),
}));

/* ------------------------------------------------------------------ */
/*  Imports (after mock)                                               */
/* ------------------------------------------------------------------ */

import {
  createExperiment,
  assignVariant,
  recordOutcome,
  getResults,
  listExperiments,
} from "../src/services/abtesting/abTestService";

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("abTestService", () => {
  beforeEach(() => {
    resetTables();
  });

  /* ---- createExperiment ---- */

  it("creates an experiment and returns a UUID", async () => {
    const id = await createExperiment("checkout-button", [
      { id: "control", weight: 50 },
      { id: "variant-a", weight: 50 },
    ]);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("persists experiment with correct fields", async () => {
    const id = await createExperiment("hero-banner", [
      { id: "blue", weight: 30 },
      { id: "red", weight: 70 },
    ]);
    const results = await getResults(id);
    expect(results.experiment.name).toBe("hero-banner");
    expect(results.experiment.status).toBe("active");
    expect(results.experiment.variants).toHaveLength(2);
  });

  it("rejects empty name", async () => {
    await expect(
      createExperiment("", [{ id: "a", weight: 1 }]),
    ).rejects.toThrow("Experiment name and at least one variant are required.");
  });

  it("rejects empty variants array", async () => {
    await expect(createExperiment("test", [])).rejects.toThrow(
      "Experiment name and at least one variant are required.",
    );
  });

  it("rejects non-positive weight", async () => {
    await expect(
      createExperiment("test", [{ id: "a", weight: 0 }]),
    ).rejects.toThrow('Variant "a" must have a positive weight.');
  });

  /* ---- assignVariant ---- */

  it("assigns a user to a variant deterministically", async () => {
    const expId = await createExperiment("pricing", [
      { id: "control", weight: 50 },
      { id: "discount", weight: 50 },
    ]);

    const first = await assignVariant(expId, "user-1");
    expect(first.is_new).toBe(true);
    expect(["control", "discount"]).toContain(first.variant_id);
  });

  it("returns the same variant on repeated assignment", async () => {
    const expId = await createExperiment("pricing", [
      { id: "control", weight: 50 },
      { id: "discount", weight: 50 },
    ]);

    const first = await assignVariant(expId, "user-42");
    const second = await assignVariant(expId, "user-42");
    expect(second.variant_id).toBe(first.variant_id);
    expect(second.is_new).toBe(false);
  });

  it("throws for non-existent experiment", async () => {
    await expect(assignVariant("nope", "user-1")).rejects.toThrow(
      'Experiment "nope" not found.',
    );
  });

  /* ---- recordOutcome ---- */

  it("records an outcome after assignment", async () => {
    const expId = await createExperiment("funnel", [
      { id: "step-a", weight: 100 },
    ]);
    await assignVariant(expId, "user-7");
    await recordOutcome(expId, "user-7", "converted");

    const results = await getResults(expId);
    expect(results.totalOutcomes).toBe(1);
    expect(results.variants[0].outcomeBreakdown).toEqual({ converted: 1 });
  });

  it("rejects outcome without prior assignment", async () => {
    const expId = await createExperiment("funnel", [
      { id: "step-a", weight: 100 },
    ]);
    await expect(
      recordOutcome(expId, "ghost-user", "clicked"),
    ).rejects.toThrow("is not assigned to experiment");
  });

  /* ---- getResults ---- */

  it("aggregates assignments and outcomes across multiple users", async () => {
    const expId = await createExperiment("button-color", [
      { id: "green", weight: 50 },
      { id: "orange", weight: 50 },
    ]);

    // Assign 4 users
    for (let i = 1; i <= 4; i++) {
      await assignVariant(expId, `user-${i}`);
    }

    // Record outcomes for user-1 and user-2
    const a1 = await assignVariant(expId, "user-1");
    await recordOutcome(expId, "user-1", "clicked");
    const a2 = await assignVariant(expId, "user-2");
    await recordOutcome(expId, "user-2", "clicked");
    await recordOutcome(expId, "user-2", "purchased");

    const results = await getResults(expId);
    expect(results.totalAssignments).toBe(4);
    expect(results.totalOutcomes).toBe(3);

    // Verify per-variant counts
    const greenResult = results.variants.find((v) => v.variant_id === "green");
    const orangeResult = results.variants.find(
      (v) => v.variant_id === "orange",
    );
    expect(greenResult).toBeDefined();
    expect(orangeResult).toBeDefined();
    // Total assignments across both variants should be 4
    expect(
      (greenResult!.assignments) + (orangeResult!.assignments),
    ).toBe(4);
  });

  it("returns zero counts for a fresh experiment", async () => {
    const expId = await createExperiment("empty", [
      { id: "a", weight: 10 },
      { id: "b", weight: 90 },
    ]);

    const results = await getResults(expId);
    expect(results.totalAssignments).toBe(0);
    expect(results.totalOutcomes).toBe(0);
    expect(results.variants[0].assignments).toBe(0);
    expect(results.variants[0].outcomes).toBe(0);
  });

  it("throws for non-existent experiment results", async () => {
    await expect(getResults("nonexistent")).rejects.toThrow(
      'Experiment "nonexistent" not found.',
    );
  });

  /* ---- listExperiments ---- */

  it("lists all created experiments", async () => {
    await createExperiment("exp-1", [{ id: "a", weight: 1 }]);
    await createExperiment("exp-2", [{ id: "b", weight: 1 }]);
    await createExperiment("exp-3", [{ id: "c", weight: 1 }]);

    const list = await listExperiments();
    expect(list).toHaveLength(3);
    expect(list.map((e) => e.name)).toEqual(
      expect.arrayContaining(["exp-1", "exp-2", "exp-3"]),
    );
  });

  it("returns empty array when no experiments exist", async () => {
    const list = await listExperiments();
    expect(list).toEqual([]);
  });
});
