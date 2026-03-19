export const config = {
  runtime: 'edge',
};

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 25000;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ]);
}

function validateRequestBody(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.contents) || b.contents.length === 0) {
    return { valid: false, error: 'Missing or empty contents array' };
  }

  return { valid: true };
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'GEMINI_API_KEY is not configured' }, 500);
  }

  let body: any;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const validation = validateRequestBody(body);
  if (!validation.valid) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const requestBody = {
    ...body,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.1,
      topP: 0.8,
      ...(body.generationConfig || {}),
    },
  };

  const modelErrors: string[] = [];

  for (const model of MODELS) {
    try {
      const response = await withTimeout(
        fetch(`${BASE_URL}/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }),
        TIMEOUT_MS
      );

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok) {
        return jsonResponse(data, 200);
      }

      const apiMessage =
        data?.error?.message ||
        data?.message ||
        `Gemini API returned HTTP ${response.status}`;

      if (response.status === 429) {
        modelErrors.push(`${model}: rate limited`);
        continue;
      }

      if (response.status === 503) {
        modelErrors.push(`${model}: overloaded/unavailable`);
        continue;
      }

      if (response.status === 404) {
        modelErrors.push(`${model}: model not found`);
        continue;
      }

      return jsonResponse(
        {
          error: apiMessage,
          code: response.status,
          model,
        },
        response.status
      );
    } catch (err: any) {
      if (err?.message === 'TIMEOUT') {
        modelErrors.push(`${model}: timeout after ${TIMEOUT_MS}ms`);
        continue;
      }

      modelErrors.push(`${model}: ${err?.message || 'Unknown fetch error'}`);
      continue;
    }
  }

  const allRateLimited =
    modelErrors.length > 0 &&
    modelErrors.every((msg) => msg.includes('rate limited'));

  return jsonResponse(
    {
      error: allRateLimited
        ? 'Rate limit reached. Please wait a minute and try again.'
        : 'All AI models are currently unavailable. Please try again shortly.',
      details: modelErrors,
    },
    503
  );
}
