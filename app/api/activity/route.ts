import { NextResponse } from "next/server";
import {
  getActivityFeed,
  getActivityCount,
  logActivity,
  type ActivityType,
} from "../../../src/services/collaboration/activityFeed";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIVITY_TYPES = new Set<ActivityType>([
  "experiment_created",
  "task_completed",
  "comment_added",
  "file_uploaded",
  "analysis_run",
  "member_joined",
  "member_left",
  "project_updated",
  "tool_executed",
  "evidence_added",
]);

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * GET /api/activity?projectId=...&limit=...
 *
 * Returns the activity feed for a project.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const limitParam = url.searchParams.get("limit");

  if (!projectId || projectId.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing required parameter: projectId" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  if (limitParam && (Number.isNaN(limit) || limit! < 1)) {
    return NextResponse.json(
      { ok: false, error: "Invalid limit parameter: must be a positive integer" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  try {
    const [items, total] = await Promise.all([
      getActivityFeed(projectId, limit),
      getActivityCount(projectId),
    ]);

    return NextResponse.json(
      {
        ok: true,
        items,
        total,
        projectId,
      },
      { headers: getCorsHeaders(request) },
    );
  } catch (err) {
    console.error("[api/activity] GET error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve activity feed" },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}

/**
 * POST /api/activity
 *
 * Logs a new activity. Body: { projectId, userId, userName, type, details? }
 */
export async function POST(request: Request) {
  // CSRF: require JSON content type
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Invalid content type" },
      { status: 415, headers: getCorsHeaders(request) },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const { projectId, userId, userName, type, details } = body as {
    projectId?: string;
    userId?: string;
    userName?: string;
    type?: string;
    details?: Record<string, unknown>;
  };

  // Validate required fields
  const errors: string[] = [];
  if (!projectId || typeof projectId !== "string" || projectId.trim().length === 0) {
    errors.push("projectId is required");
  }
  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    errors.push("userId is required");
  }
  if (!userName || typeof userName !== "string" || userName.trim().length === 0) {
    errors.push("userName is required");
  }
  if (!type || typeof type !== "string" || !VALID_ACTIVITY_TYPES.has(type as ActivityType)) {
    errors.push(`type is required and must be one of: ${[...VALID_ACTIVITY_TYPES].join(", ")}`);
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", errors },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  try {
    await logActivity(
      projectId!.trim(),
      userId!.trim(),
      userName!.trim(),
      type as ActivityType,
      details && typeof details === "object" ? details : {},
    );

    return NextResponse.json(
      { ok: true, message: "Activity logged" },
      { status: 201, headers: getCorsHeaders(request) },
    );
  } catch (err) {
    console.error("[api/activity] POST error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to log activity" },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}
