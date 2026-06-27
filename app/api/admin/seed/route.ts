/**
 * Admin Seed API — POST to seed reference data or create demo projects.
 *
 * POST /api/admin/seed
 *   body: { "action": "reference-data" }    → seeds all reference tables
 *   body: { "action": "demo-project", "userId": "..." } → creates demo project
 *
 * GET /api/admin/seed → returns current seed status
 *
 * Runtime: nodejs (requires file-system DB access)
 */

import { NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../src/utils/cors";
import {
  seedReferenceData,
  seedDemoProject,
  getSeedStatus,
} from "../../../../src/server/seeds/seedService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function GET(req: Request) {
  try {
    const status = await getSeedStatus();
    return NextResponse.json(status, {
      status: 200,
      headers: getCorsHeaders(req),
    });
  } catch (error) {
    console.error('[api/admin/seed] GET error:', error);
    return NextResponse.json(
      { error: "Failed to get seed status" },
      { status: 500, headers: getCorsHeaders(req) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    const { action } = body as { action?: string };

    if (action === "reference-data") {
      const result = await seedReferenceData();
      return NextResponse.json(result, {
        status: 200,
        headers: getCorsHeaders(req),
      });
    }

    if (action === "demo-project") {
      const { userId } = body as { userId?: string };
      if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
        return NextResponse.json(
          { error: "userId is required for demo-project action" },
          { status: 400, headers: getCorsHeaders(req) },
        );
      }
      const projectId = await seedDemoProject(userId.trim());
      return NextResponse.json({ projectId }, {
        status: 200,
        headers: getCorsHeaders(req),
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Use "reference-data" or "demo-project".` },
      { status: 400, headers: getCorsHeaders(req) },
    );
  } catch (error) {
    console.error('[api/admin/seed] POST error:', error);
    return NextResponse.json(
      { error: "Seed operation failed" },
      { status: 500, headers: getCorsHeaders(req) },
    );
  }
}
