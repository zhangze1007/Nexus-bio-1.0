/** @jest-environment node */

/**
 * Tests for the Data Classifier — classification logic and DB persistence.
 */

// ── In-memory mock of the data_classifications table ─────────────────

const mockClassificationRows: Record<string, unknown>[] = [];

jest.mock('../../src/server/libsqlDb', () => ({
  sqlAll: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes('data_classifications')) {
      if (sql.includes('WHERE entity_id')) {
        return mockClassificationRows.filter(
          (r) => r.entity_id === args[0] && r.entity_type === args[1],
        );
      }
      return [...mockClassificationRows];
    }
    return [];
  }),
  sqlGet: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes('data_classifications') && sql.includes('WHERE entity_id')) {
      return mockClassificationRows.find(
        (r) => r.entity_id === args[0] && r.entity_type === args[1],
      );
    }
    return undefined;
  }),
  sqlRun: jest.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith('CREATE TABLE')) {
      return { rowsAffected: 0 };
    }
    if (sql.startsWith('INSERT INTO data_classifications')) {
      mockClassificationRows.push({
        entity_id: args[0],
        entity_type: args[1],
        classification: args[2],
        classified_at: args[3],
        classified_by: args[4],
      });
      return { rowsAffected: 1 };
    }
    if (sql.startsWith('UPDATE data_classifications')) {
      const row = mockClassificationRows.find(
        (r) => r.entity_id === args[3] && r.entity_type === args[4],
      );
      if (row) {
        row.classification = args[0];
        row.classified_at = args[1];
        row.classified_by = args[2];
        return { rowsAffected: 1 };
      }
      return { rowsAffected: 0 };
    }
    return { rowsAffected: 0 };
  }),
  sqlBatch: jest.fn(async () => {}),
  closeLibsqlClient: jest.fn(),
}));

import {
  classifyData,
  getDataClassification,
  setDataClassification,
} from '../../src/services/governance/dataClassifier';

beforeEach(() => {
  mockClassificationRows.length = 0;
});

describe('classifyData (pure function)', () => {
  test('classifies restricted entity types', () => {
    expect(classifyData({}, 'genetic_sequence')).toBe('restricted');
    expect(classifyData({}, 'patient_data')).toBe('restricted');
    expect(classifyData({}, 'health_record')).toBe('restricted');
    expect(classifyData({}, 'biometric')).toBe('restricted');
    expect(classifyData({}, 'clinical_data')).toBe('restricted');
  });

  test('classifies confidential entity types', () => {
    expect(classifyData({}, 'user')).toBe('confidential');
    expect(classifyData({}, 'account')).toBe('confidential');
    expect(classifyData({}, 'profile')).toBe('confidential');
    expect(classifyData({}, 'session')).toBe('confidential');
    expect(classifyData({}, 'auth')).toBe('confidential');
    expect(classifyData({}, 'billing')).toBe('confidential');
  });

  test('classifies internal entity types', () => {
    expect(classifyData({}, 'project')).toBe('internal');
    expect(classifyData({}, 'experiment')).toBe('internal');
    expect(classifyData({}, 'workbench')).toBe('internal');
    expect(classifyData({}, 'artifact')).toBe('internal');
    expect(classifyData({}, 'pathway')).toBe('internal');
  });

  test('classifies as restricted when entity has sensitive fields', () => {
    expect(classifyData({ dnaSequence: 'ATCGATCG' }, 'data')).toBe('restricted');
    expect(classifyData({ genotype: 'AA' }, 'data')).toBe('restricted');
    expect(classifyData({ patientId: 'P123' }, 'data')).toBe('restricted');
  });

  test('classifies as confidential when entity has PII fields', () => {
    expect(classifyData({ email: 'user@example.com' }, 'data')).toBe('confidential');
    expect(classifyData({ name: 'John Doe' }, 'data')).toBe('confidential');
    expect(classifyData({ phone: '+1234567890' }, 'data')).toBe('confidential');
    expect(classifyData({ ipAddress: '192.168.1.1' }, 'data')).toBe('confidential');
  });

  test('classifies as internal when entity has no sensitive fields', () => {
    expect(classifyData({ title: 'My Project', description: 'test' }, 'data')).toBe('internal');
  });

  test('defaults to internal for unknown entity types with no sensitive data', () => {
    expect(classifyData({}, 'unknown_type')).toBe('internal');
  });

  test('handles null and undefined entities', () => {
    expect(classifyData(null, 'data')).toBe('internal');
    expect(classifyData(undefined, 'data')).toBe('internal');
  });

  test('handles arrays gracefully', () => {
    // Arrays are not plain objects, so no content-based heuristics
    expect(classifyData([1, 2, 3], 'data')).toBe('internal');
  });

  test('entity type check takes priority over content heuristics', () => {
    // Even if the entity has PII, if entity type is 'user', it's confidential
    expect(classifyData({ dnaSequence: 'ATCG' }, 'user')).toBe('confidential');
  });

  test('case-insensitive entity type matching', () => {
    expect(classifyData({}, 'User')).toBe('confidential');
    expect(classifyData({}, 'GENETIC_SEQUENCE')).toBe('restricted');
    expect(classifyData({}, '  experiment  ')).toBe('internal');
  });

  test('restricted fields take priority over PII fields in content', () => {
    // If both sensitive and PII fields are present, restricted wins
    expect(classifyData({ email: 'a@b.com', dnaSequence: 'ATCG' }, 'data')).toBe('restricted');
  });
});

describe('getDataClassification (DB-backed)', () => {
  test('returns null when no classification exists', async () => {
    const result = await getDataClassification('entity-1', 'experiment');
    expect(result).toBeNull();
  });

  test('returns stored classification', async () => {
    mockClassificationRows.push({
      entity_id: 'entity-1',
      entity_type: 'experiment',
      classification: 'confidential',
      classified_at: new Date().toISOString(),
      classified_by: 'system',
    });

    const result = await getDataClassification('entity-1', 'experiment');
    expect(result).toBe('confidential');
  });
});

describe('setDataClassification (DB-backed)', () => {
  test('inserts a new classification', async () => {
    await setDataClassification('entity-2', 'project', 'internal', 'admin');

    expect(mockClassificationRows).toHaveLength(1);
    expect(mockClassificationRows[0].entity_id).toBe('entity-2');
    expect(mockClassificationRows[0].classification).toBe('internal');
    expect(mockClassificationRows[0].classified_by).toBe('admin');
  });

  test('updates an existing classification', async () => {
    mockClassificationRows.push({
      entity_id: 'entity-3',
      entity_type: 'project',
      classification: 'internal',
      classified_at: '2025-01-01T00:00:00.000Z',
      classified_by: 'system',
    });

    await setDataClassification('entity-3', 'project', 'restricted', 'admin');

    expect(mockClassificationRows).toHaveLength(1);
    expect(mockClassificationRows[0].classification).toBe('restricted');
    expect(mockClassificationRows[0].classified_by).toBe('admin');
  });

  test('defaults classifiedBy to system', async () => {
    await setDataClassification('entity-4', 'experiment', 'public');

    expect(mockClassificationRows[0].classified_by).toBe('system');
  });
});
