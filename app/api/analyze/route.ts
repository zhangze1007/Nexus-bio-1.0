import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// ── Model providers in priority order ──
// Groq: primary (1000 req/day, very stable)
// Gemini: fallback (250 req/day)

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
];

const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 25000;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ]);
}

function getParts(body: any): any[] {
  if (!Array.isArray(body?.contents)) return [];

  return body.contents.flatMap((content: any) =>
    Array.isArray(content?.parts) ? content.parts : []
  );
}

function isTextOnlyRequest(body: any): boolean {
  const parts = getParts(body);
  return parts.length > 0 && parts.every((part) => typeof part?.text === 'string' && !part?.inline_data && !part?.file_data);
}

// Extract prompt text from Gemini-format request body
function extractPrompt(body: any): string {
  return getParts(body)
    .map((part) => (typeof part?.text === 'string' ? part.text.trim() : ''))
    .filter(Boolean)
    .join('\n\n');
}

// ── Try Groq first (OpenAI-compatible format) ──
async function tryGroq(prompt: string, apiKey: string): Promise<string | null> {
  for (const model of GROQ_MODELS) {
    try {
      const res = await withTimeout(
        fetch(GROQ_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 2048,
          }),
        }),
        TIMEOUT_MS
      );

      const data = await res.json();

      if (res.status === 429) continue; // rate limited, try next model
      if (res.status === 503) continue; // unavailable
      if (!res.ok) continue;

      const text = data?.choices?.[0]?.message?.content;
      if (text) return text;

    } catch {
      continue;
    }
  }
  return null;
}

// ── Try Gemini as fallback ──
async function tryGemini(body: any, apiKey: string): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const geminiBody = {
        ...body,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.1,
          topP: 0.8,
          ...(body.generationConfig || {}),
        },
      };

      const res = await withTimeout(
        fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        }),
        TIMEOUT_MS
      );

      const data = await res.json();

      if (res.status === 429) continue;
      if (res.status === 503) continue;
      if (res.status === 404) continue;
      if (!res.ok) continue;

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;

    } catch {
      continue;
    }
  }
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    return jsonResponse({ error: 'No API keys configured' }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body?.contents || !Array.isArray(body.contents) || body.contents.length === 0) {
    return jsonResponse({ error: 'Missing contents array' }, 400);
  }

  const prompt = extractPrompt(body);
  if (!prompt) {
    return jsonResponse({ error: 'No prompt text found' }, 400);
  }

  const textOnlyRequest = isTextOnlyRequest(body);

  if (!textOnlyRequest && !geminiKey) {
    return jsonResponse({
      error: 'Multimodal analysis requires GEMINI_API_KEY to be configured.',
    }, 503);
  }

  // ── Try Groq first ──
  if (groqKey && textOnlyRequest) {
    const groqResult = await tryGroq(prompt, groqKey);
    if (groqResult) {
      // Return in Gemini-compatible format so frontend doesn't need to change
      return jsonResponse({
        candidates: [{
          content: {
            parts: [{ text: groqResult }]
          }
        }],
        meta: { provider: 'groq' }
      });
    }
  }

  // ── Fallback to Gemini ──
  if (geminiKey) {
    const geminiResult = await tryGemini(body, geminiKey);
    if (geminiResult) {
      return jsonResponse({
        candidates: [{
          content: {
            parts: [{ text: geminiResult }]
          }
        }],
        meta: { provider: 'gemini' }
      });
    }
  }

  // ── All providers failed ──
  return jsonResponse({
    error: 'All AI providers are currently unavailable. Please try again in a moment.',
  }, 503);
}
