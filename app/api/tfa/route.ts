/**
 * TFA (Thermodynamic Flux Analysis) API Route
 *
 * Runs TFA server-side so the engine stays out of the client bundle
 * (integrity audit T3-3).
 *
 * POST /api/tfa
 *   Body: { model: TFAModel, options?: TFAOptions }  (or a bare TFAModel)
 *   Returns: { ok, result: TFAResult }
 */

import { NextResponse } from "next/server";
import { runTFA } from "../../../src/server/tfaEngine";
import type { TFAModel, TFAOptions } from "../../../src/server/tfaEngine";
import { TFARequestSchema, validateSchema } from "../../../src/schemas";
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

  const b = (body ?? {}) as Record<string, unknown>;
  // Accept either { model, options } or a bare TFAModel ({ reactions, conditions }).
  const candidate = b.model
    ? { ...(b.model as Record<string, unknown>), options: b.options }
    : b;

  const parsed = validateSchema(TFARequestSchema, candidate);
  if (!parsed.ok) {
    return errorResponse("Invalid request body", 400, { errors: parsed.errors }, getCorsHeaders(req));
  }

  const model: TFAModel = { reactions: parsed.data.reactions, conditions: parsed.data.conditions };
  const options = parsed.data.options as TFAOptions | undefined;

  try {
    const result = runTFA(model, options);
    return NextResponse.json({ ok: true, result }, { headers: getCorsHeaders(req) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "TFA failed";
    return errorResponse(msg, 500, undefined, getCorsHeaders(req));
  }
}
