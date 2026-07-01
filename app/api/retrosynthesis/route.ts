/**
 * Retrosynthesis API Route
 *
 * Runs the retrosynthetic pathway search server-side so the compute engine
 * stays out of the client bundle (integrity audit T3-3).
 *
 * POST /api/retrosynthesis
 *   Body: RetrosynthesisRequest { targetSmiles, maxSteps?, maxPathways?, ... }
 *   Returns: { ok, result: RetrosynthesisResult }
 */

import { NextResponse } from "next/server";
import { findPathways } from "../../../src/server/retrosynthesis";
import type { RetrosynthesisRequest } from "../../../src/server/retrosynthesis";
import { RetrosynthesisRequestSchema, validateSchema } from "../../../src/schemas";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";
import { errorResponse } from "../../../src/utils/apiErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, undefined, getCorsHeaders(req));
  }

  const parsed = validateSchema(RetrosynthesisRequestSchema, body);
  if (!parsed.ok) {
    return errorResponse("Invalid request body", 400, { errors: parsed.errors }, getCorsHeaders(req));
  }

  try {
    const result = findPathways(parsed.data as RetrosynthesisRequest);
    return NextResponse.json({ ok: true, result }, { headers: getCorsHeaders(req) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Retrosynthesis failed";
    return errorResponse(msg, 500, undefined, getCorsHeaders(req));
  }
}
