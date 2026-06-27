import { NextResponse } from "next/server";
import {
  getInventoryStats,
  getExpiringItems,
  getLowStockItems,
} from "@/src/services/inventory/inventoryAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/inventory/analytics
 *
 * Query params:
 *   projectId  - optional project filter
 *   mode       - "stats" (default) | "expiring" | "low-stock"
 *   daysAhead  - for "expiring" mode, number of days to look ahead (default 30)
 *
 * Returns:
 *   mode=stats      -> InventoryStats
 *   mode=expiring   -> { items: ExpiringItem[], daysAhead: number }
 *   mode=low-stock  -> { items: LowStockItem[] }
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const mode = url.searchParams.get("mode") ?? "stats";

    switch (mode) {
      case "stats": {
        const stats = await getInventoryStats(projectId);
        return NextResponse.json(stats);
      }

      case "expiring": {
        const daysAhead = parseInt(url.searchParams.get("daysAhead") ?? "30", 10);
        if (isNaN(daysAhead) || daysAhead < 1) {
          return NextResponse.json(
            { error: "daysAhead must be a positive integer" },
            { status: 400 },
          );
        }
        const items = await getExpiringItems(projectId, daysAhead);
        return NextResponse.json({ items, daysAhead });
      }

      case "low-stock": {
        const items = await getLowStockItems(projectId);
        return NextResponse.json({ items });
      }

      default:
        return NextResponse.json(
          { error: `Invalid mode. Must be one of: stats, expiring, low-stock` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("[inventory/analytics] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory analytics" },
      { status: 500 },
    );
  }
}
