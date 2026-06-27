import { NextRequest, NextResponse } from 'next/server';
import { classifyAxonDomain } from '../../../src/services/axonDomainClassifier';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';

// ── Re-export all public symbols for tests and the gemini legacy alias ──
export {
  MAX_PROMPT_CHARS,
  MAX_SEARCH_QUERY_CHARS,
  MAX_HISTORY_TURNS,
  MAX_HISTORY_MSG_CHARS,
  MAX_HISTORY_TOTAL_CHARS,
  type ConversationTurn,
  type GeminiPart,
  type GeminiContent,
  type GeminiRequestBody,
  type JsonRecord,
} from '../../../src/services/analyze/types';
export { escapeHtml, sanitizePromptInput, sanitizeHistory } from '../../../src/services/analyze/sanitizer';
export {
  AXON_PROSE_SYSTEM_PROMPT,
  withProseSystemPrompt,
  offDomainRefusalText,
  withSystemPrompt,
  buildDynamicPrompt,
  buildGeminiBodyWithSystemPrompt,
  AXON_SYSTEM_PROMPT,
} from '../../../src/services/analyze/promptBuilder';
export { tryGroq, tryGemini } from '../../../src/services/analyze/providerChain';
export { enrichAxonOutput, type EnrichResult } from '../../../src/services/analyze/outputEnricher';

import {
  MAX_PROMPT_CHARS,
  MAX_SEARCH_QUERY_CHARS,
  type GeminiRequestBody,
} from '../../../src/services/analyze/types';
import { sanitizePromptInput, sanitizeHistory } from '../../../src/services/analyze/sanitizer';
import {
  AXON_SYSTEM_PROMPT,
  AXON_PROSE_SYSTEM_PROMPT,
  withSystemPrompt,
  withProseSystemPrompt,
  offDomainRefusalText,
  buildDynamicPrompt,
} from '../../../src/services/analyze/promptBuilder';
import { tryGroq, tryGemini } from '../../../src/services/analyze/providerChain';
import { enrichAxonOutput, type EnrichResult } from '../../../src/services/analyze/outputEnricher';
import { checkRateLimit } from '../../../src/utils/rateLimit';

export const runtime = 'edge';
export const maxDuration = 30;

function jsonResponse(body: unknown, status = 200, req?: Request) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
  });
}

// ── Gemini-format body helpers (kept inline — small, route-specific) ──

function getParts(body: GeminiRequestBody) {
  if (!Array.isArray(body?.contents)) return [];
  return body.contents.flatMap((content) =>
    Array.isArray(content?.parts) ? content.parts : []
  );
}

function isTextPart(part: { text?: string; inline_data?: unknown; file_data?: unknown }): part is { text: string } {
  return typeof part?.text === 'string' && !part?.inline_data && !part?.file_data;
}

function isTextOnlyRequest(body: GeminiRequestBody): boolean {
  const parts = getParts(body);
  return parts.length > 0 && parts.every(isTextPart);
}

function hasMultimodalContent(body: GeminiRequestBody): boolean {
  return getParts(body).some((part) => part?.inline_data || part?.file_data);
}

function extractPrompt(body: GeminiRequestBody): string {
  return getParts(body)
    .map((part) => (isTextPart(part) ? part.text.trim() : ''))
    .filter(Boolean)
    .join('\n\n');
}

// ── Route handlers ──

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || `anon_${Date.now().toString(36)}`;

  // ── Body size limit (1MB) ──
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > 1_000_000) {
    return errorResponse('Request too large', 413, { requestId }, getCorsHeaders(req));
  }

  // ── Rate limiting ──
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  if (!(await checkRateLimit(ip, '/api/analyze')).allowed) {
    return errorResponse('Rate limit exceeded. Try again in 60 seconds.', 429, undefined, {
      'Retry-After': '60',
      ...getCorsHeaders(req),
    });
  }

  // ── CSRF: require JSON content type ──
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return errorResponse('Invalid content type', 415, undefined, getCorsHeaders(req));
  }

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    return errorResponse('No API keys configured', 500, undefined, getCorsHeaders(req));
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = await req.json();
  } catch {
    console.warn(JSON.stringify({ level: 'warn', message: 'Invalid JSON body', requestId, ip, timestamp: new Date().toISOString() }));
    return jsonResponse({ error: 'Invalid JSON body', requestId }, 400, req);
  }

  // ── Dynamic search query mode ──
  const rawSearchQuery = typeof rawBody.searchQuery === 'string' ? rawBody.searchQuery.trim() : '';

  // ── Conversation history (multi-turn context) ──
  const conversationHistory = sanitizeHistory(rawBody.history);

  let body: GeminiRequestBody;
  let prompt: string;
  let truncated = false;

  // PR-5: classify before building any prompt.
  let classificationSource: string | null = null;
  if (rawSearchQuery) {
    classificationSource = rawSearchQuery;
  } else {
    const body0 = rawBody as GeminiRequestBody;
    if (Array.isArray(body0?.contents)) {
      const extracted = extractPrompt(body0);
      if (extracted) classificationSource = extracted;
    }
  }
  const classification = classificationSource
    ? classifyAxonDomain(classificationSource)
    : null;

  if (classification && classification.category === 'off-domain') {
    const refusal = offDomainRefusalText(classificationSource!, classification.reason);
    return jsonResponse({
      candidates: [{ content: { parts: [{ text: refusal }] } }],
      meta: {
        provider: 'none',
        domain: {
          category: classification.category,
          reason: classification.reason,
          signals: classification.signals,
        },
        parseError: { code: 'NO_OBJECT', message: 'Off-domain query — no pathway output produced.' },
      },
    });
  }

  if (classification && classification.category === 'general-knowledge' && !classification.allowProseAnswer) {
    const refusal = offDomainRefusalText(
      classificationSource!,
      'short generic query with no scientific context',
    );
    return jsonResponse({
      candidates: [{ content: { parts: [{ text: refusal }] } }],
      meta: {
        provider: 'none',
        domain: {
          category: classification.category,
          reason: classification.reason,
          signals: classification.signals,
        },
        parseError: { code: 'NO_OBJECT', message: 'General-knowledge query — routed to refusal, not biosynthesis.' },
      },
    });
  }

  const useBiosynthesisPrompt = !classification || classification.allowBiosynthesisPrompt;
  const activeSystemPrompt = useBiosynthesisPrompt ? AXON_SYSTEM_PROMPT : AXON_PROSE_SYSTEM_PROMPT;

  if (rawSearchQuery) {
    if (rawSearchQuery.length > MAX_SEARCH_QUERY_CHARS) {
      return errorResponse(`searchQuery exceeds ${MAX_SEARCH_QUERY_CHARS} characters`, 413, undefined, getCorsHeaders(req));
    }
    const safeQuery = sanitizePromptInput(rawSearchQuery, MAX_SEARCH_QUERY_CHARS).value;
    if (useBiosynthesisPrompt) {
      prompt = buildDynamicPrompt(safeQuery);
      body = {
        contents: [{ parts: [{ text: withSystemPrompt(prompt) }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      };
    } else {
      prompt = safeQuery;
      body = {
        contents: [{ parts: [{ text: withProseSystemPrompt(prompt) }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      };
    }
  } else {
    // Legacy mode: Gemini-format request body with contents array
    body = rawBody as GeminiRequestBody;

    if (!body?.contents || !Array.isArray(body.contents) || body.contents.length === 0) {
      return errorResponse('Missing contents array or searchQuery', 400, undefined, getCorsHeaders(req));
    }

    const extracted = extractPrompt(body);
    if (!extracted) {
      return errorResponse('No prompt text found', 400, undefined, getCorsHeaders(req));
    }

    const cleaned = sanitizePromptInput(extracted, MAX_PROMPT_CHARS);
    truncated = cleaned.truncated;
    prompt = useBiosynthesisPrompt
      ? withSystemPrompt(cleaned.value)
      : withProseSystemPrompt(cleaned.value);
  }

  // Final hard cap — withSystemPrompt adds the Axon header on top.
  if (prompt.length > MAX_PROMPT_CHARS + AXON_SYSTEM_PROMPT.length + 64) {
    return errorResponse(`Prompt exceeds ${MAX_PROMPT_CHARS} characters after assembly`, 413, undefined, getCorsHeaders(req));
  }

  const textOnlyRequest = rawSearchQuery ? true : isTextOnlyRequest(body);

  if (!rawSearchQuery && hasMultimodalContent(body) && !geminiKey) {
    return errorResponse('This request includes non-text content such as an image or file and requires GEMINI_API_KEY. Please configure it in your environment variables.', 503, undefined, getCorsHeaders(req));
  }

  const buildMeta = (provider: 'groq' | 'gemini', enriched: EnrichResult) => {
    const meta: Record<string, unknown> = { provider };
    if (rawSearchQuery) meta.searchQuery = rawSearchQuery;
    if (truncated) meta.truncated = true;
    if (enriched.parseError) meta.parseError = enriched.parseError;
    if (conversationHistory.length > 0) {
      meta.historyTurns = conversationHistory.length;
    }
    if (classification) {
      meta.domain = {
        category: classification.category,
        reason: classification.reason,
        signals: classification.signals,
      };
    }
    return meta;
  };

  // ── Try Groq first ──
  if (groqKey && textOnlyRequest) {
    const groqResult = await tryGroq(prompt, groqKey, activeSystemPrompt, conversationHistory);
    if (groqResult) {
      const enriched: EnrichResult = useBiosynthesisPrompt
        ? enrichAxonOutput(groqResult)
        : { text: groqResult, parseError: { code: 'NO_OBJECT', message: 'Prose response — pathway schema not requested.' } };
      return jsonResponse({
        candidates: [{
          content: {
            parts: [{ text: enriched.text }]
          }
        }],
        meta: buildMeta('groq', enriched)
      });
    }
  }

  // ── Fallback to Gemini ──
  if (geminiKey) {
    const geminiResult = await tryGemini(body, geminiKey, activeSystemPrompt, conversationHistory);
    if (geminiResult) {
      const enriched: EnrichResult = useBiosynthesisPrompt
        ? enrichAxonOutput(geminiResult)
        : { text: geminiResult, parseError: { code: 'NO_OBJECT', message: 'Prose response — pathway schema not requested.' } };
      return jsonResponse({
        candidates: [{
          content: {
            parts: [{ text: enriched.text }]
          }
        }],
        meta: buildMeta('gemini', enriched)
      });
    }
  }

  // ── All providers failed ──
  return errorResponse('All AI providers are currently unavailable. Please try again in a moment.', 503, undefined, getCorsHeaders(req));
}
