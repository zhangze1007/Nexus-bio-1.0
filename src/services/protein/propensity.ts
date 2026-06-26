/**
 * Amino Acid Propensity Tables — Chou-Fasman Parameters
 *
 * Published secondary structure propensities for each of the 20 standard
 * amino acids. Used by the inverse folding engine to assign residues that
 * are compatible with local backbone geometry.
 *
 * @scientific_provenance
 *   ALGORITHM: Chou-Fasman secondary structure prediction parameters
 *   REFERENCE: Chou PY, Fasman GD (1978) Annu Rev Biochem 47:251-276
 *   KNOWN_LIMITATIONS:
 *     - Derived from a small dataset of solved structures (1978)
 *     - Does not capture context-dependent effects (neighboring residues)
 *     - Loop propensities are derived, not directly measured
 *     - Modern methods (PSIPRED, NetSurfP) outperform raw Chou-Fasman
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All 20 standard amino acid single-letter codes */
export const ALL_AMINO_ACIDS: readonly string[] = 'ACDEFGHIKLMNPQRSTVWY'.split('');

// ---------------------------------------------------------------------------
// Chou-Fasman Propensity Tables
// ---------------------------------------------------------------------------

/**
 * Helix propensities (Pa values).
 *
 * Values > 1.0 indicate the residue favors α-helix formation.
 * Values < 1.0 indicate the residue disfavors α-helix.
 *
 * Chou & Fasman (1978) Table I — α-helix parameters.
 */
export const HELIX_PROPENSITIES: Record<string, number> = {
  A: 1.42, // Ala — strong helix former
  R: 0.98, // Arg
  N: 0.67, // Asn — helix breaker
  D: 1.01, // Asp
  C: 0.70, // Cys
  Q: 1.11, // Gln
  E: 1.51, // Glu — strongest helix former
  G: 0.57, // Gly — helix breaker
  H: 1.00, // His — neutral
  I: 1.08, // Ile
  L: 1.21, // Leu — strong helix former
  K: 1.16, // Lys
  M: 1.45, // Met — strong helix former
  F: 1.13, // Phe
  P: 0.57, // Pro — strongest helix breaker
  S: 0.77, // Ser
  T: 0.83, // Thr
  W: 1.08, // Trp
  Y: 0.69, // Tyr
  V: 1.06, // Val
};

/**
 * Sheet propensities (Pb values).
 *
 * Values > 1.0 indicate the residue favors β-sheet formation.
 * Values < 1.0 indicate the residue disfavors β-sheet.
 *
 * Chou & Fasman (1978) Table II — β-sheet parameters.
 */
export const SHEET_PROPENSITIES: Record<string, number> = {
  A: 0.83, // Ala
  R: 0.93, // Arg
  N: 0.89, // Asn
  D: 0.54, // Asp — sheet breaker
  C: 1.19, // Cys
  Q: 1.10, // Gln
  E: 0.37, // Glu — strongest sheet breaker
  G: 0.75, // Gly
  H: 0.87, // His
  I: 1.60, // Ile — strong sheet former
  L: 1.30, // Leu
  K: 0.74, // Lys
  M: 1.05, // Met
  F: 1.38, // Phe — strong sheet former
  P: 0.55, // Pro — sheet breaker
  S: 0.75, // Ser
  T: 1.19, // Thr
  W: 1.37, // Trp
  Y: 1.47, // Tyr — strong sheet former
  V: 1.70, // Val — strongest sheet former
};

/**
 * Loop/turn propensities (Pt values).
 *
 * Values > 1.0 indicate the residue favors coil/turn formation.
 * These are derived from (1 - Pa - Pb) normalization in the original
 * Chou-Fasman framework, supplemented by turn propensity data.
 *
 * Chou & Fasman (1978) Table III — β-turn parameters.
 */
export const LOOP_PROPENSITIES: Record<string, number> = {
  A: 0.66, // Ala
  R: 1.03, // Arg
  N: 1.56, // Asn — strong turn former
  D: 1.46, // Asp — strong turn former
  C: 1.19, // Cys
  Q: 0.98, // Gln
  E: 0.74, // Glu
  G: 1.64, // Gly — strongest turn former (flexible backbone)
  H: 1.22, // His
  I: 0.47, // Ile — rare in turns
  L: 0.59, // Leu
  K: 1.01, // Lys
  M: 0.60, // Met
  F: 0.60, // Phe
  P: 1.91, // Pro — strongest turn former (rigid, breaks helix/sheet)
  S: 1.43, // Ser — common in turns
  T: 0.88, // Thr
  W: 0.60, // Trp
  Y: 1.14, // Tyr
  V: 0.39, // Val — rare in turns
};

// ---------------------------------------------------------------------------
// Hydrophobic Core
// ---------------------------------------------------------------------------

/**
 * Amino acids that prefer to be buried in the protein hydrophobic core.
 *
 * These residues have nonpolar side chains and are typically found in the
 * interior of globular proteins, away from solvent.
 *
 * Note: Tyrosine (Y) and Tryptophan (W) are included despite having polar
 * atoms because their large hydrophobic surface area dominates burial.
 */
export const HYDROPHOBIC_CORE: ReadonlySet<string> = new Set([
  'V', // Val — branched aliphatic
  'I', // Ile — branched aliphatic
  'L', // Leu — branched aliphatic
  'F', // Phe — aromatic
  'W', // Trp — aromatic (large, mostly hydrophobic)
  'M', // Met — sulfur-containing, hydrophobic
]);

// ---------------------------------------------------------------------------
// Charge Pairs (Salt Bridges)
// ---------------------------------------------------------------------------

/**
 * Oppositely charged amino acid pairs that can form salt bridges.
 *
 * Salt bridges are electrostatic interactions between positively and
 * negatively charged side chains, stabilizing protein structure.
 *
 * Standard salt bridges:
 *   Asp(-) -- Lys(+)
 *   Glu(-) -- Arg(+)
 *   Asp(-) -- Arg(+)
 *   Glu(-) -- Lys(+)
 *   His(+) -- Asp(-)  (partial charge at physiological pH)
 *   His(+) -- Glu(-)
 */
export const CHARGE_PAIRS: ReadonlyArray<[string, string]> = [
  ['D', 'K'], // Asp(-) -- Lys(+)
  ['E', 'R'], // Glu(-) -- Arg(+)
  ['D', 'R'], // Asp(-) -- Arg(+)
  ['E', 'K'], // Glu(-) -- Lys(+)
  ['H', 'D'], // His(+) -- Asp(-)
  ['H', 'E'], // His(+) -- Glu(-)
];
