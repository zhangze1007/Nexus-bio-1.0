/**
 * POST /api/auth/mfa/enable
 *
 * Generates a TOTP secret for the authenticated user, returns a QR code URL
 * and backup codes. Does NOT enable MFA yet — the user must verify a token
 * first via /api/auth/mfa/verify.
 */

import { NextResponse } from "next/server";
import { auth } from "../../../../../src/lib/auth";
import { getLibsqlClient } from "../../../../../src/lib/db";
import {
  encryptSecret,
  generateMfaSecret,
  hashBackupCodes,
} from "../../../../../src/services/auth/mfaService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = getLibsqlClient();

    // Check if MFA is already enabled
    const existing = await client.execute({
      sql: "SELECT mfa_enabled FROM users WHERE email = ?",
      args: [session.user.email],
    });
    const row = existing.rows[0] as Record<string, unknown> | undefined;
    if (row?.mfa_enabled) {
      return NextResponse.json(
        { error: "MFA is already enabled" },
        { status: 409 },
      );
    }

    // Generate secret, QR URL, and backup codes
    const { secret, qrCodeUrl, backupCodes } = generateMfaSecret(
      session.user.id,
      session.user.email,
    );

    // Encrypt secret and hash backup codes for storage
    const encryptedSecret = encryptSecret(secret);
    const hashedCodes = hashBackupCodes(backupCodes);

    // Store pending MFA setup (not yet enabled — user must verify first)
    const now = new Date().toISOString();
    await client.execute({
      sql: `UPDATE users SET mfa_secret = ?, mfa_backup_codes = ?, mfa_enabled = 0, updated_at = ? WHERE email = ?`,
      args: [encryptedSecret, JSON.stringify(hashedCodes), now, session.user.email],
    });

    return NextResponse.json({
      qrCodeUrl,
      backupCodes,
      message: "Scan the QR code with your authenticator app, then verify with /api/auth/mfa/verify",
    });
  } catch (err) {
    console.error("MFA enable error:", err);
    return NextResponse.json(
      { error: "Failed to enable MFA" },
      { status: 500 },
    );
  }
}
