/** @jest-environment node */

/**
 * In-memory mock of all tables used by the data processing record manager.
 * Avoids SQLite file locking issues when Jest runs test files in parallel.
 */

// ── In-memory table stores ──

let dprRows: Record<string, unknown>[] = [];

// Track CREATE TABLE / CREATE INDEX calls
const createdTables: string[] = [];
const createdIndexes: string[] = [];

jest.mock('../src/server/libsqlDb', () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    // List records for an org, ordered by created_at DESC
    if (sql.includes('FROM data_processing_records') && sql.includes('ORDER BY created_at DESC')) {
      const orgId = args?.[0] as string;
      return dprRows
        .filter((r) => r.org_id === orgId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }

    return [];
  }),

  sqlGet: jest.fn(async () => undefined),

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

    // INSERT INTO data_processing_records
    if (sql.startsWith('INSERT INTO data_processing_records')) {
      dprRows.push({
        id: args![0],
        org_id: args![1],
        category: args![2],
        purpose: args![3],
        legal_basis: args![4],
        data_types_json: args![5],
        recipients_json: args![6],
        retention_period: args![7] ?? null,
        created_at: args![8],
        updated_at: args![9],
      });
      return { rowsAffected: 1 };
    }

    // UPDATE data_processing_records
    if (sql.startsWith('UPDATE data_processing_records')) {
      // Parse SET clauses from the SQL and apply to the target row
      const id = args![args!.length - 1] as string;
      const row = dprRows.find((r) => r.id === id);
      if (row) {
        // Parse the SQL to figure out which columns are being set
        const setPart = sql.split('SET ')[1]?.split(' WHERE')[0] ?? '';
        const clauses = setPart.split(',').map((c) => c.trim());
        let paramIndex = 0;
        for (const clause of clauses) {
          const colMatch = clause.match(/^(\w+)\s*=\s*\?$/);
          if (colMatch) {
            const col = colMatch[1];
            row[col] = args![paramIndex];
            paramIndex++;
          }
        }
        return { rowsAffected: 1 };
      }
      return { rowsAffected: 0 };
    }

    return { rowsAffected: 0 };
  }),

  closeLibsqlClient: jest.fn(),
}));

import {
  createRecord,
  listRecords,
  updateRecord,
  VALID_PROCESSING_CATEGORIES,
  type ProcessingCategory,
  type DataProcessingRecordUpdates,
} from '../src/services/compliance/dataProcessingRecord';

// ── Helpers ──

const ORG_1 = 'org-001';
const ORG_2 = 'org-002';

function resetAllTables() {
  dprRows = [];
  createdTables.length = 0;
  createdIndexes.length = 0;
  jest.clearAllMocks();
}

// ── Tests ──

describe('dataProcessingRecord', () => {
  beforeEach(resetAllTables);

  // ── Schema bootstrap ──

  test('createRecord creates data_processing_records table and indexes', async () => {
    await createRecord(ORG_1, 'user_data', 'User authentication', 'consent', ['email'], ['internal']);
    expect(createdTables).toContain('data_processing_records');
    expect(createdIndexes).toContain('idx_dpr_org_id');
    expect(createdIndexes).toContain('idx_dpr_category');
  });

  // ── createRecord ──

  test('createRecord stores a record with all fields', async () => {
    const record = await createRecord(
      ORG_1,
      'user_data',
      'User authentication',
      'consent',
      ['email', 'name'],
      ['internal analytics', 'cloud provider'],
      '2 years',
    );

    expect(dprRows).toHaveLength(1);
    const row = dprRows[0];
    expect(row.org_id).toBe(ORG_1);
    expect(row.category).toBe('user_data');
    expect(row.purpose).toBe('User authentication');
    expect(row.legal_basis).toBe('consent');
    expect(row.data_types_json).toBe('["email","name"]');
    expect(row.recipients_json).toBe('["internal analytics","cloud provider"]');
    expect(row.retention_period).toBe('2 years');
    expect(row.created_at).toBeDefined();
    expect(row.updated_at).toBeDefined();

    // Returned object should match
    expect(record.orgId).toBe(ORG_1);
    expect(record.dataTypes).toEqual(['email', 'name']);
    expect(record.recipients).toEqual(['internal analytics', 'cloud provider']);
    expect(record.retentionPeriod).toBe('2 years');
  });

  test('createRecord works without retentionPeriod', async () => {
    const record = await createRecord(ORG_1, 'research_data', 'Clinical trials', 'legitimate interest', ['genomic'], ['research team']);

    expect(dprRows).toHaveLength(1);
    expect(dprRows[0].retention_period).toBeNull();
    expect(record.retentionPeriod).toBeNull();
  });

  test('createRecord rejects invalid category', async () => {
    await expect(
      createRecord(ORG_1, 'invalid_cat' as ProcessingCategory, 'test', 'consent', ['email'], ['internal']),
    ).rejects.toThrow('Invalid processing category');
  });

  test('createRecord rejects empty orgId', async () => {
    await expect(
      createRecord('', 'user_data', 'test', 'consent', ['email'], ['internal']),
    ).rejects.toThrow('non-empty string');
  });

  test('createRecord rejects empty purpose', async () => {
    await expect(
      createRecord(ORG_1, 'user_data', '', 'consent', ['email'], ['internal']),
    ).rejects.toThrow('non-empty string');
  });

  test('createRecord rejects empty legalBasis', async () => {
    await expect(
      createRecord(ORG_1, 'user_data', 'test', '', ['email'], ['internal']),
    ).rejects.toThrow('non-empty string');
  });

  test('createRecord rejects non-array dataTypes', async () => {
    await expect(
      createRecord(ORG_1, 'user_data', 'test', 'consent', 'email' as unknown as string[], ['internal']),
    ).rejects.toThrow('must be an array');
  });

  test('createRecord rejects non-array recipients', async () => {
    await expect(
      createRecord(ORG_1, 'user_data', 'test', 'consent', ['email'], 'internal' as unknown as string[]),
    ).rejects.toThrow('must be an array');
  });

  test('createRecord rejects dataTypes with empty strings', async () => {
    await expect(
      createRecord(ORG_1, 'user_data', 'test', 'consent', ['email', ''], ['internal']),
    ).rejects.toThrow('non-empty strings');
  });

  // ── listRecords ──

  test('listRecords returns empty array for org with no records', async () => {
    const records = await listRecords(ORG_1);
    expect(records).toHaveLength(0);
  });

  test('listRecords returns all records for an org ordered by created_at DESC', async () => {
    // Create records with controlled timestamps
    await createRecord(ORG_1, 'user_data', 'Auth', 'consent', ['email'], ['internal']);
    dprRows[0].created_at = '2026-01-01T00:00:00.000Z';

    await createRecord(ORG_1, 'research_data', 'Trials', 'legitimate interest', ['genomic'], ['research']);
    dprRows[1].created_at = '2026-06-01T00:00:00.000Z';

    await createRecord(ORG_1, 'financial_data', 'Billing', 'contract', ['invoice'], ['finance']);
    dprRows[2].created_at = '2026-03-01T00:00:00.000Z';

    const records = await listRecords(ORG_1);
    expect(records).toHaveLength(3);

    // Should be ordered by created_at descending
    expect(records[0].createdAt).toBe('2026-06-01T00:00:00.000Z');
    expect(records[1].createdAt).toBe('2026-03-01T00:00:00.000Z');
    expect(records[2].createdAt).toBe('2026-01-01T00:00:00.000Z');

    // Verify parsed fields
    expect(records[0].purpose).toBe('Trials');
    expect(records[0].dataTypes).toEqual(['genomic']);
    expect(records[0].recipients).toEqual(['research']);
  });

  test('listRecords rejects empty orgId', async () => {
    await expect(listRecords('')).rejects.toThrow('non-empty string');
  });

  // ── updateRecord ──

  test('updateRecord updates a single field', async () => {
    await createRecord(ORG_1, 'user_data', 'Auth', 'consent', ['email'], ['internal']);
    const recordId = String(dprRows[0].id);

    await updateRecord(recordId, { purpose: 'Authentication and authorization' });

    expect(dprRows[0].purpose).toBe('Authentication and authorization');
    // Other fields should remain unchanged
    expect(dprRows[0].category).toBe('user_data');
    expect(dprRows[0].legal_basis).toBe('consent');
  });

  test('updateRecord updates multiple fields at once', async () => {
    await createRecord(ORG_1, 'user_data', 'Auth', 'consent', ['email'], ['internal']);
    const recordId = String(dprRows[0].id);

    await updateRecord(recordId, {
      category: 'operational_data',
      purpose: 'System monitoring',
      legalBasis: 'legitimate interest',
    });

    expect(dprRows[0].category).toBe('operational_data');
    expect(dprRows[0].purpose).toBe('System monitoring');
    expect(dprRows[0].legal_basis).toBe('legitimate interest');
  });

  test('updateRecord updates JSON array fields', async () => {
    await createRecord(ORG_1, 'user_data', 'Auth', 'consent', ['email'], ['internal']);
    const recordId = String(dprRows[0].id);

    await updateRecord(recordId, {
      dataTypes: ['email', 'name', 'ip_address'],
      recipients: ['internal', 'analytics partner'],
    });

    expect(dprRows[0].data_types_json).toBe('["email","name","ip_address"]');
    expect(dprRows[0].recipients_json).toBe('["internal","analytics partner"]');
  });

  test('updateRecord updates retentionPeriod', async () => {
    await createRecord(ORG_1, 'user_data', 'Auth', 'consent', ['email'], ['internal']);
    const recordId = String(dprRows[0].id);

    await updateRecord(recordId, { retentionPeriod: '5 years' });
    expect(dprRows[0].retention_period).toBe('5 years');

    await updateRecord(recordId, { retentionPeriod: null });
    expect(dprRows[0].retention_period).toBeNull();
  });

  test('updateRecord rejects empty id', async () => {
    await expect(updateRecord('', { purpose: 'test' })).rejects.toThrow('non-empty string');
  });

  test('updateRecord rejects invalid category in updates', async () => {
    await createRecord(ORG_1, 'user_data', 'Auth', 'consent', ['email'], ['internal']);
    const recordId = String(dprRows[0].id);

    await expect(
      updateRecord(recordId, { category: 'bad_cat' as ProcessingCategory }),
    ).rejects.toThrow('Invalid processing category');
  });

  test('updateRecord rejects empty purpose in updates', async () => {
    await createRecord(ORG_1, 'user_data', 'Auth', 'consent', ['email'], ['internal']);
    const recordId = String(dprRows[0].id);

    await expect(updateRecord(recordId, { purpose: '' })).rejects.toThrow('non-empty string');
  });

  test('updateRecord rejects empty update (no fields provided)', async () => {
    await createRecord(ORG_1, 'user_data', 'Auth', 'consent', ['email'], ['internal']);
    const recordId = String(dprRows[0].id);

    await expect(updateRecord(recordId, {})).rejects.toThrow('At least one field');
  });

  // ── Cross-org isolation ──

  test('records are isolated per org', async () => {
    await createRecord(ORG_1, 'user_data', 'Auth', 'consent', ['email'], ['internal']);
    await createRecord(ORG_2, 'research_data', 'Trials', 'legitimate interest', ['genomic'], ['research']);

    const records1 = await listRecords(ORG_1);
    const records2 = await listRecords(ORG_2);

    expect(records1).toHaveLength(1);
    expect(records1[0].category).toBe('user_data');

    expect(records2).toHaveLength(1);
    expect(records2[0].category).toBe('research_data');
  });

  // ── All categories ──

  test('all four processing categories can be created and listed', async () => {
    for (const category of VALID_PROCESSING_CATEGORIES) {
      await createRecord(ORG_1, category, `Purpose for ${category}`, 'consent', ['data'], ['recipient']);
    }

    const records = await listRecords(ORG_1);
    expect(records).toHaveLength(4);

    const categories = records.map((r) => r.category).sort();
    expect(categories).toEqual([...VALID_PROCESSING_CATEGORIES].sort());
  });
});
