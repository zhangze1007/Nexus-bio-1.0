/**
 * Codon Optimization Engine
 *
 * Selects optimal codons for a target organism based on codon usage frequency,
 * optionally avoiding restriction enzyme recognition sites and tuning GC content.
 * Computes the Codon Adaptation Index (CAI) as a measure of expression likelihood.
 *
 * The algorithm proceeds in three phases: (1) greedy codon selection by descending
 * frequency while avoiding forbidden restriction sites, (2) GC-content refinement
 * via synonymous codon swaps, and (3) CAI computation as the geometric mean of
 * relative adaptiveness values across all codons.
 *
 * @scientific_provenance
 *   ALGORITHM: Codon Adaptation Index (CAI) with greedy frequency-based selection
 *     and iterative GC-content refinement via synonymous codon substitution.
 *   REFERENCE: Sharp PM, Li WH. "The Codon Adaptation Index — a measure of
 *     directional synonymous codon usage bias, and its potential applications."
 *     Nucleic Acids Res. 1987;15(3):1281-1295.
 *   KNOWN_LIMITATIONS:
 *     - CAI is a codon-level proxy and does not account for mRNA secondary
 *       structure, which significantly affects translation efficiency.
 *     - Restriction-site avoidance is greedy and may not find the global optimum
 *       when many sites must be removed simultaneously.
 *     - GC refinement is a local search; it can get stuck at local optima and
 *       may not reach the target GC range for highly constrained sequences.
 *     - Uses static codon usage tables; does not adapt to gene-specific context
 *       or operon position effects.
 */

import codonTables from "../data/codonUsageTables.json";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Organism = "ecoli" | "scerevisiae" | "human" | "mouse" | "arabidopsis";

export interface CodonOptimizationConfig {
  /** Target organism for codon usage optimization. */
  organism: Organism;
  /** Restriction enzyme recognition sites (DNA strings) to remove from the output. */
  avoidSites?: string[];
  /** GC-content target range as [min, max] fractions. Defaults to [0.4, 0.6]. */
  gcTarget?: [number, number];
}

export interface CodonOptimizationResult {
  /** Optimized DNA sequence (5'→3'). */
  dnaSequence: string;
  /** Codon Adaptation Index — geometric mean of relative adaptiveness values (0–1). */
  cai: number;
  /** GC content of the output sequence as a fraction. */
  gcContent: number;
  /** Restriction sites from `avoidSites` that were found after optimization (should be empty). */
  restrictionSitesFound: string[];
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type CodonUsageTable = Record<string, [string, number][]>;

/** Load the codon usage table for the given organism. */
function loadTable(organism: Organism): CodonUsageTable {
  return (codonTables as unknown as Record<string, CodonUsageTable>)[organism];
}

/** Compute GC fraction of a DNA string. */
function gcFraction(dna: string): number {
  if (dna.length === 0) return 0;
  let gc = 0;
  for (let i = 0; i < dna.length; i++) {
    const ch = dna[i];
    if (ch === "G" || ch === "C" || ch === "g" || ch === "c") gc++;
  }
  return gc / dna.length;
}

/** Check whether any of the given restriction sites appear in the DNA. */
function findRestrictionSites(dna: string, sites: string[]): string[] {
  const upper = dna.toUpperCase();
  return sites.filter((site) => upper.includes(site.toUpperCase()));
}

/**
 * Build a relative-adaptiveness (w) lookup for each codon.
 * For each amino acid, w = freq / maxFreq among synonymous codons.
 */
function buildRelativeAdaptiveness(table: CodonUsageTable): Map<string, number> {
  const w = new Map<string, number>();
  for (const aminoAcid of Object.keys(table)) {
    const codons = table[aminoAcid];
    const maxFreq = Math.max(...codons.map((c) => c[1]));
    for (const [codon, freq] of codons) {
      w.set(codon.toUpperCase(), maxFreq > 0 ? freq / maxFreq : 0);
    }
  }
  return w;
}

/**
 * Select the best codon for an amino acid, optionally skipping codons that
 * would introduce a forbidden restriction site.
 */
function selectCodon(
  aminoAcid: string,
  table: CodonUsageTable,
  avoidUpper: string[],
  currentDnaContext: string,
): string | null {
  const codons = table[aminoAcid];
  if (!codons || codons.length === 0) return null;

  // Sort by descending frequency (stable — original order on ties)
  const sorted = [...codons].sort((a, b) => b[1] - a[1]);

  for (const [codon] of sorted) {
    const candidate = currentDnaContext + codon.toUpperCase();
    const hasSite = avoidUpper.some((site) => candidate.toUpperCase().includes(site));
    if (!hasSite) return codon.toUpperCase();
  }

  // Fallback: return the most frequent codon even if it introduces a site
  // (caller will report it in restrictionSitesFound)
  return sorted[0][0].toUpperCase();
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Optimize a protein sequence for expression in the target organism.
 *
 * @param aminoAcidSequence - One-letter amino acid codes (e.g. "MKTAYIAKQR").
 * @param config - Optimization parameters.
 * @returns The optimized DNA sequence along with quality metrics.
 */
export function optimizeCodons(aminoAcidSequence: string, config: CodonOptimizationConfig): CodonOptimizationResult {
  const { organism, avoidSites = [], gcTarget = [0.4, 0.6] } = config;
  const table = loadTable(organism);
  const wMap = buildRelativeAdaptiveness(table);
  const avoidUpper = avoidSites.map((s) => s.toUpperCase());

  // --- Phase 1: select codons, avoiding restriction sites ---
  let dna = "";
  const codonChoices: string[] = [];

  for (let i = 0; i < aminoAcidSequence.length; i++) {
    const aa = aminoAcidSequence[i].toUpperCase();
    const codon = selectCodon(aa, table, avoidUpper, dna);
    if (!codon) {
      throw new Error(`No codon mapping found for amino acid "${aa}" in organism "${organism}".`);
    }
    codonChoices.push(codon);
    dna += codon;
  }

  // --- Phase 2: GC-content refinement ---
  // Swap synonymous codons at the end of the sequence to push GC toward target.
  let gc = gcFraction(dna);
  const maxPasses = codonChoices.length * 2;
  let pass = 0;

  while ((gc < gcTarget[0] || gc > gcTarget[1]) && pass < maxPasses) {
    const needMoreGC = gc < gcTarget[0];

    // Find a swappable position (scan from the end)
    let swapped = false;
    for (let i = codonChoices.length - 1; i >= 0; i--) {
      const aa = aminoAcidSequence[i].toUpperCase();
      const codons = table[aa];
      if (!codons || codons.length < 2) continue;

      const current = codonChoices[i];
      const currentGC = gcFraction(current);

      // Try to find a synonymous codon with better GC
      const alternatives = [...codons].sort((a, b) => b[1] - a[1]).map((c) => c[0].toUpperCase());

      for (const alt of alternatives) {
        if (alt === current) continue;
        const altGC = gcFraction(alt);
        if (needMoreGC ? altGC > currentGC : altGC < currentGC) {
          // Check restriction sites with the swap
          const newDna = dna.slice(0, i * 3) + alt + dna.slice((i + 1) * 3);
          if (findRestrictionSites(newDna, avoidUpper).length === 0) {
            codonChoices[i] = alt;
            dna = newDna;
            gc = gcFraction(dna);
            swapped = true;
            break;
          }
        }
      }
      if (swapped) break;
    }
    if (!swapped) break;
    pass++;
  }

  // --- Phase 3: compute CAI ---
  // CAI = (∏ w_i)^(1/L) — geometric mean of relative adaptiveness for each codon.
  let logSum = 0;
  let effectiveLength = 0;
  for (const codon of codonChoices) {
    const wi = wMap.get(codon) ?? 0;
    if (wi > 0) {
      logSum += Math.log(wi);
      effectiveLength++;
    }
  }
  const cai = effectiveLength > 0 ? Math.exp(logSum / effectiveLength) : 0;

  // --- Phase 4: final restriction-site check ---
  const sitesFound = findRestrictionSites(dna, avoidUpper);

  return {
    dnaSequence: dna,
    cai: Math.round(cai * 10000) / 10000,
    gcContent: Math.round(gcFraction(dna) * 10000) / 10000,
    restrictionSitesFound: sitesFound,
  };
}

/**
 * Compute Codon Adaptation Index (CAI) for an existing DNA sequence.
 *
 * CAI measures how well a sequence uses codons preferred by the host organism.
 * CAI = 1.0 means all codons are the most preferred; CAI → 0 means many rare codons.
 *
 * Reference: Sharp & Li (1987) Nucleic Acids Res 15:1281-1295
 *
 * @param dnaSequence  DNA sequence (must be multiple of 3)
 * @param organism     Target organism
 * @returns CAI value (0–1)
 */
export function computeCAI(dnaSequence: string, organism: Organism = "ecoli"): number {
  const table = loadTable(organism);
  const wMap = buildRelativeAdaptiveness(table);
  const upper = dnaSequence.toUpperCase().replace(/[^ACGT]/g, "");

  let logSum = 0;
  let count = 0;

  for (let i = 0; i < upper.length - 2; i += 3) {
    const codon = upper.substring(i, i + 3);
    const wi = wMap.get(codon) ?? 0;
    if (wi > 0) {
      logSum += Math.log(wi);
      count++;
    }
  }

  return count > 0 ? Math.round(Math.exp(logSum / count) * 10000) / 10000 : 0;
}

/**
 * Back-translate an amino acid sequence to DNA using the most common codons.
 *
 * @param aaSequence  Amino acid sequence (one-letter codes)
 * @param organism    Target organism for codon selection
 * @returns DNA sequence using the most frequently used codons
 */
export function backTranslate(aaSequence: string, organism: Organism = "ecoli"): string {
  const table = loadTable(organism);
  let dna = "";

  for (const aa of aaSequence.toUpperCase()) {
    const codons = table[aa];
    if (!codons || codons.length === 0) {
      dna += "NNN";
      continue;
    }
    // Select the most frequent codon
    const sorted = [...codons].sort((a, b) => b[1] - a[1]);
    dna += sorted[0][0].toUpperCase();
  }

  return dna;
}
