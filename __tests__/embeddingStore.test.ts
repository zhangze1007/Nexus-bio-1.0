/**
 * Embedding Store Tests
 *
 * Tests the local in-memory fallback path for the vector embeddings service.
 * Upstash integration tests require real credentials and are excluded here;
 * the local path exercises the same code paths (cosine similarity, upsert,
 * query, delete) without external dependencies.
 */

import {
  cosineSimilarity,
  generateLocalEmbedding,
  upsertEmbedding,
  queryEmbedding,
  deleteEmbedding,
  clearLocalStore,
  getStoreStats,
  getLocalVectorCount,
} from "../src/services/ai/embeddingStore";

// Force local fallback — no Upstash credentials in test env
beforeEach(() => {
  clearLocalStore();
});

// ---------------------------------------------------------------------------
// generateLocalEmbedding
// ---------------------------------------------------------------------------

describe("generateLocalEmbedding", () => {
  test("produces a 128-dimensional vector", () => {
    const vec = generateLocalEmbedding("hello world");
    expect(vec).toHaveLength(128);
  });

  test("is deterministic — same input yields same output", () => {
    const a = generateLocalEmbedding("ATGCATGC");
    const b = generateLocalEmbedding("ATGCATGC");
    expect(a).toEqual(b);
  });

  test("produces different vectors for different inputs", () => {
    const a = generateLocalEmbedding("artemisinin biosynthesis");
    const b = generateLocalEmbedding("flux balance analysis");
    expect(a).not.toEqual(b);
  });

  test("produces L2-normalized vectors", () => {
    const vec = generateLocalEmbedding("test normalization");
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 10);
  });
});

// ---------------------------------------------------------------------------
// cosineSimilarity
// ---------------------------------------------------------------------------

describe("cosineSimilarity", () => {
  test("returns 1 for identical vectors", () => {
    const vec = [0.1, 0.3, 0.5, 0.7, 0.9];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 10);
  });

  test("returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
  });

  test("returns negative value for opposite vectors", () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10);
  });

  test("throws on dimension mismatch", () => {
    const a = [1, 0, 0];
    const b = [1, 0];
    expect(() => cosineSimilarity(a, b)).toThrow(/dimension mismatch/i);
  });

  test("returns 0 when one vector is zero", () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// upsertEmbedding / queryEmbedding / deleteEmbedding (local fallback)
// ---------------------------------------------------------------------------

describe("local store operations", () => {
  test("upsert + query returns the stored embedding", async () => {
    await upsertEmbedding("doc-1", "synthetic biology pathway design", {
      source: "paper",
    });

    const results = await queryEmbedding("synthetic biology pathway design");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("doc-1");
    expect(results[0].metadata.source).toBe("paper");
  });

  test("query returns empty array for empty store", async () => {
    const results = await queryEmbedding("anything");
    expect(results).toEqual([]);
  });

  test("query results are sorted by descending score", async () => {
    await upsertEmbedding("close", "metabolic engineering pathway optimization");
    await upsertEmbedding("far", "quantum computing entanglement");

    const results = await queryEmbedding("metabolic engineering pathway");
    expect(results.length).toBe(2);

    // The "close" document should score higher than "far"
    const closeIdx = results.findIndex((r) => r.id === "close");
    const farIdx = results.findIndex((r) => r.id === "far");
    expect(closeIdx).toBeLessThan(farIdx);
    expect(results[closeIdx].score).toBeGreaterThan(results[farIdx].score);
  });

  test("deleteEmbedding removes the embedding", async () => {
    await upsertEmbedding("to-delete", "temporary entry");
    expect(getLocalVectorCount()).toBe(1);

    const deleted = await deleteEmbedding("to-delete");
    expect(deleted).toBe(true);
    expect(getLocalVectorCount()).toBe(0);

    const results = await queryEmbedding("temporary entry");
    expect(results).toEqual([]);
  });

  test("deleteEmbedding returns false for non-existent ID", async () => {
    const deleted = await deleteEmbedding("does-not-exist");
    expect(deleted).toBe(false);
  });

  test("upsert with same ID overwrites previous embedding", async () => {
    await upsertEmbedding("dup", "first version", { version: 1 });
    await upsertEmbedding("dup", "second version updated", { version: 2 });

    expect(getLocalVectorCount()).toBe(1);

    const results = await queryEmbedding("second version updated");
    expect(results[0].id).toBe("dup");
    expect(results[0].metadata.version).toBe(2);
  });

  test("queryEmbedding respects topK parameter", async () => {
    for (let i = 0; i < 10; i++) {
      await upsertEmbedding(`doc-${i}`, `document number ${i} about biology`);
    }

    const results = await queryEmbedding("biology", 3);
    expect(results.length).toBe(3);
  });

  test("metadata is preserved through upsert and query", async () => {
    await upsertEmbedding("meta-test", "CRISPR gene editing", {
      tags: ["crispr", "gene-editing"],
      tool: "pathd",
      createdAt: "2026-06-26",
    });

    const results = await queryEmbedding("CRISPR gene editing");
    expect(results[0].metadata.tags).toEqual(["crispr", "gene-editing"]);
    expect(results[0].metadata.tool).toBe("pathd");
    expect(results[0].metadata.createdAt).toBe("2026-06-26");
  });

  test("original text is available in query results (local fallback)", async () => {
    await upsertEmbedding("text-check", "this is the original text");
    const results = await queryEmbedding("this is the original text");
    expect(results[0].text).toBe("this is the original text");
  });
});

// ---------------------------------------------------------------------------
// getStoreStats
// ---------------------------------------------------------------------------

describe("getStoreStats", () => {
  test("reports local backend when Upstash is not configured", () => {
    const stats = getStoreStats();
    expect(stats.backend).toBe("local");
  });

  test("reports correct vector count", async () => {
    await upsertEmbedding("a", "alpha");
    await upsertEmbedding("b", "beta");

    const stats = getStoreStats();
    expect(stats.vectorCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// clearLocalStore
// ---------------------------------------------------------------------------

describe("clearLocalStore", () => {
  test("empties the store", async () => {
    await upsertEmbedding("x", "one");
    await upsertEmbedding("y", "two");
    expect(getLocalVectorCount()).toBe(2);

    clearLocalStore();
    expect(getLocalVectorCount()).toBe(0);
  });
});
