/**
 * Tests for the NexusBioClient using mocked fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NexusBioClient, NexusBioError } from '../client';

// ── Mock setup ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockJsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers || {})),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

// ── Health ───────────────────────────────────────────────────────────────────

describe('health', () => {
  it('returns health status', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({ status: 'ok', timestamp: '2026-06-26T00:00:00Z', version: 'abc1234' }),
    );
    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.health();
    expect(result.status).toBe('ok');
    expect(result.version).toBe('abc1234');
  });
});

// ── Analyze ──────────────────────────────────────────────────────────────────

describe('analyze', () => {
  it('sends prompt and returns response', async () => {
    const response = {
      candidates: [{ content: { parts: [{ text: 'Artemisinin pathway analysis.' }] } }],
      meta: { provider: 'groq' },
    };
    mockFetch.mockResolvedValue(mockJsonResponse(response));

    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.analyze('Design an artemisinin pathway');

    expect(result.candidates?.[0]?.content?.parts?.[0]?.text).toBe('Artemisinin pathway analysis.');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://nexus-bio-1-0.vercel.app/api/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
      }),
    );
  });

  it('sends context and searchQuery', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ candidates: [], meta: {} }));

    const client = new NexusBioClient({ apiKey: 'test-key' });
    await client.analyze('test', { organism: 'ecoli' }, { searchQuery: 'mevalonate pathway' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.context).toEqual({ organism: 'ecoli' });
    expect(body.searchQuery).toBe('mevalonate pathway');
  });
});

// ── FBA ──────────────────────────────────────────────────────────────────────

describe('runFBA', () => {
  it('runs single-species FBA', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({
        ok: true,
        growthRate: 0.873,
        fluxes: { BIOMASS_Ecoli_core: 0.873 },
        status: 'optimal',
      }),
    );

    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.runFBA({ objective: 'biomass', species: 'ecoli' });

    expect(result.ok).toBe(true);
    expect(result.growthRate).toBeCloseTo(0.873);
  });

  it('runs community FBA with knockouts', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({ ok: true, growthRate: 0.5, fluxes: {}, status: 'optimal' }),
    );

    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.runFBA({
      mode: 'community',
      alpha: 0.6,
      knockouts: ['PFK'],
    });

    expect(result.ok).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.mode).toBe('community');
    expect(body.knockouts).toEqual(['PFK']);
  });
});

// ── Inventory ────────────────────────────────────────────────────────────────

describe('listInventory', () => {
  it('lists strains', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({
        items: [{ id: 'inv_1', name: 'E. coli BL21' }],
        total: 1,
      }),
    );

    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.listInventory('strains');

    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe('E. coli BL21');
  });

  it('applies search and pagination', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ items: [], total: 0 }));

    const client = new NexusBioClient({ apiKey: 'test-key' });
    await client.listInventory('plasmids', { search: 'pET', limit: 10, offset: 20 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('search=pET');
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('offset=20');
  });
});

// ── Projects ─────────────────────────────────────────────────────────────────

describe('listProjects', () => {
  it('lists projects', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse([
        { id: 'proj_1', name: 'Artemisinin', revision: 5 },
        { id: 'proj_2', name: 'Lycopene', revision: 2 },
      ]),
    );

    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.listProjects();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Artemisinin');
  });

  it('wraps single project in array', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ id: 'proj_1', name: 'Solo' }));

    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.listProjects();

    expect(result).toHaveLength(1);
  });
});

// ── External lookups ─────────────────────────────────────────────────────────

describe('external lookups', () => {
  it('fetches AlphaFold structure', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ pdb: 'HEADER ...' }));

    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.analyzeProtein('Q9AR04');

    expect(result.pdb).toBe('HEADER ...');
    expect(mockFetch.mock.calls[0][0]).toContain('alphafold?id=Q9AR04');
  });

  it('looks up PubChem molecule', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ sdf: '...' }));

    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.lookupMolecule({ name: 'artemisinin' });

    expect(result.sdf).toBe('...');
  });

  it('searches KEGG', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ results: [] }));

    const client = new NexusBioClient({ apiKey: 'test-key' });
    const result = await client.searchKEGG('mevalonate');

    expect(result).toEqual({ results: [] });
  });
});

// ── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('throws NexusBioError on 401', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Invalid API key' }, 401));

    const client = new NexusBioClient({ apiKey: 'bad-key' });
    await expect(client.health()).rejects.toThrow(NexusBioError);
    await expect(client.health()).rejects.toThrow('Invalid API key');
  });

  it('throws on 429 with message', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Rate limit exceeded' }, 429));

    const client = new NexusBioClient({ apiKey: 'test-key' });
    await expect(client.analyze('test')).rejects.toThrow('Rate limit exceeded');
  });

  it('throws on 500', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'Internal server error' }, 500));

    const client = new NexusBioClient({ apiKey: 'test-key' });
    await expect(client.health()).rejects.toThrow('Internal server error');
  });
});

// ── Custom base URL ──────────────────────────────────────────────────────────

describe('custom base URL', () => {
  it('uses provided base URL', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ status: 'ok' }));

    const client = new NexusBioClient({ apiKey: 'key', baseUrl: 'http://localhost:3000' });
    await client.health();

    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:3000/api/health');
  });
});
