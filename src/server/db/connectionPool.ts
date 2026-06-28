/**
 * Connection Pool for libSQL (Turso) connections.
 *
 * Wraps @libsql/client with a managed pool that reuses connections,
 * enforces a maximum pool size, and queues requests when the pool
 * is exhausted.
 *
 * Usage:
 *   const pool = createPool({ url: 'file:local.db', maxSize: 5 });
 *   const conn = await getConnection(pool);
 *   const result = await conn.execute('SELECT 1');
 *   releaseConnection(pool, conn);
 *   const stats = getPoolStats(pool);
 */

import { type Client, createClient, type InArgs, type ResultSet } from "@libsql/client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConnectionWrapper {
  client: Client;
  id: number;
  createdAt: number;
  lastUsedAt: number;
}

export interface PoolOptions {
  /** libSQL URL (file: for local, libsql:// or https:// for Turso) */
  url: string;
  /** Auth token for remote Turso databases */
  authToken?: string;
  /** Maximum number of connections in the pool (default: 5) */
  maxSize?: number;
  /** Idle timeout in ms before a connection is closed (default: 30_000) */
  idleTimeoutMs?: number;
  /** Max lifetime of a connection in ms (default: 300_000) */
  maxLifetimeMs?: number;
}

export interface PoolStats {
  active: number;
  idle: number;
  total: number;
  waitingRequests: number;
}

interface WaitingRequest {
  resolve: (conn: ConnectionWrapper) => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
}

export interface ConnectionPool {
  options: Required<PoolOptions>;
  active: Set<ConnectionWrapper>;
  idle: ConnectionWrapper[];
  waiting: WaitingRequest[];
  nextId: number;
  closed: boolean;
}

// ── Factory ──────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<PoolOptions> = {
  url: "",
  authToken: "",
  maxSize: 5,
  idleTimeoutMs: 30_000,
  maxLifetimeMs: 300_000,
};

/**
 * Create a new connection pool.
 */
export function createPool(options: PoolOptions): ConnectionPool {
  return {
    options: { ...DEFAULT_OPTIONS, ...options, authToken: options.authToken ?? "" },
    active: new Set(),
    idle: [],
    waiting: [],
    nextId: 1,
    closed: false,
  };
}

// ── Acquire ──────────────────────────────────────────────────────────────────

/**
 * Acquire a connection from the pool. Returns an existing idle connection
 * if available, otherwise creates a new one (up to maxSize). If the pool
 * is full, the request is queued and resolved when a connection is released.
 */
export async function getConnection(pool: ConnectionPool): Promise<ConnectionWrapper> {
  if (pool.closed) {
    throw new Error("Connection pool is closed");
  }

  // Try to reuse an idle connection (reaping stale ones first)
  reapIdle(pool);

  while (pool.idle.length > 0) {
    const conn = pool.idle.pop()!;
    if (isExpired(conn, pool)) {
      closeConnection(conn);
      continue;
    }
    conn.lastUsedAt = Date.now();
    pool.active.add(conn);
    return conn;
  }

  // If pool has capacity, create a new connection
  if (pool.active.size < pool.options.maxSize) {
    const conn = await createConnection(pool);
    pool.active.add(conn);
    return conn;
  }

  // Pool is full — queue the request
  return new Promise<ConnectionWrapper>((resolve, reject) => {
    pool.waiting.push({ resolve, reject, enqueuedAt: Date.now() });
  });
}

// ── Release ──────────────────────────────────────────────────────────────────

/**
 * Release a connection back to the pool. If there are waiting requests,
 * the connection is handed directly to the next waiter. Otherwise it
 * returns to the idle list.
 */
export function releaseConnection(pool: ConnectionPool, conn: ConnectionWrapper): void {
  if (!pool.active.has(conn)) {
    return; // not owned by this pool or already released
  }

  pool.active.delete(conn);

  if (pool.closed) {
    closeConnection(conn);
    drainWaiting(pool);
    return;
  }

  // Hand off to the next waiter if any
  while (pool.waiting.length > 0) {
    const waiter = pool.waiting.shift()!;
    if (isExpired(conn, pool)) {
      closeConnection(conn);
      // Try to create a fresh one for the waiter
      createConnection(pool)
        .then((fresh) => {
          fresh.lastUsedAt = Date.now();
          pool.active.add(fresh);
          waiter.resolve(fresh);
        })
        .catch(waiter.reject);
      return;
    }
    conn.lastUsedAt = Date.now();
    pool.active.add(conn);
    waiter.resolve(conn);
    return;
  }

  // No waiters — return to idle
  if (isExpired(conn, pool)) {
    closeConnection(conn);
  } else {
    conn.lastUsedAt = Date.now();
    pool.idle.push(conn);
  }
}

// ── Stats ────────────────────────────────────────────────────────────────────

/**
 * Get current pool statistics.
 */
export function getPoolStats(pool: ConnectionPool): PoolStats {
  return {
    active: pool.active.size,
    idle: pool.idle.length,
    total: pool.active.size + pool.idle.length,
    waitingRequests: pool.waiting.length,
  };
}

// ── Close ────────────────────────────────────────────────────────────────────

/**
 * Close the pool and all connections. Rejects any waiting requests.
 */
export function closePool(pool: ConnectionPool): void {
  if (pool.closed) return;
  pool.closed = true;

  for (const conn of pool.active) {
    closeConnection(conn);
  }
  pool.active.clear();

  for (const conn of pool.idle) {
    closeConnection(conn);
  }
  pool.idle = [];

  drainWaiting(pool);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createConnection(pool: ConnectionPool): Promise<ConnectionWrapper> {
  const client = createClient({
    url: pool.options.url,
    authToken: pool.options.authToken || undefined,
  });
  const now = Date.now();
  return {
    client,
    id: pool.nextId++,
    createdAt: now,
    lastUsedAt: now,
  };
}

function closeConnection(conn: ConnectionWrapper): void {
  try {
    conn.client.close();
  } catch {
    // already closed
  }
}

function isExpired(conn: ConnectionWrapper, pool: ConnectionPool): boolean {
  const now = Date.now();
  if (now - conn.createdAt > pool.options.maxLifetimeMs) return true;
  if (now - conn.lastUsedAt > pool.options.idleTimeoutMs) return true;
  return false;
}

function reapIdle(pool: ConnectionPool): void {
  pool.idle = pool.idle.filter((conn) => {
    if (isExpired(conn, pool)) {
      closeConnection(conn);
      return false;
    }
    return true;
  });
}

function drainWaiting(pool: ConnectionPool): void {
  while (pool.waiting.length > 0) {
    const waiter = pool.waiting.shift()!;
    waiter.reject(new Error("Connection pool is closed"));
  }
}

/**
 * Execute a SQL statement using a pooled connection (auto-release).
 */
export async function pooledExecute(pool: ConnectionPool, sql: string, args?: InArgs): Promise<ResultSet> {
  const conn = await getConnection(pool);
  try {
    return await conn.client.execute({ sql, args });
  } finally {
    releaseConnection(pool, conn);
  }
}

/**
 * Execute a batch of statements using a pooled connection (auto-release).
 */
export async function pooledBatch(
  pool: ConnectionPool,
  statements: { sql: string; args?: InArgs }[],
): Promise<ResultSet[]> {
  const conn = await getConnection(pool);
  try {
    return await conn.client.batch(
      statements.map((s) => ({ sql: s.sql, args: s.args })),
      "write",
    );
  } finally {
    releaseConnection(pool, conn);
  }
}
