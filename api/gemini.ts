import type { VercelRequest, VercelResponse } from '@vercel/node';

const MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

  const body = req.body;
  if (body.generationConfig) {
    body.generationConfig.maxOutputTokens = 2048;
    body.generationConfig.temperature = 0.1;
  }

  // Try each model in order — fallback if one fails
  for (const model of MODELS) {
    try {
      const response = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.status === 429 || response.status === 503) continue; // try next model
      if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'API error' });

      return res.status(200).json(data);
    } catch {
      continue;
    }
  }

  return res.status(503).json({ error: 'All models unavailable. Please try again in a moment.' });
}
