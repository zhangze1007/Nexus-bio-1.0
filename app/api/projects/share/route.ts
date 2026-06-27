/**
 * Project share links API — POST create, GET list, DELETE revoke.
 *
 * Runtime: Node.js (requires filesystem access for local SQLite).
 */

import { NextResponse } from "next/server";
import {
  shareProject,
  listShareLinks,
  revokeShareLink,
  type SharePermission,
} from "../../../../src/services/collaboration/projectSharing";
import { getCorsHeaders, handleOptions } from "../../../../src/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PERMISSIONS = new Set<SharePermission>(["view", "comment", "edit"]);

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * POST /api/projects/share
 * Body: { projectId, userId, permission?, ttlMs? }
 * Creates a new share link.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const ALLOWED_ORIGINS = [
    "https://nexus-bio-1-0.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
  ];
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden: invalid origin" },
      { status: 403, headers: getCorsHeaders(request) },
    );
  }

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
      { ok: false, error: "Invalid request body" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const { projectId, userId, permission, ttlMs } = body as {
    projectId?: string;
    userId?: string;
    permission?: string;
    ttlMs?: number;
  };

  if (!projectId || typeof projectId !== "string" || projectId.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid projectId" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid userId" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const resolvedPermission: SharePermission =
    typeof permission === "string" && VALID_PERMISSIONS.has(permission as SharePermission)
      ? (permission as SharePermission)
      : "view";

  const resolvedTtl = typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : null;

  try {
    const link = await shareProject(projectId.trim(), userId.trim(), resolvedPermission, resolvedTtl);
    return NextResponse.json({ ok: true, link }, { headers: getCorsHeaders(request) });
  } catch (err) {
    console.error("[api/projects/share] POST error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to create share link" },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}

/**
 * GET /api/projects/share?projectId=<id>
 * Lists all active share links for a project.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId || projectId.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing projectId query parameter" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  try {
    const links = await listShareLinks(projectId.trim());
    return NextResponse.json({ ok: true, links }, { headers: getCorsHeaders(request) });
  } catch (err) {
    console.error("[api/projects/share] GET error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to list share links" },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}

/**
 * DELETE /api/projects/share?token=<token>
 * Revokes (deletes) a share link.
 */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token || token.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing token query parameter" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  try {
    await revokeShareLink(token.trim());
    return NextResponse.json({ ok: true }, { headers: getCorsHeaders(request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json(
        { ok: false, error: message },
        { status: 404, headers: getCorsHeaders(request) },
      );
    }
    console.error("[api/projects/share] DELETE error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to revoke share link" },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}
