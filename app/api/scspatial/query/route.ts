import { NextResponse } from 'next/server';
import { buildScSpatialQueryResponse } from '../../../../src/server/scspatialAnalysis';
import { readScSpatialArtifact } from '../../../../src/server/scspatialArtifactStore';
import type { ScSpatialQueryRequest, ScSpatialViewMode } from '../../../../src/types/scspatial';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Python backend URL (set via SCSPATIAL_PYTHON_BACKEND env var). */
const PYTHON_BACKEND = process.env.SCSPATIAL_PYTHON_BACKEND?.replace(/\/+$/, '') || '';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

const VIEW_MODES = new Set<ScSpatialViewMode>([
  'spatial-2d',
  'spatial-3d',
  'umap',
  'trajectory',
  'table',
]);

function asViewMode(value: unknown): ScSpatialViewMode {
  return typeof value === 'string' && VIEW_MODES.has(value as ScSpatialViewMode)
    ? value as ScSpatialViewMode
    : 'table';
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function jsonError(error: string, status = 400, detail?: string, req?: Request) {
  return NextResponse.json({ ok: false, error, detail }, { status, headers: getCorsHeaders(req) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return jsonError('Invalid SCSPATIAL query payload', 400, undefined, request);
  }

  const artifactId = asString((body as Record<string, unknown>).artifactId);
  if (!artifactId) {
    return jsonError('artifactId is required', 400, undefined, request);
  }

  // ── Proxy to Python backend ──────────────────────────────────────
  if (PYTHON_BACKEND) {
    try {
      const resp = await fetch(`${PYTHON_BACKEND}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        const data = await resp.json();
        return NextResponse.json({ ok: true, ...data }, { headers: getCorsHeaders(request) });
      }

      // If artifact not found on Python side, fall through to local
      if (resp.status !== 404) {
        const errText = await resp.text();
        console.error('Python backend query error:', errText);
        return jsonError('Python backend query failed', 502, errText, request);
      }
    } catch (err) {
      console.error('Python backend unreachable for query:', err);
      // Fall through to local query
    }
  }

  // ── Fallback: local TypeScript engine ────────────────────────────
  const artifact = await readScSpatialArtifact(artifactId);
  if (!artifact) {
    return jsonError('SCSPATIAL artifact not found', 404, undefined, request);
  }

  try {
    const query = buildScSpatialQueryResponse(artifact, {
      artifactId,
      selectedGene: asString((body as Record<string, unknown>).selectedGene),
      selectedCluster: asNullableString((body as Record<string, unknown>).selectedCluster),
      selectedCellId: asNullableString((body as Record<string, unknown>).selectedCellId),
      viewMode: asViewMode((body as Record<string, unknown>).viewMode),
      developerMode: Boolean((body as Record<string, unknown>).developerMode),
    } satisfies ScSpatialQueryRequest);

    return NextResponse.json({ ok: true, ...query }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('SCSPATIAL query error:', error);
    return jsonError(
      'SCSPATIAL query failed',
      500,
      undefined,
      request,
    );
  }
}
