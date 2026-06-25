import { NextResponse } from "next/server";

/**
 * Next.js proxy route for ViennaRNA folding backend.
 *
 * Forwards POST /api/rna/fold to the Python backend at RNA_PYTHON_BACKEND.
 * Returns 503 if the backend URL is not configured.
 */

const RNA_BACKEND = process.env.RNA_PYTHON_BACKEND;

export async function POST(request: Request) {
  if (!RNA_BACKEND) {
    return NextResponse.json(
      { ok: false, error: "RNA backend not configured (set RNA_PYTHON_BACKEND)" },
      { status: 503 },
    );
  }

  const body = await request.json();

  try {
    const res = await fetch(`${RNA_BACKEND}/rna/fold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to reach RNA backend" },
      { status: 502 },
    );
  }
}
