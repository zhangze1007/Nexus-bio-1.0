import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';

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

function corsHeaders(req?: Request) {
  return { ...getCorsHeaders(req), 'Cache-Control': 'public, max-age=3600' };
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

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
        return NextResponse.json({ error: 'KEGG compound search failed', status: res.status }, { status: 502, headers: corsHeaders(req) });
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
      return NextResponse.json({ query: sanitized, results }, { headers: corsHeaders(req) });
    }

    // Mode 2: Get pathways linked to a compound ID
    if (pathway) {
      if (!/^C\d{5}$/.test(pathway)) {
        return NextResponse.json({ error: 'Invalid KEGG compound ID (expected C#####)' }, { status: 400, headers: corsHeaders(req) });
      }
      const res = await fetch(`${KEGG_BASE}/link/pathway/${pathway}`);
      if (!res.ok) {
        return NextResponse.json({ error: 'KEGG pathway link failed', status: res.status }, { status: 502, headers: corsHeaders(req) });
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
      return NextResponse.json({ compound: pathway, pathways }, { headers: corsHeaders(req) });
    }

    // Mode 3: Get reaction details (accepts R##### or EC number)
    if (reaction) {
      let reactionId = reaction;

      // If it's an EC number (e.g. "2.7.1.1"), resolve to a KEGG reaction ID first
      if (/^\d+\.\d+\.\d+\.\d+(-)?$/.test(reaction)) {
        const linkRes = await fetch(`${KEGG_BASE}/link/reaction/ec:${reaction}`);
        if (!linkRes.ok) {
          return NextResponse.json({ error: 'KEGG EC→reaction link failed', status: linkRes.status }, { status: 502, headers: corsHeaders(req) });
        }
        const linkText = await linkRes.text();
        const ids = linkText
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(line => {
            const parts = line.split('\t');
            return parts[1]?.replace('rn:', '') ?? '';
          })
          .filter(id => /^R\d{5}$/.test(id));
        if (ids.length === 0) {
          return NextResponse.json({ ec: reaction, data: [] }, { headers: corsHeaders(req) });
        }
        reactionId = ids[0];
      } else if (!/^R\d{5}$/.test(reaction)) {
        return NextResponse.json({ error: 'Invalid KEGG reaction ID (expected R##### or EC number)' }, { status: 400, headers: corsHeaders(req) });
      }

      const res = await fetch(`${KEGG_BASE}/get/${reactionId}`);
      if (!res.ok) {
        return NextResponse.json({ error: 'KEGG reaction fetch failed', status: res.status }, { status: 502, headers: corsHeaders(req) });
      }
      const text = await res.text();

      // Parse the KEGG flat-file into structured fields
      const getField = (field: string): string => {
        const regex = new RegExp(`^${field}\\s+(.+)$`, 'm');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
      };

      const entry = getField('ENTRY').split(/\s+/)[0] ?? '';
      const name = getField('NAME');
      const definition = getField('DEFINITION');
      const equation = getField('EQUATION');
      const enzymes = getField('ENZYME');

      return NextResponse.json({
        reaction: reactionId,
        ec: reaction !== reactionId ? reaction : undefined,
        data: [{ entry, name, definition, equation, enzymes }],
      }, { headers: corsHeaders(req) });
    }

    return NextResponse.json(
      { error: 'Missing parameter. Use ?compound=<name>, ?pathway=<C#####>, or ?reaction=<R#####>' },
      { status: 400, headers: corsHeaders(req) },
    );
  } catch (err) {
    console.error('KEGG proxy error:', err);
    return NextResponse.json(
      { error: 'KEGG proxy error' },
      { status: 502, headers: corsHeaders(req) },
    );
  }
}
