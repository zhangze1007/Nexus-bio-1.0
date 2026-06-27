import { type NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '../../../src/utils/apiErrors';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import {
  createPage,
  listPages,
} from '../../../src/services/knowledge/wikiService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * GET /api/wiki?projectId=...&category=...
 * List wiki pages for a project, optionally filtered by category.
 */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return errorResponse('projectId is required', 400, undefined, getCorsHeaders(request));
  }

  const category = request.nextUrl.searchParams.get('category') ?? undefined;
  const pages = await listPages(projectId, category);
  return NextResponse.json({ ok: true, pages }, { headers: getCorsHeaders(request) });
}

/**
 * POST /api/wiki
 * Create a new wiki page.
 *
 * Body: { projectId, title, content, category?, userId? }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorResponse('Invalid request body', 400, undefined, getCorsHeaders(request));
  }

  const { projectId, title, content, category, userId } = body as Record<string, unknown>;

  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    return errorResponse('projectId is required', 400, undefined, getCorsHeaders(request));
  }
  if (typeof title !== 'string' || title.trim().length === 0) {
    return errorResponse('title is required', 400, undefined, getCorsHeaders(request));
  }
  if (title.length > 500) {
    return errorResponse('title must be 500 characters or fewer', 400, undefined, getCorsHeaders(request));
  }
  if (typeof content !== 'string') {
    return errorResponse('content is required', 400, undefined, getCorsHeaders(request));
  }

  const page = await createPage({
    projectId: projectId as string,
    title: title as string,
    content: content as string,
    category: typeof category === 'string' ? category : undefined,
    userId: typeof userId === 'string' ? userId : undefined,
  });

  return NextResponse.json({ ok: true, page }, { status: 201, headers: getCorsHeaders(request) });
}
