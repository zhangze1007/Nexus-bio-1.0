/**
 * Compliance Check API
 *
 * POST /api/compliance/check — Run a full compliance check for an organization.
 * GET  /api/compliance/check — Get the latest compliance status for an organization.
 */

import { NextResponse } from "next/server";
import {
  runComplianceCheck,
  getComplianceStatus,
} from "../../../../src/services/compliance/complianceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const orgId = body?.orgId;

    if (!orgId || typeof orgId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'orgId' in request body." },
        { status: 400 },
      );
    }

    const report = await runComplianceCheck(orgId.trim());
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    console.error("[compliance/check POST]", err);
    return NextResponse.json(
      { error: "Internal server error during compliance check." },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");

    if (!orgId || orgId.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required 'orgId' query parameter." },
        { status: 400 },
      );
    }

    const status = await getComplianceStatus(orgId.trim());
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    console.error("[compliance/check GET]", err);
    return NextResponse.json(
      { error: "Internal server error fetching compliance status." },
      { status: 500 },
    );
  }
}
