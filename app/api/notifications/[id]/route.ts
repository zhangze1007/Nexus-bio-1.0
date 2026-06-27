/**
 * Notifications [id] API — per-notification operations.
 *
 * PATCH /api/notifications/[id]  — mark a single notification as read
 */

import { NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../src/utils/cors";
import { markAsRead } from "../../../../src/services/collaboration/notificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/notifications/[id]
 *
 * Mark a single notification as read.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing notification id" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  try {
    await markAsRead(id);
    return NextResponse.json({ ok: true, read: true }, { headers: getCorsHeaders(request) });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    const status = errorMsg.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: errorMsg },
      { status, headers: getCorsHeaders(request) },
    );
  }
}
