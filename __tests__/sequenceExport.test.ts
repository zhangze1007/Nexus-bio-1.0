/**
 * Tests for sequenceExport.ts
 *
 * Covers all 4 exported functions:
 *   - exportToFasta
 *   - exportToGenBank
 *   - exportToSBOL
 *   - autoDetectFormat
 */

import {
  exportToFasta,
  exportToGenBank,
  exportToSBOL,
  autoDetectFormat,
  type SequenceFeature,
} from "../src/services/sequences/sequenceExport";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SHORT_DNA = "ATGCGATCGATCGATCG";
const LONG_DNA = "ATGCGATCGATCGATCGATGCGATCGATCGATCGATGCGATCGATCGATCGATGCGATCGATCGATCGATGCGATCGATCGATCGATGCGATCGATCGATCG";
// 96 bp — exceeds FASTA 80-char wrap width

const PROTEIN_SEQ = "MKTAYIAKQRQISFVKSH";

const BASIC_FEATURES: SequenceFeature[] = [
  { name: "lacZ", start: 1, end: 6, strand: 1, type: "CDS" },
  { name: "AmpR promoter", start: 8, end: 15, strand: -1, type: "promoter" },
];

const EMPTY_FEATURES: SequenceFeature[] = [];

const FEATURE_WITH_QUALIFIERS: SequenceFeature[] = [
  {
    name: "rbs",
    start: 1,
    end: 9,
    strand: 1,
    type: "ribosome_entry_site",
    qualifiers: { label: "RBS001", note: "synthetic RBS" },
  },
];

// ── exportToFasta ──────────────────────────────────────────────────────────────

describe("exportToFasta", () => {
  test("produces valid FASTA with header and sequence", () => {
    const result = exportToFasta(SHORT_DNA, "test_seq");
    expect(result).toBe(`>test_seq\n${SHORT_DNA}\n`);
  });

  test("wraps long sequences at 80 characters per line", () => {
    const result = exportToFasta(LONG_DNA, "long_seq");
    const lines = result.split("\n").filter((l) => l.length > 0);
    // Header + wrapped sequence lines
    expect(lines[0]).toBe(">long_seq");
    // All sequence lines should be <= 80 chars
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].length).toBeLessThanOrEqual(80);
    }
    // Reconstructed sequence matches original
    const reconstructed = lines.slice(1).join("");
    expect(reconstructed).toBe(LONG_DNA.toUpperCase());
  });

  test("throws on empty sequence", () => {
    expect(() => exportToFasta("", "name")).toThrow("Cannot export empty sequence");
  });

  test("throws on empty name", () => {
    expect(() => exportToFasta(SHORT_DNA, "")).toThrow("Sequence name is required");
  });

  test("strips non-alphabetic characters from sequence", () => {
    const dirty = "AT-GC 123 TCG";
    const result = exportToFasta(dirty, "clean");
    expect(result).toBe(`>clean\nATGCTCG\n`);
  });
});

// ── exportToGenBank ───────────────────────────────────────────────────────────

describe("exportToGenBank", () => {
  test("produces valid GenBank record with all sections", () => {
    const result = exportToGenBank(SHORT_DNA, BASIC_FEATURES, "test_locus");

    expect(result).toContain("LOCUS       test_locus");
    expect(result).toContain("FEATURES             Location/Qualifiers");
    expect(result).toContain("ORIGIN");
    expect(result).toContain("//");

    // Feature table entries
    expect(result).toContain('CDS             1..6');
    expect(result).toContain('promoter        complement(8..15)');
    expect(result).toContain('/gene="lacZ"');
    expect(result).toContain('/gene="AmpR promoter"');
  });

  test("includes qualifiers in feature table", () => {
    const result = exportToGenBank(SHORT_DNA, FEATURE_WITH_QUALIFIERS, "qual_test");

    expect(result).toContain('ribosome_entry_site 1..9');
    expect(result).toContain('/gene="rbs"');
    expect(result).toContain('/label="RBS001"');
    expect(result).toContain('/note="synthetic RBS"');
  });

  test("formats ORIGIN with 60-char lines and 10-char groups", () => {
    const result = exportToGenBank(SHORT_DNA, EMPTY_FEATURES, "origin_test");

    // The ORIGIN section should have numbered lines
    expect(result).toContain("ORIGIN");
    // First ORIGIN line should start with position 1, padded to 9 chars
    expect(result).toMatch(/\n {8}1 ATGCGATCGA TCG/);
  });

  test("throws on empty sequence", () => {
    expect(() => exportToGenBank("", EMPTY_FEATURES, "name")).toThrow(
      "Cannot export empty sequence",
    );
  });

  test("throws on empty name", () => {
    expect(() => exportToGenBank(SHORT_DNA, EMPTY_FEATURES, "")).toThrow(
      "Sequence name is required",
    );
  });
});

// ── exportToSBOL ──────────────────────────────────────────────────────────────

describe("exportToSBOL", () => {
  test("produces valid SBOL 3.0 XML with Component and Sequence", () => {
    const result = exportToSBOL(SHORT_DNA, EMPTY_FEATURES, "test_component");

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('xmlns:sbol="http://sbols.org/v3#"');
    expect(result).toContain("<sbol:Component");
    expect(result).toContain("<sbol:displayId>test_component</sbol:displayId>");
    expect(result).toContain(`<sbol:name>test_component</sbol:name>`);
    expect(result).toContain("<sbol:hasSequence>");
    expect(result).toContain(`<sbol:elements>${SHORT_DNA.toUpperCase()}</sbol:elements>`);
    expect(result).toContain("</rdf:RDF>");
  });

  test("includes SequenceFeature annotations with SO roles", () => {
    const result = exportToSBOL(SHORT_DNA, BASIC_FEATURES, "annotated");

    expect(result).toContain("<sbol:hasFeature>");
    expect(result).toContain("<sbol:SequenceFeature");
    // CDS maps to SO:0000316
    expect(result).toContain('rdf:resource="http://identifiers.org/SO:0000316"');
    // promoter maps to SO:0000167
    expect(result).toContain('rdf:resource="http://identifiers.org/SO:0000167"');
    // Range with coordinates
    expect(result).toContain('sbol:start="1"');
    expect(result).toContain('sbol:end="6"');
    // Reverse complement orientation
    expect(result).toContain("reverseComplement");
  });

  test("does not emit hasFeature when features array is empty", () => {
    const result = exportToSBOL(SHORT_DNA, EMPTY_FEATURES, "bare");

    expect(result).not.toContain("<sbol:hasFeature>");
    expect(result).not.toContain("SequenceFeature");
  });

  test("throws on empty sequence", () => {
    expect(() => exportToSBOL("", EMPTY_FEATURES, "name")).toThrow(
      "Cannot export empty sequence",
    );
  });

  test("throws on empty name", () => {
    expect(() => exportToSBOL(SHORT_DNA, EMPTY_FEATURES, "")).toThrow(
      "Sequence name is required",
    );
  });
});

// ── autoDetectFormat ──────────────────────────────────────────────────────────

describe("autoDetectFormat", () => {
  test("detects FASTA format", () => {
    const fasta = ">seq1\nATGCGATCG\n";
    expect(autoDetectFormat(fasta)).toBe("fasta");
  });

  test("detects GenBank format from LOCUS line", () => {
    const genbank =
      "LOCUS       pUC19                2686 bp    DNA     circular SYN 01-JAN-2020\n" +
      "FEATURES             Location/Qualifiers\n" +
      "ORIGIN\n" +
      "        1 atgc\n" +
      "//\n";
    expect(autoDetectFormat(genbank)).toBe("genbank");
  });

  test("detects GenBank format from FEATURES/ORIGIN/terminator", () => {
    // Even without a leading LOCUS line, the structural markers should match
    const fragment =
      "FEATURES             Location/Qualifiers\n" +
      "ORIGIN\n" +
      "//\n";
    expect(autoDetectFormat(fragment)).toBe("genbank");
  });

  test("detects SBOL 3.0 format", () => {
    const sbol =
      '<?xml version="1.0"?>\n' +
      '<rdf:RDF xmlns:sbol="http://sbols.org/v3#">\n' +
      "</rdf:RDF>\n";
    expect(autoDetectFormat(sbol)).toBe("sbol");
  });

  test("detects SBOL 2.0 format", () => {
    const sbol2 =
      '<?xml version="1.0"?>\n' +
      '<rdf:RDF xmlns:sbol2="http://sbols.org/v2#">\n' +
      "</rdf:RDF>\n";
    expect(autoDetectFormat(sbol2)).toBe("sbol");
  });

  test("returns unknown for empty string", () => {
    expect(autoDetectFormat("")).toBe("unknown");
  });

  test("returns unknown for unrecognized content", () => {
    expect(autoDetectFormat("just some random text")).toBe("unknown");
  });

  test("returns unknown for null/undefined-like inputs", () => {
    expect(autoDetectFormat(null as unknown as string)).toBe("unknown");
    expect(autoDetectFormat(undefined as unknown as string)).toBe("unknown");
  });
});

// ── Round-trip: export then detect ─────────────────────────────────────────────

describe("round-trip export/detect", () => {
  test("FASTA export is detected as FASTA", () => {
    const exported = exportToFasta(SHORT_DNA, "round_trip");
    expect(autoDetectFormat(exported)).toBe("fasta");
  });

  test("GenBank export is detected as GenBank", () => {
    const exported = exportToGenBank(SHORT_DNA, BASIC_FEATURES, "round_trip");
    expect(autoDetectFormat(exported)).toBe("genbank");
  });

  test("SBOL export is detected as SBOL", () => {
    const exported = exportToSBOL(SHORT_DNA, BASIC_FEATURES, "round_trip");
    expect(autoDetectFormat(exported)).toBe("sbol");
  });
});
