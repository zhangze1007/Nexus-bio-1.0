/** @jest-environment node */

/**
 * Tests for the /api/pubchem endpoint (PubChem 3D SDF proxy).
 *
 * Covers: CID lookup, name lookup, properties mode, autocomplete suggestions,
 * invalid CID, missing parameters, and error handling.
 */

// ── Imports ──

import { NextRequest } from 'next/server';
import { GET } from '../../app/api/pubchem/route';

const VALID_SDF = `
     RDKit          3D

  8  8  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5400    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
M  END
`;

const PROPERTIES_JSON = JSON.stringify({
  PropertyTable: {
    Properties: [{ CID: 444493, MolecularFormula: 'C23H38N7O17P3S', MolecularWeight: 809.57 }],
  },
});

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createGetRequest(params: Record<string, string>): NextRequest {
  const searchParams = new URLSearchParams(params);
  const url = `http://localhost:3000/api/pubchem?${searchParams.toString()}`;
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ──

describe('GET /api/pubchem', () => {
  describe('CID lookup', () => {
    it('returns SDF data for a valid CID (3D attempt first)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(VALID_SDF),
      });

      const req = createGetRequest({ cid: '444493' });
      const res = await GET(req);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toContain('RDKit');
      expect(res.headers.get('Content-Type')).toBe('text/plain');
    });

    it('falls back to 2D SDF when 3D is unavailable', async () => {
      // 3D attempt fails
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        // 2D attempt succeeds
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(VALID_SDF),
        });

      const req = createGetRequest({ cid: '444493' });
      const res = await GET(req);

      expect(res.status).toBe(200);
    });

    it('returns molecular properties when properties=true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(PROPERTIES_JSON),
      });

      const req = createGetRequest({ cid: '444493', properties: 'true' });
      const res = await GET(req);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toContain('MolecularFormula');
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('returns 404 when no SDF is available for CID', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      const req = createGetRequest({ cid: '999999999' });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.ok).toBe(false);
    });

    it('returns 400 for non-numeric CID', async () => {
      const req = createGetRequest({ cid: 'abc' });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/invalid cid/i);
    });
  });

  describe('name lookup', () => {
    it('resolves compound name to CID and returns SDF', async () => {
      // Step 1: name -> CID lookup
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ IdentifierList: { CID: [68827] } }),
        })
        // Step 2: 3D SDF fetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(VALID_SDF),
        });

      const req = createGetRequest({ name: 'artemisinin' });
      const res = await GET(req);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toContain('RDKit');
      expect(res.headers.get('X-PubChem-CID')).toBe('68827');
    });

    it('returns 404 when name is not found in PubChem', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const req = createGetRequest({ name: 'nonexistent-compound-xyz' });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.ok).toBe(false);
    });

    it('returns 400 for empty name parameter', async () => {
      const req = createGetRequest({ name: '   ' });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.ok).toBe(false);
    });
  });

  describe('autocomplete suggestions', () => {
    it('returns suggestion list for a partial compound name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          dictionary: {
            compound: [
              { ci: 68827, name: 'artemisinin' },
              { ci: 5362031, name: 'artemisinic acid' },
            ],
          },
        }),
      });

      const req = createGetRequest({ suggest: 'artem' });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.suggestions).toHaveLength(2);
      expect(data.suggestions[0].name).toBe('artemisinin');
    });

    it('returns empty suggestions on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const req = createGetRequest({ suggest: 'artem' });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.suggestions).toEqual([]);
    });
  });

  describe('missing parameters', () => {
    it('returns 400 when neither cid nor name is provided', async () => {
      const req = createGetRequest({});
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/cid.*name/i);
    });
  });
});
