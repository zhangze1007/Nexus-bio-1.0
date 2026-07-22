/**
 * CatDes Shared -- Types, constants, styles, and quality helpers
 * for the Catalyst Designer sub-components.
 */
import type React from "react";
import { toolTokens } from "../../../hooks/useToolTheme";
import type { CatalyticResidue } from "../../../services/CatalystDesignerEngine";
import { estimateStabilityDelta } from "../../../services/CatalystDesignerEngine";
import { THEME } from "../../../theme";

/* -- Docking Result Interface ---------------------------------------- */

export interface DockingResult {
  protein: string;
  ligand: string;
  dockingScore: number;
  bindingEnergy: number;
  contactsFound: number;
  source: string;
}

/* -- Design Tokens --------------------------------------------------- */

export const {
  panelBg: PANEL_BG,
  border: BORDER,
  label: LABEL,
  value: VALUE,
  inputBg: INPUT_BG,
  inputBorder: INPUT_BORDER,
  inputText: INPUT_TEXT,
} = toolTokens;

export const GLASS: React.CSSProperties = {
  ...toolTokens.glass,
  borderRadius: "var(--nb-radius-xl)",
};

/* -- Phase Colors ---------------------------------------------------- */

export const PHASE_COLORS: Record<string, string> = {
  binding: THEME.MINT,
  sequence: THEME.SKY,
  flux: THEME.APRICOT,
  balancing: THEME.CORAL,
  pareto: THEME.LILAC,
  mutagenesis: THEME.MINT,
};

export const PHASE_MAP: Record<string, string> = {
  retrosynthesis: "binding",
  enzyme_selection: "binding",
  structure_analysis: "binding",
  sequence_design: "sequence",
  flux_coupling: "flux",
  balancing: "balancing",
  mutagenesis: "mutagenesis",
};

/* -- Shared Styles --------------------------------------------------- */

export const tn: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };

export const hdrCell: React.CSSProperties = {
  fontFamily: THEME.MONO,
  fontSize: "var(--nb-fs-xs)",
  color: LABEL,
  textAlign: "left",
  padding: "4px 6px",
  borderBottom: `1px solid ${BORDER}`,
  letterSpacing: "0.04em",
};

export const dataCell: React.CSSProperties = {
  fontFamily: THEME.MONO,
  fontSize: "var(--nb-fs-sm)",
  color: VALUE,
  padding: "4px 6px",
  textAlign: "right",
  ...tn,
};

/* -- Quality Helpers ------------------------------------------------- */

export interface QualityIndicator {
  icon: string;
  color: string;
  label: string;
}

export function kdQuality(kd: number): QualityIndicator {
  if (kd < 1) return { icon: "★", color: THEME.SUCCESS_HIGH, label: "Excellent" };
  if (kd < 10) return { icon: "✓", color: THEME.SUCCESS_MEDIUM, label: "Good" };
  if (kd < 100) return { icon: "~", color: THEME.RISK_LOW, label: "Moderate" };
  if (kd < 1000) return { icon: "⊘", color: THEME.RISK_MEDIUM, label: "Weak" };
  return { icon: "⊘", color: THEME.RISK_HIGH, label: "Very weak" };
}

export function kcatQuality(kcat: number): QualityIndicator {
  if (kcat > 100) return { icon: "★", color: THEME.SUCCESS_HIGH, label: "Excellent" };
  if (kcat > 10) return { icon: "✓", color: THEME.SUCCESS_MEDIUM, label: "Good" };
  if (kcat > 1) return { icon: "~", color: THEME.RISK_LOW, label: "Moderate" };
  return { icon: "⊘", color: THEME.RISK_HIGH, label: "Slow" };
}

export function fitQuality(fit: number): QualityIndicator {
  if (fit > 0.85) return { icon: "★", color: THEME.SUCCESS_HIGH, label: "Excellent" };
  if (fit > 0.65) return { icon: "✓", color: THEME.SUCCESS_MEDIUM, label: "Good" };
  if (fit > 0.45) return { icon: "~", color: THEME.RISK_LOW, label: "Moderate" };
  return { icon: "⊘", color: THEME.RISK_HIGH, label: "Poor" };
}

/* -- Frontier Engine Badge Styles ------------------------------------ */

export const VALIDITY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  real: { bg: "rgba(147, 203, 82, 0.16)", border: "rgba(147, 203, 82, 0.45)", color: "#5d8a2f", label: "REAL" },
  partial: { bg: "rgba(232, 220, 200, 0.32)", border: "rgba(180, 150, 100, 0.50)", color: "#8a6a30", label: "PARTIAL" },
  demo: { bg: "rgba(250, 128, 114, 0.16)", border: "rgba(250, 128, 114, 0.50)", color: "#a8453a", label: "DEMO" },
};

/* -- BLOSUM62-based Mutation Impact Computation ---------------------- */

const AA_LETTERS = "ACDEFGHIKLMNPQRSTVWY";
export const BLOSUM62_RAW: Record<string, number[]> = {
  // A-C corrected from -1 to 0 to match the authoritative Henikoff 1992 BLOSUM62.
  A: [4, 0, -2, -1, -2, 0, -2, -1, -1, -1, -1, -2, -1, -1, -1, 1, 0, 0, -3, -2],
  C: [0, 9, -3, -4, -2, -3, -3, -1, -3, -1, -1, -3, -3, -3, -3, -1, -1, -1, -2, -2],
  D: [-2, -3, 6, 2, -3, -1, -1, -3, -1, -4, -3, 1, -1, 0, -2, 0, -1, -3, -4, -3],
  E: [-1, -4, 2, 5, -3, -2, 0, -3, 1, -3, -2, 0, -1, 2, 0, 0, -1, -2, -3, -2],
  F: [-2, -2, -3, -3, 6, -3, -1, 0, -3, 0, 0, -3, -4, -3, -3, -2, -2, -1, 1, 3],
  G: [0, -3, -1, -2, -3, 6, -2, -4, -2, -4, -3, 0, -2, -2, -2, 0, -2, -3, -2, -3],
  H: [-2, -3, -1, 0, -1, -2, 8, -3, -1, -3, -2, 1, -2, 0, 0, -1, -2, -3, -2, 2],
  I: [-1, -1, -3, -3, 0, -4, -3, 4, -3, 2, 1, -3, -3, -3, -3, -2, -1, 3, -3, -1],
  K: [-1, -3, -1, 1, -3, -2, -1, -3, 5, -2, -1, 0, -1, 1, 2, 0, -1, -2, -3, -2],
  L: [-1, -1, -4, -3, 0, -4, -3, 2, -2, 4, 2, -3, -3, -2, -2, -2, -1, 1, -2, -1],
  M: [-1, -1, -3, -2, 0, -3, -2, 1, -1, 2, 5, -2, -2, 0, -1, -1, -1, 1, -1, -1],
  N: [-2, -3, 1, 0, -3, 0, 1, -3, 0, -3, -2, 6, -2, 0, 0, 1, 0, -3, -4, -2],
  P: [-1, -3, -1, -1, -4, -2, -2, -3, -1, -3, -2, -2, 7, -1, -2, -1, -1, -2, -4, -3],
  Q: [-1, -3, 0, 2, -3, -2, 0, -3, 1, -2, 0, 0, -1, 5, 1, 0, -1, -2, -2, -1],
  R: [-1, -3, -2, 0, -3, -2, 0, -3, 2, -2, -1, 0, -2, 1, 5, -1, -1, -3, -3, -2],
  S: [1, -1, 0, 0, -2, 0, -1, -2, 0, -2, -1, 1, -1, 0, -1, 4, 1, -2, -3, -2],
  T: [0, -1, -1, -1, -2, -2, -2, -1, -1, -1, -1, 0, -1, -1, -1, 1, 5, 0, -2, -2],
  V: [0, -1, -3, -2, -1, -3, -3, 3, -2, 1, 1, -3, -2, -2, -3, -2, 0, 4, -3, -1],
  W: [-3, -2, -4, -3, 1, -2, -2, -3, -3, -2, -1, -4, -4, -2, -3, -3, -2, -3, 11, 2],
  Y: [-2, -2, -3, -2, 3, -3, 2, -1, -2, -1, -1, -2, -3, -1, -2, -2, -2, -1, 2, 7],
};

export function computeMutationImpact(
  selectedResidue: number | null,
  selectedMutation: string | null,
  selectedCatResidue: CatalyticResidue | undefined,
  sequence: string,
  predictedKd: number,
): {
  deltaKd: number;
  deltaKcat: number | null;
  newKd: number;
  newKcat: number | null;
  confidence: number;
  deltaG: number;
} | null {
  if (selectedResidue == null || !selectedMutation || !selectedCatResidue) return null;
  try {
    const wtSeq = sequence;
    const mutSeq = wtSeq.slice(0, selectedResidue) + selectedMutation + wtSeq.slice(selectedResidue + 1);
    const ddg = estimateStabilityDelta(wtSeq, mutSeq);
    const idxA = AA_LETTERS.indexOf(selectedCatResidue.residue);
    const idxB = AA_LETTERS.indexOf(selectedMutation);
    const blosumScore = idxA >= 0 && idxB >= 0 ? BLOSUM62_RAW[selectedCatResidue.residue][idxB] : -4;
    const confidence = Math.max(0.3, Math.min(0.9, 0.3 + (blosumScore + 4) * (0.6 / 8)));
    const R = 0.592;
    const kdRatio = Math.exp(ddg / R);
    const newKd = predictedKd * kdRatio;
    return {
      deltaKd: kdRatio,
      deltaKcat: null as number | null,
      newKd,
      newKcat: null as number | null,
      confidence,
      deltaG: ddg,
    };
  } catch {
    return null;
  }
}
