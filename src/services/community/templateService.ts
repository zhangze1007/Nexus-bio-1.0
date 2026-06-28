/**
 * Community Template Sharing Service
 *
 * Manages community-authored project templates: publish, browse, fork, and rate.
 * Uses libsqlDb helpers (Turso / local SQLite) for persistence.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommunityTemplate {
  id: string;
  name: string;
  description: string;
  author_id: string;
  category: string;
  project_data: Record<string, unknown>;
  fork_count: number;
  star_count: number;
  rating_avg: number;
  rating_count: number;
  is_public: number;
  created_at: number;
}

export interface PublishTemplateInput {
  name: string;
  description: string;
  category: string;
  project_data: Record<string, unknown>;
  is_public?: boolean;
}

// ── Schema ───────────────────────────────────────────────────────────────────

let schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await sqlBatch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS community_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          author_id TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general',
          project_data TEXT NOT NULL DEFAULT '{}',
          fork_count INTEGER NOT NULL DEFAULT 0,
          star_count INTEGER NOT NULL DEFAULT 0,
          rating_avg REAL NOT NULL DEFAULT 0.0,
          rating_count INTEGER NOT NULL DEFAULT 0,
          is_public INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL
        )
      `,
      args: [],
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS community_template_ratings (
          template_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          score INTEGER NOT NULL,
          PRIMARY KEY (template_id, user_id)
        )
      `,
      args: [],
    },
  ]);
  schemaReady = true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function parseProjectData(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function rowToTemplate(row: Record<string, unknown>): CommunityTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    author_id: row.author_id as string,
    category: row.category as string,
    project_data: parseProjectData(row.project_data),
    fork_count: Number(row.fork_count),
    star_count: Number(row.star_count),
    rating_avg: Number(row.rating_avg),
    rating_count: Number(row.rating_count),
    is_public: Number(row.is_public),
    created_at: Number(row.created_at),
  };
}

/**
 * Reset the schema-ready flag (for testing only).
 * Allows tests to drop and re-create tables between runs.
 */
export function resetSchemaReady(): void {
  schemaReady = false;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Publish a new community template.
 * Returns the created template with server-generated id, counts, and timestamps.
 */
export async function publishTemplate(userId: string, template: PublishTemplateInput): Promise<CommunityTemplate> {
  await ensureSchema();
  const id = randomUUID();
  const timestamp = now();

  await sqlRun(
    `INSERT INTO community_templates
       (id, name, description, author_id, category, project_data, fork_count, star_count, rating_avg, rating_count, is_public, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0.0, 0, ?, ?)`,
    [
      id,
      template.name,
      template.description,
      userId,
      template.category,
      JSON.stringify(template.project_data),
      template.is_public === false ? 0 : 1,
      timestamp,
    ],
  );

  return {
    id,
    name: template.name,
    description: template.description,
    author_id: userId,
    category: template.category,
    project_data: template.project_data,
    fork_count: 0,
    star_count: 0,
    rating_avg: 0.0,
    rating_count: 0,
    is_public: template.is_public === false ? 0 : 1,
    created_at: timestamp,
  };
}

/**
 * List public templates, optionally filtered by category.
 * Returns templates ordered by creation date (newest first).
 */
export async function listTemplates(category?: string): Promise<CommunityTemplate[]> {
  await ensureSchema();
  let rows: Record<string, unknown>[];
  if (category) {
    rows = await sqlAll(
      "SELECT * FROM community_templates WHERE is_public = 1 AND category = ? ORDER BY created_at DESC",
      [category],
    );
  } else {
    rows = await sqlAll("SELECT * FROM community_templates WHERE is_public = 1 ORDER BY created_at DESC");
  }
  return rows.map(rowToTemplate);
}

/**
 * Get a single template by ID.
 * Returns undefined if not found.
 */
export async function getTemplate(id: string): Promise<CommunityTemplate | undefined> {
  await ensureSchema();
  const row = await sqlGet("SELECT * FROM community_templates WHERE id = ?", [id]);
  return row ? rowToTemplate(row) : undefined;
}

/**
 * Fork an existing template.
 * Creates a copy owned by the given user and increments the source template's fork count.
 * Returns the new forked template, or undefined if the source template does not exist.
 */
export async function forkTemplate(templateId: string, userId: string): Promise<CommunityTemplate | undefined> {
  await ensureSchema();
  const source = await sqlGet("SELECT * FROM community_templates WHERE id = ?", [templateId]);
  if (!source) return undefined;

  const newId = randomUUID();
  const timestamp = now();
  const parsed = rowToTemplate(source);

  await sqlBatch([
    {
      sql: `INSERT INTO community_templates
              (id, name, description, author_id, category, project_data, fork_count, star_count, rating_avg, rating_count, is_public, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0.0, 0, 1, ?)`,
      args: [
        newId,
        parsed.name,
        parsed.description,
        userId,
        parsed.category,
        JSON.stringify(parsed.project_data),
        timestamp,
      ],
    },
    {
      sql: "UPDATE community_templates SET fork_count = fork_count + 1 WHERE id = ?",
      args: [templateId],
    },
  ]);

  return {
    id: newId,
    name: parsed.name,
    description: parsed.description,
    author_id: userId,
    category: parsed.category,
    project_data: parsed.project_data,
    fork_count: 0,
    star_count: 0,
    rating_avg: 0.0,
    rating_count: 0,
    is_public: 1,
    created_at: timestamp,
  };
}

/**
 * Rate a template (1-5 scale).
 * Each user can rate a template once; re-rating updates the existing score.
 * Returns the updated template, or undefined if the template does not exist.
 */
export async function rateTemplate(
  templateId: string,
  userId: string,
  score: number,
): Promise<CommunityTemplate | undefined> {
  await ensureSchema();

  const template = await sqlGet("SELECT * FROM community_templates WHERE id = ?", [templateId]);
  if (!template) return undefined;

  const existing = await sqlGet("SELECT score FROM community_template_ratings WHERE template_id = ? AND user_id = ?", [
    templateId,
    userId,
  ]);

  if (existing) {
    // Update existing rating
    await sqlRun("UPDATE community_template_ratings SET score = ? WHERE template_id = ? AND user_id = ?", [
      score,
      templateId,
      userId,
    ]);
  } else {
    // Insert new rating
    await sqlRun("INSERT INTO community_template_ratings (template_id, user_id, score) VALUES (?, ?, ?)", [
      templateId,
      userId,
      score,
    ]);
  }

  // Recalculate aggregates
  const agg = await sqlGet(
    "SELECT COUNT(*) as cnt, AVG(score) as avg FROM community_template_ratings WHERE template_id = ?",
    [templateId],
  );

  const ratingCount = Number(agg?.cnt ?? 0);
  const ratingAvg = Number(agg?.avg ?? 0);
  const starCount = ratingCount; // star_count equals number of raters

  await sqlRun("UPDATE community_templates SET rating_avg = ?, rating_count = ?, star_count = ? WHERE id = ?", [
    ratingAvg,
    ratingCount,
    starCount,
    templateId,
  ]);

  const updated = await sqlGet("SELECT * FROM community_templates WHERE id = ?", [templateId]);
  return updated ? rowToTemplate(updated) : undefined;
}
