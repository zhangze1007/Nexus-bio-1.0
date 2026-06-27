/**
 * Zod schema for the /api/analyze request body.
 *
 * The analyze route accepts two mutually exclusive input modes:
 *   1. searchQuery mode: { searchQuery: string, history?: ConversationTurn[] }
 *   2. Legacy Gemini mode: { contents: GeminiContent[], generationConfig?: ... }
 */
import { z } from "zod";

const GeminiPartSchema = z.object({
  text: z.string().optional(),
  inline_data: z.unknown().optional(),
  file_data: z.unknown().optional(),
});

const GeminiContentSchema = z.object({
  role: z.enum(["user", "model"]).optional(),
  parts: z.array(GeminiPartSchema).optional(),
});

const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

/**
 * Union schema: either searchQuery mode or legacy Gemini contents mode.
 * Validated at the top of the POST handler before any processing.
 */
export const AnalyzeRequestSchema = z.union([
  // Mode 1: searchQuery
  z.object({
    searchQuery: z.string().min(1).max(500),
    history: z.array(ConversationTurnSchema).max(5).optional(),
  }),
  // Mode 2: legacy Gemini contents
  z.object({
    contents: z.array(GeminiContentSchema).min(1),
    generationConfig: z.record(z.string(), z.unknown()).optional(),
    systemInstruction: z.object({
      parts: z.array(z.object({ text: z.string() })),
    }).optional(),
    history: z.array(ConversationTurnSchema).max(5).optional(),
  }),
]);

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
