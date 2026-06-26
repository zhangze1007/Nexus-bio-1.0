/**
 * Webhook API — register and list webhooks.
 *
 * POST /api/webhooks           — register a new webhook
 * GET  /api/webhooks?orgId=xxx — list webhooks (optionally filtered by org)
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  listWebhooks,
  registerWebhook,
} from "../../../src/services/webhooks/webhookDispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks — register a new webhook subscription.
 *
 * Body: { orgId: string, url: string, events: string[] }
 *
 * Returns the created webhook with its secret (shown once).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, url, events } = body as {
      orgId?: string;
      url?: string;
      events?: string[];
    };

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing required field: orgId" },
        { status: 400 },
      );
    }
    if (!url) {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 },
      );
    }
    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty required field: events (must be a non-empty array)" },
        { status: 400 },
      );
    }

    const webhook = await registerWebhook({ orgId, url, events });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Invalid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/webhooks?orgId=xxx — list webhooks.
 *
 * Returns all webhooks, optionally filtered by orgId.
 * Secrets are redacted in the response for security.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId") ?? undefined;

    const webhooks = await listWebhooks(orgId);

    // Redact secrets in the listing — callers should have stored the secret at registration time
    const safeWebhooks = webhooks.map((wh) => ({
      ...wh,
      secret: `${wh.secret.slice(0, 8)}...`,
    }));

    return NextResponse.json({ webhooks: safeWebhooks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
