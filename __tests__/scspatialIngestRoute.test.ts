/** @jest-environment node */

// Mock the server-side modules
jest.mock('../src/server/scspatialAnalysis', () => ({
  buildScSpatialQueryResponse: jest.fn(() => ({
    validity: 'demo',
    datasetMeta: { cellCount: 100, geneCount: 50 },
    centerView: { points: [] },
    rightPanel: { clusterSummaries: [] },
  })),
}));

jest.mock('../src/server/scspatialArtifactStore', () => ({
  writeScSpatialArtifact: jest.fn(async () => {}),
}));

jest.mock('../src/server/scspatialDemo', () => ({
  createDemoScSpatialArtifact: jest.fn(() => ({
    schemaVersion: 1,
    artifactId: 'demo-123',
    source: { fileName: 'demo.h5ad', uploadedAt: Date.now(), sampleCount: 10, parserVersion: '1.0' },
    metadata: { hasSpatialCoords: true, warnings: [], missingFields: [] },
  })),
}));

jest.mock('../src/server/scspatialSidecar', () => ({
  runScSpatialSidecar: jest.fn(async () => ({
    schemaVersion: 1,
    artifactId: 'scspatial-123',
    source: { fileName: 'test.h5ad', uploadedAt: Date.now(), sampleCount: 10, parserVersion: '1.0' },
    metadata: { hasSpatialCoords: true, warnings: [], missingFields: [] },
  })),
}));

// Mock fs/promises
jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn(async () => '/tmp/scspatial-test/'),
  writeFile: jest.fn(async () => {}),
  rm: jest.fn(async () => {}),
}));

import { POST } from '../app/api/scspatial/ingest/route';

describe('scspatial ingest POST — demo mode', () => {
  it('accepts JSON body with mode "demo"', async () => {
    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'demo' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.artifactId).toBe('demo-123');
    expect(data.validity).toBeDefined();
    expect(data.datasetMeta).toBeDefined();
    expect(data.initialQuery).toBeDefined();
  });

  it('rejects JSON body without mode "demo"', async () => {
    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'upload' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain('demo');
  });

  it('rejects JSON body with no mode field', async () => {
    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('rejects invalid JSON body', async () => {
    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('scspatial ingest POST — file upload validation', () => {
  it('rejects form data without file', async () => {
    const formData = new FormData();
    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('file');
  });

  it('rejects non-.h5ad file', async () => {
    const formData = new FormData();
    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    formData.append('file', file);

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('.h5ad');
  });

  it('accepts .h5ad file upload', async () => {
    const formData = new FormData();
    const file = new File(['test h5ad content'], 'experiment.h5ad', { type: 'application/octet-stream' });
    formData.append('file', file);

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.artifactId).toBeDefined();
  });

  it('accepts .h5ad file with config', async () => {
    const formData = new FormData();
    const file = new File(['test h5ad content'], 'experiment.h5ad', { type: 'application/octet-stream' });
    formData.append('file', file);
    formData.append('config', JSON.stringify({ clusterKey: 'leiden', cellTypeKey: 'cell_type' }));

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.ok).toBe(true);
  });

  it('handles .H5AD extension (case insensitive)', async () => {
    const formData = new FormData();
    const file = new File(['test'], 'experiment.H5AD', { type: 'application/octet-stream' });
    formData.append('file', file);

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });
});

describe('scspatial ingest POST — parseConfig helper', () => {
  it('returns empty object for null config', async () => {
    const formData = new FormData();
    const file = new File(['test'], 'test.h5ad', { type: 'application/octet-stream' });
    formData.append('file', file);
    // No config field

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    // Should succeed with default config
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns empty object for empty string config', async () => {
    const formData = new FormData();
    const file = new File(['test'], 'test.h5ad', { type: 'application/octet-stream' });
    formData.append('file', file);
    formData.append('config', '');

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns empty object for whitespace-only config', async () => {
    const formData = new FormData();
    const file = new File(['test'], 'test.h5ad', { type: 'application/octet-stream' });
    formData.append('file', file);
    formData.append('config', '   ');

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });
});

describe('scspatial ingest POST — error handling', () => {
  it('returns 500 when sidecar throws', async () => {
    const { runScSpatialSidecar } = require('../src/server/scspatialSidecar');
    runScSpatialSidecar.mockRejectedValueOnce(new Error('Python module not found'));

    const formData = new FormData();
    const file = new File(['test'], 'test.h5ad', { type: 'application/octet-stream' });
    formData.append('file', file);

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain('SCSPATIAL ingest failed');
    expect(data.detail).toContain('Python module not found');
  });

  it('handles non-Error exceptions', async () => {
    const { runScSpatialSidecar } = require('../src/server/scspatialSidecar');
    runScSpatialSidecar.mockRejectedValueOnce('string error');

    const formData = new FormData();
    const file = new File(['test'], 'test.h5ad', { type: 'application/octet-stream' });
    formData.append('file', file);

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.detail).toBe('Unknown SCSPATIAL ingest failure');
  });
});

describe('scspatial ingest POST — defaultViewMode', () => {
  it('returns spatial-2d when hasSpatialCoords is true', async () => {
    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'demo' }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);
    // The demo artifact has hasSpatialCoords: true, so viewMode should be spatial-2d
  });

  it('returns table when hasSpatialCoords is false', async () => {
    const { createDemoScSpatialArtifact } = require('../src/server/scspatialDemo');
    createDemoScSpatialArtifact.mockReturnValueOnce({
      schemaVersion: 1,
      artifactId: 'demo-nospatial',
      source: { fileName: 'demo.h5ad', uploadedAt: Date.now(), sampleCount: 10, parserVersion: '1.0' },
      metadata: { hasSpatialCoords: false, warnings: [], missingFields: [] },
    });

    const request = new Request('http://localhost:3000/api/scspatial/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'demo' }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });
});
