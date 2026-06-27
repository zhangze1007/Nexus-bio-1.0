/**
 * Tests for sliding window rate limiter.
 *
 * Covers:
 * - createRateLimiter returns a valid limiter
 * - check allows requests under the limit
 * - check denies requests over the limit
 * - remaining count decrements correctly
 * - window slides: old entries expire
 * - checkRateLimit convenience wrapper
 * - separate keys are independent
 * - resetAt is in the future
 * - limit field matches configuration
 * - close() does not throw
 */

import type { RateLimiter, RateLimitResult } from '../src/middleware/rateLimiter';

// ── Mock @libsql/client ─────────────────────────────────────────────────────

interface StoredRow {
  key: string;
  timestamp: number;
}

let storedRows: StoredRow[] = [];
let tableCreated = false;

const mockExecute = jest.fn(async (arg: string | { sql: string; args?: unknown[] }) => {
  const sql = typeof arg === 'string' ? arg : arg.sql;
  const args = typeof arg === 'string' ? [] : (arg.args ?? []);

  // CREATE TABLE / CREATE INDEX — no-ops
  if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
    tableCreated = true;
    return { rows: [] };
  }

  // DELETE expired entries
  if (sql.startsWith('DELETE FROM')) {
    const key = args[0] as string;
    const windowStart = args[1] as number;
    storedRows = storedRows.filter(
      (r) => !(r.key === key && r.timestamp < windowStart),
    );
    return { rows: [] };
  }

  // SELECT COUNT
  if (sql.startsWith('SELECT COUNT')) {
    const key = args[0] as string;
    const windowStart = args[1] as number;
    const count = storedRows.filter(
      (r) => r.key === key && r.timestamp >= windowStart,
    ).length;
    return { rows: [{ cnt: count }] };
  }

  // INSERT
  if (sql.startsWith('INSERT INTO')) {
    const key = args[0] as string;
    const timestamp = args[1] as number;
    storedRows.push({ key, timestamp });
    return { rows: [] };
  }

  return { rows: [] };
});

const mockClose = jest.fn();

jest.mock('@libsql/client', () => ({
  createClient: () => ({
    execute: mockExecute,
    close: mockClose,
  }),
}));

// ── Import after mock ───────────────────────────────────────────────────────

import { createRateLimiter, checkRateLimit } from '../src/middleware/rateLimiter';

// ── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  storedRows = [];
  tableCreated = false;
  mockExecute.mockClear();
  mockClose.mockClear();
  // Advance fake timers so Date.now() is deterministic
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('createRateLimiter', () => {
  it('creates a limiter with check and close methods', async () => {
    const limiter = await createRateLimiter({ maxRequests: 5, windowMs: 60000 });
    expect(typeof limiter.check).toBe('function');
    expect(typeof limiter.close).toBe('function');
    await limiter.close();
  });

  it('initializes the rate_limit_entries table', async () => {
    await createRateLimiter({ maxRequests: 5, windowMs: 60000 });
    expect(tableCreated).toBe(true);
  });
});

describe('RateLimiter.check', () => {
  it('allows requests under the limit', async () => {
    const limiter = await createRateLimiter({ maxRequests: 3, windowMs: 60000 });
    const result = await limiter.check('user:1');
    expect(result.allowed).toBe(true);
    await limiter.close();
  });

  it('denies requests over the limit', async () => {
    const limiter = await createRateLimiter({ maxRequests: 2, windowMs: 60000 });
    await limiter.check('user:1'); // 1st
    await limiter.check('user:1'); // 2nd
    const result = await limiter.check('user:1'); // 3rd — over limit
    expect(result.allowed).toBe(false);
    await limiter.close();
  });

  it('decrements remaining count correctly', async () => {
    const limiter = await createRateLimiter({ maxRequests: 3, windowMs: 60000 });
    const r1 = await limiter.check('user:1');
    expect(r1.remaining).toBe(2);
    const r2 = await limiter.check('user:1');
    expect(r2.remaining).toBe(1);
    const r3 = await limiter.check('user:1');
    expect(r3.remaining).toBe(0);
    await limiter.close();
  });

  it('remaining stays 0 when denied', async () => {
    const limiter = await createRateLimiter({ maxRequests: 1, windowMs: 60000 });
    await limiter.check('user:1');
    const denied = await limiter.check('user:1');
    expect(denied.remaining).toBe(0);
    expect(denied.allowed).toBe(false);
    await limiter.close();
  });

  it('slides the window: old entries expire', async () => {
    const limiter = await createRateLimiter({ maxRequests: 2, windowMs: 1000 });

    await limiter.check('user:1'); // t=0
    await limiter.check('user:1'); // t=0 — at limit

    const denied = await limiter.check('user:1');
    expect(denied.allowed).toBe(false);

    // Advance time past the window
    jest.advanceTimersByTime(1100);

    const allowed = await limiter.check('user:1');
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(1);
    await limiter.close();
  });

  it('separate keys are independent', async () => {
    const limiter = await createRateLimiter({ maxRequests: 1, windowMs: 60000 });
    await limiter.check('user:1');
    const r2 = await limiter.check('user:2');
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);
    await limiter.close();
  });

  it('resetAt is in the future', async () => {
    const limiter = await createRateLimiter({ maxRequests: 5, windowMs: 60000 });
    const result = await limiter.check('user:1');
    expect(result.resetAt).toBeGreaterThan(Date.now());
    await limiter.close();
  });

  it('limit field matches configuration', async () => {
    const limiter = await createRateLimiter({ maxRequests: 10, windowMs: 30000 });
    const result = await limiter.check('user:1');
    expect(result.limit).toBe(10);
    await limiter.close();
  });
});

describe('checkRateLimit', () => {
  it('delegates to limiter.check', async () => {
    const limiter = await createRateLimiter({ maxRequests: 5, windowMs: 60000 });
    const result = await checkRateLimit('user:1', limiter);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5);
    await limiter.close();
  });

  it('returns the same result as direct check', async () => {
    const limiter = await createRateLimiter({ maxRequests: 2, windowMs: 60000 });
    const direct = await limiter.check('user:1');
    const wrapper = await checkRateLimit('user:2', limiter);
    expect(wrapper.allowed).toBe(direct.allowed);
    expect(wrapper.limit).toBe(direct.limit);
    await limiter.close();
  });
});

describe('RateLimiter.close', () => {
  it('does not throw', async () => {
    const limiter = await createRateLimiter({ maxRequests: 5, windowMs: 60000 });
    await expect(limiter.close()).resolves.toBeUndefined();
  });
});
