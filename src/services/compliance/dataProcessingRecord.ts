/**
 * GDPR Article 30 Data Processing Record Manager.
 *
 * Maintains records of processing activities as required by GDPR Article 30(1).
 * Each record documents a category of data processing performed by an organisation,
 * including the purpose, legal basis, data types, and recipients.
 *
 * Storage: data_processing_records table via @libsql/client.
 */

import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──

/** Valid data processing categories. */
export type ProcessingCategory = "user_data" | "research_data" | "financial_data" | "operational_data";

/** All valid processing categories, used for validation. */
export const VALID_PROCESSING_CATEGORIES: readonly ProcessingCategory[] = [
  "user_data",
  "research_data",
  "financial_data",
  "operational_data",
];

/** A single data processing record as returned by the database. */
export interface DataProcessingRecord {
  id: string;
  orgId: string;
  category: ProcessingCategory;
  purpose: string;
  legalBasis: string;
  dataTypes: string[];
  recipients: string[];
  retentionPeriod: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields that may be updated on an existing record. */
export interface DataProcessingRecordUpdates {
  category?: ProcessingCategory;
  purpose?: string;
  legalBasis?: string;
  dataTypes?: string[];
  recipients?: string[];
  retentionPeriod?: string | null;
}

// ── Schema bootstrap ──

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS data_processing_records (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  category TEXT NOT NULL,
  purpose TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  data_types_json TEXT NOT NULL DEFAULT '[]',
  recipients_json TEXT NOT NULL DEFAULT '[]',
  retention_period TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_ORG_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_dpr_org_id
  ON data_processing_records (org_id)`;

const CREATE_CATEGORY_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_dpr_category
  ON data_processing_records (org_id, category)`;

let tablesEnsured = false;

async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  await sqlRun(CREATE_TABLE_SQL);
  await sqlRun(CREATE_ORG_INDEX_SQL);
  await sqlRun(CREATE_CATEGORY_INDEX_SQL);
  tablesEnsured = true;
}

// ── Validation ──

function validateOrgId(orgId: string): void {
  if (!orgId || typeof orgId !== "string" || orgId.trim().length === 0) {
    throw new Error("orgId must be a non-empty string.");
  }
}

function validateCategory(category: string): asserts category is ProcessingCategory {
  if (!VALID_PROCESSING_CATEGORIES.includes(category as ProcessingCategory)) {
    throw new Error(
      `Invalid processing category '${category}'. Must be one of: ${VALID_PROCESSING_CATEGORIES.join(", ")}`,
    );
  }
}

function validatePurpose(purpose: string): void {
  if (!purpose || typeof purpose !== "string" || purpose.trim().length === 0) {
    throw new Error("purpose must be a non-empty string.");
  }
}

function validateLegalBasis(legalBasis: string): void {
  if (!legalBasis || typeof legalBasis !== "string" || legalBasis.trim().length === 0) {
    throw new Error("legalBasis must be a non-empty string.");
  }
}

function validateStringArray(value: unknown, fieldName: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`${fieldName} must contain only non-empty strings.`);
    }
  }
}

// ── Row mapping ──

function mapRow(row: Record<string, unknown>): DataProcessingRecord {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    category: String(row.category) as ProcessingCategory,
    purpose: String(row.purpose),
    legalBasis: String(row.legal_basis),
    dataTypes: JSON.parse(String(row.data_types_json)) as string[],
    recipients: JSON.parse(String(row.recipients_json)) as string[],
    retentionPeriod: row.retention_period ? String(row.retention_period) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// ── Public API ──

/**
 * Create a new data processing record.
 *
 * @param orgId          - The organisation identifier.
 * @param category       - The processing category (user_data, research_data, etc.).
 * @param purpose        - The purpose of the processing activity.
 * @param legalBasis     - The legal basis for processing (e.g. "consent", "legitimate interest").
 * @param dataTypes      - Array of data types being processed (e.g. ["email", "name"]).
 * @param recipients     - Array of recipient categories (e.g. ["internal analytics", "cloud provider"]).
 * @param retentionPeriod - Optional retention period description (e.g. "2 years", "until withdrawal").
 * @returns The created record.
 */
export async function createRecord(
  orgId: string,
  category: ProcessingCategory,
  purpose: string,
  legalBasis: string,
  dataTypes: string[],
  recipients: string[],
  retentionPeriod?: string,
): Promise<DataProcessingRecord> {
  validateOrgId(orgId);
  validateCategory(category);
  validatePurpose(purpose);
  validateLegalBasis(legalBasis);
  validateStringArray(dataTypes, "dataTypes");
  validateStringArray(recipients, "recipients");

  await ensureTables();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await sqlRun(
    `INSERT INTO data_processing_records
       (id, org_id, category, purpose, legal_basis, data_types_json, recipients_json, retention_period, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      orgId.trim(),
      category,
      purpose.trim(),
      legalBasis.trim(),
      JSON.stringify(dataTypes.map((d) => d.trim())),
      JSON.stringify(recipients.map((r) => r.trim())),
      retentionPeriod?.trim() ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    orgId: orgId.trim(),
    category,
    purpose: purpose.trim(),
    legalBasis: legalBasis.trim(),
    dataTypes: dataTypes.map((d) => d.trim()),
    recipients: recipients.map((r) => r.trim()),
    retentionPeriod: retentionPeriod?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * List all data processing records for an organisation.
 *
 * @param orgId - The organisation identifier.
 * @returns Array of records ordered by creation date descending.
 */
export async function listRecords(orgId: string): Promise<DataProcessingRecord[]> {
  validateOrgId(orgId);

  await ensureTables();

  const rows = await sqlAll(
    `SELECT id, org_id, category, purpose, legal_basis, data_types_json, recipients_json,
            retention_period, created_at, updated_at
     FROM data_processing_records
     WHERE org_id = ?
     ORDER BY created_at DESC`,
    [orgId.trim()],
  );

  return rows.map(mapRow);
}

/**
 * Update an existing data processing record.
 *
 * Only the fields provided in `updates` are modified; omitted fields retain
 * their current values. The updated_at timestamp is refreshed automatically.
 *
 * @param id      - The record identifier.
 * @param updates - Partial update payload.
 */
export async function updateRecord(id: string, updates: DataProcessingRecordUpdates): Promise<void> {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw new Error("id must be a non-empty string.");
  }

  // Validate provided fields
  if (updates.category !== undefined) {
    validateCategory(updates.category);
  }
  if (updates.purpose !== undefined) {
    validatePurpose(updates.purpose);
  }
  if (updates.legalBasis !== undefined) {
    validateLegalBasis(updates.legalBasis);
  }
  if (updates.dataTypes !== undefined) {
    validateStringArray(updates.dataTypes, "dataTypes");
  }
  if (updates.recipients !== undefined) {
    validateStringArray(updates.recipients, "recipients");
  }

  // Check that at least one field is being updated
  const hasUpdates =
    updates.category !== undefined ||
    updates.purpose !== undefined ||
    updates.legalBasis !== undefined ||
    updates.dataTypes !== undefined ||
    updates.recipients !== undefined ||
    updates.retentionPeriod !== undefined;

  if (!hasUpdates) {
    throw new Error("At least one field must be provided for update.");
  }

  await ensureTables();

  // Build dynamic SET clause
  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (updates.category !== undefined) {
    setClauses.push("category = ?");
    params.push(updates.category);
  }
  if (updates.purpose !== undefined) {
    setClauses.push("purpose = ?");
    params.push(updates.purpose.trim());
  }
  if (updates.legalBasis !== undefined) {
    setClauses.push("legal_basis = ?");
    params.push(updates.legalBasis.trim());
  }
  if (updates.dataTypes !== undefined) {
    setClauses.push("data_types_json = ?");
    params.push(JSON.stringify(updates.dataTypes.map((d) => d.trim())));
  }
  if (updates.recipients !== undefined) {
    setClauses.push("recipients_json = ?");
    params.push(JSON.stringify(updates.recipients.map((r) => r.trim())));
  }
  if (updates.retentionPeriod !== undefined) {
    setClauses.push("retention_period = ?");
    params.push(updates.retentionPeriod?.trim() ?? null);
  }

  setClauses.push("updated_at = ?");
  params.push(new Date().toISOString());

  params.push(id.trim());

  await sqlRun(`UPDATE data_processing_records SET ${setClauses.join(", ")} WHERE id = ?`, params);
}
