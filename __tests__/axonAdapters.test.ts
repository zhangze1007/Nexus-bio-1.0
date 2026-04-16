/** @jest-environment node */
/**
 * Thin-adapter contract tests. We don't hit real backends — we stub fetch
 * and assert the adapters (a) build the right request, (b) surface success
 * shape, and (c) raise explicit errors on unsupported input / server fail.
 */
import { pathdAdapter, fbasimAdapter } from '../src/services/axonAdapters';

type FetchMock = jest.Mock<Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>, [string, RequestInit?]>;

function mockFetch(handler: (url: string, init?: RequestInit) => { ok: boolean; status?: number; body: unknown }): FetchMock {
  const mock: FetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const r = handler(url, init);
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.body,
    };
  });
  (globalThis as unknown as { fetch: unknown }).fetch = mock;
  return mock;
}

describe('pathdAdapter', () => {
  afterEach(() => { (globalThis as unknown as { fetch?: unknown }).fetch = undefined; });

  it('rejects empty targetProduct with a clear error', async () => {
    await expect(
      pathdAdapter({ targetProduct: '' }, {}),
    ).rejects.toThrow(/non-empty targetProduct/i);
  });

  it('posts to /api/analyze and extracts node / bottleneck counts', async () => {
    const mock = mockFetch((url) => {
      expect(url).toBe('/api/analyze');
      const body = {
        candidates: [{
          content: { parts: [{ text: JSON.stringify({
            nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
            bottleneck_enzymes: [{ node_id: 'a' }],
          }) }] },
        }],
        meta: { provider: 'groq' },
      };
      return { ok: true, body };
    });
    const result = await pathdAdapter({ targetProduct: 'artemisinin' }, {});
    expect(mock).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('groq');
    expect(result.nodeCount).toBe(3);
    expect(result.bottleneckCount).toBe(1);
    expect(result.parseError).toBeNull();
  });

  it('surfaces meta.parseError when backend flagged malformed output', async () => {
    mockFetch(() => ({
      ok: true,
      body: {
        candidates: [{ content: { parts: [{ text: 'not json' }] } }],
        meta: { provider: 'gemini', parseError: { code: 'INVALID_SYNTAX', message: 'bad' } },
      },
    }));
    const result = await pathdAdapter({ targetProduct: 'xyz' }, {});
    expect(result.nodeCount).toBe(0);
    expect(result.parseError).toEqual({ code: 'INVALID_SYNTAX', message: 'bad' });
  });

  it('throws when the backend returns a non-2xx', async () => {
    mockFetch(() => ({ ok: false, status: 503, body: { error: 'All providers down' } }));
    await expect(
      pathdAdapter({ targetProduct: 'xyz' }, {}),
    ).rejects.toThrow(/All providers down/);
  });

  it('throws when the backend returns ok but no candidate text', async () => {
    mockFetch(() => ({ ok: true, body: { candidates: [] } }));
    await expect(
      pathdAdapter({ targetProduct: 'xyz' }, {}),
    ).rejects.toThrow(/no candidate text/i);
  });
});

describe('fbasimAdapter', () => {
  afterEach(() => { (globalThis as unknown as { fetch?: unknown }).fetch = undefined; });

  it('posts default species/objective and extracts flux count', async () => {
    const mock = mockFetch((url, init) => {
      expect(url).toBe('/api/fba');
      const parsed = JSON.parse((init?.body as string) ?? '{}');
      expect(parsed.species).toBe('ecoli');
      expect(parsed.objective).toBe('biomass');
      return {
        ok: true,
        body: {
          ok: true,
          result: { objectiveValue: 0.873, fluxes: [{ id: 'r1' }, { id: 'r2' }] },
        },
      };
    });
    const out = await fbasimAdapter({}, {});
    expect(mock).toHaveBeenCalled();
    expect(out.species).toBe('ecoli');
    expect(out.objective).toBe('biomass');
    expect(out.objectiveValue).toBeCloseTo(0.873);
    expect(out.fluxCount).toBe(2);
  });

  it('respects user-supplied species and knockouts', async () => {
    mockFetch((_, init) => {
      const parsed = JSON.parse((init?.body as string) ?? '{}');
      expect(parsed.species).toBe('yeast');
      expect(parsed.knockouts).toEqual(['pfk1']);
      return { ok: true, body: { ok: true, result: { objectiveValue: 0.2, fluxes: [] } } };
    });
    const out = await fbasimAdapter({ species: 'yeast', knockouts: ['pfk1'] }, {});
    expect(out.species).toBe('yeast');
  });

  it('throws on backend error payload', async () => {
    mockFetch(() => ({ ok: false, status: 400, body: { ok: false, error: 'bad request' } }));
    await expect(fbasimAdapter({}, {})).rejects.toThrow(/bad request/);
  });

  it('throws when backend returns ok=false without throwing HTTP error', async () => {
    mockFetch(() => ({ ok: true, body: { ok: false, error: 'simplex infeasible' } }));
    await expect(fbasimAdapter({}, {})).rejects.toThrow(/simplex infeasible/);
  });
});
