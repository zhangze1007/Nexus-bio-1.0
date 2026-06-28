import { NextResponse } from 'next/server';
import { errorResponse } from '../../../../src/utils/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Python backend URL (set via SCSPATIAL_PYTHON_BACKEND env var). */
const PYTHON_BACKEND = process.env.SCSPATIAL_PYTHON_BACKEND?.replace(/\/+$/, '') || '';

/**
 * Proxy SSE status stream from the Python backend.
 *
 * Frontend calls: GET /api/scspatial/status?jobId=xxx
 * This forwards to: GET {PYTHON_BACKEND}/status/{job_id}
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');
  if (!jobId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return errorResponse("Invalid jobId format", 400);
  }

  if (!PYTHON_BACKEND) {
    return errorResponse('Python backend not configured', 503);
  }

  try {
    const resp = await fetch(`${PYTHON_BACKEND}/status/${jobId}`, {
      headers: { Accept: 'text/event-stream' },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[api/scspatial/status] Python backend error:', errText);
      return errorResponse(`Python backend returned ${resp.status}`, resp.status);
    }

    // Stream the SSE response through
    return new NextResponse(resp.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    return errorResponse('Python backend unreachable', 502);
  }
}
