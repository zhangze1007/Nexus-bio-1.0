/**
 * ML Model Serving — Model Loader
 *
 * Singleton loader that lazily imports onnxruntime-web (~10-20 MB) and
 * caches InferenceSession instances per model ID. Follows the same
 * dynamic-import pattern used in src/services/vaeONNX.ts.
 */

import type { ModelMetadata } from "./types";

type OrtModule = Awaited<typeof import("onnxruntime-web")>;
// InferenceSession is a namespace with a static create() factory, not a class.
// The return type of create() is the session instance type.
type OrtSession = Awaited<ReturnType<OrtModule["InferenceSession"]["create"]>>;
let ort: OrtModule | null = null;

async function getOrt(): Promise<OrtModule> {
  if (!ort) {
    ort = await import("onnxruntime-web");
    // Single-threaded WASM — avoids SharedArrayBuffer / COOP/COEP requirements
    ort.env.wasm.numThreads = 1;
  }
  return ort;
}

// Cache of loaded InferenceSession instances keyed by model ID
const sessions = new Map<string, OrtSession>();

/**
 * Load (or return cached) ONNX InferenceSession for the given model.
 *
 * @throws {Error} if the .onnx file cannot be fetched or parsed
 */
export async function loadModel(model: ModelMetadata) {
  if (sessions.has(model.id)) {
    return sessions.get(model.id)!;
  }

  const runtime = await getOrt();

  const session = await runtime.InferenceSession.create(model.filePath, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  sessions.set(model.id, session);
  return session;
}

/**
 * Evict all cached sessions (useful for testing or memory pressure).
 */
export function clearModelCache(): void {
  sessions.clear();
}

/**
 * Check whether a session is currently cached for the given model ID.
 */
export function hasCachedModel(id: string): boolean {
  return sessions.has(id);
}
