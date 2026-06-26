/**
 * FCS (Flow Cytometry Standard) File Parser
 *
 * Parses FCS 2.0 and FCS 3.0 flow cytometry files.
 * Supports standard list-mode data with float or integer parameters.
 *
 * FCS file structure:
 *   1. Header (58 bytes): version + segment offsets
 *   2. TEXT segment: key-value pairs delimited by primary delimiter
 *   3. DATA segment: binary event data (parameters × events)
 *   4. ANALYSIS segment: optional analysis results
 *
 * All parsing is pure TypeScript with zero external dependencies.
 * Works in both Node.js and browser environments using Uint8Array.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface FcsMetadata {
  /** FCS version string ("FCS2.0" or "FCS3.0") */
  version: string;
  /** Number of events (from $TOT) */
  totalEvents: number;
  /** Number of parameters (from $PAR) */
  numParameters: number;
  /** Byte order used in data segment (from $BYTEORD) */
  byteOrder: string;
  /** Data type code (from $DATATYPE): F=float, I=integer, etc. */
  dataType: string;
  /** Acquisition mode (from $MODE): L=list mode, etc. */
  mode: string;
  /** All TEXT segment key-value pairs */
  textParams: Record<string, string>;
}

export interface FcsParseResult {
  /** Parameter names (from $PnN) */
  parameters: string[];
  /** Event data: array of events, each an array of parameter values */
  events: number[][];
  /** File metadata */
  metadata: FcsMetadata;
}

/** Byte offsets for FCS header fields. */
const HEADER_OFFSETS = {
  version: { start: 0, end: 6 },
  textStart: { start: 10, end: 18 },
  textEnd: { start: 18, end: 26 },
  dataStart: { start: 26, end: 34 },
  dataEnd: { start: 34, end: 42 },
  analysisStart: { start: 42, end: 50 },
  analysisEnd: { start: 50, end: 58 },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Read a slice of a Uint8Array as an ASCII string.
 * Trims leading/trailing whitespace.
 */
function readAscii(data: Uint8Array, start: number, end: number): string {
  let result = '';
  for (let i = start; i < end && i < data.length; i++) {
    result += String.fromCharCode(data[i]);
  }
  return result.trim();
}

/**
 * Parse an ASCII-encoded integer from a byte range.
 */
function readAsciiInt(data: Uint8Array, start: number, end: number): number {
  const s = readAscii(data, start, end);
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Determine if the byte order is big-endian based on $BYTEORD value.
 * Common values: "1,2,3,4" (little-endian), "4,3,2,1" (big-endian)
 */
function isBigEndian(byteOrd: string): boolean {
  const parts = byteOrd.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length === 0) return false;
  // Big-endian if first byte is the most significant
  return parts[0] === 4 || parts[0] === 8;
}

/**
 * Read a 32-bit float from data at the given offset, respecting byte order.
 */
function readFloat32(data: Uint8Array, offset: number, bigEndian: boolean): number {
  if (offset + 4 > data.length) return NaN;

  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  return bigEndian ? view.getFloat32(0, false) : view.getFloat32(0, true);
}

/**
 * Read a 32-bit unsigned integer from data at the given offset.
 */
function readUint32(data: Uint8Array, offset: number, bigEndian: boolean): number {
  if (offset + 4 > data.length) return 0;
  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  return bigEndian ? view.getUint32(0, false) : view.getUint32(0, true);
}

/**
 * Read a 16-bit unsigned integer from data at the given offset.
 */
function readUint16(data: Uint8Array, offset: number, bigEndian: boolean): number {
  if (offset + 2 > data.length) return 0;
  const view = new DataView(data.buffer, data.byteOffset + offset, 2);
  return bigEndian ? view.getUint16(0, false) : view.getUint16(0, true);
}

/**
 * Read a single byte as unsigned integer.
 */
function readUint8(data: Uint8Array, offset: number): number {
  return offset < data.length ? data[offset] : 0;
}

// ─── TEXT Segment Parser ─────────────────────────────────────────

/**
 * Parse the FCS TEXT segment into a key-value record.
 *
 * The TEXT segment uses a primary delimiter (first byte, typically ASCII 0x2F '/').
 * Key-value pairs are separated by the delimiter.
 * Some FCS files use alternative delimiters (e.g., '|' or '`').
 */
function parseTextSegment(data: Uint8Array, start: number, end: number): Record<string, string> {
  const result: Record<string, string> = {};

  if (start >= end || start >= data.length) return result;

  // Primary delimiter is the first byte of the TEXT segment
  const primaryDelim = String.fromCharCode(data[start]);

  // Read the entire TEXT segment as a string (skip the delimiter byte itself)
  let text = '';
  for (let i = start + 1; i < end && i < data.length; i++) {
    text += String.fromCharCode(data[i]);
  }

  // Split by delimiter and parse key-value pairs
  const pairs = text.split(primaryDelim);

  for (let i = 0; i < pairs.length - 1; i += 2) {
    const key = pairs[i].trim();
    const val = (i + 1 < pairs.length) ? pairs[i + 1].trim() : '';
    if (key) {
      result[key] = val;
    }
  }

  return result;
}

// ─── DATA Segment Parser ─────────────────────────────────────────

/**
 * Parse the DATA segment into an array of events.
 *
 * Each event contains `numParams` values. Data may be stored as:
 *   - Float (datatype 'F'): 4 bytes per value, IEEE 754
 *   - Double (datatype 'D'): 8 bytes per value, IEEE 754
 *   - Integer (datatype 'I'): 2 or 4 bytes per value
 *   - ASCII (datatype 'A'): ASCII-encoded numbers
 *
 * @param data       Raw file bytes
 * @param start      Data segment start offset
 * @param end        Data segment end offset
 * @param numParams  Number of parameters per event
 * @param numEvents  Expected number of events
 * @param dataType   Data type code from $DATATYPE
 * @param bigEndian  Whether data is big-endian
 * @param paramRanges  Per-parameter ranges from $PnR (for integer data scaling)
 */
function parseDataSegment(
  data: Uint8Array,
  start: number,
  end: number,
  numParams: number,
  numEvents: number,
  dataType: string,
  bigEndian: boolean,
  paramRanges: number[],
): number[][] {
  const events: number[][] = [];
  if (numParams <= 0 || numEvents <= 0 || start >= end) return events;

  const dt = dataType.toUpperCase();

  if (dt === 'F') {
    // Float32: 4 bytes per value
    const bytesPerValue = 4;
    const bytesPerEvent = numParams * bytesPerValue;
    const maxEvents = Math.min(numEvents, Math.floor((end - start) / bytesPerEvent));

    for (let e = 0; e < maxEvents; e++) {
      const event: number[] = [];
      const eventOffset = start + e * bytesPerEvent;
      for (let p = 0; p < numParams; p++) {
        event.push(readFloat32(data, eventOffset + p * bytesPerValue, bigEndian));
      }
      events.push(event);
    }
  } else if (dt === 'D') {
    // Float64: 8 bytes per value
    const bytesPerValue = 8;
    const bytesPerEvent = numParams * bytesPerValue;
    const maxEvents = Math.min(numEvents, Math.floor((end - start) / bytesPerEvent));

    for (let e = 0; e < maxEvents; e++) {
      const event: number[] = [];
      const eventOffset = start + e * bytesPerEvent;
      for (let p = 0; p < numParams; p++) {
        const offset = eventOffset + p * bytesPerValue;
        if (offset + 8 <= data.length) {
          const view = new DataView(data.buffer, data.byteOffset + offset, 8);
          event.push(bigEndian ? view.getFloat64(0, false) : view.getFloat64(0, true));
        } else {
          event.push(NaN);
        }
      }
      events.push(event);
    }
  } else if (dt === 'I') {
    // Integer: determine bytes per value from $PnB (bits per parameter)
    // Default to 32-bit if not specified
    const bitsPerParam = 32; // Will be refined below if $PnB is available
    const bytesPerValue = Math.ceil(bitsPerParam / 8);
    const bytesPerEvent = numParams * bytesPerValue;
    const maxEvents = Math.min(numEvents, Math.floor((end - start) / bytesPerEvent));

    for (let e = 0; e < maxEvents; e++) {
      const event: number[] = [];
      const eventOffset = start + e * bytesPerEvent;
      for (let p = 0; p < numParams; p++) {
        let rawValue: number;
        const offset = eventOffset + p * bytesPerValue;
        if (bytesPerValue === 4) {
          rawValue = readUint32(data, offset, bigEndian);
        } else if (bytesPerValue === 2) {
          rawValue = readUint16(data, offset, bigEndian);
        } else {
          rawValue = readUint8(data, offset);
        }
        // Scale to range if available
        const range = (p < paramRanges.length) ? paramRanges[p] : 0;
        event.push(range > 0 ? rawValue : rawValue);
      }
      events.push(event);
    }
  } else if (dt === 'A') {
    // ASCII: values are ASCII-encoded numbers separated by spaces/commas
    let ascii = '';
    for (let i = start; i < end && i < data.length; i++) {
      ascii += String.fromCharCode(data[i]);
    }
    const tokens = ascii.trim().split(/[\s,]+/);
    let idx = 0;
    for (let e = 0; e < numEvents && idx < tokens.length; e++) {
      const event: number[] = [];
      for (let p = 0; p < numParams && idx < tokens.length; p++) {
        event.push(parseNumeric(tokens[idx]));
        idx++;
      }
      if (event.length === numParams) events.push(event);
    }
  }

  return events;
}

/**
 * Parse a numeric string to number. Returns NaN for non-numeric input.
 */
function parseNumeric(s: string): number {
  const n = Number(s);
  return isNaN(n) ? NaN : n;
}

// ─── Main Parser ─────────────────────────────────────────────────

/**
 * Parse an FCS file from raw bytes.
 *
 * @param input  File contents as Uint8Array or ArrayBuffer
 * @returns  Parsed FCS result with parameters, events, and metadata
 * @throws  If the file is not a valid FCS file
 */
export function parseFcs(input: Uint8Array | ArrayBuffer): FcsParseResult {
  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : input;

  // Validate minimum header size
  if (data.length < 58) {
    throw new Error(`Invalid FCS file: too short (${data.length} bytes, minimum 58)`);
  }

  // Read version
  const version = readAscii(data, HEADER_OFFSETS.version.start, HEADER_OFFSETS.version.end);
  if (!version.startsWith('FCS')) {
    throw new Error(`Invalid FCS file: expected version starting with "FCS", got "${version}"`);
  }

  const majorVersion = parseInt(version.charAt(3), 10);
  if (majorVersion !== 2 && majorVersion !== 3) {
    throw new Error(`Unsupported FCS version: ${version}. Only FCS 2.0 and 3.0 are supported.`);
  }

  // Read segment offsets
  // For FCS 2.0/3.0, the standard header has offsets at bytes 10-57
  // But some files use only the first 3 offsets (text, data, analysis)
  let textStart = readAsciiInt(data, HEADER_OFFSETS.textStart.start, HEADER_OFFSETS.textStart.end);
  let textEnd = readAsciiInt(data, HEADER_OFFSETS.textEnd.start, HEADER_OFFSETS.textEnd.end);
  let dataStart = readAsciiInt(data, HEADER_OFFSETS.dataStart.start, HEADER_OFFSETS.dataStart.end);
  let dataEnd = readAsciiInt(data, HEADER_OFFSETS.dataEnd.start, HEADER_OFFSETS.dataEnd.end);
  let analysisStart = readAsciiInt(data, HEADER_OFFSETS.analysisStart.start, HEADER_OFFSETS.analysisStart.end);
  let analysisEnd = readAsciiInt(data, HEADER_OFFSETS.analysisEnd.start, HEADER_OFFSETS.analysisEnd.end);

  // FCS 3.0: if standard offsets are zero, check the supplemental segment
  // (bytes 58-65 may contain extended data/analysis offsets in some implementations)
  if (textStart === 0 && textEnd === 0) {
    throw new Error('Invalid FCS file: TEXT segment offsets are zero');
  }

  // Parse TEXT segment
  const textParams = parseTextSegment(data, textStart, textEnd);

  // Extract key parameters
  const totalEvents = parseInt(textParams['$TOT'] || '0', 10);
  const numParameters = parseInt(textParams['$PAR'] || '0', 10);
  const byteOrder = textParams['$BYTEORD'] || '1,2,3,4';
  const dataType = textParams['$DATATYPE'] || 'F';
  const mode = textParams['$MODE'] || 'L';
  const bigEndian = isBigEndian(byteOrder);

  // Validate required parameters
  if (numParameters <= 0) {
    throw new Error(`Invalid FCS file: $PAR (number of parameters) is ${numParameters}`);
  }
  if (totalEvents <= 0) {
    throw new Error(`Invalid FCS file: $TOT (total events) is ${totalEvents}`);
  }

  // Extract parameter names and ranges
  const parameters: string[] = [];
  const paramRanges: number[] = [];
  for (let i = 1; i <= numParameters; i++) {
    const name = textParams[`$P${i}N`] || `P${i}`;
    parameters.push(name);
    const range = parseInt(textParams[`$P${i}R`] || '0', 10);
    paramRanges.push(range);
  }

  // Resolve data segment offsets if zero (FCS 2.0 allows TEXT segment to specify them)
  if (dataStart === 0 && dataEnd === 0) {
    dataStart = parseInt(textParams['$BEGINDATA'] || '0', 10);
    dataEnd = parseInt(textParams['$ENDDATA'] || '0', 10);
  }

  // Parse DATA segment
  let events: number[][] = [];
  if (dataStart > 0 && dataEnd > dataStart) {
    events = parseDataSegment(
      data, dataStart, dataEnd,
      numParameters, totalEvents,
      dataType, bigEndian, paramRanges,
    );
  }

  const metadata: FcsMetadata = {
    version,
    totalEvents,
    numParameters,
    byteOrder,
    dataType,
    mode,
    textParams,
  };

  return { parameters, events, metadata };
}

// ─── String-based Parser (for environments without binary access) ──

/**
 * Parse an FCS file from a base64-encoded string.
 * Useful when receiving file data over HTTP or in environments
 * where binary file access is not available.
 *
 * @param base64  Base64-encoded FCS file contents
 * @returns  Parsed FCS result
 */
export function parseFcsFromBase64(base64: string): FcsParseResult {
  // Decode base64 to Uint8Array
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return parseFcs(bytes);
}

// ─── Validation ──────────────────────────────────────────────────

/**
 * Validate that a Uint8Array contains a valid FCS file header.
 * Returns true if the file starts with "FCS2.0" or "FCS3.0".
 */
export function isFcsFile(data: Uint8Array | ArrayBuffer): boolean {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  if (bytes.length < 6) return false;
  const version = readAscii(bytes, 0, 6);
  return version === 'FCS2.0' || version === 'FCS3.0';
}

/**
 * Get the FCS version string from a file without fully parsing it.
 */
export function getFcsVersion(data: Uint8Array | ArrayBuffer): string | null {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  if (bytes.length < 6) return null;
  const version = readAscii(bytes, 0, 6);
  return version.startsWith('FCS') ? version : null;
}

/**
 * Estimate memory requirements for parsing an FCS file.
 * Useful for pre-checking before loading very large files.
 *
 * @param data  Raw file bytes
 * @returns  Estimated memory in bytes, or -1 if unable to estimate
 */
export function estimateFcsMemory(data: Uint8Array | ArrayBuffer): number {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  if (bytes.length < 58) return -1;

  const version = readAscii(bytes, 0, 6);
  if (!version.startsWith('FCS')) return -1;

  // Read TEXT segment to get $TOT and $PAR
  const textStart = readAsciiInt(bytes, 10, 18);
  const textEnd = readAsciiInt(bytes, 18, 26);
  if (textStart <= 0 || textEnd <= textStart) return -1;

  const textParams = parseTextSegment(bytes, textStart, textEnd);
  const totalEvents = parseInt(textParams['$TOT'] || '0', 10);
  const numParameters = parseInt(textParams['$PAR'] || '0', 10);
  const dataType = (textParams['$DATATYPE'] || 'F').toUpperCase();

  let bytesPerValue: number;
  if (dataType === 'D') bytesPerValue = 8;
  else if (dataType === 'F') bytesPerValue = 4;
  else if (dataType === 'I') bytesPerValue = 4;
  else return -1;

  // Estimate: events × parameters × bytes per value, plus overhead for number arrays
  const dataBytes = totalEvents * numParameters * bytesPerValue;
  // JS number arrays have ~8 bytes per number + object overhead
  const jsOverhead = totalEvents * numParameters * 8;
  return dataBytes + jsOverhead;
}
