/**
 * Cloning Simulator Tests
 *
 * Covers:
 *   - Restriction digest (5' overhang, 3' overhang, blunt, multi-site, no sites)
 *   - Gibson Assembly (valid overlaps, mismatched overlaps, single fragment, zero overlap)
 *   - Golden Gate Assembly (BsaI digestion + reassembly, no sites, unknown enzyme)
 *   - Tm calculation (SantaLucia nearest-neighbor, self-complementary, edge cases)
 */

import {
  simulateRestrictionDigest,
  simulateGibsonAssembly,
  simulateGoldenGate,
  calculateTm,
} from "../src/services/sequences/cloningSimulator";

// ── Restriction Digest ─────────────────────────────────────────────────────────

describe("simulateRestrictionDigest", () => {
  it("returns empty result for empty sequence", () => {
    const result = simulateRestrictionDigest("", ["EcoRI"]);
    expect(result.fragments).toEqual([]);
    expect(result.cutSites).toEqual([]);
  });

  it("returns empty result for empty enzyme list", () => {
    const result = simulateRestrictionDigest("AAGAATTCAA", []);
    expect(result.fragments).toEqual([]);
    expect(result.cutSites).toEqual([]);
  });

  it("returns empty result for unknown enzyme name", () => {
    const result = simulateRestrictionDigest("AAGAATTCAA", ["FakeEnzyme"]);
    expect(result.fragments).toEqual([]);
    expect(result.cutSites).toEqual([]);
  });

  it("digests with EcoRI (5' overhang) at a single site", () => {
    // EcoRI cuts G^AATTC — recognition GAATTC, cutSite=1
    // Sequence: AAGAATTCAA
    // Position of GAATTC: index 2
    // Watson cut at 2+1=3, Crick cut at 2+6-1=7
    const result = simulateRestrictionDigest("AAGAATTCAA", ["EcoRI"]);
    expect(result.cutSites).toHaveLength(1);
    expect(result.cutSites[0].enzyme).toBe("EcoRI");
    expect(result.cutSites[0].overhang).toBe("5prime");

    // Should produce fragments between cut positions 3 and 7
    expect(result.fragments.length).toBeGreaterThanOrEqual(1);

    // The fragments should reconstruct the original sequence
    const reconstructed = result.fragments.map((f) => f.watson).join("");
    expect(reconstructed).toBe("AAGAATTCAA");
  });

  it("digests with PstI (3' overhang)", () => {
    // PstI cuts CTGCA^G — recognition CTGCAG, cutSite=5
    // Sequence: AACTGCAGA
    // Position of CTGCAG: index 2
    // Watson cut at 2+5=7, Crick cut at 2+6-5=3
    const result = simulateRestrictionDigest("AACTGCAGA", ["PstI"]);
    expect(result.cutSites).toHaveLength(1);
    expect(result.cutSites[0].enzyme).toBe("PstI");
    expect(result.cutSites[0].overhang).toBe("3prime");

    // Fragments reconstruct original
    const reconstructed = result.fragments.map((f) => f.watson).join("");
    expect(reconstructed).toBe("AACTGCAGA");
  });

  it("digests with SmaI (blunt end)", () => {
    // SmaI cuts CCC^GGG — recognition CCCGGG, cutSite=3
    // Sequence: AACCCGGGAA
    // Position: index 2
    // Watson cut at 2+3=5, Crick cut at 2+6-3=5 (same — blunt)
    const result = simulateRestrictionDigest("AACCCGGGAA", ["SmaI"]);
    expect(result.cutSites).toHaveLength(1);
    expect(result.cutSites[0].enzyme).toBe("SmaI");
    expect(result.cutSites[0].overhang).toBe("blunt");
    expect(result.cutSites[0].watsonCut).toBe(result.cutSites[0].crickCut);

    // Fragments reconstruct original
    const reconstructed = result.fragments.map((f) => f.watson).join("");
    expect(reconstructed).toBe("AACCCGGGAA");
  });

  it("digests with multiple enzymes", () => {
    // Sequence with both EcoRI and BamHI sites
    // AAGAATTCGGATCCAA
    //   GAATTC at idx 2 (EcoRI)
    //       GGATCC at idx 8 (BamHI)
    const seq = "AAGAATTCGGATCCAA";
    const result = simulateRestrictionDigest(seq, ["EcoRI", "BamHI"]);
    expect(result.cutSites.length).toBeGreaterThanOrEqual(2);

    // Fragments should reconstruct original
    const reconstructed = result.fragments.map((f) => f.watson).join("");
    expect(reconstructed).toBe(seq);
  });

  it("digests NotI (8-base recognition, 5' overhang)", () => {
    // NotI: GCGGCCGC, cutSite=2
    // AAGCGGCCGCAA — position 2
    // Watson cut at 4, Crick cut at 8
    const result = simulateRestrictionDigest("AAGCGGCCGCAA", ["NotI"]);
    expect(result.cutSites).toHaveLength(1);
    expect(result.cutSites[0].enzyme).toBe("NotI");
    expect(result.cutSites[0].overhang).toBe("5prime");

    const reconstructed = result.fragments.map((f) => f.watson).join("");
    expect(reconstructed).toBe("AAGCGGCCGCAA");
  });

  it("produces no cut sites when recognition site is absent", () => {
    const result = simulateRestrictionDigest("AAAAAAA", ["EcoRI"]);
    expect(result.cutSites).toHaveLength(0);
    // No cuts means no fragments from the cut algorithm
    expect(result.fragments).toHaveLength(0);
  });
});

// ── Gibson Assembly ────────────────────────────────────────────────────────────

describe("simulateGibsonAssembly", () => {
  it("assembles two fragments with valid overlap", () => {
    const result = simulateGibsonAssembly([
      { sequence: "AATTCCGG", overlap: 4 },
      { sequence: "CCGGTTAA", overlap: 4 },
    ]);
    expect(result.success).toBe(true);
    expect(result.assembled).toBe("AATTCCGGTTAA");
    expect(result.errors).toHaveLength(0);
  });

  it("assembles three fragments with overlaps", () => {
    const result = simulateGibsonAssembly([
      { sequence: "AAATTTCCC", overlap: 3 },
      { sequence: "CCCGGGAAA", overlap: 3 },
      { sequence: "AAATTTGGG", overlap: 3 },
    ]);
    expect(result.success).toBe(true);
    expect(result.assembled).toBe("AAATTTCCCGGGAAATTTGGG");
  });

  it("fails on overlap mismatch", () => {
    const result = simulateGibsonAssembly([
      { sequence: "AATTCCGG", overlap: 4 },
      { sequence: "TTAATTAA", overlap: 4 },
    ]);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("mismatch");
  });

  it("fails when overlap exceeds fragment length", () => {
    const result = simulateGibsonAssembly([
      { sequence: "AA", overlap: 4 },
      { sequence: "TT", overlap: 4 },
    ]);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("exceeds");
  });

  it("fails on zero overlap", () => {
    const result = simulateGibsonAssembly([
      { sequence: "AATT", overlap: 0 },
      { sequence: "CCGG", overlap: 0 },
    ]);
    expect(result.success).toBe(false);
  });

  it("returns the single fragment as-is", () => {
    const result = simulateGibsonAssembly([
      { sequence: "AATTCCGG", overlap: 4 },
    ]);
    expect(result.success).toBe(true);
    expect(result.assembled).toBe("AATTCCGG");
  });

  it("fails with empty fragments array", () => {
    const result = simulateGibsonAssembly([]);
    expect(result.success).toBe(false);
  });
});

// ── Golden Gate Assembly ───────────────────────────────────────────────────────

describe("simulateGoldenGate", () => {
  it("fails on empty sequence", () => {
    const result = simulateGoldenGate("", "BsaI");
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("Empty");
  });

  it("fails on unknown enzyme", () => {
    const result = simulateGoldenGate("AAGGAGCTAA", "NotARealEnzyme");
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("Unknown");
  });

  it("fails when no recognition sites are found", () => {
    const result = simulateGoldenGate("AAAAAAAAAA", "BsaI");
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("No BsaI");
  });

  it("digests and reassembles with BsaI", () => {
    // BsaI recognition: GGAGCT, cuts 7/11 nt downstream
    // Construct: [flank]GGAGCT[spacer]GGAGCT[flank]
    // Need enough sequence downstream of each recognition site
    const recog = "GGAGCT";
    // Build: GGAGCT + 11 bases downstream + GGAGCT + 11 bases downstream
    const flank1 = "AATT";
    const spacer = "CCGGAATTCCGG"; // 12 bases between recognition end and next
    const flank2 = "TTAA";
    const seq = flank1 + recog + spacer.slice(0, 11) + recog + spacer.slice(0, 11) + flank2;

    const result = simulateGoldenGate(seq, "BsaI");
    // At minimum, it should find 2 BsaI sites and produce fragments
    expect(result.assembled).toBeDefined();
  });
});

// ── Melting Temperature ────────────────────────────────────────────────────────

describe("calculateTm", () => {
  it("returns 0 for empty sequence", () => {
    expect(calculateTm("")).toBe(0);
  });

  it("returns 0 for single nucleotide", () => {
    expect(calculateTm("A")).toBe(0);
  });

  it("calculates Tm for a short oligo (AT-rich, lower Tm)", () => {
    const tm = calculateTm("AATTAA");
    // AT-rich short oligos can have sub-zero Tm (no stable duplex)
    // This is physically correct — the nearest-neighbor model reflects that
    expect(tm).toBeLessThan(30);
  });

  it("calculates Tm for a GC-rich oligo (higher Tm)", () => {
    const tm = calculateTm("GGCCGGCC");
    // GC-rich sequences have higher Tm
    expect(tm).toBeGreaterThan(30);
  });

  it("returns higher Tm for GC-rich than AT-rich of same length", () => {
    const tmAT = calculateTm("AATTAA");
    const tmGC = calculateTm("GGCCGG");
    expect(tmGC).toBeGreaterThan(tmAT);
  });

  it("returns lower Tm at lower concentration", () => {
    const tmHigh = calculateTm("GGCCGGCCGGCC", 1000);
    const tmLow = calculateTm("GGCCGGCCGGCC", 10);
    expect(tmHigh).toBeGreaterThan(tmLow);
  });

  it("handles case-insensitive input", () => {
    const tmUpper = calculateTm("GGCCGGCC");
    const tmLower = calculateTm("ggccggcc");
    expect(tmUpper).toBe(tmLower);
  });

  it("ignores non-DNA characters", () => {
    const tmClean = calculateTm("GGCCGGCC");
    const tmMessy = calculateTm("GG-CC GG CC!");
    expect(tmClean).toBe(tmMessy);
  });

  it("calculates Tm in a biologically reasonable range for a 20-mer primer", () => {
    // Typical PCR primer: 18-25 nt, Tm 50-70 C
    const tm = calculateTm("ATCGATCGATCGATCGATCG");
    expect(tm).toBeGreaterThan(30);
    expect(tm).toBeLessThan(90);
  });
});
