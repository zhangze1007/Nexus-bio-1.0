"use client";

/**
 * MockDataBanner — Prominent warning when tool displays mock/demo data.
 *
 * Shows a full-width warning banner with icon when data validity is
 * 'demo' or 'simulated'. More visible than small ValidityBadge labels.
 *
 * Usage:
 *   <MockDataBanner validity="demo" toolName="FBASim" />
 *   <MockDataBanner validity="simulated" message="Using sample dataset" />
 */

import { AlertTriangle, Info } from "lucide-react";
import { THEME } from "../../../theme";

interface MockDataBannerProps {
  /** Data validity tier */
  validity: "real" | "partial" | "demo" | "simulated";
  /** Tool name for context */
  toolName?: string;
  /** Custom message override */
  message?: string;
  /** Show dismissible */
  onDismiss?: () => void;
}

export function MockDataBanner({ validity, toolName, message, onDismiss }: MockDataBannerProps) {
  // Only show for non-real data
  if (validity === "real") return null;

  const isSimulated = validity === "simulated" || validity === "demo";

  const defaultMessages: Record<string, string> = {
    demo: "This tool is displaying demo data for illustration purposes. Results are not from real analysis.",
    simulated: "This tool is using simulated data. For real results, upload your own dataset.",
    partial: "This tool has partial data coverage. Some results may be estimated or incomplete.",
  };

  const displayMessage = message ?? defaultMessages[validity] ?? "Data validity unknown.";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "14px 18px",
        background: isSimulated
          ? "rgba(255, 193, 7, 0.08)"
          : "rgba(255, 152, 0, 0.08)",
        border: `1px solid ${isSimulated ? "rgba(255, 193, 7, 0.25)" : "rgba(255, 152, 0, 0.25)"}`,
        borderRadius: "10px",
        marginBottom: "16px",
        fontFamily: THEME.SANS,
      }}
    >
      <AlertTriangle
        size={20}
        style={{
          color: isSimulated ? "#ffc107" : "#ff9800",
          flexShrink: 0,
          marginTop: "1px",
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: isSimulated ? "#ffc107" : "#ff9800",
            marginBottom: "4px",
            fontFamily: THEME.MONO,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {isSimulated ? "⚠ Demo / Simulated Data" : "⚠ Partial Data"}
          {toolName && ` — ${toolName}`}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: THEME.LABEL,
            lineHeight: 1.5,
          }}
        >
          {displayMessage}
        </div>
        {isSimulated && (
          <div
            style={{
              fontSize: "12px",
              color: THEME.DIM,
              marginTop: "6px",
              fontFamily: THEME.MONO,
            }}
          >
            Upload real data via the tool controls to see actual analysis results.
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: THEME.DIM,
            cursor: "pointer",
            padding: "4px",
          }}
          aria-label="Dismiss warning"
        >
          ×
        </button>
      )}
    </div>
  );
}
