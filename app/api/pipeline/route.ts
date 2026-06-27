/**
 * POST /api/pipeline — execute a tool pipeline.
 *
 * Request body (JSON):
 *   {
 *     tools: string[]       — ordered list of tool IDs to execute
 *     input?: unknown       — initial payload passed to the first tool
 *   }
 *
 * Response:
 *   { ok: true, result: PipelineResult }
 *   { ok: false, error: string, details?: ValidationIssue[] }
 */

import { NextResponse } from "next/server";
import { runToolPipeline, validatePipeline } from "../../../src/services/integration/toolIntegrationService";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? `pipeline_${Date.now().toString(36)}`;

  // Validate Content-Type
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid Content-Type. Expected application/json.",
        requestId,
      },
      { status: 415, headers: getCorsHeaders(request) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body.", requestId },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "Request body must be a JSON object.", requestId },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const { tools, input } = body as { tools?: unknown; input?: unknown };

  // Validate tools is a non-empty string array
  if (!Array.isArray(tools) || tools.length === 0) {
    return NextResponse.json(
      { ok: false, error: '"tools" must be a non-empty array of tool IDs.', requestId },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const toolIds = tools.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  if (toolIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: '"tools" contains no valid tool ID strings.', requestId },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  // Pre-validate the pipeline
  const validation = validatePipeline(toolIds);
  if (!validation.valid) {
    return NextResponse.json(
      {
        ok: false,
        error: "Pipeline validation failed.",
        details: validation.issues,
        requestId,
      },
      { status: 422, headers: getCorsHeaders(request) },
    );
  }

  try {
    const result = await runToolPipeline(toolIds, input ?? {});

    return NextResponse.json({ ok: true, result, requestId }, { headers: getCorsHeaders(request) });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: "error",
        message: "Pipeline route failed",
        requestId,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      }),
    );

    return NextResponse.json(
      { ok: false, error: `Pipeline execution error: ${errorMsg}`, requestId },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}
