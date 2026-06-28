/**
 * Plugin manifest and input validation using Zod.
 *
 * Provides two validators:
 * - validateManifest: checks that a raw object conforms to PluginManifest schema
 * - validateInputs: checks that runtime inputs match a manifest's declared inputs
 */

import { z } from "zod";
import type { PluginManifest } from "./types";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const pluginInputSchema = z.object({
  name: z.string().min(1, "Input name is required"),
  type: z.enum(["string", "number", "boolean", "file", "json"]),
  required: z.boolean(),
  description: z.string(),
  default: z.unknown().optional(),
});

const pluginOutputSchema = z.object({
  name: z.string().min(1, "Output name is required"),
  type: z.enum(["string", "number", "json", "file"]),
  description: z.string(),
});

const pluginUISchema = z.object({
  icon: z.string(),
  color: z.string(),
  category: z.string(),
});

const pluginEngineSchema = z.object({
  runtime: z.enum(["javascript", "python", "wasm"]),
  entrypoint: z.string().min(1, "Engine entrypoint is required"),
  timeoutMs: z.number().positive().optional(),
  memoryLimitMb: z.number().positive().optional(),
});

export const pluginManifestSchema = z.object({
  name: z.string().min(1, "Plugin name is required"),
  version: z.string().min(1, "Plugin version is required"),
  description: z.string().min(1, "Plugin description is required"),
  author: z.string().min(1, "Plugin author is required"),
  license: z.string().optional(),
  inputs: z.array(pluginInputSchema).min(1, "At least one input is required"),
  outputs: z.array(pluginOutputSchema).min(1, "At least one output is required"),
  ui: pluginUISchema.optional(),
  engine: pluginEngineSchema,
});

// ---------------------------------------------------------------------------
// validateManifest
// ---------------------------------------------------------------------------

/**
 * Validate a raw value against the PluginManifest schema.
 * Returns `{ valid: true, errors: [] }` on success, or
 * `{ valid: false, errors: [...] }` with human-readable messages on failure.
 */
export function validateManifest(manifest: unknown): {
  valid: boolean;
  errors: string[];
} {
  const result = pluginManifestSchema.safeParse(manifest);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { valid: false, errors };
}

// ---------------------------------------------------------------------------
// validateInputs
// ---------------------------------------------------------------------------

/**
 * Validate runtime inputs against a manifest's declared input descriptors.
 *
 * Checks:
 * 1. All required inputs are present
 * 2. No unknown inputs are provided
 * 3. Each value matches its declared type
 */
export function validateInputs(
  manifest: PluginManifest,
  inputs: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const declaredNames = new Set(manifest.inputs.map((i) => i.name));
  const providedNames = Object.keys(inputs);

  // Check for unknown inputs
  for (const name of providedNames) {
    if (!declaredNames.has(name)) {
      errors.push(`Unknown input: "${name}" is not declared in the manifest`);
    }
  }

  // Check each declared input
  for (const decl of manifest.inputs) {
    const value = inputs[decl.name];
    const isProvided = decl.name in inputs && value !== undefined;

    if (decl.required && !isProvided) {
      errors.push(`Required input "${decl.name}" is missing`);
      continue;
    }

    if (!isProvided) continue;

    // Type check
    const typeOk = checkType(decl.type, value);
    if (!typeOk) {
      errors.push(`Input "${decl.name}" expected type "${decl.type}", got "${typeof value}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkType(expected: "string" | "number" | "boolean" | "file" | "json", value: unknown): boolean {
  switch (expected) {
    case "string":
    case "file":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "json":
      return typeof value === "object" && value !== null;
    default:
      return false;
  }
}
