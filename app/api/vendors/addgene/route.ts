import { type NextRequest, NextResponse } from 'next/server';
import { searchAddgene } from '../../../../src/services/vendors/vendorService';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';
import { errorResponse } from '../../../../src/utils/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * GET /api/vendors/addgene?q=<query>
 *
 * Search Addgene's plasmid catalog. Returns up to 25 results.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return errorResponse('Missing required query parameter: q', 400, undefined, getCorsHeaders(req));
  }

  if (query.trim().length > 200) {
    return errorResponse('Query too long (max 200 characters)', 400, undefined, getCorsHeaders(req));
  }

  try {
    const results = await searchAddgene(query);
    return NextResponse.json(
      { ok: true, results, count: results.length },
      { headers: getCorsHeaders(req) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Addgene search failed';
    return errorResponse(message, 502, undefined, getCorsHeaders(req));
  }
}
