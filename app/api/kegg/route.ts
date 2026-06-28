import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';

export const runtime = 'edge';

/**
 * KEGG REST API CORS proxy for pathway validation (P3.3).
 *
 * Modes:
 *   ?compound=<name>   — search KEGG compounds by name, returns list of KEGG IDs
 *   ?pathway=<cpd_id>  — get pathways linked to a KEGG compound ID (e.g. C00024)
 *   ?reaction=<rxn_id> — get reaction details (e.g. R00238)
 *
 * @license
 *   KEGG REST API is public and free for academic use.
 *   Commercial use requires a paid license from Kanehisa Laboratories.
 *   See: https://www.kegg.jp/kegg/legal.html
 *   Citation: Kanehisa & Goto (2000) Nucleic Acids Res 28:27-30
 *
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
      const sanitized = compound.replace(/[^a-zA-Z0-9\s\-]/g, '').slice(0, 100);
      const res = await fetch(`${KEGG_BASE}/find/compound/${encodeURIComponent(sanitized)}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        return errorResponse('KEGG compound search failed', 502, { status: res.status }, corsHeaders(req));
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
        return errorResponse('Invalid KEGG compound ID (expected C#####)', 400, undefined, corsHeaders(req));
      }
      const res = await fetch(`${KEGG_BASE}/link/pathway/${pathway}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        return errorResponse('KEGG pathway link failed', 502, { status: res.status }, corsHeaders(req));
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
        const linkRes = await fetch(`${KEGG_BASE}/link/reaction/ec:${reaction}`, { signal: AbortSignal.timeout(10000) });
        if (!linkRes.ok) {
          return errorResponse('KEGG EC→reaction link failed', 502, { status: linkRes.status }, corsHeaders(req));
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
        return errorResponse('Invalid KEGG reaction ID (expected R##### or EC number)', 400, undefined, corsHeaders(req));
      }

      const res = await fetch(`${KEGG_BASE}/get/${reactionId}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        return errorResponse('KEGG reaction fetch failed', 502, { status: res.status }, corsHeaders(req));
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

    return errorResponse('Missing parameter. Use ?compound=<name>, ?pathway=<C#####>, or ?reaction=<R#####>', 400, undefined, corsHeaders(req));
  } catch (err) {
    console.error('KEGG proxy error:', err);
    return errorResponse('KEGG proxy error', 502, undefined, corsHeaders(req));
  }
}
