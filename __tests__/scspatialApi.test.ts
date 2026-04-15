/** @jest-environment node */

import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { POST as ingestPost } from '../app/api/scspatial/ingest/route';
import { POST as queryPost } from '../app/api/scspatial/query/route';
import { writeScSpatialArtifact } from '../src/server/scspatialArtifactStore';
import { createDemoScSpatialArtifact } from '../src/server/scspatialDemo';

describe('SCSPATIAL API routes', () => {
  let artifactDir = '';

  beforeEach(async () => {
    artifactDir = await mkdtemp(path.join(tmpdir(), 'scspatial-api-'));
    process.env.SCSPATIAL_ARTIFACT_DIR = artifactDir;
  });

  afterEach(async () => {
    delete process.env.SCSPATIAL_ARTIFACT_DIR;
    if (artifactDir) {
      await rm(artifactDir, { recursive: true, force: true });
    }
  });

  it('returns a demo ingest payload with an initial query', async () => {
    const response = await ingestPost(new Request('http://localhost/api/scspatial/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ mode: 'demo' }),
    }));

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.validity).toBe('demo');
    expect(body.initialQuery.artifactId).toBe(body.artifactId);
    expect(body.datasetMeta.fileName).toBe('bundled-demo.h5ad');
  });

  it('returns query results for a persisted normalized artifact', async () => {
    const artifact = createDemoScSpatialArtifact();
    await writeScSpatialArtifact(artifact);

    const response = await queryPost(new Request('http://localhost/api/scspatial/query', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        artifactId: artifact.artifactId,
        selectedGene: '',
        selectedCluster: null,
        selectedCellId: null,
        viewMode: 'spatial-2d',
        developerMode: false,
      }),
    }));

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.artifactId).toBe(artifact.artifactId);
    expect(body.centerView.mode).toBe('spatial-2d');
    expect(body.rightPanel.provenance.validity).toBe('demo');
  });
});
