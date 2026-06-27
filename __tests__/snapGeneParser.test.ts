/**
 * SnapGene .dna Parser Tests
 *
 * Uses synthetic binary data constructed to match the SnapGene format:
 *   Header: 0x09 + uint32(14) + "SnapGene" + uint16(isDna) + uint16(exportVer) + uint16(importVer)
 *   Blocks: byte(type) + uint32BE(size) + payload
 *
 * Block types: 0=sequence, 5=primers, 6=notes, 10=features
 */

import { parseSnapGene, isSnapGeneFile } from "../src/services/sequences/snapGeneParser";
import type { SnapGeneResult } from "../src/services/sequences/snapGeneParser";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Encode an ASCII string to Uint8Array. */
function ascii(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

/** Write a big-endian uint16 into a Uint8Array at the given offset. */
function writeUint16BE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >> 8) & 0xff;
  arr[offset + 1] = value & 0xff;
}

/** Write a big-endian uint32 into a Uint8Array at the given offset. */
function writeUint32BE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >> 24) & 0xff;
  arr[offset + 1] = (value >> 16) & 0xff;
  arr[offset + 2] = (value >> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

/** Concatenate multiple Uint8Arrays. */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Build a SnapGene file header.
 *
 * Structure:
 *   0x09 (1 byte) + docLength uint32BE (4) + "SnapGene" (8) + isDna uint16BE (2)
 *   + exportVer uint16BE (2) + importVer uint16BE (2) = 19 bytes
 */
function buildHeader(
  isDna = true,
  exportVersion = 1,
  importVersion = 1,
): Uint8Array {
  const header = new Uint8Array(19);
  header[0] = 0x09;
  writeUint32BE(header, 1, 14); // document length
  // "SnapGene" at offset 5..12
  const magic = ascii("SnapGene");
  header.set(magic, 5);
  writeUint16BE(header, 13, isDna ? 1 : 0);
  writeUint16BE(header, 15, exportVersion);
  writeUint16BE(header, 17, importVersion);
  return header;
}

/**
 * Build a block: type (1 byte) + size uint32BE (4 bytes) + payload.
 */
function buildBlock(type: number, payload: Uint8Array): Uint8Array {
  const block = new Uint8Array(5 + payload.length);
  block[0] = type;
  writeUint32BE(block, 1, payload.length);
  block.set(payload, 5);
  return block;
}

/**
 * Build a sequence properties block (type 0).
 *
 * Payload: flags byte (1) + DNA sequence (ASCII).
 *
 * Flags:
 *   bit 0: circular
 *   bit 1: double-stranded
 *   bit 2: A methylated
 *   bit 3: C methylated
 *   bit 4: KI methylated
 */
function buildSequenceBlock(
  sequence: string,
  circular = false,
  doubleStranded = true,
): Uint8Array {
  let flags = 0;
  if (circular) flags |= 0x01;
  if (doubleStranded) flags |= 0x02;

  const payload = new Uint8Array(1 + sequence.length);
  payload[0] = flags;
  payload.set(ascii(sequence), 1);

  return buildBlock(0, payload);
}

/**
 * Build a features block (type 10).
 *
 * Payload is XML-encoded feature annotations.
 */
function buildFeaturesBlock(
  features: Array<{
    name: string;
    type: string;
    start: number;
    end: number;
    strand: 1 | -1;
    qualifiers?: Record<string, string>;
  }>,
): Uint8Array {
  let xml = "<Features>";
  for (const f of features) {
    const strandAttr = f.strand === -1 ? 'strand="-1"' : 'strand="1"';
    xml += `<Feature name="${f.name}" type="${f.type}" start="${f.start}" end="${f.end}" ${strandAttr}>`;
    if (f.qualifiers) {
      for (const [key, value] of Object.entries(f.qualifiers)) {
        xml += `<Q name="${key}" value="${value}"/>`;
      }
    }
    xml += "</Feature>";
  }
  xml += "</Features>";

  return buildBlock(10, ascii(xml));
}

/**
 * Build a notes block (type 6).
 */
function buildNotesBlock(notes: Record<string, string>): Uint8Array {
  let xml = "<Notes>";
  for (const [tag, value] of Object.entries(notes)) {
    xml += `<${tag}>${value}</${tag}>`;
  }
  xml += "</Notes>";

  return buildBlock(6, ascii(xml));
}

/**
 * Build a complete SnapGene .dna binary from parts.
 */
function buildSnapGeneFile(
  sequence: string,
  options: {
    circular?: boolean;
    doubleStranded?: boolean;
    features?: Parameters<typeof buildFeaturesBlock>[0];
    notes?: Record<string, string>;
    isDna?: boolean;
    exportVersion?: number;
    importVersion?: number;
    extraBlocks?: Uint8Array[];
  } = {},
): ArrayBuffer {
  const parts: Uint8Array[] = [
    buildHeader(
      options.isDna ?? true,
      options.exportVersion ?? 1,
      options.importVersion ?? 1,
    ),
  ];

  // Sequence block (type 0) — always present
  parts.push(
    buildSequenceBlock(
      sequence,
      options.circular ?? false,
      options.doubleStranded ?? true,
    ),
  );

  // Features block (type 10)
  if (options.features && options.features.length > 0) {
    parts.push(buildFeaturesBlock(options.features));
  }

  // Notes block (type 6)
  if (options.notes && Object.keys(options.notes).length > 0) {
    parts.push(buildNotesBlock(options.notes));
  }

  // Extra blocks (for testing unknown types, etc.)
  if (options.extraBlocks) {
    for (const block of options.extraBlocks) {
      parts.push(block);
    }
  }

  return concat(...parts).buffer;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("isSnapGeneFile", () => {
  it("returns true for a valid SnapGene header", () => {
    const buffer = buildSnapGeneFile("ATCG");
    expect(isSnapGeneFile(buffer)).toBe(true);
  });

  it("returns false for null/undefined input", () => {
    expect(isSnapGeneFile(null as unknown as ArrayBuffer)).toBe(false);
    expect(isSnapGeneFile(undefined as unknown as ArrayBuffer)).toBe(false);
  });

  it("returns false for a buffer that is too small (< 15 bytes)", () => {
    const tiny = new ArrayBuffer(10);
    expect(isSnapGeneFile(tiny)).toBe(false);
  });

  it("returns false when magic bytes are wrong", () => {
    const buffer = new Uint8Array(19);
    buffer[0] = 0x09;
    writeUint32BE(buffer as unknown as Uint8Array, 1, 14);
    // Write wrong magic
    buffer.set(ascii("NotSnap!"), 5);
    expect(isSnapGeneFile(buffer.buffer)).toBe(false);
  });

  it("returns false when leading byte is not 0x09", () => {
    const buffer = buildSnapGeneFile("ATCG");
    const bytes = new Uint8Array(buffer);
    bytes[0] = 0x00; // corrupt leading byte
    expect(isSnapGeneFile(bytes.buffer)).toBe(false);
  });

  it("returns false for a plain text file", () => {
    const buffer = ascii("This is not a SnapGene file").buffer;
    expect(isSnapGeneFile(buffer)).toBe(false);
  });
});

describe("parseSnapGene", () => {
  it("parses a minimal file with only a sequence block", () => {
    const seq = "ATCGATCGATCG";
    const buffer = buildSnapGeneFile(seq);
    const result = parseSnapGene(buffer);

    expect(result.sequence).toBe(seq);
    expect(result.topology).toBe("linear");
    expect(result.isDoubleStranded).toBe(true);
    expect(result.features).toEqual([]);
    expect(result.exportVersion).toBe(1);
    expect(result.importVersion).toBe(1);
  });

  it("parses a circular plasmid", () => {
    const seq = "ATCGATCGATCGATCGATCGATCG";
    const buffer = buildSnapGeneFile(seq, { circular: true });
    const result = parseSnapGene(buffer);

    expect(result.sequence).toBe(seq);
    expect(result.topology).toBe("circular");
  });

  it("parses features correctly", () => {
    const seq = "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG";
    const features = [
      { name: "AmpR", type: "CDS", start: 1, end: 12, strand: 1 as const },
      { name: "lacZ", type: "promoter", start: 20, end: 36, strand: -1 as const },
    ];
    const buffer = buildSnapGeneFile(seq, { features });
    const result = parseSnapGene(buffer);

    expect(result.features).toHaveLength(2);
    expect(result.features[0]).toMatchObject({
      name: "AmpR",
      type: "CDS",
      start: 1,
      end: 12,
      strand: 1,
    });
    expect(result.features[1]).toMatchObject({
      name: "lacZ",
      type: "promoter",
      start: 20,
      end: 36,
      strand: -1,
    });
  });

  it("parses notes and uses Description as the sequence name", () => {
    const seq = "ATCGATCG";
    const notes = {
      Description: "pUC19 cloning vector",
      Author: "SnapGene Parser Test",
    };
    const buffer = buildSnapGeneFile(seq, { notes });
    const result = parseSnapGene(buffer);

    expect(result.name).toBe("pUC19 cloning vector");
    expect(result.notes.Description).toBe("pUC19 cloning vector");
    expect(result.notes.Author).toBe("SnapGene Parser Test");
  });

  it("defaults name to 'Unnamed Sequence' when no Description or Name note exists", () => {
    const seq = "ATCG";
    const buffer = buildSnapGeneFile(seq, { notes: { Author: "Test" } });
    const result = parseSnapGene(buffer);

    // Notes exist but no Description or Name — falls through to default
    expect(result.name).toBe("Unnamed Sequence");
    expect(result.notes.Author).toBe("Test");
  });

  it("defaults name to 'Unnamed Sequence' when no notes block exists", () => {
    const seq = "ATCG";
    const buffer = buildSnapGeneFile(seq);
    const result = parseSnapGene(buffer);

    expect(result.name).toBe("Unnamed Sequence");
  });

  it("parses version numbers correctly", () => {
    const seq = "ATCG";
    const buffer = buildSnapGeneFile(seq, {
      exportVersion: 5,
      importVersion: 3,
    });
    const result = parseSnapGene(buffer);

    expect(result.exportVersion).toBe(5);
    expect(result.importVersion).toBe(3);
  });

  it("handles single-stranded DNA", () => {
    const seq = "AUCGAUCG"; // RNA-like, but stored as single-stranded
    const buffer = buildSnapGeneFile(seq, { doubleStranded: false });
    const result = parseSnapGene(buffer);

    expect(result.isDoubleStranded).toBe(false);
    expect(result.sequence).toBe(seq);
  });

  it("skips unknown block types without error", () => {
    const seq = "ATCGATCG";
    // Add an unknown block type (e.g., type 99) with some payload
    const unknownPayload = ascii("some unknown data");
    const unknownBlock = buildBlock(99, unknownPayload);

    const buffer = buildSnapGeneFile(seq, {
      extraBlocks: [unknownBlock],
      notes: { Description: "Test with unknown block" },
    });
    const result = parseSnapGene(buffer);

    expect(result.sequence).toBe(seq);
    expect(result.name).toBe("Test with unknown block");
  });

  it("parses features with qualifiers", () => {
    const seq = "ATCGATCGATCGATCGATCGATCGATCG";
    const features = [
      {
        name: "GFP",
        type: "CDS",
        start: 5,
        end: 20,
        strand: 1 as const,
        qualifiers: { color: "#00FF00", gene: "egfp" },
      },
    ];
    const buffer = buildSnapGeneFile(seq, { features });
    const result = parseSnapGene(buffer);

    expect(result.features).toHaveLength(1);
    expect(result.features[0].qualifiers).toBeDefined();
    expect(result.features[0].qualifiers!.color).toBe("#00FF00");
    expect(result.features[0].qualifiers!.gene).toBe("egfp");
  });

  it("throws on invalid leading byte", () => {
    const buffer = buildSnapGeneFile("ATCG");
    const bytes = new Uint8Array(buffer);
    bytes[0] = 0xff;
    expect(() => parseSnapGene(bytes.buffer)).toThrow("expected leading byte 0x09");
  });

  it("throws on wrong magic bytes", () => {
    const buffer = new Uint8Array(19);
    buffer[0] = 0x09;
    writeUint32BE(buffer as unknown as Uint8Array, 1, 14);
    buffer.set(ascii("NotGene!"), 5);
    writeUint16BE(buffer as unknown as Uint8Array, 13, 1);
    writeUint16BE(buffer as unknown as Uint8Array, 15, 1);
    writeUint16BE(buffer as unknown as Uint8Array, 17, 1);
    expect(() => parseSnapGene(buffer.buffer)).toThrow('expected magic "SnapGene"');
  });

  it("throws when buffer is too small", () => {
    const tiny = new ArrayBuffer(5);
    expect(() => parseSnapGene(tiny)).toThrow("buffer too small");
  });

  it("parses a complex file with all block types", () => {
    const seq = "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG";
    const features = [
      { name: "AmpR", type: "CDS", start: 1, end: 15, strand: 1 as const },
      { name: "ori", type: "rep_origin", start: 30, end: 45, strand: 1 as const },
    ];
    const notes = {
      Description: "pET-28a expression vector",
      Author: "Novagen",
    };
    const primerPayload = ascii("<Primers><Primer name='Fwd' sequence='ATCG'/></Primers>");
    const primerBlock = buildBlock(5, primerPayload);

    const buffer = buildSnapGeneFile(seq, {
      circular: true,
      features,
      notes,
      extraBlocks: [primerBlock],
    });

    const result = parseSnapGene(buffer);

    expect(result.name).toBe("pET-28a expression vector");
    expect(result.sequence).toBe(seq);
    expect(result.topology).toBe("circular");
    expect(result.isDoubleStranded).toBe(true);
    expect(result.features).toHaveLength(2);
    expect(result.features[0].name).toBe("AmpR");
    expect(result.features[1].name).toBe("ori");
    expect(result.notes.Description).toBe("pET-28a expression vector");
    expect(result.notes.Author).toBe("Novagen");
  });

  it("handles a real-world-sized sequence (4000 bp plasmid)", () => {
    // Generate a 4000 bp sequence
    const bases = "ATCG";
    let seq = "";
    for (let i = 0; i < 4000; i++) {
      seq += bases[i % 4];
    }

    const features = [
      { name: "lacI", type: "CDS", start: 100, end: 1200, strand: 1 as const },
      { name: "T7 promoter", type: "promoter", start: 2000, end: 2050, strand: 1 as const },
      { name: "MCS", type: "misc_feature", start: 2050, end: 2200, strand: 1 as const },
      { name: "T7 terminator", type: "terminator", start: 2300, end: 2400, strand: -1 as const },
      { name: "KanR", type: "CDS", start: 3000, end: 3800, strand: 1 as const },
    ];

    const buffer = buildSnapGeneFile(seq, {
      circular: true,
      features,
      notes: { Description: "pET-28a(+) cloning vector" },
    });

    const result = parseSnapGene(buffer);

    expect(result.sequence).toHaveLength(4000);
    expect(result.topology).toBe("circular");
    expect(result.features).toHaveLength(5);
    expect(result.features[0].name).toBe("lacI");
    expect(result.features[4].name).toBe("KanR");
    expect(result.features[3].strand).toBe(-1);
  });
});
