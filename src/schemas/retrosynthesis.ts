/**
 * Zod schema for the /api/retrosynthesis request body.
 */
import { z } from "zod";

export const RetrosynthesisRequestSchema = z.object({
  targetSmiles: z.string().min(1, "targetSmiles is required"),
  precursorSmiles: z.string().optional(),
  maxSteps: z.number().int().positive().max(20).optional(),
  maxPathways: z.number().int().positive().max(100).optional(),
});

export type RetrosynthesisRequestInput = z.infer<typeof RetrosynthesisRequestSchema>;
