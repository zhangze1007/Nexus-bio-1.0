/**
 * BLAST Off-Target Search Proxy
 *
 * Proxies CRISPR guide RNA off-target search requests to the Railway-hosted
 * Python BLAST backend. The backend aligns the guide against the E. coli K-12
 * MG1655 genome using blastn-short (optimized for 20-nt queries).
 *
 * Environment variable: BLAST_PYTHON_BACKEND (e.g. https://scspatial-backend.up.railway.app)
 *
 * Request body:
 *   { sequence: "ACGTACGTACGTACGTACGT", maxMismatches?: 3 }
 *
 * Response body:
 *   { ok: true, total_hits: number, hits: OffTargetHit[], seed_mismatch_sites: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';

export const runtime = 'edge';

const BLAST_BACKEND = process.env.BLAST_PYTHON_BACKEND?.replace(/\/+$/, '') || '';

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  if (!BLAST_BACKEND) {
    return NextResponse.json(
      {
        ok: false,
        error: 'BLAST_PYTHON_BACKEND not configured',
        detail: 'Set BLAST_PYTHON_BACKEND env var to the Railway backend URL.',
      },
      { status: 503, headers: getCorsHeaders(req) },
    );
  }

  try {
    const body = await req.json();
    const { sequence, maxMismatches = 3 } = body;

    if (!sequence || typeof sequence !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid sequence' },
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    const cleanSeq = sequence.toUpperCase().replace(/[^ACGT]/g, '');
    if (cleanSeq.length < 15) {
      return NextResponse.json(
        { ok: false, error: `Sequence too short (${cleanSeq.length} nt, need >=15)` },
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    const resp = await fetch(`${BLAST_BACKEND}/blast/offtarget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: cleanSeq, maxMismatches }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { ok: false, error: `BLAST backend returned ${resp.status}`, detail: errText },
        { status: 502, headers: getCorsHeaders(req) },
      );
    }

    const data = await resp.json();
    return NextResponse.json(
      { ok: true, ...data },
      { headers: { ...getCorsHeaders(req), 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (err) {
    console.error('[api/blast/offtarget] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'An internal error occurred' },
      { status: 502, headers: getCorsHeaders(req) },
    );
  }
}
