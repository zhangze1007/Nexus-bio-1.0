/**
 * ML Model Serving — Predictor
 *
 * Orchestrates model lookup, input validation, ONNX inference, and output
 * extraction. Designed to be called from the API route layer.
 */

import { loadModel } from "./modelLoader";
import { getModel } from "./modelRegistry";
import type { PredictionRequest, PredictionResponse } from "./types";

/**
 * Run inference for the given prediction request.
 *
 * 1. Looks up the model in the registry.
 * 2. Loads (or retrieves cached) ONNX session.
 * 3. Validates inputs against the model schema.
 * 4. Converts inputs to ONNX tensors and runs inference.
 * 5. Extracts scalar/vector outputs from result tensors.
 *
 * @throws {Error} if model not found, inputs missing, or inference fails
 */
export async function predict(request: PredictionRequest): Promise<PredictionResponse> {
  const model = getModel(request.modelId);
  if (!model) {
    throw new Error(`Model not found: ${request.modelId}`);
  }

  // Validate inputs before loading model (fail fast)
  for (const key of Object.keys(model.inputSchema)) {
    if (request.inputs[key] === undefined) {
      throw new Error(`Missing input: ${key}`);
    }
  }

  const session = await loadModel(model);
  const ort = await import("onnxruntime-web");
  const startTime = performance.now();

  // Convert inputs to ONNX tensors
  const feeds: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(model.inputSchema)) {
    const value = request.inputs[key];
    if (schema.type === "number") {
      feeds[key] = new ort.Tensor("float32", [value as number], [1, 1]);
    } else if (schema.type === "number[]") {
      const arr = value as number[];
      feeds[key] = new ort.Tensor("float32", arr, [1, arr.length]);
    }
  }

  // Run inference
  const results = await session.run(feeds as Record<string, import("onnxruntime-web").Tensor>);
  const latencyMs = performance.now() - startTime;

  // Extract outputs
  const outputs: Record<string, number | number[]> = {};
  const resultMap = results as Record<string, { data: Float32Array }>;
  for (const [key, schema] of Object.entries(model.outputSchema)) {
    const tensor = resultMap[key];
    if (tensor) {
      if (schema.type === "number") {
        outputs[key] = tensor.data[0];
      } else {
        outputs[key] = Array.from(tensor.data);
      }
    }
  }

  return {
    modelId: model.id,
    version: model.version,
    outputs,
    latencyMs,
  };
}
