/**
 * Data Governance & GDPR Compliance — Type Definitions
 *
 * Covers:
 * - Data classification (public / internal / confidential / restricted)
 * - Retention policies per entity type and org
 * - GDPR requests (deletion, export, access) per Articles 15, 17, 20
 */

// ── Data Classification ──────────────────────────────────────────────

export type DataClassification = "public" | "internal" | "confidential" | "restricted";

/** Ordered severity — index 0 is lowest, index 3 is highest. */
export const CLASSIFICATION_SEVERITY: Record<DataClassification, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

// ── Retention Policy ─────────────────────────────────────────────────

export interface RetentionPolicy {
  id: string;
  orgId: string;
  entityType: string;
  classification: DataClassification;
  retentionDays: number;
  archiveAfterDays: number;
  autoDelete: boolean;
}

export interface RetentionEnforcementResult {
  archived: number;
  deleted: number;
  errors: string[];
}

export interface RetentionStatusEntry {
  entityType: string;
  totalRecords: number;
  expiredRecords: number;
  archivedRecords: number;
}

export interface ArchiveResult {
  entityType: string;
  archivedCount: number;
  cutoffDate: string;
  errors: string[];
}

// ── GDPR Requests ────────────────────────────────────────────────────

export type GDPRRequestType = "deletion" | "export" | "access";
export type GDPRRequestStatus = "pending" | "processing" | "completed" | "failed";

export interface GDPRRequest {
  id: string;
  userId: string;
  type: GDPRRequestType;
  status: GDPRRequestStatus;
  requestedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface DeletionResult {
  tablesAffected: string[];
  recordsDeleted: number;
  recordsAnonymized: number;
}

export interface ExportResult {
  downloadUrl: string;
  fileSize: number;
  format: "zip";
}

export interface DataTableSummary {
  name: string;
  recordCount: number;
  lastModified: string;
}

export interface DataSummary {
  tables: DataTableSummary[];
}

// ── Governance DB Row Types ──────────────────────────────────────────

/** Row shape for the data_classifications table. */
export interface DataClassificationRow {
  entity_id: string;
  entity_type: string;
  classification: DataClassification;
  classified_at: string;
  classified_by: string;
}

/** Row shape for the retention_policies table. */
export interface RetentionPolicyRow {
  id: string;
  org_id: string;
  entity_type: string;
  classification: DataClassification;
  retention_days: number;
  archive_after_days: number;
  auto_delete: number; // SQLite boolean: 0 or 1
}

/** Row shape for the gdpr_requests table. */
export interface GDPRRequestRow {
  id: string;
  user_id: string;
  type: GDPRRequestType;
  status: GDPRRequestStatus;
  requested_at: string;
  completed_at: string | null;
  error_message: string | null;
}

/** Row shape for the soft-deleted records table. */
export interface SoftDeletedRecord {
  id: string;
  original_table: string;
  original_id: string;
  data: string; // JSON-serialized original row
  deleted_at: string;
  recoverable_until: string;
  deleted_by: string;
}

// ── Table Registry ───────────────────────────────────────────────────

/** Known tables that may contain user data (for GDPR export/deletion). */
export const USER_DATA_TABLES = [
  "workbench_projects",
  "workbench_experiments",
  "workbench_history",
  "workbench_artifacts",
  "audit_log",
  "gdpr_requests",
] as const;

export type UserDataTable = (typeof USER_DATA_TABLES)[number];
