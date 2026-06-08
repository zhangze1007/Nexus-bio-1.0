/** @jest-environment node */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

import {
  solveAuthorityFBA,
  solveAuthorityFBAWithProvenance,
  solveAuthorityCommunityFBA,
  solveAuthorityCommunityFBAWithProvenance,
} from '../src/services/FBAAuthorityClient';

beforeEach(() => {
  mockFetch.mockReset();
});

describe('solveAuthorityFBA', () => {
  it('sends correct request body for single-species FBA', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        result: { fluxes: {}, growthRate: 0.5, feasible: true },
      }),
    });

    await solveAuthorityFBA({
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 20,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/fba');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.mode).toBe('single');
    expect(body.species).toBe('ecoli'); // default
    expect(body.objective).toBe('biomass');
    expect(body.glucoseUptake).toBe(10);
    expect(body.oxygenUptake).toBe(20);
    expect(body.knockouts).toEqual([]); // default
  });

  it('uses specified species', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        result: { fluxes: {}, growthRate: 0.3, feasible: true },
      }),
    });

    await solveAuthorityFBA({
      species: 'yeast',
      objective: 'product',
      glucoseUptake: 8,
      oxygenUptake: 15,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.species).toBe('yeast');
  });

  it('passes knockouts through', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        result: { fluxes: {}, growthRate: 0, feasible: false },
      }),
    });

    await solveAuthorityFBA({
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 20,
      knockouts: ['GLCpts', 'PGI'],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.knockouts).toEqual(['GLCpts', 'PGI']);
  });

  it('returns the result from the response', async () => {
    const expectedResult = {
      fluxes: { GLCpts: 10, BIOMASS: 0.82 },
      growthRate: 0.82,
      atpYield: 2.5,
      feasible: true,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: expectedResult }),
    });

    const result = await solveAuthorityFBA({
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 20,
    });

    expect(result).toEqual(expectedResult);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, error: 'Solver failed' }),
    });

    await expect(
      solveAuthorityFBA({
        objective: 'biomass',
        glucoseUptake: 10,
        oxygenUptake: 20,
      }),
    ).rejects.toThrow('Solver failed');
  });

  it('throws on ok=false in payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: 'Internal error' }),
    });

    await expect(
      solveAuthorityFBA({
        objective: 'biomass',
        glucoseUptake: 10,
        oxygenUptake: 20,
      }),
    ).rejects.toThrow('Internal error');
  });

  it('throws generic error when payload has no error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    await expect(
      solveAuthorityFBA({
        objective: 'biomass',
        glucoseUptake: 10,
        oxygenUptake: 20,
      }),
    ).rejects.toThrow('Authoritative FBA service failed');
  });

  it('handles fetch JSON parse failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => { throw new Error('parse error'); },
    });

    await expect(
      solveAuthorityFBA({
        objective: 'biomass',
        glucoseUptake: 10,
        oxygenUptake: 20,
      }),
    ).rejects.toThrow('Authoritative FBA service failed');
  });

  it('passes abort signal', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    });

    const controller = new AbortController();
    await solveAuthorityFBA(
      { objective: 'biomass', glucoseUptake: 10, oxygenUptake: 20 },
      controller.signal,
    );

    expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
  });
});

describe('solveAuthorityFBAWithProvenance', () => {
  it('returns both result and provenance', async () => {
    const result = { fluxes: {}, growthRate: 0.5, feasible: true };
    const provenance = {
      toolId: 'fbasim',
      timestamp: Date.now(),
      inputAssumptions: [],
      outputAssumptions: [],
      evidence: [],
      validityTier: 'real',
      upstreamProvenance: [],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result, provenance }),
    });

    const response = await solveAuthorityFBAWithProvenance({
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 20,
    });

    expect(response.result).toEqual(result);
    expect(response.provenance).toEqual(provenance);
  });

  it('returns undefined provenance when not provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: { fluxes: {} } }),
    });

    const response = await solveAuthorityFBAWithProvenance({
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 20,
    });

    expect(response.result).toBeDefined();
    expect(response.provenance).toBeUndefined();
  });

  it('sends same request body as solveAuthorityFBA', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    });

    await solveAuthorityFBAWithProvenance({
      species: 'yeast',
      objective: 'atp',
      glucoseUptake: 5,
      oxygenUptake: 10,
      knockouts: ['PGI'],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.mode).toBe('single');
    expect(body.species).toBe('yeast');
    expect(body.objective).toBe('atp');
    expect(body.glucoseUptake).toBe(5);
    expect(body.oxygenUptake).toBe(10);
    expect(body.knockouts).toEqual(['PGI']);
  });
});

describe('solveAuthorityCommunityFBA', () => {
  it('sends correct community request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        result: { ecoli: {}, yeast: {}, exchangeFluxes: [] },
      }),
    });

    await solveAuthorityCommunityFBA({
      objective: 'biomass',
      ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
      yeast: { glucoseUptake: 8, oxygenUptake: 15 },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.mode).toBe('community');
    expect(body.objective).toBe('biomass');
    expect(body.alpha).toBe(0.5); // default
    expect(body.ecoli).toEqual({ glucoseUptake: 10, oxygenUptake: 20 });
    expect(body.yeast).toEqual({ glucoseUptake: 8, oxygenUptake: 15 });
  });

  it('passes custom alpha', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    });

    await solveAuthorityCommunityFBA({
      objective: 'product',
      alpha: 0.7,
      ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
      yeast: { glucoseUptake: 8, oxygenUptake: 15 },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.alpha).toBe(0.7);
  });

  it('passes knockouts for each species', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    });

    await solveAuthorityCommunityFBA({
      objective: 'biomass',
      ecoli: { glucoseUptake: 10, oxygenUptake: 20, knockouts: ['GLCpts'] },
      yeast: { glucoseUptake: 8, oxygenUptake: 15, knockouts: ['HXT'] },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.ecoli.knockouts).toEqual(['GLCpts']);
    expect(body.yeast.knockouts).toEqual(['HXT']);
  });

  it('throws on failed response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, error: 'Community solver failed' }),
    });

    await expect(
      solveAuthorityCommunityFBA({
        objective: 'biomass',
        ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
        yeast: { glucoseUptake: 8, oxygenUptake: 15 },
      }),
    ).rejects.toThrow('Community solver failed');
  });
});

describe('solveAuthorityCommunityFBAWithProvenance', () => {
  it('returns result and provenance for community FBA', async () => {
    const result = {
      ecoli: { fluxes: {}, growthRate: 0.5, feasible: true },
      yeast: { fluxes: {}, growthRate: 0.3, feasible: true },
      exchangeFluxes: [],
      communityGrowthRate: 0.4,
    };
    const provenance = {
      toolId: 'fbasim',
      timestamp: Date.now(),
      inputAssumptions: [],
      outputAssumptions: [],
      evidence: [],
      validityTier: 'real',
      upstreamProvenance: [],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result, provenance }),
    });

    const response = await solveAuthorityCommunityFBAWithProvenance({
      objective: 'biomass',
      ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
      yeast: { glucoseUptake: 8, oxygenUptake: 15 },
    });

    expect(response.result).toEqual(result);
    expect(response.provenance).toEqual(provenance);
  });

  it('sends community mode in request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    });

    await solveAuthorityCommunityFBAWithProvenance({
      objective: 'atp',
      alpha: 0.3,
      ecoli: { glucoseUptake: 10, oxygenUptake: 20, knockouts: ['PGI'] },
      yeast: { glucoseUptake: 8, oxygenUptake: 15, knockouts: ['HXK'] },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.mode).toBe('community');
    expect(body.alpha).toBe(0.3);
    expect(body.objective).toBe('atp');
  });

  it('uses default alpha of 0.5', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    });

    await solveAuthorityCommunityFBAWithProvenance({
      objective: 'biomass',
      ecoli: { glucoseUptake: 10, oxygenUptake: 20 },
      yeast: { glucoseUptake: 8, oxygenUptake: 15 },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.alpha).toBe(0.5);
  });
});
