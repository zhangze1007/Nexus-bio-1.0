/**
 * Inventory search service.
 *
 * Provides full-text search across all inventory item types (strains,
 * plasmids, primers, chemicals) using SQL LIKE queries. Returns ranked
 * results with relevance scores and highlight snippets.
 *
 * Also provides autocomplete suggestions for quick item lookup.
 *
 * Uses raw SQL via `sqlAll` from `@/src/lib/db` to match the existing
 * inventory service conventions (inventoryAnalytics.ts, inventoryImport.ts).
 */

import { sqlAll } from "@/src/lib/db";

// ── Types ──────────────────────────────────────────────────────────────

export type InventoryItemType = "strain" | "plasmid" | "primer" | "chemical";

export interface SearchResult {
  type: InventoryItemType;
  id: string;
  name: string;
  relevance: number;
  highlights: string[];
}

// ── Constants ──────────────────────────────────────────────────────────

/**
 * Table definitions with the searchable columns for each item type.
 * The `name` column is always searched; additional columns provide
 * type-specific search fields.
 */
const ITEM_TABLES: {
  type: InventoryItemType;
  table: string;
  columns: string[];
}[] = [
  {
    type: "strain",
    table: "inventory_strains",
    columns: ["name", "genotype", "species", "source", "resistance_markers", "notes"],
  },
  {
    type: "plasmid",
    table: "inventory_plasmids",
    columns: ["name", "backbone", "insert_description", "resistance", "promoter", "notes"],
  },
  {
    type: "primer",
    table: "inventory_primers",
    columns: ["name", "sequence_5to3", "target_gene", "vendor", "notes"],
  },
  {
    type: "chemical",
    table: "inventory_chemicals",
    columns: ["name", "cas_number", "molecular_formula", "vendor", "catalog_number", "notes"],
  },
];

const SUGGESTION_LIMIT = 10;

// ── Helpers ────────────────────────────────────────────────────────────

function projectIdClause(projectId?: string): { sql: string; args: unknown[] } {
  if (projectId) {
    return { sql: ` AND project_id = ?`, args: [projectId] };
  }
  return { sql: "", args: [] };
}

/**
 * Build a SQL WHERE clause fragment that searches across multiple columns
 * using OR-ed LIKE conditions. Returns the fragment and the bound args.
 */
function buildSearchClause(query: string, columns: string[]): { sql: string; args: unknown[] } {
  const likeValue = `%${query}%`;
  const conditions = columns.map((col) => `${col} LIKE ?`);
  return {
    sql: `(${conditions.join(" OR ")})`,
    args: columns.map(() => likeValue),
  };
}

/**
 * Compute a relevance score for a row based on how closely the query
 * matches the item name.
 *
 * Scoring tiers:
 *   1.0  — exact (case-insensitive) name match
 *   0.8  — name starts with query
 *   0.6  — name contains query
 *   0.4  — match in a secondary column (not name)
 *
 * The score is clamped to [0, 1].
 */
function computeRelevance(query: string, name: string, nameMatched: boolean): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();

  if (!nameMatched) return 0.4;

  if (n === q) return 1.0;
  if (n.startsWith(q)) return 0.8;
  return 0.6;
}

/**
 * Extract highlight snippets from a row. Returns up to 3 short text
 * fragments that contain the query substring, truncated with ellipsis
 * for readability.
 */
function extractHighlights(query: string, row: Record<string, unknown>, columns: string[]): string[] {
  const q = query.toLowerCase();
  const highlights: string[] = [];

  for (const col of columns) {
    const value = row[col];
    if (value == null) continue;

    const str = String(value);
    if (!str.toLowerCase().includes(q)) continue;

    // Truncate long values around the match
    const idx = str.toLowerCase().indexOf(q);
    const start = Math.max(0, idx - 20);
    const end = Math.min(str.length, idx + query.length + 20);
    let snippet = str.slice(start, end);

    if (start > 0) snippet = `...${snippet}`;
    if (end < str.length) snippet = `${snippet}...`;

    highlights.push(snippet);

    if (highlights.length >= 3) break;
  }

  return highlights;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Search across all inventory tables for items matching the query string.
 *
 * Performs a case-insensitive LIKE search across type-specific columns
 * (name, genotype, backbone, sequence, cas_number, etc.). Results are
 * ranked by relevance and optionally filtered by project and item type.
 *
 * @param query      The search string. Must be at least 1 character.
 * @param projectId  Optional project filter. When omitted, searches all projects.
 * @param types      Optional array of item types to search. When omitted, searches all types.
 * @returns Array of SearchResult sorted by relevance descending, then name ascending.
 */
export async function searchInventory(
  query: string,
  projectId?: string,
  types?: InventoryItemType[],
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const { sql: pidSql, args: pidArgs } = projectIdClause(projectId);
  const tablesToSearch = types ? ITEM_TABLES.filter((t) => types.includes(t.type)) : ITEM_TABLES;

  // Execute all table searches in parallel
  const searchPromises = tablesToSearch.map(async ({ type, table, columns }) => {
    const { sql: searchSql, args: searchArgs } = buildSearchClause(trimmed, columns);
    const sql = `SELECT * FROM ${table} WHERE archived = 0${pidSql} AND ${searchSql}`;
    const rows = await sqlAll(sql, [...pidArgs, ...searchArgs]);

    return rows.map((row) => {
      const name = String(row.name ?? "");
      const nameColumn = columns[0]; // first column is always "name"
      const nameLikeValue = `%${trimmed}%`;

      // Check if the name column specifically matched
      const nameMatched = name.toLowerCase().includes(trimmed.toLowerCase());

      const relevance = computeRelevance(trimmed, name, nameMatched);
      const highlights = extractHighlights(trimmed, row, columns);

      return {
        type,
        id: String(row.id ?? ""),
        name,
        relevance,
        highlights,
      };
    });
  });

  const resultsPerTable = await Promise.all(searchPromises);
  const allResults = resultsPerTable.flat();

  // Sort by relevance descending, then name ascending
  allResults.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return a.name.localeCompare(b.name);
  });

  return allResults;
}

/**
 * Get autocomplete suggestions for a partial query string.
 *
 * Searches the `name` column across all inventory tables and returns
 * up to 10 unique, alphabetically sorted name suggestions. Useful for
 * typeahead / autocomplete UI components.
 *
 * @param query  The partial search string. Must be at least 1 character.
 * @returns Array of suggestion strings, sorted alphabetically.
 */
export async function getSearchSuggestions(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const likeValue = `%${trimmed}%`;

  // Search names across all tables in parallel
  const suggestionPromises = ITEM_TABLES.map(async ({ table }) => {
    const rows = await sqlAll(`SELECT name FROM ${table} WHERE archived = 0 AND name LIKE ? LIMIT ?`, [
      likeValue,
      SUGGESTION_LIMIT,
    ]);
    return rows.map((row) => String(row.name ?? ""));
  });

  const resultsPerTable = await Promise.all(suggestionPromises);
  const allNames = resultsPerTable.flat();

  // Deduplicate (case-insensitive) and sort
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const name of allNames) {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(name);
    }
  }

  unique.sort((a, b) => a.localeCompare(b));

  return unique.slice(0, SUGGESTION_LIMIT);
}
