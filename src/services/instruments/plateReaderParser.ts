/**
 * Plate Reader Data Parser
 *
 * Parses CSV and XML exports from common plate reader instruments:
 *   - BMG LABTECH (CLARIOstar, NEPHELOstar, PHERAstar)
 *   - Tecan (Infinite, Safire)
 *   - Molecular Devices (SpectraMax, FlexStation)
 *
 * Supports 96-well (8x12) and 384-well (16x24) plate formats.
 * All parsers are pure functions with zero external dependencies.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface WellValue {
  value: number;
  unit: string;
}

export interface PlateReaderResult {
  plateFormat: 96 | 384;
  wells: Record<string, WellValue>;
  metadata: Record<string, string>;
}

export type PlateReaderVendor = 'bmg' | 'tecan' | 'molecular-devices';

// ─── Constants ───────────────────────────────────────────────────

const ROW_LABELS_96 = 'ABCDEFGH'.split('');
const ROW_LABELS_384 = 'ABCDEFGHIJKLMNOP'.split('');

/** Well ID regex: letter(s) followed by 1-2 digit column number. */
const WELL_ID_RE = /^([A-P])(\d{1,2})$/;

/** Maximum column numbers per plate format. */
const MAX_COLS: Record<number, number> = { 96: 12, 384: 24 };

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Parse a numeric value from a string, returning NaN for non-numeric input.
 * Handles common plate reader output formats including scientific notation,
 * comma-thousands-separators, and special flag values.
 */
export function parseNumeric(raw: string): number {
  if (raw == null) return NaN;
  let s = raw.trim();
  if (s === '' || s === '---' || s === 'OVRFLW' || s === '-' || s === 'N/A') {
    return NaN;
  }
  // Remove thousands separator (commas used in some European locales)
  // but only when they appear as thousands grouping (not decimal separator).
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return n;
}

/**
 * Normalize a well ID to canonical form: uppercase letter + zero-padded column.
 * E.g. "a1" → "A01", "B12" → "B12", "p024" → "P24".
 */
export function normalizeWellId(raw: string): string | null {
  const m = raw.trim().toUpperCase().match(WELL_ID_RE);
  if (!m) return null;
  const letter = m[1];
  const col = parseInt(m[2], 10);
  if (col < 1 || col > 24) return null;
  return `${letter}${String(col).padStart(2, '0')}`;
}

/**
 * Detect plate format (96 vs 384) from a set of well IDs.
 * Falls back to 96 if ambiguous.
 */
function detectPlateFormat(wellIds: string[]): 96 | 384 {
  let maxCol = 0;
  const letters = new Set<string>();
  for (const id of wellIds) {
    const m = id.match(WELL_ID_RE);
    if (m) {
      letters.add(m[1]);
      maxCol = Math.max(maxCol, parseInt(m[2], 10));
    }
  }
  if (maxCol > 12 || letters.size > 8) return 384;
  return 96;
}

/**
 * Try to extract a unit string from a header or label.
 * Matches patterns like "(mM)", "[OD]", "Abs 450nm", "Fluorescence (RFU)".
 */
function extractUnit(text: string): string {
  // Explicit unit in parentheses or brackets
  const bracketMatch = text.match(/[\(\[]([^\)\]]+)[\)\]]/);
  if (bracketMatch) return bracketMatch[1].trim();
  // Unit or measurement type at the start or after a space
  const unitMatch = text.match(/\b(RFU|RLU|RLUs|OD|AU|cps|mM|uM|nM|%)\b/i);
  if (unitMatch) return unitMatch[1];
  return '';
}

/**
 * Split a delimited line respecting quoted fields.
 *
 * Detects the primary delimiter from the first line context:
 *   - If the line contains tabs, splits on tabs only (TSV — preserves commas in values)
 *   - Otherwise, splits on commas (CSV)
 *   - Handles quoted fields regardless of delimiter choice
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  // Use tabs as delimiter if present (TSV preserves commas in values like "1,234.567")
  const useTabs = line.includes('\t');

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ((useTabs && ch === '\t') || (!useTabs && ch === ','))) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ─── BMG Parser ──────────────────────────────────────────────────

/**
 * Parse BMG LABTECH CSV export.
 *
 * BMG format characteristics:
 *   - Metadata lines at the top prefixed with identifiable markers or bare key-value pairs
 *   - Blank line separating metadata from data
 *   - Data grid with row labels (A-H or A-P) in first column
 *   - Column numbers as headers in the first data row
 *   - Tab or comma delimited
 *
 * Example:
 * ```
 * Instrument:  CLARIOstar
 * Date:  2025-03-15 14:30:00
 * Plate Format:  96
 * Measurement:  Absorbance 450 nm
 * Blank Line
 *     1       2       3       4   ...
 * A   0.123   0.456   0.789   ...
 * B   0.234   0.567   0.890   ...
 * ```
 */
export function parseBmgCsv(input: string): PlateReaderResult {
  const lines = input.split(/\r?\n/);
  const metadata: Record<string, string> = {};
  const wells: Record<string, WellValue> = {};
  let unit = '';
  let dataStartIdx = -1;

  // Phase 1: Parse metadata header
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      dataStartIdx = i + 1;
      break;
    }
    // Key-value pairs separated by first colon or tab
    const colonIdx = line.indexOf(':');
    const tabIdx = line.indexOf('\t');
    let sepIdx = -1;
    if (colonIdx >= 0 && (tabIdx < 0 || colonIdx < tabIdx)) {
      sepIdx = colonIdx;
    } else if (tabIdx >= 0) {
      sepIdx = tabIdx;
    }
    if (sepIdx >= 0) {
      const key = line.substring(0, sepIdx).trim();
      const val = line.substring(sepIdx + 1).trim();
      if (key) metadata[key] = val;
    }
  }

  if (dataStartIdx < 0) dataStartIdx = 0;

  // Try to extract unit from metadata
  const measureStr = metadata['Measurement'] || metadata['measurement'] || metadata['Info'] || '';
  unit = extractUnit(measureStr) || extractUnit(input.substring(0, 200));

  // Phase 2: Parse data grid
  // Find the first data row (starts with a row letter)
  let headerIdx = -1;
  for (let i = dataStartIdx; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    if (fields.length > 0 && /^[A-P]$/i.test(fields[0].trim())) {
      headerIdx = i - 1;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = dataStartIdx;

  // Parse column numbers from header row
  const headerFields = splitCsvLine(lines[headerIdx]).map(f => f.trim());
  const colNumbers: number[] = [];
  for (let j = 1; j < headerFields.length; j++) {
    const n = parseInt(headerFields[j], 10);
    if (!isNaN(n)) colNumbers.push(n);
  }

  // Parse data rows
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const fields = splitCsvLine(line);
    if (fields.length < 2) continue;
    const rowLabel = fields[0].trim().toUpperCase();
    if (!/^[A-P]$/.test(rowLabel)) continue;

    for (let j = 1; j < fields.length && j - 1 < colNumbers.length; j++) {
      const wellId = `${rowLabel}${String(colNumbers[j - 1]).padStart(2, '0')}`;
      const val = parseNumeric(fields[j]);
      wells[wellId] = { value: val, unit };
    }
  }

  const plateFormat = detectPlateFormat(Object.keys(wells));
  return { plateFormat, wells, metadata };
}

// ─── Tecan Parser ────────────────────────────────────────────────

/**
 * Parse Tecan instrument CSV export.
 *
 * Tecan format characteristics:
 *   - Metadata lines at top with labeled fields (often "Date:", "Time:", "Instrument:")
 *   - Blank line separator
 *   - Data section starts with "Well" or a blank row followed by column headers
 *   - Well coordinates may be in "Well" column (e.g., "A1", "B2") or separate Row/Col columns
 *
 * Two sub-formats:
 *   1. Grid format: row labels in first column, column numbers as headers (similar to BMG)
 *   2. Columnar format: "Well", "Value" (or "OD", "Fluorescence") columns
 */
export function parseTecanCsv(input: string): PlateReaderResult {
  const lines = input.split(/\r?\n/);
  const metadata: Record<string, string> = {};
  const wells: Record<string, WellValue> = {};
  let unit = '';

  // Parse metadata header (common to both formats)
  let dataStartIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      dataStartIdx = i + 1;
      break;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      if (key) metadata[key] = val;
    }
  }

  // Detect format by examining the first data row.
  // Columnar: "Well,Value" or "Well,OD 600nm" — second field is NOT a number.
  // Grid: "Well\t1\t2\t3" or blank-first-column + numbers — second field IS a number,
  //        or the first data row is already row labels (A, B, C...).
  let isColumnar = false;
  let headerIdx = dataStartIdx;
  for (let i = dataStartIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const fields = splitCsvLine(line);
    if (fields.length < 2) continue;

    const firstField = fields[0].trim().toUpperCase();

    // Row already starts with a letter — it's a data row in grid format
    if (/^[A-P]$/.test(firstField)) {
      // Header is the line before (or dataStartIdx if this IS dataStartIdx)
      headerIdx = i > dataStartIdx ? i - 1 : dataStartIdx;
      isColumnar = false;
      break;
    }

    // First field starts with "Well" — check if second field is numeric (grid) or label (columnar)
    if (/^WELL$/i.test(firstField)) {
      const secondField = fields[1].trim();
      if (/^\d+$/.test(secondField)) {
        // Grid: "Well\t1\t2\t3..."
        headerIdx = i;
        isColumnar = false;
      } else {
        // Columnar: "Well,OD 600nm" or "Well,Value"
        headerIdx = i;
        isColumnar = true;
      }
      break;
    }

    // First field is empty (leading tab) — likely header row in grid format
    if (firstField === '' && fields.length > 1) {
      const secondField = fields[1].trim();
      if (/^\d+$/.test(secondField)) {
        headerIdx = i;
        isColumnar = false;
        break;
      }
    }
  }

  if (isColumnar) {
    return parseTecanColumnar(lines, metadata, headerIdx);
  }

  const headerFields = splitCsvLine(lines[headerIdx]).map(f => f.trim());
  const colNumbers: number[] = [];
  for (let j = 1; j < headerFields.length; j++) {
    const n = parseInt(headerFields[j], 10);
    if (!isNaN(n)) colNumbers.push(n);
  }

  // Try to get unit from header or metadata
  const measureStr = metadata['Measurement'] || metadata['Description'] || '';
  unit = extractUnit(measureStr);
  if (!unit) {
    // Check second field of header for unit
    for (let j = 1; j < headerFields.length; j++) {
      const u = extractUnit(headerFields[j]);
      if (u) { unit = u; break; }
    }
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const fields = splitCsvLine(line);
    if (fields.length < 2) continue;
    const rowLabel = fields[0].trim().toUpperCase();
    if (!/^[A-P]$/.test(rowLabel)) continue;

    for (let j = 1; j < fields.length && j - 1 < colNumbers.length; j++) {
      const wellId = `${rowLabel}${String(colNumbers[j - 1]).padStart(2, '0')}`;
      const val = parseNumeric(fields[j]);
      wells[wellId] = { value: val, unit };
    }
  }

  const plateFormat = detectPlateFormat(Object.keys(wells));
  return { plateFormat, wells, metadata };
}

/**
 * Parse Tecan columnar format: each row is "Well,Value" or "Well,Value,Unit".
 */
function parseTecanColumnar(lines: string[], metadata: Record<string, string>, headerIdx: number): PlateReaderResult {
  const wells: Record<string, WellValue> = {};
  let unit = '';

  if (headerIdx < 0 || headerIdx >= lines.length) {
    return { plateFormat: 96, wells, metadata };
  }

  const rawHeaders = splitCsvLine(lines[headerIdx]).map(f => f.trim());
  const headers = rawHeaders.map(f => f.toLowerCase());
  const valueColIdx = headers.findIndex(h =>
    h === 'value' || h === 'od' || h === 'abs' || h === 'fluorescence' ||
    h === 'measurement' || h === 'result' ||
    h.startsWith('value') || h.startsWith('od ') || h.startsWith('abs ') ||
    h.startsWith('fluorescence') || h.startsWith('measurement') || h.startsWith('result'),
  );
  if (valueColIdx < 0) {
    // Assume second column is value
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const fields = splitCsvLine(lines[i]);
      if (fields.length < 2) continue;
      const wellId = normalizeWellId(fields[0]);
      if (!wellId) continue;
      const val = parseNumeric(fields[1]);
      if (!isNaN(val)) {
        wells[wellId] = { value: val, unit };
      }
    }
  } else {
    // Try to extract unit from the value header (use original case)
    unit = extractUnit(rawHeaders[valueColIdx]) || unit;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const fields = splitCsvLine(lines[i]);
      if (fields.length < valueColIdx + 1) continue;
      const wellId = normalizeWellId(fields[0]);
      if (!wellId) continue;
      const val = parseNumeric(fields[valueColIdx]);
      if (!isNaN(val)) {
        wells[wellId] = { value: val, unit };
      }
    }
  }

  const plateFormat = detectPlateFormat(Object.keys(wells));
  return { plateFormat, wells, metadata };
}

// ─── Molecular Devices Parser ────────────────────────────────────

/**
 * Parse Molecular Devices CSV export.
 *
 * Molecular Devices (SpectraMax/FlexStation) format characteristics:
 *   - Section headers in square brackets: [Plate ID], [Results], etc.
 *   - Metadata within sections
 *   - Results section contains the data grid
 *   - Row labels A-H or A-P in first column
 *   - May include wavelength or read type in metadata
 */
export function parseMolecularDevicesCsv(input: string): PlateReaderResult {
  const lines = input.split(/\r?\n/);
  const metadata: Record<string, string> = {};
  const wells: Record<string, WellValue> = {};
  let unit = '';
  let inResults = false;
  let headerParsed = false;
  const colNumbers: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;

    // Section header
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      inResults = sectionMatch[1].toLowerCase().includes('result');
      continue;
    }

    // Metadata outside results section
    if (!inResults) {
      const eqIdx = line.indexOf('=');
      const colonIdx = line.indexOf(':');
      const sepIdx = (eqIdx >= 0 && (colonIdx < 0 || eqIdx < colonIdx)) ? eqIdx : colonIdx;
      if (sepIdx > 0) {
        const key = line.substring(0, sepIdx).trim();
        const val = line.substring(sepIdx + 1).trim();
        if (key) metadata[key] = val;
      }
      continue;
    }

    // Inside results section
    const fields = splitCsvLine(line);

    // First row in results: try to parse as column headers
    if (!headerParsed && fields.length > 1) {
      headerParsed = true; // Mark as parsed regardless of format

      const possibleCols = fields.slice(1).map(f => parseInt(f.trim(), 10));
      const validCols = possibleCols.filter(n => !isNaN(n) && n >= 1 && n <= 24);
      if (validCols.length > 0) {
        // Numeric column headers (1, 2, 3...)
        colNumbers.push(...validCols);
        // Try to get unit from header
        for (const f of fields) {
          const u = extractUnit(f);
          if (u) { unit = u; break; }
        }
      } else {
        // Label-based headers (e.g., "Well\tValue (OD)")
        // Try to extract unit from value column headers
        for (let j = 1; j < fields.length; j++) {
          const u = extractUnit(fields[j]);
          if (u) { unit = u; break; }
        }
      }
      continue;
    }

    // Data row
    if (fields.length >= 2) {
      const firstField = fields[0].trim();
      // Try to normalize as well ID (handles both "A1" and "A01" formats)
      const normalizedId = normalizeWellId(firstField);
      if (!normalizedId) continue;
      const rowLabel = normalizedId.charAt(0);

      if (colNumbers.length > 0) {
        for (let j = 1; j < fields.length && j - 1 < colNumbers.length; j++) {
          const wellId = `${rowLabel}${String(colNumbers[j - 1]).padStart(2, '0')}`;
          const val = parseNumeric(fields[j]);
          wells[wellId] = { value: val, unit };
        }
      } else {
        // Label-based headers (e.g., "Well\tValue (OD)")
        // Each data row contains a well ID and one or more values.
        // Extract column number from the well ID itself.
        const colMatch = firstField.match(/(\d{1,2})$/);
        const colNum = colMatch ? parseInt(colMatch[1], 10) : 1;
        for (let j = 1; j < fields.length; j++) {
          const val = parseNumeric(fields[j]);
          if (!isNaN(val)) {
            const wellId = `${rowLabel}${String(colNum).padStart(2, '0')}`;
            wells[wellId] = { value: val, unit };
            break; // One value per well in this format
          }
        }
      }
    }
  }

  // Extract unit from metadata if not found in headers
  if (!unit) {
    const wl = metadata['Wavelength'] || metadata['Wavelength(nm)'] || metadata['Read'] || '';
    unit = extractUnit(wl) || '';
  }

  const plateFormat = detectPlateFormat(Object.keys(wells));
  return { plateFormat, wells, metadata };
}

// ─── Generic XML Parser (Molecular Devices SoftMax Pro XML) ──────

/**
 * Parse a minimal XML plate reader export (Molecular Devices SoftMax Pro style).
 *
 * Expected structure:
 * ```xml
 * <PlateData>
 *   <Plate>96</Plate>
 *   <Wavelength>450</Wavelength>
 *   <Wells>
 *     <Well id="A1"><Value>0.123</Value></Well>
 *     ...
 *   </Wells>
 * </PlateData>
 * ```
 *
 * Uses regex-based parsing to avoid XML library dependency.
 */
export function parsePlateReaderXml(input: string): PlateReaderResult {
  const metadata: Record<string, string> = {};
  const wells: Record<string, WellValue> = {};

  // Extract plate format
  const plateMatch = input.match(/<Plate[^>]*>(\d+)<\/Plate>/i);
  const plateFormat = plateMatch ? (parseInt(plateMatch[1], 10) === 384 ? 384 : 96) : 96;

  // Extract metadata fields
  const metaTags = ['Instrument', 'Date', 'Time', 'Protocol', 'Wavelength', 'Temperature', 'User'];
  for (const tag of metaTags) {
    const re = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
    const m = input.match(re);
    if (m) metadata[tag] = m[1].trim();
  }

  // Extract unit
  let unit = '';
  const unitMatch = input.match(/<Unit[^>]*>([^<]*)<\/Unit>/i) ||
    input.match(/<Measurement[^>]*>([^<]*)<\/Measurement>/i);
  if (unitMatch) unit = extractUnit(unitMatch[1]) || unitMatch[1].trim();

  // Extract wells
  const wellRe = /<Well\s+[^>]*id\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/Well>/gi;
  let wellMatch: RegExpExecArray | null;
  while ((wellMatch = wellRe.exec(input)) !== null) {
    const wellId = normalizeWellId(wellMatch[1]);
    if (!wellId) continue;
    const valueMatch = wellMatch[2].match(/<Value[^>]*>([^<]*)<\/Value>/i);
    if (valueMatch) {
      const val = parseNumeric(valueMatch[1]);
      if (!isNaN(val)) {
        wells[wellId] = { value: val, unit };
      }
    }
  }

  return { plateFormat, wells, metadata };
}

// ─── Auto-detect and Dispatch ────────────────────────────────────

/**
 * Auto-detect vendor and parse plate reader data.
 *
 * Detection heuristics:
 *   - XML content → parsePlateReaderXml
 *   - "[Results]" or "[Plate" sections → Molecular Devices
 *   - "Well," columnar header → Tecan columnar
 *   - Metadata with ":" pairs + grid of letters/numbers → BMG (default)
 *
 * @param input  Raw file contents (CSV, TSV, or XML)
 * @param vendor  Optional explicit vendor override
 */
export function parsePlateReaderData(input: string, vendor?: PlateReaderVendor): PlateReaderResult {
  const trimmed = input.trim();

  // XML detection
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<PlateData') || trimmed.startsWith('<plate')) {
    return parsePlateReaderXml(trimmed);
  }

  // Explicit vendor
  if (vendor === 'bmg') return parseBmgCsv(trimmed);
  if (vendor === 'tecan') return parseTecanCsv(trimmed);
  if (vendor === 'molecular-devices') return parseMolecularDevicesCsv(trimmed);

  // Auto-detect
  if (/\[Results?\]/i.test(trimmed) || /\[Plate/i.test(trimmed)) {
    return parseMolecularDevicesCsv(trimmed);
  }
  if (/^\s*Well\s*[,\t]/im.test(trimmed)) {
    return parseTecanCsv(trimmed);
  }
  // Default to BMG-style grid parsing
  return parseBmgCsv(trimmed);
}
