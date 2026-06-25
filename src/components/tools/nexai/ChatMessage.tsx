"use client";
import { THEME } from "../../../theme";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessageProps {
  role: MessageRole;
  content: string;
  timestamp?: number;
  confidence?: number;
  citations?: number;
  isLoading?: boolean;
  actions?: Array<{ label: string; onClick: () => void; accent?: string }>;
}

export function ChatMessage({ role, content, timestamp, confidence, citations, isLoading, actions }: ChatMessageProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "14px 16px",
        borderRadius: "var(--nb-radius-lg)",
        background: isUser
          ? "rgba(175, 195, 214, 0.12)"
          : isSystem
            ? "rgba(147, 203, 82, 0.06)"
            : THEME.PANEL_GLASS_STRONG,
        border: `1px solid ${
          isUser ? "rgba(175, 195, 214, 0.15)" : isSystem ? "rgba(147, 203, 82, 0.12)" : THEME.BORDER
        }`,
        backdropFilter: isUser ? "none" : "blur(12px)",
        WebkitBackdropFilter: isUser ? "none" : "blur(12px)",
      }}
    >
      {/* Header: role badge + timestamp + metadata */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          fontSize: "var(--nb-fs-xs)",
          fontFamily: THEME.MONO,
        }}
      >
        <span
          style={{
            padding: "2px 7px",
            borderRadius: "6px",
            background: isUser
              ? "rgba(175,195,214,0.12)"
              : isSystem
                ? "rgba(147,203,82,0.12)"
                : "rgba(163,195,214,0.12)",
            color: isUser ? THEME.LABEL : isSystem ? "#93CB52" : THEME.SKY,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
          }}
        >
          {isUser ? "You" : isSystem ? "System" : "Axon"}
        </span>
        {timestamp !== undefined && (
          <span style={{ color: THEME.INK_SOFT, fontSize: "var(--nb-fs-xs)" }}>
            {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {confidence !== undefined && (
          <span
            style={{
              padding: "1px 5px",
              borderRadius: "4px",
              background:
                confidence > 0.7
                  ? "rgba(147,203,82,0.12)"
                  : confidence > 0.4
                    ? "rgba(231,199,169,0.12)"
                    : "rgba(250,128,114,0.12)",
              color: confidence > 0.7 ? "#93CB52" : confidence > 0.4 ? THEME.APRICOT : THEME.CORAL,
              fontSize: "var(--nb-fs-xs)",
            }}
          >
            {(confidence * 100).toFixed(0)}% conf
          </span>
        )}
        {citations !== undefined && citations > 0 && (
          <span
            style={{
              padding: "1px 5px",
              borderRadius: "4px",
              background: "rgba(175,195,214,0.10)",
              color: THEME.LABEL,
              fontSize: "var(--nb-fs-xs)",
            }}
          >
            {citations} citation{citations !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "flex", gap: "5px", padding: "10px 0" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: THEME.SKY,
                animation: `axon-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            lineHeight: 1.65,
            color: THEME.VALUE,
            whiteSpace: "pre-wrap",
          }}
        >
          {content}
        </div>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && !isLoading && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--nb-radius-sm)",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${action.accent ?? "rgba(255,255,255,0.10)"}`,
                color: action.accent ?? THEME.LABEL,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
