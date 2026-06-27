/**
 * Feedback API — GET list / POST submit.
 *
 * POST /api/feedback  { userId, type, description, pageUrl? }
 * GET  /api/feedback?status=open
 */

import { NextResponse } from "next/server";
import {
  listFeedback,
  submitFeedback,
  updateFeedbackStatus,
} from "../../../src/services/business/feedbackService";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");

  const validStatuses = ["open", "in_review", "resolved", "closed"];
  const statusFilter =
    statusParam && validStatuses.includes(statusParam)
      ? (statusParam as "open" | "in_review" | "resolved" | "closed")
      : undefined;

  try {
    const feedback = await listFeedback(statusFilter);
    return NextResponse.json({ ok: true, feedback }, { headers: getCorsHeaders(request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: getCorsHeaders(request) });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const { userId, type, description, pageUrl } = body as Record<string, unknown>;

  if (typeof userId !== "string" || userId.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "userId is required and must be a non-empty string" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }
  if (typeof type !== "string" || !["bug", "feature_request", "general"].includes(type)) {
    return NextResponse.json(
      { ok: false, error: "type must be one of: bug, feature_request, general" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "description is required and must be a non-empty string" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  try {
    const feedback = await submitFeedback(
      userId as string,
      type as "bug" | "feature_request" | "general",
      description as string,
      typeof pageUrl === "string" ? pageUrl : undefined,
    );
    return NextResponse.json({ ok: true, feedback }, { status: 201, headers: getCorsHeaders(request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Invalid feedback type") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status, headers: getCorsHeaders(request) });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const { id, status } = body as Record<string, unknown>;

  if (typeof id !== "string" || id.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "id is required and must be a non-empty string" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }
  if (typeof status !== "string" || !["open", "in_review", "resolved", "closed"].includes(status)) {
    return NextResponse.json(
      { ok: false, error: "status must be one of: open, in_review, resolved, closed" },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  try {
    await updateFeedbackStatus(id, status as "open" | "in_review" | "resolved" | "closed");
    return NextResponse.json({ ok: true }, { headers: getCorsHeaders(request) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status, headers: getCorsHeaders(request) });
  }
}
