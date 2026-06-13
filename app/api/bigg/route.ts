export const runtime = 'edge';

const BIGG_BASE = 'http://bigg.ucsd.edu/api/v3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');

  if (!type) {
    return Response.json({ error: 'Missing param: type' }, { status: 400 });
  }

  const rxnId = searchParams.get('rxnId');

  const endpointMap: Record<string, string> = {
    models: 'models',
    model: `models/${id}`,
    reaction: `models/${id}/reactions`,
    metabolite: `models/${id}/metabolites`,
    rxn_detail: rxnId ? `models/${id}/reactions/${rxnId}` : '',
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
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return Response.json(
      { error: `BiGG unreachable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
