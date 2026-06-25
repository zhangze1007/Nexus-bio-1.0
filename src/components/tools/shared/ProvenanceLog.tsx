"use client";

import { THEME } from "../../../theme";

/**
 * ProvenanceLog — Audit trail display.
 *
 * Timeline of entries with tool name, timestamp (relative), validity badge.
 * Compact mode shows just icons.
 */

export interface ProvenanceEntry {
  toolId: string;
  timestamp: number;
  validityTier: "real" | "partial" | "demo";
  source?: string;
}

interface ProvenanceLogProps {
  entries: ProvenanceEntry[];
  compact?: boolean;
}

const TIER_BADGE: Record<ProvenanceEntry["validityTier"], { label: string; color: string; bg: string }> = {
  real: { label: "REAL", color: THEME.MINT, bg: "rgba(191, 220, 205, 0.14)" },
  partial: { label: "PARTIAL", color: THEME.APRICOT, bg: "rgba(231, 199, 169, 0.14)" },
  demo: { label: "DEMO", color: THEME.LILAC, bg: "rgba(207, 196, 227, 0.14)" },
};

const TOOL_ICONS: Record<string, string> = {
  pathd: "λ",
  fbasim: "Σ",
  cethx: "Δ",
  catdes: "❂",
  proevol: "Ω",
  gecair: "⚙",
  genmim: "⚛",
  dyncon: "⧖",
  cellfree: "⚗",
  multio: "⬡",
  scspatial: "⬢",
  dbtlflow: "↻",
  nexai: "✦",
  metabolic: "☣",
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function ProvenanceLog({ entries, compact = false }: ProvenanceLogProps) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_SM,
          color: THEME.DIM,
          padding: "12px",
          textAlign: "center",
        }}
      >
        No provenance entries.
      </div>
    );
  }

  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          flexWrap: "wrap",
        }}
      >
        {entries.map((entry, i) => {
          const tier = TIER_BADGE[entry.validityTier];
          const icon = TOOL_ICONS[entry.toolId] || "•";
          return (
            <span
              key={i}
              title={`${entry.toolId} — ${tier.label} — ${formatRelativeTime(entry.timestamp)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: tier.bg,
                border: `1px solid ${tier.color}33`,
                fontFamily: THEME.MONO,
                fontSize: "10px",
                color: tier.color,
                cursor: "default",
              }}
            >
              {icon}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        position: "relative",
      }}
    >
      {entries.map((entry, i) => {
        const tier = TIER_BADGE[entry.validityTier];
        const icon = TOOL_ICONS[entry.toolId] || "•";
        const isLast = i === entries.length - 1;

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              position: "relative",
              paddingBottom: isLast ? 0 : "14px",
            }}
          >
            {/* Timeline: icon + vertical line */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                flexShrink: 0,
                width: "24px",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: tier.bg,
                  border: `1px solid ${tier.color}44`,
                  fontFamily: THEME.MONO,
                  fontSize: "11px",
                  color: tier.color,
                  zIndex: 1,
                }}
              >
                {icon}
              </span>
              {!isLast && (
                <div
                  style={{
                    width: "1px",
                    flex: 1,
                    minHeight: "8px",
                    background: THEME.BORDER,
                    marginTop: "4px",
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                flex: 1,
                minWidth: 0,
                paddingTop: "2px",
              }}
            >
              {/* Top row: tool + badge + time */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: THEME.FS_SM,
                    fontWeight: 600,
                    color: THEME.VALUE,
                  }}
                >
                  {entry.toolId}
                </span>

                {/* Validity badge */}
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: tier.color,
                    padding: "1px 6px",
                    borderRadius: "999px",
                    background: tier.bg,
                    border: `1px solid ${tier.color}33`,
                  }}
                >
                  {tier.label}
                </span>

                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "10px",
                    color: THEME.DIM,
                    marginLeft: "auto",
                  }}
                >
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>

              {/* Source */}
              {entry.source && (
                <span
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: THEME.FS_XS,
                    color: THEME.DIM,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.source}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
