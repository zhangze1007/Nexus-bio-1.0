import {
  ASSAY_TYPES,
  type AssayType,
  EXPERIMENT_RECORD_QC_FLAGS,
  EXPERIMENT_RECORD_SOURCE_TYPES,
  type ExperimentRecordQcFlag,
  type ExperimentRecordSourceType,
  type ExperimentRecordV1,
} from "../types/experimentRecord";
import { validateExperimentRecordV1 } from "../validation/experimentRecordValidator";

export interface ExperimentCsvColumnMapping {
  recordId?: string;
  batchId: string;
  sampleId: string;
  constructId: string;
  assayType: string;
  sourceType?: string;
  measurementUnit: string;
  instrument: string;
  operator: string;
  startedAt: string;
  completedAt?: string;
  timeHours: string;
  value: string;
  unit: string;
  replicateId?: string;
  qcFlags?: string;
  notes?: string;
}

export interface RejectedExperimentCsvRow {
  rowIndex: number;
  reason: string;
  raw: Record<string, string>;
}

export interface ExperimentCsvImportResult {
  records: ExperimentRecordV1[];
  rejectedRows: RejectedExperimentCsvRow[];
}

interface ExperimentCsvImportOptions {
  sourceFileId?: string;
  defaultSourceType?: ExperimentRecordSourceType;
  generateRecordId?: (row: Record<string, string>, rowIndex: number) => string;
}

interface GroupedRecord {
  record: ExperimentRecordV1;
  rawRows: Array<{
    rowIndex: number;
    raw: Record<string, string>;
  }>;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseExperimentCsvTextToRows(csvText: string): Array<Record<string, string>> {
  const cleaned = csvText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!cleaned) return [];
  const lines = cleaned.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function cell(row: Record<string, string>, column: string | undefined): string {
  if (!column) return "";
  return row[column]?.trim() ?? "";
}

function isAssayType(value: string): value is AssayType {
  return (ASSAY_TYPES as readonly string[]).includes(value);
}

function isSourceType(value: string): value is ExperimentRecordSourceType {
  return (EXPERIMENT_RECORD_SOURCE_TYPES as readonly string[]).includes(value);
}

function isQcFlag(value: string): value is ExperimentRecordQcFlag {
  return (EXPERIMENT_RECORD_QC_FLAGS as readonly string[]).includes(value);
}

function parseNumberCell(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

function parseQcFlags(raw: string): ExperimentRecordQcFlag[] {
  if (!raw.trim()) return ["passed"];
  const flags = raw
    .split(/[;|,]/)
    .map((flag) => flag.trim())
    .filter(Boolean);
  const validFlags: ExperimentRecordQcFlag[] = [];
  for (const flag of flags) {
    if (isQcFlag(flag)) validFlags.push(flag);
  }
  return validFlags.length > 0 ? validFlags : ["manual-review-required"];
}

function uniqueFlags(flags: ExperimentRecordQcFlag[]): ExperimentRecordQcFlag[] {
  return Array.from(new Set(flags));
}

function metadataMatches(existing: ExperimentRecordV1, next: ExperimentRecordV1): boolean {
  return (
    existing.batchId === next.batchId &&
    existing.sampleId === next.sampleId &&
    existing.constructId === next.constructId &&
    existing.assayType === next.assayType &&
    existing.sourceType === next.sourceType &&
    existing.measurementUnit === next.measurementUnit &&
    existing.instrument === next.instrument &&
    existing.operator === next.operator &&
    existing.startedAt === next.startedAt &&
    existing.completedAt === next.completedAt &&
    existing.sourceFileId === next.sourceFileId
  );
}

function reject(
  rejectedRows: RejectedExperimentCsvRow[],
  rowIndex: number,
  raw: Record<string, string>,
  reason: string,
): void {
  rejectedRows.push({ rowIndex, raw, reason });
}

function buildCandidate(
  row: Record<string, string>,
  mapping: ExperimentCsvColumnMapping,
  options: ExperimentCsvImportOptions,
  rowIndex: number,
): ExperimentRecordV1 | string {
  const recordId = mapping.recordId ? cell(row, mapping.recordId) : (options.generateRecordId?.(row, rowIndex) ?? "");
  if (!recordId) return "Missing record id and no generateRecordId option was supplied.";

  const assayType = cell(row, mapping.assayType);
  if (!isAssayType(assayType)) return `Unsupported assay type: ${assayType || "<empty>"}.`;

  const sourceTypeRaw = mapping.sourceType
    ? cell(row, mapping.sourceType)
    : (options.defaultSourceType ?? "imported-csv");
  if (!isSourceType(sourceTypeRaw)) return `Unsupported source type: ${sourceTypeRaw || "<empty>"}.`;

  const qcFlags = parseQcFlags(cell(row, mapping.qcFlags));
  return {
    schemaVersion: "experiment-record-v1",
    recordId,
    batchId: cell(row, mapping.batchId),
    sampleId: cell(row, mapping.sampleId),
    constructId: cell(row, mapping.constructId),
    assayType,
    sourceType: sourceTypeRaw,
    measurementUnit: cell(row, mapping.measurementUnit),
    instrument: cell(row, mapping.instrument),
    operator: cell(row, mapping.operator),
    startedAt: cell(row, mapping.startedAt),
    ...(cell(row, mapping.completedAt) ? { completedAt: cell(row, mapping.completedAt) } : {}),
    timepoints: [
      {
        timeHours: parseNumberCell(cell(row, mapping.timeHours)),
        value: parseNumberCell(cell(row, mapping.value)),
        unit: cell(row, mapping.unit),
        ...(cell(row, mapping.replicateId) ? { replicateId: cell(row, mapping.replicateId) } : {}),
        qcFlags,
      },
    ],
    qcFlags,
    ...(options.sourceFileId ? { sourceFileId: options.sourceFileId } : {}),
    ...(cell(row, mapping.notes) ? { notes: cell(row, mapping.notes) } : {}),
  };
}

export function mapCsvRowsToExperimentRecords(
  rows: Array<Record<string, string>>,
  mapping: ExperimentCsvColumnMapping,
  options: ExperimentCsvImportOptions = {},
): ExperimentCsvImportResult {
  const rejectedRows: RejectedExperimentCsvRow[] = [];
  const grouped = new Map<string, GroupedRecord>();

  rows.forEach((row, rowIndex) => {
    const candidate = buildCandidate(row, mapping, options, rowIndex);
    if (typeof candidate === "string") {
      reject(rejectedRows, rowIndex, row, candidate);
      return;
    }

    const validation = validateExperimentRecordV1(candidate);
    const errors = validation.issues.filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      reject(rejectedRows, rowIndex, row, errors.map((issue) => issue.message).join(" "));
      return;
    }

    const existing = grouped.get(candidate.recordId);
    if (!existing) {
      grouped.set(candidate.recordId, {
        record: candidate,
        rawRows: [{ rowIndex, raw: row }],
      });
      return;
    }

    if (!metadataMatches(existing.record, candidate)) {
      reject(rejectedRows, rowIndex, row, "Record metadata does not match earlier rows for the same record id.");
      return;
    }

    existing.record.timepoints.push(...candidate.timepoints);
    existing.record.qcFlags = uniqueFlags([...existing.record.qcFlags, ...candidate.qcFlags]);
    existing.rawRows.push({ rowIndex, raw: row });
  });

  const records: ExperimentRecordV1[] = [];
  for (const group of grouped.values()) {
    const validation = validateExperimentRecordV1(group.record);
    const errors = validation.issues.filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      for (const rawRow of group.rawRows) {
        reject(rejectedRows, rawRow.rowIndex, rawRow.raw, errors.map((issue) => issue.message).join(" "));
      }
    } else {
      records.push(group.record);
    }
  }

  return { records, rejectedRows };
}
