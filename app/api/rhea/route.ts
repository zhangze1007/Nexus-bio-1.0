import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';

export const runtime = 'edge';

/**
 * Rhea REST API CORS proxy for enzyme-catalyzed reaction lookups.
 *
 * Rhea is a comprehensive, expert-curated database of biochemical reactions
 * built on the ChEBI (Chemical Entities of Biological Interest) ontology.
 *
 * Modes:
 *   ?query=<term>         — search Rhea for reactions matching a query (e.g. "mevalonate kinase")
 *   ?id=<rhea_id>        — get full reaction details (e.g. "12345" or "RHEA:12345")
 *   ?ec=<ec_number>      — search Rhea by EC number (e.g. "2.7.1.36")
 *
 * Rhea REST API is public and free for academic use.
 * See: https://www.rhea-db.org/help/programmatic-access
 */

const RHEA_BASE = 'https://www.rhea-db.org/rest';

function corsHeaders(req?: Request) {
  return { ...getCorsHeaders(req), 'Cache-Control': 'public, max-age=3600' };
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query');
  const id = req.nextUrl.searchParams.get('id');
  const ec = req.nextUrl.searchParams.get('ec');

  try {
    // Mode 1: Search Rhea by query string
    if (query) {
      const sanitized = query.replace(/[^a-zA-Z0-9\s\-().,]/g, '').slice(0, 200);
      const res = await fetch(
        `${RHEA_BASE}/rhea/search?query=${encodeURIComponent(sanitized)}&format=json`,
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Rhea search failed', status: res.status },
          { status: 502, headers: corsHeaders(req) },
        );
      }
      const data = await res.json();
      return NextResponse.json(
        { query: sanitized, results: data.results ?? [] },
        { headers: corsHeaders(req) },
      );
    }

    // Mode 2: Get reaction details by Rhea ID
    if (id) {
      const normalizedId = id.replace(/^RHEA:/i, '').replace(/[^0-9]/g, '');
      if (!normalizedId) {
        return NextResponse.json(
          { error: 'Invalid Rhea ID (expected numeric or RHEA:XXXXX)' },
          { status: 400, headers: corsHeaders(req) },
        );
      }
      const res = await fetch(`${RHEA_BASE}/rhea/${normalizedId}?format=json`);
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Rhea reaction fetch failed', status: res.status },
          { status: 502, headers: corsHeaders(req) },
        );
      }
      const data = await res.json();
      return NextResponse.json(data, { headers: corsHeaders(req) });
    }

    // Mode 3: Search Rhea by EC number
    if (ec) {
      // Validate EC number format (e.g. "2.7.1.36" or "2.7.1.-")
      if (!/^\d+\.\d+\.\d+\.\d+(-)?$/.test(ec)) {
        return NextResponse.json(
          { error: 'Invalid EC number format (expected X.X.X.X)' },
          { status: 400, headers: corsHeaders(req) },
        );
      }
      const res = await fetch(
        `${RHEA_BASE}/rhea/search?query=${encodeURIComponent(ec)}&format=json`,
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Rhea EC search failed', status: res.status },
          { status: 502, headers: corsHeaders(req) },
        );
      }
      const data = await res.json();
      return NextResponse.json(
        { ec, results: data.results ?? [] },
        { headers: corsHeaders(req) },
      );
    }

    return NextResponse.json(
      { error: 'Missing parameter. Use ?query=<term>, ?id=<rhea_id>, or ?ec=<ec_number>' },
      { status: 400, headers: corsHeaders(req) },
    );
  } catch (err) {
    console.error('Rhea proxy error:', err);
    return NextResponse.json(
      { error: 'Rhea proxy error' },
      { status: 502, headers: corsHeaders(req) },
    );
  }
}
