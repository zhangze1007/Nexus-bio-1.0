/**
 * Plugin API — install a plugin to a project.
 *
 * POST /api/plugins/[id]/install — install plugin to a project
 *
 * Body: { projectId: string, userId: string, config?: Record<string, unknown> }
 */

import { NextResponse } from "next/server";
import { PluginRegistry } from "../../../../../src/services/plugins/pluginRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registry = new PluginRegistry();

/**
 * POST /api/plugins/[id]/install — install a plugin to a project.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: pluginId } = await params;
    const body = await request.json();
    const { projectId, userId, config } = body as {
      projectId?: string;
      userId?: string;
      config?: Record<string, unknown>;
    };

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing required field: projectId" },
        { status: 400 },
      );
    }
    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 },
      );
    }

    const installation = await registry.install(pluginId, projectId, userId, config);
    return NextResponse.json({ installation }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found")
      ? 404
      : message.includes("not active")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
