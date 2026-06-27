import { type NextRequest, NextResponse } from "next/server";
import { trackEvent, getEventStats, getUserActivity } from "@/services/business/analyticsService";

export const runtime = "nodejs";

/**
 * POST /api/analytics/events
 *
 * Track a user event.
 *
 * Body:
 *   { userId: string, event: string, properties?: Record<string, unknown>, sessionId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.userId || typeof body.userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (!body.event || typeof body.event !== "string") {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }

    await trackEvent(body.userId, body.event, body.properties, body.sessionId);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/analytics/events
 *
 * Query analytics data. Supports two modes:
 *
 *   ?mode=stats&event=<name>&start=<ms>&end=<ms>
 *     → returns EventStats for the given event and time range.
 *
 *   ?mode=activity&userId=<id>&days=<n>
 *     → returns ActivitySummary for the user over the last n days.
 *
 *   (no mode) defaults to activity for the first user found — or 400.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "activity";

    if (mode === "stats") {
      const event = searchParams.get("event");
      const startStr = searchParams.get("start");
      const endStr = searchParams.get("end");

      if (!event) {
        return NextResponse.json({ error: "event query param is required" }, { status: 400 });
      }
      if (!startStr || !endStr) {
        return NextResponse.json(
          { error: "start and end query params (Unix ms) are required" },
          { status: 400 },
        );
      }

      const start = Number(startStr);
      const end = Number(endStr);
      if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
        return NextResponse.json(
          { error: "start and end must be valid numbers with start < end" },
          { status: 400 },
        );
      }

      const stats = await getEventStats(event, { start, end });
      return NextResponse.json(stats, { status: 200 });
    }

    if (mode === "activity") {
      const userId = searchParams.get("userId");
      const daysStr = searchParams.get("days") ?? "30";

      if (!userId) {
        return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
      }

      const days = Number(daysStr);
      if (Number.isNaN(days) || days <= 0) {
        return NextResponse.json({ error: "days must be a positive number" }, { status: 400 });
      }

      const activity = await getUserActivity(userId, days);
      return NextResponse.json(activity, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Invalid mode. Use "stats" or "activity".' },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
