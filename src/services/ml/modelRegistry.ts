/**
 * ML Model Serving — Model Registry
 *
 * Static registry of available pre-trained models. Each entry describes
 * the model's I/O schema, file path, and metadata. No actual .onnx files
 * are shipped yet — the registry is the source of truth for what models
 * exist and how to invoke them.
 */

import type { ModelMetadata } from "./types";

const MODELS: ModelMetadata[] = [
  {
    id: "yield-predictor-v1",
    name: "Yield Predictor",
    version: "1.0.0",
    description: "Predicts metabolic yield from pathway features",
    inputSchema: {
      pathway_length: { type: "number" },
      num_heterologous: { type: "number" },
      thermodynamic_feasibility: { type: "number" },
      carbon_efficiency: { type: "number" },
    },
    outputSchema: {
      predicted_yield: { type: "number" },
    },
    framework: "onnx",
    filePath: "/models/yield-predictor-v1.onnx",
    createdAt: "2026-06-25",
  },
  {
    id: "enzyme-activity-v1",
    name: "Enzyme Activity Predictor",
    version: "1.0.0",
    description: "Predicts enzyme kcat from sequence features",
    inputSchema: {
      sequence_length: { type: "number" },
      molecular_weight: { type: "number" },
      isoelectric_point: { type: "number" },
      gravy: { type: "number" },
    },
    outputSchema: {
      log_kcat: { type: "number" },
    },
    framework: "onnx",
    filePath: "/models/enzyme-activity-v1.onnx",
    createdAt: "2026-06-25",
  },
];

/**
 * Retrieve a single model by its unique ID.
 * Returns `undefined` if no model matches.
 */
export function getModel(id: string): ModelMetadata | undefined {
  return MODELS.find((m) => m.id === id);
}

/**
 * List all registered models.
 */
export function listModels(): ModelMetadata[] {
  return MODELS;
}
