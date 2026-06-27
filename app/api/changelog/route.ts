/**
 * Changelog API Route
 *
 * GET  /api/changelog          — list changelog entries (optional ?limit=N)
 * POST /api/changelog          — add a new changelog entry
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  addChangelogEntry,
  getChangelog,
} from "../../../src/services/business/changelogService";
import type { ChangeItem } from "../../../src/services/business/changelogService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    if (limitParam && (Number.isNaN(limit) || limit < 1)) {
      return NextResponse.json(
        { error: "limit must be a positive integer" },
        { status: 400 },
      );
    }

    const entries = await getChangelog(limit);
    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { version, changes } = body as {
      version?: string;
      changes?: ChangeItem[];
    };

    if (!version) {
      return NextResponse.json(
        { error: "Missing required field: version" },
        { status: 400 },
      );
    }
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: changes (non-empty array)" },
        { status: 400 },
      );
    }

    await addChangelogEntry(version, changes);
    return NextResponse.json({ success: true, version }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
