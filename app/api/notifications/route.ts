/**
 * Notifications API — list notifications and mark all as read.
 *
 * GET  /api/notifications?userId=<id>&unreadOnly=true  — list notifications
 * POST /api/notifications                              — create a notification
 * PATCH /api/notifications                             — mark all as read for a user
 */

import { NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";
import {
  createNotification,
  getNotifications,
  markAllAsRead,
  getUnreadCount,
} from "../../../src/services/collaboration/notificationService";
import type { NotificationType } from "../../../src/services/collaboration/notificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * GET /api/notifications
 *
 * Query params:
 *   userId     (required) — the user whose notifications to fetch
 *   unreadOnly (optional) — "true" to filter to unread only
 *   countOnly  (optional) — "true" to return only the unread count
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const countOnly = url.searchParams.get("countOnly") === "true";

  try {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "Missing required query param: userId" },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    if (countOnly) {
      const count = await getUnreadCount(userId.trim());
      return NextResponse.json({ ok: true, count }, { headers: getCorsHeaders(request) });
    }

    const notifications = await getNotifications(userId.trim(), unreadOnly);
    return NextResponse.json({ ok: true, notifications }, { headers: getCorsHeaders(request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}

/**
 * POST /api/notifications
 *
 * Body: { userId, type, title, body, link? }
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

    const { userId, type, title, body: notifBody, link } = body as Record<string, unknown>;

    const validTypes: NotificationType[] = ["mention", "comment", "assignment", "review", "system", "alert"];

    if (
      typeof userId !== "string" || userId.trim().length === 0 ||
      typeof type !== "string" || !validTypes.includes(type as NotificationType) ||
      typeof title !== "string" || title.trim().length === 0 ||
      typeof notifBody !== "string" || notifBody.trim().length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "userId, type (mention|comment|assignment|review|system|alert), title, and body are required and must be non-empty strings",
        },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    if (link !== undefined && link !== null && typeof link !== "string") {
      return NextResponse.json(
        { ok: false, error: "link must be a string if provided" },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    const notification = await createNotification(
      userId.trim(),
      type as NotificationType,
      title.trim(),
      notifBody.trim(),
      typeof link === "string" ? link.trim() : undefined,
    );

    return NextResponse.json({ ok: true, notification }, { status: 201, headers: getCorsHeaders(request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}

/**
 * PATCH /api/notifications
 *
 * Mark all unread notifications as read for a user.
 * Body: { userId, action: "markAllRead" }
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    const { userId, action } = body as Record<string, unknown>;

    if (typeof userId !== "string" || userId.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "userId is required and must be a non-empty string" },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    if (action !== "markAllRead") {
      return NextResponse.json(
        { ok: false, error: 'action must be "markAllRead"' },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    const marked = await markAllAsRead(userId.trim());
    return NextResponse.json({ ok: true, marked }, { headers: getCorsHeaders(request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}
