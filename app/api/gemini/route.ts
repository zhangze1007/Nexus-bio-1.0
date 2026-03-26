import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL_PRIMARY?.trim(),
  process.env.GEMINI_MODEL_FALLBACK?.trim(),
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter((model): model is string => Boolean(model));

function makeHeaders(extra?: HeadersInit) {
  const headers = new Headers(BASE_HEADERS);

  if (extra) {
    const extraHeaders = new Headers(extra);
    extraHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new NextResponse(JSON.stringify(body), {
    ...init,
    headers: makeHeaders(init.headers),
  });
}

function shouldFallback(status: number, message: string) {
  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    status === 404 ||
    /temporarily unavailable|unavailable|overload|rate limit|quota|timeout|internal error/i.test(message)
  );
}

async function callModel(model: string, apiKey: string, body: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    const data = await response.json().catch(() => null);
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: makeHeaders() });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonResponse({ error: 'API key not configured' }, { status: 500 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return jsonResponse({ error: 'Invalid request body' }, { status: 400 });
  }

  let lastError = 'AI model is temporarily unavailable. Please try again shortly.';

  for (const [index, model] of MODEL_CANDIDATES.entries()) {
    try {
      const { response, data } = await callModel(model, apiKey, body);

      if (response.ok) {
        return jsonResponse(data, { status: 200 });
      }

      const message =
        data?.error?.message ||
        response.statusText ||
        'Gemini API error';

      lastError = message;

      const retryAfter = response.headers.get('retry-after');
      const canFallback = shouldFallback(response.status, message) && index < MODEL_CANDIDATES.length - 1;

      if (canFallback) {
        continue;
      }

      const payload: Record<string, unknown> = {
        error: message,
        status: response.status,
        model,
      };

      if (retryAfter) {
        payload.retryAfter = retryAfter;
      }

      return jsonResponse(payload, {
        status: response.status,
        ...(retryAfter ? { headers: { 'Retry-After': retryAfter } } : {}),
      });
    } catch (err: any) {
      const message =
        err?.name === 'AbortError'
          ? 'Request timed out'
          : err?.message || 'Internal server error';

      lastError = message;

      const canFallback = index < MODEL_CANDIDATES.length - 1;
      if (canFallback) {
        continue;
      }

      return jsonResponse(
        {
          error: message,
          status: 503,
          model,
        },
        { status: 503 }
      );
    }
  }

  return jsonResponse(
    {
      error: lastError,
      status: 503,
      modelsTried: MODEL_CANDIDATES,
    },
    { status: 503 }
  );
}
