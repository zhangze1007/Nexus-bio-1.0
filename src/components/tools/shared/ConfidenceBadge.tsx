"use client";

import { THEME } from "../../../theme";

/**
 * ConfidenceBadge — Confidence/risk indicator pill.
 *
 * Color-coded pill: green (>high), yellow (between), red (<low).
 * Shows percentage. Optional label.
 */

interface ConfidenceBadgeProps {
  value: number; // 0-1
  label?: string;
  thresholds?: { high: number; low: number }; // defaults: 0.7, 0.4
}

const DEFAULT_THRESHOLDS = { high: 0.7, low: 0.4 };

export default function ConfidenceBadge({ value, label, thresholds = DEFAULT_THRESHOLDS }: ConfidenceBadgeProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);

  let accentColor: string;
  let bgOpacity: string;
  let borderOpacity: string;

  if (clamped >= thresholds.high) {
    accentColor = THEME.MINT;
    bgOpacity = "0.14";
    borderOpacity = "0.25";
  } else if (clamped >= thresholds.low) {
    accentColor = THEME.APRICOT;
    bgOpacity = "0.14";
    borderOpacity = "0.25";
  } else {
    accentColor = THEME.CORAL;
    bgOpacity = "0.14";
    borderOpacity = "0.25";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 10px",
        borderRadius: "999px",
        background: `rgba(${hexToRgb(accentColor)}, ${bgOpacity})`,
        border: `1px solid rgba(${hexToRgb(accentColor)}, ${borderOpacity})`,
        whiteSpace: "nowrap",
      }}
    >
      {/* Dot indicator */}
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: accentColor,
          flexShrink: 0,
        }}
      />

      {/* Label */}
      {label && (
        <span
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_XS,
            fontWeight: 500,
            color: THEME.LABEL,
          }}
        >
          {label}
        </span>
      )}

      {/* Value */}
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          fontWeight: 700,
          color: accentColor,
          fontFeatureSettings: "'tnum' 1",
        }}
      >
        {pct}%
      </span>
    </span>
  );
}

/** Convert hex color to comma-separated RGB for rgba() usage. */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
