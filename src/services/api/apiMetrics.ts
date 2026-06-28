/**
 * API Metrics persistence layer — libSQL (Turso) backed.
 *
 * Tracks every API call (endpoint, method, status code, duration) in the
 * api_metrics table. Provides aggregate queries for dashboards, per-endpoint
 * stats including p95 latency, and error-rate monitoring.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeRange {
  start: number; // Unix ms
  end: number; // Unix ms
}

export interface EndpointStatEntry {
  endpoint: string;
  count: number;
}

export interface ApiMetrics {
  totalCalls: number;
  avgDuration: number;
  errorRate: number;
  topEndpoints: EndpointStatEntry[];
}

export interface EndpointStats {
  calls: number;
  avgDuration: number;
  p95Duration: number;
  errorRate: number;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

let schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;

  await sqlRun("PRAGMA journal_mode = WAL");
  await sqlRun("PRAGMA synchronous = NORMAL");

  await sqlBatch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS api_metrics (
          id TEXT PRIMARY KEY,
          endpoint TEXT NOT NULL,
          method TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          duration_ms REAL NOT NULL,
          timestamp INTEGER NOT NULL,
          user_id TEXT
        )
      `,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON api_metrics (endpoint, timestamp DESC)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_api_metrics_status ON api_metrics (status_code, timestamp DESC)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_api_metrics_timestamp ON api_metrics (timestamp DESC)",
    },
  ]);

  schemaReady = true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a single API call. Generates a UUID id and uses the current
 * timestamp if none is provided by the caller.
 */
export async function trackApiCall(
  endpoint: string,
  method: string,
  statusCode: number,
  durationMs: number,
  userId?: string,
): Promise<void> {
  await ensureSchema();

  if (!endpoint || endpoint.trim().length === 0) {
    throw new Error("endpoint is required");
  }
  if (!method || method.trim().length === 0) {
    throw new Error("method is required");
  }
  if (typeof statusCode !== "number" || statusCode < 100 || statusCode > 599) {
    throw new Error("statusCode must be an integer between 100 and 599");
  }
  if (typeof durationMs !== "number" || durationMs < 0) {
    throw new Error("durationMs must be a non-negative number");
  }

  const id = randomUUID();
  const timestamp = Date.now();

  await sqlRun(
    `INSERT INTO api_metrics (id, endpoint, method, status_code, duration_ms, timestamp, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      endpoint.trim(),
      method.trim().toUpperCase(),
      Math.round(statusCode),
      durationMs,
      timestamp,
      userId?.trim() ?? null,
    ],
  );
}

/**
 * Get aggregate API metrics within a time range.
 *
 * Returns total calls, average duration, error rate (4xx + 5xx), and the
 * top 10 endpoints by call volume.
 */
export async function getApiMetrics(timeRange: TimeRange): Promise<ApiMetrics> {
  await ensureSchema();

  if (timeRange.start >= timeRange.end) {
    throw new Error("timeRange.start must be less than timeRange.end");
  }

  // Aggregate stats
  const aggRow = await sqlGet(
    `SELECT
       COUNT(*) as totalCalls,
       COALESCE(AVG(duration_ms), 0) as avgDuration,
       COALESCE(
         CAST(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(*), 0),
         0
       ) as errorRate
     FROM api_metrics
     WHERE timestamp >= ? AND timestamp < ?`,
    [timeRange.start, timeRange.end],
  );

  // Top endpoints by call volume
  const topRows = await sqlAll(
    `SELECT endpoint, COUNT(*) as count
     FROM api_metrics
     WHERE timestamp >= ? AND timestamp < ?
     GROUP BY endpoint
     ORDER BY count DESC
     LIMIT 10`,
    [timeRange.start, timeRange.end],
  );

  return {
    totalCalls: Number(aggRow?.totalCalls ?? 0),
    avgDuration: Math.round(Number(aggRow?.avgDuration ?? 0) * 100) / 100,
    errorRate: Math.round(Number(aggRow?.errorRate ?? 0) * 10000) / 10000,
    topEndpoints: topRows.map((r) => ({
      endpoint: r.endpoint as string,
      count: Number(r.count),
    })),
  };
}

/**
 * Get detailed stats for a single endpoint within a time range.
 *
 * Returns total calls, average duration, p95 duration, and error rate.
 * p95 is computed by ordering all durations and picking the value at the
 * 95th percentile index.
 */
export async function getEndpointStats(endpoint: string, timeRange?: TimeRange): Promise<EndpointStats> {
  await ensureSchema();

  if (!endpoint || endpoint.trim().length === 0) {
    throw new Error("endpoint is required");
  }

  const trimmed = endpoint.trim();

  // Build WHERE clause — optional time range filter
  let whereClause = "WHERE endpoint = ?";
  const args: unknown[] = [trimmed];

  if (timeRange) {
    if (timeRange.start >= timeRange.end) {
      throw new Error("timeRange.start must be less than timeRange.end");
    }
    whereClause += " AND timestamp >= ? AND timestamp < ?";
    args.push(timeRange.start, timeRange.end);
  }

  // Aggregate stats
  const aggRow = await sqlGet(
    `SELECT
       COUNT(*) as calls,
       COALESCE(AVG(duration_ms), 0) as avgDuration,
       COALESCE(
         CAST(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(*), 0),
         0
       ) as errorRate
     FROM api_metrics
     ${whereClause}`,
    args,
  );

  const calls = Number(aggRow?.calls ?? 0);

  // p95 duration — fetch all durations ordered, pick at 95th percentile index
  let p95Duration = 0;
  if (calls > 0) {
    const durationRows = await sqlAll(
      `SELECT duration_ms FROM api_metrics ${whereClause} ORDER BY duration_ms ASC`,
      args,
    );
    const p95Index = Math.min(Math.floor(calls * 0.95), calls - 1);
    p95Duration = Math.round(Number(durationRows[p95Index]?.duration_ms ?? 0) * 100) / 100;
  }

  return {
    calls,
    avgDuration: Math.round(Number(aggRow?.avgDuration ?? 0) * 100) / 100,
    p95Duration,
    errorRate: Math.round(Number(aggRow?.errorRate ?? 0) * 10000) / 10000,
  };
}
