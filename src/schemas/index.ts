/**
 * Zod validation schemas for API routes.
 *
 * Each schema validates the request body at the top of its handler,
 * providing typed input and structured error messages before any
 * business logic runs.
 */
export { AnalyzeRequestSchema, type AnalyzeRequest } from "./analyze";
export { FBARequestSchema, type FBARequest } from "./fba";
export { WorkbenchPutSchema, type WorkbenchPutBody } from "./workbench";

import type { z } from "zod";

/**
 * Structured validation error for API responses.
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate data against a Zod schema. Returns either the parsed data
 * or a flat list of { field, message } errors suitable for API responses.
 */
export function validateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; errors: ValidationError[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
  return { ok: false, errors };
}
