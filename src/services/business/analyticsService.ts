/**
 * Analytics persistence layer — libSQL (Turso) backed.
 *
 * Tracks user events (page views, tool runs, feature usage) in the
 * analytics_events table. Provides aggregate queries for dashboards
 * and activity summaries.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventStats {
  total: number;
  uniqueUsers: number;
  trend: number; // percentage change vs previous period (e.g. +12.5 or -8.3)
}

export interface ActivitySummary {
  totalEvents: number;
  uniqueEvents: number;
  topEvents: Array<{ event: string; count: number }>;
  dailyCounts: Array<{ date: string; count: number }>;
}

export interface TimeRange {
  start: number; // Unix ms
  end: number;   // Unix ms
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
        CREATE TABLE IF NOT EXISTS analytics_events (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          event TEXT NOT NULL,
          properties_json TEXT,
          timestamp INTEGER NOT NULL,
          session_id TEXT
        )
      `,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events (event, timestamp DESC)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events (user_id, timestamp DESC)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events (session_id)",
    },
  ]);

  schemaReady = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Track a user event. Properties are stored as serialized JSON.
 */
export async function trackEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
  sessionId?: string,
): Promise<void> {
  await ensureSchema();

  if (!userId || userId.trim().length === 0) {
    throw new Error("userId is required");
  }
  if (!event || event.trim().length === 0) {
    throw new Error("event is required");
  }

  const id = randomUUID();
  const timestamp = now();
  const propertiesJson = properties ? JSON.stringify(properties) : null;

  await sqlRun(
    `INSERT INTO analytics_events (id, user_id, event, properties_json, timestamp, session_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId.trim(), event.trim(), propertiesJson, timestamp, sessionId?.trim() ?? null],
  );
}

/**
 * Get aggregate stats for an event within a time range.
 * Also computes trend by comparing to the preceding period of equal length.
 */
export async function getEventStats(event: string, timeRange: TimeRange): Promise<EventStats> {
  await ensureSchema();

  if (!event || event.trim().length === 0) {
    throw new Error("event is required");
  }
  if (timeRange.start >= timeRange.end) {
    throw new Error("timeRange.start must be less than timeRange.end");
  }

  const periodLength = timeRange.end - timeRange.start;
  const previousStart = timeRange.start - periodLength;

  // Current period stats
  const currentRow = await sqlGet(
    `SELECT
       COUNT(*) as total,
       COUNT(DISTINCT user_id) as uniqueUsers
     FROM analytics_events
     WHERE event = ? AND timestamp >= ? AND timestamp < ?`,
    [event.trim(), timeRange.start, timeRange.end],
  );

  // Previous period stats (for trend calculation)
  const previousRow = await sqlGet(
    `SELECT COUNT(*) as total
     FROM analytics_events
     WHERE event = ? AND timestamp >= ? AND timestamp < ?`,
    [event.trim(), previousStart, timeRange.start],
  );

  const total = Number(currentRow?.total ?? 0);
  const uniqueUsers = Number(currentRow?.uniqueUsers ?? 0);
  const previousTotal = Number(previousRow?.total ?? 0);

  let trend = 0;
  if (previousTotal > 0) {
    trend = Math.round(((total - previousTotal) / previousTotal) * 1000) / 10;
  } else if (total > 0) {
    trend = 100; // new activity, 100% increase
  }

  return { total, uniqueUsers, trend };
}

/**
 * Get activity summary for a user over the last N days.
 */
export async function getUserActivity(userId: string, days: number): Promise<ActivitySummary> {
  await ensureSchema();

  if (!userId || userId.trim().length === 0) {
    throw new Error("userId is required");
  }
  if (days <= 0) {
    throw new Error("days must be a positive number");
  }

  const cutoff = now() - days * 24 * 60 * 60 * 1000;

  // Total and unique event counts
  const summaryRow = await sqlGet(
    `SELECT
       COUNT(*) as totalEvents,
       COUNT(DISTINCT event) as uniqueEvents
     FROM analytics_events
     WHERE user_id = ? AND timestamp >= ?`,
    [userId.trim(), cutoff],
  );

  // Top events by frequency
  const topEventRows = await sqlAll(
    `SELECT event, COUNT(*) as count
     FROM analytics_events
     WHERE user_id = ? AND timestamp >= ?
     GROUP BY event
     ORDER BY count DESC
     LIMIT 10`,
    [userId.trim(), cutoff],
  );

  // Daily counts
  const dailyRows = await sqlAll(
    `SELECT
       strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date,
       COUNT(*) as count
     FROM analytics_events
     WHERE user_id = ? AND timestamp >= ?
     GROUP BY date
     ORDER BY date ASC`,
    [userId.trim(), cutoff],
  );

  return {
    totalEvents: Number(summaryRow?.totalEvents ?? 0),
    uniqueEvents: Number(summaryRow?.uniqueEvents ?? 0),
    topEvents: topEventRows.map((r) => ({
      event: r.event as string,
      count: Number(r.count),
    })),
    dailyCounts: dailyRows.map((r) => ({
      date: r.date as string,
      count: Number(r.count),
    })),
  };
}
