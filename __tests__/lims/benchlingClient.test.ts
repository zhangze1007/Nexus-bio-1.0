/**
 * Benchling Client Tests
 *
 * Tests API call structure, error handling, and response mapping.
 * Uses a mock fetch function to avoid real HTTP calls.
 */

import { BenchlingClient } from '../../src/services/lims/benchlingClient';
import type { LIMSConfig } from '../../src/services/lims/types';

// ── Helpers ──

function makeConfig(overrides?: Partial<LIMSConfig>): LIMSConfig {
  return {
    id: 'test-benchling',
    name: 'Test Benchling',
    type: 'benchling',
    baseUrl: 'https://test.benchling.com',
    authType: 'api_key',
    credentials: { api_key: 'test-key-123' },
    syncDirection: 'bidirectional',
    ...overrides,
  };
}

function mockFetch(response: unknown, status = 200): typeof fetch {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: jest.fn().mockResolvedValue(JSON.stringify(response)),
    json: jest.fn().mockResolvedValue(response),
  }) as unknown as typeof fetch;
}

function mockFetchError(message: string): typeof fetch {
  return jest.fn().mockRejectedValue(new Error(message)) as unknown as typeof fetch;
}

// ── Tests ──

describe('BenchlingClient', () => {
  const dummyFetch = jest.fn() as unknown as typeof fetch;

  describe('constructor', () => {
    test('creates client with valid benchling config', () => {
      const client = new BenchlingClient(makeConfig(), { fetchFn: dummyFetch });
      expect(client).toBeDefined();
    });

    test('throws if config type is not benchling', () => {
      expect(() => {
        new BenchlingClient(makeConfig({ type: 'generic' }), { fetchFn: dummyFetch });
      }).toThrow('requires config type "benchling"');
    });

    test('throws if api_key is missing', () => {
      expect(() => {
        new BenchlingClient(makeConfig({ credentials: {} }), { fetchFn: dummyFetch });
      }).toThrow('requires an api_key');
    });
  });

  describe('searchSequences', () => {
    test('calls correct API endpoint with query', async () => {
      const fetchFn = mockFetch({
        dnaSequences: [
          { id: 'seq-001', name: 'pBR322', bases: 'ATCG', length: 4361 },
        ],
      });

      const client = new BenchlingClient(makeConfig(), { fetchFn });
      const results = await client.searchSequences('pBR322');

      expect(fetchFn).toHaveBeenCalledWith(
        'https://test.benchling.com/api/v2/dna-sequences?name=pBR322&limit=20',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    test('maps response to LIMSSample format', async () => {
      const fetchFn = mockFetch({
        dnaSequences: [
          {
            id: 'seq-001',
            name: 'pBR322',
            bases: 'ATCGATCG',
            length: 8,
            annotations: [{ type: 'CDS' }],
            folderId: 'folder-1',
          },
        ],
      });

      const client = new BenchlingClient(makeConfig(), { fetchFn });
      const results = await client.searchSequences('pBR322');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'benchling-seq-001',
        name: 'pBR322',
        type: 'plasmid',
        properties: {
          length: 8,
          bases: 'ATCGATCG',
          annotations: [{ type: 'CDS' }],
          folderId: 'folder-1',
        },
        externalId: 'seq-001',
        source: 'lims',
      });
    });

    test('returns empty array when no results', async () => {
      const fetchFn = mockFetch({ dnaSequences: [] });
      const client = new BenchlingClient(makeConfig(), { fetchFn });
      const results = await client.searchSequences('nonexistent');

      expect(results).toEqual([]);
    });

    test('throws on API error', async () => {
      const fetchFn = mockFetch({ error: 'not found' }, 404);
      const client = new BenchlingClient(makeConfig(), { fetchFn });

      await expect(client.searchSequences('test')).rejects.toThrow(
        'Benchling API 404',
      );
    });

    test('throws on network error', async () => {
      const fetchFn = mockFetchError('network timeout');
      const client = new BenchlingClient(makeConfig(), { fetchFn });

      await expect(client.searchSequences('test')).rejects.toThrow(
        'network timeout',
      );
    });
  });

  describe('getSequence', () => {
    test('fetches single sequence by ID', async () => {
      const fetchFn = mockFetch({
        id: 'seq-001',
        name: 'pUC19',
        bases: 'ATCG',
        length: 2686,
      });

      const client = new BenchlingClient(makeConfig(), { fetchFn });
      const result = await client.getSequence('seq-001');

      expect(fetchFn).toHaveBeenCalledWith(
        'https://test.benchling.com/api/v2/dna-sequences/seq-001',
        expect.anything(),
      );
      expect(result.id).toBe('benchling-seq-001');
      expect(result.name).toBe('pUC19');
      expect(result.type).toBe('plasmid');
      expect(result.source).toBe('lims');
    });
  });

  describe('createSequence', () => {
    test('POSTs sequence data and returns ID', async () => {
      const fetchFn = mockFetch({ id: 'seq-new-001' });
      const client = new BenchlingClient(makeConfig(), { fetchFn });

      const id = await client.createSequence({
        id: 'local-1',
        name: 'New Plasmid',
        type: 'plasmid',
        properties: { bases: 'ATCGATCG', folderId: 'folder-1' },
        source: 'nexus-bio',
      });

      expect(id).toBe('seq-new-001');
      expect(fetchFn).toHaveBeenCalledWith(
        'https://test.benchling.com/api/v2/dna-sequences',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'New Plasmid',
            bases: 'ATCGATCG',
            folderId: 'folder-1',
            annotations: [],
          }),
        }),
      );
    });
  });

  describe('searchPlates', () => {
    test('searches plates by barcode', async () => {
      const fetchFn = mockFetch({
        plates: [
          { id: 'plate-001', name: 'Plate A', barcode: 'BC-001', plateType: '96-well', wellCount: 96 },
        ],
      });

      const client = new BenchlingClient(makeConfig(), { fetchFn });
      const results = await client.searchPlates('BC-001');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('benchling-plate-plate-001');
      expect(results[0].properties.barcode).toBe('BC-001');
    });
  });

  describe('uploadAssayResults', () => {
    test('creates assay run with experiment data', async () => {
      const fetchFn = mockFetch({ id: 'run-001' });
      const client = new BenchlingClient(makeConfig(), { fetchFn });

      const id = await client.uploadAssayResults({
        id: 'exp-1',
        title: 'Growth Assay',
        description: 'Testing growth rate',
        results: { growthRate: 0.42, od600: 1.2 },
      });

      expect(id).toBe('run-001');
      expect(fetchFn).toHaveBeenCalledWith(
        'https://test.benchling.com/api/v2/assay-runs',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Growth Assay',
            notes: 'Testing growth rate',
            fields: { growthRate: 0.42, od600: 1.2 },
          }),
        }),
      );
    });
  });

  describe('getCustomEntities', () => {
    test('fetches and classifies custom entities', async () => {
      const fetchFn = mockFetch({
        customEntities: [
          { id: 'ent-001', name: 'E. coli BL21', fields: { type: 'strain' } },
          { id: 'ent-002', name: 'pET28a', fields: { type: 'plasmid' } },
          { id: 'ent-003', name: 'Forward Primer', fields: { type: 'primer' } },
          { id: 'ent-004', name: 'IPTG', fields: { type: 'chemical' } },
          { id: 'ent-005', name: 'Unknown', fields: {} },
        ],
      });

      const client = new BenchlingClient(makeConfig(), { fetchFn });
      const results = await client.getCustomEntities('samples');

      expect(results).toHaveLength(5);
      expect(results[0].type).toBe('strain');
      expect(results[1].type).toBe('plasmid');
      expect(results[2].type).toBe('primer');
      expect(results[3].type).toBe('chemical');
      expect(results[4].type).toBe('other');
    });
  });

  describe('authorization', () => {
    test('sends Basic auth with API key', async () => {
      const fetchFn = mockFetch({ dnaSequences: [] });
      const client = new BenchlingClient(makeConfig(), { fetchFn });

      await client.searchSequences('test');

      const [, init] = (fetchFn as jest.Mock).mock.calls[0];
      const authHeader = init.headers.Authorization;

      // Basic auth: base64("test-key-123:")
      const expected = `Basic ${Buffer.from('test-key-123:').toString('base64')}`;
      expect(authHeader).toBe(expected);
    });
  });
});
