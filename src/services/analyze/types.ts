/**
 * Shared types and constants for the analyze API route.
 * Extracted from app/api/analyze/route.ts.
 */

// ── Model providers in priority order ──
// Groq: primary (1000 req/day, very stable)
// Gemini: fallback (250 req/day)

export const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama3-70b-8192"] as const;

export const GEMINI_MODELS = ["gemini-2.0-flash-lite", "gemini-1.5-flash"] as const;

export const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const TIMEOUT_MS = 12_000;

// ── Input safety limits ──
export const MAX_PROMPT_CHARS = 24_000;
export const MAX_SEARCH_QUERY_CHARS = 500;

// ── Conversation history limits ──
export const MAX_HISTORY_TURNS = 5;
export const MAX_HISTORY_MSG_CHARS = 1_000;
export const MAX_HISTORY_TOTAL_CHARS = 6_000;

// ── Shared types ──

export type GeminiPart = {
  text?: string;
  inline_data?: unknown;
  file_data?: unknown;
};

export type GeminiContent = {
  role?: "user" | "model";
  parts?: GeminiPart[];
};

export type GeminiRequestBody = {
  contents?: GeminiContent[];
  generationConfig?: Record<string, unknown>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
};

export type JsonRecord = Record<string, unknown>;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}
