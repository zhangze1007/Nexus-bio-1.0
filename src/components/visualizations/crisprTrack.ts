/**
 * CRISPR Track Builder — converts gRNA target data into IGV.js annotation tracks.
 *
 * Generates BED-format features for CRISPR guide RNA target sites with
 * color-coding by off-target risk and scoring.
 *
 * Reference: Doench et al. (2016) Nat Biotechnol 34:184 — Rule Set 2 scoring
 */

import type { GenomeTrack } from "./GenomeBrowser";

/** CRISPR guide RNA target site */
export interface CRISPRGuide {
  /** 20-nt guide sequence (without PAM) */
  sequence: string;
  /** Genomic start position of target site (0-based) */
  targetStart: number;
  /** Genomic end position of target site (0-based) */
  targetEnd: number;
  /** On-target efficiency score (0-1, higher = more efficient) */
  score: number;
  /** Number of predicted off-target sites */
  offTargets: number;
  /** Optional: strand of the target */
  strand?: "+" | "-";
  /** Optional: gene name if targeting a specific gene */
  geneName?: string;
  /** Optional: PAM sequence used */
  pam?: string;
}

/**
 * Color scale for CRISPR guide quality.
 * Based on off-target risk: fewer off-targets = safer (greener).
 */
function guideColor(guide: CRISPRGuide): string {
  if (guide.offTargets === 0 && guide.score >= 0.7) {
    return "#9ECE7E"; // Excellent — high efficiency, no off-targets
  }
  if (guide.offTargets <= 2 && guide.score >= 0.5) {
    return "#86C2C6"; // Good — moderate efficiency, few off-targets
  }
  if (guide.offTargets <= 5) {
    return "#D9BC5D"; // Caution — some off-targets
  }
  return "#D96562"; // Risk — many off-targets
}

/**
 * Determine feature type label for tooltip display.
 */
function guideType(guide: CRISPRGuide): string {
  if (guide.offTargets === 0 && guide.score >= 0.7) return "Optimal";
  if (guide.offTargets <= 2 && guide.score >= 0.5) return "Good";
  if (guide.offTargets <= 5) return "Caution";
  return "High Risk";
}

/**
 * Build an IGV.js annotation track from CRISPR gRNA target data.
 *
 * Each guide becomes a BED-format feature with:
 * - Color-coded by off-target risk (green → red)
 * - Score field for sorting/filtering
 * - Name showing guide sequence (truncated) + gene if available
 *
 * @param gRNAs - Array of CRISPR guide RNA targets
 * @param chromosome - Chromosome identifier (e.g., 'chr' for E. coli)
 * @returns IGV.js-compatible GenomeTrack for annotation display
 *
 * @example
 * ```ts
 * const track = buildCRISPRTrack([
 *   { sequence: 'ATGCGATCGATCGATCGATC', targetStart: 1000, targetEnd: 1023,
 *     score: 0.85, offTargets: 0 },
 * ], 'chr');
 * ```
 */
export function buildCRISPRTrack(gRNAs: CRISPRGuide[], chromosome: string): GenomeTrack {
  const features = gRNAs.map((guide) => ({
    chr: chromosome,
    start: guide.targetStart,
    end: guide.targetEnd,
    name: guide.geneName ? `${guide.geneName} (${guide.sequence.slice(0, 8)}...)` : `${guide.sequence.slice(0, 12)}...`,
    score: guide.score,
    strand: guide.strand ?? "+",
    color: guideColor(guide),
    // Custom fields for tooltip / popup
    description: [
      `Guide: ${guide.sequence}`,
      guide.pam ? `PAM: ${guide.pam}` : null,
      `Efficiency: ${(guide.score * 100).toFixed(0)}%`,
      `Off-targets: ${guide.offTargets}`,
      `Status: ${guideType(guide)}`,
    ]
      .filter(Boolean)
      .join(" | "),
  }));

  return {
    name: "CRISPR Targets",
    type: "annotation",
    format: "bed",
    features,
  };
}

/**
 * Build a summary of CRISPR guide quality distribution.
 */
export function summarizeGuides(gRNAs: CRISPRGuide[]): {
  total: number;
  optimal: number;
  good: number;
  caution: number;
  highRisk: number;
  avgScore: number;
  avgOffTargets: number;
} {
  const total = gRNAs.length;
  let optimal = 0;
  let good = 0;
  let caution = 0;
  let highRisk = 0;
  let totalScore = 0;
  let totalOffTargets = 0;

  for (const g of gRNAs) {
    totalScore += g.score;
    totalOffTargets += g.offTargets;
    if (g.offTargets === 0 && g.score >= 0.7) optimal++;
    else if (g.offTargets <= 2 && g.score >= 0.5) good++;
    else if (g.offTargets <= 5) caution++;
    else highRisk++;
  }

  return {
    total,
    optimal,
    good,
    caution,
    highRisk,
    avgScore: total > 0 ? totalScore / total : 0,
    avgOffTargets: total > 0 ? totalOffTargets / total : 0,
  };
}
