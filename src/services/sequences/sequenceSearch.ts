/**
 * Sequence Search & Feature Query Service
 *
 * Provides substring search within biological sequences, feature filtering
 * by name/type, and restriction enzyme site scanning. All functions are
 * pure TypeScript with no external dependencies.
 *
 * Biological context:
 * - Substring search finds motifs, primer binding sites, or any exact
 *   subsequence match within a larger sequence
 * - Feature search enables quick lookup of annotated regions (CDS,
 *   promoters, terminators, etc.) by name or type
 * - Restriction site scanning identifies enzyme cut sites for cloning
 *   design, using the same enzyme database as the cloning simulator
 *
 * All positions are 0-indexed. Sequences are case-insensitive.
 */

import { COMMON_ENZYMES, type RestrictionEnzyme } from "../../components/sequence/restrictionEnzymes";
import type { RestrictionSite } from "../../components/sequence/types";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * A single match result from a sequence search.
 *
 * `position` is 0-indexed. `context` shows flanking bases so the user
 * can visually locate the match within the full sequence.
 */
export interface SearchResult {
  /** 0-indexed start position of the match in the sequence */
  position: number;
  /** The matched subsequence (preserves case from the original) */
  match: string;
  /** Flanking context: up to 10 bases before and after the match */
  context: string;
}

/**
 * A sequence feature/annotation, compatible with the SequenceFeature type
 * from the sequence editor data model.
 */
export interface Feature {
  /** Feature name (e.g. "lacZ", "AmpR promoter") */
  name: string;
  /** 0-indexed start position */
  start: number;
  /** 0-indexed end position (exclusive) */
  end: number;
  /** Strand: 1 = forward, -1 = reverse */
  strand: 1 | -1;
  /** Feature type (e.g. "CDS", "promoter", "terminator") */
  type: string;
  /** Optional display color */
  color?: string;
  /** Optional notes */
  notes?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Number of flanking bases to include in search result context */
const CONTEXT_FLANK = 10;

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Compute the reverse complement of a DNA string (uppercase).
 * Non-ACGT characters are preserved as-is.
 */
function revComp(seq: string): string {
  const comp: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
  return seq
    .split("")
    .reverse()
    .map((b) => comp[b] ?? b)
    .join("");
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Search for all occurrences of a query substring within a sequence.
 *
 * Performs case-insensitive exact matching. Each match includes its
 * 0-indexed position, the matched text (preserving original case), and
 * a context window showing flanking bases for visual reference.
 *
 * @param sequence - The full biological sequence to search within
 * @param query   - The substring to find (case-insensitive)
 * @returns Sorted array of SearchResult (by position ascending)
 * @throws Error if query is empty
 */
export function searchSequence(sequence: string, query: string): SearchResult[] {
  if (!query || query.length === 0) {
    throw new Error("Search query must not be empty");
  }
  if (!sequence || sequence.length === 0) {
    return [];
  }

  const upperSeq = sequence.toUpperCase();
  const upperQuery = query.toUpperCase();
  const results: SearchResult[] = [];

  let fromIdx = 0;
  while (fromIdx <= upperSeq.length - upperQuery.length) {
    const pos = upperSeq.indexOf(upperQuery, fromIdx);
    if (pos === -1) break;

    // Extract the match preserving original case
    const match = sequence.slice(pos, pos + upperQuery.length);

    // Build context window: up to CONTEXT_FLANK bases before and after
    const ctxStart = Math.max(0, pos - CONTEXT_FLANK);
    const ctxEnd = Math.min(sequence.length, pos + upperQuery.length + CONTEXT_FLANK);
    const context = sequence.slice(ctxStart, ctxEnd);

    results.push({ position: pos, match, context });

    fromIdx = pos + 1;
  }

  return results;
}

/**
 * Filter an array of features by a text query.
 *
 * Matches against feature name and type (case-insensitive). A feature
 * matches if the query appears as a substring in either its name or type.
 *
 * @param features - Array of features to filter
 * @param query    - Text query to match against name and type
 * @returns Filtered array of matching features (original order preserved)
 * @throws Error if query is empty
 */
export function searchFeatures(features: Feature[], query: string): Feature[] {
  if (!query || query.length === 0) {
    throw new Error("Feature search query must not be empty");
  }

  const lowerQuery = query.toLowerCase();

  return features.filter((f) => {
    const nameMatch = f.name.toLowerCase().includes(lowerQuery);
    const typeMatch = f.type.toLowerCase().includes(lowerQuery);
    return nameMatch || typeMatch;
  });
}

/**
 * Find all restriction enzyme cut sites in a DNA sequence.
 *
 * Scans both Watson and Crick strands for recognition sequences. For
 * palindromic enzymes (self-complementary recognition), each site is
 * reported once on the forward strand.
 *
 * @param sequence - DNA sequence to scan (case-insensitive)
 * @param enzymes  - Optional array of enzyme names to scan for.
 *                   If omitted, all enzymes in the COMMON_ENZYMES database
 *                   are used. Names are matched case-insensitively.
 * @returns Sorted array of RestrictionSite (by position ascending)
 */
export function findRestrictionSites(sequence: string, enzymes?: string[]): RestrictionSite[] {
  if (!sequence) return [];

  const upper = sequence.toUpperCase();

  // Select enzymes to scan
  let enzymeSet: RestrictionEnzyme[];
  if (enzymes && enzymes.length > 0) {
    const nameSet = new Set(enzymes.map((n) => n.toUpperCase()));
    enzymeSet = COMMON_ENZYMES.filter((e) => nameSet.has(e.name.toUpperCase()));
  } else {
    enzymeSet = COMMON_ENZYMES;
  }

  const sites: RestrictionSite[] = [];

  for (const enz of enzymeSet) {
    const recog = enz.sequence.toUpperCase();
    const rcRecog = revComp(recog);
    const isPalindromic = recog === rcRecog;

    // Scan Watson strand (5' -> 3')
    let fromIndex = 0;
    while (true) {
      const pos = upper.indexOf(recog, fromIndex);
      if (pos === -1) break;

      sites.push({
        enzyme: enz.name,
        sequence: recog,
        position: pos,
        strand: 1,
      });

      fromIndex = pos + 1;
    }

    // Scan Crick strand for non-palindromic enzymes
    if (!isPalindromic) {
      fromIndex = 0;
      while (true) {
        const pos = upper.indexOf(rcRecog, fromIndex);
        if (pos === -1) break;

        sites.push({
          enzyme: enz.name,
          sequence: rcRecog,
          position: pos,
          strand: -1,
        });

        fromIndex = pos + 1;
      }
    }
  }

  // Sort by position, then enzyme name
  sites.sort((a, b) => a.position - b.position || a.enzyme.localeCompare(b.enzyme));

  return sites;
}
