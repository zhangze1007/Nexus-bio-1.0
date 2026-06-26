/**
 * Audit Log API — GET paginated audit entries.
 *
 * GET /api/audit/log?projectId=xxx&entityType=xxx&limit=50&offset=0
 *
 * Returns paginated audit log entries, ordered by sequence_number descending.
 */

import { type NextRequest, NextResponse } from "next/server";
import { sqlAll, sqlGet } from "../../../../src/server/libsqlDb";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const entityType = url.searchParams.get("entityType");
    const action = url.searchParams.get("action");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50"), 1), 500);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (projectId) {
      conditions.push("project_id = ?");
      params.push(projectId);
    }
    if (entityType) {
      conditions.push("entity_type = ?");
      params.push(entityType);
    }
    if (action) {
      conditions.push("action = ?");
      params.push(action);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countRow = await sqlGet(
      `SELECT COUNT(*) as total FROM audit_log ${whereClause}`,
      params,
    );
    const total = Number(countRow?.total ?? 0);

    // Get paginated entries
    const entries = await sqlAll(
      `SELECT id, sequence_number, timestamp, actor_id, actor_name, actor_email,
              action, entity_type, entity_id, project_id, change_summary, hash
       FROM audit_log ${whereClause}
       ORDER BY sequence_number DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return NextResponse.json({
      entries,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[audit/log] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 },
    );
  }
}
