import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';

export const runtime = 'edge';

function getCors(req?: Request) {
  return {
    'Content-Type': 'text/plain',
    'Cache-Control': 'public, max-age=86400, s-maxage=604800', // 1 day browser, 7 days CDN
    ...getCorsHeaders(req),
  };
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get('cid');
  const name = req.nextUrl.searchParams.get('name');
  const properties = req.nextUrl.searchParams.get('properties');
  const suggest = req.nextUrl.searchParams.get('suggest');

  // ── Mode 0: autocomplete suggestions ──────────────────────────────
  if (suggest) {
    try {
      const res = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(suggest)}?limit=8`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (!res.ok) return NextResponse.json({ ok: true, suggestions: [] }, { headers: getCors(req) });
      const data = await res.json();
      const suggestions = (data.dictionary?.compound ?? []).map((item: { ci?: number; name?: string }) => ({
        cid: item.ci ?? 0,
        name: item.name ?? '',
      }));
      return NextResponse.json({ ok: true, suggestions }, { headers: getCors(req) });
    } catch {
      return NextResponse.json({ ok: true, suggestions: [] }, { headers: getCors(req) });
    }
  }

  // ── Mode 1: fetch SDF or properties by CID ────────────────────────
  if (cid) {
    if (!/^\d+$/.test(cid)) return errorResponse('Invalid CID', 400, undefined, getCors(req));

    // Mode 1b: fetch molecular properties as JSON
    if (properties === 'true') {
      try {
        const propUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`;
        const propRes = await fetch(propUrl, {
          headers: { 'User-Agent': 'NexusBio/1.0 (contact@nexus-bio.vercel.app)' },
        });
        if (!propRes.ok) return errorResponse(`No properties for CID ${cid}`, 404, undefined, getCors(req));
        const propData = await propRes.text();
        return new NextResponse(propData, {
          status: 200,
          headers: { ...getCors(req), 'Content-Type': 'application/json' },
        });
      } catch {
        return errorResponse(`Property fetch failed for CID ${cid}`, 502, undefined, getCors(req));
      }
    }

    // Mode 1a: fetch SDF (default)
    const attempts = [
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`,
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF`,
    ];

    for (const attemptUrl of attempts) {
      try {
        const res = await fetch(attemptUrl, {
          headers: { 'User-Agent': 'NexusBio/1.0 (contact@nexus-bio.vercel.app)' },
        });
        if (!res.ok) continue;
        const sdf = await res.text();
        if (!sdf || sdf.length < 30) continue;
        return new NextResponse(sdf, { status: 200, headers: getCors(req) });
      } catch { continue; }
    }

    return errorResponse(`No SDF found for CID ${cid}`, 404, undefined, getCors(req));
  }

  // ── Mode 2: search CID by name, then fetch SDF ────────────────────
  if (name) {
    const cleanName = name.trim().slice(0, 200);
    if (!cleanName) return errorResponse('Empty name', 400, undefined, getCors(req));

    try {
      // Step 1: resolve name → CID
      const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(cleanName)}/cids/JSON`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'NexusBio/1.0 (contact@nexus-bio.vercel.app)' },
      });

      if (!searchRes.ok) return errorResponse('Name not found in PubChem', 404, undefined, getCors(req));

      const searchData = await searchRes.json() as { IdentifierList?: { CID?: number[] } };
      const foundCid = searchData?.IdentifierList?.CID?.[0];
      if (!foundCid) return errorResponse('No CID found for this name', 404, undefined, getCors(req));

      // Step 2: fetch 3D SDF with found CID
      const sdfAttempts = [
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${foundCid}/SDF?record_type=3d`,
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${foundCid}/SDF`,
      ];

      for (const sdfUrl of sdfAttempts) {
        try {
          const sdfRes = await fetch(sdfUrl, {
            headers: { 'User-Agent': 'NexusBio/1.0 (contact@nexus-bio.vercel.app)' },
          });
          if (!sdfRes.ok) continue;
          const sdf = await sdfRes.text();
          if (!sdf || sdf.length < 30) continue;

          // Return SDF with CID in header so frontend knows what was found
          return new NextResponse(sdf, {
            status: 200,
            headers: { ...getCors(req), 'X-PubChem-CID': String(foundCid) },
          });
        } catch { continue; }
      }

      return errorResponse(`CID ${foundCid} found but no SDF available`, 404, undefined, getCors(req));

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'PubChem lookup failed';
      return errorResponse(message, 500, undefined, getCors(req));
    }
  }

  return errorResponse('Provide either cid or name parameter', 400, undefined, getCors(req));
}
