/**
 * ESMFold API Route — Protein Structure Prediction
 *
 * Proxies ESMFold (Evolutionary Scale Modeling) for protein structure prediction.
 * ESMFold is a single-sequence structure prediction model that doesn't require
 * MSA (Multiple Sequence Alignment), making it much faster than AlphaFold.
 *
 * Reference: Lin et al. (2023) Science 379:1123-1130
 *
 * API: https://www.ebi.ac.uk/tools/esmfold/
 * Fallback: RCSB PDB search for known structures
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';

export const runtime = 'edge';

const ESMFOLD_API = 'https://www.ebi.ac.uk/tools/esmfold/api/predict';
const ESMFOLD_TIMEOUT = 60000; // 60s

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * POST /api/esmfold
 *
 * Body: { sequence: string, name?: string }
 * Returns: { pdb: string, plddt: number, model: string }
 */
export async function POST(req: NextRequest) {
  const requestId = `esmfold_${Date.now().toString(36)}`;

  try {
    const body = await req.json();
    const { sequence, name } = body;

    if (!sequence || typeof sequence !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid sequence', requestId },
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    // Validate sequence (amino acids only)
    const cleanSeq = sequence.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '');
    if (cleanSeq.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Sequence too short (minimum 10 residues)', requestId },
        { status: 400, headers: getCorsHeaders(req) },
      );
    }
    if (cleanSeq.length > 1500) {
      return NextResponse.json(
        { ok: false, error: 'Sequence too long (maximum 1500 residues for ESMFold)', requestId },
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    // Call ESMFold API
    const startTime = Date.now();

    const response = await fetch(ESMFOLD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: cleanSeq }),
      signal: AbortSignal.timeout(ESMFOLD_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { ok: false, error: `ESMFold API error: ${response.status} - ${errorText}`, requestId },
        { status: 502, headers: getCorsHeaders(req) },
      );
    }

    const result = await response.json();
    const durationMs = Date.now() - startTime;

    // Extract PDB and pLDDT
    const pdb = result.pdb || result.structure || '';
    const plddt = result.plddt || result.confidence || 0;

    return NextResponse.json(
      {
        ok: true,
        pdb,
        plddt: Math.round(plddt * 100) / 100,
        model: 'ESM-2 (8M)',
        sequence: cleanSeq,
        name: name || 'ESMFold prediction',
        requestId,
        durationMs,
      },
      { headers: { ...getCorsHeaders(req), 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } },
    );
  } catch (error) {
    console.error('[api/esmfold] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    // If ESMFold API is unavailable, return a helpful error
    if (errorMsg.includes('timeout') || errorMsg.includes('fetch')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ESMFold API unavailable. Use AlphaFold proxy (/api/alphafold) for known structures.',
          requestId,
          fallback: '/api/alphafold',
        },
        { status: 503, headers: getCorsHeaders(req) },
      );
    }

    return NextResponse.json(
      { ok: false, error: 'An internal error occurred', requestId },
      { status: 500, headers: getCorsHeaders(req) },
    );
  }
}

/**
 * GET /api/esmfold?sequence=MKT...
 *
 * Convenience GET endpoint for simple queries.
 */
export async function GET(req: NextRequest) {
  const sequence = req.nextUrl.searchParams.get('sequence');
  if (!sequence) {
    return NextResponse.json(
      { ok: false, error: 'Missing ?sequence= parameter' },
      { status: 400, headers: getCorsHeaders(req) },
    );
  }

  // Delegate to POST
  const fakeReq = new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sequence }),
  }) as NextRequest;

  return POST(fakeReq);
}
