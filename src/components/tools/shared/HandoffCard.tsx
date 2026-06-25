"use client";

import { THEME } from "../../../theme";

/**
 * HandoffCard — "Send to downstream tool" card.
 *
 * Glass card showing from->to flow, payload summary,
 * and "Send to {toTool}" button. Uses MINT accent for the send button.
 */

interface HandoffCardProps {
  fromTool: string;
  toTool: string;
  payloadSummary: string;
  onSend: () => void;
}

export default function HandoffCard({ fromTool, toTool, payloadSummary, onSend }: HandoffCardProps) {
  return (
    <div
      style={{
        borderRadius: THEME.R_MD,
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_SURFACE,
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Header: from -> to */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: THEME.LABEL,
          }}
        >
          Handoff
        </span>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginLeft: "auto",
          }}
        >
          {/* From badge */}
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              fontWeight: 600,
              color: THEME.VALUE,
              padding: "2px 8px",
              borderRadius: THEME.R_SM,
              background: "rgba(175, 195, 214, 0.12)",
              border: `1px solid rgba(175, 195, 214, 0.2)`,
            }}
          >
            {fromTool}
          </span>

          {/* Arrow */}
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_SM,
              color: THEME.DIM,
            }}
          >
            &rarr;
          </span>

          {/* To badge */}
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              fontWeight: 600,
              color: THEME.VALUE,
              padding: "2px 8px",
              borderRadius: THEME.R_SM,
              background: "rgba(191, 220, 205, 0.12)",
              border: `1px solid rgba(191, 220, 205, 0.2)`,
            }}
          >
            {toTool}
          </span>
        </div>
      </div>

      {/* Payload summary */}
      <p
        style={{
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_SM,
          color: THEME.LABEL,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {payloadSummary}
      </p>

      {/* Send button */}
      <button
        type="button"
        onClick={onSend}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          height: "34px",
          padding: "0 14px",
          borderRadius: THEME.R_SM,
          border: "1px solid transparent",
          background: THEME.MINT,
          color: "#0a0a0a",
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_SM,
          fontWeight: 600,
          cursor: "pointer",
          transition: "background 80ms, transform 120ms ease",
          whiteSpace: "nowrap",
          alignSelf: "flex-start",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#A8CDB9";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = THEME.MINT;
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.background = "#96BDAA";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.background = "#A8CDB9";
        }}
      >
        <span style={{ fontSize: "12px", lineHeight: 1 }}>&#9654;</span>
        Send to {toTool}
      </button>
    </div>
  );
}
