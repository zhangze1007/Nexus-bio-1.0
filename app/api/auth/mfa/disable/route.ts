/**
 * POST /api/auth/mfa/disable
 *
 * Disables MFA for the authenticated user. Requires a valid TOTP token
 * to confirm the user still has access to their authenticator app.
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

    if (!row?.mfa_enabled) {
      return NextResponse.json(
        { error: "MFA is not enabled" },
        { status: 400 },
      );
    }

    // Verify the token before disabling
    const secret = decryptSecret(row.mfa_secret as string);
    const valid = verifyToken(secret, token.trim());

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid TOTP token" },
        { status: 400 },
      );
    }

    // Disable MFA and clear secrets
    const now = new Date().toISOString();
    await client.execute({
      sql: `UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_backup_codes = NULL, updated_at = ? WHERE email = ?`,
      args: [now, session.user.email],
    });

    return NextResponse.json({ success: true, message: "MFA disabled successfully" });
  } catch (err) {
    console.error("MFA disable error:", err);
    return NextResponse.json(
      { error: "Failed to disable MFA" },
      { status: 500 },
    );
  }
}
