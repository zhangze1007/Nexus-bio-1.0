export const config = {
  runtime: 'edge',
};

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

const BASE = 'https://generativelanguage.googleapis.com/v1/models';
const TIMEOUT_MS = 25000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ]);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function validateRequestBody(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const b = body as Record<string, unknown>;

  if (!b.contents || !Array.isArray(b.contents)) {
    return { valid: false, error: 'Missing contents array' };
  }

  if ((b.contents as unknown[]).length === 0) {
    return { valid: false, error: 'Empty contents array' };
  }

  return { valid: true };
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return jsonResponse({}, 200);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  try {
    const requestBody = await req.json();

    const validation = validateRequestBody(requestBody);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }

    const body = {
      ...requestBody,
      generationConfig: {
        ...(requestBody?.generationConfig || {}),
        maxOutputTokens: 2048,
        temperature: 0.1,
        topP: 0.8,
      },
    };

    const errors: string[] = [];

    for (const model of MODELS) {
      try {
        const fetchPromise = fetch(
          `${BASE}/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        );

        const response = await withTimeout(fetchPromise, TIMEOUT_MS);
        const data = await response.json();

        if (response.status === 429) {
          errors.push(`${model}: rate limited`);
          continue;
        }

        if (response.status === 503 || response.status === 404) {
          errors.push(`${model}: unavailable`);
          continue;
        }

        if (!response.ok) {
          return jsonResponse(
            {
              error: data?.error?.message || `HTTP ${response.status}`,
              code: response.status,
              model,
            },
            response.status
          );
        }

        return jsonResponse({
          ...data,
          meta: {
            modelUsed: model,
            fallbackCount: errors.length,
          },
        });
      } catch (err: any) {
        const msg =
          err?.message === 'TIMEOUT'
            ? `${model}: timeout after ${TIMEOUT_MS}ms`
            : `${model}: ${err?.message || 'Unknown error'}`;
        errors.push(msg);
      }
    }

    const isRateLimit = errors.length > 0 && errors.every((e) => e.includes('rate limited'));

    return jsonResponse(
      {
        error: isRateLimit
          ? 'Rate limit reached. Please wait 1–2 minutes and try again.'
          : 'All AI models are currently unavailable. Please try again shortly.',
        details: errors,
      },
      503
    );
  } catch (err: any) {
    return jsonResponse(
      {
        error: err?.message || 'Internal server error',
      },
      500
    );
  }
}
