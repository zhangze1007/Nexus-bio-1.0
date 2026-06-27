/** @jest-environment node */

/**
 * Tests for the /api/alphafold endpoint (AlphaFold PDB proxy).
 *
 * Covers: successful proxy via API, fallback to legacy URL, invalid ID,
 * missing ID parameter, and network error handling.
 */

// ── Imports ──

import { NextRequest } from 'next/server';
import { GET } from '../../app/api/alphafold/route';

const VALID_PDB = `HEADER    HYDROLASE
ATOM      1  N   ALA A   1      27.340  24.430   2.614  1.00  9.67           N
ATOM      2  CA  ALA A   1      26.266  25.413   2.842  1.00 10.38           C
ATOM      3  C   ALA A   1      26.913  26.639  3.531  1.00  9.62           C
ATOM      4  O   ALA A   1      27.886  26.463  4.263  1.00  9.62           O
ATOM      5  CB  ALA A   1      25.112  24.880   3.649  1.00 13.77           C
END`;

const SHORT_PDB = 'HEADER    SHORT'; // Too short, < 100 chars

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createGetRequest(id?: string): NextRequest {
  const url = id
    ? `http://localhost:3000/api/alphafold?id=${id}`
    : 'http://localhost:3000/api/alphafold';
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ──

describe('GET /api/alphafold', () => {
  describe('successful proxy', () => {
    it('returns PDB data from AlphaFold API entry point', async () => {
      // Strategy 1: AlphaFold API returns a JSON entry with pdbUrl
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-Q9AR04-F1-model_v4.pdb' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(VALID_PDB),
        });

      const req = createGetRequest('Q9AR04');
      const res = await GET(req);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toContain('HEADER');
      expect(text).toContain('ATOM');
      expect(res.headers.get('Content-Type')).toBe('text/plain');
      expect(res.headers.get('Cache-Control')).toContain('max-age');
    });

    it('falls back to legacy URL when API entry point fails', async () => {
      // Strategy 1: API returns error
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        // Strategy 2: legacy URL succeeds
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(VALID_PDB),
        });

      const req = createGetRequest('P08836');
      const res = await GET(req);
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toContain('HEADER');
    });

    it('rejects PDB data shorter than 100 characters', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-XXXX.pdb' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(SHORT_PDB),
        })
        // Legacy also returns short
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(SHORT_PDB),
        });

      const req = createGetRequest('Q9AR04');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/not found/i);
    });
  });

  describe('invalid input', () => {
    it('returns 400 when id parameter is missing', async () => {
      const req = createGetRequest();
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/missing id/i);
    });

    it('returns 400 for invalid UniProt ID format', async () => {
      const req = createGetRequest('invalid-id-123!@#');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/invalid.*uniprot/i);
    });

    it('returns 400 for too-short ID', async () => {
      const req = createGetRequest('AB');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.ok).toBe(false);
    });
  });

  describe('not found', () => {
    it('returns 404 when both API and legacy strategies fail', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      const req = createGetRequest('Q9AR04');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/not found/i);
    });
  });

  describe('network errors', () => {
    it('returns 500 when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const req = createGetRequest('Q9AR04');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/fetch failed/i);
    });
  });
});
