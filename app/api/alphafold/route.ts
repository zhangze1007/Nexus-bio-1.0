import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const MIN_VALID_PDB_LENGTH = 100;

export async function GET(req: NextRequest) {
  const headers = {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  };

  const uniprotId = req.nextUrl.searchParams.get('id');

  if (!uniprotId) {
    return new NextResponse('Missing id parameter', { status: 400, headers });
  }

  // Sanitize — only allow valid UniProt ID format
  if (!/^[A-Z0-9]{6,10}$/i.test(uniprotId)) {
    return new NextResponse('Invalid UniProt ID', { status: 400, headers });
  }

  try {
    // Strategy 1: Use the AlphaFold prediction API to get the current download URL
    const apiUrl = `https://alphafold.ebi.ac.uk/api/prediction/${uniprotId}`;
    const apiRes = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (apiRes.ok) {
      const entries = await apiRes.json();
      const entry = Array.isArray(entries) ? entries[0] : entries;
      const pdbUrl = entry?.pdbUrl;

      if (pdbUrl) {
        const pdbRes = await fetch(pdbUrl);
        if (pdbRes.ok) {
          const pdbData = await pdbRes.text();
          if (pdbData && pdbData.length > MIN_VALID_PDB_LENGTH) {
            return new NextResponse(pdbData, { status: 200, headers });
          }
        }
      }
    }

    // Strategy 2: Try the legacy direct file URL as fallback
    const legacyUrl = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
    const legacyRes = await fetch(legacyUrl);

    if (legacyRes.ok) {
      const pdbData = await legacyRes.text();
      if (pdbData && pdbData.length > MIN_VALID_PDB_LENGTH) {
        return new NextResponse(pdbData, { status: 200, headers });
      }
    }

    return new NextResponse(`AlphaFold structure not found for ${uniprotId}`, {
      status: 404, headers,
    });
  } catch (err: any) {
    return new NextResponse(`Fetch error: ${err.message}`, { status: 500, headers });
  }
}
