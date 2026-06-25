"use client";

import type { CSSProperties, ReactNode } from "react";
import { THEME } from "../../../theme";
export const PROEVOL_THEME = {
  border: THEME.BORDER,
  borderStrong: THEME.BORDER_STRONG,
  label: THEME.LABEL,
  value: THEME.VALUE,
  muted: THEME.PAPER_MUTED,
  surface: THEME.PANEL_SURFACE,
  inset: THEME.PANEL_INSET,
  glass: THEME.PANEL_GLASS,
  pageBg: THEME.PAPER,
  mint: THEME.MINT,
  coral: THEME.CORAL,
  apricot: THEME.APRICOT,
  sky: THEME.SKY,
  lilac: THEME.LILAC,
  riskLow: THEME.RISK_LOW,
  riskMedium: THEME.RISK_MEDIUM,
  riskHigh: THEME.RISK_HIGH,
  successLow: THEME.SUCCESS_LOW,
  successMedium: THEME.SUCCESS_MEDIUM,
  successHigh: THEME.SUCCESS_HIGH,
};

export function formatSigned(value: number, digits = 1) {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function toneColor(tone: "neutral" | "cool" | "warm" | "alert") {
  if (tone === "cool") return PROEVOL_THEME.successHigh;
  if (tone === "warm") return PROEVOL_THEME.riskMedium;
  if (tone === "alert") return PROEVOL_THEME.riskHigh;
  return PROEVOL_THEME.sky;
}

export function surfaceCardStyle(options?: {
  minHeight?: number | string;
  padding?: string;
  inset?: boolean;
}): CSSProperties {
  return {
    display: "grid",
    gap: "10px",
    padding: options?.padding ?? "12px",
    borderRadius: "var(--nb-radius-md)",
    border: `1px solid ${options?.inset ? PROEVOL_THEME.borderStrong : PROEVOL_THEME.border}`,
    background: options?.inset ? PROEVOL_THEME.inset : PROEVOL_THEME.surface,
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    minHeight: options?.minHeight,
  };
}

export function sectionKickerStyle(): CSSProperties {
  return {
    fontFamily: THEME.MONO,
    fontSize: "var(--nb-fs-xs)",
    color: PROEVOL_THEME.label,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  };
}

export function tableHeaderStyle(): CSSProperties {
  return {
    fontFamily: THEME.MONO,
    fontSize: "var(--nb-fs-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: PROEVOL_THEME.label,
    padding: "8px 10px",
    textAlign: "left",
    borderBottom: `1px solid ${PROEVOL_THEME.borderStrong}`,
    whiteSpace: "nowrap",
  };
}

export function tableCellStyle(): CSSProperties {
  return {
    fontFamily: THEME.SANS,
    fontSize: "var(--nb-fs-sm)",
    color: PROEVOL_THEME.value,
    padding: "8px 10px",
    verticalAlign: "top",
  };
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "cool" | "warm" | "alert";
}) {
  const color = toneColor(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        minHeight: "24px",
        padding: "0 10px",
        borderRadius: "999px",
        border: `1px solid ${color}44`,
        background: `${color}18`,
        color,
        fontFamily: THEME.MONO,
        fontSize: "var(--nb-fs-xs)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

export function MetricBadge({
  label,
  value,
  detail,
  accent = PROEVOL_THEME.sky,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: "10px 12px",
        borderRadius: "var(--nb-radius-md)",
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: "rgba(255,255,255,0.03)",
        display: "grid",
        gap: "4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "999px",
            background: accent,
            flexShrink: 0,
          }}
        />
        <span style={sectionKickerStyle()}>{label}</span>
      </div>
      <div
        style={{
          fontFamily: THEME.SANS,
          fontSize: "var(--nb-fs-md)",
          fontWeight: 700,
          color: PROEVOL_THEME.value,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      {detail ? (
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            lineHeight: 1.5,
            color: PROEVOL_THEME.muted,
          }}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function ProEvolCard({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  minHeight,
  inset = false,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  minHeight?: number | string;
  inset?: boolean;
}) {
  return (
    <section style={surfaceCardStyle({ minHeight, inset })}>
      {eyebrow || title || actions ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            paddingBottom: "6px",
            borderBottom: `1px solid ${PROEVOL_THEME.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0 }}>
            {eyebrow ? <div style={sectionKickerStyle()}>{eyebrow}</div> : null}
            {title ? (
              <div
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-sm)",
                  fontWeight: 600,
                  color: PROEVOL_THEME.value,
                  letterSpacing: "-0.02em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </div>
            ) : null}
          </div>
          {actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
        </div>
      ) : null}
      <div style={{ minHeight: 0 }}>{children}</div>
    </section>
  );
}
