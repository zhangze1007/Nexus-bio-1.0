/**
 * Primer Designer
 *
 * PCR primer design utilities for synthetic biology workflows.
 * Designs forward/reverse primer pairs from a template DNA sequence
 * using nearest-neighbor thermodynamic Tm calculation (SantaLucia 1998).
 *
 * Features:
 *   - Nearest-neighbor Tm via shared computeTm from sequenceAnalysis
 *   - GC clamp verification (3'-terminal G or C)
 *   - Self-complementarity scoring (3'-end overlap detection)
 *   - Primer length and Tm window constraints
 *   - Product size calculation
 *
 * All functions are pure TypeScript, deterministic, and side-effect-free.
 *
 * References:
 *   SantaLucia J (1998) PNAS 95:1460-1465
 *   Dieffenbach CW et al. (1993) "General concepts for PCR primer design"
 *     PCR Methods Appl 3(2):S30-S37
 */

import { computeGC, computeTm } from "./sequenceAnalysis";

// ── Types ──────────────────────────────────────────────────────────────────────

/** A designed primer (5'→3' sequence with thermodynamic metadata). */
export interface Primer {
  /** Primer sequence in 5'→3' orientation */
  sequence: string;
  /** Melting temperature in °C (nearest-neighbor) */
  tm: number;
  /** GC content as fraction [0, 1] */
  gcContent: number;
  /** Start position on template (0-indexed, inclusive) */
  start: number;
  /** End position on template (0-indexed, exclusive) */
  end: number;
  /** Whether the 3' end has a G or C (GC clamp) */
  hasGcClamp: boolean;
  /** Self-complementarity score at the 3' end (0–1, lower is better) */
  selfComplementarity: number;
}

/** A matched forward/reverse primer pair. */
export interface PrimerPair {
  /** Forward primer */
  forward: Primer;
  /** Reverse primer (sequence is the reverse complement of the template) */
  reverse: Primer;
  /** Amplicon (product) size in base pairs */
  productSize: number;
  /** Absolute difference in Tm between forward and reverse primers (°C) */
  tmDiff: number;
}

/** Configuration for primer design. */
export interface PrimerDesignOptions {
  /** Minimum primer length (default: 18) */
  minLength?: number;
  /** Maximum primer length (default: 25) */
  maxLength?: number;
  /** Minimum acceptable Tm in °C (default: 55) */
  minTm?: number;
  /** Maximum acceptable Tm in °C (default: 65) */
  maxTm?: number;
  /** Maximum allowed |Tm(forward) − Tm(reverse)| in °C (default: 5) */
  maxTmDiff?: number;
  /** Maximum 3' self-complementarity score (default: 0.5) */
  maxSelfComplementarity?: number;
  /** Require a GC clamp at the 3' end (default: true) */
  requireGcClamp?: boolean;
  /** Total strand concentration in M for Tm calculation (default: 250e-9) */
  strandConcentration?: number;
}

// ── Internal Helpers ───────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<PrimerDesignOptions> = {
  minLength: 18,
  maxLength: 25,
  minTm: 55,
  maxTm: 65,
  maxTmDiff: 5,
  maxSelfComplementarity: 0.5,
  requireGcClamp: true,
  strandConcentration: 250e-9,
};

/** Normalize DNA to uppercase, replace U→T, strip non-ACGT. */
function normalize(seq: string): string {
  return seq
    .toUpperCase()
    .replace(/U/g, "T")
    .replace(/[^ATGC]/g, "");
}

/** Get the reverse complement of a DNA sequence. */
function reverseComplement(seq: string): string {
  const comp: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
  let rc = "";
  for (let i = seq.length - 1; i >= 0; i--) {
    rc += comp[seq[i]] ?? "N";
  }
  return rc;
}

/**
 * Check 3'-end self-complementarity.
 *
 * Scores how many of the last `windowSize` bases at the 3' end can form
 * Watson-Crick pairs with any region of the same primer (or its reverse
 * complement). Returns a normalized score in [0, 1] where 0 = no
 * complementarity and 1 = full complementarity at the 3' end.
 *
 * A high score indicates the primer may form hairpins or primer dimers.
 *
 * @param sequence  Primer sequence (5'→3')
 * @param windowSize  Number of 3'-terminal bases to check (default: 6)
 */
export function checkSelfComplementarity(sequence: string, windowSize: number = 6): number {
  const seq = normalize(sequence);
  if (seq.length === 0) return 0;

  const w = Math.min(windowSize, seq.length);
  const tail = seq.slice(seq.length - w);

  // Check the tail against every position in the full sequence for
  // Watson-Crick complementarity. We count matching complementary bases
  // in an alignment-free sliding approach.
  const comp: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
  let maxMatches = 0;

  // Compare tail (reversed) against each window in the sequence
  for (let offset = 0; offset <= seq.length - w; offset++) {
    // Skip the tail's own position to avoid self-match
    if (offset === seq.length - w) continue;

    let matches = 0;
    for (let j = 0; j < w; j++) {
      // Compare tail[j] with seq[offset + (w-1-j)] (antiparallel)
      if (comp[tail[j]] === seq[offset + (w - 1 - j)]) {
        matches++;
      }
    }
    if (matches > maxMatches) maxMatches = matches;
  }

  return maxMatches / w;
}

/**
 * Check whether a sequence has a GC clamp (G or C at the 3' end).
 */
function hasGcClamp(sequence: string): boolean {
  if (sequence.length === 0) return false;
  const last = sequence[sequence.length - 1].toUpperCase();
  return last === "G" || last === "C";
}

/**
 * Build a Primer object for a candidate subsequence of the template.
 */
function buildPrimer(template: string, start: number, end: number, ct: number): Primer {
  const seq = template.slice(start, end);
  return {
    sequence: seq,
    tm: computeTm(seq, ct),
    gcContent: computeGC(seq),
    start,
    end,
    hasGcClamp: hasGcClamp(seq),
    selfComplementarity: checkSelfComplementarity(seq),
  };
}

/**
 * Find the best primer in a search region of the template.
 *
 * Scans primer lengths from maxLength down to minLength and returns
 * the first candidate that satisfies all thermodynamic constraints.
 * Preference is given to primers closest to the target Tm midpoint.
 *
 * @param template  Full normalized template sequence
 * @param regionStart  Start of the search region (inclusive)
 * @param regionEnd  End of the search region (exclusive)
 * @param opts  Merged design options
 * @returns  Best primer found, or null if none pass constraints
 */
function findBestPrimer(
  template: string,
  regionStart: number,
  regionEnd: number,
  opts: Required<PrimerDesignOptions>,
): Primer | null {
  const targetTm = (opts.minTm + opts.maxTm) / 2;
  let best: Primer | null = null;
  let bestScore = Infinity;

  for (let len = opts.maxLength; len >= opts.minLength; len--) {
    // Slide the primer window across the search region
    for (let start = regionStart; start + len <= regionEnd; start++) {
      const end = start + len;
      const primer = buildPrimer(template, start, end, opts.strandConcentration);

      // Tm constraint
      if (primer.tm < opts.minTm || primer.tm > opts.maxTm) continue;

      // GC clamp constraint
      if (opts.requireGcClamp && !primer.hasGcClamp) continue;

      // Self-complementarity constraint
      if (primer.selfComplementarity > opts.maxSelfComplementarity) continue;

      // Score: distance from target Tm (prefer middle of range)
      const score = Math.abs(primer.tm - targetTm);
      if (score < bestScore) {
        bestScore = score;
        best = primer;
      }
    }
  }

  return best;
}

// ── Exported Functions ─────────────────────────────────────────────────────────

/**
 * Calculate the melting temperature of a DNA oligonucleotide.
 *
 * Delegates to the SantaLucia nearest-neighbor model in sequenceAnalysis.
 * Exposed here for convenience so consumers of primerDesigner do not need
 * a separate import.
 *
 * @param sequence  DNA sequence (case-insensitive)
 * @param ct  Total strand concentration in M (default 250 nM)
 * @returns  Tm in degrees Celsius
 */
export function calculateTm(sequence: string, ct: number = 250e-9): number {
  return computeTm(sequence, ct);
}

/**
 * Design PCR primer pairs for a given template DNA sequence.
 *
 * The algorithm:
 *   1. Searches the first `searchFraction` of the template for a forward
 *      primer (reading 5'→3' on the sense strand).
 *   2. Searches the last `searchFraction` of the template for a reverse
 *      primer (reading 5'→3' on the antisense strand, i.e. reverse
 *      complement of the 3' end).
 *   3. Picks the candidate in each region that best satisfies Tm, GC clamp,
 *      and self-complementarity constraints.
 *   4. Returns up to `maxPairs` primer pairs, sorted by |Tm difference|.
 *
 * @param template  Template DNA sequence (case-insensitive)
 * @param options   Design constraints (all optional; sensible defaults)
 * @returns  Array of PrimerPair objects sorted by ascending tmDiff
 */
export async function designPrimers(template: string, options?: PrimerDesignOptions): Promise<PrimerPair[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const seq = normalize(template);

  if (seq.length < opts.minLength * 2 + 50) {
    return [];
  }

  // Search the first 40% of the template for the forward primer
  const fwdRegionEnd = Math.floor(seq.length * 0.4);
  const fwd = findBestPrimer(seq, 0, fwdRegionEnd, opts);

  // Search the last 40% of the template for the reverse primer
  const revRegionStart = Math.floor(seq.length * 0.6);
  // We work on the reverse complement of the 3' region
  const revRegion = reverseComplement(seq.slice(revRegionStart));
  const rev = findBestPrimer(revRegion, 0, revRegion.length, opts);

  if (!fwd || !rev) {
    return [];
  }

  // Map the reverse primer back to template coordinates
  // rev.start/end are positions on the reverse-complement subsequence,
  // which corresponds to template positions from the 3' end.
  const revTemplateStart = seq.length - rev.end;
  const revTemplateEnd = seq.length - rev.start;

  const reversePrimer: Primer = {
    ...rev,
    start: revTemplateStart,
    end: revTemplateEnd,
    sequence: reverseComplement(rev.sequence),
    // Recompute Tm for the actual reverse primer sequence on the template
    tm: computeTm(reverseComplement(rev.sequence), opts.strandConcentration),
    gcContent: computeGC(reverseComplement(rev.sequence)),
    hasGcClamp: hasGcClamp(reverseComplement(rev.sequence)),
    selfComplementarity: checkSelfComplementarity(reverseComplement(rev.sequence)),
  };

  const productSize = reversePrimer.end - fwd.start;
  const tmDiff = Math.abs(fwd.tm - reversePrimer.tm);

  const pair: PrimerPair = {
    forward: fwd,
    reverse: reversePrimer,
    productSize,
    tmDiff: Math.round(tmDiff * 100) / 100,
  };

  // If tmDiff exceeds maxTmDiff, try alternative reverse primers
  if (tmDiff <= opts.maxTmDiff) {
    return [pair];
  }

  // Attempt to find a better-matched reverse primer by widening search
  const candidates: PrimerPair[] = [pair];

  for (let len = opts.minLength; len <= opts.maxLength; len++) {
    for (let start = 0; start + len <= revRegion.length; start++) {
      const rcSeq = revRegion.slice(start, start + len);
      const rcTm = computeTm(rcSeq, opts.strandConcentration);
      const actualSeq = reverseComplement(rcSeq);

      if (rcTm < opts.minTm || rcTm > opts.maxTm) continue;
      if (opts.requireGcClamp && !hasGcClamp(actualSeq)) continue;
      if (checkSelfComplementarity(actualSeq) > opts.maxSelfComplementarity) continue;

      const altTmDiff = Math.abs(fwd.tm - rcTm);
      if (altTmDiff < pair.tmDiff) {
        const altRevTemplateStart = seq.length - (revRegionStart + start + len);
        const altRevTemplateEnd = seq.length - (revRegionStart + start);

        const altReverse: Primer = {
          sequence: actualSeq,
          tm: rcTm,
          gcContent: computeGC(actualSeq),
          start: altRevTemplateStart,
          end: altRevTemplateEnd,
          hasGcClamp: hasGcClamp(actualSeq),
          selfComplementarity: checkSelfComplementarity(actualSeq),
        };

        candidates.push({
          forward: fwd,
          reverse: altReverse,
          productSize: altReverse.end - fwd.start,
          tmDiff: Math.round(altTmDiff * 100) / 100,
        });
      }
    }
  }

  // Sort by tmDiff and deduplicate (keep best per product size)
  candidates.sort((a, b) => a.tmDiff - b.tmDiff);

  return candidates.slice(0, 3);
}
