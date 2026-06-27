/**
 * Feature Flags Admin API
 *
 * GET  /api/admin/flags  — List all feature flags.
 * POST /api/admin/flags  — Create or update a feature flag.
 *
 * Body (POST): { name: string, enabled: boolean, rolloutPercentage?: number }
 */

import { NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../src/utils/cors";
import {
  getAllFlags,
  setFlag,
  deleteFlag,
} from "../../../../src/services/infra/featureFlags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  OPTIONS                                                            */
/* ------------------------------------------------------------------ */

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/* ------------------------------------------------------------------ */
/*  GET /api/admin/flags                                               */
/* ------------------------------------------------------------------ */

export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const flags = await getAllFlags();
    return NextResponse.json({ ok: true, flags }, { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/admin/flags                                              */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { name, enabled, rolloutPercentage, action } = body as {
      name?: string;
      enabled?: boolean;
      rolloutPercentage?: number;
      action?: string;
    };

    // Handle delete action
    if (action === "delete") {
      if (!name || typeof name !== "string") {
        return NextResponse.json(
          { error: "name is required for delete action" },
          { status: 400, headers: corsHeaders },
        );
      }
      const deleted = await deleteFlag(name);
      if (!deleted) {
        return NextResponse.json(
          { error: `Flag '${name}' not found` },
          { status: 404, headers: corsHeaders },
        );
      }
      return NextResponse.json({ ok: true, deleted: name }, { status: 200, headers: corsHeaders });
    }

    // Validate required fields for create/update
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name (string) is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled (boolean) is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (rolloutPercentage !== undefined) {
      if (typeof rolloutPercentage !== "number" || rolloutPercentage < 0 || rolloutPercentage > 100) {
        return NextResponse.json(
          { error: "rolloutPercentage must be a number between 0 and 100" },
          { status: 400, headers: corsHeaders },
        );
      }
    }

    await setFlag(name, enabled, rolloutPercentage);
    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
