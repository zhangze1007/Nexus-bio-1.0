import type { VercelRequest, VercelResponse } from '@vercel/node';

const MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 25000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ]);
}

function validateRequestBody(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid request body' };
  const b = body as Record<string, unknown>;
  if (!b.contents || !Array.isArray(b.contents)) return { valid: false, error: 'Missing contents array' };
  if (b.contents.length === 0) return { valid: false, error: 'Empty contents array' };
  return { valid: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server configuration error' });

  const validation = validateRequestBody(req.body);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  const body = { ...req.body };

  // Enforce stable generation config
  body.generationConfig = {
    ...(body.generationConfig || {}),
    maxOutputTokens: 2048,
    temperature: 0.1,       // Low temperature = more deterministic JSON
    topP: 0.8,
  };

  // Try each model with fallback
  const errors: string[] = [];

  for (const model of MODELS) {
    try {
      const fetchPromise = fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await withTimeout(fetchPromise, TIMEOUT_MS);
      const data = await response.json();

      // Rate limit — try next model
      if (response.status === 429) {
        errors.push(`${model}: rate limited`);
        continue;
      }

      // Model unavailable — try next
      if (response.status === 503 || response.status === 404) {
        errors.push(`${model}: unavailable`);
        continue;
      }

      if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        return res.status(response.status).json({
          error: errMsg,
          code: response.status,
        });
      }

      return res.status(200).json(data);

    } catch (err: any) {
      const msg = err.message === 'TIMEOUT'
        ? `${model}: timeout after ${TIMEOUT_MS}ms`
        : `${model}: ${err.message}`;
      errors.push(msg);
      continue;
    }
  }

  // All models failed
  const isRateLimit = errors.every(e => e.includes('rate limited'));
  return res.status(503).json({
    error: isRateLimit
      ? 'Rate limit reached. Please wait 1–2 minutes and try again.'
      : 'All AI models are currently unavailable. Please try again shortly.',
    details: errors,
  });
}
