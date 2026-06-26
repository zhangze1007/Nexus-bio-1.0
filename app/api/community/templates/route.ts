import { type NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '../../../../src/utils/apiErrors';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';
import {
  listTemplates,
  publishTemplate,
} from '../../../../src/services/community/templateService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * GET /api/community/templates?category=...
 * List public community templates, optionally filtered by category.
 */
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') ?? undefined;
  const templates = await listTemplates(category);
  return NextResponse.json({ ok: true, templates }, { headers: getCorsHeaders(request) });
}

/**
 * POST /api/community/templates
 * Publish a new community template.
 *
 * Body: { name, description, category, project_data, is_public?, author_id }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorResponse('Invalid request body', 400, undefined, getCorsHeaders(request));
  }

  const { name, description, category, project_data, is_public, author_id } = body as Record<
    string,
    unknown
  >;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return errorResponse('name is required', 400, undefined, getCorsHeaders(request));
  }
  if (typeof author_id !== 'string' || author_id.trim().length === 0) {
    return errorResponse('author_id is required', 400, undefined, getCorsHeaders(request));
  }
  if (name.length > 200) {
    return errorResponse('name must be 200 characters or fewer', 400, undefined, getCorsHeaders(request));
  }
  if (typeof description === 'string' && description.length > 2000) {
    return errorResponse(
      'description must be 2000 characters or fewer',
      400,
      undefined,
      getCorsHeaders(request),
    );
  }

  const template = await publishTemplate(author_id as string, {
    name: name as string,
    description: typeof description === 'string' ? description : '',
    category: typeof category === 'string' ? category : 'general',
    project_data:
      project_data && typeof project_data === 'object'
        ? (project_data as Record<string, unknown>)
        : {},
    is_public: is_public === false ? false : true,
  });

  return NextResponse.json({ ok: true, template }, { status: 201, headers: getCorsHeaders(request) });
}
