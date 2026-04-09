import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * KEGG REST API CORS proxy for pathway validation (P3.3).
 *
 * Modes:
 *   ?compound=<name>   — search KEGG compounds by name, returns list of KEGG IDs
 *   ?pathway=<cpd_id>  — get pathways linked to a KEGG compound ID (e.g. C00024)
 *   ?reaction=<rxn_id> — get reaction details (e.g. R00238)
 *
 * KEGG REST API is public and free for academic use.
 * See: https://rest.kegg.jp/
 */

const KEGG_BASE = 'https://rest.kegg.jp';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=3600',
};

export async function GET(req: NextRequest) {
  const compound = req.nextUrl.searchParams.get('compound');
  const pathway = req.nextUrl.searchParams.get('pathway');
  const reaction = req.nextUrl.searchParams.get('reaction');

  try {
    // Mode 1: Search compound by name → list of KEGG compound IDs
    if (compound) {
      const sanitized = compound.replace(/[^a-zA-Z0-9\s\-()]/g, '').slice(0, 100);
      const res = await fetch(`${KEGG_BASE}/find/compound/${encodeURIComponent(sanitized)}`);
      if (!res.ok) {
        return NextResponse.json({ error: 'KEGG compound search failed', status: res.status }, { status: 502, headers: CORS_HEADERS });
      }
      const text = await res.text();
      const results = text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [id, ...nameParts] = line.split('\t');
          return { id: id?.replace('cpd:', '') ?? '', names: nameParts.join('\t') };
        });
      return NextResponse.json({ query: sanitized, results }, { headers: CORS_HEADERS });
    }

    // Mode 2: Get pathways linked to a compound ID
    if (pathway) {
      if (!/^C\d{5}$/.test(pathway)) {
        return NextResponse.json({ error: 'Invalid KEGG compound ID (expected C#####)' }, { status: 400, headers: CORS_HEADERS });
      }
      const res = await fetch(`${KEGG_BASE}/link/pathway/${pathway}`);
      if (!res.ok) {
        return NextResponse.json({ error: 'KEGG pathway link failed', status: res.status }, { status: 502, headers: CORS_HEADERS });
      }
      const text = await res.text();
      const pathways = text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const parts = line.split('\t');
          return { compound: parts[0]?.replace('cpd:', '') ?? '', pathway: parts[1]?.replace('path:', '') ?? '' };
        });
      return NextResponse.json({ compound: pathway, pathways }, { headers: CORS_HEADERS });
    }

    // Mode 3: Get reaction details
    if (reaction) {
      if (!/^R\d{5}$/.test(reaction)) {
        return NextResponse.json({ error: 'Invalid KEGG reaction ID (expected R#####)' }, { status: 400, headers: CORS_HEADERS });
      }
      const res = await fetch(`${KEGG_BASE}/get/${reaction}`);
      if (!res.ok) {
        return NextResponse.json({ error: 'KEGG reaction fetch failed', status: res.status }, { status: 502, headers: CORS_HEADERS });
      }
      const text = await res.text();
      return NextResponse.json({ reaction, data: text }, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { error: 'Missing parameter. Use ?compound=<name>, ?pathway=<C#####>, or ?reaction=<R#####>' },
      { status: 400, headers: CORS_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'KEGG proxy error', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 502, headers: CORS_HEADERS },
    );
  }
}
