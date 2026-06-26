/**
 * 6-Frame Translation Engine
 *
 * Translates DNA sequences into amino acid sequences in all 6 reading frames.
 * Uses the standard genetic code (NCBI table 1).
 */

/**
 * Standard genetic code codon table (NCBI table 1).
 * Maps 64 codons to single-letter amino acid codes.
 * '*' = stop codon, '?' = unknown/invalid.
 */
const CODON_TABLE: Record<string, string> = {
  // Phenylalanine
  TTT: "F",
  TTC: "F",
  // Leucine
  TTA: "L",
  TTG: "L",
  CTT: "L",
  CTC: "L",
  CTA: "L",
  CTG: "L",
  // Isoleucine
  ATT: "I",
  ATC: "I",
  ATA: "I",
  // Methionine (start)
  ATG: "M",
  // Valine
  GTT: "V",
  GTC: "V",
  GTA: "V",
  GTG: "V",
  // Serine
  TCT: "S",
  TCC: "S",
  TCA: "S",
  TCG: "S",
  AGT: "S",
  AGC: "S",
  // Proline
  CCT: "P",
  CCC: "P",
  CCA: "P",
  CCG: "P",
  // Threonine
  ACT: "T",
  ACC: "T",
  ACA: "T",
  ACG: "T",
  // Alanine
  GCT: "A",
  GCC: "A",
  GCA: "A",
  GCG: "A",
  // Tyrosine
  TAT: "Y",
  TAC: "Y",
  // Stop
  TAA: "*",
  TAG: "*",
  TGA: "*",
  // Histidine
  CAT: "H",
  CAC: "H",
  // Glutamine
  CAA: "Q",
  CAG: "Q",
  // Asparagine
  AAT: "N",
  AAC: "N",
  // Lysine
  AAA: "K",
  AAG: "K",
  // Aspartate
  GAT: "D",
  GAC: "D",
  // Glutamate
  GAA: "E",
  GAG: "E",
  // Cysteine
  TGT: "C",
  TGC: "C",
  // Tryptophan
  TGG: "W",
  // Arginine
  CGT: "R",
  CGC: "R",
  CGA: "R",
  CGG: "R",
  AGA: "R",
  AGG: "R",
  // Glycine
  GGT: "G",
  GGC: "G",
  GGA: "G",
  GGG: "G",
};

/**
 * Translate a single codon (3-letter DNA string) to an amino acid letter.
 * Returns '?' for unknown or incomplete codons.
 */
export function translateCodon(codon: string): string {
  const upper = codon.toUpperCase();
  if (upper.length !== 3) return "?";
  return CODON_TABLE[upper] ?? "?";
}

/**
 * Compute the reverse complement of a DNA string.
 */
function revComp(seq: string): string {
  const comp: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
  return seq
    .split("")
    .reverse()
    .map((b) => comp[b] ?? b)
    .join("");
}

/**
 * Translate a DNA sequence in a given reading frame.
 *
 * Frames:
 *   0  = +1 (starts at position 0)
 *   1  = +2 (starts at position 1)
 *   2  = +3 (starts at position 2)
 *  -1  = -1 (reverse complement, starts at position 0)
 *  -2  = -2 (reverse complement, starts at position 1)
 *  -3  = -3 (reverse complement, starts at position 2)
 *
 * Incomplete trailing codons (1-2 leftover bases) are silently dropped.
 */
export function translateFrame(sequence: string, frame: 0 | 1 | 2 | -1 | -2 | -3): string {
  if (!sequence) return "";

  const upper = sequence.toUpperCase();
  const seq = frame < 0 ? revComp(upper) : upper;
  const offset = Math.abs(frame) - (frame < 0 ? 1 : 0);
  // For positive frames: offset = frame (0,1,2)
  // For negative frames: offset = |frame|-1 (0,1,2) since frame -1 => offset 0, -2 => 1, -3 => 2
  const actualOffset = frame >= 0 ? frame : Math.abs(frame) - 1;

  const result: string[] = [];
  for (let i = actualOffset; i + 2 < seq.length; i += 3) {
    const codon = seq.substring(i, i + 3);
    result.push(translateCodon(codon));
  }
  return result.join("");
}

/**
 * Perform 6-frame translation of a DNA sequence.
 *
 * Returns an object with keys '+1', '+2', '+3', '-1', '-2', '-3'.
 */
export function sixFrameTranslation(sequence: string): Record<string, string> {
  return {
    "+1": translateFrame(sequence, 0),
    "+2": translateFrame(sequence, 1),
    "+3": translateFrame(sequence, 2),
    "-1": translateFrame(sequence, -1),
    "-2": translateFrame(sequence, -2),
    "-3": translateFrame(sequence, -3),
  };
}
