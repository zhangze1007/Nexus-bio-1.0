"use client";

import type { ReactNode } from "react";
import { THEME } from "../../../theme";

/**
 * ResultSummaryPanel — Compact 3-5 metric summary above detail views.
 *
 * Row of compact metric displays with optional trend arrows.
 * Actions slot on the right.
 */

export interface SummaryMetric {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "flat";
  accent?: string;
}

interface ResultSummaryPanelProps {
  metrics: SummaryMetric[];
  actions?: ReactNode;
}

const TREND_MAP: Record<"up" | "down" | "flat", { arrow: string; color: string }> = {
  up: { arrow: "↑", color: THEME.MINT },
  down: { arrow: "↓", color: THEME.CORAL },
  flat: { arrow: "→", color: THEME.DIM },
};

export default function ResultSummaryPanel({ metrics, actions }: ResultSummaryPanelProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: "1px",
        borderRadius: THEME.R_MD,
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.BORDER,
        overflow: "hidden",
      }}
    >
      {/* Metric cells */}
      {metrics.map((m, i) => {
        const trend = m.trend ? TREND_MAP[m.trend] : null;
        const accentColor = m.accent || THEME.MINT;

        return (
          <div
            key={i}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              padding: "10px 14px",
              background: THEME.PANEL_SURFACE,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {/* Label */}
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: THEME.LABEL,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {m.label}
            </span>

            {/* Value row */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "4px",
              }}
            >
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_LG,
                  fontWeight: 700,
                  color: accentColor,
                  letterSpacing: "-0.02em",
                  fontFeatureSettings: "'tnum' 1",
                }}
              >
                {m.value}
              </span>
              {m.unit && (
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: THEME.FS_XS,
                    color: THEME.LABEL,
                  }}
                >
                  {m.unit}
                </span>
              )}
              {trend && (
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: THEME.FS_SM,
                    fontWeight: 700,
                    color: trend.color,
                    marginLeft: "2px",
                  }}
                >
                  {trend.arrow}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Actions slot */}
      {actions && (
        <div
          style={{
            flex: "0 0 auto",
            padding: "10px 14px",
            background: THEME.PANEL_SURFACE,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
