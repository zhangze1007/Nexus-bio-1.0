/**
 * Incident Response API
 *
 * GET  /api/compliance/incidents         — List incidents (optional ?status= filter)
 * POST /api/compliance/incidents         — Create a new incident
 */

import { NextResponse } from "next/server";
import {
  createIncident,
  listIncidents,
} from "../../../../src/services/compliance/incidentResponse";
import type { IncidentSeverity, IncidentStatus } from "../../../../src/services/compliance/incidentResponse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");

    const status = statusParam && statusParam.trim().length > 0
      ? (statusParam.trim() as IncidentStatus)
      : undefined;
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const incidents = await listIncidents(status, limit);
    return NextResponse.json({ ok: true, incidents }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[compliance/incidents GET]", err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }

    const { severity, description, affectedSystems, createdBy } = body as {
      severity?: unknown;
      description?: unknown;
      affectedSystems?: unknown;
      createdBy?: unknown;
    };

    if (!severity || typeof severity !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid 'severity' field." },
        { status: 400 },
      );
    }

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid 'description' field." },
        { status: 400 },
      );
    }

    const systems = Array.isArray(affectedSystems)
      ? affectedSystems.filter((s): s is string => typeof s === "string")
      : [];

    const actor = typeof createdBy === "string" && createdBy.trim().length > 0
      ? createdBy.trim()
      : "system";

    const incident = await createIncident(
      severity as IncidentSeverity,
      description,
      systems,
      actor,
    );

    return NextResponse.json({ ok: true, incident }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[compliance/incidents POST]", err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}
