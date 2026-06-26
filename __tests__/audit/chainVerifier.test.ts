/** @jest-environment node */
import { createHash } from 'crypto';

/**
 * In-memory mock of the audit_log table for chain verifier tests.
 * Uses a shared row store so we can inject tampered entries.
 */
let mockRows: Record<string, unknown>[] = [];
let mockSeqCounter = 1;

jest.mock('../../src/server/libsqlDb', () => ({
  sqlAll: jest.fn(async (sql: string) => {
    if (sql.includes('ORDER BY sequence_number ASC')) {
      return [...mockRows].sort(
        (a, b) => (a.sequence_number as number) - (b.sequence_number as number),
      );
    }
    if (sql.includes('ORDER BY sequence_number DESC LIMIT 1')) {
      return mockRows.length > 0 ? [mockRows[mockRows.length - 1]] : [];
    }
    return [...mockRows];
  }),
  sqlGet: jest.fn(async (sql: string) => {
    if (sql.includes('ORDER BY sequence_number DESC LIMIT 1')) {
      return mockRows.length > 0 ? mockRows[mockRows.length - 1] : undefined;
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
      mockSeqCounter = 1;
      return { rowsAffected: 0 };
    }
    if (sql.includes('UPDATE audit_log SET')) {
      // Simulate tampering for test purposes
      return { rowsAffected: 1 };
    }
    return { rowsAffected: 0 };
  }),
  closeLibsqlClient: jest.fn(),
}));

import { logAuditEvent } from '../../src/services/audit/auditLogger';
import { verifyAuditChain } from '../../src/services/audit/chainVerifier';

/** Manually build an audit entry row with correct hash. */
function buildEntry(seq: number, prevHash: string, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const timestamp = overrides.timestamp ?? `2026-06-25T00:00:0${seq}.000Z`;
  const actorId = overrides.actor_id ?? 'user-001';
  const action = overrides.action ?? `action-${seq}`;
  const entityType = overrides.entity_type ?? 'experiment';
  const entityId = overrides.entity_id ?? `exp-${seq}`;

  const hashInput = JSON.stringify({
    timestamp,
    actorId,
    action,
    entityType,
    entityId,
    previousHash: prevHash,
  });
  const hash = overrides.hash ?? createHash('sha256').update(hashInput).digest('hex');

  return {
    id: overrides.id ?? `entry-${seq}`,
    sequence_number: overrides.sequence_number ?? seq,
    timestamp,
    actor_id: actorId,
    actor_name: null,
    actor_email: null,
    actor_ip: null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    project_id: null,
    before_state: null,
    after_state: null,
    change_summary: null,
    hash,
    previous_hash: prevHash,
    metadata: null,
    ...overrides,
  };
}

describe('chainVerifier', () => {
  beforeEach(() => {
    mockRows = [];
    mockSeqCounter = 1;
    jest.clearAllMocks();
  });

  test('empty chain is valid', async () => {
    const result = await verifyAuditChain();

    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(0);
    expect(result.verifiedEntries).toBe(0);
    expect(result.brokenAt).toBeNull();
  });

  test('single entry chain is valid', async () => {
    await logAuditEvent({ actorId: 'u1', action: 'create', entityType: 'project' });

    const result = await verifyAuditChain();

    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(1);
    expect(result.verifiedEntries).toBe(1);
    expect(result.brokenAt).toBeNull();
  });

  test('multi-entry chain is valid', async () => {
    for (let i = 0; i < 5; i++) {
      await logAuditEvent({ actorId: 'u1', action: `action-${i}` });
    }

    const result = await verifyAuditChain();

    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(5);
    expect(result.verifiedEntries).toBe(5);
    expect(result.brokenAt).toBeNull();
  });

  test('detects tampered hash', () => {
    const genesis = '0'.repeat(64);
    const entry1 = buildEntry(1, genesis);
    // Tamper with hash
    const tampered = { ...entry1, hash: 'a'.repeat(64) };
    mockRows = [tampered];

    const result = verifyAuditChain();

    return result.then((r) => {
      expect(r.valid).toBe(false);
      expect(r.brokenAt).toBe(1);
      expect(r.error).toContain('Hash mismatch');
    });
  });

  test('detects tampered previousHash (broken chain link)', () => {
    const genesis = '0'.repeat(64);
    const entry1 = buildEntry(1, genesis);
    const entry2 = buildEntry(2, String(entry1.hash));
    // Tamper entry2's previousHash
    const tampered2 = { ...entry2, previous_hash: 'b'.repeat(64) };
    mockRows = [entry1, tampered2];

    return verifyAuditChain().then((r) => {
      expect(r.valid).toBe(false);
      expect(r.brokenAt).toBe(2);
      expect(r.error).toContain('Previous hash mismatch');
    });
  });

  test('detects tampered actorId', () => {
    const genesis = '0'.repeat(64);
    const entry1 = buildEntry(1, genesis);
    // Build entry2 with correct chain, then tamper actor_id (hash won't match)
    const entry2Correct = buildEntry(2, String(entry1.hash));
    const entry2Tampered = { ...entry2Correct, actor_id: 'hacker' };
    mockRows = [entry1, entry2Tampered];

    return verifyAuditChain().then((r) => {
      expect(r.valid).toBe(false);
      expect(r.brokenAt).toBe(2);
      expect(r.error).toContain('Hash mismatch');
    });
  });

  test('detects tampered timestamp', () => {
    const genesis = '0'.repeat(64);
    const entry1 = buildEntry(1, genesis);
    const entry2Correct = buildEntry(2, String(entry1.hash));
    const entry2Tampered = { ...entry2Correct, timestamp: '2099-01-01T00:00:00.000Z' };
    mockRows = [entry1, entry2Tampered];

    return verifyAuditChain().then((r) => {
      expect(r.valid).toBe(false);
      expect(r.brokenAt).toBe(2);
      expect(r.error).toContain('Hash mismatch');
    });
  });

  test('detects deletion of middle entry (chain break)', () => {
    const genesis = '0'.repeat(64);
    const entry1 = buildEntry(1, genesis);
    const entry2 = buildEntry(2, String(entry1.hash));
    const entry3 = buildEntry(3, String(entry2.hash));
    // Remove middle entry — entry3's previousHash now doesn't match entry1
    mockRows = [entry1, entry3];

    return verifyAuditChain().then((r) => {
      expect(r.valid).toBe(false);
      expect(r.totalEntries).toBe(2);
    });
  });

  test('returns correct error message for hash mismatch', () => {
    const genesis = '0'.repeat(64);
    const entry1 = buildEntry(1, genesis, { action: 'tampered' });
    // entry1 was built with action='tampered' but its hash was computed from that.
    // To trigger a hash mismatch, we need to change a field AFTER hash was computed.
    const tampered = { ...entry1, action: 'original' };
    // hash was computed with action='tampered', but stored action='original' -> mismatch
    mockRows = [tampered];

    return verifyAuditChain().then((r) => {
      expect(r.valid).toBe(false);
      expect(r.error).toMatch(/Hash mismatch at sequence 1/);
    });
  });
});
