/**
 * Inventory export service.
 *
 * Provides CSV and JSON export for inventory items, plus full inventory
 * report generation that aggregates across all item types.
 *
 * CSV generation follows RFC-4180: fields containing commas, double-quotes,
 * or newlines are wrapped in double-quotes with internal quotes doubled.
 *
 * Uses raw SQL via `sqlAll` from `@/src/lib/db` to match the existing
 * inventory service conventions (inventoryAnalytics.ts).
 */

import { sqlAll } from "@/src/lib/db";

// ── Types ──────────────────────────────────────────────────────────────

export interface ReportSummary {
  total: number;
  byType: { strains: number; plasmids: number; primers: number; chemicals: number };
  expiring: number;
  lowStock: number;
}

export interface InventoryReport {
  summary: ReportSummary;
  items: {
    strains: Record<string, unknown>[];
    plasmids: Record<string, unknown>[];
    primers: Record<string, unknown>[];
    chemicals: Record<string, unknown>[];
  };
  generatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const ITEM_TABLES = [
  { type: "strains", table: "inventory_strains" },
  { type: "plasmids", table: "inventory_plasmids" },
  { type: "primers", table: "inventory_primers" },
  { type: "chemicals", table: "inventory_chemicals" },
] as const;

// ── CSV Helpers ────────────────────────────────────────────────────────

/**
 * Escape a single field for RFC-4180 CSV output.
 *
 * - null/undefined become empty string
 * - values containing commas, double-quotes, or newlines are quoted
 * - internal double-quotes are doubled (" -> "")
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Export an array of inventory items to CSV format.
 *
 * The first row is the header, derived from the union of all keys across
 * the provided items. Each subsequent row is one item. Values are
 * RFC-4180 escaped.
 *
 * @param items  Array of item records (plain objects).
 * @param type   Inventory type label (e.g. "strains", "plasmids"). Used
 *               only for metadata; does not affect the column set.
 * @returns RFC-4180 compliant CSV string with trailing newline.
 */
export function exportToCSV(items: Record<string, unknown>[], type: string): string {
  if (items.length === 0) return "";

  // Collect all unique keys in insertion order, preserving first-seen order
  const headerSet = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      headerSet.add(key);
    }
  }
  const headers = Array.from(headerSet);

  const lines: string[] = [];

  // Header row
  lines.push(headers.map(escapeCSVField).join(","));

  // Data rows
  for (const item of items) {
    const row = headers.map((h) => escapeCSVField(item[h]));
    lines.push(row.join(","));
  }

  return lines.join("\n") + "\n";
}

/**
 * Export an array of inventory items to a formatted JSON string.
 *
 * Wraps the items in an envelope with a `type` field and `exportedAt`
 * ISO timestamp. The JSON is pretty-printed with 2-space indentation.
 *
 * @param items  Array of item records (plain objects).
 * @param type   Inventory type label (e.g. "strains", "plasmids").
 * @returns Pretty-printed JSON string.
 */
export function exportToJSON(items: Record<string, unknown>[], type: string): string {
  const envelope = {
    type,
    count: items.length,
    exportedAt: new Date().toISOString(),
    items,
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Generate a full inventory report for a project.
 *
 * Queries all four item tables (strains, plasmids, primers, chemicals)
 * for non-archived items belonging to the given project, computes
 * summary statistics (total, by-type, expiring chemicals, low-stock),
 * and returns everything in a structured report.
 *
 * @param projectId  The project to generate the report for.
 * @returns InventoryReport with summary, per-type item arrays, and timestamp.
 */
export async function generateInventoryReport(projectId: string): Promise<InventoryReport> {
  const pidArgs = [projectId];

  // ── Fetch all items per type ──────────────────────────────────────

  const [strainRows, plasmidRows, primerRows, chemicalRows] = await Promise.all(
    ITEM_TABLES.map(({ table }) => sqlAll(`SELECT * FROM ${table} WHERE archived = 0 AND project_id = ?`, pidArgs)),
  );

  const byType = {
    strains: strainRows.length,
    plasmids: plasmidRows.length,
    primers: primerRows.length,
    chemicals: chemicalRows.length,
  };
  const total = byType.strains + byType.plasmids + byType.primers + byType.chemicals;

  // ── Expiring chemicals (within 30 days, not yet past) ─────────────

  const expiringRows = await sqlAll(
    `SELECT COUNT(*) as cnt FROM inventory_chemicals
     WHERE archived = 0
       AND project_id = ?
       AND expiry_date IS NOT NULL
       AND expiry_date != ''
       AND date(expiry_date) <= date('now', '+30 days')
       AND date(expiry_date) >= date('now')`,
    pidArgs,
  );
  const expiring = Number(expiringRows[0]?.cnt ?? 0);

  // ── Low-stock items ───────────────────────────────────────────────

  const lowChemicalRows = await sqlAll(
    `SELECT COUNT(*) as cnt FROM inventory_chemicals
     WHERE archived = 0
       AND project_id = ?
       AND reorder_threshold IS NOT NULL
       AND quantity_remaining IS NOT NULL
       AND quantity_remaining <= reorder_threshold`,
    pidArgs,
  );

  const lowStrainRows = await sqlAll(
    `SELECT COUNT(*) as cnt FROM inventory_strains
     WHERE archived = 0
       AND project_id = ?
       AND aliquot_count IS NOT NULL
       AND aliquot_count <= 2`,
    pidArgs,
  );

  const lowStock = Number(lowChemicalRows[0]?.cnt ?? 0) + Number(lowStrainRows[0]?.cnt ?? 0);

  return {
    summary: { total, byType, expiring, lowStock },
    items: {
      strains: strainRows,
      plasmids: plasmidRows,
      primers: primerRows,
      chemicals: chemicalRows,
    },
    generatedAt: new Date().toISOString(),
  };
}
