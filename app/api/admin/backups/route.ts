/**
 * Backup Automation Admin API
 *
 * POST /api/admin/backups  — Create a new backup snapshot.
 * GET  /api/admin/backups  — List all recorded backups.
 */

import { NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../src/utils/cors";
import { createBackup, listBackups } from "../../../../src/server/backup/backupManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * POST /api/admin/backups
 *
 * Creates a point-in-time snapshot of the workbench database.
 * Returns the backup metadata (id, timestamp, size, table counts).
 */
export async function POST(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const result = await createBackup();
    return NextResponse.json({ ok: true, backup: result }, { status: 201, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

/**
 * GET /api/admin/backups
 *
 * Lists all recorded backups, most recent first.
 */
export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const backups = await listBackups();
    return NextResponse.json({ ok: true, backups }, { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
