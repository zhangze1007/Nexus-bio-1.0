/**
 * Sequence Analysis Utilities
 *
 * Pure TypeScript functions for common nucleic acid and protein sequence
 * computations:
 *   - GC content
 *   - Melting temperature (SantaLucia nearest-neighbor method)
 *   - Molecular weight
 *   - Open reading frame (ORF) detection
 *   - DNA-to-protein translation (standard genetic code)
 *
 * All functions are deterministic and side-effect-free. Sequences are
 * treated case-insensitively; invalid bases are silently ignored or
 * treated as non-matching as appropriate.
 *
 * References:
 *   SantaLucia J (1998) "A unified view of polymer, dumbbell, and
 *     oligonucleotide DNA nearest-neighbor thermodynamics" PNAS 95:1460-1465
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** A detected open reading frame. */
export interface ORF {
  /** 0-indexed start position (inclusive), at the first base of the start codon */
  start: number;
  /** 0-indexed end position (exclusive), first base after the stop codon */
  end: number;
  /** Reading frame: 0, 1, or 2 (offset from sequence start) */
  frame: number;
  /** Translated peptide sequence (stop codon excluded) */
  peptide: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Standard genetic code codon table.
 * Maps each 3-letter RNA codon to a single-letter amino acid code.
 * Stop codons map to '*'.
 */
const CODON_TABLE: Record<string, string> = {
  UUU: 'F', UUC: 'F', UUA: 'L', UUG: 'L',
  CUU: 'L', CUC: 'L', CUA: 'L', CUG: 'L',
  AUU: 'I', AUC: 'I', AUA: 'I', AUG: 'M',
  GUU: 'V', GUC: 'V', GUA: 'V', GUG: 'V',
  UCU: 'S', UCC: 'S', UCA: 'S', UCG: 'S',
  CCU: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  ACU: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  GCU: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  UAU: 'Y', UAC: 'Y', UAA: '*', UAG: '*',
  CAU: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  AAU: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  GAU: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  UGU: 'C', UGC: 'C', UGA: '*', UGG: 'W',
  CGU: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  AGU: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GGU: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

/**
 * Molecular weights of deoxyribonucleotide monophosphate residues (Da).
 * These are the average masses of each nucleotide as incorporated into
 * a DNA strand (i.e. minus one water for phosphodiester bond formation,
 * plus one water for the terminal 5'-phosphate and 3'-OH).
 *
 * Values from http://biotools.nubic.northwestern.edu/OligoCalc.html
 */
const NUCLEOTIDE_MW: Record<string, number> = {
  A: 313.21,
  T: 304.20,
  G: 329.21,
  C: 289.18,
};

/** Additional mass for a 5'-phosphate group (monoester) */
const FIVE_PRIME_PHOSPHATE_MW = 79.97;

// ── SantaLucia Nearest-Neighbor Parameters ─────────────────────────────────────
// ΔH in kcal/mol, ΔS in cal/(mol·K)
// From SantaLucia J (1998), Table 1

interface NNParams { dH: number; dS: number }

const NN_PARAMS: Record<string, NNParams> = {
  AA: { dH: -7.9, dS: -22.2 },
  TT: { dH: -7.9, dS: -22.2 },
  AT: { dH: -7.2, dS: -20.4 },
  TA: { dH: -7.2, dS: -21.3 },
  CA: { dH: -8.5, dS: -22.7 },
  TG: { dH: -8.5, dS: -22.7 },
  GT: { dH: -8.4, dS: -22.4 },
  AC: { dH: -8.4, dS: -22.4 },
  CT: { dH: -7.8, dS: -21.0 },
  AG: { dH: -7.8, dS: -21.0 },
  GA: { dH: -8.2, dS: -22.2 },
  TC: { dH: -8.2, dS: -22.2 },
  CG: { dH: -10.6, dS: -27.2 },
  GC: { dH: -9.8, dS: -24.4 },
  GG: { dH: -8.0, dS: -19.9 },
  CC: { dH: -8.0, dS: -19.9 },
};

/** Initiation parameters for duplex formation */
const INIT_DNA: NNParams = { dH: 0.1, dS: -2.8 };

/** Entropy correction for self-complementary sequences */
const SELF_COMPENSALITY_CORRECTION_DS = -1.4; // cal/(mol·K)

// ── Helper Functions ───────────────────────────────────────────────────────────

/** Normalize a DNA sequence to uppercase and replace U with T. */
function normalizeDNA(seq: string): string {
  return seq.toUpperCase().replace(/U/g, 'T');
}

/** Complement a single DNA base. Non-standard bases map to 'N'. */
function complementBase(b: string): string {
  switch (b) {
    case 'A': return 'T';
    case 'T': return 'A';
    case 'G': return 'C';
    case 'C': return 'G';
    default: return 'N';
  }
}

/**
 * Check if a sequence is self-complementary (palindromic).
 * A sequence is self-complementary if it equals its own reverse complement.
 */
function isSelfComplementary(seq: string): boolean {
  for (let i = 0; i < Math.floor(seq.length / 2); i++) {
    const j = seq.length - 1 - i;
    if (seq[i] !== complementBase(seq[j])) return false;
  }
  return true;
}

// ── Exported Functions ─────────────────────────────────────────────────────────

/**
 * Compute the GC content of a nucleotide sequence.
 *
 * GC content = (count of G + count of C) / (count of all valid bases)
 *
 * @param sequence  DNA or RNA sequence (case-insensitive)
 * @returns GC fraction in [0, 1]. Returns 0 for empty/invalid input.
 */
export function computeGC(sequence: string): number {
  const normalized = normalizeDNA(sequence);
  let gc = 0;
  let total = 0;
  for (const base of normalized) {
    if (base === 'G' || base === 'C') {
      gc++;
      total++;
    } else if (base === 'A' || base === 'T') {
      total++;
    }
    // Skip non-standard bases (N, R, Y, etc.)
  }
  return total === 0 ? 0 : gc / total;
}

/**
 * Compute the melting temperature (Tm) of a DNA duplex using the
 * SantaLucia nearest-neighbor thermodynamic model.
 *
 * The formula used:
 *   Tm = (1000 * ΔH) / (ΔS + R * ln(Ct/4)) - 273.15
 *
 * where:
 *   - ΔH is the sum of nearest-neighbor enthalpies (kcal/mol)
 *   - ΔS is the sum of nearest-neighbor entropies (cal/(mol·K))
 *   - R = 1.987 cal/(mol·K) (universal gas constant)
 *   - Ct is the total strand concentration (M)
 *
 * For sequences shorter than 2 bases, falls back to the Wallace rule:
 *   Tm = 2 * (A+T) + 4 * (G+C)
 *
 * @param sequence  DNA sequence (case-insensitive)
 * @param ct        Total strand concentration in M (default 250e-9 = 250 nM)
 * @param isSelfComp  Whether the oligo is self-complementary (default: auto-detect)
 * @returns Tm in degrees Celsius
 */
export function computeTm(
  sequence: string,
  ct: number = 250e-9,
  isSelfComp?: boolean,
): number {
  const normalized = normalizeDNA(sequence);

  // Filter to only valid bases for nearest-neighbor calculation
  const validBases = normalized.replace(/[^ATGC]/g, '');

  if (validBases.length < 2) {
    // Wallace rule fallback for very short sequences
    let at = 0;
    let gc = 0;
    for (const b of normalized) {
      if (b === 'A' || b === 'T') at++;
      else if (b === 'G' || b === 'C') gc++;
    }
    return 2 * at + 4 * gc;
  }

  // Sum nearest-neighbor parameters
  let dH = INIT_DNA.dH; // kcal/mol
  let dS = INIT_DNA.dS; // cal/(mol·K)

  for (let i = 0; i < validBases.length - 1; i++) {
    const pair = validBases.slice(i, i + 2);
    const params = NN_PARAMS[pair];
    if (params) {
      dH += params.dH;
      dS += params.dS;
    } else {
      // Fallback for unknown pairs: use a rough average
      dH += -7.0;
      dS += -20.0;
    }
  }

  // Self-complementary correction
  const selfComp = isSelfComp ?? isSelfComplementary(validBases);
  if (selfComp) {
    dS += SELF_COMPENSALITY_CORRECTION_DS;
  }

  // Tm = (1000 * ΔH) / (ΔS + R * ln(Ct/4)) - 273.15
  const R = 1.987; // cal/(mol·K)
  const tm = (1000 * dH) / (dS + R * Math.log(ct / 4)) - 273.15;

  return Math.round(tm * 100) / 100;
}

/**
 * Compute the molecular weight of a single-stranded DNA sequence.
 *
 * Uses average mass values for each deoxyribonucleotide monophosphate
 * residue plus the 5'-terminal phosphate group. Non-standard bases
 * contribute 0 Da (conservative estimate).
 *
 * @param sequence  DNA sequence (case-insensitive)
 * @returns Molecular weight in Daltons (Da). Returns 0 for empty input.
 */
export function computeMW(sequence: string): number {
  const normalized = normalizeDNA(sequence);

  if (normalized.length === 0) return 0;

  let mw = FIVE_PRIME_PHOSPHATE_MW;
  for (const base of normalized) {
    mw += NUCLEOTIDE_MW[base] ?? 0;
  }

  return Math.round(mw * 100) / 100;
}

/**
 * Find all open reading frames (ORFs) in a DNA sequence across all
 * three forward reading frames.
 *
 * An ORF is defined as a region starting with ATG and ending with a
 * stop codon (TAA, TAG, TGA). Only ORFs meeting the minimum length
 * requirement are returned.
 *
 * @param sequence   DNA sequence (case-insensitive)
 * @param minLength  Minimum ORF length in nucleotides (default: 30)
 * @returns Array of ORF objects sorted by start position, then frame
 */
export function findORFs(sequence: string, minLength: number = 30): ORF[] {
  const normalized = normalizeDNA(sequence);
  const orfs: ORF[] = [];

  const stopCodons = new Set(['TAA', 'TAG', 'TGA']);

  for (let frame = 0; frame < 3; frame++) {
    let i = frame;
    while (i <= normalized.length - 3) {
      const codon = normalized.slice(i, i + 3);
      if (codon === 'ATG') {
        // Found a start codon; scan for the next in-frame stop
        let j = i + 3;
        while (j <= normalized.length - 3) {
          const nextCodon = normalized.slice(j, j + 3);
          if (stopCodons.has(nextCodon)) {
            const orfLen = j + 3 - i;
            if (orfLen >= minLength) {
              const cds = normalized.slice(i, j);
              orfs.push({
                start: i,
                end: j + 3,
                frame,
                peptide: translateDNA(cds),
              });
            }
            i = j + 3; // advance past this stop codon
            break;
          }
          j += 3;
        }
        if (j > normalized.length - 3) {
          // No stop codon found; skip this start codon
          i += 3;
        }
      } else {
        i += 3;
      }
    }
  }

  // Sort by start position, then by frame
  orfs.sort((a, b) => a.start - b.start || a.frame - b.frame);
  return orfs;
}

/**
 * Translate a DNA sequence into a protein sequence using the standard
 * genetic code.
 *
 * The sequence is first transcribed (T→U) and then read in triplets.
 * Non-standard bases produce 'X' (unknown amino acid). The reading
 * begins at the first base; partial trailing codons are ignored.
 *
 * @param sequence  DNA sequence (case-insensitive)
 * @returns Protein sequence as a single-letter amino acid string
 */
export function translateSequence(sequence: string): string {
  const normalized = normalizeDNA(sequence);
  return translateDNA(normalized);
}

// ── Internal Translation ───────────────────────────────────────────────────────

/**
 * Internal DNA translation helper. Assumes input is already uppercase
 * and T-normalized.
 */
function translateDNA(dna: string): string {
  const rna = dna.replace(/T/g, 'U');
  const peptides: string[] = [];

  for (let i = 0; i <= rna.length - 3; i += 3) {
    const codon = rna.slice(i, i + 3);
    const aa = CODON_TABLE[codon];
    if (aa === undefined) {
      peptides.push('X'); // unknown amino acid
    } else if (aa === '*') {
      break; // stop codon
    } else {
      peptides.push(aa);
    }
  }

  return peptides.join('');
}
