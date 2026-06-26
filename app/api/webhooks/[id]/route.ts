/**
 * Webhook API — delete a single webhook.
 *
 * DELETE /api/webhooks/[id] — remove a webhook and its delivery history
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  deleteWebhook,
  getDeliveries,
  getWebhook,
} from "../../../../src/services/webhooks/webhookDispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/[id] — get webhook details and recent deliveries.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const webhook = await getWebhook(id);
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const deliveries = await getDeliveries(id, 50);

    // Redact secret in response
    return NextResponse.json({
      webhook: { ...webhook, secret: `${webhook.secret.slice(0, 8)}...` },
      deliveries,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/webhooks/[id] — remove a webhook subscription.
 *
 * Cascade-deletes all associated delivery records.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteWebhook(id);
    if (!deleted) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
