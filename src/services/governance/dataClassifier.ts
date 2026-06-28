/**
 * Data Classifier — Automatic and manual data classification.
 *
 * Provides:
 * - `classifyData`: Pure function that inspects an entity and returns its
 *   default classification based on entity type and content heuristics.
 * - `getDataClassification`: Reads persisted classification from the DB.
 * - `setDataClassification`: Writes (or updates) classification in the DB.
 *
 * Classification rules (heuristic):
 *   restricted  — health data, biometric data, genetic sequences marked sensitive
 *   confidential — PII (email, name, IP address), user accounts, auth tokens
 *   internal    — project data, experiment records, workbench state
 *   public      — published research, public pathways, marketing content
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";
import type { DataClassification, DataClassificationRow } from "./types";

// ── Classification heuristics ────────────────────────────────────────

/** Entity types that are inherently internal. */
const INTERNAL_ENTITY_TYPES = new Set([
  "project",
  "experiment",
  "workbench",
  "artifact",
  "tool_run",
  "pathway",
  "simulation",
]);

/** Entity types that contain PII — classified as confidential. */
const CONFIDENTIAL_ENTITY_TYPES = new Set(["user", "account", "profile", "session", "auth", "billing"]);

/** Entity types that are health/genetic data — classified as restricted. */
const RESTRICTED_ENTITY_TYPES = new Set([
  "genetic_sequence",
  "patient_data",
  "health_record",
  "biometric",
  "clinical_data",
]);

/** Field names that indicate PII (all lowercase for case-insensitive matching). */
const PII_FIELDS = new Set([
  "email",
  "name",
  "fullname",
  "firstname",
  "lastname",
  "phone",
  "address",
  "ipaddress",
  "ip",
  "ssn",
  "dateofbirth",
  "dob",
]);

/** Field names that indicate health/genetic data (all lowercase for case-insensitive matching). */
const SENSITIVE_FIELDS = new Set([
  "genotype",
  "phenotype",
  "dnasequence",
  "proteinsequence",
  "geneticdata",
  "patientid",
  "medicalrecord",
]);

/**
 * Classify data based on entity type and content heuristics.
 *
 * @param entity — The data object to classify (can be any shape).
 * @param entityType — A string tag describing the entity (e.g. 'user', 'experiment').
 * @returns The computed DataClassification.
 */
export function classifyData(entity: unknown, entityType: string): DataClassification {
  const normalizedType = entityType.toLowerCase().trim();

  // 1. Entity-type-based rules (highest priority)
  if (RESTRICTED_ENTITY_TYPES.has(normalizedType)) {
    return "restricted";
  }
  if (CONFIDENTIAL_ENTITY_TYPES.has(normalizedType)) {
    return "confidential";
  }
  if (INTERNAL_ENTITY_TYPES.has(normalizedType)) {
    return "internal";
  }

  // 2. Content-based heuristics (if entity is a plain object)
  if (entity && typeof entity === "object" && !Array.isArray(entity)) {
    const keys = Object.keys(entity as Record<string, unknown>);

    // Check for sensitive fields
    for (const key of keys) {
      const normalizedKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.has(normalizedKey)) {
        return "restricted";
      }
    }

    // Check for PII fields
    for (const key of keys) {
      const normalizedKey = key.toLowerCase();
      if (PII_FIELDS.has(normalizedKey)) {
        return "confidential";
      }
    }
  }

  // 3. Default — internal (anything stored in the system is at least internal)
  return "internal";
}

// ── DB-backed classification lookups ─────────────────────────────────

/**
 * Get the persisted data classification for a specific entity.
 *
 * @returns The stored classification, or null if not yet classified.
 */
export async function getDataClassification(entityId: string, entityType: string): Promise<DataClassification | null> {
  const row = await sqlGet("SELECT classification FROM data_classifications WHERE entity_id = ? AND entity_type = ?", [
    entityId,
    entityType,
  ]);
  if (!row) return null;
  return (row as unknown as DataClassificationRow).classification;
}

/**
 * Persist a data classification for a specific entity.
 * Upserts: if a row already exists for this (entityId, entityType), updates it.
 */
export async function setDataClassification(
  entityId: string,
  entityType: string,
  classification: DataClassification,
  classifiedBy: string = "system",
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await sqlGet("SELECT entity_id FROM data_classifications WHERE entity_id = ? AND entity_type = ?", [
    entityId,
    entityType,
  ]);

  if (existing) {
    await sqlRun(
      "UPDATE data_classifications SET classification = ?, classified_at = ?, classified_by = ? WHERE entity_id = ? AND entity_type = ?",
      [classification, now, classifiedBy, entityId, entityType],
    );
  } else {
    await sqlRun(
      "INSERT INTO data_classifications (entity_id, entity_type, classification, classified_at, classified_by) VALUES (?, ?, ?, ?, ?)",
      [entityId, entityType, classification, now, classifiedBy],
    );
  }
}

/**
 * Initialize the data_classifications table (idempotent).
 */
export async function ensureClassificationTable(): Promise<void> {
  await sqlRun(`
    CREATE TABLE IF NOT EXISTS data_classifications (
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      classification TEXT NOT NULL CHECK(classification IN ('public','internal','confidential','restricted')),
      classified_at TEXT NOT NULL,
      classified_by TEXT NOT NULL DEFAULT 'system',
      PRIMARY KEY (entity_id, entity_type)
    )
  `);
}
