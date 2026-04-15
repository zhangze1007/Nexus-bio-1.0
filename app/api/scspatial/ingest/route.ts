import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { buildScSpatialQueryResponse } from '../../../../src/server/scspatialAnalysis';
import { writeScSpatialArtifact } from '../../../../src/server/scspatialArtifactStore';
import { createDemoScSpatialArtifact } from '../../../../src/server/scspatialDemo';
import { runScSpatialSidecar } from '../../../../src/server/scspatialSidecar';
import type { ScSpatialIngestConfig, ScSpatialQueryRequest, ScSpatialViewMode } from '../../../../src/types/scspatial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(error: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error, detail }, { status });
}

function parseConfig(raw: FormDataEntryValue | null): ScSpatialIngestConfig {
  if (typeof raw !== 'string' || raw.trim().length === 0) return {};
  const parsed = JSON.parse(raw) as ScSpatialIngestConfig;
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function defaultViewMode(hasSpatial: boolean): ScSpatialViewMode {
  return hasSpatial ? 'spatial-2d' : 'table';
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null);
      if (body?.mode !== 'demo') {
        return jsonError('Expected multipart h5ad upload or JSON body {"mode":"demo"}');
      }

      const artifact = createDemoScSpatialArtifact();
      await writeScSpatialArtifact(artifact);
      const initialQuery = buildScSpatialQueryResponse(artifact, {
        artifactId: artifact.artifactId,
        selectedGene: '',
        selectedCluster: null,
        selectedCellId: null,
        viewMode: defaultViewMode(artifact.metadata.hasSpatialCoords),
        developerMode: false,
      });
      return NextResponse.json({
        ok: true,
        artifactId: artifact.artifactId,
        validity: initialQuery.validity,
        datasetMeta: initialQuery.datasetMeta,
        initialQuery,
      });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return jsonError('A .h5ad file is required under the "file" field');
    }
    if (!file.name.toLowerCase().endsWith('.h5ad')) {
      return jsonError('SCSPATIAL ingest only accepts .h5ad uploads');
    }

    const config = parseConfig(formData.get('config'));
    const artifactId = `scspatial-${randomUUID()}`;
    const uploadedAt = Date.now();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'scspatial-'));
    const tempFilePath = path.join(tempDir, file.name);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(tempFilePath, buffer);
      const artifact = await runScSpatialSidecar({
        artifactId,
        filePath: tempFilePath,
        fileName: file.name,
        uploadedAt,
        config,
      });
      await writeScSpatialArtifact(artifact);
      const initialQueryRequest: ScSpatialQueryRequest = {
        artifactId: artifact.artifactId,
        selectedGene: '',
        selectedCluster: null,
        selectedCellId: null,
        viewMode: defaultViewMode(artifact.metadata.hasSpatialCoords),
        developerMode: false,
      };
      const initialQuery = buildScSpatialQueryResponse(artifact, initialQueryRequest);
      return NextResponse.json({
        ok: true,
        artifactId: artifact.artifactId,
        validity: initialQuery.validity,
        datasetMeta: initialQuery.datasetMeta,
        initialQuery,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    return jsonError(
      'SCSPATIAL ingest failed',
      500,
      error instanceof Error ? error.message : 'Unknown SCSPATIAL ingest failure',
    );
  }
}
