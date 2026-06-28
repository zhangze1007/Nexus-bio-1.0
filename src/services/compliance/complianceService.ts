/**
 * Compliance Service — Automated compliance checks for GxP / SOC2 / ISO 27001.
 *
 * Runs five compliance sections against the database and produces a scored report.
 * Each section evaluates a different control domain and returns pass/warn/fail.
 *
 * Storage: compliance_report + compliance_log tables via @libsql/client.
 */

import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──

export interface ComplianceSection {
  name: string;
  status: "pass" | "warn" | "fail";
  details: string;
}

export interface ComplianceReport {
  checkId: string;
  timestamp: string;
  orgId: string;
  sections: ComplianceSection[];
  overallScore: number; // 0-100
}

export interface ComplianceStatus {
  orgId: string;
  lastCheckId: string | null;
  lastCheckTimestamp: string | null;
  overallScore: number | null;
  sectionStatuses: Record<string, "pass" | "warn" | "fail" | null>;
}

export interface ComplianceEvent {
  orgId: string;
  eventType: string; // check_started, check_completed, section_failed, remediation_requested
  checkId?: string;
  section?: string;
  status?: "pass" | "warn" | "fail";
  details?: string;
  actorId?: string;
}

// ── Schema bootstrap ──

const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS compliance_report (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    sections TEXT NOT NULL,
    overall_score INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS compliance_log (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    check_id TEXT,
    section TEXT,
    status TEXT,
    details TEXT,
    actor_id TEXT,
    timestamp TEXT NOT NULL
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

// ── Individual compliance checks ──

async function checkAuditTrailIntegrity(): Promise<ComplianceSection> {
  try {
    const rows = await sqlAll(
      "SELECT id, hash, previous_hash, sequence_number FROM audit_log ORDER BY sequence_number ASC",
    );

    if (rows.length === 0) {
      return {
        name: "Audit Trail Integrity",
        status: "warn",
        details: "No audit entries found. Audit trail is empty.",
      };
    }

    // Verify hash chain integrity
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
        name: "Audit Trail Integrity",
        status: "fail",
        details: `Hash chain broken at sequence ${brokenAt}. ${rows.length} total entries.`,
      };
    }

    return {
      name: "Audit Trail Integrity",
      status: "pass",
      details: `Verified ${rows.length} entries. Hash chain intact from genesis to latest.`,
    };
  } catch {
    return {
      name: "Audit Trail Integrity",
      status: "warn",
      details: "Could not verify audit trail — audit_log table may not exist.",
    };
  }
}

async function checkDataClassificationCoverage(orgId: string): Promise<ComplianceSection> {
  try {
    const total = await sqlGet("SELECT COUNT(*) as cnt FROM data_assets WHERE org_id = ?", [orgId]);
    const totalCnt = total ? Number(total.cnt) : 0;

    if (totalCnt === 0) {
      return {
        name: "Data Classification Coverage",
        status: "warn",
        details: "No data assets registered. Cannot assess classification coverage.",
      };
    }

    const classified = await sqlGet(
      "SELECT COUNT(*) as cnt FROM data_assets WHERE org_id = ? AND classification IS NOT NULL AND classification != ''",
      [orgId],
    );
    const classifiedCnt = classified ? Number(classified.cnt) : 0;
    const coverage = (classifiedCnt / totalCnt) * 100;

    if (coverage >= 95) {
      return {
        name: "Data Classification Coverage",
        status: "pass",
        details: `${coverage.toFixed(1)}% coverage — ${classifiedCnt}/${totalCnt} assets classified.`,
      };
    }
    if (coverage >= 70) {
      return {
        name: "Data Classification Coverage",
        status: "warn",
        details: `${coverage.toFixed(1)}% coverage — ${classifiedCnt}/${totalCnt} assets classified. Target: 95%.`,
      };
    }
    return {
      name: "Data Classification Coverage",
      status: "fail",
      details: `${coverage.toFixed(1)}% coverage — ${classifiedCnt}/${totalCnt} assets classified. Below 70% threshold.`,
    };
  } catch {
    return {
      name: "Data Classification Coverage",
      status: "warn",
      details: "Could not assess — data_assets table may not exist.",
    };
  }
}

async function checkRetentionPolicyEnforcement(orgId: string): Promise<ComplianceSection> {
  try {
    // Check if retention policies exist
    const policies = await sqlGet("SELECT COUNT(*) as cnt FROM retention_policies WHERE org_id = ?", [orgId]);
    const policyCnt = policies ? Number(policies.cnt) : 0;

    if (policyCnt === 0) {
      return {
        name: "Retention Policy Enforcement",
        status: "fail",
        details: "No retention policies defined for this organization.",
      };
    }

    // Check for expired data that hasn't been purged
    const now = new Date().toISOString();
    const expired = await sqlGet(
      `SELECT COUNT(*) as cnt FROM data_assets da
       JOIN retention_policies rp ON da.retention_policy_id = rp.id
       WHERE da.org_id = ? AND datetime(da.created_at, '+' || rp.retention_days || ' days') < ?`,
      [orgId, now],
    );
    const expiredCnt = expired ? Number(expired.cnt) : 0;

    if (expiredCnt > 0) {
      return {
        name: "Retention Policy Enforcement",
        status: "fail",
        details: `${expiredCnt} data assets past retention period and not yet purged. ${policyCnt} policies active.`,
      };
    }

    return {
      name: "Retention Policy Enforcement",
      status: "pass",
      details: `${policyCnt} retention policies active. No expired data assets found.`,
    };
  } catch {
    return {
      name: "Retention Policy Enforcement",
      status: "warn",
      details: "Could not assess — retention_policies or data_assets table may not exist.",
    };
  }
}

async function checkAccessControlReview(orgId: string): Promise<ComplianceSection> {
  try {
    // Check for a recent access review within the last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const recentReview = await sqlGet(
      "SELECT COUNT(*) as cnt FROM access_reviews WHERE org_id = ? AND reviewed_at > ?",
      [orgId, ninetyDaysAgo],
    );
    const reviewCnt = recentReview ? Number(recentReview.cnt) : 0;

    if (reviewCnt === 0) {
      return {
        name: "Access Control Review",
        status: "fail",
        details: "No access review completed within the last 90 days.",
      };
    }

    // Check for stale permissions (users not reviewed)
    const totalUsers = await sqlGet("SELECT COUNT(*) as cnt FROM org_members WHERE org_id = ?", [orgId]);
    const totalCnt = totalUsers ? Number(totalUsers.cnt) : 0;

    const reviewedUsers = await sqlGet(
      "SELECT COUNT(DISTINCT user_id) as cnt FROM access_review_entries WHERE org_id = ? AND reviewed_at > ?",
      [orgId, ninetyDaysAgo],
    );
    const reviewedCnt = reviewedUsers ? Number(reviewedUsers.cnt) : 0;

    if (totalCnt > 0 && reviewedCnt < totalCnt) {
      const coverage = (reviewedCnt / totalCnt) * 100;
      return {
        name: "Access Control Review",
        status: coverage >= 80 ? "warn" : "fail",
        details: `Last review covered ${reviewedCnt}/${totalCnt} members (${coverage.toFixed(0)}%). Review count: ${reviewCnt}.`,
      };
    }

    return {
      name: "Access Control Review",
      status: "pass",
      details: `${reviewCnt} access review(s) completed. All ${totalCnt} members reviewed.`,
    };
  } catch {
    return {
      name: "Access Control Review",
      status: "warn",
      details: "Could not assess — access_reviews or org_members table may not exist.",
    };
  }
}

async function checkMfaAdoptionRate(orgId: string): Promise<ComplianceSection> {
  try {
    const totalUsers = await sqlGet("SELECT COUNT(*) as cnt FROM org_members WHERE org_id = ?", [orgId]);
    const totalCnt = totalUsers ? Number(totalUsers.cnt) : 0;

    if (totalCnt === 0) {
      return {
        name: "MFA Adoption Rate",
        status: "warn",
        details: "No organization members found. Cannot assess MFA adoption.",
      };
    }

    const mfaEnabled = await sqlGet("SELECT COUNT(*) as cnt FROM org_members WHERE org_id = ? AND mfa_enabled = 1", [
      orgId,
    ]);
    const mfaCnt = mfaEnabled ? Number(mfaEnabled.cnt) : 0;
    const rate = (mfaCnt / totalCnt) * 100;

    if (rate >= 90) {
      return {
        name: "MFA Adoption Rate",
        status: "pass",
        details: `${rate.toFixed(1)}% adoption — ${mfaCnt}/${totalCnt} members have MFA enabled.`,
      };
    }
    if (rate >= 50) {
      return {
        name: "MFA Adoption Rate",
        status: "warn",
        details: `${rate.toFixed(1)}% adoption — ${mfaCnt}/${totalCnt} members have MFA enabled. Target: 90%.`,
      };
    }
    return {
      name: "MFA Adoption Rate",
      status: "fail",
      details: `${rate.toFixed(1)}% adoption — ${mfaCnt}/${totalCnt} members have MFA enabled. Below 50% threshold.`,
    };
  } catch {
    return {
      name: "MFA Adoption Rate",
      status: "warn",
      details: "Could not assess — org_members table may not exist.",
    };
  }
}

// ── Public API ──

/**
 * Run a full compliance check for the given organization.
 * Executes all five compliance sections and produces a scored report.
 */
export async function runComplianceCheck(orgId: string): Promise<ComplianceReport> {
  await ensureTables();

  const checkId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  await logComplianceEvent({
    orgId,
    eventType: "check_started",
    checkId,
  });

  const sections = await Promise.all([
    checkAuditTrailIntegrity(),
    checkDataClassificationCoverage(orgId),
    checkRetentionPolicyEnforcement(orgId),
    checkAccessControlReview(orgId),
    checkMfaAdoptionRate(orgId),
  ]);

  // Score: pass=20, warn=10, fail=0 per section (5 sections, max 100)
  const scoreMap: Record<string, number> = { pass: 20, warn: 10, fail: 0 };
  const overallScore = sections.reduce((sum, s) => sum + scoreMap[s.status], 0);

  const report: ComplianceReport = {
    checkId,
    timestamp,
    orgId,
    sections,
    overallScore,
  };

  // Persist the report
  await sqlRun(
    `INSERT INTO compliance_report (id, org_id, timestamp, sections, overall_score)
     VALUES (?, ?, ?, ?, ?)`,
    [checkId, orgId, timestamp, JSON.stringify(sections), overallScore],
  );

  // Log individual section failures/warnings
  for (const section of sections) {
    if (section.status !== "pass") {
      await logComplianceEvent({
        orgId,
        eventType: "section_failed",
        checkId,
        section: section.name,
        status: section.status,
        details: section.details,
      });
    }
  }

  await logComplianceEvent({
    orgId,
    eventType: "check_completed",
    checkId,
    details: `Overall score: ${overallScore}/100`,
  });

  return report;
}

/**
 * Get the current compliance status for an organization.
 * Returns the latest report's summary without re-running checks.
 */
export async function getComplianceStatus(orgId: string): Promise<ComplianceStatus> {
  await ensureTables();

  const latest = await sqlGet(
    `SELECT id, timestamp, sections, overall_score
     FROM compliance_report
     WHERE org_id = ?
     ORDER BY timestamp DESC
     LIMIT 1`,
    [orgId],
  );

  if (!latest) {
    return {
      orgId,
      lastCheckId: null,
      lastCheckTimestamp: null,
      overallScore: null,
      sectionStatuses: {
        "Audit Trail Integrity": null,
        "Data Classification Coverage": null,
        "Retention Policy Enforcement": null,
        "Access Control Review": null,
        "MFA Adoption Rate": null,
      },
    };
  }

  const sections: ComplianceSection[] = JSON.parse(String(latest.sections));
  const sectionStatuses: Record<string, "pass" | "warn" | "fail" | null> = {};
  for (const s of sections) {
    sectionStatuses[s.name] = s.status;
  }

  return {
    orgId,
    lastCheckId: String(latest.id),
    lastCheckTimestamp: String(latest.timestamp),
    overallScore: Number(latest.overall_score),
    sectionStatuses,
  };
}

/**
 * Log a compliance-related event for audit and tracking purposes.
 */
export async function logComplianceEvent(event: ComplianceEvent): Promise<{ id: string }> {
  await ensureTables();

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  await sqlRun(
    `INSERT INTO compliance_log (id, org_id, event_type, check_id, section, status, details, actor_id, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      event.orgId,
      event.eventType,
      event.checkId ?? null,
      event.section ?? null,
      event.status ?? null,
      event.details ?? null,
      event.actorId ?? null,
      timestamp,
    ],
  );

  return { id };
}
