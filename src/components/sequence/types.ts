/**
 * Sequence Editor — Data Model
 *
 * Core types for the Nexus-Bio sequence editor.
 * All positions are 0-indexed, end is exclusive.
 */

export type SequenceType = "dna" | "rna" | "protein";

export type FeatureType = "CDS" | "promoter" | "terminator" | "RBS" | "misc" | "primer" | "restriction_site";

export interface SequenceFeature {
  id: string;
  type: FeatureType;
  start: number; // 0-indexed
  end: number; // exclusive
  strand: 1 | -1;
  name: string;
  color: string;
  notes?: string;
}

export interface RestrictionSite {
  enzyme: string;
  sequence: string;
  position: number;
  strand: 1 | -1;
}

export interface Primer {
  id: string;
  name: string;
  sequence: string;
  bindingStart: number;
  bindingEnd: number;
  strand: 1 | -1;
  tm: number;
}

export interface SequenceData {
  id: string;
  name: string;
  type: SequenceType;
  sequence: string; // uppercase, no spaces
  features: SequenceFeature[];
  restrictionSites: RestrictionSite[];
  primers: Primer[];
  annotations: Record<string, string>; // metadata
  topology: "linear" | "circular";
  length: number;
}

/**
 * Create a SequenceData object with sensible defaults.
 */
export function createSequenceData(partial: Partial<SequenceData> & Pick<SequenceData, "sequence">): SequenceData {
  const seq = partial.sequence.toUpperCase().replace(/\s+/g, "");
  const type = partial.type ?? inferSequenceType(seq);
  return {
    id: partial.id ?? crypto.randomUUID?.() ?? `seq-${Date.now()}`,
    name: partial.name ?? "Untitled",
    type,
    sequence: seq,
    features: partial.features ?? [],
    restrictionSites: partial.restrictionSites ?? [],
    primers: partial.primers ?? [],
    annotations: partial.annotations ?? {},
    topology: partial.topology ?? "linear",
    length: seq.length,
  };
}

/**
 * Infer sequence type from character composition.
 */
function inferSequenceType(seq: string): SequenceType {
  if (/^[ATCGUN\s]+$/i.test(seq)) {
    return seq.includes("U") ? "rna" : "dna";
  }
  return "protein";
}

/**
 * Validate that a sequence string is valid for its declared type.
 */
export function validateSequence(seq: string, type: SequenceType): string | null {
  const upper = seq.toUpperCase().replace(/\s+/g, "");
  if (upper.length === 0) return "Sequence is empty";

  switch (type) {
    case "dna":
      if (!/^[ATCG]+$/.test(upper)) return "DNA sequence must contain only A, T, C, G";
      break;
    case "rna":
      if (!/^[AUCG]+$/.test(upper)) return "RNA sequence must contain only A, U, C, G";
      break;
    case "protein":
      if (!/^[ACDEFGHIKLMNPQRSTVWY]+$/.test(upper))
        return "Protein sequence must contain only standard amino acid codes";
      break;
  }
  return null;
}

/**
 * Reverse complement of a DNA sequence.
 */
export function reverseComplement(seq: string): string {
  const comp: Record<string, string> = {
    A: "T",
    T: "A",
    C: "G",
    G: "C",
    a: "t",
    t: "a",
    c: "g",
    g: "c",
  };
  return seq
    .split("")
    .reverse()
    .map((b) => comp[b] ?? b)
    .join("");
}
