import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ScSpatialIngestConfig, ScSpatialNormalizedArtifact } from '../types/scspatial';

const execFileAsync = promisify(execFile);
const SIDECAR_MAX_BUFFER = 1024 * 1024 * 128;
const LOCAL_PYTHON_TARGET = path.join(process.cwd(), '.nexus', 'scspatial-pydeps');

interface SidecarOptions {
  artifactId: string;
  filePath: string;
  fileName: string;
  uploadedAt: number;
  config: ScSpatialIngestConfig;
}

function resolvePythonCandidates() {
  const configured = process.env.SCSPATIAL_PYTHON_BIN?.trim();
  if (configured) return [configured];

  const localCandidates = [
    path.join(process.cwd(), '.venv-scspatial', 'bin', 'python'),
    path.join(process.cwd(), '.venv', 'bin', 'python'),
  ].filter((candidate) => existsSync(candidate));

  return [...localCandidates, 'python3', 'python'];
}

function resolveSidecarPath() {
  return path.join(process.cwd(), 'src', 'server', 'scspatial_sidecar.py');
}

function resolveSidecarPythonPath() {
  if (!existsSync(LOCAL_PYTHON_TARGET)) {
    return process.env.PYTHONPATH;
  }
  return process.env.PYTHONPATH
    ? `${LOCAL_PYTHON_TARGET}${path.delimiter}${process.env.PYTHONPATH}`
    : LOCAL_PYTHON_TARGET;
}

export async function runScSpatialSidecar({
  artifactId,
  filePath,
  fileName,
  uploadedAt,
  config,
}: SidecarOptions): Promise<ScSpatialNormalizedArtifact> {
  const sidecarPath = resolveSidecarPath();
  const payload = Buffer.from(JSON.stringify({
    artifactId,
    fileName,
    uploadedAt,
    config,
  })).toString('base64url');

  let lastError: Error | null = null;
  for (const pythonBin of resolvePythonCandidates()) {
    try {
      const { stdout } = await execFileAsync(
        pythonBin,
        [sidecarPath, filePath, payload],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            PYTHONPATH: resolveSidecarPythonPath(),
          },
          maxBuffer: SIDECAR_MAX_BUFFER,
        },
      );
      const parsed = JSON.parse(stdout) as ScSpatialNormalizedArtifact;
      if (!parsed?.artifactId || parsed.schemaVersion !== 1) {
        throw new Error('Sidecar returned an invalid normalized artifact payload');
      }
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown SCSPATIAL sidecar failure');
    }
  }

  throw new Error(
    lastError?.message
      ?? 'SCSPATIAL sidecar could not be executed. Set SCSPATIAL_PYTHON_BIN if Python is installed in a non-standard location.',
  );
}
