import { NextResponse } from "next/server";
import { errorResponse } from "../../../src/utils/apiErrors";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Variant-effect prediction proxy (ML-1).
 *
 * Real predictions require ESM-2 (Python-only): the delta embedding that feeds
 * the validated Ridge model, plus the zero-shot masked-marginal baseline, can
 * only be produced by the Python backend (scspatial-backend/variant_effect_service.py serve).
 * There is deliberately NO TypeScript fallback that fabricates a number — if the
 * backend is not connected we say so plainly and return no prediction. This is
 * the honest-degradation contract (CLAUDE.md GOTCHA #2: never substitute mock
 * data for a real computation).
 */
const VARIANT_EFFECT_BACKEND = process.env.VARIANT_EFFECT_BACKEND?.replace(/\/+$/, "") || "";
const MODEL_ID = "facebook/esm2_t12_35M_UR50D";
const ASSAY = "BLAT_ECOLX_Stiffler_2015";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/** No real backend → explicit "not connected", partial-tier validity, zero fabricated numbers. */
function backendUnavailable(request: Request, detail: string) {
  return errorResponse(
    "Real variant-effect model backend not connected — no prediction returned. " +
      "Predictions require the ESM-2 Python service (scspatial-backend/variant_effect_service.py serve); " +
      "set VARIANT_EFFECT_BACKEND to its URL. Fabricated or mock predictions are never substituted.",
    503,
    {
      code: "SERVICE_UNAVAILABLE",
      backend_connected: false,
      source: "unavailable",
      validity: "partial",
      model: MODEL_ID,
      assay: ASSAY,
      detail,
    },
    getCorsHeaders(request),
  );
}

/** Health/status: reports whether the real model backend is reachable. */
export async function GET(request: Request) {
  if (!VARIANT_EFFECT_BACKEND) return backendUnavailable(request, "VARIANT_EFFECT_BACKEND not set");
  try {
    const resp = await fetch(`${VARIANT_EFFECT_BACKEND}/health`, { method: "GET" });
    if (resp.ok) {
      const data = await resp.json();
      return NextResponse.json(
        { ok: true, backend_connected: true, source: "engine", validity: "partial", ...data },
        { headers: getCorsHeaders(request) },
      );
    }
    return backendUnavailable(request, `backend health ${resp.status}`);
  } catch (err) {
    return backendUnavailable(request, `unreachable: ${String(err)}`);
  }
}

/**
 * POST { wt_seq?, mutation?, variant_seq? } → { predicted_fitness, zeroshot_score }.
 * `mutation` is like "E210I"; omit wt_seq to use the model's bundled BLAT WT.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse("Invalid variant-effect payload", 400, undefined, getCorsHeaders(request));
  }
  const b = body as Record<string, unknown>;
  const mutation = typeof b.mutation === "string" ? b.mutation.trim() : "";
  const variantSeq = typeof b.variant_seq === "string" ? b.variant_seq.trim() : "";
  if (!mutation && !variantSeq) {
    return errorResponse(
      'Provide either `mutation` (e.g. "E210I") or `variant_seq`.',
      400,
      undefined,
      getCorsHeaders(request),
    );
  }

  // No real backend → honest degradation (never a fabricated prediction).
  if (!VARIANT_EFFECT_BACKEND) return backendUnavailable(request, "VARIANT_EFFECT_BACKEND not set");

  try {
    const resp = await fetch(`${VARIANT_EFFECT_BACKEND}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      const data = await resp.json();
      return NextResponse.json(
        {
          ok: true,
          backend_connected: true,
          source: "engine",
          validity: "partial",
          model: MODEL_ID,
          assay: ASSAY,
          ...data,
        },
        { headers: getCorsHeaders(request) },
      );
    }
    const errText = await resp.text();
    console.error("variant-effect backend error:", errText);
    return errorResponse(
      "Variant-effect backend prediction failed",
      502,
      { detail: errText, source: "engine", backend_connected: true },
      getCorsHeaders(request),
    );
  } catch (err) {
    // Backend URL set but unreachable → still honest degradation, no fake number.
    return backendUnavailable(request, `unreachable: ${String(err)}`);
  }
}
