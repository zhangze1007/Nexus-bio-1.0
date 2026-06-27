/**
 * Tests for AI Response Cache (src/services/ai/responseCache.ts).
 *
 * Uses a real libSQL in-memory/file database (same pattern as libsqlDb.test.ts).
 * Each test starts with a clean table via clearCache().
 */

import {
  generateCacheKey,
  getCachedResponse,
  setCachedResponse,
  clearCache,
  pruneExpired,
  cacheSize,
  _resetSchemaEnsured,
} from "../src/services/ai/responseCache";
import { sqlRun, closeLibsqlClient } from "../src/server/libsqlDb";

beforeAll(async () => {
  // Drop table to start fresh (ignore error if table doesn't exist)
  await sqlRun("DROP TABLE IF EXISTS ai_cache").catch(() => {});
  _resetSchemaEnsured();
});

afterEach(async () => {
  await clearCache();
});

afterAll(async () => {
  await sqlRun("DROP TABLE IF EXISTS ai_cache").catch(() => {});
  closeLibsqlClient();
});

// ── generateCacheKey ──

describe("generateCacheKey", () => {
  test("returns a 64-char hex SHA-256 digest", () => {
    const key = generateCacheKey("hello", "model-a");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  test("deterministic — same inputs produce identical keys", () => {
    const a = generateCacheKey("prompt", "gpt-4", { temp: 0.7 });
    const b = generateCacheKey("prompt", "gpt-4", { temp: 0.7 });
    expect(a).toBe(b);
  });

  test("different prompts produce different keys", () => {
    const a = generateCacheKey("prompt A", "model");
    const b = generateCacheKey("prompt B", "model");
    expect(a).not.toBe(b);
  });

  test("different models produce different keys", () => {
    const a = generateCacheKey("same prompt", "groq");
    const b = generateCacheKey("same prompt", "gemini");
    expect(a).not.toBe(b);
  });

  test("param key order is canonicalised (sorted)", () => {
    const a = generateCacheKey("p", "m", { b: 2, a: 1 });
    const b = generateCacheKey("p", "m", { a: 1, b: 2 });
    expect(a).toBe(b);
  });

  test("leading/trailing whitespace in prompt is trimmed", () => {
    const a = generateCacheKey("  hello  ", "m");
    const b = generateCacheKey("hello", "m");
    expect(a).toBe(b);
  });
});

// ── setCachedResponse / getCachedResponse ──

describe("setCachedResponse and getCachedResponse", () => {
  test("round-trips a cached response", async () => {
    const key = generateCacheKey("q1", "model-1");
    await setCachedResponse(key, "answer-1", 300, "model-1", 42);

    const cached = await getCachedResponse(key);
    expect(cached).not.toBeNull();
    expect(cached!.response).toBe("answer-1");
    expect(cached!.model).toBe("model-1");
    expect(cached!.tokensUsed).toBe(42);
    expect(cached!.cacheKey).toBe(key);
  });

  test("returns null for a cache miss", async () => {
    const cached = await getCachedResponse("nonexistent-key");
    expect(cached).toBeNull();
  });

  test("returns null for an expired entry", async () => {
    const key = generateCacheKey("ttl-test", "m");
    // Set TTL of 1 second
    await setCachedResponse(key, "short-lived", 1, "m");
    // Wait for it to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const cached = await getCachedResponse(key);
    expect(cached).toBeNull();
  });

  test("overwrites an existing entry with the same key (upsert)", async () => {
    const key = generateCacheKey("overwrite", "m");
    await setCachedResponse(key, "first", 300, "m", 10);
    await setCachedResponse(key, "second", 300, "m", 20);

    const cached = await getCachedResponse(key);
    expect(cached).not.toBeNull();
    expect(cached!.response).toBe("second");
    expect(cached!.tokensUsed).toBe(20);
  });

  test("defaults model to 'unknown' and tokensUsed to 0 when omitted", async () => {
    const key = generateCacheKey("defaults", "m");
    await setCachedResponse(key, "data", 300);

    const cached = await getCachedResponse(key);
    expect(cached!.model).toBe("unknown");
    expect(cached!.tokensUsed).toBe(0);
  });
});

// ── clearCache ──

describe("clearCache", () => {
  test("removes all entries and returns the count", async () => {
    await setCachedResponse("k1", "r1", 300);
    await setCachedResponse("k2", "r2", 300);
    await setCachedResponse("k3", "r3", 300);

    const removed = await clearCache();
    expect(removed).toBeGreaterThanOrEqual(3);

    const size = await cacheSize();
    expect(size).toBe(0);
  });

  test("returns 0 when cache is already empty", async () => {
    await clearCache();
    const removed = await clearCache();
    expect(removed).toBe(0);
  });
});

// ── pruneExpired ──

describe("pruneExpired", () => {
  test("removes only expired entries", async () => {
    const liveKey = "prune-live";
    const deadKey = "prune-dead";

    // Live entry: 1 hour TTL
    await setCachedResponse(liveKey, "alive", 3600);
    // Dead entry: 1 second TTL
    await setCachedResponse(deadKey, "dead", 1);

    // Wait for the short-lived entry to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const pruned = await pruneExpired();
    expect(pruned).toBe(1);

    // Live entry should still be there
    const live = await getCachedResponse(liveKey);
    expect(live).not.toBeNull();

    // Dead entry should be gone
    const dead = await getCachedResponse(deadKey);
    expect(dead).toBeNull();
  });
});

// ── cacheSize ──

describe("cacheSize", () => {
  test("returns the count of non-expired entries", async () => {
    await clearCache();
    await setCachedResponse("sz1", "r", 300);
    await setCachedResponse("sz2", "r", 300);
    await setCachedResponse("sz3", "r", 300);

    const size = await cacheSize();
    expect(size).toBe(3);
  });

  test("excludes expired entries from count", async () => {
    await clearCache();
    await setCachedResponse("sz-exp", "r", 1);
    await setCachedResponse("sz-live", "r", 300);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const size = await cacheSize();
    expect(size).toBe(1);
  });
});
