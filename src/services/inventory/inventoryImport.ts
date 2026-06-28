/**
 * Inventory CSV import service.
 *
 * Provides bulk import of primers, strains, and plasmids from CSV text.
 * Uses a pure-TypeScript CSV parser (no external dependencies) inspired
 * by Papa Parse's RFC-4180 handling.
 *
 * Features:
 *   - RFC-4180 compliant CSV parsing (quoted fields, escaped quotes, CRLF/LF)
 *   - Flexible header aliasing (accepts "Name", "name", "sequence_5to3", "Sequence", etc.)
 *   - Required-field validation per item type
 *   - Deduplication by name (case-insensitive) against existing DB records
 *   - Returns structured ImportResult with counts and per-row error messages
 */

import { sqlAll, sqlRun } from "@/src/server/libsqlDb";

// ── Types ──────────────────────────────────────────────────────────────

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

type ImportableType = "primers" | "strains" | "plasmids";

// ── CSV Parser ─────────────────────────────────────────────────────────

/**
 * Parse a CSV string into an array of rows, where each row is an array
 * of cell strings. Handles quoted fields (double-quote), escaped quotes
 * (""), and embedded newlines per RFC 4180.
 *
 * @param csv  Raw CSV text.
 * @returns    Array of rows, each row an array of cell values.
 */
export function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < csv.length) {
    const ch = csv[i];

    if (inQuotes) {
      if (ch === '"') {
        // Look ahead for escaped quote ("")
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
      } else if (ch === "\r") {
        // Handle CRLF: consume \r, the \n will be handled on next iteration
        currentRow.push(currentField);
        currentField = "";
        currentRow = pushRowIfNotEmpty(rows, currentRow);
        currentRow = [];
        i++;
        // Skip the \n in CRLF
        if (i < csv.length && csv[i] === "\n") {
          i++;
        }
      } else if (ch === "\n") {
        currentRow.push(currentField);
        currentField = "";
        currentRow = pushRowIfNotEmpty(rows, currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += ch;
        i++;
      }
    }
  }

  // Flush the last field / row
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    pushRowIfNotEmpty(rows, currentRow);
  }

  return rows;
}

/** Push a row only if it has at least one non-empty cell. */
function pushRowIfNotEmpty(rows: string[][], row: string[]): string[] {
  const hasContent = row.some((cell) => cell.trim() !== "");
  if (hasContent) {
    rows.push(row);
  }
  return row; // return value unused, but keeps the type consistent
}

/**
 * Parse CSV text into an array of record objects using the first row as
 * headers. Empty rows and rows that are entirely blank are skipped.
 *
 * @param csv  Raw CSV text.
 * @returns    Array of { header: value } records.
 */
export function parseCSVToRecords(csv: string): Record<string, string>[] {
  const rows = parseCSV(csv);
  if (rows.length < 2) return []; // need at least a header + 1 data row

  const headers = rows[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip entirely empty rows
    if (row.every((cell) => cell.trim() === "")) continue;

    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (row[j] ?? "").trim();
    }
    records.push(record);
  }

  return records;
}

// ── Header Aliases ─────────────────────────────────────────────────────

/**
 * Maps common CSV header variants to the camelCase field names used
 * by the inventory API layer.
 */
const HEADER_ALIASES: Record<string, Record<string, string>> = {
  primers: {
    name: "name",
    "primer name": "name",
    primer_name: "name",
    primername: "name",
    sequence: "sequence5to3",
    sequence_5to3: "sequence5to3",
    "sequence 5' to 3'": "sequence5to3",
    "5_to_3": "sequence5to3",
    sequence5to3: "sequence5to3",
    target: "targetGene",
    target_gene: "targetGene",
    "target gene": "targetGene",
    targetgene: "targetGene",
    length: "lengthBp",
    length_bp: "lengthBp",
    "length (bp)": "lengthBp",
    "length bp": "lengthBp",
    lengthbp: "lengthBp",
    tm: "tmCelsius",
    tm_celsius: "tmCelsius",
    "tm (c)": "tmCelsius",
    "tm (°c)": "tmCelsius",
    tm_c: "tmCelsius",
    tmcelsius: "tmCelsius",
    gc: "gcPercent",
    gc_percent: "gcPercent",
    "gc (%)": "gcPercent",
    "gc%": "gcPercent",
    gcpercent: "gcPercent",
    modification: "modification5prime",
    modification_5prime: "modification5prime",
    "5' modification": "modification5prime",
    modification5prime: "modification5prime",
    pair: "pairId",
    pair_id: "pairId",
    pairid: "pairId",
    concentration: "concentrationUM",
    concentration_um: "concentrationUM",
    "concentration (um)": "concentrationUM",
    "concentration (μm)": "concentrationUM",
    concentrationum: "concentrationUM",
    vendor: "vendor",
    supplier: "vendor",
    notes: "notes",
    comments: "notes",
  },
  strains: {
    name: "name",
    "strain name": "name",
    strain_name: "name",
    strainname: "name",
    genotype: "genotype",
    species: "species",
    organism: "species",
    source: "source",
    origin: "source",
    resistance: "resistanceMarkers",
    resistance_markers: "resistanceMarkers",
    "resistance markers": "resistanceMarkers",
    resistancemarkers: "resistanceMarkers",
    "marker(s)": "resistanceMarkers",
    markers: "resistanceMarkers",
    aliquots: "aliquotCount",
    aliquot_count: "aliquotCount",
    "aliquot count": "aliquotCount",
    aliquotcount: "aliquotCount",
    location: "freezerLocationId",
    freezer_location_id: "freezerLocationId",
    "freezer location": "freezerLocationId",
    freezerlocationid: "freezerLocationId",
    box_position: "boxPosition",
    "box position": "boxPosition",
    boxposition: "boxPosition",
    position: "boxPosition",
    notes: "notes",
    comments: "notes",
  },
  plasmids: {
    name: "name",
    "plasmid name": "name",
    plasmid_name: "name",
    plasmidname: "name",
    backbone: "backbone",
    vector: "backbone",
    insert: "insertDescription",
    insert_description: "insertDescription",
    "insert description": "insertDescription",
    insertdescription: "insertDescription",
    description: "insertDescription",
    resistance: "resistance",
    "selection marker": "resistance",
    selection_marker: "resistance",
    selectionmarker: "resistance",
    promoter: "promoter",
    "copy number": "copyNumber",
    copy_number: "copyNumber",
    copynumber: "copyNumber",
    size: "insertLengthBp",
    insert_length_bp: "insertLengthBp",
    "insert length": "insertLengthBp",
    "insert length (bp)": "insertLengthBp",
    insertlengthbp: "insertLengthBp",
    addgene: "addgeneId",
    addgene_id: "addgeneId",
    addgeneid: "addgeneId",
    "addgene id": "addgeneId",
    concentration: "concentrationNgUl",
    concentration_ng_ul: "concentrationNgUl",
    "concentration (ng/ul)": "concentrationNgUl",
    concentrationngul: "concentrationNgUl",
    sequence: "insertSequence",
    insert_sequence: "insertSequence",
    "insert sequence": "insertSequence",
    insertsequence: "insertSequence",
    verified: "sequenceVerified",
    sequence_verified: "sequenceVerified",
    "sequence verified": "sequenceVerified",
    sequenceverified: "sequenceVerified",
    tags: "tags",
    notes: "notes",
    comments: "notes",
  },
};

/**
 * Required field names (camelCase) per importable type.
 */
const REQUIRED_FIELDS: Record<ImportableType, string[]> = {
  primers: ["name", "sequence5to3"],
  strains: ["name"],
  plasmids: ["name"],
};

/**
 * Table name per importable type.
 */
const TABLE_MAP: Record<ImportableType, string> = {
  primers: "inventory_primers",
  strains: "inventory_strains",
  plasmids: "inventory_plasmids",
};

// ── camelCase → snake_case Column Map ──────────────────────────────────

/**
 * Maps camelCase field names (from header aliasing) to the snake_case
 * column names used in the SQLite/Turso schema.
 */
const COLUMN_MAP: Record<string, string> = {
  name: "name",
  sequence5to3: "sequence_5to3",
  targetGene: "target_gene",
  lengthBp: "length_bp",
  tmCelsius: "tm_celsius",
  gcPercent: "gc_percent",
  modification5prime: "modification_5prime",
  pairId: "pair_id",
  concentrationUM: "concentration_uM",
  vendor: "vendor",
  genotype: "genotype",
  species: "species",
  source: "source",
  parentStrainId: "parent_strain_id",
  associatedPlasmidIds: "associated_plasmid_ids",
  freezerLocationId: "freezer_location_id",
  boxPosition: "box_position",
  aliquotCount: "aliquot_count",
  resistanceMarkers: "resistance_markers",
  backbone: "backbone",
  insertDescription: "insert_description",
  insertSequence: "insert_sequence",
  insertLengthBp: "insert_length_bp",
  resistance: "resistance",
  copyNumber: "copy_number",
  promoter: "promoter",
  tags: "tags",
  linkedPathwayNode: "linked_pathway_node",
  designSourceTool: "design_source_tool",
  concentrationNgUl: "concentration_ng_ul",
  addgeneId: "addgene_id",
  sequenceVerified: "sequence_verified",
  notes: "notes",
  projectId: "project_id",
  createdBy: "created_by",
};

// ── Helpers ────────────────────────────────────────────────────────────

function generateId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Resolve raw CSV header names to camelCase field names using the
 * alias map for the given type.
 */
function resolveHeaders(rawHeaders: string[], type: ImportableType): (string | null)[] {
  const aliases = HEADER_ALIASES[type];
  return rawHeaders.map((raw) => {
    const key = raw.trim().toLowerCase();
    return aliases[key] ?? null;
  });
}

/**
 * Validate that all required fields are present and non-empty.
 * Returns an array of error messages (empty if valid).
 */
function validateRequired(record: Record<string, string>, type: ImportableType): string[] {
  const required = REQUIRED_FIELDS[type];
  const errors: string[] = [];
  for (const field of required) {
    const value = record[field];
    if (!value || value.trim() === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }
  return errors;
}

/**
 * Coerce numeric string values to numbers where the target column
 * expects a numeric type. Non-numeric strings are left as-is (the DB
 * will accept them as text; the column type enforcement is at the
 * application layer).
 */
function coerceNumeric(value: string): string | number {
  if (value === "") return value;
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") {
    return num;
  }
  return value;
}

/**
 * Fetch all non-archived names from a table, lowercased, for
 * deduplication.
 */
async function fetchExistingNames(table: string): Promise<Set<string>> {
  const rows = await sqlAll(`SELECT name FROM ${table} WHERE archived = 0`, []);
  const names = new Set<string>();
  for (const row of rows) {
    if (row.name) {
      names.add(String(row.name).toLowerCase());
    }
  }
  return names;
}

// ── Core Import Logic ──────────────────────────────────────────────────

/**
 * Generic import function shared by primers, strains, and plasmids.
 *
 * 1. Parses CSV text into records with header aliasing.
 * 2. Validates required fields per row.
 * 3. Deduplicates by name (case-insensitive) against existing DB rows.
 * 4. Inserts non-duplicate valid rows.
 * 5. Returns an ImportResult summary.
 */
async function importFromCSV(
  csvContent: string,
  type: ImportableType,
  projectId: string,
  userId: string,
): Promise<ImportResult> {
  const table = TABLE_MAP[type];
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  // 1. Parse CSV
  const rows = parseCSV(csvContent);
  if (rows.length < 1) {
    result.errors.push("CSV is empty or contains no parseable rows");
    return result;
  }

  // 2. Resolve headers
  const rawHeaders = rows[0];
  const resolvedHeaders = resolveHeaders(rawHeaders, type);

  if (resolvedHeaders.every((h) => h === null)) {
    result.errors.push(
      `No recognized column headers found for ${type}. ` + `Expected columns like: ${REQUIRED_FIELDS[type].join(", ")}`,
    );
    return result;
  }

  // Check that at least the name column is recognized
  if (!resolvedHeaders.includes("name")) {
    result.errors.push(
      'CSV must contain a "name" column (accepted aliases: Name, name, primer name, strain name, plasmid name)',
    );
    return result;
  }

  // 3. Fetch existing names for deduplication
  const existingNames = await fetchExistingNames(table);

  // 4. Process each data row
  const now = new Date().toISOString();
  const seenInBatch = new Set<string>(); // within-batch dedup

  for (let i = 1; i < rows.length; i++) {
    const rowNum = i + 1; // 1-indexed for user-facing messages
    const cells = rows[i];

    // Skip entirely empty rows
    if (cells.every((c) => c.trim() === "")) continue;

    // Build a camelCase record from the resolved headers
    const record: Record<string, string> = {};
    for (let j = 0; j < resolvedHeaders.length; j++) {
      const field = resolvedHeaders[j];
      if (field !== null) {
        record[field] = (cells[j] ?? "").trim();
      }
    }

    // Validate required fields
    const validationErrors = validateRequired(record, type);
    if (validationErrors.length > 0) {
      result.errors.push(`Row ${rowNum}: ${validationErrors.join("; ")}`);
      continue;
    }

    // Deduplicate by name (case-insensitive)
    const normalizedName = record.name.toLowerCase();
    if (existingNames.has(normalizedName) || seenInBatch.has(normalizedName)) {
      result.skipped++;
      continue;
    }
    seenInBatch.add(normalizedName);

    // Build INSERT columns and values
    const columns: string[] = ["id", "created_at", "updated_at", "archived"];
    const placeholders: string[] = ["?", "?", "?", "?"];
    const values: unknown[] = [generateId(), now, now, 0];

    // Map camelCase fields to snake_case DB columns
    for (const [field, value] of Object.entries(record)) {
      const col = COLUMN_MAP[field];
      if (col) {
        columns.push(col);
        placeholders.push("?");
        values.push(coerceNumeric(value));
      }
    }

    // Always stamp projectId and userId
    if (!columns.includes("project_id")) {
      columns.push("project_id");
      placeholders.push("?");
      values.push(projectId);
    }
    if (!columns.includes("created_by")) {
      columns.push("created_by");
      placeholders.push("?");
      values.push(userId);
    }

    try {
      const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
      await sqlRun(sql, values);
      result.imported++;
      existingNames.add(normalizedName); // prevent within-batch dupes from passing later
    } catch (err) {
      result.errors.push(`Row ${rowNum}: DB insert failed — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Import primers from CSV text.
 *
 * Expected CSV columns (aliases accepted):
 *   Required: name, sequence_5to3
 *   Optional: target_gene, length_bp, tm_celsius, gc_percent,
 *             modification_5prime, pair_id, concentration_uM, vendor, notes
 *
 * @param csvContent  Raw CSV text with a header row.
 * @param projectId   Project ID to stamp on inserted rows.
 * @param userId      User ID to stamp as created_by on inserted rows.
 * @returns ImportResult with imported / skipped / errors counts.
 */
export async function importPrimersFromCSV(
  csvContent: string,
  projectId: string,
  userId: string,
): Promise<ImportResult> {
  return importFromCSV(csvContent, "primers", projectId, userId);
}

/**
 * Import strains from CSV text.
 *
 * Expected CSV columns (aliases accepted):
 *   Required: name
 *   Optional: genotype, species, source, resistance_markers, aliquot_count,
 *             freezer_location_id, box_position, notes
 *
 * @param csvContent  Raw CSV text with a header row.
 * @param projectId   Project ID to stamp on inserted rows.
 * @param userId      User ID to stamp as created_by on inserted rows.
 * @returns ImportResult with imported / skipped / errors counts.
 */
export async function importStrainsFromCSV(
  csvContent: string,
  projectId: string,
  userId: string,
): Promise<ImportResult> {
  return importFromCSV(csvContent, "strains", projectId, userId);
}

/**
 * Import plasmids from CSV text.
 *
 * Expected CSV columns (aliases accepted):
 *   Required: name
 *   Optional: backbone, insert_description, resistance, promoter, copy_number,
 *             insert_length_bp, addgene_id, concentration_ng_ul, insert_sequence,
 *             sequence_verified, tags, notes
 *
 * @param csvContent  Raw CSV text with a header row.
 * @param projectId   Project ID to stamp on inserted rows.
 * @param userId      User ID to stamp as created_by on inserted rows.
 * @returns ImportResult with imported / skipped / errors counts.
 */
export async function importPlasmidsFromCSV(
  csvContent: string,
  projectId: string,
  userId: string,
): Promise<ImportResult> {
  return importFromCSV(csvContent, "plasmids", projectId, userId);
}
