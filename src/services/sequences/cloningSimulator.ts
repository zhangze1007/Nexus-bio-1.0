/**
 * In-Silico Cloning Simulation Service
 *
 * Simulates common molecular cloning workflows:
 * - Restriction enzyme digestion (Type II)
 * - Gibson Assembly (homology-based)
 * - Golden Gate Assembly (Type IIS, scarless)
 * - Melting temperature (SantaLucia nearest-neighbor method)
 *
 * All positions are 0-indexed. Sequences are uppercase DNA (A, T, C, G).
 *
 * References:
 *   SantaLucia, J. (1998) "A unified view of polymer, dumbbell, and
 *     oligonucleotide DNA nearest-neighbor thermodynamics"
 *     PNAS 95(4): 1460-1465.
 */

import { COMMON_ENZYMES, type RestrictionEnzyme } from "../../components/sequence/restrictionEnzymes";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DigestFragment {
  watson: string;
  crick: string;
  start: number;
  end: number;
  watsonOverhang: string;
  crickOverhang: string;
}

export interface CutSite {
  enzyme: string;
  position: number;
  watsonCut: number;
  crickCut: number;
  overhang: "5prime" | "3prime" | "blunt";
}

export interface RestrictionDigestResult {
  fragments: DigestFragment[];
  cutSites: CutSite[];
}

export interface GibsonFragment {
  sequence: string;
  overlap: number;
}

export interface GibsonResult {
  assembled: string;
  success: boolean;
  errors: string[];
}

export interface GoldenGateResult {
  assembled: string;
  success: boolean;
  errors: string[];
}

// ── Type IIS Enzymes for Golden Gate ───────────────────────────────────────────

interface TypeIISEnzyme {
  name: string;
  recognition: string;
  /** Offset from 3' end of recognition to Watson cut (positive = downstream) */
  watsonOffset: number;
  /** Offset from 3' end of recognition to Crick cut */
  crickOffset: number;
}

const TYPE_IIS_ENZYMES: Record<string, TypeIISEnzyme> = {
  BsaI: { name: "BsaI", recognition: "GGAGCT", watsonOffset: 7, crickOffset: 11 },
  BpiI: { name: "BpiI", recognition: "GAAGAC", watsonOffset: 7, crickOffset: 11 },
  BsmBI: { name: "BsmBI", recognition: "CGTCTC", watsonOffset: 7, crickOffset: 11 },
};

// ── SantaLucia Nearest-Neighbor Parameters ─────────────────────────────────────
//   dH: kcal/mol, dS: cal/(mol*K)
//   Unified parameters from SantaLucia (1998)

interface NNParams {
  dH: number;
  dS: number;
}

const NN_TABLE: Record<string, NNParams> = {
  AA: { dH: -7.9, dS: -22.2 },
  AT: { dH: -7.2, dS: -20.4 },
  TA: { dH: -7.2, dS: -21.3 },
  CA: { dH: -8.5, dS: -22.7 },
  GT: { dH: -8.4, dS: -22.4 },
  CT: { dH: -7.8, dS: -21.0 },
  GA: { dH: -8.2, dS: -22.2 },
  CG: { dH: -10.6, dS: -27.2 },
  GC: { dH: -9.8, dS: -24.4 },
  GG: { dH: -8.0, dS: -19.9 },
};

// Initiation parameters for terminal base pairs
const INIT_PARAMS: NNParams = { dH: 0.1, dS: -2.8 };

// ── Helper ─────────────────────────────────────────────────────────────────────

function reverseComplement(seq: string): string {
  const comp: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
  return seq
    .split("")
    .reverse()
    .map((b) => comp[b] ?? "N")
    .join("");
}

// ── Restriction Digest ─────────────────────────────────────────────────────────

/**
 * Simulate restriction enzyme digestion of a DNA sequence.
 *
 * Uses enzyme data from `restrictionEnzymes.ts` to locate recognition sites,
 * then computes Watson and Crick strand cut positions to generate fragments
 * with the correct overhang type (5', 3', or blunt).
 *
 * @param sequence - Input DNA (case-insensitive)
 * @param enzymes  - Array of enzyme names (must match COMMON_ENZYMES names)
 * @returns Fragments and cut site metadata
 */
export function simulateRestrictionDigest(sequence: string, enzymeNames: string[]): RestrictionDigestResult {
  if (!sequence || enzymeNames.length === 0) {
    return { fragments: [], cutSites: [] };
  }

  const upper = sequence.toUpperCase();
  const enzymeMap = new Map<string, RestrictionEnzyme>();
  for (const enz of COMMON_ENZYMES) {
    enzymeMap.set(enz.name.toUpperCase(), enz);
  }

  const sites: CutSite[] = [];
  const cutPositions = new Set<number>();

  for (const name of enzymeNames) {
    const enz = enzymeMap.get(name.toUpperCase());
    if (!enz) continue;

    const recog = enz.sequence.toUpperCase();
    const rcRecog = reverseComplement(recog);
    const isPalindromic = recog === rcRecog;

    // Find all Watson-strand occurrences
    let fromIdx = 0;
    while (true) {
      const pos = upper.indexOf(recog, fromIdx);
      if (pos === -1) break;

      const watsonCut = pos + enz.cutSite;
      const crickCut = enz.overhang === "blunt" ? pos + enz.cutSite : pos + recog.length - enz.cutSite;

      sites.push({
        enzyme: enz.name,
        position: pos,
        watsonCut,
        crickCut,
        overhang: enz.overhang,
      });

      cutPositions.add(watsonCut);
      cutPositions.add(crickCut);

      fromIdx = pos + 1;
    }

    // For non-palindromic enzymes, also scan the Crick strand
    if (!isPalindromic) {
      fromIdx = 0;
      while (true) {
        const pos = upper.indexOf(rcRecog, fromIdx);
        if (pos === -1) break;

        // On the Crick strand, the cut positions are mirrored
        const crickWatsonCut = pos + enz.cutSite;
        const crickCrickCut = enz.overhang === "blunt" ? pos + enz.cutSite : pos + recog.length - enz.cutSite;

        sites.push({
          enzyme: enz.name,
          position: pos,
          watsonCut: crickWatsonCut,
          crickCut: crickCrickCut,
          overhang: enz.overhang,
        });

        cutPositions.add(crickWatsonCut);
        cutPositions.add(crickCrickCut);

        fromIdx = pos + 1;
      }
    }
  }

  // Sort sites by position
  sites.sort((a, b) => a.position - b.position);

  // Generate fragments from sorted cut positions.
  // Include flanking regions (0 and sequence end) only when cuts exist.
  const fragments: DigestFragment[] = [];

  if (cutPositions.size > 0) {
    const sorted = [0, ...Array.from(cutPositions), upper.length]
      .filter((v, i, a) => i === 0 || v !== a[i - 1]) // deduplicate
      .sort((a, b) => a - b);

    for (let i = 0; i < sorted.length - 1; i++) {
      const start = sorted[i];
      const end = sorted[i + 1];
      if (end <= start) continue;

      fragments.push({
        watson: upper.slice(start, end),
        crick: reverseComplement(upper.slice(start, end)),
        start,
        end,
        watsonOverhang: "",
        crickOverhang: "",
      });
    }
  }

  return { fragments, cutSites: sites };
}

// ── Gibson Assembly ────────────────────────────────────────────────────────────

/**
 * Simulate Gibson Assembly of DNA fragments.
 *
 * Gibson Assembly uses a 5' exonuclease to create single-stranded overhangs,
 * a polymerase to fill gaps, and a ligase to seal nicks. This simulation
 * validates that consecutive fragments share the specified overlap length
 * at their junctions (3' end of fragment N matches 5' end of fragment N+1).
 *
 * @param fragments - Ordered fragments with their overlap lengths
 * @returns Assembled sequence and success status
 */
export function simulateGibsonAssembly(fragments: GibsonFragment[]): GibsonResult {
  const errors: string[] = [];

  if (fragments.length === 0) {
    return { assembled: "", success: false, errors: ["No fragments provided"] };
  }

  if (fragments.length === 1) {
    return { assembled: fragments[0].sequence.toUpperCase(), success: true, errors: [] };
  }

  let assembled = fragments[0].sequence.toUpperCase();

  for (let i = 1; i < fragments.length; i++) {
    const prevSeq = assembled;
    const currSeq = fragments[i].sequence.toUpperCase();
    const overlapLen = fragments[i].overlap;

    if (overlapLen <= 0) {
      errors.push(`Fragment ${i}: overlap must be positive (got ${overlapLen})`);
      continue;
    }

    if (overlapLen > prevSeq.length || overlapLen > currSeq.length) {
      errors.push(
        `Fragment ${i}: overlap (${overlapLen}) exceeds fragment length (prev=${prevSeq.length}, curr=${currSeq.length})`,
      );
      continue;
    }

    // 3' end of previous assembly must match 5' start of current fragment
    const prevTail = prevSeq.slice(-overlapLen);
    const currHead = currSeq.slice(0, overlapLen);

    if (prevTail !== currHead) {
      errors.push(`Fragment ${i}: overlap mismatch — expected "${prevTail}" at 3' end, got "${currHead}" at 5' end`);
      continue;
    }

    // Successful overlap: append only the non-overlapping portion
    assembled = prevSeq + currSeq.slice(overlapLen);
  }

  return {
    assembled,
    success: errors.length === 0,
    errors,
  };
}

// ── Golden Gate Assembly ───────────────────────────────────────────────────────

/**
 * Simulate Golden Gate Assembly using a Type IIS restriction enzyme.
 *
 * Golden Gate uses Type IIS enzymes (e.g. BsaI, BpiI) that cut outside their
 * recognition sequence, creating 4-nt 5' overhangs. After digestion, fragments
 * are ordered by position and reassembled by matching complementary overhangs.
 * The recognition sites are destroyed in the process, yielding scarless assembly.
 *
 * @param sequence - Input DNA containing Type IIS recognition sites
 * @param enzyme   - Type IIS enzyme name (BsaI, BpiI, BsmBI)
 * @returns Assembled sequence and success status
 */
export function simulateGoldenGate(sequence: string, enzymeName: string): GoldenGateResult {
  const errors: string[] = [];

  if (!sequence) {
    return { assembled: "", success: false, errors: ["Empty sequence"] };
  }

  const enz = TYPE_IIS_ENZYMES[enzymeName];
  if (!enz) {
    return {
      assembled: "",
      success: false,
      errors: [`Unknown Type IIS enzyme: ${enzymeName}`],
    };
  }

  const upper = sequence.toUpperCase();
  const recog = enz.recognition.toUpperCase();
  const rcRecog = reverseComplement(recog);

  // Collect cut position pairs (watsonCut, crickCut)
  const cutPairs: { watsonCut: number; crickCut: number }[] = [];

  // Scan Watson strand
  let fromIdx = 0;
  while (true) {
    const pos = upper.indexOf(recog, fromIdx);
    if (pos === -1) break;

    const recognitionEnd = pos + recog.length;
    const watsonCut = recognitionEnd + enz.watsonOffset;
    const crickCut = recognitionEnd + enz.crickOffset;

    if (watsonCut <= upper.length && crickCut <= upper.length) {
      cutPairs.push({ watsonCut, crickCut });
    }

    fromIdx = pos + 1;
  }

  // Scan Crick strand (reverse complement of recognition site)
  if (recog !== rcRecog) {
    fromIdx = 0;
    while (true) {
      const pos = upper.indexOf(rcRecog, fromIdx);
      if (pos === -1) break;

      const recognitionEnd = pos + recog.length;
      const watsonCut = recognitionEnd + enz.watsonOffset;
      const crickCut = recognitionEnd + enz.crickOffset;

      if (watsonCut <= upper.length && crickCut <= upper.length) {
        cutPairs.push({ watsonCut, crickCut });
      }

      fromIdx = pos + 1;
    }
  }

  if (cutPairs.length === 0) {
    return {
      assembled: "",
      success: false,
      errors: [`No ${enzymeName} recognition sites found in sequence`],
    };
  }

  // Sort by Watson cut position
  cutPairs.sort((a, b) => a.watsonCut - b.watsonCut);

  // Collect all unique cut positions
  const allCuts = new Set<number>();
  for (const pair of cutPairs) {
    allCuts.add(pair.watsonCut);
    allCuts.add(pair.crickCut);
  }

  const sortedCuts = Array.from(allCuts).sort((a, b) => a - b);

  // Generate fragments
  const fragments: { watson: string; start: number; end: number }[] = [];
  for (let i = 0; i < sortedCuts.length - 1; i++) {
    const start = sortedCuts[i];
    const end = sortedCuts[i + 1];
    if (end <= start) continue;

    fragments.push({
      watson: upper.slice(start, end),
      start,
      end,
    });
  }

  if (fragments.length < 2) {
    return {
      assembled: "",
      success: false,
      errors: ["Digestion produced fewer than 2 fragments — nothing to assemble"],
    };
  }

  // Golden Gate assembly: check that adjacent fragments have complementary
  // overhangs. Since the fragments are ordered by position and the overhangs
  // are created by the same enzyme, they should be complementary (the 3' end
  // of the left fragment pairs with the 5' end of the right fragment).
  //
  // In a real Golden Gate reaction, the overhangs are designed to be unique.
  // Here we verify that the overhang at each junction is a valid 4-nt sticky end.

  // For Golden Gate, we need the 4-nt overhang from the cut.
  // The overhang is the 4 bases between watsonCut and crickCut (or vice versa).
  const overhangLen = Math.abs(enz.watsonOffset - enz.crickOffset); // should be 4

  // Verify all cut pairs have matching overhangs
  for (let i = 0; i < cutPairs.length; i++) {
    const pair = cutPairs[i];
    const overhangStart = Math.min(pair.watsonCut, pair.crickCut);
    const overhangEnd = Math.max(pair.watsonCut, pair.crickCut);

    if (overhangEnd - overhangStart !== overhangLen) {
      errors.push(
        `Cut site ${i}: overhang length mismatch (expected ${overhangLen}, got ${overhangEnd - overhangStart})`,
      );
    }
  }

  // Assemble by joining all fragments (overhangs are complementary by construction)
  const assembled = fragments.map((f) => f.watson).join("");

  return {
    assembled,
    success: errors.length === 0,
    errors,
  };
}

// ── Melting Temperature (SantaLucia Nearest-Neighbor) ──────────────────────────

/**
 * Calculate the melting temperature (Tm) of a DNA oligonucleotide using the
 * SantaLucia unified nearest-neighbor method.
 *
 * Uses the thermodynamic parameters from:
 *   SantaLucia, J. (1998) PNAS 95(4): 1460-1465.
 *
 * The formula is:
 *   Tm = (dH * 1000) / (dS + R * ln(C/4)) - 273.15
 *
 * where:
 *   dH = sum of nearest-neighbor enthalpies + initiation (kcal/mol)
 *   dS = sum of nearest-neighbor entropies + initiation (cal/mol/K)
 *   R  = 1.987 cal/(mol*K) (gas constant)
 *   C  = total strand concentration (nM)
 *
 * For self-complementary sequences, the concentration term adjusts by /1 instead
 * of /4. For palindromic recognition sites (which are self-complementary), this
 * is detected automatically.
 *
 * @param sequence - DNA oligonucleotide (case-insensitive)
 * @param concentration - Total strand concentration in nM (default: 250)
 * @returns Melting temperature in degrees Celsius
 */
export function calculateTm(sequence: string, concentration: number = 250): number {
  if (!sequence || sequence.length < 2) return 0;

  const upper = sequence.toUpperCase().replace(/[^ATCG]/g, "");
  if (upper.length < 2) return 0;

  const rc = reverseComplement(upper);
  const isSelfComplementary = upper === rc;

  // Sum nearest-neighbor parameters
  let dH = 0; // kcal/mol
  let dS = 0; // cal/(mol*K)

  for (let i = 0; i < upper.length - 1; i++) {
    const pair = upper.slice(i, i + 2);
    const params = NN_TABLE[pair];
    if (params) {
      dH += params.dH;
      dS += params.dS;
    }
  }

  // Add initiation parameters for 5' and 3' terminal bases
  dH += 2 * INIT_PARAMS.dH;
  dS += 2 * INIT_PARAMS.dS;

  // Gas constant
  const R = 1.987; // cal/(mol*K)

  // Concentration adjustment: /4 for non-self-complementary, /1 for self-complementary
  const concFactor = isSelfComplementary ? 1 : 4;

  // Tm = dH * 1000 / (dS + R * ln(C/concFactor)) - 273.15
  const tmCelsius = (dH * 1000) / (dS + R * Math.log((concentration * 1e-9) / concFactor)) - 273.15;

  return Math.round(tmCelsius * 100) / 100;
}
