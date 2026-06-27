/**
 * SnapGene .dna Binary File Parser
 *
 * Parses SnapGene's proprietary binary format into Nexus-Bio's internal data model.
 * SnapGene .dna files use a block-based binary structure:
 *   - Header: 0x09 byte, document length, "SnapGene" magic, flags, version
 *   - Blocks: type byte (1) + size (4 bytes big-endian uint32) + payload
 *
 * Block types:
 *   0  = Sequence properties (topology, methylation, DNA sequence)
 *   5  = Primers (XML)
 *   6  = Notes/description (XML)
 *   10 = Features/annotations (XML)
 *
 * Reference: Reverse-engineered format; see dotDNA (MIT) and snapgene_reader.
 * Pure TypeScript — no external dependencies.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SnapGeneFeature {
  /** Feature name (e.g. "AmpR promoter", "lacZ") */
  name: string;
  /** 1-based start position */
  start: number;
  /** 1-based end position (inclusive) */
  end: number;
  /** Strand: 1 = forward, -1 = reverse */
  strand: 1 | -1;
  /** Feature type (e.g. "CDS", "promoter", "terminator", "misc_feature") */
  type: string;
  /** Optional qualifiers from the feature */
  qualifiers?: Record<string, string>;
}

export interface SnapGeneResult {
  /** Sequence name from the file header */
  name: string;
  /** DNA sequence (uppercase A/C/G/T/N) */
  sequence: string;
  /** Annotated features */
  features: SnapGeneFeature[];
  /** Topology: circular or linear */
  topology: "circular" | "linear";
  /** Whether the file is double-stranded */
  isDoubleStranded: boolean;
  /** File export version */
  exportVersion: number;
  /** File import version */
  importVersion: number;
  /** Notes/description text from the file */
  notes: Record<string, string>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SNAPGENE_MAGIC = "SnapGene";

// Block type identifiers
const BLOCK_SEQUENCE = 0;
const BLOCK_PRIMERS = 5;
const BLOCK_NOTES = 6;
const BLOCK_FEATURES = 10;

// Sequence property flag bits (first byte of sequence block)
const FLAG_CIRCULAR = 0x01;
const FLAG_DOUBLE_STRANDED = 0x02;
const FLAG_A_METHYLATED = 0x04;
const FLAG_C_METHYLATED = 0x08;
const FLAG_KI_METHYLATED = 0x10;

// ── Binary helpers ─────────────────────────────────────────────────────────────

class BinaryReader {
  private readonly view: DataView;
  private readonly buffer: ArrayBuffer;
  private offset: number;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
  }

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.buffer.byteLength - this.offset;
  }

  /** Read a single byte and advance. */
  readByte(): number {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  /** Peek at the current byte without advancing. */
  peekByte(): number {
    return this.view.getUint8(this.offset);
  }

  /** Read a big-endian uint16 and advance. */
  readUint16BE(): number {
    const val = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return val;
  }

  /** Read a big-endian uint32 and advance. */
  readUint32BE(): number {
    const val = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return val;
  }

  /** Read N raw bytes as a Uint8Array and advance. */
  readBytes(count: number): Uint8Array {
    const bytes = new Uint8Array(this.buffer, this.offset, count);
    this.offset += count;
    return bytes;
  }

  /** Read N bytes as an ASCII string and advance. */
  readAscii(count: number): string {
    const bytes = this.readBytes(count);
    return String.fromCharCode(...bytes);
  }

  /** Skip N bytes. */
  skip(count: number): void {
    this.offset += count;
  }

  /** Check if there are more bytes to read. */
  hasMore(): boolean {
    return this.offset < this.buffer.byteLength;
  }
}

// ── XML helpers (regex-based, no external dependency) ──────────────────────────

/** Extract text content from the first occurrence of an XML tag. */
function xmlExtractText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/** Extract an attribute value from the first matching tag. */
function xmlExtractAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : "";
}

/** Extract all top-level child elements matching a tag. */
function xmlExtractBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[0]);
  }
  return results;
}

/**
 * Decode a Uint8Array to a UTF-8 string.
 * Pure JS implementation — no TextDecoder dependency (works in Jest/jsdom).
 */
function decodeUtf8(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) {
      // Single-byte ASCII
      result += String.fromCharCode(b);
    } else if (b < 0xe0 && i + 1 < bytes.length) {
      // Two-byte sequence
      result += String.fromCharCode(((b & 0x1f) << 6) | (bytes[++i] & 0x3f));
    } else if (b < 0xf0 && i + 2 < bytes.length) {
      // Three-byte sequence
      result += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f),
      );
    } else if (i + 3 < bytes.length) {
      // Four-byte sequence (surrogate pair)
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[++i] & 0x3f) << 12) |
        ((bytes[++i] & 0x3f) << 6) |
        (bytes[++i] & 0x3f);
      result += String.fromCharCode(
        0xd800 + ((cp - 0x10000) >> 10),
        0xdc00 + ((cp - 0x10000) & 0x3ff),
      );
    } else {
      // Truncated or invalid — emit replacement char
      result += String.fromCharCode(0xfffd);
    }
  }
  return result;
}

// ── Header parsing ─────────────────────────────────────────────────────────────

interface SnapGeneHeader {
  isDna: boolean;
  exportVersion: number;
  importVersion: number;
}

function parseHeader(reader: BinaryReader): SnapGeneHeader {
  // First byte must be 0x09 (tab)
  const firstByte = reader.readByte();
  if (firstByte !== 0x09) {
    throw new Error(
      `Invalid SnapGene file: expected leading byte 0x09, got 0x${firstByte.toString(16).padStart(2, "0")}`
    );
  }

  // Document length (big-endian uint32) — should be 14
  const docLength = reader.readUint32BE();
  if (docLength !== 14) {
    throw new Error(
      `Invalid SnapGene file: expected document length 14, got ${docLength}`
    );
  }

  // Magic bytes: "SnapGene" (8 bytes ASCII)
  const magic = reader.readAscii(8);
  if (magic !== SNAPGENE_MAGIC) {
    throw new Error(
      `Invalid SnapGene file: expected magic "SnapGene", got "${magic}"`
    );
  }

  // isDNA flag (big-endian uint16: 1 = DNA)
  const isDna = reader.readUint16BE() === 1;

  // Export version (big-endian uint16)
  const exportVersion = reader.readUint16BE();

  // Import version (big-endian uint16)
  const importVersion = reader.readUint16BE();

  return { isDna, exportVersion, importVersion };
}

// ── Block parsers ──────────────────────────────────────────────────────────────

/**
 * Parse the sequence properties block (type 0).
 *
 * The first byte is a flags byte:
 *   bit 0: circular (1) / linear (0)
 *   bit 1: double-stranded (1) / single-stranded (0)
 *   bit 2: A methylated
 *   bit 3: C methylated
 *   bit 4: KI methylated
 *
 * Remaining bytes are the DNA sequence as ASCII.
 */
function parseSequenceBlock(
  blockSize: number,
  reader: BinaryReader,
): { topology: "circular" | "linear"; isDoubleStranded: boolean; sequence: string } {
  if (blockSize < 1) {
    throw new Error("Sequence block too small: must be at least 1 byte for flags");
  }

  // Flags byte
  const flags = reader.readByte();
  const topology: "circular" | "linear" =
    (flags & FLAG_CIRCULAR) !== 0 ? "circular" : "linear";
  const isDoubleStranded = (flags & FLAG_DOUBLE_STRANDED) !== 0;

  // DNA sequence (remaining bytes in block)
  const seqLength = blockSize - 1;
  const sequence = reader.readAscii(seqLength).toUpperCase();

  return { topology, isDoubleStranded, sequence };
}

/**
 * Parse a features block (type 10).
 *
 * Features are stored as XML with this structure:
 * <Features>
 *   <Feature name="..." type="..." start="..." end="..." strand="...">
 *     <Q name="color">...</Q>
 *   </Feature>
 * </Features>
 */
function parseFeaturesBlock(blockSize: number, reader: BinaryReader): SnapGeneFeature[] {
  const rawBytes = reader.readBytes(blockSize);
  const xml = decodeUtf8(rawBytes);
  const features: SnapGeneFeature[] = [];

  // Feature tags can be <Feature> or custom tag names with attributes
  const featureBlocks = xmlExtractBlocks(xml, "Feature");

  for (const block of featureBlocks) {
    const name = xmlExtractAttr(block, "Feature", "name") || "unnamed";
    const type = xmlExtractAttr(block, "Feature", "type") || "misc_feature";
    const startStr = xmlExtractAttr(block, "Feature", "start");
    const endStr = xmlExtractAttr(block, "Feature", "end");
    const strandStr = xmlExtractAttr(block, "Feature", "strand");

    const start = Number.parseInt(startStr, 10);
    const end = Number.parseInt(endStr, 10);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      continue; // Skip malformed features
    }

    // Strand: "1" or "-1" or "true"/"false" (SnapGene uses "true" for forward in some versions)
    let strand: 1 | -1 = 1;
    if (strandStr === "-1" || strandStr === "false") {
      strand = -1;
    }

    // Extract qualifiers from <Q> elements (may be self-closing or paired)
    const qualifiers: Record<string, string> = {};
    // Match both <Q name="..." value="..."/>  and <Q name="...">text</Q>
    const qRegex = /<Q\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/Q>)/gi;
    let qMatch: RegExpExecArray | null;
    while ((qMatch = qRegex.exec(block)) !== null) {
      const attrs = qMatch[1];
      const innerText = qMatch[2]?.trim() ?? "";
      const qNameMatch = attrs.match(/name="([^"]*)"/);
      const qValueMatch = attrs.match(/value="([^"]*)"/);
      if (qNameMatch) {
        qualifiers[qNameMatch[1]] = qValueMatch ? qValueMatch[1] : innerText;
      }
    }

    features.push({ name, start, end, strand, type, qualifiers });
  }

  // Also try alternative XML structure with <Segment> children
  if (features.length === 0) {
    // Some SnapGene versions nest features differently
    const altBlocks = xmlExtractBlocks(xml, "FeatureLine");
    for (const block of altBlocks) {
      const name = xmlExtractAttr(block, "FeatureLine", "name") || "unnamed";
      const type = xmlExtractAttr(block, "FeatureLine", "type") || "misc_feature";
      const startStr = xmlExtractAttr(block, "FeatureLine", "start");
      const endStr = xmlExtractAttr(block, "FeatureLine", "end");
      const strandStr = xmlExtractAttr(block, "FeatureLine", "strand");

      const start = Number.parseInt(startStr, 10);
      const end = Number.parseInt(endStr, 10);

      if (Number.isNaN(start) || Number.isNaN(end)) continue;

      let strand: 1 | -1 = 1;
      if (strandStr === "-1" || strandStr === "false") {
        strand = -1;
      }

      features.push({ name, start, end, strand, type });
    }
  }

  return features;
}

/**
 * Parse a notes block (type 6).
 *
 * Notes are stored as XML with simple tag-value pairs:
 * <Notes>
 *   <Description>Some text</Description>
 *   <Author>Name</Author>
 * </Notes>
 */
function parseNotesBlock(blockSize: number, reader: BinaryReader): Record<string, string> {
  const rawBytes = reader.readBytes(blockSize);
  const xml = decodeUtf8(rawBytes);
  const notes: Record<string, string> = {};

  // Extract the inner content of the root element (e.g. <Notes>...</Notes>).
  // This avoids the root tag itself being captured as a note.
  const rootMatch = xml.match(/<(\w+)(?:\s[^>]*)?>([\s\S]*)<\/\1>/);
  const inner = rootMatch ? rootMatch[2] : xml;

  // Match leaf-level tags — those whose content does not contain nested opening tags.
  const tagRegex = /<(\w+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(inner)) !== null) {
    const tag = match[1];
    const text = match[2].trim();
    if (text) {
      notes[tag] = text;
    }
  }

  return notes;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Check whether an ArrayBuffer contains a SnapGene .dna file.
 *
 * Validates the leading byte (0x09), document length (14), and magic bytes ("SnapGene").
 * Does NOT validate the entire file — use `parseSnapGene()` for full parsing.
 *
 * @param buffer - Raw file bytes as an ArrayBuffer
 * @returns true if the buffer appears to be a valid SnapGene file
 */
export function isSnapGeneFile(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 15) {
    return false;
  }

  try {
    const reader = new BinaryReader(buffer);

    // Leading byte: 0x09
    const firstByte = reader.readByte();
    if (firstByte !== 0x09) return false;

    // Document length: must be 14
    const docLength = reader.readUint32BE();
    if (docLength !== 14) return false;

    // Magic: "SnapGene"
    const magic = reader.readAscii(8);
    return magic === SNAPGENE_MAGIC;
  } catch {
    return false;
  }
}

/**
 * Parse a SnapGene .dna binary file into a structured result.
 *
 * Extracts:
 * - Sequence name and DNA sequence
 * - Feature annotations (name, start, end, strand, type)
 * - Topology (circular/linear)
 * - Strandedness, version info, and notes
 *
 * @param buffer - Raw .dna file bytes as an ArrayBuffer
 * @returns Parsed SnapGene result
 * @throws Error if the buffer is not a valid SnapGene file
 */
export function parseSnapGene(buffer: ArrayBuffer): SnapGeneResult {
  if (!buffer || buffer.byteLength < 15) {
    throw new Error("Invalid SnapGene file: buffer too small");
  }

  const reader = new BinaryReader(buffer);

  // Parse header
  const header = parseHeader(reader);

  // Default result (populated as blocks are parsed)
  let sequence = "";
  let topology: "circular" | "linear" = "linear";
  let isDoubleStranded = false;
  const features: SnapGeneFeature[] = [];
  const notes: Record<string, string> = {};

  // Parse blocks until EOF
  while (reader.hasMore()) {
    // Need at least 5 bytes for block header (1 type + 4 size)
    if (reader.remaining < 5) {
      // Trailing bytes — not uncommon in some SnapGene exports
      break;
    }

    const blockType = reader.readByte();
    const blockSize = reader.readUint32BE();

    // Sanity check: block size must not exceed remaining buffer
    if (blockSize > reader.remaining) {
      throw new Error(
        `Corrupt SnapGene file: block type ${blockType} claims size ${blockSize} but only ${reader.remaining} bytes remain`
      );
    }

    switch (blockType) {
      case BLOCK_SEQUENCE: {
        const seqResult = parseSequenceBlock(blockSize, reader);
        sequence = seqResult.sequence;
        topology = seqResult.topology;
        isDoubleStranded = seqResult.isDoubleStranded;
        break;
      }

      case BLOCK_FEATURES: {
        const parsedFeatures = parseFeaturesBlock(blockSize, reader);
        features.push(...parsedFeatures);
        break;
      }

      case BLOCK_NOTES: {
        const parsedNotes = parseNotesBlock(blockSize, reader);
        Object.assign(notes, parsedNotes);
        break;
      }

      case BLOCK_PRIMERS: {
        // Primers are not in scope — skip the block
        reader.skip(blockSize);
        break;
      }

      default: {
        // Unknown block type — skip
        reader.skip(blockSize);
        break;
      }
    }
  }

  // Derive the sequence name from notes or default
  const name = notes["Description"] || notes["Name"] || "Unnamed Sequence";

  return {
    name,
    sequence,
    features,
    topology,
    isDoubleStranded,
    exportVersion: header.exportVersion,
    importVersion: header.importVersion,
    notes,
  };
}
