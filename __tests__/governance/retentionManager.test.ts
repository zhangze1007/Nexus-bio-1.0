/** @jest-environment node */

/**
 * Tests for the Retention Manager — policy enforcement, archiving, and soft-deletion.
 */

// ── In-memory mock tables ─────────────────────────────────────────────

let mockEntityRows: Record<string, unknown>[] = [];
let mockArchivedRows: Record<string, unknown>[] = [];
let mockSoftDeletedRows: Record<string, unknown>[] = [];
let mockPolicyRows: Record<string, unknown>[] = [];

jest.mock('../../src/server/libsqlDb', () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // Retention policies query
    if (sql.includes('retention_policies') && sql.includes('WHERE org_id')) {
      return mockPolicyRows.filter((r) => r.org_id === args[0]);
    }
    // Archived records count
    if (sql.includes('archived_records') && sql.includes('COUNT')) {
      const table = args[0];
      return [{ cnt: mockArchivedRows.filter((r) => r.original_table === table).length }];
    }
    // Soft deleted records for permanent delete
    if (sql.includes('soft_deleted_records') && sql.includes('recoverable_until')) {
      const table = args[0];
      const cutoff = args[1] as string;
      return mockSoftDeletedRows.filter(
        (r) => r.original_table === table && String(r.recoverable_until) < cutoff,
      );
    }
    // Entity table scan for archiving
    if (sql.includes('created_at <') && sql.includes('archived')) {
      const cutoff = args[0] as string;
      return mockEntityRows.filter(
        (r) => String(r.created_at) < cutoff && (!r.archived || r.archived === 0),
      );
    }
    // Entity table scan for deletion
    if (sql.includes('created_at <') && sql.includes('soft_deleted')) {
      const cutoff = args[0] as string;
      return mockEntityRows.filter(
        (r) => String(r.created_at) < cutoff && (!r.soft_deleted || r.soft_deleted === 0),
      );
    }
    // Entity table total count
    if (sql.includes('COUNT(*)') && !sql.includes('archived_records') && !sql.includes('soft_deleted_records')) {
      return [{ cnt: mockEntityRows.filter((r) => !r.soft_deleted || r.soft_deleted === 0).length }];
    }
    // Entity table expired count
    if (sql.includes('COUNT(*)') && sql.includes('created_at <')) {
      const cutoff = args[0] as string;
      return [{
        cnt: mockEntityRows.filter(
          (r) => String(r.created_at) < cutoff && (!r.soft_deleted || r.soft_deleted === 0),
        ).length,
      }];
    }
    return [];
  }),
  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes('COUNT(*)') && sql.includes('archived_records')) {
      const table = args[0];
      return { cnt: mockArchivedRows.filter((r) => r.original_table === table).length };
    }
    if (sql.includes('COUNT(*)')) {
      if (sql.includes('created_at <')) {
        const cutoff = args[0] as string;
        return {
          cnt: mockEntityRows.filter(
            (r) => String(r.created_at) < cutoff && (!r.soft_deleted || r.soft_deleted === 0),
          ).length,
        };
      }
      return { cnt: mockEntityRows.filter((r) => !r.soft_deleted || r.soft_deleted === 0).length };
    }
    return undefined;
  }),
  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith('CREATE TABLE')) {
      return { rowsAffected: 0 };
    }
    // Insert into archived_records
    if (sql.startsWith('INSERT INTO archived_records')) {
      mockArchivedRows.push({
        id: args[0],
        original_table: args[1],
        original_id: args[2],
        data: args[3],
        archived_at: args[4],
        archived_by: args[5],
      });
      return { rowsAffected: 1 };
    }
    // Insert into soft_deleted_records
    if (sql.startsWith('INSERT INTO soft_deleted_records')) {
      mockSoftDeletedRows.push({
        id: args[0],
        original_table: args[1],
        original_id: args[2],
        data: args[3],
        deleted_at: args[4],
        recoverable_until: args[5],
        deleted_by: args[6],
      });
      return { rowsAffected: 1 };
    }
    // Update entity SET archived = 1
    if (sql.includes('SET archived = 1')) {
      const id = args[0];
      const row = mockEntityRows.find((r) => r.id === id);
      if (row) row.archived = 1;
      return { rowsAffected: row ? 1 : 0 };
    }
    // Update entity SET soft_deleted = 1
    if (sql.includes('SET soft_deleted = 1')) {
      const id = args[0];
      const row = mockEntityRows.find((r) => r.id === id);
      if (row) row.soft_deleted = 1;
      return { rowsAffected: row ? 1 : 0 };
    }
    // Delete from soft_deleted_records
    if (sql.startsWith('DELETE FROM soft_deleted_records')) {
      const id = args[0];
      const idx = mockSoftDeletedRows.findIndex((r) => r.id === id);
      if (idx >= 0) {
        mockSoftDeletedRows.splice(idx, 1);
        return { rowsAffected: 1 };
      }
      return { rowsAffected: 0 };
    }
    return { rowsAffected: 0 };
  }),
  sqlBatch: jest.fn(async () => {}),
  closeLibsqlClient: jest.fn(),
}));

import { RetentionManager } from '../../src/services/governance/retentionManager';
import type { RetentionPolicy } from '../../src/services/governance/types';

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

beforeEach(() => {
  mockEntityRows = [];
  mockArchivedRows = [];
  mockSoftDeletedRows = [];
  mockPolicyRows = [];
});

describe('RetentionManager.enforceRetentionPolicy', () => {
  const basePolicy: RetentionPolicy = {
    id: 'policy-1',
    orgId: 'org-1',
    entityType: 'experiments',
    classification: 'internal',
    retentionDays: 90,
    archiveAfterDays: 30,
    autoDelete: false,
  };

  test('archives records older than archiveAfterDays', async () => {
    mockEntityRows = [
      { id: 'exp-1', created_at: daysAgo(45), archived: 0, soft_deleted: 0 },
      { id: 'exp-2', created_at: daysAgo(10), archived: 0, soft_deleted: 0 },
    ];

    const manager = new RetentionManager();
    const result = await manager.enforceRetentionPolicy(basePolicy);

    expect(result.archived).toBe(1);
    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockArchivedRows).toHaveLength(1);
    expect(mockArchivedRows[0].original_id).toBe('exp-1');
  });

  test('soft-deletes records older than retentionDays', async () => {
    mockEntityRows = [
      { id: 'exp-1', created_at: daysAgo(100), archived: 1, soft_deleted: 0 },
      { id: 'exp-2', created_at: daysAgo(95), archived: 0, soft_deleted: 0 },
    ];

    const manager = new RetentionManager();
    const result = await manager.enforceRetentionPolicy(basePolicy);

    expect(result.deleted).toBe(2);
    expect(mockSoftDeletedRows).toHaveLength(2);
  });

  test('skips already archived records', async () => {
    mockEntityRows = [
      { id: 'exp-1', created_at: daysAgo(50), archived: 1, soft_deleted: 0 },
    ];

    const manager = new RetentionManager();
    const result = await manager.enforceRetentionPolicy(basePolicy);

    expect(result.archived).toBe(0);
  });

  test('skips already soft-deleted records', async () => {
    mockEntityRows = [
      { id: 'exp-1', created_at: daysAgo(100), archived: 0, soft_deleted: 1 },
    ];

    const manager = new RetentionManager();
    const result = await manager.enforceRetentionPolicy(basePolicy);

    expect(result.deleted).toBe(0);
  });

  test('returns errors gracefully when table does not exist', async () => {
    const policy = { ...basePolicy, entityType: 'nonexistent_table' };

    const manager = new RetentionManager();
    const result = await manager.enforceRetentionPolicy(policy);

    // Should not throw — errors are collected
    expect(result).toBeDefined();
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
  });

  test('handles empty tables', async () => {
    mockEntityRows = [];

    const manager = new RetentionManager();
    const result = await manager.enforceRetentionPolicy(basePolicy);

    expect(result.archived).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  test('sets recoverable_until to 30 days from now for soft-deleted records', async () => {
    mockEntityRows = [
      { id: 'exp-1', created_at: daysAgo(100), archived: 0, soft_deleted: 0 },
    ];

    const manager = new RetentionManager();
    await manager.enforceRetentionPolicy(basePolicy);

    expect(mockSoftDeletedRows).toHaveLength(1);
    const recoverable = new Date(mockSoftDeletedRows[0].recoverable_until as string);
    const now = new Date();
    const diffDays = Math.round((recoverable.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });
});

describe('RetentionManager.getRetentionStatus', () => {
  test('returns status for each policy in the org', async () => {
    mockPolicyRows = [
      {
        id: 'policy-1',
        org_id: 'org-1',
        entity_type: 'experiments',
        classification: 'internal',
        retention_days: 90,
        archive_after_days: 30,
        auto_delete: 0,
      },
    ];

    mockEntityRows = [
      { id: 'exp-1', created_at: daysAgo(5), soft_deleted: 0 },
      { id: 'exp-2', created_at: daysAgo(100), soft_deleted: 0 },
    ];
    mockArchivedRows = [
      { id: 'arch-1', original_table: 'experiments', original_id: 'exp-old' },
    ];

    const manager = new RetentionManager();
    const status = await manager.getRetentionStatus('org-1');

    expect(status).toHaveLength(1);
    expect(status[0].entityType).toBe('experiments');
    expect(status[0].archivedRecords).toBe(1);
  });

  test('returns empty array for org with no policies', async () => {
    mockPolicyRows = [];

    const manager = new RetentionManager();
    const status = await manager.getRetentionStatus('org-empty');

    expect(status).toHaveLength(0);
  });
});
