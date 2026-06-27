/**
 * FCS Parser Tests
 *
 * Tests for FCS 2.0 and FCS 3.0 flow cytometry file parsing.
 * Builds binary FCS data programmatically for reproducible testing.
 */

import {
  parseFcs,
  parseFcsFromBase64,
  isFcsFile,
  getFcsVersion,
  estimateFcsMemory,
} from '../../src/services/instruments/fcsParser';

// ─── Test Helpers ────────────────────────────────────────────────

/**
 * Write an ASCII string into a Uint8Array at a given offset.
 */
function writeAscii(arr: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    arr[offset + i] = text.charCodeAt(i);
  }
}

/**
 * Write a number as zero-padded ASCII into a Uint8Array field.
 */
function writeAsciiPadded(arr: Uint8Array, offset: number, length: number, value: number): void {
  const s = String(value);
  const padded = s.padStart(length, ' ');
  writeAscii(arr, offset, padded);
}

/**
 * Build a minimal FCS file in memory for testing.
 *
 * @param version    "FCS2.0" or "FCS3.0"
 * @param params     Parameter names (e.g., ["FSC", "SSC", "FL1"])
 * @param events     Array of events, each an array of float values
 * @param extraText  Additional TEXT segment key-value pairs
 */
function buildFcsFile(
  version: string,
  params: string[],
  events: number[][],
  extraText?: Record<string, string>,
): Uint8Array {
  const numParams = params.length;
  const numEvents = events.length;

  // Build TEXT segment
  // Primary delimiter: '/'
  const textPairs: string[] = [];
  textPairs.push('$MODE', 'L');
  textPairs.push('$DATATYPE', 'F');
  textPairs.push('$BYTEORD', '1,2,3,4'); // little-endian
  textPairs.push('$PAR', String(numParams));
  textPairs.push('$TOT', String(numEvents));
  for (let i = 0; i < numParams; i++) {
    textPairs.push(`$P${i + 1}N`, params[i]);
    textPairs.push(`$P${i + 1}R`, '1024');
    textPairs.push(`$P${i + 1}E`, '0,0');
  }
  if (extraText) {
    for (const [k, v] of Object.entries(extraText)) {
      textPairs.push(k, v);
    }
  }

  // Build text string with '/' delimiter
  let textContent = '/';
  for (let i = 0; i < textPairs.length; i++) {
    textContent += textPairs[i];
    textContent += '/';
  }

  // Pad TEXT segment to align nicely
  while (textContent.length % 4 !== 0) {
    textContent += ' ';
  }

  // Segment layout:
  // Header: bytes 0-57 (58 bytes)
  // TEXT: bytes 58 to 58 + textContent.length - 1
  // DATA: starts after TEXT, aligned to 8 bytes
  const headerSize = 58;
  const textStart = headerSize;
  const textEnd = textStart + textContent.length;
  // Align data start to 8 bytes
  const dataStart = Math.ceil(textEnd / 8) * 8;
  const bytesPerEvent = numParams * 4; // float32
  const dataSize = numEvents * bytesPerEvent;
  const dataEnd = dataStart + dataSize;

  const totalSize = dataEnd;
  const file = new Uint8Array(totalSize);

  // Write header
  writeAscii(file, 0, version.padEnd(6));
  // Bytes 6-9: unused in standard FCS
  writeAsciiPadded(file, 10, 8, textStart);
  writeAsciiPadded(file, 18, 8, textEnd);
  writeAsciiPadded(file, 26, 8, dataStart);
  writeAsciiPadded(file, 34, 8, dataEnd);
  writeAsciiPadded(file, 42, 8, 0); // analysis start
  writeAsciiPadded(file, 50, 8, 0); // analysis end

  // Write TEXT segment
  writeAscii(file, textStart, textContent);

  // Write DATA segment (float32, little-endian)
  const dataView = new DataView(file.buffer, file.byteOffset + dataStart, dataSize);
  for (let e = 0; e < numEvents; e++) {
    for (let p = 0; p < numParams; p++) {
      const offset = (e * numParams + p) * 4;
      dataView.setFloat32(offset, events[e][p] ?? 0, true); // little-endian
    }
  }

  return file;
}

/**
 * Encode a Uint8Array to base64 string.
 */
function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

// ─── Sample Data ─────────────────────────────────────────────────

/** Simple 3-parameter, 5-event FCS 2.0 file. */
const SIMPLE_EVENTS: number[][] = [
  [100.5, 200.3, 50.1],
  [150.0, 250.7, 75.2],
  [200.1, 300.0, 100.0],
  [125.5, 225.5, 62.5],
  [175.0, 275.0, 87.5],
];

const SIMPLE_PARAMS = ['FSC', 'SSC', 'FL1'];

/** Larger dataset: 4 parameters, 100 events. */
function generateLargeEvents(): number[][] {
  const events: number[][] = [];
  // Use a deterministic seed-like approach for reproducibility
  for (let i = 0; i < 100; i++) {
    events.push([
      100 + (i % 50) * 2,
      200 + (i % 30) * 3,
      50 + (i % 20) * 5,
      10 + (i % 10) * 10,
    ]);
  }
  return events;
}

const LARGE_EVENTS = generateLargeEvents();
const LARGE_PARAMS = ['FSC-A', 'SSC-A', 'FL1-A', 'FL2-A'];

// ─── Tests ───────────────────────────────────────────────────────

describe('isFcsFile', () => {
  it('returns true for valid FCS 2.0 header', () => {
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    expect(isFcsFile(file)).toBe(true);
  });

  it('returns true for valid FCS 3.0 header', () => {
    const file = buildFcsFile('FCS3.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    expect(isFcsFile(file)).toBe(true);
  });

  it('returns false for non-FCS data', () => {
    const notFcs = new Uint8Array([0x50, 0x44, 0x46, 0x2D]); // "PDF-"
    expect(isFcsFile(notFcs)).toBe(false);
  });

  it('returns false for too-short data', () => {
    expect(isFcsFile(new Uint8Array(3))).toBe(false);
    expect(isFcsFile(new Uint8Array(0))).toBe(false);
  });
});

describe('getFcsVersion', () => {
  it('returns "FCS2.0" for FCS 2.0 files', () => {
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    expect(getFcsVersion(file)).toBe('FCS2.0');
  });

  it('returns "FCS3.0" for FCS 3.0 files', () => {
    const file = buildFcsFile('FCS3.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    expect(getFcsVersion(file)).toBe('FCS3.0');
  });

  it('returns null for non-FCS data', () => {
    const random = new Uint8Array([1, 2, 3, 4, 5, 6]);
    expect(getFcsVersion(random)).toBeNull();
  });
});

describe('parseFcs', () => {
  it('parses a simple FCS 2.0 file with correct parameters', () => {
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    const result = parseFcs(file);

    expect(result.parameters).toEqual(['FSC', 'SSC', 'FL1']);
    expect(result.metadata.version).toBe('FCS2.0');
    expect(result.metadata.numParameters).toBe(3);
    expect(result.metadata.totalEvents).toBe(5);
  });

  it('parses correct number of events', () => {
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    const result = parseFcs(file);

    expect(result.events.length).toBe(5);
    expect(result.events[0].length).toBe(3);
  });

  it('parses float values correctly', () => {
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    const result = parseFcs(file);

    // Allow small floating-point tolerance
    expect(result.events[0][0]).toBeCloseTo(100.5, 1);
    expect(result.events[0][1]).toBeCloseTo(200.3, 1);
    expect(result.events[0][2]).toBeCloseTo(50.1, 1);
    expect(result.events[2][0]).toBeCloseTo(200.1, 1);
  });

  it('parses FCS 3.0 files identically to FCS 2.0', () => {
    const file2 = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    const file3 = buildFcsFile('FCS3.0', SIMPLE_PARAMS, SIMPLE_EVENTS);

    const result2 = parseFcs(file2);
    const result3 = parseFcs(file3);

    expect(result3.metadata.version).toBe('FCS3.0');
    expect(result3.parameters).toEqual(result2.parameters);
    expect(result3.events.length).toBe(result2.events.length);

    for (let e = 0; e < result2.events.length; e++) {
      for (let p = 0; p < result2.events[e].length; p++) {
        expect(result3.events[e][p]).toBeCloseTo(result2.events[e][p], 4);
      }
    }
  });

  it('handles a larger dataset (100 events, 4 parameters)', () => {
    const file = buildFcsFile('FCS2.0', LARGE_PARAMS, LARGE_EVENTS);
    const result = parseFcs(file);

    expect(result.parameters).toEqual(['FSC-A', 'SSC-A', 'FL1-A', 'FL2-A']);
    expect(result.events.length).toBe(100);
    expect(result.events[0].length).toBe(4);
    expect(result.events[0][0]).toBeCloseTo(100, 0);
    expect(result.events[0][1]).toBeCloseTo(200, 0);
  });

  it('includes TEXT segment parameters in metadata', () => {
    const extra = { '$COMP': 'FSC,SSC,FL1', '$CYT': 'FACScan' };
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS, extra);
    const result = parseFcs(file);

    expect(result.metadata.textParams['$COMP']).toBe('FSC,SSC,FL1');
    expect(result.metadata.textParams['$CYT']).toBe('FACScan');
    expect(result.metadata.textParams['$MODE']).toBe('L');
    expect(result.metadata.textParams['$DATATYPE']).toBe('F');
  });

  it('accepts ArrayBuffer input', () => {
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const result = parseFcs(buffer);

    expect(result.parameters).toEqual(['FSC', 'SSC', 'FL1']);
    expect(result.events.length).toBe(5);
  });

  it('throws on too-short input', () => {
    expect(() => parseFcs(new Uint8Array(10))).toThrow('too short');
  });

  it('throws on non-FCS magic bytes', () => {
    const bad = new Uint8Array(100);
    writeAscii(bad, 0, 'NOTFCS');
    expect(() => parseFcs(bad)).toThrow('expected version starting with "FCS"');
  });

  it('throws on unsupported FCS version', () => {
    const bad = new Uint8Array(100);
    writeAscii(bad, 0, 'FCS1.0');
    expect(() => parseFcs(bad)).toThrow('Unsupported FCS version');
  });
});

describe('parseFcsFromBase64', () => {
  it('parses a base64-encoded FCS file', () => {
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    const b64 = toBase64(file);
    const result = parseFcsFromBase64(b64);

    expect(result.parameters).toEqual(['FSC', 'SSC', 'FL1']);
    expect(result.events.length).toBe(5);
    expect(result.events[0][0]).toBeCloseTo(100.5, 1);
  });

  it('produces identical results to direct binary parsing', () => {
    const file = buildFcsFile('FCS3.0', LARGE_PARAMS, LARGE_EVENTS);
    const b64 = toBase64(file);

    const direct = parseFcs(file);
    const fromBase64 = parseFcsFromBase64(b64);

    expect(fromBase64.parameters).toEqual(direct.parameters);
    expect(fromBase64.events.length).toBe(direct.events.length);
    for (let e = 0; e < direct.events.length; e++) {
      for (let p = 0; p < direct.events[e].length; p++) {
        expect(fromBase64.events[e][p]).toBeCloseTo(direct.events[e][p], 4);
      }
    }
  });
});

describe('estimateFcsMemory', () => {
  it('estimates memory for a valid FCS file', () => {
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, SIMPLE_EVENTS);
    const estimate = estimateFcsMemory(file);

    expect(estimate).toBeGreaterThan(0);
    // 5 events × 3 params × 4 bytes = 60 bytes data + JS overhead
    expect(estimate).toBeGreaterThan(60);
  });

  it('returns -1 for non-FCS data', () => {
    expect(estimateFcsMemory(new Uint8Array(10))).toBe(-1);
  });

  it('returns -1 for too-short data', () => {
    expect(estimateFcsMemory(new Uint8Array(2))).toBe(-1);
  });
});

describe('edge cases', () => {
  it('handles single-event file', () => {
    const events: number[][] = [[42.0, 84.0, 126.0]];
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, events);
    const result = parseFcs(file);

    expect(result.events.length).toBe(1);
    expect(result.events[0][0]).toBeCloseTo(42.0, 1);
  });

  it('handles single-parameter file', () => {
    const params = ['FL1'];
    const events: number[][] = [[100], [200], [300]];
    const file = buildFcsFile('FCS2.0', params, events);
    const result = parseFcs(file);

    expect(result.parameters).toEqual(['FL1']);
    expect(result.events.length).toBe(3);
    expect(result.events[0].length).toBe(1);
  });

  it('handles many-parameter file (10 parameters)', () => {
    const params = Array.from({ length: 10 }, (_, i) => `P${i + 1}`);
    const events: number[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, (_, i) => i * 10),
    );
    const file = buildFcsFile('FCS3.0', params, events);
    const result = parseFcs(file);

    expect(result.parameters.length).toBe(10);
    expect(result.events.length).toBe(10);
    expect(result.events[0].length).toBe(10);
    expect(result.events[0][9]).toBeCloseTo(90, 0);
  });

  it('preserves zero values correctly', () => {
    const events: number[][] = [[0, 0, 0]];
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, events);
    const result = parseFcs(file);

    expect(result.events[0][0]).toBeCloseTo(0, 4);
    expect(result.events[0][1]).toBeCloseTo(0, 4);
    expect(result.events[0][2]).toBeCloseTo(0, 4);
  });

  it('handles negative float values', () => {
    const events: number[][] = [[-10.5, -20.3, 0]];
    const file = buildFcsFile('FCS2.0', SIMPLE_PARAMS, events);
    const result = parseFcs(file);

    expect(result.events[0][0]).toBeCloseTo(-10.5, 1);
    expect(result.events[0][1]).toBeCloseTo(-20.3, 1);
  });
});
