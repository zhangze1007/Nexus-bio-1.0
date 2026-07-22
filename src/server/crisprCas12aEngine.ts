/**
 * Cas12a (Cpf1) CRISPR Engine
 *
 * Extends the CRISPR toolbox beyond SpCas9 to include Cas12a (Cpf1),
 * which offers several advantages:
 *   - TTTV PAM (5' of protospacer, not 3')
 *   - Staggered cuts (5' overhangs)
 *   - No tracrRNA required (simpler gRNA)
 *   - Lower off-target rates
 *   - Better for AT-rich genomes
 *
 * Also supports other Cas variants:
 *   - Cas12b (AapCas12b, BcaCas12b) — TTN PAM
 *   - Cas12e (CasX) — TTCN PAM
 *   - Cas13 — RNA targeting (no PAM)
 *
 * References:
 *   - Zetsche et al. (2015) Cell 163:759-771 (Cas12a/Cpf1)
 *   - Teng et al. (2018) Cell 175:1582-1594 (Cas12b)
 *   - Liu et al. (2019) Nature 572:156-160 (CasX)
 *   - Abudayyeh et al. (2017) Nature 550:280-284 (Cas13)
 *
 * @scientific_provenance
 *   ALGORITHM: PAM scanning, gRNA design, efficiency prediction
 *   REFERENCE: Zetsche et al. (2015) Cell 163:759-771
 */

// ── Types ──────────────────────────────────────────────────────────────

export type CasVariant = "SpCas9" | "SaCas9" | "Cas12a" | "Cas12b" | "Cas12e" | "Cas13a" | "Cas13b";

export interface PAMSpec {
  /** Cas variant name */
  variant: CasVariant;
  /** PAM pattern (IUPAC nucleotide codes) */
  pattern: string;
  /** PAM position relative to protospacer ('5prime' or '3prime') */
  position: "5prime" | "3prime";
  /** PAM length in nucleotides */
  length: number;
  /** Protospacer length in nucleotides */
  spacerLength: number;
  /** Cut type */
  cutType: "blunt" | "staggered_5prime" | "staggered_3prime";
  /** Cut offset from PAM (in bp) */
  cutOffset: number;
}

export interface Cas12aGuideRNA {
  /** Target sequence (protospacer) */
  spacer: string;
  /** PAM sequence */
  pam: string;
  /** PAM position in the target sequence */
  pamPosition: number;
  /** Strand (forward or reverse) */
  strand: "+" | "-";
  /** Predicted on-target efficiency (0-1) */
  efficiency: number;
  /** GC content of spacer */
  gcContent: number;
  /** Poly-T count (4+ consecutive T's terminate transcription) */
  polyTCount: number;
  /** Self-complementarity score */
  selfComplementarity: number;
}

export interface Cas12aDesignResult {
  /** Gene ID */
  geneId: string;
  /** Target region */
  targetRegion: { start: number; end: number; strand: "+" | "-" };
  /** Designed guide RNAs */
  guides: Cas12aGuideRNA[];
  /** Best guide (highest efficiency) */
  bestGuide: Cas12aGuideRNA | null;
  /** PAM variant used */
  pamVariant: CasVariant;
  /** Design notes */
  notes: string[];
}

// ── PAM Specifications ─────────────────────────────────────────────────

export const PAM_SPECS: Record<CasVariant, PAMSpec> = {
  SpCas9: {
    variant: "SpCas9",
    pattern: "NGG",
    position: "3prime",
    length: 3,
    spacerLength: 20,
    cutType: "blunt",
    cutOffset: 3,
  },
  SaCas9: {
    variant: "SaCas9",
    pattern: "NNGRRT",
    position: "3prime",
    length: 6,
    spacerLength: 21,
    cutType: "blunt",
    cutOffset: 3,
  },
  Cas12a: {
    variant: "Cas12a",
    pattern: "TTTV",
    position: "5prime",
    length: 4,
    spacerLength: 20,
    cutType: "staggered_5prime",
    cutOffset: 18,
  },
  Cas12b: {
    variant: "Cas12b",
    pattern: "TTN",
    position: "5prime",
    length: 3,
    spacerLength: 20,
    cutType: "staggered_5prime",
    cutOffset: 18,
  },
  Cas12e: {
    variant: "Cas12e",
    pattern: "TTCN",
    position: "5prime",
    length: 4,
    spacerLength: 20,
    cutType: "staggered_5prime",
    cutOffset: 18,
  },
  Cas13a: {
    variant: "Cas13a",
    pattern: "ANY", // No PAM required for RNA targeting
    position: "5prime",
    length: 0,
    spacerLength: 28,
    cutType: "blunt",
    cutOffset: 0,
  },
  Cas13b: {
    variant: "Cas13b",
    pattern: "ANY",
    position: "5prime",
    length: 0,
    spacerLength: 30,
    cutType: "blunt",
    cutOffset: 0,
  },
};

// ── IUPAC Nucleotide Matching ──────────────────────────────────────────

const IUPAC: Record<string, string[]> = {
  A: ["A"],
  C: ["C"],
  G: ["G"],
  T: ["T"],
  R: ["A", "G"],
  Y: ["C", "T"],
  S: ["G", "C"],
  W: ["A", "T"],
  K: ["G", "T"],
  M: ["A", "C"],
  B: ["C", "G", "T"],
  D: ["A", "G", "T"],
  H: ["A", "C", "T"],
  V: ["A", "C", "G"],
  N: ["A", "C", "G", "T"],
};

function matchesIUPAC(sequence: string, pattern: string): boolean {
  if (sequence.length !== pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    const allowed = IUPAC[pattern[i].toUpperCase()];
    if (!allowed || !allowed.includes(sequence[i].toUpperCase())) {
      return false;
    }
  }
  return true;
}

// ── Guide RNA Design ───────────────────────────────────────────────────

/**
 * Design Cas12a guide RNAs for a target sequence.
 *
 * Cas12a recognizes TTTV PAM (V = A, C, or G) located 5' of the protospacer.
 * The guide RNA is 20 nt and does NOT require a tracrRNA.
 */
export function designCas12aGuides(targetSequence: string, geneId: string, maxGuides: number = 10): Cas12aDesignResult {
  const pamSpec = PAM_SPECS.Cas12a;
  const guides: Cas12aGuideRNA[] = [];
  const notes: string[] = [];

  // Scan for TTTV PAM sites on both strands
  for (const strand of ["+", "-"] as const) {
    const seq = strand === "+" ? targetSequence : reverseComplement(targetSequence);

    for (let i = 0; i <= seq.length - pamSpec.length - pamSpec.spacerLength; i++) {
      const pamSeq = seq.substring(i, i + pamSpec.length);
      const spacerSeq = seq.substring(i + pamSpec.length, i + pamSpec.length + pamSpec.spacerLength);

      // Check PAM match (TTTV = TTTA, TTTC, TTTG)
      if (!matchesIUPAC(pamSeq, pamSpec.pattern)) continue;

      // Skip if spacer contains poly-T (terminates RNA polymerase III)
      const polyTCount = countPolyT(spacerSeq);
      if (polyTCount >= 4) continue;

      // Calculate efficiency
      const efficiency = calculateCas12aEfficiency(spacerSeq, pamSeq);
      const gcContent = calculateGCContent(spacerSeq);
      const selfComp = calculateSelfComplementarity(spacerSeq);

      guides.push({
        spacer: spacerSeq,
        pam: pamSeq,
        pamPosition: strand === "+" ? i : targetSequence.length - i - pamSpec.length,
        strand,
        efficiency,
        gcContent,
        polyTCount,
        selfComplementarity: selfComp,
      });
    }
  }

  // Sort by efficiency and take top N
  guides.sort((a, b) => b.efficiency - a.efficiency);
  const topGuides = guides.slice(0, maxGuides);

  if (topGuides.length === 0) {
    notes.push("No valid Cas12a guide RNAs found. Try extending the target region.");
  }

  return {
    geneId,
    targetRegion: { start: 0, end: targetSequence.length, strand: "+" },
    guides: topGuides,
    bestGuide: topGuides[0] ?? null,
    pamVariant: "Cas12a",
    notes,
  };
}

/**
 * Design guides for any Cas variant.
 */
export function designGuidesForVariant(
  targetSequence: string,
  geneId: string,
  variant: CasVariant,
  maxGuides: number = 10,
): Cas12aDesignResult {
  if (variant === "SpCas9") {
    return designSpCas9Guides(targetSequence, geneId, maxGuides);
  }
  if (variant === "Cas12a") {
    return designCas12aGuides(targetSequence, geneId, maxGuides);
  }

  // Generic PAM scanning for other variants
  const pamSpec = PAM_SPECS[variant];
  const guides: Cas12aGuideRNA[] = [];
  const notes: string[] = [];

  for (const strand of ["+", "-"] as const) {
    const seq = strand === "+" ? targetSequence : reverseComplement(targetSequence);

    for (let i = 0; i <= seq.length - pamSpec.length - pamSpec.spacerLength; i++) {
      const pamSeq = seq.substring(i, i + pamSpec.length);
      const spacerSeq = seq.substring(i + pamSpec.length, i + pamSpec.length + pamSpec.spacerLength);

      if (pamSpec.pattern !== "ANY" && !matchesIUPAC(pamSeq, pamSpec.pattern)) continue;

      const efficiency = calculateGenericEfficiency(spacerSeq, pamSeq, variant);
      const gcContent = calculateGCContent(spacerSeq);

      guides.push({
        spacer: spacerSeq,
        pam: pamSeq,
        pamPosition: strand === "+" ? i : targetSequence.length - i - pamSpec.length,
        strand,
        efficiency,
        gcContent,
        polyTCount: countPolyT(spacerSeq),
        selfComplementarity: calculateSelfComplementarity(spacerSeq),
      });
    }
  }

  guides.sort((a, b) => b.efficiency - a.efficiency);
  const topGuides = guides.slice(0, maxGuides);

  return {
    geneId,
    targetRegion: { start: 0, end: targetSequence.length, strand: "+" },
    guides: topGuides,
    bestGuide: topGuides[0] ?? null,
    pamVariant: variant,
    notes,
  };
}

// ── SpCas9 Guide Design (for comparison) ───────────────────────────────

function designSpCas9Guides(targetSequence: string, geneId: string, maxGuides: number): Cas12aDesignResult {
  const pamSpec = PAM_SPECS.SpCas9;
  const guides: Cas12aGuideRNA[] = [];

  for (const strand of ["+", "-"] as const) {
    const seq = strand === "+" ? targetSequence : reverseComplement(targetSequence);

    for (let i = 0; i <= seq.length - pamSpec.length - pamSpec.spacerLength; i++) {
      const spacerSeq = seq.substring(i, i + pamSpec.spacerLength);
      const pamSeq = seq.substring(i + pamSpec.length, i + pamSpec.length + pamSpec.length);

      if (!matchesIUPAC(pamSeq, pamSpec.pattern)) continue;

      const efficiency = calculateSpCas9Efficiency(spacerSeq, pamSeq);
      const gcContent = calculateGCContent(spacerSeq);

      guides.push({
        spacer: spacerSeq,
        pam: pamSeq,
        pamPosition: strand === "+" ? i + pamSpec.spacerLength : targetSequence.length - i - pamSpec.spacerLength,
        strand,
        efficiency,
        gcContent,
        polyTCount: countPolyT(spacerSeq),
        selfComplementarity: calculateSelfComplementarity(spacerSeq),
      });
    }
  }

  guides.sort((a, b) => b.efficiency - a.efficiency);
  const topGuides = guides.slice(0, maxGuides);

  return {
    geneId,
    targetRegion: { start: 0, end: targetSequence.length, strand: "+" },
    guides: topGuides,
    bestGuide: topGuides[0] ?? null,
    pamVariant: "SpCas9",
    notes: [],
  };
}

// ── Efficiency Prediction ──────────────────────────────────────────────

/**
 * Calculate Cas12a on-target efficiency.
 *
 * Based on:
 *   - Kim et al. (2018) Nat Methods 15:782-788 (Cas12a specificity)
 *   - Kleinstiver et al. (2016) Nat Biotechnol 34:869-874
 *
 * Factors:
 *   - GC content (optimal: 40-60%)
 *   - Poly-T penalty (terminates Pol III)
 *   - Self-complementarity penalty
 *   - Position-specific nucleotide preferences
 */
function calculateCas12aEfficiency(spacer: string, pam: string): number {
  let score = 0.5; // Base score

  // GC content (optimal: 40-60%)
  const gc = calculateGCContent(spacer);
  if (gc >= 0.4 && gc <= 0.6) {
    score += 0.2;
  } else if (gc >= 0.3 && gc <= 0.7) {
    score += 0.1;
  } else {
    score -= 0.1;
  }

  // Poly-T penalty
  const polyT = countPolyT(spacer);
  if (polyT >= 4) {
    score -= 0.3; // Strong penalty
  } else if (polyT >= 3) {
    score -= 0.1;
  }

  // Self-complementarity
  const selfComp = calculateSelfComplementarity(spacer);
  if (selfComp > 0.5) {
    score -= 0.15;
  }

  // Position-specific preferences (Cas12a prefers T at position 1)
  if (spacer[0] === "T") score += 0.05;

  // PAM strength (TTTV > TTTN)
  if (pam === "TTTA" || pam === "TTTC" || pam === "TTTG") {
    score += 0.05;
  }

  return Math.max(0, Math.min(1, score));
}

function calculateSpCas9Efficiency(spacer: string, pam: string): number {
  let score = 0.5;

  const gc = calculateGCContent(spacer);
  if (gc >= 0.4 && gc <= 0.6) score += 0.2;
  else if (gc >= 0.3 && gc <= 0.7) score += 0.1;
  else score -= 0.1;

  // GG at PAM positions 2-3 is optimal
  if (pam[1] === "G" && pam[2] === "G") score += 0.1;

  // Self-complementarity
  if (calculateSelfComplementarity(spacer) > 0.5) score -= 0.15;

  return Math.max(0, Math.min(1, score));
}

const VARIANT_BASELINE: Record<CasVariant, number> = {
  SpCas9: 0.55,
  SaCas9: 0.5,
  Cas12a: 0.5,
  Cas12b: 0.45,
  Cas12e: 0.4,
  Cas13a: 0.35,
  Cas13b: 0.35,
};

/** PAM-quality contribution by Cas family: Cas12* favor TTTV, Cas9/Cas13 favor NGG. */
function pamQualityForVariant(pam: string, variant: CasVariant): number {
  const p = pam.toUpperCase();
  if (variant.startsWith("Cas12")) {
    if (/^TTT[ACG]$/.test(p)) return 0.15; // canonical TTTV
    if (/^TTT/.test(p)) return 0.05; // TTTT — weaker
    if (/^TT/.test(p)) return 0.0;
    return -0.1; // not T-rich — poor for Cas12
  }
  if (/GG$/.test(p)) return 0.12; // NGG optimal
  if (/AG$/.test(p)) return 0.03; // NAG weak
  return -0.08;
}

export function calculateGenericEfficiency(spacer: string, pam: string, variant: CasVariant): number {
  // Per-variant baseline cutting efficiency (enzyme-dependent).
  let score = VARIANT_BASELINE[variant] ?? 0.45;

  const gc = calculateGCContent(spacer);
  if (gc >= 0.4 && gc <= 0.6) score += 0.15;

  if (calculateSelfComplementarity(spacer) > 0.5) score -= 0.1;

  // PAM matching + enzyme-family preference (uses `pam` and `variant`).
  score += pamQualityForVariant(pam, variant);

  return Math.max(0, Math.min(1, score));
}

// ── Utility Functions ──────────────────────────────────────────────────

function reverseComplement(seq: string): string {
  const comp: Record<string, string> = { A: "T", T: "A", C: "G", G: "C", N: "N" };
  return seq
    .split("")
    .reverse()
    .map((b) => comp[b.toUpperCase()] ?? "N")
    .join("");
}

function calculateGCContent(seq: string): number {
  const gc = (seq.match(/[GC]/gi) ?? []).length;
  return gc / seq.length;
}

function countPolyT(seq: string): number {
  let maxRun = 0;
  let currentRun = 0;
  for (const b of seq) {
    if (b === "T" || b === "t") {
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 0;
    }
  }
  return maxRun;
}

function calculateSelfComplementarity(seq: string): number {
  // Simplified: check for palindromic sequences
  const rc = reverseComplement(seq);
  let matches = 0;
  for (let i = 0; i < seq.length - 3; i++) {
    const subseq = seq.substring(i, i + 4);
    if (rc.includes(subseq)) matches++;
  }
  return matches / (seq.length - 3);
}

// ── Display Helpers ────────────────────────────────────────────────────

export function getCasVariantInfo(variant: CasVariant): {
  name: string;
  pam: string;
  description: string;
  advantages: string[];
  applications: string[];
} {
  const info: Record<
    CasVariant,
    { name: string; pam: string; description: string; advantages: string[]; applications: string[] }
  > = {
    SpCas9: {
      name: "SpCas9",
      pam: "NGG",
      description: "Streptococcus pyogenes Cas9 — the most widely used CRISPR nuclease",
      advantages: ["Well-characterized", "High efficiency", "Many variants available"],
      applications: ["Gene knockout", "HDR knock-in", "CRISPRi/CRISPRa"],
    },
    SaCas9: {
      name: "SaCas9",
      pam: "NNGRRT",
      description: "Staphylococcus aureus Cas9 — smaller size for AAV delivery",
      advantages: ["Smaller (1053 aa vs 1368 aa)", "Fits in single AAV"],
      applications: ["In vivo gene therapy", "AAV-delivered editing"],
    },
    Cas12a: {
      name: "Cas12a (Cpf1)",
      pam: "TTTV",
      description: "Acidaminococcus sp. Cas12a — recognizes T-rich PAMs",
      advantages: ["No tracrRNA needed", "Staggered cuts", "Lower off-targets", "AT-rich targeting"],
      applications: ["Multiplex editing", "Diagnostic detection", "Plant genome editing"],
    },
    Cas12b: {
      name: "Cas12b",
      pam: "TTN",
      description: "Cas12b from Alicyclobacillus — thermostable variant",
      advantages: ["Thermostable", "Active at 37-65°C"],
      applications: ["Diagnostics", "High-temperature applications"],
    },
    Cas12e: {
      name: "Cas12e (CasX)",
      pam: "TTCN",
      description: "Compact Cas12e from Deltaproteobacteria",
      advantages: ["Smaller than Cas9", "Distinct evolutionary origin"],
      applications: ["Genome editing", "Diagnostics"],
    },
    Cas13a: {
      name: "Cas13a",
      pam: "ANY",
      description: "RNA-targeting CRISPR — no PAM required",
      advantages: ["RNA targeting", "No DNA damage", "Programmable"],
      applications: ["RNA knockdown", "SARS-CoV-2 detection (SHERLOCK)", "RNA editing"],
    },
    Cas13b: {
      name: "Cas13b",
      pam: "ANY",
      description: "RNA-targeting CRISPR with enhanced activity",
      advantages: ["Higher activity than Cas13a", "RNA targeting"],
      applications: ["RNA knockdown", "RNA editing", "Diagnostics"],
    },
  };
  return info[variant];
}
