/**
 * POST /api/auth/mfa/backup
 *
 * Verifies a backup code for the authenticated user. Used when the user
 * cannot access their authenticator app. Each backup code can only be used once.
 */

import { NextResponse } from "next/server";
import { auth } from "../../../../../src/lib/auth";
import { getLibsqlClient } from "../../../../../src/lib/db";
import { verifyBackupCode } from "../../../../../src/services/auth/mfaService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { code } = body as { code?: string };

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Missing backup code" },
        { status: 400 },
      );
    }

    const client = getLibsqlClient();
    const result = await client.execute({
      sql: "SELECT mfa_enabled, mfa_backup_codes FROM users WHERE email = ?",
      args: [session.user.email],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;

    if (!row?.mfa_enabled) {
      return NextResponse.json(
        { error: "MFA is not enabled" },
        { status: 400 },
      );
    }

    if (!row.mfa_backup_codes) {
      return NextResponse.json(
        { error: "No backup codes available" },
        { status: 400 },
      );
    }

    const storedHashes: string[] = JSON.parse(row.mfa_backup_codes as string);
    const { valid, remaining } = verifyBackupCode(storedHashes, code);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid backup code" },
        { status: 400 },
      );
    }

    // Update stored backup codes (remove the used one)
    const now = new Date().toISOString();
    await client.execute({
      sql: "UPDATE users SET mfa_backup_codes = ?, updated_at = ? WHERE email = ?",
      args: [JSON.stringify(remaining), now, session.user.email],
    });

    return NextResponse.json({
      success: true,
      remainingCodes: remaining.length,
      message: "Backup code verified successfully",
    });
  } catch (err) {
    console.error("MFA backup error:", err);
    return NextResponse.json(
      { error: "Failed to verify backup code" },
      { status: 500 },
    );
  }
}
