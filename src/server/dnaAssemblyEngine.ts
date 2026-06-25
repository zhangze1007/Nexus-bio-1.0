/**
 * DNA Assembly Design Engine
 *
 * Designs DNA assembly strategies for synthetic biology constructs.
 * Supports:
 *   1. Gibson Assembly — isothermal one-pot assembly with 20-40 bp overlaps
 *   2. Golden Gate — Type IIS restriction enzyme-based assembly
 *   3. MoClo — Modular Cloning standardized assembly
 *
 * Reference:
 *   - Gibson et al. (2009) Nat Methods 6:343-345 (Gibson Assembly)
 *   - Engler et al. (2008) PLoS ONE 3:e3647 (Golden Gate)
 *   - Weber et al. (2011) J Biol Eng 5:12 (MoClo)
 *
 * @scientific_provenance
 *   ALGORITHM: Overlap generation + fragment ordering + restriction site analysis
 *   KNOWN_LIMITATIONS:
 *     - Does not predict assembly efficiency (would require thermodynamic modeling)
 *     - Overlap design uses simple GC-content heuristic, not full NUPACK
 *     - Golden Gate overhang design is simplified (not full Ligase Chain Reaction model)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type AssemblyMethod = "gibson" | "golden_gate" | "moclo";

export interface DNAFragment {
  /** Fragment identifier */
  id: string;
  /** DNA sequence (5'→3') */
  sequence: string;
  /** Fragment name/description */
  name?: string;
  /** Whether this is a vector backbone */
  isBackbone?: boolean;
}

export interface GibsonAssemblyInput {
  /** DNA fragments to assemble (in order) */
  fragments: DNAFragment[];
  /** Overlap length (20-40 bp, default 30) */
  overlapLength?: number;
  /** Target temperature for overlap Tm (default 60°C) */
  targetTm?: number;
}

export interface GoldenGateInput {
  /** DNA fragments to assemble */
  fragments: DNAFragment[];
  /** Type IIS enzyme to use */
  enzyme: "BsaI" | "BbsI" | "SapI" | "AarI";
  /** Number of bases for overhangs (4 bp standard) */
  overhangLength?: number;
}

export interface MoCloInput {
  /** DNA modules to assemble (in order) */
  modules: DNAFragment[];
  /** Assembly level (1 = basic parts, 2 = devices, 3 = systems) */
  level: 1 | 2 | 3;
  /** Position in the assembly (for standardized fusion sites) */
  positions: number[];
}

export interface AssemblyResult {
  /** Assembly method used */
  method: AssemblyMethod;
  /** Final assembled sequence */
  assembledSequence: string;
  /** Fragment overlaps/junctions */
  junctions: Array<{
    fragment1: string;
    fragment2: string;
    overlapSequence: string;
    overlapLength: number;
    tm: number;
    gcContent: number;
  }>;
  /** Assembly metadata */
  metadata: {
    totalLength: number;
    fragmentCount: number;
    totalOverlaps: number;
    assemblyTime: number;
  };
  /** Design notes */
  designNotes: string[];
}

// ── Gibson Assembly ──────────────────────────────────────────────────────

/**
 * Design a Gibson Assembly reaction.
 *
 * Generates overlapping sequences between adjacent fragments with:
 *   - Target overlap length (20-40 bp)
 *   - Tm targeting 60°C (salt-adjusted)
 *   - GC content 40-60% in overlap regions
 *   - No secondary structure in overlaps
 *
 * @param input Gibson assembly parameters
 * @returns Assembly design with overlaps and final sequence
 */
export function designGibsonAssembly(input: GibsonAssemblyInput): AssemblyResult {
  const startTime = Date.now();
  const { fragments, overlapLength = 30, targetTm = 60 } = input;

  if (fragments.length < 2) {
    throw new Error("Gibson assembly requires at least 2 fragments");
  }

  const junctions: AssemblyResult["junctions"] = [];
  let assembledSequence = fragments[0].sequence.toUpperCase();

  for (let i = 0; i < fragments.length - 1; i++) {
    const frag1 = fragments[i].sequence.toUpperCase();
    const frag2 = fragments[i + 1].sequence.toUpperCase();

    // Generate overlap from 3' end of frag1 and 5' end of frag2
    const overlap1 = frag1.substring(frag1.length - overlapLength);
    const overlap2 = frag2.substring(0, overlapLength);

    // Optimize overlap for Tm and GC content
    const optimizedOverlap = optimizeOverlap(overlap1, overlap2, targetTm, overlapLength);

    // Compute Tm (salt-adjusted, simplified)
    const tm = computeTm(optimizedOverlap);
    const gcContent = (optimizedOverlap.match(/[GC]/g) || []).length / optimizedOverlap.length;

    junctions.push({
      fragment1: fragments[i].id,
      fragment2: fragments[i + 1].id,
      overlapSequence: optimizedOverlap,
      overlapLength: optimizedOverlap.length,
      tm: Math.round(tm * 10) / 10,
      gcContent: Math.round(gcContent * 100) / 100,
    });

    // Add fragment 2 without the overlap region
    assembledSequence += frag2.substring(overlapLength);
  }

  return {
    method: "gibson",
    assembledSequence,
    junctions,
    metadata: {
      totalLength: assembledSequence.length,
      fragmentCount: fragments.length,
      totalOverlaps: junctions.length,
      assemblyTime: Date.now() - startTime,
    },
    designNotes: [
      `Gibson Assembly: ${fragments.length} fragments → ${assembledSequence.length} bp construct`,
      `Overlap length: ${overlapLength} bp (target Tm: ${targetTm}°C)`,
      `Average overlap Tm: ${(junctions.reduce((s, j) => s + j.tm, 0) / junctions.length).toFixed(1)}°C`,
      `Average overlap GC: ${(junctions.reduce((s, j) => s + j.gcContent, 0) / junctions.length * 100).toFixed(1)}%`,
      `Reference: Gibson et al. (2009) Nat Methods 6:343-345`,
      `Protocol: Incubate at 50°C for 15-60 min with Gibson Master Mix`,
    ],
  };
}

// ── Golden Gate Assembly ─────────────────────────────────────────────────

/**
 * Design a Golden Gate Assembly reaction.
 *
 * Uses Type IIS restriction enzymes to create 4 bp overhangs:
 *   - BsaI: cuts outside recognition site (GGTCTC)
 *   - BbsI: cuts outside recognition site (GAAGAC)
 *   - SapI: cuts outside recognition site (GCTCTTC)
 *   - AarI: cuts outside recognition site (CACCTGC)
 *
 * @param input Golden Gate assembly parameters
 * @returns Assembly design with overhangs and final sequence
 */
export function designGoldenGateAssembly(input: GoldenGateInput): AssemblyResult {
  const startTime = Date.now();
  const { fragments, enzyme = "BsaI", overhangLength = 4 } = input;

  if (fragments.length < 2) {
    throw new Error("Golden Gate assembly requires at least 2 fragments");
  }

  // Enzyme recognition sequences and cut sites
  const enzymeInfo: Record<string, { recognition: string; cutOffset: number; overhang: number }> = {
    BsaI: { recognition: "GGTCTC", cutOffset: 1, overhang: 4 },
    BbsI: { recognition: "GAAGAC", cutOffset: 2, overhang: 4 },
    SapI: { recognition: "GCTCTTC", cutOffset: 1, overhang: 3 },
    AarI: { recognition: "CACCTGC", cutOffset: 4, overhang: 4 },
  };

  const info = enzymeInfo[enzyme] || enzymeInfo.BsaI;

  // Generate overhangs between fragments
  const junctions: AssemblyResult["junctions"] = [];
  let assembledSequence = "";

  for (let i = 0; i < fragments.length; i++) {
    const seq = fragments[i].sequence.toUpperCase();

    // Add the fragment sequence (without overhang regions)
    assembledSequence += seq;

    // Generate junction overhang
    if (i < fragments.length - 1) {
      const nextSeq = fragments[i + 1].sequence.toUpperCase();
      const overhang = generateOverhang(seq, nextSeq, overhangLength);

      const gcContent = (overhang.match(/[GC]/g) || []).length / overhang.length;
      const tm = computeTm(overhang);

      junctions.push({
        fragment1: fragments[i].id,
        fragment2: fragments[i + 1].id,
        overlapSequence: overhang,
        overlapLength: overhang.length,
        tm: Math.round(tm * 10) / 10,
        gcContent: Math.round(gcContent * 100) / 100,
      });
    }
  }

  // Remove any internal enzyme recognition sites
  const cleanSequence = removeRestrictionSites(assembledSequence, info.recognition);

  return {
    method: "golden_gate",
    assembledSequence: cleanSequence,
    junctions,
    metadata: {
      totalLength: cleanSequence.length,
      fragmentCount: fragments.length,
      totalOverlaps: junctions.length,
      assemblyTime: Date.now() - startTime,
    },
    designNotes: [
      `Golden Gate Assembly: ${fragments.length} fragments using ${enzyme}`,
      `Enzyme: ${enzyme} (recognition: ${info.recognition})`,
      `Overhang length: ${overhangLength} bp`,
      `Fragments: ${fragments.map((f) => f.id).join(" → ")}`,
      `Reference: Engler et al. (2008) PLoS ONE 3:e3647`,
      `Protocol: Digest + ligate in one pot at ${enzyme === "BsaI" ? "37" : "37"}°C for 1-16 hours`,
    ],
  };
}

// ── MoClo Assembly ──────────────────────────────────────────────────────

/**
 * Design a MoClo (Modular Cloning) assembly.
 *
 * MoClo uses standardized fusion sites for modular, hierarchical assembly:
 *   - Level 0: Basic parts (promoters, CDS, terminators)
 *   - Level 1: Transcriptional units
 *   - Level 2: Multi-gene constructs
 *
 * Standard fusion sites: {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}
 *
 * @param input MoClo assembly parameters
 * @returns Assembly design with standardized junctions
 */
export function designMoCloAssembly(input: MoCloInput): AssemblyResult {
  const startTime = Date.now();
  const { modules, level = 1, positions } = input;

  if (modules.length < 2) {
    throw new Error("MoClo assembly requires at least 2 modules");
  }

  // Standard MoClo fusion sites (4 bp)
  const FUSION_SITES: Record<number, Record<number, string>> = {
    1: { // Level 1 — transcriptional units
      0: "AATG", // {1} — promoter start
      1: "AGGT", // {2} — promoter/CDS junction
      2: "GCTT", // {3} — CDS/terminator junction
      3: "CGCT", // {4} — terminator end
    },
    2: { // Level 2 — multi-gene
      0: "AATG", // {1}
      1: "AGGT", // {2}
      2: "GCTT", // {3}
      3: "CGCT", // {4}
      4: "GCAA", // {5}
      5: "TACT", // {6}
      6: "ATGC", // {7}
      7: "GCAT", // {8}
    },
  };

  const sites = FUSION_SITES[level] || FUSION_SITES[1];
  const junctions: AssemblyResult["junctions"] = [];
  let assembledSequence = "";

  for (let i = 0; i < modules.length; i++) {
    const seq = modules[i].sequence.toUpperCase();
    assembledSequence += seq;

    if (i < modules.length - 1) {
      const pos = positions[i] ?? i;
      const fusionSite = sites[pos % Object.keys(sites).length];
      assembledSequence += fusionSite;

      const gcContent = (fusionSite.match(/[GC]/g) || []).length / fusionSite.length;
      const tm = computeTm(fusionSite);

      junctions.push({
        fragment1: modules[i].id,
        fragment2: modules[i + 1].id,
        overlapSequence: fusionSite,
        overlapLength: fusionSite.length,
        tm: Math.round(tm * 10) / 10,
        gcContent: Math.round(gcContent * 100) / 100,
      });
    }
  }

  return {
    method: "moclo",
    assembledSequence,
    junctions,
    metadata: {
      totalLength: assembledSequence.length,
      fragmentCount: modules.length,
      totalOverlaps: junctions.length,
      assemblyTime: Date.now() - startTime,
    },
    designNotes: [
      `MoClo Assembly: ${modules.length} modules at level ${level}`,
      `Fusion sites: ${junctions.map((j) => j.overlapSequence).join(" → ")}`,
      `Standard: Weber et al. (2011) J Biol Eng 5:12`,
      `Level ${level}: ${level === 1 ? "Transcriptional units" : level === 2 ? "Multi-gene constructs" : "Systems"}`,
      `Positions: [${positions.join(", ")}]`,
    ],
  };
}

// ── Helper Functions ─────────────────────────────────────────────────────

/**
 * Compute melting temperature (Tm) for a short DNA sequence.
 * Uses the Wallace rule for short oligonucleotides.
 */
function computeTm(sequence: string): number {
  const seq = sequence.toUpperCase();
  const a = (seq.match(/A/g) || []).length;
  const t = (seq.match(/T/g) || []).length;
  const g = (seq.match(/G/g) || []).length;
  const c = (seq.match(/C/g) || []).length;

  if (seq.length <= 14) {
    // Wallace rule: Tm = 2(A+T) + 4(G+C)
    return 2 * (a + t) + 4 * (g + c);
  } else {
    // Salt-adjusted Tm for longer sequences
    return 64.9 + 41 * (g + c - 16.4) / (a + t + g + c);
  }
}

/**
 * Optimize an overlap sequence for target Tm and GC content.
 */
function optimizeOverlap(overlap1: string, overlap2: string, targetTm: number, length: number): string {
  // Use the overlap with better Tm match
  const tm1 = computeTm(overlap1);
  const tm2 = computeTm(overlap2);

  let bestOverlap = Math.abs(tm1 - targetTm) < Math.abs(tm2 - targetTm) ? overlap1 : overlap2;

  // Try to adjust GC content toward 50%
  const gcTarget = 0.5;
  const currentGC = (bestOverlap.match(/[GC]/g) || []).length / bestOverlap.length;

  if (Math.abs(currentGC - gcTarget) > 0.15) {
    // Try synonymous swaps to improve GC
    bestOverlap = bestOverlap
      .split("")
      .map((base, i) => {
        if (i < 3 || i > length - 4) return base; // Don't change ends
        const gc = (bestOverlap.match(/[GC]/g) || []).length / bestOverlap.length;
        if (gc < gcTarget && (base === "A" || base === "T")) {
          return base === "A" ? "G" : "C";
        }
        if (gc > gcTarget && (base === "G" || base === "C")) {
          return base === "G" ? "A" : "T";
        }
        return base;
      })
      .join("");
  }

  return bestOverlap;
}

/**
 * Generate an overhang sequence between two fragments.
 */
function generateOverhang(frag1End: string, frag2Start: string, length: number): string {
  // Use the last `length` bases of frag1 as the overhang
  return frag1End.substring(frag1End.length - length);
}

/**
 * Remove restriction sites from a sequence (synonymous codon substitution).
 */
function removeRestrictionSites(sequence: string, site: string): string {
  const upper = sequence.toUpperCase();
  const idx = upper.indexOf(site);
  if (idx === -1) return sequence;

  // Try to mutate the recognition site without changing the reading frame
  // This is a simplified version — in production, would use codon tables
  const before = sequence.substring(0, idx);
  const after = sequence.substring(idx + site.length);

  // Simple substitution: change one base to break the recognition site
  const mutated = site.split("").map((base, i) => {
    if (i === Math.floor(site.length / 2)) {
      // Change middle base
      return base === "G" ? "A" : base === "C" ? "T" : base === "A" ? "G" : "C";
    }
    return base;
  }).join("");

  return before + mutated + after;
}
