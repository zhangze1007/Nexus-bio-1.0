/**
 * Plugin API — list and register plugins.
 *
 * GET  /api/plugins              — list plugins (optional ?orgId=&status= filters)
 * POST /api/plugins              — register a new plugin
 */

import { NextResponse } from "next/server";
import { PluginRegistry } from "../../../src/services/plugins/pluginRegistry";
import type { PluginManifest } from "../../../src/services/plugins/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registry = new PluginRegistry();

/**
 * GET /api/plugins — list plugins with optional filters.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;

    const plugins = await registry.list({ orgId, status });
    return NextResponse.json({ plugins });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/plugins — register a new plugin.
 *
 * Body: { manifest: PluginManifest, packageUrl: string, userId: string, orgId?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { manifest, packageUrl, userId, orgId } = body as {
      manifest?: PluginManifest;
      packageUrl?: string;
      userId?: string;
      orgId?: string;
    };

    if (!manifest) {
      return NextResponse.json(
        { error: "Missing required field: manifest" },
        { status: 400 },
      );
    }
    if (!packageUrl) {
      return NextResponse.json(
        { error: "Missing required field: packageUrl" },
        { status: 400 },
      );
    }
    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 },
      );
    }

    const plugin = await registry.register(manifest, packageUrl, userId, orgId);
    return NextResponse.json({ plugin }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Invalid manifest") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
