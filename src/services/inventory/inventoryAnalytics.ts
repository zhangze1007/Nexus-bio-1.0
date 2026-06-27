/**
 * Inventory analytics service.
 *
 * Provides aggregate statistics, expiry alerts, and low-stock warnings
 * across all inventory item types (strains, plasmids, primers, chemicals).
 *
 * Uses raw SQL via `sqlAll` / `sqlGet` from `@/src/lib/db` to match the
 * existing inventory API conventions.
 */

import { sqlAll, sqlGet } from "@/src/lib/db";

// ── Types ──────────────────────────────────────────────────────────────

export interface InventoryStats {
  totalItems: number;
  byType: {
    strains: number;
    plasmids: number;
    primers: number;
    chemicals: number;
  };
  expiringCount: number;
  lowStockCount: number;
}

export interface ExpiringItem {
  id: string;
  name: string;
  type: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  type: string;
  quantityRemaining: number | null;
  quantityUnit: string | null;
  reorderThreshold: number | null;
  aliquotCount: number | null;
}

// ── Constants ──────────────────────────────────────────────────────────

const ITEM_TABLES = [
  { type: "strains", table: "inventory_strains" },
  { type: "plasmids", table: "inventory_plasmids" },
  { type: "primers", table: "inventory_primers" },
  { type: "chemicals", table: "inventory_chemicals" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────

function projectIdClause(projectId?: string): { sql: string; args: unknown[] } {
  if (projectId) {
    return { sql: ` AND project_id = ?`, args: [projectId] };
  }
  return { sql: "", args: [] };
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Get aggregate inventory statistics for a project.
 *
 * Counts total items (non-archived) across all 4 item tables,
 * breaks down by type, and includes counts of expiring and low-stock items.
 *
 * @param projectId  Optional project filter. When omitted, counts across all projects.
 * @returns InventoryStats with totalItems, byType, expiringCount, lowStockCount.
 */
export async function getInventoryStats(projectId?: string): Promise<InventoryStats> {
  const byType = { strains: 0, plasmids: 0, primers: 0, chemicals: 0 };
  let totalItems = 0;

  // Count items per table in parallel
  const countPromises = ITEM_TABLES.map(async ({ type, table }) => {
    const { sql: pidSql, args: pidArgs } = projectIdClause(projectId);
    const row = await sqlGet(
      `SELECT COUNT(*) as cnt FROM ${table} WHERE archived = 0${pidSql}`,
      pidArgs,
    );
    const count = Number(row?.cnt ?? 0);
    byType[type] = count;
    return count;
  });

  const counts = await Promise.all(countPromises);
  totalItems = counts.reduce((sum, c) => sum + c, 0);

  // Count expiring chemicals (within 30 days)
  const { sql: pidSql, args: pidArgs } = projectIdClause(projectId);
  const expiringRow = await sqlGet(
    `SELECT COUNT(*) as cnt FROM inventory_chemicals
     WHERE archived = 0
       AND expiry_date IS NOT NULL
       AND expiry_date != ''
       AND date(expiry_date) <= date('now', '+30 days')
       AND date(expiry_date) >= date('now')${pidSql}`,
    pidArgs,
  );
  const expiringCount = Number(expiringRow?.cnt ?? 0);

  // Count low-stock items:
  //   chemicals where quantity_remaining <= reorder_threshold
  //   strains where aliquot_count <= 2 (low aliquot heuristic)
  const lowChemicalRow = await sqlGet(
    `SELECT COUNT(*) as cnt FROM inventory_chemicals
     WHERE archived = 0
       AND reorder_threshold IS NOT NULL
       AND quantity_remaining IS NOT NULL
       AND quantity_remaining <= reorder_threshold${pidSql}`,
    pidArgs,
  );
  const lowStrainRow = await sqlGet(
    `SELECT COUNT(*) as cnt FROM inventory_strains
     WHERE archived = 0
       AND aliquot_count IS NOT NULL
       AND aliquot_count <= 2${pidSql}`,
    pidArgs,
  );
  const lowStockCount =
    Number(lowChemicalRow?.cnt ?? 0) + Number(lowStrainRow?.cnt ?? 0);

  return { totalItems, byType, expiringCount, lowStockCount };
}

/**
 * Get items expiring within a given number of days.
 *
 * Searches chemicals table for items with an `expiry_date` that falls
 * between now and `daysAhead` from now.
 *
 * @param projectId   Optional project filter.
 * @param daysAhead   Number of days to look ahead (default 30).
 * @returns Array of ExpiringItem, sorted by expiry date ascending.
 */
export async function getExpiringItems(
  projectId?: string,
  daysAhead: number = 30,
): Promise<ExpiringItem[]> {
  const { sql: pidSql, args: pidArgs } = projectIdClause(projectId);

  const rows = await sqlAll(
    `SELECT
       id,
       name,
       'chemical' as type,
       expiry_date as expiryDate,
       CAST(julianday(expiry_date) - julianday('now') AS INTEGER) as daysUntilExpiry
     FROM inventory_chemicals
     WHERE archived = 0
       AND expiry_date IS NOT NULL
       AND expiry_date != ''
       AND date(expiry_date) <= date('now', '+' || ? || ' days')
       AND date(expiry_date) >= date('now')${pidSql}
     ORDER BY expiry_date ASC`,
    [daysAhead, ...pidArgs],
  );

  return rows.map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    type: String(row.type ?? "chemical"),
    expiryDate: String(row.expiryDate ?? ""),
    daysUntilExpiry: Number(row.daysUntilExpiry ?? 0),
  }));
}

/**
 * Get items that are below their reorder threshold or critically low.
 *
 * Includes:
 *   - Chemicals where `quantity_remaining <= reorder_threshold`
 *   - Strains where `aliquot_count <= 2`
 *
 * @param projectId  Optional project filter.
 * @returns Array of LowStockItem, sorted by type then name.
 */
export async function getLowStockItems(
  projectId?: string,
): Promise<LowStockItem[]> {
  const { sql: pidSql, args: pidArgs } = projectIdClause(projectId);

  // Low-stock chemicals
  const chemicalRows = await sqlAll(
    `SELECT
       id,
       name,
       'chemical' as type,
       quantity_remaining as quantityRemaining,
       quantity_unit as quantityUnit,
       reorder_threshold as reorderThreshold,
       NULL as aliquotCount
     FROM inventory_chemicals
     WHERE archived = 0
       AND reorder_threshold IS NOT NULL
       AND quantity_remaining IS NOT NULL
       AND quantity_remaining <= reorder_threshold${pidSql}
     ORDER BY name ASC`,
    pidArgs,
  );

  // Low-aliquot strains
  const strainRows = await sqlAll(
    `SELECT
       id,
       name,
       'strain' as type,
       NULL as quantityRemaining,
       NULL as quantityUnit,
       NULL as reorderThreshold,
       aliquot_count as aliquotCount
     FROM inventory_strains
     WHERE archived = 0
       AND aliquot_count IS NOT NULL
       AND aliquot_count <= 2${pidSql}
     ORDER BY name ASC`,
    pidArgs,
  );

  const allRows = [...chemicalRows, ...strainRows];

  return allRows.map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    type: String(row.type ?? ""),
    quantityRemaining: row.quantityRemaining != null ? Number(row.quantityRemaining) : null,
    quantityUnit: row.quantityUnit != null ? String(row.quantityUnit) : null,
    reorderThreshold: row.reorderThreshold != null ? Number(row.reorderThreshold) : null,
    aliquotCount: row.aliquotCount != null ? Number(row.aliquotCount) : null,
  }));
}
