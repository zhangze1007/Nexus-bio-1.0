/**
 * Copilot API — Multi-turn conversation with tool calling.
 *
 * POST /api/copilot
 * Body: { conversationId?: string, message: string, projectId?: string, userId?: string }
 * Response: SSE stream of { type: 'token' | 'tool_call' | 'done' | 'error', data: ... }
 *
 * Uses Node.js runtime (not Edge) because it needs DatabaseAdapter.
 */

import { NextRequest } from "next/server";
import { getDb } from "../../../src/server/db/adapter";
import {
  ConversationManager,
  buildSystemPrompt,
  executeToolCall,
  extractToolCall,
  type CopilotContext,
} from "../../../src/services/copilot";
import { tryGroq, tryGemini } from "../../../src/services/analyze/providerChain";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";
import type { ConversationTurn } from "../../../src/services/analyze/types";
import { checkRateLimit } from "../../../src/utils/rateLimit";

export const runtime = "nodejs";

// ── SSE helpers ───────────────────────────────────────────────────────

function sseResponse(controller: ReadableStreamDefaultController) {
  return {
    send(data: Record<string, unknown>) {
      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
      );
    },
    close() {
      controller.close();
    },
  };
}

// ── Route handlers ────────────────────────────────────────────────────

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  // Rate limit
  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!(await checkRateLimit(ip, '/api/copilot')).allowed) {
    return new Response(
      JSON.stringify({ ok: false, error: "Rate limit exceeded" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
          ...getCorsHeaders(req),
        },
      },
    );
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      },
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId : null;
  const projectId =
    typeof body.projectId === "string" ? body.projectId : null;
  const userId = typeof body.userId === "string" ? body.userId : "anonymous";

  if (!message) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing 'message' field" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      },
    );
  }

  // Check API keys
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!groqKey && !geminiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "No API keys configured" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      },
    );
  }

  // Set up SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const sse = sseResponse(controller);

      try {
        const db = getDb();
        const manager = new ConversationManager(db);

        // Create or resume conversation
        let convId = conversationId;
        if (!convId) {
          const conv = await manager.createConversation(
            projectId,
            userId,
            message.slice(0, 80),
          );
          convId = conv.id;
          sse.send({ type: "conversation", data: { id: convId } });
        }

        // Add user message
        await manager.addMessage(convId, {
          role: "user",
          content: message,
        });

        // Get recent messages for context
        const recentMessages = await manager.getRecentMessages(convId, 20);
        const conversationSummary = await manager.summarizeOldMessages(convId);

        // Build conversation history for the LLM
        const history: ConversationTurn[] = recentMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(0, -1) // Exclude the message we just added
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // Build system prompt
        const context: CopilotContext = {
          conversationSummary: conversationSummary || undefined,
          toolCatalog: undefined, // Use full catalog
        };
        const systemPrompt = buildSystemPrompt(context);

        // Call LLM
        let responseText: string | null = null;

        if (groqKey) {
          responseText = await tryGroq(
            message,
            groqKey,
            systemPrompt,
            history,
          );
        }

        if (!responseText && geminiKey) {
          const geminiBody = {
            contents: [{ parts: [{ text: message }] }],
          };
          responseText = await tryGemini(
            geminiBody,
            geminiKey,
            systemPrompt,
            history,
          );
        }

        if (!responseText) {
          sse.send({
            type: "error",
            data: "All AI providers are currently unavailable.",
          });
          sse.close();
          return;
        }

        // Check for tool call in response
        const toolCall = extractToolCall(responseText);

        if (toolCall) {
          // Notify client about tool call
          sse.send({
            type: "tool_call",
            data: { tool: toolCall.tool, inputs: toolCall.inputs },
          });

          // Execute tool
          const toolResult = await executeToolCall({
            tool: toolCall.tool,
            inputs: toolCall.inputs,
            conversationId: convId,
          });

          // Save assistant message with tool call
          const assistantMsg = await manager.addMessage(convId, {
            role: "assistant",
            content: responseText,
            toolCalls: [
              {
                id: toolResult.id,
                tool: toolResult.tool,
                inputs: toolResult.inputs,
                status: toolResult.status,
                result: toolResult.result,
              },
            ],
          });

          // Save tool result as tool message
          await manager.addMessage(convId, {
            role: "tool",
            content: JSON.stringify(toolResult.result ?? toolResult.error),
            toolResult: toolResult,
          });

          sse.send({
            type: "token",
            data: responseText.replace(/```tool_call[\s\S]*?```/, "").trim(),
          });
          sse.send({
            type: "tool_result",
            data: toolResult,
          });
        } else {
          // Plain text response — no tool call
          await manager.addMessage(convId, {
            role: "assistant",
            content: responseText,
          });

          sse.send({ type: "token", data: responseText });
        }

        sse.send({ type: "done", data: { conversationId: convId } });
        sse.close();
      } catch (err) {
        console.error('[api/copilot] Error:', err);
        sse.send({
          type: "error",
          data: "An internal error occurred",
        });
        sse.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...getCorsHeaders(req),
    },
  });
}
