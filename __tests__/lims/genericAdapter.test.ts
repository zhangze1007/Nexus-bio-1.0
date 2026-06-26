/**
 * Generic LIMS Adapter Tests
 *
 * Tests field mapping transforms, sync logic, and error handling.
 */

import { GenericLIMSAdapter } from '../../src/services/lims/genericAdapter';
import type { FieldMapping, LIMSConfig } from '../../src/services/lims/types';

// ── Helpers ──

function makeConfig(overrides?: Partial<LIMSConfig>): LIMSConfig {
  return {
    id: 'test-generic',
    name: 'Test Generic LIMS',
    type: 'generic',
    baseUrl: 'https://lims.example.com',
    authType: 'api_key',
    credentials: { api_key: 'test-key' },
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

// ── Tests ──

describe('GenericLIMSAdapter', () => {
  const dummyFetch = jest.fn() as unknown as typeof fetch;

  describe('constructor', () => {
    test('creates adapter with valid config', () => {
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn: dummyFetch });
      expect(adapter).toBeDefined();
    });
  });

  describe('mapToLIMS', () => {
    test('maps fields using direct transform', () => {
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn: dummyFetch });
      const mappings: FieldMapping[] = [
        { nexusField: 'name', limsField: 'sample_name', transform: 'direct' },
        { nexusField: 'type', limsField: 'sample_type' },
      ];

      const result = adapter.mapToLIMS(
        { name: 'E. coli BL21', type: 'strain', extra: 'keep' },
        mappings,
      );

      expect(result).toEqual({
        sample_name: 'E. coli BL21',
        sample_type: 'strain',
        extra: 'keep', // unmapped field passed through
      });
    });

    test('transforms values to JSON string', () => {
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn: dummyFetch });
      const mappings: FieldMapping[] = [
        { nexusField: 'metadata', limsField: 'metadata_json', transform: 'json' },
      ];

      const result = adapter.mapToLIMS(
        { metadata: { key: 'value', count: 42 } },
        mappings,
      );

      expect(result.metadata_json).toBe('{"key":"value","count":42}');
    });

    test('transforms Date to ISO string', () => {
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn: dummyFetch });
      const mappings: FieldMapping[] = [
        { nexusField: 'createdAt', limsField: 'created_date', transform: 'date' },
      ];

      const date = new Date('2026-01-15T10:30:00Z');
      const result = adapter.mapToLIMS({ createdAt: date }, mappings);

      expect(result.created_date).toBe('2026-01-15T10:30:00.000Z');
    });

    test('handles null and undefined values', () => {
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn: dummyFetch });
      const mappings: FieldMapping[] = [
        { nexusField: 'name', limsField: 'name' },
        { nexusField: 'missing', limsField: 'also_missing' },
      ];

      const result = adapter.mapToLIMS({ name: null, missing: undefined }, mappings);

      expect(result.name).toBeNull();
      expect(result.also_missing).toBeUndefined();
    });
  });

  describe('mapFromLIMS', () => {
    test('reverse-maps fields from LIMS format', () => {
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn: dummyFetch });
      const mappings: FieldMapping[] = [
        { nexusField: 'name', limsField: 'sample_name' },
        { nexusField: 'type', limsField: 'sample_type' },
      ];

      const result = adapter.mapFromLIMS(
        { sample_name: 'BL21', sample_type: 'strain', lims_id: 'L-001' },
        mappings,
      );

      expect(result).toEqual({
        name: 'BL21',
        type: 'strain',
        lims_id: 'L-001', // unmapped field preserved
      });
    });

    test('parses JSON strings back to objects', () => {
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn: dummyFetch });
      const mappings: FieldMapping[] = [
        { nexusField: 'metadata', limsField: 'metadata_json', transform: 'json' },
      ];

      const result = adapter.mapFromLIMS(
        { metadata_json: '{"key":"value"}' },
        mappings,
      );

      expect(result.metadata).toEqual({ key: 'value' });
    });

    test('handles invalid JSON gracefully', () => {
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn: dummyFetch });
      const mappings: FieldMapping[] = [
        { nexusField: 'metadata', limsField: 'metadata_json', transform: 'json' },
      ];

      const result = adapter.mapFromLIMS(
        { metadata_json: 'not valid json' },
        mappings,
      );

      // Returns original string when JSON parse fails
      expect(result.metadata).toBe('not valid json');
    });

    test('parses date strings to ISO format', () => {
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn: dummyFetch });
      const mappings: FieldMapping[] = [
        { nexusField: 'createdAt', limsField: 'created_date', transform: 'date' },
      ];

      const result = adapter.mapFromLIMS(
        { created_date: '2026-01-15T10:30:00.000Z' },
        mappings,
      );

      expect(result.createdAt).toBe('2026-01-15T10:30:00.000Z');
    });
  });

  describe('sync', () => {
    test('pull direction fetches and maps entities', async () => {
      const remoteEntities = [
        { sample_name: 'BL21', sample_type: 'strain' },
        { sample_name: 'pUC19', sample_type: 'plasmid' },
      ];
      const fetchFn = mockFetch(remoteEntities);
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn });

      const result = await adapter.sync({
        direction: 'pull',
        entityType: 'samples',
        mappings: [
          { nexusField: 'name', limsField: 'sample_name' },
          { nexusField: 'type', limsField: 'sample_type' },
        ],
        endpoint: '/api/samples',
      });

      expect(result.direction).toBe('pull');
      expect(result.entityType).toBe('samples');
      expect(result.pulled).toBe(2);
      expect(result.pushed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.syncedAt).toBeDefined();

      expect(fetchFn).toHaveBeenCalledWith(
        'https://lims.example.com/api/samples',
        expect.anything(),
      );
    });

    test('passes since parameter when provided', async () => {
      const fetchFn = mockFetch([]);
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn });

      await adapter.sync({
        direction: 'pull',
        entityType: 'samples',
        since: '2026-01-01T00:00:00Z',
      });

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining('since=2026-01-01T00%3A00%3A00Z'),
        expect.anything(),
      );
    });

    test('captures errors during sync', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('DB connection failed'),
      }) as unknown as typeof fetch;

      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn });

      const result = await adapter.sync({
        direction: 'pull',
        entityType: 'samples',
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('500');
    });
  });

  describe('pushEntity', () => {
    test('POSTs mapped entity and returns external ID', async () => {
      const fetchFn = mockFetch({ id: 'ext-001' });
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn });

      const id = await adapter.pushEntity(
        { name: 'BL21', type: 'strain' },
        [
          { nexusField: 'name', limsField: 'sample_name' },
          { nexusField: 'type', limsField: 'sample_type' },
        ],
        '/api/samples',
      );

      expect(id).toBe('ext-001');
      expect(fetchFn).toHaveBeenCalledWith(
        'https://lims.example.com/api/samples',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sample_name: 'BL21',
            sample_type: 'strain',
          }),
        }),
      );
    });
  });

  describe('pullEntities', () => {
    test('fetches and maps multiple entities', async () => {
      const fetchFn = mockFetch([
        { sample_name: 'BL21', sample_type: 'strain' },
        { sample_name: 'DH5a', sample_type: 'strain' },
      ]);
      const adapter = new GenericLIMSAdapter(makeConfig(), { fetchFn });

      const results = await adapter.pullEntities(
        [
          { nexusField: 'name', limsField: 'sample_name' },
          { nexusField: 'type', limsField: 'sample_type' },
        ],
        '/api/samples',
      );

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('BL21');
      expect(results[1].name).toBe('DH5a');
    });
  });

  describe('authorization', () => {
    test('sends Bearer token for api_key auth', async () => {
      const fetchFn = mockFetch([]);
      const adapter = new GenericLIMSAdapter(
        makeConfig({ authType: 'api_key', credentials: { api_key: 'my-key' } }),
        { fetchFn },
      );

      await adapter.sync({ direction: 'pull', entityType: 'test' });

      const [, init] = (fetchFn as jest.Mock).mock.calls[0];
      expect(init.headers.Authorization).toBe('Bearer my-key');
    });

    test('sends Basic auth for basic auth type', async () => {
      const fetchFn = mockFetch([]);
      const adapter = new GenericLIMSAdapter(
        makeConfig({
          authType: 'basic',
          credentials: { username: 'user', password: 'pass' },
        }),
        { fetchFn },
      );

      await adapter.sync({ direction: 'pull', entityType: 'test' });

      const [, init] = (fetchFn as jest.Mock).mock.calls[0];
      const expected = `Basic ${Buffer.from('user:pass').toString('base64')}`;
      expect(init.headers.Authorization).toBe(expected);
    });

    test('sends Bearer token for oauth2 auth', async () => {
      const fetchFn = mockFetch([]);
      const adapter = new GenericLIMSAdapter(
        makeConfig({ authType: 'oauth2', credentials: { access_token: 'oauth-tok' } }),
        { fetchFn },
      );

      await adapter.sync({ direction: 'pull', entityType: 'test' });

      const [, init] = (fetchFn as jest.Mock).mock.calls[0];
      expect(init.headers.Authorization).toBe('Bearer oauth-tok');
    });
  });
});
