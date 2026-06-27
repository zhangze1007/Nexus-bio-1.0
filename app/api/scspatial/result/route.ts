import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Python backend URL (set via SCSPATIAL_PYTHON_BACKEND env var). */
const PYTHON_BACKEND = process.env.SCSPATIAL_PYTHON_BACKEND?.replace(/\/+$/, '') || '';

/**
 * Proxy artifact result from the Python backend.
 *
 * Frontend calls: GET /api/scspatial/result?jobId=xxx
 * This forwards to: GET {PYTHON_BACKEND}/result/{job_id}
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');
  if (!jobId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return NextResponse.json({ ok: false, error: "Invalid jobId format" }, { status: 400 });
  }

  if (!PYTHON_BACKEND) {
    return NextResponse.json(
      { ok: false, error: 'Python backend not configured' },
      { status: 503 },
    );
  }

  try {
    const resp = await fetch(`${PYTHON_BACKEND}/result/${jobId}`);

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { ok: false, error: `Python backend returned ${resp.status}`, detail: errText },
        { status: resp.status },
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Python backend unreachable' },
      { status: 502 },
    );
  }
}
