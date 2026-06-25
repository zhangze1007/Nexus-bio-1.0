"use client";
import { THEME } from "../../../theme";

const MONO = THEME.MONO;
const SANS = THEME.SANS;

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  warning?: string;
  highlight?: boolean;
}

export default function MetricCard({ label, value, unit, delta, warning, highlight }: MetricCardProps) {
  const deltaColor = delta === undefined ? undefined : delta > 0 ? THEME.MINT : delta < 0 ? THEME.CORAL : THEME.LABEL;

  return (
    <div
      style={{
        padding: "14px 14px 12px",
        background: highlight ? "rgba(191,220,205,0.10)" : THEME.PANEL_SURFACE,
        border: `1px solid ${highlight ? "rgba(191,220,205,0.28)" : THEME.BORDER}`,
        borderRadius: "12px",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        overflow: "hidden",
      }}
    >
      <p
        style={{
          fontFamily: SANS,
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.09em",
          color: THEME.LABEL,
          margin: "0 0 8px",
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "5px", minWidth: 0 }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: "20px",
            fontWeight: 700,
            color: THEME.VALUE,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {typeof value === "number" ? value.toFixed(value < 10 ? 3 : value < 100 ? 2 : 1) : value}
        </span>
        {unit && <span style={{ fontFamily: SANS, fontSize: "10px", color: THEME.LABEL }}>{unit}</span>}
        {delta !== undefined && (
          <span style={{ fontFamily: MONO, fontSize: "10px", color: deltaColor, marginLeft: "4px" }}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(2)}
          </span>
        )}
      </div>
      {warning && (
        <p style={{ fontFamily: SANS, fontSize: "10px", color: THEME.CORAL, margin: "6px 0 0", lineHeight: 1.45 }}>
          {warning}
        </p>
      )}
    </div>
  );
}
