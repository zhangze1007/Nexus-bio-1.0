/**
 * Comments [id] API — per-thread operations.
 *
 * GET   /api/comments/[id]  — get a single thread with all replies
 * POST  /api/comments/[id]  — add a reply to the thread
 * PATCH /api/comments/[id]  — resolve the thread
 */

import { NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../src/utils/cors";
import {
  replyToThread,
  resolveThread,
  getThreads,
  ensureCommentSchema,
} from "../../../../src/services/collaboration/commentService";
import { sqlGet } from "../../../../src/server/libsqlDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/comments/[id]
 *
 * Returns a single thread with all its replies.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing thread id" },
      { status: 400, headers: getCorsHeaders(_request) },
    );
  }

  try {
    await ensureCommentSchema();

    const thread = await sqlGet(
      `SELECT id, entity_type, entity_id, project_id, created_by, resolved, created_at
       FROM comment_threads WHERE id = ?`,
      [id],
    );

    if (!thread) {
      return NextResponse.json(
        { ok: false, error: "Thread not found" },
        { status: 404, headers: getCorsHeaders(_request) },
      );
    }

    // Reuse getThreads to get thread with replies
    const threads = await getThreads(
      thread.entity_type as string,
      thread.entity_id as string,
    );

    const found = threads.find((t) => t.id === id);
    if (!found) {
      return NextResponse.json(
        { ok: false, error: "Thread not found" },
        { status: 404, headers: getCorsHeaders(_request) },
      );
    }

    return NextResponse.json({ ok: true, thread: found }, { headers: getCorsHeaders(_request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: getCorsHeaders(_request) },
    );
  }
}

/**
 * POST /api/comments/[id]
 *
 * Add a reply to an existing thread.
 * Body: { userId, message }
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing thread id" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    const { userId, message } = body as Record<string, unknown>;

    if (
      typeof userId !== "string" || userId.trim().length === 0 ||
      typeof message !== "string" || message.trim().length === 0
    ) {
      return NextResponse.json(
        { ok: false, error: "userId and message are required and must be non-empty strings" },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    const reply = await replyToThread(id, userId.trim(), message.trim());
    return NextResponse.json({ ok: true, reply }, { status: 201, headers: getCorsHeaders(request) });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    const status = errorMsg.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status, headers: getCorsHeaders(request) },
    );
  }
}

/**
 * PATCH /api/comments/[id]
 *
 * Resolve a thread.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing thread id" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  try {
    await resolveThread(id);
    return NextResponse.json({ ok: true, resolved: true }, { headers: getCorsHeaders(request) });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    const status = errorMsg.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status, headers: getCorsHeaders(request) },
    );
  }
}
