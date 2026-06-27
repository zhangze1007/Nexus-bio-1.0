import { type NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '../../../../src/utils/apiErrors';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';
import {
  getPage,
  getPageHistory,
  updatePage,
} from '../../../../src/services/knowledge/wikiService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * GET /api/wiki/[id]
 * Get a single wiki page by ID, including its revision history.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return errorResponse('Page id is required', 400, undefined, getCorsHeaders(_request));
  }

  const page = await getPage(id);
  if (!page) {
    return errorResponse('Page not found', 404, undefined, getCorsHeaders(_request));
  }

  const history = await getPageHistory(id);

  return NextResponse.json(
    { ok: true, page, history },
    { headers: getCorsHeaders(_request) },
  );
}

/**
 * PUT /api/wiki/[id]
 * Update a wiki page's content. Increments version and creates a revision.
 *
 * Body: { content, userId?, changeSummary? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return errorResponse('Page id is required', 400, undefined, getCorsHeaders(request));
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorResponse('Invalid request body', 400, undefined, getCorsHeaders(request));
  }

  const { content, userId, changeSummary } = body as Record<string, unknown>;

  if (typeof content !== 'string') {
    return errorResponse('content is required', 400, undefined, getCorsHeaders(request));
  }

  const updated = await updatePage(id, {
    content: content as string,
    userId: typeof userId === 'string' ? userId : undefined,
    changeSummary: typeof changeSummary === 'string' ? changeSummary : undefined,
  });

  if (!updated) {
    return errorResponse('Page not found', 404, undefined, getCorsHeaders(request));
  }

  return NextResponse.json({ ok: true, page: updated }, { headers: getCorsHeaders(request) });
}
