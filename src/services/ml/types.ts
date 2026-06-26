/**
 * ML Model Serving — Type Definitions
 *
 * Core interfaces for model registry, prediction requests/responses,
 * and ONNX model metadata.
 */

export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  inputSchema: Record<string, { type: "number" | "string" | "number[]"; shape?: number[] }>;
  outputSchema: Record<string, { type: "number" | "number[]"; shape?: number[] }>;
  metrics?: Record<string, number>; // r2, rmse, etc.
  framework: "onnx";
  filePath: string; // path to .onnx file
  createdAt: string;
}

export interface PredictionRequest {
  modelId: string;
  inputs: Record<string, number | number[] | string>;
}

export interface PredictionResponse {
  modelId: string;
  version: string;
  outputs: Record<string, number | number[]>;
  latencyMs: number;
  confidence?: number;
}
