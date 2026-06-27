/** @jest-environment node */

/**
 * In-memory mock of all tables used by the consent manager.
 * Avoids SQLite file locking issues when Jest runs test files in parallel.
 */

// ── In-memory table stores ──

let consentRows: Record<string, unknown>[] = [];

// Track CREATE TABLE calls
const createdTables: string[] = [];
const createdIndexes: string[] = [];

jest.mock('../src/server/libsqlDb', () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // Latest consent per type for a user (getConsentStatus subquery)
    if (sql.includes('FROM consent_records') && sql.includes('GROUP BY consent_type')) {
      const userId = args?.[0] as string;
      const matching = consentRows.filter((r) => r.user_id === userId);

      // Group by consent_type, pick latest granted_at per group
      const byType = new Map<string, Record<string, unknown>>();
      for (const row of matching) {
        const type = String(row.consent_type);
        const existing = byType.get(type);
        if (!existing || String(row.granted_at) > String(existing.granted_at)) {
          byType.set(type, row);
        }
      }

      return Array.from(byType.values()).sort((a, b) =>
        String(a.consent_type).localeCompare(String(b.consent_type)),
      );
    }

    // Full consent history for a user
    if (sql.includes('FROM consent_records') && sql.includes('ORDER BY granted_at DESC')) {
      const userId = args?.[0] as string;
      return consentRows
        .filter((r) => r.user_id === userId)
        .sort((a, b) => String(b.granted_at).localeCompare(String(a.granted_at)));
    }

    return [];
  }),

  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    // Find latest active (non-revoked) consent record for revokeConsent
    if (sql.includes('FROM consent_records') && sql.includes('revoked_at IS NULL')) {
      const userId = args?.[0] as string;
      const consentType = args?.[1] as string;
      const matching = consentRows
        .filter((r) => r.user_id === userId && r.consent_type === consentType && r.revoked_at === null)
        .sort((a, b) => String(b.granted_at).localeCompare(String(a.granted_at)));
      return matching[0] ?? undefined;
    }

    return undefined;
  }),

  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    // CREATE TABLE
    if (sql.startsWith('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (match) createdTables.push(match[1]);
      return { rowsAffected: 0 };
    }

    // CREATE INDEX
    if (sql.startsWith('CREATE INDEX')) {
      const match = sql.match(/CREATE INDEX IF NOT EXISTS (\w+)/);
      if (match) createdIndexes.push(match[1]);
      return { rowsAffected: 0 };
    }

    // INSERT INTO consent_records
    // SQL: VALUES (?, ?, ?, ?, ?, NULL, ?) — revoked_at is a literal NULL, not a param
    // So args = [id, user_id, consent_type, granted, granted_at, ip_address]
    if (sql.startsWith('INSERT INTO consent_records')) {
      consentRows.push({
        id: args![0],
        user_id: args![1],
        consent_type: args![2],
        granted: args![3],
        granted_at: args![4],
        revoked_at: null,
        ip_address: args![5] ?? null,
      });
      return { rowsAffected: 1 };
    }

    // UPDATE consent_records SET revoked_at
    if (sql.startsWith('UPDATE consent_records SET revoked_at')) {
      const revokedAt = args![0] as string;
      const id = args![1] as string;
      const row = consentRows.find((r) => r.id === id);
      if (row) {
        row.revoked_at = revokedAt;
        return { rowsAffected: 1 };
      }
      return { rowsAffected: 0 };
    }

    return { rowsAffected: 0 };
  }),

  closeLibsqlClient: jest.fn(),
}));

import {
  recordConsent,
  getConsentStatus,
  revokeConsent,
  getConsentHistory,
  VALID_CONSENT_TYPES,
  ConsentType,
} from '../src/services/compliance/consentManager';

// ── Helpers ──

const USER_1 = 'user-001';
const USER_2 = 'user-002';

function resetAllTables() {
  consentRows = [];
  createdTables.length = 0;
  createdIndexes.length = 0;
  jest.clearAllMocks();
}

// ── Tests ──

describe('consentManager', () => {
  beforeEach(resetAllTables);

  // ── Schema bootstrap ──

  test('recordConsent creates consent_records table and index', async () => {
    await recordConsent(USER_1, 'analytics', true);
    expect(createdTables).toContain('consent_records');
    expect(createdIndexes).toContain('idx_consent_user_type');
  });

  // ── recordConsent ──

  test('recordConsent stores a consent grant with correct fields', async () => {
    await recordConsent(USER_1, 'analytics', true, '192.168.1.1');

    expect(consentRows).toHaveLength(1);
    const row = consentRows[0];
    expect(row.user_id).toBe(USER_1);
    expect(row.consent_type).toBe('analytics');
    expect(row.granted).toBe(1);
    expect(row.granted_at).toBeDefined();
    expect(row.revoked_at).toBeNull();
    expect(row.ip_address).toBe('192.168.1.1');
  });

  test('recordConsent stores a consent denial', async () => {
    await recordConsent(USER_1, 'marketing', false);

    expect(consentRows).toHaveLength(1);
    expect(consentRows[0].granted).toBe(0);
    expect(consentRows[0].consent_type).toBe('marketing');
  });

  test('recordConsent works without ipAddress', async () => {
    await recordConsent(USER_1, 'data_processing', true);

    expect(consentRows).toHaveLength(1);
    expect(consentRows[0].ip_address).toBeNull();
  });

  test('recordConsent rejects invalid consent type', async () => {
    await expect(recordConsent(USER_1, 'invalid_type' as ConsentType, true)).rejects.toThrow(
      'Invalid consent type',
    );
  });

  test('recordConsent rejects empty userId', async () => {
    await expect(recordConsent('', 'analytics', true)).rejects.toThrow('non-empty string');
  });

  // ── getConsentStatus ──

  test('getConsentStatus returns empty consents for new user', async () => {
    const status = await getConsentStatus(USER_1);
    expect(status.userId).toBe(USER_1);
    expect(status.consents).toHaveLength(0);
  });

  test('getConsentStatus returns latest consent per type', async () => {
    // Grant analytics, then deny it (latest should be denied)
    await recordConsent(USER_1, 'analytics', true);
    // Small delay to ensure different timestamps
    consentRows[0].granted_at = '2026-01-01T00:00:00.000Z';
    await recordConsent(USER_1, 'analytics', false);
    consentRows[1].granted_at = '2026-01-02T00:00:00.000Z';

    // Also grant marketing
    await recordConsent(USER_1, 'marketing', true);

    const status = await getConsentStatus(USER_1);
    expect(status.consents).toHaveLength(2);

    const analytics = status.consents.find((c) => c.consentType === 'analytics');
    expect(analytics).toBeDefined();
    expect(analytics!.granted).toBe(false);
    expect(analytics!.grantedAt).toBe('2026-01-02T00:00:00.000Z');

    const marketing = status.consents.find((c) => c.consentType === 'marketing');
    expect(marketing).toBeDefined();
    expect(marketing!.granted).toBe(true);
  });

  test('getConsentStatus returns revokedAt when consent has been revoked', async () => {
    await recordConsent(USER_1, 'analytics', true);
    await revokeConsent(USER_1, 'analytics');

    const status = await getConsentStatus(USER_1);
    const analytics = status.consents.find((c) => c.consentType === 'analytics');
    expect(analytics).toBeDefined();
    expect(analytics!.revokedAt).not.toBeNull();
  });

  // ── revokeConsent ──

  test('revokeConsent returns true and sets revoked_at on active record', async () => {
    await recordConsent(USER_1, 'marketing', true);
    const result = await revokeConsent(USER_1, 'marketing');

    expect(result).toBe(true);
    expect(consentRows[0].revoked_at).not.toBeNull();
    expect(typeof consentRows[0].revoked_at).toBe('string');
  });

  test('revokeConsent returns false when no active consent exists', async () => {
    const result = await revokeConsent(USER_1, 'analytics');
    expect(result).toBe(false);
  });

  test('revokeConsent does not re-revoke an already revoked record', async () => {
    await recordConsent(USER_1, 'analytics', true);
    const first = await revokeConsent(USER_1, 'analytics');
    expect(first).toBe(true);

    // No active record left — second revoke should return false
    const second = await revokeConsent(USER_1, 'analytics');
    expect(second).toBe(false);
  });

  test('revokeConsent rejects invalid consent type', async () => {
    await expect(revokeConsent(USER_1, 'bogus' as ConsentType)).rejects.toThrow(
      'Invalid consent type',
    );
  });

  // ── getConsentHistory ──

  test('getConsentHistory returns full audit trail ordered by date descending', async () => {
    // Create multiple records with controlled timestamps
    await recordConsent(USER_1, 'analytics', true);
    consentRows[0].granted_at = '2026-01-01T00:00:00.000Z';

    await recordConsent(USER_1, 'analytics', false);
    consentRows[1].granted_at = '2026-03-01T00:00:00.000Z';

    await recordConsent(USER_1, 'marketing', true);
    consentRows[2].granted_at = '2026-06-01T00:00:00.000Z';

    const history = await getConsentHistory(USER_1);
    expect(history).toHaveLength(3);

    // Should be ordered by granted_at descending
    expect(history[0].grantedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(history[1].grantedAt).toBe('2026-03-01T00:00:00.000Z');
    expect(history[2].grantedAt).toBe('2026-01-01T00:00:00.000Z');

    // All records should include ip_address field
    expect(history.every((r) => 'ipAddress' in r)).toBe(true);
  });

  test('getConsentHistory returns empty array for user with no records', async () => {
    const history = await getConsentHistory('nonexistent-user');
    expect(history).toHaveLength(0);
  });

  // ── Cross-user isolation ──

  test('consent records are isolated per user', async () => {
    await recordConsent(USER_1, 'analytics', true);
    await recordConsent(USER_2, 'marketing', true);

    const status1 = await getConsentStatus(USER_1);
    const status2 = await getConsentStatus(USER_2);

    expect(status1.consents).toHaveLength(1);
    expect(status1.consents[0].consentType).toBe('analytics');

    expect(status2.consents).toHaveLength(1);
    expect(status2.consents[0].consentType).toBe('marketing');
  });

  // ── All consent types ──

  test('all four consent types can be recorded and queried', async () => {
    for (const type of VALID_CONSENT_TYPES) {
      await recordConsent(USER_1, type, true);
    }

    const status = await getConsentStatus(USER_1);
    expect(status.consents).toHaveLength(4);

    const types = status.consents.map((c) => c.consentType).sort();
    expect(types).toEqual([...VALID_CONSENT_TYPES].sort());
  });
});
