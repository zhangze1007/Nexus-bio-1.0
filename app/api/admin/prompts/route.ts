/**
 * Admin Prompt Versioning API
 *
 * GET    /api/admin/prompts?toolId=...     — List prompt versions for a tool
 * POST   /api/admin/prompts                — Create a new prompt version
 * PATCH  /api/admin/prompts                — Activate a prompt version by ID
 *
 * Requires Node.js runtime (libsql client).
 */

import { NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';
import {
  createPromptVersion,
  getActivePrompt,
  listPromptVersions,
  activatePrompt,
} from '../../../../src/services/ml/promptVersioning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * GET /api/admin/prompts?toolId=...
 *
 * Lists all prompt versions for the given toolId.
 * If no toolId is provided, returns a 400 error.
 */
export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const url = new URL(req.url);
    const toolId = url.searchParams.get('toolId');

    if (!toolId || toolId.trim().length === 0) {
      return NextResponse.json(
        { error: 'toolId query parameter is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    const versions = await listPromptVersions(toolId.trim());
    const active = await getActivePrompt(toolId.trim());

    return NextResponse.json(
      { ok: true, toolId: toolId.trim(), versions, active },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}

/**
 * POST /api/admin/prompts
 *
 * Creates a new prompt version.
 * Body: { toolId: string, template: string, version: string }
 */
export async function POST(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { toolId, template, version } = body as {
      toolId?: string;
      template?: string;
      version?: string;
    };

    if (!toolId || typeof toolId !== 'string' || toolId.trim().length === 0) {
      return NextResponse.json(
        { error: 'toolId is required and must be a non-empty string' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!template || typeof template !== 'string' || template.trim().length === 0) {
      return NextResponse.json(
        { error: 'template is required and must be a non-empty string' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!version || typeof version !== 'string' || version.trim().length === 0) {
      return NextResponse.json(
        { error: 'version is required and must be a non-empty string' },
        { status: 400, headers: corsHeaders },
      );
    }

    const created = await createPromptVersion(toolId.trim(), template, version.trim());

    return NextResponse.json(
      { ok: true, promptVersion: created },
      { status: 201, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}

/**
 * PATCH /api/admin/prompts
 *
 * Activates a prompt version by ID (deactivates all others for the same tool).
 * Body: { versionId: string }
 */
export async function PATCH(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { versionId } = body as { versionId?: string };

    if (!versionId || typeof versionId !== 'string' || versionId.trim().length === 0) {
      return NextResponse.json(
        { error: 'versionId is required and must be a non-empty string' },
        { status: 400, headers: corsHeaders },
      );
    }

    await activatePrompt(versionId.trim());

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: corsHeaders },
    );
  }
}
