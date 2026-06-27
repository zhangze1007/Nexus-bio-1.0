/**
 * Admin Migration API
 *
 * GET  — Return the status of all known migrations.
 * POST — Run pending migrations (optionally rollback a specific migration).
 *
 * Request body for POST:
 *   { "action": "run" }                              — apply pending migrations
 *   { "action": "rollback", "name": "001_foo.sql" }  — rollback a specific migration
 */

import { NextRequest, NextResponse } from "next/server";
import {
  runMigrations,
  getMigrationStatus,
  rollbackMigration,
} from "../../../../src/server/migrations/migrationRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getMigrationStatus();
    return NextResponse.json({ ok: true, migrations: status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = (body as Record<string, unknown>).action;

    if (action === "run") {
      const result = await runMigrations();
      return NextResponse.json({ ok: true, result });
    }

    if (action === "rollback") {
      const name = (body as Record<string, unknown>).name;
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { ok: false, error: "Missing or invalid 'name' field for rollback" },
          { status: 400 },
        );
      }
      await rollbackMigration(name.trim());
      return NextResponse.json({ ok: true, message: `Migration "${name}" rolled back` });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action. Use 'run' or 'rollback'." },
      { status: 400 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
