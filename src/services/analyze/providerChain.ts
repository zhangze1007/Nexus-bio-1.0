/**
 * LLM provider chain — Groq primary, Gemini fallback.
 * Extracted from app/api/analyze/route.ts.
 */

import {
  GROQ_MODELS,
  GEMINI_MODELS,
  GROQ_BASE,
  GEMINI_BASE,
  TIMEOUT_MS,
  type ConversationTurn,
  type GeminiRequestBody,
  type GeminiContent,
} from './types';
import { buildGeminiBodyWithSystemPrompt, AXON_SYSTEM_PROMPT } from './promptBuilder';

function withTimeout<T>(promise: Promise<T>, ms: number, controller: AbortController): Promise<T> {
  const timeoutId = setTimeout(() => controller.abort(), ms);

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('TIMEOUT')));
    }),
  ]).finally(() => clearTimeout(timeoutId));
}

// ── Try Groq first (OpenAI-compatible format) ──
export async function tryGroq(
  prompt: string,
  apiKey: string,
  systemPrompt: string = AXON_SYSTEM_PROMPT,
  conversationHistory: ConversationTurn[] = [],
): Promise<string | null> {
  for (const model of GROQ_MODELS) {
    try {
      // Build messages array: [system, ...history, current user]
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: prompt },
      ];

      const controller = new AbortController();
      const res = await withTimeout(
        fetch(GROQ_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.1,
            max_tokens: 4096,
          }),
          signal: controller.signal,
        }),
        TIMEOUT_MS,
        controller,
      );

      const data = await res.json();

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const delayMs = retryAfter ? Math.min(parseInt(retryAfter) * 1000, 5000) : 2000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      if (res.status === 503) continue; // unavailable
      if (!res.ok) continue;

      const text = data?.choices?.[0]?.message?.content;
      if (text) return text;

    } catch (err) {
      console.warn(JSON.stringify({ level: 'warn', message: 'Groq provider failed', error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }));
      continue;
    }
  }
  return null;
}

// ── Try Gemini as fallback ──
export async function tryGemini(
  body: GeminiRequestBody,
  apiKey: string,
  systemPrompt: string = AXON_SYSTEM_PROMPT,
  conversationHistory: ConversationTurn[] = [],
): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      // Build history contents for Gemini multi-turn format.
      // Gemini uses 'user' and 'model' roles (not 'assistant').
      const historyContents: GeminiContent[] = conversationHistory.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));

      // Prepend history to the existing contents array.
      const bodyWithHistory: GeminiRequestBody = {
        ...body,
        contents: [
          ...historyContents,
          ...(body.contents ?? []),
        ],
      };

      const geminiBody = {
        ...buildGeminiBodyWithSystemPrompt(bodyWithHistory, systemPrompt),
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.1,
          topP: 0.8,
          ...(body.generationConfig || {}),
        },
      };

      const controller = new AbortController();
      const res = await withTimeout(
        fetch(`${GEMINI_BASE}/${model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(geminiBody),
          signal: controller.signal,
        }),
        TIMEOUT_MS,
        controller,
      );

      const data = await res.json();

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const delayMs = retryAfter ? Math.min(parseInt(retryAfter) * 1000, 5000) : 2000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      if (res.status === 503) continue;
      if (res.status === 404) continue;
      if (!res.ok) continue;

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;

    } catch (err) {
      console.warn(JSON.stringify({ level: 'warn', message: 'Gemini provider failed', error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }));
      continue;
    }
  }
  return null;
}
