export const config = { runtime: 'edge' };

const CORS = {
  'Content-Type': 'text/plain',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });

  const url = new URL(req.url);
  const cid = url.searchParams.get('cid');
  const name = url.searchParams.get('name');

  // ── Mode 1: fetch SDF by CID ──────────────────────────────────────
  if (cid) {
    if (!/^\d+$/.test(cid)) return json({ error: 'Invalid CID' }, 400);

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

  // ── Mode 2: search CID by name, then fetch SDF ────────────────────
  if (name) {
    const cleanName = name.trim().slice(0, 200);
    if (!cleanName) return json({ error: 'Empty name' }, 400);

    try {
      // Step 1: resolve name → CID
      const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(cleanName)}/cids/JSON`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'NexusBio/1.0 (fuchanze@gmail.com)' },
      });

      if (!searchRes.ok) return json({ error: 'Name not found in PubChem' }, 404);

      const searchData = await searchRes.json() as { IdentifierList?: { CID?: number[] } };
      const foundCid = searchData?.IdentifierList?.CID?.[0];
      if (!foundCid) return json({ error: 'No CID found for this name' }, 404);

      // Step 2: fetch 3D SDF with found CID
      const sdfAttempts = [
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${foundCid}/SDF?record_type=3d`,
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${foundCid}/SDF`,
      ];

      for (const sdfUrl of sdfAttempts) {
        try {
          const sdfRes = await fetch(sdfUrl, {
            headers: { 'User-Agent': 'NexusBio/1.0 (fuchanze@gmail.com)' },
          });
          if (!sdfRes.ok) continue;
          const sdf = await sdfRes.text();
          if (!sdf || sdf.length < 30) continue;

          // Return SDF with CID in header so frontend knows what was found
          return new Response(sdf, {
            status: 200,
            headers: { ...CORS, 'X-PubChem-CID': String(foundCid) },
          });
        } catch { continue; }
      }

      return json({ error: `CID ${foundCid} found but no SDF available` }, 404);

    } catch (err: any) {
      return json({ error: err.message || 'PubChem lookup failed' }, 500);
    }
  }

  return json({ error: 'Provide either cid or name parameter' }, 400);
}
