import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ScSpatialNormalizedArtifact } from '../types/scspatial';

const LOCAL_STORE_DIR = path.join(process.cwd(), '.nexus', 'scspatial-artifacts');
const SERVERLESS_STORE_DIR = path.join('/tmp', '.nexus', 'scspatial-artifacts');

function resolveStoreDir() {
  return process.env.SCSPATIAL_ARTIFACT_DIR
    ?? (process.env.VERCEL ? SERVERLESS_STORE_DIR : LOCAL_STORE_DIR);
}

function resolveArtifactPath(artifactId: string) {
  return path.join(resolveStoreDir(), `${artifactId}.json`);
}

export async function writeScSpatialArtifact(artifact: ScSpatialNormalizedArtifact) {
  const storeDir = resolveStoreDir();
  await mkdir(storeDir, { recursive: true });
  await writeFile(resolveArtifactPath(artifact.artifactId), JSON.stringify(artifact), 'utf8');
}

export async function readScSpatialArtifact(artifactId: string) {
  try {
    const raw = await readFile(resolveArtifactPath(artifactId), 'utf8');
    return JSON.parse(raw) as ScSpatialNormalizedArtifact;
  } catch {
    return null;
  }
}
