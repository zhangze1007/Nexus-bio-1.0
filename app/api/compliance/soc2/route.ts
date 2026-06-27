/**
 * SOC 2 Compliance Controls API
 *
 * POST /api/compliance/soc2 — Run a full SOC 2 compliance check.
 * GET  /api/compliance/soc2 — Get the latest SOC 2 control statuses.
 */

import { NextResponse } from "next/server";
import {
  runSOC2Check,
  getControlStatus,
} from "../../../../src/services/compliance/soc2Controls";

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

    const report = await runSOC2Check(orgId.trim());
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    console.error("[compliance/soc2 POST]", err);
    return NextResponse.json(
      { error: "Internal server error during SOC 2 check." },
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

    const controls = await getControlStatus(orgId.trim());
    return NextResponse.json({ controls }, { status: 200 });
  } catch (err) {
    console.error("[compliance/soc2 GET]", err);
    return NextResponse.json(
      { error: "Internal server error fetching SOC 2 status." },
      { status: 500 },
    );
  }
}
