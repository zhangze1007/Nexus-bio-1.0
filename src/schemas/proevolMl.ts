/**
 * Zod schema for the /api/proevol-ml request body.
 *
 * The `artifact` is validated structurally at the boundary by isProEvolArtifact
 * (runtime guard); here we validate the ML control fields.
 */
import { z } from "zod";

export const ProEvolMLRequestSchema = z.object({
  // Artifact shape is validated by isProEvolArtifact in the route; accept object here.
  artifact: z.object({}).passthrough(),
  modelType: z.enum(["linear", "ridge", "lasso", "decision_tree", "random_forest"]).optional(),
  seed: z.number().int().optional(),
  predictSequences: z.array(z.string()).max(1000).optional(),
});

export type ProEvolMLRequestInput = z.infer<typeof ProEvolMLRequestSchema>;
