/**
 * Comments API — list threads and create new threads.
 *
 * GET  /api/comments?entityType=<t>&entityId=<id>  — list threads for an entity
 * POST /api/comments                                — create a new thread
 */

import { NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";
import {
  createThread,
  getThreads,
  getRecentActivity,
} from "../../../src/services/collaboration/commentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * GET /api/comments
 *
 * Query params:
 *   entityType + entityId  — list threads for that entity
 *   projectId + recent     — list recent activity for a project
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  const projectId = url.searchParams.get("projectId");
  const recent = url.searchParams.get("recent");

  try {
    // Recent activity mode
    if (recent === "true" && projectId) {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;
      const activity = await getRecentActivity(projectId, limit);
      return NextResponse.json({ ok: true, activity }, { headers: getCorsHeaders(request) });
    }

    // Entity-scoped thread listing
    if (!entityType || !entityId) {
      return NextResponse.json(
        { ok: false, error: "Missing required query params: entityType and entityId" },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    const threads = await getThreads(entityType, entityId);
    return NextResponse.json({ ok: true, threads }, { headers: getCorsHeaders(request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}

/**
 * POST /api/comments
 *
 * Body: { entityType, entityId, projectId, userId, message }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    const { entityType, entityId, projectId, userId, message } = body as Record<string, unknown>;

    if (
      typeof entityType !== "string" || entityType.trim().length === 0 ||
      typeof entityId !== "string" || entityId.trim().length === 0 ||
      typeof projectId !== "string" || projectId.trim().length === 0 ||
      typeof userId !== "string" || userId.trim().length === 0 ||
      typeof message !== "string" || message.trim().length === 0
    ) {
      return NextResponse.json(
        { ok: false, error: "All fields are required and must be non-empty strings: entityType, entityId, projectId, userId, message" },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    const thread = await createThread(
      entityType.trim(),
      entityId.trim(),
      projectId.trim(),
      userId.trim(),
      message.trim(),
    );

    return NextResponse.json({ ok: true, thread }, { status: 201, headers: getCorsHeaders(request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}
