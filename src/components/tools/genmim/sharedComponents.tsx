"use client";
import React from "react";
import { getToolValidity } from "../../../config/toolValidity";
import { THEME } from "../../../theme";
import type { ToolTab } from "../shared/ToolTabBar";

/**
 * Generate a deterministic pseudo-sequence from a numeric seed.
 * Used to demonstrate sgRNA design when real coding sequences are not available.
 * In production, this would be replaced by actual genome sequence lookup.
 */
export function generatePseudoSequence(seed: number, length: number): string {
  const bases = "ACGT";
  let s = seed;
  let seq = "";
  for (let i = 0; i < length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    seq += bases[s % 4];
  }
  return seq;
}

// FBA reaction → gene mapping for flux-driven CRISPRi prioritization
// Targets aligned with FBA-identified flux bottlenecks receive a score boost
export const REACTION_TO_GENES: Record<string, string[]> = {
  PFK: ["pfkA", "pfkB"],
  PYK: ["pykF", "pykA"],
  GAPD: ["gapA"],
  PGI: ["zwf"],
  ENO: ["eno"],
  PDH: ["ppc"],
  CS: ["sdhA"],
  MDH: ["sucA"],
  FBA: ["gpmA"],
};

export const GENMIM_TABS: ToolTab[] = [
  { id: "genome", label: "Genome Map", accent: THEME.SKY },
  { id: "targets", label: "Targets", accent: THEME.LILAC },
  { id: "schedule", label: "Schedule", accent: THEME.CORAL },
  { id: "efficiency", label: "Efficiency", accent: THEME.MINT },
  { id: "multiplex", label: "Multiplex Strategy", accent: THEME.LILAC },
  { id: "prime", label: "Prime Editing", accent: THEME.SKY },
  { id: "base", label: "Base Editing", accent: THEME.MINT },
  { id: "epigenome", label: "Epigenome", accent: THEME.LILAC },
  { id: "paste", label: "PASTE", accent: THEME.APRICOT },
  { id: "synthetic", label: "Synthetic", accent: THEME.APRICOT },
  { id: "biosafety", label: "Biosafety", accent: THEME.CORAL },
  { id: "gem", label: "GEM Reconstruction", accent: THEME.MINT },
];

export const VALIDITY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  real: { bg: "rgba(147, 203, 82, 0.16)", border: "rgba(147, 203, 82, 0.45)", color: "#5d8a2f", label: "REAL" },
  partial: { bg: "rgba(232, 220, 200, 0.32)", border: "rgba(180, 150, 100, 0.50)", color: "#8a6a30", label: "PARTIAL" },
  demo: { bg: "rgba(250, 128, 114, 0.16)", border: "rgba(250, 128, 114, 0.50)", color: "#a8453a", label: "DEMO" },
};

export function FrontierEngineBadge({ engineId }: { engineId: string }) {
  const validity = getToolValidity(engineId);
  if (!validity) return null;
  const style = VALIDITY_STYLES[validity.level] ?? VALIDITY_STYLES.partial;
  return (
    <div
      title={validity.caption}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        marginLeft: "auto",
        marginRight: 16,
        fontFamily: THEME.MONO,
        fontSize: "var(--nb-fs-xs)",
        fontWeight: 700,
        letterSpacing: "0.10em",
        padding: "5px 9px",
        borderRadius: "var(--nb-radius-md)",
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        cursor: "help",
        flexShrink: 0,
      }}
    >
      {style.label}
      <span style={{ fontWeight: 400, opacity: 0.7, letterSpacing: 0 }}>/ {engineId}</span>
    </div>
  );
}

export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
