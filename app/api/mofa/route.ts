import { NextResponse } from "next/server";
import { errorResponse } from "../../../src/utils/apiErrors";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * MOFA+ Python Backend Proxy
 *
 * Proxies MOFA+ factor analysis requests to a Railway-hosted Python backend
 * running the real MOFA+ package (mofax/mofapy2). Follows the same pattern
 * as app/api/scspatial/ingest/route.ts for Railway proxying.
 *
 * Environment variable: MOFA_PYTHON_BACKEND (e.g. https://mofa-backend.up.railway.app)
 *
 * Request body:
 *   { views: Record<string, number[][]>, nFactors?: number, nIterations?: number }
 *
 * Response body (MOFA+ Python output):
 *   { factors: number[][], loadings: Record<string, number[][]>,
 *     varianceExplained: Record<string, number[]>, converged: boolean, iterations: number }
 */

const MOFA_BACKEND = process.env.MOFA_PYTHON_BACKEND?.replace(/\/+$/, "") || "";

export async function POST(request: Request) {
  if (!MOFA_BACKEND) {
    return errorResponse("MOFA_PYTHON_BACKEND not configured", 503, { detail: "Set MOFA_PYTHON_BACKEND env var to the Railway backend URL." });
  }

  try {
    const body = await request.json();

    if (!body?.views || typeof body.views !== "object") {
      return errorResponse("Missing required 'views' field", 400);
    }

    const resp = await fetch(`${MOFA_BACKEND}/mofa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        views: body.views,
        nFactors: body.nFactors ?? 10,
        nIterations: body.nIterations ?? 1000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "Unknown error");
      return errorResponse(`MOFA+ backend returned ${resp.status}`, 502, { detail: errText });
    }

    const data = await resp.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "MOFA+ proxy failed";
    return errorResponse(msg, 502);
  }
}
