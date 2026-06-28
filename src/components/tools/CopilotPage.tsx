"use client";
/**
 * CopilotPage — Multi-turn conversation interface for Nexus-Bio.
 *
 * Features:
 *   - Message list (scrollable)
 *   - Input field with send button
 *   - Tool call cards (expandable)
 *   - Conversation sidebar (past conversations)
 *   - "New Conversation" button
 *
 * Dark theme only, uses THEME tokens from src/theme/index.ts.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { THEME } from "../../theme";

// ── Types ────────────────────────────────────────────────────────────

interface ToolCallData {
  id: string;
  tool: string;
  inputs: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCallData[];
  toolResult?: unknown;
  timestamp: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

// ── Constants ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Design a pathway for lycopene biosynthesis from glucose.",
  "Run FBA on the current pathway and identify bottlenecks.",
  "Compare thermodynamic feasibility of two candidate enzymes.",
  "Explain the DBTL cycle and suggest the next iteration step.",
];

// ── Sub-components ───────────────────────────────────────────────────

function ToolCallCard({ tc }: { tc: ToolCallData }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor =
    tc.status === "completed"
      ? THEME.SUCCESS_HIGH
      : tc.status === "failed"
        ? THEME.RISK_HIGH
        : tc.status === "running"
          ? THEME.SKY
          : THEME.DIM;

  return (
    <div
      style={{
        background: THEME.PANEL_INSET,
        border: `1px solid ${THEME.BORDER}`,
        borderRadius: THEME.R_MD,
        padding: "10px 14px",
        marginTop: 8,
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
      role="button"
      tabIndex={0}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_SM,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: statusColor,
            flexShrink: 0,
          }}
        />
        <span style={{ color: THEME.VALUE, fontWeight: 600 }}>{tc.tool}</span>
        <span style={{ color: THEME.DIM, marginLeft: "auto" }}>{tc.status}</span>
      </div>
      {expanded && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${THEME.BORDER}`,
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.LABEL,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <div style={{ marginBottom: 4, color: THEME.DIM }}>Inputs:</div>
          <div style={{ marginBottom: 8 }}>{JSON.stringify(tc.inputs, null, 2)}</div>
          {tc.result !== undefined && (
            <>
              <div style={{ marginBottom: 4, color: THEME.DIM }}>Result:</div>
              <div>{JSON.stringify(tc.result, null, 2).slice(0, 1000)}</div>
            </>
          )}
          {tc.error && (
            <>
              <div style={{ marginBottom: 4, color: THEME.RISK_HIGH }}>Error:</div>
              <div>{tc.error}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const isTool = msg.role === "tool";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      {/* Role label */}
      <div
        style={{
          fontSize: THEME.FS_XS,
          fontFamily: THEME.MONO,
          color: isUser ? THEME.SKY : isTool ? THEME.MINT : THEME.LILAC,
          marginBottom: 4,
          paddingLeft: isUser ? 0 : 4,
          paddingRight: isUser ? 4 : 0,
        }}
      >
        {isUser ? "You" : isTool ? "Tool Result" : "Copilot"}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: "80%",
          padding: "12px 16px",
          borderRadius: isUser
            ? `${THEME.R_MD} ${THEME.R_MD} 4px ${THEME.R_MD}`
            : `${THEME.R_MD} ${THEME.R_MD} ${THEME.R_MD} 4px`,
          background: isUser
            ? "rgba(175, 195, 214, 0.12)"
            : isTool
              ? "rgba(191, 220, 205, 0.08)"
              : THEME.PANEL_GLASS_STRONG,
          border: `1px solid ${
            isUser ? "rgba(175, 195, 214, 0.15)" : isTool ? "rgba(191, 220, 205, 0.12)" : THEME.BORDER
          }`,
          color: THEME.VALUE,
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_MD,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {msg.content}

        {/* Tool calls */}
        {msg.toolCalls?.map((tc) => (
          <ToolCallCard key={tc.id} tc={tc} />
        ))}
      </div>

      {/* Timestamp */}
      <div
        style={{
          fontSize: THEME.FS_XS,
          fontFamily: THEME.MONO,
          color: THEME.DIM,
          marginTop: 2,
          paddingLeft: isUser ? 0 : 4,
          paddingRight: isUser ? 4 : 0,
        }}
      >
        {new Date(msg.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load conversation list on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await fetch("/api/copilot?list=true&userId=anonymous");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // Ignore — sidebar is optional
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/copilot?conversationId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
        setConversationId(id);
        setSidebarOpen(false);
      }
    } catch {
      // Ignore
    }
  };

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    // Add user message to UI immediately
    const userMsg: Message = {
      id: `temp_${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId,
          projectId: null,
          userId: "anonymous",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "system",
            content: err.error ?? "Request failed",
            timestamp: new Date().toISOString(),
          },
        ]);
        setLoading(false);
        return;
      }

      // Process SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let toolCalls: ToolCallData[] = [];
      let convId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case "conversation":
                convId = event.data.id;
                setConversationId(convId);
                break;

              case "token":
                assistantContent += event.data;
                break;

              case "tool_call":
                toolCalls.push({
                  id: `tc_${Date.now()}`,
                  tool: event.data.tool,
                  inputs: event.data.inputs,
                  status: "running",
                });
                break;

              case "tool_result":
                toolCalls = toolCalls.map((tc) =>
                  tc.tool === event.data.tool
                    ? {
                        ...tc,
                        status: event.data.status,
                        result: event.data.result,
                        error: event.data.error,
                      }
                    : tc,
                );
                break;

              case "error":
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `err_${Date.now()}`,
                    role: "system",
                    content: event.data,
                    timestamp: new Date().toISOString(),
                  },
                ]);
                break;

              case "done":
                break;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      // Add assistant message
      if (assistantContent || toolCalls.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            role: "assistant",
            content: assistantContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      // Refresh conversation list
      loadConversations();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "system",
          content: err instanceof Error ? err.message : "Network error",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, conversationId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.nativeEvent as KeyboardEvent).isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    inputRef.current?.focus();
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: "100vh",
        background: THEME.BG_SHELL,
        color: THEME.VALUE,
        fontFamily: THEME.SANS,
      }}
    >
      {/* Sidebar — conversation list */}
      {sidebarOpen && (
        <div
          style={{
            width: 280,
            background: THEME.BG_SIDEBAR,
            borderRight: `1px solid ${THEME.BORDER}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px",
              borderBottom: `1px solid ${THEME.BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: THEME.BRAND,
                fontSize: THEME.FS_LG,
                fontWeight: 600,
              }}
            >
              Conversations
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: THEME.DIM,
                cursor: "pointer",
                fontSize: THEME.FS_LG,
                padding: 4,
              }}
            >
              x
            </button>
          </div>

          {/* New conversation button */}
          <button
            onClick={handleNewConversation}
            style={{
              margin: 12,
              padding: "10px 14px",
              background: "rgba(175, 195, 214, 0.12)",
              border: `1px solid ${THEME.BORDER}`,
              borderRadius: THEME.R_MD,
              color: THEME.SKY,
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            + New Conversation
          </button>

          {/* Conversation list */}
          <div style={{ flex: 1, overflow: "auto", padding: "0 12px" }}>
            {conversations.length === 0 && (
              <div
                style={{
                  color: THEME.DIM,
                  fontSize: THEME.FS_SM,
                  padding: "12px 4px",
                }}
              >
                No conversations yet.
              </div>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 12px",
                  marginBottom: 4,
                  background: c.id === conversationId ? "rgba(175, 195, 214, 0.1)" : "transparent",
                  border: `1px solid ${c.id === conversationId ? "rgba(175, 195, 214, 0.2)" : "transparent"}`,
                  borderRadius: THEME.R_SM,
                  color: THEME.VALUE,
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_SM,
                  cursor: "pointer",
                  textAlign: "left",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: `1px solid ${THEME.BORDER}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: THEME.BG_TOPBAR,
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none",
              border: `1px solid ${THEME.BORDER}`,
              borderRadius: THEME.R_SM,
              color: THEME.LABEL,
              cursor: "pointer",
              padding: "6px 10px",
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_SM,
            }}
          >
            {sidebarOpen ? "<<" : ">>"}
          </button>
          <div
            style={{
              fontFamily: THEME.BRAND,
              fontSize: THEME.FS_LG,
              fontWeight: 600,
              color: THEME.VALUE,
            }}
          >
            Nexus-Bio Copilot
          </div>
          <div
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: THEME.DIM,
              marginLeft: 8,
            }}
          >
            {conversationId ? `Conversation: ${conversationId.slice(0, 12)}...` : "New conversation"}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleNewConversation}
            style={{
              background: "rgba(175, 195, 214, 0.08)",
              border: `1px solid ${THEME.BORDER}`,
              borderRadius: THEME.R_SM,
              color: THEME.SKY,
              cursor: "pointer",
              padding: "6px 14px",
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
            }}
          >
            New
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 24px",
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 24,
              }}
            >
              <div
                style={{
                  fontFamily: THEME.BRAND,
                  fontSize: THEME.FS_XXL,
                  fontWeight: 700,
                  color: THEME.VALUE,
                  textAlign: "center",
                }}
              >
                Nexus-Bio Copilot
              </div>
              <div
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_MD,
                  color: THEME.LABEL,
                  textAlign: "center",
                  maxWidth: 480,
                  lineHeight: 1.6,
                }}
              >
                Ask questions about synthetic biology, request pathway designs, run simulations, or explore your
                research data.
              </div>

              {/* Suggestion chips */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                  maxWidth: 600,
                }}
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      inputRef.current?.focus();
                    }}
                    style={{
                      padding: "8px 14px",
                      background: "rgba(175, 195, 214, 0.06)",
                      border: `1px solid ${THEME.BORDER}`,
                      borderRadius: THEME.R_MD,
                      color: THEME.LABEL,
                      fontFamily: THEME.SANS,
                      fontSize: THEME.FS_SM,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                color: THEME.DIM,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: `2px solid ${THEME.BORDER}`,
                  borderTopColor: THEME.SKY,
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Thinking...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: "16px 24px 20px",
            borderTop: `1px solid ${THEME.BORDER}`,
            background: THEME.BG_TOPBAR,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-end",
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about pathways, enzymes, simulations..."
              rows={1}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: THEME.INPUT_BG,
                border: `1px solid ${THEME.INPUT_BORDER}`,
                borderRadius: THEME.R_MD,
                color: THEME.INPUT_TEXT,
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_MD,
                lineHeight: 1.5,
                resize: "none",
                outline: "none",
                minHeight: 44,
                maxHeight: 120,
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                padding: "12px 20px",
                background: loading || !input.trim() ? "rgba(175, 195, 214, 0.06)" : "rgba(175, 195, 214, 0.15)",
                border: `1px solid ${loading || !input.trim() ? THEME.BORDER : "rgba(175, 195, 214, 0.3)"}`,
                borderRadius: THEME.R_MD,
                color: loading || !input.trim() ? THEME.DIM : THEME.SKY,
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_MD,
                fontWeight: 600,
                cursor: loading || !input.trim() ? "default" : "pointer",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              Send
            </button>
          </div>
          <div
            style={{
              textAlign: "center",
              marginTop: 6,
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: THEME.DIM,
            }}
          >
            Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
