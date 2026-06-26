/**
 * Plugin API — get and update a single plugin.
 *
 * GET   /api/plugins/[id]   — get plugin details
 * PATCH /api/plugins/[id]   — update plugin fields (status, manifest, packageUrl)
 */

import { NextResponse } from "next/server";
import { PluginRegistry } from "../../../../src/services/plugins/pluginRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registry = new PluginRegistry();

/**
 * GET /api/plugins/[id] — retrieve a plugin by ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const plugin = await registry.get(id);
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }
    return NextResponse.json({ plugin });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/plugins/[id] — update plugin fields.
 *
 * Body: { status?: string, manifest?: PluginManifest, packageUrl?: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const plugin = await registry.update(id, body);
    return NextResponse.json({ plugin });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found")
      ? 404
      : message.includes("Invalid")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
