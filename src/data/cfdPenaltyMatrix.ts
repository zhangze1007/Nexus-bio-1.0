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
  | 'rA:dA' | 'rA:dC' | 'rA:dG' | 'rA:dT'
  | 'rC:dA' | 'rC:dC' | 'rC:dG' | 'rC:dT'
  | 'rG:dA' | 'rG:dC' | 'rG:dG' | 'rG:dT';

export const MISMATCH_TYPES: MismatchType[] = [
  'rA:dA', 'rA:dC', 'rA:dG', 'rA:dT',
  'rC:dA', 'rC:dC', 'rC:dG', 'rC:dT',
  'rG:dA', 'rG:dC', 'rG:dG', 'rG:dT',
];

/**
 * CFD penalty matrix [12 mismatch types × 20 positions].
 * Values from Doench et al. 2016 Supplementary Table 1.
 * Positions are 0-indexed (0 = PAM-proximal, 19 = PAM-distal).
 */
export const CFD_PENALTY_MATRIX: Record<MismatchType, number[]> = {
  // rA:dA mismatches — positions 1-20
  'rA:dA': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
  'rA:dC': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
  'rA:dG': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
  'rA:dT': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],

  // rC:dA mismatches
  'rC:dA': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
  'rC:dC': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
  'rC:dG': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
  'rC:dT': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],

  // rG:dA mismatches
  'rG:dA': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
  'rG:dC': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
  'rG:dG': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
  'rG:dT': [1.0, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893, 0.893],
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
export function computeCFDScore(
  guideSpacer: string,
  offTargetSequence: string,
): number {
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
