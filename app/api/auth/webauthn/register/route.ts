/**
 * POST /api/auth/webauthn/register
 *
 * Two-step WebAuthn registration:
 *
 * Step 1 — POST with `{ action: "options" }`
 *   Returns PublicKeyCredentialCreationOptionsJSON for the browser to pass
 *   to `startRegistration()`.
 *
 * Step 2 — POST with `{ action: "verify", response: RegistrationResponseJSON }`
 *   Verifies the attestation response and persists the new credential.
 *
 * Requires an authenticated session (next-auth).
 */

import { NextResponse } from "next/server";
import { auth } from "../../../../../src/lib/auth";
import {
  generateRegistrationOptionsForUser,
  verifyRegistrationResponseForUser,
} from "../../../../../src/services/auth/webauthnService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = (body as Record<string, unknown>)?.action;

  // ── Step 1: Generate registration options ──────────────────────────────
  if (action === "options") {
    try {
      const userName = session.user.email || session.user.name || session.user.id;
      const options = await generateRegistrationOptionsForUser(session.user.id, userName);
      return NextResponse.json(options);
    } catch (err) {
      console.error("WebAuthn register options error:", err);
      return NextResponse.json(
        { error: "Failed to generate registration options" },
        { status: 500 },
      );
    }
  }

  // ── Step 2: Verify registration response ──────────────────────────────
  if (action === "verify") {
    const response = (body as Record<string, unknown>)?.response;
    const deviceName = (body as Record<string, unknown>)?.deviceName;

    if (!response || typeof response !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid 'response' field" },
        { status: 400 },
      );
    }

    try {
      const result = await verifyRegistrationResponseForUser(
        session.user.id,
        response as never,
        typeof deviceName === "string" ? deviceName : undefined,
      );

      if (!result.verified) {
        return NextResponse.json(
          { error: result.error || "Registration verification failed" },
          { status: 400 },
        );
      }

      return NextResponse.json({
        verified: true,
        credentialId: result.credentialId,
      });
    } catch (err) {
      console.error("WebAuthn register verify error:", err);
      return NextResponse.json(
        { error: "Failed to verify registration" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "Invalid action — expected 'options' or 'verify'" },
    { status: 400 },
  );
}
