import { NextRequest, NextResponse } from 'next/server';

/**
 * Web Vitals analytics endpoint.
 *
 * Receives beaconed Core Web Vitals data from the WebVitals component.
 * Currently logs to stdout; can be extended to store in a database or
 * forward to a third-party RUM provider.
 *
 * Edge Runtime is not used here because the handler is trivial and
 * Node.js runtime keeps it consistent with other data-oriented routes.
 */

export const runtime = 'nodejs';

interface WebVitalPayload {
  metric: string;
  value: number;
  id: string;
  startTime: number;
  attribution?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
  timestamp?: number;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    let payload: WebVitalPayload;

    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 },
      );
    }

    // Validate required fields
    if (!payload.metric || typeof payload.value !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: metric, value' },
        { status: 400 },
      );
    }

    // Log the metric (structured for easy grep/analysis)
    // In production, this could be forwarded to a data warehouse or RUM service.
    const logEntry = {
      type: 'web-vital',
      metric: payload.metric,
      value: Math.round(payload.value * 100) / 100,
      id: payload.id,
      url: payload.url,
      timestamp: payload.timestamp || Date.now(),
    };

    // Use structured logging — easy to parse with log aggregators
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(logEntry));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// Reject non-POST methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 },
  );
}
