"use client";
import type React from "react";
import { THEME } from "../../../theme";
import type { OmicsLayer, OmicsRow } from "../../../types";
import { PAPER_THEME, SCI_SERIES } from "../../charts/chartTheme";
import type { TableColumn } from "../../ide/shared/DataTable";
import type { ToolTab } from "../shared/ToolTabBar";

/* ── Design Tokens ────────────────────────────────────────────────── */

export const LAYER_COLORS: Record<OmicsLayer, string> = {
  transcriptomics: THEME.LILAC,
  proteomics: THEME.SKY,
  metabolomics: THEME.CORAL,
};

export const MULTIO_TABS: ToolTab[] = [
  { id: "embedding", label: "Embedding", accent: THEME.SKY },
  { id: "volcano", label: "Volcano", accent: THEME.LILAC },
  { id: "factors", label: "Factors", accent: THEME.APRICOT },
  { id: "mofaplus", label: "MOFA+", accent: THEME.MINT },
  { id: "projection", label: "Projection", accent: THEME.MINT },
  { id: "efficiency", label: "Efficiency", accent: THEME.CORAL },
  { id: "mlpredict", label: "ML Predict", accent: THEME.LILAC },
  { id: "fluxomics", label: "Fluxomics", accent: THEME.APRICOT },
  { id: "mfa13c", label: "13C-MFA", accent: THEME.CORAL },
];

export function canonicalGeneToken(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function findPreferredGene(candidates: string[], data: { gene: string }[]) {
  const availableGenes = data.map((row) => row.gene);
  const availableTokens = new Map(availableGenes.map((gene) => [canonicalGeneToken(gene), gene]));
  for (const candidate of candidates) {
    const token = canonicalGeneToken(candidate);
    if (!token) continue;
    const exact = availableTokens.get(token);
    if (exact) return exact;
    const partial = availableGenes.find(
      (gene) => token.includes(canonicalGeneToken(gene)) || canonicalGeneToken(gene).includes(token),
    );
    if (partial) return partial;
  }
  return availableGenes[0] ?? "";
}

/* ── DataTable COLUMNS (preserved) ────────────────────────────────── */

export const COLUMNS: TableColumn<OmicsRow>[] = [
  { key: "gene", header: "Gene", width: 80 },
  { key: "transcript", header: "RNA", width: 55, render: (v) => (typeof v === "number" ? v.toFixed(1) : "—") },
  { key: "protein", header: "Prot.", width: 55, render: (v) => (typeof v === "number" ? v.toFixed(1) : "—") },
  { key: "metabolite", header: "Met.", width: 55, render: (v) => (typeof v === "number" ? v.toFixed(1) : "—") },
  {
    key: "fold_change",
    header: "FC",
    width: 55,
    render: (v) =>
      typeof v === "number" ? (
        <span
          style={{
            color: (v as number) > 0 ? "rgba(147,203,82,0.85)" : "rgba(250,128,114,0.8)",
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
          }}
        >
          {(v as number) > 0 ? "+" : ""}
          {(v as number).toFixed(2)}
        </span>
      ) : (
        "—"
      ),
  },
  {
    key: "pValue",
    header: "p-val",
    width: 60,
    render: (v) =>
      typeof v === "number" ? (
        <span
          style={{
            color: (v as number) < 0.05 ? "rgba(255,139,31,0.85)" : PAPER_THEME.tickColor,
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
          }}
        >
          {(v as number).toFixed(3)}
        </span>
      ) : (
        "—"
      ),
  },
];

/* ── Shared helpers for tri-panel ────────────────────────────────── */

export const CLUSTER_PAL = SCI_SERIES.slice(0, 8);

export function divergingColor(t: number): string {
  const n = (t + 1) / 2;
  if (n < 0.5) {
    const f = n * 2;
    return `rgb(${Math.round(33 + (247 - 33) * f)},${Math.round(102 + (247 - 102) * f)},${Math.round(172 + (247 - 172) * f)})`;
  }
  const f = (n - 0.5) * 2;
  return `rgb(${Math.round(247 + (214 - 247) * f)},${Math.round(247 + (96 - 247) * f)},${Math.round(247 + (77 - 247) * f)})`;
}

export function pearsonR(v1: number[], v2: number[]): number {
  const n = v1.length;
  if (n === 0) return 0;
  const m1 = v1.reduce((a, b) => a + b, 0) / n;
  const m2 = v2.reduce((a, b) => a + b, 0) / n;
  const num = v1.reduce((s, x, i) => s + (x - m1) * (v2[i] - m2), 0);
  const d1 = Math.sqrt(v1.reduce((s, x) => s + (x - m1) ** 2, 0));
  const d2 = Math.sqrt(v2.reduce((s, x) => s + (x - m2) ** 2, 0));
  return d1 === 0 || d2 === 0 ? 0 : num / (d1 * d2);
}

/* ── Section label helper ────────────────────────────────────────── */

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p
    style={{
      fontFamily: THEME.SANS,
      fontSize: "var(--nb-fs-xs)",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: THEME.LABEL,
      margin: "0 0 10px",
    }}
  >
    {children}
  </p>
);
