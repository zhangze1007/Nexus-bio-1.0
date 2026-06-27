/** @jest-environment node */

import { sqlRun, sqlAll, sqlGet, closeLibsqlClient } from '../src/server/libsqlDb';
import {
  enforceRetentionPolicies,
  getRetentionStatus,
  archiveExpiredData,
} from '../src/services/governance/retentionAutomation';
import { ensureRetentionTables } from '../src/services/governance/retentionManager';

const TEST_ORG = 'test-org-retention';

afterAll(() => {
  closeLibsqlClient();
});

describe('retentionAutomation', () => {
  beforeEach(async () => {
    await ensureRetentionTables();

    // Create a test entity table with retention-compatible columns
    await sqlRun('DROP TABLE IF EXISTS test_retention_entity').catch(() => {});
    await sqlRun(`
      CREATE TABLE test_retention_entity (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        archived INTEGER DEFAULT 0,
        soft_deleted INTEGER DEFAULT 0
      )
    `);

    // Create a second test entity table
    await sqlRun('DROP TABLE IF EXISTS test_retention_entity_2').catch(() => {});
    await sqlRun(`
      CREATE TABLE test_retention_entity_2 (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        archived INTEGER DEFAULT 0,
        soft_deleted INTEGER DEFAULT 0
      )
    `);

    // Clean up policies and archive/soft-delete tables for the test org
    await sqlRun('DELETE FROM retention_policies WHERE org_id = ?', [TEST_ORG]).catch(() => {});
    await sqlRun('DELETE FROM archived_records WHERE original_table IN (?, ?)', [
      'test_retention_entity',
      'test_retention_entity_2',
    ]).catch(() => {});
    await sqlRun('DELETE FROM soft_deleted_records WHERE original_table IN (?, ?)', [
      'test_retention_entity',
      'test_retention_entity_2',
    ]).catch(() => {});
  });

  afterEach(async () => {
    await sqlRun('DELETE FROM retention_policies WHERE org_id = ?', [TEST_ORG]).catch(() => {});
    await sqlRun('DELETE FROM archived_records WHERE original_table IN (?, ?)', [
      'test_retention_entity',
      'test_retention_entity_2',
    ]).catch(() => {});
    await sqlRun('DELETE FROM soft_deleted_records WHERE original_table IN (?, ?)', [
      'test_retention_entity',
      'test_retention_entity_2',
    ]).catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS test_retention_entity');
    await sqlRun('DROP TABLE IF EXISTS test_retention_entity_2');
  });

  // ── enforceRetentionPolicies ───────────────────────────────────────

  describe('enforceRetentionPolicies', () => {
    it('throws on empty orgId', async () => {
      await expect(enforceRetentionPolicies('')).rejects.toThrow('orgId is required');
    });

    it('throws on whitespace-only orgId', async () => {
      await expect(enforceRetentionPolicies('   ')).rejects.toThrow('orgId is required');
    });

    it('returns zero counts when no policies exist', async () => {
      const result = await enforceRetentionPolicies(TEST_ORG);
      expect(result.archived).toBe(0);
      expect(result.deleted).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('archives records older than archiveAfterDays', async () => {
      // Insert a policy: archive after 7 days, delete after 30 days
      await sqlRun(
        `INSERT INTO retention_policies (id, org_id, entity_type, classification, retention_days, archive_after_days, auto_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['p1', TEST_ORG, 'test_retention_entity', 'internal', 30, 7, 0],
      );

      // Insert a record created 10 days ago (past archive cutoff of 7 days)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at) VALUES (?, ?, ?)`,
        ['r1', 'old-record', tenDaysAgo.toISOString()],
      );

      const result = await enforceRetentionPolicies(TEST_ORG);
      expect(result.archived).toBe(1);
      expect(result.deleted).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify the record is now archived
      const archived = await sqlGet(
        'SELECT * FROM archived_records WHERE original_table = ? AND original_id = ?',
        ['test_retention_entity', 'r1'],
      );
      expect(archived).toBeDefined();

      // Verify the source record is marked as archived
      const source = await sqlGet(
        'SELECT archived FROM test_retention_entity WHERE id = ?',
        ['r1'],
      );
      expect(Number(source?.archived)).toBe(1);
    });

    it('soft-deletes records older than retentionDays', async () => {
      // Insert a policy: archive after 1 day, delete after 1 day (both short for testing)
      await sqlRun(
        `INSERT INTO retention_policies (id, org_id, entity_type, classification, retention_days, archive_after_days, auto_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['p2', TEST_ORG, 'test_retention_entity', 'internal', 1, 1, 0],
      );

      // Insert a record created 5 days ago (past both cutoffs)
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at) VALUES (?, ?, ?)`,
        ['r2', 'very-old-record', fiveDaysAgo.toISOString()],
      );

      const result = await enforceRetentionPolicies(TEST_ORG);
      expect(result.archived).toBe(1);
      expect(result.deleted).toBe(1);
    });

    it('aggregates results across multiple policies', async () => {
      // Two policies for two different entity types
      await sqlRun(
        `INSERT INTO retention_policies (id, org_id, entity_type, classification, retention_days, archive_after_days, auto_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['p3', TEST_ORG, 'test_retention_entity', 'internal', 30, 7, 0],
      );
      await sqlRun(
        `INSERT INTO retention_policies (id, org_id, entity_type, classification, retention_days, archive_after_days, auto_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['p4', TEST_ORG, 'test_retention_entity_2', 'confidential', 60, 14, 0],
      );

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at) VALUES (?, ?, ?)`,
        ['r3', 'entity1-record', tenDaysAgo.toISOString()],
      );
      await sqlRun(
        `INSERT INTO test_retention_entity_2 (id, label, created_at) VALUES (?, ?, ?)`,
        ['r4', 'entity2-record', tenDaysAgo.toISOString()],
      );

      const result = await enforceRetentionPolicies(TEST_ORG);
      // r3 is 10 days old, archive cutoff is 7 -> archived
      // r4 is 10 days old, archive cutoff is 14 -> not archived
      expect(result.archived).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('collects errors from non-existent entity tables gracefully', async () => {
      await sqlRun(
        `INSERT INTO retention_policies (id, org_id, entity_type, classification, retention_days, archive_after_days, auto_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['p5', TEST_ORG, 'nonexistent_table_xyz', 'internal', 30, 7, 0],
      );

      const result = await enforceRetentionPolicies(TEST_ORG);
      expect(result.archived).toBe(0);
      expect(result.deleted).toBe(0);
      // Should have at least one error about the missing table
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('does not archive already-archived records', async () => {
      await sqlRun(
        `INSERT INTO retention_policies (id, org_id, entity_type, classification, retention_days, archive_after_days, auto_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['p6', TEST_ORG, 'test_retention_entity', 'internal', 30, 7, 0],
      );

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      // Insert an already-archived record
      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at, archived) VALUES (?, ?, ?, ?)`,
        ['r5', 'already-archived', tenDaysAgo.toISOString(), 1],
      );

      const result = await enforceRetentionPolicies(TEST_ORG);
      expect(result.archived).toBe(0);
    });
  });

  // ── getRetentionStatus ─────────────────────────────────────────────

  describe('getRetentionStatus', () => {
    it('throws on empty orgId', async () => {
      await expect(getRetentionStatus('')).rejects.toThrow('orgId is required');
    });

    it('returns empty array when no policies exist', async () => {
      const status = await getRetentionStatus(TEST_ORG);
      expect(status).toEqual([]);
    });

    it('returns correct counts for entity types', async () => {
      await sqlRun(
        `INSERT INTO retention_policies (id, org_id, entity_type, classification, retention_days, archive_after_days, auto_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['p7', TEST_ORG, 'test_retention_entity', 'internal', 30, 7, 0],
      );

      // Insert 3 active records, 1 already archived
      const now = new Date().toISOString();
      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at) VALUES (?, ?, ?)`,
        ['s1', 'active-1', now],
      );
      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at) VALUES (?, ?, ?)`,
        ['s2', 'active-2', now],
      );
      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at) VALUES (?, ?, ?)`,
        ['s3', 'active-3', now],
      );

      // Insert an archived record in the archive table
      await sqlRun(
        `INSERT INTO archived_records (id, original_table, original_id, data, archived_at, archived_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['a1', 'test_retention_entity', 's-old', '{}', now, 'test'],
      );

      const status = await getRetentionStatus(TEST_ORG);
      expect(status).toHaveLength(1);
      expect(status[0].entityType).toBe('test_retention_entity');
      expect(status[0].totalRecords).toBe(3);
      expect(status[0].archivedRecords).toBe(1);
    });

    it('reports zeros for tables that do not exist', async () => {
      await sqlRun(
        `INSERT INTO retention_policies (id, org_id, entity_type, classification, retention_days, archive_after_days, auto_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['p8', TEST_ORG, 'nonexistent_table_xyz', 'internal', 30, 7, 0],
      );

      const status = await getRetentionStatus(TEST_ORG);
      expect(status).toHaveLength(1);
      expect(status[0].entityType).toBe('nonexistent_table_xyz');
      expect(status[0].totalRecords).toBe(0);
      expect(status[0].expiredRecords).toBe(0);
      expect(status[0].archivedRecords).toBe(0);
    });
  });

  // ── archiveExpiredData ─────────────────────────────────────────────

  describe('archiveExpiredData', () => {
    it('throws on empty entityType', async () => {
      await expect(archiveExpiredData('', new Date())).rejects.toThrow(
        'entityType is required',
      );
    });

    it('throws on invalid cutoffDate', async () => {
      await expect(
        archiveExpiredData('test_retention_entity', new Date('invalid')),
      ).rejects.toThrow('cutoffDate must be a valid Date');
    });

    it('archives records older than cutoff', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at) VALUES (?, ?, ?)`,
        ['c1', 'old', tenDaysAgo.toISOString()],
      );
      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at) VALUES (?, ?, ?)`,
        ['c2', 'recent', fiveDaysAgo.toISOString()],
      );

      // Cutoff: 7 days ago — should archive c1 but not c2
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await archiveExpiredData('test_retention_entity', sevenDaysAgo);
      expect(result.entityType).toBe('test_retention_entity');
      expect(result.archivedCount).toBe(1);
      expect(result.cutoffDate).toBe(sevenDaysAgo.toISOString());
      expect(result.errors).toHaveLength(0);

      // Verify c1 is archived
      const archived = await sqlGet(
        'SELECT * FROM archived_records WHERE original_table = ? AND original_id = ?',
        ['test_retention_entity', 'c1'],
      );
      expect(archived).toBeDefined();
    });

    it('skips already-archived records', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at, archived) VALUES (?, ?, ?, ?)`,
        ['c3', 'already-archived', tenDaysAgo.toISOString(), 1],
      );

      const result = await archiveExpiredData('test_retention_entity', new Date());
      expect(result.archivedCount).toBe(0);
    });

    it('returns zero for a table with no expired records', async () => {
      const now = new Date();
      await sqlRun(
        `INSERT INTO test_retention_entity (id, name, created_at) VALUES (?, ?, ?)`,
        ['c4', 'brand-new', now.toISOString()],
      );

      const result = await archiveExpiredData('test_retention_entity', now);
      expect(result.archivedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
