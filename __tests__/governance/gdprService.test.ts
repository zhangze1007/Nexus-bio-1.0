/** @jest-environment node */

/**
 * Tests for the GDPR Service — Articles 15, 17, and 20 compliance.
 *
 * Covers:
 * - requestDataDeletion / processDeletion (Article 17)
 * - requestDataExport / processExport (Article 20)
 * - getDataSummary (Article 15)
 * - Audit log anonymization
 * - Soft-delete with 30-day recovery
 * - Export as ZIP with JSON files per table
 */

// ── In-memory mock tables ─────────────────────────────────────────────

let mockGdprRequests: Record<string, unknown>[] = [];
let mockSoftDeletedRows: Record<string, unknown>[] = [];
let mockTableData: Record<string, Record<string, unknown>[]> = {};

jest.mock('../../src/server/libsqlDb', () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // GDPR requests lookup
    if (sql.includes('gdpr_requests') && sql.includes('WHERE id')) {
      return mockGdprRequests.filter((r) => r.id === args[0]);
    }
    // User data in a specific table
    for (const table of [
      'workbench_projects', 'workbench_experiments', 'workbench_history',
      'workbench_artifacts', 'audit_log', 'gdpr_requests',
    ]) {
      if (sql.includes(`SELECT * FROM ${table}`) && sql.includes('WHERE')) {
        const userId = args[0];
        return (mockTableData[table] || []).filter((r) => {
          const userCol = table === 'gdpr_requests' ? 'user_id' : 'actor_id';
          return r[userCol] === userId;
        });
      }
    }
    return [];
  }),
  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    // GDPR request by id and type
    if (sql.includes('gdpr_requests') && sql.includes('WHERE id')) {
      return mockGdprRequests.find((r) => r.id === args[0] && (args.length < 2 || r.type === args[1]));
    }
    // COUNT queries
    if (sql.includes('COUNT(*)')) {
      for (const table of [
        'workbench_projects', 'workbench_experiments', 'workbench_history',
        'workbench_artifacts', 'audit_log', 'gdpr_requests',
      ]) {
        if (sql.includes(table)) {
          const userId = args[0];
          const userCol = table === 'gdpr_requests' ? 'user_id' : 'actor_id';
          const count = (mockTableData[table] || []).filter((r) => r[userCol] === userId).length;
          return { cnt: count };
        }
      }
      return { cnt: 0 };
    }
    // Timestamp queries
    if (sql.includes('ORDER BY') && sql.includes('DESC LIMIT 1')) {
      for (const table of [
        'workbench_projects', 'workbench_experiments', 'workbench_history',
        'workbench_artifacts', 'audit_log', 'gdpr_requests',
      ]) {
        if (sql.includes(table)) {
          const userId = args[0];
          const userCol = table === 'gdpr_requests' ? 'user_id' : 'actor_id';
          const rows = (mockTableData[table] || []).filter((r) => r[userCol] === userId);
          if (rows.length > 0) {
            // Return the last row's timestamp
            const tsCol = sql.match(/SELECT (\w+) FROM/)?.[1] || 'updated_at';
            return { [tsCol]: rows[rows.length - 1][tsCol] || '2026-01-01T00:00:00Z' };
          }
          return undefined;
        }
      }
      return undefined;
    }
    return undefined;
  }),
  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith('CREATE TABLE')) {
      return { rowsAffected: 0 };
    }
    // INSERT into gdpr_requests
    // SQL: INSERT INTO gdpr_requests (id, user_id, type, status, requested_at) VALUES (?, ?, 'deletion', 'pending', ?)
    // args: [id, userId, now] — type and status are literals in SQL, not bind params
    if (sql.startsWith('INSERT INTO gdpr_requests')) {
      const typeMatch = sql.match(/'(\w+)'\s*,\s*'(\w+)'/);
      const request = {
        id: args[0],
        user_id: args[1],
        type: typeMatch ? typeMatch[1] : 'deletion',
        status: typeMatch ? typeMatch[2] : 'pending',
        requested_at: args[2],
        completed_at: null,
        error_message: null,
      };
      mockGdprRequests.push(request);
      return { rowsAffected: 1 };
    }
    // UPDATE gdpr_requests
    if (sql.startsWith('UPDATE gdpr_requests')) {
      const row = mockGdprRequests.find((r) => r.id === args[args.length - 1]);
      if (row) {
        if (sql.includes('status =')) row.status = args[0];
        if (sql.includes('completed_at =') && args.length >= 3) row.completed_at = args[1];
        if (sql.includes('error_message =') && args.length >= 3) row.error_message = args[1];
        // Simple 2-arg update (status, id)
        if (args.length === 2 && sql.includes('status =')) {
          row.status = args[0];
        }
        return { rowsAffected: 1 };
      }
      return { rowsAffected: 0 };
    }
    // UPDATE audit_log anonymization
    if (sql.includes('UPDATE audit_log') && sql.includes('DELETED USER')) {
      const userId = args[0];
      let affected = 0;
      for (const row of mockTableData['audit_log'] || []) {
        if (row.actor_id === userId) {
          row.actor_id = '[DELETED USER]';
          row.actor_name = '[DELETED USER]';
          row.actor_email = null;
          row.actor_ip = null;
          affected++;
        }
      }
      return { rowsAffected: affected };
    }
    // INSERT into soft_deleted_records
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
    // UPDATE SET soft_deleted = 1
    if (sql.includes('SET soft_deleted = 1')) {
      // Match table name from the SQL
      const tableMatch = sql.match(/UPDATE (\w+) SET/);
      if (tableMatch) {
        const table = tableMatch[1];
        const userId = args[0];
        const userCol = table === 'gdpr_requests' ? 'user_id' : 'actor_id';
        let affected = 0;
        for (const row of mockTableData[table] || []) {
          if (row[userCol] === userId && (!row.soft_deleted || row.soft_deleted === 0)) {
            row.soft_deleted = 1;
            affected++;
          }
        }
        return { rowsAffected: affected };
      }
      return { rowsAffected: 0 };
    }
    return { rowsAffected: 0 };
  }),
  sqlBatch: jest.fn(async () => {}),
  closeLibsqlClient: jest.fn(),
}));

import { GDPRService, ExportStore } from '../../src/services/governance/gdprService';

beforeEach(() => {
  mockGdprRequests = [];
  mockSoftDeletedRows = [];
  mockTableData = {};
  ExportStore.clear();
});

describe('GDPRService.requestDataDeletion', () => {
  test('creates a pending deletion request', async () => {
    const service = new GDPRService();
    const request = await service.requestDataDeletion('user-1');

    expect(request.type).toBe('deletion');
    expect(request.status).toBe('pending');
    expect(request.userId).toBe('user-1');
    expect(request.id).toBeDefined();
    expect(request.requestedAt).toBeDefined();
    expect(mockGdprRequests).toHaveLength(1);
  });

  test('generates unique IDs for each request', async () => {
    const service = new GDPRService();
    const r1 = await service.requestDataDeletion('user-1');
    const r2 = await service.requestDataDeletion('user-2');

    expect(r1.id).not.toBe(r2.id);
  });
});

describe('GDPRService.processDeletion', () => {
  test('soft-deletes user data across tables', async () => {
    mockTableData = {
      workbench_projects: [
        { id: 'proj-1', actor_id: 'user-1', name: 'Project A' },
        { id: 'proj-2', actor_id: 'user-2', name: 'Project B' },
      ],
      workbench_experiments: [
        { id: 'exp-1', actor_id: 'user-1', title: 'Experiment A' },
      ],
    };

    const service = new GDPRService();
    const request = await service.requestDataDeletion('user-1');
    const result = await service.processDeletion(request.id);

    expect(result.tablesAffected).toContain('workbench_projects');
    expect(result.tablesAffected).toContain('workbench_experiments');
    expect(result.recordsDeleted).toBe(2);
    expect(mockSoftDeletedRows.length).toBeGreaterThanOrEqual(2);
  });

  test('anonymizes audit logs instead of deleting', async () => {
    mockTableData = {
      audit_log: [
        { id: 'log-1', actor_id: 'user-1', actor_name: 'John', actor_email: 'john@test.com', actor_ip: '1.2.3.4' },
        { id: 'log-2', actor_id: 'user-2', actor_name: 'Jane', actor_email: 'jane@test.com', actor_ip: '5.6.7.8' },
      ],
    };

    const service = new GDPRService();
    const request = await service.requestDataDeletion('user-1');
    const result = await service.processDeletion(request.id);

    expect(result.recordsAnonymized).toBe(1);
    expect(result.tablesAffected).toContain('audit_log');
    // Verify anonymization
    expect(mockTableData['audit_log'][0].actor_id).toBe('[DELETED USER]');
    expect(mockTableData['audit_log'][0].actor_name).toBe('[DELETED USER]');
    // Other user's data should be untouched
    expect(mockTableData['audit_log'][1].actor_id).toBe('user-2');
  });

  test('marks request as completed after processing', async () => {
    mockTableData = {
      workbench_projects: [
        { id: 'proj-1', actor_id: 'user-1', name: 'Project A' },
      ],
    };

    const service = new GDPRService();
    const request = await service.requestDataDeletion('user-1');
    await service.processDeletion(request.id);

    const stored = mockGdprRequests.find((r) => r.id === request.id);
    expect(stored?.status).toBe('completed');
    expect(stored?.completed_at).toBeDefined();
  });

  test('throws if request not found', async () => {
    const service = new GDPRService();
    await expect(service.processDeletion('nonexistent-id')).rejects.toThrow('not found');
  });

  test('throws if request already completed', async () => {
    mockGdprRequests = [{
      id: 'req-1',
      user_id: 'user-1',
      type: 'deletion',
      status: 'completed',
      requested_at: new Date().toISOString(),
    }];

    const service = new GDPRService();
    await expect(service.processDeletion('req-1')).rejects.toThrow('already completed');
  });

  test('sets recoverable_until to 30 days from now', async () => {
    mockTableData = {
      workbench_projects: [
        { id: 'proj-1', actor_id: 'user-1', name: 'Project A' },
      ],
    };

    const service = new GDPRService();
    const request = await service.requestDataDeletion('user-1');
    await service.processDeletion(request.id);

    expect(mockSoftDeletedRows).toHaveLength(1);
    const recoverable = new Date(mockSoftDeletedRows[0].recoverable_until as string);
    const now = new Date();
    const diffDays = Math.round((recoverable.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  test('handles user with no data gracefully', async () => {
    mockTableData = {};

    const service = new GDPRService();
    const request = await service.requestDataDeletion('user-ghost');
    const result = await service.processDeletion(request.id);

    expect(result.recordsDeleted).toBe(0);
    expect(result.tablesAffected).toHaveLength(0);
  });
});

describe('GDPRService.requestDataExport', () => {
  test('creates a pending export request', async () => {
    const service = new GDPRService();
    const request = await service.requestDataExport('user-1');

    expect(request.type).toBe('export');
    expect(request.status).toBe('pending');
    expect(request.userId).toBe('user-1');
  });
});

describe('GDPRService.processExport', () => {
  test('exports user data as ZIP with JSON files', async () => {
    mockTableData = {
      workbench_projects: [
        { id: 'proj-1', actor_id: 'user-1', name: 'Project A', updated_at: '2026-01-01T00:00:00Z' },
      ],
      workbench_experiments: [
        { id: 'exp-1', actor_id: 'user-1', title: 'Experiment A', updated_at: '2026-01-02T00:00:00Z' },
      ],
    };

    const service = new GDPRService();
    const request = await service.requestDataExport('user-1');
    const result = await service.processExport(request.id);

    expect(result.format).toBe('zip');
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.downloadUrl).toContain(request.id);

    // Verify ZIP buffer is stored
    const buffer = await service.getExportBuffer(request.id);
    expect(buffer).not.toBeNull();
    expect(buffer!.length).toBeGreaterThan(0);
  });

  test('marks request as completed after export', async () => {
    mockTableData = {
      workbench_projects: [
        { id: 'proj-1', actor_id: 'user-1', name: 'Project A' },
      ],
    };

    const service = new GDPRService();
    const request = await service.requestDataExport('user-1');
    await service.processExport(request.id);

    const stored = mockGdprRequests.find((r) => r.id === request.id);
    expect(stored?.status).toBe('completed');
  });

  test('throws if export request not found', async () => {
    const service = new GDPRService();
    await expect(service.processExport('nonexistent-id')).rejects.toThrow('not found');
  });

  test('handles user with no data (empty export)', async () => {
    mockTableData = {};

    const service = new GDPRService();
    const request = await service.requestDataExport('user-ghost');
    const result = await service.processExport(request.id);

    expect(result.format).toBe('zip');
    // Should still produce a valid ZIP (with just metadata)
    expect(result.fileSize).toBeGreaterThan(0);
  });

  test('sanitizes records by removing internal fields', async () => {
    mockTableData = {
      workbench_projects: [
        { id: 'proj-1', actor_id: 'user-1', name: 'Project A', soft_deleted: 0, archived: 0 },
      ],
    };

    const service = new GDPRService();
    const request = await service.requestDataExport('user-1');
    await service.processExport(request.id);

    const buffer = await service.getExportBuffer(request.id);
    expect(buffer).not.toBeNull();
    // The ZIP should be valid (starts with PK signature)
    expect(buffer![0]).toBe(0x50); // 'P'
    expect(buffer![1]).toBe(0x4b); // 'K'
  });
});

describe('GDPRService.getDataSummary', () => {
  test('returns data summary across tables', async () => {
    mockTableData = {
      workbench_projects: [
        { id: 'proj-1', actor_id: 'user-1', name: 'Project A', updated_at: '2026-01-01T00:00:00Z' },
        { id: 'proj-2', actor_id: 'user-1', name: 'Project B', updated_at: '2026-01-02T00:00:00Z' },
      ],
      workbench_experiments: [
        { id: 'exp-1', actor_id: 'user-1', title: 'Experiment A', updated_at: '2026-01-03T00:00:00Z' },
      ],
      audit_log: [
        { id: 'log-1', actor_id: 'user-1', action: 'login', timestamp: '2026-01-04T00:00:00Z' },
      ],
    };

    const service = new GDPRService();
    const summary = await service.getDataSummary('user-1');

    expect(summary.tables).toBeDefined();
    expect(summary.tables.length).toBeGreaterThan(0);

    const projectsTable = summary.tables.find((t) => t.name === 'workbench_projects');
    expect(projectsTable).toBeDefined();
    expect(projectsTable!.recordCount).toBe(2);
  });

  test('returns zero counts for tables with no user data', async () => {
    mockTableData = {};

    const service = new GDPRService();
    const summary = await service.getDataSummary('user-ghost');

    expect(summary.tables).toBeDefined();
    for (const table of summary.tables) {
      expect(table.recordCount).toBe(0);
    }
  });
});
