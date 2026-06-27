/**
 * GET /api/auth/sso/config?orgId=<id>     — Retrieve SSO config for an org
 * POST /api/auth/sso/config               — Create or update SSO config for an org
 *
 * Both endpoints require an authenticated session (next-auth).
 *
 * POST body:
 *   {
 *     orgId: string,
 *     provider: string,
 *     metadata_url: string,
 *     entity_id: string,
 *     acs_url: string,
 *     enabled?: boolean
 *   }
 */

import { NextResponse } from "next/server";
import { auth } from "../../../../../src/lib/auth";
import {
  getSSOConfig,
  updateSSOConfig,
} from "../../../../../src/services/auth/ssoService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json(
      { error: "Missing required query parameter: orgId" },
      { status: 400 },
    );
  }

  try {
    const config = await getSSOConfig(orgId);

    if (!config) {
      return NextResponse.json(
        { error: "No SSO configuration found for this organization" },
        { status: 404 },
      );
    }

    return NextResponse.json(config);
  } catch (err) {
    console.error("SSO config GET error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve SSO configuration" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orgId = body.orgId as string | undefined;
  const provider = body.provider as string | undefined;
  const metadataUrl = body.metadata_url as string | undefined;
  const entityId = body.entity_id as string | undefined;
  const acsUrl = body.acs_url as string | undefined;
  const enabled = body.enabled as boolean | undefined;

  // Validate required fields
  const missing: string[] = [];
  if (!orgId) missing.push("orgId");
  if (!provider) missing.push("provider");
  if (!metadataUrl) missing.push("metadata_url");
  if (!entityId) missing.push("entity_id");
  if (!acsUrl) missing.push("acs_url");

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const config = await updateSSOConfig(orgId!, {
      provider: provider!,
      metadata_url: metadataUrl!,
      entity_id: entityId!,
      acs_url: acsUrl!,
      enabled: enabled ?? false,
    });

    return NextResponse.json(config);
  } catch (err) {
    console.error("SSO config POST error:", err);
    return NextResponse.json(
      { error: "Failed to update SSO configuration" },
      { status: 500 },
    );
  }
}
