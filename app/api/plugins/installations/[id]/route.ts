/**
 * Plugin API — uninstall a plugin installation.
 *
 * DELETE /api/plugins/installations/[id] — remove an installation
 */

import { NextResponse } from "next/server";
import { PluginRegistry } from "../../../../../src/services/plugins/pluginRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registry = new PluginRegistry();

/**
 * DELETE /api/plugins/installations/[id] — uninstall a plugin from a project.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await registry.uninstall(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
