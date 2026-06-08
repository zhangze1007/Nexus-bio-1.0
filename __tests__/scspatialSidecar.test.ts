/** @jest-environment node */

const mockExecFileAsync = jest.fn();

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('node:util', () => ({
  promisify: jest.fn(() => mockExecFileAsync),
}));

jest.mock('node:fs', () => ({
  existsSync: jest.fn(() => false),
}));

import { runScSpatialSidecar } from '../src/server/scspatialSidecar';

// The module has 2 python candidates when no venv exists and no SCSPATIAL_PYTHON_BIN:
// ['python3', 'python']
// Each iteration of the loop calls execFileAsync once.
// If the first call fails (error or invalid output), the loop continues to the next candidate.

function makeValidArtifact(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    artifactId: 'test-123',
    source: { fileName: 'test.h5ad', uploadedAt: Date.now(), sampleCount: 10, parserVersion: '1.0' },
    metadata: { hasSpatialCoords: true, warnings: [], missingFields: [] },
    ...overrides,
  };
}

describe('scspatialSidecar — runScSpatialSidecar', () => {
  beforeEach(() => {
    mockExecFileAsync.mockReset();
  });

  it('returns parsed artifact when sidecar succeeds on first candidate', async () => {
    mockExecFileAsync.mockResolvedValueOnce({ stdout: JSON.stringify(makeValidArtifact()) });

    const result = await runScSpatialSidecar({
      artifactId: 'test-123',
      filePath: '/tmp/test.h5ad',
      fileName: 'test.h5ad',
      uploadedAt: Date.now(),
      config: {},
    });

    expect(result.schemaVersion).toBe(1);
    expect(result.artifactId).toBe('test-123');
  });

  it('throws when sidecar returns invalid schemaVersion (both candidates fail)', async () => {
    // Both candidates return invalid artifact
    const invalid = JSON.stringify({ schemaVersion: 2, artifactId: 'test-123' });
    mockExecFileAsync
      .mockResolvedValueOnce({ stdout: invalid })
      .mockResolvedValueOnce({ stdout: invalid });

    await expect(
      runScSpatialSidecar({
        artifactId: 'test-123',
        filePath: '/tmp/test.h5ad',
        fileName: 'test.h5ad',
        uploadedAt: Date.now(),
        config: {},
      }),
    ).rejects.toThrow('invalid normalized artifact');
  });

  it('throws when sidecar returns missing artifactId (both candidates fail)', async () => {
    const invalid = JSON.stringify({ schemaVersion: 1, artifactId: '' });
    mockExecFileAsync
      .mockResolvedValueOnce({ stdout: invalid })
      .mockResolvedValueOnce({ stdout: invalid });

    await expect(
      runScSpatialSidecar({
        artifactId: 'test-123',
        filePath: '/tmp/test.h5ad',
        fileName: 'test.h5ad',
        uploadedAt: Date.now(),
        config: {},
      }),
    ).rejects.toThrow('invalid normalized artifact');
  });

  it('throws when sidecar returns null artifactId (both candidates fail)', async () => {
    const invalid = JSON.stringify({ schemaVersion: 1, artifactId: null });
    mockExecFileAsync
      .mockResolvedValueOnce({ stdout: invalid })
      .mockResolvedValueOnce({ stdout: invalid });

    await expect(
      runScSpatialSidecar({
        artifactId: 'test-123',
        filePath: '/tmp/test.h5ad',
        fileName: 'test.h5ad',
        uploadedAt: Date.now(),
        config: {},
      }),
    ).rejects.toThrow('invalid normalized artifact');
  });

  it('throws when sidecar returns invalid JSON (both candidates fail)', async () => {
    mockExecFileAsync
      .mockResolvedValueOnce({ stdout: 'not json' })
      .mockResolvedValueOnce({ stdout: 'not json' });

    await expect(
      runScSpatialSidecar({
        artifactId: 'test-123',
        filePath: '/tmp/test.h5ad',
        fileName: 'test.h5ad',
        uploadedAt: Date.now(),
        config: {},
      }),
    ).rejects.toThrow();
  });

  it('throws when execFile fails with Error (both candidates fail)', async () => {
    mockExecFileAsync
      .mockRejectedValueOnce(new Error('python3 not found'))
      .mockRejectedValueOnce(new Error('python not found'));

    await expect(
      runScSpatialSidecar({
        artifactId: 'test-123',
        filePath: '/tmp/test.h5ad',
        fileName: 'test.h5ad',
        uploadedAt: Date.now(),
        config: {},
      }),
    ).rejects.toThrow('python not found');
  });

  it('wraps non-Error exceptions (both candidates fail)', async () => {
    mockExecFileAsync
      .mockRejectedValueOnce('string error')
      .mockRejectedValueOnce('string error');

    await expect(
      runScSpatialSidecar({
        artifactId: 'test-123',
        filePath: '/tmp/test.h5ad',
        fileName: 'test.h5ad',
        uploadedAt: Date.now(),
        config: {},
      }),
    ).rejects.toThrow('Unknown SCSPATIAL sidecar failure');
  });

  it('tries multiple python candidates and succeeds on second', async () => {
    mockExecFileAsync
      .mockRejectedValueOnce(new Error('python3 not found'))
      .mockResolvedValueOnce({
        stdout: JSON.stringify(makeValidArtifact({ artifactId: 'test-456' })),
      });

    const result = await runScSpatialSidecar({
      artifactId: 'test-456',
      filePath: '/tmp/test.h5ad',
      fileName: 'test.h5ad',
      uploadedAt: Date.now(),
      config: {},
    });

    expect(result.artifactId).toBe('test-456');
    expect(mockExecFileAsync).toHaveBeenCalledTimes(2);
  });

  it('calls execFile with correct arguments', async () => {
    mockExecFileAsync.mockResolvedValueOnce({
      stdout: JSON.stringify(makeValidArtifact({ artifactId: 'test-args' })),
    });

    await runScSpatialSidecar({
      artifactId: 'test-args',
      filePath: '/tmp/upload/my_file.h5ad',
      fileName: 'my_file.h5ad',
      uploadedAt: 12345,
      config: { clusterKey: 'leiden' },
    });

    expect(mockExecFileAsync).toHaveBeenCalledTimes(1);
    const [pythonBin, args, opts] = mockExecFileAsync.mock.calls[0];
    expect(typeof pythonBin).toBe('string');
    expect(args).toHaveLength(3);
    expect(args[1]).toBe('/tmp/upload/my_file.h5ad');
    expect(opts.maxBuffer).toBe(1024 * 1024 * 128);
    expect(opts.cwd).toBeDefined();
    expect(opts.env).toBeDefined();
  });

  it('base64url encodes the payload', async () => {
    mockExecFileAsync.mockResolvedValueOnce({
      stdout: JSON.stringify(makeValidArtifact({ artifactId: 'test-payload' })),
    });

    await runScSpatialSidecar({
      artifactId: 'test-payload',
      filePath: '/tmp/test.h5ad',
      fileName: 'test.h5ad',
      uploadedAt: 999,
      config: { clusterKey: 'test_key' },
    });

    const [, args] = mockExecFileAsync.mock.calls[0];
    const payload = args[2];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    expect(decoded.artifactId).toBe('test-payload');
    expect(decoded.config.clusterKey).toBe('test_key');
    expect(decoded.fileName).toBe('test.h5ad');
    expect(decoded.uploadedAt).toBe(999);
  });

  it('passes environment variables to execFile', async () => {
    mockExecFileAsync.mockResolvedValueOnce({
      stdout: JSON.stringify(makeValidArtifact()),
    });

    await runScSpatialSidecar({
      artifactId: 'test-env',
      filePath: '/tmp/test.h5ad',
      fileName: 'test.h5ad',
      uploadedAt: Date.now(),
      config: {},
    });

    const [, , opts] = mockExecFileAsync.mock.calls[0];
    expect(opts.env).toBeDefined();
    expect(typeof opts.env).toBe('object');
  });

  it('first candidate is python3 when no venv', async () => {
    mockExecFileAsync.mockResolvedValueOnce({
      stdout: JSON.stringify(makeValidArtifact()),
    });

    await runScSpatialSidecar({
      artifactId: 'test-bin',
      filePath: '/tmp/test.h5ad',
      fileName: 'test.h5ad',
      uploadedAt: Date.now(),
      config: {},
    });

    const [pythonBin] = mockExecFileAsync.mock.calls[0];
    expect(pythonBin).toBe('python3');
  });
});
