/**
 * AlphaFold3 / ColabFold Multi-Chain Prediction API Route
 *
 * Proxies ColabFold API for multi-chain protein complex prediction.
 * ColabFold uses MMseqs2 for MSA + AlphaFold2/3 for structure prediction.
 *
 * API: https://colabfold.com
 * Alternative: https://alphafold.ebi.ac.uk/api/
 *
 * Reference: Mirdita et al. (2022) Nat Methods 19:679 (ColabFold)
 * Reference: Abramson et al. (2024) Nature 630:493 (AlphaFold3)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';

export const runtime = 'edge';

const COLABFOLD_API = 'https://colabfold.com/api';
const ALPHAFOLD_API = 'https://alphafold.ebi.ac.uk/api';
const TIMEOUT = 120000; // 2 min timeout for complex predictions

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * POST /api/alphafold3
 *
 * Body: {
 *   sequences: Array<{ id: string; sequence: string }>,
 *   mode: 'alphafold2' | 'alphafold3',
 *   paired: boolean  // whether to use paired MSA
 * }
 *
 * Returns: { pdb: string, plddt: number[], ptm: number, iptm: number, chains: string[] }
 */
export async function POST(req: NextRequest) {
  const requestId = `af3_${Date.now().toString(36)}`;

  try {
    const body = await req.json();
    const { sequences, mode = 'alphafold2', paired = true } = body;

    if (!sequences || !Array.isArray(sequences) || sequences.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing or empty sequences array', requestId },
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    // Validate sequences
    for (const seq of sequences) {
      if (!seq.id || !seq.sequence) {
        return NextResponse.json(
          { ok: false, error: 'Each sequence must have id and sequence', requestId },
          { status: 400, headers: getCorsHeaders(req) },
        );
      }
      const cleanSeq = seq.sequence.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '');
      if (cleanSeq.length < 10) {
        return NextResponse.json(
          { ok: false, error: `Sequence ${seq.id} too short (min 10 residues)`, requestId },
          { status: 400, headers: getCorsHeaders(req) },
        );
      }
    }

    const startTime = Date.now();

    // Try ColabFold API first (supports multi-chain)
    try {
      const colabResult = await callColabFold(sequences, paired);
      if (colabResult) {
        return NextResponse.json({
          ok: true,
          ...colabResult,
          source: 'colabfold',
          requestId,
          durationMs: Date.now() - startTime,
        }, { headers: { ...getCorsHeaders(req), 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } });
      }
    } catch {
      // ColabFold unavailable, try AlphaFold API
    }

    // Fallback: AlphaFold EBI API (single chain only)
    if (sequences.length === 1) {
      try {
        const afResult = await callAlphaFold(sequences[0].sequence);
        if (afResult) {
          return NextResponse.json({
            ok: true,
            pdb: afResult.pdb,
            plddt: afResult.plddt,
            ptm: 0,
            iptm: 0,
            chains: [sequences[0].id],
            source: 'alphafold',
            requestId,
            durationMs: Date.now() - startTime,
          }, { headers: { ...getCorsHeaders(req), 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } });
        }
      } catch {
        // AlphaFold also unavailable
      }
    }

    // Both APIs unavailable
    return NextResponse.json({
      ok: false,
      error: 'Structure prediction APIs unavailable. Try ESMFold (/api/esmfold) for single chains.',
      requestId,
      fallback: '/api/esmfold',
    }, { status: 503, headers: getCorsHeaders(req) });

  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error), requestId },
      { status: 500, headers: getCorsHeaders(req) },
    );
  }
}

/**
 * Call ColabFold API for multi-chain prediction.
 */
async function callColabFold(
  sequences: Array<{ id: string; sequence: string }>,
  paired: boolean,
): Promise<{ pdb: string; plddt: number[]; ptm: number; iptm: number; chains: string[] } | null> {
  // Format sequences for ColabFold
  const fasta = sequences.map(s => `>${s.id}\n${s.sequence}`).join('\n');

  // Submit job
  const submitResponse = await fetch(`${COLABFOLD_API}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sequences: sequences.map(s => s.sequence),
      mode: paired ? 'paired' : 'unpaired',
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!submitResponse.ok) return null;

  const submitData = await submitResponse.json();
  const jobId = submitData.job_id || submitData.id;
  if (!jobId) return null;

  // Poll for results
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusResponse = await fetch(`${COLABFOLD_API}/status/${jobId}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!statusResponse.ok) continue;

    const statusData = await statusResponse.json();

    if (statusData.status === 'completed' || statusData.pdb) {
      const pdb = statusData.pdb || statusData.structure || '';
      const plddt = extractPLDDTFromPDB(pdb);

      return {
        pdb,
        plddt,
        ptm: statusData.ptm || 0,
        iptm: statusData.iptm || 0,
        chains: sequences.map(s => s.id),
      };
    }

    if (statusData.status === 'failed') return null;
  }

  return null; // timeout
}

/**
 * Call AlphaFold EBI API for single chain.
 */
async function callAlphaFold(sequence: string): Promise<{ pdb: string; plddt: number[] } | null> {
  const response = await fetch(`${ALPHAFOLD_API}/prediction/${sequence}`, {
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data && data.length > 0) {
    const pdbUrl = data[0].pdbUrl;
    const pdbResponse = await fetch(pdbUrl, { signal: AbortSignal.timeout(30000) });
    const pdb = await pdbResponse.text();
    const plddt = extractPLDDTFromPDB(pdb);
    return { pdb, plddt };
  }

  return null;
}

/**
 * Extract pLDDT from PDB B-factor column.
 */
function extractPLDDTFromPDB(pdbText: string): number[] {
  const plddt: number[] = [];
  const lines = pdbText.split('\n');
  let prevResidue = -1;

  for (const line of lines) {
    if (!line.startsWith('ATOM')) continue;
    const atomName = line.substring(12, 16).trim();
    if (atomName !== 'CA') continue;

    const residueIndex = parseInt(line.substring(22, 26).trim());
    if (residueIndex === prevResidue) continue;
    prevResidue = residueIndex;

    const bFactor = parseFloat(line.substring(60, 66));
    if (!isNaN(bFactor)) plddt.push(bFactor);
  }

  return plddt;
}
