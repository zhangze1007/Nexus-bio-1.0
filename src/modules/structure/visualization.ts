/**
 * Confidence Visualization Mapping
 *
 * Maps structure prediction confidence scores (pLDDT, ipTM) to
 * per-residue and per-chain visual representations with color encoding.
 *
 * pLDDT ranges (AlphaFold convention):
 *   very_high > 90, high 70-90, low 50-70, very_low < 50
 *
 * Reference: Jumper et al. (2021) Nature 596:583 — pLDDT calibration
 * Reference: Abramson et al. (2024) Nature 630:493 — ipTM scoring
 */

import type { ChainConfidence, ConfidenceSummary, ResidueConfidence } from "./types";

// ── Color Scales ──────────────────────────────────────────────────────────────

/**
 * pLDDT-style color scale: red (low) -> orange -> yellow -> cyan -> blue (high).
 * Input t in [0, 1]. Returns 6-digit hex without '#'.
 */
function plddtColorScale(t: number): string {
  const stops: Array<{ t: number; r: number; g: number; b: number }> = [
    { t: 0.0, r: 255, g: 0, b: 0 }, // red
    { t: 0.25, r: 255, g: 165, b: 0 }, // orange
    { t: 0.5, r: 255, g: 255, b: 0 }, // yellow
    { t: 0.75, r: 0, g: 255, b: 255 }, // cyan
    { t: 1.0, r: 0, g: 0, b: 255 }, // blue
  ];
  return interpolateStops(stops, t);
}

/**
 * Rainbow color scale: red -> yellow -> green -> cyan -> blue.
 * Input t in [0, 1]. Returns 6-digit hex without '#'.
 */
function rainbowColorScale(t: number): string {
  const stops: Array<{ t: number; r: number; g: number; b: number }> = [
    { t: 0.0, r: 255, g: 0, b: 0 }, // red
    { t: 0.25, r: 255, g: 255, b: 0 }, // yellow
    { t: 0.5, r: 0, g: 255, b: 0 }, // green
    { t: 0.75, r: 0, g: 255, b: 255 }, // cyan
    { t: 1.0, r: 0, g: 0, b: 255 }, // blue
  ];
  return interpolateStops(stops, t);
}

/**
 * Grayscale: black (0) -> white (1).
 * Input t in [0, 1]. Returns 6-digit hex without '#'.
 */
function grayscaleColorScale(t: number): string {
  const v = Math.round(Math.max(0, Math.min(1, t)) * 255);
  const hex = v.toString(16).padStart(2, "0");
  return `${hex}${hex}${hex}`;
}

/**
 * Interpolate between color stops using linear blending.
 */
function interpolateStops(stops: Array<{ t: number; r: number; g: number; b: number }>, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));

  // Find the two bounding stops
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].t && clamped <= stops[i + 1].t) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }

  const range = hi.t - lo.t;
  const alpha = range === 0 ? 0 : (clamped - lo.t) / range;

  const r = Math.round(lo.r + alpha * (hi.r - lo.r));
  const g = Math.round(lo.g + alpha * (hi.g - lo.g));
  const b = Math.round(lo.b + alpha * (hi.b - lo.b));

  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  return `${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ── Confidence Classification ─────────────────────────────────────────────────

/**
 * Classify a pLDDT score into a confidence level.
 *
 * Thresholds follow the AlphaFold convention:
 *   very_high > 90, high 70-90, low 50-70, very_low < 50
 */
function classifyPLDDT(score: number): ResidueConfidence["confidence"] {
  if (score > 90) return "very_high";
  if (score >= 70) return "high";
  if (score >= 50) return "low";
  return "very_low";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Map pLDDT scores to per-residue confidence with color encoding.
 *
 * @param plddtScores - Array of per-residue pLDDT scores (0-100)
 * @param residueIndices - Optional explicit residue indices (defaults to 0-based sequential)
 * @returns Array of ResidueConfidence objects with index, score, level, and color
 */
export function mapPLDDT(plddtScores: number[], residueIndices?: number[]): ResidueConfidence[] {
  if (plddtScores.length === 0) return [];

  return plddtScores.map((score, i) => {
    const normalizedScore = Math.max(0, Math.min(100, score));
    return {
      residueIndex: residueIndices ? residueIndices[i] : i,
      score: normalizedScore,
      confidence: classifyPLDDT(normalizedScore),
      color: confidenceToColor(normalizedScore / 100, "plddt"),
    };
  });
}

/**
 * Map an ipTM score to per-chain confidence.
 *
 * ipTM is a complex-level metric, so the same score is applied to all chains.
 *
 * @param iptmScore - ipTM score (0-1)
 * @param chainIds - Chain identifiers to map
 * @returns Array of ChainConfidence objects
 */
export function mapIPTM(iptmScore: number, chainIds: string[]): ChainConfidence[] {
  if (chainIds.length === 0) return [];

  const clampedScore = Math.max(0, Math.min(1, iptmScore));

  return chainIds.map((chainId) => ({
    chainId,
    score: clampedScore,
    color: confidenceToColor(clampedScore, "plddt"),
  }));
}

/**
 * Map a confidence value (0-1) to a hex color string.
 *
 * @param confidence - Normalized confidence value (0-1)
 * @param colorScale - Color scale to use: 'plddt' (default), 'rainbow', or 'grayscale'
 * @returns Hex color string (e.g. '#0000ff')
 */
export function confidenceToColor(confidence: number, colorScale: "plddt" | "rainbow" | "grayscale" = "plddt"): string {
  const t = Math.max(0, Math.min(1, confidence));

  let hex: string;
  switch (colorScale) {
    case "rainbow":
      hex = rainbowColorScale(t);
      break;
    case "grayscale":
      hex = grayscaleColorScale(t);
      break;
    case "plddt":
    default:
      hex = plddtColorScale(t);
      break;
  }

  return `#${hex}`;
}

/**
 * Export confidence data as pretty-printed JSON.
 *
 * @param residues - Per-residue confidence array
 * @param chains - Per-chain confidence array
 * @returns JSON string (2-space indented)
 */
export function exportConfidenceJSON(residues: ResidueConfidence[], chains: ChainConfidence[]): string {
  return JSON.stringify({ residues, chains }, null, 2);
}

/**
 * Export per-residue confidence as CSV.
 *
 * Columns: residueIndex, score, confidence, color
 *
 * @param residues - Per-residue confidence array
 * @returns CSV string with header row
 */
export function exportConfidenceCSV(residues: ResidueConfidence[]): string {
  const header = "residueIndex,score,confidence,color";
  const rows = residues.map((r) => `${r.residueIndex},${r.score},${r.confidence},${r.color}`);
  return [header, ...rows].join("\n");
}

/**
 * Compute summary statistics for confidence data.
 *
 * @param residues - Per-residue confidence array
 * @param chains - Per-chain confidence array (used for overallConfidence)
 * @returns ConfidenceSummary with mean, min, max, std, counts, and overall confidence
 */
export function computeConfidenceSummary(residues: ResidueConfidence[], chains: ChainConfidence[]): ConfidenceSummary {
  if (residues.length === 0) {
    return {
      residueMean: 0,
      residueMin: 0,
      residueMax: 0,
      residueStd: 0,
      overallConfidence: chains.length > 0 ? chains.reduce((sum, c) => sum + c.score, 0) / chains.length : 0,
      counts: { very_high: 0, high: 0, low: 0, very_low: 0 },
    };
  }

  const scores = residues.map((r) => r.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  // Population standard deviation
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance);

  const counts = { very_high: 0, high: 0, low: 0, very_low: 0 };
  for (const r of residues) {
    counts[r.confidence]++;
  }

  const overallConfidence = chains.length > 0 ? chains.reduce((sum, c) => sum + c.score, 0) / chains.length : 0;

  return {
    residueMean: mean,
    residueMin: min,
    residueMax: max,
    residueStd: std,
    overallConfidence,
    counts,
  };
}
