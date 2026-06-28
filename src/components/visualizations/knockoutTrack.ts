/**
 * Knockout Track Builder — converts gene knockout targets into IGV.js annotation tracks.
 *
 * Generates BED-format features for gene knockouts (CRISPRi/CRISPRko) with
 * color-coding by predicted impact on cell fitness.
 *
 * Impact categories follow the CRISPRi screening conventions:
 * - Essential: lethal knockdown (growth_impact = -1.0)
 * - Beneficial: improved product yield
 * - Neutral: minimal fitness effect
 * - Deleterious: significant growth reduction
 */

import type { GenomeTrack } from "./GenomeBrowser";

/** Gene knockout target with predicted impact */
export interface KnockoutTarget {
  /** BiGG gene ID (e.g., 'b1779') */
  geneId: string;
  /** Common gene name (e.g., 'gapA') */
  geneName: string;
  /** Gene start position (0-based, bp) */
  start: number;
  /** Gene end position (0-based, bp) */
  end: number;
  /** Strand direction */
  strand: "+" | "-";
  /** Predicted impact category */
  impact: "essential" | "beneficial" | "neutral" | "deleterious";
  /** Optional: growth impact coefficient (-1 to 0, where -1 = lethal) */
  growthImpact?: number;
  /** Optional: knockdown efficiency (0-1) */
  efficiency?: number;
  /** Optional: phenotype description */
  phenotype?: string;
}

/**
 * Color mapping for knockout impact categories.
 *
 * Essential (coral/red): genes required for growth — knockdown is lethal.
 * Beneficial (mint/green): knockdown improves product yield.
 * Neutral (sky/blue): minimal effect on fitness.
 * Deleterious (apricot/amber): significant growth reduction without yield benefit.
 */
const IMPACT_COLORS: Record<KnockoutTarget["impact"], string> = {
  essential: "#E8A3A1", // Coral — DO NOT knock out
  beneficial: "#9ECE7E", // Green — target for knockout
  neutral: "#AFC3D6", // Sky — candidate for testing
  deleterious: "#E7C7A9", // Apricot — avoid
};

/** Human-readable labels for impact categories */
const IMPACT_LABELS: Record<KnockoutTarget["impact"], string> = {
  essential: "Essential (Lethal)",
  beneficial: "Beneficial (Yield+)",
  neutral: "Neutral (Candidate)",
  deleterious: "Deleterious (Growth-)",
};

/**
 * Build an IGV.js annotation track from gene knockout target data.
 *
 * Each knockout target becomes a BED-format feature with:
 * - Color-coded by impact (coral=essential, green=beneficial, sky=neutral, amber=deleterious)
 * - Directional arrow indicating strand
 * - Tooltip with gene details
 *
 * @param knockouts - Array of knockout target definitions
 * @param chromosome - Chromosome identifier (e.g., 'chr' for E. coli)
 * @returns IGV.js-compatible GenomeTrack for annotation display
 *
 * @example
 * ```ts
 * const track = buildKnockoutTrack([
 *   { geneId: 'b1779', geneName: 'gapA', start: 1858681, end: 1859682,
 *     strand: '+', impact: 'essential' },
 * ], 'chr');
 * ```
 */
export function buildKnockoutTrack(knockouts: KnockoutTarget[], chromosome: string): GenomeTrack {
  const features = knockouts.map((ko) => ({
    chr: chromosome,
    start: ko.start,
    end: ko.end,
    name: ko.geneName,
    score: ko.growthImpact ?? 0,
    strand: ko.strand,
    color: IMPACT_COLORS[ko.impact],
    // Custom fields for tooltip / popup
    description: [
      `Gene: ${ko.geneName} (${ko.geneId})`,
      `Impact: ${IMPACT_LABELS[ko.impact]}`,
      ko.growthImpact !== undefined ? `Growth impact: ${(ko.growthImpact * 100).toFixed(0)}%` : null,
      ko.efficiency !== undefined ? `Knockdown efficiency: ${(ko.efficiency * 100).toFixed(0)}%` : null,
      ko.phenotype ? `Phenotype: ${ko.phenotype}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
  }));

  return {
    name: "Knockout Targets",
    type: "annotation",
    format: "bed",
    features,
  };
}

/**
 * Build a track specifically for essential genes (protected from knockout).
 */
export function buildEssentialGeneTrack(
  genes: Array<{ geneId: string; geneName: string; start: number; end: number; strand: "+" | "-" }>,
  chromosome: string,
): GenomeTrack {
  return buildKnockoutTrack(
    genes.map((g) => ({
      ...g,
      impact: "essential" as const,
    })),
    chromosome,
  );
}

/**
 * Summarize knockout target distribution by impact category.
 */
export function summarizeKnockouts(knockouts: KnockoutTarget[]): {
  total: number;
  essential: number;
  beneficial: number;
  neutral: number;
  deleterious: number;
  avgGrowthImpact: number;
} {
  const total = knockouts.length;
  const counts = { essential: 0, beneficial: 0, neutral: 0, deleterious: 0 };
  let totalGrowthImpact = 0;
  let growthImpactCount = 0;

  for (const ko of knockouts) {
    counts[ko.impact]++;
    if (ko.growthImpact !== undefined) {
      totalGrowthImpact += ko.growthImpact;
      growthImpactCount++;
    }
  }

  return {
    total,
    ...counts,
    avgGrowthImpact: growthImpactCount > 0 ? totalGrowthImpact / growthImpactCount : 0,
  };
}
