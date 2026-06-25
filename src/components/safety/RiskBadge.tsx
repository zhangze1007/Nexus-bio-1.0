"use client";
/**
 * RiskBadge — Compact risk level indicator
 *
 * Reusable across all modules. Shows risk level as a colored badge.
 * Does NOT compute risk — only displays it.
 */

import React from "react";
import type { RiskLevel } from "../../core/safety/riskModel";
import { getRiskColor, getRiskLabel } from "../../core/safety/riskModel";

interface RiskBadgeProps {
  level: RiskLevel;
  /** Optional score to display alongside level */
  score?: number;
  /** Show label text (default: true) */
  showLabel?: boolean;
  /** Size variant */
  size?: "sm" | "md";
}

export function RiskBadge({ level, score, showLabel = true, size = "md" }: RiskBadgeProps) {
  const color = getRiskColor(level);
  const label = getRiskLabel(level);
  const fontSize = size === "sm" ? "10px" : "12px";
  const padding = size === "sm" ? "2px 6px" : "3px 8px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding,
        background: `${color}22`,
        border: `1px solid ${color}44`,
        borderRadius: "4px",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize,
        color,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {showLabel && label}
      {score !== undefined && <span style={{ opacity: 0.7, fontSize: "9px" }}>({(score * 100).toFixed(0)}%)</span>}
    </span>
  );
}
