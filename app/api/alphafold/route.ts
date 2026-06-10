import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';

export const runtime = 'edge';

const MIN_VALID_PDB_LENGTH = 100;

/** Whitelist of domains we're allowed to fetch PDB data from (SSRF prevention). */
const ALLOWED_PDB_HOSTS = new Set([
  'alphafold.ebi.ac.uk',
  'www.rcsb.org',
  'files.rcsb.org',
]);

function isAllowedPdbUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return url.protocol === 'https:' && ALLOWED_PDB_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    'Cache-Control': 'public, max-age=86400, s-maxage=604800', // 1 day browser, 7 days CDN
    ...getCorsHeaders(req),
  };

  const uniprotId = req.nextUrl.searchParams.get('id');

  if (!uniprotId) {
    return errorResponse('Missing id parameter', 400, undefined, getCorsHeaders(req));
  }

  // Sanitize — only allow valid UniProt ID format
  if (!/^[A-Z0-9]{6,10}$/i.test(uniprotId)) {
    return errorResponse('Invalid UniProt ID', 400, undefined, getCorsHeaders(req));
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

      if (pdbUrl && isAllowedPdbUrl(pdbUrl)) {
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

    return errorResponse(`AlphaFold structure not found for ${uniprotId}`, 404, undefined, getCorsHeaders(req));
  } catch (err: unknown) {
    console.error('AlphaFold fetch error:', err);
    return errorResponse('AlphaFold structure fetch failed', 500, undefined, getCorsHeaders(req));
  }
}
