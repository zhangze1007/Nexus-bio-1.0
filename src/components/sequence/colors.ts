/**
 * Sequence Editor — Feature Color Map
 *
 * Pastel accent palette aligned with Nexus-Bio brand.
 * All colors from the canonical 5-color + extended pastel palette.
 */

import type { FeatureType } from "./types";

export const FEATURE_COLORS: Record<FeatureType, string> = {
  CDS: "#5151CD", // indigo blue
  promoter: "#93CB52", // lime green
  terminator: "#FA8072", // salmon
  RBS: "#C8E0D0", // mint
  misc: "#C8D8E8", // sky
  primer: "#E8DCC8", // apricot
  restriction_site: "#DDD0E8", // lavender
};

/**
 * Nucleotide base colors (for linear viewer).
 */
export const BASE_COLORS: Record<string, string> = {
  A: "#93CB52", // green
  T: "#FA8072", // salmon
  C: "#5151CD", // blue
  G: "#E8DCC8", // amber
  U: "#FA8072", // salmon (like T)
};

/**
 * Amino acid colors (grouped by properties).
 * Based on the Taylor color scheme adapted to pastel tones.
 */
export const AA_COLORS: Record<string, string> = {
  // Nonpolar / hydrophobic
  A: "#C8D8E8",
  V: "#C8D8E8",
  L: "#C8D8E8",
  I: "#C8D8E8",
  M: "#C8D8E8",
  F: "#C8D8E8",
  W: "#C8D8E8",
  P: "#C8D8E8",
  // Polar / uncharged
  G: "#C8E0D0",
  S: "#C8E0D0",
  T: "#C8E0D0",
  C: "#C8E0D0",
  Y: "#C8E0D0",
  N: "#C8E0D0",
  Q: "#C8E0D0",
  // Positive
  K: "#5151CD",
  R: "#5151CD",
  H: "#5151CD",
  // Negative
  D: "#FA8072",
  E: "#FA8072",
  // Stop
  "*": "#DDD0E8",
};

/**
 * Get the color for a single character (base or amino acid) based on sequence type.
 */
export function getCharColor(char: string, seqType: "dna" | "rna" | "protein"): string {
  if (seqType === "protein") {
    return AA_COLORS[char.toUpperCase()] ?? "#666";
  }
  return BASE_COLORS[char.toUpperCase()] ?? "#666";
}
