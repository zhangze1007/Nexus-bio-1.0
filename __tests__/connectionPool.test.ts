/**
 * Tests for the libSQL connection pool.
 *
 * Mocks @libsql/client so tests run without a real database.
 */

import {
  createPool,
  getConnection,
  releaseConnection,
  getPoolStats,
  closePool,
  pooledExecute,
  pooledBatch,
  type ConnectionPool,
  type ConnectionWrapper,
} from "../src/server/db/connectionPool";

// ── Mock @libsql/client ──────────────────────────────────────────────────────

const mockClose = jest.fn();
const mockExecute = jest.fn().mockResolvedValue({
  rows: [{ result: 1 }],
  rowsAffected: 0,
  lastInsertRowid: 0,
});
const mockBatch = jest.fn().mockResolvedValue([]);

jest.mock("@libsql/client", () => ({
  createClient: jest.fn(() => ({
    close: mockClose,
    execute: mockExecute,
    batch: mockBatch,
  })),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("connectionPool", () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = createPool({ url: "file:local.db", maxSize: 3 });
  });

  afterEach(() => {
    closePool(pool);
  });

  // ── createPool ────────────────────────────────────────────────────────────

  test("createPool returns a pool with default options", () => {
    const p = createPool({ url: "file:test.db" });
    expect(p.options.maxSize).toBe(5);
    expect(p.options.idleTimeoutMs).toBe(30_000);
    expect(p.options.maxLifetimeMs).toBe(300_000);
    expect(p.closed).toBe(false);
    expect(p.nextId).toBe(1);
    closePool(p);
  });

  test("createPool respects custom options", () => {
    const p = createPool({
      url: "libsql://db.turso.io",
      authToken: "tok",
      maxSize: 10,
      idleTimeoutMs: 5_000,
    });
    expect(p.options.maxSize).toBe(10);
    expect(p.options.idleTimeoutMs).toBe(5_000);
    expect(p.options.authToken).toBe("tok");
    closePool(p);
  });

  // ── getConnection / releaseConnection ─────────────────────────────────────

  test("getConnection creates a new connection", async () => {
    const conn = await getConnection(pool);
    expect(conn.id).toBe(1);
    expect(pool.active.size).toBe(1);
    expect(getPoolStats(pool).total).toBe(1);
    releaseConnection(pool, conn);
  });

  test("releaseConnection returns connection to idle list", async () => {
    const conn = await getConnection(pool);
    expect(getPoolStats(pool).active).toBe(1);
    expect(getPoolStats(pool).idle).toBe(0);

    releaseConnection(pool, conn);
    expect(getPoolStats(pool).active).toBe(0);
    expect(getPoolStats(pool).idle).toBe(1);
  });

  test("getConnection reuses idle connections", async () => {
    const conn1 = await getConnection(pool);
    releaseConnection(pool, conn1);

    const conn2 = await getConnection(pool);
    expect(conn2.id).toBe(conn1.id); // same connection reused
    expect(getPoolStats(pool).total).toBe(1);
    releaseConnection(pool, conn2);
  });

  test("getConnection creates multiple connections up to maxSize", async () => {
    const conns: ConnectionWrapper[] = [];
    for (let i = 0; i < 3; i++) {
      conns.push(await getConnection(pool));
    }
    expect(getPoolStats(pool).active).toBe(3);
    expect(getPoolStats(pool).idle).toBe(0);
    expect(new Set(conns.map((c) => c.id)).size).toBe(3); // all distinct
    conns.forEach((c) => releaseConnection(pool, c));
  });

  test("getConnection queues when pool is exhausted", async () => {
    const conns: ConnectionWrapper[] = [];
    for (let i = 0; i < 3; i++) {
      conns.push(await getConnection(pool));
    }

    // Pool is full (maxSize=3), next request should queue
    let resolved = false;
    const pendingConn = getConnection(pool).then((c) => {
      resolved = true;
      return c;
    });

    // Give the event loop a tick — the request should still be waiting
    await new Promise((r) => setTimeout(r, 20));
    expect(resolved).toBe(false);
    expect(getPoolStats(pool).waitingRequests).toBe(1);

    // Release one connection — the waiter should resolve
    releaseConnection(pool, conns[0]);
    const awaitedConn = await pendingConn;
    expect(resolved).toBe(true);
    expect(awaitedConn.id).toBe(conns[0].id);

    releaseConnection(pool, awaitedConn);
    conns.slice(1).forEach((c) => releaseConnection(pool, c));
  });

  test("releaseConnection ignores unknown connections", async () => {
    const foreignConn: ConnectionWrapper = {
      client: { close: jest.fn() } as any,
      id: 999,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
    // Should not throw
    releaseConnection(pool, foreignConn);
    expect(getPoolStats(pool).active).toBe(0);
  });

  // ── getPoolStats ──────────────────────────────────────────────────────────

  test("getPoolStats returns correct counts", async () => {
    const stats0 = getPoolStats(pool);
    expect(stats0).toEqual({ active: 0, idle: 0, total: 0, waitingRequests: 0 });

    const c1 = await getConnection(pool);
    const c2 = await getConnection(pool);
    const stats1 = getPoolStats(pool);
    expect(stats1).toEqual({ active: 2, idle: 0, total: 2, waitingRequests: 0 });

    releaseConnection(pool, c1);
    const stats2 = getPoolStats(pool);
    expect(stats2).toEqual({ active: 1, idle: 1, total: 2, waitingRequests: 0 });

    releaseConnection(pool, c2);
  });

  // ── closePool ─────────────────────────────────────────────────────────────

  test("closePool closes all connections and marks pool as closed", async () => {
    const c1 = await getConnection(pool);
    const c2 = await getConnection(pool);
    const numCloseBefore = mockClose.mock.calls.length;

    closePool(pool);

    expect(pool.closed).toBe(true);
    expect(mockClose).toHaveBeenCalledTimes(numCloseBefore + 2);
    expect(getPoolStats(pool)).toEqual({ active: 0, idle: 0, total: 0, waitingRequests: 0 });
  });

  test("closePool rejects waiting requests", async () => {
    const conns: ConnectionWrapper[] = [];
    for (let i = 0; i < 3; i++) {
      conns.push(await getConnection(pool));
    }

    const pendingConnPromise = getConnection(pool);
    await new Promise((r) => setTimeout(r, 20));

    closePool(pool);

    await expect(pendingConnPromise).rejects.toThrow("Connection pool is closed");
  });

  test("getConnection throws after pool is closed", async () => {
    closePool(pool);
    await expect(getConnection(pool)).rejects.toThrow("Connection pool is closed");
  });

  test("closePool is idempotent", async () => {
    closePool(pool);
    closePool(pool); // second call should not throw
    expect(pool.closed).toBe(true);
  });

  // ── pooledExecute / pooledBatch ───────────────────────────────────────────

  test("pooledExecute acquires, executes, and releases automatically", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ value: 42 }],
      rowsAffected: 1,
      lastInsertRowid: 0,
    });

    const result = await pooledExecute(pool, "SELECT ? AS value", [42]);
    expect(result.rows[0]).toEqual({ value: 42 });
    // Connection should be back in idle
    expect(getPoolStats(pool).active).toBe(0);
    expect(getPoolStats(pool).idle).toBe(1);
  });

  test("pooledExecute releases connection even on error", async () => {
    mockExecute.mockRejectedValueOnce(new Error("SQL syntax error"));

    await expect(pooledExecute(pool, "INVALID SQL")).rejects.toThrow("SQL syntax error");
    expect(getPoolStats(pool).active).toBe(0);
    expect(getPoolStats(pool).idle).toBe(1);
  });

  test("pooledBatch acquires, executes batch, and releases", async () => {
    const stmts = [
      { sql: "INSERT INTO t VALUES (?)", args: [1] },
      { sql: "INSERT INTO t VALUES (?)", args: [2] },
    ];
    await pooledBatch(pool, stmts);
    expect(mockBatch).toHaveBeenCalledWith(
      stmts,
      "write",
    );
    expect(getPoolStats(pool).active).toBe(0);
  });
});
