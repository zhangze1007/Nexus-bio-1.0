/**
 * Persistent rate limiter using Upstash Redis with in-memory fallback.
 *
 * Uses a sliding window algorithm implemented via Redis sorted sets.
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set,
 * falls back to an in-memory Map so local development works without Redis.
 *
 * Environment variables:
 *   UPSTASH_REDIS_REST_URL   — Upstash Redis REST URL
 *   UPSTASH_REDIS_REST_TOKEN — Upstash Redis REST token
 */

// ── Minimal Redis interface for type safety ───────────────────────────

interface RedisPipeline {
  zremrangebyscore(key: string, min: number, max: number): void;
  zcard(key: string): void;
  zadd(key: string, payload: { score: number; member: string }): void;
  expire(key: string, seconds: number): void;
  exec(): Promise<unknown[]>;
}

interface RedisLike {
  pipeline(): RedisPipeline;
  zrem(key: string, member: string): Promise<unknown>;
  zrange(key: string, start: number, end: number, opts?: { withScores: boolean }): Promise<unknown[]>;
}

type RedisConstructor = new (config: { url: string; token: string }) => RedisLike;

// Dynamic import to avoid Edge Runtime issues with @upstash/redis
let Redis: RedisConstructor | null = null;

// ── Types ───────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

// ── Rate limit tiers (same as the original middleware config) ────────────

export function getRateLimitConfig(path: string): RateLimitConfig {
  if (path.startsWith("/api/analyze") || path.startsWith("/api/gemini")) {
    return { limit: 10, windowMs: 60_000 }; // 10 req/min for AI
  }
  if (path.startsWith("/api/fba")) {
    return { limit: 20, windowMs: 60_000 }; // 20 req/min for compute
  }
  if (path.startsWith("/api/alphafold") || path.startsWith("/api/pubchem") || path.startsWith("/api/kegg")) {
    return { limit: 30, windowMs: 60_000 }; // 30 req/min for external API proxies
  }
  return { limit: 60, windowMs: 60_000 }; // 60 req/min default
}

// ── Redis client (lazy singleton) ───────────────────────────────────────

let redisClient: RedisLike | null = null;
let redisInitialized = false;

async function getRedis(): Promise<RedisLike | null> {
  if (redisInitialized) return redisClient;

  redisInitialized = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    // Dynamic import to avoid Edge Runtime issues
    const { Redis: RedisClass } = await import("@upstash/redis");
    Redis = RedisClass as unknown as RedisConstructor;
    redisClient = new RedisClass({ url, token }) as unknown as RedisLike;
  }

  return redisClient;
}

// ── In-memory fallback ──────────────────────────────────────────────────

interface MemoryEntry {
  timestamps: number[];
}

const memoryStore = new Map<string, MemoryEntry>();

// Warn once in production if Upstash is not configured
let warnedMissingRedis = false;
function warnMissingRedis(): void {
  if (warnedMissingRedis) return;
  warnedMissingRedis = true;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL not set — using per-instance in-memory fallback. " +
        "Rate limiting will NOT work correctly across Vercel serverless instances. " +
        "Set Upstash Redis env vars for production: https://upstash.com/docs/redis/overall/getstarted",
    );
  }
}

// Periodic cleanup of stale entries (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
      if (entry.timestamps.length === 0) memoryStore.delete(key);
    }
  }, 300_000);
}

function checkRateLimitMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  let entry = memoryStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    memoryStore.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0];
    const resetMs = windowMs - (now - oldestInWindow);
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: limit - entry.timestamps.length, resetMs: windowMs };
}

// ── Redis sliding window ────────────────────────────────────────────────

async function checkRateLimitRedis(
  redis: RedisLike,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Use a Redis pipeline for atomicity
  const pipe = redis.pipeline();

  // Remove expired entries
  pipe.zremrangebyscore(key, 0, windowStart);

  // Count current entries in window
  pipe.zcard(key);

  // Add the current request timestamp (use timestamp as both member and score)
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;
  pipe.zadd(key, { score: now, member });

  // Set TTL so keys auto-expire (window + 10s buffer)
  pipe.expire(key, Math.ceil(windowMs / 1000) + 10);

  const results = await pipe.exec();
  // zcard result is at index 1
  const currentCount = (results[1] as number) ?? 0;

  // We already added the new entry, so check against limit
  // currentCount is the count BEFORE the new entry was added
  if (currentCount >= limit) {
    // Over limit — remove the entry we just added
    await redis.zrem(key, member);
    // Get the oldest entry to compute reset time
    const oldest = await redis.zrange(key, 0, 0, { withScores: true });
    const oldestScore = oldest.length > 0 ? (oldest[0] as { score: number }).score : now;
    const resetMs = windowMs - (now - oldestScore);
    return { allowed: false, remaining: 0, resetMs: Math.max(resetMs, 0) };
  }

  return { allowed: true, remaining: limit - currentCount - 1, resetMs: windowMs };
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Check rate limit for a given IP and path.
 *
 * Uses Upstash Redis when configured, falls back to in-memory storage.
 * Returns `{ allowed, remaining, resetMs }`.
 */
export async function checkRateLimit(ip: string, path: string): Promise<RateLimitResult> {
  const { limit, windowMs } = getRateLimitConfig(path);
  const normalizedPath = path.split("/").slice(0, 3).join("/");
  const key = `rl:${ip}:${normalizedPath}`;

  const redis = await getRedis();
  if (redis) {
    try {
      return await checkRateLimitRedis(redis, key, limit, windowMs);
    } catch {
      // If Redis fails, fall back to in-memory
      warnMissingRedis();
      return checkRateLimitMemory(key, limit, windowMs);
    }
  }

  warnMissingRedis();
  return checkRateLimitMemory(key, limit, windowMs);
}

/**
 * Synchronous wrapper for middleware compatibility.
 *
 * In Edge Runtime middleware, the rate limiter must be awaited.
 * This function is kept for backward compatibility with code that
 * may need the synchronous in-memory path only.
 */
export function checkRateLimitSync(ip: string, path: string): RateLimitResult {
  const { limit, windowMs } = getRateLimitConfig(path);
  const normalizedPath = path.split("/").slice(0, 3).join("/");
  const key = `rl:${ip}:${normalizedPath}`;
  return checkRateLimitMemory(key, limit, windowMs);
}
