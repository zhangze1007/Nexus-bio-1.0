import { NextResponse } from "next/server";
import { errorResponse } from "../../../src/utils/apiErrors";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * UMAP Python Backend Proxy
 *
 * Proxies UMAP embedding requests to a Railway-hosted Python backend
 * running the real umap-learn package. Shares the same backend as MOFA+
 * (MOFA_PYTHON_BACKEND env var) but hits the /umap endpoint.
 *
 * Request body:
 *   { data: number[][], nNeighbors?: number, minDist?: number, nComponents?: number }
 *
 * Response body:
 *   { embedding: number[][] }  // [nSamples x nComponents]
 */

const MOFA_BACKEND = process.env.MOFA_PYTHON_BACKEND?.replace(/\/+$/, "") || "";

export async function POST(request: Request) {
  if (!MOFA_BACKEND) {
    return errorResponse("MOFA_PYTHON_BACKEND not configured", 503, { detail: "Set MOFA_PYTHON_BACKEND env var to the Railway backend URL." });
  }

  try {
    const body = await request.json();

    if (!body?.data || !Array.isArray(body.data)) {
      return errorResponse("Missing required 'data' field (number[][])", 400);
    }

    const resp = await fetch(`${MOFA_BACKEND}/umap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: body.data,
        nNeighbors: body.nNeighbors ?? 15,
        minDist: body.minDist ?? 0.1,
        nComponents: body.nComponents ?? 2,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "Unknown error");
      return errorResponse(`UMAP backend returned ${resp.status}`, 502, { detail: errText });
    }

    const data = await resp.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UMAP proxy failed";
    return errorResponse(msg, 502);
  }
}
