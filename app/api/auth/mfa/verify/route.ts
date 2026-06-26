/**
 * POST /api/auth/mfa/verify
 *
 * Verifies a TOTP token against the user's pending MFA secret.
 * On success, marks MFA as enabled for the user.
 */

import { NextResponse } from "next/server";
import { auth } from "../../../../../src/lib/auth";
import { getLibsqlClient } from "../../../../../src/lib/db";
import {
  decryptSecret,
  verifyToken,
} from "../../../../../src/services/auth/mfaService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { token } = body as { token?: string };

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Missing TOTP token" },
        { status: 400 },
      );
    }

    const client = getLibsqlClient();
    const result = await client.execute({
      sql: "SELECT mfa_secret, mfa_enabled FROM users WHERE email = ?",
      args: [session.user.email],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;

    if (!row?.mfa_secret) {
      return NextResponse.json(
        { error: "No pending MFA setup. Call /api/auth/mfa/enable first." },
        { status: 400 },
      );
    }

    if (row.mfa_enabled) {
      return NextResponse.json(
        { error: "MFA is already enabled" },
        { status: 409 },
      );
    }

    // Decrypt the stored secret and verify the token
    const secret = decryptSecret(row.mfa_secret as string);
    const valid = verifyToken(secret, token.trim());

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid TOTP token" },
        { status: 400 },
      );
    }

    // Token valid — enable MFA
    const now = new Date().toISOString();
    await client.execute({
      sql: "UPDATE users SET mfa_enabled = 1, updated_at = ? WHERE email = ?",
      args: [now, session.user.email],
    });

    return NextResponse.json({ success: true, message: "MFA enabled successfully" });
  } catch (err) {
    console.error("MFA verify error:", err);
    return NextResponse.json(
      { error: "Failed to verify MFA token" },
      { status: 500 },
    );
  }
}
