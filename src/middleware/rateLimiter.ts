/**
 * Sliding Window Rate Limiter
 *
 * Uses a sliding window algorithm backed by libsql for distributed
 * rate limiting across multiple server instances.
 *
 * Schema: rate_limit_entries (key TEXT, timestamp INTEGER)
 */

import { createClient, type Client } from "@libsql/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RateLimiterOptions {
  /** Maximum number of requests allowed in the window. */
  maxRequests: number;
  /** Window size in milliseconds. */
  windowMs: number;
  /** libsql connection URL (file: or libsql:). Defaults to "file::memory:". */
  url?: string;
  /** libsql auth token. */
  authToken?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Number of requests remaining in the current window. */
  remaining: number;
  /** Unix timestamp (ms) when the current window resets. */
  resetAt: number;
  /** Total limit for the window. */
  limit: number;
}

export interface RateLimiter {
  /** Check whether a request identified by `key` is allowed. */
  check(key: string): Promise<RateLimitResult>;
  /** Close the underlying database connection. */
  close(): Promise<void>;
}

// ─── Factory ────────────────────────────────────────────────────────────────

let _defaultClient: Client | null = null;

/**
 * Create a rate limiter instance with a sliding window algorithm.
 *
 * @param options  Configuration: maxRequests, windowMs, and optional libsql connection details.
 * @returns A RateLimiter with `check(key)` and `close()` methods.
 */
export async function createRateLimiter(
  options: RateLimiterOptions,
): Promise<RateLimiter> {
  const { maxRequests, windowMs, url, authToken } = options;

  const client = createClient({
    url: url ?? "file::memory:",
    authToken,
  });

  // Ensure the table exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS rate_limit_entries (
      key      TEXT    NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);

  // Index for efficient sliding-window lookups
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_rate_limit_key_ts
    ON rate_limit_entries (key, timestamp)
  `);

  return {
    async check(key: string): Promise<RateLimitResult> {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove expired entries outside the window
      await client.execute({
        sql: "DELETE FROM rate_limit_entries WHERE key = ? AND timestamp < ?",
        args: [key, windowStart],
      });

      // Count current window entries
      const countResult = await client.execute({
        sql: "SELECT COUNT(*) as cnt FROM rate_limit_entries WHERE key = ? AND timestamp >= ?",
        args: [key, windowStart],
      });
      const currentCount = Number(countResult.rows[0]?.cnt ?? 0);

      const allowed = currentCount < maxRequests;
      const remaining = Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0));
      const resetAt = now + windowMs;

      if (allowed) {
        // Record this request
        await client.execute({
          sql: "INSERT INTO rate_limit_entries (key, timestamp) VALUES (?, ?)",
          args: [key, now],
        });
      }

      return {
        allowed,
        remaining,
        resetAt,
        limit: maxRequests,
      };
    },

    async close(): Promise<void> {
      client.close();
    },
  };
}

/**
 * Check rate limit against an existing RateLimiter instance.
 * This is a convenience re-export for callers that hold a limiter reference.
 *
 * @param key      The rate limit key (e.g. IP address, user ID).
 * @param limiter  An existing RateLimiter instance.
 * @returns The rate limit result.
 */
export async function checkRateLimit(
  key: string,
  limiter: RateLimiter,
): Promise<RateLimitResult> {
  return limiter.check(key);
}
