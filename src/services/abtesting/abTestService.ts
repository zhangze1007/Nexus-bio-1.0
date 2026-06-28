/**
 * A/B Testing Service
 *
 * Provides experiment creation, variant assignment (deterministic hashing),
 * outcome recording, and result aggregation. All persistence goes through
 * the shared @libsql/client helpers in src/server/libsqlDb.ts.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";
import type { InStatement } from "@libsql/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Variant {
  id: string;
  weight: number;
}

export interface Experiment {
  id: string;
  name: string;
  status: "active" | "paused" | "concluded";
  variants: Variant[];
  created_at: string;
}

export interface Assignment {
  experiment_id: string;
  user_id: string;
  variant_id: string;
  assigned_at: string;
}

export interface Outcome {
  experiment_id: string;
  user_id: string;
  variant_id: string;
  outcome: string;
  recorded_at: string;
}

export interface VariantResult {
  variant_id: string;
  weight: number;
  assignments: number;
  outcomes: number;
  outcomeBreakdown: Record<string, number>;
}

export interface ExperimentResults {
  experiment: Experiment;
  totalAssignments: number;
  totalOutcomes: number;
  variants: VariantResult[];
}

/* ------------------------------------------------------------------ */
/*  Schema initialisation                                              */
/* ------------------------------------------------------------------ */

let schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;

  const statements: InStatement[] = [
    {
      sql: `CREATE TABLE IF NOT EXISTS ab_experiments (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'active',
        variants    TEXT NOT NULL,
        created_at  TEXT NOT NULL
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS ab_assignments (
        experiment_id TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        variant_id    TEXT NOT NULL,
        assigned_at   TEXT NOT NULL,
        PRIMARY KEY (experiment_id, user_id),
        FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id)
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS ab_outcomes (
        experiment_id TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        variant_id    TEXT NOT NULL,
        outcome       TEXT NOT NULL,
        recorded_at   TEXT NOT NULL,
        FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id)
      )`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_ab_assignments_experiment
            ON ab_assignments(experiment_id)`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_ab_outcomes_experiment
            ON ab_outcomes(experiment_id)`,
    },
  ];

  await sqlBatch(statements);
  schemaReady = true;
}

/* ------------------------------------------------------------------ */
/*  Deterministic variant assignment                                   */
/* ------------------------------------------------------------------ */

/**
 * Assign a variant by hashing (experimentId + userId) and mapping the
 * result to cumulative weight buckets. This is deterministic: the same
 * user always gets the same variant for a given experiment.
 */
function hashAssignVariant(variants: Variant[], experimentId: string, userId: string): string {
  // Simple FNV-1a-style hash over the concatenation
  const input = `${experimentId}:${userId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  const bucket = (hash % (totalWeight * 1000)) / 1000; // 3-decimal precision

  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight;
    if (bucket < cumulative) return v.id;
  }
  // Fallback to last variant (handles floating-point edge case)
  return variants[variants.length - 1].id;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create a new A/B experiment.
 * Returns the generated experiment ID.
 */
export async function createExperiment(name: string, variants: Variant[]): Promise<string> {
  await ensureSchema();

  if (!name || variants.length === 0) {
    throw new Error("Experiment name and at least one variant are required.");
  }

  // Validate weights are positive
  for (const v of variants) {
    if (v.weight <= 0) {
      throw new Error(`Variant "${v.id}" must have a positive weight.`);
    }
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await sqlRun(
    `INSERT INTO ab_experiments (id, name, status, variants, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, "active", JSON.stringify(variants), now],
  );

  return id;
}

/**
 * Assign a variant to a user for a given experiment.
 * If the user is already assigned, returns the existing assignment.
 */
export async function assignVariant(
  experimentId: string,
  userId: string,
): Promise<{ variant_id: string; is_new: boolean }> {
  await ensureSchema();

  // Check for existing assignment
  const existing = await sqlGet(
    `SELECT variant_id FROM ab_assignments
     WHERE experiment_id = ? AND user_id = ?`,
    [experimentId, userId],
  );

  if (existing) {
    return { variant_id: existing.variant_id as string, is_new: false };
  }

  // Load experiment
  const experiment = await sqlGet(`SELECT variants, status FROM ab_experiments WHERE id = ?`, [experimentId]);

  if (!experiment) {
    throw new Error(`Experiment "${experimentId}" not found.`);
  }

  if (experiment.status !== "active") {
    throw new Error(`Experiment "${experimentId}" is not active.`);
  }

  const variants: Variant[] = JSON.parse(experiment.variants as string);
  const variantId = hashAssignVariant(variants, experimentId, userId);
  const now = new Date().toISOString();

  await sqlRun(
    `INSERT INTO ab_assignments (experiment_id, user_id, variant_id, assigned_at)
     VALUES (?, ?, ?, ?)`,
    [experimentId, userId, variantId, now],
  );

  return { variant_id: variantId, is_new: true };
}

/**
 * Record an outcome for a user in an experiment.
 */
export async function recordOutcome(experimentId: string, userId: string, outcome: string): Promise<void> {
  await ensureSchema();

  // Look up the user's assignment
  const assignment = await sqlGet(
    `SELECT variant_id FROM ab_assignments
     WHERE experiment_id = ? AND user_id = ?`,
    [experimentId, userId],
  );

  if (!assignment) {
    throw new Error(`User "${userId}" is not assigned to experiment "${experimentId}". Assign a variant first.`);
  }

  const now = new Date().toISOString();

  await sqlRun(
    `INSERT INTO ab_outcomes (experiment_id, user_id, variant_id, outcome, recorded_at)
     VALUES (?, ?, ?, ?, ?)`,
    [experimentId, userId, assignment.variant_id as string, outcome, now],
  );
}

/**
 * Get aggregated results for an experiment.
 */
export async function getResults(experimentId: string): Promise<ExperimentResults> {
  await ensureSchema();

  const experiment = await sqlGet(`SELECT id, name, status, variants, created_at FROM ab_experiments WHERE id = ?`, [
    experimentId,
  ]);

  if (!experiment) {
    throw new Error(`Experiment "${experimentId}" not found.`);
  }

  const variants: Variant[] = JSON.parse(experiment.variants as string);

  // Assignment counts per variant
  const assignmentRows = await sqlAll(
    `SELECT variant_id, COUNT(*) as cnt FROM ab_assignments
     WHERE experiment_id = ? GROUP BY variant_id`,
    [experimentId],
  );

  const assignmentMap: Record<string, number> = {};
  let totalAssignments = 0;
  for (const row of assignmentRows) {
    const vid = row.variant_id as string;
    const cnt = row.cnt as number;
    assignmentMap[vid] = cnt;
    totalAssignments += cnt;
  }

  // Outcome counts per variant + breakdown
  const outcomeRows = await sqlAll(
    `SELECT variant_id, outcome, COUNT(*) as cnt FROM ab_outcomes
     WHERE experiment_id = ? GROUP BY variant_id, outcome`,
    [experimentId],
  );

  const outcomeMap: Record<string, number> = {};
  const breakdownMap: Record<string, Record<string, number>> = {};
  let totalOutcomes = 0;

  for (const row of outcomeRows) {
    const vid = row.variant_id as string;
    const out = row.outcome as string;
    const cnt = row.cnt as number;
    outcomeMap[vid] = (outcomeMap[vid] ?? 0) + cnt;
    totalOutcomes += cnt;
    if (!breakdownMap[vid]) breakdownMap[vid] = {};
    breakdownMap[vid][out] = cnt;
  }

  const variantResults: VariantResult[] = variants.map((v) => ({
    variant_id: v.id,
    weight: v.weight,
    assignments: assignmentMap[v.id] ?? 0,
    outcomes: outcomeMap[v.id] ?? 0,
    outcomeBreakdown: breakdownMap[v.id] ?? {},
  }));

  return {
    experiment: {
      id: experiment.id as string,
      name: experiment.name as string,
      status: experiment.status as Experiment["status"],
      variants,
      created_at: experiment.created_at as string,
    },
    totalAssignments,
    totalOutcomes,
    variants: variantResults,
  };
}

/**
 * List all experiments (lightweight — no per-variant aggregation).
 */
export async function listExperiments(): Promise<Experiment[]> {
  await ensureSchema();

  const rows = await sqlAll(
    `SELECT id, name, status, variants, created_at FROM ab_experiments ORDER BY created_at DESC`,
  );

  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    status: r.status as Experiment["status"],
    variants: JSON.parse(r.variants as string) as Variant[],
    created_at: r.created_at as string,
  }));
}
