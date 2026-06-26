/**
 * ConversationManager — CRUD for Copilot multi-turn conversations.
 *
 * Uses the existing ai_conversations / ai_messages tables from
 * src/server/db/schema/ai.ts via the DatabaseAdapter.
 *
 * Design:
 *   - Stateless per-call: each method opens a prepared statement, runs it, returns.
 *   - Max 20 messages in context window; older messages are summarised.
 *   - IDs are crypto.randomUUID()-style strings (caller may inject idFactory for tests).
 */

import type { DatabaseAdapter } from "../../server/db/adapter";

// ── Public types ──────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  projectId: string | null;
  userId: string;
  title: string;
  messages: CopilotMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResult?: unknown;
  timestamp: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  inputs: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────

function generateId(): string {
  return `cop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ── ConversationManager ───────────────────────────────────────────────

export class ConversationManager {
  private db: DatabaseAdapter;
  private idFactory: () => string;

  constructor(db: DatabaseAdapter, opts?: { idFactory?: () => string }) {
    this.db = db;
    this.idFactory = opts?.idFactory ?? generateId;
  }

  // ── Create ────────────────────────────────────────────────────────

  async createConversation(
    projectId: string | null,
    userId: string,
    title?: string,
  ): Promise<Conversation> {
    const id = this.idFactory();
    const ts = nowISO();
    const safeTitle = title ?? "New Conversation";

    this.db
      .prepare(
        `INSERT INTO ai_conversations (id, project_id, user_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, projectId, userId, safeTitle, ts, ts);

    return {
      id,
      projectId,
      userId,
      title: safeTitle,
      messages: [],
      createdAt: ts,
      updatedAt: ts,
    };
  }

  // ── Read ──────────────────────────────────────────────────────────

  async getConversation(id: string): Promise<Conversation | null> {
    const row = this.db
      .prepare(`SELECT * FROM ai_conversations WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;

    const messages = this.db
      .prepare(
        `SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      )
      .all(id) as Record<string, unknown>[];

    return {
      id: row.id as string,
      projectId: (row.project_id as string) ?? null,
      userId: row.user_id as string,
      title: (row.title as string) ?? "Untitled",
      messages: messages.map(this.rowToMessage),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // ── Add message ───────────────────────────────────────────────────

  async addMessage(
    conversationId: string,
    message: Omit<CopilotMessage, "id" | "timestamp">,
  ): Promise<CopilotMessage> {
    const id = this.idFactory();
    const ts = nowISO();
    const toolCallsJson = message.toolCalls
      ? JSON.stringify(message.toolCalls)
      : null;
    const toolResultJson =
      message.toolResult !== undefined
        ? JSON.stringify(message.toolResult)
        : null;

    this.db
      .prepare(
        `INSERT INTO ai_messages (id, conversation_id, role, content, tool_calls, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, conversationId, message.role, message.content, toolCallsJson, ts);

    // Touch conversation updated_at
    this.db
      .prepare(`UPDATE ai_conversations SET updated_at = ? WHERE id = ?`)
      .run(ts, conversationId);

    return {
      id,
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls,
      toolResult: message.toolResult,
      timestamp: ts,
    };
  }

  // ── Get recent messages (for context window) ──────────────────────

  async getRecentMessages(
    conversationId: string,
    limit = 20,
  ): Promise<CopilotMessage[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM ai_messages WHERE conversation_id = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(conversationId, limit) as Record<string, unknown>[];

    // Reverse so oldest-first
    return rows.reverse().map(this.rowToMessage);
  }

  // ── Summarize older messages ──────────────────────────────────────

  async summarizeOldMessages(conversationId: string): Promise<string> {
    const total = this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM ai_messages WHERE conversation_id = ?`,
      )
      .get(conversationId) as Record<string, unknown> | undefined;

    const count = Number(total?.cnt ?? 0);
    if (count <= 20) return "";

    // Get messages older than the most recent 20
    const oldRows = this.db
      .prepare(
        `SELECT role, content FROM ai_messages WHERE conversation_id = ?
         ORDER BY created_at ASC LIMIT ?`,
      )
      .all(conversationId, count - 20) as Record<string, unknown>[];

    if (oldRows.length === 0) return "";

    // Build a plain-text summary of the older conversation turns
    const lines = oldRows.map(
      (r) => `[${r.role}]: ${String(r.content).slice(0, 200)}`,
    );
    return `Previous conversation summary (${oldRows.length} messages):\n${lines.join("\n")}`;
  }

  // ── List conversations ────────────────────────────────────────────

  async listConversations(
    userId: string,
    projectId?: string,
  ): Promise<Conversation[]> {
    let rows: Record<string, unknown>[];

    if (projectId) {
      rows = this.db
        .prepare(
          `SELECT * FROM ai_conversations WHERE user_id = ? AND project_id = ?
           ORDER BY updated_at DESC`,
        )
        .all(userId, projectId) as Record<string, unknown>[];
    } else {
      rows = this.db
        .prepare(
          `SELECT * FROM ai_conversations WHERE user_id = ?
           ORDER BY updated_at DESC`,
        )
        .all(userId) as Record<string, unknown>[];
    }

    return rows.map((row) => ({
      id: row.id as string,
      projectId: (row.project_id as string) ?? null,
      userId: row.user_id as string,
      title: (row.title as string) ?? "Untitled",
      messages: [], // Lazy — don't load messages for list view
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }

  // ── Internal ──────────────────────────────────────────────────────

  private rowToMessage(row: Record<string, unknown>): CopilotMessage {
    let toolCalls: ToolCall[] | undefined;
    if (row.tool_calls && typeof row.tool_calls === "string") {
      try {
        toolCalls = JSON.parse(row.tool_calls);
      } catch {
        toolCalls = undefined;
      }
    }

    return {
      id: row.id as string,
      role: row.role as CopilotMessage["role"],
      content: row.content as string,
      toolCalls,
      timestamp: row.created_at as string,
    };
  }
}
