/**
 * Confidence Scorer — AlphaFold pLDDT / pTM / ipTM Analysis
 *
 * Parses per-residue confidence from PDB B-factor columns (AlphaFold convention)
 * and produces human-readable quality assessments.
 *
 * In AlphaFold-predicted structures the B-factor column stores pLDDT (0-100):
 *   >90  Very high confidence (well-packed core)
 *   70-90 Confident (most structured regions)
 *   50-70 Low confidence (flexible loops, termini)
 *   <50  Very low confidence (disordered, unmodeled regions)
 *
 * Reference: Jumper et al. (2021) Nature 596:583, Supp. Fig. 1
 */

import type { ConfidenceAnalysis, QualityLevel } from "./types";

// ---------------------------------------------------------------------------
// PDB B-factor extraction
// ---------------------------------------------------------------------------

/**
 * Extract per-residue pLDDT from PDB B-factor column.
 *
 * AlphaFold stores pLDDT in the B-factor field (columns 61-66, 0-indexed 60-66).
 * One value per residue — uses the CA atom's B-factor for each residue.
 *
 * @param pdbText - Full PDB-format text
 * @returns Array of per-residue pLDDT values (0-100)
 */
export function extractPLDDTFromPDB(pdbText: string): number[] {
  const plddt: number[] = [];
  const lines = pdbText.split("\n");
  let prevResidueKey = "";

  for (const line of lines) {
    if (!line.startsWith("ATOM")) continue;

    // Use CA atoms as the per-residue representative
    const atomName = line.substring(12, 16).trim();
    if (atomName !== "CA") continue;

    // Build a unique residue key: chain + residue number
    const chainId = line.length > 21 ? line.charAt(21) : " ";
    const residueNumber = line.substring(22, 26).trim();
    const residueKey = `${chainId}:${residueNumber}`;

    if (residueKey === prevResidueKey) continue;
    prevResidueKey = residueKey;

    // B-factor is columns 61-66 (0-indexed: 60-66)
    const bFactor = line.length > 66 ? parseFloat(line.substring(60, 66).trim()) : NaN;
    if (!isNaN(bFactor)) {
      plddt.push(bFactor);
    }
  }

  return plddt;
}

/**
 * Extract per-residue pLDDT grouped by chain.
 *
 * @param pdbText - Full PDB-format text
 * @returns Map of chain ID to pLDDT array
 */
export function extractPLDDTByChain(pdbText: string): Map<string, number[]> {
  const chains = new Map<string, number[]>();
  const lines = pdbText.split("\n");
  const prevResidueKeys = new Map<string, string>();

  for (const line of lines) {
    if (!line.startsWith("ATOM")) continue;

    const atomName = line.substring(12, 16).trim();
    if (atomName !== "CA") continue;

    const chainId = line.length > 21 ? line.charAt(21).trim() : "A";
    const residueNumber = line.substring(22, 26).trim();
    const residueKey = `${chainId}:${residueNumber}`;

    const prevKey = prevResidueKeys.get(chainId) ?? "";
    if (residueKey === prevKey) continue;
    prevResidueKeys.set(chainId, residueKey);

    const bFactor = line.length > 66 ? parseFloat(line.substring(60, 66).trim()) : NaN;
    if (!isNaN(bFactor)) {
      if (!chains.has(chainId)) chains.set(chainId, []);
      chains.get(chainId)!.push(bFactor);
    }
  }

  return chains;
}

// ---------------------------------------------------------------------------
// pLDDT color mapping
// ---------------------------------------------------------------------------

/**
 * Map a pLDDT value to the AlphaFold confidence color scheme.
 *
 * Color mapping (hex):
 *   >90  : '#0053D6' (very high — deep blue)
 *   70-90: '#65CBF3' (confident — cyan)
 *   50-70: '#FFDB13' (low — yellow)
 *   <50  : '#FF7D45' (very low — orange)
 *
 * @param pLDDT - Per-residue pLDDT score (0-100)
 * @returns Hex color string
 */
export function pLDDTtoColor(pLDDT: number): string {
  if (pLDDT > 90) return "#0053D6";
  if (pLDDT >= 70) return "#65CBF3";
  if (pLDDT >= 50) return "#FFDB13";
  return "#FF7D45";
}

/**
 * Return the color palette as an array of threshold/color pairs, useful for
 * rendering color legends or continuous color mapping.
 */
export function pLDDTColorPalette(): Array<{ threshold: number; color: string; label: string }> {
  return [
    { threshold: 90, color: "#0053D6", label: "Very high (>90)" },
    { threshold: 70, color: "#65CBF3", label: "Confident (70-90)" },
    { threshold: 50, color: "#FFDB13", label: "Low (50-70)" },
    { threshold: 0, color: "#FF7D45", label: "Very low (<50)" },
  ];
}

// ---------------------------------------------------------------------------
// Quality classification
// ---------------------------------------------------------------------------

/**
 * Classify overall quality from mean pLDDT.
 *
 * Thresholds aligned with AlphaFold confidence bands:
 *   >= 70  → 'high'       (reliable for most analyses)
 *   >= 50  → 'medium'     (caution — fold is approximate)
 *   >= 30  → 'low'        (may be disordered)
 *   <  30  → 'very_low'   (likely unstructured / prediction failure)
 */
export function classifyQuality(meanPLDDT: number): QualityLevel {
  if (meanPLDDT >= 70) return "high";
  if (meanPLDDT >= 50) return "medium";
  if (meanPLDDT >= 30) return "low";
  return "very_low";
}

// ---------------------------------------------------------------------------
// Low-confidence region detection
// ---------------------------------------------------------------------------

/**
 * Detect contiguous low-confidence regions (pLDDT < 70).
 *
 * @param plddt - Per-residue pLDDT array
 * @param threshold - pLDDT threshold (default 70)
 * @returns Array of {start, end} ranges (0-indexed residue indices)
 */
export function detectLowConfidenceRegions(plddt: number[], threshold = 70): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];
  let inRegion = false;
  let regionStart = 0;

  for (let i = 0; i < plddt.length; i++) {
    if (plddt[i] < threshold) {
      if (!inRegion) {
        regionStart = i;
        inRegion = true;
      }
    } else {
      if (inRegion) {
        regions.push({ start: regionStart, end: i - 1 });
        inRegion = false;
      }
    }
  }

  // Close any open region at the end
  if (inRegion) {
    regions.push({ start: regionStart, end: plddt.length - 1 });
  }

  return regions;
}

// ---------------------------------------------------------------------------
// Interpretation generation
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable interpretation of the confidence analysis.
 */
function generateInterpretation(
  quality: QualityLevel,
  meanPLDDT: number,
  pTM: number,
  ipTM: number | null,
  lowRegionCount: number,
): string {
  const parts: string[] = [];

  // Overall quality
  switch (quality) {
    case "high":
      parts.push(
        `High-confidence prediction (mean pLDDT ${meanPLDDT.toFixed(1)}). ` +
          "The structure is reliable for most analyses including binding site identification and homology modeling.",
      );
      break;
    case "medium":
      parts.push(
        `Medium-confidence prediction (mean pLDDT ${meanPLDDT.toFixed(1)}). ` +
          "The overall fold is likely correct but loop regions and side-chain orientations may be inaccurate.",
      );
      break;
    case "low":
      parts.push(
        `Low-confidence prediction (mean pLDDT ${meanPLDDT.toFixed(1)}). ` +
          "The structure should be interpreted with caution — significant portions may be disordered or incorrectly modeled.",
      );
      break;
    case "very_low":
      parts.push(
        `Very low confidence (mean pLDDT ${meanPLDDT.toFixed(1)}). ` +
          "The prediction is unreliable. Consider experimental determination or alternative modeling approaches.",
      );
      break;
  }

  // pTM context
  if (pTM > 0) {
    if (pTM >= 0.6) {
      parts.push(`Good global topology (pTM ${pTM.toFixed(2)}).`);
    } else if (pTM >= 0.4) {
      parts.push(`Moderate global topology (pTM ${pTM.toFixed(2)}) — fold may have domain-level errors.`);
    } else {
      parts.push(`Poor global topology (pTM ${pTM.toFixed(2)}) — the overall fold may be incorrect.`);
    }
  }

  // ipTM context for complexes
  if (ipTM !== null && ipTM > 0) {
    if (ipTM >= 0.8) {
      parts.push(`High interface confidence (ipTM ${ipTM.toFixed(2)}) — the complex arrangement is reliable.`);
    } else if (ipTM >= 0.6) {
      parts.push(`Moderate interface confidence (ipTM ${ipTM.toFixed(2)}) — chain arrangement is plausible.`);
    } else {
      parts.push(`Low interface confidence (ipTM ${ipTM.toFixed(2)}) — the complex may not reflect the true assembly.`);
    }
  }

  // Low-confidence regions
  if (lowRegionCount > 0) {
    parts.push(
      `${lowRegionCount} low-confidence region${lowRegionCount > 1 ? "s" : ""} detected (pLDDT < 70). ` +
        "These are often flexible loops, disordered termini, or prediction artifacts.",
    );
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze confidence of a protein structure prediction.
 *
 * Extracts pLDDT from the PDB B-factor column, computes mean scores,
 * detects low-confidence regions, and produces a human-readable interpretation.
 *
 * @param pdbText - PDB-format structure text
 * @param pTM - Global template modeling score (0-1), default 0
 * @param ipTM - Interface pTM for complexes (0-1), default null
 * @returns Full confidence analysis
 */
export function analyzeConfidence(pdbText: string, pTM = 0, ipTM: number | null = null): ConfidenceAnalysis {
  const perResidueConfidence = extractPLDDTFromPDB(pdbText);
  const meanPLDDT =
    perResidueConfidence.length > 0
      ? perResidueConfidence.reduce((sum, v) => sum + v, 0) / perResidueConfidence.length
      : 0;

  const overallQuality = classifyQuality(meanPLDDT);
  const lowConfidenceRegions = detectLowConfidenceRegions(perResidueConfidence);
  const interpretation = generateInterpretation(overallQuality, meanPLDDT, pTM, ipTM, lowConfidenceRegions.length);

  return {
    overallQuality,
    pTM,
    ipTM,
    meanPLDDT: Math.round(meanPLDDT * 100) / 100,
    perResidueConfidence,
    lowConfidenceRegions,
    interpretation,
  };
}
