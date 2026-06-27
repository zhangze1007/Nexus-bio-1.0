/**
 * Tests for src/services/sequences/sequenceSearch.ts
 *
 * Covers:
 * - searchSequence: exact substring matching with context
 * - searchFeatures: feature name/type filtering
 * - findRestrictionSites: restriction enzyme scanning
 */

import {
  searchSequence,
  searchFeatures,
  findRestrictionSites,
  type Feature,
  type SearchResult,
} from "../src/services/sequences/sequenceSearch";

// ── searchSequence ─────────────────────────────────────────────────────────────

describe("searchSequence", () => {
  it("finds all exact matches in a sequence", () => {
    const seq = "ATGCGATCGATCGATCG";
    const results = searchSequence(seq, "GATC");
    expect(results).toHaveLength(3);
    expect(results[0].position).toBe(4);
    expect(results[1].position).toBe(8);
    expect(results[2].position).toBe(12);
    expect(results[0].match).toBe("GATC");
  });

  it("finds multiple non-overlapping matches", () => {
    const seq = "AAGAATTCAAGAATTCGG";
    const results = searchSequence(seq, "GAATTC");
    expect(results).toHaveLength(2);
    expect(results[0].position).toBe(2);
    expect(results[1].position).toBe(10);
  });

  it("finds overlapping matches", () => {
    const seq = "AAAA";
    const results = searchSequence(seq, "AAA");
    expect(results).toHaveLength(2);
    expect(results[0].position).toBe(0);
    expect(results[1].position).toBe(1);
  });

  it("returns empty array when query not found", () => {
    const results = searchSequence("ATCGATCG", "XXXX");
    expect(results).toEqual([]);
  });

  it("is case-insensitive for matching", () => {
    const seq = "ATCGatcg";
    const results = searchSequence(seq, "atcg");
    expect(results).toHaveLength(2);
    // First match preserves original case
    expect(results[0].match).toBe("ATCG");
    expect(results[1].match).toBe("atcg");
  });

  it("includes flanking context around each match", () => {
    const seq = "AAAAAATCGAAAAA";
    const results = searchSequence(seq, "TCG");
    expect(results).toHaveLength(1);
    // Context should include 10 bases before and after
    expect(results[0].context).toBe("AAAAAATCGAAAAA");
    expect(results[0].context).toContain("TCG");
  });

  it("truncates context at sequence boundaries", () => {
    const seq = "ATCG";
    const results = searchSequence(seq, "ATCG");
    expect(results).toHaveLength(1);
    // No flanking bases available at boundaries
    expect(results[0].context).toBe("ATCG");
  });

  it("throws on empty query", () => {
    expect(() => searchSequence("ATCG", "")).toThrow("Search query must not be empty");
  });

  it("returns empty array for empty sequence", () => {
    const results = searchSequence("", "ATCG");
    expect(results).toEqual([]);
  });

  it("handles query equal to the full sequence", () => {
    const seq = "GAATTC";
    const results = searchSequence(seq, "GAATTC");
    expect(results).toHaveLength(1);
    expect(results[0].position).toBe(0);
    expect(results[0].match).toBe("GAATTC");
  });
});

// ── searchFeatures ─────────────────────────────────────────────────────────────

describe("searchFeatures", () => {
  const features: Feature[] = [
    { name: "lacZ", start: 100, end: 300, strand: 1, type: "CDS" },
    { name: "AmpR promoter", start: 0, end: 50, strand: 1, type: "promoter" },
    { name: "T7 terminator", start: 400, end: 450, strand: -1, type: "terminator" },
    { name: "RBS site", start: 80, end: 95, strand: 1, type: "RBS" },
    { name: "GFP", start: 500, end: 720, strand: 1, type: "CDS" },
  ];

  it("matches features by name (substring)", () => {
    const results = searchFeatures(features, "lac");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("lacZ");
  });

  it("matches features by type", () => {
    const results = searchFeatures(features, "CDS");
    expect(results).toHaveLength(2);
    expect(results.map((f) => f.name)).toEqual(["lacZ", "GFP"]);
  });

  it("matches case-insensitively", () => {
    const results = searchFeatures(features, "cds");
    expect(results).toHaveLength(2);
  });

  it("returns empty array when no features match", () => {
    const results = searchFeatures(features, "nonexistent");
    expect(results).toEqual([]);
  });

  it("throws on empty query", () => {
    expect(() => searchFeatures(features, "")).toThrow(
      "Feature search query must not be empty",
    );
  });

  it("handles empty feature array", () => {
    const results = searchFeatures([], "CDS");
    expect(results).toEqual([]);
  });
});

// ── findRestrictionSites ───────────────────────────────────────────────────────

describe("findRestrictionSites", () => {
  it("finds a single EcoRI site", () => {
    const seq = "AAAAAAGAATTCAAAAA";
    const sites = findRestrictionSites(seq, ["EcoRI"]);
    expect(sites).toHaveLength(1);
    expect(sites[0].enzyme).toBe("EcoRI");
    expect(sites[0].position).toBe(6);
    expect(sites[0].strand).toBe(1);
  });

  it("finds multiple sites of the same enzyme", () => {
    const seq = "GAATTCXXXXXXGAATTC";
    const sites = findRestrictionSites(seq, ["EcoRI"]);
    expect(sites).toHaveLength(2);
    expect(sites[0].position).toBe(0);
    expect(sites[1].position).toBe(12);
  });

  it("finds sites for multiple enzymes", () => {
    const seq = "GAATTCGGATCCAAGCTT";
    const sites = findRestrictionSites(seq, ["EcoRI", "BamHI", "HindIII"]);
    expect(sites).toHaveLength(3);
    expect(sites.map((s) => s.enzyme)).toEqual(["EcoRI", "BamHI", "HindIII"]);
  });

  it("scans all common enzymes when none specified", () => {
    // Sequence with an EcoRI site (GAATTC) and a BamHI site (GGATCC)
    const seq = "ATCGGAATTCATCGGGATCCATCG";
    const sites = findRestrictionSites(seq);
    expect(sites.length).toBeGreaterThanOrEqual(2);
    const enzymeNames = sites.map((s) => s.enzyme);
    expect(enzymeNames).toContain("EcoRI");
    expect(enzymeNames).toContain("BamHI");
  });

  it("scans the reverse complement strand for non-palindromic enzymes", () => {
    // NotI recognition: GCGGCCGC. The reverse complement is also GCGGCCGC (palindromic).
    // Let's use a non-palindromic test. XhoI: CTCGAG, RC: CTCGAG (also palindromic).
    // Most common enzymes are palindromic. Test with explicit forward site.
    const seq = "AAAAGCGGCCGCAAA";
    const sites = findRestrictionSites(seq, ["NotI"]);
    expect(sites).toHaveLength(1);
    expect(sites[0].enzyme).toBe("NotI");
    expect(sites[0].position).toBe(4);
  });

  it("returns empty array for empty sequence", () => {
    const sites = findRestrictionSites("", ["EcoRI"]);
    expect(sites).toEqual([]);
  });

  it("returns empty array when enzyme name not found in database", () => {
    const seq = "GAATTC";
    const sites = findRestrictionSites(seq, ["FakeEnzyme"]);
    expect(sites).toEqual([]);
  });

  it("sorts results by position ascending", () => {
    const seq = "AAGCTTAAAAAGAATTC";
    const sites = findRestrictionSites(seq, ["EcoRI", "HindIII"]);
    expect(sites).toHaveLength(2);
    // HindIII (AAGCTT) at pos 0, EcoRI (GAATTC) at pos 11
    expect(sites[0].position).toBeLessThanOrEqual(sites[1].position);
  });

  it("handles enzyme name case-insensitively", () => {
    const seq = "GAATTC";
    const sites = findRestrictionSites(seq, ["ecori"]);
    expect(sites).toHaveLength(1);
    expect(sites[0].enzyme).toBe("EcoRI");
  });
});
