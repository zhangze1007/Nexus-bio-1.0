export const config = { runtime: 'edge' };

const CORS = {
  'Content-Type': 'text/plain',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });

  const url = new URL(req.url);
  const cid = url.searchParams.get('cid');
  if (!cid || !/^\d+$/.test(cid)) return json({ error: 'Invalid CID' }, 400);

  // Try 3D first, fall back to 2D if no 3D conformer exists
  const attempts = [
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`,
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF`,
  ];

  for (const attemptUrl of attempts) {
    try {
      const res = await fetch(attemptUrl, {
        headers: { 'User-Agent': 'NexusBio/1.0 (fuchanze@gmail.com)' },
      });
      if (!res.ok) continue;
      const sdf = await res.text();
      if (!sdf || sdf.length < 30) continue;
      return new Response(sdf, { status: 200, headers: CORS });
    } catch { continue; }
  }

  return json({ error: `No SDF found for CID ${cid}` }, 404);
}
