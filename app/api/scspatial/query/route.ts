import { NextResponse } from 'next/server';
import { buildScSpatialQueryResponse } from '../../../../src/server/scspatialAnalysis';
import { readScSpatialArtifact } from '../../../../src/server/scspatialArtifactStore';
import type { ScSpatialQueryRequest, ScSpatialViewMode } from '../../../../src/types/scspatial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, detail }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return jsonError('Invalid SCSPATIAL query payload');
  }

  const artifactId = asString((body as Record<string, unknown>).artifactId);
  if (!artifactId) {
    return jsonError('artifactId is required');
  }

  const artifact = await readScSpatialArtifact(artifactId);
  if (!artifact) {
    return jsonError('SCSPATIAL artifact not found', 404);
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

    return NextResponse.json({ ok: true, ...query });
  } catch (error) {
    return jsonError(
      'SCSPATIAL query failed',
      500,
      error instanceof Error ? error.message : 'Unknown SCSPATIAL query failure',
    );
  }
}
