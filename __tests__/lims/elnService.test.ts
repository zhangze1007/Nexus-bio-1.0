/**
 * ELN Service Tests
 *
 * Tests CRUD operations, electronic signatures, content integrity,
 * and immutability guarantees for signed entries.
 */

import { ELNService, type ELNDatabase } from '../../src/services/lims/elnService';
import type { ELNEntry } from '../../src/services/lims/types';

// ── In-memory mock database ──

function createMockDb(): ELNDatabase & { rows: Map<string, Record<string, unknown>> } {
  const rows = new Map<string, Record<string, unknown>>();

  return {
    rows,
    async run(sql: string, params: unknown[] = []) {
      if (sql.startsWith('INSERT INTO eln_entries')) {
        const row: Record<string, unknown> = {
          id: params[0],
          project_id: params[1],
          title: params[2],
          content: params[3],
          attachments: params[4],
          signatures: params[5],
          created_at: params[6],
          updated_at: params[7],
        };
        rows.set(params[0] as string, row);
        return { rowsAffected: 1 };
      }
      if (sql.startsWith('UPDATE eln_entries')) {
        const id = params[params.length - 1];
        const existing = rows.get(id as string);
        if (existing) {
          // Parse the SET clause params
          if (sql.includes('SET title =')) {
            existing.title = params[0];
            existing.content = params[1];
            existing.attachments = params[2];
            existing.updated_at = params[3];
          }
          if (sql.includes('SET signatures =')) {
            existing.signatures = params[0];
            existing.updated_at = params[1];
          }
          return { rowsAffected: 1 };
        }
        return { rowsAffected: 0 };
      }
      if (sql.startsWith('DELETE FROM eln_entries')) {
        const id = params[0];
        const existed = rows.has(id as string);
        rows.delete(id as string);
        return { rowsAffected: existed ? 1 : 0 };
      }
      return { rowsAffected: 0 };
    },
    async get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      if (sql.includes('WHERE id =')) {
        const id = params[0];
        return rows.get(id as string) as T | undefined;
      }
      return undefined;
    },
    async all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      if (sql.includes('WHERE project_id =')) {
        const projectId = params[0];
        return Array.from(rows.values())
          .filter((r) => r.project_id === projectId)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) as T[];
      }
      return Array.from(rows.values()) as T[];
    },
  };
}

// ── Tests ──

describe('ELNService', () => {
  let db: ReturnType<typeof createMockDb>;
  let service: ELNService;
  const fixedDate = new Date('2026-06-26T12:00:00Z');
  let uuidCounter = 0;

  beforeEach(() => {
    db = createMockDb();
    uuidCounter = 0;
    service = new ELNService(db, {
      clock: () => fixedDate,
      uuidFn: () => `test-uuid-${++uuidCounter}`,
    });
  });

  describe('createEntry', () => {
    test('creates entry with generated id and timestamps', async () => {
      const entry = await service.createEntry({
        projectId: 'proj-001',
        title: 'Growth curve experiment',
        content: '{"type":"doc","content":[{"type":"paragraph"}]}',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      expect(entry.id).toBe('test-uuid-1');
      expect(entry.projectId).toBe('proj-001');
      expect(entry.title).toBe('Growth curve experiment');
      expect(entry.signatures).toEqual([]);
      expect(entry.createdAt).toBe('2026-06-26T12:00:00.000Z');
      expect(entry.updatedAt).toBe('2026-06-26T12:00:00.000Z');
    });

    test('persists entry to database', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Test Entry',
        content: 'content here',
        attachments: [
          { id: 'att-1', filename: 'data.csv', mimeType: 'text/csv', size: 1024, path: '/files/data.csv' },
        ],
        createdAt: '',
        updatedAt: '',
      });

      expect(db.rows.size).toBe(1);
      const row = db.rows.get('test-uuid-1');
      expect(row).toBeDefined();
      expect(row!.title).toBe('Test Entry');
    });
  });

  describe('getEntry', () => {
    test('retrieves existing entry by ID', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'My Entry',
        content: 'test content',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      const entry = await service.getEntry('test-uuid-1');

      expect(entry).not.toBeNull();
      expect(entry!.id).toBe('test-uuid-1');
      expect(entry!.title).toBe('My Entry');
    });

    test('returns null for nonexistent entry', async () => {
      const entry = await service.getEntry('nonexistent');
      expect(entry).toBeNull();
    });
  });

  describe('updateEntry', () => {
    test('updates title and content', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Original Title',
        content: 'original content',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      const updated = await service.updateEntry('test-uuid-1', {
        title: 'Updated Title',
        content: 'updated content',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('updated content');
      expect(updated.updatedAt).toBe('2026-06-26T12:00:00.000Z');
    });

    test('throws if entry not found', async () => {
      await expect(
        service.updateEntry('nonexistent', { title: 'New' }),
      ).rejects.toThrow('ELN entry not found: nonexistent');
    });

    test('preserves existing fields when partially updating', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Title',
        content: 'content',
        attachments: [{ id: 'a1', filename: 'f.txt', mimeType: 'text/plain', size: 10, path: '/f.txt' }],
        createdAt: '',
        updatedAt: '',
      });

      const updated = await service.updateEntry('test-uuid-1', {
        title: 'New Title',
      });

      expect(updated.title).toBe('New Title');
      expect(updated.content).toBe('content');
      expect(updated.attachments).toHaveLength(1);
    });
  });

  describe('signEntry', () => {
    test('adds signature with content hash', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Protocol',
        content: 'Step 1: Prepare media',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      const signed = await service.signEntry(
        'test-uuid-1',
        'user-001',
        'Dr. Smith',
        'authored',
      );

      expect(signed.signatures).toHaveLength(1);
      expect(signed.signatures[0]).toEqual({
        userId: 'user-001',
        userName: 'Dr. Smith',
        signedAt: '2026-06-26T12:00:00.000Z',
        meaning: 'authored',
        contentHash: expect.any(String),
      });
      expect(signed.signatures[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
    });

    test('supports multiple signatures with different meanings', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Protocol',
        content: 'Step 1: Prepare media',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      await service.signEntry('test-uuid-1', 'user-001', 'Alice', 'authored');
      await service.signEntry('test-uuid-1', 'user-002', 'Bob', 'reviewed');
      const entry = await service.signEntry('test-uuid-1', 'user-003', 'Carol', 'approved');

      expect(entry.signatures).toHaveLength(3);
      expect(entry.signatures[0].meaning).toBe('authored');
      expect(entry.signatures[1].meaning).toBe('reviewed');
      expect(entry.signatures[2].meaning).toBe('approved');
    });

    test('throws on duplicate signature (same user + meaning)', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Protocol',
        content: 'content',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      await service.signEntry('test-uuid-1', 'user-001', 'Alice', 'authored');

      await expect(
        service.signEntry('test-uuid-1', 'user-001', 'Alice', 'authored'),
      ).rejects.toThrow('already signed');
    });

    test('throws if entry not found', async () => {
      await expect(
        service.signEntry('nonexistent', 'user-001', 'Alice', 'authored'),
      ).rejects.toThrow('ELN entry not found: nonexistent');
    });
  });

  describe('verifySignature', () => {
    test('returns true when content matches signature hash', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Protocol',
        content: 'Step 1: Prepare media',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      const signed = await service.signEntry(
        'test-uuid-1',
        'user-001',
        'Alice',
        'authored',
      );

      expect(service.verifySignature(signed, 0)).toBe(true);
    });

    test('returns false when content has been tampered with', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Protocol',
        content: 'Step 1: Prepare media',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      await service.signEntry('test-uuid-1', 'user-001', 'Alice', 'authored');

      // Tamper with content
      await service.updateEntry('test-uuid-1', {
        content: 'TAMPERED content',
      });

      const entry = await service.getEntry('test-uuid-1');
      expect(service.verifySignature(entry!, 0)).toBe(false);
    });

    test('returns false for invalid signature index', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Protocol',
        content: 'content',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      const entry = await service.getEntry('test-uuid-1');
      expect(service.verifySignature(entry!, 5)).toBe(false);
    });
  });

  describe('listEntries', () => {
    test('returns entries for a project', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Entry A',
        content: 'a',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Entry B',
        content: 'b',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });
      await service.createEntry({
        projectId: 'proj-002',
        title: 'Entry C',
        content: 'c',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      const entries = await service.listEntries('proj-001');
      expect(entries).toHaveLength(2);
      expect(entries.every((e: ELNEntry) => e.projectId === 'proj-001')).toBe(true);
    });

    test('returns empty array for project with no entries', async () => {
      const entries = await service.listEntries('empty-project');
      expect(entries).toEqual([]);
    });
  });

  describe('deleteEntry', () => {
    test('deletes unsigned entry', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Draft',
        content: 'draft content',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      const deleted = await service.deleteEntry('test-uuid-1');
      expect(deleted).toBe(true);

      const entry = await service.getEntry('test-uuid-1');
      expect(entry).toBeNull();
    });

    test('throws when trying to delete a signed entry', async () => {
      await service.createEntry({
        projectId: 'proj-001',
        title: 'Signed Protocol',
        content: 'approved content',
        attachments: [],
        createdAt: '',
        updatedAt: '',
      });

      await service.signEntry('test-uuid-1', 'user-001', 'Alice', 'approved');

      await expect(service.deleteEntry('test-uuid-1')).rejects.toThrow(
        'Cannot delete a signed ELN entry',
      );
    });

    test('throws if entry not found', async () => {
      await expect(service.deleteEntry('nonexistent')).rejects.toThrow(
        'ELN entry not found: nonexistent',
      );
    });
  });
});
