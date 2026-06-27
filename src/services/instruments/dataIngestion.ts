/**
 * Data Ingestion Service
 *
 * Unified entry point for ingesting instrument data. Wraps the existing
 * plate reader and FCS parsers behind a common IngestResult contract,
 * with format auto-detection based on filename extension and content
 * inspection.
 *
 * Pure TypeScript, zero external dependencies.
 */

import {
  parsePlateReaderData,
  type PlateReaderResult,
} from './plateReaderParser';

import {
  parseFcs,
  isFcsFile,
  type FcsParseResult,
} from './fcsParser';

// ─── Types ───────────────────────────────────────────────────────

/** Supported ingest formats. */
export type IngestFormat = 'plate-reader' | 'fcs' | 'unknown';

/** Unified result returned by every ingestion function. */
export interface IngestResult {
  /** Detected or specified format. */
  format: IngestFormat;
  /** Number of data records ingested (wells or events). */
  records: number;
  /** Parsed metadata extracted from the source. */
  metadata: Record<string, string>;
  /** Non-fatal warnings generated during parsing. */
  warnings: string[];
  /** Format-specific parsed payload (null when ingestion fails). */
  data: PlateReaderResult | FcsParseResult | null;
  /** Error message when ingestion fails; undefined on success. */
  error?: string;
}

// ─── Ingest: Plate Reader ────────────────────────────────────────

/**
 * Ingest plate reader CSV/XML data.
 *
 * Delegates to `parsePlateReaderData` which auto-detects the vendor
 * (BMG, Tecan, Molecular Devices, SoftMax XML).
 */
export function ingestPlateReaderData(content: string): IngestResult {
  const warnings: string[] = [];

  if (typeof content !== 'string' || content.trim().length === 0) {
    return {
      format: 'plate-reader',
      records: 0,
      metadata: {},
      warnings,
      data: null,
      error: 'Empty or non-string content provided for plate reader ingestion.',
    };
  }

  try {
    const result = parsePlateReaderData(content);
    const wellCount = Object.keys(result.wells).length;

    if (wellCount === 0) {
      warnings.push('No well values were extracted from the input.');
    }

    // Warn on unusual well counts that may indicate partial parse
    if (wellCount > 0 && wellCount < 96) {
      warnings.push(
        `Only ${wellCount} wells parsed; expected 96 or 384 for a full plate.`,
      );
    }

    return {
      format: 'plate-reader',
      records: wellCount,
      metadata: result.metadata,
      warnings,
      data: result,
    };
  } catch (err) {
    return {
      format: 'plate-reader',
      records: 0,
      metadata: {},
      warnings,
      data: null,
      error: `Plate reader parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Ingest: FCS ─────────────────────────────────────────────────

/**
 * Ingest FCS (Flow Cytometry Standard) binary data.
 *
 * Delegates to `parseFcs` which handles FCS 2.0 and 3.0.
 */
export function ingestFCSData(buffer: ArrayBuffer): IngestResult {
  const warnings: string[] = [];

  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
    return {
      format: 'fcs',
      records: 0,
      metadata: {},
      warnings,
      data: null,
      error: 'Empty or non-ArrayBuffer input provided for FCS ingestion.',
    };
  }

  if (!isFcsFile(buffer)) {
    return {
      format: 'fcs',
      records: 0,
      metadata: {},
      warnings,
      data: null,
      error: 'Input does not have a valid FCS header.',
    };
  }

  try {
    const result = parseFcs(buffer);
    const eventCount = result.events.length;

    if (eventCount === 0) {
      warnings.push('FCS file parsed successfully but contains zero events.');
    }

    // Surface text-param keys as flat metadata
    const metadata: Record<string, string> = {
      version: result.metadata.version,
      totalEvents: String(result.metadata.totalEvents),
      numParameters: String(result.metadata.numParameters),
      dataType: result.metadata.dataType,
      mode: result.metadata.mode,
      ...result.metadata.textParams,
    };

    return {
      format: 'fcs',
      records: eventCount,
      metadata,
      warnings,
      data: result,
    };
  } catch (err) {
    return {
      format: 'fcs',
      records: 0,
      metadata: {},
      warnings,
      data: null,
      error: `FCS parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Auto-detect & Ingest ────────────────────────────────────────

/** File extensions that indicate plate reader CSV/XML data. */
const PLATE_EXTENSIONS = ['.csv', '.tsv', '.xml', '.txt'];

/** File extensions that indicate FCS data. */
const FCS_EXTENSIONS = ['.fcs'];

/**
 * Detect format from filename extension.
 */
function detectFormatFromFilename(filename: string): IngestFormat {
  const lower = filename.toLowerCase();
  const dotIndex = lower.lastIndexOf('.');
  if (dotIndex === -1) return 'unknown';
  const ext = lower.slice(dotIndex);

  if (FCS_EXTENSIONS.includes(ext)) return 'fcs';
  if (PLATE_EXTENSIONS.includes(ext)) return 'plate-reader';
  return 'unknown';
}

/**
 * Attempt content-based detection for text that might be FCS or plate data.
 * Checks for the FCS magic header in a string (unlikely but defensive),
 * then falls back to plate reader if the content looks tabular.
 */
function detectFormatFromContent(content: string): IngestFormat {
  // FCS files start with "FCS2.0" or "FCS3.0" — check first 6 chars
  if (content.length >= 6 && /^FCS[23]\.0/.test(content.slice(0, 6))) {
    return 'fcs';
  }
  // If content has commas, tabs, or well-like patterns, assume plate reader
  if (/[,\t]/.test(content) || /[A-P]\d{1,2}/i.test(content)) {
    return 'plate-reader';
  }
  return 'unknown';
}

/**
 * Auto-detect the data format and ingest.
 *
 * Detection priority:
 *   1. Filename extension (most reliable)
 *   2. Content inspection (fallback)
 *
 * For `ArrayBuffer` input without a filename, only FCS header check is used.
 */
export function autoDetectAndIngest(
  content: string | ArrayBuffer,
  filename: string,
): IngestResult {
  const warnings: string[] = [];

  // ── Step 1: Determine format ──
  let format = detectFormatFromFilename(filename);

  if (format === 'unknown' && typeof content === 'string') {
    format = detectFormatFromContent(content);
    if (format !== 'unknown') {
      warnings.push(
        `Format "${format}" detected from content inspection (filename "${filename}" had no recognized extension).`,
      );
    }
  }

  if (format === 'unknown' && content instanceof ArrayBuffer) {
    // Last resort: check FCS header on raw bytes
    if (isFcsFile(content)) {
      format = 'fcs';
      warnings.push('Format "fcs" detected from binary header inspection.');
    }
  }

  // ── Step 2: Dispatch to the appropriate ingester ──
  if (format === 'fcs') {
    if (content instanceof ArrayBuffer) {
      return ingestFCSData(content);
    }
    // String that looks like FCS — cannot parse; return error
    return {
      format: 'fcs',
      records: 0,
      metadata: {},
      warnings,
      data: null,
      error:
        'Filename or content suggests FCS format, but input is a string, not an ArrayBuffer.',
    };
  }

  if (format === 'plate-reader') {
    if (typeof content === 'string') {
      const result = ingestPlateReaderData(content);
      return { ...result, warnings: [...warnings, ...result.warnings] };
    }
    // ArrayBuffer for plate reader — try decoding as UTF-8 text
    try {
      const text = new TextDecoder('utf-8').decode(content);
      const result = ingestPlateReaderData(text);
      warnings.push('ArrayBuffer decoded as UTF-8 for plate reader parsing.');
      return { ...result, warnings: [...warnings, ...result.warnings] };
    } catch (err) {
      return {
        format: 'plate-reader',
        records: 0,
        metadata: {},
        warnings,
        data: null,
        error: `Failed to decode ArrayBuffer as UTF-8: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── Step 3: Unknown format ──
  return {
    format: 'unknown',
    records: 0,
    metadata: {},
    warnings,
    data: null,
    error: `Unable to detect data format for "${filename}". Supported extensions: ${[...PLATE_EXTENSIONS, ...FCS_EXTENSIONS].join(', ')}.`,
  };
}
