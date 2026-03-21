export const config = { runtime: 'edge' };

const CORS_HEADERS = {
  'Content-Type': 'text/plain',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const cid = url.searchParams.get('cid');

  if (!cid || !/^\d+$/.test(cid)) {
    return new Response('Invalid CID', { status: 400, headers: CORS_HEADERS });
  }

  try {
    const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
    const res = await fetch(pubchemUrl);

    if (!res.ok) {
      return new Response(`PubChem error: ${res.status}`, { status: res.status, headers: CORS_HEADERS });
    }

    const sdf = await res.text();
    if (!sdf || sdf.length < 50) {
      return new Response('Empty SDF', { status: 404, headers: CORS_HEADERS });
    }

    return new Response(sdf, { status: 200, headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(`Fetch error: ${err.message}`, { status: 500, headers: CORS_HEADERS });
  }
}
