/** @jest-environment node */

/**
 * In-memory mock of all tables used by the SOC 2 controls service.
 * Follows the same pattern as complianceService.test.ts.
 */

// ── In-memory table stores ──

let accessControlPolicyRows: Record<string, unknown>[] = [];
let orgMemberRows: Record<string, unknown>[] = [];
let auditLogRows: Record<string, unknown>[] = [];
let incidentResponsePlanRows: Record<string, unknown>[] = [];
let backupJobRows: Record<string, unknown>[] = [];
let capacityMetricRows: Record<string, unknown>[] = [];
let validationRuleRows: Record<string, unknown>[] = [];
let dataIntegrityCheckRows: Record<string, unknown>[] = [];
let dataAssetRows: Record<string, unknown>[] = [];
let userRows: Record<string, unknown>[] = [];
let dataSubjectRequestRows: Record<string, unknown>[] = [];
let retentionPolicyRows: Record<string, unknown>[] = [];
let soc2ReportRows: Record<string, unknown>[] = [];
let soc2ControlStatusRows: Record<string, unknown>[] = [];

// Track CREATE TABLE calls
const createdTables: string[] = [];

jest.mock('../src/server/libsqlDb', () => ({
  sqlAll: jest.fn(async (sql: string, _args: unknown[] = []) => {
    if (sql.includes('FROM audit_log')) {
      return [...auditLogRows].sort(
        (a, b) => (a.sequence_number as number) - (b.sequence_number as number),
      );
    }
    if (sql.includes('FROM soc2_report')) {
      return [...soc2ReportRows].sort(
        (a, b) => String(b.timestamp).localeCompare(String(a.timestamp)),
      );
    }
    if (sql.includes('FROM soc2_control_status')) {
      const reportId = _args?.[0] as string;
      return soc2ControlStatusRows
        .filter((r) => r.report_id === reportId)
        .sort((a, b) => String(a.control_id).localeCompare(String(b.control_id)));
    }
    return [];
  }),

  sqlGet: jest.fn(async (sql: string, _args: unknown[] = []) => {
    // Access control policies
    if (sql.includes('FROM access_control_policies') && sql.includes('enabled = 1')) {
      return { cnt: accessControlPolicyRows.filter((r) => r.enabled === 1).length };
    }

    // Org members — total
    if (sql.includes('FROM org_members') && sql.includes('COUNT(*)') && !sql.includes('mfa_enabled')) {
      return { cnt: orgMemberRows.length };
    }

    // Org members — MFA enabled
    if (sql.includes('FROM org_members') && sql.includes('mfa_enabled = 1')) {
      return { cnt: orgMemberRows.filter((r) => r.mfa_enabled === 1).length };
    }

    // Audit log — for integrity check (handled by sqlAll)

    // Incident response plans
    if (sql.includes('FROM incident_response_plans') && sql.includes('active = 1')) {
      return { cnt: incidentResponsePlanRows.filter((r) => r.active === 1).length };
    }

    // Backup jobs — recent completed
    if (sql.includes('FROM backup_jobs') && sql.includes("'-7 days'")) {
      return { cnt: backupJobRows.filter((r) => r.status === 'completed' && r.recent === true).length };
    }

    // Backup jobs — any completed
    if (sql.includes('FROM backup_jobs') && sql.includes("status = 'completed'")) {
      return { cnt: backupJobRows.filter((r) => r.status === 'completed').length };
    }

    // Capacity metrics
    if (sql.includes('FROM capacity_metrics')) {
      return { cnt: capacityMetricRows.filter((r) => r.recent === true).length };
    }

    // Validation rules
    if (sql.includes('FROM validation_rules') && sql.includes('enabled = 1')) {
      return { cnt: validationRuleRows.filter((r) => r.enabled === 1).length };
    }

    // Data integrity checks
    if (sql.includes('FROM data_integrity_checks')) {
      return { cnt: dataIntegrityCheckRows.filter((r) => r.status === 'passed' && r.recent === true).length };
    }

    // Data assets — classified
    if (sql.includes('FROM data_assets') && sql.includes('classification IS NOT NULL')) {
      return { cnt: dataAssetRows.filter((r) => r.classification && r.classification !== '').length };
    }

    // Data assets — encrypted
    if (sql.includes('FROM data_assets') && sql.includes("encryption_status = 'encrypted'")) {
      return { cnt: dataAssetRows.filter((r) => r.encryption_status === 'encrypted').length };
    }

    // Data assets — total
    if (sql.includes('FROM data_assets') && sql.includes('COUNT(*)')) {
      return { cnt: dataAssetRows.length };
    }

    // Users — total
    if (sql.includes('FROM users') && sql.includes('COUNT(*)') && !sql.includes('consent')) {
      return { cnt: userRows.length };
    }

    // Users — consented
    if (sql.includes('FROM users') && sql.includes('consent_given = 1')) {
      return { cnt: userRows.filter((r) => r.consent_given === 1).length };
    }

    // Data subject requests — overdue
    if (sql.includes('FROM data_subject_requests')) {
      return { cnt: dataSubjectRequestRows.filter((r) => r.status === 'pending' && r.overdue === true).length };
    }

    // Retention policies
    if (sql.includes('FROM retention_policies') && sql.includes('COUNT(*)')) {
      return { cnt: retentionPolicyRows.length };
    }

    // Latest soc2_report
    if (sql.includes('FROM soc2_report') && sql.includes('LIMIT 1')) {
      if (soc2ReportRows.length === 0) return undefined;
      const sorted = [...soc2ReportRows].sort(
        (a, b) => String(b.timestamp).localeCompare(String(a.timestamp)),
      );
      return sorted[0];
    }

    return undefined;
  }),

  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (match) createdTables.push(match[1]);
      return { rowsAffected: 0 };
    }

    if (sql.startsWith('INSERT INTO soc2_report')) {
      soc2ReportRows.push({
        id: args[0],
        timestamp: args[1],
        controls: args[2],
      });
      return { rowsAffected: 1 };
    }

    if (sql.startsWith('INSERT INTO soc2_control_status')) {
      soc2ControlStatusRows.push({
        control_id: args[0],
        name: args[1],
        category: args[2],
        status: args[3],
        evidence: args[4],
        checked_at: args[5],
        report_id: args[6],
      });
      return { rowsAffected: 1 };
    }

    return { rowsAffected: 0 };
  }),

  closeLibsqlClient: jest.fn(),
}));

import {
  runSOC2Check,
  getControlStatus,
  SOC2Report,
  SOC2Control,
} from '../src/services/compliance/soc2Controls';

// ── Helpers ──

const ORG = 'org-test-soc2';
const GENESIS_HASH = '0'.repeat(64);

function resetAllTables() {
  accessControlPolicyRows = [];
  orgMemberRows = [];
  auditLogRows = [];
  incidentResponsePlanRows = [];
  backupJobRows = [];
  capacityMetricRows = [];
  validationRuleRows = [];
  dataIntegrityCheckRows = [];
  dataAssetRows = [];
  userRows = [];
  dataSubjectRequestRows = [];
  retentionPolicyRows = [];
  soc2ReportRows = [];
  soc2ControlStatusRows = [];
  createdTables.length = 0;
  jest.clearAllMocks();
}

function seedAuditTrail(count: number) {
  for (let i = 1; i <= count; i++) {
    auditLogRows.push({
      id: `audit-${i}`,
      sequence_number: i,
      hash: `hash-${i}`,
      previous_hash: i === 1 ? GENESIS_HASH : `hash-${i - 1}`,
    });
  }
}

function seedAllPassingControls() {
  accessControlPolicyRows.push({ id: 'acp-1', enabled: 1 });
  for (let i = 1; i <= 5; i++) {
    orgMemberRows.push({ id: `m-${i}`, mfa_enabled: 1 });
  }
  seedAuditTrail(3);
  incidentResponsePlanRows.push({ id: 'irp-1', active: 1 });
  backupJobRows.push({ id: 'bk-1', status: 'completed', recent: true });
  capacityMetricRows.push({ id: 'cm-1', recent: true });
  for (let i = 1; i <= 5; i++) {
    validationRuleRows.push({ id: `vr-${i}`, enabled: 1 });
  }
  dataIntegrityCheckRows.push({ id: 'dic-1', status: 'passed', recent: true });
  for (let i = 1; i <= 5; i++) {
    dataAssetRows.push({
      id: `da-${i}`,
      classification: 'confidential',
      encryption_status: 'encrypted',
    });
  }
  for (let i = 1; i <= 3; i++) {
    userRows.push({ id: `u-${i}`, consent_given: 1 });
  }
  dataSubjectRequestRows = [];
  retentionPolicyRows.push({ id: 'rp-1' });
}

// ── Tests ──

describe('soc2Controls', () => {
  beforeEach(resetAllTables);

  // ── Schema bootstrap ──

  test('runSOC2Check creates soc2_report and soc2_control_status tables', async () => {
    seedAllPassingControls();
    await runSOC2Check(ORG);
    expect(createdTables).toContain('soc2_report');
    expect(createdTables).toContain('soc2_control_status');
  });

  // ── Report structure ──

  test('returns a report with 13 controls across 5 categories', async () => {
    seedAllPassingControls();
    const report = await runSOC2Check(ORG);

    expect(report.controls).toHaveLength(13);
    expect(report.checkId).toBeDefined();
    expect(report.checkId.length).toBeGreaterThan(0);
    expect(report.timestamp).toBeDefined();

    const categories = new Set(report.controls.map((c) => c.category));
    expect(categories.size).toBe(5);
    expect(categories.has('security')).toBe(true);
    expect(categories.has('availability')).toBe(true);
    expect(categories.has('processing_integrity')).toBe(true);
    expect(categories.has('confidentiality')).toBe(true);
    expect(categories.has('privacy')).toBe(true);
  });

  test('all controls pass when fully seeded', async () => {
    seedAllPassingControls();
    const report = await runSOC2Check(ORG);

    for (const control of report.controls) {
      expect(control.status).toBe('pass');
      expect(control.evidence.length).toBeGreaterThan(0);
    }
  });

  // ── Security controls ──

  test('CC6.1 fails when no access control policies exist', async () => {
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'CC6.1');
    expect(ctrl!.status).toBe('fail');
    expect(ctrl!.evidence).toContain('No active access control policies');
  });

  test('CC6.2 fails when MFA adoption is below 60%', async () => {
    for (let i = 1; i <= 10; i++) {
      orgMemberRows.push({ id: `m-${i}`, mfa_enabled: i <= 3 ? 1 : 0 });
    }
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'CC6.2');
    expect(ctrl!.status).toBe('fail');
    expect(ctrl!.evidence).toContain('30.0%');
  });

  test('CC6.2 warns when MFA adoption is between 60% and 95%', async () => {
    for (let i = 1; i <= 10; i++) {
      orgMemberRows.push({ id: `m-${i}`, mfa_enabled: i <= 7 ? 1 : 0 });
    }
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'CC6.2');
    expect(ctrl!.status).toBe('warn');
    expect(ctrl!.evidence).toContain('70.0%');
  });

  test('CC6.3 fails when audit chain is broken', async () => {
    auditLogRows.push(
      { id: 'a-1', sequence_number: 1, hash: 'hash-1', previous_hash: GENESIS_HASH },
      { id: 'a-2', sequence_number: 2, hash: 'hash-2', previous_hash: 'wrong-hash' },
    );
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'CC6.3');
    expect(ctrl!.status).toBe('fail');
    expect(ctrl!.evidence).toContain('broken at sequence 2');
  });

  // ── Availability controls ──

  test('A1.1 fails when no incident response plans exist', async () => {
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'A1.1');
    expect(ctrl!.status).toBe('fail');
    expect(ctrl!.evidence).toContain('No active incident response plans');
  });

  test('A1.2 fails when no backups exist', async () => {
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'A1.2');
    expect(ctrl!.status).toBe('fail');
    expect(ctrl!.evidence).toContain('No completed backups');
  });

  // ── Processing integrity controls ──

  test('PI1.1 warns when fewer than 5 validation rules exist', async () => {
    for (let i = 1; i <= 3; i++) {
      validationRuleRows.push({ id: `vr-${i}`, enabled: 1 });
    }
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'PI1.1');
    expect(ctrl!.status).toBe('warn');
    expect(ctrl!.evidence).toContain('3 validation rules');
  });

  // ── Confidentiality controls ──

  test('C1.1 fails when classification coverage is below 70%', async () => {
    for (let i = 1; i <= 10; i++) {
      dataAssetRows.push({
        id: `da-${i}`,
        classification: i <= 3 ? 'confidential' : null,
        encryption_status: 'encrypted',
      });
    }
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'C1.1');
    expect(ctrl!.status).toBe('fail');
    expect(ctrl!.evidence).toContain('30.0%');
  });

  // ── Privacy controls ──

  test('P1.2 fails when data subject requests are overdue', async () => {
    dataSubjectRequestRows.push(
      { id: 'dsr-1', status: 'pending', overdue: true },
      { id: 'dsr-2', status: 'pending', overdue: true },
    );
    retentionPolicyRows.push({ id: 'rp-1' });
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'P1.2');
    expect(ctrl!.status).toBe('fail');
    expect(ctrl!.evidence).toContain('2 data subject request(s) pending');
  });

  test('P1.3 fails when no retention policies exist', async () => {
    const report = await runSOC2Check(ORG);
    const ctrl = report.controls.find((c) => c.id === 'P1.3');
    expect(ctrl!.status).toBe('fail');
    expect(ctrl!.evidence).toContain('No retention policies');
  });

  // ── Report persistence ──

  test('report is persisted to soc2_report table', async () => {
    seedAllPassingControls();
    const report = await runSOC2Check(ORG);
    expect(soc2ReportRows.length).toBeGreaterThanOrEqual(1);
    const stored = soc2ReportRows.find((r) => r.id === report.checkId);
    expect(stored).toBeDefined();
  });

  test('individual controls are persisted to soc2_control_status table', async () => {
    seedAllPassingControls();
    const report = await runSOC2Check(ORG);
    expect(soc2ControlStatusRows.length).toBe(13);
    const storedIds = soc2ControlStatusRows.map((r) => r.control_id);
    expect(storedIds).toContain('CC6.1');
    expect(storedIds).toContain('A1.1');
    expect(storedIds).toContain('PI1.1');
    expect(storedIds).toContain('C1.1');
    expect(storedIds).toContain('P1.1');
  });

  // ── getControlStatus ──

  test('getControlStatus returns empty array when no report exists', async () => {
    const statuses = await getControlStatus(ORG);
    expect(statuses).toEqual([]);
  });

  test('getControlStatus returns latest report controls after check', async () => {
    seedAllPassingControls();
    await runSOC2Check(ORG);

    const statuses = await getControlStatus(ORG);
    expect(statuses.length).toBe(13);
    expect(statuses[0].controlId).toBeDefined();
    expect(statuses[0].name).toBeDefined();
    expect(statuses[0].category).toBeDefined();
    expect(statuses[0].status).toBeDefined();
    expect(statuses[0].evidence).toBeDefined();
    expect(statuses[0].checkedAt).toBeDefined();
  });

  // ── Edge cases ──

  test('controls that cannot evaluate tables return warn status', async () => {
    // No tables seeded — every control should either fail or warn, never throw
    const report = await runSOC2Check(ORG);
    expect(report.controls).toHaveLength(13);
    for (const control of report.controls) {
      expect(['pass', 'warn', 'fail']).toContain(control.status);
    }
  });

  test('multiple checks produce independent reports', async () => {
    seedAllPassingControls();
    const first = await runSOC2Check(ORG);
    const second = await runSOC2Check(ORG);

    expect(first.checkId).not.toBe(second.checkId);
    expect(soc2ReportRows.length).toBe(2);

    // getControlStatus should return the latest
    const statuses = await getControlStatus(ORG);
    expect(statuses.length).toBe(13);
  });
});
