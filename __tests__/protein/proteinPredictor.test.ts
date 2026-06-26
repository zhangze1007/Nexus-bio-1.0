/**
 * Protein Predictor Tests
 *
 * Tests for routing logic, validation, error handling, and backend selection.
 * Backend calls are mocked since they depend on API routes.
 */

import { predictStructure } from '../../src/services/protein/proteinPredictor';
import type { ProteinPredictionRequest } from '../../src/services/protein/types';

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Helper to create a successful fetch response
function okResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
    status: 200,
  } as Response;
}

function failResponse(status = 500) {
  return {
    ok: false,
    json: async () => ({ ok: false, error: 'Internal error' }),
    status,
  } as Response;
}

// Minimal valid PDB for tests
const MINIMAL_PDB = [
  'HEADER    TEST',
  'ATOM      1 CA  ALA A   1       0.000   0.000   0.000  1.00 90.00           C  ',
  'ATOM      2 CA  ALA A   2       3.800   0.000   0.000  1.00 85.00           C  ',
  'ATOM      3 CA  ALA A   3       7.600   0.000   0.000  1.00 80.00           C  ',
  'ATOM      4 CA  ALA A   4      11.400   0.000   0.000  1.00 75.00           C  ',
  'ATOM      5 CA  ALA A   5      15.200   0.000   0.000  1.00 70.00           C  ',
  'ATOM      6 CA  ALA A   6      19.000   0.000   0.000  1.00 65.00           C  ',
  'ATOM      7 CA  ALA A   7      22.800   0.000   0.000  1.00 60.00           C  ',
  'ATOM      8 CA  ALA A   8      26.600   0.000   0.000  1.00 55.00           C  ',
  'ATOM      9 CA  ALA A   9      30.400   0.000   0.000  1.00 50.00           C  ',
  'ATOM     10 CA  ALA A  10      34.200   0.000   0.000  1.00 45.00           C  ',
  'END',
].join('\n');

// A 10-residue valid amino acid sequence
const VALID_SEQ = 'ACDEFGHIKL';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('predictStructure', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ── Validation ──────────────────────────────────────────────────────────

  it('throws if sequences array is empty', async () => {
    await expect(predictStructure({ sequences: [] })).rejects.toThrow(
      'At least one sequence is required',
    );
  });

  it('throws if sequence is too short (< 10 residues)', async () => {
    await expect(
      predictStructure({ sequences: ['ACDEF'] }),
    ).rejects.toThrow('Sequence too short');
  });

  it('throws if sequence is too long (> 4000 residues)', async () => {
    const longSeq = 'A'.repeat(4001);
    await expect(
      predictStructure({ sequences: [longSeq] }),
    ).rejects.toThrow('Sequence too long');
  });

  it('throws if chainIds length < sequences length', async () => {
    await expect(
      predictStructure({
        sequences: [VALID_SEQ, VALID_SEQ],
        chainIds: ['A'],
      }),
    ).rejects.toThrow('chainIds length');
  });

  it('cleans non-standard amino acid characters', async () => {
    // Sequence with spaces and numbers — should be cleaned to valid AA string
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [90, 85, 80, 75, 70, 65, 60, 55, 50, 45],
        ptm: 0.8,
        iptm: 0,
        source: 'alphafold',
        durationMs: 1000,
      }),
    );

    const result = await predictStructure({
      sequences: ['A C D E F G H I K L'],
    });
    expect(result.pdb).toBeTruthy();
  });

  // ── Routing: single chain ───────────────────────────────────────────────

  it('routes single chain to AlphaFold2 first', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [90, 85, 80, 75, 70, 65, 60, 55, 50, 45],
        ptm: 0.75,
        iptm: 0,
        source: 'alphafold',
        durationMs: 500,
      }),
    );

    const result = await predictStructure({ sequences: [VALID_SEQ] });

    expect(result.pdb).toBe(MINIMAL_PDB);
    expect(result.metadata.model).toBe('alphafold2');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Should call /api/alphafold3 with alphafold2 mode
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/alphafold3');
    const body = JSON.parse(opts.body);
    expect(body.mode).toBe('alphafold2');
  });

  it('falls back to ESMFold when AlphaFold2 fails', async () => {
    mockFetch
      .mockResolvedValueOnce(failResponse(503)) // alphafold2 fails
      .mockResolvedValueOnce(
        okResponse({
          ok: true,
          pdb: MINIMAL_PDB,
          plddt: 75,
          durationMs: 200,
        }),
      );

    const result = await predictStructure({ sequences: [VALID_SEQ] });

    expect(result.metadata.model).toBe('esmfold');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws when all backends fail for single chain', async () => {
    mockFetch
      .mockResolvedValueOnce(failResponse(503)) // alphafold2
      .mockResolvedValueOnce(failResponse(503)); // esmfold

    await expect(
      predictStructure({ sequences: [VALID_SEQ] }),
    ).rejects.toThrow('All structure prediction backends are unavailable');
  });

  // ── Routing: multi-chain ────────────────────────────────────────────────

  it('routes multi-chain to ColabFold', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [90, 85, 80, 75, 70, 65, 60, 55, 50, 45],
        ptm: 0.7,
        iptm: 0.85,
        source: 'colabfold',
        durationMs: 3000,
      }),
    );

    const result = await predictStructure({
      sequences: [VALID_SEQ, VALID_SEQ],
    });

    expect(result.metadata.model).toBe('colabfold');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/alphafold3');
    const body = JSON.parse(opts.body);
    expect(body.mode).toBe('alphafold3');
    expect(body.sequences).toHaveLength(2);
  });

  it('falls back to AlphaFold2+ESMFold for single chain when ColabFold fails', async () => {
    mockFetch
      .mockResolvedValueOnce(failResponse(503)) // colabfold fails
      .mockResolvedValueOnce(
        okResponse({
          ok: true,
          pdb: MINIMAL_PDB,
          plddt: [90, 85, 80, 75, 70, 65, 60, 55, 50, 45],
          ptm: 0.7,
          source: 'alphafold',
          durationMs: 500,
        }),
      );

    const result = await predictStructure({
      sequences: [VALID_SEQ],
      model: 'colabfold',
    });

    // Should have tried colabfold, then alphafold2
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.metadata.model).toBe('alphafold2');
  });

  // ── Explicit model preference ───────────────────────────────────────────

  it('uses esmfold when explicitly requested', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: 72,
        durationMs: 100,
      }),
    );

    const result = await predictStructure({
      sequences: [VALID_SEQ],
      model: 'esmfold',
    });

    expect(result.metadata.model).toBe('esmfold');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/esmfold');
  });

  it('uses alphafold3 preference to route to colabfold', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [85],
        ptm: 0.8,
        iptm: 0.9,
        source: 'colabfold',
        durationMs: 2000,
      }),
    );

    const result = await predictStructure({
      sequences: [VALID_SEQ],
      model: 'alphafold3',
    });

    expect(result.metadata.model).toBe('colabfold');
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.mode).toBe('alphafold3');
  });

  // ── Chain ID generation ─────────────────────────────────────────────────

  it('auto-generates chain IDs when not provided', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [90, 85, 80, 75, 70, 65, 60, 55, 50, 45],
        ptm: 0.7,
        iptm: 0.8,
        source: 'colabfold',
        durationMs: 2000,
      }),
    );

    await predictStructure({
      sequences: [VALID_SEQ, VALID_SEQ, VALID_SEQ],
    });

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.sequences[0].id).toBe('A');
    expect(body.sequences[1].id).toBe('B');
    expect(body.sequences[2].id).toBe('C');
  });

  it('uses provided chain IDs', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [90, 85, 80, 75, 70, 65, 60, 55, 50, 45],
        ptm: 0.7,
        iptm: 0.8,
        source: 'colabfold',
        durationMs: 2000,
      }),
    );

    await predictStructure({
      sequences: [VALID_SEQ, VALID_SEQ],
      chainIds: ['H', 'L'],
    });

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.sequences[0].id).toBe('H');
    expect(body.sequences[1].id).toBe('L');
  });

  // ── Confidence extraction ───────────────────────────────────────────────

  it('extracts confidence from returned plddt array', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [95, 85, 75, 65, 55, 45, 35, 25, 15, 5],
        ptm: 0.6,
        iptm: 0,
        source: 'alphafold',
        durationMs: 400,
      }),
    );

    const result = await predictStructure({ sequences: [VALID_SEQ] });

    expect(result.confidence.pLDDT).toEqual([95, 85, 75, 65, 55, 45, 35, 25, 15, 5]);
    expect(result.confidence.meanPLDDT).toBeCloseTo(50, 0);
    expect(result.confidence.pTM).toBe(0.6);
  });

  it('falls back to PDB B-factor extraction when plddt is missing', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        // no plddt field
        ptm: 0.7,
        source: 'alphafold',
        durationMs: 400,
      }),
    );

    const result = await predictStructure({ sequences: [VALID_SEQ] });

    // Should extract from PDB B-factors
    expect(result.confidence.pLDDT).toHaveLength(10);
    expect(result.confidence.pLDDT[0]).toBeCloseTo(90, 0);
  });

  // ── Metadata ────────────────────────────────────────────────────────────

  it('includes timestamp in metadata', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [80],
        ptm: 0.5,
        source: 'alphafold',
        durationMs: 300,
      }),
    );

    const result = await predictStructure({ sequences: [VALID_SEQ] });

    expect(result.metadata.timestamp).toBeTruthy();
    expect(new Date(result.metadata.timestamp).getTime()).not.toBeNaN();
  });

  it('preserves sequence in metadata', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [80],
        ptm: 0.5,
        source: 'alphafold',
        durationMs: 300,
      }),
    );

    const result = await predictStructure({ sequences: [VALID_SEQ] });
    expect(result.metadata.sequence).toBe(VALID_SEQ);
  });

  it('stores array sequence for multi-chain', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ok: true,
        pdb: MINIMAL_PDB,
        plddt: [80],
        ptm: 0.5,
        iptm: 0.7,
        source: 'colabfold',
        durationMs: 1000,
      }),
    );

    const result = await predictStructure({
      sequences: [VALID_SEQ, VALID_SEQ],
    });
    expect(Array.isArray(result.metadata.sequence)).toBe(true);
    expect((result.metadata.sequence as string[])).toHaveLength(2);
  });

  // ── Network errors ──────────────────────────────────────────────────────

  it('handles fetch rejection (network error)', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    await expect(
      predictStructure({ sequences: [VALID_SEQ] }),
    ).rejects.toThrow('All structure prediction backends are unavailable');
  });
});
