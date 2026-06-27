/**
 * SOC 2 Compliance Controls — Trust Service Criteria evaluation.
 *
 * Evaluates controls across the five SOC 2 Trust Service Criteria:
 *   - Security (CC6): Logical and physical access controls
 *   - Availability (A1): System uptime, disaster recovery, capacity
 *   - Processing Integrity (PI1): System processing completeness and accuracy
 *   - Confidentiality (C1): Protection of confidential information
 *   - Privacy (P1): Collection, use, retention, and disposal of personal information
 *
 * Each control returns pass/warn/fail with a human-readable evidence string.
 * Storage: soc2_report + soc2_control_status tables via @libsql/client.
 */

import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──

export type SOC2Category =
  | "security"
  | "availability"
  | "processing_integrity"
  | "confidentiality"
  | "privacy";

export type SOC2ControlStatus = "pass" | "warn" | "fail";

export interface SOC2Control {
  id: string;
  name: string;
  category: SOC2Category;
  status: SOC2ControlStatus;
  evidence: string;
}

export interface SOC2Report {
  checkId: string;
  timestamp: string;
  controls: SOC2Control[];
}

export interface ControlStatusRow {
  controlId: string;
  name: string;
  category: SOC2Category;
  status: SOC2ControlStatus;
  evidence: string;
  checkedAt: string;
}

// ── Schema bootstrap ──

const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS soc2_report (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    controls TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS soc2_control_status (
    control_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    evidence TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    report_id TEXT NOT NULL,
    PRIMARY KEY (control_id, report_id)
  )`,
];

let tablesEnsured = false;

async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  for (const sql of CREATE_TABLES_SQL) {
    await sqlRun(sql);
  }
  tablesEnsured = true;
}

// ── Security controls (CC6) ──

async function checkAccessControlPolicies(): Promise<SOC2Control> {
  try {
    const policies = await sqlGet(
      "SELECT COUNT(*) as cnt FROM access_control_policies WHERE enabled = 1",
    );
    const count = policies ? Number(policies.cnt) : 0;

    if (count >= 1) {
      return {
        id: "CC6.1",
        name: "Access Control Policies",
        category: "security",
        status: "pass",
        evidence: `${count} active access control policies configured.`,
      };
    }
    return {
      id: "CC6.1",
      name: "Access Control Policies",
      category: "security",
      status: "fail",
      evidence: "No active access control policies found.",
    };
  } catch {
    return {
      id: "CC6.1",
      name: "Access Control Policies",
      category: "security",
      status: "warn",
      evidence: "Could not evaluate — access_control_policies table may not exist.",
    };
  }
}

async function checkMfaEnforcement(): Promise<SOC2Control> {
  try {
    const total = await sqlGet("SELECT COUNT(*) as cnt FROM org_members");
    const totalCnt = total ? Number(total.cnt) : 0;

    if (totalCnt === 0) {
      return {
        id: "CC6.2",
        name: "Multi-Factor Authentication",
        category: "security",
        status: "warn",
        evidence: "No organization members found. Cannot assess MFA enforcement.",
      };
    }

    const mfaEnabled = await sqlGet(
      "SELECT COUNT(*) as cnt FROM org_members WHERE mfa_enabled = 1",
    );
    const mfaCnt = mfaEnabled ? Number(mfaEnabled.cnt) : 0;
    const rate = (mfaCnt / totalCnt) * 100;

    if (rate >= 95) {
      return {
        id: "CC6.2",
        name: "Multi-Factor Authentication",
        category: "security",
        status: "pass",
        evidence: `${rate.toFixed(1)}% MFA adoption — ${mfaCnt}/${totalCnt} members.`,
      };
    }
    if (rate >= 60) {
      return {
        id: "CC6.2",
        name: "Multi-Factor Authentication",
        category: "security",
        status: "warn",
        evidence: `${rate.toFixed(1)}% MFA adoption — ${mfaCnt}/${totalCnt} members. Target: 95%.`,
      };
    }
    return {
      id: "CC6.2",
      name: "Multi-Factor Authentication",
      category: "security",
      status: "fail",
      evidence: `${rate.toFixed(1)}% MFA adoption — ${mfaCnt}/${totalCnt} members. Below 60% threshold.`,
    };
  } catch {
    return {
      id: "CC6.2",
      name: "Multi-Factor Authentication",
      category: "security",
      status: "warn",
      evidence: "Could not evaluate — org_members table may not exist.",
    };
  }
}

async function checkAuditLogIntegrity(): Promise<SOC2Control> {
  try {
    const rows = await sqlAll(
      "SELECT id, hash, previous_hash, sequence_number FROM audit_log ORDER BY sequence_number ASC",
    );

    if (rows.length === 0) {
      return {
        id: "CC6.3",
        name: "Audit Log Integrity",
        category: "security",
        status: "warn",
        evidence: "No audit log entries found.",
      };
    }

    const GENESIS_HASH = "0".repeat(64);
    let brokenAt: number | null = null;
    let previousHash = GENESIS_HASH;

    for (const row of rows) {
      if (String(row.previous_hash) !== previousHash) {
        brokenAt = Number(row.sequence_number);
        break;
      }
      previousHash = String(row.hash);
    }

    if (brokenAt !== null) {
      return {
        id: "CC6.3",
        name: "Audit Log Integrity",
        category: "security",
        status: "fail",
        evidence: `Hash chain broken at sequence ${brokenAt}. ${rows.length} total entries.`,
      };
    }

    return {
      id: "CC6.3",
      name: "Audit Log Integrity",
      category: "security",
      status: "pass",
      evidence: `Verified ${rows.length} entries. Hash chain intact from genesis.`,
    };
  } catch {
    return {
      id: "CC6.3",
      name: "Audit Log Integrity",
      category: "security",
      status: "warn",
      evidence: "Could not evaluate — audit_log table may not exist.",
    };
  }
}

// ── Availability controls (A1) ──

async function checkIncidentResponsePlan(): Promise<SOC2Control> {
  try {
    const plans = await sqlGet(
      "SELECT COUNT(*) as cnt FROM incident_response_plans WHERE active = 1",
    );
    const count = plans ? Number(plans.cnt) : 0;

    if (count >= 1) {
      return {
        id: "A1.1",
        name: "Incident Response Plan",
        category: "availability",
        status: "pass",
        evidence: `${count} active incident response plan(s) documented.`,
      };
    }
    return {
      id: "A1.1",
      name: "Incident Response Plan",
      category: "availability",
      status: "fail",
      evidence: "No active incident response plans found.",
    };
  } catch {
    return {
      id: "A1.1",
      name: "Incident Response Plan",
      category: "availability",
      status: "warn",
      evidence: "Could not evaluate — incident_response_plans table may not exist.",
    };
  }
}

async function checkBackupRecovery(): Promise<SOC2Control> {
  try {
    const backups = await sqlGet(
      "SELECT COUNT(*) as cnt FROM backup_jobs WHERE status = 'completed' AND completed_at > datetime('now', '-7 days')",
    );
    const count = backups ? Number(backups.cnt) : 0;

    if (count >= 1) {
      return {
        id: "A1.2",
        name: "Backup and Recovery",
        category: "availability",
        status: "pass",
        evidence: `${count} successful backup(s) in the last 7 days.`,
      };
    }

    const anyBackup = await sqlGet(
      "SELECT COUNT(*) as cnt FROM backup_jobs WHERE status = 'completed'",
    );
    const anyCount = anyBackup ? Number(anyBackup.cnt) : 0;

    if (anyCount > 0) {
      return {
        id: "A1.2",
        name: "Backup and Recovery",
        category: "availability",
        status: "warn",
        evidence: `${anyCount} total backups found, but none completed in the last 7 days.`,
      };
    }
    return {
      id: "A1.2",
      name: "Backup and Recovery",
      category: "availability",
      status: "fail",
      evidence: "No completed backups found.",
    };
  } catch {
    return {
      id: "A1.2",
      name: "Backup and Recovery",
      category: "availability",
      status: "warn",
      evidence: "Could not evaluate — backup_jobs table may not exist.",
    };
  }
}

async function checkCapacityMonitoring(): Promise<SOC2Control> {
  try {
    const metrics = await sqlGet(
      "SELECT COUNT(*) as cnt FROM capacity_metrics WHERE recorded_at > datetime('now', '-24 hours')",
    );
    const count = metrics ? Number(metrics.cnt) : 0;

    if (count >= 1) {
      return {
        id: "A1.3",
        name: "Capacity Monitoring",
        category: "availability",
        status: "pass",
        evidence: `${count} capacity metric(s) recorded in the last 24 hours.`,
      };
    }
    return {
      id: "A1.3",
      name: "Capacity Monitoring",
      category: "availability",
      status: "fail",
      evidence: "No capacity metrics recorded in the last 24 hours.",
    };
  } catch {
    return {
      id: "A1.3",
      name: "Capacity Monitoring",
      category: "availability",
      status: "warn",
      evidence: "Could not evaluate — capacity_metrics table may not exist.",
    };
  }
}

// ── Processing Integrity controls (PI1) ──

async function checkInputValidation(): Promise<SOC2Control> {
  try {
    const rules = await sqlGet(
      "SELECT COUNT(*) as cnt FROM validation_rules WHERE enabled = 1",
    );
    const count = rules ? Number(rules.cnt) : 0;

    if (count >= 5) {
      return {
        id: "PI1.1",
        name: "Input Validation Rules",
        category: "processing_integrity",
        status: "pass",
        evidence: `${count} active validation rules configured.`,
      };
    }
    if (count >= 1) {
      return {
        id: "PI1.1",
        name: "Input Validation Rules",
        category: "processing_integrity",
        status: "warn",
        evidence: `Only ${count} validation rules. Recommended: at least 5 core rules.`,
      };
    }
    return {
      id: "PI1.1",
      name: "Input Validation Rules",
      category: "processing_integrity",
      status: "fail",
      evidence: "No active validation rules found.",
    };
  } catch {
    return {
      id: "PI1.1",
      name: "Input Validation Rules",
      category: "processing_integrity",
      status: "warn",
      evidence: "Could not evaluate — validation_rules table may not exist.",
    };
  }
}

async function checkDataIntegrityChecks(): Promise<SOC2Control> {
  try {
    const checks = await sqlGet(
      "SELECT COUNT(*) as cnt FROM data_integrity_checks WHERE status = 'passed' AND checked_at > datetime('now', '-24 hours')",
    );
    const count = checks ? Number(checks.cnt) : 0;

    if (count >= 1) {
      return {
        id: "PI1.2",
        name: "Data Integrity Verification",
        category: "processing_integrity",
        status: "pass",
        evidence: `${count} integrity check(s) passed in the last 24 hours.`,
      };
    }
    return {
      id: "PI1.2",
      name: "Data Integrity Verification",
      category: "processing_integrity",
      status: "fail",
      evidence: "No integrity checks passed in the last 24 hours.",
    };
  } catch {
    return {
      id: "PI1.2",
      name: "Data Integrity Verification",
      category: "processing_integrity",
      status: "warn",
      evidence: "Could not evaluate — data_integrity_checks table may not exist.",
    };
  }
}

// ── Confidentiality controls (C1) ──

async function checkDataClassification(): Promise<SOC2Control> {
  try {
    const total = await sqlGet("SELECT COUNT(*) as cnt FROM data_assets");
    const totalCnt = total ? Number(total.cnt) : 0;

    if (totalCnt === 0) {
      return {
        id: "C1.1",
        name: "Data Classification Coverage",
        category: "confidentiality",
        status: "warn",
        evidence: "No data assets registered. Cannot assess classification coverage.",
      };
    }

    const classified = await sqlGet(
      "SELECT COUNT(*) as cnt FROM data_assets WHERE classification IS NOT NULL AND classification != ''",
    );
    const classifiedCnt = classified ? Number(classified.cnt) : 0;
    const coverage = (classifiedCnt / totalCnt) * 100;

    if (coverage >= 95) {
      return {
        id: "C1.1",
        name: "Data Classification Coverage",
        category: "confidentiality",
        status: "pass",
        evidence: `${coverage.toFixed(1)}% coverage — ${classifiedCnt}/${totalCnt} assets classified.`,
      };
    }
    if (coverage >= 70) {
      return {
        id: "C1.1",
        name: "Data Classification Coverage",
        category: "confidentiality",
        status: "warn",
        evidence: `${coverage.toFixed(1)}% coverage — ${classifiedCnt}/${totalCnt} assets classified. Target: 95%.`,
      };
    }
    return {
      id: "C1.1",
      name: "Data Classification Coverage",
      category: "confidentiality",
      status: "fail",
      evidence: `${coverage.toFixed(1)}% coverage — ${classifiedCnt}/${totalCnt} assets classified. Below 70%.`,
    };
  } catch {
    return {
      id: "C1.1",
      name: "Data Classification Coverage",
      category: "confidentiality",
      status: "warn",
      evidence: "Could not evaluate — data_assets table may not exist.",
    };
  }
}

async function checkEncryptionAtRest(): Promise<SOC2Control> {
  try {
    const encrypted = await sqlGet(
      "SELECT COUNT(*) as cnt FROM data_assets WHERE encryption_status = 'encrypted'",
    );
    const encryptedCnt = encrypted ? Number(encrypted.cnt) : 0;

    const total = await sqlGet("SELECT COUNT(*) as cnt FROM data_assets");
    const totalCnt = total ? Number(total.cnt) : 0;

    if (totalCnt === 0) {
      return {
        id: "C1.2",
        name: "Encryption at Rest",
        category: "confidentiality",
        status: "warn",
        evidence: "No data assets registered. Cannot assess encryption status.",
      };
    }

    const rate = (encryptedCnt / totalCnt) * 100;

    if (rate >= 100) {
      return {
        id: "C1.2",
        name: "Encryption at Rest",
        category: "confidentiality",
        status: "pass",
        evidence: `All ${totalCnt} data assets encrypted at rest.`,
      };
    }
    if (rate >= 80) {
      return {
        id: "C1.2",
        name: "Encryption at Rest",
        category: "confidentiality",
        status: "warn",
        evidence: `${rate.toFixed(1)}% encrypted — ${encryptedCnt}/${totalCnt} assets. Target: 100%.`,
      };
    }
    return {
      id: "C1.2",
      name: "Encryption at Rest",
      category: "confidentiality",
      status: "fail",
      evidence: `${rate.toFixed(1)}% encrypted — ${encryptedCnt}/${totalCnt} assets. Below 80%.`,
    };
  } catch {
    return {
      id: "C1.2",
      name: "Encryption at Rest",
      category: "confidentiality",
      status: "warn",
      evidence: "Could not evaluate — data_assets table may not exist.",
    };
  }
}

// ── Privacy controls (P1) ──

async function checkPrivacyConsent(): Promise<SOC2Control> {
  try {
    const totalUsers = await sqlGet(
      "SELECT COUNT(*) as cnt FROM users",
    );
    const totalCnt = totalUsers ? Number(totalUsers.cnt) : 0;

    if (totalCnt === 0) {
      return {
        id: "P1.1",
        name: "Privacy Consent Records",
        category: "privacy",
        status: "warn",
        evidence: "No users found. Cannot assess consent coverage.",
      };
    }

    const consented = await sqlGet(
      "SELECT COUNT(*) as cnt FROM users WHERE consent_given = 1",
    );
    const consentedCnt = consented ? Number(consented.cnt) : 0;
    const rate = (consentedCnt / totalCnt) * 100;

    if (rate >= 100) {
      return {
        id: "P1.1",
        name: "Privacy Consent Records",
        category: "privacy",
        status: "pass",
        evidence: `All ${totalCnt} users have consent records.`,
      };
    }
    if (rate >= 80) {
      return {
        id: "P1.1",
        name: "Privacy Consent Records",
        category: "privacy",
        status: "warn",
        evidence: `${rate.toFixed(1)}% consent coverage — ${consentedCnt}/${totalCnt} users. Target: 100%.`,
      };
    }
    return {
      id: "P1.1",
      name: "Privacy Consent Records",
      category: "privacy",
      status: "fail",
      evidence: `${rate.toFixed(1)}% consent coverage — ${consentedCnt}/${totalCnt} users. Below 80%.`,
    };
  } catch {
    return {
      id: "P1.1",
      name: "Privacy Consent Records",
      category: "privacy",
      status: "warn",
      evidence: "Could not evaluate — users table may not exist.",
    };
  }
}

async function checkDataSubjectRequests(): Promise<SOC2Control> {
  try {
    const pending = await sqlGet(
      "SELECT COUNT(*) as cnt FROM data_subject_requests WHERE status = 'pending' AND requested_at < datetime('now', '-30 days')",
    );
    const pendingCnt = pending ? Number(pending.cnt) : 0;

    if (pendingCnt === 0) {
      return {
        id: "P1.2",
        name: "Data Subject Request Handling",
        category: "privacy",
        status: "pass",
        evidence: "No overdue data subject requests (all resolved within 30 days).",
      };
    }
    return {
      id: "P1.2",
      name: "Data Subject Request Handling",
      category: "privacy",
      status: "fail",
      evidence: `${pendingCnt} data subject request(s) pending for more than 30 days.`,
    };
  } catch {
    return {
      id: "P1.2",
      name: "Data Subject Request Handling",
      category: "privacy",
      status: "warn",
      evidence: "Could not evaluate — data_subject_requests table may not exist.",
    };
  }
}

async function checkRetentionPolicy(): Promise<SOC2Control> {
  try {
    const policies = await sqlGet(
      "SELECT COUNT(*) as cnt FROM retention_policies",
    );
    const count = policies ? Number(policies.cnt) : 0;

    if (count >= 1) {
      return {
        id: "P1.3",
        name: "Data Retention Policies",
        category: "privacy",
        status: "pass",
        evidence: `${count} retention policy(ies) configured.`,
      };
    }
    return {
      id: "P1.3",
      name: "Data Retention Policies",
      category: "privacy",
      status: "fail",
      evidence: "No retention policies defined.",
    };
  } catch {
    return {
      id: "P1.3",
      name: "Data Retention Policies",
      category: "privacy",
      status: "warn",
      evidence: "Could not evaluate — retention_policies table may not exist.",
    };
  }
}

// ── Public API ──

/** All control check functions in execution order. */
const ALL_CONTROL_CHECKS = [
  // Security (CC6)
  checkAccessControlPolicies,
  checkMfaEnforcement,
  checkAuditLogIntegrity,
  // Availability (A1)
  checkIncidentResponsePlan,
  checkBackupRecovery,
  checkCapacityMonitoring,
  // Processing Integrity (PI1)
  checkInputValidation,
  checkDataIntegrityChecks,
  // Confidentiality (C1)
  checkDataClassification,
  checkEncryptionAtRest,
  // Privacy (P1)
  checkPrivacyConsent,
  checkDataSubjectRequests,
  checkRetentionPolicy,
];

/**
 * Run a full SOC 2 compliance check.
 * Executes all 13 controls across 5 Trust Service Criteria and produces a report.
 */
export async function runSOC2Check(orgId: string): Promise<SOC2Report> {
  void orgId; // reserved for future multi-tenant scoping
  await ensureTables();

  const checkId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const controls = await Promise.all(
    ALL_CONTROL_CHECKS.map((check) => check()),
  );

  const report: SOC2Report = { checkId, timestamp, controls };

  // Persist the report
  await sqlRun(
    "INSERT INTO soc2_report (id, timestamp, controls) VALUES (?, ?, ?)",
    [checkId, timestamp, JSON.stringify(controls)],
  );

  // Persist individual control statuses
  for (const control of controls) {
    await sqlRun(
      `INSERT INTO soc2_control_status (control_id, name, category, status, evidence, checked_at, report_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [control.id, control.name, control.category, control.status, control.evidence, timestamp, checkId],
    );
  }

  return report;
}

/**
 * Get the current SOC 2 control statuses for an organization.
 * Returns the latest report's controls without re-running checks.
 */
export async function getControlStatus(orgId: string): Promise<ControlStatusRow[]> {
  void orgId; // reserved for future multi-tenant scoping
  await ensureTables();

  // Find the latest report
  const latest = await sqlGet(
    "SELECT id, timestamp FROM soc2_report ORDER BY timestamp DESC LIMIT 1",
  );

  if (!latest) {
    return [];
  }

  const reportId = String(latest.id);
  const rows = await sqlAll(
    "SELECT control_id, name, category, status, evidence, checked_at FROM soc2_control_status WHERE report_id = ? ORDER BY control_id",
    [reportId],
  );

  return rows.map((row) => ({
    controlId: String(row.control_id),
    name: String(row.name),
    category: String(row.category) as SOC2Category,
    status: String(row.status) as SOC2ControlStatus,
    evidence: String(row.evidence),
    checkedAt: String(row.checked_at),
  }));
}
