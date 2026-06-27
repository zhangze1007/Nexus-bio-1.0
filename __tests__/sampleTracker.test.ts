/** @jest-environment node */
/**
 * sampleTracker — unit tests for the lab sample tracking service.
 *
 * Tests cover CRUD operations, provenance event recording, search,
 * input validation, and error paths. Uses a local SQLite database
 * via the shared libsqlDb helpers.
 */

import {
  createSample,
  moveSample,
  getSampleHistory,
  searchSamples,
  ensureSampleTrackerSchema,
  type SampleType,
} from "../src/services/instruments/sampleTracker";
import { closeLibsqlClient, sqlRun } from "../src/server/libsqlDb";

// ─── Cleanup ─────────────────────────────────────────────────────

afterAll(() => {
  closeLibsqlClient();
});

describe("sampleTracker", () => {
  beforeAll(async () => {
    await ensureSampleTrackerSchema();
    // Remove any leftover test data
    await sqlRun("DELETE FROM sample_events WHERE sample_id IN (SELECT id FROM samples WHERE name LIKE 'TEST-%')");
    await sqlRun("DELETE FROM samples WHERE name LIKE 'TEST-%'");
  });

  afterEach(async () => {
    await sqlRun("DELETE FROM sample_events WHERE sample_id IN (SELECT id FROM samples WHERE name LIKE 'TEST-%')");
    await sqlRun("DELETE FROM samples WHERE name LIKE 'TEST-%'");
  });

  // ── createSample ──────────────────────────────────────────────────────────

  test("createSample returns a complete Sample record", async () => {
    const sample = await createSample("TEST-pET28a", "plasmid", "Freezer A, Rack 3");

    expect(sample.id).toBeDefined();
    expect(sample.name).toBe("TEST-pET28a");
    expect(sample.type).toBe("plasmid");
    expect(sample.location).toBe("Freezer A, Rack 3");
    expect(sample.status).toBe("active");
    expect(sample.created_at).toBeGreaterThan(0);
    expect(sample.updated_at).toBe(sample.created_at);
  });

  test("createSample automatically records a 'created' event", async () => {
    const sample = await createSample("TEST-Ecoli-DH5a", "strain", "Incubator B");

    const history = await getSampleHistory(sample.id);
    expect(history).toHaveLength(1);
    expect(history[0].event_type).toBe("created");
    expect(history[0].sample_id).toBe(sample.id);
    expect(history[0].details).toContain("TEST-Ecoli-DH5a");
    expect(history[0].details).toContain("Incubator B");
  });

  test("createSample accepts all five valid types", async () => {
    const types: SampleType[] = ["strain", "plasmid", "primer", "chemical", "media"];

    for (const t of types) {
      const sample = await createSample(`TEST-type-${t}`, t, "Shelf 1");
      expect(sample.type).toBe(t);
    }
  });

  test("createSample trims whitespace from name", async () => {
    const sample = await createSample("  TEST-spaced  ", "chemical", "Bench");
    expect(sample.name).toBe("TEST-spaced");
  });

  test("createSample rejects invalid type", async () => {
    await expect(
      createSample("TEST-bad", "virus" as SampleType, "Lab"),
    ).rejects.toThrow("Invalid sample type");
  });

  test("createSample rejects empty name", async () => {
    await expect(
      createSample("", "strain", "Lab"),
    ).rejects.toThrow("must not be empty");
  });

  // ── moveSample ────────────────────────────────────────────────────────────

  test("moveSample updates location and records a 'moved' event", async () => {
    const sample = await createSample("TEST-move-target", "primer", "-80C Freezer");

    await moveSample(sample.id, "4C Fridge, Shelf 2");

    // Verify the event was recorded
    const history = await getSampleHistory(sample.id);
    expect(history).toHaveLength(2); // created + moved
    const moveEvent = history[1];
    expect(moveEvent.event_type).toBe("moved");
    expect(moveEvent.details).toContain("-80C Freezer");
    expect(moveEvent.details).toContain("4C Fridge, Shelf 2");
  });

  test("moveSample throws for non-existent sample", async () => {
    await expect(
      moveSample("non-existent-id", "Nowhere"),
    ).rejects.toThrow("Sample not found");
  });

  // ── getSampleHistory ──────────────────────────────────────────────────────

  test("getSampleHistory returns events in chronological order", async () => {
    const sample = await createSample("TEST-chronology", "media", "Shelf A");
    await moveSample(sample.id, "Shelf B");
    await moveSample(sample.id, "Shelf C");

    const history = await getSampleHistory(sample.id);
    expect(history).toHaveLength(3);
    expect(history[0].event_type).toBe("created");
    expect(history[1].event_type).toBe("moved");
    expect(history[2].event_type).toBe("moved");

    // Verify ascending timestamps
    for (let i = 1; i < history.length; i++) {
      expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i - 1].timestamp);
    }
  });

  test("getSampleHistory throws for non-existent sample", async () => {
    await expect(
      getSampleHistory("ghost-sample-id"),
    ).rejects.toThrow("Sample not found");
  });

  // ── searchSamples ─────────────────────────────────────────────────────────

  test("searchSamples finds samples by name substring", async () => {
    await createSample("TEST-AmpR-plasmid", "plasmid", "Box 1");
    await createSample("TEST-KanR-plasmid", "plasmid", "Box 2");
    await createSample("TEST-LB-broth", "media", "Shelf 3");

    const results = await searchSamples("plasmid");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every((s) => s.name.includes("plasmid"))).toBe(true);
  });

  test("searchSamples filters by type when provided", async () => {
    await createSample("TEST-search-strain", "strain", "Rack 1");
    await createSample("TEST-search-chemical", "chemical", "Rack 2");

    const strainsOnly = await searchSamples("search", "strain");
    expect(strainsOnly.length).toBeGreaterThanOrEqual(1);
    expect(strainsOnly.every((s) => s.type === "strain")).toBe(true);
    expect(strainsOnly.some((s) => s.name.includes("TEST-search-strain"))).toBe(true);
  });

  test("searchSamples returns empty array for no matches", async () => {
    const results = await searchSamples("zzz_nonexistent_zzz_98765");
    expect(results).toEqual([]);
  });
});
