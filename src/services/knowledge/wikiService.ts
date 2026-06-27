/**
 * Knowledge Base Wiki Service
 *
 * Manages wiki pages with full revision history for project knowledge bases.
 * Uses libsqlDb helpers (Turso / local SQLite) for persistence.
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlBatch, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WikiPage {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  content: string | null;
  content_markdown: string | null;
  category: string | null;
  tags: string | null; // JSON array
  created_by: string | null;
  last_edited_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WikiRevision {
  id: string;
  page_id: string;
  version: number;
  content: string | null;
  edited_by: string | null;
  change_summary: string | null;
  edited_at: string;
}

export interface CreatePageInput {
  projectId: string;
  title: string;
  content: string;
  category?: string;
  userId?: string;
}

export interface UpdatePageInput {
  content: string;
  userId?: string;
  changeSummary?: string;
}

// ── Schema ───────────────────────────────────────────────────────────────────

let schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await sqlBatch([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS wiki_pages (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          slug TEXT NOT NULL,
          content TEXT,
          content_markdown TEXT,
          category TEXT,
          tags TEXT,
          created_by TEXT,
          last_edited_by TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
      args: [],
    },
    {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_wiki_pages_project
        ON wiki_pages (project_id)
      `,
      args: [],
    },
    {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_wiki_pages_project_category
        ON wiki_pages (project_id, category)
      `,
      args: [],
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS wiki_revisions (
          id TEXT PRIMARY KEY,
          page_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          content TEXT,
          edited_by TEXT,
          change_summary TEXT,
          edited_at TEXT NOT NULL
        )
      `,
      args: [],
    },
    {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_wiki_revisions_page
        ON wiki_revisions (page_id)
      `,
      args: [],
    },
  ]);
  schemaReady = true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

/**
 * Generate a URL-friendly slug from a title.
 * Lowercases, replaces non-alphanumeric chars with hyphens, collapses multiples.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // fall through
    }
  }
  return [];
}

function rowToPage(row: Record<string, unknown>): WikiPage {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    title: row.title as string,
    slug: row.slug as string,
    content: (row.content as string) ?? null,
    content_markdown: (row.content_markdown as string) ?? null,
    category: (row.category as string) ?? null,
    tags: typeof row.tags === "string" ? row.tags : JSON.stringify(parseTags(row.tags)),
    created_by: (row.created_by as string) ?? null,
    last_edited_by: (row.last_edited_by as string) ?? null,
    version: Number(row.version),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToRevision(row: Record<string, unknown>): WikiRevision {
  return {
    id: row.id as string,
    page_id: row.page_id as string,
    version: Number(row.version),
    content: (row.content as string) ?? null,
    edited_by: (row.edited_by as string) ?? null,
    change_summary: (row.change_summary as string) ?? null,
    edited_at: row.edited_at as string,
  };
}

/**
 * Reset the schema-ready flag (for testing only).
 */
export function resetSchemaReady(): void {
  schemaReady = false;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new wiki page.
 * Auto-generates slug from title, sets version to 1, and creates the initial revision.
 */
export async function createPage(input: CreatePageInput): Promise<WikiPage> {
  await ensureSchema();

  const id = randomUUID();
  const slug = generateSlug(input.title);
  const timestamp = now();
  const version = 1;

  const page: WikiPage = {
    id,
    project_id: input.projectId,
    title: input.title,
    slug,
    content: input.content,
    content_markdown: input.content,
    category: input.category ?? null,
    tags: "[]",
    created_by: input.userId ?? null,
    last_edited_by: input.userId ?? null,
    version,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await sqlBatch([
    {
      sql: `INSERT INTO wiki_pages
              (id, project_id, title, slug, content, content_markdown, category, tags, created_by, last_edited_by, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        page.id,
        page.project_id,
        page.title,
        page.slug,
        page.content,
        page.content_markdown,
        page.category,
        page.tags,
        page.created_by,
        page.last_edited_by,
        page.version,
        page.created_at,
        page.updated_at,
      ],
    },
    {
      sql: `INSERT INTO wiki_revisions
              (id, page_id, version, content, edited_by, change_summary, edited_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), id, version, input.content, input.userId ?? null, "Initial creation", timestamp],
    },
  ]);

  return page;
}

/**
 * Get a single wiki page by ID.
 * Returns undefined if not found.
 */
export async function getPage(id: string): Promise<WikiPage | undefined> {
  await ensureSchema();
  const row = await sqlGet("SELECT * FROM wiki_pages WHERE id = ?", [id]);
  return row ? rowToPage(row) : undefined;
}

/**
 * Update a wiki page's content.
 * Increments the version number and creates a new revision record.
 * Returns the updated page, or undefined if the page does not exist.
 */
export async function updatePage(
  id: string,
  input: UpdatePageInput,
): Promise<WikiPage | undefined> {
  await ensureSchema();

  const existing = await sqlGet("SELECT * FROM wiki_pages WHERE id = ?", [id]);
  if (!existing) return undefined;

  const current = rowToPage(existing);
  const newVersion = current.version + 1;
  const timestamp = now();

  await sqlBatch([
    {
      sql: `UPDATE wiki_pages
            SET content = ?, content_markdown = ?, last_edited_by = ?, version = ?, updated_at = ?
            WHERE id = ?`,
      args: [input.content, input.content, input.userId ?? null, newVersion, timestamp, id],
    },
    {
      sql: `INSERT INTO wiki_revisions
              (id, page_id, version, content, edited_by, change_summary, edited_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        id,
        newVersion,
        input.content,
        input.userId ?? null,
        input.changeSummary ?? null,
        timestamp,
      ],
    },
  ]);

  const updated = await sqlGet("SELECT * FROM wiki_pages WHERE id = ?", [id]);
  return updated ? rowToPage(updated) : undefined;
}

/**
 * List wiki pages for a project, optionally filtered by category.
 * Returns pages ordered by updated_at descending (most recently edited first).
 */
export async function listPages(projectId: string, category?: string): Promise<WikiPage[]> {
  await ensureSchema();

  let rows: Record<string, unknown>[];
  if (category) {
    rows = await sqlAll(
      "SELECT * FROM wiki_pages WHERE project_id = ? AND category = ? ORDER BY updated_at DESC",
      [projectId, category],
    );
  } else {
    rows = await sqlAll(
      "SELECT * FROM wiki_pages WHERE project_id = ? ORDER BY updated_at DESC",
      [projectId],
    );
  }

  return rows.map(rowToPage);
}

/**
 * Get the full revision history of a wiki page.
 * Returns revisions ordered by version descending (newest first).
 */
export async function getPageHistory(pageId: string): Promise<WikiRevision[]> {
  await ensureSchema();

  const rows = await sqlAll(
    "SELECT * FROM wiki_revisions WHERE page_id = ? ORDER BY version DESC",
    [pageId],
  );

  return rows.map(rowToRevision);
}
