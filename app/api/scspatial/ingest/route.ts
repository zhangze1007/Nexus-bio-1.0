import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { buildScSpatialQueryResponse } from '../../../../src/server/scspatialAnalysis';
import { writeScSpatialArtifact } from '../../../../src/server/scspatialArtifactStore';
import { createDemoScSpatialArtifact } from '../../../../src/server/scspatialDemo';
import { runScSpatialSidecar } from '../../../../src/server/scspatialSidecar';
import type { ScSpatialIngestConfig, ScSpatialNormalizedArtifact, ScSpatialQueryRequest, ScSpatialViewMode } from '../../../../src/types/scspatial';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Python backend URL (set via SCSPATIAL_PYTHON_BACKEND env var). */
const PYTHON_BACKEND = process.env.SCSPATIAL_PYTHON_BACKEND?.replace(/\/+$/, '') || '';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

function jsonError(error: string, status = 400, detail?: string, req?: Request) {
  return NextResponse.json({ ok: false, error, detail }, { status, headers: getCorsHeaders(req) });
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
    // ── Demo mode (JSON) — always handled locally ──────────────────
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null);
      if (body?.mode !== 'demo') {
        return jsonError('Expected multipart h5ad upload or JSON body {"mode":"demo"}', 400, undefined, request);
      }

      // If Python backend is available, use its demo endpoint
      if (PYTHON_BACKEND) {
        try {
          const resp = await fetch(`${PYTHON_BACKEND}/demo`, { method: 'POST' });
          if (resp.ok) {
            const data = await resp.json();
            // Fetch the full artifact via the query endpoint
            const queryResp = await fetch(`${PYTHON_BACKEND}/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                artifactId: data.artifactId,
                selectedGene: '',
                selectedCluster: null,
                selectedCellId: null,
                viewMode: 'spatial-2d',
                developerMode: false,
              }),
            });
            if (queryResp.ok) {
              const queryData = await queryResp.json();
              return NextResponse.json({
                ok: true,
                artifactId: data.artifactId,
                validity: queryData.validity,
                datasetMeta: queryData.datasetMeta,
                initialQuery: queryData,
              }, { headers: getCorsHeaders(request) });
            }
          }
        } catch {
          // Fall through to local demo
        }
      }

      // Local demo fallback
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
      }, { headers: getCorsHeaders(request) });
    }

    // ── File upload — proxy to Python backend if available ─────────
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return jsonError('A file is required under the "file" field', 400, undefined, request);
    }
    const fnameLower = file.name.toLowerCase();
    if (!fnameLower.endsWith('.h5ad') && !fnameLower.endsWith('.zip')) {
      return jsonError('SCSPATIAL ingest accepts .h5ad files or .zip (Space Ranger output)', 400, undefined, request);
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_FILE_SIZE) {
      return jsonError(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 50 MB.`,
        413,
        undefined,
        request,
      );
    }

    const config = parseConfig(formData.get('config'));
    const artifactId = `scspatial-${randomUUID()}`;
    const uploadedAt = Date.now();
    const safeFileName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');

    // ── Proxy to Python backend (sidecar: anndata parsing only) ───
    if (PYTHON_BACKEND) {
      try {
        const pyForm = new FormData();
        pyForm.append('file', file);
        pyForm.append('config', JSON.stringify(config));
        pyForm.append('artifactId', artifactId);
        pyForm.append('fileName', safeFileName);
        pyForm.append('uploadedAt', String(uploadedAt));

        const resp = await fetch(`${PYTHON_BACKEND}/ingest-sidecar`, {
          method: 'POST',
          body: pyForm,
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error('Python backend ingest-sidecar error:', errText);
          return jsonError('Python backend analysis failed', 502, undefined, request);
        }

        const artifact = await resp.json() as ScSpatialNormalizedArtifact;
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
        }, { headers: getCorsHeaders(request) });
      } catch (err) {
        console.error('Python backend unreachable:', err);
        return jsonError('Python analysis backend is unavailable', 502, undefined, request);
      }
    }

    // ── Fallback: local sidecar ────────────────────────────────────
    const tempDir = await mkdtemp(path.join(tmpdir(), 'scspatial-'));
    const tempFilePath = path.join(tempDir, safeFileName);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(tempFilePath, buffer);
      const artifact = await runScSpatialSidecar({
        artifactId,
        filePath: tempFilePath,
        fileName: safeFileName,
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
      }, { headers: getCorsHeaders(request) });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('SCSPATIAL ingest error:', error);
    return jsonError(
      'SCSPATIAL ingest failed',
      500,
      undefined,
      request,
    );
  }
}
