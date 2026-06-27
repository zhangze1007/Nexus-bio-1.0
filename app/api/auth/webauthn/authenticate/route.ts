/**
 * POST /api/auth/webauthn/authenticate
 *
 * Two-step WebAuthn authentication:
 *
 * Step 1 — POST with `{ action: "options", userId?: string }`
 *   Returns PublicKeyCredentialRequestOptionsJSON. If `userId` is provided,
 *   scopes `allowCredentials` to that user. Otherwise, returns options for
 *   passkey discovery (no `allowCredentials`).
 *
 * Step 2 — POST with `{ action: "verify", response: AuthenticationResponseJSON }`
 *   Verifies the assertion response and returns the authenticated user ID.
 *
 * Does NOT require an existing session — this is the authentication entry point.
 */

import { NextResponse } from "next/server";
import {
  generateAuthenticationOptionsForUser,
  verifyAuthenticationResponseForUser,
} from "../../../../../src/services/auth/webauthnService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = (body as Record<string, unknown>)?.action;

  // ── Step 1: Generate authentication options ───────────────────────────
  if (action === "options") {
    const userId = (body as Record<string, unknown>)?.userId;

    try {
      const options = await generateAuthenticationOptionsForUser(
        typeof userId === "string" ? userId : undefined,
      );
      return NextResponse.json(options);
    } catch (err) {
      console.error("WebAuthn authenticate options error:", err);
      return NextResponse.json(
        { error: "Failed to generate authentication options" },
        { status: 500 },
      );
    }
  }

  // ── Step 2: Verify authentication response ───────────────────────────
  if (action === "verify") {
    const response = (body as Record<string, unknown>)?.response;
    const userId = (body as Record<string, unknown>)?.userId;

    if (!response || typeof response !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid 'response' field" },
        { status: 400 },
      );
    }

    try {
      const result = await verifyAuthenticationResponseForUser(
        typeof userId === "string" ? userId : undefined,
        response as never,
      );

      if (!result.verified) {
        return NextResponse.json(
          { error: result.error || "Authentication verification failed" },
          { status: 400 },
        );
      }

      return NextResponse.json({
        verified: true,
        userId: result.userId,
        credentialId: result.credentialId,
      });
    } catch (err) {
      console.error("WebAuthn authenticate verify error:", err);
      return NextResponse.json(
        { error: "Failed to verify authentication" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "Invalid action — expected 'options' or 'verify'" },
    { status: 400 },
  );
}
