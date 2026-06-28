/**
 * Usage tracking service — libSQL (Turso) backed.
 *
 * Records per-user resource consumption (AI queries, FBA runs, storage, API calls)
 * and enforces tier-based usage limits. Integrates with the Stripe pricing tiers
 * defined in services/billing/stripeClient.ts.
 *
 * Schema: usage_records (id, user_id, resource, amount, timestamp)
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";
import { PRICING_TIERS, type Tier } from "../billing/stripeClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UsageResource = "ai_queries" | "fba_runs" | "storage_bytes" | "api_calls";

export const USAGE_RESOURCES: UsageResource[] = ["ai_queries", "fba_runs", "storage_bytes", "api_calls"];

/** Cost per unit for each resource (in USD-equivalent credits). */
export const RESOURCE_COST_PER_UNIT: Record<UsageResource, number> = {
  ai_queries: 0.01,
  fba_runs: 0.02,
  storage_bytes: 0.0000001,
  api_calls: 0.005,
};

/** Default monthly limits per resource for each pricing tier. -1 = unlimited. */
export const TIER_LIMITS: Record<Tier, Record<UsageResource, number>> = {
  free: {
    ai_queries: 100,
    fba_runs: 50,
    storage_bytes: 100_000_000, // 100 MB
    api_calls: 200,
  },
  pro: {
    ai_queries: 1000,
    fba_runs: 500,
    storage_bytes: 5_000_000_000, // 5 GB
    api_calls: 5000,
  },
  team: {
    ai_queries: -1,
    fba_runs: -1,
    storage_bytes: -1,
    api_calls: -1,
  },
};

export interface UsageSummary {
  byResource: Record<UsageResource, { totalAmount: number; cost: number }>;
  totalCost: number;
}

export interface LimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms timestamp when the limit resets (start of next calendar month)
}

export interface TimeRange {
  start: number; // Unix ms
  end: number; // Unix ms
}

// ─── Schema ───────────────────────────────────────────────────────────────────

let schemaReady = false;

export async function ensureUsageSchema(): Promise<void> {
  if (schemaReady) return;

  await sqlRun("PRAGMA journal_mode = WAL");
  await sqlRun("PRAGMA synchronous = NORMAL");

  await sqlBatch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS usage_records (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          resource TEXT NOT NULL,
          amount REAL NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `,
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_usage_user_resource ON usage_records (user_id, resource, timestamp DESC)",
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_usage_user_time ON usage_records (user_id, timestamp DESC)",
    },
  ]);

  schemaReady = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function validateResource(resource: string): asserts resource is UsageResource {
  if (!USAGE_RESOURCES.includes(resource as UsageResource)) {
    throw new Error(`Invalid resource "${resource}". Must be one of: ${USAGE_RESOURCES.join(", ")}`);
  }
}

/** Get the Unix ms timestamp for the start of the next calendar month. */
export function getNextMonthReset(): number {
  const d = new Date();
  // Move to the 1st of next month at 00:00:00 UTC
  const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return nextMonth.getTime();
}

/** Get the Unix ms timestamp for the start of the current calendar month. */
export function getCurrentMonthStart(): number {
  const d = new Date();
  const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  return monthStart.getTime();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Track a resource usage event for a user.
 * Validates the resource type and inserts a usage record.
 */
export async function trackUsage(userId: string, resource: string, amount: number): Promise<void> {
  await ensureUsageSchema();

  if (!userId || userId.trim().length === 0) {
    throw new Error("userId is required");
  }
  validateResource(resource);
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive finite number");
  }

  const id = randomUUID();
  const timestamp = now();

  await sqlRun(
    `INSERT INTO usage_records (id, user_id, resource, amount, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId.trim(), resource, amount, timestamp],
  );
}

/**
 * Get aggregated usage summary for a user within a time range.
 * Returns per-resource totals with computed costs, plus an overall total cost.
 */
export async function getUsage(userId: string, timeRange: TimeRange): Promise<UsageSummary> {
  await ensureUsageSchema();

  if (!userId || userId.trim().length === 0) {
    throw new Error("userId is required");
  }
  if (timeRange.start >= timeRange.end) {
    throw new Error("timeRange.start must be less than timeRange.end");
  }

  const rows = await sqlAll(
    `SELECT resource, SUM(amount) as total_amount
     FROM usage_records
     WHERE user_id = ? AND timestamp >= ? AND timestamp < ?
     GROUP BY resource`,
    [userId.trim(), timeRange.start, timeRange.end],
  );

  // Initialize with zero for all resources
  const byResource: UsageSummary["byResource"] = {} as UsageSummary["byResource"];
  for (const res of USAGE_RESOURCES) {
    byResource[res] = { totalAmount: 0, cost: 0 };
  }

  let totalCost = 0;
  for (const row of rows) {
    const resource = row.resource as UsageResource;
    const totalAmount = Number(row.total_amount ?? 0);
    const cost = Math.round(totalAmount * RESOURCE_COST_PER_UNIT[resource] * 1_000_000) / 1_000_000;
    byResource[resource] = { totalAmount, cost };
    totalCost += cost;
  }

  totalCost = Math.round(totalCost * 1_000_000) / 1_000_000;

  return { byResource, totalCost };
}

/**
 * Check whether a user is allowed to consume more of a given resource
 * based on their pricing tier limits for the current calendar month.
 *
 * Returns allowed (boolean), remaining units (-1 if unlimited), and
 * the timestamp when the monthly limit resets.
 */
export async function checkLimit(userId: string, resource: string, tier: Tier = "free"): Promise<LimitCheck> {
  await ensureUsageSchema();

  if (!userId || userId.trim().length === 0) {
    throw new Error("userId is required");
  }
  validateResource(resource);

  const limit = TIER_LIMITS[tier][resource as UsageResource];

  // Unlimited tier
  if (limit === -1) {
    return {
      allowed: true,
      remaining: -1,
      resetAt: getNextMonthReset(),
    };
  }

  const monthStart = getCurrentMonthStart();
  const resetAt = getNextMonthReset();

  const row = await sqlGet(
    `SELECT SUM(amount) as total_amount
     FROM usage_records
     WHERE user_id = ? AND resource = ? AND timestamp >= ?`,
    [userId.trim(), resource, monthStart],
  );

  const currentUsage = Number(row?.total_amount ?? 0);
  const remaining = Math.max(0, limit - currentUsage);

  return {
    allowed: currentUsage < limit,
    remaining,
    resetAt,
  };
}
