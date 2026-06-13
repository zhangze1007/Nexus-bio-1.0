/**
 * RBS Strength Calculator
 *
 * Computes ribosome binding site (RBS) translation initiation rate
 * using the thermodynamic model from Salis et al. (2009) Nature Biotechnology.
 *
 * The model predicts translation rates by computing the total free energy
 * of mRNA-ribosome interactions:
 *
 *   ΔG_total = ΔG_mRNA_rRNA + ΔG_spacing + ΔG_start_codon
 *
 * References:
 *   - Salis HM, Mirsky EA, Voigt CA. Automated design of synthetic ribosome
 *     binding sites to control protein expression. Nat Biotechnol. 2009;27(10):946-50.
 */

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface RBSConfig {
  /** Upstream sequence including Shine-Dalgarno region (5' to 3'). */
  rbsSequence: string;
  /** Coding sequence starting with ATG/GUG/UUG start codon (5' to 3'). */
  cdsSequence: string;
  /** Target organism. */
  organism: 'ecoli' | 'scerevisiae';
}

export interface RBSResult {
  /** Relative translation rate (arbitrary units, proportional to initiation rate). */
  translationRate: number;
  /** Shine-Dalgarno binding energy (kcal/mol) — more negative = stronger. */
  sdStrength: number;
  /** Spacing (nt) between the 3' end of the SD match and the start codon. */
  spacing: number;
  /** Total free energy of translation initiation (kcal/mol). */
  deltaG_total: number;
  /** Free energy of mRNA–16S rRNA hybridization (kcal/mol). */
  deltaG_mRNA_rRNA: number;
  /** Spacing penalty free energy (kcal/mol). */
  deltaG_spacing: number;
  /** Start codon free energy contribution (kcal/mol). */
  deltaG_startCodon: number;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 16S rRNA 3' anti-Shine-Dalgarno sequence (E. coli): 3'-AUUCCUCC-5'
 * Its complement (Shine-Dalgarno consensus): 5'-AGGAGG-3'
 */
const SD_CONSENSUS = 'AGGAGG';

/**
 * Gas constant × temperature at 37 °C.
 * R = 1.987 × 10⁻³ kcal/(mol·K), T = 310.15 K
 */
const RT = 1.987e-3 * 310.15; // ≈ 0.616 kcal/mol

/**
 * Nearest-neighbor free energy parameters for RNA duplex formation (kcal/mol).
 * Based on Freier et al. (1986) and Salis et al. (2009) supplementary tables.
 * Values represent ΔG°37 for each dinucleotide pair in a helix.
 */
const NN_PARAMS: Record<string, number> = {
  AA: -0.9, AU: -1.1, AG: -1.3, AC: -1.3,
  UA: -1.3, UU: -0.9, UG: -1.3, UC: -2.1,
  GA: -1.6, GU: -1.3, GG: -1.8, GC: -2.7,
  CA: -1.6, CU: -1.3, CG: -2.1, CC: -1.8,
};

/**
 * Start codon free energy contributions (kcal/mol).
 * AUG is the canonical start codon with the most favorable energy.
 */
const START_CODON_ENERGY: Record<string, number> = {
  ATG: -1.194, AUG: -1.194,
  GTG: 0.016,  GUG: 0.016,
  TTG: 0.767,  UUG: 0.767,
};

/**
 * Optimal spacing between Shine-Dalgarno 3' end and start codon.
 * Salis et al. (2009): 5 nt is optimal for E. coli.
 */
const OPTIMAL_SPACING = 5;

/**
 * Spacing penalty coefficient.
 * ΔG_spacing = SPACING_COEFF * (spacing - OPTIMAL_SPACING)^2
 */
const SPACING_COEFF = 0.045;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Convert a DNA sequence to RNA (T → U), uppercased. */
function dnaToRna(seq: string): string {
  return seq.toUpperCase().replace(/T/g, 'U');
}

/** Convert an RNA sequence to DNA (U → T), uppercased. */
function rnaToDna(seq: string): string {
  return seq.toUpperCase().replace(/U/g, 'T');
}

/**
 * Compute the complement of an RNA sequence (for rRNA pairing).
 * A↔U, G↔C
 */
function rnaComplement(seq: string): string {
  const map: Record<string, string> = { A: 'U', U: 'A', G: 'C', C: 'G' };
  return seq
    .split('')
    .map((ch) => map[ch] ?? 'N')
    .join('');
}

/**
 * Compute nearest-neighbor free energy for an RNA duplex.
 * Both strands are given 5'→3'. We walk paired dinucleotides.
 */
function nearestNeighborEnergy(strand5to3: string): number {
  const s = strand5to3.toUpperCase().replace(/T/g, 'U');
  let dG = 0;
  for (let i = 0; i < s.length - 1; i++) {
    const pair = s[i] + s[i + 1];
    dG += NN_PARAMS[pair] ?? -1.0; // default penalty for unknown pairs
  }
  return dG;
}

/**
 * Find the best Shine-Dalgarno match in the RBS sequence.
 *
 * The SD sequence (AGGAGG) appears directly in the mRNA and base-pairs
 * with the 3' end of 16S rRNA (3'-AUUCCUCC-5'). We search for contiguous
 * subsequences of AGGAGG (6, 5, 4, 3, or 2 nt) in the RBS and return
 * the longest match with its computed ΔG_mRNA_rRNA.
 */
function findBestSDMatch(
  rbsSeq: string,
): { sdMatch: string; sdEndPos: number; dG_mRNA_rRNA: number } {
  const rbs = rbsSeq.toUpperCase().replace(/T/g, 'U');
  const rnaSD = dnaToRna(SD_CONSENSUS); // AGGAGG in RNA

  let bestMatch = '';
  let bestEndPos = -1;
  let bestEnergy = 0;

  // Try progressively shorter SD consensus sequences (longest first)
  for (let len = rnaSD.length; len >= 2; len--) {
    const sdFragment = rnaSD.substring(0, len);

    // Scan the RBS for the SD sequence directly
    for (let i = 0; i <= rbs.length - len; i++) {
      const window = rbs.substring(i, i + len);
      if (window === sdFragment) {
        // Found a match — compute energy of the mRNA-rRNA duplex
        const dG = nearestNeighborEnergy(sdFragment);
        if (bestMatch === '' || len > bestMatch.length) {
          bestMatch = sdFragment;
          bestEndPos = i + len; // 3' end of the SD match in RBS
          bestEnergy = dG;
        }
      }
    }
  }

  // If no SD match found, return weak default
  if (bestMatch === '') {
    return { sdMatch: '', sdEndPos: -1, dG_mRNA_rRNA: 0 };
  }

  return { sdMatch: bestMatch, sdEndPos: bestEndPos, dG_mRNA_rRNA: bestEnergy };
}

/**
 * Extract the start codon from a CDS sequence.
 * Returns the first 3 nucleotides uppercased with T→U conversion.
 */
function extractStartCodon(cds: string): string {
  return cds.substring(0, 3).toUpperCase().replace(/T/g, 'U');
}

/**
 * Count the number of nucleotides between the 3' end of the SD match
 * and the first nucleotide of the start codon in the full mRNA.
 */
function computeSpacing(
  rbsSeq: string,
  cdsSeq: string,
  sdEndPos: number,
): number {
  // The spacing is measured from the end of the SD match to the start codon
  // In the full mRNA: ...rbs...|cds...
  // The start codon begins at position rbs.length in the full mRNA
  // SD match ends at position sdEndPos in the rbsSequence
  // So spacing = rbs.length - sdEndPos
  if (sdEndPos < 0) return OPTIMAL_SPACING; // no match → neutral spacing
  const spacing = rbsSeq.length - sdEndPos;
  return Math.max(0, spacing);
}

/* -------------------------------------------------------------------------- */
/*  Main calculator                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Calculate RBS translation initiation strength using the Salis et al. (2009)
 * thermodynamic model.
 *
 * @param config — RBS sequence, CDS sequence, and target organism.
 * @returns RBSResult with all energy components and predicted translation rate.
 */
export function calculateRBSStrength(config: RBSConfig): RBSResult {
  const { rbsSequence, cdsSequence } = config;

  // 1. Find best Shine-Dalgarno match
  const { sdMatch, sdEndPos, dG_mRNA_rRNA } = findBestSDMatch(rbsSequence);

  // 2. Compute spacing between SD 3' end and start codon
  const spacing = computeSpacing(rbsSequence, cdsSequence, sdEndPos);

  // 3. Spacing penalty
  const deltaG_spacing = SPACING_COEFF * Math.pow(spacing - OPTIMAL_SPACING, 2);

  // 4. Start codon energy
  const startCodon = extractStartCodon(cdsSequence);
  const deltaG_startCodon = START_CODON_ENERGY[startCodon] ?? 0;

  // 5. Total free energy
  const deltaG_total = dG_mRNA_rRNA + deltaG_spacing + deltaG_startCodon;

  // 6. Translation rate ∝ exp(-ΔG_total / RT)
  const translationRate = Math.exp(-deltaG_total / RT);

  return {
    translationRate,
    sdStrength: dG_mRNA_rRNA,
    spacing,
    deltaG_total,
    deltaG_mRNA_rRNA: dG_mRNA_rRNA,
    deltaG_spacing,
    deltaG_startCodon,
  };
}
