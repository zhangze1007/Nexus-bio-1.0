/**
 * Data Ingestion Service Tests
 *
 * Tests for ingestPlateReaderData, ingestFCSData, and autoDetectAndIngest.
 * Reuses realistic sample data from the parser test suites.
 */

import {
  ingestPlateReaderData,
  ingestFCSData,
  autoDetectAndIngest,
} from '../src/services/instruments/dataIngestion';

// ─── Test Helpers ────────────────────────────────────────────────

function writeAscii(arr: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    arr[offset + i] = text.charCodeAt(i);
  }
}

function writeAsciiPadded(arr: Uint8Array, offset: number, length: number, value: number): void {
  const s = String(value);
  const padded = s.padStart(length, ' ');
  writeAscii(arr, offset, padded);
}

/**
 * Build a minimal FCS file in memory for testing.
 */
function buildFcsFile(
  version: string,
  params: string[],
  events: number[][],
  extraText?: Record<string, string>,
): Uint8Array {
  const numParams = params.length;
  const numEvents = events.length;

  const textPairs: string[] = [];
  textPairs.push('$MODE', 'L');
  textPairs.push('$DATATYPE', 'F');
  textPairs.push('$BYTEORD', '1,2,3,4');
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

  let textContent = '/';
  for (let i = 0; i < textPairs.length; i++) {
    textContent += textPairs[i];
    textContent += '/';
  }
  while (textContent.length % 4 !== 0) {
    textContent += ' ';
  }

  // Segment layout matching the reference parser test:
  // TEXT end is exclusive, DATA end is exclusive, DATA aligned to 8 bytes
  const headerSize = 58;
  const textStart = headerSize;
  const textEnd = textStart + textContent.length; // exclusive
  const dataStart = Math.ceil(textEnd / 8) * 8; // align to 8 bytes
  const bytesPerEvent = numParams * 4; // float32
  const dataSize = numEvents * bytesPerEvent;
  const dataEnd = dataStart + dataSize; // exclusive
  const totalSize = dataEnd;

  const buffer = new Uint8Array(totalSize);
  writeAscii(buffer, 0, version.padEnd(6));
  writeAsciiPadded(buffer, 10, 8, textStart);
  writeAsciiPadded(buffer, 18, 8, textEnd);
  writeAsciiPadded(buffer, 26, 8, dataStart);
  writeAsciiPadded(buffer, 34, 8, dataEnd);
  writeAsciiPadded(buffer, 42, 8, 0);
  writeAsciiPadded(buffer, 50, 8, 0);
  writeAscii(buffer, textStart, textContent);

  const dataView = new DataView(buffer.buffer, buffer.byteOffset + dataStart, dataSize);
  for (let e = 0; e < numEvents; e++) {
    for (let p = 0; p < numParams; p++) {
      const offset = (e * numParams + p) * 4;
      dataView.setFloat32(offset, events[e][p] ?? 0, true); // little-endian
    }
  }

  return buffer;
}

// ─── Sample Plate Reader Data ────────────────────────────────────

const BMG_CSV = [
  'Instrument:\tCLARIOstar',
  'Date:\t2025-03-15 14:30:00',
  'Measurement:\tAbsorbance 450 nm',
  '',
  '\t1\t2\t3\t4\t5\t6\t7\t8\t9\t10\t11\t12',
  'A\t0.123\t0.456\t0.789\t0.012\t0.345\t0.678\t0.901\t0.234\t0.567\t0.890\t0.111\t0.222',
  'B\t0.111\t0.222\t0.333\t0.444\t0.555\t0.666\t0.777\t0.888\t0.999\t0.100\t0.200\t0.300',
  'C\t0.100\t0.200\t0.300\t0.400\t0.500\t0.600\t0.700\t0.800\t0.900\t1.000\t1.100\t1.200',
  'D\t0.050\t0.150\t0.250\t0.350\t0.450\t0.550\t0.650\t0.750\t0.850\t0.950\t1.050\t1.150',
  'E\t0.001\t0.002\t0.003\t0.004\t0.005\t0.006\t0.007\t0.008\t0.009\t0.010\t0.011\t0.012',
  'F\t0.999\t0.888\t0.777\t0.666\t0.555\t0.444\t0.333\t0.222\t0.111\t0.000\t0.001\t0.002',
  'G\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500',
  'H\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000',
].join('\n');

const TECAN_COLUMNAR = [
  'Date: 2025-04-20',
  'Instrument: Infinite M200',
  '',
  'Well,OD 600nm',
  'A1,0.123',
  'A2,0.456',
  'A3,0.789',
  'B1,0.100',
  'B2,0.200',
  'B3,0.300',
  'C1,0.500',
  'C2,0.500',
  'C3,0.500',
  'H12,0.001',
].join('\n');

// ─── ingestPlateReaderData tests ─────────────────────────────────

describe('ingestPlateReaderData', () => {
  it('parses a BMG CSV and returns correct well count', () => {
    const result = ingestPlateReaderData(BMG_CSV);
    expect(result.format).toBe('plate-reader');
    expect(result.error).toBeUndefined();
    expect(result.records).toBe(96);
    expect(result.data).not.toBeNull();
    if (result.data && 'wells' in result.data) {
      expect(result.data.wells['A01'].value).toBeCloseTo(0.123);
    }
  });

  it('parses a Tecan columnar CSV and returns partial well count', () => {
    const result = ingestPlateReaderData(TECAN_COLUMNAR);
    expect(result.format).toBe('plate-reader');
    expect(result.error).toBeUndefined();
    expect(result.records).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0); // partial plate warning
  });

  it('returns error for empty string input', () => {
    const result = ingestPlateReaderData('');
    expect(result.format).toBe('plate-reader');
    expect(result.records).toBe(0);
    expect(result.error).toBeDefined();
    expect(result.data).toBeNull();
  });

  it('returns error for whitespace-only input', () => {
    const result = ingestPlateReaderData('   \n\t  ');
    expect(result.error).toBeDefined();
    expect(result.data).toBeNull();
  });

  it('includes metadata from parsed result', () => {
    const result = ingestPlateReaderData(BMG_CSV);
    expect(result.metadata).toBeDefined();
    expect(typeof result.metadata).toBe('object');
  });
});

// ─── ingestFCSData tests ─────────────────────────────────────────

describe('ingestFCSData', () => {
  it('parses a valid FCS 3.0 file', () => {
    const fcsBytes = buildFcsFile('FCS3.0', ['FSC', 'SSC', 'FL1'], [
      [100, 200, 300],
      [150, 250, 350],
      [400, 500, 600],
    ]);
    const result = ingestFCSData(fcsBytes.buffer as ArrayBuffer);
    expect(result.format).toBe('fcs');
    expect(result.error).toBeUndefined();
    expect(result.records).toBe(3);
    expect(result.metadata.version).toBe('FCS3.0');
    expect(result.warnings).toEqual([]);
  });

  it('returns error for zero-event FCS file (parser rejects $TOT=0)', () => {
    const fcsBytes = buildFcsFile('FCS2.0', ['FSC', 'SSC'], []);
    const result = ingestFCSData(fcsBytes.buffer as ArrayBuffer);
    expect(result.format).toBe('fcs');
    // The FCS parser throws when $TOT is 0 — ingestion catches and wraps it
    expect(result.error).toBeDefined();
    expect(result.records).toBe(0);
  });

  it('returns error for empty ArrayBuffer', () => {
    const result = ingestFCSData(new ArrayBuffer(0));
    expect(result.error).toBeDefined();
    expect(result.data).toBeNull();
  });

  it('returns error for non-FCS binary data', () => {
    const junk = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    const result = ingestFCSData(junk.buffer as ArrayBuffer);
    expect(result.error).toMatch(/valid FCS header/i);
    expect(result.data).toBeNull();
  });

  it('populates metadata with text params', () => {
    const fcsBytes = buildFcsFile('FCS3.0', ['FSC', 'SSC'], [[1, 2]], {
      '$INST': 'Test Cytometer',
    });
    const result = ingestFCSData(fcsBytes.buffer as ArrayBuffer);
    expect(result.metadata['$INST']).toBe('Test Cytometer');
    expect(result.metadata.numParameters).toBe('2');
  });
});

// ─── autoDetectAndIngest tests ───────────────────────────────────

describe('autoDetectAndIngest', () => {
  it('detects plate reader from .csv extension and parses', () => {
    const result = autoDetectAndIngest(BMG_CSV, 'experiment_001.csv');
    expect(result.format).toBe('plate-reader');
    expect(result.error).toBeUndefined();
    expect(result.records).toBe(96);
  });

  it('detects plate reader from .tsv extension', () => {
    const result = autoDetectAndIngest(BMG_CSV, 'data.tsv');
    expect(result.format).toBe('plate-reader');
    expect(result.records).toBe(96);
  });

  it('detects FCS from .fcs extension with ArrayBuffer input', () => {
    const fcsBytes = buildFcsFile('FCS3.0', ['FSC', 'SSC', 'FL1'], [
      [10, 20, 30],
    ]);
    const result = autoDetectAndIngest(fcsBytes.buffer as ArrayBuffer, 'sample_001.fcs');
    expect(result.format).toBe('fcs');
    expect(result.records).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('falls back to content inspection when extension is unknown', () => {
    const result = autoDetectAndIngest(BMG_CSV, 'noextension');
    expect(result.format).toBe('plate-reader');
    expect(result.warnings.some(w => w.includes('content inspection'))).toBe(true);
    expect(result.records).toBe(96);
  });

  it('returns unknown format for unrecognizable input', () => {
    const result = autoDetectAndIngest('hello world', 'readme.md');
    expect(result.format).toBe('unknown');
    expect(result.error).toMatch(/unable to detect/i);
    expect(result.records).toBe(0);
  });

  it('detects FCS from ArrayBuffer header even without extension', () => {
    const fcsBytes = buildFcsFile('FCS2.0', ['FSC'], [[42]]);
    const result = autoDetectAndIngest(fcsBytes.buffer as ArrayBuffer, 'data.bin');
    expect(result.format).toBe('fcs');
    expect(result.records).toBe(1);
  });

  it('returns error when FCS suggested but string input given', () => {
    const result = autoDetectAndIngest('some text', 'file.fcs');
    expect(result.format).toBe('fcs');
    expect(result.error).toMatch(/not an ArrayBuffer/i);
  });

  it('decodes ArrayBuffer as UTF-8 for plate reader with .csv extension', () => {
    if (typeof TextDecoder === 'undefined') {
      // jsdom in some Node versions lacks TextDecoder — skip
      return;
    }
    // Manual UTF-8 encoding for jsdom compatibility
    const bytes: number[] = [];
    for (let i = 0; i < TECAN_COLUMNAR.length; i++) {
      const code = TECAN_COLUMNAR.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    const buf = new Uint8Array(bytes).buffer as ArrayBuffer;
    const result = autoDetectAndIngest(buf, 'plate.csv');
    expect(result.format).toBe('plate-reader');
    expect(result.records).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('UTF-8'))).toBe(true);
  });
});
