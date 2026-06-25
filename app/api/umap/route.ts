import { NextResponse } from "next/server";

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
    return NextResponse.json(
      { ok: false, error: "MOFA_PYTHON_BACKEND not configured", detail: "Set MOFA_PYTHON_BACKEND env var to the Railway backend URL." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();

    if (!body?.data || !Array.isArray(body.data)) {
      return NextResponse.json(
        { ok: false, error: "Missing required 'data' field (number[][])" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { ok: false, error: `UMAP backend returned ${resp.status}`, detail: errText },
        { status: 502 },
      );
    }

    const data = await resp.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UMAP proxy failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
