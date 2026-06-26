/** @jest-environment node */
import { createHash } from 'crypto';

/**
 * In-memory mock of the audit_log table for unit testing.
 * Avoids SQLite file locking issues when Jest runs test files in parallel.
 */
const mockRows: Record<string, unknown>[] = [];
let nextSeq = 1;

jest.mock('../../src/server/libsqlDb', () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // Parse simple queries used by the audit logger
    if (sql.includes('ORDER BY sequence_number DESC LIMIT 1')) {
      if (mockRows.length === 0) return [];
      return [mockRows[mockRows.length - 1]];
    }
    if (sql.includes('SELECT * FROM audit_log WHERE id')) {
      const id = args[0];
      return mockRows.filter((r) => r.id === id);
    }
    if (sql.includes('SELECT sequence_number FROM audit_log ORDER BY sequence_number ASC')) {
      return [...mockRows].sort((a, b) => (a.sequence_number as number) - (b.sequence_number as number));
    }
    if (sql.includes('SELECT * FROM audit_log ORDER BY sequence_number ASC')) {
      return [...mockRows].sort((a, b) => (a.sequence_number as number) - (b.sequence_number as number));
    }
    if (sql.includes('SELECT previous_hash FROM audit_log WHERE id')) {
      const id = args[0];
      const row = mockRows.find((r) => r.id === id);
      return row ? [{ previous_hash: row.previous_hash }] : [];
    }
    if (sql.includes('COUNT(*)')) {
      return [{ total: mockRows.length }];
    }
    return [...mockRows];
  }),
  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes('ORDER BY sequence_number DESC LIMIT 1')) {
      return mockRows.length > 0 ? mockRows[mockRows.length - 1] : undefined;
    }
    if (sql.includes('SELECT * FROM audit_log WHERE id')) {
      const id = args[0];
      return mockRows.find((r) => r.id === id);
    }
    if (sql.includes('SELECT previous_hash FROM audit_log WHERE id')) {
      const id = args[0];
      const row = mockRows.find((r) => r.id === id);
      return row ? { previous_hash: row.previous_hash } : undefined;
    }
    if (sql.includes('COUNT(*)')) {
      return { total: mockRows.length };
    }
    return undefined;
  }),
  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith('INSERT INTO audit_log')) {
      const row: Record<string, unknown> = {
        id: args[0],
        sequence_number: args[1],
        timestamp: args[2],
        actor_id: args[3],
        actor_name: args[4],
        actor_email: args[5],
        actor_ip: args[6],
        action: args[7],
        entity_type: args[8],
        entity_id: args[9],
        project_id: args[10],
        before_state: args[11],
        after_state: args[12],
        change_summary: args[13],
        hash: args[14],
        previous_hash: args[15],
        metadata: args[16],
      };
      mockRows.push(row);
      return { rowsAffected: 1 };
    }
    if (sql.includes('DELETE FROM audit_log')) {
      mockRows.length = 0;
      nextSeq = 1;
      return { rowsAffected: 0 };
    }
    return { rowsAffected: 0 };
  }),
  closeLibsqlClient: jest.fn(),
}));

import { logAuditEvent, type AuditEvent } from '../../src/services/audit/auditLogger';

function baseEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    actorId: 'user-001',
    actorName: 'Alice',
    action: 'create',
    entityType: 'experiment',
    entityId: 'exp-001',
    projectId: 'proj-001',
    ...overrides,
  };
}

describe('auditLogger', () => {
  beforeEach(() => {
    mockRows.length = 0;
    nextSeq = 1;
    jest.clearAllMocks();
  });

  test('logAuditEvent returns id and 64-char hex hash', async () => {
    const result = await logAuditEvent(baseEvent());

    expect(result.id).toBeDefined();
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('first entry uses genesis previousHash (64 zeros)', async () => {
    const result = await logAuditEvent(baseEvent());
    const row = mockRows.find((r) => r.id === result.id);

    expect(row).toBeDefined();
    expect(row!.previous_hash).toBe('0'.repeat(64));
  });

  test('second entry chains to first entry hash', async () => {
    const first = await logAuditEvent(baseEvent({ action: 'create' }));
    const second = await logAuditEvent(baseEvent({ action: 'update' }));

    const row = mockRows.find((r) => r.id === second.id);
    expect(row!.previous_hash).toBe(first.hash);
  });

  test('sequence numbers are monotonically increasing', async () => {
    await logAuditEvent(baseEvent({ action: 'create' }));
    await logAuditEvent(baseEvent({ action: 'update' }));
    await logAuditEvent(baseEvent({ action: 'delete' }));

    const sorted = [...mockRows].sort(
      (a, b) => (a.sequence_number as number) - (b.sequence_number as number),
    );
    expect(sorted).toHaveLength(3);
    expect(sorted[0].sequence_number).toBe(1);
    expect(sorted[1].sequence_number).toBe(2);
    expect(sorted[2].sequence_number).toBe(3);
  });

  test('stores all audit fields correctly', async () => {
    const event = baseEvent({
      actorName: 'Bob',
      actorEmail: 'bob@example.com',
      actorIp: '10.0.0.1',
      beforeState: { status: 'draft' },
      afterState: { status: 'running' },
      changeSummary: 'Started experiment',
      metadata: { source: 'ui' },
    });

    const result = await logAuditEvent(event);
    const row = mockRows.find((r) => r.id === result.id);

    expect(row).toBeDefined();
    expect(row!.actor_id).toBe('user-001');
    expect(row!.actor_name).toBe('Bob');
    expect(row!.actor_email).toBe('bob@example.com');
    expect(row!.actor_ip).toBe('10.0.0.1');
    expect(row!.action).toBe('create');
    expect(row!.entity_type).toBe('experiment');
    expect(row!.entity_id).toBe('exp-001');
    expect(row!.project_id).toBe('proj-001');
    expect(row!.before_state).toBe(JSON.stringify({ status: 'draft' }));
    expect(row!.after_state).toBe(JSON.stringify({ status: 'running' }));
    expect(row!.change_summary).toBe('Started experiment');
    expect(row!.metadata).toBe(JSON.stringify({ source: 'ui' }));
  });

  test('hash matches SHA-256 of deterministic fields', async () => {
    const result = await logAuditEvent(baseEvent());
    const row = mockRows.find((r) => r.id === result.id);

    const expectedHash = createHash('sha256')
      .update(
        JSON.stringify({
          timestamp: row!.timestamp,
          actorId: row!.actor_id,
          action: row!.action,
          entityType: row!.entity_type,
          entityId: row!.entity_id,
          previousHash: row!.previous_hash,
        }),
      )
      .digest('hex');

    expect(row!.hash).toBe(expectedHash);
  });

  test('hash input is recomputed from stored row, not in-memory values', async () => {
    const result = await logAuditEvent(baseEvent());
    const row = mockRows.find((r) => r.id === result.id);

    const recomputed = createHash('sha256')
      .update(
        JSON.stringify({
          timestamp: row!.timestamp,
          actorId: row!.actor_id,
          action: row!.action,
          entityType: row!.entity_type,
          entityId: row!.entity_id,
          previousHash: row!.previous_hash,
        }),
      )
      .digest('hex');

    expect(result.hash).toBe(recomputed);
  });

  test('handles optional fields as null', async () => {
    const event: AuditEvent = {
      actorId: 'user-minimal',
      action: 'login',
    };

    const result = await logAuditEvent(event);
    const row = mockRows.find((r) => r.id === result.id);

    expect(row!.actor_name).toBeNull();
    expect(row!.actor_email).toBeNull();
    expect(row!.actor_ip).toBeNull();
    expect(row!.entity_type).toBeNull();
    expect(row!.entity_id).toBeNull();
    expect(row!.project_id).toBeNull();
    expect(row!.before_state).toBeNull();
    expect(row!.after_state).toBeNull();
    expect(row!.change_summary).toBeNull();
    expect(row!.metadata).toBeNull();
  });

  test('audit chain integrity across 10 entries', async () => {
    const results: Array<{ id: string; hash: string }> = [];
    for (let i = 0; i < 10; i++) {
      results.push(await logAuditEvent(baseEvent({ action: `action-${i}` })));
    }

    // Verify chain: each entry's previous_hash should equal the prior entry's hash
    for (let i = 1; i < results.length; i++) {
      const row = mockRows.find((r) => r.id === results[i].id);
      expect(row!.previous_hash).toBe(results[i - 1].hash);
    }
  });
});
