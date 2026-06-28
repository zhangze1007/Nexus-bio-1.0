/**
 * Admin Deploy API
 *
 * GET  /api/admin/deploy — Returns current deployment status.
 * POST /api/admin/deploy — Runs deployment validation checks.
 */

import { NextResponse } from "next/server";
import {
  getDeploymentStatus,
  validateDeployment,
} from "../../../../src/services/infra/deploymentService";
import { errorResponse } from "../../../../src/utils/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  GET /api/admin/deploy                                              */
/* ------------------------------------------------------------------ */

export async function GET() {
  try {
    const status = await getDeploymentStatus();
    return NextResponse.json({ ok: true, ...status }, { status: 200 });
  } catch (err) {
    console.error('[api/admin/deploy] GET error:', err);
    return errorResponse('An internal error occurred', 500);
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/admin/deploy                                             */
/* ------------------------------------------------------------------ */

export async function POST() {
  try {
    const result = await validateDeployment();

    // Derive an overall status from individual checks
    const hasFail = result.checks.some((c) => c.status === "fail");
    const hasWarn = result.checks.some((c) => c.status === "warn");

    const overall = hasFail ? "fail" : hasWarn ? "warn" : "pass";

    return NextResponse.json(
      { ok: true, overall, ...result },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/admin/deploy] POST error:', err);
    return errorResponse('An internal error occurred', 500);
  }
}
