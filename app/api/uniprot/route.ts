/**
 * UniProt REST API Proxy
 *
 * Proxies requests to the UniProt REST API for protein sequence,
 * function, and annotation data.
 *
 * Runtime: Edge
 *
 * References:
 *   - UniProt: The UniProt Consortium (2023) Nucleic Acids Res. 51:D523-D531
 *   - REST API: https://rest.uniprot.org/docs/
 */

import { NextRequest } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';

export const runtime = 'edge';

const UNIPROT_BASE = 'https://rest.uniprot.org';

const ENDPOINT_MAP: Record<string, (id: string) => string> = {
  search: (id) => `uniprotkb/search?query=${encodeURIComponent(id)}&format=json&size=1`,
  entry: (id) => `uniprotkb/${id}.json`,
};

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get('type');
  const id = searchParams.get('id');
  const corsHeaders = getCorsHeaders(req);

  if (!type || !id) {
    return errorResponse('Missing params: type, id', 400, undefined, corsHeaders);
  }

  const endpointFn = ENDPOINT_MAP[type];
  if (!endpointFn) {
    return errorResponse(`Unknown type: ${type}. Valid: ${Object.keys(ENDPOINT_MAP).join(', ')}`, 400, undefined, corsHeaders);
  }

  try {
    const res = await fetch(`${UNIPROT_BASE}/${endpointFn(id)}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return errorResponse(`UniProt returned ${res.status}`, res.status, undefined, corsHeaders);
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        ...corsHeaders,
      },
    });
  } catch (e) {
    return errorResponse(
      `UniProt unreachable: ${e instanceof Error ? e.message : String(e)}`,
      502,
      undefined,
      corsHeaders,
    );
  }
}
