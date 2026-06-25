export const runtime = 'edge';

import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';

const BIGG_BASE = 'http://bigg.ucsd.edu/api/v3';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');

  if (!type) {
    return Response.json({ error: 'Missing param: type' }, { status: 400 });
  }

  const rxnId = searchParams.get('rxnId');
  const page = searchParams.get('page');

  const endpointMap: Record<string, string> = {
    models: 'models',
    model: `models/${id}`,
    reaction: `models/${id}/reactions`,
    metabolite: `models/${id}/metabolites`,
    rxn_detail: rxnId ? `models/${id}/reactions/${rxnId}` : '',
    rxn_page: `models/${id}/reactions?page=${page ?? 1}&per_page=100`,
  };

  const endpoint = endpointMap[type];
  if (!endpoint) {
    return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });
  }

  try {
    const res = await fetch(`${BIGG_BASE}/${endpoint}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return Response.json({ error: `BiGG returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
        ...getCorsHeaders(request),
      },
    });
  } catch (e) {
    return Response.json(
      { error: `BiGG unreachable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
