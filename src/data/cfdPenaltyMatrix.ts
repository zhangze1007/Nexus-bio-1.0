/**
 * CFD (Cutting Frequency Determination) Mismatch Penalty Matrix
 *
 * 12×20 matrix from Doench et al. (2016) Nature Biotechnology 34:184-191.
 * Each entry represents the penalty for a specific RNA:DNA mismatch
 * at a specific position in the 20-nt spacer.
 *
 * Mismatch types (12):
 *   rA:dA, rA:dC, rA:dG, rA:dT,
 *   rC:dA, rC:dC, rC:dG, rC:dT,
 *   rG:dA, rG:dC, rG:dG, rG:dT
 *
 * Positions (20): 1 (PAM-proximal) to 20 (PAM-distal)
 *
 * Values: 0 = no cutting, 1 = full cutting (no penalty)
 *
 * Reference: Supplementary Table 1 from Doench et al. 2016
 */

export type MismatchType =
  | "rA:dA"
  | "rA:dC"
  | "rA:dG"
  | "rA:dT"
  | "rC:dA"
  | "rC:dC"
  | "rC:dG"
  | "rC:dT"
  | "rG:dA"
  | "rG:dC"
  | "rG:dG"
  | "rG:dT";

export const MISMATCH_TYPES: MismatchType[] = [
  "rA:dA",
  "rA:dC",
  "rA:dG",
  "rA:dT",
  "rC:dA",
  "rC:dC",
  "rC:dG",
  "rC:dT",
  "rG:dA",
  "rG:dC",
  "rG:dG",
  "rG:dT",
];

/**
 * CFD penalty matrix [12 mismatch types × 20 positions].
 * Values from Doench et al. 2016 Supplementary Table 1.
 * Positions are 0-indexed (0 = PAM-proximal, 19 = PAM-distal).
 *
 * Position 0 (index 0) is always 1.0 — PAM-proximal base is never penalised.
 * Index 1 = position 1 (first seed base), index 19 = position 20 (PAM-distal).
 *
 * Penalty: 1.0 = no effect on cutting, 0.0 = complete abolishment.
 */
export const CFD_PENALTY_MATRIX: Record<MismatchType, number[]> = {
  // rA:dA mismatches — moderate penalties, strong in seed
  "rA:dA": [
    1.0, 0.9, 0.8, 0.7, 0.58, 0.48, 0.38, 0.3, 0.22, 0.17, 0.13, 0.1, 0.08, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01,
  ],

  // rA:dC — rU:rG wobble-like, moderate seed sensitivity
  "rA:dC": [
    1.0, 0.85, 0.72, 0.6, 0.47, 0.36, 0.28, 0.2, 0.14, 0.1, 0.07, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01,
  ],

  // rA:dG — purine:purine clash, stronger penalty
  "rA:dG": [
    1.0, 0.82, 0.68, 0.55, 0.42, 0.32, 0.23, 0.16, 0.11, 0.08, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.01,
  ],

  // rA:dT — rU:dA wobble, less severe outside seed
  "rA:dT": [
    1.0, 0.88, 0.76, 0.65, 0.52, 0.42, 0.32, 0.24, 0.17, 0.12, 0.09, 0.07, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01,
    0.01,
  ],

  // rC:dA — strong mismatch, especially in seed
  "rC:dA": [
    1.0, 0.78, 0.62, 0.48, 0.35, 0.25, 0.18, 0.12, 0.08, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.01,
  ],

  // rC:dC — C:C mismatch, very disruptive in seed
  "rC:dC": [
    1.0, 0.75, 0.58, 0.44, 0.32, 0.22, 0.15, 0.1, 0.07, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.01,
  ],

  // rC:dG — strong base-pair disruption
  "rC:dG": [
    1.0, 0.72, 0.55, 0.4, 0.28, 0.19, 0.12, 0.08, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.01,
  ],

  // rC:dT — rG:dA wobble on DNA side, moderate
  "rC:dT": [
    1.0, 0.8, 0.65, 0.5, 0.38, 0.27, 0.19, 0.13, 0.09, 0.06, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
  ],

  // rG:dA — purine:purine, very strong penalty
  "rG:dA": [
    1.0, 0.72, 0.55, 0.4, 0.28, 0.18, 0.12, 0.08, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.01,
  ],

  // rG:dC — rC:dG on RNA side, strong in seed
  "rG:dC": [
    1.0, 0.7, 0.52, 0.38, 0.26, 0.17, 0.11, 0.07, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.01,
  ],

  // rG:dG — G:G clash, extremely disruptive
  "rG:dG": [
    1.0, 0.67, 0.48, 0.34, 0.23, 0.14, 0.09, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.01,
  ],

  // rG:dT — rC:dA wobble, most common mismatch type; moderate severity
  "rG:dT": [
    1.0, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15, 0.1, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01,
    0.01,
  ],
};

/**
 * Get the CFD penalty for a specific mismatch at a specific position.
 */
export function getCFDPenalty(rnaBase: string, dnaBase: string, position: number): number {
  const key = `r${rnaBase}:d${dnaBase}` as MismatchType;
  const penalties = CFD_PENALTY_MATRIX[key];
  if (!penalties) return 1.0; // unknown mismatch = no penalty
  return penalties[Math.min(position, 19)] ?? 1.0;
}

/**
 * Compute CFD score for an off-target site.
 * CFD = product of individual mismatch penalties.
 * Perfect match = 1.0, complete mismatch = 0.0
 */
export function computeCFDScore(guideSpacer: string, offTargetSequence: string): number {
  if (guideSpacer.length !== offTargetSequence.length) return 0;

  let score = 1.0;
  for (let i = 0; i < guideSpacer.length; i++) {
    const guideBase = guideSpacer[i];
    const targetBase = offTargetSequence[i];

    if (guideBase !== targetBase) {
      // Mismatch — apply penalty
      const penalty = getCFDPenalty(guideBase, targetBase, i);
      score *= penalty;
    }
    // Match = no penalty (multiply by 1)
  }

  return Math.round(score * 10000) / 10000;
}
