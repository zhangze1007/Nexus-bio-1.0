/**
 * Incident Response — GxP/SOC 2-ready incident management.
 *
 * Tracks security and operational incidents through their full lifecycle:
 * detection, triage, investigation, root cause analysis, corrective action,
 * and closure.
 *
 * Storage: incidents table via @libsql/client (async).
 */

import { randomUUID } from "node:crypto";
import { sqlAll, sqlGet, sqlRun, sqlBatch } from "../../server/libsqlDb";

// ── Types ──

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "open" | "investigating" | "mitigated" | "resolved" | "closed";

export interface Incident {
  id: string;
  severity: IncidentSeverity;
  description: string;
  affectedSystems: string[];
  status: IncidentStatus;
  detectedAt: string;
  resolvedAt: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  createdBy: string;
}

export interface IncidentUpdate {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  resolvedAt?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
}

export interface IncidentReport {
  incident: Incident;
  timeline: TimelineEntry[];
  summary: string;
}

interface TimelineEntry {
  timestamp: string;
  action: string;
  detail: string;
}

// ── Schema bootstrap ──

const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    affected_systems_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    detected_at TEXT NOT NULL,
    resolved_at TEXT,
    root_cause TEXT,
    corrective_action TEXT,
    created_by TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status)`,
  `CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents (severity)`,
  `CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON incidents (detected_at DESC)`,
];

let tablesEnsured = false;

async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  await sqlBatch(CREATE_TABLES_SQL.map((sql) => ({ sql })));
  tablesEnsured = true;
}

// ── Helpers ──

const VALID_SEVERITIES: ReadonlySet<string> = new Set(["low", "medium", "high", "critical"]);
const VALID_STATUSES: ReadonlySet<string> = new Set(["open", "investigating", "mitigated", "resolved", "closed"]);

function validateSeverity(severity: string): IncidentSeverity {
  if (!VALID_SEVERITIES.has(severity)) {
    throw new Error(`Invalid severity "${severity}". Must be one of: low, medium, high, critical.`);
  }
  return severity as IncidentSeverity;
}

function validateStatus(status: string): IncidentStatus {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status "${status}". Must be one of: open, investigating, mitigated, resolved, closed.`);
  }
  return status as IncidentStatus;
}

function rowToIncident(row: Record<string, unknown>): Incident {
  let affectedSystems: string[];
  try {
    const parsed = JSON.parse(row.affected_systems_json as string);
    affectedSystems = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    affectedSystems = [];
  }

  return {
    id: row.id as string,
    severity: row.severity as IncidentSeverity,
    description: row.description as string,
    affectedSystems,
    status: row.status as IncidentStatus,
    detectedAt: row.detected_at as string,
    resolvedAt: (row.resolved_at as string) ?? null,
    rootCause: (row.root_cause as string) ?? null,
    correctiveAction: (row.corrective_action as string) ?? null,
    createdBy: row.created_by as string,
  };
}

// ── Public API ──

/**
 * Create a new incident record.
 *
 * @param severity   - low | medium | high | critical
 * @param description - Human-readable description of the incident
 * @param affectedSystems - List of affected system/component identifiers
 * @param createdBy  - Actor who reported the incident
 * @returns The created Incident
 */
export async function createIncident(
  severity: IncidentSeverity | string,
  description: string,
  affectedSystems: string[],
  createdBy: string = "system",
): Promise<Incident> {
  await ensureTables();

  const validSeverity = validateSeverity(severity);
  const id = randomUUID();
  const detectedAt = new Date().toISOString();

  if (!description || description.trim().length === 0) {
    throw new Error("Incident description must not be empty.");
  }

  await sqlRun(
    `INSERT INTO incidents (id, severity, description, affected_systems_json, status, detected_at, resolved_at, root_cause, corrective_action, created_by)
     VALUES (?, ?, ?, ?, 'open', ?, NULL, NULL, NULL, ?)`,
    [id, validSeverity, description.trim(), JSON.stringify(affectedSystems), detectedAt, createdBy],
  );

  return {
    id,
    severity: validSeverity,
    description: description.trim(),
    affectedSystems,
    status: "open",
    detectedAt,
    resolvedAt: null,
    rootCause: null,
    correctiveAction: null,
    createdBy,
  };
}

/**
 * Update fields on an existing incident.
 *
 * @param id      - Incident ID
 * @param updates - Partial update object
 */
export async function updateIncident(id: string, updates: IncidentUpdate): Promise<void> {
  await ensureTables();

  const existing = await sqlGet("SELECT id FROM incidents WHERE id = ?", [id]);
  if (!existing) {
    throw new Error(`Incident "${id}" not found.`);
  }

  const setClauses: string[] = [];
  const args: unknown[] = [];

  if (updates.status !== undefined) {
    const validStatus = validateStatus(updates.status);
    setClauses.push("status = ?");
    args.push(validStatus);
    // Auto-set resolvedAt when transitioning to resolved/closed
    if (validStatus === "resolved" || validStatus === "closed") {
      setClauses.push("resolved_at = ?");
      args.push(updates.resolvedAt ?? new Date().toISOString());
    }
  }

  if (updates.severity !== undefined) {
    setClauses.push("severity = ?");
    args.push(validateSeverity(updates.severity));
  }

  if (updates.rootCause !== undefined) {
    setClauses.push("root_cause = ?");
    args.push(updates.rootCause);
  }

  if (updates.correctiveAction !== undefined) {
    setClauses.push("corrective_action = ?");
    args.push(updates.correctiveAction);
  }

  if (updates.resolvedAt !== undefined && updates.status === undefined) {
    setClauses.push("resolved_at = ?");
    args.push(updates.resolvedAt);
  }

  if (setClauses.length === 0) {
    return; // No-op
  }

  args.push(id);
  await sqlRun(`UPDATE incidents SET ${setClauses.join(", ")} WHERE id = ?`, args);
}

/**
 * List incidents, optionally filtered by status.
 *
 * @param status - Optional status filter
 * @param limit  - Max results (default 50, max 200)
 * @returns Array of Incident records
 */
export async function listIncidents(status?: IncidentStatus | string, limit = 50): Promise<Incident[]> {
  await ensureTables();

  const safeLimit = Math.max(1, Math.min(limit, 200));

  let sql: string;
  let args: unknown[];

  if (status) {
    const validStatus = validateStatus(status);
    sql = `SELECT * FROM incidents WHERE status = ? ORDER BY detected_at DESC LIMIT ?`;
    args = [validStatus, safeLimit];
  } else {
    sql = `SELECT * FROM incidents ORDER BY detected_at DESC LIMIT ?`;
    args = [safeLimit];
  }

  const rows = await sqlAll(sql, args);
  return rows.map(rowToIncident);
}

/**
 * Generate a full incident report including the incident record and a
 * synthesized timeline of events.
 *
 * @param id - Incident ID
 * @returns IncidentReport with incident details, timeline, and summary
 */
export async function generateIncidentReport(id: string): Promise<IncidentReport> {
  await ensureTables();

  const row = await sqlGet("SELECT * FROM incidents WHERE id = ?", [id]);
  if (!row) {
    throw new Error(`Incident "${id}" not found.`);
  }

  const incident = rowToIncident(row);
  const timeline: TimelineEntry[] = [];

  // Detection event
  timeline.push({
    timestamp: incident.detectedAt,
    action: "detected",
    detail: `Incident detected: ${incident.description}`,
  });

  // Status transitions (synthesized from current state)
  if (incident.status !== "open") {
    timeline.push({
      timestamp: incident.detectedAt,
      action: "status_change",
      detail: `Status changed to: ${incident.status}`,
    });
  }

  if (incident.rootCause) {
    timeline.push({
      timestamp: incident.resolvedAt ?? incident.detectedAt,
      action: "root_cause_identified",
      detail: incident.rootCause,
    });
  }

  if (incident.correctiveAction) {
    timeline.push({
      timestamp: incident.resolvedAt ?? incident.detectedAt,
      action: "corrective_action",
      detail: incident.correctiveAction,
    });
  }

  if (incident.resolvedAt) {
    timeline.push({
      timestamp: incident.resolvedAt,
      action: "resolved",
      detail: `Incident resolved at ${incident.resolvedAt}`,
    });
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Build summary
  const severityLabel = incident.severity.toUpperCase();
  const systemsList = incident.affectedSystems.length > 0
    ? incident.affectedSystems.join(", ")
    : "unspecified systems";
  const resolutionInfo = incident.resolvedAt
    ? ` Resolved at ${incident.resolvedAt}.`
    : " Currently unresolved.";
  const rootCauseInfo = incident.rootCause
    ? ` Root cause: ${incident.rootCause}`
    : "";
  const correctiveInfo = incident.correctiveAction
    ? ` Corrective action: ${incident.correctiveAction}`
    : "";

  const summary =
    `[${severityLabel}] ${incident.description} ` +
    `(Affected: ${systemsList}). ` +
    `Status: ${incident.status}.${resolutionInfo}${rootCauseInfo}${correctiveInfo}`;

  return { incident, timeline, summary };
}
